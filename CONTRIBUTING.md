# Desarrollo de la herramienta

Esta guía es para quien modifica **el generador** (su código, sus plantillas, sus tests). Para usarlo sobre tus componentes, consulta el [README](README.md). Para el diseño y las decisiones del proyecto, la [documentación](docs/README.md).

## Preparar el entorno

| Herramienta  | Para qué                                                      |
| ------------ | ------------------------------------------------------------- |
| Node.js ≥ 20 | Generador y tests (`.nvmrc` fija la 24)                       |
| Docker       | `make smoke`: valida en Drupal 11 lo que produce el generador |

```bash
npm install
```

Instala las dependencias de desarrollo (ESLint y Prettier; el generador en sí no tiene dependencias) y activa el hook de pre-commit (`.githooks/pre-commit`) mediante el script `prepare`.

## Qué valida cada comando

Hay dos cosas distintas que validar, y cada comando se ocupa de una:

| Comando       | Valida                                                             | Sobre qué archivos                              | ¿Modifica? |
| ------------- | ------------------------------------------------------------------ | ----------------------------------------------- | ---------- |
| `make check`  | El **código del generador**: formato, lint y tests                 | `tools/`, `test/`, configuración y docs         | No         |
| `make format` | Aplica el formato de Prettier al código del generador              | Los mismos                                      | **Sí**     |
| `make smoke`  | La **salida del generador**: que lo que produce funcione en Drupal | Un componente temporal que genera y luego borra | No         |

`make check` ignora `web/` a propósito (está excluida en Prettier y ESLint): ahí viven componentes generados, que son PHP, YAML y Twig y se rigen por los estándares de Drupal, no por las reglas de JavaScript del generador. Para revisar un componente concreto existe `make phpcs name=<n>`, documentado en el README.

### `make check`

Corre Prettier en modo verificación, ESLint y 27 tests con `node:test`, con un umbral de cobertura del 90 % (la real es del 99,7 % de líneas y el 100 % de ramas). Es exactamente lo que ejecutan el hook de pre-commit y CI.

| Archivo de test           | Cubre                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `test/validate.test.mjs`  | Reglas de machine name, longitud, reservados y sugerencias                             |
| `test/generator.test.mjs` | Estructura y contenido de los archivos, no sobrescritura y rollback ante fallos de E/S |
| `test/cli.test.mjs`       | Argumentos, mensajes, códigos de salida y el CLI como proceso real                     |

### `make smoke` (~20 s, Docker)

Responde a la pregunta: ¿lo que genera la herramienta funciona en un Drupal real? Es automático y no interactivo, porque CI también lo ejecuta.

| Paso | Qué hace                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------ |
| 0    | Verifica que Node y Docker estén disponibles                                                                 |
| 1    | Genera un componente de prueba (`smoke_component`) en una carpeta temporal                                   |
| 2    | Arranca un contenedor `drupal:11-php8.3` (`scaffold-smoke-<pid>`) e instala Drush y `drupal/coder`           |
| 3    | `php -l` y `phpcs --standard=Drupal,DrupalPractice` sobre el código generado, listando cada archivo revisado |
| 4    | Instala un sitio Drupal (SQLite) y habilita el módulo                                                        |
| 5    | Renderiza el componente y comprueba el HTML resultante                                                       |

Al terminar se borran el contenedor y la carpeta temporal. `KEEP=1 make smoke` deja el contenedor en marcha para inspeccionarlo; el script indica cómo entrar (`docker exec -it ... bash`) y cómo borrarlo.

## Arquitectura

```text
tools/scaffold/
  cli.mjs           # entrypoint: llama a run() y fija el código de salida
  run.mjs           # argumentos, mensajes al usuario y códigos de salida
  generator.mjs     # creación atómica, sin sobrescribir, con rollback
  templates.mjs     # contenido de cada archivo generado
  validate.mjs      # reglas de machine name y sugerencias
test/               # tests con node:test
scripts/
  phpcs-drupal.sh   # make phpcs   (uso)
  demo-drupal.sh    # make demo    (uso)
  smoke-drupal.sh   # make smoke   (desarrollo / CI)
  lib/common.sh     # salida por pasos y verificación de Docker, compartidos
.githooks/pre-commit         # corre make check antes de cada commit
.github/workflows/ci.yml     # CI: check + smoke en cada PR
```

- `run()` recibe `argv`, `cwd`, `env` y las funciones de salida inyectadas, y devuelve el código de salida en lugar de llamar a `process.exit`: el CLI se testea sin lanzar procesos.
- `generateComponent()` acepta un `fs` inyectable, lo que permite simular fallos de E/S en los tests (por ejemplo, el rollback).
- Los errores de dominio (`InvalidNameError`, `TargetExistsError`) se traducen a mensajes en un único lugar, `run.mjs`.

## Cambiar lo que genera la herramienta

Todas las plantillas están en `tools/scaffold/templates.mjs`. Para añadir o modificar un archivo generado:

1. Edita la plantilla en `templates.mjs` (y la lista de `buildFiles()` si es un archivo nuevo).
2. Ajusta los tests de `test/generator.test.mjs` que verifican estructura y contenido.
3. `make check`: el código del generador sigue en verde.
4. `make smoke`: lo generado sigue cumpliendo los estándares Drupal y se instala y renderiza.

## CI

`.github/workflows/ci.yml` corre en cada PR y en cada push a `main`:

- **check:** `npm ci` + `npm run check`.
- **smoke:** `scripts/smoke-drupal.sh`, después de que `check` pase.

## Convenciones

- Commits atómicos con [Conventional Commits](https://www.conventionalcommits.org/es/) (`feat(scaffold): ...`, `fix(ci): ...`, `docs: ...`).
- Código y comentarios en inglés; documentación en español.
- El hook de pre-commit corre `npm run check`; CI lo repite, así que saltarlo con `--no-verify` solo retrasa el error.

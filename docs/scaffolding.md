# Bloque 1 · Automatización ligera de scaffolding

Diseño del generador y cómo responde a lo que pedía el reto. Para usarlo, consulta el [README](../README.md).

## Problema

Cada componente nuevo se creaba a mano en 3 o 4 archivos dispersos, lo que producía nombres inconsistentes, errores de tipeo y desorden en el repositorio.

## Solución

Un CLI en Node.js **sin dependencias en runtime** (solo `fs`, `path` y `util.parseArgs`), expuesto como `npm run scaffold <nombre>` y `make component name=<nombre>`. La correspondencia entre cada requisito del reto y su test está en [requirements.md](requirements.md).

## Qué genera y por qué

| Archivo                        | Qué hace                                                                                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<nombre>.info.yml`            | Registra el módulo en Drupal: `name`, `type: module`, `description`, `package`, `core_version_requirement`.                                                                                  |
| `<nombre>.module`              | `hook_theme()` declara el theme hook `<nombre>`, sus variables (`title`, `content`) y qué plantilla usa.                                                                                     |
| `templates/<nombre>.html.twig` | El marcado. Adjunta la librería con `attach_library()` y usa clases BEM (`hero-banner`, `hero-banner__title`).                                                                               |
| `<nombre>.libraries.yml`       | Declara la librería: qué CSS y JS cargar y de qué depende (`core/drupal`, `core/once`).                                                                                                      |
| `css/<nombre>.css`             | Estilos base.                                                                                                                                                                                |
| `js/<nombre>.js`               | Un `Drupal.behavior` con `once()`: se ejecuta una sola vez por elemento, aunque la página recargue partes por AJAX. Añade la clase `--ready`, que sirve para comprobar que el JS se ejecutó. |

Cuando Drupal renderiza `['#theme' => 'hero_banner']`, la cadena es la siguiente:

```text
hook_theme (.module) → plantilla Twig → attach_library() → .libraries.yml → carga css/ y js/
```

Por eso, además de los archivos mínimos del reto (`.info.yml`, `.html.twig` y CSS/JS), se generan `.module` y `.libraries.yml`: sin ellos la plantilla no se usa y el CSS y el JS no se cargan. Las subcarpetas `templates/`, `css/` y `js/` siguen la convención de Drupal.

**Consistencia de nombres:** el único dato de entrada es el nombre, y de él se derivan todas las variantes: `hero_banner` → `Hero Banner` (etiqueta), `hero-banner` (clase CSS), `heroBanner` (behavior JS). Así desaparecen los errores de tipeo entre archivos, que es el problema que planteaba el reto.

**Consistencia de nombres:** el único dato de entrada es el nombre, y de él se derivan todas las variantes: `hero_banner` → `Hero Banner` (etiqueta), `hero-banner` (clase CSS), `heroBanner` (behavior JS). Así desaparecen los errores de tipeo entre archivos, que es justo el problema de partida.

## Robustez

- **Validación del nombre.** Exige un _machine name_ de Drupal (`^[a-z][a-z0-9_]*$`, máximo 50 caracteres, el límite `DRUPAL_EXTENSION_NAME_MAX_LENGTH` de core) y rechaza los nombres reservados más comunes (módulos de core y palabras reservadas de PHP). Si el nombre no vale, sugiere la corrección. La misma regla impide _path traversal_ (`../algo`).
- **Sin sobrescritura y sin condiciones de carrera.** La carpeta se crea con un `mkdir` no recursivo, que falla de forma atómica con `EEXIST`. Así, comprobar y crear son una sola operación, sin una ventana entre ambas. Además, cada archivo se escribe con el flag `wx`, que falla si el archivo ya existe.
- **Sin resultados a medias.** Si una escritura falla (disco lleno, permisos), se borra la carpeta recién creada. Es seguro porque no existía antes de esta ejecución.
- **Errores tipados y códigos de salida.** `InvalidNameError` y `TargetExistsError` se traducen a mensajes de usuario con código `1`. Cualquier otro error es inesperado y sale con código `2`.

## Arquitectura

```text
tools/scaffold/
  cli.mjs           # entrypoint: llama a run() y fija el código de salida
  run.mjs           # argumentos, mensajes al usuario y códigos de salida
  generator.mjs     # creación atómica, sin sobrescribir, con rollback
  templates.mjs     # contenido de cada archivo generado (único lugar a tocar para cambiar plantillas)
  validate.mjs      # reglas de machine name y sugerencias
test/               # tests con node:test
scripts/
  phpcs-drupal.sh   # make phpcs
  smoke-drupal.sh   # make smoke
  demo-drupal.sh    # make demo
  lib/common.sh     # salida por pasos y verificación de Docker, compartidos
.githooks/pre-commit              # corre make check antes de cada commit
.github/workflows/ci.yml          # CI de este repo: check + smoke en cada PR
examples/drupal-pr-pipeline.yml   # pipeline de referencia para el repo Drupal (Bloque 2)
docs/                             # requerimientos con trazabilidad y ADR
```

- `run()` recibe `argv`, `cwd`, `env` y funciones de salida inyectadas, y devuelve el código de salida en lugar de llamar a `process.exit`. Así el CLI se testea sin lanzar procesos.
- `generateComponent()` acepta un `fs` inyectable, lo que permite simular fallos de E/S en los tests (por ejemplo, el rollback).
- `templates.mjs` es el único lugar donde se tocan las plantillas.

## Estrategia de validación

Cada nivel cubre algo que el anterior no cubre:

| Nivel                   | Qué demuestra                                                                    | Dónde corre            |
| ----------------------- | -------------------------------------------------------------------------------- | ---------------------- |
| `make check` (27 tests) | La lógica del generador: validación, contenido, no sobrescritura, rollback y CLI | Local, pre-commit y CI |
| `make smoke`            | El código generado cumple `phpcs` (Drupal) y se instala y renderiza en Drupal 11 | Local (Docker) y CI    |
| `make phpcs name=<n>`   | Un componente concreto, incluso editado a mano, cumple los estándares Drupal     | Local (Docker)         |
| `make demo name=<n>`    | Verificación visual en el navegador: CSS cargado y JS ejecutado                  | Local (Docker)         |

La cobertura es del 99,7 % de líneas y el 100 % de ramas, con un umbral de CI del 90 %.

## Decisión principal

Node nativo en lugar de Plop o Yeoman. Plop daría prompts interactivos y plantillas Handlebars, pero añade una dependencia y otra sintaxis que el equipo tendría que mantener. Con template literals, el generador cabe en unas 300 líneas, se testea casi por completo y corre en cualquier máquina con Node. Si el catálogo de plantillas crece (variantes por tipo de componente, SDC, bloques), migrar a Plop es barato porque `templates.mjs` ya está aislado. Detalle en [ADR 0001](adr/0001-native-node-scaffolder.md). Trazabilidad de requerimientos a tests en [requirements.md](requirements.md).

## Supuestos y límites

- El reto pide `<nombre>.info.yml` con `type`. Se generó un **módulo** (`type: module`) porque es el contenedor que permite `hook_theme` y librerías propias. Si el equipo usa _Single Directory Components_, el cambio se limita a `templates.mjs` (`<nombre>.component.yml` + `<nombre>.twig`).
- La lista de nombres reservados no es exhaustiva: no detecta colisiones con módulos contrib instalados en un sitio concreto.
- `make phpcs` revisa PHP y YAML. El lint de Twig, CSS y JS con las reglas de Drupal core se cubre en el pipeline de la plataforma ([configuracion-y-ci.md](configuracion-y-ci.md)), no en este repo.

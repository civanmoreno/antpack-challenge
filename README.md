# Reto técnico: scaffolding, gobernanza de configuración y liderazgo (Drupal)

Respuesta a los tres bloques del reto:

1. [Automatización de scaffolding](#bloque-1--automatización-ligera-de-scaffolding): código funcional, con tests y verificado en un Drupal 11 real.
2. [Estrategia de calidad y ciclo de configuración](#bloque-2--estrategia-de-calidad-y-ciclo-de-configuración).
3. [Liderazgo situacional](#bloque-3--liderazgo-situacional-y-gestión-de-fricciones).

---

## Bloque 1 · Automatización ligera de scaffolding

Un script de Node.js **sin dependencias en runtime** (solo módulos nativos: `fs`, `path`, `util.parseArgs`) que genera un módulo/componente Drupal listo para habilitar.

### Requisitos

- Node.js ≥ 20 (`.nvmrc` fija la 24)
- `make` (opcional)
- Docker (solo para el smoke test opcional en Drupal)

### Uso

```bash
npm install                        # solo dev deps: eslint y prettier

npm run scaffold hero_banner       # o bien:
make component name=hero_banner

# Carpeta base distinta (por defecto web/modules/custom):
npm run scaffold -- hero_banner --dir web/themes/custom/mi_tema/components
make component name=hero_banner dir=otra/ruta
SCAFFOLD_DIR=otra/ruta npm run scaffold hero_banner
```

Salida:

```text
✔ Componente "hero_banner" creado en web/modules/custom/hero_banner
  + web/modules/custom/hero_banner/hero_banner.info.yml
  + web/modules/custom/hero_banner/hero_banner.libraries.yml
  + web/modules/custom/hero_banner/hero_banner.module
  + web/modules/custom/hero_banner/templates/hero_banner.html.twig
  + web/modules/custom/hero_banner/css/hero_banner.css
  + web/modules/custom/hero_banner/js/hero_banner.js

Siguiente paso: drush en hero_banner -y
```

### Qué genera y por qué

| Archivo                        | Rol                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `<nombre>.info.yml`            | Metadatos: `name`, `type: module`, `description`, `package`, `core_version_requirement: ^10.3 \|\| ^11`.           |
| `<nombre>.libraries.yml`       | Configuración YAML que registra el CSS y el JS como librería de Drupal (dependencias `core/drupal` y `core/once`). |
| `<nombre>.module`              | `hook_theme()` que registra el theme hook y apunta a la plantilla. Sin esto, la plantilla no se renderiza.         |
| `templates/<nombre>.html.twig` | Marcado con clases BEM (`hero-banner`, `hero-banner__title`) y `attach_library()`.                                 |
| `css/<nombre>.css`             | Estilos base del componente.                                                                                       |
| `js/<nombre>.js`               | `Drupal.behaviors` con `once()`, el patrón correcto para que el JS no se ejecute dos veces con AJAX/BigPipe.       |

Se generan los dos archivos opcionales (CSS **y** JS) y además `.libraries.yml` y `.module` porque, sin ellos, el componente no es funcional en Drupal: el objetivo es que funcione en cuanto se habilita, no solo crear archivos sueltos. Las subcarpetas `templates/`, `css/` y `js/` siguen la convención de Drupal; los nombres de archivo usan `<nombre>` tal como pide el reto.

Un solo nombre de entrada deriva todas las variantes de forma consistente (`hero_banner` → `Hero Banner`, `hero-banner`, `heroBanner`), que es justo lo que elimina los errores de tipeo entre archivos.

### Controles de robustez

- **Nombre válido:** debe ser un _machine name_ de Drupal (`^[a-z][a-z0-9_]*$`, máx. 50 caracteres) y no puede ser un nombre reservado (`node`, `system`, `class`...). Si no lo es, aborta y **sugiere** la corrección:
  ```text
  ✖ El nombre "Hero-Banner" no es un machine name válido: usa minúsculas, números y guion bajo, empezando por letra. ¿Quisiste decir "hero_banner"?
  ```
  La misma regla bloquea rutas como `../algo`.
- **Nunca sobrescribe:** si la carpeta existe (o hay un archivo con ese nombre), aborta sin tocar nada:
  ```text
  ✖ El componente "hero_banner" ya existe en web/modules/custom/hero_banner
    No se creó ni modificó ningún archivo.

    Opciones:
      • Usa otro nombre para el nuevo componente.
      • Si quieres regenerarlo desde cero, borra antes la carpeta: rm -rf web/modules/custom/hero_banner
  ```
  La comprobación es un `mkdir` no recursivo, que falla de forma atómica: no hay ventana entre "comprobar" y "crear". Los archivos se escriben con el flag `wx` (fallan si ya existen).
- **Sin resultados a medias:** si falla una escritura (disco lleno, permisos), borra la carpeta que acaba de crear.
- **Códigos de salida:** `0` éxito, `1` error de uso (nombre inválido, carpeta existente, argumentos), `2` error inesperado de E/S.

### Verificación

```bash
make check   # prettier + eslint + tests con umbral de cobertura del 90 %
make smoke   # genera un componente, pasa phpcs (Drupal) y lo instala y renderiza en Drupal 11 (Docker)
```

- 27 tests con `node:test` (validación, generador, CLI y proceso real) con 100 % de cobertura de ramas y 99,7 % de líneas (umbral en CI: 90 %).
- `make smoke` comprueba primero que Node y Docker estén disponibles (con un mensaje claro si Docker no está instalado o no responde) y luego muestra cada paso: genera un componente, arranca un contenedor `drupal:11-php8.3`, ejecuta `php -l` y `phpcs --standard=Drupal,DrupalPractice` (drupal/coder) listando los archivos revisados, instala Drupal, habilita el módulo y renderiza el theme hook comprobando el HTML. El contenedor se borra al terminar. Con `KEEP=1 make smoke` se queda en marcha para inspeccionarlo con `docker exec`. Es no interactivo a propósito, porque CI también lo ejecuta. Para ver el componente en el navegador está `make demo`.
- CI (`.github/workflows/ci.yml`) corre ambos en cada PR.

**Validarlo tú mismo en el navegador** (requiere Docker):

```bash
make component name=hero_banner
make demo name=hero_banner     # Drupal 11 en http://localhost:8080 con tu componente montado
```

Abre `http://localhost:8080/scaffold-demo` e inspecciona el bloque (F12): el wrapper tiene la clase `hero-banner--ready`, que añade el JS del componente al ejecutarse, y en la pestaña Network aparecen `css/hero_banner.css` y `js/hero_banner.js`. El puerto se cambia con `DEMO_PORT=8081`. Para apagarlo: `make demo-stop`. La ruta `/scaffold-demo` la crea un módulo auxiliar que existe solo dentro del contenedor de la demo y no forma parte del código generado.

- `npm install` activa un hook de pre-commit (`.githooks/pre-commit`) que corre `npm run check`. Es el mismo gate que CI, en unos 2 segundos.
- Trazabilidad requerimiento → test en [`docs/requirements.md`](docs/requirements.md).

### Arquitectura y estructura

```text
tools/scaffold/
  cli.mjs        # entrypoint (#!/usr/bin/env node)
  run.mjs        # parseo de argumentos, mensajes y códigos de salida
  generator.mjs  # creación atómica, sin sobrescribir y con rollback
  templates.mjs  # contenido de cada archivo generado
  validate.mjs   # reglas de machine name y sugerencias
test/            # tests con node:test
scripts/smoke-drupal.sh
examples/drupal-pr-pipeline.yml   # pipeline de referencia del Bloque 2
```

**Decisión principal:** Node nativo en lugar de Plop/Yeoman. Plop daría prompts interactivos y plantillas Handlebars, pero añade una dependencia y otra sintaxis que el equipo tendría que mantener. Con template literals el generador cabe en ~300 líneas, se testea casi por completo y corre en cualquier máquina con Node. Si el catálogo de plantillas crece (variantes por tipo de componente, SDC, bloques), migrar a Plop es barato porque `templates.mjs` ya está aislado. Detalle en [ADR 0001](docs/adr/0001-native-node-scaffolder.md).

---

## Bloque 2 · Estrategia de calidad y ciclo de configuración

### Gobernanza de configuración: "Git es la fuente de verdad, la BD es un derivado"

**Flujo:**

```text
local: cambio en la UI → drush cex → commit (config/sync + código) → PR
                                                                   │
  CI: site:install --existing-config + cim + cex sin diff ◄────────┘
                                                                   │
  deploy (todos los entornos): composer install → drush deploy ◄───┘
           (updb → cim → cr → deploy hooks, siempre en ese orden)
```

1. **Un único directorio de configuración** (`config/sync`) versionado. Se instala desde ahí (`drush si --existing-config`), así que cualquier entorno se puede reconstruir desde Git.
2. **El deploy siempre importa** con `drush deploy`. Lo que alguien cambie a mano en un entorno se **sobrescribe** en el siguiente despliegue. Esto convierte el problema actual (cambios manuales que pisan el código) en lo contrario: el código pisa los cambios manuales, de forma predecible.
3. **Diferencias por entorno con `config_split`** (p. ej. `devel` y logs detallados solo en dev, caché agresiva en prod) y **secretos y valores de infraestructura en `settings.php` vía variables de entorno**, nunca en el YAML exportado.
4. **Configuración que de verdad edita el negocio** (textos de banners, menús, ajustes de campaña) se excluye con `config_ignore` o se modela como **contenido**, no como config. Es la decisión clave: si no se separa, el equipo de contenido y el pipeline se pelean por siempre.
5. **Candados en entornos compartidos:**
   - `config_readonly` en stage y prod: la UI administrativa no deja guardar formularios de configuración. El cambio "se hace en local y se sube por PR".
   - Detección de drift: un job programado (o un paso previo al deploy) corre `drush config:status`; si hay diferencias, alerta al canal del equipo **antes** de que el deploy las borre en silencio.
6. **Cambios estructurales** (borrar campos, migrar datos) van en `hook_update_N` / `hook_deploy_NAME`, nunca a mano en la BD, para que sean repetibles en cada entorno.

### Pipeline de calidad en cada PR

El criterio: **pocos checks, rápidos, en paralelo y bloqueantes**. Un check lento o ruidoso acaba ignorado. Pipeline de referencia completo en [`examples/drupal-pr-pipeline.yml`](examples/drupal-pr-pipeline.yml).

| Etapa                  | Check                                                                                          | Qué evita                                                       | Tiempo aprox. |
| ---------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------- |
| Estática (en paralelo) | `composer validate --strict` + `composer audit`                                                | Lock desincronizado, dependencias con CVEs                      | < 1 min       |
|                        | `phpcs --standard=Drupal,DrupalPractice` sobre código propio                                   | Desorden de estilo, malas prácticas de Drupal                   | < 1 min       |
|                        | `phpstan` + `phpstan-drupal` + reglas de deprecaciones                                         | Errores de tipo, llamadas a APIs deprecadas (bloquean upgrades) | 1–2 min       |
|                        | Lint de Twig y YAML; ESLint/Stylelint en el frontend                                           | Plantillas o YAML rotos que solo fallan en runtime              | < 1 min       |
| Integridad             | `site:install --existing-config` → `updb` → `cim` → `cex` + `git diff --exit-code config/sync` | Config incompleta en Git, dependencias de config faltantes      | 3–5 min       |
|                        | PHPUnit (unit + kernel) del código propio                                                      | Regresiones de lógica                                           | 2–5 min       |

**Reglas de la rama principal:** branch protection con los checks anteriores como _required_, al menos 1 aprobación de code review, rama al día con `main` y sin push directo.

**Para no ralentizar al equipo:**

- Los mismos checks corren en local con un comando (`make check`) y los rápidos en un hook de pre-commit, solo sobre archivos modificados. El CI confirma, no sorprende.
- Caché de `vendor/` y `node_modules`, `concurrency` que cancela ejecuciones obsoletas y jobs en paralelo. Objetivo: **< 10 minutos** de feedback.
- **Fuera del gate de PR** (nightly o pre-release): E2E con Playwright, regresión visual, Lighthouse/accesibilidad y tests funcionales completos. Son valiosos, pero demasiado lentos o inestables para bloquear cada merge.
- Para linters en código legado: aplicar solo a archivos nuevos o modificados (o con un _baseline_ de PHPStan) y subir el nivel de forma gradual, para no bloquear al equipo con miles de errores históricos el primer día.

---

## Bloque 3 · Liderazgo situacional y gestión de fricciones

### Escenario A: "hacerlo a mano es más rápido"

Lo trato como un problema de **datos y de diseño de la herramienta**, no de obediencia.

1. **En privado y con curiosidad, no en el daily ni en el review del PR.** "¿Qué parte te frena exactamente?" A veces tiene razón: el linter es lento, hay reglas ruidosas o el generador no cubre su caso. Si es así, el problema es mío y lo corrijo.
2. **Separo lo negociable de lo que no.** Cómo trabaja en local es suyo. Lo que llega a `main` tiene que pasar los checks; no es una preferencia personal mía, es el acuerdo del equipo, y el CI lo aplica igual para todos (incluido yo).
3. **Hablo de su beneficio, no del mío.** El generador tarda 1 segundo contra unos minutos a mano, y elimina justo los errores (nombres inconsistentes, librería mal declarada) que luego cuestan un ciclo de review o un bug en stage. Los linters en pre-commit le avisan en segundos de lo que el reviewer le diría al día siguiente.
4. **Le doy la palanca.** Le propongo que mejore la herramienta: que el pre-commit solo revise los archivos modificados, una regla que le sobra, un flag nuevo en el generador. Quien la mejora deja de verla como impuesta, y su crítica se convierte en una mejora para todos.
5. **Medimos y revisamos.** Acordamos probarlo 2 semanas y comparar tiempo de PR y comentarios de review. Si después de eso sigue saltándose el proceso, la conversación pasa a ser de expectativas del rol, de forma directa y en privado. Pero casi nunca se llega ahí si los pasos anteriores se hicieron bien.

### Escenario B: cambio directo en la BD de producción 15 minutos antes del lanzamiento

**Postura técnica:** no modifico la BD de producción a mano, y tampoco me limito a decir "no": mi trabajo es que la campaña salga **a tiempo y de forma segura**. Un `UPDATE` manual en prod sin backup ni revisión puede romper el sitio justo cuando más tráfico va a tener, y el próximo `drush deploy` lo deshará en silencio (Bloque 2). El riesgo de la "solución rápida" es mayor que el del retraso.

**Primeros 3 minutos: triage.**

- ¿La prueba rota está relacionada con el cambio de la campaña o es un test inestable o preexistente? (¿falla también en `main`?)
- ¿Qué necesita exactamente la campaña: código, configuración o solo contenido?

**Alternativas, de la más a la menos preferible:**

1. **Si es contenido** (banner, landing, precio, fecha): se hace por la **UI administrativa de producción**, que es el canal legítimo para el contenido y deja revisiones y rollback. No requiere pipeline. Suele resolver la mayoría de estos casos.
2. **Si la prueba es inestable o no está relacionada:** re-ejecutar el job. Si vuelve a fallar, aplicar el **procedimiento de excepción acordado**: dos aprobadores (tech lead + PM) marcan ese test como `skip` en un commit visible, con un ticket enlazado. El pipeline sigue corriendo todo lo demás (lint, config, el resto de tests), y el test se reactiva en menos de 24 h. Es un bypass auditable, no uno silencioso.
3. **Si la prueba detecta un fallo real:** corregir hacia adelante (fix + pipeline) o, si no da tiempo, **lanzar sin esa pieza** y que la campaña use un feature flag o la versión anterior del componente. Un retraso de 30–60 minutos es recuperable; un sitio caído en la apertura de la campaña no lo es.
4. **Último recurso, si el negocio asume el riesgo por escrito:** cambio en producción como _break-glass_: backup previo (`drush sql:dump`), script SQL o `drush` revisado por una segunda persona, ejecutado por quien tenga acceso y con plan de rollback. Después, en la misma jornada, el cambio se lleva a código y config para que el siguiente deploy no lo revierta.

**Después:** postmortem sin culpables (¿por qué un test roto llegó a 15 minutos del lanzamiento?) con acciones concretas: congelar código y hacer un despliegue de prueba 24–48 h antes de las campañas críticas, tests inestables en cuarentena y no bloqueando, y el procedimiento de excepción documentado **antes** de la siguiente crisis, no improvisado durante ella.

---

## Supuestos y límites

- El reto pide `<nombre>.info.yml` con `type`; se generó un **módulo** (`type: module`) porque es el contenedor que permite `hook_theme` y librerías propias. Si el equipo usa _Single Directory Components_, el cambio se limita a `templates.mjs` (`<nombre>.component.yml` + `<nombre>.twig`).
- El pipeline de `examples/` es una referencia para el repositorio Drupal de la plataforma: no se ejecutó aquí porque este repo no contiene un sitio Drupal. El CI propio de este repo (`ci.yml`) sí está verificado en local.

# Reto técnico: scaffolding y gobernanza de configuración (Drupal)

Respuesta a los bloques técnicos del reto:

1. [Automatización de scaffolding](#bloque-1--automatización-ligera-de-scaffolding): código funcional, con tests, validado con `phpcs` (estándares Drupal) y probado en un Drupal 11 real.
2. [Estrategia de calidad y ciclo de configuración](#bloque-2--estrategia-de-calidad-y-ciclo-de-configuración).

---

## Bloque 1 · Automatización ligera de scaffolding

Un generador de línea de comandos que crea un componente Drupal completo con un solo comando. Está escrito en Node.js **sin dependencias en runtime** (solo `fs`, `path` y `util.parseArgs`), así que basta con tener Node instalado.

### En 30 segundos

```bash
npm install                        # una sola vez: instala eslint/prettier y activa el hook de pre-commit
make component name=hero_banner    # crea web/modules/custom/hero_banner con todos sus archivos
make demo name=hero_banner         # opcional: lo ves funcionando en un Drupal real en http://localhost:8080
make demo-stop                     # apaga la demo
```

### Requisitos

| Herramienta  | Para qué                                        | Obligatoria                              |
| ------------ | ----------------------------------------------- | ---------------------------------------- |
| Node.js ≥ 20 | Ejecutar el generador y los tests               | Sí (`.nvmrc` fija la 24)                 |
| `make`       | Atajos (`make component`, `make check`...)      | No: todo tiene equivalente con `npm run` |
| Docker       | `make smoke` y `make demo` (Drupal 11 temporal) | Solo para validar en Drupal              |
| `curl`       | `make demo` comprueba la página que levanta     | Solo para la demo                        |

Los scripts que usan Docker comprueban primero que esté instalado y que el servicio responda. Si no, se detienen con un mensaje que dice qué hacer.

### 1. Generar un componente

```bash
make component name=hero_banner
# equivalente:
npm run scaffold hero_banner
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

Por defecto se crea en `web/modules/custom` (la ruta estándar de un proyecto `drupal/recommended-project`). Para cambiarla:

```bash
make component name=hero_banner dir=otra/ruta
npm run scaffold -- hero_banner --dir otra/ruta     # con npm, los flags van después de "--"
SCAFFOLD_DIR=otra/ruta npm run scaffold hero_banner # --dir tiene prioridad sobre la variable
npm run scaffold -- --help
```

En un proyecto Drupal real, el siguiente paso es habilitar el módulo (`drush en hero_banner -y`) y usarlo en cualquier render array con `['#theme' => 'hero_banner', '#title' => '...', '#content' => '...']`.

### 2. Qué genera y cómo funciona dentro de Drupal

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

### 3. Controles de robustez

- **Nombre válido.** Tiene que ser un _machine name_ de Drupal: minúsculas, números y `_`, empezando por letra, con un máximo de 50 caracteres y sin nombres reservados (`node`, `system`, `class`...). Si no lo es, el generador aborta y sugiere la corrección:
  ```text
  ✖ El nombre "Hero-Banner" no es un machine name válido: usa minúsculas, números y guion bajo, empezando por letra. ¿Quisiste decir "hero_banner"?
  ```
  La misma regla impide escribir fuera de la carpeta destino (por ejemplo, con `../algo`).
- **Nunca sobrescribe.** Si la carpeta ya existe, aborta sin tocar nada:
  ```text
  ✖ El componente "hero_banner" ya existe en web/modules/custom/hero_banner
    No se creó ni modificó ningún archivo.

    Opciones:
      • Usa otro nombre para el nuevo componente.
      • Si quieres regenerarlo desde cero, borra antes la carpeta: rm -rf web/modules/custom/hero_banner
  ```
  La comprobación y la creación son una sola operación atómica (un `mkdir` no recursivo), así que no hay ventana entre "comprobar" y "crear". Además, cada archivo se escribe con el flag `wx`, que falla si el archivo ya existe.
- **Sin resultados a medias.** Si una escritura falla (disco lleno, permisos), se borra la carpeta recién creada.
- **Códigos de salida.** `0` éxito, `1` error de uso (nombre inválido, carpeta existente, argumentos), `2` error inesperado de E/S. Con `make`, un error se ve seguido de `make: *** [...] Error 1`: esa línea la añade `make` y es normal.

### 4. Cómo validar que funciona

Hay cuatro herramientas. Cada una comprueba algo que las anteriores no cubren.

#### a) Tests automáticos: `make check` (segundos, sin Docker)

Corre Prettier, ESLint y 27 tests con `node:test`, con un umbral de cobertura del 90 % (la cobertura real es del 99,7 % de líneas y el 100 % de ramas). Los tests cubren la validación de nombres, el contenido de cada archivo, la protección contra sobrescritura, el rollback ante fallos de escritura y el CLI como proceso real. Es lo mismo que corren CI y el hook de pre-commit.

#### b) Smoke test en Drupal: `make smoke` (~20 s, Docker)

Responde a la pregunta: ¿lo que genera la herramienta funciona en un Drupal real? Es automático y no interactivo, porque CI también lo ejecuta. Muestra cada paso:

| Paso | Qué hace                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------ |
| 0    | Verifica que Node y Docker estén disponibles                                                                 |
| 1    | Genera un componente de prueba (`smoke_component`) en una carpeta temporal                                   |
| 2    | Arranca un contenedor `drupal:11-php8.3` (`scaffold-smoke-<pid>`) e instala Drush y `drupal/coder`           |
| 3    | `php -l` y `phpcs --standard=Drupal,DrupalPractice` sobre el código generado, listando cada archivo revisado |
| 4    | Instala un sitio Drupal (SQLite) y habilita el módulo                                                        |
| 5    | Renderiza el componente y comprueba el HTML resultante                                                       |

Al terminar, el contenedor y la carpeta temporal se borran. Si quieres inspeccionarlo, ejecuta `KEEP=1 make smoke`: el contenedor queda en marcha y el script te dice cómo entrar (`docker exec -it ... bash`) y cómo borrarlo.

#### c) Demo en el navegador: `make demo name=<nombre>` (1–2 min, Docker)

Sirve para verlo con tus propios ojos, con **tu** componente: el que generaste en `web/modules/custom/<nombre>`.

```bash
make component name=hero_banner   # si aún no existe
make demo name=hero_banner
```

1. Arranca un contenedor `scaffold-demo` con Drupal 11 en `http://localhost:8080`. Tu componente se **monta en solo lectura**, así que la demo no puede modificar tus archivos.
2. Instala Drupal y habilita tu módulo, junto con un módulo auxiliar `scaffold_demo` que solo existe dentro del contenedor y publica la ruta `/scaffold-demo`, que renderiza el componente.
3. Comprueba con `curl` que la página contiene el HTML, el CSS y el JS del componente.

Después, en el navegador:

- **http://localhost:8080/scaffold-demo**: abre las herramientas de desarrollo (F12) e inspecciona el bloque.
  - El wrapper debe ser `<div class="hero-banner hero-banner--ready">`. La plantilla no incluye `--ready`; la añade el JS al ejecutarse, así que si la ves, el JS funciona.
  - En la pestaña **Network** (recargando la página) aparecen `css/hero_banner.css` y `js/hero_banner.js`.
- **http://localhost:8080/user/login** (`admin` / `admin`): en _Extender_ verás el módulo habilitado.

**Para apagarla:** `make demo-stop`. Borra el contenedor y todo lo que se creó dentro (el sitio, la base de datos y el módulo auxiliar). Tus archivos en `web/modules/custom` no se tocan. Si vuelves a ejecutar `make demo`, la demo anterior se reemplaza, así que nunca se acumulan contenedores.

#### d) Estándares Drupal en tus componentes: `make phpcs name=<nombre>` (Docker)

`make smoke` aplica `phpcs` solo a su componente temporal. Para revisar un componente tuyo, por ejemplo después de editarlo a mano:

```bash
make phpcs name=hero_banner
```

Ejecuta `phpcs --standard=Drupal,DrupalPractice` (de `drupal/coder`) sobre `web/modules/custom/hero_banner`, montado en solo lectura, así que nunca modifica tus archivos. Lista cada archivo revisado y, si hay incumplimientos, muestra el archivo, la línea, el problema y la regla, y termina con código de error. Ejemplo con fallos introducidos a propósito:

```text
  revisado: hero_banner.module (6 errors, 0 warnings)
  FILE: web/modules/custom/hero_banner/hero_banner.module
   25 | ERROR | [x] Missing function doc comment
   25 | ERROR | [ ] Variable "Title" starts with a capital letter, ...
   26 | ERROR | [x] Line indented incorrectly; expected 2 spaces, found 4
   26 | ERROR | [x] Short array syntax must be used to define arrays
✖ hero_banner no cumple los estándares Drupal: corrige las líneas indicadas arriba y vuelve a ejecutar make phpcs name=hero_banner
```

### 5. Solución de problemas

| Síntoma                                                              | Causa y solución                                                                                                                                                                                           |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `✖ docker no está instalado`                                         | Instala Docker: https://docs.docker.com/get-docker/                                                                                                                                                        |
| `✖ Docker está instalado pero no responde`                           | El servicio está apagado o tu usuario no tiene permisos. Inicia Docker (`sudo systemctl start docker` o Docker Desktop) y comprueba que `docker ps` funciona.                                              |
| `✖ No se pudo iniciar el contenedor...`                              | El puerto 8080 está ocupado. Usa otro: `DEMO_PORT=8081 make demo name=hero_banner`.                                                                                                                        |
| `✖ No existe web/modules/custom/<nombre>`                            | `make demo` muestra un componente que ya generaste. Créalo antes con `make component name=<nombre>`.                                                                                                       |
| `✖ El componente "<nombre>" ya existe`                               | Es la protección contra sobrescritura. Usa otro nombre o borra la carpeta si quieres regenerarlo.                                                                                                          |
| Tras `make demo-stop` sigues viendo `localhost:8080` en el navegador | El servidor está apagado. Lo que ves es la pestaña que ya estaba abierta, la caché del navegador o el autocompletado del historial. Recarga con Ctrl+Shift+R o ábrela en incógnito: verás que no responde. |
| La primera ejecución de smoke o demo tarda varios minutos            | Docker descarga la imagen de Drupal (~1 GB) solo la primera vez. Las siguientes ejecuciones son mucho más rápidas.                                                                                         |

### 6. Referencia de comandos

| Comando                             | Qué hace                                                  |
| ----------------------------------- | --------------------------------------------------------- |
| `make component name=<n> [dir=<r>]` | Genera un componente                                      |
| `make check`                        | Formato, lint y tests (el mismo gate que CI y pre-commit) |
| `make phpcs name=<n>`               | Revisa un componente con los estándares Drupal (Docker)   |
| `make smoke` / `KEEP=1 make smoke`  | Valida un componente generado en Drupal 11 (Docker)       |
| `make demo name=<n>`                | Levanta tu componente en `http://localhost:8080` (Docker) |
| `make demo-stop`                    | Apaga y borra la demo                                     |
| `make help`                         | Lista todos los comandos                                  |

### 7. Arquitectura y estructura

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

**Decisión principal:** Node nativo en lugar de Plop o Yeoman. Plop daría prompts interactivos y plantillas Handlebars, pero añade una dependencia y otra sintaxis que el equipo tendría que mantener. Con template literals, el generador cabe en unas 300 líneas, se testea casi por completo y corre en cualquier máquina con Node. Si el catálogo de plantillas crece (variantes por tipo de componente, SDC, bloques), migrar a Plop es barato porque `templates.mjs` ya está aislado. Detalle en [ADR 0001](docs/adr/0001-native-node-scaffolder.md). Trazabilidad de requerimientos a tests en [`docs/requirements.md`](docs/requirements.md).

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

## Supuestos y límites

- El reto pide `<nombre>.info.yml` con `type`; se generó un **módulo** (`type: module`) porque es el contenedor que permite `hook_theme` y librerías propias. Si el equipo usa _Single Directory Components_, el cambio se limita a `templates.mjs` (`<nombre>.component.yml` + `<nombre>.twig`).
- El pipeline de `examples/` es una referencia para el repositorio Drupal de la plataforma: no se ejecutó aquí porque este repo no contiene un sitio Drupal. El CI propio de este repo (`ci.yml`) se verificó ejecutando sus mismos comandos en local.

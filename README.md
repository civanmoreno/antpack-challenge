# Drupal Component Scaffold

Generador de línea de comandos que crea un componente Drupal completo (módulo, plantilla Twig, CSS, JS y librería) con un solo comando, con nombres consistentes y sin sobrescribir nunca código existente.

> Este README explica **cómo usarlo**. El diseño, las decisiones y la estrategia de configuración y CI están en la [documentación del proyecto](docs/README.md).

## Inicio rápido

```bash
npm install                        # una sola vez: instala eslint/prettier y activa el hook de pre-commit
make component name=hero_banner    # crea web/modules/custom/hero_banner con todos sus archivos
make demo name=hero_banner         # opcional: lo ves funcionando en un Drupal real en http://localhost:8080
make demo-stop                     # apaga la demo
```

## Requisitos

| Herramienta  | Para qué                                        | Obligatoria                              |
| ------------ | ----------------------------------------------- | ---------------------------------------- |
| Node.js ≥ 20 | Ejecutar el generador y los tests               | Sí (`.nvmrc` fija la 24)                 |
| `make`       | Atajos (`make component`, `make check`...)      | No: todo tiene equivalente con `npm run` |
| Docker       | `make smoke` y `make demo` (Drupal 11 temporal) | Solo para validar en Drupal              |
| `curl`       | `make demo` comprueba la página que levanta     | Solo para la demo                        |

Los scripts que usan Docker comprueban primero que esté instalado y que el servicio responda. Si no, se detienen con un mensaje que dice qué hacer.

## Generar un componente

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

### Qué obtienes

| Archivo                        | Qué hace                                                                                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<nombre>.info.yml`            | Registra el módulo en Drupal: `name`, `type: module`, `description`, `package`, `core_version_requirement`.                                                                                  |
| `<nombre>.module`              | `hook_theme()` declara el theme hook `<nombre>`, sus variables (`title`, `content`) y qué plantilla usa.                                                                                     |
| `templates/<nombre>.html.twig` | El marcado. Adjunta la librería con `attach_library()` y usa clases BEM (`hero-banner`, `hero-banner__title`).                                                                               |
| `<nombre>.libraries.yml`       | Declara la librería: qué CSS y JS cargar y de qué depende (`core/drupal`, `core/once`).                                                                                                      |
| `css/<nombre>.css`             | Estilos base.                                                                                                                                                                                |
| `js/<nombre>.js`               | Un `Drupal.behavior` con `once()`: se ejecuta una sola vez por elemento, aunque la página recargue partes por AJAX. Añade la clase `--ready`, que sirve para comprobar que el JS se ejecutó. |

## Errores comunes del generador

El generador aborta, sin crear nada, con un mensaje que explica qué hacer:

- **Nombre inválido.** Debe ser un _machine name_ de Drupal: minúsculas, números y `_`, empezando por letra, con un máximo de 50 caracteres y sin nombres reservados (`node`, `system`...).
  ```text
  ✖ El nombre "Hero-Banner" no es un machine name válido: usa minúsculas, números y guion bajo, empezando por letra. ¿Quisiste decir "hero_banner"?
  ```
- **El componente ya existe.** Nunca se sobrescribe:
  ```text
  ✖ El componente "hero_banner" ya existe en web/modules/custom/hero_banner
    No se creó ni modificó ningún archivo.

    Opciones:
      • Usa otro nombre para el nuevo componente.
      • Si quieres regenerarlo desde cero, borra antes la carpeta: rm -rf web/modules/custom/hero_banner
  ```

Códigos de salida: `0` éxito, `1` error de uso, `2` error inesperado de E/S. Con `make`, después del mensaje aparece `make: *** [...] Error 1`: esa línea la añade `make` y es normal.

## Validar que funciona

Hay cuatro herramientas. Cada una comprueba algo que las anteriores no cubren.

### a) Tests automáticos: `make check` (segundos, sin Docker)

Corre Prettier, ESLint y 27 tests con `node:test`, con un umbral de cobertura del 90 % (la cobertura real es del 99,7 % de líneas y el 100 % de ramas). Los tests cubren la validación de nombres, el contenido de cada archivo, la protección contra sobrescritura, el rollback ante fallos de escritura y el CLI como proceso real. Es lo mismo que corren CI y el hook de pre-commit.

### b) Smoke test en Drupal: `make smoke` (~20 s, Docker)

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

### c) Demo en el navegador: `make demo name=<nombre>` (1–2 min, Docker)

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

### d) Estándares Drupal en tus componentes: `make phpcs name=<nombre>` (Docker)

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

## Solución de problemas

| Síntoma                                                              | Causa y solución                                                                                                                                                                                           |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `✖ docker no está instalado`                                         | Instala Docker: https://docs.docker.com/get-docker/                                                                                                                                                        |
| `✖ Docker está instalado pero no responde`                           | El servicio está apagado o tu usuario no tiene permisos. Inicia Docker (`sudo systemctl start docker` o Docker Desktop) y comprueba que `docker ps` funciona.                                              |
| `✖ No se pudo iniciar el contenedor...`                              | El puerto 8080 está ocupado. Usa otro: `DEMO_PORT=8081 make demo name=hero_banner`.                                                                                                                        |
| `✖ No existe web/modules/custom/<nombre>`                            | `make demo` muestra un componente que ya generaste. Créalo antes con `make component name=<nombre>`.                                                                                                       |
| `✖ El componente "<nombre>" ya existe`                               | Es la protección contra sobrescritura. Usa otro nombre o borra la carpeta si quieres regenerarlo.                                                                                                          |
| Tras `make demo-stop` sigues viendo `localhost:8080` en el navegador | El servidor está apagado. Lo que ves es la pestaña que ya estaba abierta, la caché del navegador o el autocompletado del historial. Recarga con Ctrl+Shift+R o ábrela en incógnito: verás que no responde. |
| La primera ejecución de smoke o demo tarda varios minutos            | Docker descarga la imagen de Drupal (~1 GB) solo la primera vez. Las siguientes ejecuciones son mucho más rápidas.                                                                                         |

## Comandos

| Comando                             | Qué hace                                                  |
| ----------------------------------- | --------------------------------------------------------- |
| `make component name=<n> [dir=<r>]` | Genera un componente                                      |
| `make check`                        | Formato, lint y tests (el mismo gate que CI y pre-commit) |
| `make phpcs name=<n>`               | Revisa un componente con los estándares Drupal (Docker)   |
| `make smoke` / `KEEP=1 make smoke`  | Valida un componente generado en Drupal 11 (Docker)       |
| `make demo name=<n>`                | Levanta tu componente en `http://localhost:8080` (Docker) |
| `make demo-stop`                    | Apaga y borra la demo                                     |
| `make help`                         | Lista todos los comandos                                  |

## Desarrollo

```bash
npm install   # instala eslint/prettier y activa el hook de pre-commit (.githooks/pre-commit)
make check    # formato + lint + tests; lo mismo que corren el hook y CI
```

Las plantillas de los archivos generados están en `tools/scaffold/templates.mjs`. La arquitectura del código y el porqué de cada decisión están en [docs/scaffolding.md](docs/scaffolding.md).

# Drupal Component Scaffold

Generador de línea de comandos que crea un componente Drupal completo (módulo, plantilla Twig, CSS, JS y librería) con un solo comando, con nombres consistentes y sin sobrescribir nunca código existente.

> Este README explica **qué hace la herramienta y cómo usarla** sobre tus componentes.
> Para modificar la herramienta (su código, tests y CI), consulta [CONTRIBUTING.md](CONTRIBUTING.md). Para el diseño y las decisiones, la [documentación del proyecto](docs/README.md).

## Inicio rápido

```bash
make component name=hero_banner    # crea web/modules/custom/hero_banner con todos sus archivos
make demo name=hero_banner         # opcional: lo ves funcionando en un Drupal real en http://localhost:8080
make demo-stop                     # apaga la demo
```

## Requisitos

| Herramienta  | Para qué                                          | Obligatoria                           |
| ------------ | ------------------------------------------------- | ------------------------------------- |
| Node.js ≥ 20 | Ejecutar el generador (no necesita `npm install`) | Sí                                    |
| `make`       | Atajos (`make component`, `make phpcs`...)        | No: `npm run scaffold` es equivalente |
| Docker       | `make phpcs` y `make demo` (Drupal 11 temporal)   | Solo para revisar componentes         |
| `curl`       | `make demo` comprueba la página que levanta       | Solo para la demo                     |

Los comandos que usan Docker comprueban primero que esté instalado y que el servicio responda. Si no, se detienen con un mensaje que dice qué hacer.

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

## Revisar tus componentes

Estos comandos actúan sobre un componente que ya generaste en `web/modules/custom/<nombre>`. Lo montan en solo lectura, así que nunca modifican tus archivos.

### Verlo en el navegador: `make demo name=<nombre>` (1–2 min, Docker)

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

### Estándares Drupal: `make phpcs name=<nombre>` (Docker)

Comprueba que el componente cumple los estándares `Drupal` y `DrupalPractice`, por ejemplo después de editarlo a mano:

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

| Síntoma                                                                 | Causa y solución                                                                                                                                                                                           |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `✖ docker no está instalado`                                            | Instala Docker: https://docs.docker.com/get-docker/                                                                                                                                                        |
| `✖ Docker está instalado pero no responde`                              | El servicio está apagado o tu usuario no tiene permisos. Inicia Docker (`sudo systemctl start docker` o Docker Desktop) y comprueba que `docker ps` funciona.                                              |
| `✖ No se pudo iniciar el contenedor...`                                 | El puerto 8080 está ocupado. Usa otro: `DEMO_PORT=8081 make demo name=hero_banner`.                                                                                                                        |
| `✖ No existe web/modules/custom/<nombre>`                               | `make demo` muestra un componente que ya generaste. Créalo antes con `make component name=<nombre>`.                                                                                                       |
| `✖ El componente "<nombre>" ya existe`                                  | Es la protección contra sobrescritura. Usa otro nombre o borra la carpeta si quieres regenerarlo.                                                                                                          |
| Tras `make demo-stop` sigues viendo `localhost:8080` en el navegador    | El servidor está apagado. Lo que ves es la pestaña que ya estaba abierta, la caché del navegador o el autocompletado del historial. Recarga con Ctrl+Shift+R o ábrela en incógnito: verás que no responde. |
| La primera ejecución de `make phpcs` o `make demo` tarda varios minutos | Docker descarga la imagen de Drupal (~1 GB) solo la primera vez. Las siguientes ejecuciones son mucho más rápidas.                                                                                         |

## Comandos

| Comando                             | Qué hace                                                  |
| ----------------------------------- | --------------------------------------------------------- |
| `make component name=<n> [dir=<r>]` | Genera un componente                                      |
| `make phpcs name=<n>`               | Revisa un componente con los estándares Drupal (Docker)   |
| `make demo name=<n>`                | Levanta tu componente en `http://localhost:8080` (Docker) |
| `make demo-stop`                    | Apaga y borra la demo                                     |
| `make help`                         | Lista todos los comandos, incluidos los de desarrollo     |

## Desarrollo

`make check` y `make smoke` validan **la herramienta**, no tus componentes. Están descritos en [CONTRIBUTING.md](CONTRIBUTING.md).

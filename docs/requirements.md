# Requerimientos: generador de componentes (Bloque 1)

Fuente: enunciado del reto técnico.

## Funcionales y criterios de aceptación

| #   | Requerimiento                                                                     | Cómo se cumple                                                       | Verificado en                                               |
| --- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------- |
| F1  | Ejecutable desde la terminal (`npm run scaffold <n>` / `make component name=<n>`) | `tools/scaffold/cli.mjs`, script npm y target de Make                | `test/cli.test.mjs` (proceso real), prueba manual           |
| F2  | Crea una carpeta con el nombre indicado                                           | `generator.mjs`                                                      | `test/generator.test.mjs`                                   |
| F3  | `<nombre>.info.yml` con nombre, tipo y requisito de versión de core               | `templates.mjs` → `name`, `type: module`, `core_version_requirement` | `test/generator.test.mjs`, `make smoke` (Drupal lo instala) |
| F4  | `<nombre>.html.twig`                                                              | `templates/<nombre>.html.twig` + `hook_theme`                        | `make smoke` (renderiza el HTML esperado)                   |
| F5  | `<nombre>.css` o `<nombre>.js`                                                    | Ambos, registrados en `<nombre>.libraries.yml`                       | `test/generator.test.mjs`, `make smoke`                     |
| F6  | Valida el nombre y aborta con un mensaje claro                                    | `validate.mjs` (machine name, longitud, reservados, sugerencia)      | `test/validate.test.mjs`, `test/cli.test.mjs`               |
| F7  | Aborta si la carpeta destino existe, sin sobrescribir                             | `mkdir` no recursivo (atómico) + escritura con `wx`                  | `test/generator.test.mjs`                                   |

## No funcionales

- Sin dependencias en runtime; Node ≥ 20.
- Sin resultados a medias si falla la escritura (rollback).
- Códigos de salida distinguibles: 0 éxito, 1 error de uso, 2 error inesperado.

## Fuera de alcance

- Prompts interactivos y variantes de plantilla por tipo de componente (ver ADR 0001).
- Detección de colisiones con módulos contrib instalados en un sitio concreto.

## Supuestos

- "Componente" se materializa como módulo Drupal (`type: module`), porque permite `hook_theme` y librerías propias.

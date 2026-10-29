# 0001. Generador con Node.js nativo en lugar de Plop o Yeoman

- Estado: Aceptada
- Fecha: 2026-10-29

## Contexto

El equipo crea a mano 3 o 4 archivos por componente y eso produce nombres inconsistentes. Se necesita un generador ejecutable desde la terminal que cualquiera pueda correr sin configuración previa y que el equipo pueda mantener sin aprender otra herramienta.

## Decisión

Script de Node.js con módulos nativos (`fs/promises`, `path`, `util.parseArgs`) y plantillas como template literals, expuesto como `npm run scaffold` y `make component`.

## Alternativas consideradas

| Opción                | Pros                                                                | Contras                                                                           |
| --------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Node nativo (elegida) | Cero dependencias en runtime, testeable al 100 %, sin otra sintaxis | Sin prompts interactivos; las plantillas son código JS                            |
| Plop.js               | Prompts, plantillas Handlebars, convención conocida                 | Dependencia y sintaxis extra; la validación robusta igual hay que escribirla      |
| Bash + Makefile       | Disponible en cualquier servidor                                    | Validación y manejo de errores frágiles; difícil de testear; no corre en Windows  |
| `drush generate`      | Oficial de Drupal, muchas plantillas                                | Requiere un sitio Drupal arrancado; no impone las convenciones propias del equipo |

## Consecuencias

- Positivas: arranque instantáneo, nada que instalar para usarlo, comportamiento cubierto por tests.
- Negativas / trade-offs: si se necesitan muchas variantes de plantilla o prompts, conviene migrar a Plop. El coste es bajo porque las plantillas están aisladas en `tools/scaffold/templates.mjs`.

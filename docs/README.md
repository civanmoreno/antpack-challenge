# Documentación del proyecto

Respuesta técnica a un reto para una plataforma web de alto tráfico basada en Drupal. El reto planteaba tres cuellos de botella:

1. **Trabajo manual repetitivo:** cada componente nuevo se creaba a mano en 3 o 4 archivos, con nombres inconsistentes.
2. **Desajuste de configuraciones:** los cambios manuales en los entornos se perdían o pisaban el código versionado.
3. **Falta de candados automáticos:** no había validaciones de estándares ni de integridad antes del merge.

| Documento                                                                | Contenido                                                                                      |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| [scaffolding.md](scaffolding.md)                                         | **Bloque 1:** diseño del generador, robustez, arquitectura, estrategia de validación y límites |
| [configuracion-y-ci.md](configuracion-y-ci.md)                           | **Bloque 2:** gobernanza de configuración y pipeline de calidad en cada PR                     |
| [requirements.md](requirements.md)                                       | Requisitos del Bloque 1 y dónde se verifica cada uno                                           |
| [adr/0001-native-node-scaffolder.md](adr/0001-native-node-scaffolder.md) | Decisión: Node nativo en lugar de Plop, Bash o `drush generate`                                |
| [../examples/drupal-pr-pipeline.yml](../examples/drupal-pr-pipeline.yml) | Pipeline de referencia (GitHub Actions) para el repositorio Drupal                             |

Para usar el generador, consulta el [README](../README.md). Para modificarlo (código, tests y CI), [CONTRIBUTING.md](../CONTRIBUTING.md).

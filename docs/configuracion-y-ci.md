# Bloque 2 · Estrategia de calidad y ciclo de configuración

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

El criterio: **pocos checks, rápidos, en paralelo y bloqueantes**. Un check lento o ruidoso acaba ignorado. Pipeline de referencia completo en [`examples/drupal-pr-pipeline.yml`](../examples/drupal-pr-pipeline.yml).

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

## Supuestos y límites

- El pipeline de [`examples/`](../examples/drupal-pr-pipeline.yml) es una referencia para el repositorio Drupal de la plataforma. Supone un proyecto basado en `drupal/recommended-project`, con la configuración en `config/sync` y el código propio en `web/modules/custom` y `web/themes/custom`. No se ejecutó aquí porque este repo no contiene un sitio Drupal.
- El CI propio de este repo ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) aplica la misma filosofía a pequeña escala: un gate rápido (`make check`) y un smoke test en Drupal en cada PR.

.DEFAULT_GOAL := help
.PHONY: help install component test lint format check phpcs smoke demo demo-stop

dir ?= web/modules/custom

help: ## Muestra los comandos disponibles
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-12s %s\n", $$1, $$2}'

install: ## Instala dependencias de desarrollo
	npm ci

component: ## Genera un componente: make component name=<nombre> [dir=<ruta>]
	@if [ -z "$(name)" ]; then echo "✖ Falta el nombre. Uso: make component name=<nombre>" >&2; exit 1; fi
	@node tools/scaffold/cli.mjs "$(name)" --dir "$(dir)"

test: ## Corre los tests con cobertura
	npm test

lint: ## Corre ESLint
	npm run lint

format: ## Formatea el código con Prettier
	npm run format

check: ## Formato + lint + tests (lo mismo que corre CI)
	npm run check

phpcs: ## Revisa un componente con los estándares Drupal: make phpcs name=<nombre> (Docker)
	@if [ -z "$(name)" ]; then echo "✖ Falta el nombre. Uso: make phpcs name=<nombre>" >&2; exit 1; fi
	@./scripts/phpcs-drupal.sh "$(name)" "$(dir)"

smoke: ## Valida un componente generado en Drupal 11 (Docker). KEEP=1 deja el contenedor vivo
	./scripts/smoke-drupal.sh

demo: ## Levanta Drupal en localhost:8080 con tu componente: make demo name=<nombre> (requiere Docker)
	@if [ -z "$(name)" ]; then echo "✖ Falta el nombre. Uso: make demo name=<nombre>" >&2; exit 1; fi
	@./scripts/demo-drupal.sh "$(name)" "$(dir)"

demo-stop: ## Apaga y borra el contenedor de la demo (y todo lo creado dentro)
	@docker rm -f scaffold-demo >/dev/null 2>&1 && echo "✔ Demo detenida" || echo "No había demo corriendo"

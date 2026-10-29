.DEFAULT_GOAL := help
.PHONY: help install component test lint format check

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

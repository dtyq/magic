SHELL := /usr/bin/env bash
.SHELLFLAGS := -eu -o pipefail -c

.DEFAULT_GOAL := help

PROJECT_NAME ?= magicrew-
BINARY_NAME ?= magicrew-cli

GO ?= go
GOFLAGS ?=
GO_LDFLAGS ?= -s -w

MODULE_DIR := 
DIST_DIR := $(CURDIR)/dist
OUTPUT ?= $(DIST_DIR)/$(BINARY_NAME)-$(shell $(GO) env GOOS)-$(shell $(GO) env GOARCH)
CMD_PACKAGE ?= ./cmd

# 多平台构建：darwin/linux × amd64/arm64
PLATFORMS := darwin/amd64 darwin/arm64 linux/amd64 linux/arm64

# 默认 charts 目录：以 Make 当前目录为基准的 ../charts（MODULE_DIR 为空时避免变成 /charts）
CHARTS_DIR ?= $(abspath $(CURDIR)/../charts)
VALUES_FILE ?=
DEPLOY_ARGS ?=
TEARDOWN_ARGS ?=

define require_tool
@command -v $(1) >/dev/null 2>&1 || { \
	echo "Error: required tool '$(1)' is not installed or not in PATH."; \
	exit 1; \
}
endef

.PHONY: help setup build deploy teardown test clean deps tidy check-go check-runtime-tools

help: ## Show available make targets
	@echo "$(PROJECT_NAME) development targets"
	@awk 'BEGIN {FS = ":.*## "}; /^[a-zA-Z0-9_.-]+:.*## / {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: check-go tidy deps check-runtime-tools ## Verify local environment and dependencies
	@echo "Setup complete."

deps: ## Download Go module dependencies
	@$(GO) mod download

tidy: check-go ## Normalize go.mod/go.sum dependencies
	@$(GO) mod tidy

check-go: ## Check Go is installed
	$(call require_tool,go)

check-runtime-tools: ## Check runtime tools required by deploy/teardown
	$(call require_tool,docker)

build: check-go deps ## Build all platforms (darwin/linux × amd64/arm64) into dist
	@mkdir -p "$(DIST_DIR)"
	@for platform in $(PLATFORMS); do \
		GOOS=$${platform%/*}; GOARCH=$${platform#*/}; \
		echo "Building $$GOOS/$$GOARCH..."; \
		GOOS=$$GOOS GOARCH=$$GOARCH $(GO) build $(GOFLAGS) -trimpath -ldflags "$(GO_LDFLAGS)" -o "$(DIST_DIR)/$(BINARY_NAME)-$$GOOS-$$GOARCH" "$(CMD_PACKAGE)"; \
	done
	@echo "Built all platforms in $(DIST_DIR)"

build-local: check-go deps ## Build current platform only into dist
	@mkdir -p "$(DIST_DIR)"
	@echo "Building $(OUTPUT)..."
	@$(GO) build $(GOFLAGS) -trimpath -ldflags "$(GO_LDFLAGS)" -o "$(OUTPUT)" "$(CMD_PACKAGE)"
	@echo "Built $(OUTPUT)"

deploy: build-local check-runtime-tools ## Build current platform and deploy to local kind cluster
	@"$(OUTPUT)" deploy --charts-dir "$(CHARTS_DIR)" $(if $(strip $(VALUES_FILE)),--values "$(VALUES_FILE)",) $(DEPLOY_ARGS)

teardown: check-runtime-tools ## Delete the local kind cluster (builds binary only if missing)
	@test -f "$(OUTPUT)" || $(MAKE) build-local
	@"$(OUTPUT)" teardown $(TEARDOWN_ARGS)

test: check-go ## Run all unit tests
	@$(GO) test ./...

clean: ## Remove build artifacts
	@rm -rf "$(DIST_DIR)"
	@echo "Cleaned: $(DIST_DIR)"

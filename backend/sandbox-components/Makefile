# Define variables
SHELL := /bin/bash
BIN_DIR := bin
CMD_DIR := cmd
GO_FILES := $(shell find . -type f -name "*.go" -not -path "./vendor/*")
COMMANDS := $(shell find $(CMD_DIR) -maxdepth 1 -mindepth 1 -type d -exec basename {} \;)

# Get version information
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo "unknown")
BUILD_TIME := $(shell date -u '+%Y-%m-%d %H:%M:%S')
LDFLAGS := -ldflags "-w -s -X 'main.Version=$(VERSION)' -X 'main.BuildTime=$(BUILD_TIME)'"

# Default target
.DEFAULT_GOAL := all

# Define phony targets
.PHONY: all clean help $(COMMANDS)

# Help target
help:
	@echo "Usage:"
	@echo "  make            - compile all commands"
	@echo "  make <command>  - compile specific command"
	@echo "  make clean      - clean generated files"
	@echo "Available commands:"
	@echo "  $(COMMANDS)"

# All commands build target
all: $(COMMANDS)
	@echo "All commands built successfully, executables in $(BIN_DIR) directory"
	@echo "Version: $(VERSION)"
	@echo "Build time: $(BUILD_TIME)"

# Single command build target
$(COMMANDS):
	@echo "Building $@..."
	@mkdir -p $(BIN_DIR)
	@go build $(LDFLAGS) -o $(BIN_DIR)/$@ ./$(CMD_DIR)/$@

# Clean target
clean:
	@echo "Cleaning generated files..."
	@rm -rf $(BIN_DIR)
	@echo "Clean completed" 
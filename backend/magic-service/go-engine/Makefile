.PHONY: install lint update-lint-bins fix fmt dev dev-no-restart test race race-business race-all cover cover-all slow-tests

GOCACHE ?= $(shell go env GOCACHE)
export GOCACHE

TOOLS_BIN_DIR := $(CURDIR)/bin
export PATH := $(TOOLS_BIN_DIR):$(PATH)

TEST_TIMEOUT := 5m
CPU_COUNT := $(shell nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)
GOMAXPROCS ?= $(CPU_COUNT)
TEST_PKG_PARALLEL ?= $(shell CPU="$(CPU_COUNT)"; echo $$((CPU * 2)))
TEST_FUNC_PARALLEL ?= $(CPU_COUNT)
SLOW_TEST_PKG_PARALLEL ?= 1
LIST_TEST_PKGS = GOCACHE=$(GOCACHE) go list -f '{{if or .TestGoFiles .XTestGoFiles}}{{.ImportPath}}{{end}}' ./... | sed '/^$$/d'
FAST_TEST_PKGS ?= $(shell $(LIST_TEST_PKGS) | grep -E '^(magic/internal/pkg/|magic/pkg/)')
BUSINESS_TEST_PKGS ?= $(shell $(LIST_TEST_PKGS) | grep -E '^(magic$$|magic/internal/config|magic/internal/application/|magic/internal/domain/)')
ALL_TEST_PKGS ?= $(shell GOCACHE=$(GOCACHE) go list ./... | grep -v '/e2e')
TEST_PKGS ?= $(FAST_TEST_PKGS)
COVER_TEST_PKGS ?= $(BUSINESS_TEST_PKGS)
COVERAGE_DIR := coverage
COVERAGE_OUT := $(COVERAGE_DIR)/coverage.out
COVERAGE_HTML := $(COVERAGE_DIR)/coverage.html
COVERAGE_PRETTY_HTML := $(COVERAGE_DIR)/coverage_pretty.html
SLOW_TEST_THRESHOLD ?= 100ms
SLOW_TEST_TOP ?= 50
SLOW_PACKAGE_THRESHOLD ?= 1s
SLOW_PACKAGE_TOP ?= 30

SQLC_VERSION ?= v1.30.0
WIRE_VERSION ?= v0.7.0
DEADCODE_VERSION ?= v0.41.0
AIR_VERSION ?= latest
GOLANGCI_LINT_VERSION ?= latest
GOFUMPT_VERSION ?= v0.9.2
GCI_VERSION ?= latest
GOTESTSUM_VERSION ?= latest
GOIMPORTS_VERSION ?= latest
GO_COVER_TREEMAP_VERSION ?= v1.5.0
GOCOV_VERSION ?= latest
GOCOV_HTML_VERSION ?= v1.4.0
GOCOV_X_TOOLS_VERSION ?= v0.43.0

AIR_BIN := $(TOOLS_BIN_DIR)/air
SQLC_BIN := $(TOOLS_BIN_DIR)/sqlc
WIRE_BIN := $(TOOLS_BIN_DIR)/wire
DEADCODE_BIN := $(TOOLS_BIN_DIR)/deadcode
GOLANGCI_LINT_BIN := $(TOOLS_BIN_DIR)/golangci-lint
GOFUMPT_BIN := $(TOOLS_BIN_DIR)/gofumpt
GCI_BIN := $(TOOLS_BIN_DIR)/gci
GOTESTSUM_BIN := $(TOOLS_BIN_DIR)/gotestsum
GOIMPORTS_BIN := $(TOOLS_BIN_DIR)/goimports
GO_COVER_TREEMAP_BIN := $(TOOLS_BIN_DIR)/go-cover-treemap
GOCOV_BIN := $(TOOLS_BIN_DIR)/gocov
GOCOV_HTML_BIN := $(TOOLS_BIN_DIR)/gocov-html
LINT_BIN := $(TOOLS_BIN_DIR)/lint

.DEFAULT_GOAL := $(AIR_BIN)

# Keep public targets near the top. Some IDEs only do shallow Makefile parsing
# for completion and otherwise miss targets hidden behind later define/eval
# blocks and dynamically generated rules.
install:
lint:
update-lint-bins:
fix:
fmt:
dev:
dev-no-restart:
test:
race:
race-business:
race-all:
cover:
cover-all:
slow-tests:

INSTALL_BINS := $(AIR_BIN) $(SQLC_BIN) $(WIRE_BIN) $(DEADCODE_BIN) $(GOLANGCI_LINT_BIN) $(GOFUMPT_BIN) $(GCI_BIN) $(GOTESTSUM_BIN) $(GOIMPORTS_BIN) $(GO_COVER_TREEMAP_BIN) $(GOCOV_BIN) $(GOCOV_HTML_BIN)

LINT_BIN_SOURCES := $(strip $(shell GOCACHE=$(GOCACHE) go list -deps -f '{{if and .Module (eq .Module.Path "magic")}}{{$$dir := .Dir}}{{range .GoFiles}}{{$$dir}}/{{.}} {{end}}{{end}}' ./cmd/lint)) go.mod go.sum
SQLC_INPUTS := sqlc.yaml $(sort $(shell find internal/infrastructure/persistence/mysql/queries internal/infrastructure/persistence/mysql/schema -type f -name '*.sql'))
WIRE_INPUTS := wire.go $(sort $(shell find internal/di -type f -name '*.go'))
SQLC_STAMP := .cache/sqlc/hash
WIRE_STAMP := .cache/wire/hash

GO_HOT_RELOAD ?= 1
DEV_GOOS ?= $(shell go env GOOS)
DEV_GOARCH ?= $(shell go env GOARCH)
DEV_START_FLAGS :=
ifneq ($(filter 1 true TRUE yes YES on ON,$(GO_HOT_RELOAD)),)
DEV_START_FLAGS := -w
endif

define install_go_tool
$1:
	@mkdir -p $(dir $1)
	@echo "Installing $(notdir $1) ($3@$2)..."
	@GOBIN=$(TOOLS_BIN_DIR) go install $3@$2
endef

$(eval $(call install_go_tool,$(AIR_BIN),$(AIR_VERSION),github.com/air-verse/air))
$(eval $(call install_go_tool,$(SQLC_BIN),$(SQLC_VERSION),github.com/sqlc-dev/sqlc/cmd/sqlc))
$(eval $(call install_go_tool,$(WIRE_BIN),$(WIRE_VERSION),github.com/google/wire/cmd/wire))
$(eval $(call install_go_tool,$(DEADCODE_BIN),$(DEADCODE_VERSION),golang.org/x/tools/cmd/deadcode))
$(eval $(call install_go_tool,$(GOLANGCI_LINT_BIN),$(GOLANGCI_LINT_VERSION),github.com/golangci/golangci-lint/v2/cmd/golangci-lint))
$(eval $(call install_go_tool,$(GOFUMPT_BIN),$(GOFUMPT_VERSION),mvdan.cc/gofumpt))
$(eval $(call install_go_tool,$(GCI_BIN),$(GCI_VERSION),github.com/daixiang0/gci))
$(eval $(call install_go_tool,$(GOTESTSUM_BIN),$(GOTESTSUM_VERSION),gotest.tools/gotestsum))
$(eval $(call install_go_tool,$(GOIMPORTS_BIN),$(GOIMPORTS_VERSION),golang.org/x/tools/cmd/goimports))
$(eval $(call install_go_tool,$(GO_COVER_TREEMAP_BIN),$(GO_COVER_TREEMAP_VERSION),github.com/nikolaydubina/go-cover-treemap))
$(eval $(call install_go_tool,$(GOCOV_HTML_BIN),$(GOCOV_HTML_VERSION),github.com/matm/gocov-html/cmd/gocov-html))

$(GOCOV_BIN):
	@mkdir -p $(dir $@)
	@echo "Installing $(notdir $@) (github.com/axw/gocov/gocov@$(GOCOV_VERSION), golang.org/x/tools@$(GOCOV_X_TOOLS_VERSION))..."
	@tmpdir=$$(mktemp -d); \
	trap 'rm -rf "$$tmpdir"' EXIT INT TERM; \
	mod_dir=$$(go mod download -json github.com/axw/gocov@$(GOCOV_VERSION) | awk -F'"' '/"Dir":/ {print $$4}'); \
	if [ -z "$$mod_dir" ]; then \
		echo "ERROR: failed to resolve github.com/axw/gocov@$(GOCOV_VERSION)"; \
		exit 1; \
	fi; \
	cp -R "$$mod_dir"/. "$$tmpdir"/; \
	chmod -R u+w "$$tmpdir"; \
	cd "$$tmpdir"; \
	go get golang.org/x/tools@$(GOCOV_X_TOOLS_VERSION); \
	go mod tidy; \
	go build -o "$@" ./gocov

install: $(INSTALL_BINS)
	@go mod download
	@VSTR=$$($(GOLANGCI_LINT_BIN) version 2>&1 | head -n1); MAJOR=$$(printf "%s" "$$VSTR" | sed -nE 's/.*v?([0-9]+)\..*/\1/p'); echo "$$VSTR"; if [ -z "$$MAJOR" ] || [ "$$MAJOR" -lt 2 ]; then echo "ERROR: golangci-lint v2 is required by .golangci.yml"; exit 1; fi
	@echo "✓ Development dependencies ready in $(TOOLS_BIN_DIR)"

$(SQLC_STAMP): $(SQLC_BIN) $(SQLC_INPUTS)
	@mkdir -p $(dir $@)
	@FILES="$(SQLC_INPUTS)"; \
	HASH=$$(printf '%s\n' $$FILES | while IFS= read -r f; do [ -f "$$f" ] && cat "$$f"; done | ( command -v sha256sum >/dev/null 2>&1 && sha256sum || shasum -a 256 ) | awk '{print $$1}'); \
	PREV_HASH=$$(cat $@ 2>/dev/null || true); \
	if [ "$$HASH" != "$$PREV_HASH" ]; then \
		echo "Rebuilding sqlc (hash changed)..."; \
		"$(SQLC_BIN)" generate; \
	else \
		echo "Skipping sqlc (schema/query unchanged)"; \
	fi; \
	printf '%s\n' "$$HASH" > $@

$(WIRE_STAMP): $(WIRE_BIN) $(WIRE_INPUTS)
	@mkdir -p $(dir $@)
	@FILES="$(WIRE_INPUTS)"; \
	HASH=$$(printf '%s\n' $$FILES | while IFS= read -r f; do [ -f "$$f" ] && cat "$$f"; done | ( command -v sha256sum >/dev/null 2>&1 && sha256sum || shasum -a 256 ) | awk '{print $$1}'); \
	PREV_HASH=$$(cat $@ 2>/dev/null || true); \
	if [ "$$HASH" != "$$PREV_HASH" ]; then \
		echo "Running wire (DI graph changed)..."; \
		"$(WIRE_BIN)"; \
	else \
		echo "Skipping wire (DI graph unchanged)"; \
	fi; \
	printf '%s\n' "$$HASH" > $@

$(LINT_BIN): $(LINT_BIN_SOURCES)
	@mkdir -p $(dir $@)
	@echo "Building lint binary..."
	@go build -o $@ ./cmd/lint

define check_and_update_go_tool
	@{ \
		want="$2"; bin="$1"; pkg="$3"; name=$$(basename "$$bin"); \
		if [ ! -x "$$bin" ]; then \
			echo "Installing $$name ($$pkg@$$want)..."; \
			GOBIN=$(TOOLS_BIN_DIR) go install "$$pkg@$$want"; \
		elif [ "$$want" = "latest" ]; then \
			echo "Updating $$name ($$pkg@latest)..."; \
			GOBIN=$(TOOLS_BIN_DIR) go install "$$pkg@latest"; \
		else \
			got=$$(go version -m "$$bin" 2>/dev/null | awk '$$1=="mod"{print $$3}'); \
			if [ "$$got" = "$$want" ]; then \
				echo "Skipping $$name (already at $$want)"; \
			else \
				echo "Updating $$name: $$got -> $$want"; \
				GOBIN=$(TOOLS_BIN_DIR) go install "$$pkg@$$want"; \
			fi; \
		fi; \
	}
endef

update-lint-bins:
	$(call check_and_update_go_tool,$(GOLANGCI_LINT_BIN),$(GOLANGCI_LINT_VERSION),github.com/golangci/golangci-lint/v2/cmd/golangci-lint)
	$(call check_and_update_go_tool,$(DEADCODE_BIN),$(DEADCODE_VERSION),golang.org/x/tools/cmd/deadcode)
	@$(MAKE) --no-print-directory $(LINT_BIN)

lint: $(GOLANGCI_LINT_BIN) $(DEADCODE_BIN) $(WIRE_BIN) $(SQLC_BIN)
	@set -e; \
	sqlc_status=0; \
	lint_bin_status=0; \
	if $(MAKE) -q --no-print-directory $(SQLC_STAMP); then :; else $(MAKE) --no-print-directory $(SQLC_STAMP); fi & SQLC_PID=$$!; \
	if $(MAKE) -q --no-print-directory $(LINT_BIN); then :; else $(MAKE) --no-print-directory $(LINT_BIN); fi & LINT_BIN_PID=$$!; \
	wait $$SQLC_PID || sqlc_status=$$?; \
	wait $$LINT_BIN_PID || lint_bin_status=$$?; \
	if [ $$sqlc_status -ne 0 ]; then exit $$sqlc_status; fi; \
	if [ $$lint_bin_status -ne 0 ]; then exit $$lint_bin_status; fi; \
	/usr/bin/time -p sh -c 'PATH="$(TOOLS_BIN_DIR):$$PATH" "$(LINT_BIN)" --no-smart-cache'

fmt: $(GOFUMPT_BIN) $(GCI_BIN)
	@echo "Formatting Go code..."
	@$(GOFUMPT_BIN) -l -w -extra .
	@$(GCI_BIN) write --skip-generated -s standard -s default -s "prefix(magic)" .
	@echo "✓ Formatting complete"

fix: $(GOFUMPT_BIN) $(GCI_BIN)
	@echo "Applying Go fixers..."
	@go fix ./...
	@$(MAKE) --no-print-directory fmt
	@go mod tidy
	@echo "✓ Fix complete"

dev: $(AIR_BIN) $(WIRE_BIN) $(SQLC_STAMP)
	@echo "Starting development server..."
	@bash start.sh $(DEV_START_FLAGS)

dev-no-restart:
	@$(MAKE) --no-print-directory dev GO_HOT_RELOAD=0

test:
	@mkdir -p $(GOCACHE)
	@tmp=$$(mktemp); time_tmp=$$(mktemp); \
	/usr/bin/time -p -o "$$time_tmp" env GOCACHE=$(GOCACHE) GOMAXPROCS=$(GOMAXPROCS) go test \
		-short \
		-p $(TEST_PKG_PARALLEL) \
		-parallel $(TEST_FUNC_PARALLEL) \
		-timeout $(TEST_TIMEOUT) \
		$(ALL_TEST_PKGS) >"$$tmp" 2>&1; \
	rc=$$?; \
	if [ $$rc -ne 0 ]; then \
		grep -Ev "^(ok[[:space:]]|\\?[[:space:]])" "$$tmp" || true; \
	else \
		echo "全部成功"; \
	fi; \
	grep -E "^(real|user|sys) " "$$time_tmp" || true; \
	rm -f "$$tmp" "$$time_tmp"; \
	exit $$rc

race:
	@mkdir -p $(GOCACHE)
	@tmp=$$(mktemp); time_tmp=$$(mktemp); \
	/usr/bin/time -p -o "$$time_tmp" env GOCACHE=$(GOCACHE) GOMAXPROCS=$(GOMAXPROCS) go test \
		-short \
		-race \
		-p $(TEST_PKG_PARALLEL) \
		-parallel $(TEST_FUNC_PARALLEL) \
		-timeout $(TEST_TIMEOUT) \
		$(TEST_PKGS) >"$$tmp" 2>&1; \
	rc=$$?; \
	if [ $$rc -ne 0 ]; then \
		grep -Ev "^(ok[[:space:]]|\\?[[:space:]])" "$$tmp" || true; \
	else \
		echo "竞态检测通过"; \
	fi; \
	grep -E "^(real|user|sys) " "$$time_tmp" || true; \
	rm -f "$$tmp" "$$time_tmp"; \
	exit $$rc

race-business:
	@mkdir -p $(GOCACHE)
	@tmp=$$(mktemp); time_tmp=$$(mktemp); \
	/usr/bin/time -p -o "$$time_tmp" env GOCACHE=$(GOCACHE) GOMAXPROCS=$(GOMAXPROCS) go test \
		-short \
		-race \
		-p $(TEST_PKG_PARALLEL) \
		-parallel $(TEST_FUNC_PARALLEL) \
		-timeout $(TEST_TIMEOUT) \
		$(BUSINESS_TEST_PKGS) >"$$tmp" 2>&1; \
	rc=$$?; \
	if [ $$rc -ne 0 ]; then \
		grep -Ev "^(ok[[:space:]]|\\?[[:space:]])" "$$tmp" || true; \
	else \
		echo "竞态检测通过"; \
	fi; \
	grep -E "^(real|user|sys) " "$$time_tmp" || true; \
	rm -f "$$tmp" "$$time_tmp"; \
	exit $$rc

race-all:
	@mkdir -p $(GOCACHE)
	@tmp=$$(mktemp); time_tmp=$$(mktemp); \
	/usr/bin/time -p -o "$$time_tmp" env GOCACHE=$(GOCACHE) GOMAXPROCS=$(GOMAXPROCS) go test \
		-short \
		-race \
		-p $(TEST_PKG_PARALLEL) \
		-parallel $(TEST_FUNC_PARALLEL) \
		-timeout $(TEST_TIMEOUT) \
		$(ALL_TEST_PKGS) >"$$tmp" 2>&1; \
	rc=$$?; \
	if [ $$rc -ne 0 ]; then \
		grep -Ev "^(ok[[:space:]]|\\?[[:space:]])" "$$tmp" || true; \
	else \
		echo "竞态检测通过"; \
	fi; \
	grep -E "^(real|user|sys) " "$$time_tmp" || true; \
	rm -f "$$tmp" "$$time_tmp"; \
	exit $$rc

slow-tests:
	@mkdir -p $(GOCACHE)
	@GOCACHE=$(GOCACHE) GOMAXPROCS=$(GOMAXPROCS) go run ./cmd/slowtest \
		--threshold $(SLOW_TEST_THRESHOLD) \
		--top $(SLOW_TEST_TOP) \
		--package-threshold $(SLOW_PACKAGE_THRESHOLD) \
		--package-top $(SLOW_PACKAGE_TOP) -- \
		-short \
		-p $(SLOW_TEST_PKG_PARALLEL) \
		-parallel $(TEST_FUNC_PARALLEL) \
		-timeout $(TEST_TIMEOUT) \
		$(COVER_TEST_PKGS)

cover: $(GOTESTSUM_BIN)
	@mkdir -p $(GOCACHE)
	@mkdir -p $(COVERAGE_DIR)
	@echo "================================"
	@echo "一键测试 + 竞态检测 + 覆盖率可视化"
	@echo "================================"
	@echo ""
	@echo "Step 1/4: 运行单元测试 (含竞态检测)..."
	@echo "--------------------------------"
	@GOCACHE=$(GOCACHE) GOMAXPROCS=$(GOMAXPROCS) $(GOTESTSUM_BIN) --format testname -- -short -race -p $(TEST_PKG_PARALLEL) -parallel $(TEST_FUNC_PARALLEL) -timeout $(TEST_TIMEOUT) \
		-coverprofile=$(COVERAGE_OUT) \
		-covermode=atomic \
		$(COVER_TEST_PKGS)
	@echo ""
	@echo "Step 2/4: 覆盖率摘要"
	@echo "--------------------------------"
	@go tool cover -func=$(COVERAGE_OUT) | tail -1
	@echo ""
	@echo "Step 3/4: 生成可视化报告..."
	@echo "--------------------------------"
	@GO_COVER_TREEMAP=$$(command -v go-cover-treemap 2>/dev/null || echo "$(GO_COVER_TREEMAP_BIN)"); \
	if [ -x "$$GO_COVER_TREEMAP" ]; then \
		"$$GO_COVER_TREEMAP" -coverprofile "$(COVERAGE_OUT)" > "$(COVERAGE_DIR)/coverage_treemap.svg"; \
		echo "树状图 (SVG): $(COVERAGE_DIR)/coverage_treemap.svg"; \
	else \
		echo "go-cover-treemap 未安装，跳过树状图"; \
	fi
	@GOCOV=$$(command -v gocov 2>/dev/null || echo "$(GOCOV_BIN)"); \
	GOCOV_HTML=$$(command -v gocov-html 2>/dev/null || echo "$(GOCOV_HTML_BIN)"); \
	if [ -x "$$GOCOV" ] && [ -x "$$GOCOV_HTML" ]; then \
		"$$GOCOV" convert "$(COVERAGE_OUT)" | "$$GOCOV_HTML" > "$(COVERAGE_PRETTY_HTML)"; \
		echo "美观报告 (HTML): $(COVERAGE_PRETTY_HTML)"; \
	else \
		echo "gocov/gocov-html 未安装，跳过美观报告"; \
	fi
	@echo ""
	@echo "Step 4/4: 生成标准 HTML 报告 (备用)..."
	@echo "--------------------------------"
	@go tool cover -html=$(COVERAGE_OUT) -o $(COVERAGE_HTML)
	@echo "标准报告 (HTML): $(COVERAGE_HTML)"
	@echo ""
	@echo "================================"
	@echo "测试完成"
	@echo "================================"
	@ABS_COVERAGE_OUT_PATH="$(CURDIR)/$(COVERAGE_OUT)"; \
	ABS_SVG_PATH="$(CURDIR)/$(COVERAGE_DIR)/coverage_treemap.svg"; \
	ABS_PRETTY_HTML_PATH="$(CURDIR)/$(COVERAGE_PRETTY_HTML)"; \
	ABS_HTML_PATH="$(CURDIR)/$(COVERAGE_HTML)"; \
	echo "覆盖率数据: $$ABS_COVERAGE_OUT_PATH"; \
	echo ""; \
	echo "请按住 Command/Ctrl 点击下方路径查看报告:"; \
	echo "树状图 (SVG):    $$ABS_SVG_PATH"; \
	echo "美观报告 (HTML): $$ABS_PRETTY_HTML_PATH"; \
	echo "标准报告 (HTML): $$ABS_HTML_PATH"

cover-all: COVER_TEST_PKGS := $(ALL_TEST_PKGS)
cover-all: cover

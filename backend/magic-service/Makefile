.PHONY: dev dev-no-restart fix fmt lint go-build

GO_HOT_RELOAD ?= 1
DEV_GOOS ?= darwin
DEV_GOARCH ?= arm64
TARGETOS ?= linux
TARGETARCH ?= amd64
GO_ENGINE_SOCKET_WAIT_SECONDS ?= 180
GO_ENGINE_DEV_CMD ?= make -C ./go-engine dev GO_HOT_RELOAD=$(GO_HOT_RELOAD) DEV_GOOS=$(DEV_GOOS) DEV_GOARCH=$(DEV_GOARCH)
GO_ENGINE_DIR := $(CURDIR)/go-engine
GO_ENGINE_BIN := $(CURDIR)/bin/magic-go-engine

dev:
	@set -eu; \
	if ! command -v lsof >/dev/null 2>&1; then \
		printf '%s\n' '未找到 lsof，无法在启动前检测端口占用。'; \
		exit 1; \
	fi; \
	if [ -f .env ]; then \
		set -a; \
		. ./.env; \
		set +a; \
	fi; \
	http_port="$${HTTP_PORT:-9501}"; \
	websocket_port="$${WEBSOCKET_PORT:-9502}"; \
	crontab_enable="$${CRONTAB_ENABLE:-true}"; \
	ports="http:$$http_port"; \
	case "$$(printf '%s' "$$crontab_enable" | tr '[:upper:]' '[:lower:]')" in \
		true|'(true)'|1|yes|on) ;; \
		*) ports="$$ports socket-io:$$websocket_port mock-http-service:9503" ;; \
	esac; \
	all_pids=''; \
	for entry in $$ports; do \
		name="$${entry%%:*}"; \
		port="$${entry##*:}"; \
		pids="$$(lsof -tiTCP:$$port -sTCP:LISTEN 2>/dev/null | sort -u | tr '\n' ' ')"; \
		if [ -z "$$pids" ]; then \
			continue; \
		fi; \
		printf -- '- 检测到 %s 服务端口 %s 被占用，准备清理\n' "$$name" "$$port"; \
		lsof -nP -iTCP:$$port -sTCP:LISTEN 2>/dev/null | awk 'NR > 1 { printf "  PID=%s COMMAND=%s\n", $$2, $$1 }'; \
		all_pids="$$all_pids $$pids"; \
	done; \
	all_pids="$$(printf '%s\n' "$$all_pids" | tr ' ' '\n' | sed '/^$$/d' | sort -u | tr '\n' ' ')"; \
	if [ -n "$$all_pids" ]; then \
		printf '%s\n' '正在停止占用端口的进程...'; \
		kill $$all_pids 2>/dev/null || true; \
		for pid in $$all_pids; do \
			for _ in 1 2 3 4 5; do \
				if ! kill -0 "$$pid" 2>/dev/null; then \
					break; \
				fi; \
				sleep 1; \
			done; \
			if kill -0 "$$pid" 2>/dev/null; then \
				printf '  PID=%s 未在超时内退出，执行强制终止\n' "$$pid"; \
				kill -9 "$$pid" 2>/dev/null || true; \
			fi; \
		done; \
		printf '%s\n' '端口占用进程已清理。'; \
	fi; \
	if [ -f runtime/hyperf.pid ]; then \
		printf '%s\n' '清理旧的 runtime/hyperf.pid'; \
		rm -f runtime/hyperf.pid; \
	fi; \
	printf '%s\n' '端口检查通过，准备启动服务。'
	@IPC_SOCKET=$${IPC_ENGINE_SOCKET:-$$PWD/runtime/magic_engine.sock}; \
	GO_ENGINE_DIR=$$(cd ./go-engine && pwd); \
	collect_descendants() { \
		local parent_pid="$$1"; \
		local child_pid=""; \
		for child_pid in $$(pgrep -P "$$parent_pid" 2>/dev/null || true); do \
			collect_descendants "$$child_pid"; \
			printf '%s\n' "$$child_pid"; \
		done; \
	}; \
	terminate_go_tree() { \
		local root_pid="$$1"; \
		local tracked_pids=""; \
		local target_pid=""; \
		if [ -z "$$root_pid" ]; then \
			return; \
		fi; \
		tracked_pids=$$(collect_descendants "$$root_pid" | awk '!seen[$$0]++'); \
		for target_pid in $$tracked_pids; do \
			kill -TERM "$$target_pid" 2>/dev/null || true; \
		done; \
		kill -TERM "$$root_pid" 2>/dev/null || true; \
		sleep 1; \
		for target_pid in $$tracked_pids $$root_pid; do \
			if kill -0 "$$target_pid" 2>/dev/null; then \
				kill -KILL "$$target_pid" 2>/dev/null || true; \
			fi; \
		done; \
		wait "$$root_pid" 2>/dev/null || true; \
	}; \
	stale_go_roots=$$( \
		{ lsof -t "$$IPC_SOCKET" 2>/dev/null || true; \
		  pgrep -f "$$GO_ENGINE_DIR/start.sh" 2>/dev/null || true; \
		  pgrep -f "$$GO_ENGINE_DIR/bin/air" 2>/dev/null || true; \
		  pgrep -f "$$GO_ENGINE_DIR/tmp/main" 2>/dev/null || true; \
		  pgrep -f "$$GO_ENGINE_BIN" 2>/dev/null || true; \
		  pgrep -f "$$GO_ENGINE_DIR/bin/magic" 2>/dev/null || true; } | awk '!seen[$$0]++' \
	); \
	go_pids=""; \
	if command -v lsof >/dev/null 2>&1; then \
		go_pids=$$(lsof -t "$$IPC_SOCKET" 2>/dev/null | sort -u); \
	else \
		echo "lsof not found, skip stale Go process cleanup."; \
	fi; \
	if [ -n "$$stale_go_roots" ] || [ -n "$$go_pids" ]; then \
		safe_go_pids=$$(printf '%s\n%s\n' "$$stale_go_roots" "$$go_pids" | awk -v self=$$$$ -v ppid=$$PPID 'NF && $$1 != self && $$1 != ppid && !seen[$$1]++'); \
		if [ -n "$$safe_go_pids" ]; then \
			echo "Stopping existing Go processes: $$safe_go_pids"; \
			for pid in $$safe_go_pids; do \
				terminate_go_tree "$$pid"; \
			done; \
		fi; \
	fi
	@pids=$$(ps aux | grep -i php | grep -vEi "phpstorm|grep" | awk '{print $$2}'); \
	if [ -n "$$pids" ]; then \
		echo "Stopping existing PHP processes: $$pids"; \
		echo "$$pids" | xargs kill -9 2>/dev/null || true; \
	fi
	@IPC_SOCKET=$${IPC_ENGINE_SOCKET:-$$PWD/runtime/magic_engine.sock}; \
	rm -f "$$IPC_SOCKET"; \
	go_cmd='$(GO_ENGINE_DEV_CMD)'; \
	cleanup_done=0; \
	collect_descendants() { \
		local parent_pid="$$1"; \
		local child_pid=""; \
		for child_pid in $$(pgrep -P "$$parent_pid" 2>/dev/null || true); do \
			collect_descendants "$$child_pid"; \
			printf '%s\n' "$$child_pid"; \
		done; \
	}; \
	terminate_go_tree() { \
		local root_pid="$$1"; \
		local tracked_pids=""; \
		local target_pid=""; \
		if [ -z "$$root_pid" ]; then \
			return; \
		fi; \
		tracked_pids=$$(collect_descendants "$$root_pid" | awk '!seen[$$0]++'); \
		for target_pid in $$tracked_pids; do \
			kill -TERM "$$target_pid" 2>/dev/null || true; \
		done; \
		kill -TERM "$$root_pid" 2>/dev/null || true; \
		sleep 1; \
		for target_pid in $$tracked_pids $$root_pid; do \
			if kill -0 "$$target_pid" 2>/dev/null; then \
				kill -KILL "$$target_pid" 2>/dev/null || true; \
			fi; \
		done; \
		wait "$$root_pid" 2>/dev/null || true; \
	}; \
	cleanup() { \
		if [ "$$cleanup_done" -eq 1 ]; then \
			return; \
		fi; \
		cleanup_done=1; \
		if [ -n "$$go_pid" ] && kill -0 "$$go_pid" 2>/dev/null; then \
			terminate_go_tree "$$go_pid"; \
		fi; \
	}; \
	trap cleanup EXIT INT TERM; \
	$$go_cmd & \
	go_pid=$$!; \
	waited=0; \
	until [ -S "$$IPC_SOCKET" ]; do \
		if ! kill -0 "$$go_pid" 2>/dev/null; then \
			wait "$$go_pid"; \
			exit $$?; \
		fi; \
		if [ "$$waited" -ge "$(GO_ENGINE_SOCKET_WAIT_SECONDS)" ]; then \
			echo "Go engine socket not ready after $(GO_ENGINE_SOCKET_WAIT_SECONDS)s: $$IPC_SOCKET"; \
			exit 1; \
		fi; \
		if [ "$$waited" -gt 0 ] && [ $$((waited % 10)) -eq 0 ]; then \
			echo "Waiting for Go engine socket ($$waited/$(GO_ENGINE_SOCKET_WAIT_SECONDS)s): $$IPC_SOCKET"; \
		fi; \
		sleep 1; \
		waited=$$((waited + 1)); \
	done; \
	echo "Starting PHP watcher with IPC_ENGINE_AUTO_START=false; Go is managed only by air."; \
	IPC_ENGINE_AUTO_START=false php bin/hyperf.php server:watch

dev-no-restart: GO_HOT_RELOAD=0
dev-no-restart: dev

fix:
	@$(MAKE) --no-print-directory fmt

fmt:
	composer fix

lint:
	composer analyse

go-build:
	@case "$(TARGETARCH)" in \
		amd64|arm64) ;; \
		*) printf '%s\n' "不支持的 TARGETARCH: $(TARGETARCH)。仅支持 amd64 或 arm64。"; exit 1 ;; \
	esac
	@mkdir -p "$(CURDIR)/bin"
	@printf '%s\n' "构建 magic-go-engine ($(TARGETOS)/$(TARGETARCH))..."
	@cd "$(GO_ENGINE_DIR)" && GOOS="$(TARGETOS)" GOARCH="$(TARGETARCH)" CGO_ENABLED=0 go build -o "$(GO_ENGINE_BIN)" .
	@chmod +x "$(GO_ENGINE_BIN)"
	@printf '%s\n' "已生成: $(GO_ENGINE_BIN)"

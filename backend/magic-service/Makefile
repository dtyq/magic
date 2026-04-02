.PHONY: dev fix lint

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
	php bin/hyperf.php server:watch

fix:
	composer fix

lint:
	composer analyse

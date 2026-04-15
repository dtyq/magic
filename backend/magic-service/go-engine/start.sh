#!/bin/bash

# Magic Service Go Engine 启动脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的输出
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

resolve_magic_service_dir() {
    if [ -n "${GO_ENGINE_RUNTIME_DIR:-}" ]; then
        printf '%s\n' "$GO_ENGINE_RUNTIME_DIR"
        return
    fi

    local project_dir
    project_dir="$(cd "$(dirname "$0")" && pwd)"
    printf '%s\n' "$(cd "$project_dir/.." && pwd)"
}

resolve_output_bin() {
    if [ -n "${GO_ENGINE_OUTPUT_BIN:-}" ]; then
        printf '%s\n' "$GO_ENGINE_OUTPUT_BIN"
        return
    fi

    printf '%s/bin/magic-go-engine\n' "$(resolve_magic_service_dir)"
}

resolve_runtime_config_file() {
    if [ -n "${GO_ENGINE_CONFIG_FILE:-}" ]; then
        printf '%s\n' "$GO_ENGINE_CONFIG_FILE"
        return
    fi

    printf '%s/magic-go-engine-config.yaml\n' "$(resolve_magic_service_dir)"
}

resolve_runtime_env_file() {
    if [ -n "${GO_ENGINE_ENV_FILE:-}" ]; then
        printf '%s\n' "$GO_ENGINE_ENV_FILE"
        return
    fi

    printf '%s/.env\n' "$(resolve_magic_service_dir)"
}

resolve_runtime_socket() {
    if [ -n "${IPC_ENGINE_SOCKET:-}" ]; then
        printf '%s\n' "$IPC_ENGINE_SOCKET"
        return
    fi

    printf '%s/runtime/magic_engine.sock\n' "$(resolve_magic_service_dir)"
}

resolve_dev_goos() {
    if [ -n "${DEV_GOOS:-}" ]; then
        printf '%s\n' "$DEV_GOOS"
        return
    fi

    go env GOOS
}

resolve_dev_goarch() {
    if [ -n "${DEV_GOARCH:-}" ]; then
        printf '%s\n' "$DEV_GOARCH"
        return
    fi

    go env GOARCH
}

build_output_binary() {
    local output_bin
    local goos
    local goarch

    output_bin="$(resolve_output_bin)"
    goos="$(resolve_dev_goos)"
    goarch="$(resolve_dev_goarch)"

    mkdir -p "$(dirname "$output_bin")"
    print_info "构建 Go 二进制 -> ${output_bin} (${goos}/${goarch})"
    GOOS="$goos" GOARCH="$goarch" go build -o "$output_bin" .
    chmod +x "$output_bin"
}

pid_is_alive() {
    local pid=$1
    [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1
}

collect_descendants() {
    local parent_pid=$1
    local child_pid=""

    for child_pid in $(pgrep -P "$parent_pid" 2>/dev/null || true); do
        collect_descendants "$child_pid"
        printf '%s\n' "$child_pid"
    done
}

terminate_managed_process() {
    local pid=$1
    local name=${2:-process}
    local tracked_pids=""
    local target_pid=""

    if ! pid_is_alive "$pid"; then
        wait "$pid" 2>/dev/null || true
        return 0
    fi

    print_info "正在停止 ${name} (PID: ${pid})..."
    tracked_pids=$(collect_descendants "$pid" | awk '!seen[$0]++')

    for target_pid in $tracked_pids; do
        kill -TERM "$target_pid" >/dev/null 2>&1 || true
    done
    kill -TERM "$pid" >/dev/null 2>&1 || true

    for _ in 1 2 3 4 5; do
        local alive=0
        for target_pid in $tracked_pids $pid; do
            if pid_is_alive "$target_pid"; then
                alive=1
                break
            fi
        done
        if [ "$alive" -eq 0 ]; then
            wait "$pid" 2>/dev/null || true
            return 0
        fi
        sleep 0.2
    done

    print_warning "${name} 未在预期时间内退出，发送 SIGKILL"
    for target_pid in $tracked_pids $pid; do
        if pid_is_alive "$target_pid"; then
            kill -KILL "$target_pid" >/dev/null 2>&1 || true
        fi
    done
    wait "$pid" 2>/dev/null || true
}

cleanup_stale_local_processes() {
    local project_dir
    local ipc_socket
    local output_bin
    local stale_pids=""
    local pid=""

    project_dir="$(cd "$(dirname "$0")" && pwd)"
    ipc_socket="$(resolve_runtime_socket)"
    output_bin="$(resolve_output_bin)"
    stale_pids=$( \
        { lsof -t "$ipc_socket" 2>/dev/null || true; \
          pgrep -f "$project_dir/start.sh" 2>/dev/null || true; \
          pgrep -f "$project_dir/bin/air" 2>/dev/null || true; \
          pgrep -f "$project_dir/tmp/main" 2>/dev/null || true; \
          pgrep -f "$project_dir/bin/magic" 2>/dev/null || true; \
          pgrep -f "$output_bin" 2>/dev/null || true; } | \
        awk -v self="$$" -v ppid="$PPID" 'NF && $1 != self && $1 != ppid && !seen[$1]++'
    )

    if [ -z "$stale_pids" ]; then
        return 0
    fi

    print_warning "发现残留的 Go 开发进程，启动前先清理: $stale_pids"
    for pid in $stale_pids; do
        terminate_managed_process "$pid" "stale-go-process"
    done
}

# 检查 Go 版本
check_go_version() {
    print_info "检查 Go 版本..."
    if ! command -v go &> /dev/null; then
        print_error "Go 未安装，请先安装 Go 1.21 或更高版本"
        exit 1
    fi
    
    GO_VERSION=$(go version | grep -o 'go[0-9]\+\.[0-9]\+' | head -1)
    print_success "Go 版本: $GO_VERSION"
}

# 检查数据库服务
check_databases() {
    print_info "检查数据库服务状态..."
    
    # 检查 Qdrant
    QDRANT_HOST=${QDRANT_HOST:-"localhost"}
    QDRANT_PORT=${QDRANT_PORT:-6334}
    
    if nc -z "$QDRANT_HOST" "$QDRANT_PORT" 2>/dev/null; then
        print_success "Qdrant 连接正常 ($QDRANT_HOST:$QDRANT_PORT)"
    else
        print_warning "Qdrant 连接失败 ($QDRANT_HOST:$QDRANT_PORT)"
        print_info "请确保 Qdrant 服务已启动，或运行以下命令启动："
        echo "docker run -d --name qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant"
    fi
}

# 检查并释放端口占用
ensure_port_available() {
    SERVER_PORT=${SERVER_PORT:-81}

    if ! command -v lsof >/dev/null 2>&1; then
        print_warning "lsof 未安装，跳过端口占用检测"
        return
    fi

    print_info "检查端口 ${SERVER_PORT} 是否被占用..."

    if lsof -ti tcp:"${SERVER_PORT}" >/dev/null 2>&1; then
        print_warning "端口 ${SERVER_PORT} 已被占用，尝试释放..."
        local pids
        pids=$(lsof -ti tcp:"${SERVER_PORT}")

        for pid in ${pids}; do
            if kill -TERM "${pid}" >/dev/null 2>&1; then
                print_info "已发送 SIGTERM 至进程 ${pid}"
            fi
        done

        sleep 1

        if lsof -ti tcp:"${SERVER_PORT}" >/dev/null 2>&1; then
            print_warning "端口 ${SERVER_PORT} 仍被占用，强制终止相关进程..."
            for pid in $(lsof -ti tcp:"${SERVER_PORT}"); do
                if kill -KILL "${pid}" >/dev/null 2>&1; then
                    print_info "已发送 SIGKILL 至进程 ${pid}"
                fi
            done
            sleep 1
        fi

        if lsof -ti tcp:"${SERVER_PORT}" >/dev/null 2>&1; then
            print_error "无法释放端口 ${SERVER_PORT}，请手动检查占用进程"
            exit 1
        fi

        print_success "端口 ${SERVER_PORT} 已释放"
    else
        print_success "端口 ${SERVER_PORT} 可用"
    fi
}

# 设置环境变量
setup_environment() {
    print_info "设置环境变量..."
    
    local env_file
    local env_example

    env_file="$(resolve_runtime_env_file)"
    env_example="$(dirname "$env_file")/.env.example"

    if [ -f "$env_file" ]; then
        print_success "检测到共享环境文件: $env_file"
    elif [ -f "$env_example" ]; then
        cp "$env_example" "$env_file"
        print_success "已从 $env_example 创建 $env_file"
    else
        print_warning "未找到共享环境文件，使用默认配置"
    fi

    # 加载环境变量
    if [ -f "$env_file" ]; then
        # shellcheck disable=SC1091
        set -a
        . "$env_file"
        set +a
        print_success "环境变量已加载 ($env_file)"
    fi
}

# 安装依赖
install_dependencies() {
    print_info "安装 Go 依赖..."
    if go mod tidy; then
        print_success "Go 模块依赖安装完成"
    else
        print_error "Go 模块依赖安装失败"
        return 1
    fi
}

# 检查开发工具
check_dev_tools() {
    print_info "检查开发工具..."
    
    # 检查 goimports（代码格式化）
    if ! check_goimports_installed; then
        print_warning "goimports 安装失败，代码格式化功能可能不可用"
    fi
    
    print_success "开发工具检查完成"
}

# 构建项目
build_project() {
    print_info "构建项目..."
    build_output_binary
    print_success "项目构建完成"
}

# 确保项目本地 bin/ 与 GOPATH/bin 在 PATH 中
ensure_go_path() {
    local project_bin_path
    project_bin_path="$(cd "$(dirname "$0")" && pwd)/bin"
    if [[ ":$PATH:" != *":$project_bin_path:"* ]]; then
        export PATH=$project_bin_path:$PATH
        print_info "已添加 $project_bin_path 到 PATH"
    fi

    local go_bin_path=$(go env GOPATH)/bin
    if [[ ":$PATH:" != *":$go_bin_path:"* ]]; then
        export PATH=$PATH:$go_bin_path
        print_info "已添加 $go_bin_path 到 PATH"
    fi
}

# 检查工具是否安装
check_tool_installed() {
    local tool_name=$1
    local install_cmd=$2
    
    # 确保 GOPATH/bin 在 PATH 中
    ensure_go_path
    
    if command -v "$tool_name" &> /dev/null; then
        local version_info=""
        case "$tool_name" in
            "air")
                version_info=$(air -v 2>/dev/null | head -1 || echo "")
                ;;
            "goimports")
                version_info="goimports"
                ;;
            *)
                version_info="$tool_name"
                ;;
        esac
        print_success "$tool_name 已安装 ($version_info)"
        return 0
    else
        print_warning "$tool_name 未安装"
        print_info "正在安装 $tool_name..."
        
        if eval "$install_cmd"; then
            # 再次确保 PATH 正确
            ensure_go_path
            
            # 验证安装是否成功
            if command -v "$tool_name" &> /dev/null; then
                print_success "$tool_name 安装成功"
                return 0
            else
                print_error "$tool_name 安装失败，请手动运行: $install_cmd"
                return 1
            fi
        else
            print_error "$tool_name 安装失败，请手动运行: $install_cmd"
            return 1
        fi
    fi
}

# 检查 Air 是否安装
check_air_installed() {
    check_tool_installed "air" "make install"
}

# 检查 goimports 是否安装
check_goimports_installed() {
    check_tool_installed "goimports" "make install"
}

# 检查 wire 是否安装
check_wire_installed() {
    check_tool_installed "wire" "make install"
}

# 热重载启动前做一次完整预检查，确保 wire/build 失败时直接中断启动
verify_hot_reload_build() {
    print_info "执行热重载启动前预检查..."

    mkdir -p tmp

    if ! check_wire_installed; then
        print_error "热重载预检查失败：wire 未安装，启动已中断"
        return 1
    fi

    if ! ./bin/wire; then
        print_error "热重载预检查失败：wire 未通过，启动已中断"
        return 1
    fi

    if ! build_output_binary; then
        print_error "热重载预检查失败：go build 未通过，启动已中断"
        return 1
    fi

    : > ./tmp/.air-initial-build-skip

    print_success "热重载预检查通过"
}

# 热重载模式启动
start_with_hot_reload() {
    print_info "启动热重载开发服务器..."
    local ipc_socket
    local output_bin
    local runtime_config
    local air_pid=""
    local exit_code=0
    local cleanup_done=0

    ipc_socket="$(resolve_runtime_socket)"
    output_bin="$(resolve_output_bin)"
    runtime_config="$(resolve_runtime_config_file)"

    cleanup_hot_reload() {
        if [ "$cleanup_done" -eq 1 ]; then
            return
        fi
        cleanup_done=1
        trap - EXIT INT TERM
        terminate_managed_process "$air_pid" "air"
    }
    
    # 检查 Air 配置文件
    if [ ! -f ".air.toml" ]; then
        print_warning ".air.toml 配置文件不存在，创建默认配置..."
        create_air_config
    fi

    cleanup_stale_local_processes
    
    verify_hot_reload_build || exit 1

    print_success "🔥 热重载开发服务器启动"
    print_info "IPC Socket: $ipc_socket"
    print_info "Go Binary: $output_bin"
    print_info "Go Config: $runtime_config"
    print_info "📝 构建日志: build-errors.log"
    print_info "⚡ 代码变更将自动重新编译和重启"
    print_info "按 Ctrl+C 停止服务"
    echo ""
    
    # 确保 PATH 包含本地工具目录
    ensure_go_path
    
    air &
    air_pid=$!
    trap cleanup_hot_reload EXIT INT TERM

    wait "$air_pid"
    exit_code=$?

    trap - EXIT INT TERM
    wait "$air_pid" 2>/dev/null || true

    if [ $exit_code -ne 0 ]; then
        print_error "air 退出，状态码: $exit_code"
    fi
    exit $exit_code
}

# 创建 Air 配置文件
create_air_config() {
    cat > .air.toml << 'EOF'
root = "."
testdata_dir = "testdata"
tmp_dir = "tmp"

[build]
  entrypoint = "../bin/magic-go-engine"
  cmd = "./scripts/air-build.sh"
  delay = 1000
  exclude_dir = ["assets", "tmp", "vendor", "testdata", "storage", "docs", "frontend", "node_modules", ".git"]
  exclude_file = ["wire_gen.go"]
  exclude_regex = ["_test.go"]
  exclude_unchanged = false
  follow_symlink = false
  full_bin = "cd .. && CONFIG_FILE=./magic-go-engine-config.yaml ./bin/magic-go-engine"
  include_dir = []
  include_ext = ["go", "tpl", "tmpl", "html"]
  include_file = []
  kill_delay = "1s"
  log = "build-errors.log"
  poll = false
  poll_interval = 0
  post_cmd = []
  pre_cmd = []
  rerun = false
  rerun_delay = 500
  send_interrupt = true
  stop_on_root = false

[color]
  app = ""
  build = "yellow"
  main = "magenta"
  runner = "green"
  watcher = "cyan"

[log]
  main_only = true
  time = false

[misc]
  clean_on_exit = false

[screen]
  clear_on_rebuild = true
  keep_scroll = false
EOF
    print_success ".air.toml 配置文件已创建"
}

# 启动服务
start_service() {
    print_info "启动 Magic Service Go Engine..."
    local ipc_socket
    local runtime_dir
    local output_bin
    local service_pid=""
    local exit_code=0
    local cleanup_done=0

    ipc_socket="$(resolve_runtime_socket)"
    runtime_dir="$(resolve_magic_service_dir)"
    output_bin="$(resolve_output_bin)"

    cleanup_service() {
        if [ "$cleanup_done" -eq 1 ]; then
            return
        fi
        cleanup_done=1
        trap - EXIT INT TERM
        terminate_managed_process "$service_pid" "magic-service-go-engine"
    }

    cleanup_stale_local_processes

    print_info "IPC Socket: $ipc_socket"
    print_info "Go Binary: $output_bin"
    print_info "Go Config: $(resolve_runtime_config_file)"
    print_info "按 Ctrl+C 停止服务"
    
    (
        cd "$runtime_dir"
        CONFIG_FILE=./magic-go-engine-config.yaml "$output_bin"
    ) &
    service_pid=$!
    trap cleanup_service EXIT INT TERM

    wait "$service_pid"
    exit_code=$?

    trap - EXIT INT TERM
    wait "$service_pid" 2>/dev/null || true

    return $exit_code
}

# Docker 启动选项
start_with_docker() {
    print_info "使用 Docker 启动完整环境..."
    
    if [ ! -f "docker-compose.yml" ]; then
        print_error "docker-compose.yml 文件不存在"
        exit 1
    fi
    
    # 启动所有服务
    docker-compose up -d
    
    print_success "Docker 服务启动完成"
    print_info "等待服务启动..."
    sleep 10
    
    # 检查服务状态
    docker-compose ps
}

# 显示帮助信息
show_help() {
    echo "Magic Service Go Engine 启动脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help          显示帮助信息"
    echo "  -d, --docker        使用 Docker 启动完整环境"
    echo "  -c, --check-only    仅检查环境，不启动服务"
    echo "  -b, --build-only    仅构建项目，不启动服务"
    echo "  -w, --watch         启用热重载模式 (推荐开发使用)"
    echo "  --setup-demo        启动后自动设置演示数据（当前 IPC-only 模式不可用）"
    echo ""
    echo "环境变量:"
    echo "  IPC_ENGINE_SOCKET   Go IPC Socket 路径"
    echo "  DEV_GOOS           本地开发构建目标 OS"
    echo "  DEV_GOARCH         本地开发构建目标架构"
    echo "  QDRANT_HOST        Qdrant 主机 (默认: localhost)"
    echo "  QDRANT_PORT        Qdrant 端口 (默认: 6334)"
    echo ""
    echo "示例:"
    echo "  $0                  # 正常启动"
    echo "  $0 -w              # 热重载开发模式 (推荐)"
    echo "  $0 -d              # Docker 启动"
    echo "  $0 -c              # 仅检查环境"
}

# 设置演示数据
setup_demo_data() {
    print_warning "当前 Go engine 以 IPC-only 模式运行，--setup-demo 暂不支持"
    return 1
}

# 主函数
main() {
    print_info "=== Magic Service Go Engine 启动脚本 ==="
    
    # 检查参数
    DOCKER_MODE=false
    CHECK_ONLY=false
    BUILD_ONLY=false
    SETUP_DEMO=false
    WATCH_MODE=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -d|--docker)
                DOCKER_MODE=true
                shift
                ;;
            -c|--check-only)
                CHECK_ONLY=true
                shift
                ;;
            -b|--build-only)
                BUILD_ONLY=true
                shift
                ;;
            -w|--watch)
                WATCH_MODE=true
                shift
                ;;
            --setup-demo)
                SETUP_DEMO=true
                shift
                ;;
            *)
                print_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Docker 模式
    if [ "$DOCKER_MODE" = true ]; then
        start_with_docker
        exit 0
    fi

    if [ "$WATCH_MODE" = true ]; then
        setup_environment
        start_with_hot_reload
        exit 0
    fi
    
    # 基础检查
    check_go_version
    setup_environment
    check_databases
    
    # 仅检查模式
    if [ "$CHECK_ONLY" = true ]; then
        print_success "环境检查完成"
        exit 0
    fi
    
    # 安装依赖和构建
    install_dependencies
    build_project
    
    # 仅构建模式
    if [ "$BUILD_ONLY" = true ]; then
        print_success "项目构建完成"
        exit 0
    fi
    
    # 启动服务
    if [ "$SETUP_DEMO" = true ]; then
        # 后台启动服务
        nohup ./bin/magic > service.log 2>&1 &
        SERVICE_PID=$!
        print_success "服务已在后台启动 (PID: $SERVICE_PID)"
        
        # 设置演示数据
        setup_demo_data
        
        # 显示日志
        print_info "显示服务日志 (Ctrl+C 退出日志查看，服务继续运行):"
        tail -f service.log
    else
        # 前台启动服务
        start_service
    fi
}

# 执行主函数
main "$@"

#!/bin/bash

# 定义颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # 恢复默认颜色

# 帮助信息
function show_help {
  echo -e "${YELLOW}API网关多环境部署脚本${NC}"
  echo "用法: $0 [环境] [操作]"
  echo ""
  echo "环境选项:"
  echo "  test       - 测试环境 (端口 8001)"
  echo "  pre        - 预发布环境 (端口 8002)"
  echo "  prod       - 生产环境 (端口 8003)"
  echo ""
  echo "操作选项:"
  echo "  start      - 启动指定环境"
  echo "  stop       - 停止指定环境"
  echo "  restart    - 重启指定环境"
  echo "  logs       - 查看指定环境日志"
  echo "  status     - 查看指定环境状态"
  echo "  all        - 操作所有环境"
  echo ""
  echo "示例:"
  echo "  $0 test start    - 启动测试环境"
  echo "  $0 all start     - 启动所有环境"
  echo "  $0 prod logs     - 查看生产环境日志"
}

# 参数检查
if [ $# -lt 2 ]; then
  show_help
  exit 1
fi

# 环境参数检查
if [ "$1" != "test" ] && [ "$1" != "pre" ] && [ "$1" != "prod" ] && [ "$1" != "all" ]; then
  show_help
  exit 1
fi

# 操作参数检查
if [ "$2" != "start" ] && [ "$2" != "stop" ] && [ "$2" != "restart" ] && [ "$2" != "logs" ] && [ "$2" != "status" ]; then
  show_help
  exit 1
fi

# 检查是否存在配置目录，不存在则创建
function check_config_dir {
  local env=$1
  if [ ! -d "config/$env" ]; then
    echo -e "${YELLOW}配置目录 config/$env 不存在，正在创建...${NC}"
    mkdir -p config/$env

    # 如果没有环境配置文件，从示例文件复制
    if [ ! -f "config/$env/.env" ]; then
      if [ -f ".env_example" ]; then
        cp .env_example config/$env/.env
        echo -e "${YELLOW}已从示例文件创建 config/$env/.env 配置文件，请根据环境需求修改该文件${NC}"
      else
        echo -e "${RED}警告: 未找到示例配置文件，请手动创建 config/$env/.env 文件${NC}"
        touch config/$env/.env
      fi
    fi
  fi
}

# 检查并创建外部网络
function ensure_network_exists {
  if ! docker network ls | grep -q magic-sandbox-network; then
    echo -e "${YELLOW}创建外部网络 magic-sandbox-network...${NC}"
    docker network create magic-sandbox-network
  else
    echo -e "${GREEN}外部网络 magic-sandbox-network 已存在${NC}"
  fi
}

# 启动指定环境
function start_env {
  local env=$1
  local port
  local api_key
  local jwt_secret
  local debug
  local redis_port
  local redis_db

  # 检查配置目录
  check_config_dir $env

  # 确保外部网络存在
  ensure_network_exists

  echo -e "${GREEN}正在启动 $env 环境...${NC}"

  case $env in
    test)
      port=8001
      redis_port=28001
      redis_db=0
      api_key="test-gateway-api-key"
      jwt_secret="test-jwt-secret-key"
      debug="true"
      ;;
    pre)
      port=8002
      redis_port=28001  # 使用相同的Redis端口
      redis_db=1
      api_key="pre-gateway-api-key"
      jwt_secret="pre-jwt-secret-key"
      debug="true"
      ;;
    prod)
      port=8003
      redis_port=28001  # 使用相同的Redis端口
      redis_db=2
      api_key="prod-gateway-api-key"
      jwt_secret="prod-jwt-secret-key"
      debug="false"
      ;;
  esac

  # 检查Redis容器是否已存在
  if docker ps -a | grep -q "api-gateway-redis"; then
    echo -e "${YELLOW}Redis容器 api-gateway-redis 已存在，跳过创建...${NC}"
    # 如果Redis容器存在但未运行，则启动它
    if ! docker ps | grep -q "api-gateway-redis"; then
      echo -e "${YELLOW}正在启动已存在的Redis容器...${NC}"
      docker start api-gateway-redis
    fi
  else
    echo -e "${YELLOW}创建Redis容器...${NC}"
    # 直接启动Redis容器，不通过docker-compose
    docker run -d --name api-gateway-redis --network magic-sandbox-network -p ${redis_port}:6379 -v $(pwd)/redis_data:/data redis:alpine redis-server --appendonly yes
  fi

  # 获取Redis容器的IP地址
  local redis_ip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' api-gateway-redis)
  echo -e "${YELLOW}Redis容器IP地址: ${redis_ip}${NC}"

  # 创建临时的docker-compose重写文件
  cat > docker-compose.override.yml <<EOF
services:
  magic-gateway:
    environment:
      - REDIS_HOST=${redis_ip}
      - REDIS_PORT=6379
      - REDIS_DB=${redis_db}
  # 不再通过docker-compose管理redis容器
  magic-redis:
    profiles: ["disabled"]
EOF

  ENV=$env PORT=$port MAGIC_GATEWAY_PORT=$port MAGIC_GATEWAY_API_KEY=$api_key JWT_SECRET=$jwt_secret MAGIC_GATEWAY_DEBUG=$debug \
    docker compose -p magic-gateway-$env up -d --build

  # 移除临时文件
  rm docker-compose.override.yml

  echo -e "${GREEN}$env 环境已启动，访问地址: http://localhost:$port${NC}"
  echo -e "${GREEN}Redis信息: IP=${redis_ip}, 端口=6379, DB=${redis_db}${NC}"
}

# 停止指定环境
function stop_env {
  local env=$1
  echo -e "${YELLOW}正在停止 $env 环境...${NC}"
  docker compose -p magic-gateway-$env down
  echo -e "${YELLOW}$env 环境已停止${NC}"
}

# 查看指定环境日志
function view_logs {
  local env=$1
  echo -e "${GREEN}正在查看 $env 环境日志...${NC}"
  docker compose -p magic-gateway-$env logs -f
}

# 查看指定环境状态
function check_status {
  local env=$1
  echo -e "${GREEN}$env 环境状态:${NC}"
  docker compose -p magic-gateway-$env ps
}

# 处理操作
function process_operation {
  local env=$1
  local operation=$2

  case $operation in
    start)
      start_env $env
      ;;
    stop)
      stop_env $env
      ;;
    restart)
      stop_env $env
      start_env $env
      ;;
    logs)
      view_logs $env
      ;;
    status)
      check_status $env
      ;;
  esac
}

# 处理所有环境
function process_all_envs {
  local operation=$1

  for env in test pre prod; do
    process_operation $env $operation
  done
}

# 主流程
if [ "$1" == "all" ]; then
  process_all_envs $2
else
  process_operation $1 $2
fi

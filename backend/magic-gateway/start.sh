#!/bin/bash

# 设置颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}启动 Go 版 API 网关服务...${NC}"

# 检查API网关进程是否已运行
check_running_process() {
    # 查找正在运行的api-gateway进程
    EXISTING_PID=$(pgrep -f "./api-gateway")

    if [ -n "$EXISTING_PID" ]; then
        echo -e "${RED}检测到API网关服务已在运行，PID: $EXISTING_PID${NC}"
        echo -e "${YELLOW}正在终止现有进程...${NC}"

        # 尝试正常终止进程
        kill $EXISTING_PID 2>/dev/null

        # 等待进程终止
        for i in {1..5}; do
            if ! ps -p $EXISTING_PID > /dev/null; then
                echo -e "${GREEN}成功终止旧进程${NC}"
                return 0
            fi
            echo -e "${YELLOW}等待进程终止，尝试 $i/5...${NC}"
            sleep 1
        done

        # 如果进程仍在运行，强制终止
        echo -e "${RED}无法正常终止进程，尝试强制终止...${NC}"
        kill -9 $EXISTING_PID 2>/dev/null
        if ! ps -p $EXISTING_PID > /dev/null; then
            echo -e "${GREEN}成功强制终止旧进程${NC}"
        else
            echo -e "${RED}无法终止现有进程，请手动终止PID: $EXISTING_PID${NC}"
            exit 1
        fi
    fi

    # 再检查8000端口是否被占用
    PORT_PID=$(lsof -t -i:8000 2>/dev/null)
    if [ -n "$PORT_PID" ]; then
        echo -e "${RED}检测到端口8000已被占用，PID: $PORT_PID${NC}"
        echo -e "${YELLOW}正在释放端口...${NC}"
        kill -9 $PORT_PID 2>/dev/null
        sleep 1
        if lsof -t -i:8000 >/dev/null 2>&1; then
            echo -e "${RED}无法释放端口8000，请手动终止占用该端口的进程${NC}"
            exit 1
        else
            echo -e "${GREEN}成功释放端口8000${NC}"
        fi
    fi
}

# 执行进程检查
check_running_process

# 检查环境变量文件
if [ ! -f .env ]; then
    echo -e "${RED}错误: 未找到.env文件!${NC}"
    echo -e "${YELLOW}创建示例.env文件...${NC}"
    cat > .env << EOF
JWT_SECRET=your-secret-key-change-me
OPENAI_API_KEY=sk-xxxx
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4
DEFAULT_API_URL=https://api.default-service.com
API_GATEWAY_VERSION=1.0.0
EOF
    echo -e "${GREEN}已创建示例.env文件，请编辑该文件设置正确的环境变量${NC}"
    echo -e "${YELLOW}继续启动服务...${NC}"
fi

# 检查 Go 依赖并编译
echo -e "${YELLOW}检查 Go 依赖并编译...${NC}"
go mod tidy
if ! go build -o api-gateway main.go; then
    echo -e "${RED}编译失败，请检查错误信息${NC}"
    exit 1
fi

# 检查可执行文件是否存在
if [ ! -f ./api-gateway ]; then
    echo -e "${RED}编译后的可执行文件不存在，编译可能失败${NC}"
    exit 1
fi

# 显示编译成功信息
echo -e "${GREEN}编译成功!${NC}"

# 启动 API 网关服务
echo -e "${YELLOW}启动 API 网关服务...${NC}"
./api-gateway &
API_PID=$!

# 等待 API 网关服务启动
echo -e "${YELLOW}等待 API 网关服务启动...${NC}"
sleep 3

# 检查 API 网关服务是否正常运行
for i in {1..5}; do
    if curl -s http://localhost:8001/status > /dev/null; then
        echo -e "${GREEN}API 网关服务已启动 (PID: $API_PID)${NC}"
        echo -e "${GREEN}服务已启动${NC}"
        echo -e "${YELLOW}API 网关地址: http://localhost:8001${NC}"

        echo -e "${BLUE}获取令牌示例:${NC}"
        echo -e "${BLUE}curl -X POST http://localhost:8001/auth -H \"X-USER-ID: your-user-id\"${NC}"
        echo -e "${BLUE}注意: 获取令牌请求只能从本地(localhost)发起${NC}"
        echo -e "${BLUE}提示: 令牌永久有效，无过期时间限制，使用Magic-Authorization头${NC}"

        # 显示Docker示例
        echo -e "${BLUE}Docker容器使用示例:${NC}"
        echo -e "${BLUE}# 1. 在宿主机获取令牌${NC}"
        echo -e "${BLUE}TOKEN=\$(curl -s -X POST http://localhost:8001/auth -H \"X-USER-ID: your-user-id\" | jq -r '.token')${NC}"
        echo -e "${BLUE}# 2. 启动容器并注入令牌${NC}"
        echo -e "${BLUE}docker run -e API_TOKEN=\"\$TOKEN\" -e API_GATEWAY_URL=\"http://host.docker.internal:8001\" your-image${NC}"
        echo -e "${BLUE}# 3. 容器内使用令牌示例${NC}"
        echo -e "${BLUE}curl -H \"Magic-Authorization: Bearer \$API_TOKEN\" \$API_GATEWAY_URL/services${NC}"

        echo -e "${YELLOW}按 Ctrl+C 停止服务${NC}"

        # 等待用户按 Ctrl+C
        wait
        exit 0
    else
        echo -e "${YELLOW}等待服务启动，尝试 $i/5...${NC}"
        sleep 2
    fi
done

echo -e "${RED}API 网关服务启动失败，请检查日志${NC}"
kill $API_PID 2>/dev/null || true
exit 1

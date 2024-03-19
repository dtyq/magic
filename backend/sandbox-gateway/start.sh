#!/bin/bash

# 设置颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# 获取脚本目录和项目根目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." &> /dev/null && pwd )"

echo -e "${GREEN}=== 启动沙箱网关服务 ===${NC}\n"

# 进入项目根目录
cd "$PROJECT_ROOT"

# 检查并创建虚拟环境
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}创建虚拟环境...${NC}"
    python -m venv .venv
fi

# 激活虚拟环境
source .venv/bin/activate

# 安装依赖
echo -e "${YELLOW}安装依赖...${NC}"
python -m pip install -r requirements.txt

# 可选端口参数
PORT=${1:-8003}

# 启动沙箱网关
echo -e "${YELLOW}启动沙箱网关服务，监听端口: ${PORT}...${NC}"
python main.py $PORT 
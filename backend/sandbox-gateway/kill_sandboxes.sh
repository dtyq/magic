#!/bin/bash

# 设置颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# 获取项目根目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." &> /dev/null && pwd )"

# 进入项目根目录
cd "$PROJECT_ROOT"

# 检测操作系统类型
OS_TYPE="$(uname -s)"

echo -e "${GREEN}=== 沙箱容器管理工具 ===${NC}\n"

# 显示选项菜单
echo -e "请选择操作："
echo -e "  1. 清理所有沙箱容器"
echo -e "  2. 只清理已退出的沙箱容器"
echo -e "  3. 清理已退出超过指定天数的沙箱容器"
echo -e "  4. 只停止沙箱容器（不删除）"
echo -e "  5. 取消操作"
read -p "请输入选项 [1-5]: " OPTION

# 根据选项设置容器过滤条件
case $OPTION in
    1)
        echo -e "\n${GREEN}=== 查找需要清理的所有沙箱容器 ===${NC}\n"
        FILTER_ARGS="--filter \"name=sandbox-agent-\" --filter \"name=sandbox-qdrant-\""
        ACTION="clean"
        ;;
    2)
        echo -e "\n${GREEN}=== 查找需要清理的已退出沙箱容器 ===${NC}\n"
        FILTER_ARGS="--filter \"name=sandbox-agent-\" --filter \"name=sandbox-qdrant-\" --filter \"status=exited\""
        ACTION="clean"
        ;;
    3)
        echo -e "\n${GREEN}=== 查找需要清理的已退出超过指定天数的沙箱容器 ===${NC}\n"
        # 获取用户输入的天数
        while true; do
            read -p "请输入要清理的容器退出天数（必须是正整数）: " DAYS_FILTER
            if [[ "$DAYS_FILTER" =~ ^[0-9]+$ ]] && [ "$DAYS_FILTER" -gt 0 ]; then
                break
            else
                echo -e "${RED}错误: 请输入有效的正整数天数${NC}"
            fi
        done
        
        echo -e "\n${GREEN}=== 查找已退出超过 ${DAYS_FILTER} 天的沙箱容器 ===${NC}\n"
        
        # 基础过滤条件
        FILTER_ARGS="--filter \"name=sandbox-agent-\" --filter \"name=sandbox-qdrant-\" --filter \"status=exited\""
        ACTION="clean_by_days"
        ;;
    4)
        echo -e "\n${GREEN}=== 查找需要停止的沙箱容器 ===${NC}\n"
        FILTER_ARGS="--filter \"name=sandbox-agent-\" --filter \"name=sandbox-qdrant-\" --filter \"status=running\""
        ACTION="stop"
        ;;
    5|*)
        echo -e "${YELLOW}操作已取消${NC}"
        exit 0
        ;;
esac

# 使用容器名称前缀"sandbox-agent-"和"sandbox-qdrant-"来识别要操作的沙箱容器
SANDBOX_CONTAINERS=$(eval "docker ps -a --format \"{{.ID}} {{.Names}} {{.Status}}\" $FILTER_ARGS")

# 如果是按天数筛选，需要进一步处理
if [ "$ACTION" == "clean_by_days" ]; then
    # 计算过滤的时间戳（当前时间减去用户指定的天数）
    # 根据操作系统使用不同的date命令
    if [[ "$OS_TYPE" == "Darwin" ]]; then
        # macOS 版本
        FILTER_DATE=$(date -v-${DAYS_FILTER}d +%s)
    else
        # Linux 版本
        FILTER_DATE=$(date --date="${DAYS_FILTER} days ago" +%s)
    fi
    
    # 临时存储符合条件的容器
    FILTERED_CONTAINERS=""
    
    # 遍历所有已退出的容器，检查退出时间
    for CONTAINER_ID in $(echo "$SANDBOX_CONTAINERS" | awk '{print $1}'); do
        # 获取容器退出时间
        FINISH_TIME=$(docker inspect --format='{{.State.FinishedAt}}' $CONTAINER_ID)
        
        # 根据操作系统使用不同的时间戳转换命令
        if [[ "$OS_TYPE" == "Darwin" ]]; then
            # macOS 版本，去掉Z后缀并转换
            FINISH_TIMESTAMP=$(date -jf "%Y-%m-%dT%H:%M:%S" "${FINISH_TIME%.*}" +%s)
        else
            # Linux 版本
            FINISH_TIMESTAMP=$(date --date="${FINISH_TIME}" +%s)
        fi
        
        # 如果容器退出时间早于过滤时间，则添加到列表
        if [ $FINISH_TIMESTAMP -lt $FILTER_DATE ]; then
            CONTAINER_INFO=$(echo "$SANDBOX_CONTAINERS" | grep $CONTAINER_ID)
            if [ -z "$FILTERED_CONTAINERS" ]; then
                FILTERED_CONTAINERS="$CONTAINER_INFO"
            else
                FILTERED_CONTAINERS="$FILTERED_CONTAINERS\n$CONTAINER_INFO"
            fi
        fi
    done
    
    # 更新容器列表为过滤后的列表
    SANDBOX_CONTAINERS=$FILTERED_CONTAINERS
fi

if [ -z "$SANDBOX_CONTAINERS" ]; then
    echo -e "${YELLOW}当前没有需要操作的沙箱容器${NC}"
    exit 0
fi

# 统计容器数量
COUNT=$(echo "$SANDBOX_CONTAINERS" | wc -l)
echo -e "${YELLOW}发现 ${COUNT} 个需要操作的沙箱容器:${NC}"

# 显示所有将被操作的容器
echo -e "${YELLOW}将要操作的容器列表:${NC}"
if [ "$OPTION" -eq 2 ] || [ "$OPTION" -eq 3 ]; then
    # 对于已退出的容器，更明确地显示ID
    echo -e "${YELLOW}容器ID\t容器名称\t状态${NC}"
    echo -e "$SANDBOX_CONTAINERS" | awk '{print $1 "\t" $2 "\t" substr($0, index($0,$3))}'
else
    # 保持原来的格式
    echo -e "$SANDBOX_CONTAINERS" | awk '{print "  - " $2 " (" $1 ") - 状态: " substr($0, index($0,$3))}'
fi
echo ""

# 请求用户确认
if [ "$ACTION" == "clean" ] || [ "$ACTION" == "clean_by_days" ]; then
    if [ "$OPTION" -eq 3 ]; then
        read -p "是否要停止并删除这些退出超过 ${DAYS_FILTER} 天的容器? (y/N): " CONFIRM
    else
        read -p "是否要停止并删除这些容器? (y/N): " CONFIRM
    fi
else
    read -p "是否要停止这些容器? (y/N): " CONFIRM
fi

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}操作已取消${NC}"
    exit 0
fi

if [ "$ACTION" == "clean" ] || [ "$ACTION" == "clean_by_days" ]; then
    echo -e "\n${GREEN}=== 开始清理沙箱容器 ===${NC}"
else
    echo -e "\n${GREEN}=== 开始停止沙箱容器 ===${NC}"
fi

# 处理所有沙箱容器
for CONTAINER_INFO in $(echo -e "$SANDBOX_CONTAINERS" | awk '{print $1";"$2}'); do
    CONTAINER_ID=$(echo $CONTAINER_INFO | cut -d';' -f1)
    CONTAINER_NAME=$(echo $CONTAINER_INFO | cut -d';' -f2)
    
    if [ "$ACTION" == "clean" ] || [ "$ACTION" == "clean_by_days" ]; then
        echo -e "${YELLOW}正在停止并删除容器: ${CONTAINER_NAME} (${CONTAINER_ID})${NC}"
        
        # 尝试停止容器
        if docker stop $CONTAINER_ID > /dev/null 2>&1; then
            echo -e "  - 容器已停止"
        else
            echo -e "${RED}  - 停止容器失败${NC}"
        fi
        
        # 尝试删除容器
        if docker rm $CONTAINER_ID > /dev/null 2>&1; then
            echo -e "  - 容器已删除"
        else
            echo -e "${RED}  - 删除容器失败${NC}"
        fi
    else
        echo -e "${YELLOW}正在停止容器: ${CONTAINER_NAME} (${CONTAINER_ID})${NC}"
        
        # 尝试停止容器
        if docker stop $CONTAINER_ID > /dev/null 2>&1; then
            echo -e "  - 容器已停止"
        else
            echo -e "${RED}  - 停止容器失败${NC}"
        fi
    fi
done

if [ "$ACTION" == "clean" ] || [ "$ACTION" == "clean_by_days" ]; then
    echo -e "\n${GREEN}=== 沙箱容器清理完成 ===${NC}"

    # 显示完成后的状态
    if [ "$OPTION" -eq 1 ]; then
        # 检查所有容器
        FILTER_CHECK="--filter \"name=sandbox-agent-\" --filter \"name=sandbox-qdrant-\""
    elif [ "$OPTION" -eq 3 ]; then
        # 这里不再检查，因为按天数过滤的容器可能已经全部被删除
        echo -e "${GREEN}清理已退出超过 ${DAYS_FILTER} 天的沙箱容器操作完成${NC}"
        exit 0
    else
        # 检查已退出容器
        FILTER_CHECK="--filter \"name=sandbox-agent-\" --filter \"name=sandbox-qdrant-\" --filter \"status=exited\""
    fi

    if [ "$OPTION" -ne 3 ]; then
        REMAINING=$(eval "docker ps -a --format \"{{.ID}}\" $FILTER_CHECK" | wc -l)
        if [ "$REMAINING" -eq 0 ]; then
            echo -e "${GREEN}所有需要清理的沙箱容器已成功清除${NC}"
        else
            echo -e "${RED}警告: 仍有 ${REMAINING} 个沙箱容器未能清除${NC}"
            if [ "$OPTION" -eq 1 ]; then
                echo -e "${YELLOW}您可以尝试使用强制选项再次运行:${NC}"
                echo -e "  docker rm -f \$(docker ps -a --filter \"name=sandbox-agent-\" --filter \"name=sandbox-qdrant-\" -q)"
            else
                echo -e "${YELLOW}您可以尝试使用强制选项再次运行:${NC}"
                echo -e "  docker rm -f \$(docker ps -a --filter \"name=sandbox-agent-\" --filter \"name=sandbox-qdrant-\" --filter \"status=exited\" -q)"
            fi
        fi
    fi
else
    echo -e "\n${GREEN}=== 沙箱容器停止完成 ===${NC}"
    
    # 检查是否有容器未能停止
    STILL_RUNNING=$(eval "docker ps --format \"{{.ID}}\" --filter \"name=sandbox-agent-\" --filter \"name=sandbox-qdrant-\" --filter \"status=running\"" | wc -l)
    if [ "$STILL_RUNNING" -eq 0 ]; then
        echo -e "${GREEN}所有沙箱容器已成功停止${NC}"
    else
        echo -e "${RED}警告: 仍有 ${STILL_RUNNING} 个沙箱容器在运行${NC}"
        echo -e "${YELLOW}您可以尝试使用强制选项停止:${NC}"
        echo -e "  docker stop \$(docker ps --filter \"name=sandbox-agent-\" --filter \"name=sandbox-qdrant-\" -q)"
    fi
fi 
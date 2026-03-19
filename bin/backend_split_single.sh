#!/usr/bin/env bash
set -e
set -x

if (( "$#" != 1 ))
then
    echo "Usage: $0 <composer_name>"
    echo "Example: $0 api-response"
    exit 1
fi

NOW=$(date +%s)
COMPOSE_NAME=$1
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# 获取路径信息（关闭命令回显以避免显示路径）
set +x  # 暂时关闭命令回显
# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# 获取 backend 目录的绝对路径
SERVICE_DIR="$(cd "${SCRIPT_DIR}/../backend" && pwd)"
# 获取根目录的绝对路径
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
set -x  # 重新开启命令回显

# 加载环境变量（静默方式）
set +x  # 暂时关闭命令回显
if [ -f "${ROOT_DIR}/.env" ]; then
    echo "Loading environment variables..."
    source "${ROOT_DIR}/.env"
fi
set -x  # 重新开启命令回显

# 使用环境变量获取Git仓库URL，默认使用GitHub
if [ -z "${GIT_REPO_URL}" ]; then
    # 如果环境变量未设置，使用默认值
    GIT_REPO_URL="git@github.com:dtyq"
fi
REMOTE_URL="${GIT_REPO_URL}/${COMPOSE_NAME}.git"

# 添加确认环节，防止误发布
echo "Preparing to publish component to remote repository: ${COMPOSE_NAME} -> ${REMOTE_URL}"
if [[ $REMOTE_URL == *"github"* ]]; then
    echo "🔔 Note: Publishing code to GitHub repository"
elif [[ $REMOTE_URL == *"gitlab"* ]]; then
    echo "🔔 Note: Publishing code to GitLab repository"
fi

read -p "Do you want to continue? (y/n): " confirm
if [[ $confirm != "y" && $confirm != "Y" ]]; then
    echo "Publishing cancelled"
    exit 0
fi

function split()
{
    # 使用 || true 防止 set -e 在 splitsh-lite 返回非零退出码时直接终止脚本
    SHA1=$(./bin/splitsh-lite --prefix=$1) || true

    # SHA1 应为 40 位十六进制字符串，格式不符则视为失败
    if ! [[ $SHA1 =~ ^[0-9a-f]{40}$ ]]; then
        echo "splitsh-lite 执行失败，prefix=$1，输出: $SHA1"
        return 1
    fi

    git push $2 "$SHA1:refs/heads/$CURRENT_BRANCH" -f
}

function remote()
{
    # 检查远程仓库是否已存在
    if git remote | grep -q "^$1$"; then
        CURRENT_URL=$(git remote get-url $1)
        if [ "$CURRENT_URL" != "$2" ]; then
            echo "⚠️ Warning: Remote '$1' exists but points to a different URL"
            echo "Current URL: $CURRENT_URL"
            echo "Expected URL: $2"
            read -p "Do you want to update the remote URL? (y/n): " update_remote
            if [[ $update_remote == "y" || $update_remote == "Y" ]]; then
                echo "Updating remote URL..."
                git remote set-url $1 $2
            else
                echo "❌ Operation cancelled: Remote URL mismatch"
                exit 1
            fi
        fi
    else
        git remote add $1 $2
    fi
}

# 更健壮地处理git pull操作
echo "Checking remote branch status..."
if git ls-remote --heads origin $CURRENT_BRANCH | grep -q $CURRENT_BRANCH; then
    echo "Remote branch exists, pulling now..."
    git pull origin $CURRENT_BRANCH
else
    echo "Remote branch does not exist, skipping pull operation"
fi

# 初始化远程连接
echo "Initializing remote connection..."
remote $COMPOSE_NAME $REMOTE_URL

# 执行分割并推送
echo "Splitting and pushing..."
split "backend/$COMPOSE_NAME" $COMPOSE_NAME

TIME=$(echo "$(date +%s) - $NOW" | bc)

printf "Execution time: %f seconds" $TIME

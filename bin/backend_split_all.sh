#!/usr/bin/env bash

set -e
set -x


# 获取路径信息（关闭命令回显以避免显示路径）
set +x  # 暂时关闭命令回显
# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

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


# Default to GitHub if GIT_REPO_URL is not set
GIT_REPO_URL=${GIT_REPO_URL:-"git@github.com:dtyq"}


# Set ORIGIN based on GIT_REPO_URL
if [[ $GIT_REPO_URL == *"github.com"* ]]; then
    ORIGIN="origin"
else
    ORIGIN="gitlab"
fi


CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
BASEPATH=$(cd `dirname $0`; cd ../backend/; pwd)
REPOS=$@

function split()
{
    # 使用 --scratch 清理缓存，在 CI 环境中避免缓存问题
    SHA1=`./bin/splitsh-lite --prefix=$1 --scratch`

    # 检查 SHA1 是否包含错误信息
    if [[ $SHA1 == *"object not found"* ]] || [[ $SHA1 == *"error"* ]]; then
        echo "Error in splitsh-lite: $SHA1"
        echo "Trying with --debug flag to get more information..."
        SHA1=`./bin/splitsh-lite --prefix=$1 --scratch --debug`
        echo "Debug output: $SHA1"
        return 1
    fi

    # 确保远程分支存在（仅在远程仓库存在时）
    if git remote | grep -q "^$ORIGIN$"; then
        git fetch $ORIGIN $CURRENT_BRANCH 2>/dev/null || true
    fi

    # 设置最大重试次数
    MAX_RETRIES=3
    RETRY_COUNT=0

    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        # 尝试推送
        if git push $2 "$SHA1:refs/heads/$CURRENT_BRANCH" -f; then
            echo "Successfully pushed to $2"
            return 0
        else
            RETRY_COUNT=$((RETRY_COUNT + 1))
            if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
                echo "Push failed, retrying... (Attempt $RETRY_COUNT of $MAX_RETRIES)"
                sleep 2  # 等待2秒后重试
            else
                echo "Failed to push after $MAX_RETRIES attempts"
                return 1
            fi
        fi
    done
}

function remote()
{
    # 检查远程仓库是否已存在
    REPO_URL="$GIT_REPO_URL/$1.git"

    # 如果是 HTTPS URL 且包含认证信息，添加 GitLab token
    if [[ $REPO_URL == https://* ]] && [[ ! $REPO_URL == *oauth2* ]] && [ -n "$GITLAB_TOKEN" ]; then
        REPO_URL=$(echo "$REPO_URL" | sed "s|https://|https://oauth2:${GITLAB_TOKEN}@|")
    fi

    if ! git remote | grep -q "^$1$"; then
        git remote add $1 "$REPO_URL" || true
    else
        git remote set-url $1 "$REPO_URL" || true
    fi
}

# 确保本地分支是最新的
git fetch $ORIGIN $CURRENT_BRANCH 2>/dev/null || true
git pull $ORIGIN $CURRENT_BRANCH || true

if [[ $# -eq 0 ]]; then
    REPOS=$(ls $BASEPATH)
fi

# remote   "sandbox"
# split "backend/sandbox" "$GIT_REPO_URL/sandbox.git"

# Download splitsh-lite from GitHub releases
ARCH=$(uname -m)
SPLITSH_BIN=./bin/splitsh-lite
TEMP_DIR="./tmp"

# Create temporary directory
mkdir -p $TEMP_DIR

# Clean up
rm -rf $TEMP_DIR

for REPO in $REPOS ; do
    remote $REPO
    split "backend/$REPO" $REPO
done

# 处理 docs 仓库（添加 magic- 前缀）
if remote "magic-docs"; then
    split "docs" "magic-docs"
fi

# 处理 frontend/magic-web 仓库
if remote "magic-web"; then
    split "frontend/magic-web" "magic-web"
fi

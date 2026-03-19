#!/usr/bin/env bash

set -e
set -x

# 获取脚本和根目录路径
set +x
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
set -x

# 加载 .env（本地开发场景）
set +x
if [ -f "${ROOT_DIR}/.env" ]; then
    echo "Loading environment variables..."
    source "${ROOT_DIR}/.env"
fi
set -x

# 默认使用 GitHub，CI 环境通过 GIT_REPO_URL 变量覆盖
GIT_REPO_URL=${GIT_REPO_URL:-"git@github.com:dtyq"}

if [[ $GIT_REPO_URL == *"github.com"* ]]; then
    ORIGIN="origin"
else
    ORIGIN="gitlab"
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
BASEPATH=$(cd "$(dirname "$0")"; cd ../backend/; pwd)
REPOS=$@

function split()
{
    # 使用 --scratch 在 CI 环境中避免缓存问题
    # 使用 || true 防止 set -e 在 splitsh-lite 返回非零退出码时直接终止脚本
    SHA1=$(./bin/splitsh-lite --prefix=$1 --scratch 2>&1) || true

    if [[ $SHA1 == *"object not found"* ]] || [[ $SHA1 == *"error"* ]] || [ -z "$SHA1" ]; then
        echo "splitsh-lite 执行失败，prefix=$1，输出: $SHA1"
        return 1
    fi

    if git remote | grep -q "^$ORIGIN$"; then
        git fetch $ORIGIN $CURRENT_BRANCH 2>/dev/null || true
    fi

    MAX_RETRIES=3
    RETRY_COUNT=0
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if git push $2 "$SHA1:refs/heads/$CURRENT_BRANCH" -f; then
            echo "Successfully pushed to $2"
            return 0
        else
            RETRY_COUNT=$((RETRY_COUNT + 1))
            if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
                echo "Push failed, retrying... (Attempt $RETRY_COUNT of $MAX_RETRIES)"
                sleep 2
            else
                echo "Failed to push after $MAX_RETRIES attempts"
                return 1
            fi
        fi
    done
}

function remote()
{
    REPO_URL="$GIT_REPO_URL/$1.git"

    # HTTPS 模式下注入 token
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

TEMP_DIR="./tmp"
mkdir -p $TEMP_DIR
rm -rf $TEMP_DIR

for REPO in $REPOS ; do
    remote $REPO
    split "backend/$REPO" $REPO
done

# 处理 docs 仓库
remote "magic-docs"
split "docs" "magic-docs" || true

# 处理 frontend/magic-web 仓库
remote "magic-web"
split "frontend/magic-web" "magic-web" || true

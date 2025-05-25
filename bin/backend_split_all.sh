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
GIT_REPO_URL="https://git.kkgroup.cn/dtyq/"


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
    SHA1=`./bin/splitsh-lite --prefix=$1`
    # 确保远程分支存在
    git fetch $ORIGIN $CURRENT_BRANCH 2>/dev/null || true
    # 尝试推送，如果失败则创建新分支
    if ! git push $2 "$SHA1:refs/heads/$CURRENT_BRANCH" -f; then
        echo "Failed to push to existing branch, trying to create new branch..."
        git push $2 "$SHA1:refs/heads/$CURRENT_BRANCH" -f --force-with-lease
    fi
}

function remote()
{
    # 检查远程仓库是否已存在
    if ! git remote | grep -q "^$1$"; then
        git remote add $1 "$GIT_REPO_URL/$1.git" || true
    else
        git remote set-url $1 "$GIT_REPO_URL/$1.git" || true
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

# 下载并解压 splitsh-lite
curl -L https://github.com/splitsh/lite/releases/download/v1.0.1/lite_linux_amd64.tar.gz -o $TEMP_DIR/lite_linux_amd64.tar.gz
tar -xzvf $TEMP_DIR/lite_linux_amd64.tar.gz -C $TEMP_DIR
mv $TEMP_DIR/splitsh-lite $SPLITSH_BIN
chmod +x $SPLITSH_BIN

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



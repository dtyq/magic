#!/usr/bin/env bash
set -e
set -x

# 获取路径信息（关闭命令回显以避免显示路径）
set +x  # 暂时关闭命令回显
# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# 获取 service 目录的绝对路径
SERVICE_DIR="$(cd "${SCRIPT_DIR}/../backend/magic-service" && pwd)"
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
REMOTE_URL="${GIT_REPO_URL}/magic-service.git"

# 检查是否为GitHub仓库，如果不是则认为是GitLab仓库
IS_GITHUB=false
if [[ $REMOTE_URL == *"github"* ]]; then
    IS_GITHUB=true
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# 获取版本号或分支名
if (( "$#" == 1 )); then
    VERSION=$1
    # Always prepend with "v"
    if [[ $VERSION != v*  ]]; then
        VERSION="v$VERSION"
    fi
    USE_BRANCH=false
    TARGET_BRANCH=$CURRENT_BRANCH
else
    if [[ $IS_GITHUB == false ]]; then
        # 如果不是GitHub且未提供版本号，则使用当前分支
        echo "No version provided, using current branch: ${CURRENT_BRANCH}"
        USE_BRANCH=true
        TARGET_BRANCH=$CURRENT_BRANCH
    else
        echo "Tag has to be provided"
        exit 1
    fi
fi

NOW=$(date +%s)

# 添加确认环节，防止误发布
echo "Preparing to publish to remote repository: ${REMOTE_URL}"
if [[ $IS_GITHUB == true ]]; then
    echo "🔔 Note: Publishing code to GitHub repository"
    echo "🔔 Using version: ${VERSION}"
else
    echo "🔔 Note: Publishing code to GitLab repository"
    if [[ $USE_BRANCH == true ]]; then
        echo "🔔 Using branch: ${CURRENT_BRANCH}"
    else
        echo "🔔 Using version: ${VERSION}"
    fi
fi

read -p "Do you want to continue? (y/n): " confirm
if [[ $confirm != "y" && $confirm != "Y" ]]; then
    echo "Publishing cancelled"
    exit 0
fi

function split()
{
    SHA1=`./bin/splitsh-lite --prefix=$1`
    git push $2 "$SHA1:refs/heads/$TARGET_BRANCH" -f
}

function remote()
{
    git remote add $1 $2 || true
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
remote magic-service $REMOTE_URL

# 执行分割并推送
echo "Splitting and pushing..."
split "backend/magic-service" magic-service

# 打标签并推送标签
if [[ $USE_BRANCH == false ]]; then
    echo "Tagging and pushing tag..."
    git fetch magic-service || true
    git tag -a $VERSION -m "Release $VERSION" $CURRENT_BRANCH
    git push magic-service $VERSION
fi

TIME=$(echo "$(date +%s) - $NOW" | bc)

printf "Execution time: %f seconds" $TIME
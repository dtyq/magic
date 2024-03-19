#!/usr/bin/env bash
set -e
set -x

# if (( "$#" != 1 ))
# then
#     echo "Tag has to be provided"

#     exit 1
# fi

NOW=$(date +%s)
VERSION=$1
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Always prepend with "v"
if [[ $VERSION != v*  ]]
then
    VERSION="v$VERSION"
fi

# 获取路径信息（关闭命令回显以避免显示路径）
set +x  # 暂时关闭命令回显
# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# 获取 docs 目录的绝对路径
DOCS_DIR="$(cd "${SCRIPT_DIR}/../docs" && pwd)"
# 获取根目录的绝对路径
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
set -x  # 重新开启命令回显

# 加载环境变量 (静默方式)
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
REMOTE_URL="${GIT_REPO_URL}/magic-docs.git"

# 添加确认环节，防止误发布
echo "Preparing to publish to remote repository: ${REMOTE_URL}"
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
    SHA1=`./bin/splitsh-lite --prefix=$1`
    git push $2 "$SHA1:refs/heads/$CURRENT_BRANCH" -f
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
remote magic-docs $REMOTE_URL

# 执行分割并推送
echo "Splitting and pushing..."
split "docs" magic-docs

# # 打标签并推送标签
# echo "Tagging and pushing tag..."
# git fetch magic-docs || true
# git tag -a $VERSION -m "Release $VERSION" $CURRENT_BRANCH
# git push magic-docs $VERSION

TIME=$(echo "$(date +%s) - $NOW" | bc)

printf "Execution time: %f seconds" $TIME

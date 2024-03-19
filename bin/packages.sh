#!/usr/bin/env bash
set -e

if (( "$#" != 2 ))
then
    echo "Usage: $0 <package_name> <version>"
    echo "Example: $0 api-response 1.0.0"
    exit 1
fi

NOW=$(date +%s)
COMPOSE_NAME=$1
VERSION=$2

# Always prepend with "v"
if [[ $VERSION != v*  ]]
then
    VERSION="v$VERSION"
fi

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# 获取 service 目录的绝对路径
SERVICE_DIR="$(cd "${SCRIPT_DIR}/../frontend" && pwd)"
# 获取根目录的绝对路径
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 加载环境变量
if [ -f "${ROOT_DIR}/.env" ]; then
    export $(grep -v '^#' "${ROOT_DIR}/.env" | xargs)
fi

echo ""
echo ""
echo "Cloning ${COMPOSE_NAME}";
TMP_DIR="/tmp/magic-split"
# 使用环境变量获取Git仓库URL，默认使用GitHub
if [ -z "${GIT_REPO_URL}" ]; then
    # 如果环境变量未设置，使用默认值
    GIT_REPO_URL="git@github.com:dtyq"
fi
REMOTE_URL="${GIT_REPO_URL}/${COMPOSE_NAME}.git"

rm -rf $TMP_DIR;
mkdir $TMP_DIR;

(
    cd $TMP_DIR;
    git clone $REMOTE_URL;
    echo "git clone ${REMOTE_URL} success";
    ls -l;
    cd ${COMPOSE_NAME};

    # 获取默认分支名
    DEFAULT_BRANCH=$(git remote show origin | grep 'HEAD branch' | cut -d' ' -f5);
    git checkout $DEFAULT_BRANCH;

    # 备份原有的 Dockerfile
    # if [ -f Dockerfile ]; then
    #     mv Dockerfile Dockerfile.bak
    # fi

    # 复制 service 目录下的组件文件
    echo "${SERVICE_DIR}/${COMPOSE_NAME}"
    cp -a "${SERVICE_DIR}/${COMPOSE_NAME}"/* .
    # cp -a "${SERVICE_DIR}/${COMPOSE_NAME}"/.gitignore .


    # 添加并提交更改
    git add .
    git commit -m "chore: update service files for version ${VERSION}"

    if [[ $(git log --pretty="%d" -n 1 | grep tag --count) -eq 0 ]]; then
        echo "Releasing ${COMPOSE_NAME}"
        git tag $VERSION
        git push origin $DEFAULT_BRANCH
        git push origin --tags
    fi
)

TIME=$(echo "$(date +%s) - $NOW" | bc)

printf "Execution time: %f seconds" $TIME

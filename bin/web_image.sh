#!/usr/bin/env bash

### web 本地构建镜像
set -e

# determine swoole version to build.
TASK=${1}
TAG=${2}
CHECK=${!#}


export WEB_IMAGE="dtyq/magic-web"
export REGISTRY="ghcr.io"

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# 获取 service 目录的绝对路径
SERVICE_DIR="$(cd "${SCRIPT_DIR}/../frontend/magic-web" && pwd)"

function publish() {
    echo "Publishing "$TAG" ..."
    # Push origin image
    docker push ${REGISTRY}"/"${WEB_IMAGE}":"${TAG}

    echo -e "\n"
}

# 检查并安装 buildx
check_and_install_buildx() {
    if ! docker buildx version > /dev/null 2>&1; then
        echo "Docker Buildx not detected, attempting to install..."

        # 检测操作系统并安装
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            echo "Linux system detected, installing Buildx..."
            # Linux 安装方法
            mkdir -p ~/.docker/cli-plugins/
            BUILDX_URL="https://github.com/docker/buildx/releases/download/v0.10.4/buildx-v0.10.4.linux-amd64"
            if ! curl -sSL "$BUILDX_URL" -o ~/.docker/cli-plugins/docker-buildx; then
                echo "Failed to download Buildx, please check your network connection or install manually: https://docs.docker.com/go/buildx/"
                exit 1
            fi
            chmod +x ~/.docker/cli-plugins/docker-buildx
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            echo "macOS system detected, recommending Homebrew installation..."
            read -p "Do you want to install Docker Buildx using Homebrew? (y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                if ! command -v brew &> /dev/null; then
                    echo "Homebrew not detected, please install Homebrew first: https://brew.sh/"
                    exit 1
                fi
                brew install docker-buildx
            else
                echo "Please install Docker Buildx manually: https://docs.docker.com/go/buildx/"
                exit 1
            fi
        else
            echo "Unsupported operating system, please install Docker Buildx manually: https://docs.docker.com/go/buildx/"
            exit 1
        fi

        # 验证安装
        if docker buildx version > /dev/null 2>&1; then
            echo "Docker Buildx installed successfully: $(docker buildx version | head -n 1)"
        else
            echo "Docker Buildx installation failed, please install manually: https://docs.docker.com/go/buildx/"
            exit 1
        fi
    else
        echo "Docker Buildx is already installed: $(docker buildx version | head -n 1)"
    fi
}

# build base image
if [[ ${TASK} == "build" ]]; then
    # 检查并安装 buildx
    check_and_install_buildx


    # 启用 BuildKit
    export DOCKER_BUILDKIT=1

    echo "Building image: ${REGISTRY}/${WEB_IMAGE}:${TAG}"
    docker build -t ${REGISTRY}"/"${WEB_IMAGE}":"${TAG} -f ./frontend/magic-web/Dockerfile.web ./frontend/magic-web
fi

if [[ ${TASK} == "publish" ]]; then
    # Push base image
    publish $TAG
fi

#!/bin/bash

set -e

# 默认值
IMAGE_NAME="sandbox-components"
IMAGE_TAG="latest"
BUILD_FLAGS=""

# 显示帮助信息
show_help() {
    echo "用法: $0 [选项]"
    echo "选项:"
    echo "  -n, --name NAME      设置镜像名称 (默认: $IMAGE_NAME)"
    echo "  -t, --tag TAG        设置镜像标签 (默认: $IMAGE_TAG)"
    echo "  -f, --flags FLAGS    额外的构建参数"
    echo "  -h, --help           显示此帮助信息"
    exit 0
}

# 解析命令行参数
while [ $# -gt 0 ]; do
    case "$1" in
        -n|--name)
            IMAGE_NAME="$2"
            shift 2
            ;;
        -t|--tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -f|--flags)
            BUILD_FLAGS="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            ;;
        *)
            echo "错误: 未知选项 $1"
            show_help
            ;;
    esac
done

FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"

echo "============================================"
echo "开始构建镜像: $FULL_IMAGE_NAME"
[ -n "$BUILD_FLAGS" ] && echo "额外构建参数: $BUILD_FLAGS"
echo "============================================"

# 构建Docker镜像
docker build \
    --build-arg BUILD_FLAGS="$BUILD_FLAGS" \
    -t "$FULL_IMAGE_NAME" \
    -f Dockerfile .

if [ $? -eq 0 ]; then
    echo "============================================"
    echo "镜像构建成功: $FULL_IMAGE_NAME"
    echo "============================================"
    
    # 显示镜像信息
    docker images | grep "$IMAGE_NAME" | grep "$IMAGE_TAG"
else
    echo "============================================"
    echo "镜像构建失败!"
    echo "============================================"
    exit 1
fi 
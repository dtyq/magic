#!/bin/bash
# 构建沙箱网关服务 Docker 镜像脚本

set -e

# 默认参数
DOCKERFILE="./Dockerfile"
NO_CACHE=false
BUILD_ARGS=()
USE_BUILDKIT=true

# 加载.env文件中的环境变量
if [ -f .env ]; then
  source .env
fi

# 检查SANDBOX_GATEWAY_IMAGE环境变量是否存在
if [ -z "${SANDBOX_GATEWAY_IMAGE}" ]; then
  echo "错误: 环境变量 SANDBOX_GATEWAY_IMAGE 未设置"
  echo "请在.env文件中设置SANDBOX_GATEWAY_IMAGE变量"
  exit 1
fi

# 输出使用帮助
usage() {
  echo "使用方法: $0 [选项]"
  echo "选项:"
  echo "  -t, --tag <镜像标签>     指定镜像标签名称，将覆盖环境变量中的设置"
  echo "  -f, --file <文件路径>    指定 Dockerfile 路径 (默认: ./Dockerfile)"
  echo "  --no-cache              构建时不使用缓存"
  echo "  --no-buildkit           不使用 BuildKit 构建（默认启用 BuildKit）"
  echo "  --build-arg <参数>      构建参数，格式为 KEY=VALUE"
  echo "  -h, --help              显示帮助信息"
  exit 1
}

# 处理命令行参数
while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--tag)
      TAG="$2"
      shift 2
      ;;
    -f|--file)
      DOCKERFILE="$2"
      shift 2
      ;;
    --no-cache)
      NO_CACHE=true
      shift
      ;;
    --no-buildkit)
      USE_BUILDKIT=false
      shift
      ;;
    --build-arg)
      BUILD_ARGS+=("$2")
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "错误: 未知选项 $1"
      usage
      ;;
  esac
done

# 检查 Dockerfile 是否存在
if [ ! -f "$DOCKERFILE" ]; then
  echo "错误: Dockerfile 文件不存在: $DOCKERFILE"
  exit 1
fi

# 如果未在命令行参数中指定镜像标签，则使用环境变量中的值
if [ -z "$TAG" ]; then
  TAG="${SANDBOX_GATEWAY_IMAGE}"
  echo "使用环境变量中的镜像标签: $TAG"
fi

echo "开始构建沙箱网关服务 Docker 镜像: $TAG"
echo "使用 Dockerfile: $DOCKERFILE"

# 设置 BuildKit 环境变量
if [ "$USE_BUILDKIT" = true ]; then
  echo "启用 BuildKit 加速构建和缓存依赖"
  export DOCKER_BUILDKIT=1
else
  echo "未启用 BuildKit"
  unset DOCKER_BUILDKIT
fi

# 构建 Docker 命令
BUILD_CMD="docker build -t $TAG -f $DOCKERFILE --progress=plain"

# 添加 --no-cache 选项（如果指定）
if [ "$NO_CACHE" = true ]; then
  BUILD_CMD="$BUILD_CMD --no-cache"
fi

# 添加构建参数（如果有）
for arg in "${BUILD_ARGS[@]}"; do
  BUILD_CMD="$BUILD_CMD --build-arg $arg"
done

# 添加构建上下文路径
BUILD_CMD="$BUILD_CMD ."

# 执行构建
echo "执行命令: $BUILD_CMD"
if eval "$BUILD_CMD"; then
  echo "镜像构建成功: $TAG"
  echo -e "\n构建完成! 镜像标签: $TAG"
else
  echo "镜像构建失败，错误码: $?"
  exit 1
fi 
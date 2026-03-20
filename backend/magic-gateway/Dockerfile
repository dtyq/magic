
ARG GOLANG_VERSION=1.24
ARG DOCKERHUB_LIBRARY_IMAGE_PREFIX=public.ecr.aws/docker/library/
FROM ${DOCKERHUB_LIBRARY_IMAGE_PREFIX}golang:${GOLANG_VERSION}-alpine AS builder

ARG TARGETARCH

ARG GOPROXY=https://goproxy.cn,direct
ARG GOLANG_VERSION=1.24

# 设置Go模块代理
ENV GOPROXY=${GOPROXY}

WORKDIR /app

COPY go.mod go.sum ./
RUN --mount=type=cache,id=go-mod-${GOLANG_VERSION}-alpine-${TARGETARCH},target=/go/pkg/mod \
    go mod download

COPY . .
RUN --mount=type=cache,id=go-mod-${GOLANG_VERSION}-alpine-${TARGETARCH},target=/go/pkg/mod \
    --mount=type=cache,id=go-build-${GOLANG_VERSION}-alpine-${TARGETARCH},target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -o api-gateway .

ARG DOCKERHUB_LIBRARY_IMAGE_PREFIX=public.ecr.aws/docker/library/
FROM ${DOCKERHUB_LIBRARY_IMAGE_PREFIX}alpine:latest

ARG TARGETARCH

WORKDIR /app

# 从builder阶段复制编译好的二进制文件
COPY --from=builder /app/api-gateway /app/

# setup timezone
ARG APK_MIRROR=mirrors.aliyun.com
ARG TZ=Asia/Shanghai
RUN --mount=type=cache,id=alpine-apk-latest-${TARGETARCH},target=/var/cache/apk \
    # setup apk mirror
    sed -i.bak "s/dl-cdn.alpinelinux.org/${APK_MIRROR}/g" /etc/apk/repositories && \
    apk update && \
    apk add tzdata && \
    ln -sf /usr/share/zoneinfo/${TZ} /etc/localtime && \
    echo "${TZ}" > /etc/timezone && \
    mkdir -p /app/config && \
    # restore apk repositories
    mv /etc/apk/repositories.bak /etc/apk/repositories

# 环境变量
ENV MAGIC_GATEWAY_ENV=dev
ENV MAGIC_GATEWAY_DEBUG=false

# 添加健康检查
#HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
#  CMD wget -q -O- http://localhost:${PORT}/status || exit 1

CMD ["./api-gateway"]


ARG DOCKERHUB_LIBRARY_IMAGE_PREFIX=public.ecr.aws/docker/library/
ARG GOLANG_VERSION=1.24
ARG ALPINE_VERSION=latest
FROM ${DOCKERHUB_LIBRARY_IMAGE_PREFIX}golang:${GOLANG_VERSION}-alpine AS builder

ARG CI_COMMIT_SHA=""
ARG CI_COMMIT_TAG=""
ARG CI_COMMIT_BRANCH=""

ARG GOPROXY=https://goproxy.cn,direct
ARG GOLANG_VERSION=1.24

# 设置Go模块代理
ENV GOPROXY=${GOPROXY}

WORKDIR /app

ARG APK_MIRROR=mirrors.aliyun.com
RUN --mount=type=cache,id=golang-${GOLANG_VERSION}-apk,target=/var/cache/apk \
    # setup apk mirror
    sed -i.bak "s/dl-cdn.alpinelinux.org/${APK_MIRROR}/g" /etc/apk/repositories && \
    apk add \
        make \
        bash

COPY go.mod go.sum ./
RUN --mount=type=cache,id=go-mod-${GOLANG_VERSION}-alpine,target=/go/pkg/mod \
    go mod download

COPY . .
RUN --mount=type=cache,id=go-mod-${GOLANG_VERSION}-alpine,target=/go/pkg/mod \
    --mount=type=cache,id=go-build-${GOLANG_VERSION}-alpine,target=/root/.cache/go-build \
    export CGO_ENABLED=0 ; \
    make VERSION=${CI_COMMIT_TAG:-unknown} all

ARG DOCKERHUB_LIBRARY_IMAGE_PREFIX=public.ecr.aws/docker/library/
ARG ALPINE_VERSION=latest
FROM ${DOCKERHUB_LIBRARY_IMAGE_PREFIX}alpine:${ALPINE_VERSION}

LABEL org.opencontainers.image.title="Sandbox Gateway"
LABEL org.opencontainers.image.description="Sandbox Gateway - Container Management API Gateway"
LABEL org.opencontainers.image.version="0.1.0"
LABEL org.opencontainers.image.source="https://github.com/dtyq/sandbox-components"

# setup timezone
ARG APK_MIRROR=mirrors.aliyun.com
ARG TZ=Asia/Shanghai
ARG ALPINE_VERSION=latest
RUN --mount=type=cache,id=alpine-${ALPINE_VERSION},target=/var/cache/apk \
    # setup apk mirror
    sed -i.bak "s/dl-cdn.alpinelinux.org/${APK_MIRROR}/g" /etc/apk/repositories && \
    apk add \
        ca-certificates \
        tzdata \
    && \
    ln -sf /usr/share/zoneinfo/${TZ} /etc/localtime && \
    echo "${TZ}" > /etc/timezone && \
    mkdir -p /app/config && \
    # restore apk repositories
    mv /etc/apk/repositories.bak /etc/apk/repositories

ARG CI_COMMIT_TAG=""
ARG TZ=Asia/Shanghai
ENV SANDBOX_GATEWAY_TAG=${CI_COMMIT_TAG} \
    TZ=${TZ}

WORKDIR /app

COPY --from=builder /app/bin/ /app/bin/

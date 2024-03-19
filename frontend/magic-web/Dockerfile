# ===== 基础镜像配置 =====
ARG NODE_VERSION=22
ARG DOCKERHUB_LIBRARY_IMAGE_PREFIX=public.ecr.aws/docker/library/
ARG NODE_IMAGE=${DOCKERHUB_LIBRARY_IMAGE_PREFIX}node:${NODE_VERSION}-alpine
# =================================================

# build
FROM ${NODE_IMAGE} AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
COPY plugins ./plugins

ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN --mount=type=cache,id=node-${NODE_VERSION}-npm,target=/root/.npm \
    --mount=type=cache,id=node-${NODE_VERSION}-npm-compile-cache,target=/tmp/node-compile-cache \
    npm config set registry "${NPM_REGISTRY}" && \
    npm install pnpm --location=global && \
    npm install patch-package -g && \
    pnpm install

COPY . .

RUN --mount=type=cache,id=node-${NODE_VERSION}-npm,target=/root/.npm \
    --mount=type=cache,id=node-${NODE_VERSION}-npm-compile-cache,target=/tmp/node-compile-cache \
    pnpm build:opensource

# deploy
FROM ${NODE_IMAGE} AS runner

# 在 runner 阶段重新定义环境变量
ARG CI_COMMIT_SHA=
ARG CI_COMMIT_TAG=

ENV \
    MAGIC_APP_SHA=${CI_COMMIT_SHA} \
    MAGIC_APP_VERSION=${CI_COMMIT_TAG}

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

COPY server/package.json ./

ARG NODE_VERSION=22
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN --mount=type=cache,id=node-${NODE_VERSION}-npm,target=/root/.npm \
    --mount=type=cache,id=node-${NODE_VERSION}-npm-compile-cache,target=/tmp/node-compile-cache \
    npm config set registry "${NPM_REGISTRY}" && \
    npm install && \
    # restore npm registry
    rm ~/.npmrc

CMD ["node", "./server/app.cjs"]

EXPOSE 8080

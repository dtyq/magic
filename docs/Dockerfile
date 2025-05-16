# ===== 基础镜像配置 =====
# 基础镜像: node:18-alpine
ARG IMAGE_SOURCE
ARG NODE_BASE_IMAGE=${IMAGE_SOURCE}node:18-alpine
ARG CADDY_BASE_IMAGE=${IMAGE_SOURCE}caddy:alpine
# =================================================

FROM ${NODE_BASE_IMAGE} AS builder

WORKDIR /app

COPY package.json  ./

RUN npm install -g pnpm
RUN pnpm install

COPY . /app

RUN pnpm docs:build

FROM ${CADDY_BASE_IMAGE}

COPY --from=builder /app/.vitepress/dist /srv/dist/
COPY Caddyfile /Caddyfile

CMD ["caddy", "run", "--config", "/Caddyfile"]

EXPOSE 80

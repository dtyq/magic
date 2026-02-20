# ========= 基础镜像 =========
ARG DEBIAN_VERSION=trixie
ARG DOCKERHUB_LIBRARY_IMAGE_PREFIX=public.ecr.aws/docker/library/
FROM ${DOCKERHUB_LIBRARY_IMAGE_PREFIX}debian:${DEBIAN_VERSION} AS base

# 环境变量
ARG TZ=Asia/Shanghai
ENV TZ=${TZ} \
 PYTHONDONTWRITEBYTECODE=1 \
 PYTHONUNBUFFERED=1 \
 TIKTOKEN_CACHE_DIR=/app/tiktoken_cache \
 AUTO_REGENERATE_TOOL_DEFINITIONS=false \
 UNZIP="-O UTF-8" \
 ZIPINFO="-O UTF-8" \
 XDG_CACHE_HOME=/app/.cache \
 XDG_CONFIG_HOME=/app/.config \
 MPLCONFIGDIR=/app/.config/matplotlib \
 npm_config_cache=/app/.cache/npm

SHELL ["/bin/bash", "-c"]

# 准备基础依赖
ARG DEBIAN_VERSION=trixie
ARG APT_MIRROR=mirrors.aliyun.com
RUN --mount=type=cache,id=debian-${DEBIAN_VERSION}-apt,target=/var/cache/apt \
 --mount=type=cache,id=debian-${DEBIAN_VERSION}-apt-lists,target=/var/lib/apt/lists \
 # setup apt mirror follow deb-822 format
 sed -i.bak "s/deb.debian.org/${APT_MIRROR}/g" /etc/apt/sources.list.d/debian.sources && \
 # debian的docker会自动删除下载的包 导致缓存失效 因此修改一下
 mv /etc/apt/apt.conf.d/docker-clean /tmp/docker-clean.bak && \
 apt-get update && \
 apt-get install -y --no-install-recommends \
 python3 \
 python3-packaging \
 python3-setuptools \
 python3-tk \
 python3-dev \
 python3-pip \
 python3-venv \
 curl \
 ca-certificates \
 git \
 vim \
 patch \
 tzdata \
 ripgrep \
 tree \
 fontconfig \
 binutils \
 zip \
 unzip \
 xz-utils \
 make \
 ffmpeg \
 tini \
 libheif-dev \
 libheif1

# 安装 LibreOffice（用于 .doc, .xls 和 .ppt 文件转换）
RUN --mount=type=cache,id=debian-${DEBIAN_VERSION}-apt,target=/var/cache/apt \
 --mount=type=cache,id=debian-${DEBIAN_VERSION}-apt-lists,target=/var/lib/apt/lists \
 apt-get update && \
 apt-get install -y --no-install-recommends \
 libreoffice-core-nogui \
 libreoffice-writer-nogui \
 libreoffice-calc-nogui \
 libreoffice-impress-nogui \
 libreoffice-java-common \
 default-jre-headless

# 安装指定版本的Node.js和TypeScript
ARG NODE_VERSION=24
ARG NODEJS_MIRROR=https://mirrors.aliyun.com/nodejs-release/
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN --mount=type=cache,id=debian-${DEBIAN_VERSION}-npm,target=/root/.npm \
 --mount=type=cache,id=debian-${DEBIAN_VERSION}-npm-compile-cache,target=/tmp/node-compile-cache \
 # 根据系统架构选择对应的 Node.js 二进制包
 ARCH=$(uname -m | sed 's/x86_64/x64/' | sed 's/aarch64/arm64/') && \
 NODE_FULL_VERSION=$(curl -fsSL "${NODEJS_MIRROR}index.json" | \
 python3 -c "import json,sys; v=[d['version'] for d in json.load(sys.stdin) if int(d['version'][1:].split('.')[0])==${NODE_VERSION}][0]; print(v)") && \
 NODE_FILE="node-${NODE_FULL_VERSION}-linux-${ARCH}.tar.xz" && \
 curl -fsSL "${NODEJS_MIRROR}${NODE_FULL_VERSION}/${NODE_FILE}" -o "${NODE_FILE}" && \
 tar -xJf "${NODE_FILE}" -C /usr/local --strip-components=1 --no-same-owner && \
 rm "${NODE_FILE}" && \
 # install pnpm
 curl -fsSL https://get.pnpm.io/install.sh | PNPM_HOME="/opt/pnpm" ENV="$HOME/.bashrc" SHELL="$(which bash)" bash - && \
 export PNPM_HOME="/opt/pnpm" && \
 export PATH="${PNPM_HOME}:${PATH}" && \
 # install typescript
 pnpm --registry="${NPM_REGISTRY}" \
 --cache=/root/.npm \
 install -g typescript@5 && \
 echo "========== Node.js 版本信息 ==========" && \
 node -v && \
 echo "========== npm 版本信息 ==========" && \
 npm -v && \
 echo "========== pnpm 版本信息 ==========" && \
 pnpm -v && \
 echo "========== TypeScript 版本信息 ==========" && \
 tsc -v && \
 echo "========== npx 版本信息 ==========" && \
 npx -v

ENV PNPM_HOME=/opt/pnpm
ENV PATH="/opt/pnpm:$PATH"

# 杂项配置
COPY deploy/ /app/deploy/
RUN --mount=type=cache,id=debian-${DEBIAN_VERSION}-apt,target=/var/cache/apt \
 --mount=type=cache,id=debian-${DEBIAN_VERSION}-apt-lists,target=/var/lib/apt/lists \
 # alias python
 ln -sf /usr/bin/python3 /usr/bin/python && \
 # setup timezone
 ln -snf "/usr/share/zoneinfo/${TZ}" /etc/localtime && \
 echo "${TZ}" > /etc/timezone && \
 # 用bash做默认shell 不要用坑爹dash
 ln -sf /usr/bin/bash /bin/sh && \
 # 让entrypoint执行bashrc
 echo -e "#!/usr/bin/bash\n[ -f ~/.bashrc ] && . ~/.bashrc\nexec tini -- \"\$@\"" > /entrypoint.sh && \
 chmod +x /entrypoint.sh

# 设置工作目录
WORKDIR /build

# 创建venv，安装依赖
COPY requirements.txt requirements_sandbox.txt .
ENV PATH="/venv/bin:$PATH"
ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
RUN --mount=type=cache,id=debian-${DEBIAN_VERSION}-pip,target=/root/.cache/pip \
 pip config set global.index-url "${PIP_INDEX_URL}" && \
 python3 -m venv /venv && \
 export PATH="/venv/bin:$PATH" && \
 echo "========== pip 版本信息 ==========" && \
 pip --version && \
 pip install --upgrade pip wheel && \
 pip install \
 --prefer-binary \
 uv \
 tiktoken \
 -r requirements.txt \
 -r requirements_sandbox.txt && \
 opentelemetry-bootstrap -a install && \
 python /app/deploy/setup_font.py

# 安装项目并预加载 tiktoken
COPY . .
COPY scripts/preload_tiktoken.py /app/scripts/preload_tiktoken.py
RUN mkdir -p /app/tiktoken_cache && \
 chmod 777 /app/tiktoken_cache && \
 pip install ./agentlang && \
 python3 /app/scripts/preload_tiktoken.py && \
 python3 main.py tools generate

# 还原镜像源
RUN \
 # restore mirrors
 mv /etc/apt/sources.list.d/debian.sources.bak /etc/apt/sources.list.d/debian.sources && \
 rm "${XDG_CONFIG_HOME}/pip/pip.conf"

# 获取Git commit ID并保存到环境变量
ARG CI_COMMIT_SHA="未知"
ENV CI_COMMIT_SHA=${CI_COMMIT_SHA}

# 设置 tini 作为 init 进程
ENTRYPOINT [ "/entrypoint.sh" ]

EXPOSE 8000
EXPOSE 8002

CMD ["./main", "start", "ws-server"]

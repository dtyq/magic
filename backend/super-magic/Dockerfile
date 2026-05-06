# ========= 基础镜像 =========
ARG DEBIAN_VERSION=trixie
ARG DOCKERHUB_LIBRARY_IMAGE_PREFIX=public.ecr.aws/docker/library/
FROM ${DOCKERHUB_LIBRARY_IMAGE_PREFIX}debian:${DEBIAN_VERSION} AS base

ARG TARGETARCH

# 环境变量
ARG TZ=Asia/Shanghai
ARG USER_HOME_DIR=/app/.user
ENV TZ=${TZ} \
    LANG=en_US.UTF-8 \
    LC_CTYPE=en_US.UTF-8 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONUTF8=1 \
    AUTO_REGENERATE_TOOL_DEFINITIONS=false \
    UNZIP="-O UTF-8" \
    ZIPINFO="-O UTF-8" \
    IS_DOCKER=true \
    USER_HOME_DIR=${USER_HOME_DIR}

SHELL ["/bin/bash", "-c"]

# 准备基础依赖
ARG DEBIAN_VERSION=trixie
ARG DEBIAN_APT_MIRROR=mirrors.aliyun.com
RUN --mount=type=cache,id=debian-${DEBIAN_VERSION}-apt-${TARGETARCH},target=/var/cache/apt \
    --mount=type=cache,id=debian-${DEBIAN_VERSION}-apt-lists-${TARGETARCH},target=/var/lib/apt/lists \
    # setup apt mirror follow deb-822 format
    sed -i.bak "s/deb.debian.org/${DEBIAN_APT_MIRROR}/g" /etc/apt/sources.list.d/debian.sources && \
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
        locales \
        ripgrep \
        tree \
        fontconfig \
        binutils \
        zip \
        unzip \
        make \
        ffmpeg \
        tini \
        libheif-dev \
        libheif1 && \
    # generate locale so Chinese filenames display correctly in interactive shells
    sed -i 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
    locale-gen en_US.UTF-8 && \
    update-locale LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

# 安装 LibreOffice（用于 .doc, .xls 和 .ppt 文件转换）
RUN --mount=type=cache,id=debian-${DEBIAN_VERSION}-apt-${TARGETARCH},target=/var/cache/apt \
    --mount=type=cache,id=debian-${DEBIAN_VERSION}-apt-lists-${TARGETARCH},target=/var/lib/apt/lists \
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
RUN --mount=type=cache,id=debian-${DEBIAN_VERSION}-npm-${TARGETARCH},target=/root/.npm \
    --mount=type=cache,id=debian-${DEBIAN_VERSION}-npm-compile-cache-${TARGETARCH},target=/tmp/node-compile-cache \
    --mount=type=cache,id=debian-${DEBIAN_VERSION}-nvm-cache-${TARGETARCH},target=/root/.nvm/.cache \
    # install nvm for use to choose node version
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash && \
    . ~/.bashrc && \
    export NVM_NODEJS_ORG_MIRROR="${NODEJS_MIRROR}" && \
    export NPM_CONFIG_REGISTRY="${NPM_REGISTRY}" && \
    nvm install ${NODE_VERSION} && \
    nvm use ${NODE_VERSION} && \
    # install pnpm
    curl -fsSL https://get.pnpm.io/install.sh | ENV="$HOME/.bashrc" SHELL="$(which bash)" bash - && \
    . ~/.bashrc && \
    # install typescript
    pnpm --registry="${NPM_REGISTRY}" \
        --cache=/root/.npm \
        install -g typescript@5 && \
    echo "========== nvm 版本信息 ==========" && \
    nvm -v && \
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

ENV NVM_DIR=/root/.nvm
ENV PNPM_HOME=/root/.local/share/pnpm

# 安装 lark-cli 及飞书 skills
RUN --mount=type=cache,id=debian-${DEBIAN_VERSION}-npm-${TARGETARCH},target=/root/.npm \
    . ~/.bashrc && \
    pnpm --registry="${NPM_REGISTRY}" \
        --cache=/root/.npm \
        install -g @larksuite/cli && \
    npx --registry="${NPM_REGISTRY}" skills add larksuite/cli -g -y && \
    echo "========== lark-cli 版本信息 ==========" && \
    lark-cli --version

# 杂项配置
COPY deploy/ /app/deploy/
RUN --mount=type=cache,id=debian-${DEBIAN_VERSION}-apt-${TARGETARCH},target=/var/cache/apt \
    --mount=type=cache,id=debian-${DEBIAN_VERSION}-apt-lists-${TARGETARCH},target=/var/lib/apt/lists \
    # alias python
    ln -sf /usr/bin/python3 /usr/bin/python && \
    # setup timezone
    ln -snf "/usr/share/zoneinfo/${TZ}" /etc/localtime && \
    echo "${TZ}" > /etc/timezone && \
    # 用bash做默认shell 不要用坑爹dash
    ln -sf /usr/bin/bash /bin/sh && \
    # 让entrypoint执行bashrc，并在 Docker 环境中建立持久化目录软链接
    cp /app/deploy/entrypoint.sh /entrypoint.sh && \
    chmod +x /entrypoint.sh && \
    # ensure locale is always set in interactive shells (e.g. kubectl exec -- bash)
    echo 'export LANG=en_US.UTF-8' >> ~/.bashrc && \
    echo 'export LC_CTYPE=en_US.UTF-8' >> ~/.bashrc

# 设置工作目录
WORKDIR /app

# 创建venv，安装依赖
COPY requirements.txt requirements_sandbox.txt .
ENV PATH="/venv/bin:$PATH"
ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
RUN --mount=type=cache,id=debian-${DEBIAN_VERSION}-pip-${TARGETARCH},target=/root/.cache/pip \
    pip config set global.index-url "${PIP_INDEX_URL}" && \
    python3 -m venv /venv && \
    export PATH="/venv/bin:$PATH" && \
    echo "========== pip 版本信息 ==========" && \
    pip --version && \
    pip install --upgrade pip wheel && \
    pip install \
        --prefer-binary \
        uv \
        -r requirements.txt \
        -r requirements_sandbox.txt && \
    opentelemetry-bootstrap -a install && \
    python /app/deploy/setup_font.py

# 安装项目
COPY . .
RUN pip install ./agentlang && \
    python3 main.py tools generate

# 还原镜像源
RUN \
    # restore mirrors
    mv /etc/apt/sources.list.d/debian.sources.bak /etc/apt/sources.list.d/debian.sources && \
    rm ~/.config/pip/pip.conf

# 获取Git commit ID并保存到环境变量
ARG CI_COMMIT_SHA="未知"
ENV CI_COMMIT_SHA=${CI_COMMIT_SHA}

# 设置 tini 作为 init 进程
ENTRYPOINT [ "/entrypoint.sh" ]

EXPOSE 8000
EXPOSE 8002

CMD ["python3", "./main.py", "start", "ws-server"]

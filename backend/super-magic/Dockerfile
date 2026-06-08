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
ARG DEBIAN_APT_MIRROR=http://deb.debian.org
RUN --mount=type=cache,id=debian-${DEBIAN_VERSION}-apt-${TARGETARCH},target=/var/cache/apt \
    --mount=type=cache,id=debian-${DEBIAN_VERSION}-apt-lists-${TARGETARCH},target=/var/lib/apt/lists \
    cp /etc/apt/sources.list.d/debian.sources /etc/apt/sources.list.d/debian.sources.bak && \
    APT_MIRROR="${DEBIAN_APT_MIRROR}" && \
    if [[ "${APT_MIRROR}" != http://* && "${APT_MIRROR}" != https://* ]]; then \
        APT_MIRROR="http://${APT_MIRROR}"; \
    fi && \
    sed -i "s|^URIs: http://deb.debian.org|URIs: ${APT_MIRROR}|g" /etc/apt/sources.list.d/debian.sources && \
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
ARG NODEJS_MIRROR=https://nodejs.org/dist
ARG NPM_REGISTRY=https://registry.npmjs.org/
ARG NVM_VERSION=v0.40.3
ARG NVM_INSTALL_BASE_URL=https://raw.githubusercontent.com/nvm-sh/nvm
ARG NVM_SOURCE=https://github.com/nvm-sh/nvm.git
RUN --mount=type=cache,id=debian-${DEBIAN_VERSION}-npm-${TARGETARCH},target=/root/.npm \
    --mount=type=cache,id=debian-${DEBIAN_VERSION}-npm-compile-cache-${TARGETARCH},target=/tmp/node-compile-cache \
    --mount=type=cache,id=debian-${DEBIAN_VERSION}-nvm-cache-${TARGETARCH},target=/root/.nvm/.cache \
    # install nvm for use to choose node version
    curl -fsSL "${NVM_INSTALL_BASE_URL}/${NVM_VERSION}/install.sh" | \
        NVM_SOURCE="${NVM_SOURCE}" PROFILE="${HOME}/.bashrc" bash && \
    . ~/.bashrc && \
    export NVM_NODEJS_ORG_MIRROR="${NODEJS_MIRROR}" && \
    export NPM_CONFIG_REGISTRY="${NPM_REGISTRY}" && \
    nvm install ${NODE_VERSION} && \
    nvm use ${NODE_VERSION} && \
    export PNPM_HOME="/root/.local/share/pnpm" && \
    mkdir -p "${PNPM_HOME}" && \
    # install pnpm from npm registry to avoid relying on get.pnpm.io during builds
    npm --registry="${NPM_REGISTRY}" \
        --cache=/root/.npm \
        install -g pnpm@11.5.2 && \
    export PATH="${PNPM_HOME}:${PATH}" && \
    ln -sf "$(command -v pnpm)" "${PNPM_HOME}/pnpm" && \
    pnpm config set global-bin-dir "${PNPM_HOME}" && \
    echo 'export PNPM_HOME="/root/.local/share/pnpm"' >> ~/.bashrc && \
    echo 'export PATH="${PNPM_HOME}:${PATH}"' >> ~/.bashrc && \
    # install typescript
    pnpm --registry="${NPM_REGISTRY}" \
        --cache=/root/.npm \
        install -g typescript@5 && \
    # install clawhub cli and add-skills cli
    npm --registry="${NPM_REGISTRY}" \
        --cache=/root/.npm \
        install -g clawhub && \
    npm --registry="${NPM_REGISTRY}" \
        --cache=/root/.npm \
        install -g add-skills && \
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

# ========= 基础venv =========
FROM base AS venv
ARG DEBIAN_VERSION
ARG TARGETARCH

# 设置工作目录
WORKDIR /app

# 创建venv，安装依赖
COPY requirements_runtime.txt requirements_sandbox.txt .
ENV PATH="/venv/bin:$PATH"
ARG PIP_INDEX_URL=https://pypi.org/simple
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
        -r requirements_runtime.txt \
        -r requirements_sandbox.txt && \
    opentelemetry-bootstrap -a install

# matplotlib配置和字体设置
COPY deploy/setup_font.py /app/deploy/setup_font.py
RUN --mount=type=cache,id=debian-${DEBIAN_VERSION}-apt-${TARGETARCH},target=/var/cache/apt \
    --mount=type=cache,id=debian-${DEBIAN_VERSION}-apt-lists-${TARGETARCH},target=/var/lib/apt/lists \
    python3 /app/deploy/setup_font.py

# ========= 项目构建 =========
FROM venv AS builder
ARG DEBIAN_VERSION
ARG TARGETARCH

# 安装本地 agentlang 包，普通业务代码变化不会重跑这一层
COPY agentlang/ ./agentlang/
RUN --mount=type=cache,id=debian-${DEBIAN_VERSION}-pip-${TARGETARCH},target=/root/.cache/pip \
    pip install ./agentlang

COPY . .
RUN python3 main.py tools generate

# ========= 预制 CLI =========
FROM base AS prebuilt_cli
ARG DEBIAN_VERSION
ARG TARGETARCH
ARG NPM_REGISTRY=https://registry.npmjs.org/
ARG GITHUB_URL_MIRROR=
ARG CLI_CACHE_DATE=19700101

# 安装 lark-cli 及飞书 skills，安装 dws（钉钉 Workspace CLI）及钉钉 skills
RUN --mount=type=cache,id=debian-${DEBIAN_VERSION}-npm-${TARGETARCH},target=/root/.npm \
    . ~/.bashrc && \
    if [[ -n "${GITHUB_URL_MIRROR}" ]]; then \
        git config --global url."${GITHUB_URL_MIRROR}".insteadOf "https://github.com/"; \
    fi && \
    echo "========== CLI 缓存日期: ${CLI_CACHE_DATE} ==========" && \
    pnpm --registry="${NPM_REGISTRY}" \
        --cache=/root/.npm \
        install -g @larksuite/cli@latest && \
    npx --registry="${NPM_REGISTRY}" skills add larksuite/cli -g -y && \
    echo "========== lark-cli 版本信息 ==========" && \
    lark-cli --version && \
    UNZIP= npm --registry="${NPM_REGISTRY}" \
        install -g dingtalk-workspace-cli@latest && \
    echo "========== dws 版本信息 ==========" && \
    dws version && \
    rm -rf /root/.dws/cache /root/.lark-cli/cache

# ========= 最终镜像 =========
FROM prebuilt_cli

WORKDIR /app

ENV PATH="/venv/bin:$PATH"

# 合并 Python 运行环境和字体产物，避免预制 CLI 层成为 venv/builder 的父层
COPY --from=venv /venv /venv
COPY --from=venv /usr/share/fonts /usr/share/fonts
COPY --from=venv /etc/fonts /etc/fonts
COPY --from=venv /var/cache/fontconfig /var/cache/fontconfig
COPY --from=builder /app /app

# 杂项配置
RUN \
    # alias python
    ln -sf /usr/bin/python3 /usr/bin/python && \
    # setup timezone
    ln -snf "/usr/share/zoneinfo/${TZ}" /etc/localtime && \
    echo "${TZ}" > /etc/timezone && \
    # 用bash做默认shell 不要用坑爹dash
    ln -sf /usr/bin/bash /bin/sh && \
    # 还原 apt 源配置备份
    mv /etc/apt/sources.list.d/debian.sources.bak /etc/apt/sources.list.d/debian.sources && \
    rm -f ~/.config/pip/pip.conf && \
    # ensure locale is always set in interactive shells (e.g. kubectl exec -- bash)
    echo 'export LANG=en_US.UTF-8' >> ~/.bashrc && \
    echo 'export LC_CTYPE=en_US.UTF-8' >> ~/.bashrc && \
    # 创建 vim 交换/备份/undo 目录
    mkdir -p ~/.vim/swap ~/.vim/backup ~/.vim/undo

COPY deploy/.vimrc /root/.vimrc
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 获取Git commit ID并保存到环境变量
ARG CI_COMMIT_SHA="未知"
ENV CI_COMMIT_SHA=${CI_COMMIT_SHA}

# 设置 tini 作为 init 进程
ENTRYPOINT [ "/entrypoint.sh" ]

EXPOSE 8000
EXPOSE 8002

CMD ["python3", "./main.py", "start", "ws-server"]

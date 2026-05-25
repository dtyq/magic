
ARG PLAYWRIGHT_VERSION=1.57.0
ARG PLAYWRIGHT_IMAGE_VERSION=v${PLAYWRIGHT_VERSION}-noble
FROM mcr.microsoft.com/playwright:${PLAYWRIGHT_IMAGE_VERSION}

ARG TARGETARCH

LABEL org.opencontainers.image.description="装了tini作为init，装了字体，其他没做什么，理论上可以用官方镜像替代"

COPY setup_font.py /tmp

# install tini and setup font
ARG PLAYWRIGHT_VERSION=1.57.0
ARG UBUNTU_APT_MIRROR=mirrors.aliyun.com
ARG UBUNTU_SECURITY_APT_MIRROR=mirrors.aliyun.com
RUN --mount=type=cache,id=ubuntu-apt-playwright-mod-${PLAYWRIGHT_VERSION}-${TARGETARCH},target=/var/cache/apt \
    --mount=type=cache,id=ubuntu-apt-lists-playwright-mod-${PLAYWRIGHT_VERSION}-${TARGETARCH},target=/var/lib/apt/lists \
    --mount=type=cache,id=npm-playwright-mod-${PLAYWRIGHT_VERSION}-${TARGETARCH},target=/root/.npm \
    # setup apt mirror follow deb-822 format
    sed -i.bak "s|archive.ubuntu.com|${UBUNTU_APT_MIRROR}|g" /etc/apt/sources.list.d/ubuntu.sources && \
    sed -i "s|security.ubuntu.com|${UBUNTU_SECURITY_APT_MIRROR}|g" /etc/apt/sources.list.d/ubuntu.sources && \
    # ubuntu的docker会自动删除下载的包 导致缓存失效 因此修改一下
    mv /etc/apt/apt.conf.d/docker-clean /tmp/docker-clean.bak && \
    apt-get update && \
    apt-get install \
        tini && \
    python3 /tmp/setup_font.py && \
    rm /tmp/setup_font.py && \
    # install playwright (wtf there is no playwright installed in playwright image?)
    npm install -g playwright@"$PLAYWRIGHT_VERSION" && \
    # restore apt repositories
    mv /etc/apt/sources.list.d/ubuntu.sources.bak /etc/apt/sources.list.d/ubuntu.sources && \
    # restore docker-clean
    mv /tmp/docker-clean.bak /etc/apt/apt.conf.d/docker-clean

ENTRYPOINT [ "tini", "--" ]
CMD [ "/bin/bash" ]

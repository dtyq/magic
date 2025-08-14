ARG IMAGE_NAME=ghcr.io/dtyq/php-dockerfile:8.4-alpine-3.22-swow-1.6.1-jsonpath-parle-xlswriter

FROM --platform=$BUILDPLATFORM ${IMAGE_NAME}

ARG timezone
ARG TARGETPLATFORM

ENV TIMEZONE=${timezone:-"Asia/Shanghai"} \
    SCAN_CACHEABLE=(true) \
    USE_ZEND_ALLOC=0 \
    COMPOSER_FUND=0 \
    PHP_MEMORY_LIMIT=-1 \
    COMPOSER_MEMORY_LIMIT=-1 \
    PHP_INI_MEMORY_LIMIT=-1

# 设置 PHP 配置
RUN mkdir -p /etc/php/conf.d && \
    echo "memory_limit = -1" > /etc/php/conf.d/memory-limit.ini && \
    echo "max_execution_time = 0" > /etc/php/conf.d/max-execution-time.ini



# 安装 PostgreSQL 客户端库及其他依赖
RUN apk add --no-cache  git openssh-client


COPY . /opt/www

WORKDIR /opt/www

##
# ---------- env settings ----------
##
# --build-arg timezone=Asia/Shanghai
ARG timezone

ENV TIMEZONE=${timezone:-"Asia/Shanghai"} \
    SCAN_CACHEABLE=(true) \
    USE_ZEND_ALLOC=0
RUN --mount=type=cache,id=alpine-3.20,target=/var/run/apk \
    sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories && \
    # apk安装构建工具
    apk add --no-cache \
        --virtual .php-buildtool \
        git \
        autoconf \
        automake \
        file \
        gcc \
        g++ \
        libc-dev \
        make \
        pkgconf \
        re2c \
        libtool \
        php83-dev

    # 装个pcov
RUN rm -rf /src/pcov && \
    git clone --depth 1 https://gitee.com/codinghuang/pcov.git /src/pcov && \
    # 构建安装
    cd /src/pcov && \
        phpize83 && \
        ./configure --enable-pcov && \
        make && \
        make install && \
    cd .. && \
    # 清理
    rm -rf /src/pcov && \
    apk del .php-buildtool && \
    # 显示成果
    php -v && \
    php -dextension=pcov --ri pcov

## dockerfile 中修改源,并安装所需的posix依赖,用于爬取duckduckgo内容
#RUN sed -i 's/mirrors.cloud.aliyuncs.com/mirrors.aliyun.com/g' /etc/apk/repositories && \
#    apk update && \
#    apk add --no-cache php-posix
ARG COMPOSER_MIRROR=https://mirrors.aliyun.com/composer/
ENV COMPOSER_ALLOW_SUPERUSER=1

# 使用 --mount=type=secret 挂载 secret 文件时，该挂载操作是在 RUN 指令执行 期间 进行的。
# 这意味着 secret 文件只在 当前 RUN 指令的上下文中可用。一旦该 RUN 指令执行完毕，secret 文件就会被移除，并且不会被包含在下一层中。
# 要解决这个问题，你需要将所有需要访问 secret 文件的操作放在 同一个 RUN 指令中
RUN --mount=type=secret,id=composer,target=/root/.composer/auth.json \
    --mount=type=cache,id=magic-service-composer,target=/root/.composer/cache \
    # set -x ; \
    # composer镜像
    { \
        test -n "${COMPOSER_MIRROR}" && \
        composer config -g secure-http false && \
        composer config -g repos.packagist composer "${COMPOSER_MIRROR}" ; \
    } && \
    composer install -o --prefer-dist
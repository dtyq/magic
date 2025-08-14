ARG IMAGE_NAME=ghcr.io/dtyq/php-dockerfile:8.4-alpine-3.22-swow-1.6.1-jsonpath-parle-xlswrite

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


# composer 改成阿里云镜像
# RUN composer config -g repo.packagist composer https://mirrors.aliyun.com/composer/

# 使用 --mount=type=secret 挂载 secret 文件时，该挂载操作是在 RUN 指令执行 期间 进行的。
# 这意味着 secret 文件只在 当前 RUN 指令的上下文中可用。一旦该 RUN 指令执行完毕，secret 文件就会被移除，并且不会被包含在下一层中。
# 要解决这个问题，你需要将所有需要访问 secret 文件的操作放在 同一个 RUN 指令中
RUN --mount=type=secret,id=composer,target=/root/.composer/auth.json \
    --mount=type=cache,id=magic-service-composer,target=/root/.cache/composer \
    # 注意把下面的id改成你自己的项目名 防止和别人重复
    --mount=type=cache,id=magic-service-phpstan,target=/tmp/phpstan \
    export COMPOSER_ALLOW_SUPERUSER=1 ; \
    # 安装依赖
    php -d swow.enable=0  $(which composer) i -o && \
    # 可选的：生成缓存
    php bin/hyperf.php
    # rm -rf /opt/www/runtime

# 可选的：标记expose端口
EXPOSE 9501
EXPOSE 9502

ENTRYPOINT ["sh", "/opt/www/start.sh"]
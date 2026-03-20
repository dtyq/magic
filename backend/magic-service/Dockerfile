
ARG BASE_IMAGE=ghcr.io/dtyq/php-dockerfile:8.4-alpine-3.22-swow-1.6.1-jsonpath-parle-xlswriter
FROM ${BASE_IMAGE}

ARG TARGETARCH

ARG TZ=Asia/Shanghai

ENV TZ=${TZ} \
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

COPY . /opt/www

WORKDIR /opt/www

ARG COMPOSER_MIRROR=https://mirrors.aliyun.com/composer/
RUN --mount=type=cache,id=composer-cache-v1-${TARGETARCH},target=/root/.composer/cache \
    --mount=type=cache,id=composer-cache-v2-${TARGETARCH},target=/root/.cache/composer \
    # setup composer mirror
    { \
        [ -n "${COMPOSER_MIRROR}" ] && \
        composer config -g repo.packagist composer "${COMPOSER_MIRROR}" || \
        composer config -g --unset repos.packagist ; \
    } && \
    composer update && \
    # restore composer mirror
    rm /root/.config/composer/config.json

# 可选的：标记expose端口
EXPOSE 9501
EXPOSE 9502

ENTRYPOINT ["sh", "/opt/www/start.sh"]

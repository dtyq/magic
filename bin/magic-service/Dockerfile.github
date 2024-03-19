ARG IMAGE_NAME=ghcr.io/dtyq/php-dockerfile:8.3-alpine-3.21-swow-1.5.3-jsonpath-parle-xlswriter

FROM --platform=$BUILDPLATFORM ${IMAGE_NAME} AS builder

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


# 关闭swow扩展 再安装, 因为安装swow扩展后 再执行composer update 时，curl会陷入循环
RUN  php -d swow.enable=0  $(which composer) update 

# 可选的：标记expose端口
EXPOSE 9501
EXPOSE 9502

ENTRYPOINT ["sh", "/opt/www/start.sh"]
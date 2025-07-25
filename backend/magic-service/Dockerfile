FROM kkguan-registry.cn-shenzhen.cr.aliyuncs.com/open-source/hyperf-base:8.3-alpine-3.21-swow-ci-jsonpath-parle-xlswriter

##
# ---------- env settings ----------
##
# --build-arg timezone=Asia/Shanghai
ARG timezone

ENV TIMEZONE=${timezone:-"Asia/Shanghai"} \
    SCAN_CACHEABLE=(true) \
    USE_ZEND_ALLOC=0

ENV COMPOSER_ALLOW_SUPERUSER=1

WORKDIR /opt/www

# Composer Cache
# COPY ./composer.* /opt/www/
# RUN composer install --no-dev --no-scripts

COPY . /opt/www

## dockerfile 中修改源,并安装所需的posix依赖,用于爬取duckduckgo内容
#RUN sed -i 's/mirrors.cloud.aliyuncs.com/mirrors.aliyun.com/g' /etc/apk/repositories && \
#    apk update && \
#    apk add --no-cache php-posix

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
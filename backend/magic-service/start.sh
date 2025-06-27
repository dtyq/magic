#!/bin/bash

set -eo pipefail

# 获取脚本所在目录名称
base_dirname=$(
  cd "$(dirname "$0")"
  pwd
)
# 执行脚本文件位置
bin="${base_dirname}/bin/hyperf.php"
# ........................
# 执行迁移 (使用分布式锁保护，防止并发执行)
php "${bin}" shell:locker migrate

# 执行seeders
#php "${bin}" db:seed

# 开启服务
USE_ZEND_ALLOC=0 php -dopcache.enable_cli=0 "${bin}" start

#!/bin/bash

# 标记文件路径
SEED_MARKER="/opt/www/.db_seed_executed"

# 检查是否已经执行过seed
# if [ ! -f "$SEED_MARKER" ]; then
#     echo "首次启动，执行数据库种子命令..."
#     # php bin/hyperf.php db:seed
    
#     # 创建标记文件以避免再次执行
#     touch "$SEED_MARKER"
#     echo "数据库种子命令已执行并标记"
# else
#     echo "已检测到标记文件，跳过数据库种子命令"
# fi

# 启动守护进程服务
echo "正在启动魔术服务守护进程..."
php bin/hyperf.php start


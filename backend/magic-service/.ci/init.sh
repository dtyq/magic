#!/bin/sh

# 定义一个函数，这个函数将在接收到 SIGINT 信号时运行
cleanup() {
    echo '执行清理脚本...'
    # 在这里运行你的兜底脚本
    # 暂停服务
    # 进程id存储在文件runtime/hyperf.pid里面
    pid=`cat runtime/hyperf.pid`
    echo '暂停服务，进程id：'$pid
    kill $pid
}

# 启动容器
# 获取 .ci 的绝对路径
dir=$(cd `dirname $0`; pwd)

echo '启动容器'
docker-compose -f $dir/docker-compose.yml down -v
docker-compose -f $dir/docker-compose.yml up -d

docker cp $dir/check_mysql.sh magic-service-mysql:/check_mysql.sh

docker exec magic-service-mysql sh -c "chmod +x /check_mysql.sh && /check_mysql.sh";

# 初始化数据库
echo '初始化数据库'
php bin/hyperf.php migrate

# 初始化麦吉
echo '初始化麦吉必要数据'
php bin/hyperf.php init-magic:data
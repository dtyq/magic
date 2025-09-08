#!/bin/sh
sleep 2
while true
do
    echo '检测MySql数据库是否启动'
    if echo 'SELECT 1;' | mysql -h 127.0.0.1 -P 3306 -uroot -pmagic --silent; then
        echo '数据库已启动'
        break
    fi
    sleep 2
done
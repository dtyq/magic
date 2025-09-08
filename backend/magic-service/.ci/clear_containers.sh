#!/bin/sh
# 删除历史容器
# 指定镜像名称
# shellcheck disable=SC2039
CONTAINER_NAMES=("magic-service")

# 获取当前时间戳
now=$(date +%s)
passed_time=1800

# 列出所有镜像，并保留创建时间
for CONTAINER_NAME in "${CONTAINER_NAMES[@]}"; do
  container_count=$(docker ps -a | grep -c "$CONTAINER_NAME")
  container_ids=$(docker ps -a | grep "$CONTAINER_NAME" | awk '{print $1}')
  clear_count=0
  # shellcheck disable=SC2028
  echo "已存在的【$CONTAINER_NAME】容器，共【$container_count】个"
  echo "$container_ids"
  echo "正在清理【$passed_time】秒前的【$CONTAINER_NAME】容器"
  containers=$(docker ps | grep "$CONTAINER_NAME")
  while read -r line; do
    # 提取镜像ID和创建时间戳
    container_id=$(echo "$line" | awk '{print $1}')
    created=$(docker inspect --format '{{ .Created }}' "$container_id")
    # 将创建时间转换为时间戳
    created_timestamp=$(date -d "$created" +%s)
    # 计算与当前时间的差值
    delta_seconds=$((now - created_timestamp))

    # 如果差值大于3600秒（即一小时），则删除镜像
    if [ $delta_seconds -gt $passed_time ]; then
      docker rm -f "$container_id" &&
      echo "成功清理一个容器 容器id【$container_id】"
      ((clear_count++))
    fi
  done <<< "$containers"
  echo "成功清理【$clear_count】个容器"
done
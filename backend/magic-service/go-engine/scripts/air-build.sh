#!/bin/bash

set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
skip_once_flag="${AIR_BUILD_SKIP_ONCE_FLAG:-${root_dir}/tmp/.air-initial-build-skip}"
main_bin="${AIR_BUILD_OUTPUT:-${root_dir}/../bin/magic-go-engine}"
dev_goos="${DEV_GOOS:-$(go env GOOS)}"
dev_goarch="${DEV_GOARCH:-$(go env GOARCH)}"

cd "${root_dir}"
mkdir -p "$(dirname "${main_bin}")"

# 首次由启动前预检查完成构建后，允许 air 直接复用产物启动，避免重复执行 wire。
if [ -f "${skip_once_flag}" ] && [ -x "${main_bin}" ]; then
    rm -f "${skip_once_flag}"
    exit 0
fi

rm -f "${skip_once_flag}"

./bin/wire
GOOS="${dev_goos}" GOARCH="${dev_goarch}" go build -o "${main_bin}" .
chmod +x "${main_bin}"

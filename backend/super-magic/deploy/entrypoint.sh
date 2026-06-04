#!/usr/bin/bash
. ~/.bashrc

# 在 Docker 环境中，将 HOME 下的工具配置目录软链接到持久化目录
# 避免容器重启后配置丢失
# IS_DOCKER 由镜像构建时注入，USER_HOME_DIR 指定持久化根目录（可通过环境变量覆盖）
# .lark-cli   : lark-cli 应用配置（macOS 上存放 config.json）
# .dws        : 钉钉 Workspace CLI 配置
# .local/share: lark-cli 和 dws 在 Linux 上的凭据存储目录（加密 token、master.key、dek 等）
# .magic      : Magic 自有 CLI 的统一持久化配置根目录
#
# 懒创建策略：第三方 CLI 目录只建立软链接，不预创建目标目录。
# 目标目录由 shell_exec 的 CliDirInitHandler 在对应 CLI 首次执行时按需创建。
# .magic 需要在 CLI 二进制尚不存在时也可用，因此启动时预创建统一根目录。
if [ -n "${IS_DOCKER}" ] && [ -n "${USER_HOME_DIR}" ]; then
    mkdir -p "${USER_HOME_DIR}/.magic"

    for config_dir in .lark-cli .dws .local/share .magic; do
        target="${USER_HOME_DIR}/${config_dir}"
        link="${HOME}/${config_dir}"
        mkdir -p "$(dirname "${link}")"
        if [ ! -L "${link}" ]; then
            rm -rf "${link}"
            ln -sf "${target}" "${link}"
        fi
    done
fi

exec tini -- "$@"

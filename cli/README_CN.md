# Magicrew CLI

Magicrew CLI 是用于管理 Magicrew 的命令行工具。你可以在 [artifacts 仓库](https://github.com/dtyq/artifacts) 的发布页下载最新二进制版本。

英文文档请见 [README.md](./README.md)。

## 用法

```bash
magicrew help
```

## 从源码构建

可以使用 `go build` 构建当前机器可执行文件：

```bash
# 在 cli 目录下
go build -o magicrew ./cmd
```

也可以使用 Makefile 构建多平台二进制：

```bash
make build
```

构建产物会输出到 `dist` 目录，文件名格式为：

`magicrew-cli-<platform>-<arch>`

## Windows 支持（PowerShell）

PowerShell 是 Windows 原生环境下的官方支持终端。
CMD 和 Git Bash 为 best-effort 支持。

### 最低 Windows 版本

- Windows 10 22H2（build 19045+）或 Windows 11 23H2（build 22631+）
- PowerShell 7.x 为官方支持基线

### 前置依赖

执行 `magicrew deploy` 前，请确保必需命令在 `PATH` 中可用：

- 必需：`docker`
- 可选：`kubectl`

### 默认配置目录行为

CLI 按以下优先级解析基础配置目录：

1. `XDG_CONFIG_HOME`（非空时）
2. Windows 下：`APPDATA`
3. Windows 下：`USERPROFILE/.config`
4. 回退：`~/.config`

不会自动迁移历史路径；如需继续使用旧位置，请通过 `--config` 显式指定配置文件路径。

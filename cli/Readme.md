# Magicrew CLI

Magicrew CLI is a command-line tool for managing Magicrew. You can download the latest built binary from the [artifacts repository](https://github.com/dtyq/artifacts) releases.

Magicrew CLI是用于管理Magicrew的命令行工具，你可以在[artifacts仓库](https://github.com/dtyq/artifacts)的发布中下载最新版本的构建好的二进制。

## Usage 用法

```bash
magicrew help
```

## Build from source 从源代码构建

You may use `go build` to build the binary for your current machine.

可以直接用go build来构建本机的二进制

```bash
# at the cli directory
go build -o magicrew ./cmd
```

Use Makefile to build multi-platform binaries:

如果需要构建多架构的二进制，可以使用Makefile:

```bash
make build
```

The built binaries will be placed in the dist directory, with the filename format of `magicrew-cli-<platform>-<arch>`

构建好的二进制文件会在dist目录下，文件名格式为`magicrew-cli-<platform>-<arch>`。

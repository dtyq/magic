# Magicrew CLI

Magicrew CLI is a command-line tool for managing Magicrew. You can download the latest binary release from the [artifacts repository](https://github.com/dtyq/artifacts).

For Simplified Chinese documentation, see [README_CN.md](./README_CN.md).

## Usage

```bash
magicrew help
```

## Build from source

You can use `go build` to build a binary for your current machine:

```bash
# at the cli directory
go build -o magicrew ./cmd
```

Use Makefile to build multi-platform binaries:

```bash
make build
```

Built binaries are placed in the `dist` directory with this filename format:

`magicrew-cli-<platform>-<arch>`

## Windows support (PowerShell)

PowerShell is the officially supported shell on native Windows.
CMD and Git Bash are best-effort only.

### Minimum Windows version

- Windows 10 22H2 (build 19045+) or Windows 11 23H2 (build 22631+)
- PowerShell 7.x is the supported baseline

### Prerequisites

Ensure the required command is available in `PATH` before running `magicrew deploy`:

- Required: `docker`
- Optional: `kubectl`

### Default config directory behavior

The CLI resolves the base config directory in this order:

1. `XDG_CONFIG_HOME` (when non-empty)
2. On Windows: `APPDATA`
3. On Windows: `USERPROFILE/.config`
4. Fallback: `~/.config`

There is no automatic migration from historical paths. Use `--config` to explicitly point to an existing config file when needed.

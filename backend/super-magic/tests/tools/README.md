# 工具测试脚本

这个测试脚本用于方便地测试项目中的工具，支持列出所有可用工具、查看工具详细信息和执行工具。

## 安装依赖

确保你已经安装了项目所需的依赖：

```bash
python -m pip install -r requirements.txt
```

## 环境配置

测试脚本使用与主应用程序相同的配置机制。它会按照以下顺序查找配置：

1. 通过 `--config` 参数指定的配置文件路径
2. 通过 `CONFIG_PATH` 环境变量指定的配置文件路径
3. 项目根目录下的 `config/config.yaml` 文件

此外，测试脚本会自动加载 `.env` 文件中的环境变量。你可以通过环境变量来配置某些功能，例如：

```bash
LOG_LEVEL=DEBUG  # 设置日志级别（DEBUG, INFO, WARNING, ERROR）
CONFIG_PATH=/path/to/custom/config.yaml  # 指定配置文件路径
```

## 使用方法

### 使用 `tool.py` 命令行工具

这是一个友好的命令行界面，支持通过子命令进行操作。

#### 列出所有工具

```bash
python -m tests.tools.tool list
```

#### 查看工具信息

```bash
python -m tests.tools.tool info <工具名称>
```

例如：

```bash
python -m tests.tools.tool info read_file
```

#### 执行工具

```bash
python -m tests.tools.tool exec <工具名称> [--params <参数文件或JSON字符串>]
```

例如：

```bash
# 使用参数文件
python -m tests.tools.tool exec read_file --params tests/tools/examples/read_file_params.json

# 使用直接的JSON字符串
python -m tests.tools.tool exec read_file --params '{"target_file": "README.md", "offset": 0, "limit": 20}'

# 使用自定义配置文件
python -m tests.tools.tool --config path/to/config.yaml exec read_file --params '{"target_file": "README.md"}'
```

## 示例

### 读取文件

```bash
python -m tests.tools.tool exec read_file --params '{"target_file": "README.md", "offset": 0, "limit": 20}'
```

### 搜索代码

```bash
python -m tests.tools.tool exec grep_search --params '{"query": "class.*Tool", "include_pattern": "*.py"}'
```

### 写入文件

```bash
python -m tests.tools.tool exec write_file --params '{"target_file": "test_output.txt", "content": "这是测试内容"}'
```

## 参数文件

为了方便使用，在 `tests/tools/params` 目录中可以放置一些常用工具的参数示例文件。你可以直接使用这些文件，或者根据你的需求进行修改。如果工具名称与参数文件名相同，系统会自动加载匹配的参数文件。

## 故障排除

如果运行脚本时遇到问题，可以尝试以下解决方法：

1. **加载项目环境**：运行脚本前确保在正确的项目环境中。如果使用虚拟环境，确保已激活。

2. **日志级别**：通过设置 `LOG_LEVEL=DEBUG` 环境变量或在 `.env` 文件中添加此设置来获取更详细的日志。

3. **配置文件**：使用 `--config` 参数指定正确的配置文件路径。

4. **导入错误**：检查是否正确安装了所有依赖包，可以尝试重新运行 `pip install -r requirements.txt`

5. **权限问题**：某些工具（如文件操作相关工具）可能需要特定的文件权限，确保有足够的权限。

6. **JSON格式错误**：确保传入的参数是有效的JSON格式，特别是在命令行中使用时需要正确处理引号。

## 注意事项

- 工具执行时会使用实际的项目环境，所以操作可能会影响实际数据。在生产环境中谨慎使用。
- 配置文件会影响工具的行为，确保使用正确的配置文件以匹配您的测试需求。
- 部分工具可能需要额外的环境配置或权限，请参考工具文档确保环境已正确设置。

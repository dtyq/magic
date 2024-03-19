# SuperMagic 配置管理指南

## 概述

SuperMagic 使用灵活的配置管理系统，基于 YAML 文件和环境变量，支持分层配置和类型验证。系统提供统一的配置访问接口，并支持配置的热加载和动态更新。

## 配置系统组件

- **配置管理器**: 负责加载、解析和管理配置数据，支持多种配置源
- **配置模型**: 使用 Pydantic 模型定义配置结构和默认值
- **配置文件**: 存储在 `config/config.yaml` 的主配置文件
- **环境变量**: 通过占位符引用系统环境变量，支持默认值

## 配置文件结构

主配置文件位于 `config/config.yaml`，采用 YAML 格式，包含以下主要部分：

- **browser**: 浏览器相关配置
- **llm**: LLM API 通用配置
- **agent**: 代理系统配置
- **image_generator**: 图片生成服务配置
- **models**: 多种模型配置，包括各种 LLM 模型
  - 每个模型包含 api_key, api_base_url, name, type, supports_tool_use 等配置项
- **服务配置**: 各种服务的专用配置
- **系统配置**: 核心系统配置

## 环境变量占位符

配置文件支持两种环境变量引用格式：

1. `${ENV_VAR}` - 引用环境变量，无默认值
2. `${ENV_VAR:-default}` - 引用环境变量，如果不存在则使用默认值

示例：
```yaml
browser:
  headless: ${BROWSER_HEADLESS:-false}
  cookies_file: ${BROWSER_COOKIES_FILE:-.browser/cookies.json}

models:
  gpt-4o:
    api_key: "${OPENAI_API_KEY}"
    api_base_url: "${OPENAI_API_BASE_URL:-https://api.openai.com/v1}"
    name: "${OPENAI_MODEL:-gpt-4o}"
```

## 数据类型转换

配置系统会自动进行数据类型转换：

- `"true"` 和 `"false"` 转换为布尔值
- 数字字符串转换为整数或浮点数
- 列表和字典会保留其结构

## 使用方法

### 获取配置

```python
from agentlang.config import config

# 获取特定配置项
headless = config.get("browser.headless")
api_key = config.get("models.gpt-4o.api_key")

# 使用默认值
timeout = config.get("llm.api_timeout", 60)
```

### 配置管理器

```python
from agentlang.config.config import Config

# 创建配置管理器实例
config_manager = Config()

# 加载配置
config_manager.load_config("/path/to/config.yaml")

# 使用点号路径获取配置
api_key = config_manager.get("models.gpt-4o.api_key")
model_name = config_manager.get("models.gpt-4o.name", "default-model")
```

### 设置和重新加载配置

```python
from agentlang.config import config

# 设置配置值
config.set("models.gpt-4o.temperature", 0.8)

# 重新加载配置（用于运行时更新环境变量配置）
config.reload_config()
```

## 配置搜索路径

系统会按以下顺序查找配置文件：

1. 环境变量 `CONFIG_PATH` 指定的路径
2. 项目根目录下的 `config/config.yaml`

## 配置优先级

配置加载优先级从高到低为：

1. 通过 `config.set()` 设置的运行时配置
2. 环境变量
3. 配置文件中的值
4. Pydantic 模型中的默认值

## 安全性注意事项

- 敏感信息（如 API 密钥）应通过环境变量或 `.env` 文件提供，不要直接写入配置文件
- 配置文件中应使用环境变量占位符引用敏感信息
- `.env` 文件不应提交到版本控制系统
- 遵循配置文件开头的安全提示，不要在配置文件中暴露敏感信息

## 与 .env 文件的集成

SuperMagic 支持通过 `.env` 文件加载环境变量。详情请参考 [dotenv_configuration.md](dotenv_configuration.md)。

## 常见问题

### 配置未正确加载

确保：
- 配置文件存在于正确位置
- 环境变量已正确设置
- 配置文件格式正确（有效的 YAML）

### 环境变量不生效

- 检查占位符格式是否正确
- 确认环境变量已设置
- 检查环境变量名称大小写

### 自定义配置位置

可以通过环境变量指定自定义配置文件路径：

```python
import os
os.environ["CONFIG_PATH"] = "/path/to/custom/config.yaml"

# 然后加载配置
from agentlang.config.config import Config
config_manager = Config()
config_manager.load_config()
``` 
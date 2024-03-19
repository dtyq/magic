---
name: using-llm
description: List available large language models and send chat completion requests programmatically. Use this skill when you need to call an LLM within a snippet, including model comparison, visual understanding, batch inference, and model performance testing.

name-cn: 大模型调用技能
description-cn: 以编程方式获取可用大模型列表并发送对话请求。当需要在代码片段中调用大模型时使用此技能，包括对比模型、视觉理解、批量推理、测试模型效果等场景。
---

<!--zh
# 大模型调用技能
-->
# LLM Calling Skill

<!--zh
获取可用模型列表，并向指定模型发送对话请求，无需任何额外配置。
-->
List available models and send chat requests to any of them — no extra configuration required.

<!--zh
## 核心能力
-->
## Core Capabilities

<!--zh
- 获取当前可用的模型列表
- 以 OpenAI 格式发送对话请求（非流式）
-->
- List currently available models
- Send chat completion requests in OpenAI format (non-streaming)

<!--zh
## 使用指导

需要在代码中调用大模型时，可以使用 `sdk.llm` 提供的 SDK 函数。执行方式有两种：

- **方式一**：使用 `run_python_snippet` 工具直接执行代码片段
- **方式二**：将代码写入 `.py` 文件后，使用 `shell_exec` 执行

`create_openai_sync_client` 是 Python SDK 函数，**不是工具名称**，需要在代码中 import 后使用：

```python
# 方式一：run_python_snippet
run_python_snippet(
    python_code="""
from sdk.llm import create_openai_sync_client
client = create_openai_sync_client()
...
""",
    script_path="temp_llm_xxx.py",
    timeout=300,
)

# 方式二：写文件 + shell_exec
# 先用 write_file 写入脚本，再用 shell_exec 执行
shell_exec("python scripts/my_llm_script.py")
```

调用大模型时容易超时，建议根据任务复杂度适当调大超时时间，例如单次调用可设 `timeout=120`，多模型对比或批量推理建议设 `timeout=300` 或更大（`shell_exec` 同理）。
-->
## Usage Guide

When you need to call an LLM in code, use the SDK functions from `sdk.llm`. There are two ways to execute the code:

- **Option 1**: Use the `run_python_snippet` tool to execute a code snippet directly
- **Option 2**: Write the code to a `.py` file, then execute it with `shell_exec`

`create_openai_sync_client` is a Python SDK function, **not a tool name** — import and use it inside your code:

```python
# Option 1: run_python_snippet
run_python_snippet(
    python_code="""
from sdk.llm import create_openai_sync_client
client = create_openai_sync_client()
...
""",
    script_path="temp_llm_xxx.py",
    timeout=300,
)

# Option 2: write a .py file, then run with shell_exec
# First write the script with write_file, then execute:
shell_exec("python scripts/my_llm_script.py")
```

LLM calls can take a while — consider increasing the timeout based on complexity, e.g. `timeout=120` for a single call, `timeout=300` or more for multi-model comparisons or batch inference (applies to both options).

<!--zh
## 快速开始
-->
## Quick Start

<!--zh
### 第一步：获取可用模型列表

不确定模型 ID 时，先查询可用模型：
-->
### Step 1: List available models

When unsure of the model ID, query available models first:

```python
run_python_snippet(
    python_code="""
import json
from sdk.llm import create_openai_sync_client

client = create_openai_sync_client()
models = client.models.list()
print(json.dumps([{"id": m.id} for m in models.data], ensure_ascii=False, indent=2))
""",
    script_path="temp_list_models.py",
)
```

<!--zh
输出示例：
-->
Example output:

```json
[
  {"id": "claude-3-5-sonnet-20241022"},
  {"id": "gpt-4o"},
  {"id": "deepseek-v3"}
]
```

<!--zh
### 第二步：发送对话请求

使用真实的模型 ID 发送对话：
-->
### Step 2: Send a chat request

Use a real model ID to send a chat:

```python
run_python_snippet(
    python_code="""
from sdk.llm import create_openai_sync_client

client = create_openai_sync_client()

response = client.chat.completions.create(
    model="<模型ID>",
    messages=[
        {"role": "system", "content": "你是一个助手"},
        {"role": "user", "content": "你好"},
    ],
    extra_body={"thinking": {"type": "disabled"}},
)

print(response.choices[0].message.content)
""",
    script_path="temp_chat.py",
    timeout=120,
)
```

<!--zh
## 视觉理解 — 在消息中传入图片

使用支持视觉的模型时，可以在消息中附带图片。SDK 提供两种方式将工作区文件转换为 URL：

| 函数 | 适用场景 |
|---|---|
| `file_to_url(path)` | **优先使用**，直接返回可访问的 URL |
| `image_to_base64(path)` | `file_to_url` 失败时的备选方案，将图片编码为 base64 |

两者均支持直接传入 http/https URL，此时原样返回，不做任何处理。

> **重要 — `image_to_base64` 返回值说明**：该函数已返回完整的 data URL，格式为 `data:image/jpeg;base64,/9j/4AAQ...`，直接将返回值用作 `url` 字段即可。**禁止再手动拼接 `data:image/jpeg;base64,` 前缀**，否则会报 `Invalid base64 image_url` 错误。
-->
## Vision — Attach Images in Messages

When using a vision-capable model, images can be included in messages. The SDK provides two ways to convert a workspace file to a URL:

| Function | Use Case |
|---|---|
| `file_to_url(path)` | **Use this first** — returns a directly accessible URL |
| `image_to_base64(path)` | Fallback if `file_to_url` fails — encodes the image as base64 |

Both accept http/https URLs as input and return them unchanged.

> **IMPORTANT — `image_to_base64` return value**: The function already returns a complete data URL string like `data:image/jpeg;base64,/9j/4AAQ...`. Use the return value directly as `url`. **Do NOT prepend `data:image/jpeg;base64,` again** — doing so will cause an `Invalid base64 image_url` error.

```python
run_python_snippet(
    python_code="""
from sdk.llm import create_openai_sync_client, file_to_url, image_to_base64

client = create_openai_sync_client()

# 优先使用 file_to_url / use file_to_url first
# 路径相对于 .workspace/ 目录 / path is relative to .workspace/
image_url = file_to_url("test/screenshot.png")

# file_to_url 失败时用 image_to_base64 / fallback to image_to_base64
# image_url = image_to_base64("test/screenshot.png")
# image_to_base64 已返回完整 data URL，直接使用，禁止再拼接前缀
# image_to_base64 returns a complete data URL — use it directly, never prepend "data:...;base64," again

response = client.chat.completions.create(
    model="<视觉模型ID>",
    messages=[{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": image_url}},
            {"type": "text", "text": "描述这张图片的内容"},
        ],
    }],
    extra_body={"thinking": {"type": "disabled"}},
)

print(response.choices[0].message.content)
""",
    script_path="temp_vision.py",
    timeout=120,
)
```

<!--zh
## 参数说明

### `client.chat.completions.create()` 常用参数
-->
## Parameter Reference

### Common Parameters for `client.chat.completions.create()`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `model` | `str` | Yes | <!--zh 模型 ID，使用第一步查询到的真实 ID --> Model ID — use a real ID from Step 1 |
| `messages` | `list` | Yes | <!--zh 对话消息列表，每项含 `role` 和 `content` --> List of messages, each with `role` and `content` |
| `temperature` | `float` | No | <!--zh 采样温度，0~2，默认 1 --> Sampling temperature, 0~2, default 1 |
| `max_tokens` | `int` | No | <!--zh 最大输出 token 数 --> Maximum output tokens |
| `tools` | `list` | No | <!--zh 工具定义列表（Function Calling） --> Tool definitions (Function Calling) |
| `extra_body` | `dict` | No | <!--zh 扩展参数，用于传递 OpenAI SDK 未封装的原生字段，如 `thinking` --> Extra fields not natively supported by the OpenAI SDK, e.g. `thinking` |

<!--zh
### `thinking` 参数 — 控制深度思考

`thinking` 通过 `extra_body` 传入，用于控制模型是否输出思维链内容。**默认建议关闭**，避免不必要的 token 消耗和延迟。

| `thinking.type` 取值 | 说明 |
|---|---|
| `disabled` | 强制关闭深度思考，模型不输出思维链（**推荐默认值**） |
| `enabled` | 强制开启深度思考，模型强制输出思维链 |
| `auto` | 由模型自行判断是否进行深度思考 |

> **注意**：`thinking` 参数仅对支持深度思考的模型有效（如 doubao-seed 系列）。对不支持该参数的模型传入此字段可能导致报错，请根据实际模型决定是否添加。

示例：
-->
### `thinking` Parameter — Control Deep Thinking

Pass `thinking` via `extra_body` to control whether the model outputs chain-of-thought content. **Recommended default: `disabled`** to avoid unnecessary token usage and latency.

| `thinking.type` value | Description |
|---|---|
| `disabled` | Force disable deep thinking — model will not output chain-of-thought (**recommended default**) |
| `enabled` | Force enable deep thinking — model always outputs chain-of-thought |
| `auto` | Model decides on its own whether to use deep thinking |

> **Note**: The `thinking` parameter only applies to models that support deep thinking (e.g. doubao-seed series). Passing it to unsupported models may cause errors — check whether the target model supports this parameter before using it.

```python
# 关闭思考（推荐默认）/ disable thinking (recommended default)
extra_body={"thinking": {"type": "disabled"}}

# 开启思考 / enable thinking
extra_body={"thinking": {"type": "enabled"}}

# 模型自行判断 / let model decide
extra_body={"thinking": {"type": "auto"}}
```

<!--zh
## 返回值

`client.chat.completions.create()` 返回 `ChatCompletion` 对象：
-->
## Return Value

`client.chat.completions.create()` returns a `ChatCompletion` object:

```python
response.choices[0].message.content      # 文本回复 / text reply
response.choices[0].message.tool_calls   # 工具调用列表 / tool calls (Function Calling)
response.choices[0].finish_reason        # stop / tool_calls / length
response.usage.total_tokens              # 总 token 数 / total tokens used

# 仅当 thinking.type 为 enabled 或 auto（模型决定开启）时存在
# Only present when thinking.type is "enabled" or "auto" (and model decides to think)
response.choices[0].message.reasoning_content   # 思维链内容 / chain-of-thought content
response.usage.completion_tokens_details        # 含 reasoning_tokens 字段 / contains reasoning_tokens
```

<!--zh
> **注意**：`reasoning_content` 是非标准字段，OpenAI SDK 不会自动解析到属性上。需要通过以下方式读取：
-->
> **Note**: `reasoning_content` is a non-standard field and is not automatically parsed by the OpenAI SDK as an attribute. Access it as follows:

```python
# 方式一：通过 model_extra 读取 / Option 1: via model_extra
reasoning = response.choices[0].message.model_extra.get("reasoning_content")

# 方式二：转为 dict 读取 / Option 2: convert to dict
import json
msg_dict = json.loads(response.choices[0].message.model_dump_json())
reasoning = msg_dict.get("reasoning_content")
```

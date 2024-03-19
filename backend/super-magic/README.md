# SuperMagic

SuperMagic 是一个通用人工智能系统(AGI)，提供强大的任务处理能力。它基于多种大模型，支持丰富的工具调用，能够处理复杂的用户查询和任务。

## 主要特性

- **多工具支持**：预加载常用工具，包括 Python 执行、网络搜索、浏览器操作、文件保存等
- **状态管理**：完善的状态管理机制，支持 IDLE、RUNNING、FINISHED、ERROR 等状态
- **资源管理**：自动跟踪和清理资源，避免资源泄漏
- **错误处理**：分层的错误处理机制，提高系统稳定性
- **执行控制**：支持最大迭代次数限制和输出长度限制
- **模块化提示词**：整合了详细的行为指南，提高代理的任务处理能力

## 安装要求

- Python 3.8+
- 大模型 API 密钥（Claude、OpenAI、DeepSeek V3、DeepSeek R1）
- 相关依赖包

## 环境变量设置

在使用前，请确保您已通过 `.env` 文件或系统设置环境变量。

必需的环境变量：
- `OPENAI_API_KEY`：OpenAI API密钥
- `ANTHROPIC_API_KEY`：Anthropic API密钥
- `TIKHUB_API_KEY`：TikHub API密钥（用于知乎工具）

## 工具列表

### 知乎工具

知乎工具基于TikHub API实现，提供知乎问答和文章数据的获取功能。主要功能包括：

- 获取热门问题列表
- 搜索问题和文章
- 获取问题详情和回答
- 获取文章详情
- 获取用户资料

使用前请确保设置了有效的 `TIKHUB_API_KEY` 环境变量。

测试知乎工具：
```bash
python tests/test_zhihu_tool.py
```

## 基本使用

```python
from app.agent import SuperMagic

# 创建 SuperMagic 实例
agent = SuperMagic()

# 运行代理处理查询
response = agent.run("帮我查询一下Python的最新版本，并创建一个简单的Hello World程序")
print(response)
```

## 高级用法

### 自定义系统提示词

```python
custom_prompt = """
你是一个专注于数据分析的AI助手，擅长使用Python进行数据处理和可视化。
"""

agent = SuperMagic(system_prompt=custom_prompt)
```

### 注册自定义工具

```python
from app.tools.base_tool import BaseTool

class MyCustomTool(BaseTool):
    name = "my_custom_tool"
    description = "这是一个自定义工具"

    async def _run(self, **kwargs):
        # 工具实现逻辑
        return "工具执行结果"

# 注册工具
agent = SuperMagic()
agent.register_tool(MyCustomTool())
```

### 异步使用

```python
import asyncio

async def main():
    agent = SuperMagic()
    response = await agent.run_async("你的查询")
    print(response)

asyncio.run(main())
```

## 测试

运行测试脚本以验证功能：

```
python test_super_magic.py
```

## 项目结构

- `app/agent/super_magic.py`：SuperMagic 代理主实现
- `app/tools/zhihu_tool.py`：知乎工具实现
- `tests/test_zhihu_tool.py`：知乎工具测试脚本
- `test_super_magic.py`：测试脚本


# 工具系统架构指南

本文档提供了 SuperMagic 工具系统架构的详细说明，包括设计原则、核心组件、工具开发方法和最佳实践。

## 1. 架构概述

工具系统采用模块化设计，主要由以下核心组件组成：

- **BaseTool**: 工具基类，所有工具继承自此类
- **BaseToolParams**: 工具参数基类，所有参数类继承自此类
- **tool_factory**: 工具工厂单例，负责工具的扫描、注册和实例化
- **tool_executor**: 工具执行器单例，负责工具的执行和错误处理
- **@tool()**: 工具装饰器，用于自动注册工具类
- **ToolContext**: 工具上下文，包含工具执行的环境信息
- **ToolResult**: 工具结果，包含工具执行的结果信息

### 1.1 架构图

```
                           ┌────────────────┐
                           │ @tool()        │
                           │ 装饰器         │
                           └───────┬────────┘
                                   │
                                   ▼
┌────────────────┐         ┌───────────────┐         ┌────────────────┐
│ BaseToolParams │◄────────┤   BaseTool    │────────►│  ToolResult    │
└────────────────┘         └───────┬───────┘         └────────────────┘
                                   │
                                   │
                  ┌────────────────┴────────────────┐
                  │                                  │
                  ▼                                  ▼
         ┌────────────────┐                 ┌───────────────────┐
         │  tool_factory  │◄────────────────┤   tool_executor   │
         └────────────────┘                 └───────────────────┘
                  ▲                                  ▲
                  │                                  │
                  └────────────────┬────────────────┘
                                   │
                                   ▼
┌────────────────┐         ┌──────────────────────┐
│  ToolContext   │────────►│    具体工具实现      │
└────────────────┘         │  (ListDir, ReadFile) │
                           └──────────────────────┘
```

### 1.2 设计原则

1. **单一职责**: 每个工具负责单一功能，工厂负责管理，执行器负责执行
2. **依赖注入**: 通过构造函数和上下文传递依赖，避免硬编码依赖关系
3. **类型安全**: 使用 Pydantic 模型确保参数类型安全和验证
4. **自动注册**: 使用装饰器实现工具的自动注册，减少手动注册代码
5. **错误隔离**: 对工具执行错误进行捕获和处理，避免影响主流程
6. **友好错误**: 提供详细的错误消息和上下文，方便调试和修复问题

## 2. 核心组件

### 2.1 工具基类 (BaseTool)

所有工具必须继承自 `BaseTool` 基类，它提供了工具的基本接口和实现。

```python
class BaseTool(ABC, Generic[T]):
    """工具基类"""
    # 工具元数据
    name: str = ""
    description: str = ""

    # 参数模型类型
    params_class: Type[T] = None

    @abstractmethod
    async def execute(self, tool_context: ToolContext, params: T) -> ToolResult:
        """执行工具，子类必须实现"""
        pass

    async def __call__(self, tool_context: ToolContext, **kwargs) -> ToolResult:
        """工具调用的入口点，处理参数转换等通用逻辑"""
        # ...处理参数转换和错误捕获
        return result
```

`BaseTool` 类的主要特点:
- 使用泛型支持类型化的参数模型
- 抽象 `execute` 方法必须由子类实现
- `__call__` 方法提供统一的入口点，处理参数验证和错误捕获
- 提供友好的错误消息生成机制

### 2.2 工具参数基类 (BaseToolParams)

工具参数必须继承自 `BaseToolParams` 基类，它提供了参数的基本字段和验证规则。

```python
class BaseToolParams(BaseModel):
    """工具参数基类"""
    explanation: str = Field(
        "",
        description="Explain why you're using this tool in first person - briefly state your purpose, expected outcome, and how you'll use the results to help the user."
    )

    @classmethod
    def get_custom_error_message(cls, field_name: str, error_type: str) -> Optional[str]:
        """获取自定义参数错误信息"""
        return None
```

`BaseToolParams` 类的主要特点:
- 继承自 Pydantic 的 `BaseModel`，支持参数验证和类型转换
- 包含 `explanation` 字段，用于解释工具调用的目的
- 提供自定义错误消息机制，子类可以为特定字段和错误类型提供友好错误消息

### 2.3 工具装饰器 (@tool)

工具装饰器用于自动注册工具类，简化工具的定义和管理。

```python
@tool()
class MyTool(BaseTool):
    """我的工具描述"""
    # 工具实现...
```

`@tool()` 装饰器的主要功能:
- 自动从类名生成工具名称（转为蛇形命名法）
- 从文档字符串提取工具描述
- 标记工具属性，便于工具工厂扫描和注册
- 自动将类名关联到对应的文件名

### 2.4 工具工厂 (tool_factory)

工具工厂负责工具的自动发现、注册和实例化。它使用单例模式确保全局一致性。

```python
# 使用工具工厂获取工具实例
from app.tools.core.tool_factory import tool_factory

tool_instance = tool_factory.get_tool_instance("list_dir")

# 获取所有工具名称
tool_names = tool_factory.get_tool_names()

# 初始化工厂（通常不需要手动调用）
tool_factory.initialize()
```

`tool_factory` 的主要功能:
- 自动扫描和发现 `app.tools` 包下的所有工具类
- 注册工具并缓存工具信息
- 创建工具实例并缓存
- 提供工具信息查询接口

### 2.5 工具执行器 (tool_executor)

工具执行器负责工具的执行和错误处理。它也使用单例模式确保全局一致性。

```python
# 使用工具执行器执行工具
from app.tools.core.tool_executor import tool_executor

result = await tool_executor.execute_tool_call(tool_context, arguments)

# 获取工具实例
tool = tool_executor.get_tool("list_dir")

# 获取所有工具函数调用模式
schemas = tool_executor.get_tool_schemas()
```

`tool_executor` 的主要功能:
- 执行工具调用，包括参数处理和错误捕获
- 提供友好的错误处理机制
- 获取工具实例和模式信息
- 性能计时和日志记录

### 2.6 工具上下文 (ToolContext)

工具上下文包含工具执行的环境信息，如工具名称、调用ID和其他元数据。

```python
# 创建工具上下文
from agentlang.context.tool_context import ToolContext

tool_context = ToolContext(
    tool_name="list_dir",
    tool_call_id="some-id",
    # 其他上下文信息...
)
```

### 2.7 工具结果 (ToolResult)

工具结果包含工具执行的结果信息，如内容、错误、执行时间等。

```python
# 创建工具结果
from app.core.entity.tool.tool_result import ToolResult

result = ToolResult(
    content="工具执行结果",
    error=None,
    name="list_dir",
    execution_time=0.1
)
```

## 3. 工具开发指南

### 3.1 定义工具参数

首先定义工具参数类，继承自 `BaseToolParams`：

```python
from pydantic import Field
from app.tools.core import BaseToolParams

class MyToolParams(BaseToolParams):
    """工具参数"""
    param1: str = Field(..., description="参数1的描述")
    param2: int = Field(10, description="参数2的描述")
    param3: bool = Field(False, description="参数3的描述")
    
    @classmethod
    def get_custom_error_message(cls, field_name: str, error_type: str) -> Optional[str]:
        """获取自定义参数错误信息"""
        if field_name == "param1" and error_type == "missing":
            return "param1 是必须的参数，请提供一个字符串值"
        return None
```

参数定义建议:
- 使用 Pydantic 的 `Field` 为每个参数添加详细描述
- 为可选参数提供合理的默认值
- 使用类型注解指定参数类型
- 通过 `get_custom_error_message` 提供友好的错误消息

### 3.2 定义工具类

然后定义工具类，继承自 `BaseTool`，使用 `@tool()` 装饰器注册：

```python
from app.tools.core import BaseTool, tool
from agentlang.context.tool_context import ToolContext
from app.core.entity.tool.tool_result import ToolResult

@tool()
class MyTool(BaseTool):
    """我的工具描述

    这里是工具的详细说明，第一行会自动提取为简短描述。
    """

    # 设置参数类型
    params_class = MyToolParams

    async def execute(self, tool_context: ToolContext, params: MyToolParams) -> ToolResult:
        """执行工具逻辑"""
        try:
            # 实现工具逻辑
            result_content = f"处理参数: {params.param1}, {params.param2}, {params.param3}"
            
            # 返回结果
            return ToolResult(content=result_content)
        except Exception as e:
            # 错误处理
            return ToolResult(error=f"工具执行失败: {e}")
```

工具类定义建议:
- 提供详细的文档字符串，特别是第一行
- 明确指定 `params_class` 属性
- 在 `execute` 方法中实现工具逻辑
- 使用 try-except 块捕获可能的错误
- 返回格式化的 `ToolResult` 对象

### 3.3 工具执行流程

工具执行的完整流程如下：

1. 当应用启动时，`tool_factory` 会自动扫描和注册所有带有 `@tool()` 装饰器的工具类
2. 调用方创建 `ToolContext` 对象，包含工具名称和调用信息
3. 调用方通过 `tool_executor.execute_tool_call()` 执行工具
4. 执行器通过工具工厂获取工具实例
5. 执行器将参数转换为工具参数模型
6. 执行器调用工具实例的 `__call__` 方法
7. `__call__` 方法验证参数并调用 `execute` 方法
8. `execute` 方法执行工具逻辑并返回 `ToolResult`
9. 执行器处理可能的错误并返回结果

## 4. 最佳实践

### 4.1 工具命名

- 工具类名称使用 CamelCase，如 `ListDir`
- 工具名称自动转换为 snake_case，如 `list_dir`
- 文件名应该与工具名称一致，如 `list_dir.py`
- 工具描述应简洁明了，特别是第一行

### 4.2 参数设计

- 使用清晰的参数名称，避免缩写
- 使用 Pydantic 的 Field 为每个参数添加详细描述
- 为可选参数提供合理的默认值
- 使用精确的类型注解
- 通过 `get_custom_error_message` 提供友好的错误消息

### 4.3 工具实现

- 实现专注的工具，遵循单一职责原则
- 使用 try-except 块处理可能的错误
- 在 execute 方法中使用类型注解
- 将通用逻辑抽取到基类或辅助方法中
- 返回格式化的结果，避免复杂嵌套结构

### 4.4 错误处理

- 捕获并处理可能的异常
- 提供详细的错误消息，包括错误类型和上下文
- 使用自定义错误消息机制提供友好提示
- 记录详细的错误日志，包括调用栈
- 返回有意义的错误代码和描述

### 4.5 性能优化

- 避免不必要的计算和 I/O 操作
- 使用异步 I/O 提高并发性能
- 缓存频繁使用的数据和结果
- 限制资源密集型操作的范围
- 为长时间运行的操作提供超时机制

## 5. 常见问题

### 5.1 工具没有被发现

**问题**：添加了新工具，但系统没有发现它。

**解决**：
1. 确保工具类使用了 `@tool()` 装饰器
2. 确保工具文件在 `app/tools` 目录或其子目录下
3. 确保工具类名称和文件名匹配
4. 重启应用或手动调用 `tool_factory.initialize()`

### 5.2 参数验证失败

**问题**：工具执行时报参数验证错误。

**解决**：
1. 检查传入的参数是否符合参数模型的定义
2. 检查必需参数是否都已提供
3. 检查参数类型是否正确
4. 实现 `get_custom_error_message` 提供友好错误提示

### 5.3 工具执行失败

**问题**：工具执行报错。

**解决**：
1. 查看日志中的详细错误信息和调用栈
2. 检查工具逻辑中的错误处理
3. 确保所有依赖服务和资源可用
4. 在开发环境中通过单元测试验证工具功能

### 5.4 性能问题

**问题**：工具执行速度慢或资源占用高。

**解决**：
1. 使用性能分析工具找出瓶颈
2. 优化 I/O 操作，使用异步或批量处理
3. 缓存频繁使用的数据
4. 限制资源密集型操作的范围
5. 考虑分批处理大量数据的场景

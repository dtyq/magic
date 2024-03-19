# SuperMagic 事件系统架构指南

## 概述

SuperMagic 事件系统是一个基于发布-订阅模式的事件驱动架构，用于在 Agent 运行过程中实现各种组件间的解耦和通信。事件系统分为两层：

1. **基础层 (agentlang)**: 提供核心事件类型定义和事件分发机制
2. **应用层 (app)**: 提供具体业务事件的实现和监听器服务

该事件系统使 SuperMagic 能够实现高度可扩展的模块化设计，监听器可以对 Agent 生命周期中的各种事件做出响应，如文件操作、任务完成、大模型交互等。

## 1. 事件系统基础架构 (agentlang)

### 1.1 核心事件类型 (EventType)

`agentlang/event/event.py` 定义了系统支持的所有事件类型：

```python
class EventType(str, Enum):
    """事件类型枚举"""
    # Agent 生命周期事件
    BEFORE_INIT = "before_init"            # 初始化前事件
    AFTER_INIT = "after_init"              # 初始化后事件
    AGENT_SUSPENDED = "agent_suspended"    # agent终止事件
    MAIN_AGENT_FINISHED = "main_agent_finished"  # 主 agent 运行完成事件

    # 安全检查事件
    BEFORE_SAFETY_CHECK = "before_safety_check"  # 安全检查前事件
    AFTER_SAFETY_CHECK = "after_safety_check"    # 安全检查后事件

    # 用户交互事件
    AFTER_CLIENT_CHAT = "after_client_chat"      # 客户端聊天后事件

    # 大模型交互事件
    BEFORE_LLM_REQUEST = "before_llm_request"    # 请求大模型前事件
    AFTER_LLM_REQUEST = "after_llm_request"      # 请求大模型后事件

    # 工具调用事件
    BEFORE_TOOL_CALL = "before_tool_call"        # 工具调用前事件
    AFTER_TOOL_CALL = "after_tool_call"          # 工具调用后事件

    # 文件操作事件
    FILE_CREATED = "file_created"                # 文件创建事件
    FILE_UPDATED = "file_updated"                # 文件更新事件
    FILE_DELETED = "file_deleted"                # 文件删除事件

    # 错误处理事件
    ERROR = "error"                              # 错误事件
```

### 1.2 事件基类 (Event)

事件基类定义了事件的基本结构：

```python
class Event(Generic[T]):
    def __init__(self, event_type: EventType, data: BaseEventData):
        self._event_type = event_type
        self._data = data

    @property
    def event_type(self) -> EventType:
        return self._event_type

    @property
    def data(self) -> T:
        return self._data
```

### 1.3 可停止事件 (StoppableEvent)

某些事件可以中断传播流程：

```python
class StoppableEvent(Event[T]):
    def __init__(self, event_type: EventType, data: BaseEventData):
        super().__init__(event_type, data)
        self._propagation_stopped = False

    def stop_propagation(self) -> None:
        self._propagation_stopped = True

    def is_propagation_stopped(self) -> bool:
        return self._propagation_stopped
```

### 1.4 事件分发器 (EventDispatcher)

`EventDispatcher` 负责事件的注册和分发：

```python
# 在 agentlang/event/dispatcher.py 中
class EventDispatcher:
    def __init__(self):
        self._listeners = defaultdict(list)

    def add_listener(self, event_type: EventType, listener: Callable[[Event[Any]], None]) -> None:
        self._listeners[event_type].append(listener)

    async def dispatch(self, event_type: EventType, data: BaseEventData) -> Event[Any]:
        event = Event(event_type, data)
        for listener in self._listeners.get(event_type, []):
            await asyncio.ensure_future(listener(event))
        return event

    async def dispatch_stoppable(self, event_type: EventType, data: BaseEventData) -> StoppableEvent[Any]:
        event = StoppableEvent(event_type, data)
        for listener in self._listeners.get(event_type, []):
            if event.is_propagation_stopped():
                break
            await asyncio.ensure_future(listener(event))
        return event
```

## 2. 应用层事件系统 (app)

### 2.1 事件数据结构

应用层在 `app/core/entity/event/event.py` 中定义了具体的事件数据结构：

```python
# 以下是一些关键事件数据结构示例：
class BeforeLlmRequestEventData(BaseEventData):
    """请求大模型前的事件数据结构"""
    model_name: str
    chat_history: List[Dict[str, Any]]
    tools: Optional[List[Dict[str, Any]]] = None
    tool_context: ToolContext

class AfterLlmResponseEventData(BaseEventData):
    """请求大模型后的事件数据结构"""
    model_name: str
    request_time: float
    success: bool
    error: Optional[str] = None
    tool_context: ToolContext
    llm_response_message: ChatCompletionMessage
    show_in_ui: bool = True
```

### 2.2 监听器服务基类

所有监听器服务继承自 `BaseListenerService`，提供通用的事件注册逻辑：

```python
class BaseListenerService:
    @staticmethod
    def register_event_listener(agent_context: AgentContext, event_type: EventType,
                             listener: Callable[[Event[Any]], None]) -> None:
        agent_context.add_event_listener(event_type, listener)

    @staticmethod
    def register_listeners(agent_context: AgentContext,
                        event_listeners: Dict[EventType, Callable[[Event[Any]], None]]) -> None:
        for event_type, listener in event_listeners.items():
            BaseListenerService.register_event_listener(agent_context, event_type, listener)
```

### 2.3 监听器注册机制

在 `AgentDispatcher` 的 `setup` 方法中统一注册各类监听器：

```python
async def setup(self):
    """设置Agent上下文和注册监听器"""
    self.agent_context = self.agent_service.create_agent_context(
        stream_mode=False,
        task_id="",
        streams=[StdoutStream()],
        is_main_agent=True,
        sandbox_id=str(config.get("sandbox.id"))
    )

    # 注册各种监听器
    FileStorageListenerService.register_standard_listeners(self.agent_context)
    StreamListenerService.register_standard_listeners(self.agent_context)
    RagListenerService.register_standard_listeners(self.agent_context)
    CostLimitListenerService.register_standard_listeners(self.agent_context)
```

### 2.4 具体监听器服务实现

每个监听器服务实现对应的功能，以 `FileStorageListenerService` 为例：

```python
class FileStorageListenerService:
    @staticmethod
    def register_standard_listeners(agent_context: AgentContext) -> None:
        # 创建事件类型到处理函数的映射
        event_listeners = {
            EventType.FILE_CREATED: FileStorageListenerService._handle_file_event,
            EventType.FILE_UPDATED: FileStorageListenerService._handle_file_event,
            EventType.FILE_DELETED: FileStorageListenerService._handle_file_deleted,
            EventType.MAIN_AGENT_FINISHED: FileStorageListenerService._handle_main_agent_finished
        }

        # 使用基类方法批量注册监听器
        BaseListenerService.register_listeners(agent_context, event_listeners)

    @staticmethod
    async def _handle_file_event(event: Event[FileEventData]) -> None:
        # 处理文件创建和更新事件的实现...
```

## 3. Agent Context 中的事件支持

`AgentContext` 类提供了事件机制的核心功能：

```python
class AgentContext(BaseContext, AgentContextInterface):
    def add_event_listener(self, event_type: EventType, listener: Callable[[Event[Any]], None]) -> None:
        """添加事件监听器"""
        self.agent_common_context._event_dispatcher.add_listener(event_type, listener)

    async def dispatch_event(self, event_type: EventType, data: BaseEventData) -> Event[Any]:
        """分发事件"""
        return await self.agent_common_context._event_dispatcher.dispatch(event_type, data)

    async def dispatch_stoppable_event(self, event_type: EventType, data: BaseEventData) -> StoppableEvent[Any]:
        """分发可停止事件"""
        return await self.agent_common_context._event_dispatcher.dispatch_stoppable(event_type, data)
```

## 4. 主要监听器服务功能概述

SuperMagic 包含多种监听器服务，每种服务负责处理特定类型的事件：

| 监听器服务 | 主要功能 |
|------------|----------|
| FileStorageListenerService | 处理文件事件，将文件上传到存储服务 |
| StreamListenerService | 处理流式输出事件，将消息推送到客户端 |
| RagListenerService | 处理检索增强生成相关事件 |
| CostLimitListenerService | 监控和限制 API 调用成本 |

## 5. 扩展事件系统

如需添加新的事件处理，建议按照以下步骤：

1. 若需要新的事件类型，在 `agentlang/event/event.py` 中的 `EventType` 枚举中添加
2. 在 `app/core/entity/event/event.py` 中定义相应的事件数据结构
3. 创建新的监听器服务类，继承或参考 `BaseListenerService`
4. 实现事件处理方法
5. 在 `AgentDispatcher.setup()` 中注册新的监听器服务

## 结论

SuperMagic 的事件系统提供了一种灵活且可扩展的方式来处理系统中的各种状态变化和交互。通过事件驱动架构，各个组件能够在不紧密耦合的情况下进行通信，使系统更加模块化和可维护。

事件系统的分层设计（agentlang 提供基础，app 提供业务实现）也体现了关注点分离的良好架构实践，使系统更易于理解和扩展。

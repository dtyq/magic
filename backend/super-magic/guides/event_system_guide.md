# Guida all'Architettura del Sistema di Eventi SuperMagic

## Panoramica

Il sistema di eventi SuperMagic è un'architettura basata su modello publish-subscribe per l'evento-driven, utilizzata durante l'esecuzione dell'Agent per implementare il disaccoppiamento e la comunicazione tra vari componenti. Il sistema di eventi è diviso in due livelli:

1. **Livello Base (agentlang)**: Fornisce la definizione dei tipi di eventi core e il meccanismo di distribuzione degli eventi
2. **Livello Applicazione (app)**: Fornisce l'implementazione degli eventi business specifici e i servizi listener

Questo sistema di eventi permette a SuperMagic di realizzare un design modulare altamente scalabile, dove i listener possono rispondere a vari eventi nel ciclo di vita dell'Agent, come operazioni sui file, completamento dei task, interazioni con modelli di grandi dimensioni, ecc.

## 1. Architettura Base del Sistema di Eventi (agentlang)

### 1.1 Tipi di Eventi Core (EventType)

`agentlang/event/event.py` definisce tutti i tipi di eventi supportati dal sistema:

```python
class EventType(str, Enum):
    """Enumerazione dei tipi di eventi"""
    # Eventi del ciclo di vita dell'Agent
    BEFORE_INIT = "before_init"            # Evento prima dell'inizializzazione
    AFTER_INIT = "after_init"              # Evento dopo l'inizializzazione
    AGENT_SUSPENDED = "agent_suspended"    # Evento di terminazione agent
    MAIN_AGENT_FINISHED = "main_agent_finished"  # Evento di completamento esecuzione agent principale
    
    # Eventi di controllo sicurezza
    BEFORE_SAFETY_CHECK = "before_safety_check"  # Evento prima del controllo sicurezza
    AFTER_SAFETY_CHECK = "after_safety_check"    # Evento dopo il controllo sicurezza
    
    # Eventi di interazione utente
    AFTER_CLIENT_CHAT = "after_client_chat"      # Evento dopo la chat del client
    
    # Eventi di interazione con modelli di grandi dimensioni
    BEFORE_LLM_REQUEST = "before_llm_request"    # Evento prima della richiesta al modello di grandi dimensioni
    AFTER_LLM_REQUEST = "after_llm_request"      # Evento dopo la richiesta al modello di grandi dimensioni
    
    # Eventi di chiamata strumento
    BEFORE_TOOL_CALL = "before_tool_call"        # Evento prima della chiamata strumento
    AFTER_TOOL_CALL = "after_tool_call"          # Evento dopo la chiamata strumento
    
    # Eventi di operazione file
    FILE_CREATED = "file_created"                # Evento di creazione file
    FILE_UPDATED = "file_updated"                # Evento di aggiornamento file
    FILE_DELETED = "file_deleted"                # Evento di eliminazione file
    
    # Eventi di gestione errori
    ERROR = "error"                              # Evento di errore
```

### 1.2 Classe Base Evento (Event)

La classe base evento definisce la struttura base dell'evento:

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

### 1.3 Evento Arrestabile (StoppableEvent)

Alcuni eventi possono interrompere il flusso di propagazione:

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

### 1.4 Dispatcher degli Eventi (EventDispatcher)

`EventDispatcher` è responsabile della registrazione e distribuzione degli eventi:

```python
# In agentlang/event/dispatcher.py
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

## 2. Sistema di Eventi del Livello Applicazione (app)

### 2.1 Strutture Dati degli Eventi

Il livello applicazione definisce le strutture dati degli eventi specifici in `app/core/entity/event/event.py`:

```python
# Di seguito alcuni esempi di strutture dati eventi chiave:
class BeforeLlmRequestEventData(BaseEventData):
    """Struttura dati evento prima della richiesta al modello di grandi dimensioni"""
    model_name: str
    chat_history: List[Dict[str, Any]]
    tools: Optional[List[Dict[str, Any]]] = None
    tool_context: ToolContext

class AfterLlmResponseEventData(BaseEventData):
    """Struttura dati evento dopo la richiesta al modello di grandi dimensioni"""
    model_name: str
    request_time: float
    success: bool
    error: Optional[str] = None
    tool_context: ToolContext
    llm_response_message: ChatCompletionMessage
    show_in_ui: bool = True
```

### 2.2 Classe Base Servizio Listener

Tutti i servizi listener ereditano da `BaseListenerService`, fornendo la logica di registrazione eventi generica:

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

### 2.3 Meccanismo di Registrazione Listener

Nel metodo `setup` di `AgentDispatcher` vengono registrati uniformemente vari listener:

```python
async def setup(self):
    """Imposta il contesto Agent e registra i listener"""
    self.agent_context = self.agent_service.create_agent_context(
        stream_mode=False,
        task_id="",
        streams=[StdoutStream()],
        is_main_agent=True,
        sandbox_id=str(config.get("sandbox.id"))
    )

    # Registra vari listener
    FileStorageListenerService.register_standard_listeners(self.agent_context)
    TodoListenerService.register_standard_listeners(self.agent_context)
    FinishTaskListenerService.register_standard_listeners(self.agent_context)
    StreamListenerService.register_standard_listeners(self.agent_context)
    RagListenerService.register_standard_listeners(self.agent_context)
    FileListenerService.register_standard_listeners(self.agent_context)
    CostLimitListenerService.register_standard_listeners(self.agent_context)
```

### 2.4 Implementazione Servizi Listener Specifici

Ogni servizio listener implementa la funzionalità corrispondente, prendendo come esempio `FileStorageListenerService`:

```python
class FileStorageListenerService:
    @staticmethod
    def register_standard_listeners(agent_context: AgentContext) -> None:
        # Crea la mappatura da tipo evento a funzione di gestione
        event_listeners = {
            EventType.FILE_CREATED: FileStorageListenerService._handle_file_event,
            EventType.FILE_UPDATED: FileStorageListenerService._handle_file_event,
            EventType.FILE_DELETED: FileStorageListenerService._handle_file_deleted,
            EventType.MAIN_AGENT_FINISHED: FileStorageListenerService._handle_main_agent_finished
        }

        # Utilizza il metodo della classe base per registrare in batch i listener
        BaseListenerService.register_listeners(agent_context, event_listeners)
        
    @staticmethod
    async def _handle_file_event(event: Event[FileEventData]) -> None:
        # Implementazione della gestione degli eventi di creazione e aggiornamento file...
```

## 3. Supporto Eventi in Agent Context

La classe `AgentContext` fornisce le funzionalità core del meccanismo eventi:

```python
class AgentContext(BaseContext, AgentContextInterface):
    def add_event_listener(self, event_type: EventType, listener: Callable[[Event[Any]], None]) -> None:
        """Aggiunge un listener di eventi"""
        self.agent_common_context._event_dispatcher.add_listener(event_type, listener)
        
    async def dispatch_event(self, event_type: EventType, data: BaseEventData) -> Event[Any]:
        """Distribuisce l'evento"""
        return await self.agent_common_context._event_dispatcher.dispatch(event_type, data)
        
    async def dispatch_stoppable_event(self, event_type: EventType, data: BaseEventData) -> StoppableEvent[Any]:
        """Distribuisce l'evento arrestabile"""
        return await self.agent_common_context._event_dispatcher.dispatch_stoppable(event_type, data)
```

## 4. Panoramica Funzionalità Principali Servizi Listener

SuperMagic contiene molteplici servizi listener, ognuno responsabile della gestione di tipi specifici di eventi:

| Servizio Listener | Funzionalità Principali |
|-------------------|-------------------------|
| FileStorageListenerService | Gestisce eventi file, carica file al servizio di storage |
| TodoListenerService | Gestisce aggiunta, aggiornamento ed eliminazione dei task in sospeso |
| FinishTaskListenerService | Gestisce eventi di completamento task, esegue pulizie successive |
| StreamListenerService | Gestisce eventi di output streaming, invia messaggi al client |
| RagListenerService | Gestisce eventi relativi alla generazione aumentata di retrieval |
| FileListenerService | Gestisce monitoraggio cambiamenti del file system |
| CostLimitListenerService | Monitora e limita il costo delle chiamate API |

## 5. Estensione del Sistema di Eventi

Per aggiungere nuova gestione eventi, si consiglia di seguire questi passi:

1. Se necessario un nuovo tipo di evento, aggiungere nell'enumerazione `EventType` in `agentlang/event/event.py`
2. Definire la struttura dati evento corrispondente in `app/core/entity/event/event.py`
3. Creare una nuova classe servizio listener, ereditando o facendo riferimento a `BaseListenerService`
4. Implementare il metodo di gestione eventi
5. Registrare il nuovo servizio listener in `AgentDispatcher.setup()`

## Conclusione

Il sistema di eventi SuperMagic fornisce un modo flessibile ed estensibile per gestire vari cambiamenti di stato e interazioni nel sistema. Attraverso l'architettura event-driven, i vari componenti possono comunicare senza un accoppiamento stretto, rendendo il sistema più modulare e manutenibile.

Il design a livelli del sistema di eventi (agentlang fornisce le basi, app fornisce l'implementazione business) riflette anche la buona pratica architettonica della separazione delle preoccupazioni, rendendo il sistema più facile da comprendere ed estendere.

---

# Original Chinese Content / Contenuto Originale Cinese

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
    TodoListenerService.register_standard_listeners(self.agent_context)
    FinishTaskListenerService.register_standard_listeners(self.agent_context)
    StreamListenerService.register_standard_listeners(self.agent_context)
    RagListenerService.register_standard_listeners(self.agent_context)
    FileListenerService.register_standard_listeners(self.agent_context)
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
| TodoListenerService | 处理待办事项的添加、更新和删除 |
| FinishTaskListenerService | 处理任务完成事件，执行后续清理工作 |
| StreamListenerService | 处理流式输出事件，将消息推送到客户端 |
| RagListenerService | 处理检索增强生成相关事件 |
| FileListenerService | 处理文件系统变化监控 |
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
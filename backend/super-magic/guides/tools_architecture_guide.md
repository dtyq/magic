# Guida all'Architettura del Sistema di Strumenti

Questo documento fornisce una descrizione dettagliata dell'architettura del sistema di strumenti SuperMagic, inclusi i principi di design, i componenti core, i metodi di sviluppo degli strumenti e le migliori pratiche.

## 1. Panoramica dell'Architettura

Il sistema di strumenti adotta un design modulare, composto principalmente dai seguenti componenti core:

- **BaseTool**: Classe base degli strumenti, tutti gli strumenti ereditano da questa classe
- **BaseToolParams**: Classe base dei parametri degli strumenti, tutte le classi di parametri ereditano da questa classe
- **tool_factory**: Factory singleton degli strumenti, responsabile della scansione, registrazione e istanziazione degli strumenti
- **tool_executor**: Esecutore singleton degli strumenti, responsabile dell'esecuzione degli strumenti e della gestione degli errori
- **@tool()**: Decoratore degli strumenti, utilizzato per la registrazione automatica delle classi di strumenti
- **ToolContext**: Contesto degli strumenti, contiene le informazioni ambientali dell'esecuzione degli strumenti
- **ToolResult**: Risultato degli strumenti, contiene le informazioni del risultato dell'esecuzione degli strumenti

### 1.1 Diagramma dell'Architettura

```
                           ┌────────────────┐
                           │ @tool()        │
                           │ Decoratore     │
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
│  ToolContext   │────────►│    Implementazione    │
└────────────────┘         │   strumento concreta  │
                           │  (ListDir, ReadFile)  │
                           └──────────────────────┘
```

### 1.2 Principi di Design

1. **Singola Responsabilità**: Ogni strumento è responsabile di una singola funzionalità, la factory gestisce, l'esecutore esegue
2. **Iniezione delle Dipendenze**: Passare le dipendenze attraverso costruttore e contesto, evitare relazioni di dipendenza hardcoded
3. **Sicurezza dei Tipi**: Utilizzare modelli Pydantic per garantire la sicurezza e validazione dei tipi dei parametri
4. **Registrazione Automatica**: Utilizzare decoratori per implementare la registrazione automatica degli strumenti, ridurre il codice di registrazione manuale
5. **Isolamento degli Errori**: Catturare e gestire gli errori di esecuzione degli strumenti, evitare di influenzare il flusso principale
6. **Errori User-Friendly**: Fornire messaggi di errore dettagliati e contesto, facilitare il debugging e la risoluzione dei problemi

## 2. Componenti Core

### 2.1 Classe Base degli Strumenti (BaseTool)

Tutti gli strumenti devono ereditare dalla classe base `BaseTool`, che fornisce l'interfaccia e l'implementazione base degli strumenti.

```python
class BaseTool(ABC, Generic[T]):
    """Classe base degli strumenti"""
    # Metadati dello strumento
    name: str = ""
    description: str = ""

    # Tipo di modello dei parametri
    params_class: Type[T] = None

    @abstractmethod
    async def execute(self, tool_context: ToolContext, params: T) -> ToolResult:
        """Eseguire strumento, sottoclasse deve implementare"""
        pass

    async def __call__(self, tool_context: ToolContext, **kwargs) -> ToolResult:
        """Punto di ingresso della chiamata dello strumento, gestisce logica generica come conversione parametri"""
        # ...gestisce conversione parametri e cattura errori
        return result
```

Caratteristiche principali della classe `BaseTool`:
- Utilizza generici per supportare modelli di parametri tipizzati
- Il metodo astratto `execute` deve essere implementato dalla sottoclasse
- Il metodo `__call__` fornisce un punto di ingresso unificato, gestisce validazione parametri e cattura errori
- Fornisce meccanismo di generazione di messaggi di errore user-friendly

### 2.2 Classe Base dei Parametri degli Strumenti (BaseToolParams)

I parametri degli strumenti devono ereditare dalla classe base `BaseToolParams`, che fornisce i campi base e le regole di validazione dei parametri.

```python
class BaseToolParams(BaseModel):
    """Classe base dei parametri degli strumenti"""
    explanation: str = Field(
        "",
        description="Explain why you're using this tool in first person - briefly state your purpose, expected outcome, and how you'll use the results to help the user."
    )

    @classmethod
    def get_custom_error_message(cls, field_name: str, error_type: str) -> Optional[str]:
        """Ottenere messaggio di errore parametri personalizzato"""
        return None
```

Caratteristiche principali della classe `BaseToolParams`:
- Eredita da `BaseModel` di Pydantic, supporta validazione parametri e conversione tipi
- Contiene campo `explanation`, utilizzato per spiegare lo scopo della chiamata dello strumento
- Fornisce meccanismo di messaggi di errore personalizzati, le sottoclassi possono fornire messaggi user-friendly per campi e tipi di errore specifici

### 2.3 Decoratore degli Strumenti (@tool)

Il decoratore degli strumenti è utilizzato per la registrazione automatica delle classi di strumenti, semplificando la definizione e gestione degli strumenti.

```python
@tool()
class MyTool(BaseTool):
    """Descrizione del mio strumento"""
    # Implementazione strumento...
```

Funzionalità principali del decoratore `@tool()`:
- Genera automaticamente il nome dello strumento dal nome della classe (convertito in snake_case)
- Estrae la descrizione dello strumento dalla docstring
- Marca gli attributi dello strumento, facilita la scansione e registrazione da parte della factory degli strumenti
- Associa automaticamente il nome della classe al nome del file corrispondente

### 2.4 Factory degli Strumenti (tool_factory)

La factory degli strumenti è responsabile della scoperta automatica, registrazione e istanziazione degli strumenti. Utilizza il pattern singleton per garantire consistenza globale.

```python
# Utilizzare la factory degli strumenti per ottenere istanza strumento
from app.tools.core.tool_factory import tool_factory

tool_instance = tool_factory.get_tool_instance("list_dir")

# Ottenere tutti i nomi degli strumenti
tool_names = tool_factory.get_tool_names()

# Inizializzare factory (generalmente non necessario chiamare manualmente)
tool_factory.initialize()
```

Funzionalità principali di `tool_factory`:
- Scansiona e scopre automaticamente tutte le classi di strumenti nel package `app.tools`
- Registra gli strumenti e memorizza nella cache le informazioni degli strumenti
- Crea istanze degli strumenti e le memorizza nella cache
- Fornisce interfaccia di query delle informazioni degli strumenti

### 2.5 Esecutore degli Strumenti (tool_executor)

L'esecutore degli strumenti è responsabile dell'esecuzione degli strumenti e della gestione degli errori. Utilizza anche il pattern singleton per garantire consistenza globale.

```python
# Utilizzare l'esecutore degli strumenti per eseguire strumento
from app.tools.core.tool_executor import tool_executor

result = await tool_executor.execute_tool_call(tool_context, arguments)

# Ottenere istanza strumento
tool = tool_executor.get_tool("list_dir")

# Ottenere tutti gli schemi delle funzioni di chiamata degli strumenti
schemas = tool_executor.get_tool_schemas()
```

Funzionalità principali di `tool_executor`:
- Esegue chiamate di strumenti, inclusa gestione parametri e cattura errori
- Fornisce meccanismo di gestione errori user-friendly
- Ottiene istanze strumenti e informazioni schemi
- Timing delle prestazioni e registrazione log

### 2.6 Contesto degli Strumenti (ToolContext)

Il contesto degli strumenti contiene le informazioni ambientali dell'esecuzione degli strumenti, come nome strumento, ID chiamata e altri metadati.

```python
# Creare contesto strumento
from agentlang.context.tool_context import ToolContext

tool_context = ToolContext(
    tool_name="list_dir",
    tool_call_id="some-id",
    # Altre informazioni contesto...
)
```

### 2.7 Risultato degli Strumenti (ToolResult)

Il risultato degli strumenti contiene le informazioni del risultato dell'esecuzione degli strumenti, come contenuto, errore, tempo di esecuzione, ecc.

```python
# Creare risultato strumento
from app.core.entity.tool.tool_result import ToolResult

result = ToolResult(
    content="Risultato esecuzione strumento",
    error=None,
    name="list_dir",
    execution_time=0.1
)
```

## 3. Guida allo Sviluppo degli Strumenti

### 3.1 Definire Parametri degli Strumenti

Prima definire la classe dei parametri degli strumenti, ereditando da `BaseToolParams`:

```python
from pydantic import Field
from app.tools.core import BaseToolParams

class MyToolParams(BaseToolParams):
    """Parametri strumento"""
    param1: str = Field(..., description="Descrizione del parametro 1")
    param2: int = Field(10, description="Descrizione del parametro 2")
    param3: bool = Field(False, description="Descrizione del parametro 3")
    
    @classmethod
    def get_custom_error_message(cls, field_name: str, error_type: str) -> Optional[str]:
        """Ottenere messaggio di errore parametri personalizzato"""
        if field_name == "param1" and error_type == "missing":
            return "param1 è un parametro obbligatorio, fornire un valore stringa"
        return None
```

Suggerimenti per la definizione dei parametri:
- Utilizzare `Field` di Pydantic per aggiungere descrizioni dettagliate a ogni parametro
- Fornire valori predefiniti ragionevoli per parametri opzionali
- Utilizzare annotazioni di tipo per specificare il tipo dei parametri
- Fornire messaggi di errore user-friendly attraverso `get_custom_error_message`

### 3.2 Definire Classe Strumento

Poi definire la classe strumento, ereditando da `BaseTool`, utilizzando il decoratore `@tool()` per la registrazione:

```python
from app.tools.core import BaseTool, tool
from agentlang.context.tool_context import ToolContext
from app.core.entity.tool.tool_result import ToolResult

@tool()
class MyTool(BaseTool):
    """Descrizione del mio strumento

    Qui la descrizione dettagliata dello strumento, la prima riga verrà estratta automaticamente come descrizione breve.
    """

    # Impostare tipo parametri
    params_class = MyToolParams

    async def execute(self, tool_context: ToolContext, params: MyToolParams) -> ToolResult:
        """Eseguire logica strumento"""
        try:
            # Implementare logica strumento
            result_content = f"Elaborazione parametri: {params.param1}, {params.param2}, {params.param3}"
            
            # Restituire risultato
            return ToolResult(content=result_content)
        except Exception as e:
            # Gestione errori
            return ToolResult(error=f"Esecuzione strumento fallita: {e}")
```

Suggerimenti per la definizione della classe strumento:
- Fornire docstring dettagliata, specialmente la prima riga
- Specificare chiaramente l'attributo `params_class`
- Implementare la logica strumento nel metodo `execute`
- Utilizzare blocchi try-except per catturare possibili errori
- Restituire oggetto `ToolResult` formattato

### 3.3 Flusso di Esecuzione degli Strumenti

Il flusso completo di esecuzione degli strumenti è il seguente:

1. Quando l'applicazione si avvia, `tool_factory` scannerà e registrerà automaticamente tutte le classi di strumenti con decoratore `@tool()`
2. Il chiamante crea oggetto `ToolContext`, contenente nome strumento e informazioni chiamata
3. Il chiamante esegue lo strumento attraverso `tool_executor.execute_tool_call()`
4. L'esecutore ottiene l'istanza strumento attraverso la factory degli strumenti
5. L'esecutore converte i parametri nel modello di parametri dello strumento
6. L'esecutore chiama il metodo `__call__` dell'istanza strumento
7. Il metodo `__call__` valida i parametri e chiama il metodo `execute`
8. Il metodo `execute` esegue la logica strumento e restituisce `ToolResult`
9. L'esecutore gestisce possibili errori e restituisce il risultato

## 4. Migliori Pratiche

### 4.1 Denominazione degli Strumenti

- I nomi delle classi strumento utilizzano CamelCase, come `ListDir`
- I nomi strumento vengono convertiti automaticamente in snake_case, come `list_dir`
- Il nome file dovrebbe essere consistente con il nome strumento, come `list_dir.py`
- La descrizione dello strumento dovrebbe essere concisa e chiara, specialmente la prima riga

### 4.2 Design dei Parametri

- Utilizzare nomi parametri chiari, evitare abbreviazioni
- Utilizzare Field di Pydantic per aggiungere descrizioni dettagliate a ogni parametro
- Fornire valori predefiniti ragionevoli per parametri opzionali
- Utilizzare annotazioni di tipo precise
- Fornire suggerimenti user-friendly attraverso `get_custom_error_message`

### 4.3 Implementazione degli Strumenti

- Implementare strumenti focalizzati, seguire il principio di singola responsabilità
- Utilizzare blocchi try-except per gestire possibili errori
- Utilizzare annotazioni di tipo nel metodo execute
- Estrarre logica comune nella classe base o metodi ausiliari
- Restituire risultati formattati, evitare strutture annidate complesse

### 4.4 Gestione degli Errori

- Catturare e gestire possibili eccezioni
- Fornire messaggi di errore dettagliati, inclusi tipo errore e contesto
- Utilizzare meccanismo di messaggi di errore personalizzati per fornire suggerimenti user-friendly
- Registrare log di errore dettagliati, inclusi stack trace
- Restituire codici di errore e descrizioni significative

### 4.5 Ottimizzazione delle Prestazioni

- Evitare calcoli e operazioni I/O non necessarie
- Utilizzare I/O asincroni per migliorare le prestazioni concorrenti
- Memorizzare nella cache dati e risultati utilizzati frequentemente
- Limitare l'ambito di operazioni che richiedono molte risorse
- Fornire meccanismi di timeout per operazioni di lunga durata

## 5. Problemi Comuni

### 5.1 Strumento non Scoperto

**Problema**: È stato aggiunto un nuovo strumento, ma il sistema non lo ha scoperto.

**Soluzione**:
1. Assicurarsi che la classe strumento utilizzi il decoratore `@tool()`
2. Assicurarsi che il file strumento sia nella directory `app/tools` o sue sottodirectory
3. Assicurarsi che il nome della classe strumento e il nome file corrispondano
4. Riavviare l'applicazione o chiamare manualmente `tool_factory.initialize()`

### 5.2 Validazione Parametri Fallita

**Problema**: Durante l'esecuzione dello strumento viene riportato errore di validazione parametri.

**Soluzione**:
1. Verificare che i parametri passati siano conformi alla definizione del modello parametri
2. Verificare che tutti i parametri obbligatori siano stati forniti
3. Verificare che i tipi dei parametri siano corretti
4. Implementare `get_custom_error_message` per fornire suggerimenti di errore user-friendly

### 5.3 Esecuzione Strumento Fallita

**Problema**: L'esecuzione dello strumento riporta errore.

**Soluzione**:
1. Controllare le informazioni di errore dettagliate e lo stack trace nei log
2. Verificare la gestione degli errori nella logica dello strumento
3. Assicurarsi che tutti i servizi e risorse dipendenti siano disponibili
4. Verificare la funzionalità dello strumento attraverso test unitari in ambiente di sviluppo

### 5.4 Problemi di Prestazioni

**Problema**: L'esecuzione dello strumento è lenta o occupa molte risorse.

**Soluzione**:
1. Utilizzare strumenti di analisi delle prestazioni per identificare i colli di bottiglia
2. Ottimizzare operazioni I/O, utilizzare elaborazione asincrona o batch
3. Memorizzare nella cache dati utilizzati frequentemente
4. Limitare l'ambito di operazioni che richiedono molte risorse
5. Considerare l'elaborazione batch per scenari con grandi quantità di dati

---

# Original Chinese Content / Contenuto Originale Cinese

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

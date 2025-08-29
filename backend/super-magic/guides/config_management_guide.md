# Guida alla Gestione della Configurazione SuperMagic

## Panoramica

SuperMagic utilizza un sistema di gestione della configurazione flessibile, basato su file YAML e variabili d'ambiente, che supporta la configurazione gerarchica e la validazione dei tipi. Il sistema fornisce un'interfaccia unificata per l'accesso alla configurazione e supporta il caricamento a caldo e l'aggiornamento dinamico della configurazione.

## Componenti del Sistema di Configurazione

- **Gestore della Configurazione**: Responsabile del caricamento, dell'analisi e della gestione dei dati di configurazione, supporta molteplici fonti di configurazione
- **Modello di Configurazione**: Utilizza modelli Pydantic per definire la struttura della configurazione e i valori predefiniti
- **File di Configurazione**: File di configurazione principale memorizzato in `config/config.yaml`
- **Variabili d'Ambiente**: Fa riferimento alle variabili d'ambiente del sistema tramite segnaposto, supporta valori predefiniti

## Struttura del File di Configurazione

Il file di configurazione principale si trova in `config/config.yaml`, utilizza il formato YAML e contiene le seguenti parti principali:

- **browser**: Configurazioni relative al browser
- **llm**: Configurazioni generali dell'API LLM
- **agent**: Configurazioni del sistema agente
- **image_generator**: Configurazioni del servizio di generazione immagini
- **models**: Configurazioni di molteplici modelli, inclusi vari modelli LLM
  - Ogni modello contiene elementi di configurazione come api_key, api_base_url, name, type, supports_tool_use
- **Configurazioni di Servizio**: Configurazioni dedicate per vari servizi
- **Configurazioni di Sistema**: Configurazioni del sistema core

## Segnaposto delle Variabili d'Ambiente

Il file di configurazione supporta due formati di riferimento alle variabili d'ambiente:

1. `${ENV_VAR}` - Fa riferimento alla variabile d'ambiente, senza valore predefinito
2. `${ENV_VAR:-default}` - Fa riferimento alla variabile d'ambiente, se non esiste utilizza il valore predefinito

Esempio:
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

## Conversione dei Tipi di Dati

Il sistema di configurazione esegue automaticamente la conversione dei tipi di dati:

- `"true"` e `"false"` vengono convertiti in valori booleani
- Le stringhe numeriche vengono convertite in interi o numeri in virgola mobile
- Liste e dizionari mantengono la loro struttura

## Metodo d'Uso

### Ottenere la Configurazione

```python
from agentlang.config import config

# Ottenere un elemento di configurazione specifico
headless = config.get("browser.headless")
api_key = config.get("models.gpt-4o.api_key")

# Utilizzare valori predefiniti
timeout = config.get("llm.api_timeout", 60)
```

### Gestore della Configurazione

```python
from agentlang.config.config import Config

# Creare un'istanza del gestore della configurazione
config_manager = Config()

# Caricare la configurazione
config_manager.load_config("/path/to/config.yaml")

# Utilizzare il percorso con punto per ottenere la configurazione
api_key = config_manager.get("models.gpt-4o.api_key")
model_name = config_manager.get("models.gpt-4o.name", "default-model")
```

### Impostare e Ricaricare la Configurazione

```python
from agentlang.config import config

# Impostare il valore della configurazione
config.set("models.gpt-4o.temperature", 0.8)

# Ricaricare la configurazione (per aggiornamenti runtime delle variabili d'ambiente)
config.reload_config()
```

## Percorso di Ricerca della Configurazione

Il sistema cerca i file di configurazione nel seguente ordine:

1. Percorso specificato dalla variabile d'ambiente `CONFIG_PATH`
2. `config/config.yaml` nella directory radice del progetto

## Priorità della Configurazione

La priorità di caricamento della configurazione va dall'alto al basso:

1. Configurazione runtime impostata tramite `config.set()`
2. Variabili d'ambiente
3. Valori nel file di configurazione
4. Valori predefiniti nel modello Pydantic

## Note di Sicurezza

- Le informazioni sensibili (come le chiavi API) dovrebbero essere fornite tramite variabili d'ambiente o file `.env`, non scritte direttamente nei file di configurazione
- Nei file di configurazione si dovrebbero utilizzare i segnaposto delle variabili d'ambiente per fare riferimento alle informazioni sensibili
- I file `.env` non dovrebbero essere sottoposti a controllo versione
- Seguire le note di sicurezza all'inizio del file di configurazione, non esporre informazioni sensibili nei file di configurazione

## Integrazione con File .env

SuperMagic supporta il caricamento delle variabili d'ambiente tramite file `.env`. Per dettagli fare riferimento a [dotenv_configuration.md](dotenv_configuration.md).

## Domande Frequenti

### Configurazione non caricata correttamente

Assicurarsi che:
- Il file di configurazione esista nella posizione corretta
- Le variabili d'ambiente siano impostate correttamente
- Il formato del file di configurazione sia corretto (YAML valido)

### Variabili d'ambiente non efficaci

- Verificare che il formato del segnaposto sia corretto
- Confermare che la variabile d'ambiente sia impostata
- Controllare maiuscole/minuscole nel nome della variabile d'ambiente

### Posizione di configurazione personalizzata

È possibile specificare un percorso di file di configurazione personalizzato tramite variabile d'ambiente:

```python
import os
os.environ["CONFIG_PATH"] = "/path/to/custom/config.yaml"

# Poi caricare la configurazione
from agentlang.config.config import Config
config_manager = Config()
config_manager.load_config()
```

---

# Original Chinese Content / Contenuto Originale Cinese

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
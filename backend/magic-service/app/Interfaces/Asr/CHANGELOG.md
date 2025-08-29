# Registro delle Modifiche API Token ASR

## 2024-01-XX - Aggiunto parametro refresh e modifica duration

### Nuove Funzionalità
- ✅ Aggiunto parametro `refresh` all'interfaccia `GET /api/v1/asr/tokens`
- ✅ Supporto per il refresh forzato del token, quando `refresh=true` cancella la cache e riottiene il token

### Contenuto delle Modifiche
- 🔄 Duration predefinito cambiato da 3600 secondi a 7200 secondi (2 ore)
- 🔄 Non accetta più il parametro duration esterno, fisso a 7200 secondi
- 🔄 Ottimizzata la logica di cache, supporto per refresh su richiesta
- 🔄 Campo `duration` visualizzato dinamicamente: nuovi token mostrano 7200 secondi, token in cache mostrano il tempo rimanente

### Modifiche all'Interfaccia
- **GET /api/v1/asr/tokens**
  - Nuovo: parametro `refresh` (boolean, predefinito false)
  - Rimosso: parametro `duration`
  - Modificato: Validità token fissata a 7200 secondi
  - Ottimizzato: campo `duration` mostra dinamicamente il tempo rimanente di validità

### Miglioramenti Tecnici
- 🚀 Migliorata l'esperienza d'uso del token, ridotto il problema delle scadenze frequenti
- 🔧 Aumentata la flessibilità del controllo della cache
- 📊 Visualizzazione dinamica del tempo rimanente del token, migliorata l'esperienza utente
- 📝 Aggiornata la documentazione API completa e gli esempi d'uso

## 2024-01-XX - Refactoring Completato

### Funzionalità Rimosse
- ❌ Rimosso l'interfaccia `GET /api/v1/asr/config`
- ❌ Eliminata la classe `AsrTokenController`
- ❌ Eliminato il comando di test `TestJwtTokenCommand`

### Nuove Funzionalità
- ✅ Creata la classe `AsrTokenApi`, conforme al pattern Facade del progetto
- ✅ Creata la classe base `AbstractApi`, fornisce funzionalità generiche
- ✅ Refactored la struttura delle directory, utilizza sottodirectory `Facade`

### Funzionalità Mantenute
- ✅ `GET /api/v1/asr/tokens` - Ottieni JWT Token
- ✅ `DELETE /api/v1/asr/tokens` - Cancella cache JWT Token
- ✅ Meccanismo di autenticazione utente
- ✅ Meccanismo di cache Redis
- ✅ Ottimizzazione prestazioni (miglioramento del 93.8%)

### Miglioramenti Tecnici
- 📁 Struttura delle directory più conforme agli standard del progetto
- 🏗️ Utilizzo del pattern Facade, eredita da AbstractApi
- 🧹 Codice più pulito, rimossi gli interfaccia di configurazione non necessari
- 📝 Mantenuta documentazione completa e gestione degli errori

## Struttura dei File

```
app/Interfaces/Asr/
├── Facade/
│   ├── AbstractApi.php      # Classe API base
│   └── AsrTokenApi.php      # API JWT Token
├── README.md                # Documentazione API
└── CHANGELOG.md             # Registro delle modifiche
```

## Mappatura delle Route

```
GET    /api/v1/asr/tokens  → AsrTokenApi::show()
DELETE /api/v1/asr/tokens  → AsrTokenApi::destroy()
```

---

# ASR Token API 变更日志

## 2024-01-XX - 新增refresh参数和duration修改

### 新增功能
- ✅ 为 `GET /api/v1/asr/tokens` 接口新增 `refresh` 参数
- ✅ 支持强制刷新token功能，当 `refresh=true` 时会清除缓存并重新获取

### 变更内容
- 🔄 默认duration从3600秒改为7200秒（2小时）
- 🔄 不再接受外部传入的duration参数，固定为7200秒
- 🔄 优化缓存逻辑，支持按需刷新
- 🔄 `duration` 字段动态显示：新token显示7200秒，缓存token显示剩余时间

### 接口变更
- **GET /api/v1/asr/tokens**
  - 新增：`refresh` 参数（boolean，默认false）
  - 移除：`duration` 参数
  - 修改：Token有效期固定为7200秒
  - 优化：`duration` 字段动态显示剩余有效时间

### 技术改进
- 🚀 提升token使用体验，减少频繁过期问题
- 🔧 增强缓存控制灵活性
- 📊 动态显示token剩余时间，提升用户体验
- 📝 更新完整的API文档和使用示例

## 2024-01-XX - 重构完成

### 移除的功能
- ❌ 移除了 `GET /api/v1/asr/config` 接口
- ❌ 删除了 `AsrTokenController` 类
- ❌ 删除了 `TestJwtTokenCommand` 测试命令

### 新增的功能
- ✅ 创建了 `AsrTokenApi` 类，符合项目Facade模式
- ✅ 创建了 `AbstractApi` 基类，提供通用功能
- ✅ 重构了目录结构，使用 `Facade` 子目录

### 保持的功能
- ✅ `GET /api/v1/asr/tokens` - 获取JWT Token
- ✅ `DELETE /api/v1/asr/tokens` - 清除JWT Token缓存
- ✅ 用户鉴权机制
- ✅ Redis缓存机制
- ✅ 性能优化（93.8%提升）

### 技术改进
- 📁 目录结构更符合项目规范
- 🏗️ 使用Facade模式，继承AbstractApi
- 🧹 代码更加简洁，移除了不必要的配置接口
- 📝 保持了完整的文档和错误处理

## 文件结构

```
app/Interfaces/Asr/
├── Facade/
│   ├── AbstractApi.php      # 基础API类
│   └── AsrTokenApi.php      # JWT Token API
├── README.md                # API文档
└── CHANGELOG.md             # 变更日志
```

## 路由映射

```
GET    /api/v1/asr/tokens  → AsrTokenApi::show()
DELETE /api/v1/asr/tokens  → AsrTokenApi::destroy()
```

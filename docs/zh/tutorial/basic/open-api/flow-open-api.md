# 📘 Documentazione API di Magic Flow

## 🔐 1. Autenticazione
Le API supportano due metodi di autenticazione. Puoi fornire la tua API Key in uno dei due modi seguenti:

Metodo 1: Intestazione api-key (consigliato)
```
api-key: YOUR_API_KEY
```

Metodo 2: Intestazione Authorization
```
Authorization: Bearer YOUR_API_KEY
```

Formato della chiave: inizia con `api-sk-`.
Per istruzioni sulla generazione e configurazione dell’API Key, vedi: https://www.teamshare.cn/knowledge/preview/710857519214628864/775765654906695680

## 📎 2. Spiegazioni di base
- URL base delle API: `https://[API_HOST]`
- Tutte le richieste e risposte usano JSON
- I timestamp usano il formato ISO 8601
- Tutte le richieste devono includere le intestazioni di autenticazione

## 🧩 3. Elenco delle API

### 3.1 Chat API
Crea una conversazione, supporta dialoghi generali e in modalità Flow.
- Percorso: `/api/chat`
- Metodo: `POST`
- Content-Type: `application/json`

Parametri richiesta:
| Nome | Tipo | Obbligatorio | Descrizione |
|---|---|---|---|
| message | string | Sì | Contenuto del messaggio |
| conversation_id | string | No | ID conversazione per mantenere il contesto; se omesso, il server ne crea uno nuovo e lo restituisce |
| attachments | array | No | Elenco degli allegati (solo l’API chat lo supporta) |
| stream | boolean | No | Abilita risposta in streaming, predefinito false |

Allegati: carica prima i file su un URL pubblico, quindi fornisci i riferimenti nella richiesta.
Esempio struttura allegato:
```json
{
  "attachment_name": "filename.ext",
  "attachment_url": "https://example.com/path/to/file"
}
```

Tipi di allegato supportati:
- Immagini: jpeg, jpg, png, gif
- Documenti: pdf, doc, docx, txt

Note sugli allegati:
1) L’URL deve essere pubblicamente accessibile
2) Dimensione massima 10MB
3) Per analisi immagini serve un modello che supporti la visione

Struttura risposta (principale):
| Campo | Tipo | Descrizione |
|---|---|---|
| conversation_id | string | ID conversazione |
| messages | array | Array di messaggi (stessa struttura del non-stream) |

Struttura oggetto messaggio:
| Campo | Tipo | Descrizione |
|---|---|---|
| id | string | ID messaggio |
| message | object | Contenuto del messaggio |
| conversation_id | string | ID conversazione |
| error_information | string | Dettagli errore, se presenti |
| success | boolean | Indica successo esecuzione, default true |

Esempi richiesta/risposta e streaming: invariati nei blocchi di codice sottostanti.

### 3.2 API chiamata con parametri
Esegue chiamate con parametri.
- Percorso: `/api/param-call`
- Metodo: `POST`
- Content-Type: `application/json`

Parametri richiesta:
| Nome | Tipo | Obbligatorio | Descrizione |
|---|---|---|---|
| message | string | Sì | Contenuto del messaggio |
| conversation_id | string | No | ID conversazione (solo a fini di log) |
| params | object | Sì | Parametri chiave-valore della chiamata |

Parametri risposta:
| Campo | Tipo | Descrizione |
|---|---|---|
| conversation_id | string | ID conversazione |
| result | object | Risultato dell’esecuzione |

Gli esempi di richiesta e risposta sono riportati nei blocchi sottostanti.

### 3.3 Chat asincrona
Crea una conversazione in modalità asincrona.
- Percorso: `/api/async-chat`
- Metodo: `POST`
- Content-Type: `application/json`

Parametri richiesta:
| Nome | Tipo | Obbligatorio | Descrizione |
|---|---|---|---|
| message | string | Sì | Contenuto del messaggio |
| conversation_id | string | No | ID conversazione |
| attachments | array | No | Elenco allegati, stesso formato della Chat API |
| async | boolean | Sì | Deve essere true |

Parametri risposta:
| Campo | Tipo | Descrizione |
|---|---|---|
| conversation_id | string | ID conversazione |
| task_id | string | ID del task asincrono |

Gli esempi di richiesta e risposta sono riportati nei blocchi sottostanti.

### 3.4 Chiamata con parametri (asincrona)
- Percorso: `/api/param-call`
- Metodo: `POST`
- Content-Type: `application/json`

Parametri richiesta:
| Nome | Tipo | Obbligatorio | Descrizione |
|---|---|---|---|
| message | string | Sì | Contenuto del messaggio |
| conversation_id | string | No | ID conversazione (solo log) |
| params | object | Sì | Parametri chiave-valore |
| async | boolean | Sì | Deve essere true |

Parametri risposta:
| Campo | Tipo | Descrizione |
|---|---|---|
| conversation_id | string | ID conversazione |
| task_id | string | ID del task asincrono |

### 3.5 Recupero risultato asincrono
Ottieni il risultato dell’elaborazione di un task asincrono.
- Percorso: `/api/async-chat/{task_id}`
- Metodo: `GET`

Parametri richiesta:
| Nome | Tipo | Obbligatorio | Descrizione |
|---|---|---|---|
| task_id | string | Sì | ID del task asincrono (nel path) |

Parametri risposta:
| Campo | Tipo | Descrizione |
|---|---|---|
| task_id | string | ID task |
| status | integer | Codice stato |
| status_label | string | Descrizione stato: "pending" | "processing" | "completed" | "failed" |
| created_at | string | Data creazione |
| result | object | Risultato (solo quando completato) |

Gli esempi per chat e chiamate parametriche sono riportati nei blocchi sottostanti.

## 🧯 4. Codici di errore
| Codice | Descrizione |
|---|---|
| 400 | Parametri richiesta non validi |
| 401 | Non autorizzato, API Key non valida |
| 403 | Permessi insufficienti |
| 404 | Risorsa non trovata |
| 429 | Troppe richieste |
| 500 | Errore interno del server |

Esempio di risposta errore: invariato nel blocco sottostante.

---

# 中文原文
# Magic Flow API 接口文档
## 一、认证方式
API 支持两种认证方式，您可以选择以下任一方式提供 API Key：
**方式一：使用 api-key 请求头（推荐）**
```
api-key: YOUR_API_KEY
```
**方式二：使用 Authorization 请求头**
```
Authorization: Bearer YOUR_API_KEY
```
API Key 格式为 `api-sk-` 开头的字符串。
具体如何设置API Key可以参考这里：[https://www.teamshare.cn/knowledge/preview/710857519214628864/775765654906695680](https://www.teamshare.cn/knowledge/preview/710857519214628864/775765654906695680)
## 二、基础说明
- 接口基础 URL: `https://[API_HOST]`
- 所有请求和响应均使用 JSON 格式
- 所有时间戳采用 ISO 8601 格式
- 所有请求均需包含认证头
## 三、接口列表
### 聊天接口
用于创建聊天对话，支持普通对话和流式对话。
**接口路径**：`/api/chat`
**请求方式**：`POST`
**Content-Type**：`application/json`
**请求参数**：
|参数名|类型|必选|描述|
|---|---|---|---|
|message|string|是|聊天消息内容|
|conversation_id|string|否|对话 ID，用于维持对话上下文。若不提供，服务端会创建一个新的对话 ID 并在响应中返回|
|attachments|array|否|附件列表，仅聊天接口支持附件参数|
|stream|boolean|否|是否使用流式返回，默认为 false|

**附件参数说明**：
附件需要先上传到可公开访问的 URL，然后在请求中提供附件的引用。
```json
{
  "attachment_name": "文件名.扩展名",
  "attachment_url": "https://example.com/path/to/file"
}
```
|参数名|类型|必选|描述|
|---|---|---|---|
|attachment_name|string|是|附件文件名，包含扩展名（如image.jpeg）|
|attachment_url|string|是|附件的公开可访问URL|

**支持的附件类型**：
- 图片：jpeg, jpg, png, gif
- 文档：pdf, doc, docx, txt
**附件注意事项**：
1. 附件 URL 必须是公开可访问的
2. 附件大小限制为 10MB
3. 图片分析能力需要使用支持图像处理的模型
**响应参数**：
|参数名|类型|描述|
|---|---|---|
|conversation_id|string|对话 ID，如果请求中未提供，则服务端会创建一个新的|
|messages|array|消息数组，包含对话消息内容|

**消息对象结构**：
|参数名|类型|描述|
|---|---|---|
|id|string|消息 ID|
|message|object|消息内容对象|
|conversation_id|string|对话 ID|
|error_information|string|错误信息，如果有的话|
|success|boolean|消息是否成功，默认为 true|

**请求示例**：
```bash
curl -X POST "https://[API_HOST]/api/chat" \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_API_KEY" \
  -d '{
    "message": "你好，Magic!",
    "conversation_id": "conv_123456",
    "attachments": [],
    "stream": false
  }'
```
**带附件的请求示例**：
```bash
curl -X POST "https://[API_HOST]/api/chat" \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_API_KEY" \
  -d '{
    "message": "这张图片里有什么?",
    "attachments": [
      {
        "attachment_name": "image.jpeg",
        "attachment_url": "https://example.com/path/to/image.jpeg"
      }
    ],
    "stream": false
  }'
```
**响应示例**：
```json
{
  "conversation_id": "conv_123456",
  "messages": [
    {
      "id": "msg_abc123",
      "message": {
        "content": "你好！有什么我可以帮助你的吗？",
        "role": "assistant"
      },
      "conversation_id": "conv_123456",
      "error_information": "",
      "success": true
    }
  ]
}
```
**流式请求示例**：
```bash
curl -X POST "https://[API_HOST]/api/chat" \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_API_KEY" \
  -d '{
    "message": "你好，Magic!",
    "conversation_id": "conv_123456",
    "attachments": [],
    "stream": true
  }'
```
**流式响应**：
流式响应将以 `text/event-stream` 格式返回，每个事件包含部分消息内容。每个消息片段的结构与非流式响应中的消息对象结构相同。
### 参数调用接口
用于带参数的调用。
**接口路径**：`/api/param-call`
**请求方式**：`POST`
**Content-Type**：`application/json`
**请求参数**：
|参数名|类型|必选|描述|
|---|---|---|---|
|message|string|是|消息内容|
|conversation_id|string|否|对话 ID（注意：此接口不使用此参数，仅用于记录）|
|params|object|是|调用参数，键值对形式|

**响应参数**：
|参数名|类型|描述|
|---|---|---|
|conversation_id|string|对话 ID|
|result|object|调用结果，包含执行参数调用的结果数据|

**请求示例**：
```bash
curl -X POST "https://[API_HOST]/api/param-call" \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_API_KEY" \
  -d '{
    "message": "执行任务",
    "conversation_id": "conv_123456",
    "params": {
      "name": "test",
      "value": 123
    }
  }'
```
**响应示例**：
```json
{
  "conversation_id": "conv_123456",
  "result": {
    "status": "success",
    "data": {"key": "value"}
  }
}
```
### 异步聊天接口
用于异步方式创建聊天对话。
**接口路径**：`/api/async-chat`
**请求方式**：`POST`
**Content-Type**：`application/json`
**请求参数**：
|参数名|类型|必选|描述|
|---|---|---|---|
|message|string|是|聊天消息内容|
|conversation_id|string|否|对话 ID，用于维持对话上下文。若不提供，服务端会创建一个新的对话 ID|
|attachments|array|否|附件列表，格式同聊天接口|
|async|boolean|是|必须为 true|

**响应参数**：
|参数名|类型|描述|
|---|---|---|
|conversation_id|string|对话 ID|
|task_id|string|异步任务 ID，用于后续查询任务结果|

**请求示例**：
```bash
curl -X POST "https://[API_HOST]/api/async-chat" \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_API_KEY" \
  -d '{
    "message": "你好，Magic!",
    "conversation_id": "conv_123456",
    "attachments": [],
    "async": true
  }'
```
**响应示例**：
```json
{
  "conversation_id": "conv_123456",
  "task_id": "task_123456"
}
```
### 异步参数调用接口
用于异步方式进行带参数的调用。
**接口路径**：`/api/param-call`
**请求方式**：`POST`
**Content-Type**：`application/json`
**请求参数**：
|参数名|类型|必选|描述|
|---|---|---|---|
|message|string|是|消息内容|
|conversation_id|string|否|对话 ID（注意：此接口不使用此参数，仅用于记录）|
|params|object|是|调用参数，键值对形式|
|async|boolean|是|必须为 true|

**响应参数**：
|参数名|类型|描述|
|---|---|---|
|conversation_id|string|对话 ID|
|task_id|string|异步任务 ID，用于后续查询任务结果|

**请求示例**：
```bash
curl -X POST "https://[API_HOST]/api/param-call" \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_API_KEY" \
  -d '{
    "message": "执行任务",
    "conversation_id": "conv_123456",
    "params": {
      "name": "test",
      "value": 123
    },
    "async": true
  }'
```
**响应示例**：
```json
{
  "conversation_id": "conv_123456",
  "task_id": "task_123456"
}
```
### 获取异步结果接口
用于获取异步任务的处理结果。
**接口路径**：`/api/async-chat/{task_id}`
**请求方式**：`GET`
**请求参数**：
|参数名|类型|必选|描述|
|---|---|---|---|
|task_id|string|是|异步任务 ID，包含在URL中|

**响应参数**：
|参数名|类型|描述|
|---|---|---|
|task_id|string|异步任务 ID|
|status|integer|任务状态码|
|status_label|string|任务状态描述，可能为 "pending"、"processing"、"completed"、"failed"|
|created_at|string|创建时间|
|result|object|任务结果，仅当任务状态为已完成时有效|

**请求示例**：
```bash
curl -X GET "https://[API_HOST]/api/async-chat/task_123456" \
  -H "api-key: YOUR_API_KEY"
```
**响应示例（聊天任务）**：
```json
{
  "task_id": "task_123456",
  "status": 2,
  "status_label": "completed",
  "created_at": "2023-09-01T12:00:00Z",
  "result": {
    "conversation_id": "conv_123456",
    "messages": [
      {
        "id": "msg_abc123",
        "message": {
          "content": "你好！有什么我可以帮助你的吗？",
          "role": "assistant"
        },
        "conversation_id": "conv_123456",
        "error_information": "",
        "success": true
      }
    ]
  }
}
```
**响应示例（参数调用任务）**：
```json
{
  "task_id": "task_123456",
  "status": 2,
  "status_label": "completed",
  "created_at": "2023-09-01T12:00:00Z",
  "result": {
    "conversation_id": "conv_123456",
    "result": {
      "status": "success",
      "data": {"key": "value"}
    }
  }
}
```
## 四、错误码
|错误码|描述|
|---|---|
|400|请求参数错误|
|401|未授权，API Key 无效|
|403|权限不足|
|404|资源不存在|
|429|请求过于频繁|
|500|服务器内部错误|

**错误响应示例**：
```json
{
  "error": {
    "code": 400,
    "message": "参数 message 不能为空"
  }
}
```


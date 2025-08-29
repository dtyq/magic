# Servizio API Gateway in Go 🏰

Questo è un servizio API gateway ad alte prestazioni per container Docker, implementato in linguaggio Go, che può gestire in modo sicuro le variabili d'ambiente e fornire token di accesso temporanei.

**Nota importante:** Questo gateway supporta solo la sostituzione del contenuto degli header e del dominio URL, non supporta la sostituzione del contenuto del body.

## 🚀 Caratteristiche Principali

- **⚡ Alte Prestazioni**: Implementato in Go, con miglioramenti significativi delle prestazioni rispetto alla versione Python
- **🔐 Servizio di Autenticazione**: Genera token di accesso temporanei per i container
- **🛡️ Protezione delle Variabili d'Ambiente**: I container non possono ottenere direttamente i valori delle variabili d'ambiente, possono solo usarli indirettamente tramite proxy API
- **🔗 Supporto Multi-Servizio**: Può supportare contemporaneamente più servizi API (come OpenAI, DeepSeek, Magic, ecc.)
- **🛤️ Routing per Nome Variabile d'Ambiente**: Accesso diretto ai servizi corrispondenti tramite nome della variabile d'ambiente
- **🔄 Proxy API**: Sostituzione automatica dei riferimenti alle variabili d'ambiente nelle richieste
- **📝 Supporto Formati Multipli di Riferimento alle Variabili**: `env:VAR`, `${VAR}`, `$VAR`, `OPENAI_*`, ecc.
- **🌍 Distribuzione Multi-Ambiente**: Supporta tre ambienti indipendenti: test, pre-release e produzione

## 📁 Struttura del Progetto

```
magic-gateway/
├── main.go                    # Punto di ingresso principale del programma
├── .env                       # File di configurazione delle variabili d'ambiente
├── README.md                  # Documentazione del progetto
├── deploy.sh                  # Script di distribuzione multi-ambiente
├── docker-compose.yml         # Configurazione Docker Compose
├── Dockerfile                 # File di costruzione Docker
├── config/                    # Directory di configurazione multi-ambiente
│   ├── test/                  # Configurazione ambiente di test
│   ├── pre/                   # Configurazione ambiente pre-release
│   └── prod/                  # Configurazione ambiente produzione
├── docs/                      # Directory documentazione
│   └── multi-environment-deployment.md # Guida dettagliata distribuzione multi-ambiente
├── tests/                     # Directory test unitari e funzionali
│   ├── auth_test_client.go    # Client di test interfaccia autenticazione
│   ├── auth_key_test.go       # Test validazione API Key
│   └── test_api_key.go        # Test funzionalità API Key
└── test_client/               # Strumenti client di test
    └── test_client.go         # Client di test generico
```

## 🏁 Avvio Rapido

### 📋 Prerequisiti

- Go 1.18+ (per costruzione locale)
- Docker & Docker Compose (per distribuzione containerizzata)

### 🚀 Avvio con Script

```bash
# Rendere eseguibile lo script di avvio del servizio
chmod +x start.sh

# Avviare il servizio
./start.sh
```

### 🐳 Avvio con Docker Compose

```bash
# Avviare il servizio
docker-compose up -d

# Visualizzare i log
docker-compose logs -f
```

### 🌍 Distribuzione Multi-Ambiente

Il gateway API supporta tre ambienti indipendenti: test, pre-release e produzione, ciascuno con configurazioni e porte diverse:

```bash
# Prima assicurarsi che lo script di distribuzione sia eseguibile
chmod +x deploy.sh

# Avviare ambiente di test (porta 8001)
./deploy.sh test start

# Avviare ambiente pre-release (porta 8002)
./deploy.sh pre start

# Avviare ambiente produzione (porta 8003)
./deploy.sh prod start

# Avviare tutti gli ambienti contemporaneamente
./deploy.sh all start

# Visualizzare log dell'ambiente specifico
./deploy.sh test logs

# Verificare stato dell'ambiente
./deploy.sh pre status

# Fermare ambiente specifico
./deploy.sh prod stop

# Riavviare ambiente specifico
./deploy.sh test restart
```

Lo script di distribuzione crea automaticamente directory e file di configurazione per ciascun ambiente. Le configurazioni di ciascun ambiente sono memorizzate nel file `config/<ambiente>/.env`, che può essere modificato secondo necessità.

**Porte di accesso ambiente:**
- Ambiente test: http://localhost:8001
- Ambiente pre-release: http://localhost:8002
- Ambiente produzione: http://localhost:8003

Per informazioni più dettagliate sulla distribuzione multi-ambiente, fare riferimento alla [Guida alla Distribuzione Multi-Ambiente](docs/multi-environment-deployment.md).

## ⚙️ Spiegazione Configurazione

### 🔧 Variabili d'Ambiente

Nel file `.env` configurare le seguenti variabili d'ambiente:

```
# Configurazioni Generali
JWT_SECRET=your-secret-key-change-me
API_GATEWAY_VERSION=1.0.0
DEFAULT_API_URL=https://api.default-service.com
MAGIC_GATEWAY_API_KEY=your-gateway-api-key-here

# Configurazioni Servizio OpenAI
OPENAI_API_KEY=sk-xxxx
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4

# Configurazioni Servizio Magic
MAGIC_API_KEY=xxx
MAGIC_API_BASE_URL=https://api.magic.com/v1
MAGIC_MODEL=gpt-4o-global

# Configurazioni Servizio DeepSeek
DEEPSEEK_API_KEY=xxxxx
DEEPSEEK_API_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-coder

# Configurazioni Servizio Azure OpenAI
AZURE_OPENAI_EMBEDDING_API_KEY=xxxx
AZURE_OPENAI_EMBEDDING_ENDPOINT=https://example.openai.azure.com/
AZURE_OPENAI_EMBEDDING_MODEL=text-embedding-3-large
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=example-text-embedding
AZURE_OPENAI_EMBEDDING_API_VERSION=2023-05-15
```

**⚠️ Importante:** `MAGIC_GATEWAY_API_KEY` è una credenziale di sicurezza chiave, utilizzata solo per l'autenticazione dell'interfaccia `/auth`. Solo quando si ottiene il token è necessario fornire questa chiave API, le altre richieste dopo aver ottenuto il token utilizzano il token ottenuto per l'autenticazione e non necessitano più di fornire questa chiave API.

### 📦 Variabili d'Ambiente Container

Nel container, utilizzare gli stessi nomi di variabili d'ambiente, ma senza valori effettivi. Ad esempio nel file `.env` del container:

```
OPENAI_API_KEY="OPENAI_API_KEY"
OPENAI_API_BASE_URL="OPENAI_API_BASE_URL"
OPENAI_MODEL="OPENAI_MODEL"

MAGIC_API_KEY="MAGIC_API_KEY"
MAGIC_API_BASE_URL="MAGIC_API_BASE_URL"
MAGIC_MODEL="MAGIC_MODEL"
```

## 📖 Spiegazione Utilizzo API

### 1. 🏷️ Ottenere Token Temporaneo

**⚠️ Suggerimento Importante:**
1. Le richieste per ottenere token temporaneo possono essere effettuate **solo** localmente dall'host (localhost/127.0.0.1), non possono essere effettuate dai container. Questo è progettato per motivi di sicurezza.
2. Quando si ottiene il token, **è necessario** fornire l'header di richiesta `X-Gateway-API-Key` valido, il cui valore deve corrispondere a `MAGIC_GATEWAY_API_KEY` nelle variabili d'ambiente.

```bash
curl -X POST http://localhost:8000/auth \
  -H "magic-user-id: your-user-id" \
  -H "magic-organization-code: your-organization-code" \
  -H "X-Gateway-API-Key: your-gateway-api-key-here"
```

Esempio risposta:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "header": "Magic-Authorization",
  "example": "Magic-Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Il token temporaneo ora è **permanentemente valido**, senza limite di tempo di scadenza. È sufficiente ottenerlo una volta e può essere utilizzato a lungo termine. Durante l'esecuzione del container, dovrebbe essere iniettato dalle variabili d'ambiente dell'host nel container al momento dell'avvio. Si noti di utilizzare l'header `Magic-Authorization` invece del `Authorization` standard.

### 2. 🔍 Query Variabili d'Ambiente Disponibili

```bash
# Ottenere tutti i nomi delle variabili d'ambiente consentite
curl http://host.docker.internal:8000/env \
  -H "Magic-Authorization: Bearer YOUR_TOKEN"

# Verificare se una variabile d'ambiente specifica è disponibile
curl "http://host.docker.internal:8000/env?vars=OPENAI_API_KEY,OPENAI_MODEL" \
  -H "Magic-Authorization: Bearer YOUR_TOKEN"
```

Esempio risposta:
```json
{
  "available_vars": ["OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_API_BASE_URL", "MAGIC_API_KEY", "MAGIC_MODEL", "API_GATEWAY_VERSION"],
  "message": "Non è consentito ottenere direttamente i valori delle variabili d'ambiente, utilizzare il proxy API per utilizzare queste variabili"
}
```

### 3. 🔗 Query Servizi Disponibili

```bash
curl http://localhost:8000/services \
  -H "Magic-Authorization: Bearer YOUR_TOKEN"
```

Esempio risposta:
```json
{
  "available_services": [
    {
      "name": "OPENAI",
      "base_url": "api.openai.com",
      "default_model": "gpt-4"
    },
    {
      "name": "MAGIC",
      "base_url": "api.magic.com",
      "default_model": "gpt-4o-global"
    },
    {
      "name": "DEEPSEEK",
      "base_url": "api.deepseek.com",
      "default_model": "deepseek-coder"
    }
  ],
  "message": "È possibile utilizzare il proxy API per utilizzare questi servizi, formato: /{service}/path o utilizzare riferimenti env:"
}
```

### 4. 🔄 Utilizzo Proxy API e Sostituzione Variabili d'Ambiente

Esistono molteplici modi per chiamare diversi servizi:

#### 📍 Metodo 1: Accesso diretto tramite nome variabile d'ambiente (consigliato)

```bash
# Accesso diretto tramite nome variabile d'ambiente
curl -X POST http://host.docker.internal:8000/OPENAI_API_BASE_URL/v1/chat/completions \
  -H "Magic-Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'

# È anche possibile utilizzare direttamente il nome della variabile d'ambiente come valore (quando la stringa corrisponde completamente)
curl -X POST http://host.docker.internal:8000/OPENAI_API_BASE_URL/v1/chat/completions \
  -H "Magic-Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "OPENAI_MODEL",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'

# Utilizzo servizio Magic
curl -X POST http://host.docker.internal:8000/MAGIC_API_BASE_URL/v1/chat/completions \
  -H "Magic-Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MAGIC_MODEL",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

#### 📍 Metodo 2: Accesso tramite nome servizio

```bash
# Chiamata servizio OpenAI
curl -X POST http://host.docker.internal:8000/openai/v1/chat/completions \
  -H "Magic-Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "env:OPENAI_MODEL",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'

# Chiamata servizio Magic
curl -X POST http://host.docker.internal:8000/magic/v1/chat/completions \
  -H "Magic-Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "env:MAGIC_MODEL",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

#### 📍 Metodo 3: Utilizzo parametri query per specificare servizio

```bash
curl -X POST "http://host.docker.internal:8000/v1/chat/completions?service=deepseek" \
  -H "Magic-Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "env:DEEPSEEK_MODEL",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

#### 📍 Metodo 4: Utilizzo riferimenti variabili d'ambiente

```bash
curl -X POST http://host.docker.internal:8000/v1/chat/completions \
  -H "Magic-Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "env:OPENAI_MODEL",
    "api_base": "${OPENAI_API_BASE_URL}",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

## 🐳 Integrazione Container Docker

Poiché esistono limitazioni di sicurezza nei container Docker, non è possibile ottenere direttamente token temporanei. Seguire i seguenti passaggi per ottenere il token dall'host e iniettarli nel container:

### 1. 🏠 Ottenere Token Temporaneo dall'Host

#### 🔸 Modalità Ambiente Singolo

```bash
# Eseguire sull'host
USER_ID="your-user-id"
GATEWAY_API_KEY="your-gateway-api-key"

# Ottenere token temporaneo (può essere eseguito solo localmente)
TOKEN=$(curl -s -X POST "http://localhost:8000/auth" \
  -H "X-USER-ID: $USER_ID" \
  -H "X-Gateway-API-Key: $GATEWAY_API_KEY" | jq -r '.token')

echo "Token ottenuto: $TOKEN"
```

#### 🔸 Modalità Multi-Ambiente

```bash
# Eseguire sull'host - specificare ambiente (test, pre, prod)
ENV="test"  # Valori possibili: test, pre, prod
USER_ID="your-user-id"

# Selezionare porta e chiave API in base all'ambiente
case $ENV in
  test)
    PORT=8001
    GATEWAY_API_KEY="test-gateway-api-key"
    ;;
  pre)
    PORT=8002
    GATEWAY_API_KEY="pre-gateway-api-key"
    ;;
  prod)
    PORT=8003
    GATEWAY_API_KEY="prod-gateway-api-key"
    ;;
esac

# Ottenere token temporaneo dell'ambiente specificato
TOKEN=$(curl -s -X POST "http://localhost:$PORT/auth" \
  -H "X-USER-ID: $USER_ID" \
  -H "X-Gateway-API-Key: $GATEWAY_API_KEY" | jq -r '.token')

echo "Token $ENV ottenuto: $TOKEN"
```

### 2. 🚀 Avvio Container con Iniezione Token

#### 🔸 Modalità Ambiente Singolo

```bash
# Utilizzare il token ottenuto per avviare il container
docker run -e API_TOKEN="$TOKEN" \
  -e API_GATEWAY_URL="http://host.docker.internal:8000" \
  your-image
```

#### 🔸 Modalità Multi-Ambiente

```bash
# Utilizzare il token ottenuto per avviare il container, specificando l'ambiente
docker run -e API_TOKEN="$TOKEN" \
  -e API_GATEWAY_URL="http://host.docker.internal:$PORT" \
  -e API_GATEWAY_ENV="$ENV" \
  your-image
```

### 3. 🔧 Utilizzo Token Iniettato nel Container

```bash
# L'applicazione nel container può ottenere il token dalle variabili d'ambiente
TOKEN=$API_TOKEN
GATEWAY_URL=$API_GATEWAY_URL

# Query servizi disponibili
curl -s "$GATEWAY_URL/services" \
  -H "Magic-Authorization: Bearer $TOKEN"
```

### 4. 🐳 Configurazione Multi-Ambiente con Docker Compose

È possibile configurare i container dell'applicazione nel file docker-compose.yml per connettersi al gateway API di un ambiente specifico:

```yaml
version: '3'

services:
  your-app:
    image: your-app-image
    environment:
      - API_TOKEN=${API_TOKEN}
      - API_GATEWAY_URL=http://host.docker.internal:${PORT:-8000}
      - API_GATEWAY_ENV=${ENV:-dev}
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

Poi avviare il container utilizzando le variabili d'ambiente:

```bash
# Iniettare variabili d'ambiente per avviare il container dell'applicazione
ENV=test PORT=8001 API_TOKEN=$TOKEN docker-compose up -d
```

## 🔒 Caratteristiche di Sicurezza

1. **🛡️ Protezione Variabili d'Ambiente**: I container non possono ottenere direttamente i valori delle variabili d'ambiente dell'host, possono solo utilizzarli indirettamente tramite richieste proxy API
2. **🔄 Sostituzione Variabili d'Ambiente**: Il gateway API sostituisce automaticamente i riferimenti alle variabili d'ambiente nelle richieste, il container non ha bisogno di conoscere i valori effettivi
3. **🏷️ Header di Autenticazione Personalizzati**: Utilizza l'header Magic-Authorization per evitare conflitti con l'Authorization di altri servizi
4. **🔐 Isolamento Multi-Servizio**: Le chiavi API di ciascun servizio sono gestite dal gateway e non vengono divulgate ai container
5. **⏰ Token Temporanei**: Tutte le richieste richiedono un token di autenticazione valido con limite di tempo
6. **📦 Isolamento Container**: Ogni container utilizza un token indipendente e non può accedere ai token di altri container
7. **🔑 Chiave API Gateway**: L'ottenimento del token richiede una chiave API del gateway valida (`X-Gateway-API-Key`), aggiungendo un ulteriore livello di sicurezza

## ⚡ Confronto Prestazioni

Rispetto alla versione Python, la versione Go del gateway API ha i seguenti vantaggi prestazionali:

1. **💾 Minor Occupazione Memoria**: La versione Go generalmente occupa meno memoria rispetto alla versione Python
2. **🚀 Maggiore Capacità Elaborazione Concorrente**: Il modello di concorrenza di Go gli permette di gestire più efficacemente un gran numero di richieste
3. **⚡ Tempo di Avvio Più Rapido**: Go viene compilato in un singolo file eseguibile, con tempi di avvio più rapidi
4. **🔥 Latenza Ridotta**: La latenza di elaborazione delle richieste è significativamente ridotta

## 🏗️ Istruzioni di Costruzione

Se è necessario costruire manualmente:

```bash
# Ottenere dipendenze
go mod tidy

# Costruire file eseguibile
go build -o api-gateway
```

## 🛡️ Suggerimenti di Sicurezza

1. Cambiare `JWT_SECRET` in ambiente di produzione
2. Aggiungere un livello proxy HTTPS quando necessario
3. Limitare i container autorizzati ad accedere
4. Ruotare regolarmente le chiavi API

## 🔄 Funzionalità Sostituzione Variabili d'Ambiente

Il gateway API fornisce una potente funzionalità di sostituzione delle variabili d'ambiente che può sostituire i riferimenti alle variabili d'ambiente in diverse posizioni:

1. **📝 Sostituzione Corpo Richiesta** - Sostituisce i riferimenti alle variabili d'ambiente nel corpo JSON della richiesta nei seguenti formati:
   - Corrispondenza completa nome variabile d'ambiente: `"model": "OPENAI_MODEL"`
   - Prefisso `env:`: `"model": "env:OPENAI_MODEL"`
   - Formato `${VAR}`: `"url": "https://example.com/${SERVICE_URL}"`
   - Formato `$VAR`: `"key": "$OPENAI_API_KEY"`

2. **🏷️ Sostituzione Header Richiesta** - Sostituisce i riferimenti alle variabili d'ambiente negli header personalizzati della richiesta

3. **🛤️ Sostituzione Percorso URL** - Utilizza le variabili d'ambiente come prefisso del percorso URL: `/OPENAI_API_BASE_URL/v1/chat/completions`

Questo permette ai container di utilizzare in sicurezza le variabili d'ambiente senza conoscerne i valori effettivi. Il gateway API rileva e sostituisce automaticamente i riferimenti alle variabili d'ambiente nelle richieste, e tutte le sostituzioni vengono completate lato proxy, garantendo che le informazioni sensibili non vengano esposte ai container.

---

# Go 版 API 网关服务

这是一个用于 Docker 容器的高性能 API 网关服务，使用 Go 语言实现，可以安全地管理环境变量并提供临时访问令牌。

注意事项：该网关仅支持替换header内容和url的域名, 不支持替换body 的内容

## 功能特点

- **高性能**：使用 Go 语言实现，相比 Python 版本有显著的性能提升
- **认证服务**：为容器生成临时访问令牌
- **环境变量保护**：容器不能直接获取环境变量值，只能通过API代理间接使用
- **多服务支持**：可同时支持多个API服务（如OpenAI、DeepSeek、Magic等）
- **环境变量名称路由**：通过环境变量名称直接访问对应的服务
- **API 代理**：自动替换请求中的环境变量引用
- **支持多种环境变量引用格式**：`env:VAR`、`${VAR}`、`$VAR`、`OPENAI_*` 等
- **多环境部署**：支持测试(test)、预发布(pre)和生产(production)三套环境独立部署

## 项目结构

```
magic-gateway/
├── main.go            # 主程序入口
├── .env               # 环境变量配置文件
├── README.md          # 项目说明文档
├── deploy.sh          # 多环境部署脚本
├── docker-compose.yml # Docker编排配置
├── Dockerfile         # Docker构建文件
├── config/            # 多环境配置目录
│   ├── test/          # 测试环境配置
│   ├── pre/           # 预发布环境配置
│   └── prod/          # 生产环境配置
├── docs/              # 文档目录
│   └── multi-environment-deployment.md # 多环境部署详细说明
├── tests/             # 单元测试和功能测试目录
│   ├── auth_test_client.go  # 认证接口测试客户端
│   ├── auth_key_test.go     # API Key 验证测试
│   └── test_api_key.go      # API Key 功能测试
└── test_client/       # 测试客户端工具
    └── test_client.go # 通用测试客户端
```

## 快速开始

### 依赖条件

- Go 1.18+ (用于本地构建)
- Docker & Docker Compose (用于容器化部署)

### 使用脚本启动

```bash
# 使服务启动脚本可执行
chmod +x start.sh

# 启动服务
./start.sh
```

### 使用 Docker Compose

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 多环境部署

API网关支持测试(test)、预发布(pre)和生产(production)三套环境的独立部署，每个环境使用不同的配置和端口：

```bash
# 首先确保部署脚本有执行权限
chmod +x deploy.sh

# 启动测试环境 (端口 8001)
./deploy.sh test start

# 启动预发布环境 (端口 8002)
./deploy.sh pre start

# 启动生产环境 (端口 8003)
./deploy.sh prod start

# 同时启动所有环境
./deploy.sh all start

# 查看指定环境日志
./deploy.sh test logs

# 检查环境状态
./deploy.sh pre status

# 停止指定环境
./deploy.sh prod stop

# 重启指定环境
./deploy.sh test restart
```

部署脚本会自动创建环境配置目录和文件。每个环境的配置存放在 `config/<环境>/.env` 文件中，可以根据需要进行修改。

环境访问端口:
- 测试环境: http://localhost:8001
- 预发布环境: http://localhost:8002
- 生产环境: http://localhost:8003

更多关于多环境部署的详细信息，请参考 [多环境部署指南](docs/multi-environment-deployment.md)。

## 配置说明

### 环境变量

在 `.env` 文件中配置以下环境变量：

```
# 通用配置
JWT_SECRET=your-secret-key-change-me
API_GATEWAY_VERSION=1.0.0
DEFAULT_API_URL=https://api.default-service.com
MAGIC_GATEWAY_API_KEY=your-gateway-api-key-here

# OpenAI 服务配置
OPENAI_API_KEY=sk-xxxx
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4

# Magic 服务配置
MAGIC_API_KEY=xxx
MAGIC_API_BASE_URL=https://api.magic.com/v1
MAGIC_MODEL=gpt-4o-global

# DeepSeek 服务配置
DEEPSEEK_API_KEY=xxxxx
DEEPSEEK_API_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-coder

# Azure OpenAI 服务配置
AZURE_OPENAI_EMBEDDING_API_KEY=xxxx
AZURE_OPENAI_EMBEDDING_ENDPOINT=https://example.openai.azure.com/
AZURE_OPENAI_EMBEDDING_MODEL=text-embedding-3-large
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=example-text-embedding
AZURE_OPENAI_EMBEDDING_API_VERSION=2023-05-15
```

**重要：** `MAGIC_GATEWAY_API_KEY` 是一个关键安全凭证，仅用于 `/auth` 接口的认证。只有获取令牌时需要提供此API密钥，获取令牌后的其他请求都使用获得的令牌进行认证，不需要再提供此API密钥。

### 容器环境变量

在容器中，可以使用相同的环境变量名称，但不包含实际值。例如在容器的 `.env` 文件中：

```
OPENAI_API_KEY="OPENAI_API_KEY"
OPENAI_API_BASE_URL="OPENAI_API_BASE_URL"
OPENAI_MODEL="OPENAI_MODEL"

MAGIC_API_KEY="MAGIC_API_KEY"
MAGIC_API_BASE_URL="MAGIC_API_BASE_URL"
MAGIC_MODEL="MAGIC_MODEL"
```

## API 使用说明

### 1. 获取临时令牌

**重要提示：**
1. 获取临时令牌的请求**只能**从宿主机本地（localhost/127.0.0.1）发起，容器内无法直接获取令牌。这是出于安全考虑设计的。
2. 获取令牌时**必须**提供有效的 `X-Gateway-API-Key` 请求头，其值必须与环境变量中的 `MAGIC_GATEWAY_API_KEY` 匹配。

```bash
curl -X POST http://localhost:8000/auth \
  -H "magic-user-id: your-user-id" \
  -H "magic-organization-code: your-organization-code" \
  -H "X-Gateway-API-Key: your-gateway-api-key-here"
```

响应示例：
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "header": "Magic-Authorization",
  "example": "Magic-Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

临时令牌现在**永久有效**，没有过期时间限制。你只需获取一次令牌，可以长期使用。在容器运行时，应该在启动容器时将宿主机获取的令牌通过环境变量注入到容器中。请注意使用`Magic-Authorization`头部而不是标准的`Authorization`头部发送请求。

### 2. 查询可用环境变量

```bash
# 获取所有允许的环境变量名称
curl  http://host.docker.internal:8000/env \
  -H "Magic-Authorization: Bearer YOUR_TOKEN"

# 查询特定环境变量是否可用
curl "http://host.docker.internal:8000/env?vars=OPENAI_API_KEY,OPENAI_MODEL" \
  -H "Magic-Authorization: Bearer YOUR_TOKEN"
```

响应示例：
```json
{
  "available_vars": ["OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_API_BASE_URL", "MAGIC_API_KEY", "MAGIC_MODEL", "API_GATEWAY_VERSION"],
  "message": "不允许直接获取环境变量值，请通过API代理请求使用这些变量"
}
```

### 3. 查询可用服务

```bash
curl http://localhost:8000/services \
  -H "Magic-Authorization: Bearer YOUR_TOKEN"
```

响应示例：
```json
{
  "available_services": [
    {
      "name": "OPENAI",
      "base_url": "api.openai.com",
      "default_model": "gpt-4"
    },
    {
      "name": "MAGIC",
      "base_url": "api.magic.com",
      "default_model": "gpt-4o-global"
    },
    {
      "name": "DEEPSEEK",
      "base_url": "api.deepseek.com",
      "default_model": "deepseek-coder"
    }
  ],
  "message": "可以通过API代理请求使用这些服务，使用格式: /{service}/path 或 使用 env: 引用"
}
```

### 4. 使用 API 代理并替换环境变量

有多种方式可以调用不同的服务：

#### 方式1：直接使用环境变量名称访问（推荐）

```bash
# 直接通过环境变量名称访问
curl -X POST http://host.docker.internal:8000/OPENAI_API_BASE_URL/v1/chat/completions \
  -H "Magic-Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'

# 也可以直接使用环境变量名称作为值（当字符串完全匹配时）
curl -X POST http://host.docker.internal:8000/OPENAI_API_BASE_URL/v1/chat/completions \
  -H "Magic-Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "OPENAI_MODEL",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'

# 使用 Magic 服务
curl -X POST http://host.docker.internal:8000/MAGIC_API_BASE_URL/v1/chat/completions \
  -H "Magic-Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MAGIC_MODEL",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

#### 方式2：通过服务名称访问

```bash
# 调用 OpenAI 服务
curl -X POST http://host.docker.internal:8000/openai/v1/chat/completions \
  -H "Magic-Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "env:OPENAI_MODEL",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'

# 调用 Magic 服务
curl -X POST http://host.docker.internal:8000/magic/v1/chat/completions \
  -H "Magic-Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "env:MAGIC_MODEL",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

#### 方式3：使用查询参数指定服务

```bash
curl -X POST "http://host.docker.internal:8000/v1/chat/completions?service=deepseek" \
  -H "Magic-Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "env:DEEPSEEK_MODEL",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

#### 方式4：使用环境变量引用

```bash
curl -X POST http://host.docker.internal:8000/v1/chat/completions \
  -H "Magic-Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "env:OPENAI_MODEL",
    "api_base": "${OPENAI_API_BASE_URL}",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

## Docker 容器集成

在 Docker 容器中，由于安全限制，无法直接获取临时令牌。请按照以下步骤在宿主机上获取令牌，然后将其注入到容器中：

### 1. 在宿主机上获取临时令牌

#### 单环境模式

```bash
# 在宿主机上执行
USER_ID="your-user-id"
GATEWAY_API_KEY="your-gateway-api-key"

# 获取临时令牌（只能在本地执行）
TOKEN=$(curl -s -X POST "http://localhost:8000/auth" \
  -H "X-USER-ID: $USER_ID" \
  -H "X-Gateway-API-Key: $GATEWAY_API_KEY" | jq -r '.token')

echo "获取到的令牌: $TOKEN"
```

#### 多环境模式

```bash
# 在宿主机上执行 - 指定环境(test, pre, prod)
ENV="test"  # 可选值: test, pre, prod
USER_ID="your-user-id"

# 根据环境选择端口和API密钥
case $ENV in
  test)
    PORT=8001
    GATEWAY_API_KEY="test-gateway-api-key"
    ;;
  pre)
    PORT=8002
    GATEWAY_API_KEY="pre-gateway-api-key"
    ;;
  prod)
    PORT=8003
    GATEWAY_API_KEY="prod-gateway-api-key"
    ;;
esac

# 获取指定环境的临时令牌
TOKEN=$(curl -s -X POST "http://localhost:$PORT/auth" \
  -H "X-USER-ID: $USER_ID" \
  -H "X-Gateway-API-Key: $GATEWAY_API_KEY" | jq -r '.token')

echo "获取到 $ENV 环境的令牌: $TOKEN"
```

### 2. 启动容器时注入令牌

#### 单环境模式

```bash
# 使用获取到的令牌启动容器
docker run -e API_TOKEN="$TOKEN" \
  -e API_GATEWAY_URL="http://host.docker.internal:8000" \
  your-image
```

#### 多环境模式

```bash
# 使用获取到的令牌启动容器，指定环境
docker run -e API_TOKEN="$TOKEN" \
  -e API_GATEWAY_URL="http://host.docker.internal:$PORT" \
  -e API_GATEWAY_ENV="$ENV" \
  your-image
```

### 3. 在容器内使用注入的令牌

```bash
# 容器内的应用程序可以从环境变量中获取令牌
TOKEN=$API_TOKEN
GATEWAY_URL=$API_GATEWAY_URL

# 查询可用服务
curl -s "$GATEWAY_URL/services" \
  -H "Magic-Authorization: Bearer $TOKEN"
```

### 4. 使用Docker Compose配置多环境

可以在docker-compose.yml文件中配置应用容器以连接到特定环境的API网关：

```yaml
version: '3'

services:
  your-app:
    image: your-app-image
    environment:
      - API_TOKEN=${API_TOKEN}
      - API_GATEWAY_URL=http://host.docker.internal:${PORT:-8000}
      - API_GATEWAY_ENV=${ENV:-dev}
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

然后使用环境变量启动容器：

```bash
# 注入环境变量启动应用容器
ENV=test PORT=8001 API_TOKEN=$TOKEN docker-compose up -d
```

## 安全特性

1. **环境变量保护**：容器无法直接获取宿主机环境变量的值，只能通过API代理请求间接使用
2. **环境变量替换**：API网关自动替换请求中的环境变量引用，容器无需知道实际值
3. **自定义认证头**：使用Magic-Authorization头避免与其他服务的Authorization产生冲突
4. **多服务隔离**：各服务的API密钥由网关管理，不会泄露给容器
5. **临时令牌**：所有请求需要有效的认证令牌，令牌有时效限制
6. **容器隔离**：每个容器使用独立的令牌，无法访问其他容器的令牌
7. **网关API密钥**：获取令牌必须提供有效的网关API密钥（`X-Gateway-API-Key`），增加了额外的安全层

## 性能比较

与 Python 版本相比，Go 版本的 API 网关有以下性能优势：

1. **更低的内存占用**：Go 版本通常比 Python 版本占用更少的内存
2. **更高的并发处理能力**：Go 的并发模型使其能够更有效地处理大量请求
3. **更快的启动时间**：Go 编译为单一可执行文件，启动速度更快
4. **更低的延迟**：请求处理延迟明显降低

## 构建说明

如果需要手动构建：

```bash
# 获取依赖
go mod tidy

# 构建可执行文件
go build -o api-gateway
```

## 安全建议

1. 在生产环境中更改 `JWT_SECRET`
2. 在需要时添加 HTTPS 代理层
3. 限制允许访问的容器
4. 定期轮换 API 密钥

## 环境变量替换功能

API网关提供了强大的环境变量替换功能，可以在不同位置替换环境变量引用：

1. **请求体替换** - 在JSON请求体中替换以下格式的环境变量引用：
   - 完全匹配环境变量名：`"model": "OPENAI_MODEL"`
   - `env:`前缀：`"model": "env:OPENAI_MODEL"`
   - `${VAR}`格式：`"url": "https://example.com/${SERVICE_URL}"`
   - `$VAR`格式：`"key": "$OPENAI_API_KEY"`

2. **请求头替换** - 在自定义请求头中替换环境变量引用

3. **URL路径替换** - 使用环境变量作为URL路径前缀：`/OPENAI_API_BASE_URL/v1/chat/completions`

这使得容器可以安全地使用环境变量，而无需知道实际值。API网关会自动检测和替换请求中的环境变量引用，所有替换都在代理端完成，确保敏感信息不会暴露给容器。

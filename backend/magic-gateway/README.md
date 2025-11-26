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

#### 目标URL白名单配置

`MAGIC_GATEWAY_ALLOWED_TARGET_URLS` 用于配置允许访问的目标URL白名单规则。

**格式说明：**
- 使用 `|` 分隔多个规则
- 每个规则格式：`type:pattern@description`（`@description` 为可选）
- 规则类型：
  - `exact`: 精确URL匹配
  - `domain`: 域名及所有子域名
  - `prefix`: URL前缀匹配
  - `regex`: 正则表达式匹配

**示例：**
```bash
# 允许特定域名
MAGIC_GATEWAY_ALLOWED_TARGET_URLS=domain:example.com@示例服务|domain:openai.com@OpenAI API

# 混合规则
MAGIC_GATEWAY_ALLOWED_TARGET_URLS=domain:xxxx.cn@内部服务|prefix:https://api.github.com/@GitHub API
```

**安全特性：**
- 自动阻止内网IP（127.x, 10.x, 192.168.x等）
- 仅允许 http/https 协议
- 阻止常见的管理端口（22, 23, 25, 3306等）

#### 允许的内网IP配置

`MAGIC_GATEWAY_ALLOWED_TARGET_IP` 用于在多节点部署场景下，允许部分内网IP通过验证。

**格式说明：**
- 支持多种分隔符：逗号（`,`）、分号（`;`）、换行符（`\n`）、空格（` `）
- 支持单个IP地址和CIDR格式
- 支持IPv4和IPv6

**使用场景：**
- 单节点部署：允许特定内网服务
- 多节点部署：允许集群内各节点的IP段

**示例：**

```bash
# 单节点部署 - 允许特定IP和网段
MAGIC_GATEWAY_ALLOWED_TARGET_IP=192.168.1.1,10.0.0.0/8

# 多节点部署 - 逗号分隔（推荐）
MAGIC_GATEWAY_ALLOWED_TARGET_IP=10.0.1.0/24,10.0.2.0/24,10.0.3.0/24,192.168.1.0/24

# 多节点部署 - 换行符分隔（适合配置文件）
MAGIC_GATEWAY_ALLOWED_TARGET_IP="10.0.1.0/24
10.0.2.0/24
10.0.3.0/24
192.168.1.0/24"

# 混合格式
MAGIC_GATEWAY_ALLOWED_TARGET_IP=192.168.1.1,10.0.0.0/8;172.16.0.0/12 192.168.2.0/24

# 支持IPv6
MAGIC_GATEWAY_ALLOWED_TARGET_IP=10.0.0.0/8,2001:db8::/32,::1
```

**注意事项：**
- 如果不配置此变量，所有内网IP将被禁止访问
- 配置的IP会在私有IP检查之前进行白名单验证
- 系统会自动去重，避免重复的IP/CIDR规则
- 在调试模式下会显示详细的加载日志和统计信息

### 其他环境变量

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

# 环境变量配置说明

本文档详细说明 Magic 项目中使用的环境变量配置，为开发和部署提供参考。

## 概述

Magic 项目使用 `.env` 文件管理环境变量配置。在项目部署或开发时，您需要正确配置这些环境变量以确保系统正常运行。

## 配置文件

系统默认提供了 `.env.example` 示例配置文件，您可以通过以下命令复制并创建自己的配置：

```bash
cp .env.example .env
```

然后根据实际需要修改 `.env` 文件中的配置项。

## 配置分类

环境变量可分为以下几类：

### 1. 基础服务配置

#### 版本标签

```
# 服务版本标签
MAGIC_SERVICE_TAG=latest
MAGIC_WEB_TAG=latest

# 版本类型 (ENTERPRISE | COMMUNITY)
MAGIC_EDITION=COMMUNITY
```

#### Git 仓库配置

```
# Git Repository URL (默认使用 GitHub)
GIT_REPO_URL=git@github.com:dtyq
```

### 2. 数据库配置

#### MySQL 配置

```
# MySQL 配置
MYSQL_USER=magic
MYSQL_PASSWORD=magic123456
MYSQL_DATABASE=magic
MYSQL_DATA=/var/lib/mysql
MYSQL_MAX_CONNECTIONS=1000
MYSQL_SHARED_BUFFERS=128MB
MYSQL_WORK_MEM=4MB
MYSQL_MAINTENANCE_WORK_MEM=64MB
MYSQL_EFFECTIVE_CACHE_SIZE=4096MB

# 应用 MySQL 连接配置
DB_DRIVER=mysql
DB_HOST=db
DB_PORT=3306
DB_USERNAME=magic
DB_PASSWORD=magic123456
DB_DATABASE=magic
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_unicode_ci
DB_PREFIX=
```

#### Redis 配置

```
# Redis 配置
REDIS_HOST=redis
REDIS_AUTH=magic123456
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=magic123456
```

#### RabbitMQ 配置

```
# RabbitMQ 配置
AMQP_HOST=rabbitmq
AMQP_PORT=5672
AMQP_USER=admin
AMQP_PASSWORD=magic123456
AMQP_VHOST=magic-chat
```

#### OpenSearch 配置

```
# OpenSearch 配置
OPENSEARCH_DISCOVERY_TYPE=single-node
OPENSEARCH_BOOTSTRAP_MEMORY_LOCK=true
OPENSEARCH_JAVA_OPTS_MIN=512m
OPENSEARCH_JAVA_OPTS_MAX=1024m
OPENSEARCH_INITIAL_ADMIN_PASSWORD=Qazwsxedc!@#123
OPENSEARCH_MEMLOCK_SOFT=-1
OPENSEARCH_MEMLOCK_HARD=-1
OPENSEARCH_NOFILE_SOFT=65536
OPENSEARCH_NOFILE_HARD=65536
```

#### Qdrant 配置

```
# Qdrant 配置
QDRANT_API_KEY=magic123456
ODIN_QDRANT_BASE_URI=http://qdrant
ODIN_QDRANT_API_KEY=
```

### 3. 应用配置

#### 应用基础配置

```
APP_NAME=magic_service
APP_ENV=dev
APP_HOST=

MAGIC_API_DEFAULT_ACCESS_TOKEN=
MAGIC_PRIVILEGED_PASSWORD=

# 超级管理员权限配置
SUPER_WHITELISTS={"privilege_send_message":["13800000000","13900000000"]}
# 组织管理后台权限白名单
ORGANIZATION_WHITELISTS={}
```

#### 功能开关

```
# 启用消费者
ENABLE_CONSUME=true
# 启用聊天消息
ENABLE_CHAT_MESSAGE=true
# 启用聊天序列
ENABLE_CHAT_SEQ=true
# 启用 Magic 看门狗（本地开发可禁用）
ENABLE_MAGIC_WATCHDOG=false

# 通用开关
AZURE_OPENAI_GPT4O_ENABLED=false
DOUBAO_PRO_32K_ENABLED=false
DEEPSEEK_R1_ENABLED=false
DEEPSEEK_V3_ENABLED=false
DOUBAO_EMBEDDING_ENABLED=false
MISC_DMETA_EMBEDDING_ENABLED=false
```

### 4. AI 模型配置

#### Azure OpenAI 配置

```
# Azure OpenAI GPT-4
AZURE_OPENAI_4_API_KEY=
AZURE_OPENAI_4_API_BASE=
AZURE_OPENAI_4_API_VERSION=2023-08-01-preview
AZURE_OPENAI_4_DEPLOYMENT_NAME=

# Azure OpenAI GPT-3.5 Turbo
AZURE_OPENAI_35_TURBO_API_KEY=
AZURE_OPENAI_35_TURBO_API_BASE=
AZURE_OPENAI_35_TURBO_API_VERSION=2023-08-01-preview
AZURE_OPENAI_35_TURBO_DEPLOYMENT_NAME=

# AzureOpenAI GPT-4o
AZURE_OPENAI_4O_GLOBAL_MODEL=gpt-4o-global
AZURE_OPENAI_4O_GLOBAL_API_KEY=
AZURE_OPENAI_4O_GLOBAL_BASE_URL=
AZURE_OPENAI_4O_GLOBAL_API_VERSION=2024-10-21
AZURE_OPENAI_4O_GLOBAL_DEPLOYMENT_NAME=gpt-4o-global
```

#### 豆包模型配置

```
# 豆包 Pro 32k
DOUBAO_PRO_32K_ENDPOINT=doubao-1.5-pro-32k
DOUBAO_PRO_32K_API_KEY=
DOUBAO_PRO_32K_BASE_URL=https://ark.cn-beijing.volces.com

# 豆包 Embedding
DOUBAO_EMBEDDING_ENDPOINT=doubao-embedding-text-240715
DOUBAO_EMBEDDING_API_KEY=
DOUBAO_EMBEDDING_BASE_URL=https://ark.cn-beijing.volces.com
DOUBAO_EMBEDDING_VECTOR_SIZE=2048
```

#### DeepSeek 模型配置

```
# DeepSeek R1
DEEPSEEK_R1_ENDPOINT=deepseek-reasoner
DEEPSEEK_R1_API_KEY=
DEEPSEEK_R1_BASE_URL=https://api.deepseek.com

# DeepSeek V3
DEEPSEEK_V3_ENDPOINT=deepseek-chat
DEEPSEEK_V3_API_KEY=
DEEPSEEK_V3_BASE_URL=https://api.deepseek.com
```

#### 其他 AI 服务配置

```
# dmeta-embedding
MISC_DMETA_EMBEDDING_ENDPOINT=dmeta-embedding
MISC_DMETA_EMBEDDING_API_KEY=
MISC_DMETA_EMBEDDING_BASE_URL=
MISC_DMETA_EMBEDDING_VECTOR_SIZE=768

# HD 转换
MIRACLE_VISION_KEY=
MIRACLE_VISION_SECRET=
```

### 5. 外部服务配置

#### Google 搜索配置

```
# Google 搜索所需代理
HTTP_PROXY=
GOOGLE_SEARCH_API_KEY=
# 使用 Google 时，请指定搜索 cx (GOOGLE_SEARCH_ENGINE_ID)
GOOGLE_SEARCH_CX=
BACKEND=GOOGLE
RELATED_QUESTIONS=true
```

#### 应用凭证

```
# 应用凭证
APP_ID=
APP_SECRET=
APP_CODE=

# CODE 白名单
CODE_WHITE_ACCOUNT_ID=

# 默认 Magic 环境 ID
DEFAULT_MAGIC_ENVIRONMENT_ID=

# Magic 环境 ID
MAGIC_ENV_ID=1000
```


### 6. 文件存储配置

#### 文件驱动类型

```
# 文件驱动
FILE_DRIVER=local   # 可选值：local/oss/tos
```

#### 本地文件驱动配置

```
# 本地文件驱动配置
FILE_LOCAL_ROOT=    # 本地存储根目录，例如：/app/storage/files
FILE_LOCAL_READ_HOST=     # 文件读取域名，例如：https://example.com
FILE_LOCAL_WRITE_HOST=    # 文件上传域名，例如：https://upload.example.com
```

#### 阿里云存储配置

```
# 阿里云文件驱动配置 - 私有 
FILE_PRIVATE_ALIYUN_ACCESS_ID=      # 阿里云 AccessKey ID
FILE_PRIVATE_ALIYUN_ACCESS_SECRET=  # 阿里云 AccessKey Secret
FILE_PRIVATE_ALIYUN_BUCKET=         # OSS 存储桶名称
FILE_PRIVATE_ALIYUN_ENDPOINT=       # OSS 访问域名，例如：oss-cn-hangzhou.aliyuncs.com
FILE_PRIVATE_ALIYUN_ROLE_ARN=       # 可选，用于 STS 临时授权的角色 ARN

# 阿里云文件驱动配置 - 公有
FILE_PUBLIC_ALIYUN_ACCESS_ID=       # 阿里云 AccessKey ID
FILE_PUBLIC_ALIYUN_ACCESS_SECRET=   # 阿里云 AccessKey Secret
FILE_PUBLIC_ALIYUN_BUCKET=          # OSS 存储桶名称
FILE_PUBLIC_ALIYUN_ENDPOINT=        # OSS 访问域名
FILE_PUBLIC_ALIYUN_ROLE_ARN=        # 可选，用于 STS 临时授权的角色 ARN
```

#### 火山引擎存储配置

```
# 火山云文件驱动配置 - 私有
FILE_PRIVATE_TOS_REGION=     # TOS 地域，例如：cn-beijing
FILE_PRIVATE_TOS_ENDPOINT=   # TOS 访问域名
FILE_PRIVATE_TOS_AK=         # 火山引擎 AccessKey
FILE_PRIVATE_TOS_SK=         # 火山引擎 SecretKey
FILE_PRIVATE_TOS_BUCKET=     # TOS 存储桶名称
FILE_PRIVATE_TOS_TRN=        # 可选，用于 STS 临时授权的角色 ARN

# 火山云文件驱动配置 - 公有
FILE_PUBLIC_TOS_REGION=      # TOS 地域
FILE_PUBLIC_TOS_ENDPOINT=    # TOS 访问域名
FILE_PUBLIC_TOS_AK=          # 火山引擎 AccessKey
FILE_PUBLIC_TOS_SK=          # 火山引擎 SecretKey
FILE_PUBLIC_TOS_BUCKET=      # TOS 存储桶名称
FILE_PUBLIC_TOS_TRN=         # 可选，用于 STS 临时授权的角色 ARN
```

### 7. Web应用配置

#### 前端服务配置

```
# Web 应用配置
PORT=8080
MAGIC_SOCKET_BASE_URL=ws://localhost:9502
MAGIC_SERVICE_BASE_URL=http://localhost:9501
```

## 配置建议

1. **开发环境**：复制 `.env.example` 到 `.env`，根据本地环境调整配置
2. **测试环境**：使用与生产环境类似但资源较少的配置
3. **生产环境**：确保设置强密码，并使用更可靠的外部服务配置

## 安全建议

1. 不要将 `.env` 文件提交到代码仓库
2. 定期更换密码和API密钥
3. 使用最小权限原则配置外部服务访问权限
4. 在生产环境中使用密码管理系统或环境变量注入方式，而非直接编辑 `.env` 文件

## 文件驱动特别说明

详细的文件驱动配置和使用方法可参考[文件驱动使用说明](file-driver.md)。

## 初次部署注意事项

1. 首次部署时使用 `./bin/magic.sh start` 命令会自动复制 `.env.example` 到 `.env`
2. 如果使用云存储服务，需要执行文件系统初始化命令：`php bin/hyperf.php file:init`
3. 修改环境变量后需要重启服务以使变更生效

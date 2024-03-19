# Environment Variables Configuration Guide

This document provides detailed information about the environment variables used in the Magic project, serving as a reference for development and deployment.

## Overview

The Magic project uses the `.env` file to manage environment variable configurations. During project deployment or development, you need to correctly configure these environment variables to ensure the system operates normally.

## Configuration File

The system provides a default `.env.example` file. You can copy and create your own configuration using the following command:

```bash
cp .env.example .env
```

Then modify the configuration items in the `.env` file according to your actual needs.

## Configuration Categories

Environment variables can be classified into the following categories:

### 1. Basic Service Configuration

#### Version Tags

```
# Service version tags
MAGIC_SERVICE_TAG=latest
MAGIC_WEB_TAG=latest

# Version type (ENTERPRISE | COMMUNITY)
MAGIC_EDITION=COMMUNITY
```

#### Git Repository Configuration

```
# Git Repository URL (Default using GitHub)
GIT_REPO_URL=git@github.com:dtyq
```

### 2. Database Configuration

#### MySQL Configuration

```
# MySQL Configuration
MYSQL_USER=magic
MYSQL_PASSWORD=magic123456
MYSQL_DATABASE=magic
MYSQL_DATA=/var/lib/mysql
MYSQL_MAX_CONNECTIONS=1000
MYSQL_SHARED_BUFFERS=128MB
MYSQL_WORK_MEM=4MB
MYSQL_MAINTENANCE_WORK_MEM=64MB
MYSQL_EFFECTIVE_CACHE_SIZE=4096MB

# Application MySQL connection configuration
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

#### Redis Configuration

```
# Redis Configuration
REDIS_HOST=redis
REDIS_AUTH=magic123456
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=magic123456
```

#### RabbitMQ Configuration

```
# RabbitMQ Configuration
AMQP_HOST=rabbitmq
AMQP_PORT=5672
AMQP_USER=admin
AMQP_PASSWORD=magic123456
AMQP_VHOST=magic-chat
```

#### OpenSearch Configuration

```
# OpenSearch Configuration
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

#### Qdrant Configuration

```
# Qdrant Configuration
QDRANT_API_KEY=magic123456
ODIN_QDRANT_BASE_URI=http://qdrant
ODIN_QDRANT_API_KEY=
```

### 3. Application Configuration

#### Application Basic Configuration

```
APP_NAME=magic_service
APP_ENV=dev
APP_HOST=

MAGIC_API_DEFAULT_ACCESS_TOKEN=
MAGIC_PRIVILEGED_PASSWORD=

# Super admin permission configuration
SUPER_WHITELISTS={"privilege_send_message":["13800000000","13900000000"]}
# Organization management backend permission whitelist
ORGANIZATION_WHITELISTS={}
```

#### Feature Switches

```
# Enable consumer
ENABLE_CONSUME=true
# Enable chat messages
ENABLE_CHAT_MESSAGE=true
# Enable chat sequence
ENABLE_CHAT_SEQ=true
# Enable Magic Watchdog (can be disabled for local development)
ENABLE_MAGIC_WATCHDOG=false

# Common switches
AZURE_OPENAI_GPT4O_ENABLED=false
DOUBAO_PRO_32K_ENABLED=false
DEEPSEEK_R1_ENABLED=false
DEEPSEEK_V3_ENABLED=false
DOUBAO_EMBEDDING_ENABLED=false
MISC_DMETA_EMBEDDING_ENABLED=false
```

### 4. AI Model Configuration

#### Azure OpenAI Configuration

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

#### Doubao Model Configuration

```
# Doubao Pro 32k
DOUBAO_PRO_32K_ENDPOINT=doubao-1.5-pro-32k
DOUBAO_PRO_32K_API_KEY=
DOUBAO_PRO_32K_BASE_URL=https://ark.cn-beijing.volces.com

# Doubao Embedding
DOUBAO_EMBEDDING_ENDPOINT=doubao-embedding-text-240715
DOUBAO_EMBEDDING_API_KEY=
DOUBAO_EMBEDDING_BASE_URL=https://ark.cn-beijing.volces.com
DOUBAO_EMBEDDING_VECTOR_SIZE=2048
```

#### DeepSeek Model Configuration

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

#### Other AI Service Configurations

```
# dmeta-embedding
MISC_DMETA_EMBEDDING_ENDPOINT=dmeta-embedding
MISC_DMETA_EMBEDDING_API_KEY=
MISC_DMETA_EMBEDDING_BASE_URL=
MISC_DMETA_EMBEDDING_VECTOR_SIZE=768

# HD Conversion
MIRACLE_VISION_KEY=
MIRACLE_VISION_SECRET=
```

### 5. External Service Configuration

#### Google Search Configuration

```
# Proxy required for Google search
HTTP_PROXY=
GOOGLE_SEARCH_API_KEY=
# When using Google, please specify the search cx (GOOGLE_SEARCH_ENGINE_ID)
GOOGLE_SEARCH_CX=
BACKEND=GOOGLE
RELATED_QUESTIONS=true
```

#### Application Credentials

```
# Application credentials
APP_ID=
APP_SECRET=
APP_CODE=

# CODE whitelist
CODE_WHITE_ACCOUNT_ID=

# Default magic_environment ID
DEFAULT_MAGIC_ENVIRONMENT_ID=

# Magic environment ID
MAGIC_ENV_ID=1000
```

### 6. File Storage Configuration

#### File Driver Type

```
# File Driver
FILE_DRIVER=local   # Available options: local, oss, tos
```

#### Local File Driver Configuration

```
# Local File Driver Configuration
FILE_LOCAL_ROOT=    # Local storage root directory, e.g.: /app/storage/files
FILE_LOCAL_READ_HOST=     # File read domain, e.g.: https://example.com
FILE_LOCAL_WRITE_HOST=    # File upload domain, e.g.: https://upload.example.com
```

#### Aliyun OSS Storage Configuration

```
# Aliyun OSS File Driver Configuration - Private
FILE_PRIVATE_ALIYUN_ACCESS_ID=      # Aliyun AccessKey ID
FILE_PRIVATE_ALIYUN_ACCESS_SECRET=  # Aliyun AccessKey Secret
FILE_PRIVATE_ALIYUN_BUCKET=         # OSS bucket name
FILE_PRIVATE_ALIYUN_ENDPOINT=       # OSS access domain, e.g.: oss-cn-hangzhou.aliyuncs.com
FILE_PRIVATE_ALIYUN_ROLE_ARN=       # Optional, for STS temporary authorization role ARN

# Aliyun OSS File Driver Configuration - Public
FILE_PUBLIC_ALIYUN_ACCESS_ID=       # Aliyun AccessKey ID
FILE_PUBLIC_ALIYUN_ACCESS_SECRET=   # Aliyun AccessKey Secret
FILE_PUBLIC_ALIYUN_BUCKET=          # OSS bucket name
FILE_PUBLIC_ALIYUN_ENDPOINT=        # OSS access domain
FILE_PUBLIC_ALIYUN_ROLE_ARN=        # Optional, for STS temporary authorization role ARN
```

#### Volc Engine TOS Storage Configuration

```
# Volc Engine TOS File Driver Configuration - Private
FILE_PRIVATE_TOS_REGION=     # TOS region, e.g.: cn-beijing
FILE_PRIVATE_TOS_ENDPOINT=   # TOS access domain
FILE_PRIVATE_TOS_AK=         # Volc Engine AccessKey
FILE_PRIVATE_TOS_SK=         # Volc Engine SecretKey
FILE_PRIVATE_TOS_BUCKET=     # TOS bucket name
FILE_PRIVATE_TOS_TRN=        # Optional, for STS temporary authorization role ARN

# Volc Engine TOS File Driver Configuration - Public
FILE_PUBLIC_TOS_REGION=      # TOS region
FILE_PUBLIC_TOS_ENDPOINT=    # TOS access domain
FILE_PUBLIC_TOS_AK=          # Volc Engine AccessKey
FILE_PUBLIC_TOS_SK=          # Volc Engine SecretKey
FILE_PUBLIC_TOS_BUCKET=      # TOS bucket name
FILE_PUBLIC_TOS_TRN=         # Optional, for STS temporary authorization role ARN
```

### 7. Web Application Configuration

#### Frontend Service Configuration

```
# Web application configuration
PORT=8080
MAGIC_SOCKET_BASE_URL=ws://localhost:9502
MAGIC_SERVICE_BASE_URL=http://localhost:9501
```

## Configuration Recommendations

1. **Development Environment**: Copy `.env.example` to `.env`, adjust configuration according to your local environment
2. **Testing Environment**: Use configurations similar to production but with fewer resources
3. **Production Environment**: Ensure strong passwords are set and use more reliable external service configurations

## Security Recommendations

1. Do not commit the `.env` file to the code repository
2. Regularly change passwords and API keys
3. Use the principle of least privilege to configure external service access permissions
4. In production environments, use password management systems or environment variable injection methods rather than directly editing the `.env` file

## Special Notes on File Driver

For detailed file driver configuration and usage methods, please refer to [File Driver Usage Guide](./file-driver.md).

## First Deployment Notes

1. When deploying for the first time, using the `./bin/magic.sh start` command will automatically copy `.env.example` to `.env`
2. If using cloud storage services, you need to execute the file system initialization command: `php bin/hyperf.php file:init`
3. After modifying environment variables, you need to restart the service for the changes to take effect

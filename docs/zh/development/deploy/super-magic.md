# 超级麦吉（Super Magic）安装与使用教程

本教程将指导您如何安装、配置和使用超级麦吉（Super Magic）服务。

## 前提条件

在开始之前，请确保您的系统已安装以下软件：

- Docker
- Docker Compose
- Git

## 安装步骤

### 1. 获取项目代码

```bash
git clone https://github.com/dtyq/magic.git
cd magic
```

### 2. 配置环境文件

Super Magic 服务依赖于几个关键的配置文件：

#### 2.1 创建 Super Magic 配置文件

```bash
cp config/.env_super_magic.example config/.env_super_magic
```
配置超级麦吉 环境变量,必须配置任意一种支持openai 格式的大模型环境变量, 才可正常使用

编辑 `config/.env_super_magic` 文件，配置必要的环境变量：

```bash
vim config/.env_super_magic
```

### 3. 运行安装脚本

使用项目提供的 `magic.sh` 脚本进行安装：

```bash
./bin/magic.sh
```

初次运行时，安装脚本会执行以下操作：

1. 检测系统语言，并允许您选择界面语言（中文或英文）
2. 检查 Docker 和 Docker Compose 是否已安装并运行
3. 检测系统架构并设置合适的平台参数
4. 询问部署方式（本地电脑部署或远程服务器部署）
5. 如选择远程服务器部署，会检测公网 IP 并更新相关配置
6. 询问是否安装 Super Magic 服务

在提示"是否安装Super Magic服务?"时，选择"1"以安装 Super Magic 服务。

## 使用指南

### 启动服务

#### 前台启动所有服务

```bash
./bin/magic.sh start
```

#### 后台启动所有服务

```bash
./bin/magic.sh daemon
```

#### 仅启动 Super Magic 服务（前台）

```bash
./bin/magic.sh super-magic
```

#### 仅启动 Super Magic 服务（后台）

```bash
./bin/magic.sh super-magic-daemon
```

### 管理服务

#### 查看服务状态

```bash
./bin/magic.sh status
```

#### 查看服务日志

```bash
./bin/magic.sh logs
```

#### 重启服务

```bash
./bin/magic.sh restart
```

#### 停止服务

```bash
./bin/magic.sh stop
```

## 配置说明

### Super Magic 环境配置

`config/.env_super_magic` 文件包含以下重要配置项：

#### 基础配置
- `APP_ENV`: 应用环境设置，可选值如 "test"、"production" 等
- `LOG_LEVEL`: 日志级别，如 INFO、DEBUG、ERROR 等
- `STORAGE_PLATFORM`: 存储平台，默认为 "local"

#### 工具调用配置
- `AGENT_ENABLE_MULTI_TOOL_CALLS`: 是否启用多工具调用（True/False）
- `AGENT_ENABLE_PARALLEL_TOOL_CALLS`: 是否启用并行工具调用（True/False）

#### 大语言模型配置

##### OpenAI 配置
- `OPENAI_API_BASE_URL`: OpenAI API 的基础 URL
- `OPENAI_API_KEY`: OpenAI API 密钥
- `OPENAI_MODEL`: 默认使用的 OpenAI 模型，如 "gpt-4o-global"
- `OPENAI_4_1_MODEL`: OpenAI 4.1 模型名称
- `OPENAI_4_1_MINI_MODEL`: OpenAI 4.1 Mini 模型名称
- `OPENAI_4_1_NANO_MODEL`: OpenAI 4.1 Nano 模型名称

#### 向量数据库配置
- `QDRANT_COLLECTION_PREFIX`: Qdrant 集合前缀，默认为 "SUPERMAGIC-"

#### 浏览器配置
- `BROWSER_HEADLESS`: 浏览器是否以无头模式运行（True/False）
- `BROWSER_STORAGE_STATE_TEMPLATE_URL`: 浏览器存储状态模板 URL

#### 搜索配置
- `BING_SUBSCRIPTION_ENDPOINT`: Bing 搜索 API 端点
- `BING_SUBSCRIPTION_KEY`: Bing 搜索订阅密钥


#### 模型服务配置

##### OpenAI 服务
- `OPENAI_API_KEY`: OpenAI API 密钥
- `OPENAI_API_BASE_URL`: OpenAI API 基础 URL
- `OPENAI_MODEL`: 使用的 OpenAI 模型

## 故障排除

### 常见问题

1. **配置文件不存在**

   确保已经从示例文件复制并正确配置了所有必要的环境文件：
   - `config/.env_sandbox_gateway`
2. **服务启动失败**

   检查 Docker 服务是否正常运行：
   ```bash
   docker info
   ```

   查看服务日志以获取详细错误信息：
   ```bash
   ./bin/magic.sh logs
   ```

3. **网络连接问题**

   如果使用远程部署，确保配置的 IP 地址正确，并且相关端口已开放：
   - Super Magic 服务端口
   - Gateway 服务端口

## 高级配置

### 自定义部署

对于需要自定义部署的情况，可以编辑 `.env` 文件修改以下配置：

- 服务端口映射
- 数据持久化路径
- 资源限制

### 手动配置

如果需要手动进行更精细的配置，可以直接编辑 `docker-compose.yml` 文件。

## 更新服务

当需要更新 Super Magic 服务时，执行以下步骤：

1. 拉取最新代码
   ```bash
   git pull
   ```

2. 重新构建并启动服务
   ```bash
   ./bin/magic.sh restart
   ```

## 结语

通过本教程，您应该已经成功安装并配置了 Super Magic 服务。如有任何问题，请参考项目文档或联系技术支持团队。

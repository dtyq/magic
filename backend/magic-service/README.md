# Magic Service

## 项目概述

Magic Service 是一个基于 Hyperf 框架的高性能 PHP 微服务应用，使用 Swow 协程驱动实现高并发处理能力。该项目集成了多种功能模块，包括 AI 搜索、聊天功能、文件处理、权限管理等，旨在提供一个全面的服务解决方案。

## 功能特性

- **AI 搜索功能**：集成 Google 等搜索引擎的 API，提供智能搜索能力
- **聊天系统**：支持实时通讯和会话管理
- **文件处理**：文件上传、下载和管理功能
- **流程管理**：支持工作流配置和执行
- **助理功能**：可扩展的助理功能支持

## 环境要求

- PHP >= 8.3
- Swow 扩展
- Redis 扩展
- PDO 扩展
- 其他扩展：bcmath, curl, fileinfo, openssl, xlswriter, zlib 等
- Composer

## 安装部署

### 1. 克隆项目

```bash
git clone https://github.com/dtyq/magic.git
cd magic-service
```

### 2. 安装依赖

```bash
composer install
```




### 3. 环境配置

复制环境配置文件并根据需要修改：

```bash
cp .env.example .env
```

### 数据库迁移

```bash
php bin/hyperf.php migrate
```

## 运行应用

### 启动前端服务

```bash
cd static/web && npm install && npm run dev
```

### 启动后端服务

```bash
php bin/hyperf.php start
```

也可以使用脚本启动：

```bash
sh start.sh
```

## 开发指南

### 项目结构

- `app/` - 应用代码
  - `Application/` - 应用层代码
  - `Domain/` - 领域层代码
  - `Infrastructure/` - 基础设施层代码
  - `Interfaces/` - 接口层代码
  - `ErrorCode/` - 错误码定义
  - `Listener/` - 事件监听器
- `config/` - 配置文件
- `migrations/` - 数据库迁移文件
- `test/` - 单元测试
- `bin/` - 可执行脚本
- `static/` - 静态资源文件

### 代码规范

项目使用 PHP-CS-Fixer 进行代码风格检查与修复：

```bash
composer fix
```

使用 PHPStan 进行静态代码分析：

```bash
composer analyse
```

### 单元测试

使用以下命令运行单元测试：

```bash
vendor/bin/phpunit
# 或使用
composer test
```

## Docker 部署

项目提供了 Dockerfile，可以使用以下命令构建镜像：

```bash
docker build -t magic-service .
```

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

## 许可证

该项目采用 MIT 许可证 - 详情请查看 LICENSE 文件

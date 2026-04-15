# Magic Service Go Engine

基于 Golang 实现的长期记忆系统引擎，采用 DDD（领域驱动设计）架构，支持向量检索和图关系推理的双引擎协同。

## 🚀 项目特性

- **DDD 架构设计**: 符合领域驱动设计的分层架构
- **双引擎支持**: 
  - Qdrant 向量数据库：语义相似度检索
  - MySQL 数据库：元数据和关系存储
- **多租户隔离**: 支持组织级和应用级的数据隔离
- **数据库迁移**: MySQL 结构迁移统一由 PHP 服务管理
- **RESTful API**: 标准化的 HTTP API 接口

## 🛠 技术栈

- **语言**: Go 1.26+
- **Web框架**: Gin
- **数据库**: 
  - Qdrant 1.x (向量数据库)
  - MySQL 8.0+ (元数据存储)
- **架构模式**: DDD (Domain-Driven Design)
- **数据库迁移**: Hyperf PHP migrations

## 🚀 快速启动

### 1. 一键启动所有服务

```bash
# 启动所有依赖服务（包括 MySQL）
docker-compose --profile mysql up -d

# 查看服务状态
docker-compose ps
```

### 2. 配置环境变量

```bash
# 复制共享环境变量模板
cp ../.env.example ../.env
```

### 3. 运行数据库迁移和应用

```bash
# 安装本地开发依赖
make install

# 执行 PHP 项目迁移
cd .. && php bin/hyperf.php migrate

# 启动应用
cd ..
make dev
```

默认以纯 IPC 模式启动，不监听 HTTP 端口；如需本地开启 HTTP 调试，请设置 `SERVER_ENABLED=true`，默认端口 `81`。Go 二进制输出到 `../bin/magic-go-engine`，运行时配置文件固定为 `../magic-go-engine-config.yaml`。

## 🧪 快速测试

仅在 `SERVER_ENABLED=true` 时可用：

```bash
# 健康检查
curl http://localhost:8080/health

# 初始化演示数据
curl -X POST http://localhost:8080/api/v1/demo/setup-data

# 测试核心功能
curl -X POST http://localhost:8080/api/v1/search/user-projects \
  -H "Content-Type: application/json" \
  -d '{
    "user_name": "小明",
    "org_id": "demo_org",
    
  }'
```

## 📋 服务端口

| 服务 | 端口 | 用途 |
|------|------|------|
| Go 应用 | 8080 | HTTP API（仅 `SERVER_ENABLED=true`） |
| Qdrant | 6333/6334 | HTTP/gRPC API |
| MySQL | 3306 | 业务元数据存储 |

## 🔧 开发命令

```bash
# 热重载开发
cd ..
make dev
make dev-no-restart

# 或单独在 Go 目录启动热重载
make dev

# 代码格式化和检查
make fmt
make fix
make lint

# 安装依赖与工具
make install

# 运行测试
make test
```

## 🧭 DDD 分层与依赖注入

- 当前分层采用 `domain / application / interfaces / infrastructure / di`
- `internal/di` 是唯一合法的依赖注入与装配层，统一承载 `Provide*`、`wire.NewSet`、`wire.Bind`
- knowledge 模块按子域组织，核心目录为：
  - `internal/domain/knowledge/document|fragment|knowledgebase|embedding|shared`
  - `internal/application/knowledge/document|fragment|knowledgebase|embedding|shared`
  - `internal/infrastructure/persistence/mysql/knowledge/document|fragment|knowledgebase|embeddingcache|transaction|shared`
- `layerdeps` 负责守住导入边界：
  - `interfaces -> application`
  - `application -> domain`
  - `infrastructure -> domain`
  - `di -> application/domain/interfaces/infrastructure`
- 详细约定见：
  - `docs/ddd_layering_and_di.md`
  - `docs/wire_di_guidelines.md`
- 自定义分层分析器（layerdeps）：
  - 构建：`go build -o bin/layerdeps ./cmd/layerdeps`
  - 扫描：`./bin/layerdeps ./...`
  - 日常校验：`make lint`

## 📊 数据库迁移

MySQL 表结构迁移统一放在 PHP 项目的 [migrations](../migrations) 目录，通过 `php bin/hyperf.php migrate` 执行。Go 侧不再提供独立的迁移命令。

详细信息请参考：[数据库迁移指南](docs/database_migration_guide.md)

---

**注意**: 这是一个演示项目，展示了基于 Go 的 DDD 架构和双引擎长期记忆系统的实现。

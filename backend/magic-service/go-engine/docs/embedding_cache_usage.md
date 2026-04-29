# 向量化缓存系统使用指南

## 概述

向量化缓存系统是一个高性能的文本向量化结果缓存解决方案，专门设计用于减少重复的向量化计算，节省 API 调用成本，提升系统响应速度。

### 核心特性

- ✅ **智能缓存**：基于文本内容的 SHA256 哈希值进行缓存索引
- ✅ **访问统计**：记录每个缓存项的访问次数和最后访问时间
- ✅ **自动清理**：支持基于时间和访问频率的自动清理策略
- ✅ **手动清理**：支持按条件手动清理并返回清理前后统计
- ✅ **多组织共享**：缓存在组织间共享，提高命中率
- ✅ **批量操作**：支持批量删除和高效的数据库操作

## 快速开始

### 1. 数据库迁移

首先执行 PHP 项目的数据库迁移创建缓存表：

```bash
cd ..
php bin/hyperf.php migrate
```

### 2. 初始化服务

```go
import (
    "github.com/your-project/internal/application/service"
    mysqlRepo "github.com/your-project/internal/infrastructure/persistence/mysql"
)

// 创建数据库连接
db, err := sqlx.Connect("mysql", dsn)
if err != nil {
    log.Fatal(err)
}

// 创建仓储和服务
cacheRepo := mysqlRepo.NewEmbeddingCacheRepository(db)
cacheService := service.NewEmbeddingCacheAppService(cacheRepo)
```

### 3. 基本使用

```go
ctx := context.Background()

// 定义您的向量化函数
computeEmbedding := func(text string) ([]float64, error) {
    // 调用您的嵌入服务 API
    return yourEmbeddingAPI.GetEmbedding(text, "text-embedding-ada-002")
}

// 使用缓存获取或计算向量
embedding, err := cacheService.GetOrComputeEmbedding(
    ctx, 
    "您要向量化的文本", 
    "text-embedding-ada-002",
    computeEmbedding,
)
if err != nil {
    log.Printf("获取向量失败: %v", err)
}

fmt.Printf("获取到 %d 维向量\n", len(embedding))
```

## 高级功能

### 缓存统计

```go
// 获取缓存统计信息
stats, err := cacheService.GetCacheStatistics(ctx)
if err != nil {
    log.Printf("获取统计失败: %v", err)
    return
}

fmt.Printf("总缓存数: %d\n", stats.TotalCaches)
fmt.Printf("平均访问次数: %.2f\n", stats.AverageAccessCount)
fmt.Printf("存储大小: %.2f MB\n", float64(stats.StorageSizeBytes)/(1024*1024))
```

### 自动清理

```go
// 创建清理服务
cleanupService := service.NewEmbeddingCacheCleanupService(
    embeddingDomainService,
    service.DefaultCleanupConfig(),
    logger,
)

// 启动清理守护进程
go func() {
    cleanupService.StartCleanupDaemon(ctx)
}()
```

### 手动清理

```go
// 自定义清理标准
criteria := &entity.EmbeddingCacheCleanupCriteria{
    MinAccessCount:  2,                      // 访问次数少于2次
    MaxIdleDuration: 30 * 24 * time.Hour,   // 30天未访问
    MaxCacheAge:     90 * 24 * time.Hour,   // 90天以上
    BatchSize:       1000,                   // 批量删除大小
}

// 执行手动清理
result, err := cleanupService.ManualCleanup(ctx, criteria)
if err != nil {
    log.Printf("清理失败: %v", err)
    return
}

fmt.Printf("清理结果: %s\n", result.String())
```

## 配置选项

### 清理配置

```go
config := &service.CleanupConfig{
    CleanupInterval:    24 * time.Hour,     // 清理间隔
    AutoCleanupEnabled: true,               // 启用自动清理
    CleanupTimeout:     30 * time.Minute,   // 清理超时时间
    CleanupCriteria: &entity.EmbeddingCacheCleanupCriteria{
        MinAccessCount:  2,
        MaxIdleDuration: 30 * 24 * time.Hour,
        MaxCacheAge:     90 * 24 * time.Hour,
        BatchSize:       1000,
    },
}
```

### 清理标准说明

- **MinAccessCount**: 最小访问次数，低于此值的缓存会被清理
- **MaxIdleDuration**: 最大空闲时间，超过此时间未访问的缓存会被清理
- **MaxCacheAge**: 最大缓存年龄，创建时间超过此期限的缓存会被清理
- **BatchSize**: 每次批量清理的记录数量

## 数据库表结构

```sql
CREATE TABLE embedding_cache (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    text_hash CHAR(64) NOT NULL COMMENT '文本SHA256哈希值',
    text_preview VARCHAR(255) NOT NULL COMMENT '文本预览',
    text_length INT NOT NULL COMMENT '原始文本长度',
    embedding JSON NOT NULL COMMENT '向量化结果',
    embedding_model VARCHAR(100) NOT NULL COMMENT '嵌入模型名称',
    vector_dimension INT NOT NULL COMMENT '向量维度',
    access_count INT NOT NULL DEFAULT 1 COMMENT '访问次数',
    last_accessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_text_hash_model (text_hash, embedding_model),
    -- 索引省略
);
```

## 性能优化建议

### 1. 数据库优化

```sql
-- 为高频查询字段创建索引（已在迁移文件中包含）
CREATE UNIQUE INDEX uk_text_hash_model ON embedding_cache(text_hash, embedding_model);
CREATE INDEX idx_last_accessed_access ON embedding_cache(last_accessed_at, access_count);
CREATE INDEX idx_access_count ON embedding_cache(access_count);
CREATE INDEX idx_created_at ON embedding_cache(created_at);
```

### 2. 连接池配置

```go
db.SetMaxOpenConns(25)          // 最大开放连接数
db.SetMaxIdleConns(5)           // 最大空闲连接数
db.SetConnMaxLifetime(5 * time.Minute) // 连接最大生存时间
```

### 3. 缓存策略

- **文本预处理**：在缓存前对文本进行标准化处理（去除多余空格、统一换行符等）
- **分批处理**：对大量文本使用批量处理，避免频繁的数据库操作
- **监控告警**：设置缓存命中率和存储空间的监控告警

## 监控和维护

### 关键指标

- **缓存命中率**：应保持在 70% 以上
- **平均访问次数**：健康的缓存系统应该 > 2.0
- **存储空间增长**：监控存储空间的增长趋势
- **清理效率**：定期检查清理任务的执行效果

### 定期维护

```bash
# 查看缓存统计
SELECT 
    COUNT(*) as total_caches,
    AVG(access_count) as avg_access,
    SUM(LENGTH(embedding)) as storage_bytes
FROM embedding_cache;

# 查找低质量缓存
SELECT text_hash, access_count, last_accessed_at 
FROM embedding_cache 
WHERE access_count = 1 
  AND last_accessed_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
ORDER BY created_at ASC 
LIMIT 100;
```

## 故障排除

### 常见问题

1. **缓存命中率低**
   - 检查文本预处理是否一致
   - 验证哈希计算逻辑
   - 检查清理策略是否过于激进

2. **存储空间增长过快**
   - 调整清理标准
   - 检查是否有重复的无效缓存
   - 考虑向量压缩方案

3. **查询性能问题**
   - 检查索引是否正确创建
   - 监控慢查询日志
   - 优化查询条件

### 日志记录

系统会自动记录以下关键事件：
- 缓存命中和未命中
- 清理任务执行结果
- 错误和警告信息

## 示例代码

完整的使用示例请参考：`examples/embedding_cache_usage.go`

该示例包含：
- 基本缓存使用
- 统计信息获取
- 搜索功能演示
- 清理任务演示
- 与现有服务的集成方式

## 总结

向量化缓存系统通过智能的缓存策略和清理机制（定时清理 + 手动清理），可以显著提升向量化服务的性能和成本效率。合理配置清理策略和监控关键指标，能够确保系统长期稳定运行。

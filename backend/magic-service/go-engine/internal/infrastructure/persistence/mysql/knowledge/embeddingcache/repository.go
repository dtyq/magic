// Package embeddingcache 提供 embedding cache 仓储的 MySQL 实现。
package embeddingcache

import (
	"context"
	"errors"

	"magic/internal/domain/knowledge/embedding"
	"magic/internal/infrastructure/logging"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
)

// ErrCacheNotFound 表示缓存未找到的哨兵错误
var ErrCacheNotFound = embedding.ErrCacheNotFound

var (
	// ErrCacheNotFoundByID 表示按 ID 未找到缓存
	ErrCacheNotFoundByID = errors.New("cache not found by ID")
	// ErrCacheNotFoundByHash 表示按 hash 未找到缓存
	ErrCacheNotFoundByHash = errors.New("cache not found by hash")
	// ErrNoCachesDeleted 表示未删除任何缓存
	ErrNoCachesDeleted = errors.New("no caches were deleted")
)

// Repository MySQL 实现的向量化缓存仓储。
type Repository struct {
	client *mysqlclient.SQLCClient
	logger *logging.SugaredLogger
}

// NewRepository 创建新的缓存仓储实例。
func NewRepository(client *mysqlclient.SQLCClient, logger *logging.SugaredLogger) *Repository {
	return &Repository{
		client: client,
		logger: logger,
	}
}

// Close 为兼容保留的空实现；embedding_cache 现已改为同步落库。
func (repo *Repository) Close(ctx context.Context) error {
	_ = repo
	_ = ctx
	return nil
}

// Package embeddingcache 提供 embedding cache 仓储的 MySQL 实现。
package embeddingcache

import (
	"context"
	"errors"

	"magic/internal/infrastructure/logging"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
)

// ErrCacheNotFound 表示缓存未找到的哨兵错误
var ErrCacheNotFound = errors.New("embedding cache not found")

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
	client        *mysqlclient.SQLCClient
	logger        *logging.SugaredLogger
	accessUpdater *accessUpdater
}

// NewRepository 创建新的缓存仓储实例。
func NewRepository(client *mysqlclient.SQLCClient, logger *logging.SugaredLogger) *Repository {
	return &Repository{
		client:        client,
		logger:        logger,
		accessUpdater: newAccessUpdater(client, logger),
	}
}

// Close 停止异步访问计数更新器并尽力刷完剩余队列。
func (repo *Repository) Close(ctx context.Context) error {
	if repo == nil || repo.accessUpdater == nil {
		return nil
	}
	return repo.accessUpdater.Close(ctx)
}

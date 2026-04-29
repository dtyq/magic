// Package collectionmeta 提供 CollectionMeta 的 Redis 缓存。
package collectionmeta

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	sharedroute "magic/internal/domain/knowledge/shared/route"
	"magic/internal/infrastructure/logging"
)

const (
	defaultCacheKey = "magic:knowledge:collection_meta:v1"
	defaultCacheTTL = 5 * time.Minute
)

// Cache 封装集合元数据的 Redis 读写。
type Cache struct {
	client *redis.Client
	logger *logging.SugaredLogger
	key    string
	ttl    time.Duration
}

// NewCache 创建集合元数据缓存。
func NewCache(client *redis.Client, logger *logging.SugaredLogger) *Cache {
	return &Cache{
		client: client,
		logger: logger,
		key:    defaultCacheKey,
		ttl:    defaultCacheTTL,
	}
}

// Get 读取缓存中的集合元数据。
func (c *Cache) Get(ctx context.Context) (sharedroute.CollectionMeta, bool, error) {
	if c == nil || c.client == nil {
		return sharedroute.CollectionMeta{}, false, nil
	}
	payload, err := c.client.Get(ctx, c.key).Bytes()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return sharedroute.CollectionMeta{}, false, nil
		}
		return sharedroute.CollectionMeta{}, false, fmt.Errorf("get collection meta cache: %w", err)
	}

	var meta sharedroute.CollectionMeta
	if err := json.Unmarshal(payload, &meta); err != nil {
		return sharedroute.CollectionMeta{}, false, fmt.Errorf("decode collection meta cache: %w", err)
	}
	return meta, true, nil
}

// Set 写入集合元数据缓存。
func (c *Cache) Set(ctx context.Context, meta sharedroute.CollectionMeta) error {
	if c == nil || c.client == nil {
		return nil
	}
	payload, err := json.Marshal(meta)
	if err != nil {
		return fmt.Errorf("marshal collection meta cache: %w", err)
	}
	if err := c.client.Set(ctx, c.key, payload, c.ttl).Err(); err != nil {
		return fmt.Errorf("set collection meta cache: %w", err)
	}
	return nil
}

// Warn 记录缓存读写失败日志。
func (c *Cache) Warn(ctx context.Context, message string, err error) {
	if c == nil || c.logger == nil || err == nil {
		return
	}
	c.logger.KnowledgeWarnContext(ctx, message, "error", err)
}

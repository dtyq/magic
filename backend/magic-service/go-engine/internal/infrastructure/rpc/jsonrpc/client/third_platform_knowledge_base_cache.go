package client

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	"magic/internal/pkg/thirdplatform"
)

const (
	thirdPlatformKnowledgeBaseCacheTTL       = 2 * time.Minute
	thirdPlatformKnowledgeBaseCacheKeyPrefix = "magic:knowledge:third_platform:list_kbs:v1:"
)

// RedisThirdPlatformKnowledgeBaseCache 使用 Redis 缓存企业知识库列表。
type RedisThirdPlatformKnowledgeBaseCache struct {
	client *redis.Client
	ttl    time.Duration
}

// NewRedisThirdPlatformKnowledgeBaseCache 创建企业知识库列表缓存。
func NewRedisThirdPlatformKnowledgeBaseCache(client *redis.Client) *RedisThirdPlatformKnowledgeBaseCache {
	if client == nil {
		return nil
	}
	return &RedisThirdPlatformKnowledgeBaseCache{
		client: client,
		ttl:    thirdPlatformKnowledgeBaseCacheTTL,
	}
}

// Get 读取企业知识库列表缓存。
func (c *RedisThirdPlatformKnowledgeBaseCache) Get(
	ctx context.Context,
	input thirdplatform.KnowledgeBaseListInput,
) ([]thirdplatform.KnowledgeBaseItem, bool, error) {
	if c == nil || c.client == nil {
		return nil, false, nil
	}

	payload, err := c.client.Get(ctx, c.key(input)).Bytes()
	switch {
	case errors.Is(err, redis.Nil):
		return nil, false, nil
	case err != nil:
		return nil, false, fmt.Errorf("redis get third platform knowledge base cache: %w", err)
	}

	var items []thirdplatform.KnowledgeBaseItem
	if err := json.Unmarshal(payload, &items); err != nil {
		return nil, false, fmt.Errorf("unmarshal third platform knowledge base cache: %w", err)
	}
	return items, true, nil
}

// Set 写入企业知识库列表缓存。
func (c *RedisThirdPlatformKnowledgeBaseCache) Set(
	ctx context.Context,
	input thirdplatform.KnowledgeBaseListInput,
	items []thirdplatform.KnowledgeBaseItem,
) error {
	if c == nil || c.client == nil {
		return nil
	}

	payload, err := json.Marshal(items)
	if err != nil {
		return fmt.Errorf("marshal third platform knowledge base cache: %w", err)
	}
	if err := c.client.Set(ctx, c.key(input), payload, c.ttl).Err(); err != nil {
		return fmt.Errorf("redis set third platform knowledge base cache: %w", err)
	}
	return nil
}

func (c *RedisThirdPlatformKnowledgeBaseCache) key(input thirdplatform.KnowledgeBaseListInput) string {
	sum := sha256.Sum256([]byte(strings.Join([]string{
		strings.TrimSpace(input.OrganizationCode),
		strings.TrimSpace(input.UserID),
		strings.TrimSpace(input.ThirdPlatformUserID),
		strings.TrimSpace(input.ThirdPlatformOrganizationCode),
	}, "\x00")))
	return thirdPlatformKnowledgeBaseCacheKeyPrefix + hex.EncodeToString(sum[:])
}

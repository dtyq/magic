// Package sourcecacheversion 提供 third-file 源内容缓存版本的 Redis 实现。
package sourcecacheversion

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

const (
	defaultThirdFileSourceCacheVersionTTL  = time.Hour
	redisThirdFileSourceCacheVersionPrefix = "knowledge:source_cache_version:"
	thirdFileSourceKeyPartCount            = 4
	thirdFileSourceKeyPrefix               = "third_file"
	thirdFileSourceKeyPrefixIndex          = 0
	thirdFileSourceKeyOrganizationIndex    = 1
	thirdFileSourceKeyPlatformIndex        = 2
	thirdFileSourceKeyFileIndex            = 3
)

var (
	errThirdFileSourceCacheRedisRequired = errors.New("third-file source cache version redis client is required")
	errThirdFileSourceCacheKeyRequired   = errors.New("third-file source cache version source key is required")
	errThirdFileSourceCacheKeyInvalid    = errors.New("third-file source cache version source key is invalid")
)

// RedisStore 用 Redis 保存 third-file 源内容的轻量版本号。
type RedisStore struct {
	client *redis.Client
	ttl    time.Duration
}

// NewRedisStore 创建 Redis-backed third-file source cache version store。
func NewRedisStore(client *redis.Client) *RedisStore {
	if client == nil {
		return nil
	}
	return &RedisStore{client: client, ttl: defaultThirdFileSourceCacheVersionTTL}
}

// Bump 为本次 third-file fan-out 写入新版本。
func (s *RedisStore) Bump(ctx context.Context, sourceKey string) (string, error) {
	if s == nil || s.client == nil {
		return "", errThirdFileSourceCacheRedisRequired
	}
	key, err := s.redisKey(sourceKey)
	if err != nil {
		return "", err
	}

	version := fmt.Sprintf("%d:%s", time.Now().UnixMilli(), uuid.NewString())
	if err := s.client.Set(ctx, key, version, s.versionTTL()).Err(); err != nil {
		return "", fmt.Errorf("bump third-file source cache version: %w", err)
	}
	return version, nil
}

// Get 读取 Redis 当前版本；key miss 表示 consumer 必须绕过本地大对象缓存。
func (s *RedisStore) Get(ctx context.Context, sourceKey string) (string, bool, error) {
	if s == nil || s.client == nil {
		return "", false, errThirdFileSourceCacheRedisRequired
	}
	key, err := s.redisKey(sourceKey)
	if err != nil {
		return "", false, err
	}

	version, err := s.client.Get(ctx, key).Result()
	if errors.Is(err, redis.Nil) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("get third-file source cache version: %w", err)
	}
	version = strings.TrimSpace(version)
	if version == "" {
		return "", false, nil
	}
	return version, true, nil
}

func (s *RedisStore) redisKey(sourceKey string) (string, error) {
	parts := strings.Split(strings.TrimSpace(sourceKey), ":")
	if len(parts) != thirdFileSourceKeyPartCount {
		return "", errThirdFileSourceCacheKeyInvalid
	}
	if strings.TrimSpace(parts[thirdFileSourceKeyPrefixIndex]) != thirdFileSourceKeyPrefix {
		return "", errThirdFileSourceCacheKeyInvalid
	}
	organizationCode := strings.TrimSpace(parts[thirdFileSourceKeyOrganizationIndex])
	thirdPlatformType := strings.ToLower(strings.TrimSpace(parts[thirdFileSourceKeyPlatformIndex]))
	thirdFileID := strings.TrimSpace(parts[thirdFileSourceKeyFileIndex])
	if organizationCode == "" || thirdPlatformType == "" || thirdFileID == "" {
		return "", errThirdFileSourceCacheKeyRequired
	}
	return redisThirdFileSourceCacheVersionPrefix +
		organizationCode + ":" +
		thirdPlatformType + ":" +
		thirdFileID, nil
}

func (s *RedisStore) versionTTL() time.Duration {
	if s == nil || s.ttl <= 0 {
		return defaultThirdFileSourceCacheVersionTTL
	}
	return s.ttl
}

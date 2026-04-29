package kbapp

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"

	sourcebindingservice "magic/internal/domain/knowledge/sourcebinding/service"
)

const (
	sourceBindingEnterpriseTreeRootCacheTTL       = time.Minute
	sourceBindingEnterpriseTreeRootCacheKeyPrefix = "magic:knowledge:source_binding_tree_root:v1:"
)

// SourceBindingTreeRootCache 定义企业知识库根目录树索引缓存。
type SourceBindingTreeRootCache interface {
	Get(
		ctx context.Context,
		organizationCode string,
		userID string,
		provider string,
		knowledgeBaseID string,
	) (*sourcebindingservice.EnterpriseTreeIndex, bool, error)
	Set(
		ctx context.Context,
		organizationCode string,
		userID string,
		provider string,
		knowledgeBaseID string,
		index *sourcebindingservice.EnterpriseTreeIndex,
	) error
}

// RedisSourceBindingTreeRootCache 使用 Redis 缓存知识库根目录树索引。
type RedisSourceBindingTreeRootCache struct {
	client *redis.Client
	ttl    time.Duration
}

// NewRedisSourceBindingTreeRootCache 创建根目录树索引 Redis 缓存。
func NewRedisSourceBindingTreeRootCache(client *redis.Client) *RedisSourceBindingTreeRootCache {
	if client == nil {
		return nil
	}
	return &RedisSourceBindingTreeRootCache{
		client: client,
		ttl:    sourceBindingEnterpriseTreeRootCacheTTL,
	}
}

// Get 读取知识库根目录树索引。
func (c *RedisSourceBindingTreeRootCache) Get(
	ctx context.Context,
	organizationCode string,
	userID string,
	provider string,
	knowledgeBaseID string,
) (*sourcebindingservice.EnterpriseTreeIndex, bool, error) {
	if c == nil || c.client == nil {
		return nil, false, nil
	}

	payload, err := c.client.Get(ctx, c.key(organizationCode, userID, provider, knowledgeBaseID)).Bytes()
	switch {
	case errors.Is(err, redis.Nil):
		return nil, false, nil
	case err != nil:
		return nil, false, fmt.Errorf("redis get source binding tree root cache: %w", err)
	}

	var index sourcebindingservice.EnterpriseTreeIndex
	if err := json.Unmarshal(payload, &index); err != nil {
		return nil, false, fmt.Errorf("unmarshal source binding tree root cache: %w", err)
	}
	return &index, true, nil
}

// Set 写入知识库根目录树索引。
func (c *RedisSourceBindingTreeRootCache) Set(
	ctx context.Context,
	organizationCode string,
	userID string,
	provider string,
	knowledgeBaseID string,
	index *sourcebindingservice.EnterpriseTreeIndex,
) error {
	if c == nil || c.client == nil || index == nil {
		return nil
	}

	payload, err := json.Marshal(index)
	if err != nil {
		return fmt.Errorf("marshal source binding tree root cache: %w", err)
	}
	if err := c.client.Set(ctx, c.key(organizationCode, userID, provider, knowledgeBaseID), payload, c.ttl).Err(); err != nil {
		return fmt.Errorf("redis set source binding tree root cache: %w", err)
	}
	return nil
}

func (c *RedisSourceBindingTreeRootCache) key(
	organizationCode string,
	userID string,
	provider string,
	knowledgeBaseID string,
) string {
	sum := sha256.Sum256([]byte(strings.Join([]string{
		strings.TrimSpace(organizationCode),
		strings.TrimSpace(userID),
		strings.TrimSpace(provider),
		strings.TrimSpace(knowledgeBaseID),
	}, "\x00")))
	return sourceBindingEnterpriseTreeRootCacheKeyPrefix + hex.EncodeToString(sum[:])
}

type sourceBindingTreeRootLocator struct {
	mu    sync.Mutex
	items map[string]sourceBindingTreeRootLocatorEntry
	ttl   time.Duration
}

type sourceBindingTreeRootLocatorEntry struct {
	expiresAt       time.Time
	knowledgeBaseID string
}

func newSourceBindingTreeRootLocator() *sourceBindingTreeRootLocator {
	return &sourceBindingTreeRootLocator{
		items: make(map[string]sourceBindingTreeRootLocatorEntry),
		ttl:   sourceBindingEnterpriseTreeRootCacheTTL,
	}
}

func (l *sourceBindingTreeRootLocator) remember(
	organizationCode string,
	userID string,
	provider string,
	knowledgeBaseIDByFolderRef map[string]string,
) {
	if l == nil || len(knowledgeBaseIDByFolderRef) == 0 {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	expiresAt := time.Now().Add(l.ttl)
	for folderRef, knowledgeBaseID := range knowledgeBaseIDByFolderRef {
		trimmedFolderRef := strings.TrimSpace(folderRef)
		trimmedKnowledgeBaseID := strings.TrimSpace(knowledgeBaseID)
		if trimmedFolderRef == "" || trimmedKnowledgeBaseID == "" {
			continue
		}
		l.items[l.key(organizationCode, userID, provider, trimmedFolderRef)] = sourceBindingTreeRootLocatorEntry{
			expiresAt:       expiresAt,
			knowledgeBaseID: trimmedKnowledgeBaseID,
		}
	}
}

func (l *sourceBindingTreeRootLocator) get(
	organizationCode string,
	userID string,
	provider string,
	folderRef string,
) (string, bool) {
	if l == nil {
		return "", false
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	key := l.key(organizationCode, userID, provider, folderRef)
	entry, ok := l.items[key]
	if !ok {
		return "", false
	}
	if !time.Now().Before(entry.expiresAt) {
		delete(l.items, key)
		return "", false
	}
	return entry.knowledgeBaseID, true
}

func (l *sourceBindingTreeRootLocator) forget(
	organizationCode string,
	userID string,
	provider string,
	folderRef string,
) {
	if l == nil {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	delete(l.items, l.key(organizationCode, userID, provider, folderRef))
}

func (l *sourceBindingTreeRootLocator) key(
	organizationCode string,
	userID string,
	provider string,
	folderRef string,
) string {
	return strings.Join([]string{
		strings.TrimSpace(organizationCode),
		strings.TrimSpace(userID),
		strings.TrimSpace(provider),
		strings.TrimSpace(folderRef),
	}, "\x00")
}

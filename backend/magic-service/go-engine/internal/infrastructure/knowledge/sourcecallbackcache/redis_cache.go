// Package sourcecallbackcache 提供 source callback 资格判断的 Redis 缓存实现。
package sourcecallbackcache

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	sourcebindingentity "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingrepository "magic/internal/domain/knowledge/sourcebinding/repository"
)

const (
	candidateTTL           = 30 * time.Second
	callbackLockTTL        = 30 * time.Second
	projectBindingPrefix   = "source_bindings:project"
	teamshareBindingPrefix = "source_bindings:teamshare"
	kbEnabledPrefix        = "kb_enabled"
	callbackLockPrefix     = "source_callback_lock"
	scanBatchSize          = 256
	lockTokenByteSize      = 16
)

const releaseLockScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
	return redis.call("DEL", KEYS[1])
end
return 0
`

// RedisCache 缓存 source callback 热路径候选数据和短锁。
type RedisCache struct {
	client *redis.Client
}

// NewRedisCache 创建 Redis 候选数据缓存。
func NewRedisCache(client *redis.Client) *RedisCache {
	return &RedisCache{client: client}
}

// Get 不缓存最终 eligibility，避免绑定变化后靠旧结论投递无效任务。
func (c *RedisCache) Get(
	ctx context.Context,
	key sourcebindingrepository.SourceCallbackEligibilityCacheKey,
) (sourcebindingrepository.SourceCallbackEligibilityDecision, bool, error) {
	_ = ctx
	_ = key
	return sourcebindingrepository.SourceCallbackEligibilityDecision{}, false, nil
}

// Set 不缓存最终 eligibility；只允许候选数据缓存参与性能优化。
func (c *RedisCache) Set(
	ctx context.Context,
	key sourcebindingrepository.SourceCallbackEligibilityCacheKey,
	decision sourcebindingrepository.SourceCallbackEligibilityDecision,
) error {
	_ = ctx
	_ = key
	_ = decision
	return nil
}

// GetProjectBindings 读取项目来源绑定候选缓存。
func (c *RedisCache) GetProjectBindings(
	ctx context.Context,
	organizationCode string,
	projectID int64,
) ([]sourcebindingentity.Binding, bool, error) {
	return c.getBindings(ctx, projectBindingKey(organizationCode, projectID))
}

// SetProjectBindings 写入项目来源绑定候选缓存。
func (c *RedisCache) SetProjectBindings(
	ctx context.Context,
	organizationCode string,
	projectID int64,
	bindings []sourcebindingentity.Binding,
) error {
	return c.setBindings(ctx, projectBindingKey(organizationCode, projectID), bindings)
}

// GetTeamshareBindings 读取 Teamshare 来源绑定候选缓存。
func (c *RedisCache) GetTeamshareBindings(
	ctx context.Context,
	organizationCode string,
	platform string,
	knowledgeBaseID string,
) ([]sourcebindingentity.Binding, bool, error) {
	return c.getBindings(ctx, teamshareBindingKey(organizationCode, platform, knowledgeBaseID))
}

// SetTeamshareBindings 写入 Teamshare 来源绑定候选缓存。
func (c *RedisCache) SetTeamshareBindings(
	ctx context.Context,
	organizationCode string,
	platform string,
	knowledgeBaseID string,
	bindings []sourcebindingentity.Binding,
) error {
	return c.setBindings(ctx, teamshareBindingKey(organizationCode, platform, knowledgeBaseID), bindings)
}

// GetKnowledgeBaseEnabled 批量读取知识库启用状态缓存。
func (c *RedisCache) GetKnowledgeBaseEnabled(
	ctx context.Context,
	organizationCode string,
	knowledgeBaseCodes []string,
) (map[string]bool, []string, error) {
	result := make(map[string]bool, len(knowledgeBaseCodes))
	if c == nil || c.client == nil {
		return result, compactCacheStrings(knowledgeBaseCodes), nil
	}
	organizationCode = strings.TrimSpace(organizationCode)
	codes := compactCacheStrings(knowledgeBaseCodes)
	if organizationCode == "" || len(codes) == 0 {
		return result, codes, nil
	}
	keys := make([]string, 0, len(codes))
	for _, code := range codes {
		keys = append(keys, kbEnabledKey(organizationCode, code))
	}
	values, err := c.client.MGet(ctx, keys...).Result()
	if err != nil {
		return nil, nil, fmt.Errorf("mget knowledge base enabled cache: %w", err)
	}
	misses := make([]string, 0)
	for idx, value := range values {
		code := codes[idx]
		if value == nil {
			misses = append(misses, code)
			continue
		}
		text, ok := value.(string)
		if !ok {
			misses = append(misses, code)
			continue
		}
		switch text {
		case "1":
			result[code] = true
		case "0":
			result[code] = false
		default:
			misses = append(misses, code)
		}
	}
	return result, misses, nil
}

// SetKnowledgeBaseEnabled 批量写入知识库启用状态缓存。
func (c *RedisCache) SetKnowledgeBaseEnabled(
	ctx context.Context,
	organizationCode string,
	states map[string]bool,
) error {
	if c == nil || c.client == nil || len(states) == 0 {
		return nil
	}
	organizationCode = strings.TrimSpace(organizationCode)
	if organizationCode == "" {
		return nil
	}
	pipe := c.client.Pipeline()
	for code, enabled := range states {
		code = strings.TrimSpace(code)
		if code == "" {
			continue
		}
		value := "0"
		if enabled {
			value = "1"
		}
		pipe.Set(ctx, kbEnabledKey(organizationCode, code), value, candidateTTL)
	}
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("set knowledge base enabled cache: %w", err)
	}
	return nil
}

// AcquireSourceCallbackLock 获取同一来源文件回调短锁。
func (c *RedisCache) AcquireSourceCallbackLock(
	ctx context.Context,
	key sourcebindingrepository.SourceCallbackSingleflightKey,
) (string, bool, error) {
	if c == nil || c.client == nil {
		return "", true, nil
	}
	redisKey, ok := sourceCallbackLockKey(key)
	if !ok {
		return "", true, nil
	}
	token, err := newLockToken()
	if err != nil {
		return "", false, err
	}
	err = c.client.SetArgs(ctx, redisKey, token, redis.SetArgs{
		Mode: "nx",
		TTL:  callbackLockTTL,
	}).Err()
	if errors.Is(err, redis.Nil) {
		return token, false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("acquire source callback lock: %w", err)
	}
	return token, true, nil
}

// ReleaseSourceCallbackLock 释放同一来源文件回调短锁。
func (c *RedisCache) ReleaseSourceCallbackLock(
	ctx context.Context,
	key sourcebindingrepository.SourceCallbackSingleflightKey,
	token string,
) error {
	if c == nil || c.client == nil || strings.TrimSpace(token) == "" {
		return nil
	}
	redisKey, ok := sourceCallbackLockKey(key)
	if !ok {
		return nil
	}
	if err := c.client.Eval(ctx, releaseLockScript, []string{redisKey}, token).Err(); err != nil {
		return fmt.Errorf("release source callback lock: %w", err)
	}
	return nil
}

// InvalidateOrganization 尽力删除组织维度下的 source callback 资格缓存。
func (c *RedisCache) InvalidateOrganization(ctx context.Context, organizationCode string) error {
	if c == nil || c.client == nil {
		return nil
	}
	organizationCode = strings.TrimSpace(organizationCode)
	if organizationCode == "" {
		return nil
	}
	patterns := []string{
		projectBindingPrefix + ":" + organizationCode + ":*",
		teamshareBindingPrefix + ":" + organizationCode + ":*",
		kbEnabledPrefix + ":" + organizationCode + ":*",
	}
	for _, pattern := range patterns {
		if err := c.deleteByPattern(ctx, pattern); err != nil {
			return err
		}
	}
	return nil
}

func (c *RedisCache) deleteByPattern(ctx context.Context, pattern string) error {
	var cursor uint64
	for {
		keys, next, err := c.client.Scan(ctx, cursor, pattern, scanBatchSize).Result()
		if err != nil {
			return fmt.Errorf("scan source callback eligibility cache: %w", err)
		}
		if len(keys) > 0 {
			if err := c.client.Del(ctx, keys...).Err(); err != nil {
				return fmt.Errorf("delete source callback eligibility cache: %w", err)
			}
		}
		if next == 0 {
			return nil
		}
		cursor = next
	}
}

func (c *RedisCache) getBindings(ctx context.Context, key string) ([]sourcebindingentity.Binding, bool, error) {
	if c == nil || c.client == nil || strings.TrimSpace(key) == "" {
		return nil, false, nil
	}
	payload, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, false, nil
		}
		return nil, false, fmt.Errorf("get source binding candidate cache: %w", err)
	}
	var bindings []sourcebindingentity.Binding
	if err := json.Unmarshal(payload, &bindings); err != nil {
		return nil, false, fmt.Errorf("decode source binding candidate cache: %w", err)
	}
	return cloneBindings(bindings), true, nil
}

func (c *RedisCache) setBindings(
	ctx context.Context,
	key string,
	bindings []sourcebindingentity.Binding,
) error {
	if c == nil || c.client == nil || strings.TrimSpace(key) == "" {
		return nil
	}
	payload, err := json.Marshal(bindings)
	if err != nil {
		return fmt.Errorf("encode source binding candidate cache: %w", err)
	}
	if err := c.client.Set(ctx, key, payload, candidateTTL).Err(); err != nil {
		return fmt.Errorf("set source binding candidate cache: %w", err)
	}
	return nil
}

func projectBindingKey(organizationCode string, projectID int64) string {
	organizationCode = strings.TrimSpace(organizationCode)
	if organizationCode == "" || projectID <= 0 {
		return ""
	}
	return projectBindingPrefix + ":" + organizationCode + ":" + strconv.FormatInt(projectID, 10)
}

func teamshareBindingKey(organizationCode, platform, knowledgeBaseID string) string {
	organizationCode = strings.TrimSpace(organizationCode)
	platform = sourcebindingentity.NormalizeProvider(platform)
	knowledgeBaseID = strings.TrimSpace(knowledgeBaseID)
	if organizationCode == "" || platform == "" || knowledgeBaseID == "" {
		return ""
	}
	return teamshareBindingPrefix + ":" + organizationCode + ":" + platform + ":" + knowledgeBaseID
}

func kbEnabledKey(organizationCode, knowledgeBaseCode string) string {
	return kbEnabledPrefix + ":" + strings.TrimSpace(organizationCode) + ":" + strings.TrimSpace(knowledgeBaseCode)
}

func sourceCallbackLockKey(key sourcebindingrepository.SourceCallbackSingleflightKey) (string, bool) {
	provider := sourcebindingentity.NormalizeProvider(key.Provider)
	organizationCode := strings.TrimSpace(key.OrganizationCode)
	fileID := strings.TrimSpace(key.FileID)
	if provider == "" || organizationCode == "" || fileID == "" {
		return "", false
	}
	digest := sha256.Sum256([]byte(fileID))
	return callbackLockPrefix + ":" + provider + ":" + organizationCode + ":" + hex.EncodeToString(digest[:]), true
}

func newLockToken() (string, error) {
	buf := make([]byte, lockTokenByteSize)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate source callback lock token: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

func cloneBindings(bindings []sourcebindingentity.Binding) []sourcebindingentity.Binding {
	if len(bindings) == 0 {
		return []sourcebindingentity.Binding{}
	}
	result := make([]sourcebindingentity.Binding, 0, len(bindings))
	for _, binding := range bindings {
		cloned := binding
		cloned.SyncConfig = cloneMap(binding.SyncConfig)
		cloned.Targets = append([]sourcebindingentity.BindingTarget(nil), binding.Targets...)
		result = append(result, cloned)
	}
	return result
}

func cloneMap(input map[string]any) map[string]any {
	if len(input) == 0 {
		return map[string]any{}
	}
	output := make(map[string]any, len(input))
	maps.Copy(output, input)
	return output
}

func compactCacheStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

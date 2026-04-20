// Package lock 提供基于 Redis 的分布式锁
package lock

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	configpkg "magic/internal/config/autoload"
)

// ErrLockAcquisitionFailed 表示获取锁失败
var ErrLockAcquisitionFailed = errors.New("failed to acquire Redis lock after max attempts")

var errRedisOptimisticMutationFailed = errors.New("redis optimistic lock mutation failed after retries")

// RedisConfig 保存 Redis 锁配置
type RedisConfig struct {
	LockPrefix         string
	LockTTLSeconds     int
	SpinIntervalMillis int
	SpinMaxRetries     int
}

const (
	defaultLockTTLSecs        = 60
	defaultSpinIntervalMillis = 100
	defaultSpinMaxRetries     = 50
)

// DefaultRedisConfig 返回默认 Redis 锁配置
func DefaultRedisConfig() *RedisConfig {
	return &RedisConfig{
		LockPrefix:         "lock:",
		LockTTLSeconds:     defaultLockTTLSecs,
		SpinIntervalMillis: defaultSpinIntervalMillis,
		SpinMaxRetries:     defaultSpinMaxRetries,
	}
}

// RedisLockManager 管理基于 Redis 的分布式锁
type RedisLockManager struct {
	client *redis.Client
	config *RedisConfig
}

// NewRedisLockManager 创建新的 Redis 锁管理器
func NewRedisLockManager(client *redis.Client, config *RedisConfig) *RedisLockManager {
	if config == nil {
		config = DefaultRedisConfig()
	}
	return &RedisLockManager{
		client: client,
		config: config,
	}
}

// RedisLock 表示活跃的分布式锁
type RedisLock struct {
	manager *RedisLockManager
	key     string
	value   string
	ttl     time.Duration
}

// TryAcquire 尝试获取一次锁
func (l *RedisLock) TryAcquire(ctx context.Context) (bool, error) {
	status, err := l.manager.client.SetArgs(ctx, l.fullKey(), l.value, redis.SetArgs{
		TTL:  l.ttl,
		Mode: "NX",
	}).Result()
	if errors.Is(err, redis.Nil) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("redis set with nx failed: %w", err)
	}
	return status == "OK", nil
}

// SpinAcquire 带重试逻辑地获取锁
func (l *RedisLock) SpinAcquire(ctx context.Context) error {
	spinInterval := time.Duration(l.manager.config.SpinIntervalMillis) * time.Millisecond
	maxRetries := l.manager.config.SpinMaxRetries

	for i := range maxRetries {
		acquired, err := l.TryAcquire(ctx)
		if err != nil {
			return fmt.Errorf("failed to try acquire lock on attempt %d: %w", i+1, err)
		}
		if acquired {
			return nil
		}

		// 未获取，等待并重试
		if i < maxRetries-1 { // 最后一次不休眠
			// 等待后重试

			select {
			case <-ctx.Done():
				return fmt.Errorf("context cancelled while waiting for lock: %w", ctx.Err())
			case <-time.After(spinInterval):
				// 继续下一轮
			}
		}
	}

	return fmt.Errorf("%w %s after %d attempts", ErrLockAcquisitionFailed, l.key, maxRetries)
}

// Refresh 在值匹配时刷新锁 TTL。
func (l *RedisLock) Refresh(ctx context.Context) (bool, error) {
	return l.withOwnerMutation(ctx, func(pipe redis.Pipeliner) error {
		pipe.PExpire(ctx, l.fullKey(), l.ttl)
		return nil
	})
}

// Release 在值匹配时释放锁
func (l *RedisLock) Release(ctx context.Context) error {
	_, err := l.withOwnerMutation(ctx, func(pipe redis.Pipeliner) error {
		pipe.Del(ctx, l.fullKey())
		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to release redis lock: %w", err)
	}
	return nil
}

func (l *RedisLock) withOwnerMutation(ctx context.Context, mutate func(pipe redis.Pipeliner) error) (bool, error) {
	fullKey := l.fullKey()
	for range 3 {
		var matched bool
		err := l.manager.client.Watch(ctx, func(tx *redis.Tx) error {
			currentValue, err := tx.Get(ctx, fullKey).Result()
			if errors.Is(err, redis.Nil) {
				return nil
			}
			if err != nil {
				return fmt.Errorf("get current redis lock owner: %w", err)
			}
			if currentValue != l.value {
				return nil
			}
			matched = true
			_, err = tx.TxPipelined(ctx, mutate)
			if err != nil {
				return fmt.Errorf("execute redis lock mutation: %w", err)
			}
			return nil
		}, fullKey)
		switch {
		case err == nil:
			return matched, nil
		case errors.Is(err, redis.TxFailedErr):
			continue
		default:
			return false, fmt.Errorf("watch redis lock mutation: %w", err)
		}
	}
	return false, fmt.Errorf("%w: %s", errRedisOptimisticMutationFailed, l.key)
}

func (l *RedisLock) fullKey() string {
	return l.manager.config.LockPrefix + l.key
}

// CreateLock 创建新的 Redis 锁实例
func (m *RedisLockManager) CreateLock(key string, ttl time.Duration) *RedisLock {
	return &RedisLock{
		manager: m,
		key:     key,
		value:   uuid.New().String(),
		ttl:     ttl,
	}
}

// NewRedisClient 使用完整连接池配置创建 Redis 客户端
func NewRedisClient(cfg *configpkg.RedisConfig) (*redis.Client, error) {
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)

	options := &redis.Options{
		Addr:     addr,
		Username: cfg.Username,
		Password: cfg.AuthValue,
		DB:       cfg.DB,

		// 连接池设置
		PoolSize:        cfg.PoolSize,
		MinIdleConns:    cfg.MinIdleConns,
		ConnMaxIdleTime: time.Duration(cfg.ConnMaxIdleTime) * time.Second,
		ConnMaxLifetime: time.Duration(cfg.ConnMaxLifetime) * time.Second,
		PoolTimeout:     time.Duration(cfg.PoolTimeout) * time.Second,
	}

	client := redis.NewClient(options)

	// 测试连接
	const connectionTestTimeout = 5 * time.Second
	ctx, cancel := context.WithTimeout(context.Background(), connectionTestTimeout)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis at %s: %w", addr, err)
	}

	// 已连接
	return client, nil
}

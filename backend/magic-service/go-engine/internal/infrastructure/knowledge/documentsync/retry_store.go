package documentsync

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	defaultRabbitMQRetryTTL = 24 * time.Hour
	redisRetryKeyPrefix     = "knowledge:document_sync:retry:"
	redisAttemptKeyPrefix   = "knowledge:document_sync:delivery_attempt:"
)

var (
	errRabbitMQRetryKeyRequired        = errors.New("rabbitmq document sync retry key is required")
	errRabbitMQRedisRetryStoreRequired = errors.New("rabbitmq document sync redis retry store is required")
	errRabbitMQAttemptKeyRequired      = errors.New("rabbitmq document sync delivery attempt key is required")
)

// RetryStore 记录 RabbitMQ document_sync 任务的失败重试次数。
type RetryStore interface {
	Increment(ctx context.Context, taskKey string) (int, error)
	Reset(ctx context.Context, taskKey string) error
}

// DeliveryAttemptStore 记录 RabbitMQ document_sync 任务被投递消费的次数。
type DeliveryAttemptStore interface {
	Increment(ctx context.Context, taskKey string) (int, error)
	Reset(ctx context.Context, taskKey string) error
}

// RedisRetryStore 用 Redis 记录跨 worker 共享的 document_sync 重试次数。
type RedisRetryStore struct {
	client *redis.Client
	ttl    time.Duration
}

// NewRedisRetryStore 创建 Redis-backed retry store。
func NewRedisRetryStore(client *redis.Client) *RedisRetryStore {
	if client == nil {
		return nil
	}
	return &RedisRetryStore{client: client, ttl: defaultRabbitMQRetryTTL}
}

// Increment 将任务失败次数加一，并刷新 1 天 TTL。
func (s *RedisRetryStore) Increment(ctx context.Context, taskKey string) (int, error) {
	if s == nil || s.client == nil {
		return 0, errRabbitMQRedisRetryStoreRequired
	}
	key, err := s.redisKey(taskKey)
	if err != nil {
		return 0, err
	}

	var incr *redis.IntCmd
	_, err = s.client.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
		incr = pipe.Incr(ctx, key)
		pipe.Expire(ctx, key, s.retryTTL())
		return nil
	})
	if err != nil {
		return 0, fmt.Errorf("increment rabbitmq document sync retry counter: %w", err)
	}
	return int(incr.Val()), nil
}

// Reset 清理任务重试次数。
func (s *RedisRetryStore) Reset(ctx context.Context, taskKey string) error {
	if s == nil || s.client == nil {
		return nil
	}
	key, err := s.redisKey(taskKey)
	if err != nil {
		return err
	}
	if err := s.client.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("reset rabbitmq document sync retry counter: %w", err)
	}
	return nil
}

func (s *RedisRetryStore) redisKey(taskKey string) (string, error) {
	trimmedKey := strings.TrimSpace(taskKey)
	if trimmedKey == "" {
		return "", errRabbitMQRetryKeyRequired
	}
	return redisRetryKeyPrefix + trimmedKey, nil
}

func (s *RedisRetryStore) retryTTL() time.Duration {
	if s == nil || s.ttl <= 0 {
		return defaultRabbitMQRetryTTL
	}
	return s.ttl
}

// RedisDeliveryAttemptStore 用 Redis 记录跨 worker 共享的 document_sync 投递消费次数。
type RedisDeliveryAttemptStore struct {
	client *redis.Client
	ttl    time.Duration
}

// NewRedisDeliveryAttemptStore 创建 Redis-backed delivery attempt store。
func NewRedisDeliveryAttemptStore(client *redis.Client) *RedisDeliveryAttemptStore {
	if client == nil {
		return nil
	}
	return &RedisDeliveryAttemptStore{client: client, ttl: defaultRabbitMQRetryTTL}
}

// Increment 将任务投递消费次数加一，并刷新 1 天 TTL。
func (s *RedisDeliveryAttemptStore) Increment(ctx context.Context, taskKey string) (int, error) {
	if s == nil || s.client == nil {
		return 0, errRabbitMQRedisRetryStoreRequired
	}
	key, err := s.redisKey(taskKey)
	if err != nil {
		return 0, err
	}

	var incr *redis.IntCmd
	_, err = s.client.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
		incr = pipe.Incr(ctx, key)
		pipe.Expire(ctx, key, s.retryTTL())
		return nil
	})
	if err != nil {
		return 0, fmt.Errorf("increment rabbitmq document sync delivery attempt counter: %w", err)
	}
	return int(incr.Val()), nil
}

// Reset 清理任务投递消费次数。
func (s *RedisDeliveryAttemptStore) Reset(ctx context.Context, taskKey string) error {
	if s == nil || s.client == nil {
		return nil
	}
	key, err := s.redisKey(taskKey)
	if err != nil {
		return err
	}
	if err := s.client.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("reset rabbitmq document sync delivery attempt counter: %w", err)
	}
	return nil
}

func (s *RedisDeliveryAttemptStore) redisKey(taskKey string) (string, error) {
	trimmedKey := strings.TrimSpace(taskKey)
	if trimmedKey == "" {
		return "", errRabbitMQAttemptKeyRequired
	}
	return redisAttemptKeyPrefix + trimmedKey, nil
}

func (s *RedisDeliveryAttemptStore) retryTTL() time.Duration {
	if s == nil || s.ttl <= 0 {
		return defaultRabbitMQRetryTTL
	}
	return s.ttl
}

// Package ratelimit provides reusable distributed rate limiters.
package ratelimit

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	defaultKeyPrefix = "ratelimit:"
	defaultTTL       = 5 * time.Minute
	defaultMaxSleep  = time.Second
	minRetryAfter    = time.Millisecond
	milliseconds     = int64(time.Millisecond)
)

var (
	// ErrRedisClientRequired indicates the token bucket has no Redis client.
	ErrRedisClientRequired = errors.New("redis rate limiter client is required")
	// ErrKeyRequired indicates the caller did not provide a limiter key.
	ErrKeyRequired = errors.New("rate limiter key is required")
	// ErrInvalidConfig indicates an invalid token bucket configuration.
	ErrInvalidConfig = errors.New("invalid rate limiter config")
	// ErrWaitTimeout indicates Wait did not acquire a token before timeout.
	ErrWaitTimeout = errors.New("rate limiter wait timeout")
	// ErrUnavailable indicates the limiter backend is unavailable.
	ErrUnavailable = errors.New("rate limiter unavailable")

	errUnexpectedScriptResult = errors.New("unexpected redis token bucket script result")
	errUnexpectedInteger      = errors.New("unexpected integer value")
	errUnexpectedFloat        = errors.New("unexpected float value")
)

// Config describes a Redis-backed token bucket.
type Config struct {
	KeyPrefix     string
	RatePerSecond float64
	Burst         int
	TTL           time.Duration
	MaxSleep      time.Duration
}

// Result describes a token bucket decision.
type Result struct {
	Allowed    bool
	Remaining  float64
	RetryAfter time.Duration
	Waited     time.Duration
}

// RedisTokenBucket implements a Redis-backed distributed token bucket.
type RedisTokenBucket struct {
	client *redis.Client
	config Config
	script *redis.Script
	sleep  func(context.Context, time.Duration) error
	now    func() time.Time
}

// NewRedisTokenBucket creates a Redis-backed token bucket.
func NewRedisTokenBucket(client *redis.Client, config Config) (*RedisTokenBucket, error) {
	if client == nil {
		return nil, ErrRedisClientRequired
	}
	normalized, err := normalizeConfig(config)
	if err != nil {
		return nil, err
	}
	return &RedisTokenBucket{
		client: client,
		config: normalized,
		script: redis.NewScript(redisTokenBucketScript),
		sleep:  sleepContext,
		now:    time.Now,
	}, nil
}

// Allow attempts to consume one token without waiting.
func (b *RedisTokenBucket) Allow(ctx context.Context, key string) (Result, error) {
	return b.take(ctx, key)
}

// Wait waits until a token is available or timeout is reached.
func (b *RedisTokenBucket) Wait(ctx context.Context, key string, timeout time.Duration) (Result, error) {
	startedAt := b.nowTime()
	var last Result
	for {
		result, err := b.Allow(ctx, key)
		if err != nil {
			return result, err
		}
		if result.Allowed {
			result.Waited = b.nowTime().Sub(startedAt)
			return result, nil
		}
		last = result

		elapsed := b.nowTime().Sub(startedAt)
		if timeout <= 0 || elapsed >= timeout {
			last.Waited = elapsed
			return last, ErrWaitTimeout
		}

		sleepFor := b.nextSleep(result.RetryAfter, timeout-elapsed)
		if err := b.sleep(ctx, sleepFor); err != nil {
			last.Waited = b.nowTime().Sub(startedAt)
			return last, err
		}
	}
}

func (b *RedisTokenBucket) take(ctx context.Context, key string) (Result, error) {
	if b == nil || b.client == nil {
		return Result{}, ErrRedisClientRequired
	}
	redisKey, err := b.redisKey(key)
	if err != nil {
		return Result{}, err
	}
	raw, err := b.script.Run(
		ctx,
		b.client,
		[]string{redisKey},
		strconv.FormatFloat(b.config.RatePerSecond, 'f', -1, 64),
		strconv.Itoa(b.config.Burst),
		strconv.FormatInt(b.config.TTL.Milliseconds(), 10),
	).Result()
	if err != nil {
		return Result{}, fmt.Errorf("run redis token bucket script: %w", err)
	}
	return parseScriptResult(raw)
}

func (b *RedisTokenBucket) redisKey(key string) (string, error) {
	trimmed := strings.TrimSpace(key)
	if trimmed == "" {
		return "", ErrKeyRequired
	}
	return b.config.KeyPrefix + trimmed, nil
}

func (b *RedisTokenBucket) nextSleep(retryAfter, remaining time.Duration) time.Duration {
	sleepFor := retryAfter
	if sleepFor <= 0 {
		sleepFor = minRetryAfter
	}
	if b != nil && b.config.MaxSleep > 0 && sleepFor > b.config.MaxSleep {
		sleepFor = b.config.MaxSleep
	}
	if remaining > 0 && sleepFor > remaining {
		sleepFor = remaining
	}
	if sleepFor <= 0 {
		return minRetryAfter
	}
	return sleepFor
}

func (b *RedisTokenBucket) nowTime() time.Time {
	if b != nil && b.now != nil {
		return b.now()
	}
	return time.Now()
}

func normalizeConfig(config Config) (Config, error) {
	if config.RatePerSecond <= 0 {
		return Config{}, fmt.Errorf("%w: rate_per_second must be positive", ErrInvalidConfig)
	}
	if config.Burst <= 0 {
		return Config{}, fmt.Errorf("%w: burst must be positive", ErrInvalidConfig)
	}
	if strings.TrimSpace(config.KeyPrefix) == "" {
		config.KeyPrefix = defaultKeyPrefix
	}
	if config.TTL <= 0 {
		config.TTL = defaultTTL
	}
	if config.MaxSleep <= 0 {
		config.MaxSleep = defaultMaxSleep
	}
	return config, nil
}

func parseScriptResult(raw any) (Result, error) {
	values, ok := raw.([]any)
	if !ok || len(values) < 3 {
		return Result{}, fmt.Errorf("%w: %#v", errUnexpectedScriptResult, raw)
	}
	allowed, err := parseInt64(values[0])
	if err != nil {
		return Result{}, fmt.Errorf("parse token bucket allowed: %w", err)
	}
	remaining, err := parseFloat64(values[1])
	if err != nil {
		return Result{}, fmt.Errorf("parse token bucket remaining: %w", err)
	}
	retryAfterMillis, err := parseInt64(values[2])
	if err != nil {
		return Result{}, fmt.Errorf("parse token bucket retry_after: %w", err)
	}
	return Result{
		Allowed:    allowed == 1,
		Remaining:  remaining,
		RetryAfter: time.Duration(retryAfterMillis * milliseconds),
	}, nil
}

func parseInt64(value any) (int64, error) {
	switch typed := value.(type) {
	case int64:
		return typed, nil
	case int:
		return int64(typed), nil
	case string:
		parsed, err := strconv.ParseInt(typed, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("parse integer string: %w", err)
		}
		return parsed, nil
	case []byte:
		parsed, err := strconv.ParseInt(string(typed), 10, 64)
		if err != nil {
			return 0, fmt.Errorf("parse integer bytes: %w", err)
		}
		return parsed, nil
	default:
		return 0, fmt.Errorf("%w: %T", errUnexpectedInteger, value)
	}
}

func parseFloat64(value any) (float64, error) {
	switch typed := value.(type) {
	case float64:
		return typed, nil
	case int64:
		return float64(typed), nil
	case int:
		return float64(typed), nil
	case string:
		parsed, err := strconv.ParseFloat(typed, 64)
		if err != nil {
			return 0, fmt.Errorf("parse float string: %w", err)
		}
		return parsed, nil
	case []byte:
		parsed, err := strconv.ParseFloat(string(typed), 64)
		if err != nil {
			return 0, fmt.Errorf("parse float bytes: %w", err)
		}
		return parsed, nil
	default:
		return 0, fmt.Errorf("%w: %T", errUnexpectedFloat, value)
	}
}

func sleepContext(ctx context.Context, duration time.Duration) error {
	timer := time.NewTimer(duration)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return fmt.Errorf("rate limiter wait context done: %w", ctx.Err())
	case <-timer.C:
		return nil
	}
}

const redisTokenBucketScript = `
local key = KEYS[1]
local rate = tonumber(ARGV[1])
local burst = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

local now_parts = redis.call("TIME")
local now_ms = tonumber(now_parts[1]) * 1000 + math.floor(tonumber(now_parts[2]) / 1000)

local tokens = tonumber(redis.call("HGET", key, "tokens"))
local updated_at = tonumber(redis.call("HGET", key, "updated_at"))
if tokens == nil then
  tokens = burst
end
if updated_at == nil or updated_at > now_ms then
  updated_at = now_ms
end

local elapsed_ms = math.max(0, now_ms - updated_at)
tokens = math.min(burst, tokens + elapsed_ms * rate / 1000)

local allowed = 0
local retry_after_ms = 0
if tokens >= 1 then
  allowed = 1
  tokens = tokens - 1
else
  local missing = 1 - tokens
  retry_after_ms = math.ceil(missing * 1000 / rate)
end

redis.call("HSET", key, "tokens", tostring(tokens), "updated_at", now_ms)
redis.call("PEXPIRE", key, ttl)

return {allowed, tostring(tokens), retry_after_ms}
`

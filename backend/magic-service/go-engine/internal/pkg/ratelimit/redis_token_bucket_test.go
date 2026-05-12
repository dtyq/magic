package ratelimit_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	miniredis "github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"magic/internal/pkg/ratelimit"
)

const (
	testRatePerSecond = 1000
	testSlowRate      = 0.01
	testBurst         = 3
	testWaitTimeout   = 20 * time.Millisecond
	testLimiterTTL    = time.Minute
	testMaxSleep      = 2 * time.Millisecond
	testAttemptCount  = 12
)

func TestRedisTokenBucketAllowConsumesBurst(t *testing.T) {
	t.Parallel()

	_, client := newRateLimitRedis(t)
	limiter := newTestLimiter(t, client, ratelimit.Config{
		RatePerSecond: testSlowRate,
		Burst:         2,
	})

	first, err := limiter.Allow(context.Background(), "burst")
	if err != nil {
		t.Fatalf("first allow: %v", err)
	}
	second, err := limiter.Allow(context.Background(), "burst")
	if err != nil {
		t.Fatalf("second allow: %v", err)
	}
	third, err := limiter.Allow(context.Background(), "burst")
	if err != nil {
		t.Fatalf("third allow: %v", err)
	}

	if !first.Allowed || !second.Allowed {
		t.Fatalf("expected first two requests to pass, got %#v %#v", first, second)
	}
	if third.Allowed || third.RetryAfter <= 0 {
		t.Fatalf("expected third request to wait, got %#v", third)
	}
}

func TestRedisTokenBucketWaitRefillsToken(t *testing.T) {
	t.Parallel()

	_, client := newRateLimitRedis(t)
	limiter := newTestLimiter(t, client, ratelimit.Config{
		RatePerSecond: testRatePerSecond,
		Burst:         1,
		MaxSleep:      testMaxSleep,
	})
	if result, err := limiter.Allow(context.Background(), "wait-refill"); err != nil || !result.Allowed {
		t.Fatalf("initial allow result=%#v err=%v", result, err)
	}

	result, err := limiter.Wait(context.Background(), "wait-refill", testWaitTimeout)
	if err != nil {
		t.Fatalf("wait refill: %v", err)
	}
	if !result.Allowed || result.Waited <= 0 {
		t.Fatalf("expected wait to acquire a later token, got %#v", result)
	}
}

func TestRedisTokenBucketWaitTimeout(t *testing.T) {
	t.Parallel()

	server, client := newRateLimitRedis(t)
	server.SetTime(time.Unix(1_800_000_000, 0))
	limiter := newTestLimiter(t, client, ratelimit.Config{
		RatePerSecond: 1,
		Burst:         1,
		MaxSleep:      time.Millisecond,
	})
	if result, err := limiter.Allow(context.Background(), "timeout"); err != nil || !result.Allowed {
		t.Fatalf("initial allow result=%#v err=%v", result, err)
	}

	result, err := limiter.Wait(context.Background(), "timeout", time.Millisecond)
	if err == nil {
		t.Fatal("expected wait timeout error")
	}
	if !errors.Is(err, ratelimit.ErrWaitTimeout) {
		t.Fatalf("expected ErrWaitTimeout, got %v", err)
	}
	if result.Allowed {
		t.Fatalf("expected timeout result not to be allowed, got %#v", result)
	}
}

func TestRedisTokenBucketConcurrentAllowIsAtomic(t *testing.T) {
	t.Parallel()

	server, client := newRateLimitRedis(t)
	server.SetTime(time.Unix(1_800_000_000, 0))
	limiter := newTestLimiter(t, client, ratelimit.Config{
		RatePerSecond: testSlowRate,
		Burst:         testBurst,
	})

	var (
		mu      sync.Mutex
		allowed int
		wg      sync.WaitGroup
	)
	for range testAttemptCount {
		wg.Go(func() {
			result, err := limiter.Allow(context.Background(), "atomic")
			if err != nil {
				t.Errorf("allow: %v", err)
				return
			}
			if result.Allowed {
				mu.Lock()
				allowed++
				mu.Unlock()
			}
		})
	}
	wg.Wait()

	if allowed != testBurst {
		t.Fatalf("expected exactly %d allowed calls, got %d", testBurst, allowed)
	}
}

func newRateLimitRedis(t *testing.T) (*miniredis.Miniredis, *redis.Client) {
	t.Helper()

	server, err := miniredis.Run()
	if err != nil {
		t.Fatalf("start miniredis: %v", err)
	}
	t.Cleanup(server.Close)
	client := redis.NewClient(&redis.Options{Addr: server.Addr(), PoolSize: 1})
	t.Cleanup(func() { _ = client.Close() })
	return server, client
}

func newTestLimiter(t *testing.T, client *redis.Client, config ratelimit.Config) *ratelimit.RedisTokenBucket {
	t.Helper()

	if config.TTL <= 0 {
		config.TTL = testLimiterTTL
	}
	limiter, err := ratelimit.NewRedisTokenBucket(client, config)
	if err != nil {
		t.Fatalf("new limiter: %v", err)
	}
	return limiter
}

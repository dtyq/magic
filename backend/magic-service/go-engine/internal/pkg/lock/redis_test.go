package lock_test

import (
	"context"
	"errors"
	"net"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

	miniredis "github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"go.uber.org/goleak"

	configpkg "magic/internal/config/autoload"
	"magic/internal/pkg/lock"
)

// TestMain 用于检测 goroutine 泄漏
func TestMain(m *testing.M) {
	goleak.VerifyTestMain(m)
}

func newTestRedis(t *testing.T) (*miniredis.Miniredis, *redis.Client) {
	t.Helper()
	s, err := miniredis.Run()
	if err != nil {
		if isListenPermissionError(err) {
			t.Skipf("skip miniredis: %v", err)
		}
		t.Fatalf("start miniredis: %v", err)
	}
	client := redis.NewClient(&redis.Options{
		Addr:         s.Addr(),
		DialTimeout:  20 * time.Millisecond,
		ReadTimeout:  20 * time.Millisecond,
		WriteTimeout: 20 * time.Millisecond,
		PoolTimeout:  20 * time.Millisecond,
		PoolSize:     1,
		MinIdleConns: 0,
		MaxRetries:   0,
	})
	t.Cleanup(func() {
		_ = client.Close()
	})
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Fatalf("ping redis: %v", err)
	}
	return s, client
}

func TestRedisLock_TryAcquireAndRelease(t *testing.T) {
	t.Parallel()

	s, client := newTestRedis(t)
	defer s.Close()
	defer func() { _ = client.Close() }()

	mgr := lock.NewRedisLockManager(client, &lock.RedisConfig{LockPrefix: "lock:", LockTTLSeconds: 2})
	lk := mgr.CreateLock("k1", time.Second)

	ctx := context.Background()
	ok, err := lk.TryAcquire(ctx)
	if err != nil || !ok {
		t.Fatalf("expected acquire ok, err=%v ok=%v", err, ok)
	}

	// 第二次获取应失败
	ok, err = lk.TryAcquire(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Fatalf("expected acquire fail when already held")
	}

	// 释放
	if err := lk.Release(ctx); err != nil {
		t.Fatalf("release error: %v", err)
	}

	// 再次获取应成功
	ok, err = lk.TryAcquire(ctx)
	if err != nil || !ok {
		t.Fatalf("expected acquire ok after release, err=%v ok=%v", err, ok)
	}
}

func TestRedisLock_SpinAcquire(t *testing.T) {
	t.Parallel()

	s, client := newTestRedis(t)
	defer s.Close()
	defer func() { _ = client.Close() }()

	mgr := lock.NewRedisLockManager(client, &lock.RedisConfig{
		LockPrefix:         "lock:",
		LockTTLSeconds:     1,
		SpinIntervalMillis: 5,
		SpinMaxRetries:     20,
	})

	// 在另一个 goroutine 先持有锁，稍后释放
	lk1 := mgr.CreateLock("k2", 200*time.Millisecond)
	ctx := context.Background()
	ok, err := lk1.TryAcquire(ctx)
	if err != nil || !ok {
		t.Fatalf("pre acquire: err=%v ok=%v", err, ok)
	}

	done := make(chan struct{})
	go func() {
		defer close(done)
		time.Sleep(30 * time.Millisecond)
		_ = lk1.Release(context.Background())
	}()

	lk2 := mgr.CreateLock("k2", 200*time.Millisecond)
	if err := lk2.SpinAcquire(ctx); err != nil {
		t.Fatalf("spin acquire should eventually succeed: %v", err)
	}
	<-done
}

func TestRedisLock_DefaultConfigAndReleaseNotHeld(t *testing.T) {
	t.Parallel()

	s, client := newTestRedis(t)
	defer s.Close()
	defer func() { _ = client.Close() }()

	// 传入 nil 配置以覆盖 DefaultRedisConfig 路径
	mgr := lock.NewRedisLockManager(client, nil)
	lk1 := mgr.CreateLock("k3", 500*time.Millisecond)
	ctx := context.Background()
	ok, err := lk1.TryAcquire(ctx)
	if err != nil || !ok {
		t.Fatalf("acquire: err=%v ok=%v", err, ok)
	}

	// 不同值的锁实例尝试释放 -> 脚本走返回 0 分支
	lk2 := mgr.CreateLock("k3", 500*time.Millisecond)
	if err := lk2.Release(ctx); err != nil {
		t.Fatalf("release not-held should not error: %v", err)
	}
}

func TestRedisLock_Refresh(t *testing.T) {
	t.Parallel()

	s, client := newTestRedis(t)
	defer s.Close()
	defer func() { _ = client.Close() }()

	mgr := lock.NewRedisLockManager(client, &lock.RedisConfig{LockPrefix: "lock:"})
	lk := mgr.CreateLock("k-refresh", 2*time.Second)
	ctx := context.Background()

	ok, err := lk.TryAcquire(ctx)
	if err != nil || !ok {
		t.Fatalf("acquire: err=%v ok=%v", err, ok)
	}

	s.FastForward(1500 * time.Millisecond)

	refreshed, err := lk.Refresh(ctx)
	if err != nil {
		t.Fatalf("refresh error: %v", err)
	}
	if !refreshed {
		t.Fatal("expected refresh to succeed")
	}

	s.FastForward(time.Second)
	exists := s.Exists("lock:k-refresh")
	if !exists {
		t.Fatal("expected lock key to remain after refresh")
	}
}

func TestRedisLock_SpinAcquire_ContextCanceled(t *testing.T) {
	t.Parallel()

	s, client := newTestRedis(t)
	defer s.Close()
	defer func() { _ = client.Close() }()

	mgr := lock.NewRedisLockManager(client, &lock.RedisConfig{LockPrefix: "lock:", SpinIntervalMillis: 50, SpinMaxRetries: 5})
	lk1 := mgr.CreateLock("k4", time.Second)
	ctx := context.Background()
	ok, err := lk1.TryAcquire(ctx)
	if err != nil || !ok {
		t.Fatalf("pre acquire: err=%v ok=%v", err, ok)
	}

	lk2 := mgr.CreateLock("k4", time.Second)
	cctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()
	if err := lk2.SpinAcquire(cctx); err == nil {
		t.Fatal("expected context cancelled error")
	}
}

func TestRedisLock_TryAcquire_RedisError(t *testing.T) {
	t.Parallel()

	s, client := newTestRedis(t)
	defer func() { _ = client.Close() }()
	mgr := lock.NewRedisLockManager(client, &lock.RedisConfig{LockPrefix: "lock:"})
	lk := mgr.CreateLock("k5", time.Second)
	s.Close() // 关闭服务器以触发网络错误
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	_, err := lk.TryAcquire(ctx)
	if err == nil {
		t.Fatal("expected error from redis on TryAcquire")
	}
}

func TestRedisLock_Release_RedisError(t *testing.T) {
	t.Parallel()

	s, client := newTestRedis(t)
	defer func() { _ = client.Close() }()
	mgr := lock.NewRedisLockManager(client, &lock.RedisConfig{LockPrefix: "lock:"})
	lk := mgr.CreateLock("k6", time.Second)
	ctx := context.Background()
	_, _ = lk.TryAcquire(ctx)
	s.Close() // 关闭服务器以触发释放时错误
	releaseCtx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	if err := lk.Release(releaseCtx); err == nil {
		t.Fatal("expected error from redis on Release")
	}
}

func TestNewRedisClient_WithPoolConfig(t *testing.T) {
	t.Parallel()

	s, err := miniredis.Run()
	if err != nil {
		if isListenPermissionError(err) {
			t.Skipf("skip miniredis: %v", err)
		}
		t.Fatalf("start miniredis: %v", err)
	}
	defer s.Close()
	host, portStr, err := net.SplitHostPort(s.Addr())
	if err != nil {
		t.Fatalf("split addr: %v", err)
	}
	port, _ := strconv.Atoi(portStr)

	cfg := &configpkg.RedisConfig{
		Host:            host,
		Port:            port,
		Username:        "",
		AuthValue:       "",
		DB:              0,
		PoolSize:        1,
		MinIdleConns:    0,
		ConnMaxIdleTime: 60,
		ConnMaxLifetime: 300,
		PoolTimeout:     2,
	}
	client, err := lock.NewRedisClient(cfg)
	if err != nil {
		t.Fatalf("NewRedisClient: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Fatalf("ping: %v", err)
	}
	t.Cleanup(func() {
		_ = client.Close()
	})
	defer func() { _ = client.Close() }()
}

func isListenPermissionError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, syscall.EPERM) || errors.Is(err, syscall.EACCES) {
		return true
	}
	var opErr *net.OpError
	if errors.As(err, &opErr) {
		if errors.Is(opErr.Err, syscall.EPERM) || errors.Is(opErr.Err, syscall.EACCES) {
			return true
		}
	}
	msg := err.Error()
	return strings.Contains(msg, "operation not permitted") || strings.Contains(msg, "permission denied")
}

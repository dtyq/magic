package infra_test

import (
	"context"
	"errors"
	"net"
	"strings"
	"syscall"
	"testing"
	"time"

	miniredis "github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	autoloadcfg "magic/internal/config/autoload"
	diinfra "magic/internal/di/infra"
	"magic/internal/infrastructure/logging"
)

func TestProvideRedisLockManager(t *testing.T) {
	t.Parallel()
	// 使用 miniredis 避免端口冲突
	s, err := miniredis.Run()
	if err != nil {
		if isListenPermissionError(err) {
			t.Skipf("skip miniredis: %v", err)
		}
		t.Fatalf("start miniredis: %v", err)
	}
	defer s.Close()

	client := redis.NewClient(&redis.Options{Addr: s.Addr()})
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Fatalf("ping redis: %v", err)
	}

	cfg := &autoloadcfg.Config{
		Redis: autoloadcfg.RedisConfig{
			LockPrefix:         "lock:",
			LockTTLSeconds:     1,
			SpinIntervalMillis: 10,
			SpinMaxRetries:     1,
		},
	}

	manager := diinfra.ProvideRedisLockManager(client, cfg)
	if manager == nil {
		t.Fatalf("expected non-nil RedisLockManager")
	}
}

func TestProvideContentLoader(t *testing.T) {
	t.Parallel()
	loader := diinfra.ProvideContentLoader()
	if loader == nil {
		t.Fatalf("expected non-nil ContentLoader")
	}
}

func TestProvidePHPFileRPCClient(t *testing.T) {
	t.Parallel()
	client := diinfra.ProvidePHPFileRPCClient(nil, logging.New())
	if client == nil {
		t.Fatal("expected non-nil PHPFileRPCClient")
	}
}

// isListenPermissionError 检查是否是端口监听权限错误
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

package infra_test

import (
	"context"
	"database/sql"
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
	mysqlinfra "magic/internal/infrastructure/persistence/mysql"
	mysqlembeddingcache "magic/internal/infrastructure/persistence/mysql/knowledge/embeddingcache"
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

func TestProvideDocumentSyncRabbitMQBrokerValidatesConfig(t *testing.T) {
	t.Parallel()

	logger := logging.New().Named("infra.providers.test")
	cfg := &autoloadcfg.Config{
		RabbitMQ: autoloadcfg.RabbitMQConfig{
			Enabled:   true,
			Host:      "   ",
			Port:      5672,
			Username:  "guest",
			AuthValue: "guest",
			VHost:     "/",
		},
	}

	broker, cleanup, err := diinfra.ProvideDocumentSyncRabbitMQBroker(cfg, logger)
	if err == nil {
		t.Fatal("expected invalid rabbitmq config to fail validation")
	}
	if broker != nil {
		t.Fatalf("expected nil broker, got %#v", broker)
	}
	if cleanup == nil {
		t.Fatal("expected non-nil cleanup")
	}
	if !strings.Contains(err.Error(), "rabbitmq host is required") {
		t.Fatalf("expected host validation error, got %v", err)
	}
}

func TestProvideHealthCheckServiceCloseClosesInfraClients(t *testing.T) {
	t.Parallel()

	redisServer, err := miniredis.Run()
	if err != nil {
		if isListenPermissionError(err) {
			t.Skipf("skip miniredis: %v", err)
		}
		t.Fatalf("start miniredis: %v", err)
	}
	defer redisServer.Close()

	redisClient := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})
	t.Cleanup(func() { _ = redisClient.Close() })

	db, err := sql.Open("mysql", "root:password@tcp(127.0.0.1:65535)/magic")
	if err != nil {
		t.Fatalf("open mysql db handle: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	logger := logging.New().Named("infra.providers.test")
	mysqlClient := mysqlinfra.NewSQLCClientWithDB(db, logger.Named("mysql"), false)
	embeddingCacheRepo := mysqlembeddingcache.NewRepository(mysqlClient, logger.Named("embeddingcache"))
	svc := diinfra.ProvideHealthCheckService(mysqlClient, redisClient, embeddingCacheRepo, nil, nil)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := redisClient.Ping(ctx).Err(); err != nil {
		t.Fatalf("ping redis before close: %v", err)
	}

	if err := svc.Close(ctx); err != nil {
		t.Fatalf("close health check service: %v", err)
	}

	if err := redisClient.Ping(ctx).Err(); err == nil || !strings.Contains(err.Error(), "closed") {
		t.Fatalf("expected closed redis client error, got %v", err)
	}
	if err := db.PingContext(ctx); err == nil || !strings.Contains(err.Error(), "closed") {
		t.Fatalf("expected closed mysql db error, got %v", err)
	}
}

func TestProvideHealthCheckServiceCloseIsIdempotentForClosedRedisClient(t *testing.T) {
	t.Parallel()

	redisServer, err := miniredis.Run()
	if err != nil {
		if isListenPermissionError(err) {
			t.Skipf("skip miniredis: %v", err)
		}
		t.Fatalf("start miniredis: %v", err)
	}
	defer redisServer.Close()

	redisClient := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})
	t.Cleanup(func() { _ = redisClient.Close() })

	db, err := sql.Open("mysql", "root:password@tcp(127.0.0.1:65535)/magic")
	if err != nil {
		t.Fatalf("open mysql db handle: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	logger := logging.New().Named("infra.providers.test")
	mysqlClient := mysqlinfra.NewSQLCClientWithDB(db, logger.Named("mysql"), false)
	embeddingCacheRepo := mysqlembeddingcache.NewRepository(mysqlClient, logger.Named("embeddingcache"))
	svc := diinfra.ProvideHealthCheckService(mysqlClient, redisClient, embeddingCacheRepo, nil, nil)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := svc.Close(ctx); err != nil {
		t.Fatalf("first close health check service: %v", err)
	}
	if err := svc.Close(ctx); err != nil {
		t.Fatalf("second close health check service: %v", err)
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

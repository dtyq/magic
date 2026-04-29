package documentsync_test

import (
	"context"
	"testing"
	"time"

	miniredis "github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"magic/internal/infrastructure/knowledge/documentsync"
)

func TestRedisRetryStoreIncrementRefreshesOneDayTTLAndReset(t *testing.T) {
	t.Parallel()

	server, err := miniredis.Run()
	if err != nil {
		t.Fatalf("start miniredis: %v", err)
	}
	t.Cleanup(server.Close)

	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })

	ctx := context.Background()
	store := documentsync.NewRedisRetryStore(client)
	const taskKey = "TASK-1"

	count, err := store.Increment(ctx, taskKey)
	if err != nil {
		t.Fatalf("increment retry counter: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected first count 1, got %d", count)
	}

	count, err = store.Increment(ctx, taskKey)
	if err != nil {
		t.Fatalf("increment retry counter again: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected second count 2, got %d", count)
	}

	keys, err := client.Keys(ctx, "*"+taskKey).Result()
	if err != nil {
		t.Fatalf("scan retry keys: %v", err)
	}
	if len(keys) != 1 {
		t.Fatalf("expected one retry key, got %#v", keys)
	}
	ttl, err := client.TTL(ctx, keys[0]).Result()
	if err != nil {
		t.Fatalf("read retry ttl: %v", err)
	}
	if ttl <= 23*time.Hour || ttl > 24*time.Hour {
		t.Fatalf("expected retry ttl close to one day, got %s", ttl)
	}

	if err := store.Reset(ctx, taskKey); err != nil {
		t.Fatalf("reset retry counter: %v", err)
	}
	exists, err := client.Exists(ctx, keys[0]).Result()
	if err != nil {
		t.Fatalf("check retry key exists: %v", err)
	}
	if exists != 0 {
		t.Fatalf("expected retry key to be deleted, exists=%d", exists)
	}
}

func TestRedisRetryStoreRejectsEmptyKey(t *testing.T) {
	t.Parallel()

	server, err := miniredis.Run()
	if err != nil {
		t.Fatalf("start miniredis: %v", err)
	}
	t.Cleanup(server.Close)

	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })

	_, err = documentsync.NewRedisRetryStore(client).Increment(context.Background(), " ")
	if err == nil {
		t.Fatalf("expected empty key error, got %v", err)
	}
}

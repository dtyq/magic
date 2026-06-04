package sourcecacheversion_test

import (
	"context"
	"testing"
	"time"

	miniredis "github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	sourcecacheversion "magic/internal/infrastructure/knowledge/sourcecacheversion"
)

func TestRedisStoreBumpAndGetUseOrganizationScopedKeyWithOneHourTTL(t *testing.T) {
	t.Parallel()

	server, err := miniredis.Run()
	if err != nil {
		t.Fatalf("start miniredis: %v", err)
	}
	t.Cleanup(server.Close)

	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })

	ctx := context.Background()
	store := sourcecacheversion.NewRedisStore(client)
	version, err := store.Bump(ctx, "third_file:DT001:teamshare:904436220116320256")
	if err != nil {
		t.Fatalf("bump version: %v", err)
	}
	if version == "" {
		t.Fatal("expected non-empty version")
	}

	got, found, err := store.Get(ctx, "third_file:DT001:teamshare:904436220116320256")
	if err != nil {
		t.Fatalf("get version: %v", err)
	}
	if !found || got != version {
		t.Fatalf("expected version %q found, got %q found=%v", version, got, found)
	}

	const redisKey = "knowledge:source_cache_version:DT001:teamshare:904436220116320256"
	ttl, err := client.TTL(ctx, redisKey).Result()
	if err != nil {
		t.Fatalf("read ttl: %v", err)
	}
	if ttl <= 59*time.Minute || ttl > time.Hour {
		t.Fatalf("expected ttl close to one hour, got %s", ttl)
	}
}

func TestRedisStoreGetMissingVersionReturnsNotFound(t *testing.T) {
	t.Parallel()

	server, err := miniredis.Run()
	if err != nil {
		t.Fatalf("start miniredis: %v", err)
	}
	t.Cleanup(server.Close)

	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })

	version, found, err := sourcecacheversion.NewRedisStore(client).Get(context.Background(), "third_file:DT001:teamshare:missing")
	if err != nil {
		t.Fatalf("get missing version: %v", err)
	}
	if found || version != "" {
		t.Fatalf("expected missing version, got version=%q found=%v", version, found)
	}
}

func TestRedisStoreRejectsLegacyTeamshareSourceKeyPrefix(t *testing.T) {
	t.Parallel()

	server, err := miniredis.Run()
	if err != nil {
		t.Fatalf("start miniredis: %v", err)
	}
	t.Cleanup(server.Close)

	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })

	if _, err := sourcecacheversion.NewRedisStore(client).Bump(
		context.Background(),
		"teamshare:DT001:teamshare:904436220116320256",
	); err == nil {
		t.Fatal("expected legacy teamshare source key prefix to be rejected")
	}
}

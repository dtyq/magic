package client_test

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"magic/internal/infrastructure/logging"
	ipcclient "magic/internal/infrastructure/rpc/jsonrpc/client"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
	"magic/internal/pkg/thirdplatform"
)

func TestRedisThirdPlatformKnowledgeBaseCacheSetGetAndIsolation(t *testing.T) {
	t.Parallel()

	_, redisClient := newThirdPlatformKnowledgeBaseTestRedis(t)
	cache := ipcclient.NewRedisThirdPlatformKnowledgeBaseCache(redisClient)
	ctx := context.Background()
	first := []thirdplatform.KnowledgeBaseItem{{
		KnowledgeBaseID: "kb-1",
		Name:            "知识库 1",
		Description:     "desc-1",
	}}
	second := []thirdplatform.KnowledgeBaseItem{{
		KnowledgeBaseID: "kb-2",
		Name:            "知识库 2",
		Description:     "desc-2",
	}}

	if err := cache.Set(ctx, kbListInput("org-1", "user-1", "tp-user-1", "tp-org-1"), first); err != nil {
		t.Fatalf("Set() error = %v", err)
	}
	if err := cache.Set(ctx, kbListInput("org-1", "user-2", "tp-user-2", "tp-org-1"), second); err != nil {
		t.Fatalf("Set() second error = %v", err)
	}

	got, hit, err := cache.Get(ctx, kbListInput("org-1", "user-1", "tp-user-1", "tp-org-1"))
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if !hit {
		t.Fatal("expected cache hit for org-1/user-1")
	}
	if !reflect.DeepEqual(got, first) {
		t.Fatalf("unexpected cached items: %#v", got)
	}

	got, hit, err = cache.Get(ctx, kbListInput("org-1", "user-2", "tp-user-2", "tp-org-1"))
	if err != nil {
		t.Fatalf("Get() second error = %v", err)
	}
	if !hit {
		t.Fatal("expected cache hit for org-1/user-2")
	}
	if !reflect.DeepEqual(got, second) {
		t.Fatalf("unexpected cached items for second user: %#v", got)
	}

	_, hit, err = cache.Get(ctx, kbListInput("org-2", "user-1", "tp-user-1", "tp-org-1"))
	if err != nil {
		t.Fatalf("Get() third error = %v", err)
	}
	if hit {
		t.Fatal("expected cache miss for different organization")
	}

	_, hit, err = cache.Get(ctx, kbListInput("org-1", "user-1", "tp-user-2", "tp-org-1"))
	if err != nil {
		t.Fatalf("Get() fourth error = %v", err)
	}
	if hit {
		t.Fatal("expected cache miss for different third-platform user")
	}
}

func TestRedisThirdPlatformKnowledgeBaseCacheReturnsRedisErrors(t *testing.T) {
	t.Parallel()

	mini, redisClient := newThirdPlatformKnowledgeBaseTestRedis(t)
	cache := ipcclient.NewRedisThirdPlatformKnowledgeBaseCache(redisClient)
	ctx := context.Background()

	mini.Close()

	if err := cache.Set(ctx, kbListInput("org-1", "user-1", "tp-user-1", "tp-org-1"), []thirdplatform.KnowledgeBaseItem{}); err == nil {
		t.Fatal("expected Set() to fail when redis is unavailable")
	}
	if _, _, err := cache.Get(ctx, kbListInput("org-1", "user-1", "tp-user-1", "tp-org-1")); err == nil {
		t.Fatal("expected Get() to fail when redis is unavailable")
	}
}

func TestPHPThirdPlatformDocumentRPCClientListKnowledgeBasesCachesResults(t *testing.T) {
	t.Parallel()

	_, redisClient := newThirdPlatformKnowledgeBaseTestRedis(t)
	client := ipcclient.NewPHPThirdPlatformDocumentRPCClient(newThirdPlatformDocumentServerForTest(), logging.New(), redisClient)
	client.SetThirdPlatformDocumentClientReadyFuncForTest(func() bool { return true })

	expected := []thirdplatform.KnowledgeBaseItem{{
		KnowledgeBaseID: "kb-1",
		Name:            "知识库 1",
		Description:     "desc-1",
	}}
	callCount := 0
	client.SetCallListKnowledgeBasesRPCForTest(func(_ context.Context, _ *unixsocket.Server, params map[string]any, out any) error {
		callCount++
		if params["data_isolation"] == nil {
			t.Fatalf("expected data_isolation in params, got %#v", params)
		}
		result, ok := out.(*ipcclient.RPCResultForTest[[]thirdplatform.KnowledgeBaseItem])
		if !ok {
			t.Fatalf("unexpected out type: %T", out)
		}
		result.Code = 0
		result.Message = "success"
		result.Data = append([]thirdplatform.KnowledgeBaseItem(nil), expected...)
		return nil
	})

	first, err := client.ListKnowledgeBases(context.Background(), kbListInput("org-1", "user-1", "tp-user-1", "tp-org-1"))
	if err != nil {
		t.Fatalf("first ListKnowledgeBases() error = %v", err)
	}
	second, err := client.ListKnowledgeBases(context.Background(), kbListInput("org-1", "user-1", "tp-user-1", "tp-org-1"))
	if err != nil {
		t.Fatalf("second ListKnowledgeBases() error = %v", err)
	}

	if callCount != 1 {
		t.Fatalf("expected one RPC call, got %d", callCount)
	}
	if !reflect.DeepEqual(first, expected) {
		t.Fatalf("unexpected first result: %#v", first)
	}
	if !reflect.DeepEqual(second, expected) {
		t.Fatalf("unexpected second result: %#v", second)
	}
}

func TestPHPThirdPlatformDocumentRPCClientListKnowledgeBasesCachesEmptyResults(t *testing.T) {
	t.Parallel()

	_, redisClient := newThirdPlatformKnowledgeBaseTestRedis(t)
	client := ipcclient.NewPHPThirdPlatformDocumentRPCClient(newThirdPlatformDocumentServerForTest(), logging.New(), redisClient)
	client.SetThirdPlatformDocumentClientReadyFuncForTest(func() bool { return true })

	callCount := 0
	client.SetCallListKnowledgeBasesRPCForTest(func(context.Context, *unixsocket.Server, map[string]any, any) error {
		callCount++
		return nil
	})

	first, err := client.ListKnowledgeBases(context.Background(), kbListInput("org-1", "user-1", "tp-user-1", "tp-org-1"))
	if err != nil {
		t.Fatalf("first ListKnowledgeBases() error = %v", err)
	}
	second, err := client.ListKnowledgeBases(context.Background(), kbListInput("org-1", "user-1", "tp-user-1", "tp-org-1"))
	if err != nil {
		t.Fatalf("second ListKnowledgeBases() error = %v", err)
	}

	if callCount != 1 {
		t.Fatalf("expected one RPC call for empty result, got %d", callCount)
	}
	if len(first) != 0 || len(second) != 0 {
		t.Fatalf("expected empty results, got first=%#v second=%#v", first, second)
	}
}

func TestPHPThirdPlatformDocumentRPCClientListKnowledgeBasesFallsBackWhenRedisGetFails(t *testing.T) {
	t.Parallel()

	mini, redisClient := newThirdPlatformKnowledgeBaseTestRedis(t)
	client := ipcclient.NewPHPThirdPlatformDocumentRPCClient(newThirdPlatformDocumentServerForTest(), logging.New(), redisClient)
	client.SetThirdPlatformDocumentClientReadyFuncForTest(func() bool { return true })

	mini.Close()

	expected := []thirdplatform.KnowledgeBaseItem{{
		KnowledgeBaseID: "kb-fallback",
		Name:            "fallback",
		Description:     "fallback-desc",
	}}
	callCount := 0
	client.SetCallListKnowledgeBasesRPCForTest(func(_ context.Context, _ *unixsocket.Server, _ map[string]any, out any) error {
		callCount++
		result, ok := out.(*ipcclient.RPCResultForTest[[]thirdplatform.KnowledgeBaseItem])
		if !ok {
			t.Fatalf("unexpected out type: %T", out)
		}
		result.Code = 0
		result.Message = "success"
		result.Data = append([]thirdplatform.KnowledgeBaseItem(nil), expected...)
		return nil
	})

	got, err := client.ListKnowledgeBases(context.Background(), kbListInput("org-1", "user-1", "tp-user-1", "tp-org-1"))
	if err != nil {
		t.Fatalf("ListKnowledgeBases() error = %v", err)
	}
	if callCount != 1 {
		t.Fatalf("expected fallback RPC call, got %d", callCount)
	}
	if !reflect.DeepEqual(got, expected) {
		t.Fatalf("unexpected fallback result: %#v", got)
	}
}

func TestPHPThirdPlatformDocumentRPCClientListKnowledgeBasesReturnsIdentityMissing(t *testing.T) {
	t.Parallel()

	client := ipcclient.NewPHPThirdPlatformDocumentRPCClient(newThirdPlatformDocumentServerForTest(), logging.New(), nil)
	client.SetThirdPlatformDocumentClientReadyFuncForTest(func() bool { return true })

	_, err := client.ListKnowledgeBases(context.Background(), kbListInput("org-1", "user-1", "", ""))
	if !errors.Is(err, ipcclient.ErrThirdPlatformIdentityMissing) {
		t.Fatalf("expected ErrThirdPlatformIdentityMissing, got %v", err)
	}
}

func kbListInput(orgCode, userID, thirdUserID, thirdOrgCode string) thirdplatform.KnowledgeBaseListInput {
	return thirdplatform.KnowledgeBaseListInput{
		OrganizationCode:              orgCode,
		UserID:                        userID,
		ThirdPlatformUserID:           thirdUserID,
		ThirdPlatformOrganizationCode: thirdOrgCode,
	}
}

func newThirdPlatformKnowledgeBaseTestRedis(t *testing.T) (*miniredis.Miniredis, *redis.Client) {
	t.Helper()

	mini := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{
		Addr: mini.Addr(),
	})
	t.Cleanup(func() {
		_ = client.Close()
		if mini != nil {
			mini.Close()
		}
	})
	return mini, client
}

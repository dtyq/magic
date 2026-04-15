package client_test

import (
	"context"
	"errors"
	"testing"

	client "magic/internal/infrastructure/rpc/jsonrpc/client"
)

const (
	cachedTokenValue = "cached-token"
	newTokenValue    = "new-token"
	oldTokenValue    = "old-token"
)

var errRPCUnavailable = errors.New("rpc unavailable")

func TestPHPAccessTokenRPCClient_GetAccessToken_CacheFirst(t *testing.T) {
	t.Parallel()
	p := client.NewPHPAccessTokenRPCClient(nil, nil)
	p.SetTokenForTest(cachedTokenValue)

	called := false
	p.SetCallGetAccessTokenRPCForTest(func(ctx context.Context, result any) error {
		called = true
		return nil
	})

	token, err := p.GetAccessToken(context.Background())
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if token != cachedTokenValue {
		t.Fatalf("unexpected token: %q", token)
	}
	if called {
		t.Fatalf("rpc should not be called when cache hit")
	}
}

func TestPHPAccessTokenRPCClient_RefreshAccessToken_ShouldBypassCacheAndUpdate(t *testing.T) {
	t.Parallel()
	p := client.NewPHPAccessTokenRPCClient(nil, nil)
	p.SetTokenForTest(oldTokenValue)
	p.SetClientReadyFuncForTest(func() bool { return true })
	p.SetCallGetAccessTokenRPCForTest(func(ctx context.Context, result any) error {
		response, ok := result.(*client.MagicAccessTokenResponseForTest)
		if !ok {
			t.Fatalf("unexpected result type %T", result)
		}
		*response = client.MagicAccessTokenResponseForTest{
			Code:    0,
			Message: "success",
			Data: map[string]string{
				"access_token": newTokenValue,
			},
		}
		return nil
	})

	token, err := p.RefreshAccessToken(context.Background())
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if token != newTokenValue {
		t.Fatalf("unexpected token: %q", token)
	}
	cached, ok := p.CachedTokenForTest()
	if !ok || cached != newTokenValue {
		t.Fatalf("expected cache to be updated, got %q", cached)
	}
}

func TestPHPAccessTokenRPCClient_GetAccessToken_ShouldFallbackToCacheWhenRPCFails(t *testing.T) {
	t.Parallel()
	p := client.NewPHPAccessTokenRPCClient(nil, nil)
	p.SetTokenForTest(cachedTokenValue)
	p.SetClientReadyFuncForTest(func() bool { return true })
	p.SetCallGetAccessTokenRPCForTest(func(ctx context.Context, result any) error { return errRPCUnavailable })

	token, err := p.GetAccessToken(context.Background())
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if token != cachedTokenValue {
		t.Fatalf("unexpected token: %q", token)
	}
}

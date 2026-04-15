package client_test

import (
	"context"
	"testing"

	client "magic/internal/infrastructure/rpc/jsonrpc/client"
)

func TestPHPAccessTokenRPCClient_GetAccessToken_NoClientWithCache(t *testing.T) {
	t.Parallel()
	p := client.NewPHPAccessTokenRPCClient(nil, nil)
	p.SetTokenForTest(cachedTokenValue)

	token, err := p.GetAccessToken(context.Background())
	if err != nil {
		t.Fatalf("expected cached token without error, got err=%v", err)
	}
	if token != cachedTokenValue {
		t.Fatalf("unexpected token: %q", token)
	}
}

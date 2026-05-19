package client_test

import (
	"context"
	"testing"

	ipcclient "magic/internal/infrastructure/rpc/jsonrpc/client"
)

func TestPHPAccessTokenRPCClient_NoClient(t *testing.T) {
	t.Parallel()
	p := ipcclient.NewPHPAccessTokenRPCClient(nil, nil)
	if _, err := p.GetAccessToken(context.Background()); err == nil {
		t.Fatalf("expected error")
	}
}

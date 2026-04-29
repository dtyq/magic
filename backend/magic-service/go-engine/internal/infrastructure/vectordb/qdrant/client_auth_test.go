package qdrant_test

import (
	"context"
	"testing"

	"google.golang.org/grpc/metadata"

	"magic/internal/infrastructure/vectordb/qdrant"
)

func TestAuthContextWithAPIKey(t *testing.T) {
	t.Parallel()
	ctx := qdrant.AuthContextForTest(context.Background(), "magic-dev-api-key-2024")
	md, ok := metadata.FromOutgoingContext(ctx)
	if !ok {
		t.Fatal("expected outgoing metadata")
	}

	values := md.Get("api-key")
	if len(values) != 1 || values[0] != "magic-dev-api-key-2024" {
		t.Fatalf("unexpected api-key metadata: %#v", values)
	}
}

func TestAuthContextWithoutAPIKey(t *testing.T) {
	t.Parallel()
	ctx := qdrant.AuthContextForTest(context.Background(), "")
	md, ok := metadata.FromOutgoingContext(ctx)
	if !ok {
		return
	}
	if values := md.Get("api-key"); len(values) > 0 {
		t.Fatalf("did not expect api-key metadata, got %#v", values)
	}
}

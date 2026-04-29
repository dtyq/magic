package ctxmeta_test

import (
	"context"
	"testing"

	"magic/internal/pkg/ctxmeta"
)

func TestWithRequestIDAndFromContext(t *testing.T) {
	t.Parallel()
	ctx := ctxmeta.WithRequestID(context.Background(), "req_123")
	got, ok := ctxmeta.RequestIDFromContext(ctx)
	if !ok {
		t.Fatalf("expected request_id present")
	}
	if got != "req_123" {
		t.Fatalf("unexpected request_id: %q", got)
	}
}

func TestRequestIDFromContext_Empty(t *testing.T) {
	t.Parallel()
	if got, ok := ctxmeta.RequestIDFromContext(context.Background()); ok || got != "" {
		t.Fatalf("expected empty result for empty context, got=%q ok=%v", got, ok)
	}

	ctx := ctxmeta.WithRequestID(context.Background(), "")
	if got, ok := ctxmeta.RequestIDFromContext(ctx); ok || got != "" {
		t.Fatalf("expected empty result for blank request_id, got=%q ok=%v", got, ok)
	}
}

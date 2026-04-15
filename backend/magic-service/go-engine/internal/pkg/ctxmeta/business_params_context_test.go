package ctxmeta_test

import (
	"context"
	"testing"

	"magic/internal/pkg/ctxmeta"
)

func TestWithBusinessParamsAndFromContext(t *testing.T) {
	t.Parallel()

	src := &ctxmeta.BusinessParams{
		OrganizationCode: "DT001",
		UserID:           "usi_1",
		BusinessID:       "kb_1",
	}

	ctx := ctxmeta.WithBusinessParams(context.Background(), src)
	got, ok := ctxmeta.BusinessParamsFromContext(ctx)
	if !ok {
		t.Fatal("expected business params in context")
	}
	if got.OrganizationCode != src.OrganizationCode || got.UserID != src.UserID || got.BusinessID != src.BusinessID {
		t.Fatalf("unexpected business params: %#v", got)
	}

	src.OrganizationCode = "changed"
	if got.OrganizationCode != "DT001" {
		t.Fatalf("expected cloned business params, got %#v", got)
	}
}

func TestBusinessParamsFromContext_Empty(t *testing.T) {
	t.Parallel()

	if got, ok := ctxmeta.BusinessParamsFromContext(context.Background()); ok || got != nil {
		t.Fatalf("expected empty result, got %#v, %v", got, ok)
	}

	ctx := ctxmeta.WithBusinessParams(context.Background(), &ctxmeta.BusinessParams{})
	if got, ok := ctxmeta.BusinessParamsFromContext(ctx); ok || got != nil {
		t.Fatalf("expected empty result for empty business params, got %#v, %v", got, ok)
	}
}

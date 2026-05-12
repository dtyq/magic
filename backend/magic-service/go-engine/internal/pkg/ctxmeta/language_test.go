package ctxmeta_test

import (
	"context"
	"testing"

	"magic/internal/pkg/ctxmeta"
)

func TestWithLanguageAndFromContext(t *testing.T) {
	t.Parallel()

	ctx := ctxmeta.WithLanguage(context.Background(), "en_US")
	got, ok := ctxmeta.LanguageFromContext(ctx)
	if !ok || got != "en_US" {
		t.Fatalf("expected language en_US, got %q ok=%v", got, ok)
	}
}

func TestLanguageFromContextEmpty(t *testing.T) {
	t.Parallel()

	if got, ok := ctxmeta.LanguageFromContext(context.Background()); ok || got != "" {
		t.Fatalf("expected empty language, got %q ok=%v", got, ok)
	}

	ctx := ctxmeta.WithLanguage(context.Background(), "")
	if got, ok := ctxmeta.LanguageFromContext(ctx); ok || got != "" {
		t.Fatalf("expected empty language after empty write, got %q ok=%v", got, ok)
	}
}

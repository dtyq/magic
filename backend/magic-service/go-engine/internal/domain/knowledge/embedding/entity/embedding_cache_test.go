package entity_test

import (
	"strings"
	"testing"

	"magic/internal/domain/knowledge/embedding/entity"
)

func TestNewEmbeddingCache_TextPreviewShouldKeepFirstTenRunes(t *testing.T) {
	t.Parallel()

	text := strings.Repeat("你", 300)
	cache := entity.NewEmbeddingCache(text, []float64{1, 2, 3}, "test-model")

	if cache.TextPreview != strings.Repeat("你", 10) {
		t.Fatalf("expected first ten runes, got %q", cache.TextPreview)
	}
}

func TestNewEmbeddingCache_TextPreviewShouldKeepShortText(t *testing.T) {
	t.Parallel()

	cache := entity.NewEmbeddingCache("hello世界", []float64{1, 2, 3}, "test-model")

	if cache.TextPreview != "hello世界" {
		t.Fatalf("expected full text preview, got %q", cache.TextPreview)
	}
}

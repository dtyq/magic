package entity_test

import (
	"testing"

	ingestionentity "magic/internal/domain/knowledge/ingestion/entity"
)

func TestResolveItemSourceURL(t *testing.T) {
	t.Parallel()

	t.Run("uses direct source url first", func(t *testing.T) {
		t.Parallel()

		got := ingestionentity.ResolveItemSourceURL(&ingestionentity.Item{
			SourceURL: " https://oa.example.test/direct ",
			SnapshotMeta: map[string]any{
				"source_url": "https://oa.example.test/snapshot",
			},
		})
		if got != "https://oa.example.test/direct" {
			t.Fatalf("unexpected source url: %q", got)
		}
	})

	t.Run("falls back to snapshot meta", func(t *testing.T) {
		t.Parallel()

		got := ingestionentity.ResolveItemSourceURL(&ingestionentity.Item{
			SnapshotMeta: map[string]any{
				"source_url": " https://oa.example.test/snapshot ",
			},
		})
		if got != "https://oa.example.test/snapshot" {
			t.Fatalf("unexpected source url: %q", got)
		}
	})
}

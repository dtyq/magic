package sourcebinding_test

import (
	"testing"
	"time"

	sourcebinding "magic/internal/domain/knowledge/sourcebinding/service"
	"magic/internal/pkg/projectfile"
)

func TestBuildProjectSourceItemUsesAppPreparedSnapshotMetaAndFallbackContentHash(t *testing.T) {
	t.Parallel()

	resolvedAt := time.Date(2026, 4, 9, 12, 0, 0, 0, time.UTC)
	item, err := sourcebinding.BuildProjectSourceItem(sourcebinding.ProjectSourceItemInput{
		OrganizationCode: "ORG1",
		RootRef:          "900",
		Resolved: &projectfile.ResolveResult{
			OrganizationCode: "ORG1",
			ProjectID:        900,
			ProjectFileID:    501,
			FileName:         "demo.md",
			FileExtension:    "md",
			DocumentFile:     map[string]any{"name": "stale.md"},
		},
		SnapshotMeta:        map[string]any{"name": "override.md", "type": "project_file"},
		FallbackContentHash: "fallback-hash",
		ResolvedAt:          resolvedAt,
	})
	if err != nil {
		t.Fatalf("BuildProjectSourceItem returned error: %v", err)
	}
	if item.ContentHash != "fallback-hash" {
		t.Fatalf("expected fallback content hash, got %#v", item)
	}
	if item.SnapshotMeta["name"] != "override.md" {
		t.Fatalf("expected app-prepared snapshot meta, got %#v", item.SnapshotMeta)
	}
	if item.LastResolvedAt == nil || !item.LastResolvedAt.Equal(resolvedAt) {
		t.Fatalf("unexpected resolved time: %#v", item.LastResolvedAt)
	}
}

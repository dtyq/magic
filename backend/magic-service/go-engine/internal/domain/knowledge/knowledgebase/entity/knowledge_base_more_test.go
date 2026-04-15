package entity_test

import (
	"encoding/json"
	"testing"

	"magic/internal/constants"
	"magic/internal/domain/knowledge/knowledgebase/entity"
	sharedentity "magic/internal/domain/knowledge/shared/entity"
)

func TestSyncStatusString(t *testing.T) {
	t.Parallel()

	testCases := map[sharedentity.SyncStatus]string{
		sharedentity.SyncStatusPending:      "pending",
		sharedentity.SyncStatusSyncing:      "syncing",
		sharedentity.SyncStatusSynced:       "synced",
		sharedentity.SyncStatusSyncFailed:   "sync_failed",
		sharedentity.SyncStatusDeleted:      "deleted",
		sharedentity.SyncStatusDeleteFailed: "delete_failed",
		sharedentity.SyncStatusRebuilding:   "rebuilding",
		sharedentity.SyncStatus(99):         "unknown",
	}
	for input, want := range testCases {
		if got := input.String(); got != want {
			t.Fatalf("status %d: want %q got %q", input, want, got)
		}
	}
}

func TestFragmentConfigUnmarshalJSONSupportsLegacyFields(t *testing.T) {
	t.Parallel()

	var cfg sharedentity.FragmentConfig
	if err := json.Unmarshal([]byte(`{"chunk_size":256,"chunk_overlap":32,"chunk_overlap_unit":"percent","separator":"\n\n"}`), &cfg); err != nil {
		t.Fatalf("unmarshal fragment config: %v", err)
	}
	if cfg.Mode != sharedentity.FragmentModeCustom {
		t.Fatalf("expected normal mode, got %d", cfg.Mode)
	}
	if cfg.Normal == nil || cfg.Normal.SegmentRule == nil {
		t.Fatalf("expected normal segment rule initialized, got %#v", cfg.Normal)
	}
	if cfg.Normal.SegmentRule.ChunkSize != 256 ||
		cfg.Normal.SegmentRule.ChunkOverlap != 32 ||
		cfg.Normal.SegmentRule.ChunkOverlapUnit != sharedentity.ChunkOverlapUnitPercent ||
		cfg.Normal.SegmentRule.Separator != "\n\n" {
		t.Fatalf("unexpected legacy segment rule: %#v", cfg.Normal.SegmentRule)
	}
}

func TestKnowledgeBaseHelpers(t *testing.T) {
	t.Parallel()

	kb := &entity.KnowledgeBase{Code: "kb-1"}
	if got := kb.CollectionName(); got != constants.KnowledgeBaseCollectionName {
		t.Fatalf("expected collection %q, got %q", constants.KnowledgeBaseCollectionName, got)
	}
	if got := kb.DefaultDocumentCode(); got != "kb-1-DEFAULT-DOC" {
		t.Fatalf("unexpected default document code: %q", got)
	}
	if got := kb.GetVectorSize(); got != entity.VectorSizeDefault {
		t.Fatalf("expected default vector size %d, got %d", entity.VectorSizeDefault, got)
	}

	kb.Model = "text-embedding-3-large"
	if got := kb.GetVectorSize(); got != entity.VectorSize3Large {
		t.Fatalf("expected large vector size %d, got %d", entity.VectorSize3Large, got)
	}
}

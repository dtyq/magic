package model_test

import (
	"testing"
	"time"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	sharedentity "magic/internal/domain/knowledge/shared/entity"
)

func TestNewFragmentDefaults(t *testing.T) {
	t.Parallel()

	fragment := fragmodel.NewFragment("kb-1", "doc-1", "正文", map[string]any{"a": 1}, "u1")
	if fragment.KnowledgeCode != "kb-1" || fragment.DocumentCode != "doc-1" {
		t.Fatalf("unexpected fragment scope: %#v", fragment)
	}
	if fragment.SyncStatus != sharedentity.SyncStatusPending {
		t.Fatalf("expected pending sync status, got %v", fragment.SyncStatus)
	}
	if fragment.PointID == "" {
		t.Fatal("expected point id generated")
	}
	if fragment.WordCount != len([]rune("正文")) {
		t.Fatalf("unexpected word count: %d", fragment.WordCount)
	}
	if fragment.CreatedUID != "u1" || fragment.UpdatedUID != "u1" {
		t.Fatalf("unexpected uid fields: %#v", fragment)
	}
	if fragment.CreatedAt.IsZero() || fragment.UpdatedAt.IsZero() {
		t.Fatal("expected timestamps initialized")
	}
}

func TestKnowledgeBaseFragmentStateTransitions(t *testing.T) {
	t.Parallel()

	fragment := &fragmodel.KnowledgeBaseFragment{UpdatedAt: time.Now().Add(-time.Minute)}

	fragment.SetVector([]float64{1, 2})
	if len(fragment.Vector) != 2 {
		t.Fatalf("expected vector set, got %#v", fragment.Vector)
	}

	fragment.MarkSyncing()
	if fragment.SyncStatus != sharedentity.SyncStatusSyncing || fragment.SyncTimes != 1 {
		t.Fatalf("unexpected syncing state: %#v", fragment)
	}

	fragment.MarkSynced()
	if fragment.SyncStatus != sharedentity.SyncStatusSynced || fragment.SyncStatusMessage != "" {
		t.Fatalf("unexpected synced state: %#v", fragment)
	}

	fragment.MarkSyncFailed("boom")
	if fragment.SyncStatus != sharedentity.SyncStatusSyncFailed || fragment.SyncStatusMessage != "boom" {
		t.Fatalf("unexpected failed state: %#v", fragment)
	}
}

func TestVectorDimensionMismatchError(t *testing.T) {
	t.Parallel()

	err := &fragmodel.VectorDimensionMismatchError{
		Collection: "kb",
		Expected:   1536,
		Actual:     1024,
		Index:      2,
	}

	if got := err.Error(); got != "vector dimension mismatch in collection kb: expected 1536, got 1024 (index 2)" {
		t.Fatalf("unexpected error message: %q", got)
	}
	if got := err.ActualDimension(); got != 1024 {
		t.Fatalf("expected actual dimension 1024, got %d", got)
	}
}

func TestVectorDimensionMismatchErrorNilReceiver(t *testing.T) {
	t.Parallel()

	var err *fragmodel.VectorDimensionMismatchError
	if got := err.ActualDimension(); got != 0 {
		t.Fatalf("expected nil receiver dimension 0, got %d", got)
	}
}

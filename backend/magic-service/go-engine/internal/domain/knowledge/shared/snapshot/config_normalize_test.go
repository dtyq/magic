package snapshot_test

import (
	"testing"

	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
)

func TestNormalizeKnowledgeBaseSnapshotConfigsFillsDefaults(t *testing.T) {
	t.Parallel()

	snapshot := &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{}
	got := sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(snapshot)
	if got != snapshot {
		t.Fatal("expected in-place normalization")
	}
	if snapshot.RetrieveConfig == nil || snapshot.FragmentConfig == nil {
		t.Fatalf("expected non-nil defaults, got %#v", snapshot)
	}
	if snapshot.RetrieveConfig.SearchMethod != "hybrid_search" || snapshot.FragmentConfig.Mode != shared.FragmentModeAuto {
		t.Fatalf("unexpected normalized defaults: %#v", snapshot)
	}
}

func TestNormalizeKnowledgeBaseSnapshotConfigsKeepsExistingConfigs(t *testing.T) {
	t.Parallel()

	retrieveConfig := &shared.RetrieveConfig{TopK: 3}
	fragmentConfig := &shared.FragmentConfig{Mode: shared.FragmentModeHierarchy}
	snapshot := &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{
		RetrieveConfig: retrieveConfig,
		FragmentConfig: fragmentConfig,
	}

	sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(snapshot)

	if snapshot.RetrieveConfig != retrieveConfig || snapshot.FragmentConfig != fragmentConfig {
		t.Fatalf("expected existing configs preserved, got %#v", snapshot)
	}
}

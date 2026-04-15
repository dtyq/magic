package docapp_test

import (
	"testing"
	"time"

	appservice "magic/internal/application/knowledge/document/service"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	sharedentity "magic/internal/domain/knowledge/shared/entity"
)

func TestBuildFragmentResyncPlanCleansDuplicateExistingIdentity(t *testing.T) {
	t.Parallel()

	now := time.Now()
	identityKey := appservice.BuildChunkIdentityKeyForTest("hash-alpha", 0)
	currentPointID := appservice.BuildPointIDForTest("KB1", "DOC1", identityKey)
	oldFragments := []*fragmodel.KnowledgeBaseFragment{
		{
			ID:            11,
			KnowledgeCode: "KB1",
			DocumentCode:  "DOC1",
			ChunkIndex:    0,
			Content:       "alpha",
			ContentHash:   "hash-alpha",
			PointID:       "legacy-point-id",
			SyncStatus:    sharedentity.SyncStatusSynced,
			UpdatedAt:     now.Add(-time.Minute),
		},
		{
			ID:            12,
			KnowledgeCode: "KB1",
			DocumentCode:  "DOC1",
			ChunkIndex:    0,
			Content:       "alpha",
			ContentHash:   "hash-alpha",
			PointID:       currentPointID,
			SyncStatus:    sharedentity.SyncStatusSynced,
			UpdatedAt:     now,
		},
	}
	newFragments := []*fragmodel.KnowledgeBaseFragment{
		{
			KnowledgeCode: "KB1",
			DocumentCode:  "DOC1",
			ChunkIndex:    0,
			Content:       "alpha",
			ContentHash:   "hash-alpha",
			PointID:       currentPointID,
			SyncStatus:    sharedentity.SyncStatusPending,
		},
	}

	plan, err := appservice.BuildFragmentResyncPlanForTest(oldFragments, newFragments)
	if err != nil {
		t.Fatalf("buildFragmentResyncPlan returned error: %v", err)
	}
	if len(plan.Changed) != 0 {
		t.Fatalf("expected no changed fragments, got %d", len(plan.Changed))
	}
	if len(plan.Added) != 0 {
		t.Fatalf("expected no added fragments, got %d", len(plan.Added))
	}
	if len(plan.Deleted) != 1 {
		t.Fatalf("expected one redundant fragment to delete, got %d", len(plan.Deleted))
	}
	if plan.Deleted[0].ID != 11 {
		t.Fatalf("expected stale duplicate fragment deleted, got id=%d", plan.Deleted[0].ID)
	}
}

func TestBuildFragmentResyncPlanTreatsContentChangeAsDeleteAndAdd(t *testing.T) {
	t.Parallel()

	oldFragment := &fragmodel.KnowledgeBaseFragment{
		ID:            21,
		KnowledgeCode: "KB1",
		DocumentCode:  "DOC1",
		ChunkIndex:    0,
		Content:       "alpha",
		ContentHash:   "hash-alpha",
		PointID:       appservice.BuildPointIDForTest("KB1", "DOC1", appservice.BuildChunkIdentityKeyForTest("hash-alpha", 0)),
		SyncStatus:    sharedentity.SyncStatusSynced,
	}
	newFragment := &fragmodel.KnowledgeBaseFragment{
		KnowledgeCode: "KB1",
		DocumentCode:  "DOC1",
		ChunkIndex:    0,
		Content:       "beta",
		ContentHash:   "hash-beta",
		PointID:       appservice.BuildPointIDForTest("KB1", "DOC1", appservice.BuildChunkIdentityKeyForTest("hash-beta", 0)),
		SyncStatus:    sharedentity.SyncStatusPending,
	}

	plan, err := appservice.BuildFragmentResyncPlanForTest([]*fragmodel.KnowledgeBaseFragment{oldFragment}, []*fragmodel.KnowledgeBaseFragment{newFragment})
	if err != nil {
		t.Fatalf("buildFragmentResyncPlan returned error: %v", err)
	}
	if len(plan.Changed) != 0 {
		t.Fatalf("expected no changed fragments, got %d", len(plan.Changed))
	}
	if len(plan.Added) != 1 || plan.Added[0] != newFragment {
		t.Fatalf("expected new fragment in added, got %#v", plan.Added)
	}
	if len(plan.Deleted) != 1 || plan.Deleted[0] != oldFragment {
		t.Fatalf("expected old fragment in deleted, got %#v", plan.Deleted)
	}
	if len(plan.RekeyedPointIDs) != 0 {
		t.Fatalf("expected no rekeyed point ids, got %#v", plan.RekeyedPointIDs)
	}
}

func TestBuildFragmentResyncPlanKeepsMetadataOnlyChangeAsChanged(t *testing.T) {
	t.Parallel()

	identityKey := appservice.BuildChunkIdentityKeyForTest("hash-alpha", 0)
	pointID := appservice.BuildPointIDForTest("KB1", "DOC1", identityKey)
	oldFragment := &fragmodel.KnowledgeBaseFragment{
		ID:            31,
		KnowledgeCode: "KB1",
		DocumentCode:  "DOC1",
		DocumentName:  "Doc A",
		DocumentType:  1,
		ChunkIndex:    0,
		Content:       "alpha",
		ContentHash:   "hash-alpha",
		PointID:       pointID,
		SyncStatus:    sharedentity.SyncStatusSynced,
		Metadata: map[string]any{
			"chunk_index":  0,
			"content_hash": "hash-alpha",
			"title":        "old",
		},
	}
	newFragment := &fragmodel.KnowledgeBaseFragment{
		KnowledgeCode: "KB1",
		DocumentCode:  "DOC1",
		DocumentName:  "Doc B",
		DocumentType:  1,
		ChunkIndex:    0,
		Content:       "alpha",
		ContentHash:   "hash-alpha",
		PointID:       pointID,
		SyncStatus:    sharedentity.SyncStatusPending,
		Metadata: map[string]any{
			"chunk_index":  0,
			"content_hash": "hash-alpha",
			"title":        "new",
		},
	}

	plan, err := appservice.BuildFragmentResyncPlanForTest([]*fragmodel.KnowledgeBaseFragment{oldFragment}, []*fragmodel.KnowledgeBaseFragment{newFragment})
	if err != nil {
		t.Fatalf("buildFragmentResyncPlan returned error: %v", err)
	}
	if len(plan.Changed) != 1 {
		t.Fatalf("expected one changed fragment, got %d", len(plan.Changed))
	}
	if plan.Changed[0].ID != oldFragment.ID {
		t.Fatalf("expected changed fragment to keep existing id, got %d", plan.Changed[0].ID)
	}
	if plan.Changed[0].DocumentName != "Doc B" {
		t.Fatalf("expected changed fragment document name updated, got %q", plan.Changed[0].DocumentName)
	}
	if len(plan.Added) != 0 || len(plan.Deleted) != 0 {
		t.Fatalf("expected only changed fragments, got added=%d deleted=%d", len(plan.Added), len(plan.Deleted))
	}
}

func TestBuildFragmentResyncPlanForceBackfillCollectsUnchangedFragmentsForMissingPointCheck(t *testing.T) {
	t.Parallel()

	identityKey := appservice.BuildChunkIdentityKeyForTest("hash-alpha", 0)
	pointID := appservice.BuildPointIDForTest("KB1", "DOC1", identityKey)
	oldFragment := &fragmodel.KnowledgeBaseFragment{
		ID:            41,
		KnowledgeCode: "KB1",
		DocumentCode:  "DOC1",
		DocumentName:  "Doc A",
		DocumentType:  1,
		ChunkIndex:    0,
		Content:       "alpha",
		ContentHash:   "hash-alpha",
		PointID:       pointID,
		SyncStatus:    sharedentity.SyncStatusSynced,
		Metadata: map[string]any{
			"chunk_index":  0,
			"content_hash": "hash-alpha",
		},
	}
	newFragment := &fragmodel.KnowledgeBaseFragment{
		KnowledgeCode: "KB1",
		DocumentCode:  "DOC1",
		DocumentName:  "Doc A",
		DocumentType:  1,
		ChunkIndex:    0,
		Content:       "alpha",
		ContentHash:   "hash-alpha",
		PointID:       pointID,
		SyncStatus:    sharedentity.SyncStatusPending,
		Metadata: map[string]any{
			"chunk_index":  0,
			"content_hash": "hash-alpha",
		},
	}

	plan, err := appservice.BuildFragmentResyncPlanForTestWithForce(
		[]*fragmodel.KnowledgeBaseFragment{oldFragment},
		[]*fragmodel.KnowledgeBaseFragment{newFragment},
		true,
	)
	if err != nil {
		t.Fatalf("buildFragmentResyncPlan returned error: %v", err)
	}
	if len(plan.Changed) != 0 {
		t.Fatalf("expected no changed fragments before point existence check, got %d", len(plan.Changed))
	}
	if len(plan.Unchanged) != 1 {
		t.Fatalf("expected one unchanged fragment candidate, got %d", len(plan.Unchanged))
	}
	if plan.Unchanged[0].ID != oldFragment.ID {
		t.Fatalf("expected unchanged fragment candidate to keep existing id, got %d", plan.Unchanged[0].ID)
	}
	if len(plan.Added) != 0 || len(plan.Deleted) != 0 {
		t.Fatalf("expected only unchanged backfill candidates, got added=%d deleted=%d", len(plan.Added), len(plan.Deleted))
	}
}

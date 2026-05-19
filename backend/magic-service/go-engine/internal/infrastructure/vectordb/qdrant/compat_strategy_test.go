package qdrant_test

import (
	"testing"
	"time"

	shared "magic/internal/domain/knowledge/shared"
	qdrantpkg "magic/internal/infrastructure/vectordb/qdrant"
)

const (
	testLegacySearchAPI = "legacy_search"
	testQueryPointsAPI  = "query_points"
)

func TestCompatibilityStrategyUsesLegacyPre112PlanForSparseSearch(t *testing.T) {
	t.Parallel()

	client := newClient()
	qdrantpkg.SetCapabilityForTest(client, qdrantpkg.CapabilitySnapshotForTest{
		Version:           "1.11.7",
		QuerySupported:    false,
		SelectedSparseAPI: testLegacySearchAPI,
		ProbeStatus:       "ready",
		LastProbeAt:       time.Now(),
	})

	if strategy := qdrantpkg.CurrentCompatibilityStrategyNameForTest(client); strategy != "legacy_pre_1_12" {
		t.Fatalf("unexpected strategy: %q", strategy)
	}

	vectorPlan := qdrantpkg.CurrentSparseSearchPlanForTest(client, "vector")
	if vectorPlan.Primary != testLegacySearchAPI {
		t.Fatalf("unexpected vector plan: %#v", vectorPlan)
	}

	documentPlan := qdrantpkg.CurrentSparseSearchPlanForTest(client, "document")
	if !documentPlan.ImmediateUnsupported || documentPlan.LogSelectedAPI != testLegacySearchAPI {
		t.Fatalf("unexpected document plan: %#v", documentPlan)
	}
}

func TestCompatibilityStrategyTreatsQdrant19AsLegacyPre112(t *testing.T) {
	t.Parallel()

	client := newClient()
	qdrantpkg.SetCapabilityForTest(client, qdrantpkg.CapabilitySnapshotForTest{
		Version:           "1.9.3",
		QuerySupported:    false,
		SelectedSparseAPI: testLegacySearchAPI,
		ProbeStatus:       "ready",
		LastProbeAt:       time.Now(),
	})

	if strategy := qdrantpkg.CurrentCompatibilityStrategyNameForTest(client); strategy != "legacy_pre_1_12" {
		t.Fatalf("unexpected strategy: %q", strategy)
	}
}

func TestCompatibilityStrategyUsesModernPlanForSparseSearch(t *testing.T) {
	t.Parallel()

	client := newClient()
	qdrantpkg.SetCapabilityForTest(client, qdrantpkg.CapabilitySnapshotForTest{
		Version:           "1.12.2",
		QuerySupported:    true,
		SelectedSparseAPI: testQueryPointsAPI,
		ProbeStatus:       "ready",
		LastProbeAt:       time.Now(),
	})

	if strategy := qdrantpkg.CurrentCompatibilityStrategyNameForTest(client); strategy != "modern" {
		t.Fatalf("unexpected strategy: %q", strategy)
	}

	vectorPlan := qdrantpkg.CurrentSparseSearchPlanForTest(client, "vector")
	if vectorPlan.Primary != testQueryPointsAPI {
		t.Fatalf("unexpected vector plan: %#v", vectorPlan)
	}

	documentPlan := qdrantpkg.CurrentSparseSearchPlanForTest(client, "document")
	if documentPlan.Primary != testQueryPointsAPI || documentPlan.ImmediateUnsupported {
		t.Fatalf("unexpected document plan: %#v", documentPlan)
	}
}

func TestCompatibilityStrategyTreatsUnknownVersionAsModernByDefault(t *testing.T) {
	t.Parallel()

	client := newClient()
	qdrantpkg.SetCapabilityForTest(client, qdrantpkg.CapabilitySnapshotForTest{
		Version:           "unknown",
		QuerySupported:    true,
		SelectedSparseAPI: testQueryPointsAPI,
		ProbeStatus:       "ready",
		LastProbeAt:       time.Now(),
	})

	if strategy := qdrantpkg.CurrentCompatibilityStrategyNameForTest(client); strategy != "modern" {
		t.Fatalf("unexpected strategy: %q", strategy)
	}

	vectorPlan := qdrantpkg.CurrentSparseSearchPlanForTest(client, "vector")
	if vectorPlan.Primary != testQueryPointsAPI {
		t.Fatalf("unexpected vector plan: %#v", vectorPlan)
	}

	documentPlan := qdrantpkg.CurrentSparseSearchPlanForTest(client, "document")
	if documentPlan.Primary != testQueryPointsAPI || documentPlan.ImmediateUnsupported {
		t.Fatalf("unexpected document plan: %#v", documentPlan)
	}
}

func TestCompatibilityStrategyDowngradesQdrantBackendWithoutNativeBM25(t *testing.T) {
	t.Parallel()

	client := newClient()
	qdrantpkg.SetCapabilityForTest(client, qdrantpkg.CapabilitySnapshotForTest{
		Version:           "1.12.2",
		QuerySupported:    true,
		SelectedSparseAPI: testQueryPointsAPI,
		ProbeStatus:       "ready",
		LastProbeAt:       time.Now(),
	})

	selection := client.SelectSparseBackend(shared.SparseBackendQdrantBM25ZHV1)
	if selection.Effective != shared.SparseBackendClientBM25QdrantIDFV1 {
		t.Fatalf("unexpected sparse backend selection: %#v", selection)
	}
	if selection.Reason != shared.SparseBackendSelectionReasonNativeBM25Unsupported {
		t.Fatalf("unexpected sparse backend selection reason: %#v", selection)
	}
}

func TestCompatibilityStrategyAllowsQdrantBackendWithNativeBM25(t *testing.T) {
	t.Parallel()

	client := newClient()
	qdrantpkg.SetCapabilityForTest(client, qdrantpkg.CapabilitySnapshotForTest{
		Version:           "1.15.2",
		QuerySupported:    true,
		SelectedSparseAPI: testQueryPointsAPI,
		ProbeStatus:       "ready",
		LastProbeAt:       time.Now(),
	})

	selection := client.SelectSparseBackend(shared.SparseBackendQdrantBM25ZHV1)
	if selection.Effective != shared.SparseBackendQdrantBM25ZHV1 {
		t.Fatalf("unexpected sparse backend selection: %#v", selection)
	}
	if selection.Reason != shared.SparseBackendSelectionReasonExplicitRequested {
		t.Fatalf("unexpected sparse backend selection reason: %#v", selection)
	}
}

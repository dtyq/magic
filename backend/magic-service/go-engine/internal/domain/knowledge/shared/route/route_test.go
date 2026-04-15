package sharedroute_test

import (
	"context"
	"testing"

	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	"magic/internal/pkg/knowledgeroute"
)

const (
	effectiveModel        = "text-embedding-3-large"
	logicalCollectionName = "magic_knowledge"
	fixedActiveCollection = "magic_knowledge_active"
	fixedShadowCollection = "magic_knowledge_shadow"
)

type stubCollectionMetaReader struct {
	meta  sharedroute.CollectionMeta
	err   error
	calls int
}

func (s *stubCollectionMetaReader) GetCollectionMeta(context.Context) (sharedroute.CollectionMeta, error) {
	s.calls++
	if s.err != nil {
		return sharedroute.CollectionMeta{}, s.err
	}
	return s.meta, nil
}

func TestResolveRuntimeRouteUsesFallbackWhenMetaMissing(t *testing.T) {
	t.Parallel()

	got := sharedroute.ResolveRuntimeRoute(context.Background(), &stubCollectionMetaReader{}, nil, "", effectiveModel)
	if got.LogicalCollectionName == "" || got.PhysicalCollectionName == "" || got.VectorCollectionName == "" {
		t.Fatalf("expected route to fall back to default collection, got %+v", got)
	}
	if got.LogicalCollectionName != got.PhysicalCollectionName || got.VectorCollectionName != got.PhysicalCollectionName {
		t.Fatalf("expected fallback route to keep logical/physical/vector aligned, got %+v", got)
	}
	if got.Model != effectiveModel {
		t.Fatalf("expected default model fallback, got %+v", got)
	}
}

func TestResolveRuntimeRoutePrefersPhysicalCollectionForRuntimeIO(t *testing.T) {
	t.Parallel()

	got := sharedroute.ResolveRuntimeRoute(context.Background(), &stubCollectionMetaReader{
		meta: sharedroute.CollectionMeta{
			Exists:                 true,
			CollectionName:         logicalCollectionName,
			PhysicalCollectionName: fixedActiveCollection,
			Model:                  effectiveModel,
		},
	}, nil, "", "fallback-model")
	if got.LogicalCollectionName != logicalCollectionName {
		t.Fatalf("expected logical collection name to stay stable, got %+v", got)
	}
	if got.PhysicalCollectionName != fixedActiveCollection {
		t.Fatalf("expected active physical collection, got %+v", got)
	}
	if got.VectorCollectionName != fixedActiveCollection || got.TermCollectionName != fixedActiveCollection {
		t.Fatalf("expected runtime io to hit active physical collection, got %+v", got)
	}
}

func TestResolveRuntimeRouteMapsLogicalOverrideBackToPhysicalCollection(t *testing.T) {
	t.Parallel()

	ctx := knowledgeroute.WithRebuildOverride(context.Background(), &knowledgeroute.RebuildOverride{
		TargetCollection: logicalCollectionName,
	})
	got := sharedroute.ResolveRuntimeRoute(ctx, &stubCollectionMetaReader{
		meta: sharedroute.CollectionMeta{
			Exists:                 true,
			CollectionName:         logicalCollectionName,
			PhysicalCollectionName: fixedShadowCollection,
		},
	}, nil, "", "fallback-model")
	if !got.HasRebuildOverride {
		t.Fatalf("expected rebuild override marker, got %+v", got)
	}
	if got.VectorCollectionName != fixedShadowCollection {
		t.Fatalf("expected logical override to map back to target physical collection, got %+v", got)
	}
}

func TestResolveRuntimeRouteKeepsPhysicalOverrideUnchanged(t *testing.T) {
	t.Parallel()

	ctx := knowledgeroute.WithRebuildOverride(context.Background(), &knowledgeroute.RebuildOverride{
		TargetCollection: fixedShadowCollection,
	})
	got := sharedroute.ResolveRuntimeRoute(ctx, &stubCollectionMetaReader{
		meta: sharedroute.CollectionMeta{
			Exists:                 true,
			CollectionName:         logicalCollectionName,
			PhysicalCollectionName: fixedActiveCollection,
		},
	}, nil, "", "fallback-model")
	if got.VectorCollectionName != fixedShadowCollection {
		t.Fatalf("expected physical override to remain unchanged, got %+v", got)
	}
}

func TestResolveRuntimeRoutePrefersExplicitTermNamespaceOverride(t *testing.T) {
	t.Parallel()

	ctx := knowledgeroute.WithRebuildOverride(context.Background(), &knowledgeroute.RebuildOverride{
		TargetCollection:     fixedActiveCollection,
		TargetTermCollection: fixedShadowCollection,
	})
	got := sharedroute.ResolveRuntimeRoute(ctx, &stubCollectionMetaReader{
		meta: sharedroute.CollectionMeta{
			Exists:                 true,
			CollectionName:         logicalCollectionName,
			PhysicalCollectionName: fixedActiveCollection,
		},
	}, nil, "", "fallback-model")
	if got.VectorCollectionName != fixedActiveCollection || got.TermCollectionName != fixedShadowCollection {
		t.Fatalf("expected explicit term namespace override, got %+v", got)
	}
}

func TestResolveRuntimeRoutePrefersOverrideModelAndSparseBackend(t *testing.T) {
	t.Parallel()

	ctx := knowledgeroute.WithRebuildOverride(context.Background(), &knowledgeroute.RebuildOverride{
		TargetModel:         effectiveModel,
		TargetSparseBackend: shared.SparseBackendClientBM25QdrantIDFV1,
	})
	got := sharedroute.ResolveRuntimeRoute(ctx, &stubCollectionMetaReader{
		meta: sharedroute.CollectionMeta{
			Exists:                 true,
			CollectionName:         logicalCollectionName,
			PhysicalCollectionName: fixedActiveCollection,
			Model:                  "text-embedding-3-small",
			SparseBackend:          shared.SparseBackendQdrantBM25ZHV1,
		},
	}, nil, "", "fallback-model")
	if got.Model != effectiveModel || got.SparseBackend != shared.SparseBackendClientBM25QdrantIDFV1 {
		t.Fatalf("expected override model and sparse backend, got %+v", got)
	}
}

func TestResolveRuntimeRouteReadsMetaOnce(t *testing.T) {
	t.Parallel()

	reader := &stubCollectionMetaReader{
		meta: sharedroute.CollectionMeta{
			Exists:                 true,
			CollectionName:         logicalCollectionName,
			PhysicalCollectionName: fixedActiveCollection,
			Model:                  effectiveModel,
			SparseBackend:          shared.SparseBackendQdrantBM25ZHV1,
		},
	}

	got := sharedroute.ResolveRuntimeRoute(context.Background(), reader, nil, "", "fallback-model")
	if got.VectorCollectionName != fixedActiveCollection || got.Model != effectiveModel {
		t.Fatalf("unexpected resolved route: %+v", got)
	}
	if reader.calls != 1 {
		t.Fatalf("expected one meta read, got %d", reader.calls)
	}
}

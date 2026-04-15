package sharedroute_test

import (
	"context"
	"errors"
	"testing"

	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
)

type stubCollectionMetaWriter struct {
	upserted []sharedroute.CollectionMeta
	err      error
}

func (s *stubCollectionMetaWriter) UpsertCollectionMeta(_ context.Context, meta sharedroute.CollectionMeta) error {
	if s.err != nil {
		return s.err
	}
	s.upserted = append(s.upserted, meta)
	return nil
}

func TestCollectionMetaManagerEnsureInitializedWritesWhenMetaMissing(t *testing.T) {
	t.Parallel()

	reader := &stubCollectionMetaReader{}
	writer := &stubCollectionMetaWriter{}
	manager := sharedroute.NewCollectionMetaManager(reader, writer)

	err := manager.EnsureInitialized(context.Background(), sharedroute.CollectionMeta{
		CollectionName:  "magic_knowledge",
		Model:           "text-embedding-3-small",
		VectorDimension: 1536,
		SparseBackend:   shared.SparseBackendQdrantBM25ZHV1,
	})
	if err != nil {
		t.Fatalf("EnsureInitialized returned error: %v", err)
	}
	if reader.calls != 1 {
		t.Fatalf("expected one collection meta read, got %d", reader.calls)
	}
	if len(writer.upserted) != 1 {
		t.Fatalf("expected one collection meta upsert, got %d", len(writer.upserted))
	}
	if got := writer.upserted[0]; got.PhysicalCollectionName != logicalCollectionName || !got.Exists {
		t.Fatalf("unexpected normalized meta: %+v", got)
	}
}

func TestCollectionMetaManagerEnsureInitializedSkipsWhenMetaExists(t *testing.T) {
	t.Parallel()

	reader := &stubCollectionMetaReader{
		meta: sharedroute.CollectionMeta{
			CollectionName:         "magic_knowledge",
			PhysicalCollectionName: "magic_knowledge_active",
			Model:                  "text-embedding-3-small",
			VectorDimension:        1536,
			SparseBackend:          shared.SparseBackendQdrantBM25ZHV1,
			Exists:                 true,
		},
	}
	writer := &stubCollectionMetaWriter{}
	manager := sharedroute.NewCollectionMetaManager(reader, writer)

	err := manager.EnsureInitialized(context.Background(), sharedroute.CollectionMeta{
		CollectionName:         "magic_knowledge",
		PhysicalCollectionName: "magic_knowledge_shadow",
		Model:                  "text-embedding-3-large",
		VectorDimension:        3072,
		SparseBackend:          shared.SparseBackendClientBM25QdrantIDFV1,
	})
	if err != nil {
		t.Fatalf("EnsureInitialized returned error: %v", err)
	}
	if len(writer.upserted) != 0 {
		t.Fatalf("expected existing meta to skip upsert, got %+v", writer.upserted)
	}
}

func TestCollectionMetaManagerUpsertNormalizesMeta(t *testing.T) {
	t.Parallel()

	writer := &stubCollectionMetaWriter{}
	manager := sharedroute.NewCollectionMetaManager(nil, writer)

	err := manager.Upsert(context.Background(), sharedroute.CollectionMeta{
		CollectionName:  " magic_knowledge ",
		Model:           " text-embedding-3-small ",
		VectorDimension: 1536,
		SparseBackend:   " qdrant_bm25_zh_v1 ",
	})
	if err != nil {
		t.Fatalf("Upsert returned error: %v", err)
	}
	if len(writer.upserted) != 1 {
		t.Fatalf("expected one upsert, got %d", len(writer.upserted))
	}
	if got := writer.upserted[0]; got.CollectionName != "magic_knowledge" || got.PhysicalCollectionName != "magic_knowledge" || got.Model != "text-embedding-3-small" || got.SparseBackend != shared.SparseBackendQdrantBM25ZHV1 || !got.Exists {
		t.Fatalf("unexpected normalized meta: %+v", got)
	}
}

func TestCollectionMetaManagerUpsertRejectsInvalidMeta(t *testing.T) {
	t.Parallel()

	manager := sharedroute.NewCollectionMetaManager(nil, &stubCollectionMetaWriter{})

	err := manager.Upsert(context.Background(), sharedroute.CollectionMeta{
		CollectionName:  "magic_knowledge",
		Model:           "text-embedding-3-small",
		VectorDimension: 1536,
		SparseBackend:   "invalid-backend",
	})
	if !errors.Is(err, sharedroute.ErrCollectionMetaSparseBackendInvalid) {
		t.Fatalf("expected ErrCollectionMetaSparseBackendInvalid, got %v", err)
	}
}

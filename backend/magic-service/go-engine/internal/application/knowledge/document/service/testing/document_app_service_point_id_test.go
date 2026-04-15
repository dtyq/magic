package docapp_test

import (
	"testing"

	"github.com/google/uuid"

	appservice "magic/internal/application/knowledge/document/service"
)

func TestBuildPointIDIsDeterministicUUID(t *testing.T) {
	t.Parallel()

	chunkIdentityKey := appservice.BuildChunkIdentityKeyForTest("hash-chapter-section", 3)
	id1 := appservice.BuildPointIDForTest("KNOWLEDGE-1", "DOC-1", chunkIdentityKey)
	id2 := appservice.BuildPointIDForTest("KNOWLEDGE-1", "DOC-1", chunkIdentityKey)
	if id1 != id2 {
		t.Fatalf("expected deterministic point id, got %q and %q", id1, id2)
	}

	if _, err := uuid.Parse(id1); err != nil {
		t.Fatalf("expected point id to be valid UUID, got %q, err=%v", id1, err)
	}
}

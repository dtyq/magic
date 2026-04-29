package entity_test

import (
	"testing"
	"time"

	"magic/internal/domain/knowledge/document/entity"
	"magic/internal/domain/knowledge/shared"
)

func TestNewDocumentUsesProvidedCode(t *testing.T) {
	t.Parallel()

	doc := entity.NewDocument("kb-1", "doc-1", "doc-code", entity.DocumentInputKindFile, "u1", "org-1")

	if doc.Code != "doc-code" {
		t.Fatalf("expected provided code, got %q", doc.Code)
	}
	if doc.OrganizationCode != "org-1" || doc.KnowledgeBaseCode != "kb-1" {
		t.Fatalf("unexpected scope: %#v", doc)
	}
	if !doc.Enabled {
		t.Fatal("expected document enabled by default")
	}
	if doc.SyncStatus != shared.SyncStatusPending {
		t.Fatalf("expected pending sync status, got %v", doc.SyncStatus)
	}
	if doc.DocMetadata == nil {
		t.Fatal("expected doc metadata initialized")
	}
	if doc.EmbeddingConfig == nil || doc.VectorDBConfig == nil {
		t.Fatalf("expected configs initialized, got embedding=%#v vector=%#v", doc.EmbeddingConfig, doc.VectorDBConfig)
	}
	if doc.CreatedUID != "u1" || doc.UpdatedUID != "u1" {
		t.Fatalf("unexpected uid fields: %#v", doc)
	}
	if doc.CreatedAt.IsZero() || doc.UpdatedAt.IsZero() {
		t.Fatal("expected timestamps initialized")
	}
	if doc.CreatedAt.After(time.Now()) || doc.UpdatedAt.After(time.Now()) {
		t.Fatalf("expected timestamps not in future, got created=%v updated=%v", doc.CreatedAt, doc.UpdatedAt)
	}
}

func TestNewDocumentGeneratesCodeWhenEmpty(t *testing.T) {
	t.Parallel()

	doc := entity.NewDocument("kb-1", "doc-1", "", entity.DocumentInputKindText, "u1", "org-1")

	if doc.Code == "" {
		t.Fatal("expected generated code")
	}
	if doc.DocType != int(entity.DocumentInputKindText) {
		t.Fatalf("expected doc type %d, got %d", entity.DocumentInputKindText, doc.DocType)
	}
}

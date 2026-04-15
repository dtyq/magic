package rebuild_test

import (
	"context"
	"errors"
	"testing"

	domainrebuild "magic/internal/domain/knowledge/rebuild"
	rebuildinfra "magic/internal/infrastructure/rebuild"
)

var errResyncBoom = errors.New("resync boom")

type fakeDocumentSyncer struct {
	organizationCode  string
	knowledgeBaseCode string
	documentCode      string
	userID            string
	override          rebuildinfra.Override
	err               error
}

func (f *fakeDocumentSyncer) SyncDocument(
	_ context.Context,
	organizationCode string,
	knowledgeBaseCode string,
	documentCode string,
	userID string,
	override rebuildinfra.Override,
) error {
	f.organizationCode = organizationCode
	f.knowledgeBaseCode = knowledgeBaseCode
	f.documentCode = documentCode
	f.userID = userID
	f.override = override
	return f.err
}

func TestAppDocumentResyncerResyncUsesSystemUserFallback(t *testing.T) {
	t.Parallel()

	syncer := &fakeDocumentSyncer{}
	resyncer := rebuildinfra.NewAppDocumentResyncer(syncer)

	err := resyncer.Resync(context.Background(), domainrebuild.DocumentTask{
		OrganizationCode:  "org-1",
		KnowledgeBaseCode: "kb-1",
		DocumentCode:      "doc-1",
		TargetCollection:  "shadow",
		TargetModel:       "text-embedding-3-large",
	})
	if err != nil {
		t.Fatalf("Resync() error = %v", err)
	}

	if syncer.organizationCode != "org-1" || syncer.knowledgeBaseCode != "kb-1" || syncer.documentCode != "doc-1" {
		t.Fatalf("unexpected sync target: %+v", syncer)
	}
	if syncer.userID != "system" {
		t.Fatalf("expected fallback userID %q, got %q", "system", syncer.userID)
	}
	if syncer.override.TargetCollection != "shadow" || syncer.override.TargetModel != "text-embedding-3-large" {
		t.Fatalf("unexpected override: %+v", syncer.override)
	}
}

func TestAppDocumentResyncerResyncWrapsError(t *testing.T) {
	t.Parallel()

	syncer := &fakeDocumentSyncer{err: errResyncBoom}
	resyncer := rebuildinfra.NewAppDocumentResyncer(syncer)

	err := resyncer.Resync(context.Background(), domainrebuild.DocumentTask{
		KnowledgeBaseCode: "kb-2",
		DocumentCode:      "doc-2",
		UserID:            "user-2",
	})
	if err == nil {
		t.Fatal("expected error")
	}
	if syncer.userID != "user-2" {
		t.Fatalf("expected explicit userID to be preserved, got %q", syncer.userID)
	}
	if got := err.Error(); got != "resync document kb-2/doc-2: resync boom" {
		t.Fatalf("unexpected error: %s", got)
	}
}

package document_test

import (
	"context"
	"errors"
	"testing"

	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/infrastructure/logging"
)

var (
	errDocumentSaveBoom          = errors.New("save boom")
	errDocumentUpdateBoom        = errors.New("update boom")
	errDocumentFindBoom          = errors.New("find boom")
	errDocumentListBoom          = errors.New("list boom")
	errDocumentListByKBBoom      = errors.New("list by kb boom")
	errDocumentCountByKBBoom     = errors.New("count by kb boom")
	errDocumentSyncStatusBoom    = errors.New("sync status boom")
	errDocumentEnsureDefaultBoom = errors.New("ensure default boom")
)

func TestDocumentDomainServiceErrorWrappers(t *testing.T) {
	t.Parallel()

	doc := &docentity.KnowledgeBaseDocument{ID: 1, Code: "doc-1"}
	svc := documentdomain.NewDocumentDomainService(&documentRepoStub{
		saveErr:                       errDocumentSaveBoom,
		updateErr:                     errDocumentUpdateBoom,
		findByCodeErr:                 errDocumentFindBoom,
		findByCodeAndKnowledgeBaseErr: errDocumentFindBoom,
		findByThirdFileErr:            errDocumentFindBoom,
		listErr:                       errDocumentListBoom,
		listByKnowledgeBaseErr:        errDocumentListByKBBoom,
		countByKnowledgeBaseCodesErr:  errDocumentCountByKBBoom,
		updateSyncStatusErr:           errDocumentSyncStatusBoom,
		ensureDefaultDocumentErr:      errDocumentEnsureDefaultBoom,
	}, logging.New())

	if err := svc.Save(context.Background(), doc); !errors.Is(err, errDocumentSaveBoom) {
		t.Fatalf("expected save error, got %v", err)
	}
	if err := svc.Update(context.Background(), doc); !errors.Is(err, errDocumentUpdateBoom) {
		t.Fatalf("expected update error, got %v", err)
	}
	if _, err := svc.Show(context.Background(), doc.Code); !errors.Is(err, errDocumentFindBoom) {
		t.Fatalf("expected show error, got %v", err)
	}
	if _, err := svc.ShowByCodeAndKnowledgeBase(context.Background(), doc.Code, "kb-1"); !errors.Is(err, errDocumentFindBoom) {
		t.Fatalf("expected show by kb error, got %v", err)
	}
	if _, err := svc.FindByThirdFile(context.Background(), "lark", "third-1"); !errors.Is(err, errDocumentFindBoom) {
		t.Fatalf("expected find by third file error, got %v", err)
	}
	if _, _, err := svc.List(context.Background(), nil); !errors.Is(err, errDocumentListBoom) {
		t.Fatalf("expected list error, got %v", err)
	}
	if _, _, err := svc.ListByKnowledgeBase(context.Background(), "kb-1", 0, 10); !errors.Is(err, errDocumentListByKBBoom) {
		t.Fatalf("expected list by kb error, got %v", err)
	}
	if _, err := svc.CountByKnowledgeBaseCodes(context.Background(), "org-1", []string{"kb-1"}); !errors.Is(err, errDocumentCountByKBBoom) {
		t.Fatalf("expected count by kb error, got %v", err)
	}
	if err := svc.UpdateSyncStatus(context.Background(), doc); !errors.Is(err, errDocumentSyncStatusBoom) {
		t.Fatalf("expected sync status error, got %v", err)
	}
	if _, _, err := svc.EnsureDefaultDocument(context.Background(), &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{Code: "kb-1"}); !errors.Is(err, errDocumentEnsureDefaultBoom) {
		t.Fatalf("expected ensure default error, got %v", err)
	}
}

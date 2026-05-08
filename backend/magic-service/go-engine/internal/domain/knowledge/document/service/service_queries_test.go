package document_test

import (
	"context"
	"errors"
	"testing"

	docentity "magic/internal/domain/knowledge/document/entity"
	docrepo "magic/internal/domain/knowledge/document/repository"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/infrastructure/logging"
)

var (
	errDocumentDeleteByKnowledgeBaseFailed = errors.New("delete by knowledge base failed")
	errUnsupportedDocumentLookup           = errors.New("unsupported document lookup in test stub")
)

func TestDocumentDomainServiceQueries(t *testing.T) {
	t.Parallel()

	doc := &docentity.KnowledgeBaseDocument{ID: 1, Code: "doc-1", Name: "Doc", KnowledgeBaseCode: "kb-1"}
	repo := &documentRepoStub{
		findByCodeResult:                 doc,
		findByCodeAndKnowledgeBaseResult: doc,
		findByThirdFileResult:            doc,
		listResult:                       []*docentity.KnowledgeBaseDocument{doc},
		listTotal:                        1,
		listByKnowledgeBaseResult:        []*docentity.KnowledgeBaseDocument{doc},
		listByKnowledgeBaseTotal:         1,
		countByKnowledgeBaseCodesResult:  map[string]int64{"kb-1": 2},
	}
	svc := documentdomain.NewDocumentDomainService(repo, logging.New())

	if got, err := svc.Show(context.Background(), "doc-1"); err != nil || got != doc {
		t.Fatalf("show got=%#v err=%v", got, err)
	}
	if got, err := svc.ShowByCodeAndKnowledgeBase(context.Background(), "doc-1", "kb-1"); err != nil || got != doc {
		t.Fatalf("show by kb got=%#v err=%v", got, err)
	}
	if got, err := svc.FindByThirdFile(context.Background(), "oss", "file-1"); err != nil || got != doc {
		t.Fatalf("find by third file got=%#v err=%v", got, err)
	}
	if got, total, err := svc.List(context.Background(), &docrepo.DocumentQuery{}); err != nil || total != 1 || len(got) != 1 {
		t.Fatalf("list got=%#v total=%d err=%v", got, total, err)
	}
	if got, total, err := svc.ListByKnowledgeBase(context.Background(), "kb-1", 0, 10); err != nil || total != 1 || len(got) != 1 {
		t.Fatalf("list by kb got=%#v total=%d err=%v", got, total, err)
	}
	if got, err := svc.CountByKnowledgeBaseCodes(context.Background(), "org-1", []string{"kb-1"}); err != nil || got["kb-1"] != 2 {
		t.Fatalf("count by kb got=%#v err=%v", got, err)
	}
}

func TestDocumentDomainServiceMutations(t *testing.T) {
	t.Parallel()

	doc := &docentity.KnowledgeBaseDocument{ID: 1, Code: "doc-1", Name: "Doc", KnowledgeBaseCode: "kb-1"}
	repo := &documentRepoStub{
		ensureDefaultDocumentResult:  doc,
		ensureDefaultDocumentCreated: true,
	}
	svc := documentdomain.NewDocumentDomainService(repo, logging.New())

	if err := svc.Save(context.Background(), doc); err != nil {
		t.Fatalf("save: %v", err)
	}
	if err := svc.Update(context.Background(), doc); err != nil {
		t.Fatalf("update: %v", err)
	}
	if err := svc.UpdateSyncStatus(context.Background(), &docentity.KnowledgeBaseDocument{ID: 1, SyncStatus: shared.SyncStatusSynced, SyncStatusMessage: "ok"}); err != nil {
		t.Fatalf("update sync status: %v", err)
	}
	if err := svc.DeleteByKnowledgeBase(context.Background(), "kb-1"); err != nil {
		t.Fatalf("delete by knowledge base: %v", err)
	}
	if repo.deletedKnowledgeBaseCode != "kb-1" {
		t.Fatalf("expected delete by knowledge base kb-1, got %q", repo.deletedKnowledgeBaseCode)
	}
	if got, created, err := svc.EnsureDefaultDocument(context.Background(), &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{Code: "kb-1"}); err != nil || !created || got != doc {
		t.Fatalf("ensure default doc=%#v created=%v err=%v", got, created, err)
	}
}

func TestDocumentDomainServiceDeleteByKnowledgeBaseReturnsRepoError(t *testing.T) {
	t.Parallel()

	repo := &documentRepoStub{deleteByKnowledgeBaseErr: errDocumentDeleteByKnowledgeBaseFailed}
	svc := documentdomain.NewDocumentDomainService(repo, logging.New())

	err := svc.DeleteByKnowledgeBase(context.Background(), "kb-1")
	if !errors.Is(err, errDocumentDeleteByKnowledgeBaseFailed) {
		t.Fatalf("expected delete by knowledge base error, got %v", err)
	}
}

type documentRepoStub struct {
	saveErr                          error
	updateErr                        error
	findByCodeErr                    error
	findByCodeResult                 *docentity.KnowledgeBaseDocument
	findByCodeAndKnowledgeBaseErr    error
	findByCodeAndKnowledgeBaseResult *docentity.KnowledgeBaseDocument
	findByKBAndProjectFileErr        error
	findByKBAndProjectFileResult     *docentity.KnowledgeBaseDocument
	findByThirdFileErr               error
	findByThirdFileResult            *docentity.KnowledgeBaseDocument
	listByKBAndProjectErr            error
	listByKBAndProjectResult         []*docentity.KnowledgeBaseDocument
	listErr                          error
	listResult                       []*docentity.KnowledgeBaseDocument
	listTotal                        int64
	listByKnowledgeBaseErr           error
	listByKnowledgeBaseResult        []*docentity.KnowledgeBaseDocument
	listByKnowledgeBaseTotal         int64
	countByKnowledgeBaseCodesErr     error
	countByKnowledgeBaseCodesResult  map[string]int64
	deleteErr                        error
	deleteByKnowledgeBaseErr         error
	updateSyncStatusErr              error
	ensureDefaultDocumentErr         error
	ensureDefaultDocumentResult      *docentity.KnowledgeBaseDocument
	ensureDefaultDocumentCreated     bool
	deletedID                        int64
	deletedKnowledgeBaseCode         string
	deletedKnowledgeBaseCodes        []string
}

func (s *documentRepoStub) Save(context.Context, *docentity.KnowledgeBaseDocument) error {
	return s.saveErr
}

func (s *documentRepoStub) Update(context.Context, *docentity.KnowledgeBaseDocument) error {
	return s.updateErr
}

func (s *documentRepoStub) Delete(_ context.Context, id int64) error {
	s.deletedID = id
	return s.deleteErr
}

func (s *documentRepoStub) DeleteByKnowledgeBase(_ context.Context, knowledgeBaseCode string) error {
	s.deletedKnowledgeBaseCode = knowledgeBaseCode
	return s.deleteByKnowledgeBaseErr
}

func (s *documentRepoStub) DeleteByKnowledgeBaseAndCodes(_ context.Context, knowledgeBaseCode string, codes []string) error {
	s.deletedKnowledgeBaseCode = knowledgeBaseCode
	s.deletedKnowledgeBaseCodes = append([]string(nil), codes...)
	return s.deleteByKnowledgeBaseErr
}

func (s *documentRepoStub) UpdateSyncStatus(context.Context, int64, shared.SyncStatus, string) error {
	return s.updateSyncStatusErr
}

func (s *documentRepoStub) EnsureDefaultDocument(context.Context, *docrepo.KnowledgeBaseRuntimeSnapshot) (*docentity.KnowledgeBaseDocument, bool, error) {
	return s.ensureDefaultDocumentResult, s.ensureDefaultDocumentCreated, s.ensureDefaultDocumentErr
}

func (s *documentRepoStub) FindByID(context.Context, int64) (*docentity.KnowledgeBaseDocument, error) {
	return nil, errUnsupportedDocumentLookup
}

func (s *documentRepoStub) FindByCode(context.Context, string) (*docentity.KnowledgeBaseDocument, error) {
	return s.findByCodeResult, s.findByCodeErr
}

func (s *documentRepoStub) FindByCodeAndKnowledgeBase(context.Context, string, string) (*docentity.KnowledgeBaseDocument, error) {
	return s.findByCodeAndKnowledgeBaseResult, s.findByCodeAndKnowledgeBaseErr
}

func (s *documentRepoStub) FindByKnowledgeBaseAndThirdFile(context.Context, string, string, string) (*docentity.KnowledgeBaseDocument, error) {
	return s.findByThirdFileResult, s.findByThirdFileErr
}

func (s *documentRepoStub) FindByKnowledgeBaseAndProjectFile(context.Context, string, int64) (*docentity.KnowledgeBaseDocument, error) {
	return s.findByKBAndProjectFileResult, s.findByKBAndProjectFileErr
}

func (s *documentRepoStub) FindByThirdFile(context.Context, string, string) (*docentity.KnowledgeBaseDocument, error) {
	return s.findByThirdFileResult, s.findByThirdFileErr
}

func (s *documentRepoStub) ListByThirdFileInOrg(context.Context, string, string, string) ([]*docentity.KnowledgeBaseDocument, error) {
	if s.findByThirdFileResult == nil {
		if s.findByThirdFileErr != nil {
			return nil, s.findByThirdFileErr
		}
		return nil, nil
	}
	return []*docentity.KnowledgeBaseDocument{s.findByThirdFileResult}, s.findByThirdFileErr
}

func (s *documentRepoStub) ListRealtimeByThirdFileInOrg(ctx context.Context, organizationCode, thirdPlatformType, thirdFileID string) ([]*docentity.KnowledgeBaseDocument, error) {
	return s.ListByThirdFileInOrg(ctx, organizationCode, thirdPlatformType, thirdFileID)
}

func (s *documentRepoStub) HasRealtimeThirdFileDocumentInOrg(ctx context.Context, organizationCode, thirdPlatformType, thirdFileID string) (bool, error) {
	docs, err := s.ListRealtimeByThirdFileInOrg(ctx, organizationCode, thirdPlatformType, thirdFileID)
	return len(docs) > 0, err
}

func (s *documentRepoStub) ListByProjectFileInOrg(context.Context, string, int64) ([]*docentity.KnowledgeBaseDocument, error) {
	if s.findByKBAndProjectFileResult == nil {
		if s.findByKBAndProjectFileErr != nil {
			return nil, s.findByKBAndProjectFileErr
		}
		return nil, nil
	}
	return []*docentity.KnowledgeBaseDocument{s.findByKBAndProjectFileResult}, s.findByKBAndProjectFileErr
}

func (s *documentRepoStub) ListRealtimeByProjectFileInOrg(ctx context.Context, organizationCode string, projectFileID int64) ([]*docentity.KnowledgeBaseDocument, error) {
	return s.ListByProjectFileInOrg(ctx, organizationCode, projectFileID)
}

func (s *documentRepoStub) HasRealtimeProjectFileDocumentInOrg(ctx context.Context, organizationCode string, projectFileID int64) (bool, error) {
	docs, err := s.ListRealtimeByProjectFileInOrg(ctx, organizationCode, projectFileID)
	return len(docs) > 0, err
}

func (s *documentRepoStub) ListByKnowledgeBaseAndProject(context.Context, string, int64) ([]*docentity.KnowledgeBaseDocument, error) {
	return s.listByKBAndProjectResult, s.listByKBAndProjectErr
}

func (s *documentRepoStub) List(context.Context, *docrepo.DocumentQuery) ([]*docentity.KnowledgeBaseDocument, int64, error) {
	return s.listResult, s.listTotal, s.listErr
}

func (s *documentRepoStub) ListByKnowledgeBase(context.Context, string, int, int) ([]*docentity.KnowledgeBaseDocument, int64, error) {
	return s.listByKnowledgeBaseResult, s.listByKnowledgeBaseTotal, s.listByKnowledgeBaseErr
}

func (s *documentRepoStub) ListByKnowledgeBaseAndSourceBindingIDs(context.Context, string, []int64) ([]*docentity.KnowledgeBaseDocument, error) {
	return s.listByKnowledgeBaseResult, s.listByKnowledgeBaseErr
}

func (s *documentRepoStub) CountByKnowledgeBaseCodes(context.Context, string, []string) (map[string]int64, error) {
	return s.countByKnowledgeBaseCodesResult, s.countByKnowledgeBaseCodesErr
}

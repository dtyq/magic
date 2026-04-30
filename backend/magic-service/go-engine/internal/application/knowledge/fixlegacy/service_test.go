package fixlegacy_test

import (
	"context"
	"errors"
	"slices"
	"sync"
	"testing"

	fixlegacy "magic/internal/application/knowledge/fixlegacy"
	docentity "magic/internal/domain/knowledge/document/entity"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
)

var (
	errTestKnowledgeBaseNotFound = errors.New("knowledge base not found")
	errTestSyncFailed            = errors.New("sync failed")
)

func TestRunnerDryRunDoesNotMutateData(t *testing.T) {
	t.Parallel()

	fragmentRepo := &fakeFragmentRepository{
		fragments: []*fragmodel.KnowledgeBaseFragment{
			{ID: 1, KnowledgeCode: "kb-1", DocumentCode: ""},
			{ID: 2, KnowledgeCode: "kb-1", DocumentCode: ""},
		},
	}
	runner := fixlegacy.NewRunner(
		fragmentRepo,
		&fakeKnowledgeBaseReader{knowledgeBases: map[string]*kbentity.KnowledgeBase{
			"kb-1": {Code: "kb-1", OrganizationCode: "org-1"},
		}},
		&fakeDefaultDocumentEnsurer{},
		&fakeFragmentSyncer{},
		logging.New(),
	)

	result, err := runner.Run(context.Background(), fixlegacy.Options{DryRun: true, BatchSize: 10})
	if err != nil {
		t.Fatalf("run dry run: %v", err)
	}

	if result.Candidates != 2 || result.Updated != 0 || result.Synced != 0 {
		t.Fatalf("unexpected result: %+v", result)
	}
	if fragmentRepo.backfillCalls != 0 {
		t.Fatalf("expected no backfill call, got %d", fragmentRepo.backfillCalls)
	}
}

func TestRunnerRepairsMultipleKnowledgeBasesAndSyncsPayload(t *testing.T) {
	t.Parallel()

	fragmentRepo := &fakeFragmentRepository{
		fragments: []*fragmodel.KnowledgeBaseFragment{
			{ID: 1, KnowledgeCode: "kb-1", DocumentCode: "", Content: "a"},
			{ID: 2, KnowledgeCode: "kb-2", DocumentCode: "", Content: "b"},
			{ID: 3, KnowledgeCode: "kb-2", DocumentCode: "", Content: "c"},
		},
	}
	knowledgeReader := &fakeKnowledgeBaseReader{knowledgeBases: map[string]*kbentity.KnowledgeBase{
		"kb-1": {Code: "kb-1", OrganizationCode: "org-1", CreatedUID: "u-1", UpdatedUID: "u-1", Model: "m1", VectorDB: "qdrant"},
		"kb-2": {Code: "kb-2", OrganizationCode: "org-1", CreatedUID: "u-1", UpdatedUID: "u-1", Model: "m1", VectorDB: "qdrant"},
	}}
	docEnsurer := &fakeDefaultDocumentEnsurer{}
	syncer := &fakeFragmentSyncer{}
	runner := fixlegacy.NewRunner(fragmentRepo, knowledgeReader, docEnsurer, syncer, logging.New())

	result, err := runner.Run(context.Background(), fixlegacy.Options{BatchSize: 10, SyncConcurrency: 2})
	if err != nil {
		t.Fatalf("run repair: %v", err)
	}

	if result.Updated != 3 || result.Synced != 3 || result.Failed != 0 {
		t.Fatalf("unexpected result: %+v", result)
	}
	if docEnsurer.createCalls["kb-1"] != 1 || docEnsurer.createCalls["kb-2"] != 1 {
		t.Fatalf("expected default document created once per kb, got %#v", docEnsurer.createCalls)
	}
	expectedCodes := []string{"kb-1-DEFAULT-DOC", "kb-2-DEFAULT-DOC", "kb-2-DEFAULT-DOC"}
	actualCodes := append([]string(nil), syncer.syncedDocumentCodes...)
	slices.Sort(actualCodes)
	slices.Sort(expectedCodes)
	if !slices.Equal(actualCodes, expectedCodes) {
		t.Fatalf("unexpected synced document codes: %#v", syncer.syncedDocumentCodes)
	}
}

func TestRunnerIsIdempotentAndStartIDWorks(t *testing.T) {
	t.Parallel()

	fragmentRepo := &fakeFragmentRepository{
		fragments: []*fragmodel.KnowledgeBaseFragment{
			{ID: 1, KnowledgeCode: "kb-1", DocumentCode: "", Content: "skip"},
			{ID: 2, KnowledgeCode: "kb-1", DocumentCode: "", Content: "repair"},
			{ID: 3, KnowledgeCode: "kb-1", DocumentCode: "", Content: "repair-2"},
		},
	}
	knowledgeReader := &fakeKnowledgeBaseReader{knowledgeBases: map[string]*kbentity.KnowledgeBase{
		"kb-1": {Code: "kb-1", OrganizationCode: "org-1", CreatedUID: "u-1", UpdatedUID: "u-1", Model: "m1", VectorDB: "qdrant"},
	}}
	docEnsurer := &fakeDefaultDocumentEnsurer{}
	syncer := &fakeFragmentSyncer{}
	runner := fixlegacy.NewRunner(fragmentRepo, knowledgeReader, docEnsurer, syncer, logging.New())

	first, err := runner.Run(context.Background(), fixlegacy.Options{BatchSize: 10, StartID: 1})
	if err != nil {
		t.Fatalf("first run: %v", err)
	}
	if first.Updated != 2 || first.Synced != 2 {
		t.Fatalf("unexpected first result: %+v", first)
	}

	second, err := runner.Run(context.Background(), fixlegacy.Options{BatchSize: 10, StartID: 1})
	if err != nil {
		t.Fatalf("second run: %v", err)
	}
	if second.Candidates != 0 || second.Updated != 0 || second.Synced != 0 {
		t.Fatalf("unexpected second result: %+v", second)
	}
}

func TestRunnerReturnsFailuresButContinues(t *testing.T) {
	t.Parallel()

	fragmentRepo := &fakeFragmentRepository{
		fragments: []*fragmodel.KnowledgeBaseFragment{
			{ID: 1, KnowledgeCode: "kb-1", DocumentCode: "", Content: "a"},
			{ID: 2, KnowledgeCode: "kb-2", DocumentCode: "", Content: "b"},
		},
	}
	runner := fixlegacy.NewRunner(
		fragmentRepo,
		&fakeKnowledgeBaseReader{knowledgeBases: map[string]*kbentity.KnowledgeBase{
			"kb-1": {Code: "kb-1", OrganizationCode: "org-1", CreatedUID: "u-1", UpdatedUID: "u-1"},
			"kb-2": {Code: "kb-2", OrganizationCode: "org-1", CreatedUID: "u-1", UpdatedUID: "u-1"},
		}},
		&fakeDefaultDocumentEnsurer{},
		&fakeFragmentSyncer{failKnowledgeCode: "kb-2"},
		logging.New(),
	)

	result, err := runner.Run(context.Background(), fixlegacy.Options{BatchSize: 10, SyncConcurrency: 2})
	if err != nil {
		t.Fatalf("run with failure: %v", err)
	}
	if !result.HasFailures() || len(result.Failures) != 1 {
		t.Fatalf("expected one failure sample, got %+v", result)
	}
	if result.Updated != 2 || result.Synced != 1 || result.Failed != 1 {
		t.Fatalf("unexpected result: %+v", result)
	}
}

type fakeFragmentRepository struct {
	fragments      []*fragmodel.KnowledgeBaseFragment
	backfillCalls  int
	backfillDocMap map[int64]string
	mu             sync.RWMutex
}

func (f *fakeFragmentRepository) ListMissingDocumentCode(_ context.Context, query fixlegacy.ScanQuery) ([]*fragmodel.KnowledgeBaseFragment, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	limit := query.Limit
	if limit <= 0 {
		limit = len(f.fragments)
	}
	result := make([]*fragmodel.KnowledgeBaseFragment, 0, limit)
	for _, fragment := range f.fragments {
		if fragment.ID <= query.StartID {
			continue
		}
		if query.KnowledgeCode != "" && fragment.KnowledgeCode != query.KnowledgeCode {
			continue
		}
		if fragment.DocumentCode != "" {
			continue
		}
		result = append(result, cloneFragment(fragment))
		if len(result) == limit {
			break
		}
	}
	return result, nil
}

func (f *fakeFragmentRepository) BackfillDocumentCode(_ context.Context, ids []int64, documentCode string) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.backfillCalls++
	if f.backfillDocMap == nil {
		f.backfillDocMap = map[int64]string{}
	}
	var updated int64
	for _, id := range ids {
		for _, fragment := range f.fragments {
			if fragment.ID != id || fragment.DocumentCode != "" {
				continue
			}
			fragment.DocumentCode = documentCode
			f.backfillDocMap[id] = documentCode
			updated++
		}
	}
	return updated, nil
}

func (f *fakeFragmentRepository) FindByIDs(_ context.Context, ids []int64) ([]*fragmodel.KnowledgeBaseFragment, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	set := make(map[int64]struct{}, len(ids))
	for _, id := range ids {
		set[id] = struct{}{}
	}
	result := make([]*fragmodel.KnowledgeBaseFragment, 0, len(ids))
	for _, fragment := range f.fragments {
		if _, ok := set[fragment.ID]; !ok {
			continue
		}
		result = append(result, cloneFragment(fragment))
	}
	return result, nil
}

type fakeKnowledgeBaseReader struct {
	knowledgeBases map[string]*kbentity.KnowledgeBase
}

func (f *fakeKnowledgeBaseReader) Show(_ context.Context, code string) (*kbentity.KnowledgeBase, error) {
	kb, ok := f.knowledgeBases[code]
	if !ok {
		return nil, errTestKnowledgeBaseNotFound
	}
	return cloneKnowledgeBase(kb), nil
}

func (f *fakeKnowledgeBaseReader) ShowByCodeAndOrg(_ context.Context, code, orgCode string) (*kbentity.KnowledgeBase, error) {
	kb, ok := f.knowledgeBases[code]
	if !ok || kb.OrganizationCode != orgCode {
		return nil, errTestKnowledgeBaseNotFound
	}
	return cloneKnowledgeBase(kb), nil
}

type fakeDefaultDocumentEnsurer struct {
	documents   map[string]*docentity.KnowledgeBaseDocument
	createCalls map[string]int
	mu          sync.Mutex
}

func (f *fakeDefaultDocumentEnsurer) EnsureDefaultDocument(_ context.Context, kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot) (*docentity.KnowledgeBaseDocument, bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.documents == nil {
		f.documents = map[string]*docentity.KnowledgeBaseDocument{}
	}
	if f.createCalls == nil {
		f.createCalls = map[string]int{}
	}
	if doc, ok := f.documents[kb.Code]; ok {
		return cloneDocument(doc), false, nil
	}
	doc := docentity.NewDocument(kb.Code, "未命名文档.txt", kb.DefaultDocumentCode(), docentity.DocumentInputKindText, kb.CreatedUID, kb.OrganizationCode)
	doc.DocType = int(docentity.DocumentInputKindText)
	f.documents[kb.Code] = doc
	f.createCalls[kb.Code]++
	return cloneDocument(doc), true, nil
}

type fakeFragmentSyncer struct {
	syncedDocumentCodes []string
	failKnowledgeCode   string
	mu                  sync.Mutex
}

func (f *fakeFragmentSyncer) SyncFragmentBatch(_ context.Context, kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot, fragments []*fragmodel.KnowledgeBaseFragment, _ *ctxmeta.BusinessParams) error {
	if kb != nil && kb.Code == f.failKnowledgeCode {
		return errTestSyncFailed
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, fragment := range fragments {
		f.syncedDocumentCodes = append(f.syncedDocumentCodes, fragment.DocumentCode)
	}
	return nil
}

func cloneFragment(fragment *fragmodel.KnowledgeBaseFragment) *fragmodel.KnowledgeBaseFragment {
	if fragment == nil {
		return nil
	}
	cloned := *fragment
	return &cloned
}

func cloneKnowledgeBase(kb *kbentity.KnowledgeBase) *kbentity.KnowledgeBase {
	if kb == nil {
		return nil
	}
	cloned := *kb
	return &cloned
}

func cloneDocument(doc *docentity.KnowledgeBaseDocument) *docentity.KnowledgeBaseDocument {
	if doc == nil {
		return nil
	}
	cloned := *doc
	return &cloned
}

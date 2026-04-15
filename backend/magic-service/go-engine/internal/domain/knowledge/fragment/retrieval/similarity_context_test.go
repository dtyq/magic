package retrieval_test

import (
	"context"
	"errors"
	"maps"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/go-ego/gse"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	retrieval "magic/internal/domain/knowledge/fragment/retrieval"
	shared "magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/knowledgeroute"
)

var (
	errBatchLookupFailed  = errors.New("batch lookup failed")
	errUnexpectedStubCall = errors.New("unexpected stub call")
)

func TestEnrichSimilarityResultsWithContextUsesBatchLookup(t *testing.T) {
	repo := &contextFragmentRepoStub{
		batchFragments: map[fragmodel.DocumentKey][]*fragmodel.KnowledgeBaseFragment{
			{KnowledgeCode: "KB1", DocumentCode: "DOC1"}: {{KnowledgeCode: "KB1", DocumentCode: "DOC1", Content: "doc1 context"}},
			{KnowledgeCode: "KB1", DocumentCode: "DOC2"}: {{KnowledgeCode: "KB1", DocumentCode: "DOC2", Content: "doc2 context"}},
		},
	}
	results := []*fragmodel.SimilarityResult{
		{KnowledgeCode: "KB1", DocumentCode: "DOC1", Content: "hit-1"},
		{KnowledgeCode: "KB1", DocumentCode: "DOC1", Content: "hit-2"},
		{KnowledgeCode: "KB1", DocumentCode: "DOC2", Content: "hit-3"},
	}

	enriched := retrieval.EnrichSimilarityResultsWithContextForTest(context.Background(), results, repo)

	if len(enriched) != 3 {
		t.Fatalf("expected 3 enriched results, got %d", len(enriched))
	}
	if repo.batchCalls != 1 {
		t.Fatalf("expected one batch lookup, got %d", repo.batchCalls)
	}
	if repo.listCalls != 0 {
		t.Fatalf("expected no fallback list calls, got %d", repo.listCalls)
	}
}

func TestEnrichSimilarityResultsWithContextFallsBackPerDocumentOnBatchError(t *testing.T) {
	repo := &contextFragmentRepoStub{
		batchErr: errBatchLookupFailed,
		listFragments: map[fragmodel.DocumentKey][]*fragmodel.KnowledgeBaseFragment{
			{KnowledgeCode: "KB1", DocumentCode: "DOC1"}: {{KnowledgeCode: "KB1", DocumentCode: "DOC1", Content: "doc1 context"}},
			{KnowledgeCode: "KB1", DocumentCode: "DOC2"}: {{KnowledgeCode: "KB1", DocumentCode: "DOC2", Content: "doc2 context"}},
		},
	}
	results := []*fragmodel.SimilarityResult{
		{KnowledgeCode: "KB1", DocumentCode: "DOC1", Content: "hit-1"},
		{KnowledgeCode: "KB1", DocumentCode: "DOC1", Content: "hit-2"},
		{KnowledgeCode: "KB1", DocumentCode: "DOC2", Content: "hit-3"},
	}

	enriched := retrieval.EnrichSimilarityResultsWithContextForTest(context.Background(), results, repo)

	if len(enriched) != 3 {
		t.Fatalf("expected 3 enriched results, got %d", len(enriched))
	}
	if repo.batchCalls != 1 {
		t.Fatalf("expected one batch lookup attempt, got %d", repo.batchCalls)
	}
	if repo.listCalls != 2 {
		t.Fatalf("expected fallback list calls for 2 unique documents, got %d", repo.listCalls)
	}
}

func TestEnrichSimilarityResultsWithContextBackfillsFragmentIDFromContextFragments(t *testing.T) {
	repo := &contextFragmentRepoStub{
		batchFragments: map[fragmodel.DocumentKey][]*fragmodel.KnowledgeBaseFragment{
			{KnowledgeCode: "KB1", DocumentCode: "DOC1"}: {{
				ID:            88,
				BusinessID:    "BIZ-88",
				KnowledgeCode: "KB1",
				DocumentCode:  "DOC1",
				PointID:       "POINT-1",
				Content:       "doc1 context",
			}},
		},
	}
	results := []*fragmodel.SimilarityResult{
		{
			KnowledgeCode: "KB1",
			DocumentCode:  "DOC1",
			Content:       "hit-1",
			Metadata: map[string]any{
				"point_id": "POINT-1",
			},
		},
	}

	enriched := retrieval.EnrichSimilarityResultsWithContextForTest(context.Background(), results, repo)

	if len(enriched) != 1 || enriched[0].FragmentID != 88 {
		t.Fatalf("expected fragment id backfilled from context fragments, got %#v", enriched)
	}
	if enriched[0].BusinessID != "BIZ-88" {
		t.Fatalf("expected business id backfilled from context fragments, got %#v", enriched)
	}
	if repo.pointLookupCalls != 0 {
		t.Fatalf("expected no point lookup fallback, got %d", repo.pointLookupCalls)
	}
}

func TestEnrichSimilarityResultsWithContextUsesDocumentFallbackBeforePointLookup(t *testing.T) {
	repo := &contextFragmentRepoStub{
		batchErr: errBatchLookupFailed,
		listFragments: map[fragmodel.DocumentKey][]*fragmodel.KnowledgeBaseFragment{
			{KnowledgeCode: "KB1", DocumentCode: "DOC1"}: {{
				ID:            77,
				BusinessID:    "BIZ-77",
				KnowledgeCode: "KB1",
				DocumentCode:  "DOC1",
				PointID:       "POINT-77",
				Content:       "doc1 context",
			}},
		},
	}
	results := []*fragmodel.SimilarityResult{
		{
			KnowledgeCode: "KB1",
			DocumentCode:  "DOC1",
			Content:       "hit-1",
			Metadata: map[string]any{
				"point_id": "POINT-77",
			},
		},
	}

	enriched := retrieval.EnrichSimilarityResultsWithContextForTest(context.Background(), results, repo)

	if len(enriched) != 1 || enriched[0].FragmentID != 77 || enriched[0].BusinessID != "BIZ-77" {
		t.Fatalf("expected fragment fields backfilled from document fallback, got %#v", enriched)
	}
	if repo.listCalls != 1 {
		t.Fatalf("expected one document fallback list call, got %d", repo.listCalls)
	}
	if repo.pointLookupCalls != 0 {
		t.Fatalf("expected no point lookup fallback when document fallback succeeds, got %d", repo.pointLookupCalls)
	}
}

func TestEnrichSimilarityResultsWithContextFallsBackToPointLookupForFragmentID(t *testing.T) {
	repo := &contextFragmentRepoStub{
		pointLookupFragments: map[string]*fragmodel.KnowledgeBaseFragment{
			"POINT-2": {
				ID:         99,
				BusinessID: "BIZ-99",
				PointID:    "POINT-2",
			},
		},
	}
	results := []*fragmodel.SimilarityResult{
		{
			KnowledgeCode: "KB1",
			DocumentCode:  "DOC2",
			Content:       "hit-2",
			Metadata: map[string]any{
				"point_id": "POINT-2",
			},
		},
	}

	enriched := retrieval.EnrichSimilarityResultsWithContextForTest(context.Background(), results, repo)

	if len(enriched) != 1 || enriched[0].FragmentID != 99 {
		t.Fatalf("expected fragment id backfilled via point lookup, got %#v", enriched)
	}
	if enriched[0].BusinessID != "BIZ-99" {
		t.Fatalf("expected business id backfilled via point lookup, got %#v", enriched)
	}
	if repo.pointLookupCalls != 1 {
		t.Fatalf("expected one point lookup fallback, got %d", repo.pointLookupCalls)
	}
}

func TestEnrichSimilarityResultsWithContextFallsBackToScopedPointLookupForFragmentID(t *testing.T) {
	repo := &contextFragmentRepoStub{
		pointLookupFragments: map[string]*fragmodel.KnowledgeBaseFragment{
			"POINT-2": {
				ID:      99,
				PointID: "POINT-2",
			},
		},
	}
	results := []*fragmodel.SimilarityResult{
		{
			KnowledgeCode: "KB1",
			DocumentCode:  "DOC2",
			Content:       "hit-2",
			Metadata: map[string]any{
				"point_id": "POINT-2",
			},
		},
	}

	enriched := retrieval.EnrichSimilarityResultsWithContextForTest(context.Background(), results, repo)

	if len(enriched) != 1 || enriched[0].FragmentID != 99 {
		t.Fatalf("expected fragment id backfilled via scoped point lookup, got %#v", enriched)
	}
	if repo.pointLookupCalls != 1 {
		t.Fatalf("expected one scoped point lookup, got %d", repo.pointLookupCalls)
	}
	if repo.pointBatchCalls != 0 {
		t.Fatalf("expected no batch point lookup, got %d", repo.pointBatchCalls)
	}
}

func TestSearchSimilarityCandidatesReadsCollectionMetaOnce(t *testing.T) {
	reader := managedBM25MetaReader()
	service := retrieval.NewService(
		nil,
		embeddingServiceStub{},
		retrieval.Infra{
			VectorDataRepo:        &vectorDataRepoStub{},
			MetaReader:            reader,
			DefaultEmbeddingModel: "text-embedding-3-small",
		},
	)

	_, err := retrieval.SearchSimilarityCandidatesForTest(
		context.Background(),
		service,
		&struct{ Code string }{Code: "KB1"},
		retrieval.SimilarityRequest{
			Query:                   "退款 section:帮助中心",
			TopK:                    4,
			CandidateScoreThreshold: 0.1,
		},
	)
	if err != nil {
		t.Fatalf("SearchSimilarityCandidatesForTest returned error: %v", err)
	}
	if reader.calls.Load() != 1 {
		t.Fatalf("expected GetCollectionMeta to be called once, got %d", reader.calls.Load())
	}
}

func TestSearchSimilarityCandidatesUsesCapabilitySelectedSparseBackend(t *testing.T) {
	vectorRepo := &vectorDataRepoStub{
		selections: map[string]shared.SparseBackendSelection{
			shared.SparseBackendQdrantBM25ZHV1: {
				Requested:      shared.SparseBackendQdrantBM25ZHV1,
				Effective:      shared.SparseBackendClientBM25QdrantIDFV1,
				Reason:         shared.SparseBackendSelectionReasonQueryPointsUnsupported,
				ProbeStatus:    "ready",
				QuerySupported: false,
			},
		},
	}
	service := retrieval.NewService(
		nil,
		embeddingServiceStub{},
		retrieval.Infra{
			VectorDataRepo:        vectorRepo,
			MetaReader:            managedBM25MetaReader(),
			DefaultEmbeddingModel: "text-embedding-3-small",
		},
	)

	_, err := retrieval.SearchSimilarityCandidatesForTest(
		context.Background(),
		service,
		&struct{ Code string }{Code: "KB1"},
		retrieval.SimilarityRequest{
			Query:                   "退款 API 错误码",
			TopK:                    4,
			CandidateScoreThreshold: 0.1,
		},
	)
	if err != nil {
		t.Fatalf("SearchSimilarityCandidatesForTest returned error: %v", err)
	}

	requests := vectorRepo.sparseSearchRequests()
	if len(requests) != 1 {
		t.Fatalf("expected one sparse search request, got %d", len(requests))
	}
	if requests[0].Vector == nil || requests[0].Document != nil {
		t.Fatalf("expected capability-selected vector sparse request, got %+v", requests[0])
	}
}

func TestSearchSimilarityCandidatesShortQuerySkipsSparseSearch(t *testing.T) {
	assertShortQuerySkipsSparseSearch(t, "小")
}

func TestSearchSimilarityCandidatesShortASCIIQuerySkipsSparseSearch(t *testing.T) {
	assertShortQuerySkipsSparseSearch(t, "a")
}

func assertShortQuerySkipsSparseSearch(t *testing.T, query string) {
	t.Helper()

	vectorRepo := &vectorDataRepoStub{}
	service := retrieval.NewService(
		nil,
		embeddingServiceStub{},
		retrieval.Infra{
			VectorDataRepo:        vectorRepo,
			MetaReader:            managedBM25MetaReader(),
			DefaultEmbeddingModel: "text-embedding-3-small",
		},
	)

	_, err := retrieval.SearchSimilarityCandidatesForTest(
		context.Background(),
		service,
		&struct{ Code string }{Code: "KB1"},
		retrieval.SimilarityRequest{
			Query:                   query,
			TopK:                    4,
			CandidateScoreThreshold: 0.1,
		},
	)
	if err != nil {
		t.Fatalf("SearchSimilarityCandidatesForTest returned error: %v", err)
	}
	if vectorRepo.sparseCalls.Load() != 0 {
		t.Fatalf("expected short query %q to skip sparse search, got %d", query, vectorRepo.sparseCalls.Load())
	}
	if vectorRepo.denseCalls.Load() == 0 {
		t.Fatalf("expected short query %q to keep dense search enabled", query)
	}
}

func TestSearchSimilarityCandidatesSoftFilterFallbackKeepsSparseSearch(t *testing.T) {
	vectorRepo := &vectorDataRepoStub{
		denseResponsePlan: [][]*fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{
			nil,
			{{ID: "doc-1", Score: 0.9}},
		},
	}
	service := retrieval.NewService(
		nil,
		embeddingServiceStub{},
		retrieval.Infra{
			VectorDataRepo:        vectorRepo,
			MetaReader:            managedBM25MetaReader(),
			DefaultEmbeddingModel: "text-embedding-3-small",
		},
	)

	_, err := retrieval.SearchSimilarityCandidatesForTest(
		context.Background(),
		service,
		&struct{ Code string }{Code: "KB1"},
		retrieval.SimilarityRequest{
			Query:                   "退款 section:帮助中心",
			TopK:                    1,
			CandidateScoreThreshold: 0.1,
		},
	)
	if err != nil {
		t.Fatalf("SearchSimilarityCandidatesForTest returned error: %v", err)
	}

	sparseRequests := vectorRepo.sparseSearchRequests()
	if len(sparseRequests) != 2 {
		t.Fatalf("expected sparse search to run on both primary and soft-filter fallback passes, got %#v", sparseRequests)
	}

	foundHardOnlySparseFallback := false
	for _, request := range sparseRequests {
		filter := request.Filter
		if filter != nil && len(filter.Must) == 1 && len(filter.Should) == 0 && len(filter.MustNot) == 0 {
			foundHardOnlySparseFallback = true
			break
		}
	}
	if !foundHardOnlySparseFallback {
		t.Fatalf("expected a sparse search on soft-filter fallback, got %#v", sparseRequests)
	}
}

func TestSearchSimilarityCandidatesUsesResolvedTermNamespace(t *testing.T) {
	vectorRepo := &vectorDataRepoStub{}
	service := retrieval.NewService(
		nil,
		embeddingServiceStub{},
		retrieval.Infra{
			VectorDataRepo:        vectorRepo,
			MetaReader:            managedBM25MetaReader(),
			DefaultEmbeddingModel: "text-embedding-3-small",
		},
	)

	ctx := knowledgeroute.WithRebuildOverride(context.Background(), &knowledgeroute.RebuildOverride{
		TargetCollection:     "magic_knowledge_active",
		TargetTermCollection: "magic_knowledge_shadow_terms",
	})
	_, err := retrieval.SearchSimilarityCandidatesForTest(
		ctx,
		service,
		&struct{ Code string }{Code: "KB1"},
		retrieval.SimilarityRequest{
			Query:                   "退款 section:帮助中心",
			TopK:                    4,
			CandidateScoreThreshold: 0.1,
		},
	)
	if err != nil {
		t.Fatalf("SearchSimilarityCandidatesForTest returned error: %v", err)
	}

	denseRequests := vectorRepo.denseSearchRequests()
	if len(denseRequests) == 0 || denseRequests[0].Collection != "magic_knowledge_active" {
		t.Fatalf("expected dense search to use vector collection, got %#v", denseRequests)
	}

	sparseRequests := vectorRepo.sparseSearchRequests()
	if len(sparseRequests) == 0 || sparseRequests[0].Collection != "magic_knowledge_shadow_terms" {
		t.Fatalf("expected sparse search to use resolved term namespace, got %#v", sparseRequests)
	}
}

func TestSearchSimilarityCandidatesDoesNotLowerCandidateThreshold(t *testing.T) {
	vectorRepo := &vectorDataRepoStub{}
	service := retrieval.NewService(
		nil,
		embeddingServiceStub{},
		retrieval.Infra{
			VectorDataRepo:        vectorRepo,
			DefaultEmbeddingModel: "text-embedding-3-small",
		},
	)

	_, err := retrieval.SearchSimilarityCandidatesForTest(
		context.Background(),
		service,
		&struct{ Code string }{Code: "KB1"},
		retrieval.SimilarityRequest{
			Query:                   "这是一个用于验证长查询阈值回退的测试语句，虽然这里已经固定候选阈值为 0.1，但增强检索仍然应该在候选不足时把最后一轮 dense 检索的阈值降低到 0。",
			TopK:                    4,
			CandidateScoreThreshold: 0.1,
		},
	)
	if err != nil {
		t.Fatalf("SearchSimilarityCandidatesForTest returned error: %v", err)
	}

	denseRequests := vectorRepo.denseSearchRequests()
	if len(denseRequests) != 2 {
		t.Fatalf("expected two dense search passes without candidate threshold fallback, got %#v", denseRequests)
	}
	if denseRequests[0].ScoreThreshold != 0.1 || denseRequests[1].ScoreThreshold != 0.1 {
		t.Fatalf("expected dense passes to keep threshold 0.1, got %#v", denseRequests)
	}
}

func TestSearchSimilarityCandidatesEnhancedRetrievalUsesEmbeddingQuery(t *testing.T) {
	t.Parallel()

	vectorRepo := &vectorDataRepoStub{}
	embeddingSvc := &recordingEmbeddingServiceStub{}
	service := retrieval.NewService(
		nil,
		embeddingSvc,
		retrieval.Infra{
			VectorDataRepo:        vectorRepo,
			MetaReader:            managedBM25MetaReader(),
			DefaultEmbeddingModel: "text-embedding-3-small",
		},
	)

	_, err := retrieval.SearchSimilarityCandidatesForTest(
		context.Background(),
		service,
		&struct{ Code string }{Code: "KB1"},
		retrieval.SimilarityRequest{
			Query:                   "这是重写后的查询",
			EmbeddingQuery:          "这是原始问题",
			TopK:                    4,
			CandidateScoreThreshold: 0.1,
		},
	)
	if err != nil {
		t.Fatalf("SearchSimilarityCandidatesForTest returned error: %v", err)
	}
	if len(embeddingSvc.queries) == 0 {
		t.Fatal("expected enhanced retrieval to request embeddings")
	}
	for _, query := range embeddingSvc.queries {
		if query != "这是原始问题" {
			t.Fatalf("expected embedding query to use original question, got %#v", embeddingSvc.queries)
		}
	}
}

func TestWarmupLoadsSegmenterOnce(t *testing.T) {
	var loadCalls atomic.Int32
	service := retrieval.NewService(nil, nil, retrieval.Infra{})
	retrieval.SetSegmenterLoaderForTest(service, func(segmenter *gse.Segmenter) error {
		loadCalls.Add(1)
		return retrieval.LoadTestSegmenterDictForTest(segmenter)
	})

	for range 2 {
		if err := service.Warmup(context.Background()); err != nil {
			t.Fatalf("Warmup returned error: %v", err)
		}
	}

	if loadCalls.Load() != 1 {
		t.Fatalf("expected one loader call, got %d", loadCalls.Load())
	}
	if retrieval.SharedSegmenterForTest(service) == nil {
		t.Fatal("expected warmed segmenter to be cached")
	}
}

func TestWarmupPreventsFirstSearchFromReloadingSegmenter(t *testing.T) {
	var loadCalls atomic.Int32
	service := retrieval.NewService(
		nil,
		embeddingServiceStub{},
		retrieval.Infra{
			VectorDataRepo:        &vectorDataRepoStub{},
			DefaultEmbeddingModel: "text-embedding-3-small",
		},
	)
	retrieval.SetSegmenterLoaderForTest(service, func(segmenter *gse.Segmenter) error {
		loadCalls.Add(1)
		return retrieval.LoadTestSegmenterDictForTest(segmenter)
	})

	if err := service.Warmup(context.Background()); err != nil {
		t.Fatalf("Warmup returned error: %v", err)
	}

	if _, err := retrieval.SearchSimilarityCandidatesForTest(
		context.Background(),
		service,
		&struct{ Code string }{Code: "KB1"},
		retrieval.SimilarityRequest{
			Query:                   "退款 section:帮助中心",
			TopK:                    4,
			CandidateScoreThreshold: 0.1,
		},
	); err != nil {
		t.Fatalf("SearchSimilarityCandidatesForTest returned error: %v", err)
	}

	if loadCalls.Load() != 1 {
		t.Fatalf("expected warmup to satisfy first search without reloading segmenter, got %d loads", loadCalls.Load())
	}
}

type contextFragmentRepoStub struct {
	batchCalls           int
	listCalls            int
	pointBatchCalls      int
	pointLookupCalls     int
	batchErr             error
	pointBatchErr        error
	batchFragments       map[fragmodel.DocumentKey][]*fragmodel.KnowledgeBaseFragment
	listFragments        map[fragmodel.DocumentKey][]*fragmodel.KnowledgeBaseFragment
	pointBatchFragments  map[string]*fragmodel.KnowledgeBaseFragment
	pointLookupFragments map[string]*fragmodel.KnowledgeBaseFragment
}

type countingCollectionMetaReader struct {
	meta  sharedroute.CollectionMeta
	err   error
	calls atomic.Int32
}

func managedBM25MetaReader() *countingCollectionMetaReader {
	return &countingCollectionMetaReader{
		meta: sharedroute.CollectionMeta{
			Exists:                 true,
			CollectionName:         "magic_knowledge_active",
			PhysicalCollectionName: "magic_knowledge_active",
			Model:                  "text-embedding-3-small",
			SparseBackend:          fragmodel.SparseBackendQdrantBM25ZHV1,
		},
	}
}

func (s *countingCollectionMetaReader) GetCollectionMeta(context.Context) (sharedroute.CollectionMeta, error) {
	s.calls.Add(1)
	return s.meta, s.err
}

func (*contextFragmentRepoStub) FindByID(context.Context, int64) (*fragmodel.KnowledgeBaseFragment, error) {
	return nil, errUnexpectedStubCall
}

func (s *contextFragmentRepoStub) FindByPointID(_ context.Context, _, _, pointID string) (*fragmodel.KnowledgeBaseFragment, error) {
	s.pointLookupCalls++
	if fragment, ok := s.pointLookupFragments[pointID]; ok {
		return fragment, nil
	}
	return nil, errUnexpectedStubCall
}

func (s *contextFragmentRepoStub) FindByPointIDs(_ context.Context, pointIDs []string) ([]*fragmodel.KnowledgeBaseFragment, error) {
	s.pointBatchCalls++
	if s.pointBatchErr != nil {
		return nil, s.pointBatchErr
	}
	results := make([]*fragmodel.KnowledgeBaseFragment, 0, len(pointIDs))
	for _, pointID := range pointIDs {
		if fragment, ok := s.pointBatchFragments[pointID]; ok {
			results = append(results, fragment)
		}
	}
	return results, nil
}

func (*contextFragmentRepoStub) FindByIDs(context.Context, []int64) ([]*fragmodel.KnowledgeBaseFragment, error) {
	return []*fragmodel.KnowledgeBaseFragment{}, nil
}

func (*contextFragmentRepoStub) List(context.Context, *fragmodel.Query) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	return nil, 0, nil
}

func (s *contextFragmentRepoStub) ListByDocument(
	_ context.Context,
	knowledgeCode string,
	documentCode string,
	_ int,
	_ int,
) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	s.listCalls++
	fragments := s.listFragments[fragmodel.DocumentKey{KnowledgeCode: knowledgeCode, DocumentCode: documentCode}]
	return fragments, int64(len(fragments)), nil
}

func (*contextFragmentRepoStub) ListByKnowledgeBase(context.Context, string, int, int) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	return nil, 0, nil
}

func (*contextFragmentRepoStub) ListPendingSync(context.Context, string, int) ([]*fragmodel.KnowledgeBaseFragment, error) {
	return nil, nil
}

func (*contextFragmentRepoStub) CountByKnowledgeBase(context.Context, string) (int64, error) {
	return 0, nil
}

func (*contextFragmentRepoStub) CountSyncedByKnowledgeBase(context.Context, string) (int64, error) {
	return 0, nil
}

func (*contextFragmentRepoStub) ListMissingDocumentCode(context.Context, fragmodel.MissingDocumentCodeQuery) ([]*fragmodel.KnowledgeBaseFragment, error) {
	return nil, nil
}

func (s *contextFragmentRepoStub) ListContextByDocuments(
	_ context.Context,
	documentKeys []fragmodel.DocumentKey,
	_ int,
) (map[fragmodel.DocumentKey][]*fragmodel.KnowledgeBaseFragment, error) {
	s.batchCalls++
	if s.batchErr != nil {
		return nil, s.batchErr
	}
	result := make(map[fragmodel.DocumentKey][]*fragmodel.KnowledgeBaseFragment, len(documentKeys))
	for _, documentKey := range documentKeys {
		if fragments, ok := s.batchFragments[documentKey]; ok {
			result[documentKey] = fragments
		}
	}
	return result, nil
}

type embeddingServiceStub struct{}

func (embeddingServiceStub) GetEmbedding(context.Context, string, string, *ctxmeta.BusinessParams) ([]float64, error) {
	return []float64{0.1, 0.2}, nil
}

type recordingEmbeddingServiceStub struct {
	mu      sync.Mutex
	queries []string
}

func (s *recordingEmbeddingServiceStub) GetEmbedding(
	_ context.Context,
	query string,
	_ string,
	_ *ctxmeta.BusinessParams,
) ([]float64, error) {
	s.mu.Lock()
	s.queries = append(s.queries, query)
	s.mu.Unlock()
	return []float64{0.1, 0.2}, nil
}

type vectorDataRepoStub struct {
	denseCalls  atomic.Int32
	sparseCalls atomic.Int32

	mu                sync.Mutex
	denseRequests     []fragmodel.DenseSearchRequest
	sparseRequests    []fragmodel.SparseSearchRequest
	denseResponsePlan [][]*fragmodel.VectorSearchResult[fragmodel.FragmentPayload]
	defaultSelection  shared.SparseBackendSelection
	selections        map[string]shared.SparseBackendSelection
}

func (*vectorDataRepoStub) StorePoint(context.Context, string, string, []float64, fragmodel.FragmentPayload) error {
	return nil
}

func (*vectorDataRepoStub) StoreHybridPoint(context.Context, string, string, []float64, *fragmodel.SparseInput, fragmodel.FragmentPayload) error {
	return nil
}

func (*vectorDataRepoStub) StorePoints(context.Context, string, []string, [][]float64, []fragmodel.FragmentPayload) error {
	return nil
}

func (*vectorDataRepoStub) StoreHybridPoints(context.Context, string, []string, [][]float64, []*fragmodel.SparseInput, []fragmodel.FragmentPayload) error {
	return nil
}

func (*vectorDataRepoStub) SetPayloadByPointIDs(context.Context, string, map[string]map[string]any) error {
	return nil
}

func (*vectorDataRepoStub) ListExistingPointIDs(context.Context, string, []string) (map[string]struct{}, error) {
	return map[string]struct{}{}, nil
}

func (*vectorDataRepoStub) Search(context.Context, string, []float64, int, float64) ([]*fragmodel.VectorSearchResult[fragmodel.FragmentPayload], error) {
	return []*fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{}, nil
}

func (*vectorDataRepoStub) SearchWithFilter(context.Context, string, []float64, int, float64, *fragmodel.VectorFilter) ([]*fragmodel.VectorSearchResult[fragmodel.FragmentPayload], error) {
	return []*fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{}, nil
}

func (s *vectorDataRepoStub) SearchDenseWithFilter(_ context.Context, request fragmodel.DenseSearchRequest) ([]*fragmodel.VectorSearchResult[fragmodel.FragmentPayload], error) {
	callIndex := int(s.denseCalls.Add(1))
	s.mu.Lock()
	s.denseRequests = append(s.denseRequests, cloneDenseSearchRequest(request))
	s.mu.Unlock()
	if planIndex := callIndex - 1; planIndex >= 0 && planIndex < len(s.denseResponsePlan) {
		return append([]*fragmodel.VectorSearchResult[fragmodel.FragmentPayload](nil), s.denseResponsePlan[planIndex]...), nil
	}
	return []*fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{}, nil
}

func (s *vectorDataRepoStub) SearchSparseWithFilter(_ context.Context, request fragmodel.SparseSearchRequest) ([]*fragmodel.VectorSearchResult[fragmodel.FragmentPayload], error) {
	s.sparseCalls.Add(1)
	s.mu.Lock()
	s.sparseRequests = append(s.sparseRequests, cloneSparseSearchRequest(request))
	s.mu.Unlock()
	return []*fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{}, nil
}

func (s *vectorDataRepoStub) DefaultSparseBackend() shared.SparseBackendSelection {
	if s.defaultSelection.Effective != "" {
		return s.defaultSelection
	}
	return shared.ResolveSparseBackendSelection(nil, "")
}

func (s *vectorDataRepoStub) SelectSparseBackend(requested string) shared.SparseBackendSelection {
	if selection, ok := s.selections[requested]; ok {
		return selection
	}
	return shared.ResolveSparseBackendSelection(nil, requested)
}

func (s *vectorDataRepoStub) sparseSearchRequests() []fragmodel.SparseSearchRequest {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]fragmodel.SparseSearchRequest(nil), s.sparseRequests...)
}

func (s *vectorDataRepoStub) denseSearchRequests() []fragmodel.DenseSearchRequest {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]fragmodel.DenseSearchRequest(nil), s.denseRequests...)
}

func cloneSparseSearchRequest(request fragmodel.SparseSearchRequest) fragmodel.SparseSearchRequest {
	request.Filter = cloneVectorFilterForTest(request.Filter)
	if request.Document != nil {
		options := make(map[string]any, len(request.Document.Options))
		maps.Copy(options, request.Document.Options)
		request.Document = &fragmodel.SparseDocument{
			Text:    request.Document.Text,
			Model:   request.Document.Model,
			Options: options,
		}
	}
	if request.Vector != nil {
		request.Vector = &fragmodel.SparseVector{
			Indices: append([]uint32(nil), request.Vector.Indices...),
			Values:  append([]float32(nil), request.Vector.Values...),
		}
	}
	return request
}

func cloneDenseSearchRequest(request fragmodel.DenseSearchRequest) fragmodel.DenseSearchRequest {
	request.Filter = cloneVectorFilterForTest(request.Filter)
	request.Vector = append([]float64(nil), request.Vector...)
	return request
}

func cloneVectorFilterForTest(filter *fragmodel.VectorFilter) *fragmodel.VectorFilter {
	if filter == nil {
		return nil
	}
	return &fragmodel.VectorFilter{
		Must:    append([]fragmodel.FieldFilter(nil), filter.Must...),
		Should:  append([]fragmodel.FieldFilter(nil), filter.Should...),
		MustNot: append([]fragmodel.FieldFilter(nil), filter.MustNot...),
	}
}

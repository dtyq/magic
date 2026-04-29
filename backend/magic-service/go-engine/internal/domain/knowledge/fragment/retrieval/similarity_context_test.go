package retrieval_test

import (
	"context"
	"maps"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/go-ego/gse"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	retrieval "magic/internal/domain/knowledge/fragment/retrieval"
	shared "magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/knowledgeroute"
)

const sparseOnlyCandidateID = "sparse-only"

func TestSimilarityKeepsNonTabularHitContentUntouched(t *testing.T) {
	t.Parallel()

	result := runSimilarityForTest(t, &shared.VectorSearchResult[fragmodel.FragmentPayload]{
		ID:      "POINT-1",
		Score:   0.92,
		Content: "命中正文",
		Metadata: map[string]any{
			"chunk_type": "text",
		},
		Payload: fragmodel.FragmentPayload{
			FragmentID:    11,
			KnowledgeCode: "KB1",
			DocumentCode:  "DOC1",
			DocumentName:  "会议纪要",
			DocumentType:  1,
			ChunkIndex:    3,
			SectionPath:   "会议纪要 > 讨论要点",
			SectionTitle:  "1.14 原文显示问题",
		},
	})

	if result.Content != "命中正文" {
		t.Fatalf("expected non-tabular hit content to remain untouched, got %q", result.Content)
	}
	assertSimilarityResultHasNoContextMetadata(t, result.Metadata)
}

func TestSimilarityKeepsTabularSubchunkContentUntouched(t *testing.T) {
	t.Parallel()

	content := "文件名: 销售表.xlsx\n工作表: Sheet1\n表格: 销售表\n行号: 2\n- 客户: 示例客户A"
	result := runSimilarityForTest(t, &shared.VectorSearchResult[fragmodel.FragmentPayload]{
		ID:      "POINT-2",
		Score:   0.88,
		Content: content,
		Metadata: map[string]any{
			"chunk_type":         "table_row",
			"row_subchunk_index": 1,
			"table_id":           "table-1",
			"row_index":          2,
		},
		Payload: fragmodel.FragmentPayload{
			FragmentID:    12,
			KnowledgeCode: "KB1",
			DocumentCode:  "DOC2",
			DocumentName:  "销售表.xlsx",
			DocumentType:  2,
			ChunkIndex:    7,
			SectionPath:   "Sheet1 > 销售表",
			SectionTitle:  "销售表",
		},
	})

	if result.Content != content {
		t.Fatalf("expected tabular hit to keep matched subchunk content, got %q", result.Content)
	}
	assertSimilarityResultHasNoContextMetadata(t, result.Metadata)
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

func TestSearchSimilarityCandidatesKeepsDenseQueryOriginalWhileEnrichingSparseDocument(t *testing.T) {
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

	query := "小哥对录音纪要提出了哪些问题和建议"
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

	if len(embeddingSvc.queries) != 1 || embeddingSvc.queries[0] != query {
		t.Fatalf("expected dense embedding to keep original query, got %#v", embeddingSvc.queries)
	}
	requests := vectorRepo.sparseSearchRequests()
	if len(requests) != 1 || requests[0].Document == nil {
		t.Fatalf("expected one managed sparse search request, got %#v", requests)
	}
	if got := requests[0].Document.Text; got == query ||
		!strings.Contains(got, "小哥") ||
		!strings.Contains(got, "录音") ||
		!strings.Contains(got, "建议") {
		t.Fatalf("expected sparse document to use tokenized query text, got %q", got)
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
		denseResponsePlan: [][]*shared.VectorSearchResult[fragmodel.FragmentPayload]{
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

func TestSearchSimilarityCandidatesUsesSplitDenseAndSparseThresholds(t *testing.T) {
	t.Parallel()

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
			Query:                   "退款 API 错误码 E1001",
			TopK:                    3,
			CandidateScoreThreshold: 0.1,
		},
	)
	if err != nil {
		t.Fatalf("SearchSimilarityCandidatesForTest returned error: %v", err)
	}

	denseRequests := vectorRepo.denseSearchRequests()
	if len(denseRequests) != 1 || denseRequests[0].ScoreThreshold != 0.1 {
		t.Fatalf("expected dense threshold 0.1, got %#v", denseRequests)
	}

	sparseRequests := vectorRepo.sparseSearchRequests()
	if len(sparseRequests) != 1 || sparseRequests[0].ScoreThreshold != 0 {
		t.Fatalf("expected sparse threshold 0, got %#v", sparseRequests)
	}
}

func TestSearchSimilarityCandidatesKeepsSparseOnlyCandidatesAfterUnion(t *testing.T) {
	t.Parallel()

	vectorRepo := &vectorDataRepoStub{
		denseResponsePlan: [][]*shared.VectorSearchResult[fragmodel.FragmentPayload]{
			{
				{
					ID:      "shared",
					Score:   0.88,
					Content: "退款流程",
					Payload: fragmodel.FragmentPayload{DocumentCode: "doc-shared"},
				},
			},
		},
		sparseResponsePlan: [][]*shared.VectorSearchResult[fragmodel.FragmentPayload]{
			{
				{
					ID:      "shared",
					Score:   4.2,
					Content: "退款流程",
					Payload: fragmodel.FragmentPayload{DocumentCode: "doc-shared"},
				},
				{
					ID:      sparseOnlyCandidateID,
					Score:   7.8,
					Content: "E1001 错误码说明",
					Payload: fragmodel.FragmentPayload{DocumentCode: "doc-sparse"},
				},
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

	results, err := retrieval.SearchSimilarityCandidatesForTest(
		context.Background(),
		service,
		&struct{ Code string }{Code: "KB1"},
		retrieval.SimilarityRequest{
			Query:                   "退款流程 E1001",
			TopK:                    3,
			CandidateScoreThreshold: 0.1,
		},
	)
	if err != nil {
		t.Fatalf("SearchSimilarityCandidatesForTest returned error: %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("expected shared and sparse-only candidates in union, got %#v", results)
	}
	foundSparseOnly := false
	for _, result := range results {
		if result.ID == sparseOnlyCandidateID {
			foundSparseOnly = true
			break
		}
	}
	if !foundSparseOnly {
		t.Fatalf("expected sparse-only candidate to survive union, got %#v", results)
	}
}

func TestSimilarityDebugMetadataIncludesBM25QueryAndTokenPolicyDebug(t *testing.T) {
	t.Parallel()

	vectorRepo := &vectorDataRepoStub{
		denseResponsePlan: [][]*shared.VectorSearchResult[fragmodel.FragmentPayload]{
			{{
				ID:      "POINT-1",
				Score:   0.93,
				Content: "录音问题优化建议",
				Payload: fragmodel.FragmentPayload{
					DocumentCode: "DOC-1",
				},
			}},
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

	results, err := service.Similarity(
		context.Background(),
		&sharedsnapshot.KnowledgeBaseRuntimeSnapshot{Code: "KB1"},
		retrieval.SimilarityRequest{
			Query:                   "小哥对录音纪要提出了哪些问题和建议",
			TopK:                    1,
			CandidateScoreThreshold: 0.1,
			Options:                 &retrieval.SimilaritySearchOptions{Debug: true},
		},
	)
	if err != nil {
		t.Fatalf("Similarity returned error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected one similarity result, got %#v", results)
	}
	ranking, ok := results[0].Metadata["retrieval_ranking"].(retrieval.Ranking)
	if !ok {
		t.Fatalf("expected retrieval_ranking in metadata, got %#v", results[0].Metadata)
	}
	if ranking.BM25Query.RawQuery == "" || ranking.BM25Query.Backend == "" {
		t.Fatalf("expected retrieval_ranking.bm25_query in metadata, got %#v", results[0].Metadata)
	}
	if _, ok := results[0].Metadata["sparse_query_debug"]; ok {
		t.Fatalf("expected sparse_query_debug to be removed, got %#v", results[0].Metadata)
	}
	if _, ok := results[0].Metadata["token_policy_debug"]; !ok {
		t.Fatalf("expected token_policy_debug in metadata, got %#v", results[0].Metadata)
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
	if len(denseRequests) != 1 {
		t.Fatalf("expected dense search to keep a single pass when no soft-filter fallback applies, got %#v", denseRequests)
	}
	if denseRequests[0].ScoreThreshold != 0.1 {
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

func TestSearchSimilarityCandidatesDerivesSoftFilterFromQueryProfile(t *testing.T) {
	t.Parallel()

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
			Query:                   "这是重写后的查询",
			EmbeddingQuery:          "退款 section:帮助中心",
			TopK:                    4,
			CandidateScoreThreshold: 0.1,
		},
	)
	if err != nil {
		t.Fatalf("SearchSimilarityCandidatesForTest returned error: %v", err)
	}

	denseRequests := vectorRepo.denseSearchRequests()
	if len(denseRequests) == 0 || denseRequests[0].Filter == nil {
		t.Fatalf("expected dense search requests, got %#v", denseRequests)
	}

	foundSectionTitleFilter := false
	for _, filter := range denseRequests[0].Filter.Must {
		if filter.Key == "section_title" && len(filter.Match.InStrings) == 1 && filter.Match.InStrings[0] == "帮助中心" {
			foundSectionTitleFilter = true
			break
		}
	}
	if !foundSectionTitleFilter {
		t.Fatalf("expected soft filter to be derived from query profile raw query, got %#v", denseRequests[0].Filter)
	}
}

func TestSimilarityUsesQueryProfileForRerankAndThreshold(t *testing.T) {
	t.Parallel()

	vectorRepo := &vectorDataRepoStub{
		denseResponsePlan: [][]*shared.VectorSearchResult[fragmodel.FragmentPayload]{{
			{
				ID:      "profile-score",
				Score:   0.82,
				Content: "这里回答这是原始问题的处理方式",
				Payload: fragmodel.FragmentPayload{
					FragmentID:    1,
					DocumentCode:  "doc-profile",
					DocumentName:  "问题处理手册",
					SectionTitle:  "这是原始问题的处理方式",
					SectionPath:   "帮助中心 > 原始问题",
					KnowledgeCode: "KB1",
					Metadata:      map[string]any{},
				},
				Metadata: map[string]any{},
			},
		}},
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

	results, err := service.Similarity(
		context.Background(),
		&sharedsnapshot.KnowledgeBaseRuntimeSnapshot{Code: "KB1"},
		retrieval.SimilarityRequest{
			Query:                   "这是重写后的查询",
			EmbeddingQuery:          "这是原始问题",
			TopK:                    1,
			CandidateScoreThreshold: 0.1,
			Options:                 &retrieval.SimilaritySearchOptions{Debug: true},
		},
	)
	if err != nil {
		t.Fatalf("Similarity returned error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected one similarity result, got %#v", results)
	}

	queryRewrite, ok := results[0].Metadata["query_rewrite"].(map[string]any)
	if !ok {
		t.Fatalf("expected query_rewrite metadata, got %#v", results[0].Metadata)
	}
	if got := queryRewrite["original_query"]; got != "这是原始问题" {
		t.Fatalf("expected original_query to come from query profile, got %#v", queryRewrite)
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

	mu                 sync.Mutex
	denseRequests      []shared.DenseSearchRequest
	sparseRequests     []shared.SparseSearchRequest
	denseResponsePlan  [][]*shared.VectorSearchResult[fragmodel.FragmentPayload]
	sparseResponsePlan [][]*shared.VectorSearchResult[fragmodel.FragmentPayload]
	defaultSelection   shared.SparseBackendSelection
	selections         map[string]shared.SparseBackendSelection
}

func (*vectorDataRepoStub) StorePoint(context.Context, string, string, []float64, fragmodel.FragmentPayload) error {
	return nil
}

func (*vectorDataRepoStub) StoreHybridPoint(context.Context, string, string, []float64, *shared.SparseInput, fragmodel.FragmentPayload) error {
	return nil
}

func (*vectorDataRepoStub) StorePoints(context.Context, string, []string, [][]float64, []fragmodel.FragmentPayload) error {
	return nil
}

func (*vectorDataRepoStub) StoreHybridPoints(context.Context, string, []string, [][]float64, []*shared.SparseInput, []fragmodel.FragmentPayload) error {
	return nil
}

func (*vectorDataRepoStub) SetPayloadByPointIDs(context.Context, string, map[string]map[string]any) error {
	return nil
}

func (*vectorDataRepoStub) ListExistingPointIDs(context.Context, string, []string) (map[string]struct{}, error) {
	return map[string]struct{}{}, nil
}

func (*vectorDataRepoStub) Search(context.Context, string, []float64, int, float64) ([]*shared.VectorSearchResult[fragmodel.FragmentPayload], error) {
	return []*shared.VectorSearchResult[fragmodel.FragmentPayload]{}, nil
}

func (*vectorDataRepoStub) SearchWithFilter(context.Context, string, []float64, int, float64, *shared.VectorFilter) ([]*shared.VectorSearchResult[fragmodel.FragmentPayload], error) {
	return []*shared.VectorSearchResult[fragmodel.FragmentPayload]{}, nil
}

func (s *vectorDataRepoStub) SearchDenseWithFilter(_ context.Context, request shared.DenseSearchRequest) ([]*shared.VectorSearchResult[fragmodel.FragmentPayload], error) {
	callIndex := int(s.denseCalls.Add(1))
	s.mu.Lock()
	s.denseRequests = append(s.denseRequests, cloneDenseSearchRequest(request))
	s.mu.Unlock()
	if planIndex := callIndex - 1; planIndex >= 0 && planIndex < len(s.denseResponsePlan) {
		return append([]*shared.VectorSearchResult[fragmodel.FragmentPayload](nil), s.denseResponsePlan[planIndex]...), nil
	}
	return []*shared.VectorSearchResult[fragmodel.FragmentPayload]{}, nil
}

func (s *vectorDataRepoStub) SearchSparseWithFilter(_ context.Context, request shared.SparseSearchRequest) ([]*shared.VectorSearchResult[fragmodel.FragmentPayload], error) {
	callIndex := int(s.sparseCalls.Add(1))
	s.mu.Lock()
	s.sparseRequests = append(s.sparseRequests, cloneSparseSearchRequest(request))
	s.mu.Unlock()
	if planIndex := callIndex - 1; planIndex >= 0 && planIndex < len(s.sparseResponsePlan) {
		return append([]*shared.VectorSearchResult[fragmodel.FragmentPayload](nil), s.sparseResponsePlan[planIndex]...), nil
	}
	return []*shared.VectorSearchResult[fragmodel.FragmentPayload]{}, nil
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

func (s *vectorDataRepoStub) sparseSearchRequests() []shared.SparseSearchRequest {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]shared.SparseSearchRequest(nil), s.sparseRequests...)
}

func (s *vectorDataRepoStub) denseSearchRequests() []shared.DenseSearchRequest {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]shared.DenseSearchRequest(nil), s.denseRequests...)
}

func cloneSparseSearchRequest(request shared.SparseSearchRequest) shared.SparseSearchRequest {
	request.Filter = cloneVectorFilterForTest(request.Filter)
	if request.Document != nil {
		options := make(map[string]any, len(request.Document.Options))
		maps.Copy(options, request.Document.Options)
		request.Document = &shared.SparseDocument{
			Text:    request.Document.Text,
			Model:   request.Document.Model,
			Options: options,
		}
	}
	if request.Vector != nil {
		request.Vector = &shared.SparseVector{
			Indices: append([]uint32(nil), request.Vector.Indices...),
			Values:  append([]float32(nil), request.Vector.Values...),
		}
	}
	return request
}

func cloneDenseSearchRequest(request shared.DenseSearchRequest) shared.DenseSearchRequest {
	request.Filter = cloneVectorFilterForTest(request.Filter)
	request.Vector = append([]float64(nil), request.Vector...)
	return request
}

func cloneVectorFilterForTest(filter *shared.VectorFilter) *shared.VectorFilter {
	if filter == nil {
		return nil
	}
	return &shared.VectorFilter{
		Must:    append([]shared.FieldFilter(nil), filter.Must...),
		Should:  append([]shared.FieldFilter(nil), filter.Should...),
		MustNot: append([]shared.FieldFilter(nil), filter.MustNot...),
	}
}

func runSimilarityForTest(
	t *testing.T,
	searchResult *shared.VectorSearchResult[fragmodel.FragmentPayload],
) *fragmodel.SimilarityResult {
	t.Helper()

	vectorRepo := &vectorDataRepoStub{
		denseResponsePlan: [][]*shared.VectorSearchResult[fragmodel.FragmentPayload]{{searchResult}},
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

	results, err := service.Similarity(
		context.Background(),
		&sharedsnapshot.KnowledgeBaseRuntimeSnapshot{Code: "KB1"},
		retrieval.SimilarityRequest{
			Query:                   "测试查询",
			TopK:                    1,
			CandidateScoreThreshold: 0.1,
		},
	)
	if err != nil {
		t.Fatalf("Similarity returned error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected one similarity result, got %#v", results)
	}
	return results[0]
}

func assertSimilarityResultHasNoContextMetadata(t *testing.T, metadata map[string]any) {
	t.Helper()

	for _, key := range []string{"hit_chunk", "context_section_path", "neighbor_chunks", "row_context_chunks"} {
		if _, ok := metadata[key]; ok {
			t.Fatalf("expected similarity metadata to omit %q, got %#v", key, metadata)
		}
	}
}

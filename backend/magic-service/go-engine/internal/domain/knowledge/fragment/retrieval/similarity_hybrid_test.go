package retrieval_test

import (
	"math"
	"slices"
	"strings"
	"testing"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	retrieval "magic/internal/domain/knowledge/fragment/retrieval"
	shared "magic/internal/domain/knowledge/shared"
)

const (
	queryRefundFlowConfig = "退款流程配置"
	hybridSharedResultID  = "shared"
	denseOnlyResultID     = "dense-only"
)

func TestAnalyzeForIndexUsesWholeSentenceGSE(t *testing.T) {
	t.Parallel()

	tokens := retrieval.AnalyzeForIndex("退款", "content")
	if len(tokens) != 1 {
		t.Fatalf("expected one gse token, got %#v", tokens)
	}
	if tokens[0].Term != "退款" || tokens[0].Field != "content" || tokens[0].IsFallback {
		t.Fatalf("unexpected token: %#v", tokens[0])
	}
}

func TestAnalyzeForIndexFiltersStopwordsAfterWholeSentenceGSE(t *testing.T) {
	t.Parallel()

	tokens := retrieval.AnalyzeForIndex("笔记的比例调整", "content")
	terms := collectTerms(tokens)

	for _, want := range []string{"笔记", "比例", "调整"} {
		if _, ok := terms[want]; !ok {
			t.Fatalf("expected token %q in %#v", want, tokens)
		}
	}
	for _, unwanted := range []string{"的", "记的", "的比"} {
		if _, ok := terms[unwanted]; ok {
			t.Fatalf("did not expect filtered token %q in %#v", unwanted, tokens)
		}
	}
}

func TestAnalyzeForQuerySupportsChineseAndMixedASCII(t *testing.T) {
	t.Parallel()

	tokens := retrieval.AnalyzeForQuery("API鉴权v2 camelCase snake_case 退款流程")
	terms := collectTerms(tokens)

	for _, want := range []string{"api", "鉴权", "v2", "camelcase", "snake", "case", "退款", "流程"} {
		if _, ok := terms[want]; !ok {
			t.Fatalf("expected token %q in %#v", want, tokens)
		}
	}
	for _, unwanted := range []string{"camel", "snake_case", "款流", "_"} {
		if _, ok := terms[unwanted]; ok {
			t.Fatalf("did not expect token %q in %#v", unwanted, tokens)
		}
	}
}

func TestAnalyzeForQueryPrefersGSEWordsOverNoiseBigrams(t *testing.T) {
	t.Parallel()

	tokens := retrieval.AnalyzeForQuery("小哥指出了录音纪要的哪些问题")
	terms := collectTerms(tokens)

	for _, want := range []string{"小哥", "指出", "录音", "纪要", "哪些", "问题"} {
		if _, ok := terms[want]; !ok {
			t.Fatalf("expected query term %q in %#v", want, tokens)
		}
	}
	for _, unwanted := range []string{"哥指", "出了", "了录", "音纪", "要的", "的哪", "些问"} {
		if _, ok := terms[unwanted]; ok {
			t.Fatalf("did not expect noisy query term %q in %#v", unwanted, tokens)
		}
	}
}

func TestAnalyzeForQueryKeepsMixedCodeTokenIntact(t *testing.T) {
	t.Parallel()

	tokens := retrieval.AnalyzeForQuery("提供T519004的人员负责")
	terms := collectTerms(tokens)
	for _, want := range []string{"提供", "t519004", "人员", "负责"} {
		if _, ok := terms[want]; !ok {
			t.Fatalf("expected token %q in %#v", want, tokens)
		}
	}
	for _, unwanted := range []string{"t", "519004", "的"} {
		if _, ok := terms[unwanted]; ok {
			t.Fatalf("did not expect token %q in %#v", unwanted, tokens)
		}
	}
}

func TestAnalyzeForQueryHandlesCompactMixedCodeQueries(t *testing.T) {
	t.Parallel()

	cases := map[string][]string{
		"订单E1001": {"订单", "e1001"},
		"鉴权v2失败":  {"鉴权", "v2", "失败"},
	}

	for query, wantTerms := range cases {
		tokens := retrieval.AnalyzeForQuery(query)
		terms := collectTerms(tokens)
		for _, want := range wantTerms {
			if _, ok := terms[want]; !ok {
				t.Fatalf("query=%q expected token %q in %#v", query, want, tokens)
			}
		}
	}
}

func TestScoreSimilarityResultsDebugKeepsRankingSummaryWithoutRerankDetails(t *testing.T) {
	t.Parallel()

	results := retrieval.ScoreSimilarityResultsWithDebugForTest(
		"退款 的 流程",
		[]*shared.VectorSearchResult[fragmodel.FragmentPayload]{
			{
				ID:      "doc-1",
				Score:   0.92,
				Content: "退款流程说明",
				Payload: fragmodel.FragmentPayload{
					DocumentCode: "DOC-1",
				},
			},
		},
		&struct{}{},
		1,
	)
	if len(results) != 1 {
		t.Fatalf("expected one scored result, got %#v", results)
	}
	ranking := requireRetrievalRanking(t, results[0].Metadata)
	if ranking.Debug != nil {
		t.Fatalf("expected retrieval_ranking.debug to be omitted, got %#v", ranking)
	}
	if ranking.BM25Query.RawQuery != "退款 的 流程" || ranking.BM25Query.QueryType == "" {
		t.Fatalf("expected bm25 query summary to be preserved, got %#v", ranking)
	}
}

func TestFuseHybridResultsUsesRelativeScoreByDefault(t *testing.T) {
	t.Parallel()

	dense := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{ID: denseOnlyResultID, Score: 0.8},
		{ID: "shared", Score: 0.9},
	}
	sparse := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{ID: sparseOnlyCandidateID, Score: 0.9},
		{ID: "shared", Score: 0.95},
	}

	denseHeavy := retrieval.FuseHybridResultsForTest(dense, sparse, 0.9, 0.1)
	if len(denseHeavy) != 3 {
		t.Fatalf("expected 3 fused results, got %#v", denseHeavy)
	}
	if denseHeavy[0].ID != hybridSharedResultID || denseHeavy[1].ID != denseOnlyResultID || denseHeavy[2].ID != sparseOnlyCandidateID {
		t.Fatalf("expected dense-heavy ordering to follow relative score fusion, got %#v", denseHeavy)
	}
	if got := denseHeavy[0].Metadata["fusion_algorithm"]; got != "relative_score" {
		t.Fatalf("expected relative_score metadata, got %#v", denseHeavy[0].Metadata)
	}
	if got := denseHeavy[0].Metadata["dense_score_norm"]; got != 1.0 {
		t.Fatalf("expected dense_score_norm=1, got %#v", denseHeavy[0].Metadata)
	}
	if got := denseHeavy[0].Metadata["sparse_score_norm"]; got != 1.0 {
		t.Fatalf("expected sparse_score_norm=1, got %#v", denseHeavy[0].Metadata)
	}
	if got := denseHeavy[0].Metadata["dense_contribution"]; got != 0.9 {
		t.Fatalf("expected dense_contribution=0.9, got %#v", denseHeavy[0].Metadata)
	}
	if got := denseHeavy[0].Metadata["sparse_contribution"]; got != 0.1 {
		t.Fatalf("expected sparse_contribution=0.1, got %#v", denseHeavy[0].Metadata)
	}

	sparseHeavy := retrieval.FuseHybridResultsForTest(dense, sparse, 0.1, 0.9)
	if len(sparseHeavy) != 3 {
		t.Fatalf("expected 3 fused results, got %#v", sparseHeavy)
	}
	if sparseHeavy[0].ID != hybridSharedResultID || sparseHeavy[1].ID != denseOnlyResultID || sparseHeavy[2].ID != sparseOnlyCandidateID {
		t.Fatalf("expected sparse-heavy ordering to follow relative score fusion, got %#v", sparseHeavy)
	}
}

func TestFuseHybridResultsUsesFullChannelWeightWhenScoresAreFlat(t *testing.T) {
	t.Parallel()

	dense := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{ID: "shared", Score: 0.8},
		{ID: denseOnlyResultID, Score: 0.8},
	}
	sparse := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{ID: "shared", Score: 0.3},
		{ID: sparseOnlyCandidateID, Score: 0.3},
	}

	fused := retrieval.FuseHybridResultsForTest(dense, sparse, 0.55, 0.45)
	if len(fused) != 3 {
		t.Fatalf("expected 3 fused results, got %#v", fused)
	}

	sharedResult := fused[0]
	if sharedResult.ID != hybridSharedResultID {
		t.Fatalf("expected shared result first on flat scores, got %#v", fused)
	}
	if sharedResult.Metadata["dense_contribution"] != 0.55 || sharedResult.Metadata["sparse_contribution"] != 0.45 {
		t.Fatalf("expected flat scores to take full channel weight, got %#v", sharedResult.Metadata)
	}
	if sharedResult.Metadata["hybrid_score"] != 1.0 || sharedResult.Metadata["fusion_score_norm"] != 1.0 {
		t.Fatalf("expected full hybrid score on flat shared candidate, got %#v", sharedResult.Metadata)
	}
}

func TestFuseHybridResultsKeepsSparseOnlyCandidatesInUnion(t *testing.T) {
	t.Parallel()

	dense := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{ID: hybridSharedResultID, Score: 0.42},
	}
	sparse := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{ID: hybridSharedResultID, Score: 8.2},
		{ID: sparseOnlyCandidateID, Score: 9.6},
	}

	fused := retrieval.FuseHybridResultsForTest(dense, sparse, 0.55, 0.45)
	if len(fused) != 2 {
		t.Fatalf("expected sparse-only candidates to stay in union, got %#v", fused)
	}
	if fused[0].ID != sparseOnlyCandidateID && fused[1].ID != sparseOnlyCandidateID {
		t.Fatalf("expected sparse-only candidate to survive fusion, got %#v", fused)
	}
}

func TestFuseHybridResultsPromotesSparseOnlyCandidatesWithNewDefaultWeights(t *testing.T) {
	t.Parallel()

	dense := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{ID: hybridSharedResultID, Score: 1.0},
		{ID: denseOnlyResultID, Score: 0.85},
		{ID: "dense-floor", Score: 0.5},
	}
	sparse := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{ID: sparseOnlyCandidateID, Score: 0.9},
		{ID: hybridSharedResultID, Score: 0.5},
	}

	legacy := retrieval.FuseHybridResultsForTest(dense, sparse, 0.75, 0.25)
	if len(legacy) != 4 {
		t.Fatalf("expected 4 fused results with legacy weights, got %#v", legacy)
	}
	if legacy[1].ID != denseOnlyResultID || legacy[2].ID != sparseOnlyCandidateID {
		t.Fatalf("expected dense-only to stay ahead under legacy weights, got %#v", legacy)
	}

	updated := retrieval.FuseHybridResultsForTest(dense, sparse, 0.55, 0.45)
	if len(updated) != 4 {
		t.Fatalf("expected 4 fused results with updated weights, got %#v", updated)
	}
	if updated[1].ID != sparseOnlyCandidateID || updated[2].ID != denseOnlyResultID {
		t.Fatalf("expected sparse-only candidate to outrank dense-only with updated weights, got %#v", updated)
	}
}

func TestResolveHybridSearchConfigIgnoresConfiguredHybridWeights(t *testing.T) {
	t.Parallel()

	kb := &struct {
		RetrieveConfig *shared.RetrieveConfig
	}{
		RetrieveConfig: &shared.RetrieveConfig{
			HybridAlpha: 0.7,
			Weights: &shared.RetrieveWeights{
				VectorSetting:  &shared.VectorWeightSetting{VectorWeight: 0.2},
				KeywordSetting: &shared.KeywordWeightSetting{KeywordWeight: 0.8},
			},
		},
	}

	config := retrieval.ResolveHybridSearchConfigForTest(10, kb)
	if math.Abs(config.DenseWeight-0.55) > 1e-9 || math.Abs(config.SparseWeight-0.45) > 1e-9 {
		t.Fatalf("expected hard-coded hybrid weights, got dense=%v sparse=%v", config.DenseWeight, config.SparseWeight)
	}
	if math.Abs(config.HybridAlpha-0.55) > 1e-9 {
		t.Fatalf("expected effective hybrid alpha to stay at default, got %v", config.HybridAlpha)
	}
}

func TestResolveHybridSearchConfigUsesNormalizedDefaultRetrieveConfig(t *testing.T) {
	t.Parallel()

	config := retrieval.ResolveHybridSearchConfigForTest(10, &struct {
		RetrieveConfig *shared.RetrieveConfig
	}{})
	if math.Abs(config.DenseWeight-0.55) > 1e-9 || math.Abs(config.SparseWeight-0.45) > 1e-9 {
		t.Fatalf("expected default hybrid weights, got dense=%v sparse=%v", config.DenseWeight, config.SparseWeight)
	}
	if config.DenseTopK != 20 || config.SparseTopK != 30 {
		t.Fatalf("expected tighter default candidate pool, got %#v", config)
	}
}

func TestResolveHybridSearchConfigRespectsExplicitMultiplier(t *testing.T) {
	t.Parallel()

	config := retrieval.ResolveHybridSearchConfigForTest(10, &struct {
		RetrieveConfig *shared.RetrieveConfig
	}{
		RetrieveConfig: &shared.RetrieveConfig{
			HybridTopKMultiplier: 7,
		},
	})
	if config.DenseTopK != 70 || config.SparseTopK != 70 {
		t.Fatalf("expected explicit multiplier to override default pool, got %#v", config)
	}
}

func TestResolveHybridSearchConfigIgnoresLegacyOneZeroWeights(t *testing.T) {
	t.Parallel()

	config := retrieval.ResolveHybridSearchConfigForTest(10, &struct {
		RetrieveConfig *shared.RetrieveConfig
	}{
		RetrieveConfig: &shared.RetrieveConfig{
			Weights: &shared.RetrieveWeights{
				VectorSetting:  &shared.VectorWeightSetting{VectorWeight: 1},
				KeywordSetting: &shared.KeywordWeightSetting{KeywordWeight: 0},
			},
		},
	})
	if math.Abs(config.DenseWeight-0.55) > 1e-9 || math.Abs(config.SparseWeight-0.45) > 1e-9 {
		t.Fatalf("expected hard-coded hybrid weights, got dense=%v sparse=%v", config.DenseWeight, config.SparseWeight)
	}
	if config.LegacyWeightUpgraded {
		t.Fatalf("expected legacy weight upgrade flag to stay false, got %#v", config)
	}
}

func TestScoreSimilarityResultsUsesStableHybridOrderingWhenScoresTie(t *testing.T) {
	results := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{
			ID:      "title-hit",
			Score:   0.8,
			Content: "无关内容",
			Payload: fragmodel.FragmentPayload{
				DocumentCode:  "doc1",
				DocumentName:  "文档一",
				SectionTitle:  "退款说明",
				SectionPath:   "帮助中心 > 退款",
				Metadata:      map[string]any{},
				KnowledgeCode: "kb",
			},
			Metadata: map[string]any{"sparse_score": 0.6},
		},
		{
			ID:      "content-hit",
			Score:   0.8,
			Content: "这里介绍退款步骤",
			Payload: fragmodel.FragmentPayload{
				DocumentCode:  "doc2",
				DocumentName:  "文档二",
				SectionTitle:  "操作说明",
				SectionPath:   "帮助中心",
				Metadata:      map[string]any{},
				KnowledgeCode: "kb",
			},
			Metadata: map[string]any{"sparse_score": 0.6},
		},
	}

	scored := retrieval.ScoreSimilarityResultsForTest("退款", results, &struct{}{}, 2)
	if len(scored) != 2 || scored[0].DocumentCode != "doc2" || scored[1].DocumentCode != "doc1" {
		t.Fatalf("expected hybrid ordering to fall back to stable keys on score ties, got %#v", scored)
	}
}

func TestScoreSimilarityResultsCarriesFragmentIDFromPayload(t *testing.T) {
	t.Parallel()

	results := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{
			ID:      "point-101",
			Score:   0.8,
			Content: "这里介绍退款步骤",
			Payload: fragmodel.FragmentPayload{
				FragmentID:    101,
				BusinessID:    "BIZ-101",
				DocumentCode:  "doc-1",
				DocumentName:  "文档一",
				SectionTitle:  "退款说明",
				SectionPath:   "帮助中心 > 退款",
				Metadata:      map[string]any{},
				KnowledgeCode: "kb",
			},
			Metadata: map[string]any{"sparse_score": 0.6},
		},
	}

	scored := retrieval.ScoreSimilarityResultsForTest("退款", results, &struct{}{}, 1)
	if len(scored) != 1 {
		t.Fatalf("expected one scored result, got %#v", scored)
	}
	if scored[0].FragmentID != 101 || scored[0].BusinessID != "BIZ-101" {
		t.Fatalf("expected payload fields preserved, got %#v", scored[0])
	}
	if scored[0].Metadata["fragment_id"] != int64(101) {
		t.Fatalf("expected metadata fragment_id, got %#v", scored[0].Metadata["fragment_id"])
	}
}

func TestScoreSimilarityResultsOrdersByHybridScore(t *testing.T) {
	const (
		docVectorHeavy = "doc1"
		docPhraseTitle = "doc2"
	)
	query := queryRefundFlowConfig
	results := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{
			ID:      "vector-heavy",
			Score:   0.8,
			Content: "退款 指南 流程 参数 配置",
			Payload: fragmodel.FragmentPayload{
				DocumentCode:  docVectorHeavy,
				DocumentName:  "文档一",
				SectionTitle:  "其他说明",
				SectionPath:   "帮助中心",
				Metadata:      map[string]any{},
				KnowledgeCode: "kb",
			},
			Metadata: map[string]any{"sparse_score": 0.9},
		},
		{
			ID:      "phrase-title",
			Score:   0.8,
			Content: "与问题关系不大",
			Payload: fragmodel.FragmentPayload{
				DocumentCode:  docPhraseTitle,
				DocumentName:  "文档二",
				SectionTitle:  "退款流程配置",
				SectionPath:   "帮助中心 > 退款",
				Metadata:      map[string]any{},
				KnowledgeCode: "kb",
			},
			Metadata: map[string]any{"sparse_score": 0.1},
		},
	}

	scored := retrieval.ScoreSimilarityResultsWithDebugForTest(query, results, &struct{}{}, 1)
	if len(scored) != 1 {
		t.Fatalf("unexpected score result lengths: %d", len(scored))
	}
	if scored[0].DocumentCode != docVectorHeavy {
		t.Fatalf("expected higher hybrid score doc first, got %#v", scored)
	}
}

func TestScoreSimilarityResultsReturnsFinalScoreAfterRerankSelection(t *testing.T) {
	query := queryRefundFlowConfig
	results := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{
			ID:      "vector-heavy",
			Score:   0.2,
			Content: "退款 指南 流程 参数 配置",
			Payload: fragmodel.FragmentPayload{
				DocumentCode:  "doc1",
				DocumentName:  "文档一",
				SectionTitle:  "其他说明",
				SectionPath:   "帮助中心",
				Metadata:      map[string]any{},
				KnowledgeCode: "kb",
			},
			Metadata: map[string]any{
				"dense_rank":   2,
				"dense_score":  0.92,
				"sparse_rank":  1,
				"sparse_score": 2.5,
			},
		},
		{
			ID:      "phrase-title",
			Score:   0.9,
			Content: "与问题关系不大",
			Payload: fragmodel.FragmentPayload{
				DocumentCode:  "doc2",
				DocumentName:  "文档二",
				SectionTitle:  "退款流程配置",
				SectionPath:   "帮助中心 > 退款",
				Metadata:      map[string]any{},
				KnowledgeCode: "kb",
			},
			Metadata: map[string]any{
				"dense_rank":   1,
				"dense_score":  0.83,
				"sparse_rank":  2,
				"sparse_score": 1.2,
			},
		},
	}

	scored := retrieval.ScoreSimilarityResultsWithDebugForTest(query, results, &struct {
		RetrieveConfig *shared.RetrieveConfig
	}{
		RetrieveConfig: &shared.RetrieveConfig{RerankEnabled: true},
	}, 2)

	if len(scored) != 2 {
		t.Fatalf("unexpected scored results: %#v", scored)
	}
	if scored[0].DocumentCode != "doc2" {
		t.Fatalf("expected final score ordering to keep phrase-title doc first, got %#v", scored)
	}
	for _, item := range scored {
		ranking := requireRetrievalRanking(t, item.Metadata)
		if math.Abs(item.Score-ranking.FusionScore) > 1e-9 {
			t.Fatalf("expected response score to equal hybrid fusion score, got score=%v ranking=%#v", item.Score, ranking)
		}
	}
}

func TestScoreSimilarityResultsMapsSparseOnlyResultToRankingScore(t *testing.T) {
	results := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{
			ID:      "sparse-only",
			Score:   0.95,
			Content: "录音质量问题",
			Payload: fragmodel.FragmentPayload{
				DocumentCode:  "doc2",
				DocumentName:  "文档二",
				SectionTitle:  "录音质量问题",
				SectionPath:   "帮助中心 > 录音",
				Metadata:      map[string]any{},
				KnowledgeCode: "kb",
			},
			Metadata: map[string]any{
				"sparse_rank":  1,
				"sparse_score": 8.6,
			},
		},
	}

	scored := retrieval.ScoreSimilarityResultsWithDebugForTest("录音质量问题", results, &struct{}{}, 1)
	if len(scored) != 1 {
		t.Fatalf("unexpected scored results: %#v", scored)
	}

	ranking := requireRetrievalRanking(t, scored[0].Metadata)
	if math.Abs(scored[0].Score-ranking.FusionScore) > 1e-9 {
		t.Fatalf("expected sparse-only result score to equal hybrid score, got score=%v ranking=%#v", scored[0].Score, ranking)
	}
	if ranking.Sparse == nil || ranking.Sparse.Score != 8.6 {
		t.Fatalf("expected sparse score to be preserved in retrieval ranking, got %#v", ranking)
	}
	if scored[0].Score <= 0 || scored[0].Score > 1 {
		t.Fatalf("expected final score to stay within 0~1, got %#v", scored)
	}
}

func TestScoreSimilarityResultsUsesShortKeywordFormula(t *testing.T) {
	t.Parallel()

	assertQueryTypeScoreFormula(
		t,
		queryTypeFormulaFixture{
			query:         "E1001",
			wantQueryType: "short_keyword",
			hybridScore:   0.9,
			content:       "E1001 错误码说明",
			documentCode:  "doc-short",
			documentName:  "错误码手册",
			sectionPath:   "错误码",
			metadata: map[string]any{
				"hybrid_score": 0.9,
				"dense_score":  0.2,
				"sparse_score": 4.6,
			},
		},
	)
}

func TestScoreSimilarityResultsUsesMixedCodeNLFormula(t *testing.T) {
	t.Parallel()

	assertQueryTypeScoreFormula(
		t,
		queryTypeFormulaFixture{
			query:         "如何处理 E1001 鉴权错误",
			wantQueryType: "mixed_code_nl",
			hybridScore:   0.82,
			content:       "遇到 E1001 时先检查 APIResponse_v2 鉴权",
			documentCode:  "doc-mixed",
			documentName:  "接口错误码手册",
			sectionPath:   "接口 > 鉴权",
			metadata: map[string]any{
				"hybrid_score": 0.82,
				"dense_score":  0.18,
				"sparse_score": 3.7,
			},
		},
	)
}

func TestScoreSimilarityResultsClassifiesCompactMixedCodeNLQuery(t *testing.T) {
	t.Parallel()

	for _, query := range []string{"订单E1001", "鉴权v2失败"} {
		assertQueryTypeScoreFormula(
			t,
			queryTypeFormulaFixture{
				query:         query,
				wantQueryType: "mixed_code_nl",
				hybridScore:   0.82,
				content:       "紧凑 mixed query 的命中文档",
				documentCode:  "doc-compact-mixed",
				documentName:  "接口错误码手册",
				sectionPath:   "接口 > 鉴权",
				metadata: map[string]any{
					"hybrid_score": 0.82,
					"dense_score":  0.18,
					"sparse_score": 3.7,
				},
			},
		)
	}
}

func TestScoreSimilarityResultsFiltersWeakSingleCandidateSupport(t *testing.T) {
	results := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{
			ID:      "weak-single",
			Score:   1,
			Content: "你好世界呀哈哈哈哈。",
			Payload: fragmodel.FragmentPayload{
				DocumentCode:  "doc-weak",
				DocumentName:  "你好==",
				SectionTitle:  "",
				SectionPath:   "",
				Metadata:      map[string]any{},
				KnowledgeCode: "kb",
			},
			Metadata: map[string]any{
				"fusion_algorithm": "relative_score",
				"hybrid_score":     1.0,
				"dense_score":      0.13563376665115356,
				"rrf_score":        0.0,
			},
		},
	}

	scored := retrieval.ScoreSimilarityResultsWithThresholdAndDebugForTest("录音纪要有哪些问题呢", results, &struct{}{}, 1, 1.1)
	if len(scored) != 0 {
		t.Fatalf("expected result below hybrid score threshold to be filtered, got %#v", scored)
	}
}

func TestScoreSimilarityResultsKeepsDenseSupportedSingleCandidate(t *testing.T) {
	results := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{
			ID:      "dense-supported",
			Score:   1,
			Content: "录音文本时间区间查询方案说明",
			Payload: fragmodel.FragmentPayload{
				DocumentCode:  "doc-supported",
				DocumentName:  "录音方案",
				SectionTitle:  "核心需求",
				SectionPath:   "录音文本时间区间提取方案 > 需求分析",
				Metadata:      map[string]any{},
				KnowledgeCode: "kb",
			},
			Metadata: map[string]any{
				"fusion_algorithm": "relative_score",
				"hybrid_score":     1.0,
				"dense_score":      0.3,
			},
		},
	}

	scored := retrieval.ScoreSimilarityResultsWithThresholdAndDebugForTest("录音文本时间区间", results, &struct{}{}, 1, 0.25)
	if len(scored) != 1 {
		t.Fatalf("expected result to be kept when hybrid score passes threshold, got %#v", scored)
	}
}

func TestScoreSimilarityResultsDoesNotApplyShortQuerySupportGate(t *testing.T) {
	results := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{
			ID:      "short-query-weak",
			Score:   1,
			Content: "录音文本时间区间查询方案说明",
			Payload: fragmodel.FragmentPayload{
				DocumentCode:  "doc-short-weak",
				DocumentName:  "录音方案",
				SectionTitle:  "核心需求",
				SectionPath:   "录音文本时间区间提取方案 > 需求分析",
				Metadata:      map[string]any{},
				KnowledgeCode: "kb",
			},
			Metadata: map[string]any{
				"fusion_algorithm": "relative_score",
				"hybrid_score":     1.0,
				"dense_score":      0.24,
			},
		},
	}

	scored := retrieval.ScoreSimilarityResultsWithThresholdAndDebugForTest("你好", results, &struct{}{}, 1, 0.25)
	if len(scored) != 1 {
		t.Fatalf("expected short query to be filtered only by hybrid score threshold, got %#v", scored)
	}
}

func TestScoreSimilarityResultsThresholdDoesNotFallbackWhenResultsInsufficient(t *testing.T) {
	t.Parallel()

	filtered, appliedThreshold, fallbackApplied := retrieval.ApplyResultScoreThresholdWithFallbackForTest(
		[]float64{0.58, 0.21, 0.09},
		2,
		0.5,
	)

	if fallbackApplied {
		t.Fatal("expected result threshold fallback to stay disabled")
	}
	if math.Abs(appliedThreshold-0.5) > 1e-9 {
		t.Fatalf("expected applied threshold to stay at 0.5, got %v", appliedThreshold)
	}
	if len(filtered) != 1 || filtered[0] != 0.58 {
		t.Fatalf("expected threshold filtering to keep only scores above 0.5, got %#v", filtered)
	}
}

func TestScoreSimilarityResultsThresholdDoesNotFallbackWhenEnoughResultsRemain(t *testing.T) {
	t.Parallel()

	filtered, appliedThreshold, fallbackApplied := retrieval.ApplyResultScoreThresholdWithFallbackForTest(
		[]float64{0.91, 0.62, 0.18},
		2,
		0.5,
	)

	if fallbackApplied {
		t.Fatal("expected no threshold fallback when enough results remain")
	}
	if math.Abs(appliedThreshold-0.5) > 1e-9 {
		t.Fatalf("expected applied threshold to stay at 0.5, got %v", appliedThreshold)
	}
	if len(filtered) != 2 || filtered[0] != 0.91 || filtered[1] != 0.62 {
		t.Fatalf("expected threshold filtering to keep only high-scored results, got %#v", filtered)
	}
}

func TestScoreSimilarityResultsThresholdOnlyUsesFinalScore(t *testing.T) {
	t.Parallel()

	filtered, _, _ := retrieval.ApplyResultScoreThresholdWithFallbackForTest(
		[]float64{0.9, 0.8, 0.2},
		3,
		0.5,
	)

	if len(filtered) != 2 || filtered[0] != 0.9 || filtered[1] != 0.8 {
		t.Fatalf("expected threshold filtering to keep all scores above threshold, got %#v", filtered)
	}
}

func TestScoreSimilarityResultsKeepsHybridRankingStableAcrossLegacyFlag(t *testing.T) {
	query := queryRefundFlowConfig
	results := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{
			ID:      "vector-heavy",
			Score:   0.9,
			Content: "退款 指南 流程 参数 配置",
			Payload: fragmodel.FragmentPayload{
				DocumentCode:  "doc1",
				DocumentName:  "文档一",
				SectionTitle:  "其他说明",
				SectionPath:   "帮助中心",
				Metadata:      map[string]any{},
				KnowledgeCode: "kb",
			},
			Metadata: map[string]any{"sparse_score": 0.9},
		},
		{
			ID:      "phrase-title",
			Score:   0.8,
			Content: "与问题关系不大",
			Payload: fragmodel.FragmentPayload{
				DocumentCode:  "doc2",
				DocumentName:  "文档二",
				SectionTitle:  "退款流程配置",
				SectionPath:   "帮助中心 > 退款",
				Metadata:      map[string]any{},
				KnowledgeCode: "kb",
			},
			Metadata: map[string]any{"sparse_score": 0.1},
		},
	}

	withoutRerank := retrieval.ScoreSimilarityResultsWithDebugForTest(query, results, &struct{}{}, 2)
	withRerank := retrieval.ScoreSimilarityResultsWithDebugForTest(query, results, &struct {
		RetrieveConfig *shared.RetrieveConfig
	}{
		RetrieveConfig: &shared.RetrieveConfig{RerankEnabled: true},
	}, 2)
	if len(withoutRerank) != 2 || len(withRerank) != 2 {
		t.Fatalf("unexpected scored lengths without=%d with=%d", len(withoutRerank), len(withRerank))
	}

	withoutByDoc := map[string]retrieval.Ranking{}
	for _, item := range withoutRerank {
		withoutByDoc[item.DocumentCode] = requireRetrievalRanking(t, item.Metadata)
	}
	for _, item := range withRerank {
		ranking := requireRetrievalRanking(t, item.Metadata)
		without := withoutByDoc[item.DocumentCode]
		if math.Abs(ranking.FusionScore-without.FusionScore) > 1e-9 {
			t.Fatalf("expected hybrid score to stay stable for %s: without=%#v with=%#v", item.DocumentCode, without, ranking)
		}
	}
}

func TestScoreSimilarityResultsMovesFlatRankingFieldsIntoRetrievalRanking(t *testing.T) {
	t.Parallel()

	results := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{
			ID:      "flat-ranking",
			Score:   0.88,
			Content: "退款流程配置",
			Payload: fragmodel.FragmentPayload{
				DocumentCode:  "doc-flat-ranking",
				DocumentName:  "退款文档",
				SectionTitle:  "退款流程配置",
				SectionPath:   "帮助中心 > 退款",
				Metadata:      map[string]any{},
				KnowledgeCode: "kb",
			},
			Metadata: map[string]any{
				"fusion_algorithm":           "relative_score",
				"hybrid_alpha":               0.55,
				"hybrid_score":               0.8955,
				"fusion_score_norm":          0.8955,
				"rrf_score":                  0.0,
				"dense_rank":                 2,
				"dense_score":                0.81,
				"dense_score_norm":           0.81,
				"dense_contribution":         0.44550000000000006,
				"sparse_rank":                1,
				"sparse_score":               9.6,
				"sparse_score_norm":          1.0,
				"sparse_contribution":        0.45,
				"channel_presence":           "hybrid",
				"legacy_weight_upgraded":     false,
				"retrieval_pipeline_version": "v1",
			},
		},
	}

	scored := retrieval.ScoreSimilarityResultsForTest(queryRefundFlowConfig, results, &struct{}{}, 1)
	if len(scored) != 1 {
		t.Fatalf("unexpected scored results: %#v", scored)
	}

	metadata := scored[0].Metadata
	ranking := requireRetrievalRanking(t, metadata)
	assertFlatRankingKeysRemoved(t, metadata)

	if _, exists := metadata["metadata_contract_version"]; exists {
		t.Fatalf("expected metadata.metadata_contract_version to be removed, got %#v", metadata)
	}
	assertRelativeRetrievalRankingSummary(t, ranking)
	assertBM25Query(
		t,
		ranking.BM25Query,
		queryRefundFlowConfig,
		"short_keyword",
		[]string{"退款", "流程", "配置"},
	)
}

func TestScoreSimilarityResultsBM25QueryStripsNoiseBigramsFromObservation(t *testing.T) {
	t.Parallel()

	results := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{
			ID:      "bm25-query-observation",
			Score:   0.9,
			Content: "小哥指出录音纪要的问题",
			Payload: fragmodel.FragmentPayload{
				DocumentCode:  "doc-bm25-query-observation",
				DocumentName:  "录音功能优化讨论",
				SectionTitle:  "问题总结",
				SectionPath:   "会议纪要 > 讨论要点",
				Metadata:      map[string]any{},
				KnowledgeCode: "kb",
			},
			Metadata: map[string]any{
				"fusion_algorithm":           "relative_score",
				"hybrid_alpha":               0.55,
				"hybrid_score":               1.0,
				"fusion_score_norm":          1.0,
				"rrf_score":                  0.0,
				"dense_rank":                 1,
				"dense_score":                1.0,
				"dense_score_norm":           1.0,
				"dense_contribution":         0.55,
				"sparse_rank":                1,
				"sparse_score":               8.2,
				"sparse_score_norm":          1.0,
				"sparse_contribution":        0.45,
				"channel_presence":           "hybrid",
				"legacy_weight_upgraded":     false,
				"retrieval_pipeline_version": "v1",
			},
		},
	}

	scored := retrieval.ScoreSimilarityResultsForTest("小哥指出了录音纪要的哪些问题", results, &struct{}{}, 1)
	if len(scored) != 1 {
		t.Fatalf("unexpected scored results: %#v", scored)
	}

	ranking := requireRetrievalRanking(t, scored[0].Metadata)
	wantTerms := []string{"小哥", "指出", "录音", "纪要", "哪些", "问题"}
	if !slices.Equal(ranking.BM25Query.CleanedTerms, wantTerms) {
		t.Fatalf("unexpected bm25_query.cleaned_terms: %#v", ranking.BM25Query)
	}
	if !slices.Equal(ranking.BM25Query.Terms, wantTerms) {
		t.Fatalf("unexpected bm25_query.terms: %#v", ranking.BM25Query)
	}
}

func TestScoreSimilarityResultsMovesDebugScoringIntoRetrievalRankingDebug(t *testing.T) {
	t.Parallel()

	results := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{
			ID:      "debug-ranking",
			Score:   0.9,
			Content: "退款流程配置",
			Payload: fragmodel.FragmentPayload{
				DocumentCode:  "doc-debug-ranking",
				DocumentName:  "退款文档",
				SectionTitle:  "退款流程配置",
				SectionPath:   "帮助中心 > 退款",
				Metadata:      map[string]any{},
				KnowledgeCode: "kb",
			},
			Metadata: map[string]any{
				"fusion_algorithm":           "relative_score",
				"hybrid_alpha":               0.55,
				"hybrid_score":               0.83,
				"fusion_score_norm":          0.83,
				"rrf_score":                  0.0,
				"dense_rank":                 1,
				"dense_score":                0.83,
				"dense_score_norm":           0.83,
				"dense_contribution":         0.4565,
				"sparse_rank":                2,
				"sparse_score":               1.2,
				"sparse_score_norm":          0.83,
				"sparse_contribution":        0.3735,
				"channel_presence":           "hybrid",
				"legacy_weight_upgraded":     false,
				"retrieval_pipeline_version": "v1",
			},
		},
	}

	scored := retrieval.ScoreSimilarityResultsWithDebugForTest(queryRefundFlowConfig, results, &struct{}{}, 1)
	if len(scored) != 1 {
		t.Fatalf("unexpected scored results: %#v", scored)
	}

	metadata := scored[0].Metadata
	ranking := requireRetrievalRanking(t, metadata)
	assertFlatRankingKeysRemoved(t, metadata)
	if ranking.Debug != nil {
		t.Fatalf("expected retrieval_ranking.debug to be omitted, got %#v", ranking)
	}
	if ranking.BM25Query.Backend != retrieval.SparseBackendQdrantBM25ZHV1 || ranking.BM25Query.RawQuery != queryRefundFlowConfig {
		t.Fatalf("expected bm25_query to coexist with debug info, got %#v", ranking)
	}
	if _, exists := metadata["sparse_query_debug"]; exists {
		t.Fatalf("expected sparse_query_debug to be removed, got metadata=%#v", metadata)
	}
	if ranking.FusionScore != 0.83 || ranking.FusionScoreNorm != 0.83 {
		t.Fatalf("expected relative score summary to be preserved, got %#v", ranking)
	}
}

func TestScoreSimilarityResultsKeepsChannelAbsentWhenScoreMissing(t *testing.T) {
	t.Parallel()

	results := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{
			ID:      denseOnlyResultID,
			Score:   0.8,
			Content: "退款流程配置",
			Payload: fragmodel.FragmentPayload{
				DocumentCode:  "doc-dense-only",
				DocumentName:  "退款文档",
				SectionTitle:  "退款流程配置",
				SectionPath:   "帮助中心 > 退款",
				Metadata:      map[string]any{},
				KnowledgeCode: "kb",
			},
			Metadata: map[string]any{
				"fusion_algorithm":       "relative_score",
				"hybrid_alpha":           0.55,
				"hybrid_score":           0.8,
				"fusion_score_norm":      0.8,
				"rrf_score":              0.0,
				"dense_rank":             1,
				"dense_score":            0.8,
				"channel_presence":       "dense_only",
				"legacy_weight_upgraded": false,
			},
		},
	}

	scored := retrieval.ScoreSimilarityResultsForTest(queryRefundFlowConfig, results, &struct{}{}, 1)
	if len(scored) != 1 {
		t.Fatalf("unexpected scored results: %#v", scored)
	}
	ranking := requireRetrievalRanking(t, scored[0].Metadata)
	if ranking.Dense == nil || ranking.Sparse != nil {
		t.Fatalf("expected only dense channel in retrieval ranking, got %#v", ranking)
	}
}

func requireRetrievalRanking(t *testing.T, metadata map[string]any) retrieval.Ranking {
	t.Helper()

	value, ok := metadata["retrieval_ranking"]
	if !ok {
		t.Fatalf("expected retrieval_ranking in metadata: %#v", metadata)
	}
	ranking, ok := value.(retrieval.Ranking)
	if !ok {
		t.Fatalf("unexpected retrieval_ranking type %T", value)
	}
	return ranking
}

func assertRelativeRetrievalRankingSummary(t *testing.T, ranking retrieval.Ranking) {
	t.Helper()

	if ranking.PipelineVersion != "v1" || ranking.FusionAlgorithm != "relative_score" || ranking.ChannelPresence != "hybrid" {
		t.Fatalf("unexpected retrieval_ranking summary: %#v", ranking)
	}
	if ranking.FusionScore != 0.8955 || ranking.RRFScore != 0 || ranking.FusionScoreNorm != 0.8955 {
		t.Fatalf("unexpected retrieval_ranking scores: %#v", ranking)
	}
	if ranking.Dense == nil || ranking.Dense.Rank == nil || *ranking.Dense.Rank != 2 || ranking.Dense.Score != 0.81 {
		t.Fatalf("unexpected dense channel score: %#v", ranking)
	}
	if ranking.Sparse == nil || ranking.Sparse.Rank == nil || *ranking.Sparse.Rank != 1 || ranking.Sparse.Score != 9.6 {
		t.Fatalf("unexpected sparse channel score: %#v", ranking)
	}
}

func assertBM25Query(
	t *testing.T,
	query retrieval.BM25Query,
	wantRawQuery string,
	wantQueryType string,
	wantTerms []string,
) {
	t.Helper()

	wantSparseQueryText := strings.Join(wantTerms, " ")
	if query.Backend != retrieval.SparseBackendQdrantBM25ZHV1 ||
		query.RawQuery != wantRawQuery ||
		query.QueryType != wantQueryType ||
		query.SparseQueryText != wantSparseQueryText {
		t.Fatalf("unexpected bm25_query summary: %#v", query)
	}
	if !slices.Equal(query.CleanedTerms, wantTerms) {
		t.Fatalf("unexpected bm25_query.cleaned_terms: %#v", query)
	}
	if len(query.AlphaNumTerms) != 0 || len(query.KeywordTerms) != 0 {
		t.Fatalf("expected no alpha_num_terms/keyword_terms for simple chinese query, got %#v", query)
	}
	if !slices.Equal(query.Terms, wantTerms) {
		t.Fatalf("unexpected bm25_query.terms: %#v", query)
	}
}

func assertFlatRankingKeysRemoved(t *testing.T, metadata map[string]any) {
	t.Helper()

	for _, key := range []string{
		"fusion_algorithm",
		"hybrid_alpha",
		"hybrid_score",
		"fusion_score_norm",
		"rrf_score",
		"dense_rank",
		"dense_score",
		"dense_score_norm",
		"dense_contribution",
		"sparse_rank",
		"sparse_score",
		"sparse_score_norm",
		"sparse_contribution",
		"channel_presence",
		"legacy_weight_upgraded",
		"query_type",
		"rerank_score",
		"support_score",
		"score_breakdown",
		"retrieval_pipeline_version",
		"pipeline_version",
	} {
		if _, exists := metadata[key]; exists {
			t.Fatalf("expected flat ranking key %q to be removed, got metadata=%#v", key, metadata)
		}
	}
}

type queryTypeFormulaFixture struct {
	query         string
	wantQueryType string
	hybridScore   float64
	content       string
	documentCode  string
	documentName  string
	sectionPath   string
	metadata      map[string]any
}

func assertQueryTypeScoreFormula(t *testing.T, fixture queryTypeFormulaFixture) {
	t.Helper()

	results := []*shared.VectorSearchResult[fragmodel.FragmentPayload]{
		{
			ID:      fixture.documentCode,
			Score:   fixture.hybridScore,
			Content: fixture.content,
			Payload: fragmodel.FragmentPayload{
				DocumentCode:  fixture.documentCode,
				DocumentName:  fixture.documentName,
				SectionTitle:  fixture.content,
				SectionPath:   fixture.sectionPath,
				Metadata:      map[string]any{},
				KnowledgeCode: "kb",
			},
			Metadata: fixture.metadata,
		},
	}

	scored := retrieval.ScoreSimilarityResultsWithDebugForTest(fixture.query, results, &struct{}{}, 1)
	if len(scored) != 1 {
		t.Fatalf("unexpected scored results: %#v", scored)
	}
	ranking := requireRetrievalRanking(t, scored[0].Metadata)
	if ranking.BM25Query.QueryType != fixture.wantQueryType {
		t.Fatalf("expected query type %q, got %#v", fixture.wantQueryType, ranking)
	}
	if math.Abs(scored[0].Score-ranking.FusionScore) > 1e-9 {
		t.Fatalf("expected final score to equal hybrid score, got score=%v ranking=%#v", scored[0].Score, ranking)
	}
}

func collectTerms(tokens []retrieval.AnalyzedToken) map[string]struct{} {
	result := make(map[string]struct{}, len(tokens))
	for _, token := range tokens {
		result[token.Term] = struct{}{}
	}
	return result
}

func BenchmarkAnalyzeForIndexLongHanBuffer(b *testing.B) {
	text := strings.Repeat("录音功能优化讨论会议纪要，重点关注录音转文字、笔记比例调整、项目层级与移动端上传路径。", 8)

	b.ResetTimer()
	for b.Loop() {
		_ = retrieval.AnalyzeForIndex(text, "content")
	}
}

package retrieval_test

import (
	"math"
	"strings"
	"testing"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	retrieval "magic/internal/domain/knowledge/fragment/retrieval"
	shared "magic/internal/domain/knowledge/shared"
)

const queryRefundFlowConfig = "退款流程配置"

const hybridSharedResultID = "shared"

func TestAnalyzeForIndexTwoHanWordDoesNotDoubleCountBigram(t *testing.T) {
	tokens := retrieval.AnalyzeForIndex("退款", "content")
	if len(tokens) != 1 {
		t.Fatalf("expected one token for two-han word, got %#v", tokens)
	}
	if tokens[0].Term != "退款" || tokens[0].Field != "content" || tokens[0].IsFallback {
		t.Fatalf("unexpected token: %#v", tokens[0])
	}
}

func TestAnalyzeForIndexHighCoverageChineseSkipsBridgeBigrams(t *testing.T) {
	tokens := retrieval.AnalyzeForIndex("笔记的比例调整", "content")
	terms := collectTerms(tokens)

	for _, want := range []string{"笔记", "比例", "调整"} {
		if _, ok := terms[want]; !ok {
			t.Fatalf("expected token %q in %#v", want, tokens)
		}
	}
	for _, unwanted := range []string{"记的", "的比"} {
		if _, ok := terms[unwanted]; ok {
			t.Fatalf("did not expect bridge bigram %q in %#v", unwanted, tokens)
		}
	}
}

func TestResolveHanFallbackModeForTestSupportsFullSelectiveAndNone(t *testing.T) {
	t.Parallel()

	mode, coverage, covered := retrieval.ResolveHanFallbackModeForTest("龘靐麤灥", nil, false)
	if mode != "full" || coverage != 0 {
		t.Fatalf("expected full fallback with zero coverage, got mode=%s coverage=%v covered=%v", mode, coverage, covered)
	}

	mode, coverage, covered = retrieval.ResolveHanFallbackModeForTest("笔记的比例图", []string{"笔记", "比例"}, false)
	if mode != "selective" {
		t.Fatalf("expected selective fallback, got mode=%s coverage=%v covered=%v", mode, coverage, covered)
	}
	if coverage <= 0.55 || coverage >= 0.80 {
		t.Fatalf("expected selective coverage range, got %v", coverage)
	}

	mode, coverage, covered = retrieval.ResolveHanFallbackModeForTest("笔记的比例调整", []string{"笔记", "比例", "调整"}, false)
	if mode != "none" {
		t.Fatalf("expected no fallback, got mode=%s coverage=%v covered=%v", mode, coverage, covered)
	}
	if coverage < 0.80 {
		t.Fatalf("expected high coverage for no fallback, got %v", coverage)
	}
}

func TestBuildHanTokensForTestSelectiveFallbackSkipsStopwordBridgeBigrams(t *testing.T) {
	t.Parallel()

	tokens := retrieval.BuildHanTokensForTest("笔记的比例图", "content", []string{"笔记", "比例"}, false)
	terms := collectTerms(tokens)

	for _, want := range []string{"笔记", "比例", "例图"} {
		if _, ok := terms[want]; !ok {
			t.Fatalf("expected token %q in %#v", want, tokens)
		}
	}
	for _, unwanted := range []string{"记的", "的比"} {
		if _, ok := terms[unwanted]; ok {
			t.Fatalf("did not expect stopword bigram %q in %#v", unwanted, tokens)
		}
	}
}

func TestBuildHanTokensForTestQueryModeKeepsExistingFallbackBehavior(t *testing.T) {
	t.Parallel()

	tokens := retrieval.BuildHanTokensForTest("笔记的比例图", "content", []string{"笔记", "比例"}, true)
	terms := collectTerms(tokens)

	for _, want := range []string{"记的", "的比", "例图"} {
		if _, ok := terms[want]; !ok {
			t.Fatalf("expected query fallback token %q in %#v", want, tokens)
		}
	}
}

func TestAnalyzeForQuerySupportsChineseAndMixedASCII(t *testing.T) {
	tokens := retrieval.AnalyzeForQuery("API鉴权v2 camelCase snake_case 退款流程")
	terms := collectTerms(tokens)

	for _, want := range []string{"api", "鉴权", "v2", "camel", "case", "snake", "snake_case", "退款", "流程", "款流"} {
		if _, ok := terms[want]; !ok {
			t.Fatalf("expected token %q in %#v", want, tokens)
		}
	}
	if _, ok := terms["退款流程"]; ok {
		t.Fatalf("did not expect raw full-run token, got %#v", tokens)
	}
}

func TestFuseHybridResultsUsesRelativeScoreFusion(t *testing.T) {
	t.Parallel()

	dense := []*fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{
		{ID: "dense-only", Score: 0.8},
		{ID: "shared", Score: 0.7},
	}
	sparse := []*fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{
		{ID: "sparse-only", Score: 0.9},
		{ID: "shared", Score: 0.95},
	}

	denseHeavy := retrieval.FuseHybridResultsForTest(dense, sparse, 0.9, 0.1)
	if len(denseHeavy) != 3 {
		t.Fatalf("expected 3 fused results, got %#v", denseHeavy)
	}
	if denseHeavy[0].ID != "dense-only" || denseHeavy[1].ID != hybridSharedResultID || denseHeavy[2].ID != "sparse-only" {
		t.Fatalf("expected dense-heavy ordering to follow relative score fusion, got %#v", denseHeavy)
	}
	if math.Abs(denseHeavy[0].Score-0.9) > 1e-9 || math.Abs(denseHeavy[1].Score-0.1) > 1e-9 || math.Abs(denseHeavy[2].Score) > 1e-9 {
		t.Fatalf("unexpected dense-heavy fused scores: %#v", denseHeavy)
	}

	sparseHeavy := retrieval.FuseHybridResultsForTest(dense, sparse, 0.1, 0.9)
	if len(sparseHeavy) != 3 {
		t.Fatalf("expected 3 fused results, got %#v", sparseHeavy)
	}
	if sparseHeavy[0].ID != hybridSharedResultID || sparseHeavy[1].ID != "dense-only" || sparseHeavy[2].ID != "sparse-only" {
		t.Fatalf("expected sparse-heavy ordering to follow relative score fusion, got %#v", sparseHeavy)
	}
	if math.Abs(sparseHeavy[0].Score-0.9) > 1e-9 || math.Abs(sparseHeavy[1].Score-0.1) > 1e-9 || math.Abs(sparseHeavy[2].Score) > 1e-9 {
		t.Fatalf("unexpected sparse-heavy fused scores: %#v", sparseHeavy)
	}
}

func TestFuseHybridResultsAppliesDenseCutoffToSparseCandidates(t *testing.T) {
	t.Parallel()

	dense := []*fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{
		{ID: hybridSharedResultID, Score: 0.42},
	}
	sparse := []*fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{
		{ID: hybridSharedResultID, Score: 8.2},
		{ID: "sparse-only", Score: 9.6},
	}

	fused := retrieval.FuseHybridResultsWithCutoffForTest(dense, sparse, 0.55, 0.45, 0.1)
	if len(fused) != 1 || fused[0].ID != hybridSharedResultID {
		t.Fatalf("expected dense cutoff to drop sparse-only candidates, got %#v", fused)
	}
	if applied, _ := fused[0].Metadata["dense_cutoff_applied"].(bool); !applied {
		t.Fatalf("expected dense cutoff flag in metadata, got %#v", fused[0].Metadata)
	}
}

func TestResolveHybridSearchConfigPrioritizesHybridAlpha(t *testing.T) {
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
	if math.Abs(config.DenseWeight-0.7) > 1e-9 || math.Abs(config.SparseWeight-0.3) > 1e-9 {
		t.Fatalf("expected HybridAlpha to override fallback weights, got dense=%v sparse=%v", config.DenseWeight, config.SparseWeight)
	}
	if math.Abs(config.HybridAlpha-0.7) > 1e-9 {
		t.Fatalf("expected effective hybrid alpha to equal configured alpha, got %v", config.HybridAlpha)
	}
}

func TestResolveHybridSearchConfigUsesNormalizedDefaultRetrieveConfig(t *testing.T) {
	t.Parallel()

	config := retrieval.ResolveHybridSearchConfigForTest(10, &struct {
		RetrieveConfig *shared.RetrieveConfig
	}{})
	if math.Abs(config.DenseWeight-1) > 1e-9 || math.Abs(config.SparseWeight) > 1e-9 {
		t.Fatalf("expected default hybrid weights, got dense=%v sparse=%v", config.DenseWeight, config.SparseWeight)
	}
}

func TestScoreSimilarityResultsPrefersTitleMatch(t *testing.T) {
	const docTitleHit = "doc1"
	results := []*fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{
		{
			ID:      "title-hit",
			Score:   0.8,
			Content: "无关内容",
			Payload: fragmodel.FragmentPayload{
				DocumentCode:  docTitleHit,
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
	if len(scored) != 2 || scored[0].DocumentCode != docTitleHit {
		t.Fatalf("expected title hit first, got %#v", scored)
	}
}

func TestScoreSimilarityResultsCarriesFragmentIDFromPayload(t *testing.T) {
	t.Parallel()

	results := []*fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{
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

func TestScoreSimilarityResultsRerankOnlyChangesTieBreakScore(t *testing.T) {
	const (
		docVectorHeavy = "doc1"
		docPhraseTitle = "doc2"
	)
	query := queryRefundFlowConfig
	results := []*fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{
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

	withoutRerank := retrieval.ScoreSimilarityResultsWithDebugForTest(query, results, &struct{}{}, 1)
	withRerank := retrieval.ScoreSimilarityResultsWithDebugForTest(query, results, &struct {
		RetrieveConfig *shared.RetrieveConfig
	}{
		RetrieveConfig: &shared.RetrieveConfig{RerankEnabled: true},
	}, 1)

	if len(withoutRerank) != 1 || len(withRerank) != 1 {
		t.Fatalf("unexpected score result lengths: without=%d with=%d", len(withoutRerank), len(withRerank))
	}
	if withoutRerank[0].DocumentCode != docPhraseTitle {
		t.Fatalf("expected phrase-title doc to stay ahead under relative fusion, got %#v", withoutRerank)
	}
	if withRerank[0].DocumentCode != docPhraseTitle {
		t.Fatalf("expected phrase-title doc first with rerank, got %#v", withRerank)
	}
	if math.Abs(withRerank[0].Score-withoutRerank[0].Score) > 1e-9 {
		t.Fatalf("expected rerank not to change exposed score, without=%#v with=%#v", withoutRerank, withRerank)
	}
	withoutBreakdown := requireScoreBreakdown(t, withoutRerank[0].Metadata)
	withBreakdown := requireScoreBreakdown(t, withRerank[0].Metadata)
	if withBreakdown.SecondaryRankScore <= withoutBreakdown.SecondaryRankScore {
		t.Fatalf("expected rerank to only boost tie-break score, without=%#v with=%#v", withoutBreakdown, withBreakdown)
	}
}

func TestScoreSimilarityResultsReturnsHybridScoreAfterRerankSelection(t *testing.T) {
	query := queryRefundFlowConfig
	results := []*fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{
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
		breakdown := requireScoreBreakdown(t, item.Metadata)
		if math.Abs(item.Score-breakdown.RankingScore) > 1e-9 {
			t.Fatalf("expected response score to equal ranking score, got score=%v breakdown=%#v", item.Score, breakdown)
		}
		if math.Abs(breakdown.RankingScore-breakdown.HybridScore) > 1e-9 {
			t.Fatalf("expected ranking score to equal hybrid score, got %#v", breakdown)
		}
	}
}

func TestScoreSimilarityResultsMapsSparseOnlyResultToRankingScore(t *testing.T) {
	results := []*fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{
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

	breakdown := requireScoreBreakdown(t, scored[0].Metadata)
	if math.Abs(scored[0].Score-breakdown.RankingScore) > 1e-9 {
		t.Fatalf("expected sparse-only result score to equal ranking score, got score=%v breakdown=%#v", scored[0].Score, breakdown)
	}
	if math.Abs(breakdown.RankingScore-breakdown.HybridScore) > 1e-9 {
		t.Fatalf("expected sparse-only result score to expose hybrid score, got %#v", breakdown)
	}
	if breakdown.SparseScore != 8.6 {
		t.Fatalf("expected sparse score to be preserved in debug breakdown, got %#v", breakdown)
	}
	if scored[0].Score <= 0 || scored[0].Score > 1 {
		t.Fatalf("expected final score to stay within 0~1, got %#v", scored)
	}
}

func TestScoreSimilarityResultsFiltersWeakSingleCandidateSupport(t *testing.T) {
	results := []*fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{
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
				"rrf_score":        0.011305822498586773,
			},
		},
	}

	scored := retrieval.ScoreSimilarityResultsWithThresholdAndDebugForTest("录音纪要有哪些问题呢", results, &struct{}{}, 1, 0.25)
	if len(scored) != 0 {
		t.Fatalf("expected weak support result to be filtered, got %#v", scored)
	}
}

func TestScoreSimilarityResultsKeepsDenseSupportedSingleCandidate(t *testing.T) {
	results := []*fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{
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
		t.Fatalf("expected dense-supported result to be kept, got %#v", scored)
	}
	breakdown := requireScoreBreakdown(t, scored[0].Metadata)
	if breakdown.SupportScore < 0.2 {
		t.Fatalf("expected support score to pass threshold, got %#v", breakdown)
	}
}

func TestScoreSimilarityResultsUsesHigherSupportThresholdForShortQuery(t *testing.T) {
	results := []*fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{
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
	if len(scored) != 0 {
		t.Fatalf("expected short query weak support result to be filtered, got %#v", scored)
	}
}

func TestScoreSimilarityResultsKeepsShortQueryAtHigherSupportThreshold(t *testing.T) {
	results := []*fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{
		{
			ID:      "short-query-supported",
			Score:   1,
			Content: "录音文本时间区间查询方案说明",
			Payload: fragmodel.FragmentPayload{
				DocumentCode:  "doc-short-supported",
				DocumentName:  "录音方案",
				SectionTitle:  "核心需求",
				SectionPath:   "录音文本时间区间提取方案 > 需求分析",
				Metadata:      map[string]any{},
				KnowledgeCode: "kb",
			},
			Metadata: map[string]any{
				"fusion_algorithm": "relative_score",
				"hybrid_score":     1.0,
				"dense_score":      0.25,
			},
		},
	}

	scored := retrieval.ScoreSimilarityResultsWithThresholdAndDebugForTest("你好", results, &struct{}{}, 1, 0.25)
	if len(scored) != 1 {
		t.Fatalf("expected short query supported result to be kept, got %#v", scored)
	}
	breakdown := requireScoreBreakdown(t, scored[0].Metadata)
	if breakdown.SupportScore < 0.25 {
		t.Fatalf("expected short query support score to pass higher threshold, got %#v", breakdown)
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

func TestScoreSimilarityResultsThresholdAlsoRequiresSupport(t *testing.T) {
	t.Parallel()

	filtered := retrieval.ApplyResultScoreThresholdWithSupportForTest(
		[]float64{0.9, 0.8, 0.2},
		[]float64{0.19, 0.2, 1},
		0.5,
	)

	if len(filtered) != 1 || filtered[0] != 0.8 {
		t.Fatalf("expected threshold filtering to require final and support scores, got %#v", filtered)
	}
}

func TestScoreSimilarityResultsRerankOnlyChangesTieBreakScoreInDebug(t *testing.T) {
	query := queryRefundFlowConfig
	results := []*fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{
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

	withoutByDoc := map[string]retrieval.ScoreBreakdown{}
	for _, item := range withoutRerank {
		withoutByDoc[item.DocumentCode] = requireScoreBreakdown(t, item.Metadata)
	}
	for _, item := range withRerank {
		breakdown := requireScoreBreakdown(t, item.Metadata)
		without := withoutByDoc[item.DocumentCode]
		if math.Abs(breakdown.RankingScore-without.RankingScore) > 1e-9 {
			t.Fatalf("expected rerank not to change exposed score for %s: without=%#v with=%#v", item.DocumentCode, without, breakdown)
		}
		if breakdown.SecondaryRankScore < without.SecondaryRankScore {
			t.Fatalf("expected rerank not to lower tie-break score for %s: without=%#v with=%#v", item.DocumentCode, without, breakdown)
		}
	}
}

func requireScoreBreakdown(t *testing.T, metadata map[string]any) retrieval.ScoreBreakdown {
	t.Helper()

	value, ok := metadata["score_breakdown"]
	if !ok {
		t.Fatalf("expected score_breakdown in metadata: %#v", metadata)
	}
	breakdown, ok := value.(retrieval.ScoreBreakdown)
	if !ok {
		t.Fatalf("unexpected score_breakdown type %T", value)
	}
	return breakdown
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

package retrieval

import (
	"context"
	"fmt"
	"slices"

	"github.com/go-ego/gse"
)

type CandidateFieldTextForTest struct {
	Field string
	Text  string
}

type CandidateAnalysisSnapshotForTest struct {
	FieldTexts        []CandidateFieldTextForTest
	DocTokens         []string
	FieldTokenHits    map[string][]string
	SectionPathTokens []string
}

type HybridSearchConfigForTest struct {
	DenseTopK    int
	SparseTopK   int
	DenseWeight  float64
	SparseWeight float64
	HybridAlpha  float64
}

func FuseHybridResultsForTest(
	denseResults []*VectorSearchResult[FragmentPayload],
	sparseResults []*VectorSearchResult[FragmentPayload],
	denseWeight float64,
	sparseWeight float64,
) []*VectorSearchResult[FragmentPayload] {
	return fuseHybridResults(denseResults, sparseResults, hybridSearchConfig{
		DenseWeight:  denseWeight,
		SparseWeight: sparseWeight,
	})
}

func FuseHybridResultsWithCutoffForTest(
	denseResults []*VectorSearchResult[FragmentPayload],
	sparseResults []*VectorSearchResult[FragmentPayload],
	denseWeight float64,
	sparseWeight float64,
	denseCutoffThreshold float64,
) []*VectorSearchResult[FragmentPayload] {
	return fuseHybridResults(denseResults, sparseResults, hybridSearchConfig{
		DenseWeight:          denseWeight,
		SparseWeight:         sparseWeight,
		DenseCutoffThreshold: denseCutoffThreshold,
		EffectiveHybridAlpha: denseWeight,
	})
}

func ScoreSimilarityResultsForTest(
	query string,
	results []*VectorSearchResult[FragmentPayload],
	kb any,
	topK int,
) []*SimilarityResult {
	service := NewService(nil, nil, Infra{})
	return service.scoreSimilarityResults(context.Background(), query, results, snapshotKnowledgeBase(kb), topK, similarityResultOptions{})
}

func ScoreSimilarityResultsWithDebugForTest(
	query string,
	results []*VectorSearchResult[FragmentPayload],
	kb any,
	topK int,
) []*SimilarityResult {
	service := NewService(nil, nil, Infra{})
	return service.scoreSimilarityResults(context.Background(), query, results, snapshotKnowledgeBase(kb), topK, similarityResultOptions{
		SearchOptions: &SimilaritySearchOptions{Debug: true},
	})
}

func ScoreSimilarityResultsWithThresholdAndDebugForTest(
	query string,
	results []*VectorSearchResult[FragmentPayload],
	kb any,
	topK int,
	threshold float64,
) []*SimilarityResult {
	service := NewService(nil, nil, Infra{})
	return service.scoreSimilarityResults(context.Background(), query, results, snapshotKnowledgeBase(kb), topK, similarityResultOptions{
		ResultScoreThreshold: threshold,
		SearchOptions:        &SimilaritySearchOptions{Debug: true},
	})
}

func EnrichSimilarityResultsWithContextForTest(
	ctx context.Context,
	results []*SimilarityResult,
	repo KnowledgeBaseFragmentReader,
) []*SimilarityResult {
	return enrichSimilarityResultsWithContext(ctx, results, repo, newTestRetrievalAnalyzer())
}

func SearchSimilarityCandidatesForTest(
	ctx context.Context,
	service *Service,
	kb any,
	req SimilarityRequest,
) ([]*VectorSearchResult[FragmentPayload], error) {
	results, _, err := service.searchSimilarityCandidates(ctx, snapshotKnowledgeBase(kb), req)
	return results, err
}

func ResolveHybridSearchConfigForTest(topK int, kb any) HybridSearchConfigForTest {
	config := resolveHybridSearchConfig(topK, snapshotKnowledgeBase(kb))
	return HybridSearchConfigForTest{
		DenseTopK:    config.DenseTopK,
		SparseTopK:   config.SparseTopK,
		DenseWeight:  config.DenseWeight,
		SparseWeight: config.SparseWeight,
		HybridAlpha:  config.EffectiveHybridAlpha,
	}
}

func ApplyResultScoreThresholdWithFallbackForTest(
	finalScores []float64,
	topK int,
	threshold float64,
) ([]float64, float64, bool) {
	scored := make([]scoredResult, len(finalScores))
	for i, score := range finalScores {
		scored[i] = scoredResult{finalScore: score, denseScore: 1}
	}

	filtered, appliedThreshold := applyResultScoreThresholdWithFallback(scored, topK, threshold)

	result := make([]float64, len(filtered))
	for i, item := range filtered {
		result[i] = item.finalScore
	}
	return result, appliedThreshold, false
}

func ApplyResultScoreThresholdWithSupportForTest(
	finalScores []float64,
	supportScores []float64,
	threshold float64,
) []float64 {
	scored := make([]scoredResult, len(finalScores))
	for i, score := range finalScores {
		if i < len(supportScores) {
			scored[i] = scoredResult{finalScore: score, denseScore: supportScores[i]}
			continue
		}
		scored[i] = scoredResult{finalScore: score}
	}

	filtered := applyResultScoreThreshold(scored, threshold)
	result := make([]float64, len(filtered))
	for i, item := range filtered {
		result[i] = item.finalScore
	}
	return result
}

func ResolveHanFallbackModeForTest(text string, primaryTerms []string, queryMode bool) (string, float64, []bool) {
	mode, covered, coverage := resolveHanFallbackMode(normalizeTokenTerm(text), primaryTerms, queryMode)
	return hanFallbackModeString(mode), coverage, slices.Clone(covered)
}

func BuildHanTokensForTest(text, field string, primaryTerms []string, queryMode bool) []AnalyzedToken {
	normalizedTerms := make([]string, 0, len(primaryTerms))
	for _, term := range primaryTerms {
		if normalizedTerm := normalizeTokenTerm(term); normalizedTerm != "" {
			normalizedTerms = append(normalizedTerms, normalizedTerm)
		}
	}
	return buildHanTokens(normalizeTokenTerm(text), field, normalizedTerms, queryMode)
}

func SetSegmenterLoaderForTest(service *Service, load func(*gse.Segmenter) error) {
	if service != nil {
		service.segmenterProvider = newRetrievalSegmenterProvider(load)
	}
}

func LoadTestSegmenterDictForTest(segmenter *gse.Segmenter) error {
	return loadTestSegmenterDict(segmenter)
}

func ResolveBundledRetrievalDictionaryFilesForTest(candidateDirs []string) ([]string, error) {
	return resolveBundledRetrievalDictionaryFiles(candidateDirs)
}

func BundledRetrievalDictMagicServiceDirForTest() string {
	return retrievalBundledDictMagicServiceDir
}

func BundledRetrievalSimplifiedDictFileForTest() string {
	return retrievalBundledSimplifiedDictFile
}

func BundledRetrievalTraditionalDictFileForTest() string {
	return retrievalBundledTraditionalDictFile
}

func SharedSegmenterForTest(service *Service) *gse.Segmenter {
	if service == nil {
		return nil
	}
	switch segmenter := service.newRetrievalAnalyzer().segmenter.(type) {
	case *gse.Segmenter:
		return segmenter
	case lockedSegmenter:
		return segmenter.unwrap()
	default:
		return nil
	}
}

func BuildCandidateAnalysisSnapshotForTest(result *VectorSearchResult[FragmentPayload]) CandidateAnalysisSnapshotForTest {
	return convertCandidateAnalysisSnapshotForTest(buildCandidateAnalysisSnapshot(result, newTestRetrievalAnalyzer()))
}

func BuildLegacyCandidateAnalysisForTest(result *VectorSearchResult[FragmentPayload]) CandidateAnalysisSnapshotForTest {
	analyzer := newTestRetrievalAnalyzer()
	fieldTexts := resultSparseFieldTexts(result)
	return CandidateAnalysisSnapshotForTest{
		FieldTexts:        convertFieldTextsForTest(fieldTexts),
		DocTokens:         slices.Clone(buildRankingTermsFromResultWithAnalyzer(result, analyzer)),
		FieldTokenHits:    convertFieldTokenHitsForTest(buildFieldTokenHitsWithAnalyzer(result, analyzer)),
		SectionPathTokens: slices.Clone(analyzer.tokenTerms(result.Payload.SectionPath)),
	}
}

func ComputeExactPhraseMatchScoreForTest(query string, result *VectorSearchResult[FragmentPayload]) float64 {
	return computeExactPhraseMatchScore(query, result)
}

func ComputeSectionPathMatchScoreForTest(query, sectionPath string) float64 {
	analyzer := newTestRetrievalAnalyzer()
	return computeSectionPathMatchScore(query, analyzer.tokenTerms(query), sectionPath, analyzer)
}

func ComputeSectionPathMatchScoreWithTokensForTest(query, sectionPath string, sectionPathTokens []string) float64 {
	return computeSectionPathMatchScoreWithTokens(query, tokenizeForRetrieval(query), sectionPath, sectionPathTokens)
}

func ComputeExactPhraseMatchScoreFromSnapshotForTest(query string, snapshot CandidateAnalysisSnapshotForTest) float64 {
	return computeExactPhraseMatchScoreFromFieldTexts(query, convertFieldTextsFromTest(snapshot.FieldTexts))
}

func hanFallbackModeString(mode hanFallbackMode) string {
	const (
		hanFallbackFullMode      = "full"
		hanFallbackSelectiveMode = "selective"
		hanFallbackNoneMode      = "none"
	)

	switch mode {
	case hanFallbackModeFull:
		return hanFallbackFullMode
	case hanFallbackModeSelective:
		return hanFallbackSelectiveMode
	default:
		return hanFallbackNoneMode
	}
}

func convertCandidateAnalysisSnapshotForTest(snapshot candidateAnalysisSnapshot) CandidateAnalysisSnapshotForTest {
	return CandidateAnalysisSnapshotForTest{
		FieldTexts:        convertFieldTextsForTest(snapshot.fieldTexts),
		DocTokens:         slices.Clone(snapshot.docTokens),
		FieldTokenHits:    convertFieldTokenHitsForTest(snapshot.fieldTokenHits),
		SectionPathTokens: slices.Clone(snapshot.sectionPathTokens),
	}
}

func convertFieldTextsForTest(fieldTexts []retrievalFieldText) []CandidateFieldTextForTest {
	result := make([]CandidateFieldTextForTest, len(fieldTexts))
	for i, fieldText := range fieldTexts {
		result[i] = CandidateFieldTextForTest(fieldText)
	}
	return result
}

func convertFieldTextsFromTest(fieldTexts []CandidateFieldTextForTest) []retrievalFieldText {
	result := make([]retrievalFieldText, len(fieldTexts))
	for i, fieldText := range fieldTexts {
		result[i] = retrievalFieldText(fieldText)
	}
	return result
}

func convertFieldTokenHitsForTest(fieldTokenHits map[string]map[string]struct{}) map[string][]string {
	if len(fieldTokenHits) == 0 {
		return map[string][]string{}
	}
	result := make(map[string][]string, len(fieldTokenHits))
	for field, hits := range fieldTokenHits {
		tokens := make([]string, 0, len(hits))
		for token := range hits {
			tokens = append(tokens, token)
		}
		slices.Sort(tokens)
		result[field] = tokens
	}
	return result
}

func loadTestSegmenterDict(segmenter *gse.Segmenter) error {
	if err := segmenter.LoadDictStr(retrievalTestSegmenterDict); err != nil {
		return fmt.Errorf("load test segmenter dict: %w", err)
	}
	return nil
}

func newTestRetrievalAnalyzer() retrievalAnalyzer {
	segmenter, err := newRetrievalSegmenterProvider(loadTestSegmenterDict).cutter()
	if err != nil {
		return retrievalAnalyzer{}
	}
	return retrievalAnalyzer{segmenter: segmenter}
}

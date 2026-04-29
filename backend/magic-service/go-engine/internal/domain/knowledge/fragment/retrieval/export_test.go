package retrieval

import (
	"context"
	"fmt"
	"reflect"
	"slices"

	"github.com/go-ego/gse"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
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
	DenseTopK            int
	SparseTopK           int
	DenseWeight          float64
	SparseWeight         float64
	HybridAlpha          float64
	LegacyWeightUpgraded bool
}

func FuseHybridResultsForTest(
	denseResults []*shared.VectorSearchResult[fragmodel.FragmentPayload],
	sparseResults []*shared.VectorSearchResult[fragmodel.FragmentPayload],
	denseWeight float64,
	sparseWeight float64,
) []*shared.VectorSearchResult[fragmodel.FragmentPayload] {
	return fuseHybridResults(denseResults, sparseResults, hybridSearchConfig{
		DenseWeight:  denseWeight,
		SparseWeight: sparseWeight,
	})
}

func ScoreSimilarityResultsForTest(
	query string,
	results []*shared.VectorSearchResult[fragmodel.FragmentPayload],
	kb any,
	topK int,
) []*fragmodel.SimilarityResult {
	service := NewService(nil, nil, Infra{})
	profile := buildSimilarityQueryProfile(query, query, service.newRetrievalAnalyzer())
	return service.scoreSimilarityResults(context.Background(), profile, results, *snapshotKnowledgeBaseForTest(kb), topK, similarityResultOptions{
		Trace: similaritySearchTrace{
			SparseBackend: SparseBackendQdrantBM25ZHV1,
			QueryProfile:  profile,
			QueryType:     profile.QueryType,
		},
	})
}

func ScoreSimilarityResultsWithDebugForTest(
	query string,
	results []*shared.VectorSearchResult[fragmodel.FragmentPayload],
	kb any,
	topK int,
) []*fragmodel.SimilarityResult {
	service := NewService(nil, nil, Infra{})
	profile := buildSimilarityQueryProfile(query, query, service.newRetrievalAnalyzer())
	return service.scoreSimilarityResults(context.Background(), profile, results, *snapshotKnowledgeBaseForTest(kb), topK, similarityResultOptions{
		SearchOptions: &SimilaritySearchOptions{Debug: true},
		Trace: similaritySearchTrace{
			SparseBackend: SparseBackendQdrantBM25ZHV1,
			QueryProfile:  profile,
			QueryType:     profile.QueryType,
		},
	})
}

func ScoreSimilarityResultsWithThresholdAndDebugForTest(
	query string,
	results []*shared.VectorSearchResult[fragmodel.FragmentPayload],
	kb any,
	topK int,
	threshold float64,
) []*fragmodel.SimilarityResult {
	service := NewService(nil, nil, Infra{})
	profile := buildSimilarityQueryProfile(query, query, service.newRetrievalAnalyzer())
	return service.scoreSimilarityResults(context.Background(), profile, results, *snapshotKnowledgeBaseForTest(kb), topK, similarityResultOptions{
		ResultScoreThreshold: threshold,
		SearchOptions:        &SimilaritySearchOptions{Debug: true},
		Trace: similaritySearchTrace{
			SparseBackend: SparseBackendQdrantBM25ZHV1,
			QueryProfile:  profile,
			QueryType:     profile.QueryType,
		},
	})
}

func SearchSimilarityCandidatesForTest(
	ctx context.Context,
	service *Service,
	kb any,
	req SimilarityRequest,
) ([]*shared.VectorSearchResult[fragmodel.FragmentPayload], error) {
	results, _, err := service.searchSimilarityCandidates(ctx, snapshotKnowledgeBaseForTest(kb), req)
	return results, err
}

func ResolveHybridSearchConfigForTest(topK int, kb any) HybridSearchConfigForTest {
	config := resolveHybridSearchConfig(topK, *snapshotKnowledgeBaseForTest(kb))
	return HybridSearchConfigForTest{
		DenseTopK:            config.DenseTopK,
		SparseTopK:           config.SparseTopK,
		DenseWeight:          config.DenseWeight,
		SparseWeight:         config.SparseWeight,
		HybridAlpha:          config.EffectiveHybridAlpha,
		LegacyWeightUpgraded: config.LegacyWeightUpgraded,
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

func snapshotKnowledgeBaseForTest(value any) *sharedsnapshot.KnowledgeBaseRuntimeSnapshot {
	if snapshot, ok := value.(*sharedsnapshot.KnowledgeBaseRuntimeSnapshot); ok {
		return sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(sharedsnapshot.CloneKnowledgeBaseRuntimeSnapshot(snapshot))
	}

	root := reflect.ValueOf(value)
	for root.IsValid() && (root.Kind() == reflect.Pointer || root.Kind() == reflect.Interface) {
		if root.IsNil() {
			return sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(&sharedsnapshot.KnowledgeBaseRuntimeSnapshot{})
		}
		root = root.Elem()
	}
	if !root.IsValid() || root.Kind() != reflect.Struct {
		return sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(&sharedsnapshot.KnowledgeBaseRuntimeSnapshot{})
	}

	snapshot := &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{
		Code:             stringFieldForTest(root, "Code"),
		Name:             stringFieldForTest(root, "Name"),
		OrganizationCode: stringFieldForTest(root, "OrganizationCode"),
		Model:            stringFieldForTest(root, "Model"),
		VectorDB:         stringFieldForTest(root, "VectorDB"),
		RetrieveConfig:   retrieveConfigFieldForTest(root, "RetrieveConfig"),
		FragmentConfig:   fragmentConfigFieldForTest(root, "FragmentConfig"),
		EmbeddingConfig:  embeddingConfigFieldForTest(root, "EmbeddingConfig"),
		ResolvedRoute:    resolvedRouteFieldForTest(root, "ResolvedRoute"),
	}
	return sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(snapshot)
}

func stringFieldForTest(root reflect.Value, name string) string {
	field := root.FieldByName(name)
	if !field.IsValid() || field.Kind() != reflect.String {
		return ""
	}
	return field.String()
}

func retrieveConfigFieldForTest(root reflect.Value, name string) *shared.RetrieveConfig {
	field := root.FieldByName(name)
	if !field.IsValid() || !field.CanInterface() {
		return nil
	}
	cfg, _ := field.Interface().(*shared.RetrieveConfig)
	return shared.CloneRetrieveConfig(cfg)
}

func fragmentConfigFieldForTest(root reflect.Value, name string) *shared.FragmentConfig {
	field := root.FieldByName(name)
	if !field.IsValid() || !field.CanInterface() {
		return nil
	}
	cfg, _ := field.Interface().(*shared.FragmentConfig)
	return shared.CloneFragmentConfig(cfg)
}

func embeddingConfigFieldForTest(root reflect.Value, name string) *shared.EmbeddingConfig {
	field := root.FieldByName(name)
	if !field.IsValid() || !field.CanInterface() {
		return nil
	}
	cfg, _ := field.Interface().(*shared.EmbeddingConfig)
	return shared.CloneEmbeddingConfig(cfg)
}

func resolvedRouteFieldForTest(root reflect.Value, name string) *sharedroute.ResolvedRoute {
	field := root.FieldByName(name)
	if !field.IsValid() || !field.CanInterface() {
		return nil
	}
	route, _ := field.Interface().(*sharedroute.ResolvedRoute)
	return sharedroute.CloneResolvedRoute(route)
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

func BundledRetrievalCustomTermsDictFileForTest() string {
	return retrievalBundledCustomTermsDictFile
}

func BundledRetrievalStopwordsDictFileForTest() string {
	return retrievalBundledRetrievalStopwordsFile
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

func BuildCandidateAnalysisSnapshotForTest(result *shared.VectorSearchResult[fragmodel.FragmentPayload]) CandidateAnalysisSnapshotForTest {
	return convertCandidateAnalysisSnapshotForTest(buildCandidateAnalysisSnapshot(result, newTestRetrievalAnalyzer()))
}

func BuildLegacyCandidateAnalysisForTest(result *shared.VectorSearchResult[fragmodel.FragmentPayload]) CandidateAnalysisSnapshotForTest {
	analyzer := newTestRetrievalAnalyzer()
	fieldTexts := resultSparseFieldTextsWithAnalyzer(result, analyzer)
	return CandidateAnalysisSnapshotForTest{
		FieldTexts:        convertFieldTextsForTest(fieldTexts),
		DocTokens:         slices.Clone(buildRankingTermsFromResultWithAnalyzer(result, analyzer)),
		FieldTokenHits:    convertFieldTokenHitsForTest(buildFieldTokenHitsWithAnalyzer(result, analyzer)),
		SectionPathTokens: slices.Clone(analyzer.tokenTerms(result.Payload.SectionPath)),
	}
}

func ComputeExactPhraseMatchScoreForTest(query string, result *shared.VectorSearchResult[fragmodel.FragmentPayload]) float64 {
	return computeExactPhraseMatchScore(query, result)
}

func ComputeSectionPathMatchScoreForTest(query, sectionPath string) float64 {
	analyzer := newTestRetrievalAnalyzer()
	return computeSectionPathMatchScore(query, analyzer.tokenTerms(query), sectionPath, analyzer)
}

func ComputeSectionPathMatchScoreWithTokensForTest(query, sectionPath string, sectionPathTokens []string) float64 {
	analyzer := newTestRetrievalAnalyzer()
	return computeSectionPathMatchScoreWithTokens(query, analyzer.tokenTerms(query), sectionPath, sectionPathTokens)
}

func ComputeExactPhraseMatchScoreFromSnapshotForTest(query string, snapshot CandidateAnalysisSnapshotForTest) float64 {
	return computeExactPhraseMatchScoreFromFieldTexts(query, convertFieldTextsFromTest(snapshot.FieldTexts))
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

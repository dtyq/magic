package retrieval

import (
	"hash/fnv"
	"math"
	"slices"
	"strings"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/shared"
)

const (
	fieldTokenCapacity     = 6
	termCapacityMultiplier = 8
	titleFieldWeight       = 2.0
	tableTitleFieldWeight  = 2.0
	defaultFieldWeight     = 1.0
	wordTokenWeight        = 1.0
)

type retrievalFieldText struct {
	Field string
	Text  string
}

type sparseTermWeight struct {
	index uint32
	value float32
}

func buildCandidateAnalysisSnapshot(
	result *shared.VectorSearchResult[fragmodel.FragmentPayload],
	analyzer retrievalAnalyzer,
) candidateAnalysisSnapshot {
	fieldTexts := resultSparseFieldTextsWithAnalyzer(result, analyzer)
	snapshot := candidateAnalysisSnapshot{
		fieldTexts:           fieldTexts,
		normalizedFieldTexts: make([]string, 0, len(fieldTexts)),
		docTokenSet:          make(map[string]struct{}),
		docTermFrequency:     make(map[string]int),
		tokenPositions:       make(map[string][]int),
		fieldTokenHits:       make(map[string]map[string]struct{}),
	}
	if result == nil {
		return snapshot
	}

	docTokens := make([]string, 0, keywordRetrievalPartsCapacity*termCapacityMultiplier)
	for _, fieldText := range fieldTexts {
		if normalizedFieldText := normalizeFieldTextForExactPhraseMatch(fieldText.Text); normalizedFieldText != "" {
			snapshot.normalizedFieldTexts = append(snapshot.normalizedFieldTexts, normalizedFieldText)
		}
		tokens := analyzer.analyzeSparseText(fieldText.Text, fieldText.Field, true)
		if len(tokens) == 0 {
			continue
		}
		var fieldTerms map[string]struct{}
		if isFieldMatchField(fieldText.Field) {
			fieldTerms = snapshot.fieldTokenHits[fieldText.Field]
			if fieldTerms == nil {
				fieldTerms = make(map[string]struct{}, len(tokens))
				snapshot.fieldTokenHits[fieldText.Field] = fieldTerms
			}
		}
		for _, token := range tokens {
			docTokens = append(docTokens, token.Term)
			snapshot.docTokenSet[token.Term] = struct{}{}
			snapshot.docTermFrequency[token.Term]++
			snapshot.tokenPositions[token.Term] = append(snapshot.tokenPositions[token.Term], len(docTokens)-1)
			if fieldTerms != nil {
				fieldTerms[token.Term] = struct{}{}
			}
		}
	}
	snapshot.docTokens = docTokens
	snapshot.sectionPathTokens = analyzer.tokenTerms(strings.TrimSpace(result.Payload.SectionPath))
	return snapshot
}

func isFieldMatchField(field string) bool {
	switch field {
	case retrievalFieldTitle, retrievalFieldPath, retrievalFieldDocumentName, retrievalFieldTableTitle, retrievalFieldTableKey, retrievalFieldHeader:
		return true
	default:
		return false
	}
}

func buildRankingTermsFromResultWithAnalyzer(result *shared.VectorSearchResult[fragmodel.FragmentPayload], analyzer retrievalAnalyzer) []string {
	if result == nil {
		return nil
	}

	terms := make([]string, 0, keywordRetrievalPartsCapacity*termCapacityMultiplier)
	for _, fieldText := range resultAnalysisFieldTexts(result, analyzer) {
		for _, token := range analyzer.analyzeSparseText(fieldText.Text, fieldText.Field, true) {
			terms = append(terms, token.Term)
		}
	}
	return terms
}

func buildFieldTokenHitsWithAnalyzer(result *shared.VectorSearchResult[fragmodel.FragmentPayload], analyzer retrievalAnalyzer) map[string]map[string]struct{} {
	fieldTerms := make(map[string]map[string]struct{})
	if result == nil {
		return fieldTerms
	}

	for _, fieldText := range resultAnalysisFieldTexts(result, analyzer) {
		tokens := analyzer.analyzeSparseText(fieldText.Text, fieldText.Field, true)
		if len(tokens) == 0 {
			continue
		}
		if _, ok := fieldTerms[fieldText.Field]; !ok {
			fieldTerms[fieldText.Field] = make(map[string]struct{}, len(tokens))
		}
		for _, token := range tokens {
			fieldTerms[fieldText.Field][token.Term] = struct{}{}
		}
	}
	return fieldTerms
}

func resultSparseFieldTexts(result *shared.VectorSearchResult[fragmodel.FragmentPayload]) []retrievalFieldText {
	return resultSparseFieldTextsWithAnalyzer(result, newRetrievalAnalyzer())
}

func resultSparseFieldTextsWithAnalyzer(
	result *shared.VectorSearchResult[fragmodel.FragmentPayload],
	analyzer retrievalAnalyzer,
) []retrievalFieldText {
	_ = analyzer
	return buildResultSparseSource(result).fieldTexts()
}

func resultAnalysisFieldTexts(
	result *shared.VectorSearchResult[fragmodel.FragmentPayload],
	analyzer retrievalAnalyzer,
) []retrievalFieldText {
	return resultSparseFieldTextsWithAnalyzer(result, analyzer)
}

// BuildSparseVectorFromFragment 构建客户端 sparse backend 使用的稀疏向量。
func BuildSparseVectorFromFragment(fragment *fragmodel.KnowledgeBaseFragment) *shared.SparseVector {
	return buildSparseVectorFromFragmentWithAnalyzer(fragment, newRetrievalAnalyzer())
}

// BuildSparseVectorFromFragment 使用共享检索分词器构建客户端 sparse backend 使用的稀疏向量。
func (s *Service) BuildSparseVectorFromFragment(fragment *fragmodel.KnowledgeBaseFragment) *shared.SparseVector {
	return buildSparseVectorFromFragmentWithAnalyzer(fragment, s.newRetrievalAnalyzer())
}

func buildSparseVectorFromFragmentWithAnalyzer(
	fragment *fragmodel.KnowledgeBaseFragment,
	analyzer retrievalAnalyzer,
) *shared.SparseVector {
	if fragment == nil {
		return nil
	}
	accumulator := make(map[uint32]float64, keywordRetrievalTextPartCapacity*termCapacityMultiplier)
	for _, fieldText := range buildFragmentSparseSource(fragment, analyzer).fieldTexts() {
		tokens := analyzer.analyzeSparseText(fieldText.Text, fieldText.Field, false)
		accumulateSparseTokens(accumulator, tokens, true)
	}
	return finalizeSparseVector(accumulator)
}

// BuildSparseVectorFromQuery 构建查询侧 sparse vector。
func BuildSparseVectorFromQuery(query string) *shared.SparseVector {
	return buildSparseVectorFromQueryWithAnalyzer(query, newRetrievalAnalyzer())
}

func buildSparseVectorFromQueryWithAnalyzer(query string, analyzer retrievalAnalyzer) *shared.SparseVector {
	profile := buildSimilarityQueryProfile(query, "", analyzer)
	return buildSparseVectorFromQueryProfile(profile, analyzer)
}

func buildSparseVectorFromQueryProfile(profile similarityQueryProfile, analyzer retrievalAnalyzer) *shared.SparseVector {
	tokens := buildSparseQueryTokens(profile, analyzer)
	if len(tokens) == 0 {
		return nil
	}
	accumulator := make(map[uint32]float64, len(tokens))
	accumulateSparseTokens(accumulator, tokens, false)
	return finalizeSparseVector(accumulator)
}

func buildSparseQueryTokens(profile similarityQueryProfile, analyzer retrievalAnalyzer) []AnalyzedToken {
	if len(profile.SparseTokens) > 0 {
		return compactAnalyzedTokens(profile.SparseTokens)
	}
	return buildSparseQueryTokensForProfile(profile.RawQuery, analyzer)
}

func accumulateSparseTokens(accumulator map[uint32]float64, tokens []AnalyzedToken, useFieldWeights bool) {
	for _, token := range tokens {
		term := strings.TrimSpace(token.Term)
		if term == "" {
			continue
		}
		weight := tokenSourceWeight()
		if useFieldWeights {
			weight *= fieldWeight(token.Field)
		}
		if weight <= 0 {
			continue
		}
		accumulator[hashSparseTerm(term)] += weight
	}
}

func finalizeSparseVector(accumulator map[uint32]float64) *shared.SparseVector {
	if len(accumulator) == 0 {
		return nil
	}

	entries := make([]sparseTermWeight, 0, len(accumulator))
	for index, tf := range accumulator {
		if tf <= 0 {
			continue
		}
		entries = append(entries, sparseTermWeight{
			index: index,
			value: float32(1 + math.Log1p(tf)),
		})
	}
	if len(entries) == 0 {
		return nil
	}

	slices.SortFunc(entries, func(a, b sparseTermWeight) int {
		switch {
		case a.index < b.index:
			return -1
		case a.index > b.index:
			return 1
		default:
			return 0
		}
	})

	indices := make([]uint32, len(entries))
	values := make([]float32, len(entries))
	for i, entry := range entries {
		indices[i] = entry.index
		values[i] = entry.value
	}
	return &shared.SparseVector{
		Indices: indices,
		Values:  values,
	}
}

func fieldWeight(field string) float64 {
	return sparseSourceBandWeight(field)
}

func tokenSourceWeight() float64 {
	return wordTokenWeight
}

func hashSparseTerm(term string) uint32 {
	hasher := fnv.New32a()
	_, _ = hasher.Write([]byte(term))
	return hasher.Sum32()
}

func coalesceNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func metadataStringListValue(metadata map[string]any, key string) []string {
	if len(metadata) == 0 {
		return nil
	}
	if values, ok := metadataStringListFromMap(metadata, key); ok {
		return values
	}
	if ext, ok := metadata["ext"].(map[string]any); ok {
		if values, ok := metadataStringListFromMap(ext, key); ok {
			return values
		}
	}
	return nil
}

func metadataStringListFromMap(metadata map[string]any, key string) ([]string, bool) {
	if len(metadata) == 0 {
		return nil, false
	}
	raw, ok := metadata[key]
	if !ok || raw == nil {
		return nil, false
	}

	switch value := raw.(type) {
	case []string:
		return compactStringList(value), len(value) > 0
	case []any:
		result := make([]string, 0, len(value))
		for _, item := range value {
			text, ok := item.(string)
			if !ok {
				continue
			}
			if trimmed := strings.TrimSpace(text); trimmed != "" {
				result = append(result, trimmed)
			}
		}
		return compactStringList(result), len(result) > 0
	default:
		return nil, false
	}
}

func compactStringList(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	result := make([]string, 0, len(values))
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

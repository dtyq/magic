package retrieval

import (
	"hash/fnv"
	"math"
	"slices"
	"strings"
)

const (
	fieldTokenCapacity     = 6
	termCapacityMultiplier = 8
	titleFieldWeight       = 2.0
	tableTitleFieldWeight  = 2.0
	defaultFieldWeight     = 1.0
	wordTokenWeight        = 1.0
	alphaNumTokenWeight    = 1.0
	bigramTokenWeight      = 0.7
	singleRuneTokenWeight  = 0.5
)

type retrievalFieldText struct {
	Field string
	Text  string
}

type sparseTermWeight struct {
	index uint32
	value float32
}

func buildCandidateAnalysisSnapshots(
	results []*VectorSearchResult[FragmentPayload],
	analyzer retrievalAnalyzer,
) []candidateAnalysisSnapshot {
	snapshots := make([]candidateAnalysisSnapshot, len(results))
	for i, result := range results {
		snapshots[i] = buildCandidateAnalysisSnapshot(result, analyzer)
	}
	return snapshots
}

func buildCandidateAnalysisSnapshot(
	result *VectorSearchResult[FragmentPayload],
	analyzer retrievalAnalyzer,
) candidateAnalysisSnapshot {
	snapshot := candidateAnalysisSnapshot{
		fieldTexts:     resultSparseFieldTexts(result),
		fieldTokenHits: make(map[string]map[string]struct{}),
	}
	if result == nil {
		return snapshot
	}

	docTokens := make([]string, 0, keywordRetrievalPartsCapacity*termCapacityMultiplier)
	for _, fieldText := range snapshot.fieldTexts {
		tokens := analyzer.analyzeText(fieldText.Text, "", true)
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

func buildRankingTermsFromResultWithAnalyzer(result *VectorSearchResult[FragmentPayload], analyzer retrievalAnalyzer) []string {
	if result == nil {
		return nil
	}

	terms := make([]string, 0, keywordRetrievalPartsCapacity*termCapacityMultiplier)
	for _, fieldText := range resultSparseFieldTexts(result) {
		for _, token := range analyzer.analyzeText(fieldText.Text, "", true) {
			terms = append(terms, token.Term)
		}
	}
	return terms
}

func buildFieldTokenHitsWithAnalyzer(result *VectorSearchResult[FragmentPayload], analyzer retrievalAnalyzer) map[string]map[string]struct{} {
	fieldTerms := make(map[string]map[string]struct{})
	if result == nil {
		return fieldTerms
	}

	for _, fieldText := range resultSparseFieldTexts(result) {
		tokens := analyzer.analyzeText(fieldText.Text, "", true)
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

func resultSparseFieldTexts(result *VectorSearchResult[FragmentPayload]) []retrievalFieldText {
	if result == nil {
		return nil
	}

	fields := make([]retrievalFieldText, 0, keywordRetrievalPartsCapacity+fieldTokenCapacity)
	appendFieldText(&fields, retrievalFieldTitle, coalesceNonEmpty(result.Payload.SectionTitle, metadataStringValue(result.Payload.Metadata, "section_title")))
	appendFieldText(&fields, retrievalFieldPath, coalesceNonEmpty(result.Payload.SectionPath, metadataStringValue(result.Payload.Metadata, "section_path")))
	appendFieldText(&fields, retrievalFieldDocumentName, result.Payload.DocumentName)
	appendFieldText(&fields, retrievalFieldContent, result.Content)
	appendFieldText(&fields, retrievalFieldTableTitle, metadataStringValue(result.Payload.Metadata, ParsedMetaTableTitle))
	appendFieldList(&fields, retrievalFieldTableKey, metadataStringListValue(result.Payload.Metadata, ParsedMetaPrimaryKeys))
	appendFieldList(&fields, retrievalFieldTableKey, metadataStringListValue(result.Payload.Metadata, ParsedMetaPrimaryKeyHeaders))
	appendFieldList(&fields, retrievalFieldHeader, metadataStringListValue(result.Payload.Metadata, ParsedMetaHeaderPaths))
	return fields
}

// BuildSparseVectorFromFragment 构建客户端 sparse backend 使用的稀疏向量。
func BuildSparseVectorFromFragment(fragment *KnowledgeBaseFragment) *SparseVector {
	return buildSparseVectorFromFragmentWithAnalyzer(fragment, newRetrievalAnalyzer())
}

// BuildSparseVectorFromFragment 使用共享检索分词器构建客户端 sparse backend 使用的稀疏向量。
func (s *Service) BuildSparseVectorFromFragment(fragment *KnowledgeBaseFragment) *SparseVector {
	return buildSparseVectorFromFragmentWithAnalyzer(fragment, s.newRetrievalAnalyzer())
}

func buildSparseVectorFromFragmentWithAnalyzer(
	fragment *KnowledgeBaseFragment,
	analyzer retrievalAnalyzer,
) *SparseVector {
	if fragment == nil {
		return nil
	}
	accumulator := make(map[uint32]float64, keywordRetrievalTextPartCapacity*termCapacityMultiplier)
	for _, fieldText := range fragmentSparseFieldTexts(fragment, analyzer) {
		tokens := analyzer.analyzeText(fieldText.Text, fieldText.Field, false)
		accumulateSparseTokens(accumulator, tokens, true)
	}
	return finalizeSparseVector(accumulator)
}

// BuildSparseVectorFromQuery 构建查询侧 sparse vector。
func BuildSparseVectorFromQuery(query string) *SparseVector {
	return buildSparseVectorFromQueryWithAnalyzer(query, newRetrievalAnalyzer())
}

func buildSparseVectorFromQueryWithAnalyzer(query string, analyzer retrievalAnalyzer) *SparseVector {
	tokens := buildSparseQueryTokens(query, analyzer)
	if len(tokens) == 0 {
		return nil
	}
	accumulator := make(map[uint32]float64, len(tokens))
	accumulateSparseTokens(accumulator, tokens, false)
	return finalizeSparseVector(accumulator)
}

func buildSparseQueryTokens(query string, analyzer retrievalAnalyzer) []AnalyzedToken {
	return analyzer.analyzeText(query, "", true)
}

func fragmentSparseFieldTexts(fragment *KnowledgeBaseFragment, analyzer retrievalAnalyzer) []retrievalFieldText {
	if fragment == nil {
		return nil
	}

	sectionPath, _ := resolveSectionPath(fragment.SectionPath, fragment.Metadata)
	fields := make([]retrievalFieldText, 0, keywordRetrievalTextPartCapacity+fieldTokenCapacity)
	appendFieldText(&fields, retrievalFieldTitle, coalesceNonEmpty(fragment.SectionTitle, metadataStringValue(fragment.Metadata, "section_title")))
	appendFieldText(&fields, retrievalFieldTableTitle, metadataStringValue(fragment.Metadata, ParsedMetaTableTitle))
	appendFieldText(&fields, retrievalFieldPath, trimSectionPathByTokenBudgetWithAnalyzer(strings.TrimSpace(sectionPath), sectionPathTokenBudget, analyzer))
	appendFieldText(&fields, retrievalFieldDocumentName, fragment.DocumentName)
	appendFieldList(&fields, retrievalFieldTableKey, metadataStringListValue(fragment.Metadata, ParsedMetaPrimaryKeys))
	appendFieldList(&fields, retrievalFieldTableKey, metadataStringListValue(fragment.Metadata, ParsedMetaPrimaryKeyHeaders))
	appendFieldList(&fields, retrievalFieldHeader, metadataStringListValue(fragment.Metadata, ParsedMetaHeaderPaths))
	appendFieldText(&fields, retrievalFieldContent, fragment.Content)
	return fields
}

func accumulateSparseTokens(accumulator map[uint32]float64, tokens []AnalyzedToken, useFieldWeights bool) {
	for _, token := range tokens {
		term := strings.TrimSpace(token.Term)
		if term == "" {
			continue
		}
		weight := tokenSourceWeight(token.Source)
		if useFieldWeights {
			weight *= fieldWeight(token.Field)
		}
		if weight <= 0 {
			continue
		}
		accumulator[hashSparseTerm(term)] += weight
	}
}

func finalizeSparseVector(accumulator map[uint32]float64) *SparseVector {
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
	return &SparseVector{
		Indices: indices,
		Values:  values,
	}
}

func fieldWeight(field string) float64 {
	switch strings.TrimSpace(field) {
	case retrievalFieldTitle:
		return titleFieldWeight
	case retrievalFieldTableTitle:
		return tableTitleFieldWeight
	case retrievalFieldPath, retrievalFieldDocumentName, retrievalFieldTableKey, retrievalFieldHeader, retrievalFieldContent:
		return defaultFieldWeight
	default:
		return defaultFieldWeight
	}
}

func tokenSourceWeight(source string) float64 {
	switch strings.TrimSpace(source) {
	case tokenSourceWord:
		return wordTokenWeight
	case tokenSourceAlphaNum:
		return alphaNumTokenWeight
	case tokenSourceBigram:
		return bigramTokenWeight
	case tokenSourceSingleRune:
		return singleRuneTokenWeight
	default:
		return wordTokenWeight
	}
}

func hashSparseTerm(term string) uint32 {
	hasher := fnv.New32a()
	_, _ = hasher.Write([]byte(term))
	return hasher.Sum32()
}

func appendFieldText(fields *[]retrievalFieldText, field, text string) {
	text = strings.TrimSpace(text)
	if text == "" {
		return
	}
	*fields = append(*fields, retrievalFieldText{
		Field: field,
		Text:  text,
	})
}

func appendFieldList(fields *[]retrievalFieldText, field string, values []string) {
	for _, value := range values {
		appendFieldText(fields, field, value)
	}
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

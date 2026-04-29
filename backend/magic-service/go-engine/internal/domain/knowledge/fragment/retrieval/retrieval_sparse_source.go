package retrieval

import (
	"strings"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/shared"
)

const (
	sparseSourceBandContext   = "context"
	sparseSourceBandHighValue = "high_value"
	sparseSourceBandPrimary   = "primary"

	sparseDocumentContextRepeat   = 1
	sparseDocumentHighValueRepeat = 2
	sparseDocumentPrimaryRepeat   = 1

	contextBandWeight   = 1.2
	highValueBandWeight = 1.5
	primaryBandWeight   = 1.0
)

type sparseSource struct {
	ContextText    []retrievalFieldText
	HighValueTerms []retrievalFieldText
	PrimaryText    []retrievalFieldText
}

func buildFragmentSparseSource(fragment *fragmodel.KnowledgeBaseFragment, analyzer retrievalAnalyzer) sparseSource {
	if fragment == nil {
		return sparseSource{}
	}

	source := sparseSource{}
	sectionPath := resolveSectionPath(fragment.SectionPath, fragment.Metadata)
	sectionPath = trimSectionPathByTokenBudgetWithAnalyzer(strings.TrimSpace(sectionPath), sectionPathTokenBudget, analyzer)

	appendSparseSourceText(&source.ContextText, retrievalFieldTitle, coalesceNonEmpty(fragment.SectionTitle, metadataStringValue(fragment.Metadata, "section_title")))
	appendSparseSourceText(&source.ContextText, retrievalFieldPath, sectionPath)
	appendSparseSourceText(&source.ContextText, retrievalFieldDocumentName, fragment.DocumentName)
	appendSparseSourceText(&source.ContextText, retrievalFieldTableTitle, metadataStringValue(fragment.Metadata, ParsedMetaTableTitle))

	appendSparseSourceList(&source.HighValueTerms, retrievalFieldTableKey, metadataStringListValue(fragment.Metadata, ParsedMetaPrimaryKeys))
	appendSparseSourceList(&source.HighValueTerms, retrievalFieldTableKey, metadataStringListValue(fragment.Metadata, ParsedMetaPrimaryKeyHeaders))
	appendSparseSourceList(&source.HighValueTerms, retrievalFieldHeader, metadataStringListValue(fragment.Metadata, ParsedMetaHeaderPaths))

	appendSparseSourceText(&source.PrimaryText, retrievalFieldContent, fragment.Content)
	return source
}

func buildResultSparseSource(result *shared.VectorSearchResult[fragmodel.FragmentPayload]) sparseSource {
	if result == nil {
		return sparseSource{}
	}

	source := sparseSource{}
	appendSparseSourceText(&source.ContextText, retrievalFieldTitle, coalesceNonEmpty(result.Payload.SectionTitle, metadataStringValue(result.Payload.Metadata, "section_title")))
	appendSparseSourceText(&source.ContextText, retrievalFieldPath, coalesceNonEmpty(result.Payload.SectionPath, metadataStringValue(result.Payload.Metadata, "section_path")))
	appendSparseSourceText(&source.ContextText, retrievalFieldDocumentName, result.Payload.DocumentName)
	appendSparseSourceText(&source.ContextText, retrievalFieldTableTitle, metadataStringValue(result.Payload.Metadata, ParsedMetaTableTitle))

	appendSparseSourceList(&source.HighValueTerms, retrievalFieldTableKey, metadataStringListValue(result.Payload.Metadata, ParsedMetaPrimaryKeys))
	appendSparseSourceList(&source.HighValueTerms, retrievalFieldTableKey, metadataStringListValue(result.Payload.Metadata, ParsedMetaPrimaryKeyHeaders))
	appendSparseSourceList(&source.HighValueTerms, retrievalFieldHeader, metadataStringListValue(result.Payload.Metadata, ParsedMetaHeaderPaths))

	appendSparseSourceText(&source.PrimaryText, retrievalFieldContent, result.Content)
	return source
}

func (s sparseSource) fieldTexts() []retrievalFieldText {
	fields := make([]retrievalFieldText, 0, len(s.ContextText)+len(s.HighValueTerms)+len(s.PrimaryText))
	fields = append(fields, s.ContextText...)
	fields = append(fields, s.HighValueTerms...)
	fields = append(fields, s.PrimaryText...)
	return fields
}

func buildManagedSparseDocumentText(source sparseSource, analyzer retrievalAnalyzer) string {
	parts := make([]string, 0, keywordRetrievalTextPartCapacity)
	seen := make(map[string]struct{}, keywordRetrievalSeenCapacity)
	appendManagedSparseFields(&parts, seen, source.ContextText, sparseDocumentContextRepeat, analyzer)
	appendManagedSparseFields(&parts, seen, source.HighValueTerms, sparseDocumentHighValueRepeat, analyzer)
	appendManagedSparseFields(&parts, seen, source.PrimaryText, sparseDocumentPrimaryRepeat, analyzer)
	return normalizeWhitespace(strings.Join(parts, "\n"))
}

func appendManagedSparseFields(
	parts *[]string,
	seen map[string]struct{},
	fields []retrievalFieldText,
	repeat int,
	analyzer retrievalAnalyzer,
) {
	for _, fieldText := range fields {
		appendManagedSparseFieldText(parts, seen, fieldText, repeat, analyzer)
	}
}

func appendManagedSparseFieldText(
	parts *[]string,
	seen map[string]struct{},
	fieldText retrievalFieldText,
	repeat int,
	analyzer retrievalAnalyzer,
) {
	tokenized := normalizeWhitespace(strings.Join(analyzedTokenTerms(analyzer.analyzeSparseText(fieldText.Text, fieldText.Field, false)), " "))
	if tokenized == "" {
		return
	}
	if _, exists := seen[tokenized]; exists {
		return
	}
	seen[tokenized] = struct{}{}
	for range repeat {
		*parts = append(*parts, tokenized)
	}
}

func appendSparseSourceText(fields *[]retrievalFieldText, field, text string) {
	text = strings.TrimSpace(text)
	if text == "" {
		return
	}
	*fields = append(*fields, retrievalFieldText{
		Field: field,
		Text:  text,
	})
}

func appendSparseSourceList(fields *[]retrievalFieldText, field string, values []string) {
	for _, value := range values {
		appendSparseSourceText(fields, field, value)
	}
}

func sparseSourceBand(field string) string {
	switch strings.TrimSpace(field) {
	case retrievalFieldTitle, retrievalFieldPath, retrievalFieldDocumentName, retrievalFieldTableTitle:
		return sparseSourceBandContext
	case retrievalFieldTableKey, retrievalFieldHeader:
		return sparseSourceBandHighValue
	default:
		return sparseSourceBandPrimary
	}
}

func sparseSourceBandWeight(field string) float64 {
	switch sparseSourceBand(field) {
	case sparseSourceBandContext:
		return contextBandWeight
	case sparseSourceBandHighValue:
		return highValueBandWeight
	default:
		return primaryBandWeight
	}
}

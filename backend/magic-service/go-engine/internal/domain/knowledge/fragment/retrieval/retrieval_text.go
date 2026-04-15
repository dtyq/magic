package retrieval

import (
	"regexp"
	"strings"
)

const (
	// RetrievalTextVersionV1 标记检索文本构造版本。
	RetrievalTextVersionV1 = "v1"

	sectionPathTokenBudget        = 96
	keywordRetrievalPartsCapacity = 4
	defaultSectionPathResultLimit = 2

	keywordRetrievalTextPartCapacity = 16
	keywordRetrievalSeenCapacity     = 8
)

var whitespaceRegex = regexp.MustCompile(`\s+`)

type retrievalTextMeta struct {
	SectionPath       string
	SectionTitle      string
	SectionPathSource string
}

func buildRetrievalTextFromFragmentWithAnalyzer(fragment *KnowledgeBaseFragment, analyzer retrievalAnalyzer) (string, retrievalTextMeta) {
	if fragment == nil {
		return "", retrievalTextMeta{SectionPathSource: "none"}
	}
	sectionPath, source := resolveSectionPath(fragment.SectionPath, fragment.Metadata)
	sectionTitle := metadataStringValue(fragment.Metadata, "section_title")
	return buildRetrievalTextWithAnalyzer(sectionPath, sectionTitle, fragment.Content, analyzer), retrievalTextMeta{
		SectionPath:       sectionPath,
		SectionTitle:      sectionTitle,
		SectionPathSource: source,
	}
}

func buildRetrievalTextWithAnalyzer(sectionPath, sectionTitle, content string, analyzer retrievalAnalyzer) string {
	trimmedPath := trimSectionPathByTokenBudgetWithAnalyzer(strings.TrimSpace(sectionPath), sectionPathTokenBudget, analyzer)
	trimmedTitle := strings.TrimSpace(sectionTitle)
	trimmedContent := strings.TrimSpace(content)

	if trimmedPath != "" && trimmedTitle != "" {
		if strings.Contains(trimmedPath, trimmedTitle) {
			trimmedTitle = ""
		}
	}

	parts := make([]string, 0, 3)
	if trimmedPath != "" {
		parts = append(parts, trimmedPath)
	}
	if trimmedTitle != "" {
		parts = append(parts, trimmedTitle)
	}
	if trimmedContent != "" {
		parts = append(parts, trimmedContent)
	}

	joined := strings.Join(parts, "\n")
	return normalizeWhitespace(joined)
}

// BuildKeywordRetrievalTextFromFragment 构建中文优先的 BM25 稀疏检索文本。
func BuildKeywordRetrievalTextFromFragment(fragment *KnowledgeBaseFragment) string {
	return buildKeywordRetrievalTextFromFragmentWithAnalyzer(fragment, newRetrievalAnalyzer())
}

// BuildKeywordRetrievalTextFromFragment 使用共享检索分词器构建中文优先的 BM25 稀疏检索文本。
func (s *Service) BuildKeywordRetrievalTextFromFragment(fragment *KnowledgeBaseFragment) string {
	return buildKeywordRetrievalTextFromFragmentWithAnalyzer(fragment, s.newRetrievalAnalyzer())
}

func buildKeywordRetrievalTextFromFragmentWithAnalyzer(fragment *KnowledgeBaseFragment, analyzer retrievalAnalyzer) string {
	if fragment == nil {
		return ""
	}

	sectionPath, _ := resolveSectionPath(fragment.SectionPath, fragment.Metadata)
	sectionPath = trimSectionPathByTokenBudgetWithAnalyzer(strings.TrimSpace(sectionPath), sectionPathTokenBudget, analyzer)
	sectionTitle := coalesceNonEmpty(fragment.SectionTitle, metadataStringValue(fragment.Metadata, "section_title"))
	documentName := strings.TrimSpace(fragment.DocumentName)
	tableTitle := strings.TrimSpace(metadataStringValue(fragment.Metadata, ParsedMetaTableTitle))
	content := strings.TrimSpace(fragment.Content)
	primaryKeys := metadataStringListValue(fragment.Metadata, ParsedMetaPrimaryKeys)
	primaryKeyHeaders := metadataStringListValue(fragment.Metadata, ParsedMetaPrimaryKeyHeaders)
	headerPaths := metadataStringListValue(fragment.Metadata, ParsedMetaHeaderPaths)

	parts := make([]string, 0, keywordRetrievalTextPartCapacity)
	seen := make(map[string]struct{}, keywordRetrievalSeenCapacity)
	appendKeywordTextRepeat(&parts, seen, sectionTitle, 2)
	appendKeywordTextRepeat(&parts, seen, tableTitle, 2)
	appendKeywordTextRepeat(&parts, seen, sectionPath, 1)
	appendKeywordTextRepeat(&parts, seen, documentName, 1)
	appendKeywordTextValues(&parts, seen, primaryKeys)
	appendKeywordTextValues(&parts, seen, primaryKeyHeaders)
	appendKeywordTextValues(&parts, seen, headerPaths)
	appendKeywordTextRepeat(&parts, seen, content, 1)

	return normalizeWhitespace(strings.Join(parts, "\n"))
}

// DefaultSparseDocumentForText 构造默认的 Qdrant BM25 稀疏文本。
func DefaultSparseDocumentForText(text string) *SparseDocument {
	normalized := normalizeWhitespace(text)
	if normalized == "" {
		return nil
	}
	return &SparseDocument{
		Text:  normalized,
		Model: DefaultSparseModelName,
		Options: map[string]any{
			"language":      "none",
			"tokenizer":     "multilingual",
			"ascii_folding": true,
		},
	}
}

// BuildSparseInputFromFragment 根据 sparse backend 构造片段写入所需的 sparse 输入。
func BuildSparseInputFromFragment(fragment *KnowledgeBaseFragment, sparseBackend string) *SparseInput {
	return buildSparseInputFromFragmentWithAnalyzer(fragment, sparseBackend, newRetrievalAnalyzer())
}

// BuildSparseInputFromFragment 使用共享检索分词器构造片段写入所需的 sparse 输入。
func (s *Service) BuildSparseInputFromFragment(fragment *KnowledgeBaseFragment, sparseBackend string) *SparseInput {
	return buildSparseInputFromFragmentWithAnalyzer(fragment, sparseBackend, s.newRetrievalAnalyzer())
}

func buildSparseInputFromFragmentWithAnalyzer(
	fragment *KnowledgeBaseFragment,
	sparseBackend string,
	analyzer retrievalAnalyzer,
) *SparseInput {
	switch NormalizeSparseBackend(sparseBackend) {
	case SparseBackendQdrantBM25ZHV1:
		document := DefaultSparseDocumentForText(buildKeywordRetrievalTextFromFragmentWithAnalyzer(fragment, analyzer))
		if document == nil {
			return nil
		}
		return &SparseInput{Document: document}
	case SparseBackendClientBM25QdrantIDFV1:
		vector := buildSparseVectorFromFragmentWithAnalyzer(fragment, analyzer)
		if vector == nil {
			return nil
		}
		return &SparseInput{Vector: vector}
	default:
		return nil
	}
}

func appendKeywordTextRepeat(parts *[]string, seen map[string]struct{}, text string, repeat int) {
	normalized := normalizeWhitespace(text)
	if normalized == "" || repeat <= 0 {
		return
	}
	if _, exists := seen[normalized]; exists {
		return
	}
	seen[normalized] = struct{}{}
	for range repeat {
		*parts = append(*parts, normalized)
	}
}

func appendKeywordTextValues(parts *[]string, seen map[string]struct{}, values []string) {
	for _, value := range values {
		appendKeywordTextRepeat(parts, seen, value, 1)
	}
}

func resolveSectionPath(entityPath string, metadata map[string]any) (string, string) {
	if path := strings.TrimSpace(entityPath); path != "" {
		return path, "entity"
	}
	if fallback := strings.TrimSpace(metadataStringValue(metadata, "section_path")); fallback != "" {
		return fallback, "metadata_fallback"
	}
	return "", "none"
}

func trimSectionPathByTokenBudgetWithAnalyzer(path string, budget int, analyzer retrievalAnalyzer) string {
	if path == "" || budget <= 0 {
		return path
	}
	if len(analyzer.tokenTerms(path)) <= budget {
		return path
	}

	parts := strings.Split(path, ">")
	trimmed := make([]string, 0, len(parts))
	for _, part := range parts {
		value := strings.TrimSpace(part)
		if value != "" {
			trimmed = append(trimmed, value)
		}
	}
	if len(trimmed) == 0 {
		return path
	}

	selected := make([]string, 0, len(trimmed))
	for i := len(trimmed) - 1; i >= 0; i-- {
		candidate := append([]string{trimmed[i]}, selected...)
		joined := strings.Join(candidate, " > ")
		if len(analyzer.tokenTerms(joined)) > budget {
			break
		}
		selected = candidate
	}
	if len(selected) == 0 {
		return trimmed[len(trimmed)-1]
	}
	return strings.Join(selected, " > ")
}

func normalizeWhitespace(text string) string {
	normalized := strings.TrimSpace(text)
	if normalized == "" {
		return ""
	}
	return whitespaceRegex.ReplaceAllString(normalized, " ")
}

func metadataStringValue(metadata map[string]any, key string) string {
	if len(metadata) == 0 {
		return ""
	}
	if value, ok := metadataStringFromMap(metadata, key); ok {
		return value
	}
	if ext, ok := metadata["ext"].(map[string]any); ok {
		if value, ok := metadataStringFromMap(ext, key); ok {
			return value
		}
	}
	return ""
}

func metadataStringFromMap(metadata map[string]any, key string) (string, bool) {
	if len(metadata) == 0 {
		return "", false
	}
	raw, ok := metadata[key]
	if !ok || raw == nil {
		return "", false
	}
	value, ok := raw.(string)
	if !ok {
		return "", false
	}
	trimmed := strings.TrimSpace(value)
	return trimmed, trimmed != ""
}

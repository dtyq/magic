package retrieval

import (
	"regexp"
	"strings"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/shared"
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

func buildRetrievalTextFromFragmentWithAnalyzer(fragment *fragmodel.KnowledgeBaseFragment, analyzer retrievalAnalyzer) string {
	if fragment == nil {
		return ""
	}
	sectionPath := resolveSectionPath(fragment.SectionPath, fragment.Metadata)
	sectionTitle := metadataStringValue(fragment.Metadata, "section_title")
	return buildRetrievalTextWithAnalyzer(sectionPath, sectionTitle, fragment.Content, analyzer)
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
func BuildKeywordRetrievalTextFromFragment(fragment *fragmodel.KnowledgeBaseFragment) string {
	return buildKeywordRetrievalTextFromFragmentWithAnalyzer(fragment, newRetrievalAnalyzer())
}

// BuildKeywordRetrievalTextFromFragment 使用共享检索分词器构建中文优先的 BM25 稀疏检索文本。
func (s *Service) BuildKeywordRetrievalTextFromFragment(fragment *fragmodel.KnowledgeBaseFragment) string {
	return buildKeywordRetrievalTextFromFragmentWithAnalyzer(fragment, s.newRetrievalAnalyzer())
}

func buildKeywordRetrievalTextFromFragmentWithAnalyzer(fragment *fragmodel.KnowledgeBaseFragment, analyzer retrievalAnalyzer) string {
	return buildManagedSparseDocumentText(buildFragmentSparseSource(fragment, analyzer), analyzer)
}

// DefaultSparseDocumentForText 构造交给 Qdrant 原生 BM25 inference 的稀疏文本。
//
// 注意：这里使用的是 Qdrant `qdrant/bm25` + multilingual tokenizer，不是本地 gse 分词链路。
func DefaultSparseDocumentForText(text string) *shared.SparseDocument {
	normalized := normalizeWhitespace(text)
	if normalized == "" {
		return nil
	}
	return &shared.SparseDocument{
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
func BuildSparseInputFromFragment(fragment *fragmodel.KnowledgeBaseFragment, sparseBackend string) *shared.SparseInput {
	return buildSparseInputFromFragmentWithAnalyzer(fragment, sparseBackend, newRetrievalAnalyzer())
}

// BuildSparseInputFromFragment 使用共享检索分词器构造片段写入所需的 sparse 输入。
func (s *Service) BuildSparseInputFromFragment(fragment *fragmodel.KnowledgeBaseFragment, sparseBackend string) *shared.SparseInput {
	return buildSparseInputFromFragmentWithAnalyzer(fragment, sparseBackend, s.newRetrievalAnalyzer())
}

func buildSparseInputFromFragmentWithAnalyzer(
	fragment *fragmodel.KnowledgeBaseFragment,
	sparseBackend string,
	analyzer retrievalAnalyzer,
) *shared.SparseInput {
	switch NormalizeSparseBackend(sparseBackend) {
	case SparseBackendQdrantBM25ZHV1:
		document := DefaultSparseDocumentForText(buildKeywordRetrievalTextFromFragmentWithAnalyzer(fragment, analyzer))
		if document == nil {
			return nil
		}
		return &shared.SparseInput{Document: document}
	case SparseBackendClientBM25QdrantIDFV1:
		vector := buildSparseVectorFromFragmentWithAnalyzer(fragment, analyzer)
		if vector == nil {
			return nil
		}
		return &shared.SparseInput{Vector: vector}
	default:
		return nil
	}
}

func resolveSectionPath(entityPath string, metadata map[string]any) string {
	if path := strings.TrimSpace(entityPath); path != "" {
		return path
	}
	if fallback := strings.TrimSpace(metadataStringValue(metadata, "section_path")); fallback != "" {
		return fallback
	}
	return ""
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

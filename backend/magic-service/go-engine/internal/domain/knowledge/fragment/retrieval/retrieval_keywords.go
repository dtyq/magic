package retrieval

import "magic/internal/domain/knowledge/shared"

// BuildKeywordSparseDocumentForQuery 构建 query 侧 managed BM25 使用的稀疏文本。
func BuildKeywordSparseDocumentForQuery(query string) *shared.SparseDocument {
	return buildKeywordSparseDocumentForQueryWithAnalyzer(query, newRetrievalAnalyzer())
}

// BuildKeywordSparseDocumentForQuery 使用共享检索分词器构建 query 侧 managed BM25 使用的稀疏文本。
func (s *Service) BuildKeywordSparseDocumentForQuery(query string) *shared.SparseDocument {
	return buildKeywordSparseDocumentForQueryWithAnalyzer(query, s.newRetrievalAnalyzer())
}

func buildKeywordSparseDocumentForQueryWithAnalyzer(query string, analyzer retrievalAnalyzer) *shared.SparseDocument {
	profile := buildSimilarityQueryProfile(query, "", analyzer)
	if profile.SparseQueryText == "" {
		return nil
	}
	return DefaultSparseDocumentForText(profile.SparseQueryText)
}

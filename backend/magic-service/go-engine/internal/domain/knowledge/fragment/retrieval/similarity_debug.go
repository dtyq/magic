package retrieval

import (
	"slices"
	"strings"
)

func buildBM25QueryObservation(
	profile similarityQueryProfile,
	sparseBackend string,
	analyzer retrievalAnalyzer,
) BM25Query {
	return BM25Query{
		Backend:         resolveBM25QueryBackend(sparseBackend),
		RawQuery:        strings.TrimSpace(profile.RawQuery),
		QueryType:       strings.TrimSpace(profile.QueryType),
		SparseQueryText: strings.TrimSpace(profile.SparseQueryText),
		CleanedTerms:    cloneStringList(analyzer.retrievalTerms(profile.RawQuery)),
		AlphaNumTerms:   cloneStringList(profile.AlphaNumTerms),
		KeywordTerms:    cloneStringList(profile.KeywordTerms),
		Terms:           buildBM25QueryTerms(profile, analyzer),
	}
}

func buildBM25QueryTerms(profile similarityQueryProfile, analyzer retrievalAnalyzer) []string {
	return cloneStringList(uniqueNonEmptyStrings(analyzedTokenTerms(buildSparseQueryTokens(profile, analyzer))...))
}

func cloneStringList(values []string) []string {
	if len(values) == 0 {
		return []string{}
	}
	return slices.Clone(values)
}

func resolveBM25QueryBackend(backend string) string {
	if normalized := NormalizeSparseBackend(backend); normalized != "" {
		return normalized
	}
	return strings.TrimSpace(backend)
}

func (s *Service) buildTokenPolicyDebug(query string) map[string]any {
	analyzer := s.newRetrievalAnalyzer()
	return map[string]any{
		"raw_query_tokens":         analyzer.tokenTerms(query),
		"retrieval_tokens":         analyzer.retrievalTerms(query),
		"stopword_count":           len(analyzer.policy.stopwords),
		"dict_source":              "bundled",
		"has_custom_terms":         analyzer.policy.customTermsPath != "",
		"has_retrieval_stopwords":  analyzer.policy.retrievalStopwords != "" || len(analyzer.policy.stopwords) > 0,
		"has_upstream_stop_word":   analyzer.policy.upstreamStopWordPath != "",
		"has_upstream_stop_tokens": analyzer.policy.upstreamStopTokensPath != "",
		"has_idf":                  analyzer.policy.idfPath != "",
		"has_tf_idf":               analyzer.policy.tfIDFPath != "",
		"has_tf_idf_origin":        analyzer.policy.tfIDFOriginPath != "",
	}
}

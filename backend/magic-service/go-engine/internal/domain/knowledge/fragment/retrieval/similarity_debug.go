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
	debug := map[string]any{
		"raw_query_tokens":     analyzer.tokenTerms(query),
		"retrieval_tokens":     analyzer.retrievalTerms(query),
		"retrieval_stopwords":  analyzer.policy.retrievalStopwords,
		"custom_terms":         analyzer.policy.customTermsPath,
		"bundled_dict_dir":     analyzer.policy.dictDir,
		"stopword_count":       len(analyzer.policy.stopwords),
		"upstream_stop_word":   analyzer.policy.upstreamStopWordPath,
		"upstream_stop_tokens": analyzer.policy.upstreamStopTokensPath,
	}
	if analyzer.policy.idfPath != "" {
		debug["idf"] = analyzer.policy.idfPath
	}
	if analyzer.policy.tfIDFPath != "" {
		debug["tf_idf"] = analyzer.policy.tfIDFPath
	}
	if analyzer.policy.tfIDFOriginPath != "" {
		debug["tf_idf_origin"] = analyzer.policy.tfIDFOriginPath
	}
	return debug
}

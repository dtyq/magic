package retrieval

import (
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	queryTypeShortKeyword    = "short_keyword"
	queryTypeMixedCodeNL     = "mixed_code_nl"
	queryTypeNaturalLanguage = "natural_language"
)

type similarityQueryProfile struct {
	RawQuery           string
	NormalizedRawQuery string
	DenseQuery         string
	SparseQueryText    string
	QueryType          string
	AlphaNumTerms      []string
	KeywordTerms       []string
	SparseTokens       []AnalyzedToken
}

func buildSimilarityQueryProfile(
	query string,
	denseQueryOverride string,
	analyzer retrievalAnalyzer,
) similarityQueryProfile {
	rawQuery := strings.TrimSpace(query)
	if rawQuery == "" {
		rawQuery = strings.TrimSpace(denseQueryOverride)
	}

	denseSource := strings.TrimSpace(denseQueryOverride)
	if denseSource == "" {
		denseSource = rawQuery
	}

	profile := similarityQueryProfile{
		RawQuery:           rawQuery,
		NormalizedRawQuery: normalizeDenseSimilarityQuery(rawQuery),
		DenseQuery:         normalizeDenseSimilarityQuery(denseSource),
	}
	profile.SparseTokens = buildSparseQueryTokensForProfile(profile.RawQuery, analyzer)
	profile.SparseQueryText = buildSparseQueryText(profile.SparseTokens)
	profile.QueryType = classifySimilarityQueryType(profile.NormalizedRawQuery, analyzer)
	return profile
}

func normalizeDenseSimilarityQuery(query string) string {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return ""
	}

	normalized := strings.NewReplacer(
		"，", ",",
		"。", ".",
		"：", ":",
		"；", ";",
		"（", "(",
		"）", ")",
		"【", "[",
		"】", "]",
		"“", "\"",
		"”", "\"",
		"‘", "'",
		"’", "'",
		"　", " ",
	).Replace(trimmed)
	return normalizeWhitespace(normalized)
}

func buildSparseQueryTokensForProfile(query string, analyzer retrievalAnalyzer) []AnalyzedToken {
	return analyzer.analyzeSparseText(query, "", true)
}

func buildSparseQueryText(tokens []AnalyzedToken) string {
	return normalizeWhitespace(strings.Join(analyzedTokenTerms(tokens), " "))
}

func classifySimilarityQueryType(query string, analyzer retrievalAnalyzer) string {
	normalized := normalizeRetrievalText(query)
	if normalized == "" {
		return queryTypeNaturalLanguage
	}

	uniqueTokens := uniqueNonEmptyStrings(analyzer.retrievalTerms(normalized)...)
	if isMixedCodeNLQuery(normalized) {
		return queryTypeMixedCodeNL
	}
	if isShortKeywordQuery(normalized, uniqueTokens) {
		return queryTypeShortKeyword
	}
	return queryTypeNaturalLanguage
}

func isShortKeywordQuery(normalized string, uniqueTokens []string) bool {
	if normalized == "" {
		return false
	}
	runeCount := utf8.RuneCountInString(normalized)
	if runeCount <= shortQueryMaxRuneCount {
		return true
	}
	if strings.ContainsAny(normalized, "?？!！。；;,:，：\n") {
		return false
	}
	switch {
	case len(uniqueTokens) <= 1:
		return true
	case len(uniqueTokens) <= 2 && runeCount <= 16:
		return true
	case len(uniqueTokens) <= 3 && runeCount <= 16 && !strings.ContainsAny(normalized, " ?？"):
		return true
	default:
		return false
	}
}

func isMixedCodeNLQuery(normalized string) bool {
	hasHan := false
	hasAlphaNum := false
	for _, r := range normalized {
		switch {
		case unicode.Is(unicode.Han, r):
			hasHan = true
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			hasAlphaNum = true
		}
	}
	return hasHan && hasAlphaNum
}

package retrieval

import (
	"slices"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	tokenBufferCapacity = 16

	retrievalFieldTitle        = "title"
	retrievalFieldPath         = "path"
	retrievalFieldDocumentName = "document_name"
	retrievalFieldContent      = "content"
	retrievalFieldTableTitle   = "table_title"
	retrievalFieldTableKey     = "table_key"
	retrievalFieldHeader       = "header"

	tokenSourceWord               = "word"
	tokenSourceBigram             = "bigram"
	tokenSourceAlphaNum           = "alphanum"
	tokenSourceSingleRune         = "single_rune"
	fullWidthASCIIOffset          = 0xFEE0
	hanFallbackFullThreshold      = 0.55
	hanFallbackSelectiveThreshold = 0.80
	hanBigramStopRunes            = "的了和是在与及并对将把被给让也又还就很"
)

type hanFallbackMode uint8

const (
	hanFallbackModeNone hanFallbackMode = iota
	hanFallbackModeSelective
	hanFallbackModeFull
)

// AnalyzedToken 表示检索 analyzer 产出的单个 token。
type AnalyzedToken struct {
	Term       string
	Field      string
	Source     string
	IsFallback bool
}

type retrievalAnalyzer struct {
	segmenter segmentedWordCutter
}

type segmentedWordCutter interface {
	CutSearch(text string, searchMode ...bool) []string
}

// AnalyzeForIndex 对索引侧文本做分析，保留字段信息。
func AnalyzeForIndex(text, field string) []AnalyzedToken {
	return newRetrievalAnalyzer().analyzeText(text, strings.TrimSpace(field), false)
}

// AnalyzeForIndex 使用共享检索分词器对索引侧文本做分析。
func (s *Service) AnalyzeForIndex(text, field string) []AnalyzedToken {
	return s.newRetrievalAnalyzer().analyzeText(text, strings.TrimSpace(field), false)
}

// AnalyzeForQuery 对查询侧文本做分析，不绑定字段。
func AnalyzeForQuery(text string) []AnalyzedToken {
	return newRetrievalAnalyzer().analyzeText(text, "", true)
}

// AnalyzeForQuery 使用共享检索分词器对查询文本做分析。
func (s *Service) AnalyzeForQuery(text string) []AnalyzedToken {
	return s.newRetrievalAnalyzer().analyzeText(text, "", true)
}

func tokenizeForRetrieval(text string) []string {
	return newRetrievalAnalyzer().tokenTerms(text)
}

func newRetrievalAnalyzer() retrievalAnalyzer {
	// 包级 analyzer 也必须走默认 singleton；否则 AnalyzeForIndex/Query 这类 helper 会绕开共享 provider。
	segmenter, err := newDefaultRetrievalSegmenterProvider().cutter()
	if err != nil {
		return retrievalAnalyzer{}
	}
	return retrievalAnalyzer{segmenter: segmenter}
}

func (a retrievalAnalyzer) analyzeText(text, field string, queryMode bool) []AnalyzedToken {
	normalized := normalizeRetrievalText(text)
	if normalized == "" {
		return nil
	}

	tokens := make([]AnalyzedToken, 0, len(normalized)/2)
	asciiBuffer := make([]rune, 0, tokenBufferCapacity)
	hanBuffer := make([]rune, 0, tokenBufferCapacity)
	hanCount := 0

	flushASCII := func() {
		if len(asciiBuffer) == 0 {
			return
		}
		tokens = append(tokens, analyzeASCIIBuffer(asciiBuffer, field)...)
		asciiBuffer = asciiBuffer[:0]
	}
	flushHan := func() {
		if len(hanBuffer) == 0 {
			return
		}
		tokens = append(tokens, a.analyzeHanBuffer(hanBuffer, field, queryMode)...)
		hanCount += len(hanBuffer)
		hanBuffer = hanBuffer[:0]
	}

	for _, r := range normalized {
		switch {
		case unicode.Is(unicode.Han, r):
			flushASCII()
			hanBuffer = append(hanBuffer, r)
		case isASCIIWordRune(r):
			flushHan()
			asciiBuffer = append(asciiBuffer, r)
		default:
			flushASCII()
			flushHan()
		}
	}
	flushASCII()
	flushHan()

	if queryMode && len(tokens) == 0 && hanCount == 1 {
		if r, _ := utf8.DecodeRuneInString(normalized); unicode.Is(unicode.Han, r) {
			tokens = append(tokens, AnalyzedToken{
				Term:   string(r),
				Field:  field,
				Source: tokenSourceSingleRune,
			})
		}
	}

	return compactAnalyzedTokens(tokens)
}

func analyzeASCIIBuffer(buffer []rune, field string) []AnalyzedToken {
	if strings.Trim(bufferToLowerString(buffer), "_-") == "" {
		return nil
	}

	terms := expandASCIIWordTerms(string(buffer))
	if len(terms) == 0 {
		return nil
	}

	tokens := make([]AnalyzedToken, 0, len(terms))
	for _, term := range terms {
		tokens = append(tokens, AnalyzedToken{
			Term:   term,
			Field:  field,
			Source: tokenSourceAlphaNum,
		})
	}
	return tokens
}

func (a retrievalAnalyzer) analyzeHanBuffer(buffer []rune, field string, queryMode bool) []AnalyzedToken {
	if len(buffer) == 0 {
		return nil
	}

	text := string(buffer)
	return buildHanTokens(text, field, a.segmentHanWords(text), queryMode)
}

func buildHanTokens(text, field string, primaryTerms []string, queryMode bool) []AnalyzedToken {
	if text == "" {
		return nil
	}

	textRunes := []rune(text)
	tokens := make([]AnalyzedToken, 0, len(textRunes)*2)
	primaryTermSet := make(map[string]struct{}, len(primaryTerms))
	for _, word := range primaryTerms {
		normalizedWord := normalizeTokenTerm(word)
		if normalizedWord == "" {
			continue
		}
		primaryTermSet[normalizedWord] = struct{}{}
		tokens = append(tokens, AnalyzedToken{
			Term:   normalizedWord,
			Field:  field,
			Source: tokenSourceWord,
		})
	}

	if len(textRunes) < 2 {
		return tokens
	}

	mode, coveredPositions, _ := resolveHanFallbackMode(text, primaryTerms, queryMode)
	if mode == hanFallbackModeNone {
		return tokens
	}

	for i := range len(textRunes) - 1 {
		bigramRunes := textRunes[i : i+2]
		bigram := string(bigramRunes)
		if _, ok := primaryTermSet[bigram]; ok {
			continue
		}
		if mode == hanFallbackModeSelective {
			if !hasUncoveredRune(coveredPositions, i, i+2) {
				continue
			}
			if containsHanStopRune(bigramRunes) {
				continue
			}
		}
		tokens = append(tokens, AnalyzedToken{
			Term:       bigram,
			Field:      field,
			Source:     tokenSourceBigram,
			IsFallback: true,
		})
	}

	return tokens
}

func resolveHanFallbackMode(text string, primaryTerms []string, queryMode bool) (hanFallbackMode, []bool, float64) {
	text = normalizeTokenTerm(text)
	textRunes := []rune(text)
	covered := make([]bool, len(textRunes))
	if len(textRunes) == 0 {
		return hanFallbackModeNone, covered, 0
	}
	if queryMode {
		return hanFallbackModeFull, covered, 0
	}
	if len(primaryTerms) == 0 {
		return hanFallbackModeFull, covered, 0
	}

	covered = markCoveredHanPositions(textRunes, primaryTerms)
	coverage := calculateCoveredRatio(covered)
	switch {
	case coverage < hanFallbackFullThreshold:
		return hanFallbackModeFull, covered, coverage
	case coverage < hanFallbackSelectiveThreshold:
		return hanFallbackModeSelective, covered, coverage
	default:
		return hanFallbackModeNone, covered, coverage
	}
}

func markCoveredHanPositions(textRunes []rune, primaryTerms []string) []bool {
	covered := make([]bool, len(textRunes))
	if len(textRunes) == 0 || len(primaryTerms) == 0 {
		return covered
	}

	normalizedTerms := make([][]rune, 0, len(primaryTerms))
	for _, term := range primaryTerms {
		normalizedTerm := normalizeTokenTerm(term)
		if normalizedTerm == "" {
			continue
		}
		termRunes := []rune(normalizedTerm)
		if len(termRunes) == 0 || len(termRunes) > len(textRunes) {
			continue
		}
		normalizedTerms = append(normalizedTerms, termRunes)
	}

	for start := range textRunes {
		for _, termRunes := range normalizedTerms {
			end := start + len(termRunes)
			if end > len(textRunes) {
				continue
			}
			if !slices.Equal(textRunes[start:end], termRunes) {
				continue
			}
			for idx := start; idx < end; idx++ {
				covered[idx] = true
			}
		}
	}

	return covered
}

func calculateCoveredRatio(covered []bool) float64 {
	if len(covered) == 0 {
		return 0
	}

	coveredCount := 0
	for _, value := range covered {
		if value {
			coveredCount++
		}
	}
	return float64(coveredCount) / float64(len(covered))
}

func hasUncoveredRune(covered []bool, start, end int) bool {
	if start < 0 {
		start = 0
	}
	if end > len(covered) {
		end = len(covered)
	}
	for _, value := range covered[start:end] {
		if !value {
			return true
		}
	}
	return false
}

func containsHanStopRune(runes []rune) bool {
	for _, r := range runes {
		if strings.ContainsRune(hanBigramStopRunes, r) {
			return true
		}
	}
	return false
}

func (a retrievalAnalyzer) segmentHanWords(text string) []string {
	if a.segmenter == nil {
		return nil
	}

	cut := a.segmenter.CutSearch(text, true)
	if len(cut) == 0 {
		return nil
	}

	normalizedText := normalizeTokenTerm(text)
	words := make([]string, 0, len(cut))
	for _, word := range cut {
		term := normalizeTokenTerm(word)
		if utf8.RuneCountInString(term) < 2 {
			continue
		}
		if !isAllHan(term) {
			continue
		}
		if term == normalizedText && len(cut) > 1 {
			continue
		}
		words = append(words, term)
	}
	return words
}

func normalizeRetrievalText(text string) string {
	if strings.TrimSpace(text) == "" {
		return ""
	}

	var builder strings.Builder
	builder.Grow(len(text))
	lastSpace := false
	for _, r := range text {
		r = foldWidthRune(r)
		switch {
		case unicode.IsSpace(r):
			if lastSpace {
				continue
			}
			builder.WriteByte(' ')
			lastSpace = true
		default:
			builder.WriteRune(r)
			lastSpace = false
		}
	}
	return strings.TrimSpace(builder.String())
}

func foldWidthRune(r rune) rune {
	switch {
	case r == '\u3000':
		return ' '
	case r >= '\uFF01' && r <= '\uFF5E':
		return r - fullWidthASCIIOffset
	default:
		return r
	}
}

func isASCIIWordRune(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' || r == '-'
}

func expandASCIIWordTerms(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}

	normalized := normalizeTokenTerm(raw)
	if normalized == "" {
		return nil
	}

	terms := []string{normalized}
	for _, part := range splitASCIIComponents(raw) {
		term := normalizeTokenTerm(part)
		if term == "" {
			continue
		}
		terms = append(terms, term)
	}
	return uniqueNonEmptyStrings(terms...)
}

func splitASCIIComponents(raw string) []string {
	runes := []rune(raw)
	if len(runes) == 0 {
		return nil
	}

	components := make([]string, 0, len(runes))
	start := 0
	flush := func(end int) {
		if end <= start {
			return
		}
		part := strings.Trim(string(runes[start:end]), "_-")
		if part != "" {
			components = append(components, part)
		}
		start = end
	}

	for i := 1; i < len(runes); i++ {
		prev := runes[i-1]
		curr := runes[i]
		next := rune(0)
		if i+1 < len(runes) {
			next = runes[i+1]
		}

		switch {
		case prev == '_' || prev == '-':
			flush(i - 1)
			start = i
		case curr == '_' || curr == '-':
			flush(i)
			start = i + 1
		case unicode.IsLower(prev) && unicode.IsUpper(curr):
			flush(i)
		case unicode.IsUpper(prev) && unicode.IsUpper(curr) && unicode.IsLower(next):
			flush(i)
		case unicode.IsLetter(prev) && unicode.IsDigit(curr):
			flush(i)
		case unicode.IsDigit(prev) && unicode.IsLetter(curr):
			flush(i)
		}
	}
	flush(len(runes))
	return components
}

func bufferToLowerString(buffer []rune) string {
	if len(buffer) == 0 {
		return ""
	}
	normalized := make([]rune, 0, len(buffer))
	for _, r := range buffer {
		normalized = append(normalized, unicode.ToLower(foldWidthRune(r)))
	}
	return string(normalized)
}

func normalizeTokenTerm(term string) string {
	trimmed := strings.TrimSpace(term)
	if trimmed == "" {
		return ""
	}
	if !tokenTermNeedsNormalization(trimmed) {
		return trimTokenEdgeDelimiters(trimmed)
	}

	var builder strings.Builder
	builder.Grow(len(trimmed))
	for _, r := range trimmed {
		r = unicode.ToLower(foldWidthRune(r))
		if unicode.IsSpace(r) {
			continue
		}
		builder.WriteRune(r)
	}
	return trimTokenEdgeDelimiters(builder.String())
}

func compactAnalyzedTokens(tokens []AnalyzedToken) []AnalyzedToken {
	if len(tokens) == 0 {
		return nil
	}

	result := make([]AnalyzedToken, 0, len(tokens))
	for _, token := range tokens {
		token.Term = normalizeTokenTerm(token.Term)
		if token.Term == "" {
			continue
		}
		result = append(result, token)
	}
	return result
}

func (a retrievalAnalyzer) tokenTerms(text string) []string {
	return analyzedTokenTerms(a.analyzeText(text, "", true))
}

func analyzedTokenTerms(tokens []AnalyzedToken) []string {
	if len(tokens) == 0 {
		return nil
	}
	result := make([]string, 0, len(tokens))
	for _, token := range tokens {
		if term := strings.TrimSpace(token.Term); term != "" {
			result = append(result, term)
		}
	}
	return result
}

func tokenTermNeedsNormalization(term string) bool {
	for _, r := range term {
		switch {
		case unicode.IsSpace(r):
			return true
		case r == '\u3000':
			return true
		case r >= '\uFF01' && r <= '\uFF5E':
			return true
		case unicode.IsUpper(r):
			return true
		}
	}
	return false
}

func trimTokenEdgeDelimiters(term string) string {
	start := 0
	end := len(term)
	for start < end {
		switch term[start] {
		case '_', '-':
			start++
		default:
			goto trimTail
		}
	}
trimTail:
	for start < end {
		switch term[end-1] {
		case '_', '-':
			end--
		default:
			return term[start:end]
		}
	}
	return ""
}

func isAllHan(text string) bool {
	if text == "" {
		return false
	}
	for _, r := range text {
		if !unicode.Is(unicode.Han, r) {
			return false
		}
	}
	return true
}

func uniqueNonEmptyStrings(values ...string) []string {
	if len(values) == 0 {
		return nil
	}
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}

func uniqueInts(values ...int) []int {
	if len(values) == 0 {
		return nil
	}
	result := make([]int, 0, len(values))
	seen := make(map[int]struct{}, len(values))
	for _, value := range values {
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	slices.Sort(result)
	return result
}

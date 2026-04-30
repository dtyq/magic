package retrieval

import (
	"errors"
	"fmt"
	"slices"
	"strings"
	"unicode"
)

const (
	retrievalFieldTitle        = "title"
	retrievalFieldPath         = "path"
	retrievalFieldDocumentName = "document_name"
	retrievalFieldContent      = "content"
	retrievalFieldTableTitle   = "table_title"
	retrievalFieldTableKey     = "table_key"
	retrievalFieldHeader       = "header"

	tokenSourceWord        = "word"
	retrievalSelfCheckText = "退款的流程"
	fullWidthASCIIOffset   = 0xFEE0
)

const (
	errRetrievalAnalyzerSelfCheckNoTokens = runtimeStaticError("retrieval analyzer produced no tokens for self-check text")
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
	policy    retrievalTokenPolicy
	err       error
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

func newRetrievalAnalyzer() retrievalAnalyzer {
	// 包级 analyzer 也必须走默认 singleton；否则 AnalyzeForIndex/Query 这类 helper 会绕开共享 provider。
	segmenter, err := newDefaultRetrievalSegmenterProvider().cutter()
	policy, policyErr := defaultRetrievalTokenPolicyProvider.get()
	return newRetrievalAnalyzerFromParts(segmenter, err, policy, policyErr)
}

func newRetrievalAnalyzerFromParts(
	segmenter segmentedWordCutter,
	segmenterErr error,
	policy retrievalTokenPolicy,
	policyErr error,
) retrievalAnalyzer {
	switch {
	case segmenterErr == nil && policyErr == nil:
		return retrievalAnalyzer{
			segmenter: segmenter,
			policy:    policy,
		}
	case segmenterErr != nil && policyErr != nil:
		return retrievalAnalyzer{
			err: errors.Join(
				fmt.Errorf("load retrieval segmenter: %w", segmenterErr),
				fmt.Errorf("load retrieval token policy: %w", policyErr),
			),
		}
	case segmenterErr != nil:
		return retrievalAnalyzer{
			policy: policy,
			err:    fmt.Errorf("load retrieval segmenter: %w", segmenterErr),
		}
	default:
		return retrievalAnalyzer{
			segmenter: segmenter,
			err:       fmt.Errorf("load retrieval token policy: %w", policyErr),
		}
	}
}

func (a retrievalAnalyzer) ready() error {
	return a.err
}

func (a retrievalAnalyzer) selfCheck() error {
	if err := a.ready(); err != nil {
		return err
	}
	tokens := a.retrievalTerms(retrievalSelfCheckText)
	if len(tokens) == 0 {
		return errRetrievalAnalyzerSelfCheckNoTokens
	}
	return nil
}

func (a retrievalAnalyzer) analyzeText(text, field string, queryMode bool) []AnalyzedToken {
	_ = queryMode

	normalized := normalizeRetrievalText(text)
	if normalized == "" || a.segmenter == nil {
		return nil
	}

	segments := a.segmenter.CutSearch(normalized, true)
	if len(segments) == 0 {
		return nil
	}

	tokens := make([]AnalyzedToken, 0, len(segments))
	for _, segment := range segments {
		term := normalizeTokenTerm(segment)
		if term == "" || !a.allowRetrievalToken(term) {
			continue
		}
		tokens = append(tokens, AnalyzedToken{
			Term:   term,
			Field:  field,
			Source: tokenSourceWord,
		})
	}
	return compactAnalyzedTokens(tokens)
}

func (a retrievalAnalyzer) analyzeSparseText(text, field string, queryMode bool) []AnalyzedToken {
	return a.analyzeText(text, field, queryMode)
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

func (a retrievalAnalyzer) retrievalTerms(text string) []string {
	return analyzedTokenTerms(a.analyzeSparseText(text, "", true))
}

func (a retrievalAnalyzer) allowRetrievalToken(term string) bool {
	normalized := normalizeTokenTerm(term)
	if normalized == "" || !hasTokenContentRune(normalized) {
		return false
	}
	if len(a.policy.stopwords) == 0 {
		return true
	}
	_, blocked := a.policy.stopwords[normalized]
	return !blocked
}

func hasTokenContentRune(term string) bool {
	for _, r := range term {
		switch {
		case unicode.Is(unicode.Han, r):
			return true
		case unicode.IsLetter(r), unicode.IsDigit(r):
			return true
		}
	}
	return false
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

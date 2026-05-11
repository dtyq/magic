package splitter

import (
	"errors"
	"fmt"
	"slices"
	"strings"
	"unicode/utf8"

	"magic/internal/pkg/tokenizer"
)

// TokenChunk 表示一个基于 token 的分片结果。
type TokenChunk struct {
	Text       string
	TokenCount int
}

// TokenSplitResult 表示 token 分片结果。
type TokenSplitResult struct {
	Chunks  []TokenChunk
	Encoder *tokenizer.Encoder
}

// TokenTextSplitter 基于 token 的文本分割器。
type TokenTextSplitter struct {
	ChunkSize    int
	ChunkOverlap int
	Separator    string
	Model        string
	MaxChunks    int
	tokenizer    *tokenizer.Service
}

// ErrChunkLimitExceeded 表示分片数量超过调用方配置的上限。
var ErrChunkLimitExceeded = errors.New("chunk limit exceeded")

var errTokenWindowNoProgress = errors.New("token window made no progress")

// ChunkLimitError 携带分片数量超限上下文。
type ChunkLimitError struct {
	Limit    int
	Observed int
}

func (e *ChunkLimitError) Error() string {
	if e == nil {
		return ErrChunkLimitExceeded.Error()
	}
	return fmt.Sprintf("%s: observed=%d limit=%d", ErrChunkLimitExceeded, e.Observed, e.Limit)
}

func (e *ChunkLimitError) Unwrap() error {
	return ErrChunkLimitExceeded
}

// NewTokenTextSplitter 创建 token 分割器。
func NewTokenTextSplitter(
	tokenizerService *tokenizer.Service,
	model string,
	chunkSize, chunkOverlap int,
	separator string,
) *TokenTextSplitter {
	if tokenizerService == nil {
		tokenizerService = tokenizer.NewService()
	}
	if chunkSize <= 0 {
		chunkSize = 1000
	}
	if chunkOverlap < 0 {
		chunkOverlap = 0
	}
	if separator == "" {
		separator = "\n"
	}
	return &TokenTextSplitter{
		ChunkSize:    chunkSize,
		ChunkOverlap: chunkOverlap,
		Separator:    separator,
		Model:        model,
		tokenizer:    tokenizerService,
	}
}

// SplitText 按 token 分割文本，保留分隔符边界。
func (s *TokenTextSplitter) SplitText(text string) (*TokenSplitResult, error) {
	encoder, err := s.tokenizer.EncoderForModel(s.Model)
	if err != nil {
		return nil, fmt.Errorf("resolve tokenizer encoder: %w", err)
	}

	result := &TokenSplitResult{
		Chunks:  []TokenChunk{},
		Encoder: encoder,
	}

	text = strings.ReplaceAll(text, "\r\n", "\n")
	segments := splitBySeparatorPreserve(text, s.Separator)
	if len(segments) == 0 {
		return result, nil
	}

	state := tokenTextSplitState{
		splitter:      s,
		result:        result,
		encoder:       encoder,
		chunkOverlap:  normalizeChunkOverlap(s.ChunkOverlap, s.ChunkSize),
		currentTokens: make([]int, 0, s.ChunkSize),
	}
	for _, segment := range segments {
		if err := state.consumeSegment(segment); err != nil {
			return nil, err
		}
	}

	if err := state.emitCurrentTokens(); err != nil {
		return nil, err
	}
	return result, nil
}

type tokenTextSplitState struct {
	splitter      *TokenTextSplitter
	result        *TokenSplitResult
	encoder       *tokenizer.Encoder
	currentTokens []int
	chunkOverlap  int
}

func (s *tokenTextSplitState) consumeSegment(segment string) error {
	segmentTokens := s.encoder.Encode(segment)
	if len(segmentTokens) == 0 {
		return nil
	}

	if len(segmentTokens) > s.splitter.ChunkSize {
		return s.consumeLongTokens(segmentTokens)
	}

	if len(s.currentTokens)+len(segmentTokens) > s.splitter.ChunkSize && len(s.currentTokens) > 0 {
		previous := slices.Clone(s.currentTokens)
		if err := s.emitTokens(previous); err != nil {
			return err
		}
		s.currentTokens = seedTokenOverlap(s.currentTokens[:0], previous, s.chunkOverlap, s.encoder)
	}
	if len(s.currentTokens)+len(segmentTokens) > s.splitter.ChunkSize && len(s.currentTokens) > 0 {
		return s.consumeMergedTokens(segmentTokens)
	}

	s.currentTokens = append(s.currentTokens, segmentTokens...)
	return nil
}

func (s *tokenTextSplitState) consumeLongTokens(tokens []int) error {
	if err := s.emitCurrentTokens(); err != nil {
		return err
	}
	s.currentTokens = s.currentTokens[:0]
	return s.appendLongTokens(tokens)
}

func (s *tokenTextSplitState) consumeMergedTokens(tokens []int) error {
	merged := append(slices.Clone(s.currentTokens), tokens...)
	return s.appendLongTokens(merged)
}

func (s *tokenTextSplitState) appendLongTokens(tokens []int) error {
	var lastChunkTokens []int
	var err error
	s.result.Chunks, lastChunkTokens, err = appendLongTokenChunks(
		s.result.Chunks,
		tokens,
		s.splitter.ChunkSize,
		s.chunkOverlap,
		s.encoder,
		s.splitter.MaxChunks,
	)
	if err != nil {
		return err
	}
	s.currentTokens = seedTokenOverlap(s.currentTokens[:0], lastChunkTokens, s.chunkOverlap, s.encoder)
	return nil
}

func (s *tokenTextSplitState) emitCurrentTokens() error {
	return s.emitTokens(s.currentTokens)
}

func (s *tokenTextSplitState) emitTokens(tokens []int) error {
	if len(tokens) == 0 {
		return nil
	}
	chunkText, tokenCount := decodeChunkText(s.encoder, tokens)
	if strings.TrimSpace(chunkText) == "" {
		return nil
	}
	return appendTokenChunkWithLimit(&s.result.Chunks, TokenChunk{
		Text:       chunkText,
		TokenCount: tokenCount,
	}, s.splitter.MaxChunks)
}

func appendLongTokenChunks(
	chunks []TokenChunk,
	tokens []int,
	chunkSize, chunkOverlap int,
	encoder *tokenizer.Encoder,
	maxChunks int,
) ([]TokenChunk, []int, error) {
	var lastChunkTokens []int
	if len(tokens) == 0 {
		return chunks, nil, nil
	}
	if chunkSize <= 0 {
		chunkSize = len(tokens)
	}
	if chunkOverlap < 0 {
		chunkOverlap = 0
	}
	if chunkOverlap >= chunkSize {
		chunkOverlap = chunkSize - 1
	}

	for start := 0; start < len(tokens); {
		maxEnd := min(len(tokens), start+chunkSize)
		text, end := decodeLargestValidUTF8TokenWindow(encoder, tokens, start, maxEnd)
		if end <= start {
			return chunks, lastChunkTokens, fmt.Errorf("%w: token_offset=%d", errTokenWindowNoProgress, start)
		}
		if strings.TrimSpace(text) != "" {
			if err := appendTokenChunkWithLimit(&chunks, TokenChunk{
				Text:       text,
				TokenCount: encoder.CountTokens(text),
			}, maxChunks); err != nil {
				return chunks, lastChunkTokens, err
			}
			lastChunkTokens = slices.Clone(tokens[start:end])
		}
		if end == len(tokens) {
			break
		}

		nextStart := adjustTokenWindowStartToValidUTF8Boundary(encoder, tokens, max(start, end-chunkOverlap), end)
		if nextStart <= start {
			nextStart = end
		}
		start = nextStart
	}
	return chunks, lastChunkTokens, nil
}

func appendTokenChunkWithLimit(chunks *[]TokenChunk, chunk TokenChunk, maxChunks int) error {
	if maxChunks > 0 && len(*chunks)+1 > maxChunks {
		return &ChunkLimitError{
			Limit:    maxChunks,
			Observed: len(*chunks) + 1,
		}
	}
	*chunks = append(*chunks, chunk)
	return nil
}

func seedTokenOverlap(dst, lastChunkTokens []int, overlap int, encoder *tokenizer.Encoder) []int {
	if overlap <= 0 || len(lastChunkTokens) == 0 {
		return dst[:0]
	}
	if overlap > len(lastChunkTokens) {
		overlap = len(lastChunkTokens)
	}
	start := adjustTokenWindowStartToValidUTF8Boundary(encoder, lastChunkTokens, len(lastChunkTokens)-overlap, len(lastChunkTokens))
	if start >= len(lastChunkTokens) {
		return dst[:0]
	}
	return append(dst[:0], lastChunkTokens[start:]...)
}

func decodeChunkText(encoder *tokenizer.Encoder, tokens []int) (string, int) {
	text := encoder.Decode(tokens)
	if utf8.ValidString(text) {
		return text, len(tokens)
	}

	sanitized := strings.ToValidUTF8(text, "")
	if sanitized == text {
		return text, len(tokens)
	}

	return sanitized, encoder.CountTokens(sanitized)
}

func decodeLargestValidUTF8TokenWindow(
	encoder *tokenizer.Encoder,
	tokens []int,
	start, maxEnd int,
) (string, int) {
	if encoder == nil || start < 0 || start >= len(tokens) {
		return "", start
	}

	end := min(len(tokens), maxEnd)
	for ; end > start; end-- {
		decoded := encoder.Decode(tokens[start:end])
		if utf8.ValidString(decoded) {
			return decoded, end
		}
	}

	sanitized, _ := decodeChunkText(encoder, tokens[start:min(len(tokens), maxEnd)])
	if sanitized == "" {
		return "", start
	}
	return sanitized, min(len(tokens), maxEnd)
}

func adjustTokenWindowStartToValidUTF8Boundary(
	encoder *tokenizer.Encoder,
	tokens []int,
	minStart, end int,
) int {
	if encoder == nil || len(tokens) == 0 {
		return end
	}

	start := max(0, minStart)
	if start >= end {
		return end
	}
	for ; start < end; start++ {
		if utf8.ValidString(encoder.Decode(tokens[start:end])) {
			return start
		}
	}
	return end
}

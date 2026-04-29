package splitter

import (
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
	tokenizer    *tokenizer.Service
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

	chunkOverlap := normalizeChunkOverlap(s.ChunkOverlap, s.ChunkSize)
	currentTokens := make([]int, 0, s.ChunkSize)

	emitTokens := func(tokens []int) {
		if len(tokens) == 0 {
			return
		}
		chunkText, tokenCount := decodeChunkText(encoder, tokens)
		if strings.TrimSpace(chunkText) == "" {
			return
		}
		result.Chunks = append(result.Chunks, TokenChunk{
			Text:       chunkText,
			TokenCount: tokenCount,
		})
	}

	for _, segment := range segments {
		segmentTokens := encoder.Encode(segment)
		if len(segmentTokens) == 0 {
			continue
		}

		if len(segmentTokens) > s.ChunkSize {
			emitTokens(currentTokens)
			currentTokens = currentTokens[:0]
			var lastChunkTokens []int
			result.Chunks, lastChunkTokens = appendLongTokenChunks(result.Chunks, segmentTokens, s.ChunkSize, chunkOverlap, encoder)
			currentTokens = seedTokenOverlap(currentTokens[:0], lastChunkTokens, chunkOverlap, encoder)
			continue
		}

		if len(currentTokens)+len(segmentTokens) > s.ChunkSize && len(currentTokens) > 0 {
			previous := slices.Clone(currentTokens)
			emitTokens(previous)
			currentTokens = seedTokenOverlap(currentTokens[:0], previous, chunkOverlap, encoder)
		}
		if len(currentTokens)+len(segmentTokens) > s.ChunkSize && len(currentTokens) > 0 {
			merged := append(slices.Clone(currentTokens), segmentTokens...)
			var lastChunkTokens []int
			result.Chunks, lastChunkTokens = appendLongTokenChunks(result.Chunks, merged, s.ChunkSize, chunkOverlap, encoder)
			currentTokens = seedTokenOverlap(currentTokens[:0], lastChunkTokens, chunkOverlap, encoder)
			continue
		}

		currentTokens = append(currentTokens, segmentTokens...)
	}

	emitTokens(currentTokens)
	return result, nil
}

func appendLongTokenChunks(
	chunks []TokenChunk,
	tokens []int,
	chunkSize, chunkOverlap int,
	encoder *tokenizer.Encoder,
) ([]TokenChunk, []int) {
	var lastChunkTokens []int
	if len(tokens) == 0 {
		return chunks, nil
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
			break
		}
		if strings.TrimSpace(text) != "" {
			chunks = append(chunks, TokenChunk{
				Text:       text,
				TokenCount: encoder.CountTokens(text),
			})
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
	return chunks, lastChunkTokens
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

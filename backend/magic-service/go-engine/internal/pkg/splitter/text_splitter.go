// Package splitter 提供文本分割工具
package splitter

import (
	"strings"
	"unicode/utf8"
)

const currentSegmentsCapacity = 8

// TextSplitter 文本分割器
type TextSplitter struct {
	ChunkSize    int
	ChunkOverlap int
	Separator    string
}

// NewTextSplitter 创建文本分割器
func NewTextSplitter(chunkSize, chunkOverlap int, separator string) *TextSplitter {
	if chunkSize <= 0 {
		chunkSize = 1000
	}
	if chunkOverlap < 0 {
		chunkOverlap = 0
	}
	if separator == "" {
		separator = "\n"
	}
	return &TextSplitter{
		ChunkSize:    chunkSize,
		ChunkOverlap: chunkOverlap,
		Separator:    separator,
	}
}

// SplitText 分割文本
func (s *TextSplitter) SplitText(text string) []string {
	text = strings.ReplaceAll(text, "\r\n", "\n")
	segments := splitBySeparatorPreserve(text, s.Separator)
	if len(segments) == 0 {
		return nil
	}

	chunkOverlap := normalizeChunkOverlap(s.ChunkOverlap, s.ChunkSize)

	chunks := make([]string, 0, len(segments))
	currentSegments := make([]string, 0, currentSegmentsCapacity)
	currentLen := 0
	emitCurrent := func() {
		if len(currentSegments) == 0 {
			return
		}
		chunk := strings.Join(currentSegments, "")
		if strings.TrimSpace(chunk) == "" {
			currentSegments = currentSegments[:0]
			currentLen = 0
			return
		}
		chunks = append(chunks, chunk)
		currentSegments = currentSegments[:0]
		currentLen = 0
	}

	for _, segment := range segments {
		segmentLen := utf8.RuneCountInString(segment)
		if segmentLen > s.ChunkSize {
			emitCurrent()
			chunks = appendLongChunks(chunks, segment, s.ChunkSize, chunkOverlap)
			continue
		}

		if currentLen+segmentLen > s.ChunkSize && currentLen > 0 {
			lastChunk := strings.Join(currentSegments, "")
			emitCurrent()
			currentSegments, currentLen = seedChunkOverlap(currentSegments, lastChunk, chunkOverlap)
		}

		currentSegments = append(currentSegments, segment)
		currentLen += segmentLen
	}
	emitCurrent()

	return chunks
}

func normalizeChunkOverlap(chunkOverlap, chunkSize int) int {
	chunkOverlap = max(chunkOverlap, 0)
	if chunkOverlap >= chunkSize {
		chunkOverlap = max(0, chunkSize-1)
	}
	return chunkOverlap
}

func appendLongChunks(chunks []string, segment string, chunkSize, chunkOverlap int) []string {
	longChunks := splitByRunesWithOverlap(segment, chunkSize, chunkOverlap)
	for _, chunk := range longChunks {
		if strings.TrimSpace(chunk) != "" {
			chunks = append(chunks, chunk)
		}
	}
	return chunks
}

func seedChunkOverlap(currentSegments []string, lastChunk string, chunkOverlap int) ([]string, int) {
	if chunkOverlap <= 0 || lastChunk == "" {
		return currentSegments, 0
	}
	overlapText := lastRunes(lastChunk, chunkOverlap)
	if overlapText == "" {
		return currentSegments, 0
	}
	return append(currentSegments, overlapText), utf8.RuneCountInString(overlapText)
}

func splitBySeparatorPreserve(text, separator string) []string {
	if text == "" {
		return nil
	}
	if separator == "" {
		if text == "\n" {
			return nil
		}
		return []string{text}
	}

	segments := make([]string, 0, currentSegmentsCapacity)
	firstSegment := true
	cursor := 0
	for {
		next := strings.Index(text[cursor:], separator)
		if next < 0 {
			segment := text[cursor:]
			if !firstSegment {
				segment = separator + segment
			}
			if segment != "" && segment != "\n" {
				segments = append(segments, segment)
			}
			return segments
		}

		boundary := cursor + next
		segment := text[cursor:boundary]
		if !firstSegment {
			segment = separator + segment
		}
		if segment != "" && segment != "\n" {
			segments = append(segments, segment)
		}
		firstSegment = false
		cursor = boundary + len(separator)
	}
}

func splitByRunesWithOverlap(text string, chunkSize, overlap int) []string {
	runes := []rune(text)
	if len(runes) == 0 {
		return nil
	}
	if chunkSize <= 0 {
		chunkSize = len(runes)
	}
	if overlap < 0 {
		overlap = 0
	}
	if overlap >= chunkSize {
		overlap = chunkSize - 1
	}

	chunks := make([]string, 0, max(1, len(runes)/chunkSize+1))
	start := 0
	for start < len(runes) {
		end := min(len(runes), start+chunkSize)
		chunks = append(chunks, string(runes[start:end]))
		if end == len(runes) {
			break
		}
		nextStart := end - overlap
		if nextStart <= start {
			nextStart = start + 1
		}
		start = nextStart
	}
	return chunks
}

func lastRunes(text string, count int) string {
	if count <= 0 {
		return ""
	}
	runes := []rune(text)
	if len(runes) <= count {
		return text
	}
	return string(runes[len(runes)-count:])
}

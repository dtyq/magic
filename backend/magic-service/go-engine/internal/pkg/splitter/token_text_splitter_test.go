package splitter_test

import (
	"strings"
	"testing"
	"unicode/utf8"

	"magic/internal/pkg/splitter"
	"magic/internal/pkg/tokenizer"
)

func TestNewTokenTextSplitterDefaults(t *testing.T) {
	t.Parallel()

	s := splitter.NewTokenTextSplitter(nil, "", 0, -1, "")
	if s.ChunkSize != 1000 {
		t.Fatalf("expected default chunk size 1000, got %d", s.ChunkSize)
	}
	if s.ChunkOverlap != 0 {
		t.Fatalf("expected default overlap 0, got %d", s.ChunkOverlap)
	}
	if s.Separator != "\n" {
		t.Fatalf("expected default separator newline, got %q", s.Separator)
	}
}

func TestTokenTextSplitterSplitWithOverlap(t *testing.T) {
	t.Parallel()

	s := splitter.NewTokenTextSplitter(tokenizer.NewService(), "text-embedding-3-small", 20, 5, "\n\n")
	text := "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu\n\n" +
		"nu xi omicron pi rho sigma tau upsilon phi chi psi omega\n\n" +
		"one two three four five six seven eight nine ten"

	result, err := s.SplitText(text)
	if err != nil {
		t.Fatalf("split failed: %v", err)
	}
	if len(result.Chunks) < 2 {
		t.Fatalf("expected multiple chunks, got %d", len(result.Chunks))
	}

	encoder := result.Encoder
	if encoder == nil {
		t.Fatal("expected encoder in split result")
	}
	for i, chunk := range result.Chunks {
		if chunk.TokenCount <= 0 {
			t.Fatalf("chunk %d has invalid token count: %d", i, chunk.TokenCount)
		}
		if chunk.TokenCount > s.ChunkSize {
			t.Fatalf("chunk %d exceeds chunk size: %d > %d", i, chunk.TokenCount, s.ChunkSize)
		}
	}

	_ = encoder
}

func TestTokenTextSplitterFallbackModel(t *testing.T) {
	t.Parallel()

	s := splitter.NewTokenTextSplitter(tokenizer.NewService(), "unknown-model", 30, 6, "\n")
	result, err := s.SplitText("hello world\nhello tokenizer")
	if err != nil {
		t.Fatalf("split failed: %v", err)
	}
	if result.Encoder == nil {
		t.Fatal("expected encoder in split result")
	}
	if !result.Encoder.UsesFallback() {
		t.Fatal("expected fallback for unknown model")
	}
	if result.Encoder.EncodingName() != tokenizer.DefaultEncoding {
		t.Fatalf("expected fallback encoding %q, got %q", tokenizer.DefaultEncoding, result.Encoder.EncodingName())
	}
}

func TestTokenTextSplitterLongSegmentKeepsOverlapAcrossBoundary(t *testing.T) {
	t.Parallel()

	s := splitter.NewTokenTextSplitter(tokenizer.NewService(), "text-embedding-3-small", 20, 5, "\n\n")
	text := strings.Repeat("alpha ", 120) + "\n\nSECOND SEGMENT START"

	result, err := s.SplitText(text)
	if err != nil {
		t.Fatalf("split failed: %v", err)
	}
	if len(result.Chunks) < 2 {
		t.Fatalf("expected at least two chunks, got %d", len(result.Chunks))
	}
	encoder := result.Encoder
	if encoder == nil {
		t.Fatal("expected encoder in split result")
	}

	last := result.Chunks[len(result.Chunks)-1]
	prev := result.Chunks[len(result.Chunks)-2]
	prevTokens := encoder.Encode(prev.Text)
	if len(prevTokens) < s.ChunkOverlap {
		t.Fatalf("insufficient tokens for overlap assertion: prev=%d overlap=%d", len(prevTokens), s.ChunkOverlap)
	}

	overlapText := encoder.Decode(prevTokens[len(prevTokens)-s.ChunkOverlap:])
	if overlapText == "" {
		t.Fatal("expected non-empty overlap text")
	}
	if !strings.HasPrefix(last.Text, overlapText) {
		t.Fatalf("expected last chunk to preserve overlap prefix %q, got %q", overlapText, last.Text)
	}
}

func TestTokenTextSplitterChineseChunksRemainValidUTF8(t *testing.T) {
	t.Parallel()

	s := splitter.NewTokenTextSplitter(tokenizer.NewService(), "text-embedding-3-small", 40, 8, "\n")
	text := strings.Repeat("讨论记录：录音功能优化讨论，在线录音质量需要提升。\n", 16)

	result, err := s.SplitText(text)
	if err != nil {
		t.Fatalf("split failed: %v", err)
	}
	if len(result.Chunks) == 0 {
		t.Fatal("expected chunks")
	}

	for i, chunk := range result.Chunks {
		if !utf8.ValidString(chunk.Text) {
			t.Fatalf("chunk %d contains invalid utf-8: %q", i, chunk.Text)
		}
		if chunk.TokenCount <= 0 {
			t.Fatalf("chunk %d has invalid token count: %d", i, chunk.TokenCount)
		}
	}
}

func TestTokenTextSplitterLongChineseSegmentPreservesTextWithoutOverlap(t *testing.T) {
	t.Parallel()

	s := splitter.NewTokenTextSplitter(tokenizer.NewService(), "text-embedding-3-small", 24, 0, "\n")
	text := strings.Repeat("膦元素校准能力验证记录，覆盖量块、标准器和环境修正。", 32)

	result, err := s.SplitText(text)
	if err != nil {
		t.Fatalf("split failed: %v", err)
	}
	if len(result.Chunks) < 2 {
		t.Fatalf("expected multiple chunks, got %d", len(result.Chunks))
	}

	var rebuilt strings.Builder
	for i, chunk := range result.Chunks {
		if !utf8.ValidString(chunk.Text) {
			t.Fatalf("chunk %d contains invalid utf-8: %q", i, chunk.Text)
		}
		rebuilt.WriteString(chunk.Text)
	}
	if rebuilt.String() != text {
		t.Fatalf("expected rebuilt text to equal source text")
	}
}

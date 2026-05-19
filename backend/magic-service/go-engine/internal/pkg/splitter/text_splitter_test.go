package splitter_test

import (
	"testing"

	"magic/internal/pkg/splitter"
)

func TestNewTextSplitter_Defaults(t *testing.T) {
	t.Parallel()
	s := splitter.NewTextSplitter(0, -1, "")
	if s.ChunkSize != 1000 {
		t.Fatalf("expected default chunk size")
	}
	if s.ChunkOverlap != 0 {
		t.Fatalf("expected default overlap")
	}
	if s.Separator != "\n" {
		t.Fatalf("expected default separator")
	}
}

func TestTextSplitter_SplitText(t *testing.T) {
	t.Parallel()
	s := splitter.NewTextSplitter(5, 0, "\n")
	chunks := s.SplitText("ab\ncd\nef")
	if len(chunks) != 2 {
		t.Fatalf("expected 2 chunks, got %d", len(chunks))
	}
	if chunks[0] != "ab\ncd" {
		t.Fatalf("unexpected first chunk: %q", chunks[0])
	}
	if chunks[1] != "\nef" {
		t.Fatalf("unexpected second chunk: %q", chunks[1])
	}
}

func TestTextSplitter_NormalizeNewlines(t *testing.T) {
	t.Parallel()
	s := splitter.NewTextSplitter(100, 0, "\n")
	chunks := s.SplitText("a\r\nb")
	if len(chunks) != 1 || chunks[0] != "a\nb" {
		t.Fatalf("unexpected chunks: %#v", chunks)
	}
}

func TestTextSplitter_ChunkOverlap(t *testing.T) {
	t.Parallel()
	s := splitter.NewTextSplitter(4, 2, "")
	chunks := s.SplitText("abcdef")
	if len(chunks) != 2 {
		t.Fatalf("expected 2 chunks, got %d (%#v)", len(chunks), chunks)
	}
	if chunks[0] != "abcd" {
		t.Fatalf("unexpected first chunk: %q", chunks[0])
	}
	if chunks[1] != "cdef" {
		t.Fatalf("unexpected second chunk: %q", chunks[1])
	}
}

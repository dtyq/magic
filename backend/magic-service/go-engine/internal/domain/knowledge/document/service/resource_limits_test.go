package document_test

import (
	"errors"
	"testing"

	documentdomain "magic/internal/domain/knowledge/document/service"
)

func TestDefaultResourceLimitsMaxFragmentsPerDocument(t *testing.T) {
	t.Parallel()

	limits := documentdomain.DefaultResourceLimits()
	if limits.MaxSourceBytes != 60*1024*1024 {
		t.Fatalf("expected default max source bytes 60MiB, got %d", limits.MaxSourceBytes)
	}
	if limits.MaxFragmentsPerDocument != 2_000 {
		t.Fatalf("expected default max fragments 2000, got %d", limits.MaxFragmentsPerDocument)
	}
	if limits.MaxPDFPages != 300 {
		t.Fatalf("expected default max pdf pages 300, got %d", limits.MaxPDFPages)
	}
	if limits.MaxArchiveUncompressedBytes != 256*1024*1024 {
		t.Fatalf("expected default archive uncompressed bytes 256MiB, got %d", limits.MaxArchiveUncompressedBytes)
	}
	if limits.MaxArchiveEntryBytes != 64*1024*1024 {
		t.Fatalf("expected default archive entry bytes 64MiB, got %d", limits.MaxArchiveEntryBytes)
	}
	if limits.MaxEmbeddedAssetBytes != 30*1024*1024 {
		t.Fatalf("expected default embedded asset bytes 30MiB, got %d", limits.MaxEmbeddedAssetBytes)
	}
	if limits.MaxPresentationSlides != 300 {
		t.Fatalf("expected default presentation slides 300, got %d", limits.MaxPresentationSlides)
	}
	if limits.SyncFragmentBatchSize != 64 {
		t.Fatalf("expected default sync fragment batch size 64, got %d", limits.SyncFragmentBatchSize)
	}
	if err := documentdomain.CheckFragmentCount(2_000, limits); err != nil {
		t.Fatalf("expected 2000 fragments to pass, got %v", err)
	}
	err := documentdomain.CheckFragmentCount(2_001, limits)
	if !errors.Is(err, documentdomain.ErrDocumentResourceLimitExceeded) {
		t.Fatalf("expected resource limit error, got %v", err)
	}
}

func TestCheckPDFPageCount(t *testing.T) {
	t.Parallel()

	limits := documentdomain.ResourceLimits{MaxPDFPages: 2}
	if err := documentdomain.CheckPDFPageCount(2, limits); err != nil {
		t.Fatalf("expected 2 pages to pass, got %v", err)
	}
	err := documentdomain.CheckPDFPageCount(3, limits)
	if !errors.Is(err, documentdomain.ErrDocumentResourceLimitExceeded) {
		t.Fatalf("expected resource limit error, got %v", err)
	}
}

func TestAdditionalResourceLimitChecks(t *testing.T) {
	t.Parallel()

	limits := documentdomain.ResourceLimits{
		MaxArchiveUncompressedBytes: 10,
		MaxArchiveEntryBytes:        5,
		MaxEmbeddedAssetBytes:       3,
		MaxPresentationSlides:       2,
		MaxPlainTextChars:           4,
		MaxParsedBlocks:             1,
	}
	testCases := []struct {
		name string
		err  error
	}{
		{name: "archive total", err: documentdomain.CheckArchiveUncompressedSize(11, limits)},
		{name: "archive entry", err: documentdomain.CheckArchiveEntrySize(6, limits)},
		{name: "embedded asset", err: documentdomain.CheckEmbeddedAssetSize(4, limits)},
		{name: "presentation slides", err: documentdomain.CheckPresentationSlideCount(3, limits)},
		{name: "plain text bytes", err: documentdomain.CheckPlainTextBytes([]byte("hello"), limits, "parse_text")},
		{name: "parsed blocks", err: documentdomain.CheckParsedBlockCount(2, limits, "parse_json")},
	}
	for _, tc := range testCases {
		if !errors.Is(tc.err, documentdomain.ErrDocumentResourceLimitExceeded) {
			t.Fatalf("%s: expected resource limit error, got %v", tc.name, tc.err)
		}
	}
}

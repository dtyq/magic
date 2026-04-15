package retrieval_test

import (
	"os"
	"path/filepath"
	"slices"
	"testing"

	retrieval "magic/internal/domain/knowledge/fragment/retrieval"
)

func TestResolveBundledRetrievalDictionaryFiles(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	dictDir := filepath.Join(tempDir, retrieval.BundledRetrievalDictMagicServiceDirForTest())
	if err := os.MkdirAll(dictDir, 0o750); err != nil {
		t.Fatalf("mkdir bundled retrieval dict dir: %v", err)
	}

	want := []string{
		filepath.Join(dictDir, retrieval.BundledRetrievalSimplifiedDictFileForTest()),
		filepath.Join(dictDir, retrieval.BundledRetrievalTraditionalDictFileForTest()),
	}
	for _, filePath := range want {
		if err := os.WriteFile(filePath, []byte("test"), 0o600); err != nil {
			t.Fatalf("write bundled retrieval dict %s: %v", filePath, err)
		}
	}

	got, err := retrieval.ResolveBundledRetrievalDictionaryFilesForTest([]string{
		filepath.Join(tempDir, "missing"),
		dictDir,
	})
	if err != nil {
		t.Fatalf("resolve bundled retrieval dictionaries: %v", err)
	}
	if !slices.Equal(got, want) {
		t.Fatalf("unexpected bundled retrieval dictionaries: got %v want %v", got, want)
	}
}

func TestResolveBundledRetrievalDictionaryFilesMissing(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	_, err := retrieval.ResolveBundledRetrievalDictionaryFilesForTest([]string{
		filepath.Join(tempDir, "missing"),
	})
	if err == nil {
		t.Fatal("expected bundled retrieval dictionary resolution to fail when files are missing")
	}
}

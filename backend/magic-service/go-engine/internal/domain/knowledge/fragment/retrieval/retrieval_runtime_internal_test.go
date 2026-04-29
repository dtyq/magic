package retrieval

import (
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/go-ego/gse"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
)

func TestBundledCustomTermsCorrectsSegmentation(t *testing.T) {
	t.Parallel()

	analyzer := newBundledAnalyzerForTest(t, bundledAnalyzerFixture{
		simplified:  "超导 1000 n\n量子 1000 n\n比特 1000 n\n",
		traditional: "",
		customTerms: "超导量子比特 12000 n\n",
		stopwords:   "的\n",
	})

	terms := analyzedTokenTerms(analyzer.analyzeSparseText("超导量子比特的优化流程", "", true))
	if !slices.Contains(terms, "超导量子比特") {
		t.Fatalf("expected custom term to be kept intact, got %#v", terms)
	}
	if slices.Contains(terms, "的") {
		t.Fatalf("expected retrieval stopwords to be filtered, got %#v", terms)
	}
}

func TestRetrievalStopwordsDoNotChangeDenseRetrievalText(t *testing.T) {
	t.Parallel()

	analyzer := newBundledAnalyzerForTest(t, bundledAnalyzerFixture{
		simplified:  "退款 1000 n\n流程 1000 n\n",
		traditional: "",
		customTerms: "",
		stopwords:   "的\n",
	})

	fragment := &fragmodel.KnowledgeBaseFragment{
		Content: "退款的流程",
	}
	text := buildRetrievalTextFromFragmentWithAnalyzer(fragment, analyzer)
	if text != "退款的流程" {
		t.Fatalf("expected dense retrieval text to keep original content, got %q", text)
	}
	terms := analyzer.retrievalTerms(fragment.Content)
	if slices.Contains(terms, "的") {
		t.Fatalf("expected sparse retrieval terms to filter stopword, got %#v", terms)
	}
}

func TestRetrievalAnalyzerSelfCheckAllowsMissingStopwordEntry(t *testing.T) {
	t.Parallel()

	analyzer := newBundledAnalyzerForTest(t, bundledAnalyzerFixture{
		simplified:  "退款 1000 n\n流程 1000 n\n",
		traditional: "",
		customTerms: "",
		stopwords:   "",
	})

	if err := analyzer.selfCheck(); err != nil {
		t.Fatalf("expected selfCheck to allow missing stopword entry, got %v", err)
	}
	terms := analyzer.retrievalTerms(retrievalSelfCheckText)
	if !slices.Contains(terms, "的") {
		t.Fatalf("expected selfCheck fixture to keep '的' when stopword entry is missing, got %#v", terms)
	}
}

type bundledAnalyzerFixture struct {
	simplified  string
	traditional string
	customTerms string
	stopwords   string
}

func newBundledAnalyzerForTest(t *testing.T, fixture bundledAnalyzerFixture) retrievalAnalyzer {
	t.Helper()

	dir := t.TempDir()
	for _, file := range []struct {
		name    string
		content string
	}{
		{name: retrievalBundledSimplifiedDictFile, content: fixture.simplified},
		{name: retrievalBundledTraditionalDictFile, content: fixture.traditional},
		{name: retrievalBundledCustomTermsDictFile, content: fixture.customTerms},
		{name: retrievalBundledRetrievalStopwordsFile, content: fixture.stopwords},
	} {
		if err := os.WriteFile(filepath.Join(dir, file.name), []byte(file.content), 0o600); err != nil {
			t.Fatalf("write fixture file %s: %v", file.name, err)
		}
	}

	dictSet, err := bundledRetrievalDictionarySetFromDir(dir)
	if err != nil {
		t.Fatalf("load bundled dict set: %v", err)
	}
	dictFiles, err := dictSet.requiredPaths(retrievalBundledSegmenterDictFiles()...)
	if err != nil {
		t.Fatalf("resolve segmenter dict files: %v", err)
	}

	segmenter, segmenterErr := newRetrievalSegmenterProvider(func(segmenter *gse.Segmenter) error {
		if err := segmenter.LoadDict(strings.Join(dictFiles, ", ")); err != nil {
			return fmt.Errorf("load segmenter dict files: %w", err)
		}
		return nil
	}).cutter()
	policy, err := loadRetrievalTokenPolicyFromSet(dictSet)
	if err != nil {
		t.Fatalf("load retrieval token policy: %v", err)
	}
	return newRetrievalAnalyzerFromParts(segmenter, segmenterErr, policy, nil)
}

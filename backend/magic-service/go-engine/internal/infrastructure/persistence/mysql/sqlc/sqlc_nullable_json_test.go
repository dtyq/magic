package mysqlsqlc_test

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestKnowledgeBaseQueriesUseJSONNullFallback(t *testing.T) {
	t.Parallel()
	fallbacks := []string{
		"COALESCE(retrieve_config, CAST('null' AS JSON)) AS retrieve_config",
		"COALESCE(fragment_config, CAST('null' AS JSON)) AS fragment_config",
		"COALESCE(embedding_config, CAST('null' AS JSON)) AS embedding_config",
	}

	queryFile := readQueryFile(t, "knowledge_base.sql.go")
	assertContainsAll(t, "knowledge_base.sql.go", queryFile, fallbacks)
}

func TestDocumentQueriesUseSourceBindingColumns(t *testing.T) {
	t.Parallel()
	snippets := []string{
		"source_binding_id",
		"source_item_id",
		"FindDocumentByKnowledgeBaseAndProjectFile",
		"FindDocumentByThirdFile",
	}

	queryFile := readQueryFile(t, "document.sql.go")
	assertContainsAll(t, "document.sql.go", queryFile, snippets)
}

func TestFragmentQueriesUseJSONNullFallback(t *testing.T) {
	t.Parallel()
	fallbacks := []string{
		"COALESCE(metadata, CAST('null' AS JSON)) AS metadata",
	}

	queryFile := readQueryFile(t, "fragment.sql.go")
	assertContainsAll(t, "fragment.sql.go", queryFile, fallbacks)
}

func assertContainsAll(t *testing.T, queryName, query string, snippets []string) {
	t.Helper()

	for _, snippet := range snippets {
		if !strings.Contains(query, snippet) {
			t.Fatalf("%s missing NULL fallback snippet: %s", queryName, snippet)
		}
	}
}

func readQueryFile(t *testing.T, fileName string) string {
	t.Helper()

	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("failed to resolve test file path")
	}

	queryFile := filepath.Join(filepath.Dir(thisFile), fileName)
	content, err := os.ReadFile(queryFile)
	if err != nil {
		t.Fatalf("failed to read %s: %v", fileName, err)
	}
	return string(content)
}

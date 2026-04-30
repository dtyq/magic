package mysqlsqlc_test

import (
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"testing"
)

func TestGeneratedModelsUseByteSlicesForMySQLJSONColumns(t *testing.T) {
	t.Parallel()

	modelsFile := readGeneratedFile(t, "models.go")
	assertMatchesAll(t, "models.go", modelsFile, []string{
		`(?m)^\s*Embedding\s+\[\]byte\s+`,
		`(?m)^\s*DocMetadata\s+\[\]byte\s+`,
		`(?m)^\s*DocumentFile\s+\[\]byte\s+`,
		`(?m)^\s*RetrieveConfig\s+\[\]byte\s+`,
		`(?m)^\s*FragmentConfig\s+\[\]byte\s+`,
		`(?m)^\s*EmbeddingConfig\s+\[\]byte\s+`,
		`(?m)^\s*VectorDbConfig\s+\[\]byte\s+`,
		`(?m)^\s*SyncConfig\s+\[\]byte\s+`,
		`(?m)^\s*SnapshotMeta\s+\[\]byte\s+`,
		`(?m)^\s*Metadata\s+\[\]byte\s+`,
	})
	if strings.Contains(modelsFile, "json.RawMessage") {
		t.Fatal("models.go should not use json.RawMessage for MySQL JSON columns")
	}
}

func TestFindKnowledgeBaseCollectionMetaUsesRawByteJSON(t *testing.T) {
	t.Parallel()

	queryFile := readGeneratedFile(t, "knowledge_base.sql.go")
	assertMatchesAll(t, "knowledge_base.sql.go", queryFile, []string{
		`type FindKnowledgeBaseCollectionMetaRow struct \{`,
		`(?m)^\s*EmbeddingConfig\s+\[\]byte\s+`,
	})
	if strings.Contains(queryFile, "SELECT model,\n       COALESCE(embedding_config, CAST('{}' AS JSON)) AS embedding_config") {
		t.Fatal("FindKnowledgeBaseCollectionMeta should read raw embedding_config without SQL fallback")
	}
}

func TestDocumentQueriesUseSourceBindingColumns(t *testing.T) {
	t.Parallel()

	queryFile := readGeneratedFile(t, "document.sql.go")
	assertContainsAll(t, "document.sql.go", queryFile, []string{
		"source_binding_id",
		"source_item_id",
		"ListDocumentsBySourceFileID",
		"FindDocumentByThirdFile",
	})
}

func TestFragmentQueriesUseDirectMetadataColumn(t *testing.T) {
	t.Parallel()

	queryFile := readGeneratedFile(t, "fragment.sql.go")
	if strings.Contains(queryFile, "COALESCE(metadata, CAST('null' AS JSON)) AS metadata") {
		t.Fatal("fragment.sql.go should use direct metadata column access")
	}
}

func assertContainsAll(t *testing.T, queryName, query string, snippets []string) {
	t.Helper()

	for _, snippet := range snippets {
		if !strings.Contains(query, snippet) {
			t.Fatalf("%s missing snippet: %s", queryName, snippet)
		}
	}
}

func assertMatchesAll(t *testing.T, fileName, content string, patterns []string) {
	t.Helper()

	for _, pattern := range patterns {
		matched, err := regexp.MatchString(pattern, content)
		if err != nil {
			t.Fatalf("invalid pattern %q: %v", pattern, err)
		}
		if !matched {
			t.Fatalf("%s missing pattern: %s", fileName, pattern)
		}
	}
}

func readGeneratedFile(t *testing.T, fileName string) string {
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

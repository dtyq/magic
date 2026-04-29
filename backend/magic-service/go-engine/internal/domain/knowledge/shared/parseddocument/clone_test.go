package parseddocument_test

import (
	"testing"

	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
)

func TestCloneParsedDocumentClonesSupportedMetadataShapes(t *testing.T) {
	t.Parallel()

	parsed := &parseddocument.ParsedDocument{
		DocumentMeta: map[string]any{
			"labels": map[string]string{"lang": "zh"},
			"fields": []map[string]any{
				{"name": "title", "aliases": []string{"标题"}},
			},
			"sheet_names": []string{"Sheet1"},
			"row_indexes": []int{1, 2},
			"scores":      []float64{0.1, 0.2},
			"nested": map[string]any{
				"headers": []any{"a", "b"},
				"flags":   []bool{true, false},
			},
		},
		Blocks: []parseddocument.ParsedBlock{{
			Type:    parseddocument.BlockTypeTableRow,
			Content: "row",
			Metadata: map[string]any{
				"fields": []map[string]any{
					{"name": "code"},
				},
			},
		}},
	}

	cloned := parseddocument.CloneParsedDocument(parsed)
	labels := requireStringMap(t, parsed.DocumentMeta["labels"])
	labels["lang"] = "en"
	fields := requireMapSlice(t, parsed.DocumentMeta["fields"])
	fields[0]["name"] = "changed"
	sheetNames := requireStringSlice(t, parsed.DocumentMeta["sheet_names"])
	sheetNames[0] = "Sheet2"
	rowIndexes := requireIntSlice(t, parsed.DocumentMeta["row_indexes"])
	rowIndexes[0] = 9
	scores := requireFloat64Slice(t, parsed.DocumentMeta["scores"])
	scores[0] = 9.9
	nested := requireAnyMap(t, parsed.DocumentMeta["nested"])
	requireAnySlice(t, nested["headers"])[0] = "z"
	requireBoolSlice(t, nested["flags"])[0] = false
	requireMapSlice(t, parsed.Blocks[0].Metadata["fields"])[0]["name"] = "changed-block"

	if requireStringMap(t, cloned.DocumentMeta["labels"])["lang"] != "zh" {
		t.Fatalf("expected labels to be cloned, got %#v", cloned.DocumentMeta)
	}
	if requireMapSlice(t, cloned.DocumentMeta["fields"])[0]["name"] != "title" {
		t.Fatalf("expected fields to be cloned, got %#v", cloned.DocumentMeta)
	}
	if requireStringSlice(t, cloned.DocumentMeta["sheet_names"])[0] != "Sheet1" {
		t.Fatalf("expected sheet names to be cloned, got %#v", cloned.DocumentMeta)
	}
	if requireIntSlice(t, cloned.DocumentMeta["row_indexes"])[0] != 1 {
		t.Fatalf("expected int slice to be cloned, got %#v", cloned.DocumentMeta)
	}
	if requireFloat64Slice(t, cloned.DocumentMeta["scores"])[0] != 0.1 {
		t.Fatalf("expected float64 slice to be cloned, got %#v", cloned.DocumentMeta)
	}
	if requireAnySlice(t, requireAnyMap(t, cloned.DocumentMeta["nested"])["headers"])[0] != "a" {
		t.Fatalf("expected nested any slice to be cloned, got %#v", cloned.DocumentMeta)
	}
	if requireBoolSlice(t, requireAnyMap(t, cloned.DocumentMeta["nested"])["flags"])[0] != true {
		t.Fatalf("expected bool slice to be cloned, got %#v", cloned.DocumentMeta)
	}
	if requireMapSlice(t, cloned.Blocks[0].Metadata["fields"])[0]["name"] != "code" {
		t.Fatalf("expected block metadata to be cloned, got %#v", cloned.Blocks[0].Metadata)
	}
}

func requireStringMap(t *testing.T, value any) map[string]string {
	t.Helper()
	result, ok := value.(map[string]string)
	if !ok {
		t.Fatalf("expected map[string]string, got %#v", value)
	}
	return result
}

func requireAnyMap(t *testing.T, value any) map[string]any {
	t.Helper()
	result, ok := value.(map[string]any)
	if !ok {
		t.Fatalf("expected map[string]any, got %#v", value)
	}
	return result
}

func requireMapSlice(t *testing.T, value any) []map[string]any {
	t.Helper()
	result, ok := value.([]map[string]any)
	if !ok {
		t.Fatalf("expected []map[string]any, got %#v", value)
	}
	return result
}

func requireStringSlice(t *testing.T, value any) []string {
	t.Helper()
	result, ok := value.([]string)
	if !ok {
		t.Fatalf("expected []string, got %#v", value)
	}
	return result
}

func requireIntSlice(t *testing.T, value any) []int {
	t.Helper()
	result, ok := value.([]int)
	if !ok {
		t.Fatalf("expected []int, got %#v", value)
	}
	return result
}

func requireFloat64Slice(t *testing.T, value any) []float64 {
	t.Helper()
	result, ok := value.([]float64)
	if !ok {
		t.Fatalf("expected []float64, got %#v", value)
	}
	return result
}

func requireBoolSlice(t *testing.T, value any) []bool {
	t.Helper()
	result, ok := value.([]bool)
	if !ok {
		t.Fatalf("expected []bool, got %#v", value)
	}
	return result
}

func requireAnySlice(t *testing.T, value any) []any {
	t.Helper()
	result, ok := value.([]any)
	if !ok {
		t.Fatalf("expected []any, got %#v", value)
	}
	return result
}

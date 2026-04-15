package retrieval_test

import (
	"sort"
	"strings"
	"testing"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	retrieval "magic/internal/domain/knowledge/fragment/retrieval"
)

func TestBuildKeywordRetrievalTextFromFragment_UsesConservativeWeightingAndDedup(t *testing.T) {
	fragment := &fragmodel.KnowledgeBaseFragment{
		DocumentName: "中文手册",
		Content:      "如何退款",
		SectionPath:  "帮助中心 > 售后",
		SectionTitle: "退款",
		Metadata: map[string]any{
			retrieval.ParsedMetaTableTitle:        "退款",
			retrieval.ParsedMetaPrimaryKeys:       []any{"订单号", "订单号"},
			retrieval.ParsedMetaPrimaryKeyHeaders: []any{"主键列"},
			retrieval.ParsedMetaHeaderPaths:       []any{"售后/退款", "售后/退款"},
		},
	}

	text := retrieval.BuildKeywordRetrievalTextFromFragment(fragment)
	if !strings.HasPrefix(text, "退款 退款 ") {
		t.Fatalf("expected section title to be repeated twice at the beginning, got %q", text)
	}
	if strings.Count(text, "中文手册") != 1 {
		t.Fatalf("expected document name to appear once, got %q", text)
	}
	if strings.Count(text, "订单号") != 1 {
		t.Fatalf("expected primary key to be deduplicated, got %q", text)
	}
	if strings.Count(text, "售后/退款") != 1 {
		t.Fatalf("expected header path to be deduplicated, got %q", text)
	}
	if !strings.Contains(text, "帮助中心 > 售后") || !strings.Contains(text, "如何退款") {
		t.Fatalf("expected section path and content to be retained, got %q", text)
	}
}

func TestDefaultSparseDocumentForText_UsesChineseFriendlyOptions(t *testing.T) {
	t.Parallel()

	document := retrieval.DefaultSparseDocumentForText("  中文 Query  ")
	if document == nil {
		t.Fatal("expected sparse document")
	}
	if document.Text != "中文 Query" {
		t.Fatalf("expected normalized text, got %q", document.Text)
	}
	if document.Model != fragmodel.DefaultSparseModelName {
		t.Fatalf("expected default sparse model, got %q", document.Model)
	}
	if got := document.Options["language"]; got != "none" {
		t.Fatalf("expected language=none, got %#v", got)
	}
	if got := document.Options["tokenizer"]; got != "multilingual" {
		t.Fatalf("expected tokenizer=multilingual, got %#v", got)
	}
	if got := document.Options["ascii_folding"]; got != true {
		t.Fatalf("expected ascii_folding=true, got %#v", got)
	}
}

func TestBuildSparseVectorFromFragment_PrefersTitleAndTableTitle(t *testing.T) {
	fragment := &fragmodel.KnowledgeBaseFragment{
		DocumentName: "文档A",
		Content:      "退款规则 订单号",
		SectionPath:  "帮助中心 > 售后",
		SectionTitle: "退款规则",
		Metadata: map[string]any{
			retrieval.ParsedMetaTableTitle:        "退款规则",
			retrieval.ParsedMetaPrimaryKeys:       []any{"订单号"},
			retrieval.ParsedMetaPrimaryKeyHeaders: []any{"主键"},
			retrieval.ParsedMetaHeaderPaths:       []any{"售后/退款"},
		},
	}

	vector := retrieval.BuildSparseVectorFromFragment(fragment)
	if vector == nil {
		t.Fatal("expected sparse vector")
	}
	if len(vector.Indices) == 0 || len(vector.Values) == 0 {
		t.Fatalf("expected non-empty sparse vector: %+v", vector)
	}
	if len(vector.Indices) != len(vector.Values) {
		t.Fatalf("expected aligned sparse vector, got %+v", vector)
	}
	if !sort.SliceIsSorted(vector.Indices, func(i, j int) bool {
		return vector.Indices[i] < vector.Indices[j]
	}) {
		t.Fatalf("expected indices sorted, got %+v", vector.Indices)
	}
}

func TestBuildSparseVectorFromQuery_HandlesChineseAndASCII(t *testing.T) {
	vector := retrieval.BuildSparseVectorFromQuery("退款 API 错误码 E1001")
	if vector == nil {
		t.Fatal("expected sparse vector")
	}
	if len(vector.Indices) == 0 || len(vector.Values) == 0 {
		t.Fatalf("expected non-empty sparse vector: %+v", vector)
	}
}

func TestBuildSparseInputFromFragment_SwitchesByBackend(t *testing.T) {
	fragment := &fragmodel.KnowledgeBaseFragment{
		SectionTitle: "退款",
		Content:      "如何退款",
	}

	managed := retrieval.BuildSparseInputFromFragment(fragment, fragmodel.SparseBackendQdrantBM25ZHV1)
	if managed == nil || managed.Document == nil || managed.Vector != nil {
		t.Fatalf("expected managed sparse input, got %+v", managed)
	}

	client := retrieval.BuildSparseInputFromFragment(fragment, fragmodel.SparseBackendClientBM25QdrantIDFV1)
	if client == nil || client.Vector == nil || client.Document != nil {
		t.Fatalf("expected client sparse input, got %+v", client)
	}
}

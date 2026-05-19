package retrieval_test

import (
	"sort"
	"strings"
	"testing"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	retrieval "magic/internal/domain/knowledge/fragment/retrieval"
)

func TestBuildKeywordRetrievalTextFromFragment_UsesFieldAwareBandsAndDedup(t *testing.T) {
	t.Parallel()

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
	if strings.Count(text, "订单号") != 2 {
		t.Fatalf("expected primary key to be boosted in high-value band, got %q", text)
	}
	if strings.Count(text, "主键 列") != 2 {
		t.Fatalf("expected primary key header to be boosted in high-value band, got %q", text)
	}
	for _, want := range []string{"中文", "手册", "退款", "帮助", "中心", "售后", "如何"} {
		if !strings.Contains(text, want) {
			t.Fatalf("expected managed sparse text to retain %q, got %q", want, text)
		}
	}
	for _, unwanted := range []string{">", "/"} {
		if strings.Contains(text, unwanted) {
			t.Fatalf("expected managed sparse text to contain only tokenized terms, got %q", text)
		}
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

func TestSparseSourceUsesGSETokenizedManagedText(t *testing.T) {
	t.Parallel()

	queryDocument := retrieval.BuildKeywordSparseDocumentForQuery("如何处理 APIResponse_v2 的 E1001 错误")
	if queryDocument == nil {
		t.Fatal("expected sparse query document")
	}
	for _, want := range []string{"如何", "处理", "apiresponse", "v2", "e1001", "错误"} {
		if !strings.Contains(strings.ToLower(queryDocument.Text), strings.ToLower(want)) {
			t.Fatalf("expected sparse query document to preserve %q, got %q", want, queryDocument.Text)
		}
	}
	for _, unwanted := range []string{"apiresponse_v2", "_", "的"} {
		if strings.Contains(strings.ToLower(queryDocument.Text), strings.ToLower(unwanted)) {
			t.Fatalf("expected sparse query document to drop %q, got %q", unwanted, queryDocument.Text)
		}
	}

	fragment := &fragmodel.KnowledgeBaseFragment{
		DocumentName: "接口错误码手册",
		Content:      "这里描述错误码和处理方式",
		Metadata: map[string]any{
			retrieval.ParsedMetaPrimaryKeys: []any{"APIResponse_v2", "E1001"},
		},
	}
	managedText := retrieval.BuildKeywordRetrievalTextFromFragment(fragment)
	for _, want := range []string{"apiresponse", "v2"} {
		if !strings.Contains(strings.ToLower(managedText), want) {
			t.Fatalf("expected managed sparse text to keep tokenized high-value term %q, got %q", want, managedText)
		}
	}
	if strings.Count(strings.ToLower(managedText), "e1001") < 2 {
		t.Fatalf("expected managed sparse text to boost high-value token %q, got %q", "e1001", managedText)
	}
	if strings.Contains(managedText, "_") {
		t.Fatalf("expected managed sparse text to drop delimiter tokens, got %q", managedText)
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

func TestBuildKeywordSparseDocumentForQuery_UsesTokenizedQueryText(t *testing.T) {
	t.Parallel()

	query := "如何处理 APIResponse_v2 的 E1001 错误"
	document := retrieval.BuildKeywordSparseDocumentForQuery(query)
	if document == nil {
		t.Fatal("expected sparse document")
	}
	if document.Text == query {
		t.Fatalf("expected sparse document to use tokenized query text, got %q", document.Text)
	}
	if document.Text != "如何 处理 apiresponse v2 e1001 错误" {
		t.Fatalf("unexpected tokenized sparse query document: %q", document.Text)
	}
}

func TestBuildSparseInputFromFragment_LongContentUsesOnlyTokenizedContentForManagedBM25(t *testing.T) {
	t.Parallel()

	content := strings.Repeat("录音问题优化建议。", 24)
	fragment := &fragmodel.KnowledgeBaseFragment{
		Content: content,
	}

	input := retrieval.BuildSparseInputFromFragment(fragment, fragmodel.SparseBackendQdrantBM25ZHV1)
	if input == nil || input.Document == nil {
		t.Fatalf("expected managed sparse document, got %+v", input)
	}
	if strings.Count(input.Document.Text, "问题") != strings.Count(content, "问题") {
		t.Fatalf("expected managed sparse document to keep only tokenized content terms, got %q", input.Document.Text)
	}
	if strings.Contains(input.Document.Text, "。") {
		t.Fatalf("expected managed sparse document to be tokenized without punctuation, got %q", input.Document.Text)
	}
}

func TestBuildSparseInputFromFragment_TableRowUsesTokenizedContentWithoutExtraTerms(t *testing.T) {
	t.Parallel()

	content := strings.Repeat("录音问题优化建议。", 24)
	fragment := &fragmodel.KnowledgeBaseFragment{
		Content: content,
		Metadata: map[string]any{
			retrieval.ParsedMetaChunkType: retrieval.ParsedBlockTypeTableRow,
		},
	}

	input := retrieval.BuildSparseInputFromFragment(fragment, fragmodel.SparseBackendQdrantBM25ZHV1)
	if input == nil || input.Document == nil {
		t.Fatalf("expected managed sparse document, got %+v", input)
	}
	if strings.Count(input.Document.Text, "问题") != strings.Count(content, "问题") {
		t.Fatalf("expected table row sparse document to avoid extra terms, got %q", input.Document.Text)
	}
	if strings.Contains(input.Document.Text, "。") {
		t.Fatalf("expected table row sparse document to be tokenized without punctuation, got %q", input.Document.Text)
	}
}

func BenchmarkBuildKeywordSparseDocumentForQuery(b *testing.B) {
	query := "小哥对录音纪要提出了哪些问题和建议，并说明后续优化负责人和执行顺序"

	b.ResetTimer()
	for b.Loop() {
		_ = retrieval.BuildKeywordSparseDocumentForQuery(query)
	}
}

func BenchmarkBuildSparseInputFromFragmentBatch(b *testing.B) {
	fragments := make([]*fragmodel.KnowledgeBaseFragment, 0, 64)
	content := strings.Repeat("录音问题优化建议。", 24)
	for range 64 {
		fragments = append(fragments, &fragmodel.KnowledgeBaseFragment{
			DocumentName: "会议纪要",
			SectionPath:  "会议纪要 > 讨论要点",
			SectionTitle: "录音优化",
			Content:      content,
		})
	}

	b.ResetTimer()
	for b.Loop() {
		for _, fragment := range fragments {
			_ = retrieval.BuildSparseInputFromFragment(fragment, fragmodel.SparseBackendClientBM25QdrantIDFV1)
		}
	}
}

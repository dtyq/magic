package metadata_test

import (
	"testing"
	"time"

	fragmetadata "magic/internal/domain/knowledge/fragment/metadata"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
)

const testMetadataDocumentCode = "doc-1"

func TestBuildFragmentPayloadSectionPathFallbackFromMetadata(t *testing.T) {
	t.Parallel()

	fragment := &fragmodel.KnowledgeBaseFragment{
		KnowledgeCode: "kb",
		DocumentCode:  "doc",
		Content:       "content",
		Metadata: map[string]any{
			"section_path": "A > B",
		},
	}

	payload := fragmetadata.BuildFragmentPayload(fragment)
	if payload.SectionPath != "A > B" {
		t.Fatalf("expected section path fallback from metadata, got %s", payload.SectionPath)
	}
	if payload.Metadata[fragmetadata.MetadataContractVersionKey] != fragmetadata.FragmentSemanticMetadataContractVersionV1 {
		t.Fatalf("expected metadata contract version %q, got %#v", fragmetadata.FragmentSemanticMetadataContractVersionV1, payload.Metadata[fragmetadata.MetadataContractVersionKey])
	}
}

func TestApplyFragmentMetadataContractV1NormalizesAliases(t *testing.T) {
	t.Parallel()

	fragment := &fragmodel.KnowledgeBaseFragment{
		Content: "正文",
		Metadata: map[string]any{
			"chunkIndex":           3,
			"contentHash":          "hash-123",
			"splitVersion":         "split-v2",
			"retrievalTextVersion": "v9",
			"sectionPath":          "A > B",
			"sectionTitle":         "B",
			"sectionLevel":         2,
			"createdAtTs":          int64(1700000000),
			"documentCode":         "doc-001",
			"documentType":         7,
		},
	}

	restore := fragmetadata.ApplyFragmentMetadataContractV1(fragment)
	if fragment.DocumentCode != "doc-001" || fragment.DocumentType != 7 {
		t.Fatalf("expected document info restored from metadata, got code=%q type=%d", fragment.DocumentCode, fragment.DocumentType)
	}
	if fragment.SectionPath != "A > B" || fragment.SectionTitle != "B" || fragment.SectionLevel != 2 {
		t.Fatalf("expected section metadata restored, got path=%q title=%q level=%d", fragment.SectionPath, fragment.SectionTitle, fragment.SectionLevel)
	}
	if restore.Metadata["chunkIndex"] != nil || restore.Metadata["documentCode"] != nil {
		t.Fatalf("expected alias keys removed after normalization, got %+v", restore.Metadata)
	}
	if restore.Metadata["chunk_index"] != 3 {
		t.Fatalf("expected canonical chunk_index, got %#v", restore.Metadata["chunk_index"])
	}
}

func TestBuildFragmentPayloadCompactsMetadataForVectorStore(t *testing.T) {
	t.Parallel()

	fragment := &fragmodel.KnowledgeBaseFragment{
		ID:               101,
		OrganizationCode: "org-001",
		KnowledgeCode:    "kb-001",
		DocumentCode:     "doc-001",
		DocumentType:     2,
		Content:          "正文",
		Metadata: map[string]any{
			"chunk_index":            1,
			"content_hash":           "hash-001",
			"split_version":          "split-v1",
			"retrieval_text_version": "v1",
			"section_path":           "A > B",
			"section_title":          "B",
			"section_level":          2,
			"created_at_ts":          int64(1700000000),
			"document_code":          "doc-001",
			"document_type":          2,
			"organization_code":      "org-001",
			"document_name":          "测试文档",
			"token_count":            128,
		},
	}

	payload := fragmetadata.BuildFragmentPayload(fragment)
	ext, ok := payload.Metadata["ext"].(map[string]any)
	if !ok {
		t.Fatalf("expected payload metadata ext map, got %#v", payload.Metadata["ext"])
	}
	if _, ok := ext["document_code"]; ok {
		t.Fatalf("did not expect duplicated document_code inside metadata ext: %+v", ext)
	}
	if ext["section_title"] != "B" || ext["token_count"] != 128 {
		t.Fatalf("expected ext to preserve non-filterable metadata, got %+v", ext)
	}
	if payload.Metadata["section_level"] != 2 {
		t.Fatalf("expected section_level kept as filterable metadata, got %#v", payload.Metadata["section_level"])
	}
	if payload.FragmentID != 101 {
		t.Fatalf("expected payload fragment id, got %#v", payload.FragmentID)
	}
}

func TestApplyPayloadMetadataContract(t *testing.T) {
	t.Parallel()

	payload := &fragmodel.FragmentPayload{
		Metadata: map[string]any{
			"chunkIndex":    2,
			"contentHash":   "hash-1",
			"splitVersion":  "split-v1",
			"sectionPath":   "章节一 > 小节二",
			"sectionTitle":  "小节二",
			"documentCode":  testMetadataDocumentCode,
			"documentType":  3,
			"created_at_ts": int64(1700000000),
		},
	}

	flags := fragmetadata.ApplyPayloadMetadataContract(payload)
	if len(flags) == 0 {
		t.Fatal("expected fallback flags")
	}
	if payload.DocumentCode != testMetadataDocumentCode || payload.DocumentType != 3 {
		t.Fatalf("expected document fields restored, got %#v", payload)
	}
	if payload.SectionPath != "章节一 > 小节二" || payload.SectionTitle != "小节二" {
		t.Fatalf("expected section fields restored, got %#v", payload)
	}
	if payload.ContentHash != "hash-1" || payload.SplitVersion != "split-v1" || payload.ChunkIndex != 2 {
		t.Fatalf("expected semantic fields restored, got %#v", payload)
	}
}

func TestBuildFragmentDisplayContent(t *testing.T) {
	t.Parallel()

	got := fragmetadata.BuildFragmentDisplayContent(
		"## 基本信息\n正文",
		nil,
		"录音功能优化讨论会议纪要 > 基本信息",
		"基本信息",
	)
	want := "录音功能优化讨论会议纪要 > 基本信息\n\n## 基本信息\n正文"
	if got != want {
		t.Fatalf("unexpected display content:\nwant: %q\ngot:  %q", want, got)
	}

	got = fragmetadata.BuildFragmentDisplayContent(
		"正文",
		nil,
		"会议纪要 > 讨论要点及总结",
		"1.1 录音转文字界面布局",
	)
	want = "会议纪要 > 讨论要点及总结\n\n1.1 录音转文字界面布局\n\n正文"
	if got != want {
		t.Fatalf("unexpected display content:\nwant: %q\ngot:  %q", want, got)
	}

	got = fragmetadata.BuildFragmentDisplayContent(
		"命中正文\n\n邻接正文",
		map[string]any{
			"context_section_path": "会议纪要 > 讨论要点 > 1.14 原文显示问题",
			"section_path":         "会议纪要 > 讨论要点",
			"section_title":        "1.14 原文显示问题",
		},
		"",
		"",
	)
	want = "会议纪要 > 讨论要点 > 1.14 原文显示问题\n\n命中正文\n\n邻接正文"
	if got != want {
		t.Fatalf("unexpected display content:\nwant: %q\ngot:  %q", want, got)
	}
}

func TestBuildFragmentSemanticMetadataV1MergesBaseAndExtra(t *testing.T) {
	t.Parallel()

	metadata := fragmetadata.BuildFragmentSemanticMetadataV1(
		map[string]any{"chunkIndex": 3, "ext": map[string]any{"from_base": "yes"}},
		fragmetadata.FragmentSemanticMetadataDefaults{
			ContentHash:  "hash-1",
			DocumentCode: testMetadataDocumentCode,
			DocumentType: 2,
		},
		map[string]any{"tags": []string{"a", "a", "b"}, "other": "value"},
	)

	if metadata["chunk_index"] != 3 {
		t.Fatalf("expected canonical chunk index, got %#v", metadata["chunk_index"])
	}
	if metadata["document_code"] != "doc-1" || metadata["document_type"] != 2 {
		t.Fatalf("unexpected normalized metadata: %#v", metadata)
	}
	if metadata["other"] != "value" {
		t.Fatalf("expected extra field preserved, got %#v", metadata["other"])
	}
}

func TestNormalizeFragmentSemanticMetadataV1SupportsExtStringAndBytes(t *testing.T) {
	t.Parallel()

	restore := fragmetadata.NormalizeFragmentSemanticMetadataV1(
		map[string]any{
			"ext":          `{"documentCode":"doc-1"}`,
			"createdAtTs":  []byte(`1700000001`),
			"sectionTitle": "章节",
		},
		fragmetadata.FragmentSemanticMetadataDefaults{},
	)
	if restore.Semantic.DocumentCode != testMetadataDocumentCode {
		t.Fatalf("expected ext string json to be parsed, got %#v", restore.Semantic.DocumentCode)
	}
	if restore.Semantic.SectionTitle != "章节" {
		t.Fatalf("expected direct field preserved, got %#v", restore.Semantic.SectionTitle)
	}
}

func TestNormalizeFragmentSemanticMetadataV1CoercesNumbersAndTags(t *testing.T) {
	t.Parallel()

	restore := fragmetadata.NormalizeFragmentSemanticMetadataV1(
		map[string]any{
			"chunkIndex":   3,
			"sectionLevel": float64(2),
			"createdAtTs":  "1700000000",
			"documentType": uint64(7),
			"tags":         []any{" a ", "b", "", "a"},
			"contentHash":  "hash-1",
			"splitVersion": "split-v1",
			"sectionPath":  "A > B",
			"sectionTitle": "B",
			"documentCode": testMetadataDocumentCode,
		},
		fragmetadata.FragmentSemanticMetadataDefaults{},
	)
	if restore.Semantic.ChunkIndex != 3 || restore.Semantic.SectionLevel != 2 || restore.Semantic.CreatedAtTS != 1700000000 || restore.Semantic.DocumentType != 7 {
		t.Fatalf("unexpected numeric coercion result: %#v", restore.Semantic)
	}
	if len(restore.Semantic.Tags) != 2 || restore.Semantic.Tags[0] != "a" || restore.Semantic.Tags[1] != "b" {
		t.Fatalf("unexpected normalized tags: %#v", restore.Semantic.Tags)
	}
}

func TestBuildFragmentPayloadUsesCreatedAtDefault(t *testing.T) {
	t.Parallel()

	createdAt := time.Unix(1700000000, 0)
	fragment := &fragmodel.KnowledgeBaseFragment{
		DocumentCode: testMetadataDocumentCode,
		DocumentType: 2,
		CreatedAt:    createdAt,
	}

	payload := fragmetadata.BuildFragmentPayload(fragment)
	if payload.Metadata["created_at_ts"] != createdAt.Unix() {
		t.Fatalf("expected created_at_ts %d, got %#v", createdAt.Unix(), payload.Metadata["created_at_ts"])
	}
}

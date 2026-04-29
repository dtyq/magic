package thirdplatform_test

import (
	"encoding/json"
	"testing"

	"magic/internal/pkg/thirdplatform"
)

func TestTreeNodeUnmarshalUsesRawIDAndPathKnowledgeBase(t *testing.T) {
	t.Parallel()

	var node thirdplatform.TreeNode
	err := json.Unmarshal([]byte(`{
		"id": 1002,
		"file_id": 2002,
		"name": "财务.xlsx",
		"file_type": 3,
		"path": [
			{"id": 9001, "name": "知识库", "type": 9},
			{"id": 1002, "name": "财务.xlsx", "type": 3}
		]
	}`), &node)
	if err != nil {
		t.Fatalf("unmarshal tree node: %v", err)
	}

	if node.ThirdFileID != "1002" {
		t.Fatalf("expected third file id from raw id, got %q", node.ThirdFileID)
	}
	if node.FileID != "2002" {
		t.Fatalf("expected raw file id kept, got %q", node.FileID)
	}
	if node.KnowledgeBaseID != "9001" {
		t.Fatalf("expected knowledge base id from path root, got %q", node.KnowledgeBaseID)
	}
	if node.Extension != "xlsx" {
		t.Fatalf("expected extension resolved to xlsx, got %q", node.Extension)
	}
	if node.IsDirectory {
		t.Fatal("expected excel file not directory")
	}
}

func TestTreeNodeUnmarshalSkipsSpacePathPrefixForKnowledgeBaseID(t *testing.T) {
	t.Parallel()

	var node thirdplatform.TreeNode
	err := json.Unmarshal([]byte(`{
		"id": "904433948573548544",
		"name": "空数据",
		"file_type": 3,
		"path": [
			{"id": "0", "name": "企业知识库空间", "type": "space"},
			{"id": "877886470862843904", "name": "梁朋的知识库", "type": "file"},
			{"id": "904433948573548544", "name": "空数据", "type": "file"}
		]
	}`), &node)
	if err != nil {
		t.Fatalf("unmarshal tree node: %v", err)
	}

	if node.KnowledgeBaseID != "877886470862843904" {
		t.Fatalf("expected knowledge base id from path after space prefix, got %q", node.KnowledgeBaseID)
	}
}

func TestTreeNodeUnmarshalMarksFolderByFileType(t *testing.T) {
	t.Parallel()

	var node thirdplatform.TreeNode
	err := json.Unmarshal([]byte(`{
		"file_id": "folder-1",
		"name": "目录1",
		"file_type": 0,
		"path": [
			{"id": "kb-1", "name": "知识库", "type": 9},
			{"id": "folder-1", "name": "目录1", "type": 0}
		]
	}`), &node)
	if err != nil {
		t.Fatalf("unmarshal tree node: %v", err)
	}

	if node.ThirdFileID != "folder-1" {
		t.Fatalf("expected third file id fallback to file_id, got %q", node.ThirdFileID)
	}
	if node.Extension != "" {
		t.Fatalf("expected folder extension empty, got %q", node.Extension)
	}
	if !node.IsDirectory {
		t.Fatal("expected folder file_type to be treated as directory")
	}
}

func TestTreeNodeUnmarshalKeepsRawExtension(t *testing.T) {
	t.Parallel()

	var node thirdplatform.TreeNode
	err := json.Unmarshal([]byte(`{
		"id": "ppt-1",
		"name": "季度汇报",
		"file_type": 5,
		"extension": "PPT",
		"path": [
			{"id": "kb-1", "name": "知识库", "type": 9},
			{"id": "ppt-1", "name": "季度汇报", "type": 5}
		]
	}`), &node)
	if err != nil {
		t.Fatalf("unmarshal tree node: %v", err)
	}

	if node.Extension != "ppt" {
		t.Fatalf("expected raw extension kept after normalize, got %q", node.Extension)
	}
}

func TestTreeNodeUnmarshalFallsBackToNameExtension(t *testing.T) {
	t.Parallel()

	var node thirdplatform.TreeNode
	err := json.Unmarshal([]byte(`{
		"id": "csv-1",
		"name": "销售明细.CSV",
		"file_type": 23,
		"path": [
			{"id": "kb-1", "name": "知识库", "type": 9},
			{"id": "csv-1", "name": "销售明细.CSV", "type": 23}
		]
	}`), &node)
	if err != nil {
		t.Fatalf("unmarshal tree node: %v", err)
	}

	if node.Extension != "csv" {
		t.Fatalf("expected extension resolved from name, got %q", node.Extension)
	}
}

func TestTreeNodeUnmarshalFallsBackToFileTypeExtension(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		payload   string
		extension string
	}{
		{
			name: "cloud_document",
			payload: `{
				"id": "doc-1",
				"name": "云文档",
				"file_type": 16,
				"path": [
					{"id": "kb-1", "name": "知识库", "type": 9},
					{"id": "doc-1", "name": "云文档", "type": 16}
				]
			}`,
			extension: "md",
		},
		{
			name: "md_file_type",
			payload: `{
				"id": "md-1",
				"name": "Markdown文档",
				"file_type": 15,
				"path": [
					{"id": "kb-1", "name": "知识库", "type": 9},
					{"id": "md-1", "name": "Markdown文档", "type": 15}
				]
			}`,
			extension: "md",
		},
		{
			name: "csv_file_type",
			payload: `{
				"id": "csv-2",
				"name": "导出数据",
				"file_type": 23,
				"path": [
					{"id": "kb-1", "name": "知识库", "type": 9},
					{"id": "csv-2", "name": "导出数据", "type": 23}
				]
			}`,
			extension: "csv",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var node thirdplatform.TreeNode
			err := json.Unmarshal([]byte(tc.payload), &node)
			if err != nil {
				t.Fatalf("unmarshal tree node: %v", err)
			}

			if node.Extension != tc.extension {
				t.Fatalf("expected extension %q, got %q", tc.extension, node.Extension)
			}
		})
	}
}

func TestTreeNodeUnmarshalLeavesAmbiguousMediaExtensionEmpty(t *testing.T) {
	t.Parallel()

	var node thirdplatform.TreeNode
	err := json.Unmarshal([]byte(`{
		"id": "image-1",
		"name": "配图资源",
		"file_type": 10,
		"path": [
			{"id": "kb-1", "name": "知识库", "type": 9},
			{"id": "image-1", "name": "配图资源", "type": 10}
		]
	}`), &node)
	if err != nil {
		t.Fatalf("unmarshal tree node: %v", err)
	}

	if node.Extension != "" {
		t.Fatalf("expected ambiguous media extension empty, got %q", node.Extension)
	}
}

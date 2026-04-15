package docapp_test

import (
	"context"
	"reflect"
	"strings"
	"testing"

	appservice "magic/internal/application/knowledge/document/service"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/pkg/tokenizer"
)

func TestSplitParsedDocumentToChunksSharedTokenizerCases(t *testing.T) {
	t.Parallel()
	tokenizerSvc := newSharedTokenizerForTest(t)

	t.Run("SplitsWideRowAndPreservesTabularMetadata", func(t *testing.T) {
		t.Parallel()
		assertTabularSplitPreservesMetadata(t, tokenizerSvc)
	})

	t.Run("KeepsSummaryAsSingleChunk", func(t *testing.T) {
		t.Parallel()
		assertTabularSplitKeepsSummarySingleChunk(t, tokenizerSvc)
	})

	t.Run("RefreshesHeaderPathsAndCellRefsPerSubchunk", func(t *testing.T) {
		t.Parallel()
		assertTabularSplitRefreshesHeaderPathsAndCellRefs(t, tokenizerSvc)
	})
}

func assertTabularSplitPreservesMetadata(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	parsed := &documentdomain.ParsedDocument{
		SourceType: documentdomain.ParsedDocumentSourceTabular,
		Blocks: []documentdomain.ParsedBlock{{
			Type:    documentdomain.ParsedBlockTypeTableRow,
			Content: "ignored",
			Metadata: map[string]any{
				documentdomain.ParsedMetaFileName:     "mock_region_account_table.xlsx",
				documentdomain.ParsedMetaSourceFormat: "csv",
				documentdomain.ParsedMetaChunkType:    documentdomain.ParsedBlockTypeTableRow,
				documentdomain.ParsedMetaSheetName:    "CSV",
				documentdomain.ParsedMetaTableID:      "table-1",
				documentdomain.ParsedMetaTableTitle:   "销售表",
				documentdomain.ParsedMetaRowIndex:     8,
				documentdomain.ParsedMetaPrimaryKeys:  []string{"订单号=SO001"},
				documentdomain.ParsedMetaFields: []map[string]any{
					{"header": "订单号", "value": "SO001"},
					{"header": "客户", "value": "示例客户A"},
					{"header": "区域", "value": "华东"},
					{"header": "产品", "value": "企业版"},
					{"header": "销售经理", "value": "示例成员A"},
					{"header": "金额", "value": "36800"},
				},
			},
		}},
	}

	chunks, splitVersion, err := appservice.SplitParsedDocumentToChunksWithTokenizerForTest(context.Background(), appservice.SplitParsedDocumentToChunksForTestInput{
		ParsedDocument: parsed,
		SourceFileType: "csv",
		RequestedMode:  shared.FragmentModeNormal,
		SegmentConfig:  appservice.PreviewSegmentConfigForTest{ChunkSize: 36, Separator: "\n"},
		Model:          "text-embedding-3-small",
	}, tokenizerSvc)
	if err != nil {
		t.Fatalf("split parsed document: %v", err)
	}
	if splitVersion != "go_split_v3_tabular_structured" {
		t.Fatalf("unexpected split version: %q", splitVersion)
	}
	if len(chunks) < 2 {
		t.Fatalf("expected wide row to split into multiple chunks, got %d", len(chunks))
	}
	for index, chunk := range chunks {
		if chunk.SectionPath != "CSV > 销售表" {
			t.Fatalf("chunk %d unexpected section path: %q", index, chunk.SectionPath)
		}
		if got := chunk.Metadata[documentdomain.ParsedMetaRowIndex]; got != 8 {
			t.Fatalf("chunk %d unexpected row index metadata: %#v", index, got)
		}
		if got := chunk.Metadata[documentdomain.ParsedMetaPrimaryKeys]; got == nil {
			t.Fatalf("chunk %d missing primary keys: %#v", index, chunk.Metadata)
		}
		if got := chunk.Metadata[documentdomain.ParsedMetaFileName]; got != "mock_region_account_table.xlsx" {
			t.Fatalf("chunk %d unexpected file name metadata: %#v", index, got)
		}
		if got := chunk.Content; got == "" || !strings.HasPrefix(got, "文件名: ") {
			t.Fatalf("chunk %d expected file name prefix in content, got %q", index, got)
		}
		if got := chunk.Metadata[documentdomain.ParsedMetaRowSubchunkIndex]; got != index {
			t.Fatalf("chunk %d unexpected subchunk index: %#v", index, got)
		}
		if chunk.EffectiveSplitMode != "table_structured" {
			t.Fatalf("chunk %d unexpected split mode: %q", index, chunk.EffectiveSplitMode)
		}
	}
}

func assertTabularSplitKeepsSummarySingleChunk(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	parsed := &documentdomain.ParsedDocument{
		SourceType: documentdomain.ParsedDocumentSourceTabular,
		Blocks: []documentdomain.ParsedBlock{{
			Type:    documentdomain.ParsedBlockTypeTableSummary,
			Content: "文件名: mock_region_account_table.xlsx\n来源格式: csv\n工作表: CSV\n表格: 销售表\n类型: 表摘要\n总行数: 10",
			Metadata: map[string]any{
				documentdomain.ParsedMetaFileName:     "mock_region_account_table.xlsx",
				documentdomain.ParsedMetaSourceFormat: "csv",
				documentdomain.ParsedMetaChunkType:    documentdomain.ParsedBlockTypeTableSummary,
				documentdomain.ParsedMetaSheetName:    "CSV",
				documentdomain.ParsedMetaTableID:      "table-1",
				documentdomain.ParsedMetaTableTitle:   "销售表",
			},
		}},
	}

	chunks, splitVersion, err := appservice.SplitParsedDocumentToChunksWithTokenizerForTest(context.Background(), appservice.SplitParsedDocumentToChunksForTestInput{
		ParsedDocument: parsed,
		SourceFileType: "csv",
		RequestedMode:  shared.FragmentModeNormal,
		SegmentConfig:  appservice.PreviewSegmentConfigForTest{ChunkSize: 20, Separator: "\n"},
		Model:          "text-embedding-3-small",
	}, tokenizerSvc)
	if err != nil {
		t.Fatalf("split parsed document: %v", err)
	}
	if splitVersion != "go_split_v3_tabular_structured" {
		t.Fatalf("unexpected split version: %q", splitVersion)
	}
	if len(chunks) != 1 {
		t.Fatalf("expected summary to stay as one chunk, got %d", len(chunks))
	}
	if got := chunks[0].Metadata[documentdomain.ParsedMetaChunkType]; got != documentdomain.ParsedBlockTypeTableSummary {
		t.Fatalf("unexpected summary metadata: %#v", chunks[0].Metadata)
	}
	if got := chunks[0].Metadata[documentdomain.ParsedMetaFileName]; got != "mock_region_account_table.xlsx" {
		t.Fatalf("unexpected summary file name metadata: %#v", got)
	}
	if got := chunks[0].Content; got == "" || !strings.HasPrefix(got, "文件名: ") {
		t.Fatalf("expected summary content to include file name, got %q", got)
	}
}

func assertTabularSplitRefreshesHeaderPathsAndCellRefs(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	parsed := &documentdomain.ParsedDocument{
		SourceType: documentdomain.ParsedDocumentSourceTabular,
		Blocks: []documentdomain.ParsedBlock{{
			Type:    documentdomain.ParsedBlockTypeTableRow,
			Content: "ignored",
			Metadata: map[string]any{
				documentdomain.ParsedMetaFileName:     "mock_region_account_table.xlsx",
				documentdomain.ParsedMetaSourceFormat: "xlsx",
				documentdomain.ParsedMetaChunkType:    documentdomain.ParsedBlockTypeTableRow,
				documentdomain.ParsedMetaSheetName:    "Sheet1",
				documentdomain.ParsedMetaTableID:      "table-1",
				documentdomain.ParsedMetaTableTitle:   "销售表",
				documentdomain.ParsedMetaRowIndex:     2,
				documentdomain.ParsedMetaPrimaryKeys:  []string{"订单号=SO001"},
				documentdomain.ParsedMetaFields: []map[string]any{
					{"header": "订单号", "header_path": "订单号", "value": "SO001", "cell_ref": "A2"},
					{"header": "客户", "header_path": "客户", "value": "示例客户A", "cell_ref": "B2"},
					{"header": "结算账户信息", "header_path": "结算账户信息", "value": "账户名：示例结算主体A\n账号：MOCK-ACCOUNT-0001", "cell_ref": "B2"},
					{"header": "区域", "header_path": "区域", "value": "华东", "cell_ref": "C2"},
					{"header": "金额", "header_path": "金额", "value": "36800", "cell_ref": "D2"},
				},
			},
		}},
	}

	chunks, _, err := appservice.SplitParsedDocumentToChunksWithTokenizerForTest(context.Background(), appservice.SplitParsedDocumentToChunksForTestInput{
		ParsedDocument: parsed,
		SourceFileType: "xlsx",
		RequestedMode:  shared.FragmentModeNormal,
		SegmentConfig:  appservice.PreviewSegmentConfigForTest{ChunkSize: 24, Separator: "\n"},
		Model:          "text-embedding-3-small",
	}, tokenizerSvc)
	if err != nil {
		t.Fatalf("split parsed document: %v", err)
	}
	if len(chunks) < 2 {
		t.Fatalf("expected row split into at least 2 chunks, got %d", len(chunks))
	}

	for index, chunk := range chunks {
		assertTabularChunkMetadata(t, index, chunk)
	}
}

func assertTabularChunkMetadata(t *testing.T, index int, chunk appservice.TokenChunkForTest) {
	t.Helper()

	headers, ok := chunk.Metadata[documentdomain.ParsedMetaHeaderPaths].([]string)
	if !ok {
		t.Fatalf("chunk %d expected []string headers, got %#v", index, chunk.Metadata[documentdomain.ParsedMetaHeaderPaths])
	}
	cellRefs, ok := chunk.Metadata[documentdomain.ParsedMetaCellRefs].(map[string]string)
	if !ok {
		t.Fatalf("chunk %d expected cell refs map, got %#v", index, chunk.Metadata[documentdomain.ParsedMetaCellRefs])
	}
	if len(headers) == 0 || len(headers) != len(cellRefs) {
		t.Fatalf("chunk %d expected aligned headers and cell refs, got headers=%#v cellRefs=%#v", index, headers, cellRefs)
	}
	for _, header := range headers {
		if _, exists := cellRefs[header]; !exists {
			t.Fatalf("chunk %d missing cell ref for header %q in %#v", index, header, cellRefs)
		}
	}
	fields, ok := chunk.Metadata[documentdomain.ParsedMetaFields].([]map[string]any)
	if !ok || len(fields) == 0 {
		t.Fatalf("chunk %d expected field metadata maps, got %#v", index, chunk.Metadata[documentdomain.ParsedMetaFields])
	}
	for _, field := range fields {
		if field["header_path"] == nil {
			t.Fatalf("chunk %d expected header_path in field metadata, got %#v", index, field)
		}
	}
	if got := chunk.Metadata[documentdomain.ParsedMetaPrimaryKeys]; !reflect.DeepEqual(got, []string{"订单号=SO001"}) {
		t.Fatalf("chunk %d lost primary keys, got %#v", index, got)
	}
	if strings.Contains(chunk.Content, "结算账户信息：") && !strings.Contains(chunk.Content, "结算账户信息：\n  - 账户名：示例结算主体A") {
		t.Fatalf("chunk %d expected multiline field rendered under parent header, got %q", index, chunk.Content)
	}
}

package docapp_test

import (
	"context"
	"reflect"
	"strings"
	"testing"

	appservice "magic/internal/application/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/domain/knowledge/shared/parseddocument"
	"magic/internal/pkg/tokenizer"
)

func TestSplitParsedDocumentToChunksSharedTokenizerCases(t *testing.T) {
	t.Parallel()
	tokenizerSvc := newSharedTokenizerForTest(t)

	t.Run("SplitsWideRowAndPreservesTabularMetadata", func(t *testing.T) {
		t.Parallel()
		assertTabularSplitPreservesMetadata(t, tokenizerSvc)
	})

	t.Run("KeepsNarrowRowAsSingleChunk", func(t *testing.T) {
		t.Parallel()
		assertTabularSplitKeepsNarrowRowSingleChunk(t, tokenizerSvc)
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

	parsed := &parseddocument.ParsedDocument{
		SourceType: parseddocument.SourceTabular,
		Blocks: []parseddocument.ParsedBlock{{
			Type:    parseddocument.BlockTypeTableRow,
			Content: "ignored",
			Metadata: map[string]any{
				parseddocument.MetaFileName:     "mock_region_account_table.xlsx",
				parseddocument.MetaSourceFormat: "csv",
				parseddocument.MetaChunkType:    parseddocument.BlockTypeTableRow,
				parseddocument.MetaSheetName:    "CSV",
				parseddocument.MetaTableID:      "table-1",
				parseddocument.MetaTableTitle:   "销售表",
				parseddocument.MetaRowIndex:     8,
				parseddocument.MetaPrimaryKeys:  []string{"订单号=SO001"},
				parseddocument.MetaFields: []map[string]any{
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
	seenHeaders := make(map[string]struct{}, 6)
	for index, chunk := range chunks {
		assertWideRowChunkMetadata(t, index, chunk)
		recordWideRowHeaders(t, index, chunk, seenHeaders)
	}
	if len(seenHeaders) != 6 {
		t.Fatalf("expected all row fields to be covered exactly once, got %#v", seenHeaders)
	}
}

func assertTabularSplitKeepsNarrowRowSingleChunk(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	parsed := &parseddocument.ParsedDocument{
		SourceType: parseddocument.SourceTabular,
		Blocks: []parseddocument.ParsedBlock{{
			Type:    parseddocument.BlockTypeTableRow,
			Content: "ignored",
			Metadata: map[string]any{
				parseddocument.MetaFileName:     "mock_region_account_table.xlsx",
				parseddocument.MetaSourceFormat: "xlsx",
				parseddocument.MetaChunkType:    parseddocument.BlockTypeTableRow,
				parseddocument.MetaSheetName:    "Sheet1",
				parseddocument.MetaTableID:      "table-1",
				parseddocument.MetaTableTitle:   "销售表",
				parseddocument.MetaRowIndex:     2,
				parseddocument.MetaPrimaryKeys:  []string{"订单号=SO002"},
				parseddocument.MetaFields: []map[string]any{
					{"header": "订单号", "value": "SO002"},
					{"header": "客户", "value": "示例客户B"},
					{"header": "区域", "value": "华北"},
				},
			},
		}},
	}

	chunks, _, err := appservice.SplitParsedDocumentToChunksWithTokenizerForTest(context.Background(), appservice.SplitParsedDocumentToChunksForTestInput{
		ParsedDocument: parsed,
		SourceFileType: "xlsx",
		RequestedMode:  shared.FragmentModeNormal,
		SegmentConfig:  appservice.PreviewSegmentConfigForTest{ChunkSize: 200, Separator: "\n"},
		Model:          "text-embedding-3-small",
	}, tokenizerSvc)
	if err != nil {
		t.Fatalf("split parsed document: %v", err)
	}
	if len(chunks) != 1 {
		t.Fatalf("expected narrow row to stay as one chunk, got %d", len(chunks))
	}

	chunk := chunks[0]
	fields, ok := chunk.Metadata[parseddocument.MetaFields].([]map[string]any)
	if !ok || len(fields) != 3 {
		t.Fatalf("expected single chunk to keep all row fields, got %#v", chunk.Metadata[parseddocument.MetaFields])
	}
	if got := chunk.Metadata[parseddocument.MetaRowSubchunkIndex]; got != 0 {
		t.Fatalf("expected narrow row subchunk index 0, got %#v", got)
	}
	if !strings.Contains(chunk.Content, "订单号：SO002") || !strings.Contains(chunk.Content, "客户：示例客户B") || !strings.Contains(chunk.Content, "区域：华北") {
		t.Fatalf("expected narrow row content to include all fields, got %q", chunk.Content)
	}
}

func assertTabularSplitKeepsSummarySingleChunk(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	parsed := &parseddocument.ParsedDocument{
		SourceType: parseddocument.SourceTabular,
		Blocks: []parseddocument.ParsedBlock{{
			Type:    parseddocument.BlockTypeTableSummary,
			Content: "文件名: mock_region_account_table.xlsx\n来源格式: csv\n工作表: CSV\n表格: 销售表\n类型: 表摘要\n总行数: 10",
			Metadata: map[string]any{
				parseddocument.MetaFileName:     "mock_region_account_table.xlsx",
				parseddocument.MetaSourceFormat: "csv",
				parseddocument.MetaChunkType:    parseddocument.BlockTypeTableSummary,
				parseddocument.MetaSheetName:    "CSV",
				parseddocument.MetaTableID:      "table-1",
				parseddocument.MetaTableTitle:   "销售表",
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
	if got := chunks[0].Metadata[parseddocument.MetaChunkType]; got != parseddocument.BlockTypeTableSummary {
		t.Fatalf("unexpected summary metadata: %#v", chunks[0].Metadata)
	}
	if got := chunks[0].Metadata[parseddocument.MetaFileName]; got != "mock_region_account_table.xlsx" {
		t.Fatalf("unexpected summary file name metadata: %#v", got)
	}
	if got := chunks[0].Content; got == "" || !strings.HasPrefix(got, "文件名: ") {
		t.Fatalf("expected summary content to include file name, got %q", got)
	}
}

func assertTabularSplitRefreshesHeaderPathsAndCellRefs(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	parsed := &parseddocument.ParsedDocument{
		SourceType: parseddocument.SourceTabular,
		Blocks: []parseddocument.ParsedBlock{{
			Type:    parseddocument.BlockTypeTableRow,
			Content: "ignored",
			Metadata: map[string]any{
				parseddocument.MetaFileName:     "mock_region_account_table.xlsx",
				parseddocument.MetaSourceFormat: "xlsx",
				parseddocument.MetaChunkType:    parseddocument.BlockTypeTableRow,
				parseddocument.MetaSheetName:    "Sheet1",
				parseddocument.MetaTableID:      "table-1",
				parseddocument.MetaTableTitle:   "销售表",
				parseddocument.MetaRowIndex:     2,
				parseddocument.MetaPrimaryKeys:  []string{"订单号=SO001"},
				parseddocument.MetaFields: []map[string]any{
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

	headers, ok := chunk.Metadata[parseddocument.MetaHeaderPaths].([]string)
	if !ok {
		t.Fatalf("chunk %d expected []string headers, got %#v", index, chunk.Metadata[parseddocument.MetaHeaderPaths])
	}
	cellRefs, ok := chunk.Metadata[parseddocument.MetaCellRefs].(map[string]string)
	if !ok {
		t.Fatalf("chunk %d expected cell refs map, got %#v", index, chunk.Metadata[parseddocument.MetaCellRefs])
	}
	if len(headers) == 0 || len(headers) != len(cellRefs) {
		t.Fatalf("chunk %d expected aligned headers and cell refs, got headers=%#v cellRefs=%#v", index, headers, cellRefs)
	}
	for _, header := range headers {
		if _, exists := cellRefs[header]; !exists {
			t.Fatalf("chunk %d missing cell ref for header %q in %#v", index, header, cellRefs)
		}
	}
	fields, ok := chunk.Metadata[parseddocument.MetaFields].([]map[string]any)
	if !ok || len(fields) == 0 {
		t.Fatalf("chunk %d expected field metadata maps, got %#v", index, chunk.Metadata[parseddocument.MetaFields])
	}
	for _, field := range fields {
		if field["header_path"] == nil {
			t.Fatalf("chunk %d expected header_path in field metadata, got %#v", index, field)
		}
	}
	if got := chunk.Metadata[parseddocument.MetaPrimaryKeys]; !reflect.DeepEqual(got, []string{"订单号=SO001"}) {
		t.Fatalf("chunk %d lost primary keys, got %#v", index, got)
	}
	if strings.Contains(chunk.Content, "结算账户信息：") && !strings.Contains(chunk.Content, "结算账户信息：\n  - 账户名：示例结算主体A") {
		t.Fatalf("chunk %d expected multiline field rendered under parent header, got %q", index, chunk.Content)
	}
}

func assertWideRowChunkMetadata(t *testing.T, index int, chunk appservice.TokenChunkForTest) {
	t.Helper()

	if chunk.SectionPath != "CSV > 销售表" {
		t.Fatalf("chunk %d unexpected section path: %q", index, chunk.SectionPath)
	}
	if got := chunk.Metadata[parseddocument.MetaRowIndex]; got != 8 {
		t.Fatalf("chunk %d unexpected row index metadata: %#v", index, got)
	}
	if got := chunk.Metadata[parseddocument.MetaPrimaryKeys]; got == nil {
		t.Fatalf("chunk %d missing primary keys: %#v", index, chunk.Metadata)
	}
	if got := chunk.Metadata[parseddocument.MetaFileName]; got != "mock_region_account_table.xlsx" {
		t.Fatalf("chunk %d unexpected file name metadata: %#v", index, got)
	}
	if got := chunk.Content; got == "" || !strings.HasPrefix(got, "文件名: ") {
		t.Fatalf("chunk %d expected file name prefix in content, got %q", index, got)
	}
	if got := chunk.Metadata[parseddocument.MetaRowSubchunkIndex]; got != index {
		t.Fatalf("chunk %d unexpected subchunk index: %#v", index, got)
	}
	if chunk.EffectiveSplitMode != "table_structured" {
		t.Fatalf("chunk %d unexpected split mode: %q", index, chunk.EffectiveSplitMode)
	}
}

func recordWideRowHeaders(t *testing.T, index int, chunk appservice.TokenChunkForTest, seenHeaders map[string]struct{}) {
	t.Helper()

	fields, ok := chunk.Metadata[parseddocument.MetaFields].([]map[string]any)
	if !ok || len(fields) == 0 {
		t.Fatalf("chunk %d expected field metadata maps, got %#v", index, chunk.Metadata[parseddocument.MetaFields])
	}
	if len(fields) == 6 {
		t.Fatalf("chunk %d unexpectedly kept the entire wide row in a single chunk: %#v", index, fields)
	}
	for _, field := range fields {
		header, _ := field["header"].(string)
		if _, exists := seenHeaders[header]; exists {
			t.Fatalf("chunk %d duplicated header %q across subchunks", index, header)
		}
		seenHeaders[header] = struct{}{}
	}
}

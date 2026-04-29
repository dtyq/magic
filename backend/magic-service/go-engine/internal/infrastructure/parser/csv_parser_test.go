package docparser_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	document "magic/internal/domain/knowledge/document/metadata"
	parser "magic/internal/infrastructure/parser"
)

func TestCSVParser_Parse(t *testing.T) {
	t.Parallel()
	p := parser.NewCSVParser()
	input := "a,b\nc,d\n"
	out, err := p.Parse(context.Background(), "", strings.NewReader(input), "csv")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "工作表: CSV") {
		t.Fatalf("expected csv sheet context, got %q", out)
	}
	if !strings.Contains(out, "字段列表: a, b") {
		t.Fatalf("expected header summary, got %q", out)
	}
	if !strings.Contains(out, "- a: c") || !strings.Contains(out, "- b: d") {
		t.Fatalf("unexpected output: %q", out)
	}
}

func TestCSVParser_ParseDocumentRejectsTooManyRows(t *testing.T) {
	t.Parallel()

	p := parser.NewCSVParserWithLimits(document.ResourceLimits{
		MaxTabularRows:  2,
		MaxTabularCells: 100,
	})
	input := "a,b\n1,2\n3,4\n"
	_, err := p.ParseDocument(context.Background(), "large.csv", strings.NewReader(input), "csv")
	if !errors.Is(err, document.ErrDocumentResourceLimitExceeded) {
		t.Fatalf("expected resource limit error, got %v", err)
	}
}

func TestCSVParser_ParseDocumentRejectsTooManyCells(t *testing.T) {
	t.Parallel()

	p := parser.NewCSVParserWithLimits(document.ResourceLimits{
		MaxTabularRows:  100,
		MaxTabularCells: 3,
	})
	input := "a,b\n1,2\n"
	_, err := p.ParseDocument(context.Background(), "large.csv", strings.NewReader(input), "csv")
	if !errors.Is(err, document.ErrDocumentResourceLimitExceeded) {
		t.Fatalf("expected resource limit error, got %v", err)
	}
}

func TestCSVParser_Supports(t *testing.T) {
	t.Parallel()
	p := parser.NewCSVParser()
	if !p.Supports("CSV") {
		t.Fatalf("expected CSV supported")
	}
	if p.Supports("txt") {
		t.Fatalf("expected txt not supported")
	}
}

func TestCSVParser_ParseDocumentBuildsStructuredBlocks(t *testing.T) {
	t.Parallel()
	p := parser.NewCSVParser()
	parsed, err := p.ParseDocument(context.Background(), "DT001/open/mock_region_account_table.csv", strings.NewReader("订单号,客户,金额\nSO001,示例客户A,100\n"), "csv")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if parsed == nil || parsed.SourceType != document.ParsedDocumentSourceTabular {
		t.Fatalf("expected tabular parsed document, got %#v", parsed)
	}
	if len(parsed.Blocks) != 2 {
		t.Fatalf("expected 2 blocks, got %d", len(parsed.Blocks))
	}
	if parsed.Blocks[0].Type != document.ParsedBlockTypeTableSummary {
		t.Fatalf("expected first block summary, got %s", parsed.Blocks[0].Type)
	}
	if parsed.Blocks[1].Metadata[document.ParsedMetaChunkType] != document.ParsedBlockTypeTableRow {
		t.Fatalf("expected row block metadata, got %#v", parsed.Blocks[1].Metadata)
	}
	if !strings.Contains(parsed.Blocks[1].Content, "主键: 订单号=SO001") {
		t.Fatalf("expected primary key in row block, got %q", parsed.Blocks[1].Content)
	}
	if got := parsed.Blocks[1].Metadata[document.ParsedMetaFileName]; got != "mock_region_account_table.csv" {
		t.Fatalf("expected file name metadata, got %#v", got)
	}
	if !strings.Contains(parsed.Blocks[1].Content, "文件名: mock_region_account_table.csv") {
		t.Fatalf("expected file name in row content, got %q", parsed.Blocks[1].Content)
	}
}

func TestCSVParser_ParseDocumentDetectsDelimiterAndQuotedField(t *testing.T) {
	t.Parallel()
	p := parser.NewCSVParser()
	input := "订单号;备注;金额\nSO001;\"华东,重点客户\";100\n"
	parsed, err := p.ParseDocument(context.Background(), "", strings.NewReader(input), "csv")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(parsed.Blocks) != 2 {
		t.Fatalf("expected 2 blocks, got %d", len(parsed.Blocks))
	}
	rowBlock := parsed.Blocks[1]
	if !strings.Contains(rowBlock.Content, "备注: 华东,重点客户") {
		t.Fatalf("expected quoted field preserved, got %q", rowBlock.Content)
	}
}

func TestCSVParser_ParseDocumentFallsBackToGeneratedHeaders(t *testing.T) {
	t.Parallel()
	p := parser.NewCSVParser()
	input := "1|示例成员A|88\n2|示例成员B|92\n"
	parsed, err := p.ParseDocument(context.Background(), "", strings.NewReader(input), "csv")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(parsed.Blocks) != 3 {
		t.Fatalf("expected 3 blocks, got %d", len(parsed.Blocks))
	}
	summaryBlock := parsed.Blocks[0]
	if !strings.Contains(summaryBlock.Content, "字段列表: column_1, column_2, column_3") {
		t.Fatalf("expected generated headers in summary, got %q", summaryBlock.Content)
	}
	firstRowBlock := parsed.Blocks[1]
	if !strings.Contains(firstRowBlock.Content, "主键: column_2=示例成员A") {
		t.Fatalf("expected text-like fallback primary key, got %q", firstRowBlock.Content)
	}
}

func TestCSVParser_ParseDocumentDetectsTabDelimiterAndBuildsSummaryStats(t *testing.T) {
	t.Parallel()
	p := parser.NewCSVParser()
	input := "员工\t部门\t金额\n示例成员A\t示例部门\t10\n示例成员B\t示例部门\t20\n"
	parsed, err := p.ParseDocument(context.Background(), "", strings.NewReader(input), "csv")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(parsed.Blocks) != 3 {
		t.Fatalf("expected 3 blocks, got %d", len(parsed.Blocks))
	}
	summaryBlock := parsed.Blocks[0]
	if !strings.Contains(summaryBlock.Content, "字段列表: 员工, 部门, 金额") {
		t.Fatalf("expected tab delimiter parsed into three headers, got %q", summaryBlock.Content)
	}
	if !strings.Contains(summaryBlock.Content, "- 金额: count=2, min=10, max=20, avg=15, sum=30") {
		t.Fatalf("expected numeric summary stats, got %q", summaryBlock.Content)
	}
}

func TestCSVParser_ParseDocumentPreservesEscapedQuotes(t *testing.T) {
	t.Parallel()
	p := parser.NewCSVParser()
	input := "订单号,备注\nSO001,\"客户说\"\"优先处理\"\"\"\n"
	parsed, err := p.ParseDocument(context.Background(), "", strings.NewReader(input), "csv")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(parsed.Blocks) != 2 {
		t.Fatalf("expected 2 blocks, got %d", len(parsed.Blocks))
	}
	if !strings.Contains(parsed.Blocks[1].Content, "备注: 客户说\"优先处理\"") {
		t.Fatalf("expected escaped quotes preserved, got %q", parsed.Blocks[1].Content)
	}
}

func TestCSVParser_ParseDocumentWithOptions_DisablesTabularExtraction(t *testing.T) {
	t.Parallel()

	p := parser.NewCSVParser()
	parsed, err := p.ParseDocumentWithOptions(
		context.Background(),
		"",
		strings.NewReader("a,b\nc,d\n"),
		"csv",
		document.ParseOptions{
			ParsingType:     document.ParsingTypePrecise,
			ImageExtraction: false,
			TableExtraction: false,
			ImageOCR:        false,
		},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if parsed.SourceType != document.ParsedDocumentSourceText {
		t.Fatalf("expected plain text parsed document, got %#v", parsed)
	}
	if got := parsed.BestEffortText(); got != "a,b\nc,d" {
		t.Fatalf("unexpected plain text result: %q", got)
	}
}

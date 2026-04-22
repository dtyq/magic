package docparser_test

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/xuri/excelize/v2"

	"magic/internal/domain/knowledge/document/service"
	parser "magic/internal/infrastructure/parser"
)

func TestXlsxParser_Parse(t *testing.T) {
	t.Parallel()
	f := excelize.NewFile()
	_ = f.SetCellValue("Sheet1", "A1", "hello")
	buf, err := f.WriteToBuffer()
	if err != nil {
		t.Fatalf("write buffer: %v", err)
	}
	p := parser.NewXlsxParser()
	out, err := p.Parse(context.Background(), "", bytes.NewReader(buf.Bytes()), "xlsx")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "Sheet: Sheet1") {
		if !strings.Contains(out, "工作表: Sheet1") {
			t.Fatalf("expected sheet name, got %q", out)
		}
	}
	if !strings.Contains(out, "hello") {
		t.Fatalf("expected cell content, got %q", out)
	}
}

func TestXlsxParser_ParseDocumentMergesImageOCRIntoHeaderField(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()
	imagePath := filepath.Join(tmpDir, "sheet-image.png")
	writeTestPNG(t, imagePath)
	imageBytes, err := os.ReadFile(imagePath)
	if err != nil {
		t.Fatalf("read image: %v", err)
	}

	f := excelize.NewFile()
	_ = f.SetCellValue("Sheet1", "A1", "门店")
	_ = f.SetCellValue("Sheet1", "B1", "说明")
	_ = f.SetCellValue("Sheet1", "A2", "测试门店")
	if err := f.AddPictureFromBytes("Sheet1", "B2", &excelize.Picture{
		Extension: ".png",
		File:      imageBytes,
	}); err != nil {
		t.Fatalf("add picture: %v", err)
	}

	buf, err := f.WriteToBuffer()
	if err != nil {
		t.Fatalf("write buffer: %v", err)
	}

	p := parser.NewXlsxParserWithOCR(&fakeDocxOCR{textsByType: map[string]string{"png": "图片字段关键词"}}, 20)
	parsed, err := p.ParseDocument(context.Background(), "", bytes.NewReader(buf.Bytes()), "xlsx")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(parsed.Blocks) != 1 {
		t.Fatalf("expected 1 row block, got %d", len(parsed.Blocks))
	}
	if !strings.Contains(parsed.Blocks[0].Content, "说明：图片字段关键词") {
		t.Fatalf("expected OCR text merged into business field, got %q", parsed.Blocks[0].Content)
	}
	if got := parsed.DocumentMeta[document.ParsedMetaEmbeddedImageOCRSuccessCount]; got != 1 {
		t.Fatalf("expected 1 OCR success, got %#v", got)
	}
}

func TestXlsxParser_Supports(t *testing.T) {
	t.Parallel()
	p := parser.NewXlsxParser()
	if !p.Supports("XLSX") || !p.Supports("xlsm") {
		t.Fatalf("expected xlsx/xlsm supported")
	}
	if p.Supports("csv") {
		t.Fatalf("expected csv not supported")
	}
}

func TestXlsxParser_ParseDocumentFlattensMergedHeaders(t *testing.T) {
	t.Parallel()
	f := excelize.NewFile()
	_ = f.MergeCell("Sheet1", "A1", "B1")
	_ = f.SetCellValue("Sheet1", "A1", "销售")
	_ = f.SetCellValue("Sheet1", "A2", "地区")
	_ = f.SetCellValue("Sheet1", "B2", "金额")
	_ = f.SetCellValue("Sheet1", "A3", "华东")
	_ = f.SetCellValue("Sheet1", "B3", "100")
	buf, err := f.WriteToBuffer()
	if err != nil {
		t.Fatalf("write buffer: %v", err)
	}

	p := parser.NewXlsxParser()
	parsed, err := p.ParseDocument(context.Background(), "", bytes.NewReader(buf.Bytes()), "xlsx")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if parsed == nil || parsed.SourceType != document.ParsedDocumentSourceTabular {
		t.Fatalf("expected tabular parsed document, got %#v", parsed)
	}
	if len(parsed.Blocks) != 1 {
		t.Fatalf("expected 1 row block, got %d", len(parsed.Blocks))
	}
	if strings.Contains(parsed.Blocks[0].Content, "销售 / 地区：华东") {
		t.Fatalf("expected merged title row excluded from headers, got %q", parsed.Blocks[0].Content)
	}
	if !strings.Contains(parsed.Blocks[0].Content, "地区：华东") {
		t.Fatalf("expected clean business header path in row content, got %q", parsed.Blocks[0].Content)
	}
	if !strings.Contains(parsed.Blocks[0].Content, "金额：100") {
		t.Fatalf("expected clean numeric header path, got %q", parsed.Blocks[0].Content)
	}
}

func TestXlsxParser_ParseDocumentMarksHiddenSheetAndFormula(t *testing.T) {
	t.Parallel()
	f := excelize.NewFile()
	if err := f.SetSheetName("Sheet1", "Visible"); err != nil {
		t.Fatalf("set sheet name: %v", err)
	}
	hiddenIndex, err := f.NewSheet("Hidden")
	if err != nil {
		t.Fatalf("new sheet: %v", err)
	}
	if err := f.SetSheetVisible("Hidden", false, false); err != nil {
		t.Fatalf("set hidden: %v", err)
	}
	f.SetActiveSheet(hiddenIndex)
	_ = f.SetCellValue("Hidden", "A1", "订单号")
	_ = f.SetCellValue("Hidden", "B1", "金额")
	_ = f.SetCellValue("Hidden", "A2", "SO001")
	_ = f.SetCellFormula("Hidden", "B2", "=40+2")

	buf, err := f.WriteToBuffer()
	if err != nil {
		t.Fatalf("write buffer: %v", err)
	}

	p := parser.NewXlsxParser()
	parsed, err := p.ParseDocument(context.Background(), "", bytes.NewReader(buf.Bytes()), "xlsx")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(parsed.Blocks) != 1 {
		t.Fatalf("expected 1 row block, got %d", len(parsed.Blocks))
	}
	rowBlock := parsed.Blocks[0]
	if rowBlock.Metadata[document.ParsedMetaSheetHidden] != true {
		t.Fatalf("expected hidden sheet metadata, got %#v", rowBlock.Metadata)
	}
	if rowBlock.Metadata[document.ParsedMetaHasFormula] != true {
		t.Fatalf("expected formula metadata, got %#v", rowBlock.Metadata)
	}
}

func TestXlsxParser_ParseDocumentDetectsMultipleTablesPerSheet(t *testing.T) {
	t.Parallel()
	f := excelize.NewFile()
	_ = f.SetCellValue("Sheet1", "A1", "订单号")
	_ = f.SetCellValue("Sheet1", "B1", "金额")
	_ = f.SetCellValue("Sheet1", "A2", "SO001")
	_ = f.SetCellValue("Sheet1", "B2", "100")
	_ = f.SetCellValue("Sheet1", "A4", "员工")
	_ = f.SetCellValue("Sheet1", "B4", "部门")
	_ = f.SetCellValue("Sheet1", "A5", "示例成员A")
	_ = f.SetCellValue("Sheet1", "B5", "示例部门")

	buf, err := f.WriteToBuffer()
	if err != nil {
		t.Fatalf("write buffer: %v", err)
	}

	p := parser.NewXlsxParser()
	parsed, err := p.ParseDocument(context.Background(), "", bytes.NewReader(buf.Bytes()), "xlsx")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(parsed.Blocks) != 2 {
		t.Fatalf("expected 2 row blocks, got %d", len(parsed.Blocks))
	}
	if parsed.Blocks[0].Metadata[document.ParsedMetaTableID] == parsed.Blocks[1].Metadata[document.ParsedMetaTableID] {
		t.Fatalf("expected different table ids, got %#v and %#v", parsed.Blocks[0].Metadata, parsed.Blocks[1].Metadata)
	}
}

func TestXlsxParser_ParseDocumentDetectsMultipleSheets(t *testing.T) {
	t.Parallel()
	f := excelize.NewFile()
	_ = f.SetCellValue("Sheet1", "A1", "订单号")
	_ = f.SetCellValue("Sheet1", "B1", "金额")
	_ = f.SetCellValue("Sheet1", "A2", "SO001")
	_ = f.SetCellValue("Sheet1", "B2", "100")
	_, err := f.NewSheet("Sheet2")
	if err != nil {
		t.Fatalf("new sheet: %v", err)
	}
	_ = f.SetCellValue("Sheet2", "A1", "员工")
	_ = f.SetCellValue("Sheet2", "B1", "部门")
	_ = f.SetCellValue("Sheet2", "A2", "示例成员A")
	_ = f.SetCellValue("Sheet2", "B2", "示例部门")

	buf, err := f.WriteToBuffer()
	if err != nil {
		t.Fatalf("write buffer: %v", err)
	}

	p := parser.NewXlsxParser()
	parsed, err := p.ParseDocument(context.Background(), "", bytes.NewReader(buf.Bytes()), "xlsx")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(parsed.Blocks) != 2 {
		t.Fatalf("expected 2 row blocks, got %d", len(parsed.Blocks))
	}
	if parsed.Blocks[0].Metadata[document.ParsedMetaSheetName] != "Sheet1" {
		t.Fatalf("expected first summary block from Sheet1, got %#v", parsed.Blocks[0].Metadata)
	}
	if parsed.Blocks[1].Metadata[document.ParsedMetaSheetName] != "Sheet2" {
		t.Fatalf("expected second row block from Sheet2, got %#v", parsed.Blocks[1].Metadata)
	}
}

func TestXlsxParser_ParseDocumentWithOptions_DisablesTableExtraction(t *testing.T) {
	t.Parallel()

	f := excelize.NewFile()
	_ = f.SetCellValue("Sheet1", "A1", "门店")
	_ = f.SetCellValue("Sheet1", "B1", "说明")
	_ = f.SetCellValue("Sheet1", "A2", "测试门店")
	_ = f.SetCellValue("Sheet1", "B2", "纯文本模式")
	buf, err := f.WriteToBuffer()
	if err != nil {
		t.Fatalf("write buffer: %v", err)
	}

	p := parser.NewXlsxParser()
	parsed, err := p.ParseDocumentWithOptions(context.Background(), "", bytes.NewReader(buf.Bytes()), "xlsx", document.ParseOptions{
		ParsingType:     document.ParsingTypePrecise,
		ImageExtraction: false,
		TableExtraction: false,
		ImageOCR:        false,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if parsed.SourceType != document.ParsedDocumentSourceText {
		t.Fatalf("expected plain text parsed document, got %#v", parsed)
	}
	text := parsed.BestEffortText()
	if !strings.Contains(text, "Sheet: Sheet1") || !strings.Contains(text, "测试门店\t纯文本模式") {
		t.Fatalf("unexpected plain text output: %q", text)
	}
}

func TestXlsxParser_ParseDocumentConvertsCrossTableToFacts(t *testing.T) {
	t.Parallel()
	f := excelize.NewFile()
	_ = f.SetCellValue("Sheet1", "A1", "地区")
	_ = f.SetCellValue("Sheet1", "B1", "1月")
	_ = f.SetCellValue("Sheet1", "C1", "2月")
	_ = f.SetCellValue("Sheet1", "A2", "华东")
	_ = f.SetCellValue("Sheet1", "B2", "100")
	_ = f.SetCellValue("Sheet1", "C2", "200")

	buf, err := f.WriteToBuffer()
	if err != nil {
		t.Fatalf("write buffer: %v", err)
	}

	p := parser.NewXlsxParser()
	parsed, err := p.ParseDocument(context.Background(), "", bytes.NewReader(buf.Bytes()), "xlsx")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(parsed.Blocks) != 2 {
		t.Fatalf("expected 2 fact row blocks, got %d", len(parsed.Blocks))
	}
	if !strings.Contains(parsed.Blocks[0].Content, "指标：1月") || !strings.Contains(parsed.Blocks[0].Content, "值：100") {
		t.Fatalf("expected cross table converted to fact row, got %q", parsed.Blocks[0].Content)
	}
	if !strings.Contains(parsed.Blocks[1].Content, "指标：2月") || !strings.Contains(parsed.Blocks[1].Content, "值：200") {
		t.Fatalf("expected second fact row, got %q", parsed.Blocks[1].Content)
	}
}

func TestXlsxParser_ParseDocumentIncludesCellRefsMetadata(t *testing.T) {
	t.Parallel()
	f := excelize.NewFile()
	_ = f.SetCellValue("Sheet1", "A1", "订单号")
	_ = f.SetCellValue("Sheet1", "B1", "金额")
	_ = f.SetCellValue("Sheet1", "A2", "SO001")
	_ = f.SetCellValue("Sheet1", "B2", "100")

	buf, err := f.WriteToBuffer()
	if err != nil {
		t.Fatalf("write buffer: %v", err)
	}

	p := parser.NewXlsxParser()
	parsed, err := p.ParseDocument(context.Background(), "", bytes.NewReader(buf.Bytes()), "xlsx")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(parsed.Blocks) != 1 {
		t.Fatalf("expected 1 row block, got %d", len(parsed.Blocks))
	}
	rowBlock := parsed.Blocks[0]
	cellRefs, ok := rowBlock.Metadata[document.ParsedMetaCellRefs].(map[string]string)
	if !ok {
		t.Fatalf("expected cell ref metadata map[string]string, got %#v", rowBlock.Metadata[document.ParsedMetaCellRefs])
	}
	if cellRefs["订单号"] != "A2" || cellRefs["金额"] != "B2" {
		t.Fatalf("unexpected cell refs: %#v", cellRefs)
	}
}

func TestXlsxParser_ParseDocumentKeepsSingleHeaderRowForStructuredBusinessRows(t *testing.T) {
	t.Parallel()

	f := excelize.NewFile()
	_ = f.SetCellValue("Sheet1", "A1", "区域编码")
	_ = f.SetCellValue("Sheet1", "B1", "网点名称")
	_ = f.SetCellValue("Sheet1", "C1", "结算账户信息")
	_ = f.SetCellValue("Sheet1", "D1", "账户责任人")
	_ = f.SetCellValue("Sheet1", "A2", "R1001")
	_ = f.SetCellValue("Sheet1", "B2", "示例北区一店")
	_ = f.SetCellValue("Sheet1", "C2", "账户名：示例结算主体A\n账号：MOCK-ACCOUNT-0001")
	_ = f.SetCellValue("Sheet1", "D2", "测试人员甲")

	buf, err := f.WriteToBuffer()
	if err != nil {
		t.Fatalf("write buffer: %v", err)
	}

	p := parser.NewXlsxParser()
	parsed, err := p.ParseDocument(context.Background(), "DT001/open/mock_region_account_table.xlsx", bytes.NewReader(buf.Bytes()), "xlsx")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(parsed.Blocks) != 1 {
		t.Fatalf("expected one row block, got %d", len(parsed.Blocks))
	}
	rowBlock := parsed.Blocks[0]
	if !strings.Contains(rowBlock.Content, "文件名: mock_region_account_table.xlsx") {
		t.Fatalf("expected file name in row content, got %q", rowBlock.Content)
	}
	if !strings.Contains(rowBlock.Content, "区域编码：R1001") {
		t.Fatalf("expected first row treated as data, got %q", rowBlock.Content)
	}
	if !strings.Contains(rowBlock.Content, "结算账户信息：\n  - 账户名：示例结算主体A\n  - 账号：MOCK-ACCOUNT-0001") {
		t.Fatalf("expected multiline cell kept under parent header, got %q", rowBlock.Content)
	}
	if !strings.Contains(rowBlock.Content, "账户责任人：测试人员甲") {
		t.Fatalf("expected structured business row field retained, got %q", rowBlock.Content)
	}
	fields, ok := rowBlock.Metadata[document.ParsedMetaFields].([]map[string]any)
	if !ok || len(fields) == 0 {
		t.Fatalf("expected structured field metadata, got %#v", rowBlock.Metadata[document.ParsedMetaFields])
	}
	for _, field := range fields {
		if field["header_path"] == nil {
			t.Fatalf("expected header_path in field metadata, got %#v", field)
		}
	}
}

func TestXlsxParser_ParseDocumentSkipsMergedTitleRowWhenBuildingHeaders(t *testing.T) {
	t.Parallel()

	f := excelize.NewFile()
	_ = f.MergeCell("Sheet1", "A1", "D1")
	_ = f.SetCellValue("Sheet1", "A1", "区域账户信息表")
	_ = f.SetCellValue("Sheet1", "A2", "区域编码")
	_ = f.SetCellValue("Sheet1", "B2", "网点名称")
	_ = f.SetCellValue("Sheet1", "C2", "账号信息")
	_ = f.SetCellValue("Sheet1", "D2", "负责人")
	_ = f.SetCellValue("Sheet1", "A3", "R1001")
	_ = f.SetCellValue("Sheet1", "B3", "示例北区一店")
	_ = f.SetCellValue("Sheet1", "C3", "MOCK-ACCOUNT-0001")
	_ = f.SetCellValue("Sheet1", "D3", "测试人员甲")

	buf, err := f.WriteToBuffer()
	if err != nil {
		t.Fatalf("write buffer: %v", err)
	}

	p := parser.NewXlsxParser()
	parsed, err := p.ParseDocument(context.Background(), "", bytes.NewReader(buf.Bytes()), "xlsx")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(parsed.Blocks) != 1 {
		t.Fatalf("expected one row block, got %d", len(parsed.Blocks))
	}
	rowBlock := parsed.Blocks[0]
	if strings.Contains(rowBlock.Content, "区域账户信息表 / 区域编码") {
		t.Fatalf("expected merged title row excluded from headers, got %q", rowBlock.Content)
	}
	if !strings.Contains(rowBlock.Content, "区域编码：R1001") {
		t.Fatalf("expected clean header path, got %q", rowBlock.Content)
	}
}

func TestXlsxParser_ParseDocumentTreatsTwoHeaderRowsAsHeaders(t *testing.T) {
	t.Parallel()

	f := excelize.NewFile()
	setCellValues(t, f, "Sheet1", map[string]string{
		"A1": "基础信息",
		"F1": "账户信息",
		"A2": "区域编码",
		"B2": "网点名称",
		"C2": "品牌",
		"D2": "经营状态",
		"E2": "责任人",
		"F2": "结算账户信息",
		"G2": "专项账户信息",
		"A3": "R1001",
		"B3": "示例北区一店",
		"C3": "示例品牌A",
		"D3": "营业中",
		"E3": "示例成员A",
		"F3": "账户名：示例结算主体A\n账号：MOCK-ACCOUNT-0001\n开户行：示例银行支行A",
		"G3": "账户名：示例专项主体A\n账号：MOCK-ACCOUNT-1001\n开户行：示例专项支行A",
	})

	buf, err := f.WriteToBuffer()
	if err != nil {
		t.Fatalf("write buffer: %v", err)
	}

	p := parser.NewXlsxParser()
	parsed, err := p.ParseDocument(context.Background(), "", bytes.NewReader(buf.Bytes()), "xlsx")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(parsed.Blocks) != 1 {
		t.Fatalf("expected one row block, got %d", len(parsed.Blocks))
	}

	rowBlock := parsed.Blocks[0]
	if strings.Contains(rowBlock.Content, "行号: 1") || strings.Contains(rowBlock.Content, "行号: 2") {
		t.Fatalf("expected header rows excluded from data blocks, got %q", rowBlock.Content)
	}
	if !strings.Contains(rowBlock.Content, "基础信息 / 区域编码：R1001") {
		t.Fatalf("expected first-level header path kept, got %q", rowBlock.Content)
	}
	if !strings.Contains(rowBlock.Content, "账户信息 / 结算账户信息：\n  - 账户名：示例结算主体A") {
		t.Fatalf("expected grouped account header path kept, got %q", rowBlock.Content)
	}
	if !strings.Contains(rowBlock.Content, "账户信息 / 专项账户信息：\n  - 账户名：示例专项主体A") {
		t.Fatalf("expected trailing grouped header inherited across blanks, got %q", rowBlock.Content)
	}
}

func TestXlsxParser_ParseDocumentKeepsMultipleTablesSeparatedOnOneSheet(t *testing.T) {
	t.Parallel()

	f := excelize.NewFile()
	setCellValues(t, f, "Sheet1", map[string]string{
		"A1":  "区域编码",
		"B1":  "网点名称",
		"C1":  "品牌",
		"D1":  "经营状态",
		"A2":  "R3001",
		"B2":  "示例北区一店",
		"C2":  "示例品牌A",
		"D2":  "营业中",
		"A3":  "R3002",
		"B3":  "示例北区二店",
		"C3":  "示例品牌B",
		"D3":  "营业中",
		"A4":  "R3003",
		"B4":  "示例南区一店",
		"C4":  "示例品牌C",
		"D4":  "暂停营业",
		"A7":  "区域编码",
		"B7":  "责任人",
		"C7":  "结算账户信息",
		"D7":  "专项账户信息",
		"A8":  "R3001",
		"B8":  "示例成员A",
		"C8":  "账户名：示例结算主体A\n账号：MOCK-ACCOUNT-4001\n开户行：示例银行支行A",
		"D8":  "账户名：示例专项主体A\n账号：MOCK-ACCOUNT-5001\n开户行：示例专项支行A",
		"A9":  "R3002",
		"B9":  "示例成员B",
		"C9":  "账户名：示例结算主体B\n账号：MOCK-ACCOUNT-4002\n开户行：示例银行支行B",
		"D9":  "账户名：示例专项主体B\n账号：MOCK-ACCOUNT-5002\n开户行：示例专项支行B",
		"A10": "R3003",
		"B10": "示例成员C",
		"C10": "账户名：示例结算主体C\n账号：MOCK-ACCOUNT-4003\n开户行：示例银行支行C",
		"D10": "账户名：示例专项主体C\n账号：MOCK-ACCOUNT-5003\n开户行：示例专项支行C",
	})

	buf, err := f.WriteToBuffer()
	if err != nil {
		t.Fatalf("write buffer: %v", err)
	}

	p := parser.NewXlsxParser()
	parsed, err := p.ParseDocument(context.Background(), "", bytes.NewReader(buf.Bytes()), "xlsx")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(parsed.Blocks) != 6 {
		t.Fatalf("expected 6 row blocks from two 3-row tables, got %d", len(parsed.Blocks))
	}

	firstTableID, _ := parsed.Blocks[0].Metadata[document.ParsedMetaTableID].(string)
	secondTableID, _ := parsed.Blocks[3].Metadata[document.ParsedMetaTableID].(string)
	if firstTableID == "" || secondTableID == "" || firstTableID == secondTableID {
		t.Fatalf("expected two distinct table ids, got %q and %q", firstTableID, secondTableID)
	}
	if strings.Contains(parsed.Blocks[0].Content, "区域编码 / R3001 / R3002") {
		t.Fatalf("expected first table data rows not absorbed into headers, got %q", parsed.Blocks[0].Content)
	}
	if !strings.Contains(parsed.Blocks[0].Content, "区域编码：R3001") {
		t.Fatalf("expected first table row content preserved, got %q", parsed.Blocks[0].Content)
	}
	if !strings.Contains(parsed.Blocks[3].Content, "责任人：示例成员A") {
		t.Fatalf("expected second table parsed independently, got %q", parsed.Blocks[3].Content)
	}
}

func setCellValues(t *testing.T, f *excelize.File, sheet string, values map[string]string) {
	t.Helper()
	for axis, value := range values {
		if err := f.SetCellValue(sheet, axis, value); err != nil {
			t.Fatalf("set cell %s failed: %v", axis, err)
		}
	}
}

package docparser_test

import (
	"context"
	"errors"
	"image"
	"image/color"
	"image/gif"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"baliance.com/gooxml/common"
	"baliance.com/gooxml/document"

	documentdomain "magic/internal/domain/knowledge/document/service"
	documentsplitter "magic/internal/domain/knowledge/document/splitter"
	parser "magic/internal/infrastructure/parser"
	"magic/internal/pkg/tokenizer"
)

type fakeDocxOCR struct {
	textsByType map[string]string
	err         error
	lastTypes   []string
	callCount   int
}

var (
	errUnexpectedOCRByURL = errors.New("unexpected OCR by URL call")
	errOCRDown            = errors.New("ocr down")
)

func (f *fakeDocxOCR) OCR(context.Context, string, string) (string, error) {
	return "", errUnexpectedOCRByURL
}

func (f *fakeDocxOCR) OCRBytes(_ context.Context, data []byte, fileType string) (string, error) {
	f.callCount++
	f.lastTypes = append(f.lastTypes, strings.ToLower(strings.TrimSpace(fileType)))
	if f.err != nil {
		return "", f.err
	}
	if text, ok := f.textsByType[strings.ToLower(strings.TrimSpace(fileType))]; ok {
		return text, nil
	}
	if text, ok := f.textsByType["*"]; ok {
		return text, nil
	}
	return "", nil
}

func TestDocxParser_Parse_InvalidDocx(t *testing.T) {
	t.Parallel()

	p := parser.NewDocxParser(nil)
	_, err := p.Parse(context.Background(), "", strings.NewReader("not-a-docx"), "docx")
	if err == nil {
		t.Fatalf("expected error")
	}
}

func TestDocxParser_Parse_StructuredHeading(t *testing.T) {
	t.Parallel()

	tmpPath := filepath.Join(t.TempDir(), "structured.docx")
	doc := document.New()

	title := doc.AddParagraph()
	title.SetStyle("Heading1")
	title.AddRun().AddText("第一章 总则")

	body := doc.AddParagraph()
	body.AddRun().AddText("这是正文内容。")

	section := doc.AddParagraph()
	section.SetStyle("Heading2")
	section.AddRun().AddText("1.1 适用范围")

	if err := doc.SaveToFile(tmpPath); err != nil {
		t.Fatalf("save docx failed: %v", err)
	}

	file, err := os.Open(tmpPath)
	if err != nil {
		t.Fatalf("open docx failed: %v", err)
	}
	defer func() { _ = file.Close() }()

	p := parser.NewDocxParser(nil)
	content, err := p.Parse(context.Background(), tmpPath, file, "docx")
	if err != nil {
		t.Fatalf("parse structured docx failed: %v", err)
	}

	if !strings.Contains(content, "# 第一章 总则") {
		t.Fatalf("expected heading marker in content, got %q", content)
	}
	if !strings.Contains(content, "## 1.1 适用范围") {
		t.Fatalf("expected sub-heading marker in content, got %q", content)
	}
	if !strings.Contains(content, "这是正文内容。") {
		t.Fatalf("expected paragraph text in content, got %q", content)
	}
}

func TestDocxParser_Parse_IncludeTableCellText(t *testing.T) {
	t.Parallel()

	tmpPath := filepath.Join(t.TempDir(), "table.docx")
	doc := document.New()

	before := doc.AddParagraph()
	before.AddRun().AddText("表格前文本")

	table := doc.AddTable()
	row := table.AddRow()
	cellA := row.AddCell()
	cellAP := cellA.AddParagraph()
	cellAP.AddRun().AddText("单元格A1")
	cellB := row.AddCell()
	cellBP := cellB.AddParagraph()
	cellBP.AddRun().AddText("单元格B1")

	after := doc.AddParagraph()
	after.AddRun().AddText("表格后文本")

	if err := doc.SaveToFile(tmpPath); err != nil {
		t.Fatalf("save docx failed: %v", err)
	}

	file, err := os.Open(tmpPath)
	if err != nil {
		t.Fatalf("open docx failed: %v", err)
	}
	defer func() { _ = file.Close() }()

	p := parser.NewDocxParser(nil)
	content, err := p.Parse(context.Background(), tmpPath, file, "docx")
	if err != nil {
		t.Fatalf("parse table docx failed: %v", err)
	}

	idxBefore := strings.Index(content, "表格前文本")
	idxCell := strings.Index(content, "单元格A1")
	idxAfter := strings.Index(content, "表格后文本")
	if idxBefore < 0 || idxCell < 0 || idxAfter < 0 {
		t.Fatalf("expected table and body text in content, got %q", content)
	}
	if idxBefore >= idxCell || idxCell >= idxAfter {
		t.Fatalf("expected table text to remain in document order, got %q", content)
	}
}

func TestDocxParser_ParseDocument_InlineImageOCRStaysInOrderAndFlowsIntoSplit(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()
	docxPath := filepath.Join(tmpDir, "inline-image.docx")
	imagePath := filepath.Join(tmpDir, "inline-image.png")
	writeTestPNG(t, imagePath)

	doc := document.New()
	imageRef := addDocxImage(t, doc, imagePath)
	paragraph := doc.AddParagraph()
	paragraph.AddRun().AddText("前文")
	if _, err := paragraph.AddRun().AddDrawingInline(imageRef); err != nil {
		t.Fatalf("add inline drawing: %v", err)
	}
	paragraph.AddRun().AddText("后文")

	if err := doc.SaveToFile(docxPath); err != nil {
		t.Fatalf("save docx failed: %v", err)
	}

	file, err := os.Open(docxPath)
	if err != nil {
		t.Fatalf("open docx failed: %v", err)
	}
	defer func() { _ = file.Close() }()

	ocrClient := &fakeDocxOCR{textsByType: map[string]string{"png": "唯一图片关键词"}}
	p := parser.NewDocxParser(ocrClient)
	parsed, err := p.ParseDocument(context.Background(), docxPath, file, "docx")
	if err != nil {
		t.Fatalf("parse docx with inline image failed: %v", err)
	}

	content := parsed.BestEffortText()
	assertOrderedSubstrings(t, content, "前文", "唯一图片关键词", "后文")
	assertDocxOCRStats(t, parsed, 1, 0, 0)

	chunks, _, err := documentsplitter.SplitParsedDocumentToChunks(context.Background(), documentsplitter.ParsedDocumentChunkInput{
		Parsed:           parsed,
		SourceFileType:   "docx",
		Model:            "text-embedding-3-small",
		TokenizerService: tokenizer.NewService(),
	})
	if err != nil {
		t.Fatalf("split parsed document failed: %v", err)
	}
	if len(chunks) == 0 {
		t.Fatalf("expected at least one chunk")
	}
	if !strings.Contains(chunks[0].Content, "唯一图片关键词") {
		t.Fatalf("expected OCR text to flow into chunks, got %#v", chunks)
	}
}

func TestDocxParser_ParseDocument_TableCellImageOCRIncluded(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()
	docxPath := filepath.Join(tmpDir, "table-image.docx")
	imagePath := filepath.Join(tmpDir, "table-image.png")
	writeTestPNG(t, imagePath)

	doc := document.New()
	table := doc.AddTable()
	row := table.AddRow()
	cell := row.AddCell()
	paragraph := cell.AddParagraph()
	imageRef := addDocxImage(t, doc, imagePath)
	paragraph.AddRun().AddText("单元格前")
	if _, err := paragraph.AddRun().AddDrawingInline(imageRef); err != nil {
		t.Fatalf("add inline drawing: %v", err)
	}
	paragraph.AddRun().AddText("单元格后")

	if err := doc.SaveToFile(docxPath); err != nil {
		t.Fatalf("save docx failed: %v", err)
	}

	file, err := os.Open(docxPath)
	if err != nil {
		t.Fatalf("open docx failed: %v", err)
	}
	defer func() { _ = file.Close() }()

	p := parser.NewDocxParser(&fakeDocxOCR{textsByType: map[string]string{"png": "表格图片文本"}})
	parsed, err := p.ParseDocument(context.Background(), docxPath, file, "docx")
	if err != nil {
		t.Fatalf("parse docx with table image failed: %v", err)
	}

	content := parsed.BestEffortText()
	assertOrderedSubstrings(t, content, "单元格前", "表格图片文本", "单元格后")
	assertDocxOCRStats(t, parsed, 1, 0, 0)
}

func TestDocxParser_ParseDocument_OCRFailureFallsBackToBodyText(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()
	docxPath := filepath.Join(tmpDir, "ocr-failed.docx")
	imagePath := filepath.Join(tmpDir, "ocr-failed.png")
	writeTestPNG(t, imagePath)

	doc := document.New()
	imageRef := addDocxImage(t, doc, imagePath)
	paragraph := doc.AddParagraph()
	paragraph.AddRun().AddText("正文保留")
	if _, err := paragraph.AddRun().AddDrawingInline(imageRef); err != nil {
		t.Fatalf("add inline drawing: %v", err)
	}

	if err := doc.SaveToFile(docxPath); err != nil {
		t.Fatalf("save docx failed: %v", err)
	}

	file, err := os.Open(docxPath)
	if err != nil {
		t.Fatalf("open docx failed: %v", err)
	}
	defer func() { _ = file.Close() }()

	p := parser.NewDocxParser(&fakeDocxOCR{err: errOCRDown})
	parsed, err := p.ParseDocument(context.Background(), docxPath, file, "docx")
	if err != nil {
		t.Fatalf("parse docx with failing OCR should degrade: %v", err)
	}

	content := parsed.BestEffortText()
	if !strings.Contains(content, "正文保留") {
		t.Fatalf("expected body text to remain, got %q", content)
	}
	if strings.Contains(content, "图片OCR：") {
		t.Fatalf("expected no OCR text on failure, got %q", content)
	}
	assertDocxOCRStats(t, parsed, 0, 1, 0)
}

func TestDocxParser_ParseDocument_SanitizesOCRDebugPrefixAndMarkdownImages(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()
	docxPath := filepath.Join(tmpDir, "sanitize-ocr.docx")
	imagePath := filepath.Join(tmpDir, "sanitize-ocr.png")
	writeTestPNG(t, imagePath)

	doc := document.New()
	imageRef := addDocxImage(t, doc, imagePath)
	paragraph := doc.AddParagraph()
	paragraph.AddRun().AddText("前文")
	if _, err := paragraph.AddRun().AddDrawingInline(imageRef); err != nil {
		t.Fatalf("add inline drawing: %v", err)
	}
	paragraph.AddRun().AddText("后文")

	if err := doc.SaveToFile(docxPath); err != nil {
		t.Fatalf("save docx failed: %v", err)
	}

	file, err := os.Open(docxPath)
	if err != nil {
		t.Fatalf("open docx failed: %v", err)
	}
	defer func() { _ = file.Close() }()

	ocrText := "![fig_33551](https://example.com/demo.jpg)\nmagic-web\n修复package manage页面报错"
	p := parser.NewDocxParser(&fakeDocxOCR{textsByType: map[string]string{"png": ocrText}})
	parsed, err := p.ParseDocument(context.Background(), docxPath, file, "docx")
	if err != nil {
		t.Fatalf("parse docx with markdown OCR failed: %v", err)
	}

	content := parsed.BestEffortText()
	assertOrderedSubstrings(t, content, "前文", "magic-web", "修复package manage页面报错", "后文")
	if strings.Contains(content, "图片OCR：") {
		t.Fatalf("expected sanitized OCR content without debug prefix, got %q", content)
	}
	if strings.Contains(content, "![fig_") {
		t.Fatalf("expected markdown image references removed, got %q", content)
	}
}

func TestDocxParser_ParseDocument_UnsupportedImageIsSkipped(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()
	docxPath := filepath.Join(tmpDir, "skip-gif.docx")
	imagePath := filepath.Join(tmpDir, "skip.gif")
	writeTestGIF(t, imagePath)

	doc := document.New()
	imageRef := addDocxImage(t, doc, imagePath)
	paragraph := doc.AddParagraph()
	paragraph.AddRun().AddText("正文")
	if _, err := paragraph.AddRun().AddDrawingInline(imageRef); err != nil {
		t.Fatalf("add inline drawing: %v", err)
	}

	if err := doc.SaveToFile(docxPath); err != nil {
		t.Fatalf("save docx failed: %v", err)
	}

	file, err := os.Open(docxPath)
	if err != nil {
		t.Fatalf("open docx failed: %v", err)
	}
	defer func() { _ = file.Close() }()

	ocrClient := &fakeDocxOCR{textsByType: map[string]string{"*": "不该被调用"}}
	p := parser.NewDocxParser(ocrClient)
	parsed, err := p.ParseDocument(context.Background(), docxPath, file, "docx")
	if err != nil {
		t.Fatalf("parse docx with skipped gif failed: %v", err)
	}

	content := parsed.BestEffortText()
	if content != "正文" {
		t.Fatalf("expected body text only, got %q", content)
	}
	if ocrClient.callCount != 0 {
		t.Fatalf("expected skipped image not to invoke OCR, got %d", ocrClient.callCount)
	}
	assertDocxOCRStats(t, parsed, 0, 0, 1)
}

func TestDocxParser_ParseDocument_OCRLimitSkipsRemainingImages(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()
	docxPath := filepath.Join(tmpDir, "limit.docx")
	imagePath := filepath.Join(tmpDir, "limit.png")
	writeTestPNG(t, imagePath)

	doc := document.New()
	imageRef := addDocxImage(t, doc, imagePath)
	for range 3 {
		paragraph := doc.AddParagraph()
		if _, err := paragraph.AddRun().AddDrawingInline(imageRef); err != nil {
			t.Fatalf("add drawing: %v", err)
		}
	}
	if err := doc.SaveToFile(docxPath); err != nil {
		t.Fatalf("save docx failed: %v", err)
	}

	file, err := os.Open(docxPath)
	if err != nil {
		t.Fatalf("open docx failed: %v", err)
	}
	defer func() { _ = file.Close() }()

	parsed, err := parser.NewDocxParserWithLimit(&fakeDocxOCR{textsByType: map[string]string{"png": "限额词"}}, 2).
		ParseDocument(context.Background(), docxPath, file, "docx")
	if err != nil {
		t.Fatalf("parse docx failed: %v", err)
	}

	if got := parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageCount]; got != 3 {
		t.Fatalf("expected image count 3, got %#v", got)
	}
	if got := parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRSuccessCount]; got != 2 {
		t.Fatalf("expected OCR success 2, got %#v", got)
	}
	if got := parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRLimitedCount]; got != 1 {
		t.Fatalf("expected OCR limited 1, got %#v", got)
	}
}

func TestDocxParser_ParseDocument_UnsupportedImageDoesNotConsumeOCRBudget(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()
	docxPath := filepath.Join(tmpDir, "skip-budget.docx")
	pngPath := filepath.Join(tmpDir, "supported.png")
	gifPath := filepath.Join(tmpDir, "unsupported.gif")
	writeTestPNG(t, pngPath)
	writeTestGIF(t, gifPath)

	doc := document.New()
	gifRef := addDocxImage(t, doc, gifPath)
	pngRef := addDocxImage(t, doc, pngPath)
	paragraph := doc.AddParagraph()
	if _, err := paragraph.AddRun().AddDrawingInline(gifRef); err != nil {
		t.Fatalf("add gif drawing: %v", err)
	}
	if _, err := paragraph.AddRun().AddDrawingInline(pngRef); err != nil {
		t.Fatalf("add png drawing: %v", err)
	}
	if err := doc.SaveToFile(docxPath); err != nil {
		t.Fatalf("save docx failed: %v", err)
	}

	file, err := os.Open(docxPath)
	if err != nil {
		t.Fatalf("open docx failed: %v", err)
	}
	defer func() { _ = file.Close() }()

	parsed, err := parser.NewDocxParserWithLimit(&fakeDocxOCR{textsByType: map[string]string{"png": "支持图词"}}, 1).
		ParseDocument(context.Background(), docxPath, file, "docx")
	if err != nil {
		t.Fatalf("parse docx failed: %v", err)
	}

	if got := parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRSkippedCount]; got != 1 {
		t.Fatalf("expected skipped 1, got %#v", got)
	}
	if got := parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRSuccessCount]; got != 1 {
		t.Fatalf("expected success 1, got %#v", got)
	}
	if got := parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRLimitedCount]; got != 0 {
		t.Fatalf("expected limited 0, got %#v", got)
	}
}

func TestDocxParser_Supports(t *testing.T) {
	t.Parallel()

	p := parser.NewDocxParser(nil)
	if !p.Supports("DOCX") {
		t.Fatalf("expected docx supported")
	}
	if p.Supports("pdf") {
		t.Fatalf("expected pdf not supported")
	}
}

func writeTestPNG(t *testing.T, path string) {
	t.Helper()

	file, err := os.Create(path)
	if err != nil {
		t.Fatalf("create png failed: %v", err)
	}
	defer func() { _ = file.Close() }()

	img := image.NewRGBA(image.Rect(0, 0, 4, 4))
	for y := range 4 {
		for x := range 4 {
			img.Set(x, y, color.RGBA{R: 255, G: 255, B: 255, A: 255})
		}
	}
	if err := png.Encode(file, img); err != nil {
		t.Fatalf("encode png failed: %v", err)
	}
}

func writeTestGIF(t *testing.T, path string) {
	t.Helper()

	file, err := os.Create(path)
	if err != nil {
		t.Fatalf("create gif failed: %v", err)
	}
	defer func() { _ = file.Close() }()

	palette := []color.Color{color.White, color.Black}
	img := image.NewPaletted(image.Rect(0, 0, 2, 2), palette)
	if err := gif.Encode(file, img, nil); err != nil {
		t.Fatalf("encode gif failed: %v", err)
	}
}

func addDocxImage(t *testing.T, doc *document.Document, path string) common.ImageRef {
	t.Helper()

	imageFile, err := common.ImageFromFile(path)
	if err != nil {
		t.Fatalf("read image failed: %v", err)
	}
	imageRef, err := doc.AddImage(imageFile)
	if err != nil {
		t.Fatalf("add image failed: %v", err)
	}
	return imageRef
}

func assertOrderedSubstrings(t *testing.T, content string, parts ...string) {
	t.Helper()

	lastIndex := -1
	for _, part := range parts {
		idx := strings.Index(content, part)
		if idx < 0 {
			t.Fatalf("expected %q in %q", part, content)
		}
		if idx <= lastIndex {
			t.Fatalf("expected %q to appear after index %d in %q", part, lastIndex, content)
		}
		lastIndex = idx
	}
}

func assertDocxOCRStats(
	t *testing.T,
	parsed *documentdomain.ParsedDocument,
	success, failed, skipped int,
) {
	t.Helper()

	if parsed == nil {
		t.Fatal("expected parsed document")
	}
	if got := parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageCount]; got != 1 {
		t.Fatalf("unexpected embedded image count: got %#v want %d", got, 1)
	}
	if got := parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRSuccessCount]; got != success {
		t.Fatalf("unexpected OCR success count: got %#v want %d", got, success)
	}
	if got := parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRFailedCount]; got != failed {
		t.Fatalf("unexpected OCR failed count: got %#v want %d", got, failed)
	}
	if got := parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRSkippedCount]; got != skipped {
		t.Fatalf("unexpected OCR skipped count: got %#v want %d", got, skipped)
	}
}

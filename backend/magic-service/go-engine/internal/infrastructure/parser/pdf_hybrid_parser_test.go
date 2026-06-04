package docparser_test

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"testing"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
	parser "magic/internal/infrastructure/parser"
)

var errPDFOCROCRUnavailable = errors.New("ocr unavailable")

type fakePDFOCR struct {
	text         string
	err          error
	callCount    int
	lastFileURL  string
	lastFileType string
}

func (f *fakePDFOCR) OCR(_ context.Context, fileURL, fileType string) (string, error) {
	f.callCount++
	f.lastFileURL = fileURL
	f.lastFileType = fileType
	if f.err != nil {
		return "", f.err
	}
	return f.text, nil
}

func (f *fakePDFOCR) OCRBytes(context.Context, []byte, string) (string, error) {
	return "", errUnexpectedOCRByURL
}

type fakePDFVisualExtractor struct {
	text        string
	bypassPDF   bool
	sourceCalls int
}

func (f *fakePDFVisualExtractor) RecognizeSource(context.Context, string, io.Reader, string) (string, error) {
	f.sourceCalls++
	return f.text, nil
}

func (f *fakePDFVisualExtractor) RecognizeBytes(context.Context, []byte, string) (string, error) {
	return f.text, nil
}

func (f *fakePDFVisualExtractor) NeedsResolvedURL(context.Context, string) bool {
	return !f.bypassPDF
}

func (f *fakePDFVisualExtractor) BypassesNativePDFText(_ context.Context, fileType string) bool {
	return f.bypassPDF && strings.EqualFold(fileType, "pdf")
}

func TestPDFHybridParser_ParseDocumentPrefersCleanNativeTextWhenQualityAcceptable(t *testing.T) {
	t.Parallel()

	content := buildTestPDF("Native PDF Text")
	ocr := &fakePDFOCR{text: "should not be used"}
	parsed, err := parser.NewPDFHybridParserWithLimit(ocr, 20).
		ParseDocument(context.Background(), "https://example.com/demo.pdf", bytes.NewReader(content), "pdf")
	if err != nil {
		t.Fatalf("parse pdf: %v", err)
	}

	text := parsed.BestEffortText()
	if got := strings.TrimSpace(text); got != "Native PDF Text" {
		t.Fatalf("expected native text only, got %q", got)
	}
	if ocr.callCount != 0 {
		t.Fatalf("expected OCR not to be called, got %d", ocr.callCount)
	}
	if got, ok := parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRSuccessCount]; ok && got != 0 {
		t.Fatalf("expected OCR success metadata absent or zero, got %#v", got)
	}
}

func TestPDFHybridParser_ParseDocumentBypassesNativeTextForModelMode(t *testing.T) {
	t.Parallel()

	visual := &fakePDFVisualExtractor{text: "模型整页识别文本", bypassPDF: true}
	parsed, err := parser.NewPDFHybridParserWithVisualLimit(visual, 20).
		ParseDocument(context.Background(), "DT001/demo.pdf", bytes.NewReader(buildMalformedTestPDF("native should not run")), "pdf")
	if err != nil {
		t.Fatalf("parse pdf: %v", err)
	}
	if got := strings.TrimSpace(parsed.BestEffortText()); got != "模型整页识别文本" {
		t.Fatalf("expected model visual text, got %q", got)
	}
	if visual.sourceCalls != 1 {
		t.Fatalf("expected direct visual extractor call once, got %d", visual.sourceCalls)
	}
}

func TestPDFHybridParser_NeedsResolvedURLForOptionsSkipsURLForModelMode(t *testing.T) {
	t.Parallel()

	visual := &fakePDFVisualExtractor{text: "模型整页识别文本", bypassPDF: true}
	p := parser.NewPDFHybridParserWithVisualLimit(visual, 20)
	if p.NeedsResolvedURLForOptions(context.Background(), "pdf", documentdomain.DefaultParseOptions()) {
		t.Fatal("expected model-mode PDF parser to skip resolved URL")
	}
}

func TestPDFHybridParser_ParseDocumentFallsBackToOCRWhenNativeTextEmpty(t *testing.T) {
	t.Parallel()

	content := buildTestPDF("")
	parsed, err := parser.NewPDFHybridParserWithLimit(&fakePDFOCR{text: "扫描图片词"}, 20).
		ParseDocument(context.Background(), "https://example.com/scan.pdf", bytes.NewReader(content), "pdf")
	if err != nil {
		t.Fatalf("parse scanned pdf: %v", err)
	}
	if got := strings.TrimSpace(parsed.BestEffortText()); got != "扫描图片词" {
		t.Fatalf("expected OCR fallback text, got %q", got)
	}
	if got := parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRSuccessCount]; got != 1 {
		t.Fatalf("expected 1 OCR success, got %#v", got)
	}
}

func TestPDFHybridParser_ParseDocumentReturnsOverloadWhenNativeTextEmptyAndOCRLimited(t *testing.T) {
	t.Parallel()

	ocr := &fakePDFOCR{err: documentdomain.NewOCROverloadedError(documentdomain.OCRProviderVolcengine, errPDFOCROCRUnavailable)}
	_, err := parser.NewPDFHybridParserWithLimit(ocr, 20).
		ParseDocument(context.Background(), "https://example.com/scan.pdf", bytes.NewReader(buildTestPDF("")), "pdf")
	if err == nil {
		t.Fatal("expected overload error")
	}
	if !documentdomain.IsOCROverloaded(err) {
		t.Fatalf("expected OCR overload error, got %v", err)
	}
}

func TestPDFHybridParser_ParseDocumentFallsBackToOCRWhenNativeTextLowQuality(t *testing.T) {
	t.Parallel()

	content := buildTestPDF(strings.Repeat("\u00bc", 10) + "healthy39")
	ocr := &fakePDFOCR{text: "Scanned OCR Text"}
	parsed, err := parser.NewPDFHybridParserWithLimit(ocr, 20).
		ParseDocument(context.Background(), "https://example.com/demo.pdf", bytes.NewReader(content), "pdf")
	if err != nil {
		t.Fatalf("parse low-quality pdf: %v", err)
	}
	if got := strings.TrimSpace(parsed.BestEffortText()); got != "Scanned OCR Text" {
		t.Fatalf("expected OCR fallback text, got %q", got)
	}
	if ocr.callCount != 1 {
		t.Fatalf("expected OCR fallback called once, got %d", ocr.callCount)
	}
	if got := parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRSuccessCount]; got != 1 {
		t.Fatalf("expected 1 OCR success, got %#v", got)
	}
}

func TestPDFHybridParser_ParseDocumentWithOptionsSkipsOCRWhenDisabled(t *testing.T) {
	t.Parallel()

	content := buildTestPDF("Native PDF Text")
	ocr := &fakePDFOCR{text: "should not be used"}
	parsed, err := parser.NewPDFHybridParserWithLimit(ocr, 20).
		ParseDocumentWithOptions(context.Background(), "https://example.com/demo.pdf", bytes.NewReader(content), "pdf", documentdomain.ParseOptions{
			ParsingType:     documentdomain.ParsingTypePrecise,
			ImageExtraction: false,
			TableExtraction: true,
			ImageOCR:        false,
		})
	if err != nil {
		t.Fatalf("parse pdf with options: %v", err)
	}
	text := parsed.BestEffortText()
	if !strings.Contains(text, "Native PDF Text") {
		t.Fatalf("expected native text retained, got %q", text)
	}
	if ocr.callCount != 0 {
		t.Fatalf("expected OCR text skipped, got %d calls", ocr.callCount)
	}
	if got, ok := parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRSuccessCount]; ok && got != 0 {
		t.Fatalf("expected OCR metadata absent or zero, got %#v", got)
	}
}

func TestPDFHybridParser_ParseDocumentRejectsSourceOverLimit(t *testing.T) {
	t.Parallel()

	limits := documentdomain.ResourceLimits{MaxSourceBytes: 5}
	_, err := parser.NewPDFHybridParserWithLimit(nil, 20, limits).
		ParseDocument(context.Background(), "https://example.com/large.pdf", bytes.NewReader([]byte("123456")), "pdf")
	if !errors.Is(err, documentdomain.ErrDocumentResourceLimitExceeded) {
		t.Fatalf("expected resource limit error, got %v", err)
	}
}

func TestPDFHybridParser_ParseDocumentRejectsPDFPagesOverLimit(t *testing.T) {
	t.Parallel()

	limits := documentdomain.ResourceLimits{
		MaxSourceBytes: 1024 * 1024,
		MaxPDFPages:    1,
	}
	_, err := parser.NewPDFHybridParserWithLimit(nil, 20, limits).
		ParseDocument(context.Background(), "https://example.com/large.pdf", bytes.NewReader(buildTestPDFWithPageCount(2)), "pdf")
	if !errors.Is(err, documentdomain.ErrDocumentResourceLimitExceeded) {
		t.Fatalf("expected resource limit error, got %v", err)
	}
}

func TestPDFHybridParser_ParseDocumentFallsBackToWholeDocumentOCRWhenNativeParseFails(t *testing.T) {
	t.Parallel()

	ocr := &fakePDFOCR{text: "整份 PDF OCR 文本"}
	parsed, err := parser.NewPDFHybridParserWithLimit(ocr, 20).
		ParseDocument(context.Background(), "https://example.com/broken.pdf", bytes.NewReader(buildMalformedTestPDF("Ignored native text")), "pdf")
	if err != nil {
		t.Fatalf("parse malformed pdf: %v", err)
	}

	if got := strings.TrimSpace(parsed.BestEffortText()); got != "整份 PDF OCR 文本" {
		t.Fatalf("expected whole-document OCR text, got %q", got)
	}
	if ocr.callCount != 1 {
		t.Fatalf("expected fallback OCR called once, got %d", ocr.callCount)
	}
	if ocr.lastFileURL != "https://example.com/broken.pdf" {
		t.Fatalf("expected fallback OCR file url forwarded, got %q", ocr.lastFileURL)
	}
	if ocr.lastFileType != "pdf" {
		t.Fatalf("expected fallback OCR file type forwarded, got %q", ocr.lastFileType)
	}
}

func TestPDFHybridParser_ParseDocumentReturnsCombinedErrorWhenNativeParseAndOCRFallbackFail(t *testing.T) {
	t.Parallel()

	ocr := &fakePDFOCR{err: errPDFOCROCRUnavailable}
	_, err := parser.NewPDFHybridParserWithLimit(ocr, 20).
		ParseDocument(context.Background(), "https://example.com/broken.pdf", bytes.NewReader(buildMalformedTestPDF("Ignored native text")), "pdf")
	if err == nil {
		t.Fatalf("expected combined error")
	}

	got := err.Error()
	if !strings.Contains(got, "open pdf failed") {
		t.Fatalf("expected native parse error in %q", got)
	}
	if !strings.Contains(got, "fallback document ocr failed") {
		t.Fatalf("expected fallback OCR error in %q", got)
	}
	if !strings.Contains(got, "ocr unavailable") {
		t.Fatalf("expected original OCR error in %q", got)
	}
}

func TestPDFHybridParser_ParseDocumentDoesNotFallbackToWholeDocumentOCRWhenNativeParseSucceeds(t *testing.T) {
	t.Parallel()

	ocr := &fakePDFOCR{text: "不该触发"}
	parsed, err := parser.NewPDFHybridParserWithLimit(ocr, 20).
		ParseDocument(context.Background(), "https://example.com/demo.pdf", bytes.NewReader(buildTestPDF("Native PDF Text")), "pdf")
	if err != nil {
		t.Fatalf("parse pdf: %v", err)
	}

	if !strings.Contains(parsed.BestEffortText(), "Native PDF Text") {
		t.Fatalf("expected native text retained, got %q", parsed.BestEffortText())
	}
	if ocr.callCount != 0 {
		t.Fatalf("expected OCR not to be called, got %d", ocr.callCount)
	}
}

func TestPDFHybridParser_ParseDocumentDoesNotFallbackToWholeDocumentOCRWhenDisabled(t *testing.T) {
	t.Parallel()

	ocr := &fakePDFOCR{text: "不该触发"}
	_, err := parser.NewPDFHybridParserWithLimit(ocr, 20).
		ParseDocumentWithOptions(context.Background(), "https://example.com/broken.pdf", bytes.NewReader(buildMalformedTestPDF("Ignored native text")), "pdf", documentdomain.ParseOptions{
			ParsingType:     documentdomain.ParsingTypePrecise,
			ImageExtraction: true,
			TableExtraction: true,
			ImageOCR:        false,
		})
	if err == nil {
		t.Fatalf("expected native parse error when OCR fallback disabled")
	}
	if !strings.Contains(err.Error(), "open pdf failed") {
		t.Fatalf("expected native parse error, got %v", err)
	}
	if ocr.callCount != 0 {
		t.Fatalf("expected no OCR fallback call, got %d", ocr.callCount)
	}
}

func buildTestPDF(text string) []byte {
	return buildTestPDFWithPageTexts([]string{text})
}

func buildTestPDFWithPageCount(pageCount int) []byte {
	texts := make([]string, pageCount)
	for index := range texts {
		texts[index] = fmt.Sprintf("page-%d", index+1)
	}
	return buildTestPDFWithPageTexts(texts)
}

func buildTestPDFWithPageTexts(texts []string) []byte {
	if len(texts) == 0 {
		texts = []string{""}
	}
	pageKids := make([]string, 0, len(texts))
	objects := make([]string, 0, 2+2*len(texts)+1)
	objects = append(objects, "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
	pageRootIndex := len(objects)
	objects = append(objects, "")

	nextObjectID := 3
	fontObjectID := 3 + len(texts)*2
	for _, text := range texts {
		pageObjectID := nextObjectID
		contentObjectID := nextObjectID + 1
		nextObjectID += 2
		pageKids = append(pageKids, fmt.Sprintf("%d 0 R", pageObjectID))

		stream := "BT /F1 24 Tf 72 720 Td (" + escapePDFText(text) + ") Tj ET"
		if text == "" {
			stream = ""
		}
		objects = append(objects,
			fmt.Sprintf(
				"%d 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 %d 0 R >> >> /Contents %d 0 R >>\nendobj\n",
				pageObjectID,
				fontObjectID,
				contentObjectID,
			),
			fmt.Sprintf("%d 0 obj\n<< /Length %d >>\nstream\n%s\nendstream\nendobj\n", contentObjectID, len(stream), stream),
		)
	}
	objects[pageRootIndex] = fmt.Sprintf(
		"2 0 obj\n<< /Type /Pages /Kids [%s] /Count %d >>\nendobj\n",
		strings.Join(pageKids, " "),
		len(texts),
	)
	objects = append(objects, fmt.Sprintf("%d 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n", fontObjectID))

	return buildPDFObjects(objects)
}

func buildPDFObjects(objects []string) []byte {
	var buffer bytes.Buffer
	buffer.WriteString("%PDF-1.4\n")
	buffer.Write([]byte("%\xE2\xE3\xCF\xD3\n"))

	offsets := make([]int, len(objects)+1)
	for index, object := range objects {
		offsets[index+1] = buffer.Len()
		buffer.WriteString(object)
	}

	xrefOffset := buffer.Len()
	fmt.Fprintf(&buffer, "xref\n0 %d\n", len(objects)+1)
	buffer.WriteString("0000000000 65535 f \n")
	for index := 1; index <= len(objects); index++ {
		fmt.Fprintf(&buffer, "%010d 00000 n \n", offsets[index])
	}
	fmt.Fprintf(&buffer, "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF", len(objects)+1, xrefOffset)
	return buffer.Bytes()
}

func buildMalformedTestPDF(text string) []byte {
	return append(buildTestPDF(text), []byte("\ntrailing-junk")...)
}

func escapePDFText(value string) string {
	replacer := strings.NewReplacer(`\`, `\\`, "(", `\(`, ")", `\)`)
	return replacer.Replace(value)
}

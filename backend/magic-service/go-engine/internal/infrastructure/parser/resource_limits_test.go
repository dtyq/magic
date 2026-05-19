package docparser_test

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"strings"
	"testing"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
	parser "magic/internal/infrastructure/parser"
)

func TestOfficeParsersRejectArchiveResourceLimitsBeforeBusinessParse(t *testing.T) {
	t.Parallel()

	t.Run("docx entry too large", func(t *testing.T) {
		t.Parallel()

		source := buildParserTestZip(t, map[string]string{
			"word/document.xml": strings.Repeat("x", 16),
		})
		limits := documentdomain.ResourceLimits{
			MaxSourceBytes:              1024 * 1024,
			MaxArchiveUncompressedBytes: 1024 * 1024,
			MaxArchiveEntryBytes:        8,
			MaxEmbeddedAssetBytes:       1024 * 1024,
			MaxPresentationSlides:       300,
		}
		_, err := parser.NewDocxParserWithLimit(nil, 20, limits).
			ParseDocument(context.Background(), "large.docx", bytes.NewReader(source), "docx")
		assertParserResourceLimit(t, err)
	})

	t.Run("xlsx archive total too large", func(t *testing.T) {
		t.Parallel()

		source := buildParserTestZip(t, map[string]string{
			"xl/workbook.xml":          strings.Repeat("a", 10),
			"xl/worksheets/sheet1.xml": strings.Repeat("b", 10),
		})
		limits := documentdomain.ResourceLimits{
			MaxSourceBytes:              1024 * 1024,
			MaxArchiveUncompressedBytes: 15,
			MaxArchiveEntryBytes:        1024,
			MaxEmbeddedAssetBytes:       1024,
			MaxPresentationSlides:       300,
		}
		_, err := parser.NewXlsxParserWithOCRAndLimits(nil, 20, limits).
			ParseDocument(context.Background(), "large.xlsx", bytes.NewReader(source), "xlsx")
		assertParserResourceLimit(t, err)
	})

	t.Run("office embedded asset too large", func(t *testing.T) {
		t.Parallel()

		source := buildParserTestZip(t, map[string]string{
			"ppt/slides/slide1.xml": "<p:sld/>",
			"ppt/media/image1.png":  "ab",
		})
		limits := documentdomain.ResourceLimits{
			MaxSourceBytes:              1024 * 1024,
			MaxArchiveUncompressedBytes: 1024 * 1024,
			MaxArchiveEntryBytes:        1024,
			MaxEmbeddedAssetBytes:       1,
			MaxPresentationSlides:       300,
		}
		_, err := parser.NewPptxParserWithLimit(nil, 20, limits).
			ParseDocument(context.Background(), "asset.pptx", bytes.NewReader(source), "pptx")
		assertParserResourceLimit(t, err)
	})

	t.Run("pptx slide count too large", func(t *testing.T) {
		t.Parallel()

		source := buildParserTestZip(t, map[string]string{
			"ppt/slides/slide1.xml": "<p:sld/>",
			"ppt/slides/slide2.xml": "<p:sld/>",
		})
		limits := documentdomain.ResourceLimits{
			MaxSourceBytes:              1024 * 1024,
			MaxArchiveUncompressedBytes: 1024 * 1024,
			MaxArchiveEntryBytes:        1024,
			MaxEmbeddedAssetBytes:       1024,
			MaxPresentationSlides:       1,
		}
		_, err := parser.NewPptxParserWithLimit(nil, 20, limits).
			ParseDocument(context.Background(), "slides.pptx", bytes.NewReader(source), "pptx")
		assertParserResourceLimit(t, err)
	})
}

func TestStructuredTextParsersRejectParsedBlockLimitDuringParse(t *testing.T) {
	t.Parallel()

	limits := documentdomain.ResourceLimits{
		MaxSourceBytes:          1024 * 1024,
		MaxPlainTextChars:       1024 * 1024,
		MaxParsedBlocks:         1,
		MaxTabularRows:          100,
		MaxTabularCells:         100,
		MaxFragmentsPerDocument: 2000,
	}

	_, jsonErr := parser.NewJSONParser(limits).
		ParseDocument(context.Background(), "large.json", strings.NewReader(`{"a":1}`), "json")
	assertParserResourceLimit(t, jsonErr)

	_, xmlErr := parser.NewXMLParser(limits).
		ParseDocument(context.Background(), "large.xml", strings.NewReader(`<root><a>1</a></root>`), "xml")
	assertParserResourceLimit(t, xmlErr)
}

func TestRichTextParsersSkipDataURIImageOverEmbeddedAssetLimit(t *testing.T) {
	t.Parallel()

	limits := documentdomain.ResourceLimits{
		MaxSourceBytes:          1024 * 1024,
		MaxPlainTextChars:       1024 * 1024,
		MaxEmbeddedAssetBytes:   1,
		MaxParsedBlocks:         100,
		MaxFragmentsPerDocument: 2000,
	}
	dataURI := "data:image/png;base64," + base64.StdEncoding.EncodeToString([]byte("ab"))

	markdownOCR := &fakeDocxOCR{textsByType: map[string]string{"png": "不应识别"}}
	_, err := parser.NewMarkdownParserWithAssets(nil, markdownOCR, 20, limits).
		ParseDocument(context.Background(), "demo.md", strings.NewReader("![x]("+dataURI+")"), "md")
	if err != nil {
		t.Fatalf("parse markdown: %v", err)
	}
	if markdownOCR.callCount != 0 {
		t.Fatalf("expected oversized markdown data URI to skip OCR, got %d calls", markdownOCR.callCount)
	}

	htmlOCR := &fakeDocxOCR{textsByType: map[string]string{"png": "不应识别"}}
	_, err = parser.NewHTMLParserWithAssets(nil, htmlOCR, 20, limits).
		ParseDocument(context.Background(), "demo.html", strings.NewReader(`<img src="`+dataURI+`">`), "html")
	if err != nil {
		t.Fatalf("parse html: %v", err)
	}
	if htmlOCR.callCount != 0 {
		t.Fatalf("expected oversized html data URI to skip OCR, got %d calls", htmlOCR.callCount)
	}
}

func buildParserTestZip(t *testing.T, entries map[string]string) []byte {
	t.Helper()

	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	for name, content := range entries {
		entry, err := writer.Create(name)
		if err != nil {
			t.Fatalf("create zip entry %s: %v", name, err)
		}
		if _, err := entry.Write([]byte(content)); err != nil {
			t.Fatalf("write zip entry %s: %v", name, err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close zip: %v", err)
	}
	return buffer.Bytes()
}

func assertParserResourceLimit(t *testing.T, err error) {
	t.Helper()

	if !errors.Is(err, documentdomain.ErrDocumentResourceLimitExceeded) {
		t.Fatalf("expected resource limit error, got %v", err)
	}
}

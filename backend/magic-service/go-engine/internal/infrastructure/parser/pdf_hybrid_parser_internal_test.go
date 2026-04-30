package docparser

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
)

var (
	errInternalPDFOCRUnavailable      = errors.New("ocr unavailable")
	errUnexpectedInternalOCRBytesCall = errors.New("unexpected OCRBytes call")
)

type internalFakePDFOCR struct {
	text      string
	err       error
	callCount int
}

func (f *internalFakePDFOCR) OCR(context.Context, string, string) (string, error) {
	f.callCount++
	if f.err != nil {
		return "", f.err
	}
	return f.text, nil
}

func (f *internalFakePDFOCR) OCRBytes(context.Context, []byte, string) (string, error) {
	return "", errUnexpectedInternalOCRBytesCall
}

func TestPDFHybridParser_LowQualityWithoutOCRReturnsCleanedNativeText(t *testing.T) {
	t.Parallel()

	ocr := &internalFakePDFOCR{text: "should not be used"}
	parser := NewPDFHybridParserWithLimit(ocr, 20)
	parser.nativeTextExtractor = func(string) (string, error) {
		return strings.Repeat("\u00bc", 10) + "healthy39", nil
	}

	parsed, err := parser.
		ParseDocumentWithOptions(context.Background(), "https://example.com/demo.pdf", bytes.NewReader([]byte("ignored")), "pdf", documentdomain.ParseOptions{
			ParsingType:     documentdomain.ParsingTypePrecise,
			ImageExtraction: false,
			TableExtraction: true,
			ImageOCR:        false,
		})
	if err != nil {
		t.Fatalf("expected low-quality native text to degrade gracefully: %v", err)
	}

	if got := parsed.BestEffortText(); got != "healthy39" {
		t.Fatalf("expected cleaned native text, got %q", got)
	}
	if ocr.callCount != 0 {
		t.Fatalf("expected OCR not to be called, got %d", ocr.callCount)
	}
	if got, ok := parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRSuccessCount]; ok && got != 0 {
		t.Fatalf("expected no OCR success metadata, got %#v", got)
	}
}

func TestPDFHybridParser_LowQualityOCRFailureReturnsCleanedNativeText(t *testing.T) {
	t.Parallel()

	ocr := &internalFakePDFOCR{err: errInternalPDFOCRUnavailable}
	parser := NewPDFHybridParserWithLimit(ocr, 20)
	parser.nativeTextExtractor = func(string) (string, error) {
		return strings.Repeat("\u00bc", 10) + "healthy39", nil
	}

	parsed, err := parser.
		ParseDocument(context.Background(), "https://example.com/demo.pdf", bytes.NewReader([]byte("ignored")), "pdf")
	if err != nil {
		t.Fatalf("expected low-quality OCR failure to degrade gracefully: %v", err)
	}

	if got := parsed.BestEffortText(); got != "healthy39" {
		t.Fatalf("expected cleaned native text, got %q", got)
	}
	if ocr.callCount != 1 {
		t.Fatalf("expected OCR attempted once, got %d", ocr.callCount)
	}
	if got := parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRFailedCount]; got != 1 {
		t.Fatalf("expected one OCR failure metadata entry, got %#v", got)
	}
}

package docparser_test

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"

	document "magic/internal/domain/knowledge/document/metadata"
	parser "magic/internal/infrastructure/parser"
)

type fakeOCR struct {
	out          string
	err          error
	lastFileType string
	sourceCalled bool
}

func (f *fakeOCR) OCR(ctx context.Context, fileURL, fileType string) (string, error) {
	f.lastFileType = fileType
	return f.out, f.err
}

func (f *fakeOCR) OCRBytes(ctx context.Context, data []byte, fileType string) (string, error) {
	f.lastFileType = fileType
	return f.out, f.err
}

func (f *fakeOCR) OCRSource(ctx context.Context, fileURL string, file io.Reader, fileType string) (string, error) {
	f.sourceCalled = true
	f.lastFileType = fileType
	return f.out, f.err
}

type testError string

func (e testError) Error() string { return string(e) }

const errFail testError = "fail"

func TestOCRParserParseWithOCR(t *testing.T) {
	t.Parallel()

	ocr := &fakeOCR{out: "ok"}
	p := parser.NewOCRParser(ocr)
	out, err := p.Parse(context.Background(), "http://example", strings.NewReader(""), "png")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out != "ok" {
		t.Fatalf("unexpected output: %q", out)
	}
	if ocr.lastFileType != "png" {
		t.Fatalf("expected file type to be forwarded, got %q", ocr.lastFileType)
	}
	if !ocr.sourceCalled {
		t.Fatal("expected OCRSource to be preferred when available")
	}
}

func TestOCRParserParseOCRFails(t *testing.T) {
	t.Parallel()

	p := parser.NewOCRParser(&fakeOCR{err: errFail})
	_, err := p.Parse(context.Background(), "http://example", strings.NewReader(""), "pdf")
	if err == nil {
		t.Fatalf("expected error")
	}
}

func TestOCRParserParseRequirements(t *testing.T) {
	t.Parallel()

	p := parser.NewOCRParser(nil)
	_, err := p.Parse(context.Background(), "", strings.NewReader(""), "pdf")
	if err == nil || !errors.Is(err, parser.ErrOCRRequirements) {
		t.Fatalf("expected ErrOCRRequirements, got %v", err)
	}
}

func TestOCRParserSupports(t *testing.T) {
	t.Parallel()

	p := parser.NewOCRParser(nil)
	for _, ext := range []string{"PDF", "jpg", "jpeg", "png", "bmp"} {
		if !p.Supports(ext) {
			t.Fatalf("expected %s supported", ext)
		}
	}
	if p.Supports("txt") {
		t.Fatalf("expected txt not supported")
	}
}

func TestOCRParserParseWithOptions_SkipsWhenImageOCRDisabled(t *testing.T) {
	t.Parallel()

	ocr := &fakeOCR{out: "should-not-run"}
	p := parser.NewOCRParser(ocr)
	out, err := p.ParseWithOptions(context.Background(), "http://example", strings.NewReader(""), "png", document.ParseOptions{
		ParsingType:     document.ParsingTypePrecise,
		ImageExtraction: true,
		TableExtraction: true,
		ImageOCR:        false,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out != "" {
		t.Fatalf("expected OCR skipped with empty output, got %q", out)
	}
	if ocr.lastFileType != "" {
		t.Fatalf("expected OCR client not called, got lastFileType=%q", ocr.lastFileType)
	}
}

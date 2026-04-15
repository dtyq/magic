package thirdplatformsource_test

import (
	"context"
	"fmt"
	"io"
	"strings"
	"testing"

	thirdplatformsource "magic/internal/application/knowledge/shared/thirdplatformsource"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/pkg/thirdplatform"
)

type parseServiceStub struct {
	readerCalls       int
	urlCalls          int
	lastReaderContent string
	lastURL           string
	lastFileType      string
	lastOptions       documentdomain.ParseOptions
}

func (s *parseServiceStub) ParseDocumentWithOptions(
	_ context.Context,
	rawURL, ext string,
	options documentdomain.ParseOptions,
) (*documentdomain.ParsedDocument, error) {
	s.urlCalls++
	s.lastURL = rawURL
	s.lastFileType = ext
	s.lastOptions = options
	return documentdomain.NewPlainTextParsedDocument(ext, rawURL), nil
}

func (s *parseServiceStub) ParseDocumentReaderWithOptions(
	_ context.Context,
	_ string,
	file io.Reader,
	fileType string,
	options documentdomain.ParseOptions,
) (*documentdomain.ParsedDocument, error) {
	s.readerCalls++
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("read parse input: %w", err)
	}
	s.lastReaderContent = string(data)
	s.lastFileType = fileType
	s.lastOptions = options
	return documentdomain.NewPlainTextParsedDocument(fileType, s.lastReaderContent), nil
}

func TestParseResolvedDocumentRawMarkdownUsesReaderParser(t *testing.T) {
	t.Parallel()

	parser := &parseServiceStub{}
	parsed, err := thirdplatformsource.ParseResolvedDocument(context.Background(), parser, &thirdplatform.DocumentResolveResult{
		SourceKind: thirdplatform.DocumentSourceKindRawContent,
		RawContent: "# title",
		DocumentFile: map[string]any{
			"name":      "demo.md",
			"extension": "md",
		},
	}, documentdomain.DefaultParseOptions())
	if err != nil {
		t.Fatalf("ParseResolvedDocument returned error: %v", err)
	}
	if parsed == nil || parsed.BestEffortText() != "# title" {
		t.Fatalf("unexpected parsed document: %#v", parsed)
	}
	if parser.readerCalls != 1 || parser.urlCalls != 0 {
		t.Fatalf("expected reader path only, got reader=%d url=%d", parser.readerCalls, parser.urlCalls)
	}
	if parser.lastReaderContent != "# title" || parser.lastFileType != "md" {
		t.Fatalf("unexpected parser input: %#v", parser)
	}
}

func TestParseResolvedDocumentRawCSVUsesReaderParser(t *testing.T) {
	t.Parallel()

	parser := &parseServiceStub{}
	parsed, err := thirdplatformsource.ParseResolvedDocument(context.Background(), parser, &thirdplatform.DocumentResolveResult{
		SourceKind: thirdplatform.DocumentSourceKindRawContent,
		RawContent: "a,b\n1,2",
		DocumentFile: map[string]any{
			"name":      "table.csv",
			"extension": "csv",
		},
	}, documentdomain.DefaultParseOptions())
	if err != nil {
		t.Fatalf("ParseResolvedDocument returned error: %v", err)
	}
	if parsed == nil || !strings.Contains(parsed.BestEffortText(), "1,2") {
		t.Fatalf("unexpected parsed document: %#v", parsed)
	}
	if parser.readerCalls != 1 || parser.urlCalls != 0 {
		t.Fatalf("expected reader path only, got reader=%d url=%d", parser.readerCalls, parser.urlCalls)
	}
	if parser.lastFileType != "csv" {
		t.Fatalf("expected csv parser input, got %#v", parser)
	}
}

func TestParseResolvedDocumentDownloadURLUsesURLParser(t *testing.T) {
	t.Parallel()

	parser := &parseServiceStub{}
	parsed, err := thirdplatformsource.ParseResolvedDocument(context.Background(), parser, &thirdplatform.DocumentResolveResult{
		SourceKind:  thirdplatform.DocumentSourceKindDownloadURL,
		DownloadURL: "https://example.com/demo.docx",
		DocumentFile: map[string]any{
			"name":      "demo.docx",
			"extension": "docx",
		},
	}, documentdomain.DefaultParseOptions())
	if err != nil {
		t.Fatalf("ParseResolvedDocument returned error: %v", err)
	}
	if parsed == nil || parsed.BestEffortText() != "https://example.com/demo.docx" {
		t.Fatalf("unexpected parsed document: %#v", parsed)
	}
	if parser.readerCalls != 0 || parser.urlCalls != 1 {
		t.Fatalf("expected url path only, got reader=%d url=%d", parser.readerCalls, parser.urlCalls)
	}
	if parser.lastURL != "https://example.com/demo.docx" || parser.lastFileType != "docx" {
		t.Fatalf("unexpected parser input: %#v", parser)
	}
}

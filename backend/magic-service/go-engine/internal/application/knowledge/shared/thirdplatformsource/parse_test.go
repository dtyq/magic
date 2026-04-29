package thirdplatformsource_test

import (
	"context"
	"errors"
	"fmt"
	"io"
	"slices"
	"strings"
	"testing"

	thirdplatformsource "magic/internal/application/knowledge/shared/thirdplatformsource"
	documentdomain "magic/internal/domain/knowledge/document/service"
	shared "magic/internal/domain/knowledge/shared"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
	"magic/internal/pkg/thirdplatform"
)

var (
	errParseTestBoom         = errors.New("boom")
	errParseTestFirstFailed  = errors.New("first failed")
	errParseTestSecondFailed = errors.New("second failed")
)

type parseServiceStub struct {
	readerCalls         int
	urlCalls            int
	lastReaderContent   string
	lastURL             string
	lastFileType        string
	lastOptions         documentdomain.ParseOptions
	urlCallSequence     []string
	urlResultsByURL     map[string]*parseddocument.ParsedDocument
	urlErrorsByURL      map[string]error
	defaultURLResult    *parseddocument.ParsedDocument
	defaultReaderResult *parseddocument.ParsedDocument
}

func (s *parseServiceStub) ParseDocumentWithOptions(
	_ context.Context,
	rawURL, ext string,
	options documentdomain.ParseOptions,
) (*parseddocument.ParsedDocument, error) {
	s.urlCalls++
	s.lastURL = rawURL
	s.lastFileType = ext
	s.lastOptions = options
	s.urlCallSequence = append(s.urlCallSequence, rawURL)
	if err := s.urlErrorsByURL[rawURL]; err != nil {
		return nil, err
	}
	if parsed, ok := s.urlResultsByURL[rawURL]; ok {
		return parsed, nil
	}
	if s.defaultURLResult != nil {
		return s.defaultURLResult, nil
	}
	return parseddocument.NewPlainTextParsedDocument(ext, rawURL), nil
}

func (s *parseServiceStub) ParseDocumentReaderWithOptions(
	_ context.Context,
	_ string,
	file io.Reader,
	fileType string,
	options documentdomain.ParseOptions,
) (*parseddocument.ParsedDocument, error) {
	s.readerCalls++
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("read parse input: %w", err)
	}
	s.lastReaderContent = string(data)
	s.lastFileType = fileType
	s.lastOptions = options
	if s.defaultReaderResult != nil {
		return s.defaultReaderResult, nil
	}
	return parseddocument.NewPlainTextParsedDocument(fileType, s.lastReaderContent), nil
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

func TestParseResolvedDocumentDownloadURLsUsesFirstNonEmptyCandidateInOrder(t *testing.T) {
	t.Parallel()

	parser := &parseServiceStub{
		urlResultsByURL: map[string]*parseddocument.ParsedDocument{
			"https://example.com/demo.xlsx?token=1": parseddocument.NewPlainTextParsedDocument("xlsx", ""),
			"https://example.com/.xlsx?token=2":     parseddocument.NewPlainTextParsedDocument("xlsx", "table data"),
		},
	}
	parsed, err := thirdplatformsource.ParseResolvedDocument(context.Background(), parser, &thirdplatform.DocumentResolveResult{
		SourceKind: thirdplatform.DocumentSourceKindDownloadURL,
		DownloadURLs: []string{
			"https://example.com/demo.xlsx?token=1",
			"https://example.com/.xlsx?token=2",
		},
		DocumentFile: map[string]any{
			"name":      "demo.xlsx",
			"extension": "xlsx",
		},
	}, documentdomain.DefaultParseOptions())
	if err != nil {
		t.Fatalf("ParseResolvedDocument returned error: %v", err)
	}
	if parsed == nil || parsed.BestEffortText() != "table data" {
		t.Fatalf("unexpected parsed document: %#v", parsed)
	}
	if !slices.Equal(parser.urlCallSequence, []string{
		"https://example.com/demo.xlsx?token=1",
		"https://example.com/.xlsx?token=2",
	}) {
		t.Fatalf("unexpected candidate order: %#v", parser.urlCallSequence)
	}
}

func TestParseResolvedDocumentDownloadURLsFallsBackAfterParseError(t *testing.T) {
	t.Parallel()

	parser := &parseServiceStub{
		urlErrorsByURL: map[string]error{
			"https://example.com/a.xlsx?token=1": errParseTestBoom,
		},
		urlResultsByURL: map[string]*parseddocument.ParsedDocument{
			"https://example.com/.xlsx?token=2": parseddocument.NewPlainTextParsedDocument("xlsx", "real data"),
		},
	}

	parsed, err := thirdplatformsource.ParseResolvedDocument(context.Background(), parser, &thirdplatform.DocumentResolveResult{
		SourceKind: thirdplatform.DocumentSourceKindDownloadURL,
		DownloadURLs: []string{
			"https://example.com/a.xlsx?token=1",
			"https://example.com/.xlsx?token=2",
		},
		DocumentFile: map[string]any{
			"name":      "demo.xlsx",
			"extension": "xlsx",
		},
	}, documentdomain.DefaultParseOptions())
	if err != nil {
		t.Fatalf("ParseResolvedDocument returned error: %v", err)
	}
	if parsed == nil || parsed.BestEffortText() != "real data" {
		t.Fatalf("unexpected parsed document: %#v", parsed)
	}
	if !slices.Equal(parser.urlCallSequence, []string{
		"https://example.com/a.xlsx?token=1",
		"https://example.com/.xlsx?token=2",
	}) {
		t.Fatalf("unexpected candidate order: %#v", parser.urlCallSequence)
	}
}

func TestParseResolvedDocumentDownloadURLsReturnsEmptyWhenAllCandidatesEmpty(t *testing.T) {
	t.Parallel()

	parser := &parseServiceStub{
		urlResultsByURL: map[string]*parseddocument.ParsedDocument{
			"https://example.com/a.xlsx?token=1": parseddocument.NewPlainTextParsedDocument("xlsx", ""),
			"https://example.com/b.xlsx?token=2": {
				SourceType: parseddocument.SourceTabular,
			},
		},
	}

	parsed, err := thirdplatformsource.ParseResolvedDocument(context.Background(), parser, &thirdplatform.DocumentResolveResult{
		SourceKind: thirdplatform.DocumentSourceKindDownloadURL,
		DownloadURLs: []string{
			"https://example.com/a.xlsx?token=1",
			"https://example.com/b.xlsx?token=2",
		},
		DocumentFile: map[string]any{
			"name":      "demo.xlsx",
			"extension": "xlsx",
		},
	}, documentdomain.DefaultParseOptions())
	if !errors.Is(err, shared.ErrDocumentFileEmpty) {
		t.Fatalf("expected empty document error, got parsed=%#v err=%v", parsed, err)
	}
}

func TestParseResolvedDocumentDownloadURLUsesLegacyFallbackWhenListEmpty(t *testing.T) {
	t.Parallel()

	parser := &parseServiceStub{
		urlResultsByURL: map[string]*parseddocument.ParsedDocument{
			"https://example.com/fallback.xlsx": parseddocument.NewPlainTextParsedDocument("xlsx", "legacy"),
		},
	}

	parsed, err := thirdplatformsource.ParseResolvedDocument(context.Background(), parser, &thirdplatform.DocumentResolveResult{
		SourceKind:  thirdplatform.DocumentSourceKindDownloadURL,
		DownloadURL: " https://example.com/fallback.xlsx ",
		DocumentFile: map[string]any{
			"name":      "demo.xlsx",
			"extension": "xlsx",
		},
	}, documentdomain.DefaultParseOptions())
	if err != nil {
		t.Fatalf("ParseResolvedDocument returned error: %v", err)
	}
	if parsed == nil || parsed.BestEffortText() != "legacy" {
		t.Fatalf("unexpected parsed document: %#v", parsed)
	}
	if !slices.Equal(parser.urlCallSequence, []string{"https://example.com/fallback.xlsx"}) {
		t.Fatalf("unexpected candidate order: %#v", parser.urlCallSequence)
	}
}

func TestParseResolvedDocumentDownloadURLsDeduplicatesLegacyFallback(t *testing.T) {
	t.Parallel()

	parser := &parseServiceStub{
		urlResultsByURL: map[string]*parseddocument.ParsedDocument{
			"https://example.com/fallback.xlsx": parseddocument.NewPlainTextParsedDocument("xlsx", "legacy"),
		},
	}

	parsed, err := thirdplatformsource.ParseResolvedDocument(context.Background(), parser, &thirdplatform.DocumentResolveResult{
		SourceKind: thirdplatform.DocumentSourceKindDownloadURL,
		DownloadURLs: []string{
			" https://example.com/fallback.xlsx ",
			"",
		},
		DownloadURL: "https://example.com/fallback.xlsx",
		DocumentFile: map[string]any{
			"name":      "demo.xlsx",
			"extension": "xlsx",
		},
	}, documentdomain.DefaultParseOptions())
	if err != nil {
		t.Fatalf("ParseResolvedDocument returned error: %v", err)
	}
	if parsed == nil || parsed.BestEffortText() != "legacy" {
		t.Fatalf("unexpected parsed document: %#v", parsed)
	}
	if !slices.Equal(parser.urlCallSequence, []string{"https://example.com/fallback.xlsx"}) {
		t.Fatalf("expected deduplicated probe sequence, got %#v", parser.urlCallSequence)
	}
}

func TestParseResolvedDocumentDownloadURLsReturnsAggregatedErrorWhenAllFail(t *testing.T) {
	t.Parallel()

	parser := &parseServiceStub{
		urlErrorsByURL: map[string]error{
			"https://example.com/a.xlsx?token=1": errParseTestFirstFailed,
			"https://example.com/b.xlsx?token=2": errParseTestSecondFailed,
		},
	}

	parsed, err := thirdplatformsource.ParseResolvedDocument(context.Background(), parser, &thirdplatform.DocumentResolveResult{
		SourceKind: thirdplatform.DocumentSourceKindDownloadURL,
		DownloadURLs: []string{
			"https://example.com/a.xlsx?token=1",
			"https://example.com/b.xlsx?token=2",
		},
		DocumentFile: map[string]any{
			"name":      "demo.xlsx",
			"extension": "xlsx",
		},
	}, documentdomain.DefaultParseOptions())
	if parsed != nil {
		t.Fatalf("expected nil parsed document, got %#v", parsed)
	}
	if err == nil || !errors.Is(err, errParseTestSecondFailed) {
		t.Fatalf("expected aggregated error containing last failure, got %v", err)
	}
}

package document_test

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	documentdomain "magic/internal/domain/knowledge/document/service"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
	"magic/internal/infrastructure/logging"
)

var (
	errParseFetchNotImplemented    = errors.New("fetch not implemented")
	errParseGetLinkNotImplemented  = errors.New("get link not implemented")
	errParseStatNotImplemented     = errors.New("stat not implemented")
	errParseUnexpectedFileType     = errors.New("unexpected file type")
	errParseFetchFailed            = errors.New("fetch failed")
	errParseObjectNotFound         = errors.New("object not found")
	errParseUnexpectedResolvedURL  = errors.New("unexpected resolved url")
	errParseFileSizeNotImplemented = errors.New("file size not implemented")
)

const parseTestHelloContent = "hello"

type parseTestFetcher struct {
	fetchFn    func(context.Context, string) (io.ReadCloser, error)
	getLinkFn  func(context.Context, string, string, time.Duration) (string, error)
	statFn     func(context.Context, string) error
	fileSizeFn func(context.Context, string) (int64, error)
}

func (m *parseTestFetcher) Fetch(ctx context.Context, path string) (io.ReadCloser, error) {
	if m.fetchFn == nil {
		return nil, errParseFetchNotImplemented
	}
	return m.fetchFn(ctx, path)
}

func (m *parseTestFetcher) GetLink(ctx context.Context, path, method string, expire time.Duration) (string, error) {
	if m.getLinkFn == nil {
		return "", errParseGetLinkNotImplemented
	}
	return m.getLinkFn(ctx, path, method, expire)
}

func (m *parseTestFetcher) Stat(ctx context.Context, path string) error {
	if m.statFn == nil {
		return errParseStatNotImplemented
	}
	return m.statFn(ctx, path)
}

func (m *parseTestFetcher) FileSize(ctx context.Context, path string) (int64, error) {
	if m.fileSizeFn == nil {
		return 0, errParseFileSizeNotImplemented
	}
	return m.fileSizeFn(ctx, path)
}

type parseTestParser struct {
	supported       string
	needsURL        bool
	parseFn         func(context.Context, string, io.Reader, string) (string, error)
	parseDocumentFn func(context.Context, string, io.Reader, string) (*parseddocument.ParsedDocument, error)
}

type parseTestParserWithOptions struct {
	*parseTestParser
	lastOptions *documentdomain.ParseOptions
}

func (p *parseTestParser) Parse(ctx context.Context, fileURL string, file io.Reader, fileType string) (string, error) {
	if p.parseFn != nil {
		return p.parseFn(ctx, fileURL, file, fileType)
	}
	if fileType != p.supported {
		return "", errParseUnexpectedFileType
	}
	data, err := io.ReadAll(file)
	if err != nil {
		return "", fmt.Errorf("read parser input: %w", err)
	}
	return string(data), nil
}

func (p *parseTestParser) Supports(fileType string) bool {
	return fileType == p.supported
}

func (p *parseTestParser) NeedsResolvedURL() bool {
	return p.needsURL
}

func (p *parseTestParser) ParseDocument(ctx context.Context, fileURL string, file io.Reader, fileType string) (*parseddocument.ParsedDocument, error) {
	if p.parseDocumentFn != nil {
		return p.parseDocumentFn(ctx, fileURL, file, fileType)
	}
	content, err := p.Parse(ctx, fileURL, file, fileType)
	if err != nil {
		return nil, err
	}
	return parseddocument.NewPlainTextParsedDocument(fileType, content), nil
}

func (p *parseTestParserWithOptions) ParseDocumentWithOptions(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
	options documentdomain.ParseOptions,
) (*parseddocument.ParsedDocument, error) {
	copied := options
	p.lastOptions = &copied
	return p.ParseDocument(ctx, fileURL, file, fileType)
}

func TestDocumentParseServiceParse_ResolveEmptyFileType(t *testing.T) {
	t.Parallel()
	fetcher := &parseTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			return io.NopCloser(strings.NewReader(parseTestHelloContent)), nil
		},
	}
	parsers := []documentdomain.Parser{
		&parseTestParser{supported: "md"},
	}
	svc := documentdomain.NewParseService(fetcher, parsers, logging.New())

	content, err := svc.Parse(context.Background(), "https://example.com/demo.md", "")
	if err != nil {
		t.Fatalf("Parse returned error: %v", err)
	}
	if content != parseTestHelloContent {
		t.Fatalf("unexpected content: %q", content)
	}
}

func TestDocumentParseServiceParse_EmptyFileTypeAndCannotResolve(t *testing.T) {
	t.Parallel()
	fetcher := &parseTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			return nil, errParseFetchFailed
		},
	}
	svc := documentdomain.NewParseService(fetcher, nil, logging.New())

	_, err := svc.Parse(context.Background(), "object-without-extension", "")
	if err == nil {
		t.Fatal("expected error but got nil")
	}
	if !strings.Contains(err.Error(), "missing or unsupported file type") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestDocumentParseServiceValidateSource(t *testing.T) {
	t.Parallel()
	fetcher := &parseTestFetcher{
		statFn: func(context.Context, string) error {
			return nil
		},
	}
	svc := documentdomain.NewParseService(fetcher, nil, logging.New())
	if err := svc.ValidateSource(context.Background(), "DT001/a/b/file.md"); err != nil {
		t.Fatalf("ValidateSource returned error: %v", err)
	}
}

func TestDocumentParseServiceValidateSource_Failed(t *testing.T) {
	t.Parallel()
	fetcher := &parseTestFetcher{
		statFn: func(context.Context, string) error {
			return errParseObjectNotFound
		},
	}
	svc := documentdomain.NewParseService(fetcher, nil, logging.New())

	err := svc.ValidateSource(context.Background(), "DT001/missing.md")
	if err == nil {
		t.Fatal("expected error but got nil")
	}
	if !strings.Contains(err.Error(), "document source check failed") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func assertStreamParserSkipsGetLink(t *testing.T, path, fileType string) {
	t.Helper()

	var getLinkCalls atomic.Int64
	var fetchCalls atomic.Int64
	fetcher := &parseTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			fetchCalls.Add(1)
			return io.NopCloser(strings.NewReader(parseTestHelloContent)), nil
		},
		getLinkFn: func(context.Context, string, string, time.Duration) (string, error) {
			getLinkCalls.Add(1)
			return "https://signed.example/demo.md", nil
		},
	}
	svc := documentdomain.NewParseService(fetcher, []documentdomain.Parser{
		&parseTestParser{supported: "md"},
	}, logging.New())

	content, err := svc.Parse(context.Background(), path, fileType)
	if err != nil {
		t.Fatalf("Parse returned error: %v", err)
	}
	if content != parseTestHelloContent {
		t.Fatalf("unexpected content: %q", content)
	}
	if got := fetchCalls.Load(); got != 1 {
		t.Fatalf("expected 1 fetch call, got %d", got)
	}
	if got := getLinkCalls.Load(); got != 0 {
		t.Fatalf("expected 0 getLink calls, got %d", got)
	}
}

func TestDocumentParseServiceParse_TextParserSkipsGetLink(t *testing.T) {
	t.Parallel()
	assertStreamParserSkipsGetLink(t, "DT001/demo.md", "md")
}

func TestDocumentParseServiceParse_ResolvedURLParserUsesGetLink(t *testing.T) {
	t.Parallel()

	var getLinkCalls atomic.Int64
	var fetchCalls atomic.Int64
	const signedURL = "https://signed.example/demo.pdf"
	fetcher := &parseTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			fetchCalls.Add(1)
			return io.NopCloser(strings.NewReader("pdf")), nil
		},
		getLinkFn: func(context.Context, string, string, time.Duration) (string, error) {
			getLinkCalls.Add(1)
			return signedURL, nil
		},
	}
	svc := documentdomain.NewParseService(fetcher, []documentdomain.Parser{
		&parseTestParser{
			supported: "pdf",
			needsURL:  true,
			parseFn: func(ctx context.Context, fileURL string, file io.Reader, fileType string) (string, error) {
				if fileURL != signedURL {
					return "", fmt.Errorf("%w: %s", errParseUnexpectedResolvedURL, fileURL)
				}
				data, err := io.ReadAll(file)
				if err != nil {
					return "", fmt.Errorf("read parser input: %w", err)
				}
				return string(data), nil
			},
		},
	}, logging.New())

	content, err := svc.Parse(context.Background(), "DT001/demo.pdf", "pdf")
	if err != nil {
		t.Fatalf("Parse returned error: %v", err)
	}
	if content != "pdf" {
		t.Fatalf("unexpected content: %q", content)
	}
	if got := fetchCalls.Load(); got != 1 {
		t.Fatalf("expected 1 fetch call, got %d", got)
	}
	if got := getLinkCalls.Load(); got != 1 {
		t.Fatalf("expected 1 getLink call, got %d", got)
	}
}

func TestDocumentParseServiceParse_ResolveFileTypeStillSkipsGetLinkForStreamParser(t *testing.T) {
	t.Parallel()
	assertStreamParserSkipsGetLink(t, "https://example.com/demo.md?token=1", "")
}

func TestDocumentParseServiceParse_PassesOriginalSourceToStreamParser(t *testing.T) {
	t.Parallel()

	const originalSource = "DT001/docs/demo.md"
	fetcher := &parseTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			return io.NopCloser(strings.NewReader("hello")), nil
		},
	}
	svc := documentdomain.NewParseService(fetcher, []documentdomain.Parser{
		&parseTestParser{
			supported: "md",
			parseFn: func(_ context.Context, fileURL string, file io.Reader, fileType string) (string, error) {
				if fileURL != originalSource {
					return "", fmt.Errorf("%w: %s", errParseUnexpectedResolvedURL, fileURL)
				}
				return "ok", nil
			},
		},
	}, logging.New())

	content, err := svc.Parse(context.Background(), originalSource, "md")
	if err != nil {
		t.Fatalf("Parse returned error: %v", err)
	}
	if content != "ok" {
		t.Fatalf("unexpected content: %q", content)
	}
}

func TestDocumentParseServiceParse_GetLinkFailureOnlyAffectsResolvedURLParser(t *testing.T) {
	t.Parallel()

	fetcher := &parseTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			return io.NopCloser(strings.NewReader("hello")), nil
		},
		getLinkFn: func(context.Context, string, string, time.Duration) (string, error) {
			return "", errParseFetchFailed
		},
	}
	svc := documentdomain.NewParseService(fetcher, []documentdomain.Parser{
		&parseTestParser{supported: "pdf", needsURL: true},
	}, logging.New())

	_, err := svc.Parse(context.Background(), "DT001/demo.pdf", "pdf")
	if err == nil {
		t.Fatal("expected error but got nil")
	}
	if !strings.Contains(err.Error(), "fetch failed") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestDocumentParseServiceParse_NoExtensionImageUsesContentType(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("fake-image"))
	}))
	defer server.Close()
	targetURL := server.URL + "/download"

	fetcher := &parseTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			return io.NopCloser(strings.NewReader("image")), nil
		},
		getLinkFn: func(context.Context, string, string, time.Duration) (string, error) {
			return targetURL, nil
		},
	}

	var seenType atomic.Value
	svc := documentdomain.NewParseService(fetcher, []documentdomain.Parser{
		&parseTestParser{
			supported: "png",
			needsURL:  true,
			parseFn: func(_ context.Context, fileURL string, file io.Reader, fileType string) (string, error) {
				seenType.Store(fileType)
				if fileURL != targetURL {
					return "", fmt.Errorf("%w: %s", errParseUnexpectedResolvedURL, fileURL)
				}
				return "ok", nil
			},
		},
	}, logging.New())

	content, err := svc.Parse(context.Background(), targetURL, "")
	if err != nil {
		t.Fatalf("Parse returned error: %v", err)
	}
	if content != "ok" {
		t.Fatalf("unexpected content: %q", content)
	}
	if got := seenType.Load(); got != "png" {
		t.Fatalf("expected resolved file type png, got %#v", got)
	}
}

func TestDocumentParseServiceParseDocument_UsesStructuredParserOutput(t *testing.T) {
	t.Parallel()

	fetcher := &parseTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			return io.NopCloser(strings.NewReader("ignored")), nil
		},
	}
	svc := documentdomain.NewParseService(fetcher, []documentdomain.Parser{
		&parseTestParser{
			supported: "csv",
			parseDocumentFn: func(context.Context, string, io.Reader, string) (*parseddocument.ParsedDocument, error) {
				return &parseddocument.ParsedDocument{
					SourceType: parseddocument.SourceTabular,
					PlainText:  "table text",
					Blocks: []parseddocument.ParsedBlock{
						{
							Type:    parseddocument.BlockTypeTableSummary,
							Content: "summary",
						},
					},
				}, nil
			},
		},
	}, logging.New())

	parsed, err := svc.ParseDocument(context.Background(), "DT001/demo.csv", "csv")
	if err != nil {
		t.Fatalf("ParseDocument returned error: %v", err)
	}
	if parsed == nil || parsed.SourceType != parseddocument.SourceTabular {
		t.Fatalf("expected structured parsed document, got %#v", parsed)
	}
	if parsed.DocumentMeta[parseddocument.MetaSourceFormat] != "csv" {
		t.Fatalf("expected source format metadata, got %#v", parsed.DocumentMeta)
	}
}

func TestDocumentParseServiceParse_UsesBestEffortTextFromStructuredDocument(t *testing.T) {
	t.Parallel()

	fetcher := &parseTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			return io.NopCloser(strings.NewReader("ignored")), nil
		},
	}
	svc := documentdomain.NewParseService(fetcher, []documentdomain.Parser{
		&parseTestParser{
			supported: "csv",
			parseDocumentFn: func(context.Context, string, io.Reader, string) (*parseddocument.ParsedDocument, error) {
				return &parseddocument.ParsedDocument{
					SourceType: parseddocument.SourceTabular,
					Blocks: []parseddocument.ParsedBlock{
						{Type: parseddocument.BlockTypeTableSummary, Content: "summary"},
						{Type: parseddocument.BlockTypeTableRow, Content: "row"},
					},
				}, nil
			},
		},
	}, logging.New())

	content, err := svc.Parse(context.Background(), "DT001/demo.csv", "csv")
	if err != nil {
		t.Fatalf("Parse returned error: %v", err)
	}
	if content != "summary\n\nrow" {
		t.Fatalf("unexpected best effort text: %q", content)
	}
}

func TestDocumentParseServiceParseDocumentWithOptions_ForwardsParseOptions(t *testing.T) {
	t.Parallel()

	fetcher := &parseTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			return io.NopCloser(strings.NewReader("ignored")), nil
		},
	}
	parserWithOptions := &parseTestParserWithOptions{
		parseTestParser: &parseTestParser{
			supported: "md",
			parseDocumentFn: func(context.Context, string, io.Reader, string) (*parseddocument.ParsedDocument, error) {
				return parseddocument.NewPlainTextParsedDocument("md", "ok"), nil
			},
		},
	}
	svc := documentdomain.NewParseService(fetcher, []documentdomain.Parser{parserWithOptions}, logging.New())

	options := documentdomain.ParseOptions{
		ParsingType:     documentdomain.ParsingTypeQuick,
		ImageExtraction: false,
		TableExtraction: false,
		ImageOCR:        false,
	}
	parsed, err := svc.ParseDocumentWithOptions(context.Background(), "DT001/demo.md", "md", options)
	if err != nil {
		t.Fatalf("ParseDocumentWithOptions returned error: %v", err)
	}
	if parsed == nil || parsed.BestEffortText() != "ok" {
		t.Fatalf("unexpected parsed result: %#v", parsed)
	}
	if parserWithOptions.lastOptions == nil || *parserWithOptions.lastOptions != options {
		t.Fatalf("expected options forwarded to parser, got %#v", parserWithOptions.lastOptions)
	}
}

func TestDocumentParseService_SourceSizePrecheckFailsBeforeFetch(t *testing.T) {
	t.Parallel()

	var fetchCalled atomic.Bool
	fetcher := &parseTestFetcher{
		fileSizeFn: func(context.Context, string) (int64, error) {
			return 6, nil
		},
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			fetchCalled.Store(true)
			return io.NopCloser(strings.NewReader("ignored")), nil
		},
	}
	svc := documentdomain.NewParseServiceWithLimits(
		fetcher,
		[]documentdomain.Parser{&parseTestParser{supported: "txt"}},
		logging.New(),
		documentdomain.ResourceLimits{MaxSourceBytes: 5},
	)

	_, err := svc.ParseDocumentWithOptions(context.Background(), "DT001/large.txt", "txt", documentdomain.DefaultParseOptions())
	if !errors.Is(err, documentdomain.ErrDocumentResourceLimitExceeded) {
		t.Fatalf("expected resource limit error, got %v", err)
	}
	if fetchCalled.Load() {
		t.Fatalf("expected fetch skipped after source size precheck")
	}
}

func TestDocumentParseService_SourceSizeLimitedReaderFailsDuringRead(t *testing.T) {
	t.Parallel()

	fetcher := &parseTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			return io.NopCloser(strings.NewReader("hello")), nil
		},
	}
	svc := documentdomain.NewParseServiceWithLimits(
		fetcher,
		[]documentdomain.Parser{&parseTestParser{supported: "txt"}},
		logging.New(),
		documentdomain.ResourceLimits{MaxSourceBytes: 4},
	)

	_, err := svc.ParseDocumentWithOptions(context.Background(), "DT001/large.txt", "txt", documentdomain.DefaultParseOptions())
	if !errors.Is(err, documentdomain.ErrDocumentResourceLimitExceeded) {
		t.Fatalf("expected resource limit error, got %v", err)
	}
}

func TestDocumentParseService_ParsedDocumentPlainTextLimit(t *testing.T) {
	t.Parallel()

	fetcher := &parseTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			return io.NopCloser(strings.NewReader("short")), nil
		},
	}
	svc := documentdomain.NewParseServiceWithLimits(
		fetcher,
		[]documentdomain.Parser{
			&parseTestParser{
				supported: "txt",
				parseDocumentFn: func(context.Context, string, io.Reader, string) (*parseddocument.ParsedDocument, error) {
					return parseddocument.NewPlainTextParsedDocument("txt", "abcdef"), nil
				},
			},
		},
		logging.New(),
		documentdomain.ResourceLimits{
			MaxSourceBytes:    1024,
			MaxPlainTextChars: 5,
		},
	)

	_, err := svc.ParseDocumentWithOptions(context.Background(), "DT001/text.txt", "txt", documentdomain.DefaultParseOptions())
	if !errors.Is(err, documentdomain.ErrDocumentResourceLimitExceeded) {
		t.Fatalf("expected resource limit error, got %v", err)
	}
}

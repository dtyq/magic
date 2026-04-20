package docparser_test

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/png"
	"io"
	"testing"
	"time"

	documentdomain "magic/internal/domain/knowledge/document/service"
	documentsplitter "magic/internal/domain/knowledge/document/splitter"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/infrastructure/logging"
	parser "magic/internal/infrastructure/parser"
	"magic/internal/pkg/tokenizer"
)

type parserTestFetcherStub struct {
	files map[string][]byte
}

func (s *parserTestFetcherStub) Fetch(_ context.Context, path string) (io.ReadCloser, error) {
	return io.NopCloser(bytes.NewReader(s.files[path])), nil
}

func (s *parserTestFetcherStub) GetLink(context.Context, string, string, time.Duration) (string, error) {
	return "", nil
}

func (s *parserTestFetcherStub) Stat(context.Context, string) error {
	return nil
}

func writeTestPNGToBuffer(t *testing.T, buffer *bytes.Buffer) {
	t.Helper()

	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.Black)
	img.Set(1, 1, color.White)
	if err := png.Encode(buffer, img); err != nil {
		t.Fatalf("encode png: %v", err)
	}
}

func assertParseServiceProducesHierarchyChunks(
	t *testing.T,
	path string,
	content []byte,
	sourceFileType string,
) {
	t.Helper()

	fetcher := &parserTestFetcherStub{
		files: map[string][]byte{
			path: content,
		},
	}
	svc := documentdomain.NewParseService(fetcher, []documentdomain.Parser{
		parser.NewPlainTextParser(),
		parser.NewMarkdownParser(),
		parser.NewHTMLParser(),
		parser.NewXMLParser(),
		parser.NewJSONParser(),
	}, logging.New())

	parsed, err := svc.ParseDocumentWithOptions(context.Background(), path, "", documentdomain.DefaultParseOptions())
	if err != nil {
		t.Fatalf("parse service %s: %v", sourceFileType, err)
	}

	chunks, _, err := documentsplitter.SplitParsedDocumentToChunks(context.Background(), documentsplitter.ParsedDocumentChunkInput{
		Parsed:           parsed,
		SourceFileType:   sourceFileType,
		RequestedMode:    shared.FragmentModeHierarchy,
		Model:            tokenizer.DefaultEncoding,
		TokenizerService: tokenizer.NewService(),
		Logger:           logging.New(),
	})
	if err != nil {
		t.Fatalf("split %s parsed document: %v", sourceFileType, err)
	}
	if len(chunks) == 0 {
		t.Fatalf("expected %s hierarchy chunks", sourceFileType)
	}
	if chunks[0].EffectiveSplitMode != "hierarchy_auto" {
		t.Fatalf("expected %s hierarchy split mode, got %q", sourceFileType, chunks[0].EffectiveSplitMode)
	}
}

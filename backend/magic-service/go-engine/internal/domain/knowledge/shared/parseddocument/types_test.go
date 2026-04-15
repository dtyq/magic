package parseddocument_test

import (
	"testing"

	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
)

func TestNewPlainTextParsedDocument(t *testing.T) {
	t.Parallel()

	doc := parseddocument.NewPlainTextParsedDocument(" csv ", "content")
	if doc.SourceType != parseddocument.SourceText {
		t.Fatalf("expected source type %q, got %q", parseddocument.SourceText, doc.SourceType)
	}
	if got := doc.DocumentMeta[parseddocument.MetaSourceFormat]; got != "csv" {
		t.Fatalf("expected trimmed source format, got %#v", got)
	}
}

func TestParsedDocumentBestEffortText(t *testing.T) {
	t.Parallel()

	doc := &parseddocument.ParsedDocument{
		Blocks: []parseddocument.ParsedBlock{
			{Content: " first "},
			{Content: ""},
			{Content: "second"},
		},
	}
	if got := doc.BestEffortText(); got != "first\n\nsecond" {
		t.Fatalf("expected best effort text from blocks, got %q", got)
	}
}

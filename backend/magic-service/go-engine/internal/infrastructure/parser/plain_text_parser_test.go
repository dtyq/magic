package docparser_test

import (
	"context"
	"strings"
	"testing"

	parser "magic/internal/infrastructure/parser"
)

func TestPlainTextParser_Parse(t *testing.T) {
	t.Parallel()

	p := parser.NewPlainTextParser()
	content, err := p.Parse(context.Background(), "", strings.NewReader("hello"), "txt")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if content != "hello" {
		t.Fatalf("unexpected content: %q", content)
	}
}

func TestPlainTextParser_Supports(t *testing.T) {
	t.Parallel()

	p := parser.NewPlainTextParser()
	if !p.Supports("TXT") {
		t.Fatalf("expected TXT supported")
	}
	if p.Supports("md") {
		t.Fatalf("expected md unsupported")
	}
}

func TestPlainTextParser_ParseDocumentDecodesEscapedMultilineContent(t *testing.T) {
	t.Parallel()

	p := parser.NewPlainTextParser()
	parsed, err := p.ParseDocument(
		context.Background(),
		"",
		strings.NewReader("第一行\\n\\n第二行"),
		"txt",
	)
	if err != nil {
		t.Fatalf("parse document: %v", err)
	}
	if got := parsed.BestEffortText(); got != "第一行\n\n第二行" {
		t.Fatalf("unexpected parsed content: %q", got)
	}
}

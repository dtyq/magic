package docparser_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"strings"
	"testing"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
	parser "magic/internal/infrastructure/parser"
)

func TestHTMLParser_ParseDocumentResolvesDataImageOCR(t *testing.T) {
	t.Parallel()

	var image bytes.Buffer
	writeTestPNGToBuffer(t, &image)
	dataURL := "data:image/png;base64," + base64.StdEncoding.EncodeToString(image.Bytes())

	p := parser.NewHTMLParserWithAssets(nil, &fakeDocxOCR{textsByType: map[string]string{"png": "HTML图片词"}}, 20)
	parsed, err := p.ParseDocument(
		context.Background(),
		"",
		strings.NewReader("<html><body><h1>标题</h1><p>正文<img src=\""+dataURL+"\"></p></body></html>"),
		"html",
	)
	if err != nil {
		t.Fatalf("parse html: %v", err)
	}

	content := parsed.BestEffortText()
	if !strings.Contains(content, "# 标题") || !strings.Contains(content, "正文 HTML图片词") {
		t.Fatalf("expected heading and OCR text in HTML content, got %q", content)
	}
	if got := parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRSuccessCount]; got != 1 {
		t.Fatalf("expected 1 OCR success, got %#v", got)
	}
}

func TestHTMLParser_ParseDocumentRendersTable(t *testing.T) {
	t.Parallel()

	p := parser.NewHTMLParser()
	parsed, err := p.ParseDocument(
		context.Background(),
		"",
		strings.NewReader("<table><tr><th>门店</th><th>品牌</th></tr><tr><td>深圳万象城</td><td>KKV</td></tr></table>"),
		"html",
	)
	if err != nil {
		t.Fatalf("parse html table: %v", err)
	}
	content := parsed.BestEffortText()
	for _, want := range []string{
		"门店 | 品牌",
		"深圳万象城 | KKV",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("expected html content to contain %q, got %q", want, content)
		}
	}
}

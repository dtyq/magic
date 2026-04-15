package docparser_test

import (
	"context"
	"strings"
	"testing"

	parser "magic/internal/infrastructure/parser"
)

func TestJSONParser_ParseDocumentBuildsHierarchyMarkdown(t *testing.T) {
	t.Parallel()

	p := parser.NewJSONParser()
	parsed, err := p.ParseDocument(
		context.Background(),
		"",
		strings.NewReader(`{
  "name": "门店数据库",
  "stores": [
    {
      "code": "V1",
      "name": "深圳万象城KKV店",
      "tags": ["在营", "华南"]
    },
    {
      "code": "T1",
      "name": "深圳万象城TC店",
      "meta": {
        "brand": "TC",
        "enabled": true
      }
    }
  ],
  "nothing": null
}`),
		"json",
	)
	if err != nil {
		t.Fatalf("parse json: %v", err)
	}

	content := parsed.BestEffortText()
	for _, want := range []string{
		"name: 门店数据库",
		"nothing: null",
		"# stores[1]",
		"code: V1",
		"tags[1]: 在营",
		"tags[2]: 华南",
		"# stores[2]",
		"## meta",
		"brand: TC",
		"enabled: true",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("expected json content to contain %q, got %q", want, content)
		}
	}
}

func TestJSONParser_ParseDocumentSupportsTopLevelArray(t *testing.T) {
	t.Parallel()

	p := parser.NewJSONParser()
	parsed, err := p.ParseDocument(
		context.Background(),
		"",
		strings.NewReader(`[{"code":"V1","brand":"KKV"},{"code":"T1","brand":"TC"}]`),
		"json",
	)
	if err != nil {
		t.Fatalf("parse top-level json array: %v", err)
	}

	content := parsed.BestEffortText()
	for _, want := range []string{
		"# item[1]",
		"code: V1",
		"# item[2]",
		"brand: TC",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("expected json array content to contain %q, got %q", want, content)
		}
	}
}

func TestJSONParser_IntegrationWithParseServiceAndHierarchySplit(t *testing.T) {
	t.Parallel()

	assertParseServiceProducesHierarchyChunks(
		t,
		"DT001/demo.json",
		[]byte(`{"stores":[{"code":"V1","meta":{"name":"深圳万象城KKV店"}}]}`),
		"json",
	)
}

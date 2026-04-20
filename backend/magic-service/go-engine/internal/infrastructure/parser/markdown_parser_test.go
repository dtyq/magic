package docparser_test

import (
	"bytes"
	"context"
	"strings"
	"testing"

	documentdomain "magic/internal/domain/knowledge/document/service"
	parser "magic/internal/infrastructure/parser"
)

func TestMarkdownParser_ParseDocumentResolvesRelativeImageOCR(t *testing.T) {
	t.Parallel()

	var image bytes.Buffer
	writeTestPNGToBuffer(t, &image)
	fetcher := &parserTestFetcherStub{
		files: map[string][]byte{
			"DT001/docs/images/demo.png": image.Bytes(),
		},
	}

	p := parser.NewMarkdownParserWithAssets(fetcher, &fakeDocxOCR{textsByType: map[string]string{"png": "Markdown图片词"}}, 20)
	parsed, err := p.ParseDocument(
		context.Background(),
		"DT001/docs/demo.md",
		strings.NewReader("# 标题\n正文 ![示意](./images/demo.png)"),
		"md",
	)
	if err != nil {
		t.Fatalf("parse markdown: %v", err)
	}

	content := parsed.BestEffortText()
	if !strings.Contains(content, "# 标题") || !strings.Contains(content, "正文") || !strings.Contains(content, "Markdown图片词") {
		t.Fatalf("expected heading, text and OCR text, got %q", content)
	}
	if got := parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRSuccessCount]; got != 1 {
		t.Fatalf("expected 1 OCR success, got %#v", got)
	}
}

func TestMarkdownParser_ParseDocumentHandlesInlineNodesWithoutPanic(t *testing.T) {
	t.Parallel()

	p := parser.NewMarkdownParser()
	parsed, err := p.ParseDocument(
		context.Background(),
		"DT001/docs/demo.md",
		strings.NewReader("# 标题\n正文里有 `code span`、[链接文本](https://example.com) 和 **强调内容**。"),
		"md",
	)
	if err != nil {
		t.Fatalf("parse markdown with inline nodes: %v", err)
	}

	content := parsed.BestEffortText()
	for _, want := range []string{"# 标题", "正文里有", "code span", "链接文本", "强调内容"} {
		if !strings.Contains(content, want) {
			t.Fatalf("expected parsed markdown to contain %q, got %q", want, content)
		}
	}
}

func TestMarkdownParser_ParseDocumentDecodesEscapedMultilineContent(t *testing.T) {
	t.Parallel()

	p := parser.NewMarkdownParser()
	parsed, err := p.ParseDocument(
		context.Background(),
		"DT001/docs/demo.md",
		strings.NewReader("# 标题\\n\\n## 背景\\n正文"),
		"md",
	)
	if err != nil {
		t.Fatalf("parse escaped markdown: %v", err)
	}

	content := parsed.BestEffortText()
	for _, want := range []string{"# 标题", "## 背景", "正文"} {
		if !strings.Contains(content, want) {
			t.Fatalf("expected parsed markdown to contain %q, got %q", want, content)
		}
	}
	if !strings.Contains(content, "\n## 背景\n") {
		t.Fatalf("expected escaped newlines decoded before markdown parsing, got %q", content)
	}
}

func TestMarkdownParser_ParseDocumentKeepsListItems(t *testing.T) {
	t.Parallel()

	p := parser.NewMarkdownParser()
	parsed, err := p.ParseDocument(
		context.Background(),
		"DT001/docs/demo.md",
		strings.NewReader("# 标题\n\n## 背景\n\n### 当前状态\n- **数据来源**：前端将录音识别的文本实时写入文件\n- **数据格式**：纯文本格式 `[HH:MM:SS] 文本内容`\n\n### 存在问题\n1. **前端痛点**：只能遍历全文\n2. **后端痛点**：缺乏查询机制"),
		"md",
	)
	if err != nil {
		t.Fatalf("parse markdown list items: %v", err)
	}

	content := parsed.BestEffortText()
	for _, want := range []string{
		"# 标题",
		"### 当前状态",
		"- 数据来源：前端将录音识别的文本实时写入文件",
		"- 数据格式：纯文本格式 [HH:MM:SS] 文本内容",
		"- 前端痛点：只能遍历全文",
		"- 后端痛点：缺乏查询机制",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("expected parsed markdown to contain %q, got %q", want, content)
		}
	}
}

func TestMarkdownParser_ParseDocumentWithHTMLBlockTable(t *testing.T) {
	t.Parallel()

	p := parser.NewMarkdownParser()
	parsed, err := p.ParseDocument(
		context.Background(),
		"DT001/docs/demo.md",
		strings.NewReader(`<div class="tableWrapper">
<table><tbody><tr><td><p>商品条码</p></td><td><p>商品名称</p></td><td><p>销量</p></td></tr><tr><td><p>8809402289264</p></td><td><p>粉饼</p></td><td><p>1950</p></td></tr></tbody></table>
</div>`),
		"md",
	)
	if err != nil {
		t.Fatalf("parse markdown html block: %v", err)
	}

	content := parsed.BestEffortText()
	for _, want := range []string{
		"商品条码 | 商品名称 | 销量",
		"8809402289264 | 粉饼 | 1950",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("expected parsed markdown html block to contain %q, got %q", want, content)
		}
	}
}

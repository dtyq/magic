package docparser_test

import (
	"bytes"
	"context"
	"strings"
	"testing"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
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
	for _, want := range []string{
		"# 标题",
		"正文 ![示意](./images/demo.png)",
		"Markdown图片词",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("expected parsed markdown to contain %q, got %q", want, content)
		}
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
	for _, want := range []string{
		"# 标题",
		"`code span`",
		"[链接文本](https://example.com)",
		"**强调内容**",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("expected parsed markdown to contain %q, got %q", want, content)
		}
	}
}

func TestMarkdownParser_ParseDocumentPreservesAutolinkURLs(t *testing.T) {
	t.Parallel()

	p := parser.NewMarkdownParser()
	source := `1.收银机卡单，门店需确认是否支付成功，按指引操作并留下顾客联系方式。

门店确认支付成功指引：

<https://docs.example.com/file/831538921692561409>

2.操作了退款，但是退款异常：按指引操作并留下顾客联系方式，操作后需报备门店负责财务。

退款异常处理指引：

<https://docs.example.com/file/831539461956739073>

3.卡单已确认收款，未出票，如何出票（联系技术补单处理）

一、确认收款，保留顾客支付单号；

二、登记天书补单信息（链接：

<https://docs.example.com/base/823882634407108608/823882634470023168/Bb0uU0S3> ）`

	parsed, err := p.ParseDocument(context.Background(), "DT001/docs/hh.md", strings.NewReader(source), "md")
	if err != nil {
		t.Fatalf("parse markdown autolinks: %v", err)
	}

	content := parsed.BestEffortText()
	for _, want := range []string{
		"<https://docs.example.com/file/831538921692561409>",
		"<https://docs.example.com/file/831539461956739073>",
		"<https://docs.example.com/base/823882634407108608/823882634470023168/Bb0uU0S3>",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("expected parsed markdown to preserve %q, got %q", want, content)
		}
	}
}

func TestMarkdownParser_ParseDocumentPreservesCommonMarkdownSyntax(t *testing.T) {
	t.Parallel()

	p := parser.NewMarkdownParser()
	source := `# 标题

> 引用 [引用链接][ref]

- [x] 已完成任务
- [ ] 未完成任务

| 商品 | 链接 |
| --- | --- |
| 粉饼 | [详情](https://example.com/item?id=1) |

![图片](./images/demo.png)

` + "```go\nfmt.Println(\"https://example.com/code\")\n```\n\n" + `<section><table><tr><td>商品条码</td><td>销量</td></tr><tr><td>8809402289264</td><td>1950</td></tr></table></section>

脚注引用[^1]

[ref]: https://example.com/ref
[^1]: https://example.com/footnote`

	parsed, err := p.ParseDocument(context.Background(), "DT001/docs/demo.md", strings.NewReader(source), "md")
	if err != nil {
		t.Fatalf("parse markdown syntax: %v", err)
	}

	content := parsed.BestEffortText()
	for _, want := range []string{
		"> 引用 [引用链接][ref]",
		"- [x] 已完成任务",
		"| 粉饼 | [详情](https://example.com/item?id=1) |",
		"![图片](./images/demo.png)",
		"```go\nfmt.Println(\"https://example.com/code\")\n```",
		"[ref]: https://example.com/ref",
		"[^1]: https://example.com/footnote",
		"商品条码 | 销量",
		"8809402289264 | 1950",
	} {
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
		"- **数据来源**：前端将录音识别的文本实时写入文件",
		"- **数据格式**：纯文本格式 `[HH:MM:SS] 文本内容`",
		"1. **前端痛点**：只能遍历全文",
		"2. **后端痛点**：缺乏查询机制",
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
		`<table><tbody><tr><td><p>商品条码</p></td>`,
		"商品条码 | 商品名称 | 销量",
		"8809402289264 | 粉饼 | 1950",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("expected parsed markdown html block to contain %q, got %q", want, content)
		}
	}
}

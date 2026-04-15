package docparser_test

import (
	"context"
	"strings"
	"testing"

	parser "magic/internal/infrastructure/parser"
)

func TestXMLParser_ParseDocumentBuildsHierarchyMarkdown(t *testing.T) {
	t.Parallel()

	p := parser.NewXMLParser()
	parsed, err := p.ParseDocument(
		context.Background(),
		"",
		strings.NewReader(`<?xml version="1.0" encoding="utf-8"?>
<门店数据库 总数="2">
  <门店 编码="V1">
    <门店名称>深圳万象城KKV店</门店名称>
    <品牌>KKV</品牌>
    <meta lang="zh">直营</meta>
  </门店>
  <门店 编码="V2">
    <门店名称>深圳万象城TC店</门店名称>
    <品牌>TC</品牌>
  </门店>
  <ns:叶子 xmlns:ns="urn:test">值</ns:叶子>
</门店数据库>`),
		"xml",
	)
	if err != nil {
		t.Fatalf("parse xml: %v", err)
	}

	content := parsed.BestEffortText()
	for _, want := range []string{
		"# 门店数据库",
		"属性.总数: 2",
		"## 门店[1]",
		"属性.编码: V1",
		"门店名称: 深圳万象城KKV店",
		"### meta",
		"属性.lang: zh",
		"内容: 直营",
		"## 门店[2]",
		"叶子: 值",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("expected xml content to contain %q, got %q", want, content)
		}
	}
}

func TestXMLParser_IntegrationWithParseServiceAndHierarchySplit(t *testing.T) {
	t.Parallel()

	assertParseServiceProducesHierarchyChunks(
		t,
		"DT001/demo.xml",
		[]byte(`<门店数据库><门店><门店名称>深圳万象城KKV店</门店名称><品牌>KKV</品牌></门店></门店数据库>`),
		"xml",
	)
}

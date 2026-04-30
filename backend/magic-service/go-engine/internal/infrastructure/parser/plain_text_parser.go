package docparser

import (
	"context"
	"io"
	"strings"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
)

// PlainTextParser 解析纯文本文件。
type PlainTextParser struct{}

// NewPlainTextParser 创建纯文本解析器。
func NewPlainTextParser() *PlainTextParser {
	return &PlainTextParser{}
}

// Parse 解析纯文本文件。
func (p *PlainTextParser) Parse(
	ctx context.Context,
	fileURL string,
	fileReader io.Reader,
	fileType string,
) (string, error) {
	parsed, err := p.ParseDocumentWithOptions(ctx, fileURL, fileReader, fileType, documentdomain.DefaultParseOptions())
	if err != nil {
		return "", err
	}
	return parsed.BestEffortText(), nil
}

// ParseWithOptions 按解析选项解析纯文本文件。
func (p *PlainTextParser) ParseWithOptions(
	ctx context.Context,
	fileURL string,
	fileReader io.Reader,
	fileType string,
	options documentdomain.ParseOptions,
) (string, error) {
	parsed, err := p.ParseDocumentWithOptions(ctx, fileURL, fileReader, fileType, options)
	if err != nil {
		return "", err
	}
	return parsed.BestEffortText(), nil
}

// ParseDocument 解析纯文本文件并返回结构化结果。
func (p *PlainTextParser) ParseDocument(
	ctx context.Context,
	fileURL string,
	fileReader io.Reader,
	fileType string,
) (*documentdomain.ParsedDocument, error) {
	return p.ParseDocumentWithOptions(ctx, fileURL, fileReader, fileType, documentdomain.DefaultParseOptions())
}

// ParseDocumentWithOptions 按解析选项解析纯文本文件并返回结构化结果。
func (p *PlainTextParser) ParseDocumentWithOptions(
	_ context.Context,
	_ string,
	fileReader io.Reader,
	fileType string,
	_ documentdomain.ParseOptions,
) (*documentdomain.ParsedDocument, error) {
	content, err := readAndNormalizeParserSource(fileReader, fileType)
	if err != nil {
		return nil, err
	}
	return documentdomain.NewPlainTextParsedDocument(fileType, string(content)), nil
}

// Supports 检查是否支持该文件类型。
func (p *PlainTextParser) Supports(fileType string) bool {
	return strings.ToLower(strings.TrimSpace(fileType)) == "txt"
}

// NeedsResolvedURL 纯文本解析器只依赖文件流。
func (p *PlainTextParser) NeedsResolvedURL() bool {
	return false
}

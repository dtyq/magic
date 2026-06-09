package docparser

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"strings"

	document "magic/internal/domain/knowledge/document/metadata"
)

var (
	errLegacyDocParserDependencies = errors.New("legacy doc parser dependencies are not configured")
	errLegacyXlsParserDependencies = errors.New("legacy xls parser dependencies are not configured")
)

// LegacyDocParser 解析旧版 .doc 文档。
type LegacyDocParser struct {
	converter *LegacyOfficeConverter
	delegate  *DocxParser
}

// NewLegacyDocParser 创建旧版 Word 解析器。
func NewLegacyDocParser(converter *LegacyOfficeConverter, delegate *DocxParser) *LegacyDocParser {
	return &LegacyDocParser{converter: converter, delegate: delegate}
}

// Parse 解析旧版 Word 为纯文本。
func (p *LegacyDocParser) Parse(ctx context.Context, fileURL string, file io.Reader, fileType string) (string, error) {
	parsed, err := p.ParseDocumentWithOptions(ctx, fileURL, file, fileType, document.DefaultParseOptions())
	if err != nil {
		return "", err
	}
	if parsed == nil {
		return "", nil
	}
	return parsed.BestEffortText(), nil
}

// ParseWithOptions 按解析选项解析旧版 Word 为纯文本。
func (p *LegacyDocParser) ParseWithOptions(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
	options document.ParseOptions,
) (string, error) {
	parsed, err := p.ParseDocumentWithOptions(ctx, fileURL, file, fileType, options)
	if err != nil {
		return "", err
	}
	if parsed == nil {
		return "", nil
	}
	return parsed.BestEffortText(), nil
}

// ParseDocument 解析旧版 Word 并返回结构化结果。
func (p *LegacyDocParser) ParseDocument(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
) (*document.ParsedDocument, error) {
	return p.ParseDocumentWithOptions(ctx, fileURL, file, fileType, document.DefaultParseOptions())
}

// ParseDocumentWithOptions 按解析选项解析旧版 Word。
func (p *LegacyDocParser) ParseDocumentWithOptions(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
	options document.ParseOptions,
) (*document.ParsedDocument, error) {
	if p == nil || p.converter == nil || p.delegate == nil {
		return nil, errLegacyDocParserDependencies
	}
	converted, err := p.converter.Convert(ctx, file, "doc", "docx")
	if err != nil {
		return nil, fmt.Errorf("convert doc to docx: %w", err)
	}
	return p.delegate.ParseDocumentWithOptions(ctx, fileURL, bytes.NewReader(converted), "docx", options)
}

// Supports 检查是否支持该文件类型。
func (p *LegacyDocParser) Supports(fileType string) bool {
	return strings.EqualFold(strings.TrimSpace(fileType), "doc")
}

// NeedsResolvedURL 旧版 Word 解析只依赖文件流。
func (p *LegacyDocParser) NeedsResolvedURL() bool {
	return false
}

// LegacyXlsParser 解析旧版 .xls 表格。
type LegacyXlsParser struct {
	converter *LegacyOfficeConverter
	delegate  *XlsxParser
}

// NewLegacyXlsParser 创建旧版 Excel 解析器。
func NewLegacyXlsParser(converter *LegacyOfficeConverter, delegate *XlsxParser) *LegacyXlsParser {
	return &LegacyXlsParser{converter: converter, delegate: delegate}
}

// Parse 解析旧版 Excel 为纯文本。
func (p *LegacyXlsParser) Parse(ctx context.Context, fileURL string, file io.Reader, fileType string) (string, error) {
	parsed, err := p.ParseDocumentWithOptions(ctx, fileURL, file, fileType, document.DefaultParseOptions())
	if err != nil {
		return "", err
	}
	if parsed == nil {
		return "", nil
	}
	return parsed.BestEffortText(), nil
}

// ParseWithOptions 按解析选项解析旧版 Excel 为纯文本。
func (p *LegacyXlsParser) ParseWithOptions(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
	options document.ParseOptions,
) (string, error) {
	parsed, err := p.ParseDocumentWithOptions(ctx, fileURL, file, fileType, options)
	if err != nil {
		return "", err
	}
	if parsed == nil {
		return "", nil
	}
	return parsed.BestEffortText(), nil
}

// ParseDocument 解析旧版 Excel 并返回结构化结果。
func (p *LegacyXlsParser) ParseDocument(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
) (*document.ParsedDocument, error) {
	return p.ParseDocumentWithOptions(ctx, fileURL, file, fileType, document.DefaultParseOptions())
}

// ParseDocumentWithOptions 按解析选项解析旧版 Excel。
func (p *LegacyXlsParser) ParseDocumentWithOptions(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
	options document.ParseOptions,
) (*document.ParsedDocument, error) {
	if p == nil || p.converter == nil || p.delegate == nil {
		return nil, errLegacyXlsParserDependencies
	}
	converted, err := p.converter.Convert(ctx, file, "xls", "xlsx")
	if err != nil {
		return nil, fmt.Errorf("convert xls to xlsx: %w", err)
	}
	return p.delegate.ParseDocumentWithOptions(ctx, fileURL, bytes.NewReader(converted), "xlsx", options)
}

// Supports 检查是否支持该文件类型。
func (p *LegacyXlsParser) Supports(fileType string) bool {
	return strings.EqualFold(strings.TrimSpace(fileType), "xls")
}

// NeedsResolvedURL 旧版 Excel 解析只依赖文件流。
func (p *LegacyXlsParser) NeedsResolvedURL() bool {
	return false
}

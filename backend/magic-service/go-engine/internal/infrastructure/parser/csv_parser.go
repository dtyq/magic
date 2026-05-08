// Package docparser 提供文档解析器实现。
package docparser

import (
	"context"
	"fmt"
	"io"
	"strings"

	document "magic/internal/domain/knowledge/document/metadata"
)

// CSVParser CSV 解析器
type CSVParser struct {
	limits document.ResourceLimits
}

// NewCSVParser 创建 CSV 解析器
func NewCSVParser() *CSVParser {
	return NewCSVParserWithLimits(document.DefaultResourceLimits())
}

// NewCSVParserWithLimits 创建带资源限制的 CSV 解析器。
func NewCSVParserWithLimits(limits document.ResourceLimits) *CSVParser {
	return &CSVParser{limits: document.NormalizeResourceLimits(limits)}
}

// Parse 解析 CSV 文件
func (p *CSVParser) Parse(ctx context.Context, fileURL string, file io.Reader, fileType string) (string, error) {
	parsed, err := p.ParseDocumentWithOptions(ctx, fileURL, file, fileType, document.DefaultParseOptions())
	if err != nil {
		return "", err
	}
	return parsed.BestEffortText(), nil
}

// ParseWithOptions 按解析选项解析 CSV 文件。
func (p *CSVParser) ParseWithOptions(
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
	return parsed.BestEffortText(), nil
}

// ParseDocument 解析 CSV 文件并返回结构化结果。
func (p *CSVParser) ParseDocument(ctx context.Context, fileURL string, file io.Reader, fileType string) (*document.ParsedDocument, error) {
	return p.ParseDocumentWithOptions(ctx, fileURL, file, fileType, document.DefaultParseOptions())
}

// ParseDocumentWithOptions 按解析选项解析 CSV 文件并返回结构化结果。
func (p *CSVParser) ParseDocumentWithOptions(
	_ context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
	options document.ParseOptions,
) (*document.ParsedDocument, error) {
	if !options.TableExtraction {
		content, err := io.ReadAll(file)
		if err != nil {
			return nil, fmt.Errorf("read csv failed: %w", err)
		}
		return document.NewPlainTextParsedDocument(fileType, strings.TrimSpace(string(content))), nil
	}
	parsed, err := parseCSVDocument(file, fileURL, fileType, p.limits)
	if err != nil {
		return nil, fmt.Errorf("parse csv document failed: %w", err)
	}
	return parsed, nil
}

// Supports 检查是否支持该文件类型
func (p *CSVParser) Supports(fileType string) bool {
	return strings.ToLower(fileType) == "csv"
}

// NeedsResolvedURL CSV 解析只依赖文件流。
func (p *CSVParser) NeedsResolvedURL() bool {
	return false
}

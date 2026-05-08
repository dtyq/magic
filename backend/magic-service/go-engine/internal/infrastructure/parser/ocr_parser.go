package docparser

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"

	document "magic/internal/domain/knowledge/document/metadata"
)

// ErrOCRRequirements 表示 OCR 解析依赖未满足时的错误。
var ErrOCRRequirements = errors.New("ocr parsing requires ocr client and file url")

// OCRParser 统一处理 PDF/图片 OCR。
type OCRParser struct {
	ocrClient document.OCRClient
}

// NewOCRParser 创建 OCR 解析器。
func NewOCRParser(ocrClient document.OCRClient) *OCRParser {
	return &OCRParser{ocrClient: ocrClient}
}

// Parse 通过 OCR 解析 PDF/图片文件。
func (p *OCRParser) Parse(ctx context.Context, fileURL string, file io.Reader, fileType string) (string, error) {
	return p.ParseWithOptions(ctx, fileURL, file, fileType, document.DefaultParseOptions())
}

// ParseWithOptions 通过 OCR 解析 PDF/图片文件，并尊重解析策略。
func (p *OCRParser) ParseWithOptions(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
	options document.ParseOptions,
) (string, error) {
	if !options.ImageExtraction || !options.ImageOCR {
		return "", nil
	}
	if p.ocrClient == nil || strings.TrimSpace(fileURL) == "" {
		return "", ErrOCRRequirements
	}
	if sourceOCR, ok := p.ocrClient.(document.OCRSourceClient); ok {
		content, err := sourceOCR.OCRSource(ctx, fileURL, file, fileType)
		if err != nil {
			return "", fmt.Errorf("ocr failed: %w", err)
		}
		return content, nil
	}
	content, err := p.ocrClient.OCR(ctx, fileURL, fileType)
	if err != nil {
		return "", fmt.Errorf("ocr failed: %w", err)
	}
	return content, nil
}

// Supports 检查是否支持 OCR 解析的文件类型。
func (p *OCRParser) Supports(fileType string) bool {
	switch strings.ToLower(strings.TrimSpace(fileType)) {
	case "pdf", "jpg", "jpeg", "png", "bmp":
		return true
	default:
		return false
	}
}

// NeedsResolvedURL OCR 解析依赖外部可访问 URL。
func (p *OCRParser) NeedsResolvedURL() bool {
	return true
}

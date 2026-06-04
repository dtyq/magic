package docparser

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"

	document "magic/internal/domain/knowledge/document/metadata"
)

// ErrOCRRequirements 表示视觉转文字解析依赖未满足时的错误。
var ErrOCRRequirements = errors.New("visual text parsing requires visual extractor and file source")

// OCRParser 统一处理 PDF/图片视觉转文字，保留旧名称兼容测试和外部引用。
type OCRParser struct {
	visualExtractor document.VisualTextExtractor
}

// NewOCRParser 创建 OCR 解析器。
func NewOCRParser(ocrClient document.OCRClient) *OCRParser {
	return NewVisualTextParser(newVisualTextExtractorFromOCR(ocrClient))
}

// NewVisualTextParser 创建图片/PDF 视觉转文字解析器。
func NewVisualTextParser(visualExtractor document.VisualTextExtractor) *OCRParser {
	return &OCRParser{visualExtractor: visualExtractor}
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
	if p.visualExtractor == nil {
		return "", ErrOCRRequirements
	}
	content, err := p.visualExtractor.RecognizeSource(ctx, fileURL, file, fileType)
	if err != nil {
		return "", fmt.Errorf("visual text recognition failed: %w", err)
	}
	return content, nil
}

// Supports 检查是否支持图片视觉转文字的文件类型，PDF 由 PDFHybridParser 负责。
func (p *OCRParser) Supports(fileType string) bool {
	switch strings.ToLower(strings.TrimSpace(fileType)) {
	case "jpg", "jpeg", "png", "bmp":
		return true
	default:
		return false
	}
}

// NeedsResolvedURL 默认按 OCR 兼容路径声明依赖外部可访问 URL。
func (p *OCRParser) NeedsResolvedURL() bool {
	return true
}

// NeedsResolvedURLForOptions 按视觉转文字实现和解析策略动态判断是否需要可访问 URL。
func (p *OCRParser) NeedsResolvedURLForOptions(
	ctx context.Context,
	fileType string,
	options document.ParseOptions,
) bool {
	if !options.ImageExtraction || !options.ImageOCR {
		return false
	}
	if policy, ok := p.visualExtractor.(document.VisualTextExtractorResolvedURLPolicy); ok {
		return policy.NeedsResolvedURL(ctx, fileType)
	}
	return p.NeedsResolvedURL()
}

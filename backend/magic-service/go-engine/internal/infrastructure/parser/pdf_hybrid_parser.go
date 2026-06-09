package docparser

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	pdf "github.com/ledongthuc/pdf"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
)

// PDFHybridParser 优先提取原生文字层，再补 OCR；没有可用文字层时回退整份 PDF OCR。
type PDFHybridParser struct {
	visualExtractor     documentdomain.VisualTextExtractor
	maxOCRPerFile       int
	resourceLimits      documentdomain.ResourceLimits
	nativeTextExtractor func(string) (string, error)
}

const errPDFParseAndOCRUnavailable = "PDF parsing failed and OCR recognition is unavailable"

// NewPDFHybridParserWithLimit 创建带单文件 OCR 限额的 PDF 混合解析器。
func NewPDFHybridParserWithLimit(
	ocrClient documentdomain.OCRClient,
	maxOCRPerFile int,
	resourceLimits ...documentdomain.ResourceLimits,
) *PDFHybridParser {
	return NewPDFHybridParserWithVisualLimit(newVisualTextExtractorFromOCR(ocrClient), maxOCRPerFile, resourceLimits...)
}

// NewPDFHybridParserWithVisualLimit 创建带单文件视觉转文字限额的 PDF 混合解析器。
func NewPDFHybridParserWithVisualLimit(
	visualExtractor documentdomain.VisualTextExtractor,
	maxOCRPerFile int,
	resourceLimits ...documentdomain.ResourceLimits,
) *PDFHybridParser {
	limits := documentdomain.DefaultResourceLimits()
	if len(resourceLimits) > 0 {
		limits = resourceLimits[0]
	}
	return &PDFHybridParser{
		visualExtractor: visualExtractor,
		maxOCRPerFile:   documentdomain.NormalizeEmbeddedImageOCRLimit(maxOCRPerFile),
		resourceLimits:  documentdomain.NormalizeResourceLimits(limits),
	}
}

// Parse 解析 PDF 文件并返回最佳努力纯文本。
func (p *PDFHybridParser) Parse(ctx context.Context, fileURL string, file io.Reader, fileType string) (string, error) {
	parsed, err := p.ParseDocumentWithOptions(ctx, fileURL, file, fileType, documentdomain.DefaultParseOptions())
	if err != nil {
		return "", err
	}
	return parsed.BestEffortText(), nil
}

// ParseWithOptions 按解析选项解析 PDF 文件。
func (p *PDFHybridParser) ParseWithOptions(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
	options documentdomain.ParseOptions,
) (string, error) {
	parsed, err := p.ParseDocumentWithOptions(ctx, fileURL, file, fileType, options)
	if err != nil {
		return "", err
	}
	return parsed.BestEffortText(), nil
}

// ParseDocument 解析 PDF 文件并返回结构化结果。
func (p *PDFHybridParser) ParseDocument(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
) (*documentdomain.ParsedDocument, error) {
	return p.ParseDocumentWithOptions(ctx, fileURL, file, fileType, documentdomain.DefaultParseOptions())
}

// ParseDocumentWithOptions 按解析选项解析 PDF 文件并返回结构化结果。
func (p *PDFHybridParser) ParseDocumentWithOptions(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
	options documentdomain.ParseOptions,
) (*documentdomain.ParsedDocument, error) {
	if p.bypassesNativePDFText(ctx, fileType) {
		return p.parseDocumentByVisualExtractor(ctx, fileURL, file, fileType, options)
	}

	tmpFile, err := os.CreateTemp("", "pdf-*.pdf")
	if err != nil {
		return nil, fmt.Errorf("create temp pdf failed: %w", err)
	}
	tmpPath := filepath.Clean(tmpFile.Name())
	defer func() { _ = os.Remove(tmpPath) }()
	defer func() { _ = tmpFile.Close() }()

	limitedReader := documentdomain.NewSourceSizeLimitedReader(file, p.limits())
	if _, err := io.Copy(tmpFile, limitedReader); err != nil {
		return nil, fmt.Errorf("write temp pdf failed: %w", err)
	}
	_ = tmpFile.Close()

	textContent, err := p.extractNativeText(tmpPath)
	if err != nil {
		if errors.Is(err, documentdomain.ErrDocumentResourceLimitExceeded) {
			return nil, err
		}
		if !p.canFallbackToDocumentOCR(fileURL, options) {
			return nil, err
		}
		parsed, fallbackErr := p.parseDocumentByOCRFallback(ctx, fileURL, tmpPath, fileType, options)
		if fallbackErr != nil {
			return nil, newPDFParseExecutionError(
				errPDFParseAndOCRUnavailable,
				errors.Join(err, fmt.Errorf("fallback document ocr failed: %w", fallbackErr)),
			)
		}
		return parsed, nil
	}

	nativeQuality := documentdomain.EvaluatePDFNativeTextQuality(textContent)
	if !nativeQuality.LowQuality {
		return documentdomain.NewPlainTextParsedDocument(fileType, nativeQuality.CleanedText), nil
	}

	nativeParsed := documentdomain.NewPlainTextParsedDocument(fileType, nativeQuality.CleanedText)
	if !p.canFallbackToDocumentOCR(fileURL, options) {
		return nativeParsed, nil
	}

	ocrHelper := newEmbeddedImageOCRHelper(p.visualExtractor, p.maxOCRPerFile)
	ocrFile, openErr := os.Open(filepath.Clean(tmpPath))
	if openErr != nil {
		ocrHelper.apply(nativeParsed)
		return nativeParsed, nil
	}
	ocrContent, ocrErr := ocrHelper.recognizeDocumentBySourceDetailed(ctx, fileURL, ocrFile, fileType)
	_ = ocrFile.Close()
	if ocrErr != nil {
		ocrHelper.apply(nativeParsed)
		if strings.TrimSpace(nativeParsed.BestEffortText()) == "" {
			if overloadErr := ocrHelper.overloadError(); overloadErr != nil {
				return nil, overloadErr
			}
		}
		return nativeParsed, nil
	}

	parsed := documentdomain.NewPlainTextParsedDocument(fileType, ocrContent)
	ocrHelper.apply(parsed)
	return parsed, nil
}

// Supports 检查是否支持该文件类型。
func (p *PDFHybridParser) Supports(fileType string) bool {
	return strings.EqualFold(strings.TrimSpace(fileType), "pdf")
}

// NeedsResolvedURL PDF OCR 补充依赖可访问 URL。
func (p *PDFHybridParser) NeedsResolvedURL() bool {
	return true
}

// NeedsResolvedURLForOptions 按视觉转文字实现和解析策略动态判断 PDF 是否需要可访问 URL。
func (p *PDFHybridParser) NeedsResolvedURLForOptions(
	ctx context.Context,
	fileType string,
	options documentdomain.ParseOptions,
) bool {
	if !options.ImageExtraction || !options.ImageOCR {
		return false
	}
	if p.bypassesNativePDFText(ctx, fileType) {
		return false
	}
	return p.NeedsResolvedURL()
}

func (p *PDFHybridParser) limits() documentdomain.ResourceLimits {
	if p == nil {
		return documentdomain.DefaultResourceLimits()
	}
	return documentdomain.NormalizeResourceLimits(p.resourceLimits)
}

func (p *PDFHybridParser) parseDocumentByVisualExtractor(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
	options documentdomain.ParseOptions,
) (*documentdomain.ParsedDocument, error) {
	if !options.ImageExtraction || !options.ImageOCR {
		return documentdomain.NewPlainTextParsedDocument(fileType, ""), nil
	}
	if p == nil || p.visualExtractor == nil {
		return nil, errEmbeddedOCRSourceUnavailable
	}
	limitedReader := documentdomain.NewSourceSizeLimitedReader(file, p.limits())
	content, err := p.visualExtractor.RecognizeSource(ctx, fileURL, limitedReader, fileType)
	if err != nil {
		return nil, fmt.Errorf("visual pdf recognition failed: %w", err)
	}
	return documentdomain.NewPlainTextParsedDocument(fileType, strings.TrimSpace(content)), nil
}

func (p *PDFHybridParser) bypassesNativePDFText(ctx context.Context, fileType string) bool {
	if p == nil || p.visualExtractor == nil {
		return false
	}
	policy, ok := p.visualExtractor.(documentdomain.VisualTextExtractorPDFNativeBypassPolicy)
	return ok && policy.BypassesNativePDFText(ctx, fileType)
}

func extractNativePDFText(pdfPath string) (string, error) {
	file, reader, err := pdf.Open(filepath.Clean(pdfPath))
	if err != nil {
		return "", fmt.Errorf("open pdf failed: %w", err)
	}
	defer func() { _ = file.Close() }()

	textReader, err := reader.GetPlainText()
	if err != nil {
		return "", fmt.Errorf("extract pdf text failed: %w", err)
	}
	content, err := io.ReadAll(textReader)
	if err != nil {
		return "", fmt.Errorf("read pdf text failed: %w", err)
	}
	return strings.TrimSpace(string(content)), nil
}

func (p *PDFHybridParser) extractNativeText(pdfPath string) (string, error) {
	if p != nil && p.nativeTextExtractor != nil {
		return p.nativeTextExtractor(pdfPath)
	}
	if err := p.checkPDFPageCount(pdfPath); err != nil {
		return "", err
	}
	return extractNativePDFText(pdfPath)
}

func (p *PDFHybridParser) checkPDFPageCount(pdfPath string) error {
	file, reader, err := pdf.Open(filepath.Clean(pdfPath))
	if err != nil {
		return fmt.Errorf("open pdf failed: %w", err)
	}
	defer func() { _ = file.Close() }()
	if err := documentdomain.CheckPDFPageCount(reader.NumPage(), p.limits()); err != nil {
		return fmt.Errorf("check pdf page count: %w", err)
	}
	return nil
}

func (p *PDFHybridParser) parseDocumentByOCRFallback(
	ctx context.Context,
	fileURL string,
	filePath string,
	fileType string,
	options documentdomain.ParseOptions,
) (*documentdomain.ParsedDocument, error) {
	if !p.canFallbackToDocumentOCR(fileURL, options) {
		return nil, errEmbeddedOCRSourceUnavailable
	}

	ocrHelper := newEmbeddedImageOCRHelper(p.visualExtractor, p.maxOCRPerFile)
	file, err := os.Open(filepath.Clean(filePath))
	if err != nil {
		return nil, fmt.Errorf("open pdf source for ocr: %w", err)
	}
	defer func() { _ = file.Close() }()

	ocrText, err := ocrHelper.recognizeDocumentBySourceDetailed(ctx, fileURL, file, fileType)
	if err != nil {
		return nil, err
	}
	parsed := documentdomain.NewPlainTextParsedDocument(fileType, strings.TrimSpace(ocrText))
	ocrHelper.apply(parsed)
	return parsed, nil
}

func (p *PDFHybridParser) canFallbackToDocumentOCR(fileURL string, options documentdomain.ParseOptions) bool {
	if p == nil || p.visualExtractor == nil {
		return false
	}
	if !options.ImageExtraction || !options.ImageOCR {
		return false
	}
	return strings.TrimSpace(fileURL) != ""
}

type pdfParseExecutionError struct {
	userMessage string
	err         error
}

func newPDFParseExecutionError(userMessage string, err error) error {
	if strings.TrimSpace(userMessage) == "" && err == nil {
		return nil
	}
	return &pdfParseExecutionError{
		userMessage: strings.TrimSpace(userMessage),
		err:         err,
	}
}

func (e *pdfParseExecutionError) Error() string {
	if e == nil {
		return ""
	}
	if e.err != nil {
		return e.err.Error()
	}
	return e.userMessage
}

func (e *pdfParseExecutionError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.err
}

func (e *pdfParseExecutionError) ExecutionUserMessage() string {
	if e == nil {
		return ""
	}
	return e.userMessage
}

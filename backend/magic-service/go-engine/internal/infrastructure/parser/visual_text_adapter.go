package docparser

import (
	"context"
	"fmt"
	"io"
	"strings"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
)

type legacyOCRVisualTextExtractor struct {
	ocrClient documentdomain.OCRClient
}

func newVisualTextExtractorFromOCR(ocrClient documentdomain.OCRClient) documentdomain.VisualTextExtractor {
	if ocrClient == nil {
		return nil
	}
	return legacyOCRVisualTextExtractor{ocrClient: ocrClient}
}

func (e legacyOCRVisualTextExtractor) RecognizeSource(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
) (string, error) {
	if e.ocrClient == nil {
		return "", errEmbeddedOCRSourceUnavailable
	}
	if sourceOCR, ok := e.ocrClient.(documentdomain.OCRSourceClient); ok && file != nil {
		content, err := sourceOCR.OCRSource(ctx, fileURL, file, fileType)
		if err != nil {
			return "", fmt.Errorf("ocr source failed: %w", err)
		}
		return content, nil
	}
	if strings.TrimSpace(fileURL) == "" {
		return "", errEmbeddedOCRSourceUnavailable
	}
	content, err := e.ocrClient.OCR(ctx, fileURL, fileType)
	if err != nil {
		return "", fmt.Errorf("ocr by url failed: %w", err)
	}
	return content, nil
}

func (e legacyOCRVisualTextExtractor) RecognizeBytes(
	ctx context.Context,
	data []byte,
	fileType string,
) (string, error) {
	if e.ocrClient == nil {
		return "", errEmbeddedOCRSourceUnavailable
	}
	content, err := e.ocrClient.OCRBytes(ctx, data, fileType)
	if err != nil {
		return "", fmt.Errorf("ocr bytes failed: %w", err)
	}
	return content, nil
}

func (e legacyOCRVisualTextExtractor) NeedsResolvedURL(context.Context, string) bool {
	return true
}

func (e legacyOCRVisualTextExtractor) BypassesNativePDFText(context.Context, string) bool {
	return false
}

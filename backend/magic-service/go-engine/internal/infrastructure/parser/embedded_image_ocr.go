package docparser

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"

	documentdomain "magic/internal/domain/knowledge/document/service"
)

var embeddedOCRMarkdownImageRegex = regexp.MustCompile(`!\[[^\]]*]\([^)]*\)`)

const (
	embeddedOCRFormatBMP  = "bmp"
	embeddedOCRFormatJPG  = "jpg"
	embeddedOCRFormatJPEG = "jpeg"
	embeddedOCRFormatPNG  = "png"
)

var (
	errEmbeddedOCRSourceUnavailable = errors.New("embedded ocr source unavailable")
	errEmbeddedOCRBudgetExceeded    = errors.New("embedded ocr budget exceeded")
	errEmbeddedOCREmptyText         = errors.New("embedded ocr text empty")
)

type embeddedImageOCRHelper struct {
	ocrClient documentdomain.OCRClient
	budget    *documentdomain.EmbeddedImageOCRBudget
	stats     documentdomain.EmbeddedImageOCRStats
}

func newEmbeddedImageOCRHelper(
	ocrClient documentdomain.OCRClient,
	maxOCRPerFile int,
) *embeddedImageOCRHelper {
	budget := documentdomain.NewEmbeddedImageOCRBudget(maxOCRPerFile)
	return &embeddedImageOCRHelper{
		ocrClient: ocrClient,
		budget:    budget,
		stats: documentdomain.EmbeddedImageOCRStats{
			Limit: budget.Limit(),
		},
	}
}

func (h *embeddedImageOCRHelper) recognizeBytes(ctx context.Context, data []byte, format string) string {
	if h == nil {
		return ""
	}
	h.stats.Total++
	if h.ocrClient == nil || len(data) == 0 {
		h.stats.Failed++
		return ""
	}
	if !isEmbeddedOCRFormatSupported(format) {
		h.stats.Skipped++
		return ""
	}
	if !h.budget.Consume() {
		h.stats.Limited++
		return ""
	}

	text, err := h.ocrClient.OCRBytes(ctx, data, normalizeEmbeddedOCRFormat(format))
	if err != nil {
		h.stats.Failed++
		return ""
	}
	text = sanitizeEmbeddedOCRText(text)
	if text == "" {
		h.stats.Failed++
		return ""
	}

	h.stats.Success++
	return text
}

func (h *embeddedImageOCRHelper) recognizeDocumentByURLDetailed(
	ctx context.Context,
	fileURL string,
	fileType string,
) (string, error) {
	if h == nil {
		return "", nil
	}
	h.stats.Total++
	if h.ocrClient == nil || strings.TrimSpace(fileURL) == "" {
		h.stats.Failed++
		return "", errEmbeddedOCRSourceUnavailable
	}
	if !h.budget.Consume() {
		h.stats.Limited++
		return "", errEmbeddedOCRBudgetExceeded
	}

	text, err := h.ocrClient.OCR(ctx, fileURL, fileType)
	if err != nil {
		h.stats.Failed++
		return "", fmt.Errorf("document OCR failed: %w", err)
	}
	text = sanitizeEmbeddedOCRText(text)
	if text == "" {
		h.stats.Failed++
		return "", errEmbeddedOCREmptyText
	}

	h.stats.Success++
	return text, nil
}

func (h *embeddedImageOCRHelper) apply(parsed *documentdomain.ParsedDocument) {
	if h == nil || parsed == nil {
		return
	}
	if parsed.DocumentMeta == nil {
		parsed.DocumentMeta = map[string]any{}
	}
	parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageCount] = h.stats.Total
	parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRSuccessCount] = h.stats.Success
	parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRFailedCount] = h.stats.Failed
	parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRSkippedCount] = h.stats.Skipped
	parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRLimitedCount] = h.stats.Limited
	parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRLimit] = h.stats.Limit
}

func (h *embeddedImageOCRHelper) Stats() *documentdomain.EmbeddedImageOCRStats {
	if h == nil {
		return nil
	}
	return &h.stats
}

func sanitizeEmbeddedOCRText(text string) string {
	replaced := embeddedOCRMarkdownImageRegex.ReplaceAllString(text, " ")
	lines := strings.Split(strings.ReplaceAll(replaced, "\r\n", "\n"), "\n")
	cleaned := make([]string, 0, len(lines))
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		cleaned = append(cleaned, trimmed)
	}
	return strings.TrimSpace(strings.Join(cleaned, "\n"))
}

func normalizeEmbeddedOCRFormat(format string) string {
	return strings.TrimPrefix(strings.ToLower(strings.TrimSpace(format)), ".")
}

func isEmbeddedOCRFormatSupported(format string) bool {
	switch normalizeEmbeddedOCRFormat(format) {
	case embeddedOCRFormatPNG, embeddedOCRFormatJPG, embeddedOCRFormatJPEG, embeddedOCRFormatBMP:
		return true
	default:
		return false
	}
}

func isHTTPURL(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return false
	}
	switch strings.ToLower(parsed.Scheme) {
	case "http", "https":
		return true
	default:
		return false
	}
}

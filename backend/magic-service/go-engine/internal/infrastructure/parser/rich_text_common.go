package docparser

import (
	"strings"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
)

func newRichTextImageOCRHelper(
	ocrClient documentdomain.OCRClient,
	maxOCRPerFile int,
	options documentdomain.ParseOptions,
) *embeddedImageOCRHelper {
	if !options.ImageExtraction || !options.ImageOCR {
		return nil
	}
	return newEmbeddedImageOCRHelper(ocrClient, maxOCRPerFile)
}

func failIfEmptyDueToOCROverload(parsed *documentdomain.ParsedDocument, ocrHelper *embeddedImageOCRHelper) error {
	if ocrHelper == nil || !ocrHelper.HasOverload() || parsed == nil {
		return nil
	}
	if strings.TrimSpace(parsed.BestEffortText()) != "" {
		return nil
	}
	return ocrHelper.overloadError()
}

func appendInlineSegment(builder *strings.Builder, value string) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return
	}
	if builder.Len() > 0 {
		last := builder.String()[builder.Len()-1]
		if last != '\n' && last != '\t' && last != ' ' {
			builder.WriteByte(' ')
		}
	}
	builder.WriteString(trimmed)
}

func filterNonEmptyStrings(values []string) []string {
	filtered := make([]string, 0, len(values))
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			filtered = append(filtered, trimmed)
		}
	}
	return filtered
}

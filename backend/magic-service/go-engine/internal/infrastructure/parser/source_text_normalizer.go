package docparser

import (
	"fmt"
	"io"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
)

func readAndNormalizeParserSourceWithLimits(
	file io.Reader,
	fileType string,
	limits documentdomain.ResourceLimits,
	stage string,
) ([]byte, error) {
	content, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("read all failed: %w", err)
	}
	if err := documentdomain.CheckPlainTextBytes(content, limits, stage); err != nil {
		return nil, fmt.Errorf("check source text size: %w", err)
	}
	normalized := normalizeParserSourceContent(fileType, content)
	if err := documentdomain.CheckPlainTextBytes(normalized, limits, stage); err != nil {
		return nil, fmt.Errorf("check normalized source text size: %w", err)
	}
	return normalized, nil
}

func normalizeParserSourceContent(fileType string, content []byte) []byte {
	if len(content) == 0 {
		return content
	}
	decoded := documentdomain.DecodeLikelyEscapedMultilineDocumentContent(fileType, string(content))
	if decoded == string(content) {
		return content
	}
	return []byte(decoded)
}

package docparser

import (
	"fmt"
	"io"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
)

func readAndNormalizeParserSource(file io.Reader, fileType string) ([]byte, error) {
	content, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("read all failed: %w", err)
	}
	return normalizeParserSourceContent(fileType, content), nil
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

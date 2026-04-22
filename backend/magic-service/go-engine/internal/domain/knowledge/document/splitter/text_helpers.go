package splitter

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

func normalizeContent(content string) string {
	content = strings.ReplaceAll(content, "\r\n", "\n")
	content = strings.ReplaceAll(content, "\r", "\n")
	lines := strings.Split(content, "\n")
	result := make([]string, 0, len(lines))
	empty := 0
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			empty++
			if empty > 1 {
				continue
			}
		} else {
			empty = 0
		}
		result = append(result, line)
	}
	return strings.Join(result, "\n")
}

func normalizeHierarchySourceFileType(sourceFileType string) string {
	normalized := strings.ToLower(strings.TrimSpace(sourceFileType))
	normalized = strings.TrimPrefix(normalized, ".")
	switch normalized {
	case "markdown":
		return "md"
	default:
		return normalized
	}
}

func hashText(text string) string {
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])
}

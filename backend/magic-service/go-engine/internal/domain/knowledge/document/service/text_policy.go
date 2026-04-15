package document

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

// NormalizeHierarchySourceFileType 归一化层级切分使用的文件类型。
func NormalizeHierarchySourceFileType(sourceFileType string) string {
	normalized := strings.ToLower(strings.TrimSpace(sourceFileType))
	normalized = strings.TrimPrefix(normalized, ".")
	switch normalized {
	case "markdown":
		return "md"
	default:
		return normalized
	}
}

// HashText 计算稳定文本哈希。
func HashText(text string) string {
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])
}

// Package text 提供文本规整与业务参数辅助函数。
package text

import (
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/pkg/ctxmeta"
)

// NormalizeContent 归一化文本内容。
func NormalizeContent(content string) string {
	return documentdomain.NormalizeDocumentContent(content)
}

// NormalizeHierarchySourceFileType 归一化层级切分使用的文件类型。
func NormalizeHierarchySourceFileType(sourceFileType string) string {
	return documentdomain.NormalizeHierarchySourceFileType(sourceFileType)
}

// HashText 计算稳定文本哈希。
func HashText(text string) string {
	return documentdomain.HashText(text)
}

// FirstNonEmptyString 返回首个非空字符串。
func FirstNonEmptyString(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

// StringValue 将 any 安全转换为 string。
func StringValue(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// BuildCreateBusinessParams 构造创建链路业务参数。
func BuildCreateBusinessParams(organizationCode, userID, businessID string) *ctxmeta.BusinessParams {
	return &ctxmeta.BusinessParams{
		OrganizationCode: organizationCode,
		UserID:           userID,
		BusinessID:       businessID,
	}
}

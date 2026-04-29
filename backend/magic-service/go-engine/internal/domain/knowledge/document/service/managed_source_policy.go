package document

import (
	"fmt"
	"strings"

	docentity "magic/internal/domain/knowledge/document/entity"
)

const managedSourceDocumentCodePrefix = "managed-source"

// BuildManagedSourceDocumentCode 为来源绑定自动创建的文档生成稳定编码。
func BuildManagedSourceDocumentCode(provider string, sourceBindingID, sourceItemID int64) string {
	provider = normalizeManagedSourceProvider(provider)
	if provider == "" || sourceBindingID <= 0 || sourceItemID <= 0 {
		return ""
	}
	return fmt.Sprintf("%s-%s-%d-%d", managedSourceDocumentCodePrefix, provider, sourceBindingID, sourceItemID)
}

// IsManagedSourceDocumentIdentity 判断已有文档是否对应同一个 source binding + source item。
func IsManagedSourceDocumentIdentity(
	doc *docentity.KnowledgeBaseDocument,
	organizationCode string,
	sourceBindingID int64,
	sourceItemID int64,
) bool {
	if doc == nil || sourceBindingID <= 0 || sourceItemID <= 0 {
		return false
	}
	return strings.TrimSpace(doc.OrganizationCode) == strings.TrimSpace(organizationCode) &&
		doc.SourceBindingID == sourceBindingID &&
		doc.SourceItemID == sourceItemID
}

func normalizeManagedSourceProvider(provider string) string {
	provider = strings.ToLower(strings.TrimSpace(provider))
	if provider == "" {
		return ""
	}
	var builder strings.Builder
	builder.Grow(len(provider))
	for _, r := range provider {
		switch {
		case r >= 'a' && r <= 'z':
			builder.WriteRune(r)
		case r >= '0' && r <= '9':
			builder.WriteRune(r)
		case r == '-' || r == '_':
			builder.WriteRune(r)
		default:
			builder.WriteByte('-')
		}
	}
	return strings.Trim(builder.String(), "-_")
}

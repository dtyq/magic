package document

import (
	"errors"

	docentity "magic/internal/domain/knowledge/document/entity"
)

// ErrManagedDocumentSingleDeleteNotAllowed 表示项目/企业来源知识库不支持单文档删除。
var ErrManagedDocumentSingleDeleteNotAllowed = errors.New("当前知识库已绑定项目或企业知识库，不支持删除单个文档，请修改知识库绑定关系")

// ValidateSingleDocumentDeleteAllowed 校验当前文档是否允许走单文档删除。
func ValidateSingleDocumentDeleteAllowed(
	doc *docentity.KnowledgeBaseDocument,
	semanticSourceType string,
	hasSemanticSourceType bool,
) error {
	if doc == nil || !hasSemanticSourceType {
		return nil
	}

	switch semanticSourceType {
	case "project", "enterprise":
		return ErrManagedDocumentSingleDeleteNotAllowed
	default:
		return nil
	}
}

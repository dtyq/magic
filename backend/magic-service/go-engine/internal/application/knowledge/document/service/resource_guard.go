package docapp

import (
	"context"
	"errors"

	docentity "magic/internal/domain/knowledge/document/entity"
	document "magic/internal/domain/knowledge/document/service"
)

const documentResourceBaseLogFieldCount = 8

func (s *DocumentAppService) logResourceLimitFailure(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	err error,
	stage string,
) {
	if s == nil || s.logger == nil || err == nil {
		return
	}
	var resourceErr *document.ResourceLimitError
	if errors.As(err, &resourceErr) && resourceErr != nil {
		s.logger.KnowledgeWarnContext(
			ctx,
			"document resource limit exceeded",
			appendDocumentResourceLogFields(doc,
				"limit_name", resourceErr.LimitName,
				"limit_value", resourceErr.LimitValue,
				"observed_value", resourceErr.ObservedValue,
				"stage", firstNonEmpty(resourceErr.Stage, stage),
				"error", err,
			)...,
		)
		return
	}
}

func appendDocumentResourceLogFields(doc *docentity.KnowledgeBaseDocument, fields ...any) []any {
	output := make([]any, 0, len(fields)+documentResourceBaseLogFieldCount)
	output = append(output,
		"document_code", documentCodeForLog(doc),
		"knowledge_base_code", knowledgeBaseCodeForLog(doc),
		"file_name", documentFileNameForLog(doc),
		"file_type", documentFileTypeForLog(doc),
	)
	output = append(output, fields...)
	return output
}

func documentCodeForLog(doc *docentity.KnowledgeBaseDocument) string {
	if doc == nil {
		return ""
	}
	return doc.Code
}

func knowledgeBaseCodeForLog(doc *docentity.KnowledgeBaseDocument) string {
	if doc == nil {
		return ""
	}
	return doc.KnowledgeBaseCode
}

func documentFileNameForLog(doc *docentity.KnowledgeBaseDocument) string {
	if doc == nil || doc.DocumentFile == nil {
		return ""
	}
	return doc.DocumentFile.Name
}

func documentFileTypeForLog(doc *docentity.KnowledgeBaseDocument) string {
	if doc == nil || doc.DocumentFile == nil {
		return ""
	}
	return doc.DocumentFile.Extension
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

package docapp

import (
	"context"
	"fmt"

	documentdomain "magic/internal/domain/knowledge/document/service"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
)

func (s *DocumentAppService) validateManualDocumentCreateAllowed(
	ctx context.Context,
	kb *knowledgebasedomain.KnowledgeBase,
	input *documentdomain.CreateManagedDocumentInput,
) error {
	if kb == nil || input == nil {
		return nil
	}
	// 来源绑定物化创建的文档仍允许写入；这里只拦手工直接添加文档。
	if input.SourceBindingID > 0 {
		return nil
	}

	// 这里必须看知识库已落库的 knowledge_base_type，不能拿 raw source_type 猜当前产品线。
	knowledgeBaseType := s.resolveKnowledgeBaseTypeForDocumentCreate(ctx, kb)
	if err := knowledgebasedomain.ValidateManualDocumentCreateAllowed(knowledgeBaseType, kb.SourceType); err != nil {
		return fmt.Errorf("validate manual document create for knowledge base %s: %w", kb.Code, err)
	}
	return nil
}

func (s *DocumentAppService) resolveKnowledgeBaseTypeForDocumentCreate(
	ctx context.Context,
	kb *knowledgebasedomain.KnowledgeBase,
) knowledgebasedomain.Type {
	_ = ctx
	if kb == nil {
		return knowledgebasedomain.KnowledgeBaseTypeFlowVector
	}
	return knowledgebasedomain.NormalizeKnowledgeBaseTypeOrDefault(kb.KnowledgeBaseType)
}

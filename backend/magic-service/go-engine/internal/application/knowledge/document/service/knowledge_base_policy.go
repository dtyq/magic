package docapp

import (
	"context"
	"fmt"

	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
)

func (s *DocumentAppService) validateManualDocumentCreateAllowed(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
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
	if err := kbentity.ValidateManualDocumentCreateAllowed(knowledgeBaseType, kb.SourceType); err != nil {
		return fmt.Errorf("validate manual document create for knowledge base %s: %w", kb.Code, err)
	}
	return nil
}

func (s *DocumentAppService) resolveKnowledgeBaseTypeForDocumentCreate(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
) kbentity.Type {
	_ = ctx
	if kb == nil {
		return kbentity.KnowledgeBaseTypeFlowVector
	}
	return kbentity.NormalizeKnowledgeBaseTypeOrDefault(kb.KnowledgeBaseType)
}

func (s *DocumentAppService) validateSingleDocumentDeleteAllowed(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
) error {
	if doc == nil {
		return nil
	}

	kb, err := s.kbService.ShowByCodeAndOrg(ctx, doc.KnowledgeBaseCode, doc.OrganizationCode)
	if err != nil {
		return fmt.Errorf("failed to find knowledge base: %w", err)
	}

	semanticSourceType, ok, resolveErr := resolveKnowledgeBaseSemanticSourceType(kb)
	if resolveErr != nil {
		return fmt.Errorf("resolve semantic source type for document destroy: %w", resolveErr)
	}
	err = documentdomain.ValidateSingleDocumentDeleteAllowed(doc, string(semanticSourceType), ok)
	if err != nil {
		return fmt.Errorf("validate single document delete allowed for knowledge base %s: %w", kb.Code, err)
	}
	return nil
}

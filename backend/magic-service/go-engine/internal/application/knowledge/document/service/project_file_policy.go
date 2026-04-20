package docapp

import (
	"context"
	"fmt"
	"strings"

	documentdomain "magic/internal/domain/knowledge/document/service"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/service"
)

func (s *DocumentAppService) resolveKnowledgeBaseEnterpriseMap(
	ctx context.Context,
	knowledgeBaseCodes []string,
) (map[string]bool, error) {
	result := make(map[string]bool, len(knowledgeBaseCodes))
	normalizedCodes := make([]string, 0, len(knowledgeBaseCodes))
	for _, code := range knowledgeBaseCodes {
		trimmed := strings.TrimSpace(code)
		if trimmed == "" {
			continue
		}
		if _, exists := result[trimmed]; exists {
			continue
		}
		result[trimmed] = false
		normalizedCodes = append(normalizedCodes, trimmed)
	}
	if len(normalizedCodes) == 0 {
		return result, nil
	}

	knowledgeBases, _, err := s.kbService.List(ctx, &knowledgebasedomain.Query{Codes: normalizedCodes, Limit: len(normalizedCodes)})
	if err != nil {
		return nil, fmt.Errorf("list knowledge bases for project file change: %w", err)
	}
	for _, kb := range knowledgeBases {
		semanticSourceType, ok, resolveErr := resolveKnowledgeBaseSemanticSourceType(kb)
		if resolveErr != nil {
			continue
		}
		if !ok {
			continue
		}
		result[kb.Code] = semanticSourceType == knowledgebasedomain.SemanticSourceTypeEnterprise
	}
	return result, nil
}

func buildProjectFileBindingRefs(bindings []sourcebindingdomain.Binding) []documentdomain.ProjectFileBindingRef {
	results := make([]documentdomain.ProjectFileBindingRef, 0, len(bindings))
	for _, binding := range bindings {
		ref := documentdomain.ProjectFileBindingRef{
			ID:                binding.ID,
			OrganizationCode:  strings.TrimSpace(binding.OrganizationCode),
			KnowledgeBaseCode: strings.TrimSpace(binding.KnowledgeBaseCode),
			Provider:          strings.TrimSpace(binding.Provider),
			RootType:          strings.TrimSpace(binding.RootType),
			RootRef:           strings.TrimSpace(binding.RootRef),
			SyncMode:          strings.TrimSpace(binding.SyncMode),
			Enabled:           binding.Enabled,
			UserID:            strings.TrimSpace(sourcebindingdomain.BindingUserID(binding)),
			Targets:           make([]documentdomain.ProjectFileBindingTarget, 0, len(binding.Targets)),
		}
		for _, target := range binding.Targets {
			ref.Targets = append(ref.Targets, documentdomain.ProjectFileBindingTarget{
				TargetType: strings.TrimSpace(target.TargetType),
				TargetRef:  strings.TrimSpace(target.TargetRef),
			})
		}
		results = append(results, ref)
	}
	return results
}

func (s *DocumentAppService) shouldUseProjectFileSourceOverride(
	ctx context.Context,
	doc *documentdomain.KnowledgeBaseDocument,
) (bool, error) {
	if s == nil || doc == nil || doc.ProjectFileID <= 0 {
		return false, nil
	}
	kb, err := s.kbService.ShowByCodeAndOrg(ctx, doc.KnowledgeBaseCode, doc.OrganizationCode)
	if err != nil {
		return false, fmt.Errorf("show knowledge base for project file sync: %w", err)
	}
	semanticSourceType, ok, resolveErr := resolveKnowledgeBaseSemanticSourceType(kb)
	if resolveErr != nil {
		return false, fmt.Errorf("resolve semantic source type for project file sync: %w", resolveErr)
	}
	if !ok {
		return false, nil
	}
	return semanticSourceType == knowledgebasedomain.SemanticSourceTypeEnterprise, nil
}

// resolveKnowledgeBaseSemanticSourceType 按知识库当前产品线解释 raw source_type。
//
// 这里故意不直接比较 4 / 1001 之类的 raw int，避免把 flow_vector 和 digital_employee 的协议值混用。
func resolveKnowledgeBaseSemanticSourceType(
	kb *knowledgebasedomain.KnowledgeBase,
) (knowledgebasedomain.SemanticSourceType, bool, error) {
	if kb == nil || kb.SourceType == nil {
		return "", false, nil
	}

	knowledgeBaseType := knowledgebasedomain.NormalizeKnowledgeBaseTypeOrDefault(kb.KnowledgeBaseType)
	semanticSourceType, err := knowledgebasedomain.ResolveSemanticSourceType(knowledgeBaseType, *kb.SourceType)
	if err != nil {
		return "", false, fmt.Errorf("resolve semantic source type: %w", err)
	}
	return semanticSourceType, true, nil
}

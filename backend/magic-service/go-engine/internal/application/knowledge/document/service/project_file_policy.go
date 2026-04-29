package docapp

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingservice "magic/internal/domain/knowledge/sourcebinding/service"
	"magic/internal/pkg/projectfile"
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

	knowledgeBases, _, err := s.kbService.List(ctx, &kbrepository.Query{Codes: normalizedCodes, Limit: len(normalizedCodes)})
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
		result[kb.Code] = semanticSourceType == kbentity.SemanticSourceTypeEnterprise
	}
	return result, nil
}

func (s *DocumentAppService) enabledKnowledgeBaseCodeSet(
	ctx context.Context,
	organizationCode string,
	knowledgeBaseCodes []string,
) (map[string]struct{}, error) {
	normalizedCodes := normalizeKnowledgeBaseCodesForDocumentSync(knowledgeBaseCodes)
	result := make(map[string]struct{}, len(normalizedCodes))
	if len(normalizedCodes) == 0 || s == nil || s.kbService == nil {
		return result, nil
	}
	codesToQuery := normalizedCodes
	if s.sourceBindingCache != nil {
		cached, misses, err := s.sourceBindingCache.GetKnowledgeBaseEnabled(ctx, organizationCode, normalizedCodes)
		if err != nil {
			s.logSourceBindingCacheWarning(ctx, "Read knowledge base enabled cache failed", err,
				"organization_code", organizationCode,
			)
		} else {
			for code, enabled := range cached {
				if enabled {
					result[code] = struct{}{}
				}
			}
			codesToQuery = misses
		}
	}
	if len(codesToQuery) == 0 {
		return result, nil
	}

	enabled := true
	knowledgeBases, _, err := s.kbService.List(ctx, &kbrepository.Query{
		OrganizationCode: strings.TrimSpace(organizationCode),
		Codes:            codesToQuery,
		Enabled:          &enabled,
		Limit:            len(codesToQuery),
	})
	if err != nil {
		return nil, fmt.Errorf("list enabled knowledge bases for source callback: %w", err)
	}
	cacheStates := make(map[string]bool, len(codesToQuery))
	for _, code := range codesToQuery {
		cacheStates[code] = false
	}
	for _, kb := range knowledgeBases {
		if kb == nil || !kb.Enabled {
			continue
		}
		code := strings.TrimSpace(kb.Code)
		if code == "" {
			continue
		}
		result[code] = struct{}{}
		cacheStates[code] = true
	}
	if s.sourceBindingCache != nil {
		if cacheErr := s.sourceBindingCache.SetKnowledgeBaseEnabled(ctx, organizationCode, cacheStates); cacheErr != nil {
			s.logSourceBindingCacheWarning(ctx, "Write knowledge base enabled cache failed", cacheErr,
				"organization_code", organizationCode,
			)
		}
	}
	return result, nil
}

func normalizeKnowledgeBaseCodesForDocumentSync(codes []string) []string {
	seen := make(map[string]struct{}, len(codes))
	result := make([]string, 0, len(codes))
	for _, code := range codes {
		trimmed := strings.TrimSpace(code)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}

func filterProjectFileBindingRefsByEnabledKnowledgeBases(
	bindings []documentdomain.ProjectFileBindingRef,
	enabledCodes map[string]struct{},
) []documentdomain.ProjectFileBindingRef {
	if len(bindings) == 0 || len(enabledCodes) == 0 {
		return []documentdomain.ProjectFileBindingRef{}
	}
	result := make([]documentdomain.ProjectFileBindingRef, 0, len(bindings))
	for _, binding := range bindings {
		if _, ok := enabledCodes[strings.TrimSpace(binding.KnowledgeBaseCode)]; ok {
			result = append(result, binding)
		}
	}
	return result
}

func filterDocumentsByEnabledKnowledgeBases(
	docs []*docentity.KnowledgeBaseDocument,
	enabledCodes map[string]struct{},
) []*docentity.KnowledgeBaseDocument {
	if len(docs) == 0 || len(enabledCodes) == 0 {
		return []*docentity.KnowledgeBaseDocument{}
	}
	result := make([]*docentity.KnowledgeBaseDocument, 0, len(docs))
	for _, doc := range docs {
		if doc == nil {
			continue
		}
		if _, ok := enabledCodes[strings.TrimSpace(doc.KnowledgeBaseCode)]; ok {
			result = append(result, doc)
		}
	}
	return result
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
			UserID:            strings.TrimSpace(sourcebindingservice.BindingUserID(binding)),
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

func filterProjectFileBindingRefsByCoverage(
	bindings []documentdomain.ProjectFileBindingRef,
	meta *projectfile.Meta,
	ancestorFolderRefs []string,
) []documentdomain.ProjectFileBindingRef {
	if len(bindings) == 0 || meta == nil || meta.ProjectFileID <= 0 {
		return []documentdomain.ProjectFileBindingRef{}
	}
	result := make([]documentdomain.ProjectFileBindingRef, 0, len(bindings))
	input := sourcebindingservice.SourceFileCoverageInput{
		OrganizationCode:   meta.OrganizationCode,
		Provider:           sourcebindingdomain.ProviderProject,
		RootType:           sourcebindingdomain.RootTypeProject,
		RootRef:            strconv.FormatInt(meta.ProjectID, 10),
		FileRef:            strconv.FormatInt(meta.ProjectFileID, 10),
		AncestorFolderRefs: ancestorFolderRefs,
	}
	for _, binding := range bindings {
		if !sourcebindingservice.BindingCoversSourceFile(projectFileBindingRefToDomain(binding), input) {
			continue
		}
		binding.CoversChangedFile = true
		result = append(result, binding)
	}
	return result
}

func splitProjectDocumentsByBindingCoverage(
	docs []*docentity.KnowledgeBaseDocument,
	bindings []documentdomain.ProjectFileBindingRef,
) ([]*docentity.KnowledgeBaseDocument, []*docentity.KnowledgeBaseDocument) {
	if len(docs) == 0 {
		return nil, nil
	}
	coveredBindingIDs := make(map[int64]struct{}, len(bindings))
	for _, binding := range bindings {
		if binding.ID > 0 {
			coveredBindingIDs[binding.ID] = struct{}{}
		}
	}
	kept := make([]*docentity.KnowledgeBaseDocument, 0, len(docs))
	stale := make([]*docentity.KnowledgeBaseDocument, 0)
	for _, doc := range docs {
		if doc == nil {
			continue
		}
		if doc.SourceBindingID <= 0 {
			kept = append(kept, doc)
			continue
		}
		if _, ok := coveredBindingIDs[doc.SourceBindingID]; ok {
			kept = append(kept, doc)
			continue
		}
		stale = append(stale, doc)
	}
	return kept, stale
}

func projectFileBindingRefToDomain(binding documentdomain.ProjectFileBindingRef) sourcebindingdomain.Binding {
	result := sourcebindingdomain.Binding{
		ID:                binding.ID,
		OrganizationCode:  strings.TrimSpace(binding.OrganizationCode),
		KnowledgeBaseCode: strings.TrimSpace(binding.KnowledgeBaseCode),
		Provider:          strings.TrimSpace(binding.Provider),
		RootType:          strings.TrimSpace(binding.RootType),
		RootRef:           strings.TrimSpace(binding.RootRef),
		SyncMode:          strings.TrimSpace(binding.SyncMode),
		Enabled:           binding.Enabled,
		Targets:           make([]sourcebindingdomain.BindingTarget, 0, len(binding.Targets)),
	}
	for _, target := range binding.Targets {
		result.Targets = append(result.Targets, sourcebindingdomain.BindingTarget{
			TargetType: strings.TrimSpace(target.TargetType),
			TargetRef:  strings.TrimSpace(target.TargetRef),
		})
	}
	return result
}

func (s *DocumentAppService) shouldUseProjectFileSourceOverride(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
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
	return semanticSourceType == kbentity.SemanticSourceTypeEnterprise, nil
}

// resolveKnowledgeBaseSemanticSourceType 按知识库当前产品线解释 raw source_type。
//
// 这里故意不直接比较 4 / 1001 之类的 raw int，避免把 flow_vector 和 digital_employee 的协议值混用。
func resolveKnowledgeBaseSemanticSourceType(
	kb *kbentity.KnowledgeBase,
) (kbentity.SemanticSourceType, bool, error) {
	if kb == nil || kb.SourceType == nil {
		return "", false, nil
	}

	knowledgeBaseType := kbentity.NormalizeKnowledgeBaseTypeOrDefault(kb.KnowledgeBaseType)
	semanticSourceType, err := kbentity.ResolveSemanticSourceType(knowledgeBaseType, *kb.SourceType)
	if err != nil {
		return "", false, fmt.Errorf("resolve semantic source type: %w", err)
	}
	return semanticSourceType, true, nil
}

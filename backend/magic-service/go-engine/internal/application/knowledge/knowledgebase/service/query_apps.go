package kbapp

import (
	"context"
	"fmt"

	pagehelper "magic/internal/application/knowledge/helper/page"
	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
)

// KnowledgeBaseSaveProcessApp 承接知识库进度更新查询流。
type KnowledgeBaseSaveProcessApp struct {
	*KnowledgeBaseAppService
}

// KnowledgeBaseShowApp 承接知识库详情查询流。
type KnowledgeBaseShowApp struct {
	*KnowledgeBaseAppService
}

// KnowledgeBaseListApp 承接知识库列表查询流。
type KnowledgeBaseListApp struct {
	*KnowledgeBaseAppService
}

// SaveProcessQueryApp 返回知识库进度更新查询应用服务。
func (s *KnowledgeBaseAppService) SaveProcessQueryApp() *KnowledgeBaseSaveProcessApp {
	return &KnowledgeBaseSaveProcessApp{KnowledgeBaseAppService: s}
}

// ShowQueryApp 返回知识库详情查询应用服务。
func (s *KnowledgeBaseAppService) ShowQueryApp() *KnowledgeBaseShowApp {
	return &KnowledgeBaseShowApp{KnowledgeBaseAppService: s}
}

// ListQueryApp 返回知识库列表查询应用服务。
func (s *KnowledgeBaseAppService) ListQueryApp() *KnowledgeBaseListApp {
	return &KnowledgeBaseListApp{KnowledgeBaseAppService: s}
}

// SaveProcess 更新知识库向量化进度。
func (s *KnowledgeBaseSaveProcessApp) SaveProcess(
	ctx context.Context,
	input *kbdto.SaveProcessKnowledgeBaseInput,
) (*kbdto.KnowledgeBaseDTO, error) {
	operation, err := s.ensureKnowledgeBaseActionAllowed(ctx, input.OrganizationCode, input.UserID, input.Code, "edit")
	if err != nil {
		return nil, err
	}
	kb, err := s.domainService.ShowByCodeAndOrg(ctx, input.Code, input.OrganizationCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find knowledge base: %w", err)
	}

	kb.SetProgress(input.ExpectedNum, input.CompletedNum, input.UserID)
	if err := s.domainService.UpdateProgress(ctx, kb); err != nil {
		return nil, fmt.Errorf("failed to update knowledge base progress: %w", err)
	}

	dto, err := s.entityToDTOWithContext(ctx, kb, input.UserID)
	if err != nil {
		return nil, err
	}
	return applyKnowledgeBaseUserOperation(dto, operation), nil
}

// Show 查询知识库详情。
func (s *KnowledgeBaseShowApp) Show(
	ctx context.Context,
	code, orgCode, userID string,
) (*kbdto.KnowledgeBaseDTO, error) {
	operation, err := s.ensureKnowledgeBaseActionAllowed(ctx, orgCode, userID, code, "read")
	if err != nil {
		return nil, err
	}
	kb, err := s.domainService.ShowByCodeAndOrg(ctx, code, orgCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find knowledge base: %w", err)
	}

	dto, err := s.entityToDTOWithContext(ctx, kb, userID)
	if err != nil {
		return nil, err
	}
	s.populateFragmentCounts(ctx, dto)
	return applyKnowledgeBaseUserOperation(dto, operation), nil
}

// List 查询知识库列表。
func (s *KnowledgeBaseListApp) List(
	ctx context.Context,
	input *kbdto.ListKnowledgeBaseInput,
) (*pagehelper.Result, error) {
	normalizedAgentCodes, err := normalizeAgentCodes(input.AgentCodes)
	if err != nil {
		return nil, err
	}
	accessibleCodes, operations, err := s.filterReadableKnowledgeBaseCodes(ctx, input.OrganizationCode, input.UserID, input.Codes)
	if err != nil {
		return nil, err
	}
	accessibleCodes, err = s.filterKnowledgeBaseCodesByAgentCodes(ctx, accessibleCodes, normalizedAgentCodes)
	if err != nil {
		return nil, err
	}
	if len(accessibleCodes) == 0 {
		return &pagehelper.Result{Total: 0, List: []*kbdto.KnowledgeBaseDTO{}}, nil
	}
	targetKnowledgeBaseType := knowledgeBaseTypeFromAgentCodes(normalizedAgentCodes)
	query := &kbrepository.Query{
		OrganizationCode:  input.OrganizationCode,
		Name:              input.Name,
		Type:              input.Type,
		KnowledgeBaseType: &targetKnowledgeBaseType,
		Enabled:           input.Enabled,
		Codes:             accessibleCodes,
		BusinessIDs:       input.BusinessIDs,
		Offset:            input.Offset,
		Limit:             input.Limit,
	}

	kbs, total, err := s.domainService.List(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list knowledge bases: %w", err)
	}
	if len(kbs) == 0 {
		return &pagehelper.Result{Total: total, List: []*kbdto.KnowledgeBaseDTO{}}, nil
	}
	listedCodes := make([]string, 0, len(kbs))
	for _, kb := range kbs {
		if kb == nil {
			continue
		}
		listedCodes = append(listedCodes, kb.Code)
	}
	accessibleSnapshot, err := s.resolveKnowledgeBaseBindingSnapshot(ctx, listedCodes)
	if err != nil {
		return nil, err
	}

	effectiveModel := ""
	if s != nil && s.domainService != nil {
		effectiveModel = s.domainService.ResolveRuntimeRoute(ctx, nil).Model
	}
	sourceBindingsByKnowledgeBase, err := s.listKnowledgeBaseSourceBindingDTOs(
		ctx,
		input.OrganizationCode,
		input.UserID,
		listedCodes,
	)
	if err != nil {
		return nil, err
	}

	list := make([]*kbdto.KnowledgeBaseDTO, len(kbs))
	for i, kb := range kbs {
		dto := s.entityToDTOWithResolvedModel(kb, effectiveModel)
		dto = applyKnowledgeBaseBindingInfo(
			dto,
			accessibleSnapshot.AgentCodesByKnowledgeBase[kb.Code],
			knowledgeBaseTypeFromKnowledgeBase(kb),
		)
		dto = applyKnowledgeBaseUserOperation(dto, operations[kb.Code])
		dto.SourceBindings = sourceBindingsByKnowledgeBase[kb.Code]
		list[i] = dto
	}
	s.populateFragmentCountsBatch(ctx, list)

	return &pagehelper.Result{Total: total, List: list}, nil
}

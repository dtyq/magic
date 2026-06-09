package kbapp

import (
	"context"
	"fmt"
	"slices"
	"strings"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
)

// LinkAgentKnowledgeBases 将已有 flow 向量知识库增量关联到数字员工。
func (s *KnowledgeBaseAppService) LinkAgentKnowledgeBases(
	ctx context.Context,
	input *kbdto.AgentKnowledgeBaseBindingsInput,
) (*kbdto.AgentKnowledgeBaseBindingsResult, error) {
	normalized, err := normalizeAgentBindingInput(input)
	if err != nil {
		return nil, err
	}
	if err := s.validateSuperMagicAgents(ctx, normalized.organizationCode, normalized.userID, []string{normalized.agentCode}); err != nil {
		return nil, err
	}
	if len(normalized.knowledgeBaseCodes) == 0 {
		return &kbdto.AgentKnowledgeBaseBindingsResult{
			AgentCode:          normalized.agentCode,
			KnowledgeBaseCodes: []string{},
		}, nil
	}
	if err := s.ensureLinkableFlowKnowledgeBases(ctx, normalized.organizationCode, normalized.userID, normalized.knowledgeBaseCodes); err != nil {
		return nil, err
	}
	if s == nil || s.knowledgeBaseBindings == nil {
		return nil, ErrKnowledgeBaseBindingRepositoryRequired
	}
	linkedCodes, err := s.knowledgeBaseBindings.LinkAgentKnowledgeBases(
		ctx,
		normalized.organizationCode,
		normalized.userID,
		normalized.agentCode,
		normalized.knowledgeBaseCodes,
	)
	if err != nil {
		return nil, fmt.Errorf("link agent knowledge bases: %w", err)
	}
	return &kbdto.AgentKnowledgeBaseBindingsResult{
		AgentCode:          normalized.agentCode,
		KnowledgeBaseCodes: linkedCodes,
	}, nil
}

// UnlinkAgentKnowledgeBases 解除数字员工与已有 flow 向量知识库的关联。
func (s *KnowledgeBaseAppService) UnlinkAgentKnowledgeBases(
	ctx context.Context,
	input *kbdto.AgentKnowledgeBaseBindingsInput,
) (*kbdto.AgentKnowledgeBaseBindingsResult, error) {
	normalized, err := normalizeAgentBindingInput(input)
	if err != nil {
		return nil, err
	}
	if err := s.validateSuperMagicAgents(ctx, normalized.organizationCode, normalized.userID, []string{normalized.agentCode}); err != nil {
		return nil, err
	}
	if len(normalized.knowledgeBaseCodes) == 0 {
		return &kbdto.AgentKnowledgeBaseBindingsResult{
			AgentCode:          normalized.agentCode,
			KnowledgeBaseCodes: []string{},
		}, nil
	}
	if s == nil || s.knowledgeBaseBindings == nil {
		return nil, ErrKnowledgeBaseBindingRepositoryRequired
	}
	unlinkedCodes, err := s.knowledgeBaseBindings.UnlinkAgentKnowledgeBases(
		ctx,
		normalized.organizationCode,
		normalized.userID,
		normalized.agentCode,
		normalized.knowledgeBaseCodes,
	)
	if err != nil {
		return nil, fmt.Errorf("unlink agent knowledge bases: %w", err)
	}
	return &kbdto.AgentKnowledgeBaseBindingsResult{
		AgentCode:          normalized.agentCode,
		KnowledgeBaseCodes: unlinkedCodes,
	}, nil
}

// UpdateAgentKnowledgeBaseBinding 更新数字员工下已关联 flow 知识库的关联级配置。
func (s *KnowledgeBaseAppService) UpdateAgentKnowledgeBaseBinding(
	ctx context.Context,
	input *kbdto.UpdateAgentKnowledgeBaseBindingInput,
) (*kbdto.UpdateAgentKnowledgeBaseBindingResult, error) {
	normalized, err := normalizeAgentBindingUpdateInput(input)
	if err != nil {
		return nil, err
	}
	if err := s.validateSuperMagicAgents(ctx, normalized.organizationCode, normalized.userID, []string{normalized.agentCode}); err != nil {
		return nil, err
	}
	if s == nil || s.knowledgeBaseBindings == nil {
		return nil, ErrKnowledgeBaseBindingRepositoryRequired
	}

	binding, err := s.knowledgeBaseBindings.UpdateAgentKnowledgeBaseBindingMetadata(
		ctx,
		normalized.organizationCode,
		normalized.userID,
		normalized.agentCode,
		normalized.knowledgeBaseCode,
		normalized.patch,
	)
	if err != nil {
		return nil, fmt.Errorf("update agent knowledge base binding metadata: %w", err)
	}

	kb, err := s.domainService.ShowByCodeAndOrg(ctx, normalized.knowledgeBaseCode, normalized.organizationCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find knowledge base: %w", err)
	}
	return buildAgentKnowledgeBaseBindingResult(normalized.agentCode, kb, binding.Metadata), nil
}

type normalizedAgentKnowledgeBaseBindingsInput struct {
	organizationCode   string
	userID             string
	agentCode          string
	knowledgeBaseCodes []string
}

type normalizedAgentKnowledgeBaseBindingUpdateInput struct {
	organizationCode  string
	userID            string
	agentCode         string
	knowledgeBaseCode string
	patch             kbentity.AgentKnowledgeBaseBindingMetadataPatch
}

func normalizeAgentBindingInput(
	input *kbdto.AgentKnowledgeBaseBindingsInput,
) (*normalizedAgentKnowledgeBaseBindingsInput, error) {
	if input == nil {
		return nil, ErrKnowledgeBaseNotFound
	}
	agentCodes, err := normalizeAgentCodes([]string{input.AgentCode})
	if err != nil {
		return nil, err
	}
	if len(agentCodes) != 1 {
		return nil, fmt.Errorf("%w: %q", ErrInvalidAgentCode, input.AgentCode)
	}
	knowledgeBaseCodes := normalizeKnowledgeBaseCodesForAgentBinding(input.KnowledgeBaseCodes)
	return &normalizedAgentKnowledgeBaseBindingsInput{
		organizationCode:   strings.TrimSpace(input.OrganizationCode),
		userID:             strings.TrimSpace(input.UserID),
		agentCode:          agentCodes[0],
		knowledgeBaseCodes: knowledgeBaseCodes,
	}, nil
}

func normalizeKnowledgeBaseCodesForAgentBinding(codes []string) []string {
	normalized := make([]string, 0, len(codes))
	seen := make(map[string]struct{}, len(codes))
	for _, code := range codes {
		trimmed := strings.TrimSpace(code)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	slices.Sort(normalized)
	return normalized
}

func normalizeAgentBindingUpdateInput(
	input *kbdto.UpdateAgentKnowledgeBaseBindingInput,
) (*normalizedAgentKnowledgeBaseBindingUpdateInput, error) {
	if input == nil {
		return nil, ErrKnowledgeBaseNotFound
	}
	agentCodes, err := normalizeAgentCodes([]string{input.AgentCode})
	if err != nil {
		return nil, err
	}
	if len(agentCodes) != 1 {
		return nil, fmt.Errorf("%w: %q", ErrInvalidAgentCode, input.AgentCode)
	}
	knowledgeBaseCode := strings.TrimSpace(input.KnowledgeBaseCode)
	if knowledgeBaseCode == "" {
		return nil, ErrKnowledgeBaseNotFound
	}
	return &normalizedAgentKnowledgeBaseBindingUpdateInput{
		organizationCode:  strings.TrimSpace(input.OrganizationCode),
		userID:            strings.TrimSpace(input.UserID),
		agentCode:         agentCodes[0],
		knowledgeBaseCode: knowledgeBaseCode,
		patch: kbentity.AgentKnowledgeBaseBindingMetadataPatch{
			DisplayName:        input.Name,
			DisplayDescription: input.Description,
			DisplayIcon:        input.Icon,
			Enabled:            input.Enabled,
		},
	}, nil
}

func buildAgentKnowledgeBaseBindingResult(
	agentCode string,
	kb *kbentity.KnowledgeBase,
	metadata kbentity.AgentKnowledgeBaseBindingMetadata,
) *kbdto.UpdateAgentKnowledgeBaseBindingResult {
	name := kb.Name
	if metadata.DisplayName != "" {
		name = metadata.DisplayName
	}
	description := kb.Description
	if metadata.DisplayDescription != "" {
		description = metadata.DisplayDescription
	}
	icon := kb.Icon
	if metadata.DisplayIcon != "" {
		icon = metadata.DisplayIcon
	}
	return &kbdto.UpdateAgentKnowledgeBaseBindingResult{
		AgentCode:         agentCode,
		KnowledgeBaseCode: kb.Code,
		Name:              name,
		Description:       description,
		Icon:              icon,
		Enabled:           kb.Enabled && metadata.IsEnabled(),
	}
}

func (s *KnowledgeBaseAppService) ensureLinkableFlowKnowledgeBases(
	ctx context.Context,
	organizationCode string,
	userID string,
	knowledgeBaseCodes []string,
) error {
	flowType := kbentity.KnowledgeBaseTypeFlowVector
	kbs, _, err := s.domainService.List(ctx, &kbrepository.Query{
		OrganizationCode:  organizationCode,
		KnowledgeBaseType: &flowType,
		Codes:             append([]string(nil), knowledgeBaseCodes...),
		Offset:            0,
		Limit:             len(knowledgeBaseCodes),
	})
	if err != nil {
		return fmt.Errorf("list linkable flow knowledge bases: %w", err)
	}
	found := make(map[string]struct{}, len(kbs))
	for _, kb := range kbs {
		if kb == nil {
			continue
		}
		found[strings.TrimSpace(kb.Code)] = struct{}{}
	}
	for _, code := range knowledgeBaseCodes {
		if _, ok := found[code]; !ok {
			return fmt.Errorf("%w: %s", ErrKnowledgeBaseNotFound, code)
		}
	}

	accessService, err := s.knowledgeAccessService()
	if err != nil {
		return err
	}
	operations, err := accessService.BatchOperations(
		ctx,
		resolveKnowledgeBaseAccessActor(ctx, organizationCode, userID),
		knowledgeBaseCodes,
	)
	if err != nil {
		return fmt.Errorf("resolve link knowledge base operations: %w", err)
	}
	for _, code := range knowledgeBaseCodes {
		if !operations[code].CanEdit() {
			return fmt.Errorf("%w: action=edit knowledge_base_code=%s", ErrKnowledgeBasePermissionDenied, code)
		}
	}
	return nil
}

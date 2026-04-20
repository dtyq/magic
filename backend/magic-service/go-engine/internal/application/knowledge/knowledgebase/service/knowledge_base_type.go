package kbapp

import (
	"context"
	"fmt"
	"slices"
	"strings"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
)

func normalizeAgentCodes(agentCodes []string) ([]string, error) {
	normalized := make([]string, 0, len(agentCodes))
	seen := make(map[string]struct{}, len(agentCodes))
	for _, agentCode := range agentCodes {
		trimmed := strings.TrimSpace(agentCode)
		if trimmed == "" {
			continue
		}
		if strings.ContainsAny(trimmed, " \t\r\n") {
			return nil, fmt.Errorf("%w: %q", ErrInvalidAgentCode, agentCode)
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	slices.Sort(normalized)
	return normalized, nil
}

func (s *KnowledgeBaseAppService) validateSuperMagicAgents(
	ctx context.Context,
	organizationCode string,
	userID string,
	agentCodes []string,
) error {
	if len(agentCodes) == 0 {
		return nil
	}
	if s == nil || s.superMagicAgents == nil {
		return ErrKnowledgeBaseSuperMagicAgentReaderRequired
	}
	existing, err := s.superMagicAgents.ListExistingCodesByOrg(ctx, organizationCode, agentCodes)
	if err != nil {
		return fmt.Errorf("list existing super magic agents: %w", err)
	}
	for _, agentCode := range agentCodes {
		if _, ok := existing[agentCode]; !ok {
			return fmt.Errorf("%w: %s", ErrSuperMagicAgentNotFound, agentCode)
		}
	}
	if s.superMagicAgentAccess == nil {
		return ErrKnowledgeBaseSuperMagicAgentAccessCheckerRequired
	}
	manageable, err := s.superMagicAgentAccess.ListManageableCodes(ctx, organizationCode, userID, agentCodes)
	if err != nil {
		return fmt.Errorf("list manageable super magic agents: %w", err)
	}
	unmanageable := make([]string, 0, len(agentCodes))
	for _, agentCode := range agentCodes {
		if _, ok := manageable[agentCode]; ok {
			continue
		}
		unmanageable = append(unmanageable, agentCode)
	}
	if len(unmanageable) > 0 {
		return fmt.Errorf("%w: %s", ErrSuperMagicAgentNotManageable, strings.Join(unmanageable, ","))
	}
	return nil
}

func (s *KnowledgeBaseAppService) replaceKnowledgeBaseAgentBindings(
	ctx context.Context,
	kbCode string,
	organizationCode string,
	userID string,
	agentCodes []string,
) error {
	if s == nil || s.knowledgeBaseBindings == nil {
		if len(agentCodes) == 0 {
			return nil
		}
		return ErrKnowledgeBaseBindingRepositoryRequired
	}
	if _, err := s.knowledgeBaseBindings.ReplaceBindings(
		ctx,
		kbCode,
		knowledgebasedomain.BindingTypeSuperMagicAgent,
		organizationCode,
		userID,
		agentCodes,
	); err != nil {
		return fmt.Errorf("replace knowledge base agent bindings: %w", err)
	}
	return nil
}

func (s *KnowledgeBaseAppService) listKnowledgeBaseAgentCodes(
	ctx context.Context,
	knowledgeBaseCode string,
) ([]string, error) {
	snapshot, err := s.resolveKnowledgeBaseBindingSnapshot(ctx, []string{knowledgeBaseCode})
	if err != nil {
		return nil, err
	}
	if snapshot == nil {
		return []string{}, nil
	}
	return append([]string(nil), snapshot.AgentCodesByKnowledgeBase[strings.TrimSpace(knowledgeBaseCode)]...), nil
}

func (s *KnowledgeBaseAppService) resolveKnowledgeBaseBindingSnapshot(
	ctx context.Context,
	knowledgeBaseCodes []string,
) (*knowledgebasedomain.ProductLineSnapshot, error) {
	resolver := knowledgebasedomain.NewProductLineResolver(s.knowledgeBaseBindings)
	snapshot, err := resolver.ResolveSnapshot(ctx, knowledgeBaseCodes)
	if err != nil {
		return nil, fmt.Errorf("resolve knowledge base binding snapshot: %w", err)
	}
	return snapshot, nil
}

func knowledgeBaseTypeFromAgentCodes(agentCodes []string) knowledgebasedomain.Type {
	return knowledgebasedomain.ResolveKnowledgeBaseTypeByAgentCodes(agentCodes)
}

// knowledgeBaseTypeFromKnowledgeBase 返回存量知识库已经确定好的产品线。
//
// 更新、详情、列表和下游消费都必须以这个结果为准，不能按本次请求的 source_type 重判产品线。
func knowledgeBaseTypeFromKnowledgeBase(kb *knowledgebasedomain.KnowledgeBase) knowledgebasedomain.Type {
	if kb == nil {
		return knowledgebasedomain.KnowledgeBaseTypeFlowVector
	}
	return knowledgebasedomain.NormalizeKnowledgeBaseTypeOrDefault(kb.KnowledgeBaseType)
}

func (s *KnowledgeBaseAppService) filterKnowledgeBaseCodesByAgentCodes(
	ctx context.Context,
	knowledgeBaseCodes []string,
	agentCodes []string,
) ([]string, error) {
	if len(knowledgeBaseCodes) == 0 || len(agentCodes) == 0 {
		return knowledgeBaseCodes, nil
	}
	snapshot, err := s.resolveKnowledgeBaseBindingSnapshot(ctx, knowledgeBaseCodes)
	if err != nil {
		return nil, err
	}
	filtered := make([]string, 0, len(knowledgeBaseCodes))
	for _, code := range knowledgeBaseCodes {
		if hasAgentCodeIntersection(snapshot.AgentCodesByKnowledgeBase[code], agentCodes) {
			filtered = append(filtered, code)
		}
	}
	return filtered, nil
}

func hasAgentCodeIntersection(currentAgentCodes, requestedAgentCodes []string) bool {
	if len(requestedAgentCodes) == 0 {
		return true
	}
	requested := make(map[string]struct{}, len(requestedAgentCodes))
	for _, agentCode := range requestedAgentCodes {
		trimmed := strings.TrimSpace(agentCode)
		if trimmed == "" {
			continue
		}
		requested[trimmed] = struct{}{}
	}
	for _, agentCode := range currentAgentCodes {
		if _, ok := requested[strings.TrimSpace(agentCode)]; ok {
			return true
		}
	}
	return false
}

func applyKnowledgeBaseBindingInfo(
	dto *kbdto.KnowledgeBaseDTO,
	agentCodes []string,
	knowledgeBaseType knowledgebasedomain.Type,
) *kbdto.KnowledgeBaseDTO {
	if dto == nil {
		return nil
	}
	dto.AgentCodes = append([]string(nil), agentCodes...)
	dto.KnowledgeBaseType = string(knowledgebasedomain.NormalizeKnowledgeBaseTypeOrDefault(knowledgeBaseType))
	return dto
}

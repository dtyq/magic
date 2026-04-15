package fragapp

import (
	"context"
	"errors"
	"fmt"
	"strings"

	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
)

func (s *FragmentAppService) ensureKnowledgeBaseMatchesAgentScope(
	_ context.Context,
	kb *knowledgebasedomain.KnowledgeBase,
) error {
	if kb == nil {
		return shared.ErrKnowledgeBaseNotFound
	}
	return nil
}

func (s *FragmentAppService) loadScopedKnowledgeBase(
	ctx context.Context,
	organizationCode string,
	knowledgeCode string,
) (*knowledgebasedomain.KnowledgeBase, error) {
	kb, err := s.findKnowledgeBaseByRuntimeCode(ctx, organizationCode, knowledgeCode)
	if err != nil {
		return nil, err
	}
	if err := s.ensureKnowledgeBaseMatchesAgentScope(ctx, kb); err != nil {
		return nil, err
	}
	return kb, nil
}

func (s *FragmentAppService) findKnowledgeBaseByRuntimeCode(
	ctx context.Context,
	organizationCode string,
	knowledgeCode string,
) (*knowledgebasedomain.KnowledgeBase, error) {
	kb, err := s.kbService.ShowByCodeAndOrg(ctx, knowledgeCode, organizationCode)
	if err == nil {
		return kb, nil
	}
	if !errors.Is(err, shared.ErrKnowledgeBaseNotFound) {
		return nil, fmt.Errorf("show knowledge base by code and org: %w", err)
	}

	resolved, resolveErr := s.resolveTeamshareKnowledgeBasesByRuntimeCodes(ctx, organizationCode, []string{knowledgeCode})
	if resolveErr != nil {
		return nil, resolveErr
	}
	if resolvedKB := resolved[strings.TrimSpace(knowledgeCode)]; resolvedKB != nil {
		return resolvedKB, nil
	}
	return nil, fmt.Errorf("show knowledge base by code and org: %w", err)
}

func (s *FragmentAppService) loadScopedKnowledgeBases(
	ctx context.Context,
	organizationCode string,
	knowledgeCodes []string,
) ([]*knowledgebasedomain.KnowledgeBase, error) {
	normalizedCodes := uniqueRuntimeKnowledgeCodes(knowledgeCodes)
	if len(normalizedCodes) == 0 {
		return nil, shared.ErrKnowledgeBaseNotFound
	}

	items, _, err := s.kbService.List(ctx, &knowledgebasedomain.Query{
		OrganizationCode: organizationCode,
		Codes:            append([]string(nil), normalizedCodes...),
		Offset:           0,
		Limit:            len(normalizedCodes),
	})
	if err != nil {
		return nil, fmt.Errorf("list knowledge bases by code and org: %w", err)
	}

	ordered := make([]*knowledgebasedomain.KnowledgeBase, 0, len(normalizedCodes))
	codeToKnowledgeBase := make(map[string]*knowledgebasedomain.KnowledgeBase, len(items))
	for _, item := range items {
		if item == nil {
			continue
		}
		codeToKnowledgeBase[item.Code] = item
	}
	missingCodes := make([]string, 0, len(normalizedCodes))
	for _, code := range normalizedCodes {
		if codeToKnowledgeBase[code] == nil {
			missingCodes = append(missingCodes, code)
		}
	}
	if len(missingCodes) > 0 {
		resolved, err := s.resolveTeamshareKnowledgeBasesByRuntimeCodes(ctx, organizationCode, missingCodes)
		if err != nil {
			return nil, err
		}
		for requestCode, kb := range resolved {
			if kb == nil {
				continue
			}
			codeToKnowledgeBase[requestCode] = kb
		}
	}
	for _, code := range normalizedCodes {
		kb := codeToKnowledgeBase[code]
		if kb == nil {
			return s.loadScopedKnowledgeBasesIndividually(ctx, organizationCode, normalizedCodes)
		}
		if err := s.ensureKnowledgeBaseMatchesAgentScope(ctx, kb); err != nil {
			return nil, err
		}
		ordered = append(ordered, kb)
	}
	return ordered, nil
}

func (s *FragmentAppService) resolveTeamshareKnowledgeBasesByRuntimeCodes(
	ctx context.Context,
	organizationCode string,
	knowledgeCodes []string,
) (map[string]*knowledgebasedomain.KnowledgeBase, error) {
	if s == nil || s.teamshareTempCodeMapper == nil || len(knowledgeCodes) == 0 {
		return map[string]*knowledgebasedomain.KnowledgeBase{}, nil
	}

	reverseBusinessIDs, err := s.teamshareTempCodeMapper.LookupBusinessIDs(ctx, knowledgeCodes)
	if err != nil {
		return nil, fmt.Errorf("lookup teamshare temp code reverse mapping: %w", err)
	}
	if len(reverseBusinessIDs) == 0 {
		return map[string]*knowledgebasedomain.KnowledgeBase{}, nil
	}

	businessIDs := make([]string, 0, len(reverseBusinessIDs))
	seenBusinessIDs := make(map[string]struct{}, len(reverseBusinessIDs))
	for _, knowledgeCode := range knowledgeCodes {
		businessID := strings.TrimSpace(reverseBusinessIDs[strings.TrimSpace(knowledgeCode)])
		if businessID == "" {
			continue
		}
		if _, exists := seenBusinessIDs[businessID]; exists {
			continue
		}
		seenBusinessIDs[businessID] = struct{}{}
		businessIDs = append(businessIDs, businessID)
	}
	if len(businessIDs) == 0 {
		return map[string]*knowledgebasedomain.KnowledgeBase{}, nil
	}

	items, _, err := s.kbService.List(ctx, &knowledgebasedomain.Query{
		OrganizationCode: organizationCode,
		BusinessIDs:      append([]string(nil), businessIDs...),
		Offset:           0,
		Limit:            len(businessIDs),
	})
	if err != nil {
		return nil, fmt.Errorf("list knowledge bases by business id: %w", err)
	}

	businessIDToKnowledgeBase := make(map[string]*knowledgebasedomain.KnowledgeBase, len(items))
	for _, item := range items {
		if item == nil {
			continue
		}
		businessID := strings.TrimSpace(item.BusinessID)
		if businessID == "" {
			continue
		}
		businessIDToKnowledgeBase[businessID] = item
	}

	resolved := make(map[string]*knowledgebasedomain.KnowledgeBase, len(knowledgeCodes))
	for _, knowledgeCode := range knowledgeCodes {
		trimmedCode := strings.TrimSpace(knowledgeCode)
		if trimmedCode == "" {
			continue
		}
		businessID := strings.TrimSpace(reverseBusinessIDs[trimmedCode])
		if businessID == "" {
			continue
		}
		if kb := businessIDToKnowledgeBase[businessID]; kb != nil {
			resolved[trimmedCode] = kb
		}
	}
	return resolved, nil
}

func (s *FragmentAppService) loadScopedKnowledgeBasesIndividually(
	ctx context.Context,
	organizationCode string,
	knowledgeCodes []string,
) ([]*knowledgebasedomain.KnowledgeBase, error) {
	ordered := make([]*knowledgebasedomain.KnowledgeBase, 0, len(knowledgeCodes))
	for _, code := range knowledgeCodes {
		kb, err := s.loadScopedKnowledgeBase(ctx, organizationCode, code)
		if err != nil {
			return nil, err
		}
		ordered = append(ordered, kb)
	}
	return ordered, nil
}

func (s *FragmentAppService) isKnowledgeBaseAccessibleInAgentScope(
	ctx context.Context,
	organizationCode string,
	knowledgeCode string,
) (bool, error) {
	_, err := s.loadScopedKnowledgeBase(ctx, organizationCode, knowledgeCode)
	if err == nil {
		return true, nil
	}
	if errors.Is(err, shared.ErrKnowledgeBaseNotFound) {
		return false, nil
	}
	return false, err
}

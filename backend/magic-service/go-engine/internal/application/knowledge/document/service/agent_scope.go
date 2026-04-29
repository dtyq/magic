package docapp

import (
	"context"
	"errors"
	"fmt"

	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	"magic/internal/domain/knowledge/shared"
)

func (s *DocumentAppService) ensureKnowledgeBaseMatchesAgentScope(
	_ context.Context,
	kb *kbentity.KnowledgeBase,
) error {
	if kb == nil {
		return shared.ErrKnowledgeBaseNotFound
	}
	return nil
}

func (s *DocumentAppService) ensureKnowledgeBaseAccessibleInAgentScope(
	ctx context.Context,
	organizationCode string,
	knowledgeBaseCode string,
) error {
	kb, err := s.kbService.ShowByCodeAndOrg(ctx, knowledgeBaseCode, organizationCode)
	if err != nil {
		return fmt.Errorf("show knowledge base by code and org: %w", err)
	}
	return s.ensureKnowledgeBaseMatchesAgentScope(ctx, kb)
}

func (s *DocumentAppService) isKnowledgeBaseAccessibleInAgentScope(
	ctx context.Context,
	organizationCode string,
	knowledgeBaseCode string,
) (bool, error) {
	err := s.ensureKnowledgeBaseAccessibleInAgentScope(ctx, organizationCode, knowledgeBaseCode)
	if err == nil {
		return true, nil
	}
	if errors.Is(err, shared.ErrKnowledgeBaseNotFound) {
		return false, nil
	}
	return false, err
}

package fragapp

import (
	"context"
	"fmt"
	"strings"

	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
)

type fragmentKnowledgeBaseUIDUpdater interface {
	Update(ctx context.Context, kb *kbentity.KnowledgeBase) error
}

func (s *FragmentAppService) healKnowledgeBaseUIDsBeforeDefaultDocument(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
) error {
	if s == nil || s.userService == nil || kb == nil {
		return nil
	}
	candidates := []string{strings.TrimSpace(kb.UpdatedUID), strings.TrimSpace(kb.CreatedUID)}
	directUsers, err := s.userService.ListActiveUserIDs(ctx, kb.OrganizationCode, candidates)
	if err != nil {
		return fmt.Errorf("list active users before default document: %w", err)
	}
	resolvedUserID, err := s.resolveKnowledgeBaseUserBeforeDefaultDocument(ctx, kb, candidates, directUsers)
	if err != nil {
		return err
	}
	if resolvedUserID == "" {
		s.logKnowledgeBaseUserMissingBeforeDefaultDocument(ctx, kb)
		return fmt.Errorf(
			"%w: organization_code=%s knowledge_base_code=%s",
			ErrFragmentKnowledgeBaseUserNotFound,
			kb.OrganizationCode,
			kb.Code,
		)
	}
	return s.applyKnowledgeBaseUIDsBeforeDefaultDocument(ctx, kb, resolvedUserID, directUsers)
}

func (s *FragmentAppService) resolveKnowledgeBaseUserBeforeDefaultDocument(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	candidates []string,
	directUsers map[string]struct{},
) (string, error) {
	for _, candidate := range candidates {
		if _, ok := directUsers[candidate]; ok {
			return candidate, nil
		}
	}
	usersByMagicID, err := s.userService.ListActiveUsersByMagicIDs(ctx, kb.OrganizationCode, candidates)
	if err != nil {
		return "", fmt.Errorf("list users by magic id before default document: %w", err)
	}
	for _, candidate := range candidates {
		users := usersByMagicID[candidate]
		if len(users) == 0 {
			continue
		}
		resolvedUserID := strings.TrimSpace(users[0].UserID)
		if resolvedUserID != "" {
			return resolvedUserID, nil
		}
	}
	return "", nil
}

func (s *FragmentAppService) applyKnowledgeBaseUIDsBeforeDefaultDocument(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	resolvedUserID string,
	directUsers map[string]struct{},
) error {
	oldCreatedUID := strings.TrimSpace(kb.CreatedUID)
	oldUpdatedUID := strings.TrimSpace(kb.UpdatedUID)
	_, createdValid := directUsers[oldCreatedUID]
	_, updatedValid := directUsers[oldUpdatedUID]
	if createdValid && updatedValid {
		return nil
	}
	if !createdValid {
		kb.CreatedUID = resolvedUserID
	}
	if !updatedValid {
		kb.UpdatedUID = resolvedUserID
	}
	updater, ok := s.kbService.(fragmentKnowledgeBaseUIDUpdater)
	if !ok {
		return nil
	}
	if s.logger != nil {
		s.logger.WarnContext(
			ctx,
			"Knowledge base uid self healed before default document",
			"organization_code", kb.OrganizationCode,
			"knowledge_base_code", kb.Code,
			"old_created_uid", oldCreatedUID,
			"old_updated_uid", oldUpdatedUID,
			"resolved_user_id", resolvedUserID,
		)
	}
	if err := updater.Update(ctx, kb); err != nil {
		return fmt.Errorf("self heal knowledge base uid before default document: %w", err)
	}
	return nil
}

func (s *FragmentAppService) logKnowledgeBaseUserMissingBeforeDefaultDocument(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
) {
	if s == nil || s.logger == nil || kb == nil {
		return
	}
	s.logger.ErrorContext(
		ctx,
		"Knowledge base user missing before default document",
		"organization_code", kb.OrganizationCode,
		"knowledge_base_code", kb.Code,
		"created_uid", kb.CreatedUID,
		"updated_uid", kb.UpdatedUID,
	)
}

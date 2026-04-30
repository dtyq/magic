package kbapp

import (
	"context"
	"fmt"
	"strings"

	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
)

func (s *KnowledgeBaseAppService) requireActiveUser(
	ctx context.Context,
	organizationCode string,
	userID string,
	action string,
) error {
	if s == nil || s.userService == nil {
		return nil
	}
	userID = strings.TrimSpace(userID)
	exists, err := s.userService.ExistsActiveUser(ctx, organizationCode, userID)
	if err != nil {
		return fmt.Errorf("check knowledge base active user: %w", err)
	}
	if !exists {
		return fmt.Errorf(
			"%w: action=%s organization_code=%s user_id=%s",
			ErrKnowledgeBaseUserNotFound,
			strings.TrimSpace(action),
			strings.TrimSpace(organizationCode),
			userID,
		)
	}
	return nil
}

func (s *KnowledgeBaseAppService) resolveWriteUserForKnowledgeBase(
	ctx context.Context,
	organizationCode string,
	requestUserID string,
	currentKnowledge *kbentity.KnowledgeBase,
	action string,
) (string, error) {
	requestUserID = strings.TrimSpace(requestUserID)
	if s == nil || s.userService == nil {
		return requestUserID, nil
	}
	if requestUserID != "" {
		exists, err := s.userService.ExistsActiveUser(ctx, organizationCode, requestUserID)
		if err != nil {
			return "", fmt.Errorf("check knowledge base write user: %w", err)
		}
		if exists {
			return requestUserID, nil
		}
	}
	if currentKnowledge != nil {
		if resolved, err := s.healKnowledgeBaseUIDs(ctx, currentKnowledge, action); err != nil {
			return "", err
		} else if resolved != "" {
			return resolved, nil
		}
	}
	return "", fmt.Errorf(
		"%w: action=%s organization_code=%s user_id=%s",
		ErrKnowledgeBaseUserNotFound,
		strings.TrimSpace(action),
		strings.TrimSpace(organizationCode),
		requestUserID,
	)
}

func (s *KnowledgeBaseAppService) healKnowledgeBaseUIDs(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	action string,
) (string, error) {
	if s == nil || s.userService == nil || kb == nil {
		return knowledgeBaseUpdatedUserID(kb), nil
	}
	candidates := []string{strings.TrimSpace(kb.UpdatedUID), strings.TrimSpace(kb.CreatedUID)}
	directUsers, err := s.userService.ListActiveUserIDs(ctx, kb.OrganizationCode, candidates)
	if err != nil {
		return "", fmt.Errorf("list active knowledge base users: %w", err)
	}
	for _, candidate := range candidates {
		if _, ok := directUsers[candidate]; ok {
			return s.applyKnowledgeBaseUIDSelfHeal(ctx, kb, candidate, directUsers, action, "knowledge_base.uid")
		}
	}
	usersByMagicID, err := s.userService.ListActiveUsersByMagicIDs(ctx, kb.OrganizationCode, candidates)
	if err != nil {
		return "", fmt.Errorf("list knowledge base users by magic id: %w", err)
	}
	for _, candidate := range candidates {
		users := usersByMagicID[candidate]
		if len(users) == 0 {
			continue
		}
		resolvedUserID := strings.TrimSpace(users[0].UserID)
		if resolvedUserID == "" {
			continue
		}
		return s.applyKnowledgeBaseUIDSelfHeal(ctx, kb, resolvedUserID, directUsers, action, "knowledge_base.magic_id")
	}
	s.logKnowledgeBaseUserMissing(ctx, kb, action)
	return "", fmt.Errorf(
		"%w: action=%s organization_code=%s knowledge_base_code=%s created_uid=%s updated_uid=%s",
		ErrKnowledgeBaseUserNotFound,
		strings.TrimSpace(action),
		kb.OrganizationCode,
		kb.Code,
		kb.CreatedUID,
		kb.UpdatedUID,
	)
}

func (s *KnowledgeBaseAppService) applyKnowledgeBaseUIDSelfHeal(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	resolvedUserID string,
	directUsers map[string]struct{},
	action string,
	source string,
) (string, error) {
	if kb == nil || resolvedUserID == "" {
		return "", nil
	}
	createdUID := strings.TrimSpace(kb.CreatedUID)
	updatedUID := strings.TrimSpace(kb.UpdatedUID)
	_, createdValid := directUsers[createdUID]
	_, updatedValid := directUsers[updatedUID]
	if createdValid && updatedValid {
		return resolvedUserID, nil
	}
	if !createdValid {
		kb.CreatedUID = resolvedUserID
	}
	if !updatedValid {
		kb.UpdatedUID = resolvedUserID
	}
	if s.logger != nil {
		s.logger.WarnContext(
			ctx,
			"Knowledge base uid self healed",
			"organization_code", kb.OrganizationCode,
			"knowledge_base_code", kb.Code,
			"old_created_uid", createdUID,
			"old_updated_uid", updatedUID,
			"resolved_user_id", resolvedUserID,
			"action", strings.TrimSpace(action),
			"source", source,
		)
	}
	if err := s.domainService.Update(ctx, kb); err != nil {
		return "", fmt.Errorf("self heal knowledge base uid: %w", err)
	}
	return resolvedUserID, nil
}

func (s *KnowledgeBaseAppService) logKnowledgeBaseUserMissing(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	action string,
) {
	if s == nil || s.logger == nil || kb == nil {
		return
	}
	s.logger.ErrorContext(
		ctx,
		"Knowledge base user missing after uid self heal",
		"organization_code", kb.OrganizationCode,
		"knowledge_base_code", kb.Code,
		"created_uid", kb.CreatedUID,
		"updated_uid", kb.UpdatedUID,
		"action", strings.TrimSpace(action),
	)
}

package docapp

import (
	"context"
	"errors"
	"fmt"
	"strings"

	kbaccess "magic/internal/domain/knowledge/access/service"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/thirdplatform"
)

// ErrDocumentPermissionDenied 表示当前用户无知识库文档权限。
var ErrDocumentPermissionDenied = errors.New("document permission denied")

func (s *DocumentAppService) knowledgeAccessService() *kbaccess.Service {
	if s == nil || s.permissionReader == nil {
		return nil
	}
	return kbaccess.NewService(
		s.permissionReader,
		nil,
		&documentExternalAccessReader{support: s},
		nil,
	)
}

func (s *DocumentAppService) authorizeKnowledgeBaseAction(
	ctx context.Context,
	organizationCode string,
	userID string,
	knowledgeBaseCode string,
	action string,
) error {
	accessService := s.knowledgeAccessService()
	if accessService == nil {
		return nil
	}
	actor := resolveDocumentAccessActor(ctx, organizationCode, userID)
	result, err := accessService.Authorize(ctx, actor, action, kbaccess.Target{
		KnowledgeBaseCode: knowledgeBaseCode,
	})
	if err != nil {
		return fmt.Errorf("authorize document knowledge base access: %w", err)
	}
	if !result.Operation.ValidateAction(action) {
		return fmt.Errorf("%w: action=%s knowledge_base_code=%s", ErrDocumentPermissionDenied, action, knowledgeBaseCode)
	}
	return nil
}

func resolveDocumentAccessActor(ctx context.Context, organizationCode, userID string) kbaccess.Actor {
	if actor, ok := ctxmeta.AccessActorFromContext(ctx); ok {
		if strings.TrimSpace(organizationCode) == "" {
			organizationCode = actor.OrganizationCode
		}
		if strings.TrimSpace(userID) == "" {
			userID = actor.UserID
		}
		return kbaccess.Actor{
			OrganizationCode:              strings.TrimSpace(organizationCode),
			UserID:                        strings.TrimSpace(userID),
			ThirdPlatformUserID:           strings.TrimSpace(actor.ThirdPlatformUserID),
			ThirdPlatformOrganizationCode: strings.TrimSpace(actor.ThirdPlatformOrganizationCode),
		}
	}
	return kbaccess.Actor{
		OrganizationCode: strings.TrimSpace(organizationCode),
		UserID:           strings.TrimSpace(userID),
	}
}

type documentExternalAccessReader struct {
	support *DocumentAppService
}

func (r *documentExternalAccessReader) ListOperations(
	ctx context.Context,
	actor kbaccess.Actor,
	knowledgeBaseCodes []string,
) (map[string]kbaccess.Operation, error) {
	if r == nil || r.support == nil || r.support.thirdPlatformAccess == nil {
		return map[string]kbaccess.Operation{}, nil
	}

	items, err := r.support.thirdPlatformAccess.ListKnowledgeBases(ctx, thirdplatform.KnowledgeBaseListInput{
		OrganizationCode:              actor.OrganizationCode,
		UserID:                        actor.UserID,
		ThirdPlatformUserID:           actor.ThirdPlatformUserID,
		ThirdPlatformOrganizationCode: actor.ThirdPlatformOrganizationCode,
	})
	if err != nil {
		if errors.Is(err, thirdplatform.ErrIdentityMissing) {
			return map[string]kbaccess.Operation{}, nil
		}
		return nil, fmt.Errorf("list external knowledge bases: %w", err)
	}
	if len(items) == 0 {
		return map[string]kbaccess.Operation{}, nil
	}

	businessIDs := make([]string, 0, len(items))
	for _, item := range items {
		businessID := strings.TrimSpace(item.KnowledgeBaseID)
		if businessID == "" {
			continue
		}
		businessIDs = append(businessIDs, businessID)
	}
	if len(businessIDs) == 0 {
		return map[string]kbaccess.Operation{}, nil
	}

	knowledgeBases, _, err := r.support.kbService.List(ctx, &kbrepository.Query{
		OrganizationCode: actor.OrganizationCode,
		BusinessIDs:      businessIDs,
		Offset:           0,
		Limit:            len(businessIDs),
	})
	if err != nil {
		return nil, fmt.Errorf("list external knowledge base snapshots: %w", err)
	}

	requested := make(map[string]struct{}, len(knowledgeBaseCodes))
	for _, knowledgeBaseCode := range knowledgeBaseCodes {
		trimmed := strings.TrimSpace(knowledgeBaseCode)
		if trimmed == "" {
			continue
		}
		requested[trimmed] = struct{}{}
	}

	operations := make(map[string]kbaccess.Operation, len(knowledgeBases))
	for _, knowledgeBase := range knowledgeBases {
		if knowledgeBase == nil || strings.TrimSpace(knowledgeBase.Code) == "" {
			continue
		}
		if len(requested) > 0 {
			if _, ok := requested[knowledgeBase.Code]; !ok {
				continue
			}
		}
		operations[knowledgeBase.Code] = kbaccess.OperationAdmin
	}
	return operations, nil
}

type documentKnowledgeAccessPort interface {
	ListKnowledgeBases(ctx context.Context, input thirdplatform.KnowledgeBaseListInput) ([]thirdplatform.KnowledgeBaseItem, error)
}

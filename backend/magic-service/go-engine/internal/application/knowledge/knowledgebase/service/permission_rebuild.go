package kbapp

import (
	"context"
	"fmt"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	kbaccess "magic/internal/domain/knowledge/access/service"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
)

const defaultRebuildKnowledgeBasePermissionLimit = 200

// PermissionRebuildApp 承接知识库权限补齐命令流。
type PermissionRebuildApp struct {
	*KnowledgeBaseAppService
}

// PermissionRebuildCommandApp 返回知识库权限补齐命令应用服务。
func (s *KnowledgeBaseAppService) PermissionRebuildCommandApp() *PermissionRebuildApp {
	return &PermissionRebuildApp{KnowledgeBaseAppService: s}
}

// RebuildPermissions 兼容旧接线，内部转发给权限补齐命令 app。
func (s *KnowledgeBaseAppService) RebuildPermissions(
	ctx context.Context,
	input *kbdto.RebuildKnowledgeBasePermissionsInput,
) (*kbdto.RebuildKnowledgeBasePermissionsResult, error) {
	return s.PermissionRebuildCommandApp().RebuildPermissions(ctx, input)
}

// RebuildPermissions 批量补齐知识库 owner/admin 权限。
func (s *PermissionRebuildApp) RebuildPermissions(
	ctx context.Context,
	input *kbdto.RebuildKnowledgeBasePermissionsInput,
) (*kbdto.RebuildKnowledgeBasePermissionsResult, error) {
	if input == nil {
		return &kbdto.RebuildKnowledgeBasePermissionsResult{}, nil
	}

	accessService, err := s.knowledgeAccessService()
	if err != nil {
		return nil, err
	}

	limit := input.Limit
	if limit <= 0 {
		limit = defaultRebuildKnowledgeBasePermissionLimit
	}

	query := &kbrepository.Query{
		OrganizationCode: input.KnowledgeOrganizationCode,
		Codes:            append([]string(nil), input.KnowledgeBaseCodes...),
		Offset:           0,
		Limit:            limit,
	}

	result := &kbdto.RebuildKnowledgeBasePermissionsResult{}
	for {
		knowledgeBases, _, err := s.domainService.List(ctx, query)
		if err != nil {
			return nil, fmt.Errorf("list knowledge bases for permission rebuild: %w", err)
		}
		if len(knowledgeBases) == 0 {
			return result, nil
		}

		items := make([]kbaccess.RebuildItem, 0, len(knowledgeBases))
		for _, knowledgeBase := range knowledgeBases {
			if knowledgeBase == nil || knowledgeBase.Code == "" || knowledgeBase.CreatedUID == "" || knowledgeBase.OrganizationCode == "" {
				continue
			}
			currentUserID := input.OperatorUserID
			if currentUserID == "" {
				currentUserID = knowledgeBase.CreatedUID
			}
			items = append(items, kbaccess.RebuildItem{
				OrganizationCode:  knowledgeBase.OrganizationCode,
				CurrentUserID:     currentUserID,
				KnowledgeBaseCode: knowledgeBase.Code,
				OwnerUserID:       knowledgeBase.CreatedUID,
				KnowledgeType:     knowledgeBase.Type,
				BusinessID:        knowledgeBase.BusinessID,
			})
		}
		result.Scanned += len(items)

		initialized, err := accessService.Rebuild(ctx, items)
		if err != nil {
			return nil, fmt.Errorf("rebuild knowledge base permissions: %w", err)
		}
		result.Initialized += initialized

		if len(knowledgeBases) < limit || len(query.Codes) > 0 {
			return result, nil
		}
		query.Offset += len(knowledgeBases)
	}
}

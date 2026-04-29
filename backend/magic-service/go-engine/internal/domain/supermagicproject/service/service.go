// Package supermagicproject 提供 super magic project 领域服务。
package supermagicproject

import (
	"context"
	"errors"
	"fmt"
	"strings"

	projectrepository "magic/internal/domain/supermagicproject/repository"
)

// ErrRepositoryRequired 表示缺少 super magic project 仓储依赖。
var ErrRepositoryRequired = errors.New("super magic project repository is required")

// DomainService 封装 super magic project 的只读领域能力。
type DomainService struct {
	repo projectrepository.Repository
}

// NewDomainService 创建 super magic project 领域服务。
func NewDomainService(repo projectrepository.Repository) *DomainService {
	return &DomainService{repo: repo}
}

// ListWorkspaceIDsByProjectIDs 按项目 ID 批量返回工作区 ID 映射。
func (s *DomainService) ListWorkspaceIDsByProjectIDs(
	ctx context.Context,
	organizationCode string,
	projectIDs []int64,
) (map[int64]int64, error) {
	if s == nil || s.repo == nil {
		return nil, ErrRepositoryRequired
	}

	normalized := normalizeProjectIDs(projectIDs)
	if len(normalized) == 0 {
		return map[int64]int64{}, nil
	}

	mappings, err := s.repo.ListWorkspaceMappings(ctx, organizationCode, normalized)
	if err != nil {
		return nil, fmt.Errorf("list workspace mappings: %w", err)
	}

	result := make(map[int64]int64, len(mappings))
	for _, mapping := range mappings {
		if mapping.ProjectID <= 0 || mapping.WorkspaceID <= 0 {
			continue
		}
		result[mapping.ProjectID] = mapping.WorkspaceID
	}
	return result, nil
}

// ListSharedProjectIDsByProjectIDs 按项目 ID 批量返回协作项目集合。
func (s *DomainService) ListSharedProjectIDsByProjectIDs(
	ctx context.Context,
	organizationCode string,
	userID string,
	projectIDs []int64,
) (map[int64]struct{}, error) {
	if s == nil || s.repo == nil {
		return nil, ErrRepositoryRequired
	}

	trimmedUserID := strings.TrimSpace(userID)
	if trimmedUserID == "" {
		return map[int64]struct{}{}, nil
	}

	normalized := normalizeProjectIDs(projectIDs)
	if len(normalized) == 0 {
		return map[int64]struct{}{}, nil
	}

	sharedProjectIDs, err := s.repo.ListSharedProjectIDs(ctx, organizationCode, trimmedUserID, normalized)
	if err != nil {
		return nil, fmt.Errorf("list shared project ids: %w", err)
	}

	result := make(map[int64]struct{}, len(sharedProjectIDs))
	for _, projectID := range sharedProjectIDs {
		if projectID <= 0 {
			continue
		}
		result[projectID] = struct{}{}
	}
	return result, nil
}

func normalizeProjectIDs(projectIDs []int64) []int64 {
	if len(projectIDs) == 0 {
		return nil
	}

	seen := make(map[int64]struct{}, len(projectIDs))
	result := make([]int64, 0, len(projectIDs))
	for _, projectID := range projectIDs {
		if projectID <= 0 {
			continue
		}
		if _, ok := seen[projectID]; ok {
			continue
		}
		seen[projectID] = struct{}{}
		result = append(result, projectID)
	}
	return result
}

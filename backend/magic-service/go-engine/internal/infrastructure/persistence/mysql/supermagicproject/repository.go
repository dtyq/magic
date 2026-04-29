// Package supermagicprojectrepo 提供 super magic project 的 MySQL 只读仓储实现。
package supermagicprojectrepo

import (
	"context"
	"errors"
	"fmt"
	"strings"

	projectrepository "magic/internal/domain/supermagicproject/repository"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
)

var errRepositoryNil = errors.New("super magic project repository is nil")

const (
	collaborationEnabled = 1
	projectMemberActive  = 1
)

// Repository 实现 super magic project 只读仓储。
type Repository struct {
	queries *mysqlsqlc.Queries
}

// NewRepository 创建 super magic project 仓储。
func NewRepository(client *mysqlclient.SQLCClient) *Repository {
	var queries *mysqlsqlc.Queries
	if client != nil {
		queries = client.Q()
	}
	return &Repository{queries: queries}
}

// ListWorkspaceMappings 按项目 ID 批量查询工作区映射。
func (r *Repository) ListWorkspaceMappings(
	ctx context.Context,
	organizationCode string,
	projectIDs []int64,
) ([]projectrepository.ProjectWorkspaceMapping, error) {
	if r == nil || r.queries == nil {
		return nil, errRepositoryNil
	}
	if len(projectIDs) == 0 {
		return []projectrepository.ProjectWorkspaceMapping{}, nil
	}

	rows, err := r.queries.ListSuperMagicProjectWorkspaceMappings(ctx, mysqlsqlc.ListSuperMagicProjectWorkspaceMappingsParams{
		UserOrganizationCode: strings.TrimSpace(organizationCode),
		ProjectIds:           append([]int64(nil), projectIDs...),
	})
	if err != nil {
		return nil, fmt.Errorf("list super magic project workspace mappings: %w", err)
	}

	result := make([]projectrepository.ProjectWorkspaceMapping, 0, len(rows))
	for _, row := range rows {
		if !row.WorkspaceID.Valid || row.WorkspaceID.Int64 <= 0 {
			continue
		}
		result = append(result, projectrepository.ProjectWorkspaceMapping{
			ProjectID:   row.ID,
			WorkspaceID: row.WorkspaceID.Int64,
		})
	}
	return result, nil
}

// ListSharedProjectIDs 按项目 ID 批量查询协作项目集合。
func (r *Repository) ListSharedProjectIDs(
	ctx context.Context,
	organizationCode string,
	userID string,
	projectIDs []int64,
) ([]int64, error) {
	if r == nil || r.queries == nil {
		return nil, errRepositoryNil
	}
	trimmedUserID := strings.TrimSpace(userID)
	if len(projectIDs) == 0 || trimmedUserID == "" {
		return []int64{}, nil
	}
	trimmedOrganizationCode := strings.TrimSpace(organizationCode)

	projects, err := r.queries.ListSuperMagicSharedProjectCandidates(ctx, mysqlsqlc.ListSuperMagicSharedProjectCandidatesParams{
		UserOrganizationCode: trimmedOrganizationCode,
		ProjectIds:           append([]int64(nil), projectIDs...),
	})
	if err != nil {
		return nil, fmt.Errorf("list super magic shared project candidates: %w", err)
	}

	projectWorkspaceByID, workspaceIDs := collectSharedProjectWorkspaces(projects)
	if len(projectWorkspaceByID) == 0 {
		return []int64{}, nil
	}

	workspaces, err := r.queries.ListSuperMagicWorkspacesByIDs(ctx, workspaceIDs)
	if err != nil {
		return nil, fmt.Errorf("list super magic workspaces by ids: %w", err)
	}

	workspaceOwnerByID := make(map[int64]string, len(workspaces))
	for _, workspace := range workspaces {
		if workspace.ID <= 0 {
			continue
		}
		workspaceOwnerByID[workspace.ID] = workspace.UserID
	}

	candidateProjectIDs, candidateProjectSeen := collectSharedProjectCandidates(
		projects,
		projectWorkspaceByID,
		workspaceOwnerByID,
		trimmedUserID,
	)
	if len(candidateProjectIDs) == 0 {
		return []int64{}, nil
	}

	members, err := r.queries.ListSuperMagicProjectMembersByProjectIDs(
		ctx,
		candidateProjectIDs,
	)
	if err != nil {
		return nil, fmt.Errorf("list super magic project members by project ids: %w", err)
	}

	return collectSharedProjectIDs(candidateProjectIDs, candidateProjectSeen, members, trimmedOrganizationCode), nil
}

func collectSharedProjectWorkspaces(
	projects []mysqlsqlc.ListSuperMagicSharedProjectCandidatesRow,
) (map[int64]int64, []int64) {
	projectWorkspaceByID := make(map[int64]int64, len(projects))
	workspaceSeen := make(map[int64]struct{}, len(projects))
	workspaceIDs := make([]int64, 0, len(projects))
	for _, project := range projects {
		if !isCollaborationProject(project) {
			continue
		}

		workspaceID := project.WorkspaceID.Int64
		projectWorkspaceByID[project.ID] = workspaceID
		if _, ok := workspaceSeen[workspaceID]; ok {
			continue
		}
		workspaceSeen[workspaceID] = struct{}{}
		workspaceIDs = append(workspaceIDs, workspaceID)
	}
	return projectWorkspaceByID, workspaceIDs
}

func isCollaborationProject(project mysqlsqlc.ListSuperMagicSharedProjectCandidatesRow) bool {
	return project.ID > 0 &&
		project.IsCollaborationEnabled == collaborationEnabled &&
		project.WorkspaceID.Valid &&
		project.WorkspaceID.Int64 > 0
}

func collectSharedProjectCandidates(
	projects []mysqlsqlc.ListSuperMagicSharedProjectCandidatesRow,
	projectWorkspaceByID map[int64]int64,
	workspaceOwnerByID map[int64]string,
	currentUserID string,
) ([]int64, map[int64]struct{}) {
	candidateProjectSeen := make(map[int64]struct{}, len(projectWorkspaceByID))
	candidateProjectIDs := make([]int64, 0, len(projectWorkspaceByID))
	for _, project := range projects {
		workspaceID, ok := projectWorkspaceByID[project.ID]
		if !ok {
			continue
		}
		workspaceOwner, ok := workspaceOwnerByID[workspaceID]
		if !ok || workspaceOwner == currentUserID {
			continue
		}
		if _, ok := candidateProjectSeen[project.ID]; ok {
			continue
		}
		candidateProjectSeen[project.ID] = struct{}{}
		candidateProjectIDs = append(candidateProjectIDs, project.ID)
	}
	return candidateProjectIDs, candidateProjectSeen
}

func collectSharedProjectIDs(
	candidateProjectIDs []int64,
	candidateProjectSeen map[int64]struct{},
	members []mysqlsqlc.ListSuperMagicProjectMembersByProjectIDsRow,
	organizationCode string,
) []int64 {
	sharedProjectSeen := make(map[int64]struct{}, len(candidateProjectIDs))
	for _, member := range members {
		if isSharedProjectMember(member, candidateProjectSeen, organizationCode) {
			sharedProjectSeen[member.ProjectID] = struct{}{}
		}
	}

	result := make([]int64, 0, len(sharedProjectSeen))
	for _, projectID := range candidateProjectIDs {
		if _, ok := sharedProjectSeen[projectID]; ok {
			result = append(result, projectID)
		}
	}
	return result
}

func isSharedProjectMember(
	member mysqlsqlc.ListSuperMagicProjectMembersByProjectIDsRow,
	candidateProjectSeen map[int64]struct{},
	organizationCode string,
) bool {
	if _, ok := candidateProjectSeen[member.ProjectID]; !ok {
		return false
	}
	return member.OrganizationCode == organizationCode &&
		member.Status == projectMemberActive &&
		!member.DeletedAt.Valid &&
		isSharedProjectRole(member.Role)
}

func isSharedProjectRole(role string) bool {
	switch role {
	case "manage", "editor", "viewer":
		return true
	default:
		return false
	}
}

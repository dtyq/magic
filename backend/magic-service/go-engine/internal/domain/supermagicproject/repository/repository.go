// Package repository 定义 super magic project 读模型仓储契约。
package repository

import "context"

// ProjectWorkspaceMapping 表示项目与工作区的轻量映射关系。
type ProjectWorkspaceMapping struct {
	ProjectID   int64
	WorkspaceID int64
}

// Repository 定义 super magic project 只读仓储。
type Repository interface {
	ListWorkspaceMappings(
		ctx context.Context,
		organizationCode string,
		projectIDs []int64,
	) ([]ProjectWorkspaceMapping, error)
	ListSharedProjectIDs(
		ctx context.Context,
		organizationCode string,
		userID string,
		projectIDs []int64,
	) ([]int64, error)
}

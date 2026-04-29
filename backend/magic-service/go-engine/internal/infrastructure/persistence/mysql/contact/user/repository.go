// Package user 提供 Magic 联系人用户 MySQL 仓储。
package user

import (
	"context"
	"fmt"
	"strings"

	userdomain "magic/internal/domain/contact/user"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
)

// Repository 是基于 sqlc 的 Magic 联系人用户仓储。
type Repository struct {
	queries *mysqlsqlc.Queries
}

// NewRepository 创建 Magic 联系人用户仓储。
func NewRepository(client *mysqlclient.SQLCClient) *Repository {
	var queries *mysqlsqlc.Queries
	if client != nil {
		queries = client.Q()
	}
	return &Repository{queries: queries}
}

// ExistsActiveUser 判断同组织用户是否存在且启用。
func (r *Repository) ExistsActiveUser(ctx context.Context, organizationCode, userID string) (bool, error) {
	if r == nil || r.queries == nil {
		return false, nil
	}
	organizationCode = strings.TrimSpace(organizationCode)
	userID = strings.TrimSpace(userID)
	if organizationCode == "" || userID == "" {
		return false, nil
	}
	count, err := r.queries.CountActiveContactUserByUserID(ctx, mysqlsqlc.CountActiveContactUserByUserIDParams{
		OrganizationCode: organizationCode,
		UserID:           userID,
	})
	if err != nil {
		return false, fmt.Errorf("count active contact user by user id: %w", err)
	}
	return count > 0, nil
}

// ListActiveUserIDs 批量返回同组织存在且启用的 user_id。
func (r *Repository) ListActiveUserIDs(
	ctx context.Context,
	organizationCode string,
	userIDs []string,
) (map[string]struct{}, error) {
	result := map[string]struct{}{}
	if r == nil || r.queries == nil {
		return result, nil
	}
	organizationCode = strings.TrimSpace(organizationCode)
	normalized := normalizeStrings(userIDs)
	if organizationCode == "" || len(normalized) == 0 {
		return result, nil
	}
	rows, err := r.queries.ListActiveContactUserIDsByUserIDs(ctx, mysqlsqlc.ListActiveContactUserIDsByUserIDsParams{
		OrganizationCode: organizationCode,
		UserIds:          normalized,
	})
	if err != nil {
		return nil, fmt.Errorf("list active contact user ids: %w", err)
	}
	for _, row := range rows {
		userID := strings.TrimSpace(row)
		if userID != "" {
			result[userID] = struct{}{}
		}
	}
	return result, nil
}

// ListActiveUsersByMagicID 按 magic_id 查询同组织启用用户。
func (r *Repository) ListActiveUsersByMagicID(
	ctx context.Context,
	organizationCode string,
	magicID string,
) ([]userdomain.User, error) {
	if r == nil || r.queries == nil {
		return nil, nil
	}
	organizationCode = strings.TrimSpace(organizationCode)
	magicID = strings.TrimSpace(magicID)
	if organizationCode == "" || magicID == "" {
		return nil, nil
	}
	rows, err := r.queries.ListActiveContactUsersByMagicID(ctx, mysqlsqlc.ListActiveContactUsersByMagicIDParams{
		OrganizationCode: organizationCode,
		MagicID:          magicID,
	})
	if err != nil {
		return nil, fmt.Errorf("list active contact users by magic id: %w", err)
	}
	users := make([]userdomain.User, 0, len(rows))
	for _, row := range rows {
		users = append(users, userdomain.User{
			ID:               row.ID,
			UserID:           strings.TrimSpace(row.UserID),
			MagicID:          strings.TrimSpace(row.MagicID),
			OrganizationCode: strings.TrimSpace(row.OrganizationCode),
		})
	}
	return users, nil
}

// ListActiveUsersByMagicIDs 批量按 magic_id 查询同组织启用用户。
func (r *Repository) ListActiveUsersByMagicIDs(
	ctx context.Context,
	organizationCode string,
	magicIDs []string,
) (map[string][]userdomain.User, error) {
	result := map[string][]userdomain.User{}
	if r == nil || r.queries == nil {
		return result, nil
	}
	organizationCode = strings.TrimSpace(organizationCode)
	normalized := normalizeStrings(magicIDs)
	if organizationCode == "" || len(normalized) == 0 {
		return result, nil
	}
	rows, err := r.queries.ListActiveContactUsersByMagicIDs(ctx, mysqlsqlc.ListActiveContactUsersByMagicIDsParams{
		OrganizationCode: organizationCode,
		MagicIds:         normalized,
	})
	if err != nil {
		return nil, fmt.Errorf("list active contact users by magic ids: %w", err)
	}
	for _, row := range rows {
		magicID := strings.TrimSpace(row.MagicID)
		if magicID == "" {
			continue
		}
		result[magicID] = append(result[magicID], userdomain.User{
			ID:               row.ID,
			UserID:           strings.TrimSpace(row.UserID),
			MagicID:          magicID,
			OrganizationCode: strings.TrimSpace(row.OrganizationCode),
		})
	}
	return result, nil
}

func normalizeStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	normalized := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	return normalized
}

// Package supermagicagentrepo 提供数字员工只读仓储实现。
package supermagicagentrepo

import (
	"context"
	"errors"
	"fmt"
	"strings"

	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
)

// Repository 实现数字员工只读查询。
type Repository struct {
	client  *mysqlclient.SQLCClient
	queries *mysqlsqlc.Queries
}

var errNilSuperMagicAgentRepository = errors.New("super magic agent repository is nil")

// NewRepository 创建数字员工只读仓储。
func NewRepository(client *mysqlclient.SQLCClient) *Repository {
	var queries *mysqlsqlc.Queries
	if client != nil {
		queries = client.Q()
	}
	return &Repository{client: client, queries: queries}
}

// ListExistingCodesByOrg 返回指定组织下真实存在且未删除的数字员工编码。
func (r *Repository) ListExistingCodesByOrg(ctx context.Context, organizationCode string, codes []string) (map[string]struct{}, error) {
	result := make(map[string]struct{}, len(codes))
	if r == nil || r.client == nil {
		return result, errNilSuperMagicAgentRepository
	}

	normalized := make([]string, 0, len(codes))
	seen := make(map[string]struct{}, len(codes))
	for _, code := range codes {
		trimmed := strings.TrimSpace(code)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	if len(normalized) == 0 {
		return result, nil
	}

	rows, err := r.queries.ListExistingSuperMagicAgentCodesByOrg(ctx, mysqlsqlc.ListExistingSuperMagicAgentCodesByOrgParams{
		OrganizationCode: strings.TrimSpace(organizationCode),
		Codes:            normalized,
	})
	if err != nil {
		return nil, fmt.Errorf("query super magic agents: %w", err)
	}
	for _, code := range rows {
		trimmed := strings.TrimSpace(code)
		if trimmed != "" {
			result[trimmed] = struct{}{}
		}
	}
	return result, nil
}

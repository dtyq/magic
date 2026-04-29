package user

import (
	"context"
	"fmt"
	"strings"
)

// DomainService 收敛 Magic 联系人用户查询规则。
type DomainService struct {
	repo Repository
}

// NewDomainService 创建用户领域服务。
func NewDomainService(repo Repository) *DomainService {
	return &DomainService{repo: repo}
}

// ExistsActiveUser 判断同组织用户是否存在且启用。
func (s *DomainService) ExistsActiveUser(ctx context.Context, organizationCode, userID string) (bool, error) {
	if s == nil || s.repo == nil {
		return false, nil
	}
	exists, err := s.repo.ExistsActiveUser(ctx, strings.TrimSpace(organizationCode), strings.TrimSpace(userID))
	if err != nil {
		return false, fmt.Errorf("exists active user: %w", err)
	}
	return exists, nil
}

// ListActiveUserIDs 批量返回同组织中存在且启用的 user_id。
func (s *DomainService) ListActiveUserIDs(
	ctx context.Context,
	organizationCode string,
	userIDs []string,
) (map[string]struct{}, error) {
	if s == nil || s.repo == nil {
		return map[string]struct{}{}, nil
	}
	users, err := s.repo.ListActiveUserIDs(ctx, strings.TrimSpace(organizationCode), userIDs)
	if err != nil {
		return nil, fmt.Errorf("list active user ids: %w", err)
	}
	return users, nil
}

// ListActiveUsersByMagicID 按 magic_id 查询同组织启用用户，调用方按返回顺序稳定选用。
func (s *DomainService) ListActiveUsersByMagicID(ctx context.Context, organizationCode, magicID string) ([]User, error) {
	if s == nil || s.repo == nil {
		return nil, nil
	}
	users, err := s.repo.ListActiveUsersByMagicID(ctx, strings.TrimSpace(organizationCode), strings.TrimSpace(magicID))
	if err != nil {
		return nil, fmt.Errorf("list active users by magic id: %w", err)
	}
	return users, nil
}

// ListActiveUsersByMagicIDs 批量按 magic_id 查询同组织启用用户，调用方按每组返回顺序稳定选用。
func (s *DomainService) ListActiveUsersByMagicIDs(
	ctx context.Context,
	organizationCode string,
	magicIDs []string,
) (map[string][]User, error) {
	if s == nil || s.repo == nil {
		return map[string][]User{}, nil
	}
	users, err := s.repo.ListActiveUsersByMagicIDs(ctx, strings.TrimSpace(organizationCode), magicIDs)
	if err != nil {
		return nil, fmt.Errorf("list active users by magic ids: %w", err)
	}
	return users, nil
}

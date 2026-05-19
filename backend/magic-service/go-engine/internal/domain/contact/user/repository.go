// Package user 定义 Magic 联系人用户领域能力。
package user

import "context"

// User 表示本次知识库链路需要识别的最小 Magic 用户信息。
type User struct {
	ID               uint64
	UserID           string
	MagicID          string
	OrganizationCode string
}

// Repository 定义 Magic 联系人用户查询仓储。
type Repository interface {
	ExistsActiveUser(ctx context.Context, organizationCode, userID string) (bool, error)
	ListActiveUserIDs(ctx context.Context, organizationCode string, userIDs []string) (map[string]struct{}, error)
	ListActiveUsersByMagicID(ctx context.Context, organizationCode, magicID string) ([]User, error)
	ListActiveUsersByMagicIDs(ctx context.Context, organizationCode string, magicIDs []string) (map[string][]User, error)
}

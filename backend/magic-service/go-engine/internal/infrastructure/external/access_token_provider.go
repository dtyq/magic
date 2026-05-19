package external

import "context"

// AccessTokenProvider 提供模型网关调用所需的访问令牌。
type AccessTokenProvider interface {
	GetAccessToken(ctx context.Context) (string, error)
}

// RefreshableAccessTokenProvider 支持强制刷新访问令牌。
type RefreshableAccessTokenProvider interface {
	AccessTokenProvider
	RefreshAccessToken(ctx context.Context) (string, error)
}

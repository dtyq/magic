package external

import (
	"context"
	"fmt"
	"strings"
)

// ConfigFirstAccessTokenProvider 优先返回配置中的令牌，否则回退到其他提供方。
type ConfigFirstAccessTokenProvider struct {
	configToken string
	fallback    AccessTokenProvider
}

// NewConfigFirstAccessTokenProvider 创建新的提供方。
func NewConfigFirstAccessTokenProvider(configToken string, fallback AccessTokenProvider) *ConfigFirstAccessTokenProvider {
	return &ConfigFirstAccessTokenProvider{
		configToken: configToken,
		fallback:    fallback,
	}
}

// GetAccessToken 配置令牌存在则返回，否则委托给回退提供方。
func (p *ConfigFirstAccessTokenProvider) GetAccessToken(ctx context.Context) (string, error) {
	token := strings.TrimSpace(p.configToken)
	if token != "" {
		return token, nil
	}
	if p.fallback == nil {
		return "", ErrAccessTokenEmpty
	}
	token, err := p.fallback.GetAccessToken(ctx)
	if err != nil {
		return "", fmt.Errorf("fallback provider failed: %w", err)
	}
	return token, nil
}

// RefreshAccessToken 强制刷新访问令牌；配置令牌存在时仍优先返回配置令牌。
func (p *ConfigFirstAccessTokenProvider) RefreshAccessToken(ctx context.Context) (string, error) {
	token := strings.TrimSpace(p.configToken)
	if token != "" {
		return token, nil
	}
	if p.fallback == nil {
		return "", ErrAccessTokenEmpty
	}
	if refresher, ok := p.fallback.(RefreshableAccessTokenProvider); ok {
		token, err := refresher.RefreshAccessToken(ctx)
		if err != nil {
			return "", fmt.Errorf("fallback refresh provider failed: %w", err)
		}
		return token, nil
	}

	token, err := p.fallback.GetAccessToken(ctx)
	if err != nil {
		return "", fmt.Errorf("fallback provider failed: %w", err)
	}
	return token, nil
}

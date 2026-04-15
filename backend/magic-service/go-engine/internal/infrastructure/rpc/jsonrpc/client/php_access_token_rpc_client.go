package client

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"

	"magic/internal/constants"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
	"magic/internal/pkg/jsoncompat"
)

// PHPAccessTokenRPCClient 获取 PHP 侧 MAGIC_ACCESS_TOKEN。
type PHPAccessTokenRPCClient struct {
	server                *unixsocket.Server
	logger                *logging.SugaredLogger
	mu                    sync.RWMutex
	token                 string
	isClientReady         func() bool
	callGetAccessTokenRPC func(ctx context.Context, result *magicAccessTokenResponse) error
}

var (
	// ErrMagicAccessTokenRPC 表示获取访问令牌的 RPC 调用失败。
	ErrMagicAccessTokenRPC = errors.New("magic access token rpc error")
	// ErrMagicAccessTokenEmpty 表示访问令牌为空。
	ErrMagicAccessTokenEmpty = errors.New("magic access token is empty")
)

// magicAccessTokenResponse PHP RPC 返回结构。
type magicAccessTokenResponse struct {
	Code    int                  `json:"code"`
	Message string               `json:"message"`
	Data    magicAccessTokenData `json:"data"`
}

type magicAccessTokenData map[string]string

func (d *magicAccessTokenData) UnmarshalJSON(data []byte) error {
	decoded := map[string]string{}
	if err := jsoncompat.UnmarshalObjectOrEmpty(data, map[string]string{}, &decoded); err != nil {
		return fmt.Errorf("decode magic access token data: %w", err)
	}
	*d = magicAccessTokenData(decoded)
	return nil
}

// NewPHPAccessTokenRPCClient 创建新的 RPC 客户端。
func NewPHPAccessTokenRPCClient(server *unixsocket.Server, logger *logging.SugaredLogger) *PHPAccessTokenRPCClient {
	return &PHPAccessTokenRPCClient{
		server:        server,
		logger:        logger,
		isClientReady: func() bool { return server != nil && server.GetRPCClientCount() > 0 },
		callGetAccessTokenRPC: func(ctx context.Context, result *magicAccessTokenResponse) error {
			return unixsocket.CallRPCTypedWithContext(ctx, server, constants.MethodModelGatewayAccessTokenGet, map[string]any{}, result)
		},
	}
}

// GetAccessToken 通过 IPC 获取 MAGIC_ACCESS_TOKEN。
func (p *PHPAccessTokenRPCClient) GetAccessToken(ctx context.Context) (string, error) {
	return p.fetchAccessToken(ctx, true)
}

// RefreshAccessToken 强制绕过缓存刷新 MAGIC_ACCESS_TOKEN。
func (p *PHPAccessTokenRPCClient) RefreshAccessToken(ctx context.Context) (string, error) {
	return p.fetchAccessToken(ctx, false)
}

func (p *PHPAccessTokenRPCClient) fetchAccessToken(ctx context.Context, useCache bool) (string, error) {
	if p == nil {
		return "", ErrNoClientConnected
	}
	if token, ok := p.cachedTokenIfAllowed(useCache); ok {
		return token, nil
	}
	if p.isClientReady == nil || !p.isClientReady() {
		return "", ErrNoClientConnected
	}

	result, err := p.callAccessTokenRPC(ctx)
	if err != nil {
		return p.fallbackTokenOrErr(useCache, fmt.Errorf("magic access token rpc failed: %w", err))
	}

	if result.Code != 0 {
		return p.fallbackTokenOrErr(useCache, fmt.Errorf("%w: code=%d message=%s", ErrMagicAccessTokenRPC, result.Code, result.Message))
	}

	token := strings.TrimSpace(readMapValue(map[string]string(result.Data), "access_token", "accessToken"))
	if token == "" {
		return p.fallbackTokenOrErr(useCache, ErrMagicAccessTokenEmpty)
	}

	p.setToken(token)

	return token, nil
}

func (p *PHPAccessTokenRPCClient) cachedTokenIfAllowed(useCache bool) (string, bool) {
	if !useCache {
		return "", false
	}
	return p.cachedToken()
}

func (p *PHPAccessTokenRPCClient) fallbackTokenOrErr(useCache bool, err error) (string, error) {
	if token, ok := p.cachedTokenIfAllowed(useCache); ok {
		return token, nil
	}
	return "", err
}

func (p *PHPAccessTokenRPCClient) callAccessTokenRPC(ctx context.Context) (magicAccessTokenResponse, error) {
	var result magicAccessTokenResponse
	if err := p.callGetAccessTokenRPC(ctx, &result); err != nil {
		if p.logger != nil {
			p.logger.ErrorContext(ctx, "获取 MAGIC_ACCESS_TOKEN 失败", "error", err)
		}
		return magicAccessTokenResponse{}, err
	}
	return result, nil
}

func (p *PHPAccessTokenRPCClient) cachedToken() (string, bool) {
	if p == nil {
		return "", false
	}
	p.mu.RLock()
	defer p.mu.RUnlock()
	if p.token == "" {
		return "", false
	}
	return p.token, true
}

func (p *PHPAccessTokenRPCClient) setToken(token string) {
	if p == nil {
		return
	}
	p.mu.Lock()
	p.token = token
	p.mu.Unlock()
}

func readMapValue(values map[string]string, keys ...string) string {
	if len(values) == 0 {
		return ""
	}
	for _, key := range keys {
		if value, ok := values[key]; ok {
			return value
		}
	}
	return ""
}

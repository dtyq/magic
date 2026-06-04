package client

import (
	"context"
	"fmt"
	"strings"

	"magic/internal/constants"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
	"magic/internal/pkg/webauth"
)

// PHPWebAuthRPCClient 通过 IPC 调 PHP 复用 WebAuth 登录态鉴权。
type PHPWebAuthRPCClient struct {
	server              *unixsocket.Server
	logger              *logging.SugaredLogger
	isClientReady       func() bool
	callAuthenticateRPC func(ctx context.Context, request webAuthRequest, out *webAuthResponse) error
}

type webAuthRequest struct {
	Authorization    string `json:"authorization"`
	OrganizationCode string `json:"organization_code"`
}

type webAuthResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    webAuthData `json:"data"`
}

type webAuthData struct {
	UserID           string `json:"user_id"`
	MagicID          string `json:"magic_id"`
	OrganizationCode string `json:"organization_code"`
	MagicEnvID       int    `json:"magic_env_id"`
}

// NewPHPWebAuthRPCClient 创建 PHP WebAuth RPC 客户端。
func NewPHPWebAuthRPCClient(server *unixsocket.Server, logger *logging.SugaredLogger) *PHPWebAuthRPCClient {
	return &PHPWebAuthRPCClient{
		server:        server,
		logger:        logger,
		isClientReady: func() bool { return server != nil && server.GetRPCClientCount() > 0 },
		callAuthenticateRPC: func(ctx context.Context, request webAuthRequest, out *webAuthResponse) error {
			return unixsocket.CallRPCTypedWithContext(ctx, server, constants.MethodAuthWebAuthAuthenticate, request, out)
		},
	}
}

// Authenticate 校验 Web 登录态。
func (c *PHPWebAuthRPCClient) Authenticate(ctx context.Context, request webauth.Request) (webauth.User, error) {
	if c == nil {
		return webauth.User{}, webauth.ErrUnavailable
	}
	if c.isClientReady == nil || !c.isClientReady() {
		return webauth.User{}, fmt.Errorf("%w: %w", webauth.ErrUnavailable, ErrNoClientConnected)
	}

	rpcRequest := webAuthRequest{
		Authorization:    strings.TrimSpace(request.Authorization),
		OrganizationCode: strings.TrimSpace(request.OrganizationCode),
	}
	var result webAuthResponse
	if err := c.callAuthenticateRPC(ctx, rpcRequest, &result); err != nil {
		if c.logger != nil {
			c.logger.ErrorContext(ctx, "WebAuth IPC 调用失败", "error", err)
		}
		return webauth.User{}, fmt.Errorf("%w: %w", webauth.ErrUnavailable, err)
	}
	if result.Code != 0 {
		if isUnauthorizedCode(result.Code) {
			return webauth.User{}, fmt.Errorf("%w: code=%d message=%s", webauth.ErrUnauthorized, result.Code, result.Message)
		}
		return webauth.User{}, fmt.Errorf("%w: code=%d message=%s", webauth.ErrUnavailable, result.Code, result.Message)
	}

	user := webauth.User{
		UserID:           strings.TrimSpace(result.Data.UserID),
		MagicID:          strings.TrimSpace(result.Data.MagicID),
		OrganizationCode: strings.TrimSpace(result.Data.OrganizationCode),
		MagicEnvID:       result.Data.MagicEnvID,
	}
	if user.UserID == "" || user.OrganizationCode == "" {
		return webauth.User{}, fmt.Errorf("%w: empty user data", webauth.ErrUnauthorized)
	}
	return user, nil
}

func isUnauthorizedCode(code int) bool {
	return code == httpStatusUnauthorized || code == httpStatusForbidden
}

const (
	httpStatusUnauthorized = 401
	httpStatusForbidden    = 403
)

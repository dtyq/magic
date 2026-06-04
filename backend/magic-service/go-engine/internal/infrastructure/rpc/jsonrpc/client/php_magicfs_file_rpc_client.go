package client

import (
	"context"
	"errors"
	"fmt"

	"magic/internal/constants"
	"magic/internal/domain/magicfs"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
)

// PHPMagicFSFileRPCClient 通过 IPC 调用 PHP MagicFS 文件服务。
type PHPMagicFSFileRPCClient struct {
	server            *unixsocket.Server
	logger            *logging.SugaredLogger
	callAuthorize     func(context.Context, map[string]any, *magicFSFileAuthorizeResponse) error
	isClientConnected func() bool
	authorizeHook     func(context.Context, map[string]any) (code int, message string, err error)
}

type magicFSFileAuthorizeResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		FileID string `json:"file_id"`
	} `json:"data"`
}

// NewPHPMagicFSFileRPCClient 创建 PHP MagicFS 文件 RPC 客户端。
func NewPHPMagicFSFileRPCClient(server *unixsocket.Server, logger *logging.SugaredLogger) *PHPMagicFSFileRPCClient {
	client := &PHPMagicFSFileRPCClient{
		server: server,
		logger: logger,
	}
	client.callAuthorize = func(ctx context.Context, params map[string]any, out *magicFSFileAuthorizeResponse) error {
		return unixsocket.CallRPCTypedWithContext(ctx, server, constants.MethodMagicFSFileAuthorizeFileViewer, params, out)
	}
	client.isClientConnected = func() bool {
		return server != nil && server.GetRPCClientCount() > 0
	}
	return client
}

// SetAuthorizeHookForTest 设置 authorize 测试钩子。
func (c *PHPMagicFSFileRPCClient) SetAuthorizeHookForTest(
	fn func(context.Context, map[string]any) (code int, message string, err error),
) {
	c.authorizeHook = fn
}

// SetConnectedHookForTest 设置连接状态测试钩子。
func (c *PHPMagicFSFileRPCClient) SetConnectedHookForTest(fn func() bool) {
	c.isClientConnected = fn
}

// AuthorizeFileViewer 校验当前请求用户对 MagicFS 文件具备 viewer 权限。
func (c *PHPMagicFSFileRPCClient) AuthorizeFileViewer(
	ctx context.Context,
	headers map[string][]string,
	fileID string,
) error {
	if !c.connected() {
		return fmt.Errorf("%w: %w", magicfs.ErrAuthorizationUnavailable, ErrNoClientConnected)
	}

	params := map[string]any{
		"headers": headers,
		"file_id": fileID,
	}
	result, err := c.requestAuthorize(ctx, params, fileID)
	if err != nil {
		return err
	}
	if result.Code != 0 {
		return &magicfs.BusinessError{
			Code:    result.Code,
			Message: result.Message,
		}
	}
	return nil
}

func (c *PHPMagicFSFileRPCClient) connected() bool {
	return c != nil && c.isClientConnected != nil && c.isClientConnected()
}

func (c *PHPMagicFSFileRPCClient) requestAuthorize(
	ctx context.Context,
	params map[string]any,
	fileID string,
) (*magicFSFileAuthorizeResponse, error) {
	result := &magicFSFileAuthorizeResponse{}
	if c.authorizeHook != nil {
		code, message, err := c.authorizeHook(ctx, params)
		if err != nil {
			return nil, errors.Join(magicfs.ErrAuthorizationUnavailable, ErrPHPRequestFailed, err)
		}
		result.Code = code
		result.Message = message
		return result, nil
	}
	if err := c.callAuthorize(ctx, params, result); err != nil {
		if c.logger != nil {
			c.logger.ErrorContext(ctx, "调用 PHP MagicFS 文件鉴权失败", "file_id", fileID, "error", err)
		}
		return nil, errors.Join(magicfs.ErrAuthorizationUnavailable, fmt.Errorf("%w: %w", ErrPHPRequestFailed, err))
	}
	return result, nil
}

package client

import (
	"context"
	"errors"
	"fmt"

	"magic/internal/constants"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
)

const (
	// PermissionResourceTypeKnowledge 与 PHP ResourceType::Knowledge 对齐。
	PermissionResourceTypeKnowledge = 4
)

// PHPOperationPermissionRPCClient 通过 IPC 调用 PHP 权限服务。
type PHPOperationPermissionRPCClient struct {
	server             *unixsocket.Server
	logger             *logging.SugaredLogger
	isClientReady      func() bool
	callAccessOwnerRPC func(context.Context, map[string]any, *operationPermissionRPCResponse[any]) error
	callDeleteRPC      func(context.Context, map[string]any, *operationPermissionRPCResponse[any]) error
}

type operationPermissionRPCResponse[T any] struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    T      `json:"data"`
}

// NewPHPOperationPermissionRPCClient 创建 PHP 权限 RPC 客户端。
func NewPHPOperationPermissionRPCClient(
	server *unixsocket.Server,
	logger *logging.SugaredLogger,
) *PHPOperationPermissionRPCClient {
	return &PHPOperationPermissionRPCClient{
		server:        server,
		logger:        logger,
		isClientReady: func() bool { return server != nil && server.GetRPCClientCount() > 0 },
		callAccessOwnerRPC: func(ctx context.Context, params map[string]any, out *operationPermissionRPCResponse[any]) error {
			return unixsocket.CallRPCTypedWithContext(ctx, server, constants.MethodPermissionOperationAccessOwner, params, out)
		},
		callDeleteRPC: func(ctx context.Context, params map[string]any, out *operationPermissionRPCResponse[any]) error {
			return unixsocket.CallRPCTypedWithContext(ctx, server, constants.MethodPermissionOperationDeleteByResource, params, out)
		},
	}
}

// GrantKnowledgeBaseOwner 显式授予知识库 owner 权限。
func (c *PHPOperationPermissionRPCClient) GrantKnowledgeBaseOwner(
	ctx context.Context,
	organizationCode string,
	currentUserID string,
	knowledgeBaseCode string,
	ownerUserID string,
) error {
	if c == nil || c.isClientReady == nil || !c.isClientReady() {
		return ErrNoClientConnected
	}

	params := map[string]any{
		"organization_code": organizationCode,
		"current_user_id":   currentUserID,
		"resource_type":     PermissionResourceTypeKnowledge,
		"resource_id":       knowledgeBaseCode,
		"owner_user_id":     ownerUserID,
	}

	var result operationPermissionRPCResponse[any]
	if err := c.callAccessOwnerRPC(ctx, params, &result); err != nil {
		if c.logger != nil {
			c.logger.ErrorContext(ctx, "调用 PHP owner 授权失败", "knowledge_base_code", knowledgeBaseCode, "error", err)
		}
		return errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		return fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}
	return nil
}

// DeleteKnowledgeBasePermissions 删除知识库资源权限。
func (c *PHPOperationPermissionRPCClient) DeleteKnowledgeBasePermissions(
	ctx context.Context,
	organizationCode string,
	currentUserID string,
	knowledgeBaseCode string,
) error {
	if c == nil || c.isClientReady == nil || !c.isClientReady() {
		return ErrNoClientConnected
	}

	params := map[string]any{
		"organization_code": organizationCode,
		"current_user_id":   currentUserID,
		"resource_type":     PermissionResourceTypeKnowledge,
		"resource_id":       knowledgeBaseCode,
	}

	var result operationPermissionRPCResponse[any]
	if err := c.callDeleteRPC(ctx, params, &result); err != nil {
		if c.logger != nil {
			c.logger.ErrorContext(ctx, "调用 PHP 删除知识库权限失败", "knowledge_base_code", knowledgeBaseCode, "error", err)
		}
		return errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		return fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}
	return nil
}

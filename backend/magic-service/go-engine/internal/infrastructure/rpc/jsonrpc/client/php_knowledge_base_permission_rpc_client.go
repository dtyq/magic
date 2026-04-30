package client

import (
	"context"
	"errors"
	"fmt"
	"maps"

	"magic/internal/constants"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
	"magic/internal/pkg/jsoncompat"
)

type knowledgeBasePermissionRPCResponse[T any] struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    T      `json:"data"`
}

type knowledgeBasePermissionOperations map[string]string

func (o *knowledgeBasePermissionOperations) UnmarshalJSON(data []byte) error {
	decoded := map[string]string{}
	if err := jsoncompat.UnmarshalObjectOrEmpty(data, map[string]string{}, &decoded); err != nil {
		return fmt.Errorf("decode knowledge base permission operations: %w", err)
	}
	*o = knowledgeBasePermissionOperations(decoded)
	return nil
}

type knowledgeBasePermissionOperationsData struct {
	Operations knowledgeBasePermissionOperations `json:"operations"`
}

type knowledgeBasePermissionOfficialOrganizationData struct {
	IsOfficialMember bool `json:"is_official_member"`
}

// PHPKnowledgeBasePermissionRPCClient 通过 IPC 调用 PHP 知识库权限只读能力。
type PHPKnowledgeBasePermissionRPCClient struct {
	server *unixsocket.Server
	logger *logging.SugaredLogger
}

// NewPHPKnowledgeBasePermissionRPCClient 创建知识库权限 RPC 客户端。
func NewPHPKnowledgeBasePermissionRPCClient(server *unixsocket.Server, logger *logging.SugaredLogger) *PHPKnowledgeBasePermissionRPCClient {
	return &PHPKnowledgeBasePermissionRPCClient{
		server: server,
		logger: logger,
	}
}

// ListOperations 批量列出当前用户对知识库的最高权限操作。
func (c *PHPKnowledgeBasePermissionRPCClient) ListOperations(
	ctx context.Context,
	organizationCode string,
	userID string,
	knowledgeCodes []string,
) (map[string]string, error) {
	if c == nil || c.server == nil || c.server.GetRPCClientCount() == 0 {
		return nil, ErrNoClientConnected
	}

	var result knowledgeBasePermissionRPCResponse[knowledgeBasePermissionOperationsData]
	if err := unixsocket.CallRPCTypedWithContext(ctx, c.server, constants.MethodKnowledgeBasePermissionListOperations, map[string]any{
		"data_isolation": map[string]any{
			"organization_code": organizationCode,
			"user_id":           userID,
		},
		"knowledge_codes": knowledgeCodes,
	}, &result); err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(ctx, "调用 PHP 知识库权限查询失败", "organization_code", organizationCode, "user_id", userID, "knowledge_codes", knowledgeCodes, "error", err)
		}
		return nil, errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		return nil, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}

	if result.Data.Operations == nil {
		return map[string]string{}, nil
	}
	return map[string]string(result.Data.Operations), nil
}

// IsOfficialOrganizationMember 校验组织是否为官方组织。
func (c *PHPKnowledgeBasePermissionRPCClient) IsOfficialOrganizationMember(
	ctx context.Context,
	organizationCode string,
) (bool, error) {
	if c == nil || c.server == nil || c.server.GetRPCClientCount() == 0 {
		return false, ErrNoClientConnected
	}

	var result knowledgeBasePermissionRPCResponse[knowledgeBasePermissionOfficialOrganizationData]
	if err := unixsocket.CallRPCTypedWithContext(ctx, c.server, constants.MethodKnowledgeBasePermissionCheckOfficialOrganizationMember, map[string]any{
		"data_isolation": map[string]any{
			"organization_code": organizationCode,
		},
	}, &result); err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(ctx, "调用 PHP 官方组织校验失败", "organization_code", organizationCode, "error", err)
		}
		return false, errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		return false, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}

	return result.Data.IsOfficialMember, nil
}

// Initialize 初始化知识库 owner/admin 权限。
func (c *PHPKnowledgeBasePermissionRPCClient) Initialize(
	ctx context.Context,
	organizationCode string,
	currentUserID string,
	payload map[string]any,
) error {
	if c == nil || c.server == nil || c.server.GetRPCClientCount() == 0 {
		return ErrNoClientConnected
	}

	params := map[string]any{
		"data_isolation": map[string]any{
			"organization_code": organizationCode,
			"user_id":           currentUserID,
		},
	}
	maps.Copy(params, payload)

	knowledgeBaseCode, _ := payload["knowledge_base_code"].(string)
	var result knowledgeBasePermissionRPCResponse[any]
	if err := unixsocket.CallRPCTypedWithContext(ctx, c.server, constants.MethodKnowledgeBasePermissionInitialize, params, &result); err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(ctx, "调用 PHP 知识库权限初始化失败", "organization_code", organizationCode, "current_user_id", currentUserID, "knowledge_base_code", knowledgeBaseCode, "error", err)
		}
		return errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		return fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}
	return nil
}

// GrantOwner 显式授予知识库 owner 权限。
func (c *PHPKnowledgeBasePermissionRPCClient) GrantOwner(
	ctx context.Context,
	organizationCode string,
	currentUserID string,
	knowledgeBaseCode string,
	ownerUserID string,
) error {
	if c == nil || c.server == nil || c.server.GetRPCClientCount() == 0 {
		return ErrNoClientConnected
	}

	var result knowledgeBasePermissionRPCResponse[any]
	if err := unixsocket.CallRPCTypedWithContext(ctx, c.server, constants.MethodKnowledgeBasePermissionGrantOwner, map[string]any{
		"data_isolation": map[string]any{
			"organization_code": organizationCode,
			"user_id":           currentUserID,
		},
		"knowledge_base_code": knowledgeBaseCode,
		"owner_user_id":       ownerUserID,
	}, &result); err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(ctx, "调用 PHP 知识库 owner 授权失败", "organization_code", organizationCode, "current_user_id", currentUserID, "knowledge_base_code", knowledgeBaseCode, "error", err)
		}
		return errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		return fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}
	return nil
}

// Cleanup 删除知识库资源权限。
func (c *PHPKnowledgeBasePermissionRPCClient) Cleanup(
	ctx context.Context,
	organizationCode string,
	currentUserID string,
	knowledgeBaseCode string,
) error {
	if c == nil || c.server == nil || c.server.GetRPCClientCount() == 0 {
		return ErrNoClientConnected
	}

	var result knowledgeBasePermissionRPCResponse[any]
	if err := unixsocket.CallRPCTypedWithContext(ctx, c.server, constants.MethodKnowledgeBasePermissionCleanup, map[string]any{
		"data_isolation": map[string]any{
			"organization_code": organizationCode,
			"user_id":           currentUserID,
		},
		"knowledge_base_code": knowledgeBaseCode,
	}, &result); err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(ctx, "调用 PHP 知识库权限清理失败", "organization_code", organizationCode, "current_user_id", currentUserID, "knowledge_base_code", knowledgeBaseCode, "error", err)
		}
		return errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		return fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}
	return nil
}

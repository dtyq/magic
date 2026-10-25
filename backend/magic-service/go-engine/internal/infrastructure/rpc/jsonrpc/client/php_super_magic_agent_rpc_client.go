package client

import (
	"context"
	"errors"
	"fmt"

	"magic/internal/constants"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
)

type superMagicAgentRPCResponse[T any] struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    T      `json:"data"`
}

type superMagicAgentManageableCodesData struct {
	ManageableCodes []string `json:"manageable_codes"`
	MissingCodes    []string `json:"missing_codes"`
}

type superMagicAgentAccessibleCodesData struct {
	AccessibleCodes    []string          `json:"accessible_codes"`
	MissingCodes       []string          `json:"missing_codes"`
	AgentOrganizations map[string]string `json:"agent_organizations"`
}

type superMagicAgentUsableCodesData struct {
	UsableCodes  []string `json:"usable_codes"`
	MissingCodes []string `json:"missing_codes"`
}

type superMagicAgentListCodesRequest struct {
	method       string
	logMessage   string
	organization string
	userID       string
	agentCodes   []string
}

// PHPSuperMagicAgentRPCClient 通过 IPC 调用 PHP/super-magic 数字员工只读能力。
type PHPSuperMagicAgentRPCClient struct {
	server *unixsocket.Server
	logger *logging.SugaredLogger
}

// NewPHPSuperMagicAgentRPCClient 创建数字员工 RPC 客户端。
func NewPHPSuperMagicAgentRPCClient(server *unixsocket.Server, logger *logging.SugaredLogger) *PHPSuperMagicAgentRPCClient {
	return &PHPSuperMagicAgentRPCClient{
		server: server,
		logger: logger,
	}
}

// ListManageableCodes 列出当前用户在指定组织下可管理的数字员工编码。
func (c *PHPSuperMagicAgentRPCClient) ListManageableCodes(
	ctx context.Context,
	organizationCode string,
	userID string,
	codes []string,
) (map[string]struct{}, error) {
	return listSuperMagicAgentCodes(
		ctx,
		c.server,
		c.logger,
		superMagicAgentListCodesRequest{
			method:       constants.MethodKnowledgeSuperMagicAgentListManageableCodes,
			logMessage:   "调用 PHP 数字员工可管理校验失败",
			organization: organizationCode,
			userID:       userID,
			agentCodes:   codes,
		},
		func(data superMagicAgentManageableCodesData) []string { return data.ManageableCodes },
	)
}

// ListAccessibleCodes 列出当前用户在指定组织下可访问的数字员工编码。
func (c *PHPSuperMagicAgentRPCClient) ListAccessibleCodes(
	ctx context.Context,
	organizationCode string,
	userID string,
	codes []string,
) (map[string]struct{}, error) {
	return listSuperMagicAgentCodes(
		ctx,
		c.server,
		c.logger,
		superMagicAgentListCodesRequest{
			method:       constants.MethodKnowledgeSuperMagicAgentListAccessibleCodes,
			logMessage:   "调用 PHP 数字员工可访问校验失败",
			organization: organizationCode,
			userID:       userID,
			agentCodes:   codes,
		},
		func(data superMagicAgentAccessibleCodesData) []string { return data.AccessibleCodes },
	)
}

// ListAccessibleContexts 返回当前用户可访问的数字员工及其资源所属组织。
func (c *PHPSuperMagicAgentRPCClient) ListAccessibleContexts(
	ctx context.Context,
	organizationCode string,
	userID string,
	codes []string,
) (map[string]string, error) {
	if c.server == nil || c.server.GetRPCClientCount() == 0 {
		return nil, ErrNoClientConnected
	}

	var result superMagicAgentRPCResponse[superMagicAgentAccessibleCodesData]
	if err := unixsocket.CallRPCTypedWithContext(ctx, c.server, constants.MethodKnowledgeSuperMagicAgentListAccessibleCodes, map[string]any{
		"data_isolation": map[string]any{
			"organization_code": organizationCode,
			"user_id":           userID,
		},
		"agent_codes": codes,
	}, &result); err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(ctx, "调用 PHP 数字员工可访问上下文失败", "organization_code", organizationCode, "user_id", userID, "agent_codes", codes, "error", err)
		}
		return nil, errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		return nil, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}
	return result.Data.AgentOrganizations, nil
}

// ListUsableCodes 列出当前用户在指定组织下可使用的数字员工编码。
func (c *PHPSuperMagicAgentRPCClient) ListUsableCodes(
	ctx context.Context,
	organizationCode string,
	userID string,
	codes []string,
) (map[string]struct{}, error) {
	return listSuperMagicAgentCodes(
		ctx,
		c.server,
		c.logger,
		superMagicAgentListCodesRequest{
			method:       constants.MethodKnowledgeSuperMagicAgentListUsableCodes,
			logMessage:   "调用 PHP 数字员工可用校验失败",
			organization: organizationCode,
			userID:       userID,
			agentCodes:   codes,
		},
		func(data superMagicAgentUsableCodesData) []string { return data.UsableCodes },
	)
}

func listSuperMagicAgentCodes[T any](
	ctx context.Context,
	server *unixsocket.Server,
	logger *logging.SugaredLogger,
	request superMagicAgentListCodesRequest,
	codeExtractor func(T) []string,
) (map[string]struct{}, error) {
	if server == nil || server.GetRPCClientCount() == 0 {
		return nil, ErrNoClientConnected
	}

	var result superMagicAgentRPCResponse[T]
	if err := unixsocket.CallRPCTypedWithContext(ctx, server, request.method, map[string]any{
		"data_isolation": map[string]any{
			"organization_code": request.organization,
			"user_id":           request.userID,
		},
		"agent_codes": request.agentCodes,
	}, &result); err != nil {
		if logger != nil {
			logger.KnowledgeErrorContext(ctx, request.logMessage, "organization_code", request.organization, "user_id", request.userID, "agent_codes", request.agentCodes, "error", err)
		}
		return nil, errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		return nil, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}

	values := codeExtractor(result.Data)
	resultCodes := make(map[string]struct{}, len(values))
	for _, agentCode := range values {
		resultCodes[agentCode] = struct{}{}
	}
	return resultCodes, nil
}

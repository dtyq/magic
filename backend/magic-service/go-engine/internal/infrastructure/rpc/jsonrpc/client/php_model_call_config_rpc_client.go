package client

import (
	"context"
	"fmt"
	"strings"

	"magic/internal/constants"
	document "magic/internal/domain/knowledge/document/metadata"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
)

// PHPModelCallConfigRPCClient 通过 IPC 获取通用模型调用配置。
type PHPModelCallConfigRPCClient struct {
	server           *unixsocket.Server
	logger           *logging.SugaredLogger
	isClientReady    func() bool
	callGetConfigRPC func(ctx context.Context, request modelCallConfigRequest, out *modelCallConfigResponse) error
}

type modelCallConfigRequest struct {
	OrganizationCode string `json:"organization_code"`
	ModelID          string `json:"model_id"`
	ModelType        string `json:"model_type"`
}

type modelCallConfigResponse struct {
	Code    int                 `json:"code"`
	Message string              `json:"message"`
	Data    modelCallConfigData `json:"data"`
}

type modelCallConfigData struct {
	ModelID        string         `json:"model_id"`
	Model          string         `json:"model"`
	ProviderCode   string         `json:"provider_code"`
	RequestBaseURL string         `json:"request_base_url"`
	AccessToken    string         `json:"access_token"`
	RawConfig      map[string]any `json:"raw_config"`
}

// ModelCallConfigRequestForTest 暴露模型调用配置请求供外部测试使用。
type ModelCallConfigRequestForTest = modelCallConfigRequest

// ModelCallConfigDataForTest 暴露模型调用配置响应数据供外部测试使用。
type ModelCallConfigDataForTest = modelCallConfigData

// NewPHPModelCallConfigRPCClient 创建模型调用配置 RPC 客户端。
func NewPHPModelCallConfigRPCClient(server *unixsocket.Server, logger *logging.SugaredLogger) *PHPModelCallConfigRPCClient {
	return &PHPModelCallConfigRPCClient{
		server:        server,
		logger:        logger,
		isClientReady: func() bool { return server != nil && server.GetRPCClientCount() > 0 },
		callGetConfigRPC: func(ctx context.Context, request modelCallConfigRequest, out *modelCallConfigResponse) error {
			return unixsocket.CallRPCTypedWithContext(ctx, server, constants.MethodModelGatewayModelConfigGet, request, out)
		},
	}
}

// GetConfig 获取指定模型的调用配置。
func (c *PHPModelCallConfigRPCClient) GetConfig(ctx context.Context, organizationCode, modelID, modelType string) (document.ModelCallConfig, error) {
	return c.fetchConfig(ctx, organizationCode, modelID, modelType)
}

// GetVisualModelCallConfig 获取知识库视觉理解使用的模型调用配置。
func (c *PHPModelCallConfigRPCClient) GetVisualModelCallConfig(
	ctx context.Context,
	organizationCode string,
	modelID string,
	modelType string,
) (document.ModelCallConfig, error) {
	return c.fetchConfig(ctx, organizationCode, modelID, modelType)
}

func (c *PHPModelCallConfigRPCClient) fetchConfig(
	ctx context.Context,
	organizationCode string,
	modelID string,
	modelType string,
) (document.ModelCallConfig, error) {
	if c == nil {
		return document.ModelCallConfig{}, ErrNoClientConnected
	}
	if c.isClientReady == nil || !c.isClientReady() {
		return document.ModelCallConfig{}, ErrNoClientConnected
	}

	var result modelCallConfigResponse
	request := modelCallConfigRequest{
		OrganizationCode: strings.TrimSpace(organizationCode),
		ModelID:          strings.TrimSpace(modelID),
		ModelType:        strings.TrimSpace(modelType),
	}
	if err := c.callGetConfigRPC(ctx, request, &result); err != nil {
		if c.logger != nil {
			c.logger.ErrorContext(ctx, "获取模型调用配置失败", "error", err, "model_id", request.ModelID, "model_type", request.ModelType)
		}
		return document.ModelCallConfig{}, fmt.Errorf("%w: %w", ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		return document.ModelCallConfig{}, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}

	config := document.ModelCallConfig{
		ModelID:        strings.TrimSpace(result.Data.ModelID),
		Model:          strings.TrimSpace(result.Data.Model),
		ProviderCode:   strings.TrimSpace(result.Data.ProviderCode),
		AccessToken:    strings.TrimSpace(result.Data.AccessToken),
		RequestBaseURL: strings.TrimSpace(result.Data.RequestBaseURL),
		RawConfig:      result.Data.RawConfig,
	}
	if config.Model == "" || config.RequestBaseURL == "" {
		return document.ModelCallConfig{}, fmt.Errorf("%w: incomplete model call config", ErrPHPRequestFailed)
	}
	return config, nil
}

// SetModelCallConfigClientReadyFuncForTest 替换模型调用配置客户端连接状态判断逻辑。
func (c *PHPModelCallConfigRPCClient) SetModelCallConfigClientReadyFuncForTest(fn func() bool) {
	if c == nil || fn == nil {
		return
	}
	c.isClientReady = fn
}

// SetCallModelCallConfigRPCForTest 替换模型调用配置 RPC 调用逻辑。
func (c *PHPModelCallConfigRPCClient) SetCallModelCallConfigRPCForTest(
	fn func(context.Context, ModelCallConfigRequestForTest, *RPCResultForTest[ModelCallConfigDataForTest]) error,
) {
	if c == nil || fn == nil {
		return
	}
	c.callGetConfigRPC = func(ctx context.Context, request modelCallConfigRequest, out *modelCallConfigResponse) error {
		testOut := &RPCResultForTest[ModelCallConfigDataForTest]{
			Code:    out.Code,
			Message: out.Message,
			Data:    out.Data,
		}
		if err := fn(ctx, request, testOut); err != nil {
			return err
		}
		out.Code = testOut.Code
		out.Message = testOut.Message
		out.Data = testOut.Data
		return nil
	}
}

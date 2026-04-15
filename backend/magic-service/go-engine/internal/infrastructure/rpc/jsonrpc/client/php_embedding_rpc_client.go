// Package client 提供 Go -> PHP 的 RPC 客户端实现（基于 IPC 传输）。
package client

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"golang.org/x/sync/errgroup"

	"magic/internal/constants"
	"magic/internal/domain/knowledge/embedding"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
	"magic/internal/pkg/ctxmeta"
)

// ErrPHPRequestFailed 当 PHP RPC 请求失败时返回。
var ErrPHPRequestFailed = errors.New("PHP RPC request failed")

// ErrNoClientConnected 当没有 PHP 客户端连接时返回。
var ErrNoClientConnected = errors.New("no PHP client connected")

var errAccessTokenRefreshUnsupported = errors.New("access token provider does not support refresh")

// AccessTokenProvider 提供模型网关调用所需的访问令牌。
type AccessTokenProvider interface {
	GetAccessToken(ctx context.Context) (string, error)
}

// AccessTokenRefresher 提供强制刷新 access token 的能力。
type AccessTokenRefresher interface {
	RefreshAccessToken(ctx context.Context) (string, error)
}

// RPCCaller 定义 RPC 调用接口（用于解耦 Server 依赖）。
type RPCCaller interface {
	CallRPC(method string, params any) (json.RawMessage, error)
	GetRPCClientCount() int
}

const (
	tokenNotExistCode               = 4000
	tokenExpiredCode                = 4005
	tokenDisabledCode               = 4019
	phpEmbeddingBatchMaxConcurrency = 3
)

// PHPEmbeddingRPCClient 通过 JSON-RPC over Unix Socket 调用 PHP 的嵌入客户端。
// Go 作为服务端，等待 PHP 连接后调用 PHP 的 embedding 方法。
type PHPEmbeddingRPCClient struct {
	server                    *unixsocket.Server
	logger                    *logging.SugaredLogger
	accessTokenProvider       AccessTokenProvider
	isClientReady             func() bool
	callEmbeddingComputeRPC   func(ctx context.Context, server *unixsocket.Server, params map[string]any, out *RPCResult[EmbeddingResult]) error
	callEmbeddingProvidersRPC func(ctx context.Context, server *unixsocket.Server, params map[string]any, out *RPCResult[[]*embedding.Provider]) error
}

// EmbeddingParams 嵌入请求参数。
type EmbeddingParams struct {
	Model          string          `json:"model"`
	Input          any             `json:"input"`
	BusinessParams *BusinessParams `json:"business_params,omitempty"`
}

// BusinessParams 业务参数。
type BusinessParams struct {
	OrganizationCode string `json:"organization_code,omitempty"`
	UserID           string `json:"user_id,omitempty"`
	BusinessID       string `json:"business_id,omitempty"`
}

// EmbeddingResult 嵌入结果。
type EmbeddingResult struct {
	Data []EmbeddingData `json:"data"`
}

// EmbeddingData 单个嵌入数据。
type EmbeddingData struct {
	Embedding []float64 `json:"embedding"`
	Index     int       `json:"index"`
}

// RPCResult 通用 RPC 返回结构（PHP 返回 envelope）。
type RPCResult[T any] struct {
	Code      int    `json:"code"`
	Message   string `json:"message"`
	ErrorCode int    `json:"error_code,omitempty"`
	Data      T      `json:"data"`
}

// NewPHPEmbeddingRPCClient 创建新的 PHP 嵌入客户端。
func NewPHPEmbeddingRPCClient(server *unixsocket.Server, logger *logging.SugaredLogger, accessTokenProvider AccessTokenProvider) *PHPEmbeddingRPCClient {
	return &PHPEmbeddingRPCClient{
		server:              server,
		logger:              logger,
		accessTokenProvider: accessTokenProvider,
		isClientReady:       func() bool { return server != nil && server.GetRPCClientCount() > 0 },
		callEmbeddingComputeRPC: func(ctx context.Context, server *unixsocket.Server, params map[string]any, out *RPCResult[EmbeddingResult]) error {
			return unixsocket.CallRPCTypedWithContext(ctx, server, constants.MethodModelGatewayEmbeddingCompute, params, out)
		},
		callEmbeddingProvidersRPC: func(ctx context.Context, server *unixsocket.Server, params map[string]any, out *RPCResult[[]*embedding.Provider]) error {
			return unixsocket.CallRPCTypedWithContext(ctx, server, constants.MethodModelGatewayEmbeddingProvidersList, params, out)
		},
	}
}

// GetEmbedding 获取单个文本的嵌入向量。
func (c *PHPEmbeddingRPCClient) GetEmbedding(ctx context.Context, input, model string, businessParams *ctxmeta.BusinessParams) ([]float64, error) {
	if c.isClientReady == nil || !c.isClientReady() {
		return nil, ErrNoClientConnected
	}

	return c.computeSingleEmbedding(ctx, input, model, businessParams)
}

// GetBatchEmbeddings 批量获取嵌入向量。
func (c *PHPEmbeddingRPCClient) GetBatchEmbeddings(ctx context.Context, inputs []string, model string, businessParams *ctxmeta.BusinessParams) ([][]float64, error) {
	if c.isClientReady == nil || !c.isClientReady() {
		return nil, ErrNoClientConnected
	}
	if ctx == nil {
		return nil, embedding.ErrNilContext
	}

	embeddings := make([][]float64, len(inputs))
	if len(inputs) == 0 {
		return embeddings, nil
	}

	group, groupCtx := errgroup.WithContext(ctx)
	group.SetLimit(phpEmbeddingBatchMaxConcurrency)

	for i, input := range inputs {
		group.Go(func() error {
			embedding, err := c.computeSingleEmbedding(groupCtx, input, model, businessParams)
			if err != nil {
				return fmt.Errorf("compute embedding at index %d: %w", i, err)
			}
			embeddings[i] = embedding
			return nil
		})
	}
	if err := group.Wait(); err != nil {
		return nil, fmt.Errorf("wait batch embedding tasks: %w", err)
	}
	return embeddings, nil
}

func (c *PHPEmbeddingRPCClient) computeSingleEmbedding(
	ctx context.Context,
	input string,
	model string,
	businessParams *ctxmeta.BusinessParams,
) ([]float64, error) {
	rpcParams := map[string]any{
		"model": model,
		"input": input,
	}
	applyBusinessParams(rpcParams, businessParams)
	attachAccessToken(ctx, rpcParams, c.accessTokenProvider, c.logger)

	result, err := executeRPCWithAuthRetry(ctx, rpcAuthRetryOptions[EmbeddingResult]{
		params:    rpcParams,
		provider:  c.accessTokenProvider,
		logger:    c.logger,
		refresh:   c.refreshAccessToken,
		operation: "embedding compute",
		call: func(params map[string]any, out *RPCResult[EmbeddingResult]) error {
			return c.callEmbeddingComputeRPC(ctx, c.server, params, out)
		},
	})
	if err != nil {
		return nil, err
	}

	for _, item := range result.Data.Data {
		if item.Index != 0 {
			continue
		}
		return item.Embedding, nil
	}
	return []float64{}, nil
}

// SetAccessToken 设置访问令牌（PHP RPC 不需要，保持接口兼容）。
func (c *PHPEmbeddingRPCClient) SetAccessToken(_ string) {
	// PHP RPC 不需要 access token
}

// ListProviders 获取嵌入模型提供商列表。
func (c *PHPEmbeddingRPCClient) ListProviders(ctx context.Context, businessParams *ctxmeta.BusinessParams) ([]*embedding.Provider, error) {
	if c.isClientReady == nil || !c.isClientReady() {
		return nil, ErrNoClientConnected
	}

	params := map[string]any{}
	applyBusinessParams(params, businessParams)
	attachAccessToken(ctx, params, c.accessTokenProvider, c.logger)

	result, err := executeRPCWithAuthRetry(ctx, rpcAuthRetryOptions[[]*embedding.Provider]{
		params:    params,
		provider:  c.accessTokenProvider,
		logger:    c.logger,
		refresh:   c.refreshAccessToken,
		operation: "embedding providers",
		call: func(callParams map[string]any, out *RPCResult[[]*embedding.Provider]) error {
			return c.callEmbeddingProvidersRPC(ctx, c.server, callParams, out)
		},
	})
	if err != nil {
		return nil, err
	}
	return result.Data, nil
}

func applyBusinessParams(params map[string]any, businessParams *ctxmeta.BusinessParams) {
	if businessParams == nil || businessParams.IsEmpty() {
		return
	}
	params["business_params"] = BusinessParams{
		OrganizationCode: businessParams.GetOrganizationCode(),
		UserID:           businessParams.UserID,
		BusinessID:       businessParams.BusinessID,
	}
}

func attachAccessToken(ctx context.Context, params map[string]any, provider AccessTokenProvider, logger *logging.SugaredLogger) {
	if provider == nil {
		return
	}
	token, err := provider.GetAccessToken(ctx)
	if err != nil {
		if logger != nil {
			logger.WarnContext(ctx, "获取 MAGIC_ACCESS_TOKEN 失败，继续走 PHP 兜底", "error", err)
		}
		return
	}
	if token != "" {
		params["access_token"] = token
	}
}

type rpcAuthRetryOptions[T any] struct {
	params    map[string]any
	provider  AccessTokenProvider
	logger    *logging.SugaredLogger
	refresh   func(context.Context) (string, error)
	operation string
	call      func(map[string]any, *RPCResult[T]) error
}

func executeRPCWithAuthRetry[T any](ctx context.Context, options rpcAuthRetryOptions[T]) (RPCResult[T], error) {
	result, err := invokeRPC(ctx, options.logger, options.operation, options.params, options.call)
	if err != nil || result.Code == 0 {
		return result, err
	}
	if options.provider == nil || !shouldRetryOnAuthError(result.ErrorCode) {
		return result, buildRPCError(result.Code, result.Message, result.ErrorCode)
	}
	return retryRPCWithRefreshedToken(ctx, options, result)
}

func invokeRPC[T any](
	ctx context.Context,
	logger *logging.SugaredLogger,
	operation string,
	params map[string]any,
	call func(map[string]any, *RPCResult[T]) error,
) (RPCResult[T], error) {
	var result RPCResult[T]
	if err := call(params, &result); err != nil {
		if logger != nil {
			logger.ErrorContext(ctx, fmt.Sprintf("调用 PHP %s 失败", operation), "error", err)
		}
		return result, errors.Join(ErrPHPRequestFailed, err)
	}
	return result, nil
}

func retryRPCWithRefreshedToken[T any](ctx context.Context, options rpcAuthRetryOptions[T], result RPCResult[T]) (RPCResult[T], error) {
	if options.logger != nil {
		options.logger.WarnContext(ctx, fmt.Sprintf("%s 鉴权失败，尝试刷新 access token", options.operation), "rpc_code", result.Code, "error_code", result.ErrorCode)
	}
	token, err := options.refresh(ctx)
	if err != nil {
		if options.logger != nil {
			options.logger.WarnContext(ctx, fmt.Sprintf("%s 刷新 access token 失败", options.operation), "error", err, "error_code", result.ErrorCode)
		}
		return result, buildRPCError(result.Code, result.Message, result.ErrorCode)
	}
	if token != "" {
		options.params["access_token"] = token
	} else {
		delete(options.params, "access_token")
	}

	retryResult, retryErr := invokeRPC(ctx, options.logger, options.operation, options.params, options.call)
	if retryErr != nil {
		return retryResult, retryErr
	}
	if retryResult.Code != 0 {
		if options.logger != nil {
			options.logger.WarnContext(ctx, fmt.Sprintf("%s 刷新 token 后仍失败", options.operation), "rpc_code", retryResult.Code, "error_code", retryResult.ErrorCode)
		}
		return retryResult, buildRPCError(retryResult.Code, retryResult.Message, retryResult.ErrorCode)
	}
	if options.logger != nil {
		options.logger.InfoContext(ctx, fmt.Sprintf("%s 刷新 token 重试成功", options.operation), "error_code", retryResult.ErrorCode)
	}
	return retryResult, nil
}

func shouldRetryOnAuthError(errorCode int) bool {
	switch errorCode {
	case tokenNotExistCode, tokenExpiredCode, tokenDisabledCode:
		return true
	default:
		return false
	}
}

func buildRPCError(code int, message string, errorCode int) error {
	return fmt.Errorf("%w: code=%d, message=%s, error_code=%d", ErrPHPRequestFailed, code, message, errorCode)
}

func (c *PHPEmbeddingRPCClient) refreshAccessToken(ctx context.Context) (string, error) {
	refresher, ok := c.accessTokenProvider.(AccessTokenRefresher)
	if !ok {
		return "", errAccessTokenRefreshUnsupported
	}
	token, err := refresher.RefreshAccessToken(ctx)
	if err != nil {
		return "", fmt.Errorf("refresh access token failed: %w", err)
	}
	return token, nil
}

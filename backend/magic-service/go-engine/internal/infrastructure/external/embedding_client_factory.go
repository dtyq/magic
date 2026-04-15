// Package external 包含调用外部服务的基础设施客户端
package external

import (
	"context"
	"fmt"

	"magic/internal/domain/knowledge/embedding"
	"magic/internal/infrastructure/logging"
	ipcclient "magic/internal/infrastructure/rpc/jsonrpc/client"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
	"magic/internal/pkg/ctxmeta"
)

// EmbeddingClientType 定义嵌入客户端类型
type EmbeddingClientType string

const (
	// EmbeddingClientTypePHP 使用 PHP JSON-RPC 回调获取 embedding
	EmbeddingClientTypePHP EmbeddingClientType = "php"
	// EmbeddingClientTypeOpenAI 直接调用 OpenAI 兼容 API
	EmbeddingClientTypeOpenAI EmbeddingClientType = "openai"
)

// EmbeddingClientFactory 嵌入客户端工厂
type EmbeddingClientFactory struct {
	phpClient    *ipcclient.PHPEmbeddingRPCClient
	openaiClient *OpenAIEmbeddingClient
	clientType   EmbeddingClientType
	logger       *logging.SugaredLogger
}

// NewEmbeddingClientFactory 创建嵌入客户端工厂
// server: 基于 IPC 传输的 RPC 服务端（Go 作为服务端，PHP 连接过来）
// openaiBaseURL: OpenAI 兼容 API 的基础 URL
// clientType: 使用 "php" 或 "openai"
func NewEmbeddingClientFactory(
	server *unixsocket.Server,
	openaiBaseURL string,
	clientType EmbeddingClientType,
	logger *logging.SugaredLogger,
	accessTokenProvider AccessTokenProvider,
) *EmbeddingClientFactory {
	factory := &EmbeddingClientFactory{
		clientType: clientType,
		logger:     logger,
	}

	// 根据配置创建对应的客户端
	switch clientType {
	case EmbeddingClientTypePHP:
		factory.phpClient = ipcclient.NewPHPEmbeddingRPCClient(server, logger, accessTokenProvider)
	case EmbeddingClientTypeOpenAI:
		factory.openaiClient = NewOpenAIEmbeddingClient(openaiBaseURL, accessTokenProvider)
	default:
		// 默认使用 OpenAI 客户端
		factory.openaiClient = NewOpenAIEmbeddingClient(openaiBaseURL, accessTokenProvider)
		factory.clientType = EmbeddingClientTypeOpenAI
	}

	return factory
}

// GetClient 获取嵌入客户端
func (f *EmbeddingClientFactory) GetClient() embedding.Client {
	switch f.clientType {
	case EmbeddingClientTypePHP:
		if f.openaiClient != nil && f.phpClient != nil {
			return &compositeEmbeddingClient{
				computeClient:  f.phpClient,
				providerClient: f.openaiClient,
			}
		}
		return f.phpClient
	default:
		return f.openaiClient
	}
}

type compositeEmbeddingClient struct {
	computeClient  embedding.Client
	providerClient embedding.Client
}

func (c *compositeEmbeddingClient) GetEmbedding(ctx context.Context, input, model string, businessParams *ctxmeta.BusinessParams) ([]float64, error) {
	v, err := c.computeClient.GetEmbedding(ctx, input, model, businessParams)
	if err != nil {
		return nil, fmt.Errorf("failed to get embedding: %w", err)
	}
	return v, nil
}

func (c *compositeEmbeddingClient) GetBatchEmbeddings(ctx context.Context, inputs []string, model string, businessParams *ctxmeta.BusinessParams) ([][]float64, error) {
	v, err := c.computeClient.GetBatchEmbeddings(ctx, inputs, model, businessParams)
	if err != nil {
		return nil, fmt.Errorf("failed to get batch embeddings: %w", err)
	}
	return v, nil
}

func (c *compositeEmbeddingClient) SetAccessToken(accessToken string) {
	if c.computeClient != nil {
		c.computeClient.SetAccessToken(accessToken)
	}
	if c.providerClient != nil {
		c.providerClient.SetAccessToken(accessToken)
	}
}

func (c *compositeEmbeddingClient) ListProviders(ctx context.Context, businessParams *ctxmeta.BusinessParams) ([]*embedding.Provider, error) {
	if c.providerClient != nil {
		providers, err := c.providerClient.ListProviders(ctx, businessParams)
		if err != nil {
			return nil, fmt.Errorf("failed to list providers: %w", err)
		}
		return providers, nil
	}
	providers, err := c.computeClient.ListProviders(ctx, businessParams)
	if err != nil {
		return nil, fmt.Errorf("failed to list providers: %w", err)
	}
	return providers, nil
}

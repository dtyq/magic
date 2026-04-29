package external

import "magic/internal/domain/knowledge/embedding"

// NewCompositeEmbeddingClientForTest 暴露组合客户端供测试使用。
func NewCompositeEmbeddingClientForTest(compute, provider embedding.Client) embedding.Client {
	return &compositeEmbeddingClient{computeClient: compute, providerClient: provider}
}

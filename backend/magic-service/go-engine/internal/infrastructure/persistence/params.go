// Package persistence 包含基础设施层仓储实现。
package persistence

// HybridSearchParams 混合搜索参数（Infrastructure 层）
type HybridSearchParams struct {
	OrganizationCode string
	Embedding        []float64
	TopK             int
	Cypher           string
	Params           map[string]any
}

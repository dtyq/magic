// Package knowledgeroute 提供知识库在线读写路由覆盖上下文工具。
package knowledgeroute

import (
	"context"
	"strings"
)

type overrideContextKey struct{}

// RebuildOverride 描述重建任务下发到底层同步链路的临时路由覆盖。
type RebuildOverride struct {
	TargetCollection     string `json:"target_collection"`
	TargetTermCollection string `json:"target_term_collection"`
	TargetModel          string `json:"target_model"`
	TargetSparseBackend  string `json:"target_sparse_backend"`
}

// WithRebuildOverride 将重建路由覆盖写入上下文。
func WithRebuildOverride(ctx context.Context, override *RebuildOverride) context.Context {
	if ctx == nil || override == nil {
		return ctx
	}
	clean := normalizeOverride(override)
	if clean == nil {
		return ctx
	}
	return context.WithValue(ctx, overrideContextKey{}, *clean)
}

// ResolveRebuildOverride 从上下文读取重建路由覆盖。
func ResolveRebuildOverride(ctx context.Context) (RebuildOverride, bool) {
	if ctx == nil {
		return RebuildOverride{}, false
	}
	value, ok := ctx.Value(overrideContextKey{}).(RebuildOverride)
	if !ok {
		return RebuildOverride{}, false
	}
	clean := normalizeOverride(&value)
	if clean == nil {
		return RebuildOverride{}, false
	}
	return *clean, true
}

func normalizeOverride(override *RebuildOverride) *RebuildOverride {
	if override == nil {
		return nil
	}
	clean := RebuildOverride{
		TargetCollection:     strings.TrimSpace(override.TargetCollection),
		TargetTermCollection: strings.TrimSpace(override.TargetTermCollection),
		TargetModel:          strings.TrimSpace(override.TargetModel),
		TargetSparseBackend:  strings.TrimSpace(override.TargetSparseBackend),
	}
	if clean.TargetCollection == "" && clean.TargetTermCollection == "" && clean.TargetModel == "" && clean.TargetSparseBackend == "" {
		return nil
	}
	return &clean
}

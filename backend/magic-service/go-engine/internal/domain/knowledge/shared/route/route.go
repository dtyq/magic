// Package sharedroute 集中定义知识库运行时路由语义。
//
// 知识库共享集合支持蓝绿重建，因此运行时同时存在两类名字：
//
//  1. 逻辑名（collection_name）
//     这是稳定的业务标识，表示“这套知识库共享集合”。
//     它应该长期稳定，不能随着蓝绿切换改变。
//
//  2. 物理名（physical_collection_name）
//     这是当前 active 槽位真实指向的向量集合。
//     在蓝绿切换后，它可能从 active 槽位切到 shadow 槽位，或者从历史物理集合切到固定槽位。
//
// 运行时主链必须只依赖本包返回的 ResolvedRoute，不能自己挑 collection_name /
// physical_collection_name，也不能自己推导 rebuild override。否则很容易出现：
//
// - 写入打到新物理集合，删除还在删旧物理集合
// - dense 检索命中 active，term namespace 还留在 legacy collection
// - rebuild override 期间，部分链路仍然回到逻辑名或旧 active 槽位
//
// 本包的职责只有一个：把“集合元数据 + rebuild override”解释成一次运行时真正应该命中的路由结果。
// 业务代码只消费 ResolvedRoute，不再拼装局部 helper。
package sharedroute

import (
	"context"
	"strings"

	"magic/internal/constants"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/infrastructure/logging"
	pkgknowledgeroute "magic/internal/pkg/knowledgeroute"
)

// CollectionMeta 表示集合级路由元数据。
type CollectionMeta struct {
	CollectionName         string `json:"collection_name"`
	PhysicalCollectionName string `json:"physical_collection_name"`
	Model                  string `json:"model"`
	VectorDimension        int64  `json:"vector_dimension"`
	SparseBackend          string `json:"sparse_backend"`
	Exists                 bool   `json:"exists"`
}

// ResolvedRoute 描述一次运行时执行应命中的完整路由。
//
// 注意：
//   - 业务代码不能直接把 LogicalCollectionName 传给 vector repo。
//   - 只有 VectorCollectionName 才能用于向量读写删查。
//   - TermCollectionName 用于 sparse/term namespace；大多数情况下它等于 VectorCollectionName，
//     只有 rebuild 显式指定 TargetTermCollection 时才会不同。
type ResolvedRoute struct {
	// LogicalCollectionName 是稳定逻辑名，面向业务语义，不可直接用于向量读写。
	LogicalCollectionName string
	// PhysicalCollectionName 是当前 active 物理集合；未启用独立物理槽位时，它可能与逻辑名相同。
	PhysicalCollectionName string
	// VectorCollectionName 是本次运行时真正要命中的向量集合。
	VectorCollectionName string
	// TermCollectionName 是本次运行时真正要命中的 sparse/term namespace。
	TermCollectionName string
	// Model 是本次运行时应使用的 embedding 模型。
	Model string
	// SparseBackend 是本次运行时应使用的 sparse backend。
	SparseBackend string
	// HasRebuildOverride 标记本次解析是否受 rebuild override 影响。
	HasRebuildOverride bool
}

// CollectionMetaReader 定义集合元信息读取能力。
type CollectionMetaReader interface {
	GetCollectionMeta(ctx context.Context) (CollectionMeta, error)
}

// CollectionMetaWriter 定义集合元信息写入能力。
type CollectionMetaWriter interface {
	UpsertCollectionMeta(ctx context.Context, meta CollectionMeta) error
}

func loadCollectionMeta(
	ctx context.Context,
	metaReader CollectionMetaReader,
	logger *logging.SugaredLogger,
) CollectionMeta {
	if metaReader == nil {
		return CollectionMeta{}
	}

	meta, err := metaReader.GetCollectionMeta(ctx)
	if err != nil {
		if logger != nil {
			logger.KnowledgeWarnContext(ctx, "Failed to read collection meta, fallback to legacy routing", "error", err)
		}
		return CollectionMeta{}
	}
	return meta
}

// ResolveRuntimeRoute 解析当前执行真正应该命中的完整运行时路由。
//
// fallbackCollection 表示没有 meta 记录时的默认逻辑名；对于共享知识库，通常是固定逻辑集合名。
// defaultModel 表示 meta 和 rebuild override 都没有给出模型时的兜底模型。
func ResolveRuntimeRoute(
	ctx context.Context,
	metaReader CollectionMetaReader,
	logger *logging.SugaredLogger,
	fallbackCollection string,
	defaultModel string,
) ResolvedRoute {
	meta := loadCollectionMeta(ctx, metaReader, logger)
	return resolveRuntimeRouteFromMeta(ctx, meta, fallbackCollection, defaultModel)
}

func resolveRuntimeRouteFromMeta(
	ctx context.Context,
	meta CollectionMeta,
	fallbackCollection string,
	defaultModel string,
) ResolvedRoute {
	logicalCollectionName := resolveLogicalCollectionName(meta, fallbackCollection)
	physicalCollectionName := resolvePhysicalCollectionName(meta, logicalCollectionName)
	vectorCollectionName, hasOverride := resolveVectorCollectionName(ctx, logicalCollectionName, physicalCollectionName)
	termCollectionName := resolveTermCollectionName(ctx, vectorCollectionName)

	return ResolvedRoute{
		LogicalCollectionName:  logicalCollectionName,
		PhysicalCollectionName: physicalCollectionName,
		VectorCollectionName:   vectorCollectionName,
		TermCollectionName:     termCollectionName,
		Model:                  resolveModel(ctx, meta, defaultModel),
		SparseBackend:          resolveSparseBackend(ctx, meta),
		HasRebuildOverride:     hasOverride,
	}
}

func normalizeCollectionFallback(fallbackCollection string) string {
	collection := strings.TrimSpace(fallbackCollection)
	if collection != "" {
		return collection
	}
	return constants.KnowledgeBaseCollectionName
}

func resolveLogicalCollectionName(meta CollectionMeta, fallbackCollection string) string {
	logicalCollectionName := normalizeCollectionFallback(fallbackCollection)
	if !meta.Exists {
		return logicalCollectionName
	}
	if candidate := strings.TrimSpace(meta.CollectionName); candidate != "" {
		return candidate
	}
	return logicalCollectionName
}

func resolvePhysicalCollectionName(meta CollectionMeta, logicalCollectionName string) string {
	if !meta.Exists {
		return logicalCollectionName
	}
	if candidate := strings.TrimSpace(meta.PhysicalCollectionName); candidate != "" {
		return candidate
	}
	if candidate := strings.TrimSpace(meta.CollectionName); candidate != "" {
		return candidate
	}
	return logicalCollectionName
}

func resolveVectorCollectionName(
	ctx context.Context,
	logicalCollectionName string,
	physicalCollectionName string,
) (string, bool) {
	override, ok := pkgknowledgeroute.ResolveRebuildOverride(ctx)
	if !ok {
		return physicalCollectionName, false
	}

	targetCollection := strings.TrimSpace(override.TargetCollection)
	if targetCollection == "" {
		return physicalCollectionName, true
	}

	// rebuild 期间允许上层仍然传逻辑名；这里统一把它解释成当前目标物理集合，
	// 避免调用方自己根据 logical/physical 做第二次推断。
	if targetCollection == logicalCollectionName {
		return physicalCollectionName, true
	}
	return targetCollection, true
}

func resolveTermCollectionName(ctx context.Context, vectorCollectionName string) string {
	override, ok := pkgknowledgeroute.ResolveRebuildOverride(ctx)
	if ok {
		if targetTermCollection := strings.TrimSpace(override.TargetTermCollection); targetTermCollection != "" {
			return targetTermCollection
		}
	}
	return vectorCollectionName
}

func resolveModel(ctx context.Context, meta CollectionMeta, defaultModel string) string {
	if override, ok := pkgknowledgeroute.ResolveRebuildOverride(ctx); ok && override.TargetModel != "" {
		return override.TargetModel
	}
	if meta.Exists {
		if model := strings.TrimSpace(meta.Model); model != "" {
			return model
		}
	}
	return strings.TrimSpace(defaultModel)
}

func resolveSparseBackend(ctx context.Context, meta CollectionMeta) string {
	if override, ok := pkgknowledgeroute.ResolveRebuildOverride(ctx); ok {
		if backend := shared.NormalizeSparseBackend(override.TargetSparseBackend); backend != "" {
			return backend
		}
	}
	return shared.NormalizeSparseBackend(meta.SparseBackend)
}

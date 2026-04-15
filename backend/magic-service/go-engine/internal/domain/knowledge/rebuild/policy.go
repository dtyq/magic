package rebuild

import (
	"errors"
	"fmt"
	"strings"
)

var (
	// ErrInplaceModeMismatch 表示 inplace 模式下目标维度与活动集合维度不一致。
	ErrInplaceModeMismatch = errors.New("inplace mode requires same collection dimension when target dimension is provided")
	// ErrAllScopeNoDocuments 表示全量范围未找到文档。
	ErrAllScopeNoDocuments = errors.New("all scope found no documents")
	// ErrOrganizationScopeNoDocuments 表示组织范围未找到文档。
	ErrOrganizationScopeNoDocuments = errors.New("organization scope found no documents")
	// ErrKnowledgeBaseScopeNoDocuments 表示知识库范围未找到文档。
	ErrKnowledgeBaseScopeNoDocuments = errors.New("knowledge_base scope found no documents")
	// ErrDocumentScopeNoDocuments 表示文档范围未找到文档。
	ErrDocumentScopeNoDocuments = errors.New("document scope found no documents")
	// ErrResyncFailuresBlockCutover 表示全量蓝绿切换时存在失败文档。
	ErrResyncFailuresBlockCutover = errors.New("resync failures block cutover for all scope")
	// ErrBlueGreenTargetEmpty 表示蓝绿目标集合为空。
	ErrBlueGreenTargetEmpty = errors.New("bluegreen target collection has no points")
)

const (
	// ScopeEscalationBootstrap 表示 bootstrap 导致的范围升级。
	ScopeEscalationBootstrap = "bootstrap"
)

// ExecutionOptions 描述重建执行参数的领域部分。
type ExecutionOptions struct {
	Scope       Scope
	Mode        RunMode
	Concurrency int
	BatchSize   int
	Retry       int
}

// ActiveCollectionState 描述当前活动集合状态。
type ActiveCollectionState struct {
	Alias              string
	PhysicalCollection string
	Model              string
	Dimension          int64
	Bootstrap          bool
	SchemaOK           bool
	NeedsNormalization bool
}

// ResyncSummary 描述重同步结果摘要。
type ResyncSummary struct {
	TotalDocs  int64
	FailedDocs int64
}

// TargetSlotPlan 描述蓝绿目标槽位的准备动作。
type TargetSlotPlan struct {
	Create      bool
	Recreate    bool
	ClearPoints bool
}

// NormalizeExecutionOptions 归一化重建执行参数。
func NormalizeExecutionOptions(input ExecutionOptions, defaultMode RunMode, defaultConcurrency, maxConcurrency, defaultBatchSize, defaultRetry int) ExecutionOptions {
	result := input
	result.Scope = NormalizeScope(result.Scope)
	if strings.TrimSpace(string(result.Mode)) == "" {
		result.Mode = defaultMode
	}
	if result.Concurrency <= 0 {
		result.Concurrency = defaultConcurrency
	}
	if maxConcurrency > 0 && result.Concurrency > maxConcurrency {
		result.Concurrency = maxConcurrency
	}
	if result.BatchSize <= 0 {
		result.BatchSize = defaultBatchSize
	}
	if result.Retry < 0 {
		result.Retry = defaultRetry
	}
	return result
}

// DetermineEffectiveScope 计算实际执行范围。
func DetermineEffectiveScope(requested Scope, bootstrap bool) (Scope, bool, string) {
	if bootstrap && requested.Mode == ScopeModeOrganization {
		return Scope{Mode: ScopeModeAll}, true, ScopeEscalationBootstrap
	}
	return requested, false, ""
}

// ResolveRequestedTargetModel 解析本次执行的目标模型。
func ResolveRequestedTargetModel(requested string, meta CollectionMeta) string {
	targetModel := strings.TrimSpace(requested)
	if targetModel != "" {
		return targetModel
	}
	return strings.TrimSpace(meta.Model)
}

// SelectMode 根据元数据与目标模型选择执行模式。
func SelectMode(requested RunMode, meta CollectionMeta, targetModel, targetSparseBackend string) RunMode {
	currentBackend := strings.TrimSpace(meta.SparseBackend)
	targetBackend := strings.TrimSpace(targetSparseBackend)
	if requested == ModeInplace && currentBackend != "" && currentBackend != targetBackend {
		return ModeBlueGreen
	}
	if requested != ModeAuto {
		return requested
	}
	if !meta.Exists {
		return ModeBlueGreen
	}
	if currentBackend != "" && currentBackend != targetBackend {
		return ModeBlueGreen
	}
	if strings.EqualFold(strings.TrimSpace(meta.Model), strings.TrimSpace(targetModel)) {
		return ModeInplace
	}
	return ModeBlueGreen
}

// ResolveActiveCollectionState 根据元数据、alias 与集合信息计算活动集合状态。
func ResolveActiveCollectionState(
	meta CollectionMeta,
	alias string,
	aliasTarget string,
	info *VectorCollectionInfo,
	fixedActiveCollection string,
) ActiveCollectionState {
	state := ActiveCollectionState{
		Alias:     strings.TrimSpace(alias),
		Bootstrap: !meta.Exists,
	}
	if strings.TrimSpace(aliasTarget) != "" {
		state.PhysicalCollection = strings.TrimSpace(aliasTarget)
		state.Bootstrap = false
	}
	if meta.Exists {
		state.Model = strings.TrimSpace(meta.Model)
		state.Dimension = meta.VectorDimension
		if state.PhysicalCollection == "" {
			if name := strings.TrimSpace(meta.PhysicalCollectionName); name != "" {
				state.PhysicalCollection = name
				state.Bootstrap = false
			} else if name := strings.TrimSpace(meta.CollectionName); name != "" {
				state.PhysicalCollection = name
				state.Bootstrap = false
			}
		}
	}
	if state.PhysicalCollection == "" && state.Bootstrap {
		state.PhysicalCollection = strings.TrimSpace(fixedActiveCollection)
	}
	if state.PhysicalCollection == "" && !state.Bootstrap {
		state.PhysicalCollection = state.Alias
	}
	state.NeedsNormalization = NeedsPhysicalNameNormalization(state.PhysicalCollection, fixedActiveCollection)
	if info != nil {
		if state.Dimension <= 0 {
			state.Dimension = info.VectorSize
		}
		state.SchemaOK = info.HasNamedDenseVector && info.HasSparseVector
	} else if state.Bootstrap {
		state.SchemaOK = true
	}
	return state
}

// ValidateInplaceTargetDimension 校验 inplace 模式维度约束。
func ValidateInplaceTargetDimension(activeCollection string, activeDimension, targetDimension int64) error {
	if targetDimension <= 0 || activeDimension <= 0 || activeDimension == targetDimension {
		return nil
	}
	return fmt.Errorf("%w: active_collection=%s active_dim=%d target_dim=%d", ErrInplaceModeMismatch, activeCollection, activeDimension, targetDimension)
}

// NeedsPhysicalNameNormalization 判断物理集合名是否需要归一化。
func NeedsPhysicalNameNormalization(name string, fixedCollections ...string) bool {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return false
	}
	for _, fixed := range fixedCollections {
		if trimmed == strings.TrimSpace(fixed) {
			return false
		}
	}
	return true
}

// ResolveFixedBlueGreenTarget 选择蓝绿切换目标槽位。
func ResolveFixedBlueGreenTarget(activePhysicalCollection string, bootstrap bool, fixedActiveCollection, fixedShadowCollection string) string {
	switch strings.TrimSpace(activePhysicalCollection) {
	case strings.TrimSpace(fixedActiveCollection):
		return strings.TrimSpace(fixedShadowCollection)
	case strings.TrimSpace(fixedShadowCollection):
		return strings.TrimSpace(fixedActiveCollection)
	default:
		if bootstrap {
			return strings.TrimSpace(fixedShadowCollection)
		}
		return strings.TrimSpace(fixedActiveCollection)
	}
}

// ResolveStandbyCollection 解析切换后的备用槽位。
func ResolveStandbyCollection(
	activePhysicalCollection string,
	fixedActiveCollection string,
	fixedShadowCollection string,
) string {
	if strings.TrimSpace(activePhysicalCollection) == strings.TrimSpace(fixedActiveCollection) {
		return strings.TrimSpace(fixedShadowCollection)
	}
	return strings.TrimSpace(fixedActiveCollection)
}

// BuildReusableTargetSlotPlan 构造可复用目标槽位的准备动作。
func BuildReusableTargetSlotPlan(exists bool, info *VectorCollectionInfo, targetDimension int64) TargetSlotPlan {
	if !exists {
		return TargetSlotPlan{Create: true}
	}
	if info == nil || info.VectorSize != targetDimension || !info.HasNamedDenseVector || !info.HasSparseVector {
		return TargetSlotPlan{Recreate: true}
	}
	return TargetSlotPlan{ClearPoints: true}
}

// ValidateResyncSummary 校验重同步摘要是否满足切换条件。
func ValidateResyncSummary(scope Scope, summary ResyncSummary) error {
	if summary.TotalDocs == 0 {
		switch scope.Mode {
		case ScopeModeDocument:
			return ErrDocumentScopeNoDocuments
		case ScopeModeKnowledgeBase:
			return ErrKnowledgeBaseScopeNoDocuments
		case ScopeModeOrganization, ScopeModeRequestUserKnowledgeBases:
			return ErrOrganizationScopeNoDocuments
		case ScopeModeAll:
			return ErrAllScopeNoDocuments
		}
	}
	if scope.Mode == ScopeModeAll && summary.FailedDocs > 0 {
		return fmt.Errorf("%w: failed_docs=%d", ErrResyncFailuresBlockCutover, summary.FailedDocs)
	}
	return nil
}

// ValidateBlueGreenCutover 校验蓝绿切换条件。
func ValidateBlueGreenCutover(scope Scope, summary ResyncSummary, targetCollection string) error {
	if err := ValidateResyncSummary(scope, summary); err != nil {
		return err
	}
	if summary.TotalDocs <= 0 {
		return fmt.Errorf("validate bluegreen cutover target %s: %w", targetCollection, ErrBlueGreenTargetEmpty)
	}
	return nil
}

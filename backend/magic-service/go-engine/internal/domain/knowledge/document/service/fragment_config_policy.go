package document

import (
	"strings"

	docentity "magic/internal/domain/knowledge/document/entity"
	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/pkg/tokenizer"
)

const (
	syncDefaultChunkSize = 1000
	syncDefaultOverlap   = 80
	syncDefaultSeparator = "\n"
)

// SyncSegmentConfig 表示同步链路使用的标准切片配置。
type SyncSegmentConfig struct {
	ChunkSize          int
	ChunkOverlap       int
	Separator          string
	TextPreprocessRule []int
}

// SyncSplitPlan 表示正式同步链路实际传给 splitter 的有效切片策略。
type SyncSplitPlan struct {
	RequestedMode  shared.FragmentMode
	FragmentConfig *shared.FragmentConfig
	SegmentConfig  SyncSegmentConfig
}

// BuildSyncSegmentConfig 根据文档和知识库配置构造同步切片配置。
func BuildSyncSegmentConfig(
	doc *docentity.KnowledgeBaseDocument,
	kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot,
) SyncSegmentConfig {
	kb = sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(kb)
	config := SyncSegmentConfig{
		ChunkSize:          syncDefaultChunkSize,
		ChunkOverlap:       syncDefaultOverlap,
		Separator:          syncDefaultSeparator,
		TextPreprocessRule: []int{},
	}
	if doc != nil {
		applyFragmentConfigToSegmentConfig(&config, doc.FragmentConfig)
	}
	if kb != nil && (doc == nil || doc.FragmentConfig == nil) {
		applyFragmentConfigToSegmentConfig(&config, kb.FragmentConfig)
	}
	return config
}

// ResolveSyncRequestedModeAndConfig 解析同步时实际生效的切片模式与配置。
func ResolveSyncRequestedModeAndConfig(
	doc *docentity.KnowledgeBaseDocument,
	kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot,
) (shared.FragmentMode, *shared.FragmentConfig) {
	kb = sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(kb)
	switch {
	case doc != nil && doc.FragmentConfig != nil:
		cfg := CloneFragmentConfig(doc.FragmentConfig)
		return normalizeRequestedMode(cfg.Mode), cfg
	case kb != nil && kb.FragmentConfig != nil:
		cfg := CloneFragmentConfig(kb.FragmentConfig)
		return normalizeRequestedMode(cfg.Mode), cfg
	default:
		return shared.FragmentModeAuto, nil
	}
}

// ResolveEffectiveSyncSplitPlan 解析正式同步链路实际生效的切片模式与配置。
//
// flow 向量知识库执行态统一走 auto，落库的 document / knowledge base fragment_config 保持不变。
func ResolveEffectiveSyncSplitPlan(
	doc *docentity.KnowledgeBaseDocument,
	kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot,
	forceAuto bool,
) SyncSplitPlan {
	if forceAuto {
		return SyncSplitPlan{
			RequestedMode:  shared.FragmentModeAuto,
			FragmentConfig: shared.DefaultFragmentConfig(),
			SegmentConfig:  BuildSyncSegmentConfig(nil, nil),
		}
	}

	segmentConfig := BuildSyncSegmentConfig(doc, kb)
	requestedMode, fragmentConfig := ResolveSyncRequestedModeAndConfig(doc, kb)
	return SyncSplitPlan{
		RequestedMode:  requestedMode,
		FragmentConfig: fragmentConfig,
		SegmentConfig:  segmentConfig,
	}
}

// CloneFragmentConfig 深拷贝切片配置。
func CloneFragmentConfig(cfg *shared.FragmentConfig) *shared.FragmentConfig {
	return cloneFragmentConfig(cfg)
}

// ResolveSplitModel 解析切片链路应使用的模型。
func ResolveSplitModel(candidates ...string) string {
	for _, candidate := range candidates {
		if trimmed := strings.TrimSpace(candidate); trimmed != "" {
			return trimmed
		}
	}
	return tokenizer.DefaultEncoding
}

func applyFragmentConfigToSegmentConfig(
	config *SyncSegmentConfig,
	fragmentConfig *shared.FragmentConfig,
) {
	if config == nil || fragmentConfig == nil {
		return
	}

	var segmentRule *shared.SegmentRule
	if fragmentConfig.Normal != nil {
		config.TextPreprocessRule = append(config.TextPreprocessRule, fragmentConfig.Normal.TextPreprocessRule...)
		segmentRule = fragmentConfig.Normal.SegmentRule
	}
	if segmentRule == nil {
		return
	}
	effective := shared.ResolveEffectiveSegmentRule(segmentRule, shared.SegmentRuleDefaults{
		Separator:    syncDefaultSeparator,
		ChunkSize:    syncDefaultChunkSize,
		ChunkOverlap: syncDefaultOverlap,
	})
	config.Separator = effective.Separator
	config.ChunkSize = effective.ChunkSize
	config.ChunkOverlap = effective.ChunkOverlap
}

func normalizeRequestedMode(mode shared.FragmentMode) shared.FragmentMode {
	switch mode {
	case shared.FragmentModeCustom, shared.FragmentModeAuto, shared.FragmentModeHierarchy:
		return mode
	default:
		return shared.FragmentModeCustom
	}
}

func cloneFragmentConfig(cfg *shared.FragmentConfig) *shared.FragmentConfig {
	if cfg == nil {
		return nil
	}
	clone := *cfg
	if cfg.Normal != nil {
		normal := *cfg.Normal
		normal.TextPreprocessRule = append([]int(nil), cfg.Normal.TextPreprocessRule...)
		if cfg.Normal.SegmentRule != nil {
			segmentRule := *cfg.Normal.SegmentRule
			normal.SegmentRule = &segmentRule
		}
		clone.Normal = &normal
	}
	if cfg.Hierarchy != nil {
		hierarchy := *cfg.Hierarchy
		hierarchy.TextPreprocessRule = append([]int(nil), cfg.Hierarchy.TextPreprocessRule...)
		clone.Hierarchy = &hierarchy
	}
	return &clone
}

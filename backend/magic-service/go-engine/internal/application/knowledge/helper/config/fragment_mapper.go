package config

import (
	"slices"

	"magic/internal/domain/knowledge/shared"
)

const (
	// ChunkOverlapUnitAbsolute 表示 chunk_overlap 按绝对长度解释。
	ChunkOverlapUnitAbsolute = shared.ChunkOverlapUnitAbsolute
	// ChunkOverlapUnitPercent 表示 chunk_overlap 按百分比解释。
	ChunkOverlapUnitPercent = shared.ChunkOverlapUnitPercent
)

// IsValidChunkOverlapUnit 判断 chunk_overlap_unit 是否有效。
func IsValidChunkOverlapUnit(unit string) bool {
	return shared.IsValidChunkOverlapUnit(unit)
}

// NormalizeChunkOverlapUnit 统一 overlap 单位，空值回退为 absolute。
func NormalizeChunkOverlapUnit(unit string) string {
	return shared.NormalizeChunkOverlapUnit(unit)
}

// FragmentConfigDTOToEntity 将应用层 DTO 转成领域配置。
func FragmentConfigDTOToEntity(cfg *FragmentConfigDTO) *shared.FragmentConfig {
	return shared.NormalizeFragmentConfig(fragmentConfigDTOToEntityRaw(cfg))
}

// FragmentConfigEntityToDTO 将领域配置转成应用层 DTO。
func FragmentConfigEntityToDTO(cfg *shared.FragmentConfig) *FragmentConfigDTO {
	normalized := shared.NormalizeFragmentConfig(cfg)
	if normalized == nil {
		return nil
	}
	result := &FragmentConfigDTO{
		Mode: int(normalized.Mode),
	}
	if normalized.Normal != nil {
		result.Normal = &NormalFragmentConfigDTO{
			TextPreprocessRule: cloneIntSliceOrEmpty(normalized.Normal.TextPreprocessRule),
			SegmentRule:        segmentRuleEntityToDTO(normalized.Normal.SegmentRule),
		}
	}
	if normalized.Hierarchy != nil {
		result.Hierarchy = &HierarchyFragmentConfigDTO{
			MaxLevel:           normalized.Hierarchy.MaxLevel,
			TextPreprocessRule: cloneIntSliceOrEmpty(normalized.Hierarchy.TextPreprocessRule),
			KeepHierarchyInfo:  normalized.Hierarchy.KeepHierarchyInfo,
		}
	}
	return result
}

// FragmentConfigEntityToOutputDTO 将领域配置转成输出 DTO。
func FragmentConfigEntityToOutputDTO(cfg *shared.FragmentConfig) *FragmentConfigOutputDTO {
	normalized := shared.NormalizeFragmentConfig(cfg)
	if normalized == nil {
		return nil
	}
	result := &FragmentConfigOutputDTO{
		Mode: int(normalized.Mode),
	}
	if normalized.Normal != nil {
		result.Normal = &NormalFragmentConfigOutputDTO{
			TextPreprocessRule: cloneIntSliceOrEmpty(normalized.Normal.TextPreprocessRule),
			SegmentRule:        segmentRuleEntityToOutputDTO(normalized.Normal.SegmentRule),
		}
	}
	if normalized.Hierarchy != nil {
		result.Hierarchy = &HierarchyFragmentConfigDTO{
			MaxLevel:           normalized.Hierarchy.MaxLevel,
			TextPreprocessRule: cloneIntSliceOrEmpty(normalized.Hierarchy.TextPreprocessRule),
			KeepHierarchyInfo:  normalized.Hierarchy.KeepHierarchyInfo,
		}
	}
	return result
}

// NormalizeFragmentConfigDTO 统一片段配置到当前三态契约。
func NormalizeFragmentConfigDTO(cfg *FragmentConfigDTO) *FragmentConfigDTO {
	return FragmentConfigEntityToDTO(fragmentConfigDTOToEntityRaw(cfg))
}

// NormalizeFragmentConfigOutputDTO 统一片段配置输出 DTO 到当前契约。
func NormalizeFragmentConfigOutputDTO(cfg *FragmentConfigOutputDTO) *FragmentConfigOutputDTO {
	if cfg == nil {
		return nil
	}
	result := &FragmentConfigOutputDTO{
		Mode: cfg.Mode,
	}
	if cfg.Normal != nil {
		result.Normal = &NormalFragmentConfigOutputDTO{
			TextPreprocessRule: cloneIntSliceOrEmpty(cfg.Normal.TextPreprocessRule),
		}
		if cfg.Normal.SegmentRule != nil {
			segmentRule := *cfg.Normal.SegmentRule
			segmentRule.ChunkOverlapUnit = NormalizeChunkOverlapUnit(segmentRule.ChunkOverlapUnit)
			result.Normal.SegmentRule = &segmentRule
		}
	}
	if cfg.Hierarchy != nil {
		hierarchy := *cfg.Hierarchy
		hierarchy.TextPreprocessRule = cloneIntSliceOrEmpty(cfg.Hierarchy.TextPreprocessRule)
		result.Hierarchy = &hierarchy
	}
	return result
}

func cloneIntSliceOrEmpty(values []int) []int {
	cloned := slices.Clone(values)
	if cloned == nil {
		return []int{}
	}
	return cloned
}

func fragmentConfigDTOToEntityRaw(cfg *FragmentConfigDTO) *shared.FragmentConfig {
	if cfg == nil {
		return nil
	}
	result := &shared.FragmentConfig{
		Mode: shared.FragmentMode(cfg.Mode),
	}
	if cfg.Normal != nil {
		result.Normal = &shared.NormalFragmentConfig{
			TextPreprocessRule: slices.Clone(cfg.Normal.TextPreprocessRule),
			SegmentRule:        segmentRuleDTOToEntity(cfg.Normal.SegmentRule),
		}
	}
	if cfg.Hierarchy != nil {
		result.Hierarchy = &shared.HierarchyFragmentConfig{
			MaxLevel:           cfg.Hierarchy.MaxLevel,
			TextPreprocessRule: slices.Clone(cfg.Hierarchy.TextPreprocessRule),
			KeepHierarchyInfo:  cfg.Hierarchy.KeepHierarchyInfo,
		}
	}
	return result
}

func segmentRuleDTOToEntity(rule *SegmentRuleDTO) *shared.SegmentRule {
	if rule == nil {
		return nil
	}
	return &shared.SegmentRule{
		ChunkSize:        rule.ChunkSize,
		ChunkOverlap:     rule.ChunkOverlap,
		ChunkOverlapUnit: rule.ChunkOverlapUnit,
		Separator:        rule.Separator,
	}
}

func segmentRuleEntityToDTO(rule *shared.SegmentRule) *SegmentRuleDTO {
	if rule == nil {
		return nil
	}
	return &SegmentRuleDTO{
		ChunkSize:        rule.ChunkSize,
		ChunkOverlap:     rule.ChunkOverlap,
		ChunkOverlapUnit: NormalizeChunkOverlapUnit(rule.ChunkOverlapUnit),
		Separator:        rule.Separator,
	}
}

func segmentRuleEntityToOutputDTO(rule *shared.SegmentRule) *SegmentRuleOutputDTO {
	if rule == nil {
		return nil
	}
	return &SegmentRuleOutputDTO{
		ChunkSize:        rule.ChunkSize,
		ChunkOverlap:     rule.ChunkOverlap,
		ChunkOverlapUnit: NormalizeChunkOverlapUnit(rule.ChunkOverlapUnit),
		Separator:        rule.Separator,
	}
}

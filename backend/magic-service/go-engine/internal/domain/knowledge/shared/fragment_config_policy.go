package shared

// NormalizeFragmentConfig 统一片段配置到当前三态契约，并返回深拷贝结果。
func NormalizeFragmentConfig(cfg *FragmentConfig) *FragmentConfig {
	if cfg == nil {
		return nil
	}

	normalized := CloneFragmentConfig(cfg)
	if normalized.Mode == 0 {
		if normalized.Normal != nil {
			normalized.Mode = FragmentModeCustom
		} else {
			normalized.Mode = FragmentModeAuto
		}
	}
	return normalized
}

// CloneFragmentConfig 深拷贝片段配置。
func CloneFragmentConfig(cfg *FragmentConfig) *FragmentConfig {
	if cfg == nil {
		return nil
	}

	cloned := &FragmentConfig{
		Mode: cfg.Mode,
	}
	if cfg.Normal != nil {
		normal := *cfg.Normal
		normal.TextPreprocessRule = append([]int(nil), cfg.Normal.TextPreprocessRule...)
		if cfg.Normal.SegmentRule != nil {
			segmentRule := *cfg.Normal.SegmentRule
			segmentRule.ChunkOverlapUnit = NormalizeChunkOverlapUnit(segmentRule.ChunkOverlapUnit)
			normal.SegmentRule = &segmentRule
		}
		cloned.Normal = &normal
	}
	if cfg.Hierarchy != nil {
		hierarchy := *cfg.Hierarchy
		hierarchy.TextPreprocessRule = append([]int(nil), cfg.Hierarchy.TextPreprocessRule...)
		cloned.Hierarchy = &hierarchy
	}
	return cloned
}

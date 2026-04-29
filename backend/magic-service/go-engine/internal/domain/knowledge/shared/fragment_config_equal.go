package shared

import "slices"

// FragmentConfigEqual 判断两个片段配置归一化后是否等价。
func FragmentConfigEqual(left, right *FragmentConfig) bool {
	lhs := NormalizeFragmentConfig(left)
	rhs := NormalizeFragmentConfig(right)
	switch {
	case lhs == nil || rhs == nil:
		return lhs == rhs
	case lhs.Mode != rhs.Mode:
		return false
	}
	if !normalFragmentConfigEqual(lhs.Normal, rhs.Normal) {
		return false
	}
	return hierarchyFragmentConfigEqual(lhs.Hierarchy, rhs.Hierarchy)
}

func normalFragmentConfigEqual(left, right *NormalFragmentConfig) bool {
	if left == nil || right == nil {
		return left == right
	}
	if !slices.Equal(left.TextPreprocessRule, right.TextPreprocessRule) {
		return false
	}
	return segmentRuleEqual(left.SegmentRule, right.SegmentRule)
}

func segmentRuleEqual(left, right *SegmentRule) bool {
	if left == nil || right == nil {
		return left == right
	}
	return left.Separator == right.Separator &&
		left.ChunkSize == right.ChunkSize &&
		left.ChunkOverlap == right.ChunkOverlap &&
		NormalizeChunkOverlapUnit(left.ChunkOverlapUnit) == NormalizeChunkOverlapUnit(right.ChunkOverlapUnit)
}

func hierarchyFragmentConfigEqual(left, right *HierarchyFragmentConfig) bool {
	if left == nil || right == nil {
		return left == right
	}
	return left.MaxLevel == right.MaxLevel &&
		left.KeepHierarchyInfo == right.KeepHierarchyInfo &&
		slices.Equal(left.TextPreprocessRule, right.TextPreprocessRule)
}

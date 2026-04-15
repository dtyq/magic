package retrieval

import "strings"

const (
	tabularRowDefaultBoost       = 0.08
	tabularRowAggregationPenalty = -0.10
)

func tabularChunkQueryBoost(query string, metadata map[string]any) float64 {
	chunkType := strings.TrimSpace(metadataStringValue(metadata, ParsedMetaChunkType))
	if chunkType == "" {
		return 0
	}
	aggregationIntent := hasAggregationIntent(query)
	switch chunkType {
	case ParsedBlockTypeTableRow:
		if aggregationIntent {
			return tabularRowAggregationPenalty
		}
		return tabularRowDefaultBoost
	default:
		return 0
	}
}

func shouldSkipSectionPathDiversity(metadata map[string]any) bool {
	switch strings.TrimSpace(metadataStringValue(metadata, ParsedMetaChunkType)) {
	case ParsedBlockTypeTableRow:
		return true
	default:
		return false
	}
}

func hasAggregationIntent(query string) bool {
	normalized := strings.ToLower(strings.TrimSpace(query))
	if normalized == "" {
		return false
	}
	for _, keyword := range tabularAggregationKeywords() {
		if strings.Contains(normalized, keyword) {
			return true
		}
	}
	return false
}

func tabularAggregationKeywords() []string {
	return []string{
		"汇总", "统计", "趋势", "占比", "对比", "分布", "总计", "总额", "平均", "avg", "sum", "count", "total",
	}
}

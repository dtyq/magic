package shared

import (
	"math"
	"strconv"
	"strings"
)

const chunkOverlapPercentBase = 100.0

// SegmentRuleDefaults 描述切片规则默认值。
type SegmentRuleDefaults struct {
	Separator    string
	ChunkSize    int
	ChunkOverlap int
}

// EffectiveSegmentRule 描述真正下发给 splitter 的切片规则。
type EffectiveSegmentRule struct {
	Separator        string
	ChunkSize        int
	ChunkOverlap     int
	ChunkOverlapUnit string
}

// IsValidChunkOverlapUnit 判断 chunk_overlap_unit 是否有效。
func IsValidChunkOverlapUnit(unit string) bool {
	switch strings.ToLower(strings.TrimSpace(unit)) {
	case "", ChunkOverlapUnitAbsolute, ChunkOverlapUnitPercent:
		return true
	default:
		return false
	}
}

// NormalizeChunkOverlapUnit 统一 overlap 单位，空值回退为 absolute。
func NormalizeChunkOverlapUnit(unit string) string {
	switch strings.ToLower(strings.TrimSpace(unit)) {
	case ChunkOverlapUnitPercent:
		return ChunkOverlapUnitPercent
	default:
		return ChunkOverlapUnitAbsolute
	}
}

// DecodeSegmentSeparator 对 JSON 转义的分隔符做还原。
func DecodeSegmentSeparator(separator string) string {
	if separator == "" {
		return ""
	}
	quoted := `"` + strings.ReplaceAll(separator, `"`, `\"`) + `"`
	unescaped, err := strconv.Unquote(quoted)
	if err != nil {
		return separator
	}
	return unescaped
}

// ResolveEffectiveSegmentRule 根据原始规则与默认值计算实际切片配置。
func ResolveEffectiveSegmentRule(rule *SegmentRule, defaults SegmentRuleDefaults) EffectiveSegmentRule {
	effective := EffectiveSegmentRule{
		Separator:        defaults.Separator,
		ChunkSize:        defaults.ChunkSize,
		ChunkOverlap:     defaults.ChunkOverlap,
		ChunkOverlapUnit: ChunkOverlapUnitAbsolute,
	}
	if effective.ChunkSize < 1 {
		effective.ChunkSize = 1
	}
	if effective.ChunkOverlap < 0 {
		effective.ChunkOverlap = 0
	}
	if maxOverlap := effective.ChunkSize - 1; effective.ChunkOverlap > maxOverlap {
		effective.ChunkOverlap = maxOverlap
	}
	if rule == nil {
		return effective
	}

	if separator := DecodeSegmentSeparator(rule.Separator); separator != "" {
		effective.Separator = separator
	}
	if rule.ChunkSize > 0 {
		effective.ChunkSize = rule.ChunkSize
	}

	effective.ChunkOverlapUnit = NormalizeChunkOverlapUnit(rule.ChunkOverlapUnit)
	rawOverlap := effective.ChunkOverlap
	if rule.ChunkOverlap >= 0 {
		rawOverlap = rule.ChunkOverlap
	}
	if rawOverlap < 0 {
		rawOverlap = 0
	}
	if effective.ChunkOverlapUnit == ChunkOverlapUnitPercent {
		rawOverlap = int(math.Ceil(float64(effective.ChunkSize) * float64(rawOverlap) / chunkOverlapPercentBase))
	}
	if maxOverlap := effective.ChunkSize - 1; rawOverlap > maxOverlap {
		rawOverlap = maxOverlap
	}
	if rawOverlap < 0 {
		rawOverlap = 0
	}
	effective.ChunkOverlap = rawOverlap
	return effective
}

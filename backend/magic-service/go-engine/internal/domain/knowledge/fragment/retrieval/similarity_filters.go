// Package retrieval 提供片段检索增强相关的领域服务实现。
package retrieval

import (
	"regexp"
	"strconv"
	"strings"

	"magic/internal/constants"
	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
)

var (
	sectionFilterRegex       = regexp.MustCompile(`(?i)(?:section|章节)[:：]\s*(.+)`)
	documentFilterRegex      = regexp.MustCompile(`(?i)(?:doc|document|文档)[:：]\s*([A-Za-z0-9_\-]+)`)
	levelFilterRegex         = regexp.MustCompile(`(?i)(?:level|层级)[:：]\s*([1-9])`)
	fromTimestampFilterRegex = regexp.MustCompile(`(?i)(?:from|开始)[:：]\s*(\d{10})`)
	toTimestampFilterRegex   = regexp.MustCompile(`(?i)(?:to|结束)[:：]\s*(\d{10})`)
)

const softFilterCapacity = 8

func buildSimilarityFilter(kb sharedsnapshot.KnowledgeBaseRuntimeSnapshot) *shared.VectorFilter {
	knowledgeCode := kb.Code
	filter := &shared.VectorFilter{
		Must: []shared.FieldFilter{{
			Key: constants.KnowledgeCodeField,
			Match: shared.Match{
				EqString: &knowledgeCode,
			},
		}},
	}
	if kb.OrganizationCode != "" {
		orgCode := kb.OrganizationCode
		filter.Must = append(filter.Must, shared.FieldFilter{
			Key: constants.OrganizationCodeField,
			Match: shared.Match{
				EqString: &orgCode,
			},
		})
	}
	return filter
}

func mergeVectorFilters(base, extra *shared.VectorFilter) *shared.VectorFilter {
	if base == nil && extra == nil {
		return nil
	}
	if base == nil {
		return cloneVectorFilter(extra)
	}
	if extra == nil {
		return cloneVectorFilter(base)
	}
	merged := &shared.VectorFilter{
		Must:    make([]shared.FieldFilter, 0, len(base.Must)+len(extra.Must)),
		Should:  make([]shared.FieldFilter, 0, len(base.Should)+len(extra.Should)),
		MustNot: make([]shared.FieldFilter, 0, len(base.MustNot)+len(extra.MustNot)),
	}
	merged.Must = append(merged.Must, base.Must...)
	merged.Must = append(merged.Must, extra.Must...)
	merged.Should = append(merged.Should, base.Should...)
	merged.Should = append(merged.Should, extra.Should...)
	merged.MustNot = append(merged.MustNot, base.MustNot...)
	merged.MustNot = append(merged.MustNot, extra.MustNot...)
	return merged
}

func cloneVectorFilter(filter *shared.VectorFilter) *shared.VectorFilter {
	if filter == nil {
		return nil
	}
	return &shared.VectorFilter{
		Must:    append([]shared.FieldFilter{}, filter.Must...),
		Should:  append([]shared.FieldFilter{}, filter.Should...),
		MustNot: append([]shared.FieldFilter{}, filter.MustNot...),
	}
}

func vectorFilterDebugView(filter *shared.VectorFilter) map[string]any {
	if filter == nil {
		return map[string]any{}
	}
	return map[string]any{
		"must":     fieldFiltersDebugView(filter.Must),
		"should":   fieldFiltersDebugView(filter.Should),
		"must_not": fieldFiltersDebugView(filter.MustNot),
	}
}

func fieldFiltersDebugView(filters []shared.FieldFilter) []map[string]any {
	if len(filters) == 0 {
		return nil
	}
	result := make([]map[string]any, 0, len(filters))
	for _, filter := range filters {
		result = append(result, map[string]any{
			"key":   filter.Key,
			"match": matchDebugView(filter.Match),
		})
	}
	return result
}

func matchDebugView(match shared.Match) map[string]any {
	result := map[string]any{}
	if match.EqString != nil {
		result["eq_string"] = *match.EqString
	}
	if match.EqFloat != nil {
		result["eq_float"] = *match.EqFloat
	}
	if match.EqBool != nil {
		result["eq_bool"] = *match.EqBool
	}
	if len(match.InStrings) > 0 {
		result["in_strings"] = append([]string{}, match.InStrings...)
	}
	if len(match.InFloats) > 0 {
		result["in_floats"] = append([]float64{}, match.InFloats...)
	}
	if match.Range != nil {
		result["range"] = rangeDebugView(match.Range)
	}
	return result
}

func rangeDebugView(value *shared.Range) map[string]float64 {
	if value == nil {
		return nil
	}
	result := map[string]float64{}
	if value.Gt != nil {
		result["gt"] = *value.Gt
	}
	if value.Gte != nil {
		result["gte"] = *value.Gte
	}
	if value.Lt != nil {
		result["lt"] = *value.Lt
	}
	if value.Lte != nil {
		result["lte"] = *value.Lte
	}
	return result
}

func rewriteSimilarityQuery(query string) QueryRewriteResult {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return QueryRewriteResult{Original: query, Rewritten: "", Used: []string{}}
	}

	rewritten := normalizeDenseSimilarityQuery(trimmed)

	if strings.EqualFold(rewritten, trimmed) {
		return QueryRewriteResult{Original: query, Rewritten: "", Used: []string{trimmed}}
	}
	return QueryRewriteResult{
		Original:  query,
		Rewritten: rewritten,
		Used:      uniqueNonEmptyStrings(trimmed, rewritten),
	}
}

func buildQueryVariants(query string) QueryRewriteResult {
	result := rewriteSimilarityQuery(query)
	if len(result.Used) == 0 {
		result.Used = uniqueNonEmptyStrings(strings.TrimSpace(query))
	}
	return result
}

func (f *SimilarityFilters) normalize() {
	if f == nil {
		return
	}
	f.DocumentCodes = uniqueNonEmptyStrings(f.DocumentCodes...)
	f.SectionPaths = uniqueNonEmptyStrings(f.SectionPaths...)
	f.SectionTitles = uniqueNonEmptyStrings(f.SectionTitles...)
	f.Tags = uniqueNonEmptyStrings(f.Tags...)
	f.DocumentTypes = uniqueInts(f.DocumentTypes...)
	f.SectionLevels = uniqueInts(f.SectionLevels...)
}

func (f *SimilarityFilters) empty() bool {
	return f == nil ||
		(len(f.DocumentCodes) == 0 &&
			len(f.DocumentTypes) == 0 &&
			len(f.SectionPaths) == 0 &&
			len(f.SectionTitles) == 0 &&
			len(f.SectionLevels) == 0 &&
			len(f.Tags) == 0 &&
			f.TimeRange == nil)
}

func deriveSoftFiltersFromQuery(query string) *SimilarityFilters {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return nil
	}

	filters := &SimilarityFilters{}
	for _, match := range documentFilterRegex.FindAllStringSubmatch(trimmed, -1) {
		if len(match) > 1 {
			filters.DocumentCodes = append(filters.DocumentCodes, strings.TrimSpace(match[1]))
		}
	}
	for _, match := range sectionFilterRegex.FindAllStringSubmatch(trimmed, -1) {
		if len(match) > 1 {
			sectionValue := normalizeSectionFilterValue(trimSectionFilterTail(match[1]))
			if sectionValue == "" {
				continue
			}
			if strings.Contains(sectionValue, ">") {
				filters.SectionPaths = append(filters.SectionPaths, sectionValue)
				continue
			}
			filters.SectionTitles = append(filters.SectionTitles, sectionValue)
		}
	}
	for _, match := range levelFilterRegex.FindAllStringSubmatch(trimmed, -1) {
		if len(match) <= 1 {
			continue
		}
		if value, err := strconv.Atoi(strings.TrimSpace(match[1])); err == nil {
			filters.SectionLevels = append(filters.SectionLevels, value)
		}
	}

	start := parseUnixTimestamp(fromTimestampFilterRegex.FindStringSubmatch(trimmed))
	end := parseUnixTimestamp(toTimestampFilterRegex.FindStringSubmatch(trimmed))
	if start > 0 || end > 0 {
		filters.TimeRange = &SimilarityTimeRange{
			StartUnix: start,
			EndUnix:   end,
		}
	}

	filters.normalize()
	if filters.empty() {
		return nil
	}
	return filters
}

func parseUnixTimestamp(match []string) int64 {
	if len(match) <= 1 {
		return 0
	}
	value := strings.TrimSpace(match[1])
	if value == "" {
		return 0
	}
	unix, err := strconv.ParseInt(value, 10, 64)
	if err != nil || unix <= 0 {
		return 0
	}
	return unix
}

func buildSoftSimilarityFilter(filters *SimilarityFilters) *shared.VectorFilter {
	if filters == nil || filters.empty() {
		return nil
	}
	must := make([]shared.FieldFilter, 0, softFilterCapacity)
	appendStringListFilter(&must, constants.DocumentCodeField, filters.DocumentCodes)
	appendFloatListFilter(&must, "document_type", filters.DocumentTypes)
	appendStringListFilter(&must, "section_path", filters.SectionPaths)
	appendStringListFilter(&must, "section_title", filters.SectionTitles)
	appendFloatListFilter(&must, "metadata.section_level", filters.SectionLevels)
	appendStringListFilter(&must, "metadata.tags", filters.Tags)
	appendTimeRangeFilter(&must, filters.TimeRange)
	if len(must) == 0 {
		return nil
	}
	return &shared.VectorFilter{Must: must}
}

func appendStringListFilter(target *[]shared.FieldFilter, key string, values []string) {
	if len(values) == 0 {
		return
	}
	*target = append(*target, shared.FieldFilter{
		Key: key,
		Match: shared.Match{
			InStrings: values,
		},
	})
}

func appendFloatListFilter(target *[]shared.FieldFilter, key string, values []int) {
	if len(values) == 0 {
		return
	}
	floatValues := make([]float64, 0, len(values))
	for _, value := range values {
		floatValues = append(floatValues, float64(value))
	}
	*target = append(*target, shared.FieldFilter{
		Key: key,
		Match: shared.Match{
			InFloats: floatValues,
		},
	})
}

func appendTimeRangeFilter(target *[]shared.FieldFilter, timeRange *SimilarityTimeRange) {
	if timeRange == nil {
		return
	}
	rangeFilter := &shared.Range{}
	if timeRange.StartUnix > 0 {
		start := float64(timeRange.StartUnix)
		rangeFilter.Gte = &start
	}
	if timeRange.EndUnix > 0 {
		end := float64(timeRange.EndUnix)
		rangeFilter.Lte = &end
	}
	if isSimilarityRangeEmpty(rangeFilter) {
		return
	}
	*target = append(*target, shared.FieldFilter{
		Key: "metadata.created_at_ts",
		Match: shared.Match{
			Range: rangeFilter,
		},
	})
}

func isSimilarityRangeEmpty(value *shared.Range) bool {
	return value == nil || (value.Lt == nil && value.Gt == nil && value.Gte == nil && value.Lte == nil)
}

func buildFilterPlan(kb sharedsnapshot.KnowledgeBaseRuntimeSnapshot, explicitFilters *SimilarityFilters, query string) FilterPlan {
	hard := mergeVectorFilters(
		buildSimilarityFilter(kb),
		buildSoftSimilarityFilter(explicitFilters),
	)
	soft := buildSoftSimilarityFilter(deriveSoftFiltersFromQuery(query))
	return FilterPlan{
		Hard: hard,
		Soft: soft,
	}
}

func normalizeSectionFilterValue(value string) string {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return ""
	}
	replacer := strings.NewReplacer("／", "/", ">", " > ", "/", " > ", "＞", " > ")
	return normalizeWhitespace(replacer.Replace(normalized))
}

func trimSectionFilterTail(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	markers := []string{
		" level:", " 层级:", " from:", " 开始:", " to:", " 结束:", " doc:", " document:", " 文档:",
		"，", ",", "；", ";",
	}
	lower := strings.ToLower(trimmed)
	cutIndex := len(trimmed)
	for _, marker := range markers {
		index := strings.Index(lower, marker)
		if index >= 0 && index < cutIndex {
			cutIndex = index
		}
	}
	return strings.TrimSpace(trimmed[:cutIndex])
}

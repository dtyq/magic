package sourcebinding

import (
	"maps"
	"strings"

	sourcebindingentity "magic/internal/domain/knowledge/sourcebinding/entity"
)

const knowledgeBaseTypeFlowVector = "flow_vector"

// NormalizeBindingsForKnowledgeBaseType 按知识库产品线规范化来源绑定。
//
// 注意：Teamshare 只是来源 provider，不是产品线。
// flow 向量知识库没有“手动/实时同步”开关，绑定 Teamshare 时业务语义固定是 realtime；
// 数字员工知识库也能绑定 Teamshare，但它有手动/实时开关，必须保留用户配置。
func NormalizeBindingsForKnowledgeBaseType(
	knowledgeBaseType string,
	bindings []sourcebindingentity.Binding,
) []sourcebindingentity.Binding {
	if len(bindings) == 0 {
		return nil
	}

	normalized := make([]sourcebindingentity.Binding, 0, len(bindings))
	for _, binding := range bindings {
		binding = cloneBindingForProductLinePolicy(binding)
		binding = sourcebindingentity.NormalizeBinding(binding)
		// 这里只按 knowledge_base_type 决定是否强制 realtime，不能按 provider=teamshare 一刀切；
		// 否则会把数字员工知识库的 Teamshare 手动同步开关误改成实时同步。
		if isFlowVectorKnowledgeBaseType(knowledgeBaseType) &&
			binding.Provider == sourcebindingentity.ProviderTeamshare {
			binding.SyncMode = sourcebindingentity.SyncModeRealtime
		}
		normalized = append(normalized, binding)
	}
	return normalized
}

// FlowTeamshareBindingIDsNeedingRealtime 找出应被历史修正为 realtime 的 flow Teamshare 绑定。
//
// 历史数据里 flow Teamshare binding 可能被错误保存成 manual，导致 third-file 回调被
// ListRealtime* 查询过滤掉；这里仅筛出 flow 的历史脏数据，数字员工 manual 必须保持不动。
func FlowTeamshareBindingIDsNeedingRealtime(
	knowledgeBaseTypesByCode map[string]string,
	bindings []sourcebindingentity.Binding,
) []int64 {
	if len(bindings) == 0 || len(knowledgeBaseTypesByCode) == 0 {
		return nil
	}

	seen := make(map[int64]struct{}, len(bindings))
	result := make([]int64, 0, len(bindings))
	for _, binding := range bindings {
		binding = sourcebindingentity.NormalizeBinding(binding)
		if binding.ID <= 0 ||
			!binding.Enabled ||
			binding.Provider != sourcebindingentity.ProviderTeamshare ||
			binding.SyncMode == sourcebindingentity.SyncModeRealtime {
			continue
		}
		if !isFlowVectorKnowledgeBaseType(knowledgeBaseTypesByCode[strings.TrimSpace(binding.KnowledgeBaseCode)]) {
			continue
		}
		if _, exists := seen[binding.ID]; exists {
			continue
		}
		seen[binding.ID] = struct{}{}
		result = append(result, binding.ID)
	}
	return result
}

func cloneBindingForProductLinePolicy(binding sourcebindingentity.Binding) sourcebindingentity.Binding {
	binding.SyncConfig = maps.Clone(binding.SyncConfig)
	binding.Targets = append([]sourcebindingentity.BindingTarget(nil), binding.Targets...)
	return binding
}

func isFlowVectorKnowledgeBaseType(knowledgeBaseType string) bool {
	switch strings.ToLower(strings.TrimSpace(knowledgeBaseType)) {
	case "", knowledgeBaseTypeFlowVector:
		return true
	default:
		return false
	}
}

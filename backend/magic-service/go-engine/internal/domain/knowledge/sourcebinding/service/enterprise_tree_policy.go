package sourcebinding

import (
	"maps"
	"strings"

	sourcebindingentity "magic/internal/domain/knowledge/sourcebinding/entity"
	pkgjsoncompat "magic/internal/pkg/jsoncompat"
)

// EnterpriseBindingExpansionSpec 描述企业知识库 binding 展开时的单个目标规格。
type EnterpriseBindingExpansionSpec struct {
	RootType    string
	RootRef     string
	RootContext map[string]any
}

// BuildEnterpriseBindingExpansionSpecs 将企业知识库 binding 解释为待展开的目标列表。
func BuildEnterpriseBindingExpansionSpecs(
	binding sourcebindingentity.Binding,
) []EnterpriseBindingExpansionSpec {
	binding = sourcebindingentity.NormalizeBinding(binding)
	rootContext := enterpriseBindingRootContext(binding)

	if len(binding.Targets) == 0 {
		if binding.RootRef == "" {
			return []EnterpriseBindingExpansionSpec{}
		}
		return []EnterpriseBindingExpansionSpec{{
			RootType:    binding.RootType,
			RootRef:     binding.RootRef,
			RootContext: rootContext,
		}}
	}

	specs := make([]EnterpriseBindingExpansionSpec, 0, len(binding.Targets))
	for _, target := range binding.Targets {
		targetRef := strings.TrimSpace(target.TargetRef)
		if targetRef == "" {
			continue
		}
		specs = append(specs, EnterpriseBindingExpansionSpec{
			RootType:    enterpriseTargetRootType(target.TargetType),
			RootRef:     targetRef,
			RootContext: cloneEnterpriseRootContext(rootContext),
		})
	}
	return specs
}

func enterpriseBindingRootContext(binding sourcebindingentity.Binding) map[string]any {
	rootContext := cloneEnterpriseRootContext(mapRootContext(binding.SyncConfig, "root_context"))
	if binding.RootType == sourcebindingentity.RootTypeKnowledgeBase &&
		enterpriseRootContextKnowledgeBaseID(rootContext) == "" &&
		strings.TrimSpace(binding.RootRef) != "" {
		rootContext["knowledge_base_id"] = strings.TrimSpace(binding.RootRef)
	}
	return rootContext
}

func enterpriseTargetRootType(targetType string) string {
	if sourcebindingentity.NormalizeTargetType(targetType) == sourcebindingentity.TargetTypeFolder {
		return sourcebindingentity.RootTypeFolder
	}
	return sourcebindingentity.RootTypeFile
}

func cloneEnterpriseRootContext(input map[string]any) map[string]any {
	if len(input) == 0 {
		return map[string]any{}
	}
	return maps.Clone(input)
}

func mapRootContext(input map[string]any, key string) map[string]any {
	if len(input) == 0 {
		return map[string]any{}
	}
	value, _ := input[key].(map[string]any)
	return value
}

func enterpriseRootContextKnowledgeBaseID(rootContext map[string]any) string {
	value, _, err := pkgjsoncompat.IDStringFromAny(rootContext["knowledge_base_id"], "root_context.knowledge_base_id")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(value)
}

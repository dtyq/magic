package knowledgebase

import (
	"errors"
	"strings"
)

// ErrDigitalEmployeeSourceTypeRequired 表示数字员工知识库必须显式传 source_type。
var ErrDigitalEmployeeSourceTypeRequired = errors.New("source_type is required for digital employee knowledge base")

// ErrAmbiguousFlowSourceType 表示 flow 缺失 source_type 时，无法从绑定语义唯一推断来源。
var ErrAmbiguousFlowSourceType = errors.New("flow source_type cannot be inferred from mixed local and enterprise bindings")

// SourceBindingHint 表示 source binding 的最小语义信息，用于推断 source_type。
type SourceBindingHint struct {
	Provider string
	RootType string
}

// NormalizeOrInferSourceType 按“已确定的产品线”统一校验 source_type，必要时从 binding 语义推断。
//
// 这个入口只负责两件事：
// 1. 判断当前产品线是否允许缺失 source_type
// 2. 在 flow_vector 且缺失时，根据 binding 语义推断 local / enterprise
//
// 它不会根据 source_type 或 binding 反推产品线。
func NormalizeOrInferSourceType(
	knowledgeBaseType Type,
	sourceType *int,
	bindingHints []SourceBindingHint,
) (*int, error) {
	normalizedType, err := NormalizeKnowledgeBaseType(knowledgeBaseType)
	if err != nil {
		return nil, err
	}

	if sourceType != nil {
		return NormalizeSourceType(normalizedType, sourceType)
	}

	switch normalizedType {
	case KnowledgeBaseTypeDigitalEmployee:
		return nil, ErrDigitalEmployeeSourceTypeRequired
	case KnowledgeBaseTypeFlowVector:
		return InferFlowSourceTypeFromBindingHints(bindingHints)
	default:
		return nil, ErrInvalidKnowledgeBaseType
	}
}

// InferFlowSourceTypeFromBindingHints 按 binding 语义推断 flow 向量知识库来源。
func InferFlowSourceTypeFromBindingHints(bindingHints []SourceBindingHint) (*int, error) {
	hasEnterpriseBinding := false
	hasLocalLikeBinding := false

	for _, bindingHint := range bindingHints {
		if isEnterpriseSourceBindingHint(bindingHint) {
			hasEnterpriseBinding = true
			continue
		}
		hasLocalLikeBinding = true
	}

	switch {
	case hasEnterpriseBinding && hasLocalLikeBinding:
		return nil, ErrAmbiguousFlowSourceType
	case hasEnterpriseBinding:
		sourceType := int(SourceTypeLegacyEnterpriseWiki)
		return &sourceType, nil
	default:
		sourceType := defaultSourceType()
		return &sourceType, nil
	}
}

func isEnterpriseSourceBindingHint(bindingHint SourceBindingHint) bool {
	return normalizeSourceBindingHintValue(bindingHint.Provider) == "teamshare" &&
		normalizeSourceBindingHintValue(bindingHint.RootType) == "knowledge_base"
}

func normalizeSourceBindingHintValue(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

package kbapp

import (
	"fmt"

	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
)

type updateSourceTypeInput struct {
	currentSourceType *int
}

func (s *KnowledgeBaseCreateApp) resolveCreateSourceType(
	knowledgeBaseType kbentity.Type,
	inputSourceType *int,
	bindings []sourcebindingdomain.Binding,
) (*int, error) {
	// 创建场景里 source_type 只能在已经判定好的产品线内解释；
	// 例如：无 agent_codes + source_type=4/1001 仍是 flow_vector，而不是数字员工。
	resolvedSourceType, err := kbentity.NormalizeOrInferSourceType(
		knowledgeBaseType,
		inputSourceType,
		sourceBindingHintsFromBindings(bindings),
	)
	if err != nil {
		return nil, fmt.Errorf("normalize source type: %w", err)
	}
	return resolvedSourceType, nil
}

func (s *KnowledgeBaseUpdateApp) resolveUpdateSourceType(
	knowledgeBaseType kbentity.Type,
	input updateSourceTypeInput,
) (*int, error) {
	resolvedSourceType, err := kbentity.NormalizeExistingSourceTypeForKnowledgeBaseType(
		knowledgeBaseType,
		input.currentSourceType,
	)
	if err != nil {
		return nil, fmt.Errorf("normalize source type: %w", err)
	}
	return resolvedSourceType, nil
}

func sourceBindingHintsFromBindings(bindings []sourcebindingdomain.Binding) []kbentity.SourceBindingHint {
	if len(bindings) == 0 {
		return nil
	}

	bindingHints := make([]kbentity.SourceBindingHint, 0, len(bindings))
	for _, binding := range bindings {
		bindingHints = append(bindingHints, kbentity.SourceBindingHint{
			Provider: binding.Provider,
			RootType: binding.RootType,
		})
	}
	return bindingHints
}

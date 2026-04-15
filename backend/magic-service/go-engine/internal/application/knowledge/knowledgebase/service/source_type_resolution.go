package kbapp

import (
	"context"
	"fmt"

	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/service"
)

type updateSourceTypeInput struct {
	inputSourceType   *int
	currentSourceType *int
	knowledgeBaseCode string
	replaceSource     bool
	bindings          []sourcebindingdomain.Binding
}

func (s *KnowledgeBaseCreateApp) resolveCreateSourceType(
	knowledgeBaseType knowledgebasedomain.Type,
	inputSourceType *int,
	bindings []sourcebindingdomain.Binding,
) (*int, error) {
	// 创建场景里 source_type 只能在已经判定好的产品线内解释；
	// 例如：无 agent_codes + source_type=1001 仍是 flow_vector，而不是数字员工。
	resolvedSourceType, err := knowledgebasedomain.NormalizeOrInferSourceType(
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
	ctx context.Context,
	knowledgeBaseType knowledgebasedomain.Type,
	input updateSourceTypeInput,
) (*int, error) {
	if input.inputSourceType != nil {
		// 显式 source_type 优先，但只能在存量产品线内校验，不能借此切换产品线。
		resolvedSourceType, err := knowledgebasedomain.NormalizeSourceType(knowledgeBaseType, input.inputSourceType)
		if err != nil {
			return nil, fmt.Errorf("normalize source type: %w", err)
		}
		return resolvedSourceType, nil
	}

	if input.replaceSource {
		// 替换 binding 且未显式传 source_type 时，只允许 flow 从新 binding 语义推断。
		resolvedSourceType, err := knowledgebasedomain.NormalizeOrInferSourceType(
			knowledgeBaseType,
			nil,
			sourceBindingHintsFromBindings(input.bindings),
		)
		if err != nil {
			return nil, fmt.Errorf("normalize source type: %w", err)
		}
		return resolvedSourceType, nil
	}

	if knowledgeBaseType == knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee {
		return nil, fmt.Errorf("normalize source type: %w", knowledgebasedomain.ErrDigitalEmployeeSourceTypeRequired)
	}

	// flow 未替换 binding 时，优先从当前 binding 语义恢复；再退化到存量 raw source_type 的兼容映射。
	currentBindings, err := s.listCurrentSourceBindings(ctx, input.knowledgeBaseCode)
	if err != nil {
		return nil, err
	}
	if len(currentBindings) > 0 {
		resolvedSourceType, inferErr := knowledgebasedomain.NormalizeOrInferSourceType(
			knowledgeBaseType,
			nil,
			sourceBindingHintsFromBindings(currentBindings),
		)
		if inferErr != nil {
			return nil, fmt.Errorf("normalize source type: %w", inferErr)
		}
		return resolvedSourceType, nil
	}

	resolvedSourceType, err := knowledgebasedomain.NormalizeExistingSourceTypeForKnowledgeBaseType(
		knowledgeBaseType,
		input.currentSourceType,
	)
	if err != nil {
		return nil, fmt.Errorf("normalize source type: %w", err)
	}
	return resolvedSourceType, nil
}

func (s *KnowledgeBaseUpdateApp) listCurrentSourceBindings(
	ctx context.Context,
	knowledgeBaseCode string,
) ([]sourcebindingdomain.Binding, error) {
	if s == nil || s.sourceBindingRepo == nil {
		return nil, nil
	}

	bindings, err := s.sourceBindingRepo.ListBindingsByKnowledgeBase(ctx, knowledgeBaseCode)
	if err != nil {
		return nil, fmt.Errorf("list knowledge base source bindings: %w", err)
	}
	return bindings, nil
}

func sourceBindingHintsFromBindings(bindings []sourcebindingdomain.Binding) []knowledgebasedomain.SourceBindingHint {
	if len(bindings) == 0 {
		return nil
	}

	bindingHints := make([]knowledgebasedomain.SourceBindingHint, 0, len(bindings))
	for _, binding := range bindings {
		bindingHints = append(bindingHints, knowledgebasedomain.SourceBindingHint{
			Provider: binding.Provider,
			RootType: binding.RootType,
		})
	}
	return bindingHints
}

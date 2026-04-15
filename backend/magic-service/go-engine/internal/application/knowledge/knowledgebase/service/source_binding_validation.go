package kbapp

import (
	"fmt"
	"strings"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/service"
)

func validateSourceBindingsForSourceType(
	knowledgeBaseType knowledgebasedomain.Type,
	sourceType *int,
	bindings []sourcebindingdomain.Binding,
) error {
	if sourceType == nil {
		return nil
	}

	// binding 校验只消费“已确定产品线 + 已归一化 source_type”推导出的统一来源语义，
	// 不允许 source binding 自己反过来决定产品线。
	semanticSourceType, err := knowledgebasedomain.ResolveSemanticSourceType(knowledgeBaseType, *sourceType)
	if err != nil {
		return fmt.Errorf("resolve semantic source type: %w", err)
	}

	semantic, err := mapSourceBindingSemantic(semanticSourceType, *sourceType)
	if err != nil {
		return err
	}
	if err := sourcebindingdomain.ValidateBindings(semantic, bindings); err != nil {
		return fmt.Errorf("validate source bindings: %w", err)
	}
	return nil
}

func mapSourceBindingSemantic(
	semanticSourceType knowledgebasedomain.SemanticSourceType,
	sourceType int,
) (sourcebindingdomain.Semantic, error) {
	switch semanticSourceType {
	case knowledgebasedomain.SemanticSourceTypeProject:
		return sourcebindingdomain.SemanticProject, nil
	case knowledgebasedomain.SemanticSourceTypeEnterprise:
		return sourcebindingdomain.SemanticEnterprise, nil
	case knowledgebasedomain.SemanticSourceTypeLocal, knowledgebasedomain.SemanticSourceTypeCustomContent:
		return sourcebindingdomain.SemanticLegacy, nil
	default:
		return "", fmt.Errorf("%w: source_type=%d", ErrSourceBindingSemanticMismatch, sourceType)
	}
}

func normalizeSourceBindingProvider(provider string) string {
	return sourcebindingdomain.NormalizeProvider(provider)
}

func normalizeSourceBindingRootType(rootType string) string {
	return sourcebindingdomain.NormalizeRootType(rootType)
}

func normalizeSourceBindingSyncMode(syncMode string) string {
	return sourcebindingdomain.NormalizeSyncMode(syncMode)
}

func normalizeSourceBindingTargetType(targetType string) string {
	return sourcebindingdomain.NormalizeTargetType(targetType)
}

func normalizeSourceBindingInputs(bindings []kbdto.SourceBindingInput) []sourcebindingdomain.Binding {
	if len(bindings) == 0 {
		return nil
	}

	normalized := make([]sourcebindingdomain.Binding, 0, len(bindings))
	for _, binding := range bindings {
		targets := make([]sourcebindingdomain.BindingTarget, 0, len(binding.Targets))
		for _, target := range binding.Targets {
			targetType := normalizeSourceBindingTargetType(target.TargetType)
			if targetType == "" {
				targetType = strings.ToLower(strings.TrimSpace(target.TargetType))
			}
			targets = append(targets, sourcebindingdomain.BindingTarget{
				TargetType: targetType,
				TargetRef:  strings.TrimSpace(target.TargetRef),
			})
		}

		enabled := true
		if binding.Enabled != nil {
			enabled = *binding.Enabled
		}

		normalized = append(normalized, sourcebindingdomain.Binding{
			Provider:   normalizeSourceBindingProvider(binding.Provider),
			RootType:   normalizeSourceBindingRootType(binding.RootType),
			RootRef:    strings.TrimSpace(binding.RootRef),
			SyncMode:   normalizeSourceBindingSyncMode(binding.SyncMode),
			Enabled:    enabled,
			SyncConfig: cloneMap(binding.SyncConfig),
			Targets:    targets,
		})
	}
	return sourcebindingdomain.NormalizeBindings(normalized)
}

func validateAndNormalizeSourceBindings(
	knowledgeBaseType knowledgebasedomain.Type,
	sourceType *int,
	bindings []kbdto.SourceBindingInput,
) ([]sourcebindingdomain.Binding, error) {
	normalized := normalizeSourceBindingInputs(bindings)
	if err := validateSourceBindingsForSourceType(knowledgeBaseType, sourceType, normalized); err != nil {
		return nil, err
	}
	return normalized, nil
}

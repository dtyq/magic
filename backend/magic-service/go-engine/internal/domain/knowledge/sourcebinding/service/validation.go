package sourcebinding

import (
	"fmt"
	"strings"

	sourcebindingentity "magic/internal/domain/knowledge/sourcebinding/entity"
)

// NormalizeBindings 统一来源绑定格式。
func NormalizeBindings(bindings []sourcebindingentity.Binding) []sourcebindingentity.Binding {
	if len(bindings) == 0 {
		return nil
	}

	normalized := make([]sourcebindingentity.Binding, 0, len(bindings))
	for _, binding := range bindings {
		normalized = append(normalized, sourcebindingentity.NormalizeBinding(binding))
	}
	return normalized
}

// ValidateBindings 校验来源绑定是否符合指定语义。
func ValidateBindings(semantic sourcebindingentity.Semantic, bindings []sourcebindingentity.Binding) error {
	seenRoots := make(map[string]struct{}, len(bindings))
	for idx, binding := range bindings {
		rootKey := bindingRootKey(binding)
		if _, exists := seenRoots[rootKey]; exists {
			return fmt.Errorf("%w: source_bindings[%d]", sourcebindingentity.ErrDuplicateBindingRoot, idx)
		}
		seenRoots[rootKey] = struct{}{}
		switch semantic {
		case sourcebindingentity.SemanticProject:
			if err := validateProjectBinding(idx, binding); err != nil {
				return err
			}
		case sourcebindingentity.SemanticEnterprise:
			if err := validateEnterpriseBinding(idx, binding); err != nil {
				return err
			}
		case sourcebindingentity.SemanticLegacy:
			if err := validateLegacyBinding(idx, binding); err != nil {
				return err
			}
		default:
			return fmt.Errorf("%w: semantic=%s", sourcebindingentity.ErrSemanticMismatch, semantic)
		}
	}
	return nil
}

func bindingRootKey(binding sourcebindingentity.Binding) string {
	return strings.Join([]string{
		sourcebindingentity.NormalizeProvider(binding.Provider),
		sourcebindingentity.NormalizeRootType(binding.RootType),
		strings.TrimSpace(binding.RootRef),
	}, "|")
}

func validateLegacyBinding(idx int, binding sourcebindingentity.Binding) error {
	provider := sourcebindingentity.NormalizeProvider(binding.Provider)
	rootType := sourcebindingentity.NormalizeRootType(binding.RootType)
	if strings.TrimSpace(binding.RootRef) == "" {
		return fmt.Errorf("%w: source_bindings[%d].root_ref", sourcebindingentity.ErrSemanticMismatch, idx)
	}

	switch provider {
	case sourcebindingentity.ProviderLocalUpload:
		if rootType != sourcebindingentity.RootTypeFile {
			return fmt.Errorf("%w: source_bindings[%d]", sourcebindingentity.ErrSemanticMismatch, idx)
		}
		return nil
	case sourcebindingentity.ProviderTeamshare:
		if rootType != sourcebindingentity.RootTypeFile && rootType != sourcebindingentity.RootTypeKnowledgeBase {
			return fmt.Errorf("%w: source_bindings[%d]", sourcebindingentity.ErrSemanticMismatch, idx)
		}
		for targetIdx, target := range binding.Targets {
			targetType := sourcebindingentity.NormalizeTargetType(target.TargetType)
			if targetType != "" && strings.TrimSpace(target.TargetRef) == "" {
				return fmt.Errorf("%w: source_bindings[%d].targets[%d].target_ref", sourcebindingentity.ErrTargetTypeInvalid, idx, targetIdx)
			}
		}
		return nil
	default:
		return fmt.Errorf("%w: source_bindings[%d]", sourcebindingentity.ErrTargetsNotAllowed, idx)
	}
}

func validateProjectBinding(idx int, binding sourcebindingentity.Binding) error {
	provider := sourcebindingentity.NormalizeProvider(binding.Provider)
	rootType := sourcebindingentity.NormalizeRootType(binding.RootType)
	syncMode := sourcebindingentity.NormalizeSyncMode(binding.SyncMode)
	if provider != sourcebindingentity.ProviderProject || rootType != sourcebindingentity.RootTypeProject {
		return fmt.Errorf("%w: source_bindings[%d]", sourcebindingentity.ErrSemanticMismatch, idx)
	}
	if strings.TrimSpace(binding.RootRef) == "" {
		return fmt.Errorf("%w: source_bindings[%d].root_ref", sourcebindingentity.ErrInvalidProjectRootRef, idx)
	}
	if syncMode == "" {
		return fmt.Errorf("%w: source_bindings[%d].sync_mode", sourcebindingentity.ErrSyncModeInvalid, idx)
	}
	return validateFolderOrFileTargets(idx, binding.Targets)
}

func validateEnterpriseBinding(idx int, binding sourcebindingentity.Binding) error {
	provider := sourcebindingentity.NormalizeProvider(binding.Provider)
	rootType := sourcebindingentity.NormalizeRootType(binding.RootType)
	syncMode := sourcebindingentity.NormalizeSyncMode(binding.SyncMode)
	if provider != sourcebindingentity.ProviderTeamshare || rootType != sourcebindingentity.RootTypeKnowledgeBase {
		return fmt.Errorf("%w: source_bindings[%d]", sourcebindingentity.ErrSemanticMismatch, idx)
	}
	if strings.TrimSpace(binding.RootRef) == "" {
		return fmt.Errorf("%w: source_bindings[%d].root_ref", sourcebindingentity.ErrSemanticMismatch, idx)
	}
	if syncMode == "" {
		return fmt.Errorf("%w: source_bindings[%d].sync_mode", sourcebindingentity.ErrSyncModeInvalid, idx)
	}
	return validateFolderOrFileTargets(idx, binding.Targets)
}

func validateFolderOrFileTargets(idx int, targets []sourcebindingentity.BindingTarget) error {
	for targetIdx, target := range targets {
		targetType := sourcebindingentity.NormalizeTargetType(target.TargetType)
		if targetType != sourcebindingentity.TargetTypeFolder && targetType != sourcebindingentity.TargetTypeFile {
			return fmt.Errorf("%w: source_bindings[%d].targets[%d]", sourcebindingentity.ErrTargetTypeInvalid, idx, targetIdx)
		}
		if strings.TrimSpace(target.TargetRef) == "" {
			return fmt.Errorf("%w: source_bindings[%d].targets[%d].target_ref", sourcebindingentity.ErrTargetTypeInvalid, idx, targetIdx)
		}
	}
	return nil
}

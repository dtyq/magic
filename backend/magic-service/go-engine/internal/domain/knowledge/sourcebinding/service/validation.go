package sourcebinding

import (
	"fmt"
	"strings"
)

// NormalizeProvider 统一 provider 格式。
func NormalizeProvider(provider string) string {
	return strings.ToLower(strings.TrimSpace(provider))
}

// NormalizeRootType 统一 root_type 格式。
func NormalizeRootType(rootType string) string {
	return strings.ToLower(strings.TrimSpace(rootType))
}

// NormalizeSyncMode 统一 sync_mode 格式并补齐默认值。
func NormalizeSyncMode(syncMode string) string {
	switch strings.ToLower(strings.TrimSpace(syncMode)) {
	case "":
		return SyncModeManual
	case SyncModeManual, SyncModeRealtime:
		return strings.ToLower(strings.TrimSpace(syncMode))
	default:
		return ""
	}
}

// NormalizeTargetType 统一 target_type 格式。
func NormalizeTargetType(targetType string) string {
	switch strings.ToLower(strings.TrimSpace(targetType)) {
	case "group", TargetTypeFolder:
		return TargetTypeFolder
	case TargetTypeFile:
		return TargetTypeFile
	default:
		return ""
	}
}

// NormalizeBindings 统一来源绑定格式。
func NormalizeBindings(bindings []Binding) []Binding {
	if len(bindings) == 0 {
		return nil
	}

	normalized := make([]Binding, 0, len(bindings))
	for _, binding := range bindings {
		normalized = append(normalized, NormalizeBinding(binding))
	}
	return normalized
}

// ValidateBindings 校验来源绑定是否符合指定语义。
func ValidateBindings(semantic Semantic, bindings []Binding) error {
	for idx, binding := range bindings {
		switch semantic {
		case SemanticProject:
			if err := validateProjectBinding(idx, binding); err != nil {
				return err
			}
		case SemanticEnterprise:
			if err := validateEnterpriseBinding(idx, binding); err != nil {
				return err
			}
		case SemanticLegacy:
			if err := validateLegacyBinding(idx, binding); err != nil {
				return err
			}
		default:
			return fmt.Errorf("%w: semantic=%s", ErrSemanticMismatch, semantic)
		}
	}
	return nil
}

func validateLegacyBinding(idx int, binding Binding) error {
	provider := NormalizeProvider(binding.Provider)
	rootType := NormalizeRootType(binding.RootType)
	if strings.TrimSpace(binding.RootRef) == "" {
		return fmt.Errorf("%w: source_bindings[%d].root_ref", ErrSemanticMismatch, idx)
	}

	switch provider {
	case ProviderLocalUpload:
		if rootType != RootTypeFile {
			return fmt.Errorf("%w: source_bindings[%d]", ErrSemanticMismatch, idx)
		}
		return nil
	case ProviderTeamshare:
		if rootType != RootTypeFile && rootType != RootTypeKnowledgeBase {
			return fmt.Errorf("%w: source_bindings[%d]", ErrSemanticMismatch, idx)
		}
		for targetIdx, target := range binding.Targets {
			targetType := NormalizeTargetType(target.TargetType)
			if targetType != "" && strings.TrimSpace(target.TargetRef) == "" {
				return fmt.Errorf("%w: source_bindings[%d].targets[%d].target_ref", ErrTargetTypeInvalid, idx, targetIdx)
			}
		}
		return nil
	default:
		return fmt.Errorf("%w: source_bindings[%d]", ErrTargetsNotAllowed, idx)
	}
}

func validateProjectBinding(idx int, binding Binding) error {
	provider := NormalizeProvider(binding.Provider)
	rootType := NormalizeRootType(binding.RootType)
	syncMode := NormalizeSyncMode(binding.SyncMode)
	if provider != ProviderProject || rootType != RootTypeProject {
		return fmt.Errorf("%w: source_bindings[%d]", ErrSemanticMismatch, idx)
	}
	if strings.TrimSpace(binding.RootRef) == "" {
		return fmt.Errorf("%w: source_bindings[%d].root_ref", ErrInvalidProjectRootRef, idx)
	}
	if syncMode == "" {
		return fmt.Errorf("%w: source_bindings[%d].sync_mode", ErrSyncModeInvalid, idx)
	}
	for targetIdx, target := range binding.Targets {
		targetType := NormalizeTargetType(target.TargetType)
		if targetType != TargetTypeFolder && targetType != TargetTypeFile {
			return fmt.Errorf("%w: source_bindings[%d].targets[%d]", ErrTargetTypeInvalid, idx, targetIdx)
		}
		if strings.TrimSpace(target.TargetRef) == "" {
			return fmt.Errorf("%w: source_bindings[%d].targets[%d].target_ref", ErrTargetTypeInvalid, idx, targetIdx)
		}
	}
	return nil
}

func validateEnterpriseBinding(idx int, binding Binding) error {
	provider := NormalizeProvider(binding.Provider)
	rootType := NormalizeRootType(binding.RootType)
	syncMode := NormalizeSyncMode(binding.SyncMode)
	if provider != ProviderTeamshare || rootType != RootTypeKnowledgeBase {
		return fmt.Errorf("%w: source_bindings[%d]", ErrSemanticMismatch, idx)
	}
	if strings.TrimSpace(binding.RootRef) == "" {
		return fmt.Errorf("%w: source_bindings[%d].root_ref", ErrSemanticMismatch, idx)
	}
	if syncMode == "" {
		return fmt.Errorf("%w: source_bindings[%d].sync_mode", ErrSyncModeInvalid, idx)
	}
	for targetIdx, target := range binding.Targets {
		targetType := NormalizeTargetType(target.TargetType)
		if targetType != TargetTypeFolder && targetType != TargetTypeFile {
			return fmt.Errorf("%w: source_bindings[%d].targets[%d]", ErrTargetTypeInvalid, idx, targetIdx)
		}
		if strings.TrimSpace(target.TargetRef) == "" {
			return fmt.Errorf("%w: source_bindings[%d].targets[%d].target_ref", ErrTargetTypeInvalid, idx, targetIdx)
		}
	}
	return nil
}

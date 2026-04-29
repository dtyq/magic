package sourcebinding

import (
	"strconv"
	"strings"

	sourcebindingentity "magic/internal/domain/knowledge/sourcebinding/entity"
)

// SourceFileCoverageInput 描述一次来源文件回调对应的当前位置。
type SourceFileCoverageInput struct {
	OrganizationCode   string
	Provider           string
	RootType           string
	RootRef            string
	FileRef            string
	AncestorFolderRefs []string
}

// BindingCoversSourceFile 判断 binding 是否覆盖当前来源文件。
func BindingCoversSourceFile(
	binding sourcebindingentity.Binding,
	input SourceFileCoverageInput,
) bool {
	binding = sourcebindingentity.NormalizeBinding(binding)
	input = normalizeSourceFileCoverageInput(input)
	if input.OrganizationCode == "" || input.Provider == "" || input.FileRef == "" {
		return false
	}
	if !binding.Enabled ||
		binding.OrganizationCode != input.OrganizationCode ||
		binding.Provider != input.Provider ||
		binding.SyncMode != sourcebindingentity.SyncModeRealtime {
		return false
	}

	ancestorRefs := stringSet(input.AncestorFolderRefs)
	switch binding.RootType {
	case sourcebindingentity.RootTypeFile:
		return binding.RootRef == input.FileRef
	case sourcebindingentity.RootTypeFolder:
		_, ok := ancestorRefs[binding.RootRef]
		return ok
	}

	if binding.RootType != input.RootType || binding.RootRef != input.RootRef {
		return false
	}
	if len(binding.Targets) == 0 {
		return true
	}

	for _, target := range binding.Targets {
		targetType := sourcebindingentity.NormalizeTargetType(target.TargetType)
		targetRef := strings.TrimSpace(target.TargetRef)
		if targetRef == "" {
			continue
		}
		switch targetType {
		case sourcebindingentity.TargetTypeFile:
			if targetRef == input.FileRef {
				return true
			}
		case sourcebindingentity.TargetTypeFolder:
			if _, ok := ancestorRefs[targetRef]; ok {
				return true
			}
		}
	}
	return false
}

// Int64Refs 将 int64 ID 列表转换为绑定判定使用的字符串 ref。
func Int64Refs(ids []int64) []string {
	if len(ids) == 0 {
		return nil
	}
	refs := make([]string, 0, len(ids))
	for _, id := range ids {
		if id <= 0 {
			continue
		}
		refs = append(refs, strconv.FormatInt(id, 10))
	}
	return refs
}

func normalizeSourceFileCoverageInput(input SourceFileCoverageInput) SourceFileCoverageInput {
	input.OrganizationCode = strings.TrimSpace(input.OrganizationCode)
	input.Provider = sourcebindingentity.NormalizeProvider(input.Provider)
	input.RootType = sourcebindingentity.NormalizeRootType(input.RootType)
	input.RootRef = strings.TrimSpace(input.RootRef)
	input.FileRef = strings.TrimSpace(input.FileRef)
	input.AncestorFolderRefs = compactStrings(input.AncestorFolderRefs)
	return input
}

func stringSet(values []string) map[string]struct{} {
	result := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		result[value] = struct{}{}
	}
	return result
}

func compactStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

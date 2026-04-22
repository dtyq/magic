package sourcebinding

import (
	"strings"

	thirdfilemappingpkg "magic/internal/pkg/thirdfilemapping"
)

// PlanLegacyTeamshareBindings 根据历史天书片段构造缺失的来源绑定。
func PlanLegacyTeamshareBindings(
	organizationCode string,
	knowledgeBaseCode string,
	userID string,
	existing []Binding,
	groups []thirdfilemappingpkg.RepairGroup,
) []Binding {
	planned := make([]Binding, 0)
	working := make([]Binding, 0, len(existing))
	for _, binding := range existing {
		if strings.TrimSpace(binding.Provider) != ProviderTeamshare {
			continue
		}
		working = append(working, NormalizeBinding(binding))
	}

	for _, group := range groups {
		if strings.TrimSpace(group.ThirdFileID) == "" {
			continue
		}
		if legacyTeamshareBindingCoversGroup(working, group) {
			continue
		}

		binding := BuildLegacyTeamshareBinding(organizationCode, knowledgeBaseCode, userID, group)
		if binding.RootRef == "" {
			continue
		}
		if hasBindingRoot(working, binding) {
			continue
		}
		planned = append(planned, binding)
		working = append(working, binding)
	}

	return planned
}

// BuildLegacyTeamshareBinding 构造单条历史天书来源绑定。
func BuildLegacyTeamshareBinding(
	organizationCode string,
	knowledgeBaseCode string,
	userID string,
	group thirdfilemappingpkg.RepairGroup,
) Binding {
	rootType := RootTypeFile
	rootRef := strings.TrimSpace(group.ThirdFileID)
	if knowledgeBaseID := strings.TrimSpace(group.KnowledgeBaseID); knowledgeBaseID != "" {
		rootType = RootTypeKnowledgeBase
		rootRef = knowledgeBaseID
	} else if groupRef := strings.TrimSpace(group.GroupRef); groupRef != "" {
		rootType = RootTypeFolder
		rootRef = groupRef
	}

	binding := NormalizeBinding(Binding{
		OrganizationCode:  strings.TrimSpace(organizationCode),
		KnowledgeBaseCode: strings.TrimSpace(knowledgeBaseCode),
		Provider:          ProviderTeamshare,
		RootType:          rootType,
		RootRef:           rootRef,
		SyncMode:          SyncModeManual,
		Enabled:           true,
		CreatedUID:        strings.TrimSpace(userID),
		UpdatedUID:        strings.TrimSpace(userID),
	})

	if rootType == RootTypeKnowledgeBase {
		binding.SyncConfig = map[string]any{
			"root_context": map[string]any{
				"knowledge_base_id": rootRef,
			},
		}
	}

	return binding
}

func hasBindingRoot(bindings []Binding, candidate Binding) bool {
	for _, binding := range bindings {
		if strings.TrimSpace(binding.Provider) != strings.TrimSpace(candidate.Provider) {
			continue
		}
		if strings.TrimSpace(binding.RootType) != strings.TrimSpace(candidate.RootType) {
			continue
		}
		if strings.TrimSpace(binding.RootRef) != strings.TrimSpace(candidate.RootRef) {
			continue
		}
		return true
	}
	return false
}

func legacyTeamshareBindingCoversGroup(bindings []Binding, group thirdfilemappingpkg.RepairGroup) bool {
	for _, binding := range bindings {
		if strings.TrimSpace(binding.Provider) != ProviderTeamshare {
			continue
		}
		if legacyTeamshareBindingMatchesGroup(binding, group) {
			return true
		}
	}
	return false
}

func legacyTeamshareBindingMatchesGroup(binding Binding, group thirdfilemappingpkg.RepairGroup) bool {
	rootType := strings.TrimSpace(binding.RootType)
	rootRef := strings.TrimSpace(binding.RootRef)
	if rootRef == "" {
		return false
	}

	switch rootType {
	case RootTypeKnowledgeBase:
		if rootRef != strings.TrimSpace(group.KnowledgeBaseID) {
			return false
		}
	case RootTypeFolder:
		if rootRef != strings.TrimSpace(group.GroupRef) {
			return false
		}
	case RootTypeFile:
		if rootRef != strings.TrimSpace(group.ThirdFileID) {
			return false
		}
	default:
		return false
	}

	if len(binding.Targets) == 0 {
		return true
	}
	for _, target := range binding.Targets {
		switch strings.TrimSpace(target.TargetType) {
		case TargetTypeFile:
			if strings.TrimSpace(target.TargetRef) == strings.TrimSpace(group.ThirdFileID) {
				return true
			}
		case TargetTypeGroup:
			if strings.TrimSpace(target.TargetRef) != "" && strings.TrimSpace(target.TargetRef) == strings.TrimSpace(group.GroupRef) {
				return true
			}
		}
	}
	return false
}

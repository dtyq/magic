package rebuild

import (
	"strings"

	"magic/internal/constants"
)

const (
	cleanupSharedAlias = constants.KnowledgeBaseCollectionName
	cleanupFixedActive = constants.KnowledgeBaseCollectionName + "_active"
	cleanupFixedShadow = constants.KnowledgeBaseCollectionName + "_shadow"
	cleanupApplyPrefix = "KNOWLEDGE"
)

// IsCleanupCandidate 判断集合是否属于重建残留清理候选。
func IsCleanupCandidate(name string) bool {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return false
	}
	switch trimmed {
	case cleanupSharedAlias, cleanupFixedActive, cleanupFixedShadow:
		return false
	}
	return true
}

// DecideCleanupAction 返回候选集合是否允许删除及保留原因。
func DecideCleanupAction(name string, points int64, aliasTarget, metaPhysical string, forceDeleteNonEmpty bool) (bool, string) {
	switch trimmedName := strings.TrimSpace(name); {
	case trimmedName == strings.TrimSpace(aliasTarget):
		return false, "collection is current alias target"
	case trimmedName == strings.TrimSpace(metaPhysical):
		return false, "collection is current meta physical collection"
	case !forceDeleteNonEmpty && points > 0:
		return false, "collection still has points"
	default:
		return true, ""
	}
}

// CanApplyDeleteCollection 判断 apply=true 时是否允许真的删除该集合。
func CanApplyDeleteCollection(name string) bool {
	return strings.HasPrefix(strings.TrimSpace(name), cleanupApplyPrefix)
}

// ShouldDeleteDualWriteState 判断当前 stale dual-write state 是否允许删除。
func ShouldDeleteDualWriteState(currentRunID string, state *VectorDualWriteState) bool {
	if strings.TrimSpace(currentRunID) != "" || state == nil {
		return false
	}
	if strings.TrimSpace(state.RunID) == "" {
		return false
	}
	return !state.Enabled
}

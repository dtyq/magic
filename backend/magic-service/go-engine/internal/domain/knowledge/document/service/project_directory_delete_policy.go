package document

import (
	"strings"

	"magic/internal/pkg/projectfile"
)

// ProjectDirectoryDeleteFileIDs 提取目录删除影响到的后代文件 ID。
func ProjectDirectoryDeleteFileIDs(descendants []projectfile.TreeNode) []int64 {
	ids := make([]int64, 0, len(descendants))
	seen := make(map[int64]struct{}, len(descendants))
	for _, node := range descendants {
		if node.ProjectFileID <= 0 || node.IsDirectory {
			continue
		}
		if _, exists := seen[node.ProjectFileID]; exists {
			continue
		}
		seen[node.ProjectFileID] = struct{}{}
		ids = append(ids, node.ProjectFileID)
	}
	return ids
}

// FilterProjectDirectoryDeleteBindingRefs 筛选目录删除需要清理的项目来源绑定。
func FilterProjectDirectoryDeleteBindingRefs(
	bindings []ProjectFileBindingRef,
	directoryID int64,
	ancestorFolderRefs []string,
	descendants []projectfile.TreeNode,
) []ProjectFileBindingRef {
	if directoryID <= 0 || len(bindings) == 0 {
		return nil
	}

	scope := buildProjectDirectoryDeleteScope(directoryID, ancestorFolderRefs, descendants)
	results := make([]ProjectFileBindingRef, 0, len(bindings))
	for _, binding := range bindings {
		if !isRealtimeProjectBinding(binding) {
			continue
		}
		if projectDirectoryDeleteCoversBinding(binding, scope) {
			results = append(results, binding)
		}
	}
	return results
}

type projectDirectoryDeleteScope struct {
	directoryRef string
	fileRefs     map[string]struct{}
	folderRefs   map[string]struct{}
	ancestorRefs map[string]struct{}
}

func buildProjectDirectoryDeleteScope(
	directoryID int64,
	ancestorFolderRefs []string,
	descendants []projectfile.TreeNode,
) projectDirectoryDeleteScope {
	scope := projectDirectoryDeleteScope{
		directoryRef: projectfileRef(directoryID),
		fileRefs:     make(map[string]struct{}, len(descendants)),
		folderRefs:   make(map[string]struct{}, len(descendants)+1),
		ancestorRefs: make(map[string]struct{}, len(ancestorFolderRefs)),
	}
	if scope.directoryRef != "" {
		scope.folderRefs[scope.directoryRef] = struct{}{}
	}
	for _, ref := range ancestorFolderRefs {
		ref = strings.TrimSpace(ref)
		if ref == "" {
			continue
		}
		scope.ancestorRefs[ref] = struct{}{}
	}
	for _, node := range descendants {
		ref := projectfileRef(node.ProjectFileID)
		if ref == "" {
			continue
		}
		if node.IsDirectory {
			scope.folderRefs[ref] = struct{}{}
		} else {
			scope.fileRefs[ref] = struct{}{}
		}
	}
	return scope
}

func projectDirectoryDeleteCoversBinding(
	binding ProjectFileBindingRef,
	scope projectDirectoryDeleteScope,
) bool {
	rootType := strings.ToLower(strings.TrimSpace(binding.RootType))
	rootRef := strings.TrimSpace(binding.RootRef)
	switch rootType {
	case "project":
		if len(binding.Targets) == 0 {
			return true
		}
		return projectDirectoryDeleteTargetsCovered(binding.Targets, scope)
	case "folder":
		return projectDirectoryDeleteFolderCovered(rootRef, scope)
	case "file":
		return projectDirectoryDeleteFileCovered(rootRef, scope)
	default:
		return false
	}
}

func projectDirectoryDeleteTargetsCovered(
	targets []ProjectFileBindingTarget,
	scope projectDirectoryDeleteScope,
) bool {
	for _, target := range targets {
		targetType := strings.ToLower(strings.TrimSpace(target.TargetType))
		targetRef := strings.TrimSpace(target.TargetRef)
		switch targetType {
		case "folder", "group":
			if projectDirectoryDeleteFolderCovered(targetRef, scope) {
				return true
			}
		case "file":
			if projectDirectoryDeleteFileCovered(targetRef, scope) {
				return true
			}
		}
	}
	return false
}

func projectDirectoryDeleteFolderCovered(ref string, scope projectDirectoryDeleteScope) bool {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return false
	}
	if _, exists := scope.folderRefs[ref]; exists {
		return true
	}
	_, exists := scope.ancestorRefs[ref]
	return exists
}

func projectDirectoryDeleteFileCovered(ref string, scope projectDirectoryDeleteScope) bool {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return false
	}
	_, exists := scope.fileRefs[ref]
	return exists
}

func isRealtimeProjectBinding(binding ProjectFileBindingRef) bool {
	return binding.Enabled &&
		strings.EqualFold(strings.TrimSpace(binding.Provider), "project") &&
		strings.EqualFold(strings.TrimSpace(binding.SyncMode), "realtime")
}

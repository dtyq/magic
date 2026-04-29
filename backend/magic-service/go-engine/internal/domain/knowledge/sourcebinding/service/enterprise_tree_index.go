package sourcebinding

import (
	"errors"
	"fmt"
	"strings"

	"magic/internal/pkg/thirdplatform"
)

var (
	errEnterpriseTreeNodeMissingThirdFileID = errors.New("enterprise tree node missing third file id")
	errEnterpriseTreeNodeMissingValidPath   = errors.New("enterprise tree node missing valid path")
	errEnterpriseTreeNodeMissingPathRoot    = errors.New("enterprise tree node missing knowledge base path root")
	errEnterpriseTreeNodeKnowledgeBaseDrift = errors.New("enterprise tree node knowledge base mismatch")
	errEnterpriseTreeNodePathLeafMismatch   = errors.New("enterprise tree node path leaf mismatch")
	errEnterpriseTreeNodeMissingPathParent  = errors.New("enterprise tree node missing path parent")
)

// EnterpriseTreeIndex 表示由 Teamshare raw cascade path 计算出的目录索引。
type EnterpriseTreeIndex struct {
	KnowledgeBaseID            string                              `json:"knowledge_base_id,omitempty"`
	ChildrenByParentRef        map[string][]thirdplatform.TreeNode `json:"children_by_parent_ref"`
	KnowledgeBaseIDByFolderRef map[string]string                   `json:"knowledge_base_id_by_folder_ref"`
}

// BuildEnterpriseTreeIndex 根据 Teamshare raw cascade 的 path 计算直接父子关系。
func BuildEnterpriseTreeIndex(items []thirdplatform.TreeNode) (*EnterpriseTreeIndex, error) {
	index := &EnterpriseTreeIndex{
		ChildrenByParentRef:        make(map[string][]thirdplatform.TreeNode),
		KnowledgeBaseIDByFolderRef: make(map[string]string),
	}
	if len(items) == 0 {
		return index, nil
	}

	seenRefs := make(map[string]struct{}, len(items))
	for _, item := range items {
		nodeRef := strings.TrimSpace(item.ThirdFileID)
		if nodeRef == "" {
			return nil, errEnterpriseTreeNodeMissingThirdFileID
		}

		path := normalizeEnterpriseTreePath(item.Path)
		if len(path) < 2 {
			return nil, fmt.Errorf("%w: node_ref=%s", errEnterpriseTreeNodeMissingValidPath, nodeRef)
		}

		rootID := strings.TrimSpace(path[0].ID)
		if rootID == "" {
			return nil, fmt.Errorf("%w: node_ref=%s", errEnterpriseTreeNodeMissingPathRoot, nodeRef)
		}
		if index.KnowledgeBaseID == "" {
			index.KnowledgeBaseID = rootID
		} else if index.KnowledgeBaseID != rootID {
			return nil, fmt.Errorf(
				"%w: node_ref=%s, actual=%s, expected=%s",
				errEnterpriseTreeNodeKnowledgeBaseDrift,
				nodeRef,
				rootID,
				index.KnowledgeBaseID,
			)
		}

		lastNodeID := strings.TrimSpace(path[len(path)-1].ID)
		if lastNodeID == "" || lastNodeID != nodeRef {
			return nil, fmt.Errorf(
				"%w: node_ref=%s, path_leaf=%s",
				errEnterpriseTreeNodePathLeafMismatch,
				nodeRef,
				lastNodeID,
			)
		}

		parentRef := strings.TrimSpace(path[len(path)-2].ID)
		if parentRef == "" {
			return nil, fmt.Errorf("%w: node_ref=%s", errEnterpriseTreeNodeMissingPathParent, nodeRef)
		}

		item.KnowledgeBaseID = strings.TrimSpace(item.KnowledgeBaseID)
		if item.KnowledgeBaseID == "" {
			item.KnowledgeBaseID = rootID
		}
		item.ParentID = parentRef

		if _, exists := seenRefs[nodeRef]; !exists {
			index.ChildrenByParentRef[parentRef] = append(index.ChildrenByParentRef[parentRef], item)
			seenRefs[nodeRef] = struct{}{}
		}
		if item.IsDirectory {
			index.KnowledgeBaseIDByFolderRef[nodeRef] = rootID
		}
	}

	return index, nil
}

// DirectChildren 返回指定 parentRef 的直接子节点。
func (i *EnterpriseTreeIndex) DirectChildren(parentRef string) []thirdplatform.TreeNode {
	if i == nil {
		return nil
	}
	return append([]thirdplatform.TreeNode(nil), i.ChildrenByParentRef[strings.TrimSpace(parentRef)]...)
}

// KnowledgeBaseIDForFolder 返回 folderRef 所属的 knowledge base ID。
func (i *EnterpriseTreeIndex) KnowledgeBaseIDForFolder(folderRef string) (string, bool) {
	if i == nil {
		return "", false
	}
	knowledgeBaseID, ok := i.KnowledgeBaseIDByFolderRef[strings.TrimSpace(folderRef)]
	if !ok || strings.TrimSpace(knowledgeBaseID) == "" {
		return "", false
	}
	return knowledgeBaseID, true
}

func normalizeEnterpriseTreePath(path []thirdplatform.PathNode) []thirdplatform.PathNode {
	if len(path) == 0 {
		return nil
	}

	normalized := make([]thirdplatform.PathNode, 0, len(path))
	skippingPrefix := true
	for _, node := range path {
		nodeID := strings.TrimSpace(node.ID)
		nodeType := strings.TrimSpace(node.Type)
		if skippingPrefix && (nodeID == "" || nodeID == "0" || strings.EqualFold(nodeType, "space")) {
			continue
		}
		skippingPrefix = false
		normalized = append(normalized, node)
	}
	return normalized
}

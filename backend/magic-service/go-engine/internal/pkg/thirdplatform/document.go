// Package thirdplatform 定义第三方文档解析的共享请求/响应模型。
package thirdplatform

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
)

const (
	// DocumentSourceKindRawContent 表示第三方侧直接返回原始文本内容。
	DocumentSourceKindRawContent = "raw_content"
	// DocumentSourceKindDownloadURL 表示第三方侧返回待解析文件下载地址。
	DocumentSourceKindDownloadURL = "download_url"
)

var errUnsupportedJSONStringValue = errors.New("unsupported JSON string value")

// ErrDocumentUnavailable 表示第三方来源绑定指向的文件当前不可用。
var ErrDocumentUnavailable = errors.New("third-platform document unavailable")

// ErrPermissionDenied 表示当前第三方平台身份无权访问目标资源。
var ErrPermissionDenied = errors.New("third-platform permission denied")

// ErrIdentityMissing 表示请求缺少第三方平台身份信息。
var ErrIdentityMissing = errors.New("third-platform identity missing")

// DocumentResolveInput 表示一次第三方文档解析请求。
type DocumentResolveInput struct {
	OrganizationCode              string
	UserID                        string
	ThirdPlatformUserID           string
	ThirdPlatformOrganizationCode string
	KnowledgeBaseCode             string
	ThirdPlatformType             string
	ThirdFileID                   string
	DocumentFile                  map[string]any
}

// KnowledgeBaseListInput 表示一次第三方知识库列表请求。
type KnowledgeBaseListInput struct {
	OrganizationCode              string
	UserID                        string
	ThirdPlatformUserID           string
	ThirdPlatformOrganizationCode string
}

// TreeNodeListInput 表示一次第三方知识库树节点请求。
type TreeNodeListInput struct {
	OrganizationCode              string
	UserID                        string
	ThirdPlatformUserID           string
	ThirdPlatformOrganizationCode string
	ParentType                    string
	ParentRef                     string
}

// NodeResolveInput 表示一次第三方单文件元信息请求。
type NodeResolveInput struct {
	OrganizationCode              string
	UserID                        string
	ThirdPlatformUserID           string
	ThirdPlatformOrganizationCode string
	ThirdPlatformType             string
	ThirdFileID                   string
	KnowledgeBaseID               string
}

// DocumentResolveResult 表示第三方文档解析结果。
type DocumentResolveResult struct {
	SourceKind   string
	RawContent   string
	DownloadURL  string
	DownloadURLs []string
	Content      string
	DocType      int
	DocumentFile map[string]any
}

// KnowledgeBaseItem 表示企业知识库选择器中的知识库节点。
type KnowledgeBaseItem struct {
	KnowledgeBaseID string `json:"knowledge_base_id"`
	Name            string `json:"name"`
	Description     string `json:"description"`
}

// TreeNode 表示企业知识库树中的目录或文件节点。
type TreeNode struct {
	ID              string     `json:"id,omitempty"`
	FileID          string     `json:"file_id,omitempty"`
	KnowledgeBaseID string     `json:"knowledge_base_id"`
	ThirdFileID     string     `json:"third_file_id"`
	ParentID        string     `json:"parent_id"`
	Name            string     `json:"name"`
	FileType        string     `json:"file_type"`
	Extension       string     `json:"extension"`
	IsDirectory     bool       `json:"is_directory"`
	Path            []PathNode `json:"path,omitempty"`
}

// NodeResolveResult 表示第三方单文件元信息响应。
type NodeResolveResult struct {
	TreeNode
	DocumentFile map[string]any `json:"document_file,omitempty"`
}

// PathNode 表示 Teamshare raw path 中的单个节点。
type PathNode struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
}

// UnmarshalJSON 兼容 Teamshare raw tree item 中数字或字符串混用的字段。
func (n *TreeNode) UnmarshalJSON(data []byte) error {
	type rawTreeNode struct {
		ID              flexibleString `json:"id"`
		FileID          flexibleString `json:"file_id"`
		KnowledgeBaseID flexibleString `json:"knowledge_base_id"`
		ThirdFileID     flexibleString `json:"third_file_id"`
		ParentID        flexibleString `json:"parent_id"`
		Name            flexibleString `json:"name"`
		FileType        flexibleString `json:"file_type"`
		Extension       flexibleString `json:"extension"`
		IsDirectory     bool           `json:"is_directory"`
		Path            []PathNode     `json:"path"`
	}

	var raw rawTreeNode
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("unmarshal raw tree node: %w", err)
	}
	path := append([]PathNode(nil), raw.Path...)
	knowledgeBaseID := string(raw.KnowledgeBaseID)
	if knowledgeBaseID == "" {
		if rootNode, ok := teamshareKnowledgeBasePathRoot(path); ok {
			knowledgeBaseID = rootNode.ID
		}
	}
	thirdFileID := strings.TrimSpace(string(raw.ID))
	if thirdFileID == "" {
		thirdFileID = strings.TrimSpace(string(raw.FileID))
	}
	if thirdFileID == "" {
		thirdFileID = strings.TrimSpace(string(raw.ThirdFileID))
	}
	fileType := strings.TrimSpace(string(raw.FileType))
	name := strings.TrimSpace(string(raw.Name))
	*n = TreeNode{
		ID:              string(raw.ID),
		FileID:          string(raw.FileID),
		KnowledgeBaseID: knowledgeBaseID,
		ThirdFileID:     thirdFileID,
		ParentID:        string(raw.ParentID),
		Name:            name,
		FileType:        fileType,
		Extension:       resolveTeamshareTreeNodeExtension(string(raw.Extension), name, fileType),
		IsDirectory:     raw.IsDirectory || isDirectoryFileType(fileType),
		Path:            path,
	}
	return nil
}

// UnmarshalJSON 兼容 Teamshare 单文件元信息字段。
func (r *NodeResolveResult) UnmarshalJSON(data []byte) error {
	type rawNodeResolveResult struct {
		DocumentFile map[string]any `json:"document_file"`
	}
	var node TreeNode
	if err := json.Unmarshal(data, &node); err != nil {
		return fmt.Errorf("unmarshal node resolve tree node: %w", err)
	}
	var raw rawNodeResolveResult
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("unmarshal node resolve result: %w", err)
	}
	*r = NodeResolveResult{
		TreeNode:     node,
		DocumentFile: raw.DocumentFile,
	}
	return nil
}

// UnmarshalJSON 兼容 Teamshare raw path node 中数字或字符串混用的字段。
func (n *PathNode) UnmarshalJSON(data []byte) error {
	type rawPathNode struct {
		ID   flexibleString `json:"id"`
		Name flexibleString `json:"name"`
		Type flexibleString `json:"type"`
	}

	var raw rawPathNode
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("unmarshal raw path node: %w", err)
	}
	*n = PathNode{
		ID:   string(raw.ID),
		Name: string(raw.Name),
		Type: string(raw.Type),
	}
	return nil
}

type flexibleString string

func (s *flexibleString) UnmarshalJSON(data []byte) error {
	trimmed := strings.TrimSpace(string(data))
	if trimmed == "" || trimmed == "null" {
		*s = ""
		return nil
	}

	var value string
	if err := json.Unmarshal(data, &value); err == nil {
		*s = flexibleString(value)
		return nil
	}

	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	var number json.Number
	if err := decoder.Decode(&number); err == nil {
		*s = flexibleString(number.String())
		return nil
	}

	var boolean bool
	if err := json.Unmarshal(data, &boolean); err == nil {
		*s = flexibleString(fmt.Sprintf("%t", boolean))
		return nil
	}

	return fmt.Errorf("%w: %s", errUnsupportedJSONStringValue, trimmed)
}

func isDirectoryFileType(fileType string) bool {
	switch strings.TrimSpace(fileType) {
	case "0", "9":
		return true
	default:
		return false
	}
}

func teamshareKnowledgeBasePathRoot(path []PathNode) (PathNode, bool) {
	for _, node := range path {
		nodeID := strings.TrimSpace(node.ID)
		if nodeID == "" || nodeID == "0" {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(node.Type), "space") {
			continue
		}
		return node, true
	}
	return PathNode{}, false
}

func resolveTeamshareTreeNodeExtension(rawExtension, name, fileType string) string {
	if ext := normalizeExtension(rawExtension); ext != "" {
		return ext
	}
	if ext := normalizeExtension(filepath.Ext(strings.TrimSpace(name))); ext != "" {
		return ext
	}
	return teamshareTreeNodeExtensionByFileType(fileType)
}

func normalizeExtension(raw string) string {
	normalized := strings.ToLower(strings.TrimSpace(raw))
	return strings.TrimPrefix(normalized, ".")
}

func teamshareTreeNodeExtensionByFileType(fileType string) string {
	switch strings.TrimSpace(fileType) {
	case "2":
		return "docx"
	case "3":
		return "xlsx"
	case "5":
		return "pptx"
	case "6":
		return "pdf"
	case "7", "15", "16":
		return "md"
	case "22":
		return "tldr"
	case "23":
		return "csv"
	case "27":
		return "json"
	default:
		return ""
	}
}

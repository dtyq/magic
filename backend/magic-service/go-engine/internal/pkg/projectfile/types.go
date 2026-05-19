// Package projectfile 定义项目文件 RPC 交互所需的数据结构。
package projectfile

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
)

// ErrFileUnavailable 表示来源绑定指向的项目文件当前不可用。
var ErrFileUnavailable = errors.New("project file unavailable")

const (
	// docType* 对应 knowledge_base_documents.doc_type 的精确类型值。
	// 这里只表达文件类型，不表达产品线、来源类型或输入三态。
	docTypeUnknown  = 0
	docTypeText     = 1
	docTypeMarkdown = 2
	docTypePDF      = 3
	docTypeHTML     = 4
	docTypeXLSX     = 5
	docTypeXLS      = 6
	docTypeDOC      = 7
	docTypeDOCX     = 8
	docTypeCSV      = 9
	docTypeXML      = 10
	docTypeHTM      = 11
	docTypePPT      = 12
	docTypeJSON     = 13

	// ResolveStatusActive 表示项目文件当前可正常解析。
	ResolveStatusActive = "active"
	// ResolveStatusDeleted 表示项目文件已被删除。
	ResolveStatusDeleted = "deleted"
	// ResolveStatusUnsupported 表示项目文件当前类型不支持解析，应被上游静默跳过。
	ResolveStatusUnsupported = "unsupported"
)

// ResolveResult 表示项目文件解析结果。
type ResolveResult struct {
	Status           string         `json:"status"`
	OrganizationCode string         `json:"organization_code"`
	ProjectID        int64          `json:"project_id"`
	ProjectFileID    int64          `json:"project_file_id"`
	FileKey          string         `json:"file_key"`
	RelativeFilePath string         `json:"relative_file_path"`
	FileName         string         `json:"file_name"`
	FileExtension    string         `json:"file_extension"`
	IsDirectory      bool           `json:"is_directory"`
	UpdatedAt        string         `json:"updated_at"`
	Content          string         `json:"content"`
	ContentHash      string         `json:"content_hash"`
	DocType          int            `json:"doc_type"`
	DocumentFile     map[string]any `json:"document_file"`
}

// Meta 表示项目文件的轻量元数据。
type Meta struct {
	Status           string `json:"status"`
	OrganizationCode string `json:"organization_code"`
	ProjectID        int64  `json:"project_id"`
	ProjectFileID    int64  `json:"project_file_id"`
	FileKey          string `json:"file_key"`
	RelativeFilePath string `json:"relative_file_path"`
	FileName         string `json:"file_name"`
	FileExtension    string `json:"file_extension"`
	FileSize         int64  `json:"file_size"`
	IsDirectory      bool   `json:"is_directory"`
	Sort             int64  `json:"sort"`
	UpdatedAt        string `json:"updated_at"`
	DeletedAt        string `json:"deleted_at"`
	ParentID         int64  `json:"parent_id"`
	IsHidden         bool   `json:"is_hidden"`
}

// ListItem 表示项目中的一个叶子文件。
type ListItem struct {
	OrganizationCode string `json:"organization_code"`
	ProjectID        int64  `json:"project_id"`
	ProjectFileID    int64  `json:"project_file_id"`
	FileKey          string `json:"file_key"`
	RelativeFilePath string `json:"relative_file_path"`
	FileName         string `json:"file_name"`
	FileExtension    string `json:"file_extension"`
	UpdatedAt        string `json:"updated_at"`
}

// WorkspaceItem 表示项目绑定选择器中的工作区项。
type WorkspaceItem struct {
	WorkspaceID   int64  `json:"workspace_id"`
	WorkspaceName string `json:"workspace_name"`
	Description   string `json:"description"`
}

// WorkspacePage 表示工作区分页结果。
type WorkspacePage struct {
	Total int64           `json:"total"`
	List  []WorkspaceItem `json:"list"`
}

// ProjectItem 表示项目绑定选择器中的项目项。
type ProjectItem struct {
	WorkspaceID  int64  `json:"workspace_id"`
	ProjectID    int64  `json:"project_id"`
	ProjectName  string `json:"project_name"`
	Description  string `json:"description"`
	WorkspaceRef string `json:"workspace_ref"`
}

// ProjectPage 表示项目分页结果。
type ProjectPage struct {
	Total int64         `json:"total"`
	List  []ProjectItem `json:"list"`
}

// TreeNode 表示项目树中的目录或文件节点。
type TreeNode struct {
	ProjectID        int64  `json:"project_id"`
	ProjectFileID    int64  `json:"project_file_id"`
	ParentID         int64  `json:"parent_id"`
	FileName         string `json:"file_name"`
	FileExtension    string `json:"file_extension"`
	RelativeFilePath string `json:"relative_file_path"`
	IsDirectory      bool   `json:"is_directory"`
	UpdatedAt        string `json:"updated_at"`
}

var projectWorkspacePattern = regexp.MustCompile(`/project_\d+(?:/workspace)?/`)

// NormalizeResolveStatus 规整项目文件解析状态值。
func NormalizeResolveStatus(status string) string {
	return strings.ToLower(strings.TrimSpace(status))
}

// IsDeletedResolveStatus 判断解析状态是否为 deleted。
func IsDeletedResolveStatus(status string) bool {
	return NormalizeResolveStatus(status) == ResolveStatusDeleted
}

// IsUnsupportedResolveStatus 判断解析状态是否为 unsupported。
func IsUnsupportedResolveStatus(status string) bool {
	return NormalizeResolveStatus(status) == ResolveStatusUnsupported
}

// InferRelativeFilePath 从 file_key 推导项目工作区相对路径。
func InferRelativeFilePath(fileKey string) string {
	trimmed := strings.TrimSpace(fileKey)
	if trimmed == "" {
		return ""
	}
	matched := projectWorkspacePattern.FindStringIndex(trimmed)
	if matched == nil {
		return strings.TrimLeft(trimmed, "/")
	}
	relative := trimmed[matched[1]:]
	return strings.TrimLeft(relative, "/")
}

// BuildMetaContentHash 构造基于元数据的稳定变更指纹。
func BuildMetaContentHash(meta *Meta) string {
	if meta == nil {
		return ""
	}
	raw := fmt.Sprintf(
		"%s|%s|%d|%t",
		strings.TrimSpace(meta.FileKey),
		strings.TrimSpace(meta.UpdatedAt),
		meta.FileSize,
		meta.IsDirectory,
	)
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// ResolveDocType 根据文件扩展名推导 knowledge_base_documents.doc_type 精确类型。
func ResolveDocType(extension string) int {
	switch strings.ToLower(strings.TrimSpace(strings.TrimPrefix(extension, "."))) {
	case "txt":
		return docTypeText
	case "markdown", "md":
		return docTypeMarkdown
	case "pdf":
		return docTypePDF
	case "html":
		return docTypeHTML
	case "xlsx":
		return docTypeXLSX
	case "xls":
		return docTypeXLS
	case "doc":
		return docTypeDOC
	case "docx":
		return docTypeDOCX
	case "csv":
		return docTypeCSV
	case "xml":
		return docTypeXML
	case "htm":
		return docTypeHTM
	case "ppt":
		return docTypePPT
	case "json":
		return docTypeJSON
	default:
		return docTypeUnknown
	}
}

// NormalizeExtension 规整文件扩展名。
func NormalizeExtension(name, extension string) string {
	trimmed := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(extension, ".")))
	if trimmed != "" {
		return trimmed
	}
	derived := strings.TrimPrefix(strings.ToLower(filepath.Ext(strings.TrimSpace(name))), ".")
	return strings.TrimSpace(derived)
}

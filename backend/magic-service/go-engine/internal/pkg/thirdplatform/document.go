// Package thirdplatform 定义第三方文档解析的共享请求/响应模型。
package thirdplatform

const (
	// DocumentSourceKindRawContent 表示第三方侧直接返回原始文本内容。
	DocumentSourceKindRawContent = "raw_content"
	// DocumentSourceKindDownloadURL 表示第三方侧返回待解析文件下载地址。
	DocumentSourceKindDownloadURL = "download_url"
)

// DocumentResolveInput 表示一次第三方文档解析请求。
type DocumentResolveInput struct {
	OrganizationCode  string
	UserID            string
	KnowledgeBaseCode string
	ThirdPlatformType string
	ThirdFileID       string
	DocumentFile      map[string]any
}

// DocumentResolveResult 表示第三方文档解析结果。
type DocumentResolveResult struct {
	SourceKind   string
	RawContent   string
	DownloadURL  string
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
	KnowledgeBaseID string `json:"knowledge_base_id"`
	ThirdFileID     string `json:"third_file_id"`
	ParentID        string `json:"parent_id"`
	Name            string `json:"name"`
	FileType        string `json:"file_type"`
	Extension       string `json:"extension"`
	IsDirectory     bool   `json:"is_directory"`
}

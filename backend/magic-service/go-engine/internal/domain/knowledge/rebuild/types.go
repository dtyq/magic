// Package rebuild 定义知识库重建领域共享类型。
package rebuild

import (
	"strings"

	sharedroute "magic/internal/domain/knowledge/shared/route"
)

// RunMode 表示知识库重建模式。
type RunMode string

const (
	// ModeAuto 根据集合元数据自动选择执行模式。
	ModeAuto RunMode = "auto"
	// ModeInplace 表示原地重建。
	ModeInplace RunMode = "inplace"
	// ModeBlueGreen 表示蓝绿重建。
	ModeBlueGreen RunMode = "bluegreen"
)

// ScopeMode 描述本次重建覆盖范围。
type ScopeMode string

const (
	// ScopeModeAll 表示重建全量知识库。
	ScopeModeAll ScopeMode = "all"
	// ScopeModeOrganization 表示仅重建单组织。
	ScopeModeOrganization ScopeMode = "organization"
	// ScopeModeKnowledgeBase 表示仅重建单个知识库下的全部文档。
	ScopeModeKnowledgeBase ScopeMode = "knowledge_base"
	// ScopeModeDocument 表示仅重建单个文档。
	ScopeModeDocument ScopeMode = "document"
	// ScopeModeRequestUserKnowledgeBases 已废弃，保留仅用于兼容历史输入。
	ScopeModeRequestUserKnowledgeBases ScopeMode = "request_user_knowledge_bases"
)

// Scope 描述本次重建的范围。
type Scope struct {
	Mode              ScopeMode `json:"mode"`
	OrganizationCode  string    `json:"organization_code,omitempty"`
	KnowledgeBaseCode string    `json:"knowledge_base_code,omitempty"`
	DocumentCode      string    `json:"document_code,omitempty"`
	// UserID 已废弃，仅保留用于兼容历史输入结构。
	UserID string `json:"user_id,omitempty"`
}

// NormalizeScope 规范化重建范围参数。
func NormalizeScope(scope Scope) Scope {
	n := Scope{
		Mode:              ScopeMode(strings.TrimSpace(string(scope.Mode))),
		OrganizationCode:  strings.TrimSpace(scope.OrganizationCode),
		KnowledgeBaseCode: strings.TrimSpace(scope.KnowledgeBaseCode),
		DocumentCode:      strings.TrimSpace(scope.DocumentCode),
		UserID:            strings.TrimSpace(scope.UserID),
	}

	switch n.Mode {
	case ScopeModeOrganization:
		n.KnowledgeBaseCode = ""
		n.DocumentCode = ""
	case ScopeModeKnowledgeBase:
		n.DocumentCode = ""
	case ScopeModeDocument:
	case ScopeModeRequestUserKnowledgeBases:
		if n.OrganizationCode == "" {
			n.Mode = ScopeModeAll
		} else {
			n.Mode = ScopeModeOrganization
			n.KnowledgeBaseCode = ""
			n.DocumentCode = ""
		}
	case ScopeModeAll:
		n.OrganizationCode = ""
		n.KnowledgeBaseCode = ""
		n.DocumentCode = ""
		n.UserID = ""
	default:
		if n.OrganizationCode != "" {
			n.Mode = ScopeModeOrganization
			n.KnowledgeBaseCode = ""
			n.DocumentCode = ""
		} else {
			n.Mode = ScopeModeAll
		}
	}

	if n.Mode == ScopeModeAll {
		n.OrganizationCode = ""
		n.KnowledgeBaseCode = ""
		n.DocumentCode = ""
		n.UserID = ""
	}
	return n
}

// MigrationStats 记录批量迁移影响的行数。
type MigrationStats struct {
	KnowledgeBaseRows int64 `json:"knowledge_base_rows"`
	DocumentRows      int64 `json:"document_rows"`
}

// DocumentTask 表示待重建的单个文档任务。
type DocumentTask struct {
	ID                   int64  `json:"id"`
	OrganizationCode     string `json:"organization_code"`
	KnowledgeBaseCode    string `json:"knowledge_base_code"`
	DocumentCode         string `json:"document_code"`
	UserID               string `json:"user_id"`
	EmbeddingModel       string `json:"embedding_model"`
	TargetCollection     string `json:"target_collection,omitempty"`
	TargetTermCollection string `json:"target_term_collection,omitempty"`
	TargetModel          string `json:"target_model,omitempty"`
	TargetSparseBackend  string `json:"target_sparse_backend,omitempty"`
}

// CollectionMeta 描述知识库重建相关的集合元数据。
type CollectionMeta = sharedroute.CollectionMeta

// VectorCollectionInfo 描述向量集合状态。
type VectorCollectionInfo struct {
	Name                string
	VectorSize          int64
	Points              int64
	HasNamedDenseVector bool
	HasSparseVector     bool
}

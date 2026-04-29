// Package snapshot provides shared read-only snapshots for knowledge domain data.
package snapshot

import (
	"strings"

	"magic/internal/constants"
	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
)

// KnowledgeBaseRuntimeSnapshot 表示跨子域可共享的知识库只读运行时快照。
type KnowledgeBaseRuntimeSnapshot struct {
	Code             string
	Name             string
	OrganizationCode string
	Model            string
	VectorDB         string
	CreatedUID       string
	UpdatedUID       string
	RetrieveConfig   *shared.RetrieveConfig
	FragmentConfig   *shared.FragmentConfig
	EmbeddingConfig  *shared.EmbeddingConfig
	ResolvedRoute    *sharedroute.ResolvedRoute
}

// DefaultDocumentCode 返回知识库默认文档编码。
func (s *KnowledgeBaseRuntimeSnapshot) DefaultDocumentCode() string {
	if s == nil {
		return ""
	}
	return strings.TrimSpace(s.Code) + "-DEFAULT-DOC"
}

// CollectionName 返回知识库默认逻辑集合名。
func (s *KnowledgeBaseRuntimeSnapshot) CollectionName() string {
	return constants.KnowledgeBaseCollectionName
}

// EffectiveEmbeddingModel 返回当前快照生效的 embedding 模型。
func (s *KnowledgeBaseRuntimeSnapshot) EffectiveEmbeddingModel() string {
	if s == nil {
		return ""
	}
	if s.ResolvedRoute != nil {
		if model := strings.TrimSpace(s.ResolvedRoute.Model); model != "" {
			return model
		}
	}
	if s.EmbeddingConfig != nil {
		if model := strings.TrimSpace(s.EmbeddingConfig.ModelID); model != "" {
			return model
		}
	}
	return strings.TrimSpace(s.Model)
}

// DocumentFile 表示跨子域共享的文档文件快照。
type DocumentFile struct {
	Type            string
	Name            string
	URL             string
	FileKey         string
	Size            int64
	Extension       string
	ThirdID         string
	SourceType      string
	ThirdFileType   string
	KnowledgeBaseID string
}

// KnowledgeDocumentSnapshot 表示跨子域共享的文档只读快照。
type KnowledgeDocumentSnapshot struct {
	OrganizationCode  string
	KnowledgeBaseCode string
	Name              string
	Code              string
	DocType           int
	DocMetadata       map[string]any
	FragmentConfig    *shared.FragmentConfig
	UpdatedUID        string
}

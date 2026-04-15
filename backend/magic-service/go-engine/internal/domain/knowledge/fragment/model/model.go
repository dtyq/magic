// Package model 定义片段子域的基础领域模型。
package model

import (
	"time"

	"github.com/google/uuid"

	sharedentity "magic/internal/domain/knowledge/shared/entity"
)

// KnowledgeBaseFragment 知识库片段实体。
type KnowledgeBaseFragment struct {
	ID                      int64                   `json:"id"`
	OrganizationCode        string                  `json:"organization_code"`
	KnowledgeCode           string                  `json:"knowledge_code"`
	DocumentCode            string                  `json:"document_code"`
	DocumentName            string                  `json:"document_name"`
	DocumentType            int                     `json:"document_type"`
	Content                 string                  `json:"content"`
	Metadata                map[string]any          `json:"metadata"`
	BusinessID              string                  `json:"business_id"`
	SyncStatus              sharedentity.SyncStatus `json:"sync_status"`
	SyncTimes               int                     `json:"sync_times"`
	SyncStatusMessage       string                  `json:"sync_status_message"`
	PointID                 string                  `json:"point_id"`
	Vector                  []float64               `json:"vector"`
	WordCount               int                     `json:"word_count"`
	ChunkIndex              int                     `json:"chunk_index"`
	ContentHash             string                  `json:"content_hash"`
	SplitVersion            string                  `json:"split_version"`
	SectionPath             string                  `json:"section_path"`
	SectionTitle            string                  `json:"section_title"`
	SectionLevel            int                     `json:"section_level"`
	CreatedUID              string                  `json:"created_uid"`
	UpdatedUID              string                  `json:"updated_uid"`
	CreatedAt               time.Time               `json:"created_at"`
	UpdatedAt               time.Time               `json:"updated_at"`
	DeletedAt               *time.Time              `json:"deleted_at"`
	MetadataContractVersion string                  `json:"metadata_contract_version"`
	FallbackFlags           []string                `json:"fallback_flags,omitempty"`
}

// FragmentPayload 定义存储到向量数据库的载荷结构。
type FragmentPayload struct {
	OrganizationCode string         `json:"organization_code"`
	KnowledgeCode    string         `json:"knowledge_code"`
	DocumentCode     string         `json:"document_code"`
	DocumentName     string         `json:"document_name"`
	DocumentType     int            `json:"document_type"`
	FragmentID       int64          `json:"fragment_id"`
	BusinessID       string         `json:"business_id"`
	Content          string         `json:"content"`
	Metadata         map[string]any `json:"metadata"`
	WordCount        int            `json:"word_count"`
	ChunkIndex       int            `json:"chunk_index"`
	ContentHash      string         `json:"content_hash"`
	SplitVersion     string         `json:"split_version"`
	SectionPath      string         `json:"section_path"`
	SectionTitle     string         `json:"section_title"`
}

// SimilarityResult 相似度搜索结果。
type SimilarityResult struct {
	FragmentID    int64          `json:"fragment_id"`
	Content       string         `json:"content"`
	Score         float64        `json:"score"`
	Metadata      map[string]any `json:"metadata"`
	KnowledgeCode string         `json:"knowledge_code"`
	DocumentCode  string         `json:"document_code"`
	DocumentName  string         `json:"document_name"`
	DocumentType  int            `json:"document_type"`
	BusinessID    string         `json:"business_id"`
}

// HybridSearchParams 描述混合检索的 dense/sparse TopK 参数。
type HybridSearchParams struct {
	DenseTopK  int
	SparseTopK int
}

// NewFragment 创建新的片段实体。
func NewFragment(knowledgeCode, documentCode, content string, metadata map[string]any, createdUID string) *KnowledgeBaseFragment {
	now := time.Now()
	return &KnowledgeBaseFragment{
		KnowledgeCode: knowledgeCode,
		DocumentCode:  documentCode,
		Content:       content,
		Metadata:      metadata,
		SyncStatus:    sharedentity.SyncStatusPending,
		PointID:       uuid.New().String(),
		WordCount:     len([]rune(content)),
		CreatedUID:    createdUID,
		UpdatedUID:    createdUID,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
}

// SetVector 设置向量并更新向量字段。
func (f *KnowledgeBaseFragment) SetVector(vector []float64) {
	f.Vector = vector
}

// MarkSyncing 标记为同步中。
func (f *KnowledgeBaseFragment) MarkSyncing() {
	f.SyncStatus = sharedentity.SyncStatusSyncing
	f.SyncTimes++
	f.UpdatedAt = time.Now()
}

// MarkSynced 标记为已同步。
func (f *KnowledgeBaseFragment) MarkSynced() {
	f.SyncStatus = sharedentity.SyncStatusSynced
	f.SyncStatusMessage = ""
	f.UpdatedAt = time.Now()
}

// MarkSyncFailed 标记为同步失败。
func (f *KnowledgeBaseFragment) MarkSyncFailed(message string) {
	f.SyncStatus = sharedentity.SyncStatusSyncFailed
	f.SyncStatusMessage = message
	f.UpdatedAt = time.Now()
}

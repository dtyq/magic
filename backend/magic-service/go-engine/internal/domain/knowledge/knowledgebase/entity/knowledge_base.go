// Package entity 定义知识库领域的实体模型
package entity

import (
	"time"

	"magic/internal/constants"
	sharedentity "magic/internal/domain/knowledge/shared/entity"
)

// KnowledgeBase 知识库实体
type KnowledgeBase struct {
	ID                     int64                         `json:"id"`
	Code                   string                        `json:"code"`
	Version                int                           `json:"version"`
	Name                   string                        `json:"name"`
	Description            string                        `json:"description"`
	Type                   int                           `json:"type"`
	Enabled                bool                          `json:"enabled"`
	BusinessID             string                        `json:"business_id"`
	SyncStatus             sharedentity.SyncStatus       `json:"sync_status"`
	SyncStatusMessage      string                        `json:"sync_status_message"`
	Model                  string                        `json:"model"`
	VectorDB               string                        `json:"vector_db"`
	OrganizationCode       string                        `json:"organization_code"`
	CreatedUID             string                        `json:"created_uid"`
	UpdatedUID             string                        `json:"updated_uid"`
	ExpectedNum            int                           `json:"expected_num"`
	CompletedNum           int                           `json:"completed_num"`
	RetrieveConfig         *sharedentity.RetrieveConfig  `json:"retrieve_config"`
	FragmentConfig         *sharedentity.FragmentConfig  `json:"fragment_config"`
	EmbeddingConfig        *sharedentity.EmbeddingConfig `json:"embedding_config"`
	WordCount              int                           `json:"word_count"`
	Icon                   string                        `json:"icon"`
	SourceType             *int                          `json:"source_type"`
	ResolvedCollectionName string                        `json:"-"`
	CreatedAt              time.Time                     `json:"created_at"`
	UpdatedAt              time.Time                     `json:"updated_at"`
	DeletedAt              *time.Time                    `json:"deleted_at"`
}

// CollectionName 返回知识库在向量数据库中的集合名称
func (kb *KnowledgeBase) CollectionName() string {
	return constants.KnowledgeBaseCollectionName
}

// DefaultDocumentCode 返回知识库默认文档编码。
func (kb *KnowledgeBase) DefaultDocumentCode() string {
	if kb == nil {
		return ""
	}
	return kb.Code + "-DEFAULT-DOC"
}

// 向量维度常量
const (
	VectorSize3Small  int64 = 1536 // text-embedding-3-small 维度
	VectorSize3Large  int64 = 3072 // text-embedding-3-large 维度
	VectorSizeDMeta   int64 = 1024 // dmeta-embedding 维度
	VectorSizeDefault int64 = 1024 // 默认向量维度
)

// GetVectorSize 获取向量维度（根据模型推断）
func (kb *KnowledgeBase) GetVectorSize() int64 {
	// 根据模型名称返回对应维度
	switch kb.Model {
	case "text-embedding-3-small":
		return VectorSize3Small
	case "text-embedding-3-large":
		return VectorSize3Large
	case "dmeta-embedding":
		return VectorSizeDMeta
	default:
		return VectorSizeDefault // 默认维度
	}
}

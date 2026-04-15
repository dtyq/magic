package documentrepo

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"

	documentdomain "magic/internal/domain/knowledge/document/service"
	knowledgeShared "magic/internal/infrastructure/persistence/mysql/knowledge/shared"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/pkg/convert"
)

var errLegacyDocumentDocTypeOverflow = errors.New("legacy document doc_type overflows int32")

// ToKnowledgeBaseDocument 兼容旧 sqlc 模型，供仍未迁移的调用方使用。
func ToKnowledgeBaseDocument(row mysqlsqlc.KnowledgeBaseDocument) (*documentdomain.KnowledgeBaseDocument, error) {
	return toKnowledgeBaseDocumentFromLegacyRow(mysqlsqlc.FindDocumentByCodeAndKnowledgeBaseRow{
		ID:                row.ID,
		OrganizationCode:  row.OrganizationCode,
		KnowledgeBaseCode: row.KnowledgeBaseCode,
		SourceBindingID:   row.SourceBindingID,
		SourceItemID:      row.SourceItemID,
		AutoAdded:         row.AutoAdded,
		Name:              row.Name,
		Description:       row.Description,
		Code:              row.Code,
		Enabled:           row.Enabled,
		DocType:           row.DocType,
		DocMetadata:       row.DocMetadata,
		DocumentFile:      row.DocumentFile,
		SyncStatus:        row.SyncStatus,
		SyncTimes:         row.SyncTimes,
		SyncStatusMessage: row.SyncStatusMessage,
		EmbeddingModel:    row.EmbeddingModel,
		VectorDb:          row.VectorDb,
		RetrieveConfig:    row.RetrieveConfig,
		FragmentConfig:    row.FragmentConfig,
		EmbeddingConfig:   row.EmbeddingConfig,
		VectorDbConfig:    row.VectorDbConfig,
		WordCount:         row.WordCount,
		CreatedUid:        row.CreatedUid,
		UpdatedUid:        row.UpdatedUid,
		CreatedAt:         row.CreatedAt,
		UpdatedAt:         row.UpdatedAt,
		DeletedAt:         row.DeletedAt,
	})
}

// ToKnowledgeBaseDocumentByCodeAndKnowledgeBase 兼容旧 sqlc 查询行，供遗留事务路径继续编译。
func ToKnowledgeBaseDocumentByCodeAndKnowledgeBase(
	row mysqlsqlc.FindDocumentByCodeAndKnowledgeBaseRow,
) (*documentdomain.KnowledgeBaseDocument, error) {
	return toKnowledgeBaseDocumentFromLegacyRow(row)
}

func toKnowledgeBaseDocumentFromLegacyRow(row mysqlsqlc.FindDocumentByCodeAndKnowledgeBaseRow) (*documentdomain.KnowledgeBaseDocument, error) {
	if row.DocType > math.MaxInt32 {
		return nil, fmt.Errorf("%w: %d", errLegacyDocumentDocTypeOverflow, row.DocType)
	}
	record := documentRecord{
		ID:                row.ID,
		OrganizationCode:  row.OrganizationCode,
		KnowledgeBaseCode: row.KnowledgeBaseCode,
		SourceBindingID:   row.SourceBindingID,
		SourceItemID:      row.SourceItemID,
		AutoAdded:         row.AutoAdded,
		Name:              row.Name,
		Description:       row.Description,
		Code:              row.Code,
		Enabled:           row.Enabled,
		DocType:           int32(row.DocType),
		DocMetadata:       row.DocMetadata,
		DocumentFile:      row.DocumentFile,
		SyncStatus:        row.SyncStatus,
		SyncTimes:         row.SyncTimes,
		SyncStatusMessage: row.SyncStatusMessage,
		EmbeddingModel:    row.EmbeddingModel,
		VectorDB:          row.VectorDb,
		RetrieveConfig:    row.RetrieveConfig,
		FragmentConfig:    row.FragmentConfig,
		EmbeddingConfig:   row.EmbeddingConfig,
		VectorDBConfig:    row.VectorDbConfig,
		WordCount:         row.WordCount,
		ThirdPlatformType: row.ThirdPlatformType,
		ThirdFileID:       row.ThirdFileID,
		CreatedUID:        row.CreatedUid,
		UpdatedUID:        row.UpdatedUid,
		CreatedAt:         sql.NullTime{Time: row.CreatedAt, Valid: true},
		UpdatedAt:         sql.NullTime{Time: row.UpdatedAt, Valid: true},
		DeletedAt:         row.DeletedAt,
	}
	return toKnowledgeBaseDocument(record)
}

// BuildInsertDocumentParams 兼容旧 sqlc insert 参数，供遗留路径继续编译。
func BuildInsertDocumentParams(doc *documentdomain.KnowledgeBaseDocument) (mysqlsqlc.InsertDocumentParams, error) {
	docMetadataJSON, err := json.Marshal(doc.DocMetadata)
	if err != nil {
		return mysqlsqlc.InsertDocumentParams{}, fmt.Errorf("marshal doc metadata: %w", err)
	}
	documentFileJSON, err := json.Marshal(doc.DocumentFile)
	if err != nil {
		return mysqlsqlc.InsertDocumentParams{}, fmt.Errorf("marshal document file: %w", err)
	}
	retrieveConfigJSON, err := json.Marshal(doc.RetrieveConfig)
	if err != nil {
		return mysqlsqlc.InsertDocumentParams{}, fmt.Errorf("marshal retrieve config: %w", err)
	}
	fragmentConfigJSON, err := json.Marshal(doc.FragmentConfig)
	if err != nil {
		return mysqlsqlc.InsertDocumentParams{}, fmt.Errorf("marshal fragment config: %w", err)
	}
	embeddingConfigJSON, err := json.Marshal(doc.EmbeddingConfig)
	if err != nil {
		return mysqlsqlc.InsertDocumentParams{}, fmt.Errorf("marshal embedding config: %w", err)
	}
	vectorDBConfigJSON, err := json.Marshal(doc.VectorDBConfig)
	if err != nil {
		return mysqlsqlc.InsertDocumentParams{}, fmt.Errorf("marshal vector db config: %w", err)
	}
	docType, err := convert.SafeIntToUint32(doc.DocType, "doc_type")
	if err != nil {
		return mysqlsqlc.InsertDocumentParams{}, fmt.Errorf("invalid doc_type: %w", err)
	}
	syncTimes, err := convert.SafeIntToInt32(doc.SyncTimes, "sync_times")
	if err != nil {
		return mysqlsqlc.InsertDocumentParams{}, fmt.Errorf("invalid sync_times: %w", err)
	}
	syncStatus, err := knowledgeShared.SyncStatusToInt32(doc.SyncStatus, "sync_status")
	if err != nil {
		return mysqlsqlc.InsertDocumentParams{}, fmt.Errorf("invalid sync_status: %w", err)
	}
	wordCount, err := convert.SafeIntToUint64(doc.WordCount, "word_count")
	if err != nil {
		return mysqlsqlc.InsertDocumentParams{}, fmt.Errorf("invalid word_count: %w", err)
	}
	return mysqlsqlc.InsertDocumentParams{
		OrganizationCode:  doc.OrganizationCode,
		KnowledgeBaseCode: doc.KnowledgeBaseCode,
		SourceBindingID:   doc.SourceBindingID,
		SourceItemID:      doc.SourceItemID,
		AutoAdded:         doc.AutoAdded,
		Name:              doc.Name,
		Description:       doc.Description,
		Code:              doc.Code,
		Enabled:           doc.Enabled,
		DocType:           docType,
		DocMetadata:       docMetadataJSON,
		DocumentFile:      documentFileJSON,
		SyncStatus:        syncStatus,
		SyncTimes:         syncTimes,
		SyncStatusMessage: doc.SyncStatusMessage,
		EmbeddingModel:    doc.EmbeddingModel,
		VectorDb:          doc.VectorDB,
		RetrieveConfig:    retrieveConfigJSON,
		FragmentConfig:    fragmentConfigJSON,
		EmbeddingConfig:   embeddingConfigJSON,
		VectorDbConfig:    vectorDBConfigJSON,
		WordCount:         wordCount,
		CreatedUid:        doc.CreatedUID,
		UpdatedUid:        doc.UpdatedUID,
		CreatedAt:         doc.CreatedAt,
		UpdatedAt:         doc.UpdatedAt,
		ThirdPlatformType: sql.NullString{String: doc.ThirdPlatformType, Valid: doc.ThirdPlatformType != ""},
		ThirdFileID:       sql.NullString{String: doc.ThirdFileID, Valid: doc.ThirdFileID != ""},
	}, nil
}

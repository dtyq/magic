package documentrepo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	mysqlDriver "github.com/go-sql-driver/mysql"

	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	knowledgeShared "magic/internal/infrastructure/persistence/mysql/knowledge/shared"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/pkg/convert"
)

var errNilKnowledgeBase = errors.New("knowledge base is nil")

// Save 插入一条新的知识库文档记录。
func (repo *DocumentRepository) Save(ctx context.Context, doc *documentdomain.KnowledgeBaseDocument) error {
	now := time.Now()
	doc.CreatedAt = now
	doc.UpdatedAt = now
	params, err := BuildInsertDocumentParams(doc)
	if err != nil {
		return err
	}
	res, err := repo.queries.InsertDocument(ctx, params)
	if err != nil {
		return fmt.Errorf("insert document: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return fmt.Errorf("get last insert id: %w", err)
	}
	doc.ID = id
	return nil
}

// Update 更新已有知识库文档记录。
func (repo *DocumentRepository) Update(ctx context.Context, doc *documentdomain.KnowledgeBaseDocument) error {
	doc.UpdatedAt = time.Now()
	docMetadataJSON, err := json.Marshal(doc.DocMetadata)
	if err != nil {
		return fmt.Errorf("marshal doc metadata: %w", err)
	}
	documentFileJSON, err := json.Marshal(doc.DocumentFile)
	if err != nil {
		return fmt.Errorf("marshal document file: %w", err)
	}
	retrieveConfigJSON, err := json.Marshal(doc.RetrieveConfig)
	if err != nil {
		return fmt.Errorf("marshal retrieve config: %w", err)
	}
	fragmentConfigJSON, err := json.Marshal(doc.FragmentConfig)
	if err != nil {
		return fmt.Errorf("marshal fragment config: %w", err)
	}
	embeddingConfigJSON, err := json.Marshal(doc.EmbeddingConfig)
	if err != nil {
		return fmt.Errorf("marshal embedding config: %w", err)
	}
	vectorDBConfigJSON, err := json.Marshal(doc.VectorDBConfig)
	if err != nil {
		return fmt.Errorf("marshal vector db config: %w", err)
	}
	syncStatus, err := knowledgeShared.SyncStatusToInt32(doc.SyncStatus, "sync_status")
	if err != nil {
		return fmt.Errorf("invalid sync_status: %w", err)
	}
	syncTimes, err := convert.SafeIntToInt32(doc.SyncTimes, "sync_times")
	if err != nil {
		return fmt.Errorf("invalid sync_times: %w", err)
	}
	docType, err := convert.SafeIntToUint32(doc.DocType, "doc_type")
	if err != nil {
		return fmt.Errorf("invalid doc_type: %w", err)
	}
	wordCount, err := convert.SafeIntToUint64(doc.WordCount, "word_count")
	if err != nil {
		return fmt.Errorf("invalid word_count: %w", err)
	}
	_, err = repo.queries.UpdateDocument(ctx, mysqlsqlc.UpdateDocumentParams{
		SourceBindingID:   doc.SourceBindingID,
		SourceItemID:      doc.SourceItemID,
		AutoAdded:         doc.AutoAdded,
		Name:              doc.Name,
		Description:       doc.Description,
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
		ThirdPlatformType: sql.NullString{String: doc.ThirdPlatformType, Valid: doc.ThirdPlatformType != ""},
		ThirdFileID:       sql.NullString{String: doc.ThirdFileID, Valid: doc.ThirdFileID != ""},
		UpdatedUid:        doc.UpdatedUID,
		UpdatedAt:         doc.UpdatedAt,
		ID:                doc.ID,
	})
	if err != nil {
		return fmt.Errorf("update document: %w", err)
	}
	return nil
}

// Delete 硬删除指定文档。
func (repo *DocumentRepository) Delete(ctx context.Context, id int64) error {
	if _, err := repo.queries.DeleteDocumentByID(ctx, id); err != nil {
		return fmt.Errorf("delete document: %w", err)
	}
	return nil
}

// DeleteByKnowledgeBase 硬删除知识库下全部文档。
func (repo *DocumentRepository) DeleteByKnowledgeBase(ctx context.Context, knowledgeBaseCode string) error {
	if _, err := repo.queries.DeleteDocumentsByKnowledgeBase(ctx, knowledgeBaseCode); err != nil {
		return fmt.Errorf("delete documents by knowledge base: %w", err)
	}
	return nil
}

// UpdateSyncStatus 更新文档同步状态。
func (repo *DocumentRepository) UpdateSyncStatus(ctx context.Context, id int64, status shared.SyncStatus, message string) error {
	syncStatus, err := knowledgeShared.SyncStatusToInt32(status, "sync_status")
	if err != nil {
		return fmt.Errorf("invalid sync_status: %w", err)
	}
	if _, err := repo.queries.UpdateDocumentSyncStatus(ctx, mysqlsqlc.UpdateDocumentSyncStatusParams{
		SyncStatus:        syncStatus,
		SyncStatusMessage: message,
		UpdatedAt:         time.Now(),
		ID:                id,
	}); err != nil {
		return fmt.Errorf("update document sync status: %w", err)
	}
	return nil
}

// EnsureDefaultDocument 确保知识库默认文档存在。
func (repo *DocumentRepository) EnsureDefaultDocument(
	ctx context.Context,
	kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot,
) (*documentdomain.KnowledgeBaseDocument, bool, error) {
	kb = sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(kb)
	if kb == nil {
		return nil, false, errNilKnowledgeBase
	}
	defaultCode := kb.DefaultDocumentCode()
	doc, err := repo.FindByCodeAndKnowledgeBase(ctx, defaultCode, kb.Code)
	switch {
	case err == nil:
		return doc, false, nil
	case !errors.Is(err, shared.ErrDocumentNotFound):
		return nil, false, err
	}

	tombstone, err := repo.findDocumentIncludingDeleted(ctx, kb.Code, defaultCode)
	if err != nil && !errors.Is(err, shared.ErrDocumentNotFound) {
		return nil, false, err
	}

	doc = documentdomain.NewDocument(kb.Code, "未命名文档.txt", defaultCode, documentdomain.DocTypeText, kb.CreatedUID, kb.OrganizationCode)
	doc.SyncStatus = shared.SyncStatusSynced
	doc.EmbeddingModel = kb.Model
	doc.VectorDB = kb.VectorDB
	doc.RetrieveConfig = kb.RetrieveConfig
	doc.FragmentConfig = kb.FragmentConfig
	doc.EmbeddingConfig = kb.EmbeddingConfig
	doc.WordCount = 0
	if err := repo.Save(ctx, doc); err != nil {
		recovered, recoverErr := repo.retryCreateDefaultDocumentAfterDuplicate(ctx, doc, tombstone, err)
		if recoverErr != nil {
			return nil, false, recoverErr
		}
		if recovered {
			return doc, true, nil
		}
		existing, findErr := repo.FindByCodeAndKnowledgeBase(ctx, defaultCode, kb.Code)
		if findErr != nil {
			return nil, false, findErr
		}
		return existing, false, nil
	}
	return doc, true, nil
}

func (repo *DocumentRepository) findDocumentIncludingDeleted(
	ctx context.Context,
	knowledgeBaseCode, code string,
) (*documentdomain.KnowledgeBaseDocument, error) {
	row, err := repo.queries.FindDocumentIncludingDeletedCompat(ctx, mysqlsqlc.FindDocumentIncludingDeletedCompatParams{
		KnowledgeBaseCode: knowledgeBaseCode,
		Code:              code,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, shared.ErrDocumentNotFound
		}
		return nil, fmt.Errorf("find document including deleted: %w", err)
	}
	record, err := documentRecordFromFindDocumentIncludingDeletedCompatRow(row)
	if err != nil {
		return nil, err
	}
	return toKnowledgeBaseDocument(record)
}

func (repo *DocumentRepository) retryCreateDefaultDocumentAfterDuplicate(
	ctx context.Context,
	doc *documentdomain.KnowledgeBaseDocument,
	tombstone *documentdomain.KnowledgeBaseDocument,
	createErr error,
) (bool, error) {
	if !IsDuplicateDocumentInsert(createErr) {
		return false, createErr
	}
	if tombstone == nil || tombstone.DeletedAt == nil {
		return false, nil
	}
	if err := repo.Delete(ctx, tombstone.ID); err != nil {
		return false, fmt.Errorf("delete deleted default document tombstone: %w", err)
	}
	if err := repo.Save(ctx, doc); err != nil {
		if IsDuplicateDocumentInsert(err) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// IsDuplicateDocumentInsert 判断插入失败是否由唯一键冲突导致。
func IsDuplicateDocumentInsert(err error) bool {
	var mysqlErr *mysqlDriver.MySQLError
	return errors.As(err, &mysqlErr) && mysqlErr.Number == 1062
}

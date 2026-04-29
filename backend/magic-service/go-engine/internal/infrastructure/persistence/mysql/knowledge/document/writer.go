package documentrepo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	mysqlDriver "github.com/go-sql-driver/mysql"

	docentity "magic/internal/domain/knowledge/document/entity"
	docrepo "magic/internal/domain/knowledge/document/repository"
	"magic/internal/domain/knowledge/shared"
	knowledgeShared "magic/internal/infrastructure/persistence/mysql/knowledge/shared"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/pkg/convert"
)

var (
	errNilKnowledgeBase                      = errors.New("knowledge base is nil")
	errManagedSourceDocumentIdentityConflict = errors.New("managed source document identity conflict")
)

// BuildInsertDocumentParams 将领域文档实体映射为 sqlc insert 参数。
func BuildInsertDocumentParams(doc *docentity.KnowledgeBaseDocument) (mysqlsqlc.InsertDocumentParams, error) {
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

// Save 插入一条新的知识库文档记录。
func (repo *DocumentRepository) Save(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error {
	now := time.Now()
	doc.CreatedAt = now
	doc.UpdatedAt = now
	params, err := BuildInsertDocumentParams(doc)
	if err != nil {
		return err
	}
	res, err := repo.queries.InsertDocument(ctx, params)
	if err != nil {
		recovered, recoverErr := repo.recoverManagedSourceDocumentAfterDuplicate(ctx, doc, err)
		if recoverErr != nil {
			return recoverErr
		}
		if recovered {
			return nil
		}
		return fmt.Errorf("insert document: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return fmt.Errorf("get last insert id: %w", err)
	}
	doc.ID = id
	return nil
}

func (repo *DocumentRepository) recoverManagedSourceDocumentAfterDuplicate(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	createErr error,
) (bool, error) {
	if !IsDuplicateDocumentInsert(createErr) || !isManagedSourceDocumentForDuplicateRecovery(doc) {
		return false, nil
	}
	existing, err := repo.FindByCodeAndKnowledgeBase(ctx, doc.Code, doc.KnowledgeBaseCode)
	if err != nil {
		if errors.Is(err, shared.ErrDocumentNotFound) {
			return false, createErr
		}
		return false, fmt.Errorf("find duplicated managed source document: %w", err)
	}
	if !sameManagedSourceDocumentIdentity(existing, doc) {
		return false, fmt.Errorf(
			"%w: knowledge_base_code=%s code=%s source_binding_id=%d source_item_id=%d",
			errManagedSourceDocumentIdentityConflict,
			doc.KnowledgeBaseCode,
			doc.Code,
			doc.SourceBindingID,
			doc.SourceItemID,
		)
	}
	*doc = *existing
	return true, nil
}

func isManagedSourceDocumentForDuplicateRecovery(doc *docentity.KnowledgeBaseDocument) bool {
	return doc != nil &&
		strings.TrimSpace(doc.KnowledgeBaseCode) != "" &&
		strings.TrimSpace(doc.Code) != "" &&
		doc.SourceBindingID > 0 &&
		doc.SourceItemID > 0
}

func sameManagedSourceDocumentIdentity(existing, expected *docentity.KnowledgeBaseDocument) bool {
	if existing == nil || expected == nil {
		return false
	}
	return strings.TrimSpace(existing.OrganizationCode) == strings.TrimSpace(expected.OrganizationCode) &&
		existing.SourceBindingID == expected.SourceBindingID &&
		existing.SourceItemID == expected.SourceItemID
}

// Update 更新已有知识库文档记录。
func (repo *DocumentRepository) Update(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error {
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

// DeleteByKnowledgeBaseAndCodes 硬删除知识库下指定编码文档。
func (repo *DocumentRepository) DeleteByKnowledgeBaseAndCodes(
	ctx context.Context,
	knowledgeBaseCode string,
	codes []string,
) error {
	if len(codes) == 0 {
		return nil
	}
	if _, err := repo.queries.DeleteDocumentsByKnowledgeBaseAndCodes(ctx, mysqlsqlc.DeleteDocumentsByKnowledgeBaseAndCodesParams{
		KnowledgeBaseCode: strings.TrimSpace(knowledgeBaseCode),
		Codes:             codes,
	}); err != nil {
		return fmt.Errorf("delete documents by knowledge base and codes: %w", err)
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
	kb *docrepo.KnowledgeBaseRuntimeSnapshot,
) (*docentity.KnowledgeBaseDocument, bool, error) {
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

	doc = docentity.NewDocument(kb.Code, "未命名文档.txt", defaultCode, docentity.DocumentInputKindText, kb.CreatedUID, kb.OrganizationCode)
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
) (*docentity.KnowledgeBaseDocument, error) {
	row, err := repo.queries.FindDocumentIncludingDeleted(ctx, mysqlsqlc.FindDocumentIncludingDeletedParams{
		KnowledgeBaseCode: strings.TrimSpace(knowledgeBaseCode),
		Code:              strings.TrimSpace(code),
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, shared.ErrDocumentNotFound
		}
		return nil, fmt.Errorf("find document including deleted: %w", err)
	}
	record, err := documentRecordFromFindDocumentIncludingDeletedRow(row)
	if err != nil {
		return nil, fmt.Errorf("map document including deleted: %w", err)
	}
	return toKnowledgeBaseDocument(record)
}

func (repo *DocumentRepository) retryCreateDefaultDocumentAfterDuplicate(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	tombstone *docentity.KnowledgeBaseDocument,
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

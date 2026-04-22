// Package fragmentrepo 提供知识库片段仓储的 MySQL 实现。
package fragmentrepo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	fragmetadata "magic/internal/domain/knowledge/fragment/metadata"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/shared"
	knowledgeShared "magic/internal/infrastructure/persistence/mysql/knowledge/shared"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/pkg/convert"
)

var (
	errUnexpectedFragmentBatchInsertCount = errors.New("unexpected fragment batch insert count")
	errFragmentContentInvalidUTF8         = errors.New("fragment content contains invalid utf-8")
)

const (
	fragmentInsertColumnCount = 14
	fragmentInsertBatchPrefix = `INSERT INTO magic_flow_knowledge_fragment (
knowledge_code, document_code, content, metadata, business_id,
sync_status, sync_times, sync_status_message, point_id, word_count,
created_uid, updated_uid, created_at, updated_at
) VALUES `
	fragmentUpdateBatchColumnCount     = 10
	fragmentSyncStatusBatchColumnCount = 5
	fragmentUpdateBatchPrefix          = `UPDATE magic_flow_knowledge_fragment AS target
JOIN (`
	fragmentUpdateBatchSuffix = `
) AS source ON target.id = source.id
SET target.content = source.content,
    target.metadata = source.metadata,
    target.point_id = source.point_id,
    target.word_count = source.word_count,
    target.sync_status = source.sync_status,
    target.sync_times = source.sync_times,
    target.sync_status_message = source.sync_status_message,
    target.updated_uid = source.updated_uid,
    target.updated_at = source.updated_at
WHERE target.deleted_at IS NULL`
	fragmentDeleteByIDsPrefix = `DELETE FROM magic_flow_knowledge_fragment
WHERE id IN (`
	fragmentDeleteByIDsSuffix     = `)`
	fragmentSyncStatusBatchPrefix = `UPDATE magic_flow_knowledge_fragment AS target
JOIN (`
	fragmentSyncStatusBatchSuffix = `
) AS source ON target.id = source.id
SET target.sync_status = source.sync_status,
    target.sync_times = source.sync_times,
    target.sync_status_message = source.sync_status_message,
    target.updated_at = source.updated_at
WHERE target.deleted_at IS NULL`
)

// Save 保存片段
func (repo *FragmentRepository) Save(ctx context.Context, fragment *fragmodel.KnowledgeBaseFragment) error {
	if err := ValidatePersistableFragment(fragment); err != nil {
		return err
	}
	params, err := BuildInsertParams(fragment, time.Now())
	if err != nil {
		return err
	}

	res, err := repo.queries.InsertFragment(ctx, params)
	if err != nil {
		return fmt.Errorf("failed to insert fragment: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get last insert id: %w", err)
	}
	fragment.ID = id

	return nil
}

// SaveBatch 批量保存片段
func (repo *FragmentRepository) SaveBatch(ctx context.Context, fragments []*fragmodel.KnowledgeBaseFragment) error {
	if len(fragments) == 0 {
		return nil
	}

	for _, fragment := range fragments {
		if err := ValidatePersistableFragment(fragment); err != nil {
			return err
		}
	}

	tx, err := repo.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	now := time.Now()
	rows := make([]fragmentInsertRow, len(fragments))
	for i, fragment := range fragments {
		row, buildErr := buildFragmentInsertRow(fragment, now)
		if buildErr != nil {
			return buildErr
		}
		rows[i] = row
	}

	maxRows := knowledgeShared.MaxBulkInsertRows(fragmentInsertColumnCount)
	for start := 0; start < len(rows); start += maxRows {
		end := min(start+maxRows, len(rows))
		chunk := rows[start:end]

		res, execErr := repo.client.ExecTxContext(
			ctx,
			tx,
			buildFragmentInsertBatchSQL(len(chunk)),
			flattenFragmentInsertArgs(chunk)...,
		)
		if execErr != nil {
			return fmt.Errorf("failed to insert fragments in batch: %w", execErr)
		}

		firstID, idErr := res.LastInsertId()
		if idErr != nil {
			return fmt.Errorf("failed to get first insert id: %w", idErr)
		}
		affected, affErr := res.RowsAffected()
		if affErr != nil {
			return fmt.Errorf("failed to get inserted rows: %w", affErr)
		}
		if affected != int64(len(chunk)) {
			return fmt.Errorf("%w: want %d, got %d", errUnexpectedFragmentBatchInsertCount, len(chunk), affected)
		}
		assignFragmentIDs(chunk, firstID)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}

type fragmentInsertRow struct {
	fragment *fragmodel.KnowledgeBaseFragment
	args     [fragmentInsertColumnCount]any
}

func buildFragmentInsertRow(fragment *fragmodel.KnowledgeBaseFragment, now time.Time) (fragmentInsertRow, error) {
	if err := ValidatePersistableFragment(fragment); err != nil {
		return fragmentInsertRow{}, err
	}

	fragment.CreatedAt = now
	fragment.UpdatedAt = now
	fragmetadata.ApplyFragmentMetadataContractV1(fragment)

	metadataJSON, err := json.Marshal(fragment.Metadata)
	if err != nil {
		return fragmentInsertRow{}, fmt.Errorf("failed to marshal metadata: %w", err)
	}

	wordCount, err := convert.SafeIntToUint64(fragment.WordCount, "word_count")
	if err != nil {
		return fragmentInsertRow{}, fmt.Errorf("invalid word_count: %w", err)
	}
	syncTimes, err := convert.SafeIntToInt32(fragment.SyncTimes, "sync_times")
	if err != nil {
		return fragmentInsertRow{}, fmt.Errorf("invalid sync_times: %w", err)
	}
	syncStatus, err := knowledgeShared.SyncStatusToInt32(fragment.SyncStatus, "sync_status")
	if err != nil {
		return fragmentInsertRow{}, fmt.Errorf("invalid sync_status: %w", err)
	}

	return fragmentInsertRow{
		fragment: fragment,
		args: [fragmentInsertColumnCount]any{
			fragment.KnowledgeCode,
			fragment.DocumentCode,
			fragment.Content,
			metadataJSON,
			fragment.BusinessID,
			syncStatus,
			syncTimes,
			fragment.SyncStatusMessage,
			fragment.PointID,
			wordCount,
			fragment.CreatedUID,
			fragment.UpdatedUID,
			fragment.CreatedAt,
			fragment.UpdatedAt,
		},
	}, nil
}

func buildFragmentInsertBatchSQL(rowCount int) string {
	return knowledgeShared.BuildBulkInsertSQL(fragmentInsertBatchPrefix, "", fragmentInsertColumnCount, rowCount)
}

func flattenFragmentInsertArgs(rows []fragmentInsertRow) []any {
	args := make([]any, 0, len(rows)*fragmentInsertColumnCount)
	for _, row := range rows {
		args = append(args, row.args[:]...)
	}
	return args
}

func assignFragmentIDs(rows []fragmentInsertRow, firstID int64) {
	for index, row := range rows {
		row.fragment.ID = firstID + int64(index)
	}
}

// UpdateBatch 批量更新分片。
func (repo *FragmentRepository) UpdateBatch(ctx context.Context, fragments []*fragmodel.KnowledgeBaseFragment) error {
	if len(fragments) == 0 {
		return nil
	}

	maxRows := knowledgeShared.MaxBulkInsertRows(fragmentUpdateBatchColumnCount)
	for start := 0; start < len(fragments); start += maxRows {
		end := min(start+maxRows, len(fragments))
		chunk := fragments[start:end]
		if err := repo.updateFragmentChunk(ctx, chunk); err != nil {
			return err
		}
	}
	return nil
}

func (repo *FragmentRepository) updateFragmentChunk(ctx context.Context, fragments []*fragmodel.KnowledgeBaseFragment) error {
	rows := make([]fragmentUpdateRow, len(fragments))
	for i, fragment := range fragments {
		row, err := buildFragmentUpdateRow(fragment)
		if err != nil {
			return err
		}
		rows[i] = row
	}

	query := buildFragmentUpdateBatchSQL(len(rows))
	if _, err := repo.client.ExecContext(ctx, query, flattenFragmentUpdateArgs(rows)...); err != nil {
		return fmt.Errorf("failed to batch update fragments: %w", err)
	}
	return nil
}

type fragmentUpdateRow struct {
	args [fragmentUpdateBatchColumnCount]any
}

func buildFragmentUpdateRow(fragment *fragmodel.KnowledgeBaseFragment) (fragmentUpdateRow, error) {
	if err := ValidatePersistableFragment(fragment); err != nil {
		return fragmentUpdateRow{}, err
	}

	fragment.UpdatedAt = time.Now()
	fragmetadata.ApplyFragmentMetadataContractV1(fragment)

	metadataJSON, err := json.Marshal(fragment.Metadata)
	if err != nil {
		return fragmentUpdateRow{}, fmt.Errorf("failed to marshal metadata: %w", err)
	}
	wordCount, err := convert.SafeIntToUint64(fragment.WordCount, "word_count")
	if err != nil {
		return fragmentUpdateRow{}, fmt.Errorf("invalid word_count: %w", err)
	}
	syncStatus, err := knowledgeShared.SyncStatusToInt32(fragment.SyncStatus, "sync_status")
	if err != nil {
		return fragmentUpdateRow{}, fmt.Errorf("invalid sync_status: %w", err)
	}
	syncTimes, err := convert.SafeIntToInt32(fragment.SyncTimes, "sync_times")
	if err != nil {
		return fragmentUpdateRow{}, fmt.Errorf("invalid sync_times: %w", err)
	}

	return fragmentUpdateRow{
		args: [fragmentUpdateBatchColumnCount]any{
			fragment.ID,
			fragment.Content,
			metadataJSON,
			fragment.PointID,
			wordCount,
			syncStatus,
			syncTimes,
			fragment.SyncStatusMessage,
			fragment.UpdatedUID,
			fragment.UpdatedAt,
		},
	}, nil
}

func buildFragmentUpdateBatchSQL(rowCount int) string {
	var builder strings.Builder
	builder.Grow(len(fragmentUpdateBatchPrefix) + len(fragmentUpdateBatchSuffix) + rowCount*256)
	builder.WriteString(fragmentUpdateBatchPrefix)
	for rowIndex := range rowCount {
		if rowIndex > 0 {
			builder.WriteString("\nUNION ALL ")
		}
		builder.WriteString(`SELECT ? AS id,
       ? AS content,
       ? AS metadata,
       ? AS point_id,
       ? AS word_count,
       ? AS sync_status,
       ? AS sync_times,
       ? AS sync_status_message,
       ? AS updated_uid,
       ? AS updated_at`)
	}
	builder.WriteString(fragmentUpdateBatchSuffix)
	return builder.String()
}

func flattenFragmentUpdateArgs(rows []fragmentUpdateRow) []any {
	args := make([]any, 0, len(rows)*fragmentUpdateBatchColumnCount)
	for _, row := range rows {
		args = append(args, row.args[:]...)
	}
	return args
}

// UpdateSyncStatusBatch 批量回写分片同步状态。
func (repo *FragmentRepository) UpdateSyncStatusBatch(ctx context.Context, fragments []*fragmodel.KnowledgeBaseFragment) error {
	if len(fragments) == 0 {
		return nil
	}

	maxRows := knowledgeShared.MaxBulkInsertRows(fragmentSyncStatusBatchColumnCount)
	for start := 0; start < len(fragments); start += maxRows {
		end := min(start+maxRows, len(fragments))
		chunk := fragments[start:end]
		if err := repo.updateSyncStatusChunk(ctx, chunk); err != nil {
			return err
		}
	}
	return nil
}

type fragmentSyncStatusRow struct {
	args [fragmentSyncStatusBatchColumnCount]any
}

func (repo *FragmentRepository) updateSyncStatusChunk(ctx context.Context, fragments []*fragmodel.KnowledgeBaseFragment) error {
	rows := make([]fragmentSyncStatusRow, len(fragments))
	for i, fragment := range fragments {
		syncStatus, err := knowledgeShared.SyncStatusToInt32(fragment.SyncStatus, "sync_status")
		if err != nil {
			return fmt.Errorf("invalid sync_status: %w", err)
		}
		syncTimes, err := convert.SafeIntToInt32(fragment.SyncTimes, "sync_times")
		if err != nil {
			return fmt.Errorf("invalid sync_times: %w", err)
		}
		rows[i] = fragmentSyncStatusRow{
			args: [fragmentSyncStatusBatchColumnCount]any{
				fragment.ID,
				syncStatus,
				syncTimes,
				fragment.SyncStatusMessage,
				fragment.UpdatedAt,
			},
		}
	}

	query := buildFragmentSyncStatusBatchSQL(len(rows))
	if _, err := repo.client.ExecContext(ctx, query, flattenFragmentSyncStatusArgs(rows)...); err != nil {
		return fmt.Errorf("failed to batch update sync status: %w", err)
	}
	return nil
}

func buildFragmentSyncStatusBatchSQL(rowCount int) string {
	var builder strings.Builder
	builder.Grow(len(fragmentSyncStatusBatchPrefix) + len(fragmentSyncStatusBatchSuffix) + rowCount*160)
	builder.WriteString(fragmentSyncStatusBatchPrefix)
	for rowIndex := range rowCount {
		if rowIndex > 0 {
			builder.WriteString("\nUNION ALL ")
		}
		builder.WriteString(`SELECT ? AS id,
       ? AS sync_status,
       ? AS sync_times,
       ? AS sync_status_message,
       ? AS updated_at`)
	}
	builder.WriteString(fragmentSyncStatusBatchSuffix)
	return builder.String()
}

func flattenFragmentSyncStatusArgs(rows []fragmentSyncStatusRow) []any {
	args := make([]any, 0, len(rows)*fragmentSyncStatusBatchColumnCount)
	for _, row := range rows {
		args = append(args, row.args[:]...)
	}
	return args
}

// Update 更新片段
func (repo *FragmentRepository) Update(ctx context.Context, fragment *fragmodel.KnowledgeBaseFragment) error {
	fragment.UpdatedAt = time.Now()
	fragmetadata.ApplyFragmentMetadataContractV1(fragment)
	metadataJSON, err := json.Marshal(fragment.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}
	wordCount, err := convert.SafeIntToUint64(fragment.WordCount, "word_count")
	if err != nil {
		return fmt.Errorf("invalid word_count: %w", err)
	}

	_, err = repo.queries.UpdateFragment(ctx, mysqlsqlc.UpdateFragmentParams{
		Content:    fragment.Content,
		Metadata:   metadataJSON,
		PointID:    fragment.PointID,
		WordCount:  wordCount,
		UpdatedUid: fragment.UpdatedUID,
		UpdatedAt:  fragment.UpdatedAt,
		ID:         fragment.ID,
	})
	if err != nil {
		return fmt.Errorf("failed to update fragment: %w", err)
	}

	return nil
}

// Delete 删除片段
func (repo *FragmentRepository) Delete(ctx context.Context, id int64) error {
	_, err := repo.queries.DeleteFragmentByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to delete fragment: %w", err)
	}
	return nil
}

// DeleteByIDs 批量删除片段。
func (repo *FragmentRepository) DeleteByIDs(ctx context.Context, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}

	maxRows := knowledgeShared.MaxBulkInsertRows(1)
	for start := 0; start < len(ids); start += maxRows {
		end := min(start+maxRows, len(ids))
		chunk := ids[start:end]
		args := make([]any, 0, len(chunk))
		for _, id := range chunk {
			args = append(args, id)
		}

		query := fragmentDeleteByIDsPrefix + knowledgeShared.BuildInClausePlaceholders(len(chunk)) + fragmentDeleteByIDsSuffix
		if _, err := repo.client.ExecContext(ctx, query, args...); err != nil {
			return fmt.Errorf("failed to batch delete fragments: %w", err)
		}
	}
	return nil
}

// DeleteByDocument 根据知识库和文档删除所有片段。
func (repo *FragmentRepository) DeleteByDocument(ctx context.Context, knowledgeCode, documentCode string) error {
	_, err := repo.queries.DeleteFragmentsByDocument(ctx, mysqlsqlc.DeleteFragmentsByDocumentParams{
		KnowledgeCode: strings.TrimSpace(knowledgeCode),
		DocumentCode:  strings.TrimSpace(documentCode),
	})
	if err != nil {
		return fmt.Errorf("failed to delete fragments by document: %w", err)
	}
	return nil
}

// DeleteByKnowledgeBase 根据知识库删除所有片段
func (repo *FragmentRepository) DeleteByKnowledgeBase(ctx context.Context, knowledgeCode string) error {
	_, err := repo.queries.DeleteFragmentsByKnowledgeBase(ctx, knowledgeCode)
	if err != nil {
		return fmt.Errorf("failed to delete fragments by knowledge base: %w", err)
	}
	return nil
}

// UpdateSyncStatus 更新同步状态
func (repo *FragmentRepository) UpdateSyncStatus(ctx context.Context, fragment *fragmodel.KnowledgeBaseFragment) error {
	syncTimes, err := convert.SafeIntToInt32(fragment.SyncTimes, "sync_times")
	if err != nil {
		return fmt.Errorf("invalid sync_times: %w", err)
	}
	syncStatus, err := knowledgeShared.SyncStatusToInt32(fragment.SyncStatus, "sync_status")
	if err != nil {
		return fmt.Errorf("invalid sync_status: %w", err)
	}

	_, err = repo.queries.UpdateFragmentSyncStatus(ctx, mysqlsqlc.UpdateFragmentSyncStatusParams{
		SyncStatus:        syncStatus,
		SyncTimes:         syncTimes,
		SyncStatusMessage: fragment.SyncStatusMessage,
		UpdatedAt:         time.Now(),
		ID:                fragment.ID,
	})
	if err != nil {
		return fmt.Errorf("failed to update sync status: %w", err)
	}
	return nil
}

// UpdateVector 更新向量（存储到向量字段，这里暂时不实现，向量存储在向量库中）
func (repo *FragmentRepository) UpdateVector(ctx context.Context, id int64, vector []float64) error {
	return nil
}

// BackfillDocumentCode 批量回填 document_code。
func (repo *FragmentRepository) BackfillDocumentCode(ctx context.Context, ids []int64, documentCode string) (int64, error) {
	if strings.TrimSpace(documentCode) == "" {
		return 0, shared.ErrFragmentDocumentCodeRequired
	}
	if len(ids) == 0 {
		return 0, nil
	}

	args := make([]any, 0, len(ids)+2)
	args = append(args, documentCode, time.Now())
	for _, id := range ids {
		args = append(args, id)
	}

	query := backfillDocumentCodePrefix + knowledgeShared.BuildInClausePlaceholders(len(ids)) + backfillDocumentCodeSuffix
	result, err := repo.client.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("failed to backfill fragment document code: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to read affected rows: %w", err)
	}
	return affected, nil
}

// ValidateDocumentCode 校验片段是否带有可落库的文档编码。
func ValidateDocumentCode(fragment *fragmodel.KnowledgeBaseFragment) error {
	if fragment == nil {
		return shared.ErrFragmentDocumentCodeRequired
	}
	if strings.TrimSpace(fragment.DocumentCode) == "" {
		return shared.ErrFragmentDocumentCodeRequired
	}
	return nil
}

// ValidatePersistableFragment 校验片段是否可安全落库。
func ValidatePersistableFragment(fragment *fragmodel.KnowledgeBaseFragment) error {
	if err := ValidateDocumentCode(fragment); err != nil {
		return err
	}
	if !utf8.ValidString(fragment.Content) {
		return errFragmentContentInvalidUTF8
	}
	return nil
}

// BuildInsertParams 将领域片段转换为插入语句参数。
func BuildInsertParams(fragment *fragmodel.KnowledgeBaseFragment, now time.Time) (mysqlsqlc.InsertFragmentParams, error) {
	if err := ValidatePersistableFragment(fragment); err != nil {
		return mysqlsqlc.InsertFragmentParams{}, err
	}

	fragment.CreatedAt = now
	fragment.UpdatedAt = now
	fragmetadata.ApplyFragmentMetadataContractV1(fragment)

	metadataJSON, err := json.Marshal(fragment.Metadata)
	if err != nil {
		return mysqlsqlc.InsertFragmentParams{}, fmt.Errorf("failed to marshal metadata: %w", err)
	}
	wordCount, err := convert.SafeIntToUint64(fragment.WordCount, "word_count")
	if err != nil {
		return mysqlsqlc.InsertFragmentParams{}, fmt.Errorf("invalid word_count: %w", err)
	}
	syncTimes, err := convert.SafeIntToInt32(fragment.SyncTimes, "sync_times")
	if err != nil {
		return mysqlsqlc.InsertFragmentParams{}, fmt.Errorf("invalid sync_times: %w", err)
	}
	syncStatus, err := knowledgeShared.SyncStatusToInt32(fragment.SyncStatus, "sync_status")
	if err != nil {
		return mysqlsqlc.InsertFragmentParams{}, fmt.Errorf("invalid sync_status: %w", err)
	}

	return mysqlsqlc.InsertFragmentParams{
		KnowledgeCode:     fragment.KnowledgeCode,
		DocumentCode:      fragment.DocumentCode,
		Content:           fragment.Content,
		Metadata:          metadataJSON,
		BusinessID:        fragment.BusinessID,
		SyncStatus:        syncStatus,
		SyncTimes:         syncTimes,
		SyncStatusMessage: fragment.SyncStatusMessage,
		PointID:           fragment.PointID,
		WordCount:         wordCount,
		CreatedUid:        fragment.CreatedUID,
		UpdatedUid:        fragment.UpdatedUID,
		CreatedAt:         fragment.CreatedAt,
		UpdatedAt:         fragment.UpdatedAt,
	}, nil
}

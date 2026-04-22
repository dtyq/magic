package fragmentrepo

import (
	"database/sql"
	"fmt"
	"time"

	fragmetadata "magic/internal/domain/knowledge/fragment/metadata"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	sharedentity "magic/internal/domain/knowledge/shared/entity"
	"magic/internal/infrastructure/persistence/mysql/jsoncompat"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/pkg/convert"
)

type fragmentRaw struct {
	id                int64
	knowledgeCode     string
	documentCode      string
	content           string
	metadataJSON      []byte
	businessID        string
	syncStatus        int32
	syncTimes         int32
	syncStatusMessage string
	pointID           string
	wordCount         uint64
	createdUID        string
	updatedUID        string
	createdAt         time.Time
	updatedAt         time.Time
	deletedAt         sql.NullTime
}

func fillFragmentCommon(raw fragmentRaw) (*fragmodel.KnowledgeBaseFragment, error) {
	wordCount, err := convert.SafeUint64ToInt(raw.wordCount, "word_count")
	if err != nil {
		return nil, fmt.Errorf("invalid word_count: %w", err)
	}
	fragment := &fragmodel.KnowledgeBaseFragment{
		ID:                raw.id,
		KnowledgeCode:     raw.knowledgeCode,
		DocumentCode:      raw.documentCode,
		Content:           raw.content,
		BusinessID:        raw.businessID,
		SyncStatus:        sharedentity.SyncStatus(raw.syncStatus),
		SyncTimes:         int(raw.syncTimes),
		SyncStatusMessage: raw.syncStatusMessage,
		PointID:           raw.pointID,
		WordCount:         wordCount,
		CreatedUID:        raw.createdUID,
		UpdatedUID:        raw.updatedUID,
		CreatedAt:         raw.createdAt,
		UpdatedAt:         raw.updatedAt,
	}
	if raw.deletedAt.Valid {
		fragment.DeletedAt = &raw.deletedAt.Time
	}
	metadata, err := decodeFragmentMetadata(raw.metadataJSON)
	if err != nil {
		return nil, err
	}
	fragment.Metadata = metadata
	fragmetadata.ApplyFragmentMetadataContractV1(fragment)

	return fragment, nil
}

func decodeFragmentMetadata(metadataJSON []byte) (map[string]any, error) {
	metadata, err := jsoncompat.DecodeObjectMap(metadataJSON, "metadata")
	if err != nil {
		return nil, fmt.Errorf("decode metadata: %w", err)
	}
	return metadata, nil
}

func toFragmentFromFindByID(row mysqlsqlc.FindFragmentByIDRow) (*fragmodel.KnowledgeBaseFragment, error) {
	return fillFragmentCommon(fragmentRaw{
		id:                row.ID,
		knowledgeCode:     row.KnowledgeCode,
		documentCode:      row.DocumentCode,
		content:           row.Content,
		metadataJSON:      row.Metadata,
		businessID:        row.BusinessID,
		syncStatus:        row.SyncStatus,
		syncTimes:         row.SyncTimes,
		syncStatusMessage: row.SyncStatusMessage,
		pointID:           row.PointID,
		wordCount:         row.WordCount,
		createdUID:        row.CreatedUid,
		updatedUID:        row.UpdatedUid,
		createdAt:         row.CreatedAt,
		updatedAt:         row.UpdatedAt,
		deletedAt:         row.DeletedAt,
	})
}

func toFragmentFromFindByPointIDs(row mysqlsqlc.FindFragmentsByPointIDsRow) (*fragmodel.KnowledgeBaseFragment, error) {
	return fillFragmentCommon(fragmentRaw{
		id:                row.ID,
		knowledgeCode:     row.KnowledgeCode,
		documentCode:      row.DocumentCode,
		content:           row.Content,
		metadataJSON:      row.Metadata,
		businessID:        row.BusinessID,
		syncStatus:        row.SyncStatus,
		syncTimes:         row.SyncTimes,
		syncStatusMessage: row.SyncStatusMessage,
		pointID:           row.PointID,
		wordCount:         row.WordCount,
		createdUID:        row.CreatedUid,
		updatedUID:        row.UpdatedUid,
		createdAt:         row.CreatedAt,
		updatedAt:         row.UpdatedAt,
		deletedAt:         row.DeletedAt,
	})
}

func toFragmentFromList(row mysqlsqlc.ListFragmentsRow) (*fragmodel.KnowledgeBaseFragment, error) {
	return fillFragmentCommon(fragmentRaw{
		id:                row.ID,
		knowledgeCode:     row.KnowledgeCode,
		documentCode:      row.DocumentCode,
		content:           row.Content,
		metadataJSON:      row.Metadata,
		businessID:        row.BusinessID,
		syncStatus:        row.SyncStatus,
		syncTimes:         row.SyncTimes,
		syncStatusMessage: row.SyncStatusMessage,
		pointID:           row.PointID,
		wordCount:         row.WordCount,
		createdUID:        row.CreatedUid,
		updatedUID:        row.UpdatedUid,
		createdAt:         row.CreatedAt,
		updatedAt:         row.UpdatedAt,
		deletedAt:         row.DeletedAt,
	})
}

func toFragmentFromListByKnowledgeAndDocument(
	row mysqlsqlc.ListFragmentsByKnowledgeAndDocumentRow,
) (*fragmodel.KnowledgeBaseFragment, error) {
	return fillFragmentCommon(fragmentRaw{
		id:                row.ID,
		knowledgeCode:     row.KnowledgeCode,
		documentCode:      row.DocumentCode,
		content:           row.Content,
		metadataJSON:      row.Metadata,
		businessID:        row.BusinessID,
		syncStatus:        row.SyncStatus,
		syncTimes:         row.SyncTimes,
		syncStatusMessage: row.SyncStatusMessage,
		pointID:           row.PointID,
		wordCount:         row.WordCount,
		createdUID:        row.CreatedUid,
		updatedUID:        row.UpdatedUid,
		createdAt:         row.CreatedAt,
		updatedAt:         row.UpdatedAt,
		deletedAt:         row.DeletedAt,
	})
}

func toFragmentFromFindByIDs(row mysqlsqlc.FindFragmentsByIDsRow) (*fragmodel.KnowledgeBaseFragment, error) {
	return fillFragmentCommon(fragmentRaw{
		id:                row.ID,
		knowledgeCode:     row.KnowledgeCode,
		documentCode:      row.DocumentCode,
		content:           row.Content,
		metadataJSON:      row.Metadata,
		businessID:        row.BusinessID,
		syncStatus:        row.SyncStatus,
		syncTimes:         row.SyncTimes,
		syncStatusMessage: row.SyncStatusMessage,
		pointID:           row.PointID,
		wordCount:         row.WordCount,
		createdUID:        row.CreatedUid,
		updatedUID:        row.UpdatedUid,
		createdAt:         row.CreatedAt,
		updatedAt:         row.UpdatedAt,
		deletedAt:         row.DeletedAt,
	})
}

func toFragmentFromListPending(row mysqlsqlc.ListPendingFragmentsRow) (*fragmodel.KnowledgeBaseFragment, error) {
	return fillFragmentCommon(fragmentRaw{
		id:                row.ID,
		knowledgeCode:     row.KnowledgeCode,
		documentCode:      row.DocumentCode,
		content:           row.Content,
		metadataJSON:      row.Metadata,
		businessID:        row.BusinessID,
		syncStatus:        row.SyncStatus,
		syncTimes:         row.SyncTimes,
		syncStatusMessage: row.SyncStatusMessage,
		pointID:           row.PointID,
		wordCount:         row.WordCount,
		createdUID:        row.CreatedUid,
		updatedUID:        row.UpdatedUid,
		createdAt:         row.CreatedAt,
		updatedAt:         row.UpdatedAt,
		deletedAt:         row.DeletedAt,
	})
}

func scanFragmentListRow(rows *sql.Rows) (mysqlsqlc.ListFragmentsRow, error) {
	var row mysqlsqlc.ListFragmentsRow
	if err := rows.Scan(
		&row.ID,
		&row.KnowledgeCode,
		&row.DocumentCode,
		&row.Content,
		&row.Metadata,
		&row.BusinessID,
		&row.SyncStatus,
		&row.SyncTimes,
		&row.SyncStatusMessage,
		&row.PointID,
		&row.WordCount,
		&row.CreatedUid,
		&row.UpdatedUid,
		&row.CreatedAt,
		&row.UpdatedAt,
		&row.DeletedAt,
	); err != nil {
		return mysqlsqlc.ListFragmentsRow{}, fmt.Errorf("scan fragment row: %w", err)
	}
	return row, nil
}

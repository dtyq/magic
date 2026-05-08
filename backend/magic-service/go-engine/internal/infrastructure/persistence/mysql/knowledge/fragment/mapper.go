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
	fragmetadata.ApplyFragmentMetadataContract(fragment)

	return fragment, nil
}

func decodeFragmentMetadata(metadataJSON []byte) (map[string]any, error) {
	metadata, err := jsoncompat.DecodeObjectMap(metadataJSON, "metadata")
	if err != nil {
		return nil, fmt.Errorf("decode metadata: %w", err)
	}
	return metadata, nil
}

func toFragmentFromModel(row mysqlsqlc.MagicFlowKnowledgeFragment) (*fragmodel.KnowledgeBaseFragment, error) {
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

func toFragmentFromFindByID(row mysqlsqlc.MagicFlowKnowledgeFragment) (*fragmodel.KnowledgeBaseFragment, error) {
	return toFragmentFromModel(row)
}

func toFragmentFromFindByPointIDs(row mysqlsqlc.MagicFlowKnowledgeFragment) (*fragmodel.KnowledgeBaseFragment, error) {
	return toFragmentFromModel(row)
}

func toFragmentFromFindByIDs(row mysqlsqlc.MagicFlowKnowledgeFragment) (*fragmodel.KnowledgeBaseFragment, error) {
	return toFragmentFromModel(row)
}

func toFragmentFromListByKnowledge(row mysqlsqlc.MagicFlowKnowledgeFragment) (*fragmodel.KnowledgeBaseFragment, error) {
	return toFragmentFromModel(row)
}

func toFragmentFromListByKnowledgeAndDocument(row mysqlsqlc.MagicFlowKnowledgeFragment) (*fragmodel.KnowledgeBaseFragment, error) {
	return toFragmentFromModel(row)
}

func toFragmentFromListByKnowledgeAndDocumentAfterID(row mysqlsqlc.MagicFlowKnowledgeFragment) (*fragmodel.KnowledgeBaseFragment, error) {
	return toFragmentFromModel(row)
}

func toFragmentFromListByKnowledgeAndDocumentFiltered(row mysqlsqlc.MagicFlowKnowledgeFragment) (*fragmodel.KnowledgeBaseFragment, error) {
	return toFragmentFromModel(row)
}

func toFragmentFromListByKnowledgeAndBusinessID(row mysqlsqlc.MagicFlowKnowledgeFragment) (*fragmodel.KnowledgeBaseFragment, error) {
	return toFragmentFromModel(row)
}

func toFragmentFromMissingDocumentCode(row mysqlsqlc.MagicFlowKnowledgeFragment) (*fragmodel.KnowledgeBaseFragment, error) {
	return toFragmentFromModel(row)
}

func toFragmentFromMissingDocumentCodeByCodes(row mysqlsqlc.MagicFlowKnowledgeFragment) (*fragmodel.KnowledgeBaseFragment, error) {
	return toFragmentFromModel(row)
}

func toFragmentFromListPending(row mysqlsqlc.MagicFlowKnowledgeFragment) (*fragmodel.KnowledgeBaseFragment, error) {
	return toFragmentFromModel(row)
}

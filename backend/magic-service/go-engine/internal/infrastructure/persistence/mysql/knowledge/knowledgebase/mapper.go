package knowledgebaserepo

import (
	"database/sql"
	"fmt"
	"time"

	"magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/infrastructure/persistence/mysql/jsoncompat"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/pkg/convert"
)

func decodeKnowledgeBaseJSON(knowledgeBase *knowledgebase.KnowledgeBase, retrieveJSON, fragmentJSON, embeddingJSON []byte) error {
	retrieveConfig, err := jsoncompat.DecodeObjectPtr[shared.RetrieveConfig](retrieveJSON, "retrieve_config")
	if err != nil {
		return fmt.Errorf("decode retrieve_config: %w", err)
	}
	knowledgeBase.RetrieveConfig = retrieveConfig

	fragmentConfig, err := jsoncompat.DecodeObjectPtr[shared.FragmentConfig](fragmentJSON, "fragment_config")
	if err != nil {
		return fmt.Errorf("decode fragment_config: %w", err)
	}
	knowledgeBase.FragmentConfig = fragmentConfig

	embeddingConfig, err := jsoncompat.DecodeObjectPtr[shared.EmbeddingConfig](embeddingJSON, "embedding_config")
	if err != nil {
		return fmt.Errorf("decode embedding_config: %w", err)
	}
	knowledgeBase.EmbeddingConfig = embeddingConfig
	return nil
}

type knowledgeBaseRaw struct {
	id                int64
	code              string
	version           int32
	name              string
	description       string
	kbType            int32
	enabled           bool
	businessID        string
	syncStatus        int32
	syncStatusMessage string
	model             string
	vectorDB          string
	organizationCode  string
	createdUID        string
	updatedUID        string
	expectedNum       int32
	completedNum      int32
	retrieveConfig    []byte
	fragmentConfig    []byte
	embeddingConfig   []byte
	wordCount         int64
	icon              string
	sourceType        sql.NullInt32
	knowledgeBaseType string
	createdAt         time.Time
	updatedAt         time.Time
}

func fillKnowledgeBaseCommon(raw knowledgeBaseRaw) (*knowledgebase.KnowledgeBase, error) {
	knowledgeBase := &knowledgebase.KnowledgeBase{
		ID:                raw.id,
		Code:              raw.code,
		Version:           int(raw.version),
		Name:              raw.name,
		Description:       raw.description,
		Type:              int(raw.kbType),
		Enabled:           raw.enabled,
		BusinessID:        raw.businessID,
		SyncStatus:        shared.SyncStatus(raw.syncStatus),
		SyncStatusMessage: raw.syncStatusMessage,
		Model:             raw.model,
		VectorDB:          raw.vectorDB,
		OrganizationCode:  raw.organizationCode,
		CreatedUID:        raw.createdUID,
		UpdatedUID:        raw.updatedUID,
		ExpectedNum:       int(raw.expectedNum),
		CompletedNum:      int(raw.completedNum),
		WordCount:         int(raw.wordCount),
		Icon:              raw.icon,
		KnowledgeBaseType: knowledgebase.NormalizeKnowledgeBaseTypeOrDefault(knowledgebase.Type(raw.knowledgeBaseType)),
		CreatedAt:         raw.createdAt,
		UpdatedAt:         raw.updatedAt,
	}

	if raw.sourceType.Valid {
		sourceTypeValue, err := convert.ParseInt(raw.sourceType.Int32)
		if err != nil {
			return nil, fmt.Errorf("invalid source_type value %d: %w", raw.sourceType.Int32, err)
		}
		if !knowledgebase.IsValidSourceType(sourceTypeValue) {
			return nil, fmt.Errorf("invalid source_type value %d: %w", raw.sourceType.Int32, knowledgebase.ErrInvalidSourceType)
		}
		knowledgeBase.SourceType = &sourceTypeValue
	}

	if err := decodeKnowledgeBaseJSON(knowledgeBase, raw.retrieveConfig, raw.fragmentConfig, raw.embeddingConfig); err != nil {
		return nil, err
	}
	return knowledgeBase, nil
}

func toKnowledgeBaseFromRawRow(row mysqlsqlc.FindKnowledgeBaseByIDRow) (*knowledgebase.KnowledgeBase, error) {
	return fillKnowledgeBaseCommon(knowledgeBaseRaw{
		id:                row.ID,
		code:              row.Code,
		version:           row.Version,
		name:              row.Name,
		description:       row.Description,
		kbType:            row.Type,
		enabled:           row.Enabled,
		businessID:        row.BusinessID,
		syncStatus:        row.SyncStatus,
		syncStatusMessage: row.SyncStatusMessage,
		model:             row.Model,
		vectorDB:          row.VectorDb,
		organizationCode:  row.OrganizationCode,
		createdUID:        row.CreatedUid,
		updatedUID:        row.UpdatedUid,
		expectedNum:       row.ExpectedNum,
		completedNum:      row.CompletedNum,
		retrieveConfig:    row.RetrieveConfig,
		fragmentConfig:    row.FragmentConfig,
		embeddingConfig:   row.EmbeddingConfig,
		wordCount:         row.WordCount,
		icon:              row.Icon,
		sourceType:        row.SourceType,
		knowledgeBaseType: row.KnowledgeBaseType,
		createdAt:         row.CreatedAt,
		updatedAt:         row.UpdatedAt,
	})
}

func toKnowledgeBaseFromFindByID(row mysqlsqlc.FindKnowledgeBaseByIDRow) (*knowledgebase.KnowledgeBase, error) {
	return toKnowledgeBaseFromRawRow(row)
}

func toKnowledgeBaseFromFindByCode(row mysqlsqlc.FindKnowledgeBaseByCodeRow) (*knowledgebase.KnowledgeBase, error) {
	return toKnowledgeBaseFromRawRow(mysqlsqlc.FindKnowledgeBaseByIDRow(row))
}

func toKnowledgeBaseFromFindByCodeAndOrg(row mysqlsqlc.FindKnowledgeBaseByCodeAndOrgRow) (*knowledgebase.KnowledgeBase, error) {
	return toKnowledgeBaseFromRawRow(mysqlsqlc.FindKnowledgeBaseByIDRow(row))
}

func toKnowledgeBaseFromList(row mysqlsqlc.ListKnowledgeBasesRow) (*knowledgebase.KnowledgeBase, error) {
	return toKnowledgeBaseFromRawRow(mysqlsqlc.FindKnowledgeBaseByIDRow(row))
}

func toKnowledgeBaseFromListByCodes(row mysqlsqlc.ListKnowledgeBasesByCodesRow) (*knowledgebase.KnowledgeBase, error) {
	return toKnowledgeBaseFromRawRow(mysqlsqlc.FindKnowledgeBaseByIDRow(row))
}

func toKnowledgeBaseFromListByBusinessIDs(row mysqlsqlc.ListKnowledgeBasesByBusinessIDsRow) (*knowledgebase.KnowledgeBase, error) {
	return toKnowledgeBaseFromRawRow(mysqlsqlc.FindKnowledgeBaseByIDRow(row))
}

func toKnowledgeBaseFromListByCodesAndBusinessIDs(row mysqlsqlc.ListKnowledgeBasesByCodesAndBusinessIDsRow) (*knowledgebase.KnowledgeBase, error) {
	return toKnowledgeBaseFromRawRow(mysqlsqlc.FindKnowledgeBaseByIDRow(row))
}

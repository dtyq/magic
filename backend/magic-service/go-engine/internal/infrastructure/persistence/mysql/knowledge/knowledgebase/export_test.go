package knowledgebaserepo

import (
	"database/sql"
	"time"

	"github.com/redis/go-redis/v9"

	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
)

func ResolveKnowledgeBaseListFilterModeForTest(query *kbrepository.Query) string {
	return string(resolveKnowledgeBaseListFilterMode(query))
}

type KnowledgeBaseRawForTest struct {
	ID                int64
	Code              string
	Version           int32
	Name              string
	Description       string
	Type              int32
	Enabled           bool
	BusinessID        string
	SyncStatus        int32
	SyncStatusMessage string
	Model             string
	VectorDB          string
	OrganizationCode  string
	CreatedUID        string
	UpdatedUID        string
	ExpectedNum       int32
	CompletedNum      int32
	RetrieveConfig    []byte
	FragmentConfig    []byte
	EmbeddingConfig   []byte
	WordCount         int64
	Icon              string
	SourceType        sql.NullInt32
	KnowledgeBaseType string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

func BuildInsertKnowledgeBaseParamsForTest(knowledgeBase *kbentity.KnowledgeBase) (mysqlsqlc.InsertKnowledgeBaseParams, error) {
	return buildInsertKnowledgeBaseParams(knowledgeBase)
}

func FillKnowledgeBaseCommonForTest(raw KnowledgeBaseRawForTest) (*kbentity.KnowledgeBase, error) {
	return fillKnowledgeBaseCommon(knowledgeBaseRaw{
		id:                raw.ID,
		code:              raw.Code,
		version:           raw.Version,
		name:              raw.Name,
		description:       raw.Description,
		kbType:            raw.Type,
		enabled:           raw.Enabled,
		businessID:        raw.BusinessID,
		syncStatus:        raw.SyncStatus,
		syncStatusMessage: raw.SyncStatusMessage,
		model:             raw.Model,
		vectorDB:          raw.VectorDB,
		organizationCode:  raw.OrganizationCode,
		createdUID:        raw.CreatedUID,
		updatedUID:        raw.UpdatedUID,
		expectedNum:       raw.ExpectedNum,
		completedNum:      raw.CompletedNum,
		retrieveConfig:    raw.RetrieveConfig,
		fragmentConfig:    raw.FragmentConfig,
		embeddingConfig:   raw.EmbeddingConfig,
		wordCount:         raw.WordCount,
		icon:              raw.Icon,
		sourceType:        raw.SourceType,
		knowledgeBaseType: raw.KnowledgeBaseType,
		createdAt:         raw.CreatedAt,
		updatedAt:         raw.UpdatedAt,
	})
}

func NewBaseRepositoryWithDBForTest(db *sql.DB) *BaseRepository {
	return &BaseRepository{
		db:      db,
		queries: mysqlsqlc.New(db),
	}
}

func NewBaseRepositoryWithDBAndRedisForTest(db *sql.DB, redisClient *redis.Client) *BaseRepository {
	client := mysqlclient.NewSQLCClientWithDB(db, nil, false)
	return NewBaseRepositoryWithCollectionMetaCache(client, redisClient, nil)
}

func BuildKnowledgeBasesParamsForTest(
	repo *BaseRepository,
	query *kbrepository.Query,
) (mysqlsqlc.CountKnowledgeBasesParams, mysqlsqlc.ListKnowledgeBasesParams, error) {
	return repo.buildKnowledgeBasesParams(query)
}

func BuildCountByBusinessIDsParamsForTest(
	params mysqlsqlc.CountKnowledgeBasesParams,
	organizationCode string,
	businessIDs []string,
) mysqlsqlc.CountKnowledgeBasesByBusinessIDsParams {
	return buildCountByBusinessIDsParams(params, organizationCode, businessIDs)
}

func BuildListByBusinessIDsParamsForTest(
	params mysqlsqlc.ListKnowledgeBasesParams,
	organizationCode string,
	businessIDs []string,
) mysqlsqlc.ListKnowledgeBasesByBusinessIDsParams {
	return buildListByBusinessIDsParams(params, organizationCode, businessIDs)
}

func BuildCountByCodesParamsForTest(
	params mysqlsqlc.CountKnowledgeBasesParams,
	codes []string,
) mysqlsqlc.CountKnowledgeBasesByCodesParams {
	return buildCountByCodesParams(params, codes)
}

func BuildListByCodesParamsForTest(
	params mysqlsqlc.ListKnowledgeBasesParams,
	codes []string,
) mysqlsqlc.ListKnowledgeBasesByCodesParams {
	return buildListByCodesParams(params, codes)
}

func ToKnowledgeBaseFromFindByIDForTest(row mysqlsqlc.MagicFlowKnowledge) (*kbentity.KnowledgeBase, error) {
	return toKnowledgeBaseFromFindByID(row)
}

func ToKnowledgeBaseFromFindByCodeForTest(row mysqlsqlc.MagicFlowKnowledge) (*kbentity.KnowledgeBase, error) {
	return toKnowledgeBaseFromFindByCode(row)
}

func ToKnowledgeBaseFromFindByCodeAndOrgForTest(row mysqlsqlc.MagicFlowKnowledge) (*kbentity.KnowledgeBase, error) {
	return toKnowledgeBaseFromFindByCodeAndOrg(row)
}

func ToKnowledgeBaseFromListForKnowledgeBaseTest(row mysqlsqlc.MagicFlowKnowledge) (*kbentity.KnowledgeBase, error) {
	return toKnowledgeBaseFromList(row)
}

func ToKnowledgeBaseFromListByCodesForTest(row mysqlsqlc.MagicFlowKnowledge) (*kbentity.KnowledgeBase, error) {
	return toKnowledgeBaseFromListByCodes(row)
}

func ToKnowledgeBaseFromListByBusinessIDsForTest(row mysqlsqlc.MagicFlowKnowledge) (*kbentity.KnowledgeBase, error) {
	return toKnowledgeBaseFromListByBusinessIDs(row)
}

func ToKnowledgeBaseFromListByCodesAndBusinessIDsForTest(row mysqlsqlc.MagicFlowKnowledge) (*kbentity.KnowledgeBase, error) {
	return toKnowledgeBaseFromListByCodesAndBusinessIDs(row)
}

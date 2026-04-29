package documentrepo

import (
	"database/sql"

	docentity "magic/internal/domain/knowledge/document/entity"
	docrepo "magic/internal/domain/knowledge/document/repository"
	"magic/internal/infrastructure/logging"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
)

type DocumentListFilterParamsForTest struct {
	NameLike         string
	DocTypeValues    []uint32
	EnabledValues    []int8
	SyncStatusValues []int32
}

func BuildDocumentListFilterParamsForTest(query *docrepo.DocumentQuery) (DocumentListFilterParamsForTest, error) {
	params, err := buildDocumentListFilterParams(query)
	if err != nil {
		return DocumentListFilterParamsForTest{}, err
	}
	return DocumentListFilterParamsForTest{
		NameLike:         params.nameLike,
		DocTypeValues:    append([]uint32(nil), params.docTypeValues...),
		EnabledValues:    append([]int8(nil), params.enabledValues...),
		SyncStatusValues: append([]int32(nil), params.syncStatusValues...),
	}, nil
}

func BuildInsertDocumentParamsForTest(doc *docentity.KnowledgeBaseDocument) (mysqlsqlc.InsertDocumentParams, error) {
	return BuildInsertDocumentParams(doc)
}

func ToKnowledgeBaseDocumentForTest(row mysqlsqlc.KnowledgeBaseDocument) (*docentity.KnowledgeBaseDocument, error) {
	record, err := documentRecordFromModel(row)
	if err != nil {
		return nil, err
	}
	return toKnowledgeBaseDocument(record)
}

func NewDocumentRepositoryWithDBForTest(db *sql.DB, logger *logging.SugaredLogger) *DocumentRepository {
	return &DocumentRepository{
		queries: mysqlsqlc.New(db),
		logger:  logger,
	}
}

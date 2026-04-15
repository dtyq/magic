package documentrepo

import (
	"database/sql"

	"magic/internal/domain/knowledge/document/service"
	"magic/internal/infrastructure/logging"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
)

func NewDocumentRepositoryWithDBForTest(db *sql.DB, logger *logging.SugaredLogger) *DocumentRepository {
	client := mysqlclient.NewSQLCClientWithDB(db, nil, false)
	return NewDocumentRepository(client, logger)
}

func BuildInsertDocumentParamsForTest(doc *document.KnowledgeBaseDocument) (mysqlsqlc.InsertDocumentParams, error) {
	return BuildInsertDocumentParams(doc)
}

func ToKnowledgeBaseDocumentForTest(row mysqlsqlc.KnowledgeBaseDocument) (*document.KnowledgeBaseDocument, error) {
	return ToKnowledgeBaseDocument(row)
}

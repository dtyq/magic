package fragmentrepo

import (
	"database/sql"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/infrastructure/logging"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
)

func NewFragmentRepositoryWithDBForTest(db *sql.DB, logger *logging.SugaredLogger) *FragmentRepository {
	client := mysqlclient.NewSQLCClientWithDB(db, nil, false)
	return NewFragmentRepository(client, logger)
}

func ToFragmentFromListForTest(row mysqlsqlc.MagicFlowKnowledgeFragment) (*fragmodel.KnowledgeBaseFragment, error) {
	return toFragmentFromListByKnowledge(row)
}

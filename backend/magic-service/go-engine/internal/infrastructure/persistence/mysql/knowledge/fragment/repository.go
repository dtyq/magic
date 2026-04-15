// Package fragmentrepo 提供知识库片段仓储的 MySQL 实现。
package fragmentrepo

import (
	"database/sql"

	"magic/internal/infrastructure/logging"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
)

// FragmentRepository MySQL 片段仓储实现
type FragmentRepository struct {
	queries *mysqlsqlc.Queries
	db      *sql.DB
	client  *mysqlclient.SQLCClient
	logger  *logging.SugaredLogger
}

// NewFragmentRepository 创建片段仓储
func NewFragmentRepository(client *mysqlclient.SQLCClient, logger *logging.SugaredLogger) *FragmentRepository {
	return &FragmentRepository{
		queries: client.Q(),
		db:      client.DB(),
		client:  client,
		logger:  logger,
	}
}

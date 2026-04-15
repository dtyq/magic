// Package documentrepo 提供知识库文档仓储的 MySQL 实现。
package documentrepo

import (
	"magic/internal/infrastructure/logging"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
)

// DocumentRepository MySQL 文档仓储实现
type DocumentRepository struct {
	queries *mysqlsqlc.Queries
	client  *mysqlclient.SQLCClient
	logger  *logging.SugaredLogger
}

// NewDocumentRepository 创建文档仓储
func NewDocumentRepository(client *mysqlclient.SQLCClient, logger *logging.SugaredLogger) *DocumentRepository {
	return &DocumentRepository{
		queries: client.Q(),
		client:  client,
		logger:  logger,
	}
}

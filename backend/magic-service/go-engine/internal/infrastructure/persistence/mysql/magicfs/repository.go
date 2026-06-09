// Package magicfs 提供 MagicFS MySQL 读取实现。
package magicfs

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	domainmagicfs "magic/internal/domain/magicfs"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/pkg/convert"
)

var errRepositoryNil = errors.New("magicfs repository is nil")

// Repository 提供 MagicFS 文件只读查询。
type Repository struct {
	client  *mysqlclient.SQLCClient
	queries *mysqlsqlc.Queries
}

// NewRepository 创建 MagicFS MySQL 仓储。
func NewRepository(client *mysqlclient.SQLCClient) *Repository {
	var queries *mysqlsqlc.Queries
	if client != nil {
		queries = client.Q()
	}
	return &Repository{client: client, queries: queries}
}

// GetMetadataVersion 按 file_id 读取未删除文件的 metadata_version。
func (r *Repository) GetMetadataVersion(ctx context.Context, fileID int64) (int64, error) {
	if r == nil || r.client == nil || r.queries == nil {
		return 0, errRepositoryNil
	}
	if fileID <= 0 {
		return 0, domainmagicfs.ErrFileNotFound
	}

	version, err := r.queries.GetMagicFSFileMetadataVersionByID(ctx, uint64(fileID))
	if errors.Is(err, sql.ErrNoRows) {
		return 0, domainmagicfs.ErrFileNotFound
	}
	if err != nil {
		return 0, fmt.Errorf("query magicfs file metadata version: %w", err)
	}
	return convert.ClampToInt64(uint64(version)), nil
}

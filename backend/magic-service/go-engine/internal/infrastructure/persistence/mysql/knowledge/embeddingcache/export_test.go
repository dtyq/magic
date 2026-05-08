package embeddingcache

import (
	"context"
	"database/sql"

	"magic/internal/domain/knowledge/embedding"
	"magic/internal/infrastructure/logging"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
)

func NewRepositoryWithDBForTest(db *sql.DB, logger *logging.SugaredLogger) *Repository {
	client := mysqlclient.NewSQLCClientWithDB(db, nil, false)
	return NewRepository(client, logger)
}

func SQLCCacheToEntityForTest(cache mysqlsqlc.EmbeddingCache) (*embedding.Cache, error) {
	return sqlcCacheToEntity(cache)
}

func BuildInsertEmbeddingCacheParamsForTest(
	cache *embedding.Cache,
) (mysqlsqlc.InsertEmbeddingCacheParams, error) {
	return buildInsertEmbeddingCacheParams(cache)
}

func BuildEmbeddingCacheInsertArgsForTest(cache *embedding.Cache) ([]any, error) {
	row, err := buildEmbeddingCacheInsertRow(cache)
	if err != nil {
		return nil, err
	}
	args := make([]any, 0, len(row.args))
	args = append(args, row.args[:]...)
	return args, nil
}

func BuildEmbeddingCacheInsertBatchSQLForTest(rowCount int) string {
	return buildEmbeddingCacheInsertBatchSQL(rowCount)
}

func IsDuplicateEntryErrorForTest(err error) bool {
	return isDuplicateEntryError(err)
}

func GetOrCreateCacheForTest(
	ctx context.Context,
	cache *embedding.Cache,
	model string,
	findByHash func(context.Context, string, string) (*embedding.Cache, error),
	save func(context.Context, *embedding.Cache) error,
) (*embedding.Cache, error) {
	return getOrCreateCache(ctx, cache, model, findByHash, save)
}

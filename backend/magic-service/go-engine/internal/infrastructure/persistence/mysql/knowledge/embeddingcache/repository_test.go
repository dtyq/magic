package embeddingcache_test

import (
	"context"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"

	"magic/internal/domain/knowledge/embedding"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	embeddingcache "magic/internal/infrastructure/persistence/mysql/knowledge/embeddingcache"
)

func TestEmbeddingCacheRepositorySaveBatchUsesSingleBulkInsert(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() {
		_ = db.Close()
	}()

	client := mysqlclient.NewSQLCClientWithDB(db, nil, false)
	repo := embeddingcache.NewRepository(client, nil)

	first := embedding.NewEmbeddingCache("first text", []float64{0.1, 0.2}, "text-embedding-3-small")
	second := embedding.NewEmbeddingCache("second text", []float64{0.3, 0.4}, "text-embedding-3-small")

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta(`INSERT IGNORE INTO embedding_cache (
text_hash, text_preview, text_length, embedding, embedding_model,
vector_dimension, access_count, last_accessed_at, created_at, updated_at
) VALUES (?,?,?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?,?,?)`)).
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectCommit()

	if err := repo.SaveBatch(context.Background(), []*embedding.Cache{first, second}); err != nil {
		t.Fatalf("SaveBatch: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestEmbeddingCacheRepositorySaveIfAbsentUsesInsertIgnore(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() {
		_ = db.Close()
	}()

	client := mysqlclient.NewSQLCClientWithDB(db, nil, false)
	repo := embeddingcache.NewRepository(client, nil)

	mock.ExpectExec(regexp.QuoteMeta(`INSERT IGNORE INTO embedding_cache (
  text_hash, text_preview, text_length, embedding, embedding_model,
  vector_dimension, access_count, last_accessed_at, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(regexp.QuoteMeta(`INSERT IGNORE INTO embedding_cache (
  text_hash, text_preview, text_length, embedding, embedding_model,
  vector_dimension, access_count, last_accessed_at, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)).
		WillReturnResult(sqlmock.NewResult(0, 0))

	if err := repo.SaveIfAbsent(context.Background(), "hello", []float64{0.1, 0.2}, "text-embedding-3-small"); err != nil {
		t.Fatalf("SaveIfAbsent first call: %v", err)
	}
	if err := repo.SaveIfAbsent(context.Background(), "hello", []float64{0.1, 0.2}, "text-embedding-3-small"); err != nil {
		t.Fatalf("SaveIfAbsent duplicate call: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

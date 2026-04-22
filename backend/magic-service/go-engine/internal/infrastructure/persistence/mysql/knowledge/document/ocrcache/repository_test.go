package ocrcache_test

import (
	"context"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"

	documentdomain "magic/internal/domain/knowledge/document/service"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	ocrcache "magic/internal/infrastructure/persistence/mysql/knowledge/document/ocrcache"
)

func TestOCRCacheRepositoryUpsertURLCache(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	client := mysqlclient.NewSQLCClientWithDB(db, nil, false)
	repo := ocrcache.NewRepository(client, nil)

	mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO embedding_cache (
  text_hash, text_preview, text_length, embedding, embedding_model,
  vector_dimension, access_count, last_accessed_at, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  text_preview = VALUES(text_preview),
  text_length = VALUES(text_length),
  embedding = VALUES(embedding),
  vector_dimension = VALUES(vector_dimension),
  access_count = access_count + 1,
  last_accessed_at = VALUES(last_accessed_at),
  updated_at = VALUES(updated_at)`)).
		WithArgs(
			"hash-url",
			"识别结果内容超长截断",
			len("识别结果内容超长截断测试"),
			sqlmock.AnyArg(),
			"ocr:volcengine:url",
			0,
			1,
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err = repo.UpsertURLCache(context.Background(), &documentdomain.OCRResultCache{
		TextHash:       "hash-url",
		EmbeddingModel: "ocr:volcengine:url",
		Content:        "识别结果内容超长截断测试",
		FileType:       "pdf",
		Etag:           "etag-1",
		LastModified:   "Wed, 21 Oct 2015 07:28:00 GMT",
		ContentLength:  "128",
	})
	if err != nil {
		t.Fatalf("UpsertURLCache: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestOCRCacheRepositoryFindBytesCacheAndTouch(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	client := mysqlclient.NewSQLCClientWithDB(db, nil, false)
	repo := ocrcache.NewRepository(client, nil)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, text_hash, text_preview, text_length, embedding, embedding_model,
       vector_dimension, access_count, last_accessed_at, created_at, updated_at
FROM embedding_cache
WHERE text_hash = ?
  AND embedding_model = ?
LIMIT 1`)).
		WithArgs("hash-bytes", "ocr:volcengine:bytes").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "text_hash", "text_preview", "text_length", "embedding", "embedding_model",
			"vector_dimension", "access_count", "last_accessed_at", "created_at", "updated_at",
		}).AddRow(
			7,
			"hash-bytes",
			"图片文字",
			12,
			[]byte(`{"content":"图片文字","file_type":"png"}`),
			"ocr:volcengine:bytes",
			0,
			3,
			time.Date(2026, 4, 9, 10, 0, 0, 0, time.Local),
			time.Date(2026, 4, 9, 9, 0, 0, 0, time.Local),
			time.Date(2026, 4, 9, 10, 0, 0, 0, time.Local),
		))

	cache, err := repo.FindBytesCache(context.Background(), "hash-bytes", "ocr:volcengine:bytes")
	if err != nil {
		t.Fatalf("FindBytesCache: %v", err)
	}
	if cache == nil || cache.Content != "图片文字" || cache.FileType != "png" {
		t.Fatalf("unexpected cache: %#v", cache)
	}

	mock.ExpectExec(regexp.QuoteMeta(`UPDATE embedding_cache
SET access_count = access_count + 1,
    last_accessed_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?`)).
		WithArgs(int64(7)).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.Touch(context.Background(), 7); err != nil {
		t.Fatalf("Touch: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

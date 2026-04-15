package rebuild_test

import (
	"context"
	"database/sql"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	miniredis "github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"magic/internal/constants"
	domainrebuild "magic/internal/domain/knowledge/rebuild"
	mysqlrebuild "magic/internal/infrastructure/persistence/mysql/rebuild"
)

func TestMySQLStoreGetCollectionMetaUsesRedisCache(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	redisServer, redisClient := newCollectionMetaRedisForRebuildTest(t)
	defer redisServer.Close()

	store := mysqlrebuild.NewMySQLStoreWithCollectionMetaCache(db, redisClient, nil)
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT model, COALESCE(embedding_config, CAST('{}' AS JSON)) AS embedding_config
FROM magic_flow_knowledge
WHERE code = ?
  AND deleted_at IS NULL
LIMIT 1`)).
		WithArgs(constants.KnowledgeBaseCollectionMetaCode).
		WillReturnRows(sqlmock.NewRows([]string{"model", "embedding_config"}).AddRow(
			"text-embedding-3-large",
			[]byte(`{"collection_name":"magic_knowledge","physical_collection_name":"magic_knowledge_r1","vector_dimension":3072}`),
		))

	first, err := store.GetCollectionMeta(context.Background())
	if err != nil {
		t.Fatalf("first GetCollectionMeta() error = %v", err)
	}
	second, err := store.GetCollectionMeta(context.Background())
	if err != nil {
		t.Fatalf("second GetCollectionMeta() error = %v", err)
	}

	if !first.Exists || second.PhysicalCollectionName != "magic_knowledge_r1" {
		t.Fatalf("unexpected cached meta: first=%+v second=%+v", first, second)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestMySQLStoreGetCollectionMetaCachesNoRows(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	redisServer, redisClient := newCollectionMetaRedisForRebuildTest(t)
	defer redisServer.Close()

	store := mysqlrebuild.NewMySQLStoreWithCollectionMetaCache(db, redisClient, nil)
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT model, COALESCE(embedding_config, CAST('{}' AS JSON)) AS embedding_config
FROM magic_flow_knowledge
WHERE code = ?
  AND deleted_at IS NULL
LIMIT 1`)).
		WithArgs(constants.KnowledgeBaseCollectionMetaCode).
		WillReturnError(sql.ErrNoRows)

	first, err := store.GetCollectionMeta(context.Background())
	if err != nil {
		t.Fatalf("first GetCollectionMeta() error = %v", err)
	}
	second, err := store.GetCollectionMeta(context.Background())
	if err != nil {
		t.Fatalf("second GetCollectionMeta() error = %v", err)
	}

	if first.Exists || second.Exists {
		t.Fatalf("expected negative cache result, got first=%+v second=%+v", first, second)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestMySQLStoreUpsertCollectionMetaRefreshesRedisCache(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	redisServer, redisClient := newCollectionMetaRedisForRebuildTest(t)
	defer redisServer.Close()

	store := mysqlrebuild.NewMySQLStoreWithCollectionMetaCache(db, redisClient, nil)
	meta := domainrebuild.CollectionMeta{
		CollectionName:         "magic_knowledge",
		PhysicalCollectionName: "magic_knowledge_r2",
		Model:                  "text-embedding-3-large",
		VectorDimension:        3072,
		Exists:                 true,
	}

	mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO magic_flow_knowledge (
    code, version, name, description, type, enabled, business_id,
    sync_status, sync_status_message, model, vector_db, organization_code,
    created_uid, updated_uid, expected_num, completed_num,
    retrieve_config, fragment_config, embedding_config, word_count, icon,
    source_type, created_at, updated_at, deleted_at
) VALUES (
    ?, 1, ?, ?, 1, TRUE, '',
    0, '', ?, ?, ?,
    '', '', 0, 0,
    NULL, NULL, ?, 0, '',
    NULL, NOW(), NOW(), NULL
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    model = VALUES(model),
    vector_db = VALUES(vector_db),
    organization_code = VALUES(organization_code),
    embedding_config = VALUES(embedding_config),
    deleted_at = NULL,
    updated_at = NOW()`)).
		WithArgs(
			constants.KnowledgeBaseCollectionMetaCode,
			constants.KnowledgeBaseCollectionMetaName,
			constants.KnowledgeBaseCollectionMetaDescription,
			meta.Model,
			constants.KnowledgeBaseCollectionMetaVectorDB,
			constants.KnowledgeBaseCollectionMetaOrganizationCode,
			sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	if err := store.UpsertCollectionMeta(context.Background(), meta); err != nil {
		t.Fatalf("UpsertCollectionMeta() error = %v", err)
	}

	got, err := store.GetCollectionMeta(context.Background())
	if err != nil {
		t.Fatalf("GetCollectionMeta() error = %v", err)
	}
	if got.PhysicalCollectionName != meta.PhysicalCollectionName || got.Model != meta.Model || !got.Exists {
		t.Fatalf("unexpected cached meta after upsert: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func newCollectionMetaRedisForRebuildTest(t *testing.T) (*miniredis.Miniredis, *redis.Client) {
	t.Helper()

	server, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis.Run: %v", err)
	}
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	return server, client
}

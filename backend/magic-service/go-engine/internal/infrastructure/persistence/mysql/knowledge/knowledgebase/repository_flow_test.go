package knowledgebaserepo_test

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"

	"magic/internal/constants"
	"magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
	knowledgebaserepo "magic/internal/infrastructure/persistence/mysql/knowledge/knowledgebase"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/pkg/convert"
)

func sqlPattern(query string) string {
	return `(?s)(?:-- name: .*?\n)?` + regexp.QuoteMeta(strings.TrimSpace(query))
}

func knowledgeBaseListFilterArgs(orgCode string) []driver.Value {
	nullString := sql.NullString{}
	nullInt32 := sql.NullInt32{}
	nullBool := sql.NullBool{}
	if orgCode == "" {
		return []driver.Value{
			nullString, nullString,
			nullString, nullString,
			nullInt32, nullInt32,
			nullString, nullString,
			nullBool, nullBool,
			nullInt32, nullInt32,
		}
	}
	org := sql.NullString{String: orgCode, Valid: true}
	return []driver.Value{
		org, org,
		nullString, nullString,
		nullInt32, nullInt32,
		nullString, nullString,
		nullBool, nullBool,
		nullInt32, nullInt32,
	}
}

func expectKnowledgeBaseListByOrg(
	mock sqlmock.Sqlmock,
	rowValues []driver.Value,
	orgCode string,
	limit int32,
	offset int32,
) {
	mock.ExpectQuery(sqlPattern(`SELECT COUNT(*)
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND (? IS NULL OR organization_code = ?)
  AND (? IS NULL OR name LIKE ?)
  AND (? IS NULL OR type = ?)
  AND (? IS NULL OR knowledge_base_type = ?)
  AND (? IS NULL OR enabled = ?)
  AND (? IS NULL OR sync_status = ?)`)).
		WithArgs(knowledgeBaseListFilterArgs(orgCode)...).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery(sqlPattern(`SELECT id, code, version, name, description, type, enabled, business_id,
       sync_status, sync_status_message, model, vector_db, organization_code,
       created_uid, updated_uid, expected_num, completed_num,
       COALESCE(retrieve_config, CAST('null' AS JSON)) AS retrieve_config,
       COALESCE(fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(embedding_config, CAST('null' AS JSON)) AS embedding_config,
       word_count, icon,
       source_type, knowledge_base_type, created_at, updated_at
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND (? IS NULL OR organization_code = ?)
  AND (? IS NULL OR name LIKE ?)
  AND (? IS NULL OR type = ?)
  AND (? IS NULL OR knowledge_base_type = ?)
  AND (? IS NULL OR enabled = ?)
  AND (? IS NULL OR sync_status = ?)
ORDER BY id DESC
LIMIT ? OFFSET ?`)).
		WithArgs(append(knowledgeBaseListFilterArgs(orgCode), limit, offset)...).
		WillReturnRows(sqlmock.NewRows(knowledgeBaseRowColumns()).AddRow(rowValues...))
}

const (
	testKnowledgeBaseCode       = "KB-1"
	testKnowledgeBaseCode2      = "KB-2"
	testKnowledgeBaseOrgCode    = "ORG-1"
	testKnowledgeBaseBusinessID = "BIZ-1"
	testEmbeddingModelLarge     = "text-embedding-3-large"
	testKnowledgeBaseName       = "知识库"
	testKnowledgeBaseDesc       = "desc"
)

func TestBuildInsertKnowledgeBaseParamsAndFillKnowledgeBaseCommon(t *testing.T) {
	t.Parallel()

	sourceType := int(knowledgebase.SourceTypeCustomContent)
	kb := sampleKnowledgeBase()
	kb.SourceType = &sourceType

	params, err := knowledgebaserepo.BuildInsertKnowledgeBaseParamsForTest(kb)
	if err != nil {
		t.Fatalf("buildInsertKnowledgeBaseParams returned error: %v", err)
	}
	if params.Code != kb.Code || params.VectorDb != kb.VectorDB || params.SourceType.Int32 != mustInt32(t, sourceType) {
		t.Fatalf("unexpected params: %#v", params)
	}
	if params.KnowledgeBaseType != string(kb.KnowledgeBaseType) {
		t.Fatalf("expected knowledge_base_type=%q, got %q", kb.KnowledgeBaseType, params.KnowledgeBaseType)
	}

	built, err := knowledgebaserepo.FillKnowledgeBaseCommonForTest(buildKnowledgeBaseRawForTest(t, kb, sourceType))
	if err != nil {
		t.Fatalf("fillKnowledgeBaseCommon returned error: %v", err)
	}
	if built.SourceType == nil || *built.SourceType != sourceType {
		t.Fatalf("expected source_type=%d, got %#v", sourceType, built.SourceType)
	}
	if built.KnowledgeBaseType != kb.KnowledgeBaseType {
		t.Fatalf("expected knowledge_base_type=%q, got %q", kb.KnowledgeBaseType, built.KnowledgeBaseType)
	}
	if built.RetrieveConfig == nil || built.RetrieveConfig.TopK != kb.RetrieveConfig.TopK {
		t.Fatalf("expected retrieve config preserved, got %#v", built.RetrieveConfig)
	}
}

func TestFillKnowledgeBaseCommonRejectsInvalidJSON(t *testing.T) {
	t.Parallel()

	_, err := knowledgebaserepo.FillKnowledgeBaseCommonForTest(knowledgebaserepo.KnowledgeBaseRawForTest{
		RetrieveConfig: []byte(`{`),
	})
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestFillKnowledgeBaseCommonPreservesLegacyEnterpriseSourceType(t *testing.T) {
	t.Parallel()

	kb := sampleKnowledgeBase()
	legacySourceType := int(knowledgebase.SourceTypeLegacyEnterpriseWiki)

	built, err := knowledgebaserepo.FillKnowledgeBaseCommonForTest(buildKnowledgeBaseRawForTest(t, kb, legacySourceType))
	if err != nil {
		t.Fatalf("fillKnowledgeBaseCommon returned error: %v", err)
	}
	if built.SourceType == nil || *built.SourceType != legacySourceType {
		t.Fatalf("expected source_type=%d, got %#v", legacySourceType, built.SourceType)
	}
}

func TestFillKnowledgeBaseCommonPreservesStaffEnterpriseSourceType(t *testing.T) {
	t.Parallel()

	kb := sampleKnowledgeBase()
	staffEnterpriseSourceType := int(knowledgebase.SourceTypeEnterpriseWiki)

	built, err := knowledgebaserepo.FillKnowledgeBaseCommonForTest(buildKnowledgeBaseRawForTest(t, kb, staffEnterpriseSourceType))
	if err != nil {
		t.Fatalf("fillKnowledgeBaseCommon returned error: %v", err)
	}
	if built.SourceType == nil || *built.SourceType != staffEnterpriseSourceType {
		t.Fatalf("expected source_type=%d, got %#v", staffEnterpriseSourceType, built.SourceType)
	}
}

func TestBaseRepositorySaveAssignsInsertedID(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := knowledgebaserepo.NewBaseRepositoryWithDBForTest(db)
	kb := sampleKnowledgeBase()

	mock.ExpectExec(sqlPattern(`INSERT INTO magic_flow_knowledge (
  code, version, name, description, type, enabled, business_id,
  sync_status, sync_status_message, model, vector_db, organization_code,
  created_uid, updated_uid, expected_num, completed_num,
  retrieve_config, fragment_config, embedding_config, word_count, icon,
  source_type, knowledge_base_type, created_at, updated_at
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)`)).
		WithArgs(
			kb.Code,
			mustInt32(t, kb.Version),
			kb.Name,
			kb.Description,
			mustInt32(t, kb.Type),
			kb.Enabled,
			kb.BusinessID,
			mustInt32(t, int(kb.SyncStatus)),
			kb.SyncStatusMessage,
			kb.Model,
			kb.VectorDB,
			kb.OrganizationCode,
			kb.CreatedUID,
			kb.UpdatedUID,
			mustInt32(t, kb.ExpectedNum),
			mustInt32(t, kb.CompletedNum),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			int64(kb.WordCount),
			kb.Icon,
			sql.NullInt32{},
			string(knowledgebase.KnowledgeBaseTypeFlowVector),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(42, 1))

	if err := repo.Save(context.Background(), kb); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}
	if kb.ID != 42 {
		t.Fatalf("expected inserted id=42, got %d", kb.ID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestNewBaseRepositoryBuildsClientBackedRepository(t *testing.T) {
	t.Parallel()

	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := knowledgebaserepo.NewBaseRepositoryWithDBForTest(db)
	if repo == nil {
		t.Fatalf("expected repository initialized, got %#v", repo)
	}
}

func TestBaseRepositoryUpdateDeleteAndProgress(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := knowledgebaserepo.NewBaseRepositoryWithDBForTest(db)
	kb := sampleKnowledgeBase()
	kb.ID = 9

	mock.ExpectExec(sqlPattern(`UPDATE magic_flow_knowledge
SET name = ?,
    description = ?,
    enabled = ?,
    updated_uid = ?,
    source_type = ?,
    knowledge_base_type = ?,
    retrieve_config = ?,
    fragment_config = ?,
    embedding_config = ?,
    word_count = ?,
    icon = ?,
    updated_at = ?
WHERE id = ?
  AND deleted_at IS NULL`)).
		WithArgs(
			kb.Name,
			kb.Description,
			kb.Enabled,
			kb.UpdatedUID,
			sqlmock.AnyArg(),
			string(knowledgebase.KnowledgeBaseTypeFlowVector),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			int64(kb.WordCount),
			kb.Icon,
			sqlmock.AnyArg(),
			kb.ID,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(sqlPattern(`UPDATE magic_flow_knowledge
SET sync_status = ?,
    sync_status_message = ?,
    updated_at = ?
WHERE id = ?
  AND deleted_at IS NULL`)).
		WithArgs(int32(shared.SyncStatusSyncing), "running", sqlmock.AnyArg(), kb.ID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(sqlPattern(`UPDATE magic_flow_knowledge
SET expected_num = ?,
    completed_num = ?,
    updated_at = ?
WHERE id = ?
  AND deleted_at IS NULL`)).
		WithArgs(int32(10), int32(6), sqlmock.AnyArg(), kb.ID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(sqlPattern(`DELETE FROM magic_flow_knowledge
WHERE id = ?`)).
		WithArgs(kb.ID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.Update(context.Background(), kb); err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if err := repo.UpdateSyncStatus(context.Background(), kb.ID, shared.SyncStatusSyncing, "running"); err != nil {
		t.Fatalf("UpdateSyncStatus returned error: %v", err)
	}
	if err := repo.UpdateProgress(context.Background(), kb.ID, 10, 6); err != nil {
		t.Fatalf("UpdateProgress returned error: %v", err)
	}
	if err := repo.Delete(context.Background(), kb.ID); err != nil {
		t.Fatalf("Delete returned error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestBaseRepositoryGetCollectionMetaAndUpsertCollectionMeta(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := knowledgebaserepo.NewBaseRepositoryWithDBForTest(db)
	configJSON := `{"collection_name":"shared_kb","vector_dimension":3072}`
	mock.ExpectQuery(sqlPattern(`SELECT model, COALESCE(embedding_config, CAST('{}' AS JSON)) AS embedding_config
FROM magic_flow_knowledge
WHERE code = ?
  AND deleted_at IS NULL
LIMIT 1`)).
		WithArgs(constants.KnowledgeBaseCollectionMetaCode).
		WillReturnRows(sqlmock.NewRows([]string{"model", "embedding_config"}).AddRow("text-embedding-3-large", []byte(configJSON)))
	mock.ExpectExec(sqlPattern(`INSERT INTO magic_flow_knowledge (
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
			"text-embedding-3-large",
			constants.KnowledgeBaseCollectionMetaVectorDB,
			constants.KnowledgeBaseCollectionMetaOrganizationCode,
			sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	meta, err := repo.GetCollectionMeta(context.Background())
	if err != nil {
		t.Fatalf("GetCollectionMeta returned error: %v", err)
	}
	if !meta.Exists || meta.CollectionName != "shared_kb" || meta.VectorDimension != 3072 {
		t.Fatalf("unexpected meta: %#v", meta)
	}
	if err := repo.UpsertCollectionMeta(context.Background(), knowledgebase.CollectionMeta{
		CollectionName:  "shared_kb",
		Model:           "text-embedding-3-large",
		VectorDimension: 3072,
	}); err != nil {
		t.Fatalf("UpsertCollectionMeta returned error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestBaseRepositoryGetCollectionMetaObjectCompatPayloads(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		payload []byte
	}{
		{name: "empty array", payload: []byte(`[]`)},
		{name: "empty string", payload: []byte(`""`)},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			db, mock, err := sqlmock.New()
			if err != nil {
				t.Fatalf("sqlmock.New: %v", err)
			}
			defer func() { _ = db.Close() }()

			repo := knowledgebaserepo.NewBaseRepositoryWithDBForTest(db)
			mock.ExpectQuery(sqlPattern(`SELECT model, COALESCE(embedding_config, CAST('{}' AS JSON)) AS embedding_config
FROM magic_flow_knowledge
WHERE code = ?
  AND deleted_at IS NULL
LIMIT 1`)).
				WithArgs(constants.KnowledgeBaseCollectionMetaCode).
				WillReturnRows(sqlmock.NewRows([]string{"model", "embedding_config"}).AddRow("model-x", tc.payload))

			meta, err := repo.GetCollectionMeta(context.Background())
			if err != nil {
				t.Fatalf("GetCollectionMeta returned error: %v", err)
			}
			if !meta.Exists || meta.Model != "model-x" {
				t.Fatalf("unexpected meta: %#v", meta)
			}
			if meta.CollectionName != "" || meta.VectorDimension != 0 || meta.SparseBackend != "" {
				t.Fatalf("expected empty config fields, got %#v", meta)
			}
		})
	}
}

func TestBaseRepositoryGetCollectionMetaReturnsEmptyWhenNotFound(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := knowledgebaserepo.NewBaseRepositoryWithDBForTest(db)
	mock.ExpectQuery(sqlPattern(`SELECT model, COALESCE(embedding_config, CAST('{}' AS JSON)) AS embedding_config
FROM magic_flow_knowledge
WHERE code = ?
  AND deleted_at IS NULL
LIMIT 1`)).
		WithArgs(constants.KnowledgeBaseCollectionMetaCode).
		WillReturnError(sql.ErrNoRows)

	meta, err := repo.GetCollectionMeta(context.Background())
	if err != nil {
		t.Fatalf("GetCollectionMeta returned error: %v", err)
	}
	if meta.Exists {
		t.Fatalf("expected empty meta when row missing, got %#v", meta)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestBaseRepositoryFindByCodeAndOrgAndList(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := knowledgebaserepo.NewBaseRepositoryWithDBForTest(db)
	now := time.Date(2026, 3, 11, 12, 0, 0, 0, time.Local)
	rowValues := knowledgeBaseRowValues(t, now)

	mock.ExpectQuery(sqlPattern(`SELECT id, code, version, name, description, type, enabled, business_id,
       sync_status, sync_status_message, model, vector_db, organization_code,
       created_uid, updated_uid, expected_num, completed_num,
       COALESCE(retrieve_config, CAST('null' AS JSON)) AS retrieve_config,
       COALESCE(fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(embedding_config, CAST('null' AS JSON)) AS embedding_config,
       word_count, icon,
       source_type, knowledge_base_type, created_at, updated_at
FROM magic_flow_knowledge
WHERE code = ?
  AND organization_code = ?
  AND deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
LIMIT 1`)).
		WithArgs("KB-1", "ORG-1").
		WillReturnRows(sqlmock.NewRows(knowledgeBaseRowColumns()).AddRow(rowValues...))
	expectKnowledgeBaseListByOrg(mock, rowValues, "ORG-1", 20, 0)

	found, err := repo.FindByCodeAndOrg(context.Background(), "KB-1", "ORG-1")
	if err != nil {
		t.Fatalf("FindByCodeAndOrg returned error: %v", err)
	}
	if found.Code != testKnowledgeBaseCode || found.OrganizationCode != testKnowledgeBaseOrgCode {
		t.Fatalf("unexpected found result: %#v", found)
	}
	list, total, err := repo.List(context.Background(), &knowledgebase.Query{
		OrganizationCode: "ORG-1",
		Limit:            20,
	})
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if total != 1 || len(list) != 1 || list[0].Code != testKnowledgeBaseCode {
		t.Fatalf("unexpected list result: total=%d list=%#v", total, list)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestBaseRepositoryFindByIDAndFindByCode(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := knowledgebaserepo.NewBaseRepositoryWithDBForTest(db)
	now := time.Date(2026, 3, 11, 12, 30, 0, 0, time.Local)
	rowValues := knowledgeBaseRowValues(t, now)

	mock.ExpectQuery(sqlPattern(`SELECT id, code, version, name, description, type, enabled, business_id,
       sync_status, sync_status_message, model, vector_db, organization_code,
       created_uid, updated_uid, expected_num, completed_num,
       COALESCE(retrieve_config, CAST('null' AS JSON)) AS retrieve_config,
       COALESCE(fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(embedding_config, CAST('null' AS JSON)) AS embedding_config,
       word_count, icon,
       source_type, knowledge_base_type, created_at, updated_at
FROM magic_flow_knowledge
WHERE id = ?
  AND deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'`)).
		WithArgs(int64(1)).
		WillReturnRows(sqlmock.NewRows(knowledgeBaseRowColumns()).AddRow(rowValues...))
	mock.ExpectQuery(sqlPattern(`SELECT id, code, version, name, description, type, enabled, business_id,
       sync_status, sync_status_message, model, vector_db, organization_code,
       created_uid, updated_uid, expected_num, completed_num,
       COALESCE(retrieve_config, CAST('null' AS JSON)) AS retrieve_config,
       COALESCE(fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(embedding_config, CAST('null' AS JSON)) AS embedding_config,
       word_count, icon,
       source_type, knowledge_base_type, created_at, updated_at
FROM magic_flow_knowledge
WHERE code = ?
  AND deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
LIMIT 1`)).
		WithArgs("KB-1").
		WillReturnRows(sqlmock.NewRows(knowledgeBaseRowColumns()).AddRow(rowValues...))

	byID, err := repo.FindByID(context.Background(), 1)
	if err != nil {
		t.Fatalf("FindByID returned error: %v", err)
	}
	byCode, err := repo.FindByCode(context.Background(), "KB-1")
	if err != nil {
		t.Fatalf("FindByCode returned error: %v", err)
	}
	if byID.Code != testKnowledgeBaseCode || byCode.Code != testKnowledgeBaseCode {
		t.Fatalf("unexpected find results: byID=%#v byCode=%#v", byID, byCode)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestBaseRepositoryListByCodesAndBusinessIDs(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := knowledgebaserepo.NewBaseRepositoryWithDBForTest(db)
	now := time.Date(2026, 3, 11, 13, 0, 0, 0, time.Local)
	rowValues := knowledgeBaseRowValues(t, now)

	mock.ExpectQuery(sqlPattern(`SELECT COUNT(*)
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND (? IS NULL OR organization_code = ?)
  AND (? IS NULL OR name LIKE ?)
  AND (? IS NULL OR type = ?)
  AND (? IS NULL OR knowledge_base_type = ?)
  AND (? IS NULL OR enabled = ?)
  AND (? IS NULL OR sync_status = ?)
  AND code IN (?,?)
  AND business_id IN (?)`)).
		WithArgs(append(knowledgeBaseListFilterArgs(""), "KB-1", "KB-2", "BIZ-1")...).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery(sqlPattern(`SELECT id, code, version, name, description, type, enabled, business_id,
       sync_status, sync_status_message, model, vector_db, organization_code,
       created_uid, updated_uid, expected_num, completed_num,
       COALESCE(retrieve_config, CAST('null' AS JSON)) AS retrieve_config,
       COALESCE(fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(embedding_config, CAST('null' AS JSON)) AS embedding_config,
       word_count, icon,
       source_type, knowledge_base_type, created_at, updated_at
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND (? IS NULL OR organization_code = ?)
  AND (? IS NULL OR name LIKE ?)
  AND (? IS NULL OR type = ?)
  AND (? IS NULL OR knowledge_base_type = ?)
  AND (? IS NULL OR enabled = ?)
  AND (? IS NULL OR sync_status = ?)
  AND code IN (?,?)
  AND business_id IN (?)
ORDER BY id DESC
LIMIT ? OFFSET ?`)).
		WithArgs(append(append(knowledgeBaseListFilterArgs(""), "KB-1", "KB-2", "BIZ-1"), int32(10), int32(0))...).
		WillReturnRows(sqlmock.NewRows(knowledgeBaseRowColumns()).AddRow(rowValues...))

	list, total, err := repo.List(context.Background(), &knowledgebase.Query{
		Codes:       []string{"KB-1", "KB-2"},
		BusinessIDs: []string{"BIZ-1"},
		Limit:       10,
	})
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if total != 1 || len(list) != 1 {
		t.Fatalf("unexpected list result: total=%d list=%#v", total, list)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestBaseRepositoryListByCodes(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := knowledgebaserepo.NewBaseRepositoryWithDBForTest(db)
	now := time.Date(2026, 3, 11, 13, 30, 0, 0, time.Local)
	rowValues := knowledgeBaseRowValues(t, now)

	mock.ExpectQuery(sqlPattern(`SELECT COUNT(*)
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND (? IS NULL OR organization_code = ?)
  AND (? IS NULL OR name LIKE ?)
  AND (? IS NULL OR type = ?)
  AND (? IS NULL OR knowledge_base_type = ?)
  AND (? IS NULL OR enabled = ?)
  AND (? IS NULL OR sync_status = ?)
  AND code IN (?,?)`)).
		WithArgs(append(knowledgeBaseListFilterArgs(""), "KB-1", "KB-2")...).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery(sqlPattern(`SELECT id, code, version, name, description, type, enabled, business_id,
       sync_status, sync_status_message, model, vector_db, organization_code,
       created_uid, updated_uid, expected_num, completed_num,
       COALESCE(retrieve_config, CAST('null' AS JSON)) AS retrieve_config,
       COALESCE(fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(embedding_config, CAST('null' AS JSON)) AS embedding_config,
       word_count, icon,
       source_type, knowledge_base_type, created_at, updated_at
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND (? IS NULL OR organization_code = ?)
  AND (? IS NULL OR name LIKE ?)
  AND (? IS NULL OR type = ?)
  AND (? IS NULL OR knowledge_base_type = ?)
  AND (? IS NULL OR enabled = ?)
  AND (? IS NULL OR sync_status = ?)
  AND code IN (?,?)
ORDER BY id DESC
LIMIT ? OFFSET ?`)).
		WithArgs(append(append(knowledgeBaseListFilterArgs(""), "KB-1", "KB-2"), int32(5), int32(0))...).
		WillReturnRows(sqlmock.NewRows(knowledgeBaseRowColumns()).AddRow(rowValues...))

	list, total, err := repo.List(context.Background(), &knowledgebase.Query{
		Codes: []string{"KB-1", "KB-2"},
		Limit: 5,
	})
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if total != 1 || len(list) != 1 {
		t.Fatalf("unexpected list result: total=%d list=%#v", total, list)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestBaseRepositoryListByBusinessIDs(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := knowledgebaserepo.NewBaseRepositoryWithDBForTest(db)
	now := time.Date(2026, 3, 11, 13, 45, 0, 0, time.Local)
	rowValues := knowledgeBaseRowValues(t, now)

	mock.ExpectQuery(sqlPattern(`SELECT COUNT(*)
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND (? IS NULL OR organization_code = ?)
  AND (? IS NULL OR name LIKE ?)
  AND (? IS NULL OR type = ?)
  AND (? IS NULL OR knowledge_base_type = ?)
  AND (? IS NULL OR enabled = ?)
  AND (? IS NULL OR sync_status = ?)
  AND business_id IN (?)`)).
		WithArgs(append(knowledgeBaseListFilterArgs(""), "BIZ-1")...).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery(sqlPattern(`SELECT id, code, version, name, description, type, enabled, business_id,
       sync_status, sync_status_message, model, vector_db, organization_code,
       created_uid, updated_uid, expected_num, completed_num,
       COALESCE(retrieve_config, CAST('null' AS JSON)) AS retrieve_config,
       COALESCE(fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(embedding_config, CAST('null' AS JSON)) AS embedding_config,
       word_count, icon,
       source_type, knowledge_base_type, created_at, updated_at
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND (? IS NULL OR organization_code = ?)
  AND (? IS NULL OR name LIKE ?)
  AND (? IS NULL OR type = ?)
  AND (? IS NULL OR knowledge_base_type = ?)
  AND (? IS NULL OR enabled = ?)
  AND (? IS NULL OR sync_status = ?)
  AND business_id IN (?)
ORDER BY id DESC
LIMIT ? OFFSET ?`)).
		WithArgs(append(append(knowledgeBaseListFilterArgs(""), "BIZ-1"), int32(5), int32(0))...).
		WillReturnRows(sqlmock.NewRows(knowledgeBaseRowColumns()).AddRow(rowValues...))

	list, total, err := repo.List(context.Background(), &knowledgebase.Query{
		BusinessIDs: []string{"BIZ-1"},
		Limit:       5,
	})
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if total != 1 || len(list) != 1 {
		t.Fatalf("unexpected list result: total=%d list=%#v", total, list)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestBaseRepositoryListByCodesAndBusinessIDsBuilderHelpers(t *testing.T) {
	t.Parallel()

	repo := knowledgebaserepo.NewBaseRepositoryWithDBForTest(nil)
	enabled := true
	kbType := 2
	status := shared.SyncStatusSyncing
	countParams, listParams, err := knowledgebaserepo.BuildKnowledgeBasesParamsForTest(repo, &knowledgebase.Query{
		OrganizationCode: testKnowledgeBaseOrgCode,
		Name:             "关键字",
		Type:             &kbType,
		Enabled:          &enabled,
		SyncStatus:       &status,
		Offset:           5,
		Limit:            10,
	})
	if err != nil {
		t.Fatalf("buildKnowledgeBasesParams returned error: %v", err)
	}
	if !countParams.OrganizationCode.Valid || countParams.OrganizationCode.String != testKnowledgeBaseOrgCode {
		t.Fatalf("unexpected count params: %#v", countParams)
	}
	if listParams.Limit != 10 || listParams.Offset != 5 {
		t.Fatalf("unexpected list params: %#v", listParams)
	}

	bizCount := knowledgebaserepo.BuildCountByBusinessIDsParamsForTest(countParams, []string{testKnowledgeBaseBusinessID})
	bizList := knowledgebaserepo.BuildListByBusinessIDsParamsForTest(listParams, []string{testKnowledgeBaseBusinessID})
	codeCount := knowledgebaserepo.BuildCountByCodesParamsForTest(countParams, []string{testKnowledgeBaseCode})
	codeList := knowledgebaserepo.BuildListByCodesParamsForTest(listParams, []string{testKnowledgeBaseCode})
	if len(bizCount.BusinessIds) != 1 || len(bizList.BusinessIds) != 1 || len(codeCount.Codes) != 1 || len(codeList.Codes) != 1 {
		t.Fatalf("expected helper builders to preserve filter values")
	}
}

func TestKnowledgeBaseFindRowMappers(t *testing.T) {
	t.Parallel()

	fixture := newKnowledgeBaseMapperFixture(t)
	byID, err := knowledgebaserepo.ToKnowledgeBaseFromFindByIDForTest(findByIDRow(fixture))
	checkMappedKB(t, mustMapKB(t, byID, err))
	byCode, err := knowledgebaserepo.ToKnowledgeBaseFromFindByCodeForTest(findByCodeRow(fixture))
	checkMappedKB(t, mustMapKB(t, byCode, err))
	byCodeAndOrg, err := knowledgebaserepo.ToKnowledgeBaseFromFindByCodeAndOrgForTest(findByCodeAndOrgRow(fixture))
	checkMappedKB(t, mustMapKB(t, byCodeAndOrg, err))
}

func TestKnowledgeBaseListRowMappers(t *testing.T) {
	t.Parallel()

	fixture := newKnowledgeBaseMapperFixture(t)
	byList, err := knowledgebaserepo.ToKnowledgeBaseFromListForKnowledgeBaseTest(listRow(fixture))
	checkMappedKB(t, mustMapKB(t, byList, err))
	byCodes, err := knowledgebaserepo.ToKnowledgeBaseFromListByCodesForTest(listByCodesRow(fixture))
	checkMappedKB(t, mustMapKB(t, byCodes, err))
	byBusinessIDs, err := knowledgebaserepo.ToKnowledgeBaseFromListByBusinessIDsForTest(listByBusinessIDsRow(fixture))
	checkMappedKB(t, mustMapKB(t, byBusinessIDs, err))
	byCodesAndBusinessIDs, err := knowledgebaserepo.ToKnowledgeBaseFromListByCodesAndBusinessIDsForTest(listByCodesAndBusinessIDsRow(fixture))
	checkMappedKB(t, mustMapKB(t, byCodesAndBusinessIDs, err))
}

func sampleKnowledgeBase() *knowledgebase.KnowledgeBase {
	now := time.Date(2026, 3, 11, 10, 0, 0, 0, time.Local)
	return &knowledgebase.KnowledgeBase{
		Code:              testKnowledgeBaseCode,
		Version:           1,
		Name:              testKnowledgeBaseName,
		Description:       testKnowledgeBaseDesc,
		Type:              1,
		Enabled:           true,
		BusinessID:        testKnowledgeBaseBusinessID,
		SyncStatus:        shared.SyncStatusPending,
		SyncStatusMessage: "",
		Model:             testEmbeddingModelLarge,
		VectorDB:          "odin_qdrant",
		OrganizationCode:  testKnowledgeBaseOrgCode,
		CreatedUID:        "creator",
		UpdatedUID:        "modifier",
		ExpectedNum:       8,
		CompletedNum:      4,
		RetrieveConfig:    &shared.RetrieveConfig{TopK: 4},
		FragmentConfig:    &shared.FragmentConfig{Mode: shared.FragmentModeNormal},
		EmbeddingConfig:   &shared.EmbeddingConfig{ModelID: testEmbeddingModelLarge},
		WordCount:         123,
		Icon:              "book",
		KnowledgeBaseType: knowledgebase.KnowledgeBaseTypeFlowVector,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
}

func buildKnowledgeBaseRawForTest(
	t *testing.T,
	kb *knowledgebase.KnowledgeBase,
	sourceType int,
) knowledgebaserepo.KnowledgeBaseRawForTest {
	t.Helper()
	return knowledgebaserepo.KnowledgeBaseRawForTest{
		ID:                1,
		Code:              kb.Code,
		Version:           mustInt32(t, kb.Version),
		Name:              kb.Name,
		Description:       kb.Description,
		Type:              mustInt32(t, kb.Type),
		Enabled:           kb.Enabled,
		BusinessID:        kb.BusinessID,
		SyncStatus:        mustInt32(t, int(kb.SyncStatus)),
		SyncStatusMessage: kb.SyncStatusMessage,
		Model:             kb.Model,
		VectorDB:          kb.VectorDB,
		OrganizationCode:  kb.OrganizationCode,
		CreatedUID:        kb.CreatedUID,
		UpdatedUID:        kb.UpdatedUID,
		ExpectedNum:       mustInt32(t, kb.ExpectedNum),
		CompletedNum:      mustInt32(t, kb.CompletedNum),
		RetrieveConfig:    mustJSON(t, kb.RetrieveConfig),
		FragmentConfig:    mustJSON(t, kb.FragmentConfig),
		EmbeddingConfig:   mustJSON(t, kb.EmbeddingConfig),
		WordCount:         int64(kb.WordCount),
		Icon:              kb.Icon,
		SourceType:        sql.NullInt32{Int32: mustInt32(t, sourceType), Valid: true},
		KnowledgeBaseType: string(kb.KnowledgeBaseType),
		CreatedAt:         kb.CreatedAt,
		UpdatedAt:         kb.UpdatedAt,
	}
}

func mustJSON(t *testing.T, value any) []byte {
	t.Helper()
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("json.Marshal failed: %v", err)
	}
	return data
}

func knowledgeBaseRowColumns() []string {
	return []string{
		"id", "code", "version", "name", "description", "type", "enabled", "business_id",
		"sync_status", "sync_status_message", "model", "vector_db", "organization_code",
		"created_uid", "updated_uid", "expected_num", "completed_num",
		"retrieve_config", "fragment_config", "embedding_config",
		"word_count", "icon", "source_type", "knowledge_base_type", "created_at", "updated_at",
	}
}

func knowledgeBaseRowValues(t *testing.T, now time.Time) []driver.Value {
	t.Helper()
	return []driver.Value{
		int64(1),
		testKnowledgeBaseCode,
		int32(1),
		testKnowledgeBaseName,
		testKnowledgeBaseDesc,
		int32(1),
		true,
		testKnowledgeBaseBusinessID,
		int32(shared.SyncStatusPending),
		"",
		testEmbeddingModelLarge,
		"odin_qdrant",
		testKnowledgeBaseOrgCode,
		"creator",
		"modifier",
		int32(8),
		int32(4),
		mustJSON(t, &shared.RetrieveConfig{TopK: 4}),
		mustJSON(t, &shared.FragmentConfig{Mode: shared.FragmentModeNormal}),
		mustJSON(t, &shared.EmbeddingConfig{ModelID: testEmbeddingModelLarge}),
		int64(123),
		"book",
		sql.NullInt32{Int32: int32(knowledgebase.SourceTypeCustomContent), Valid: true},
		string(knowledgebase.KnowledgeBaseTypeFlowVector),
		now,
		now,
	}
}

func mustMapKB(t *testing.T, kb *knowledgebase.KnowledgeBase, err error) *knowledgebase.KnowledgeBase {
	t.Helper()
	if err != nil {
		t.Fatalf("mapping returned error: %v", err)
	}
	return kb
}

func checkMappedKB(t *testing.T, kb *knowledgebase.KnowledgeBase) {
	t.Helper()
	if kb == nil {
		t.Fatal("expected knowledge base not nil")
	}
	if kb.Code != testKnowledgeBaseCode || kb.OrganizationCode != testKnowledgeBaseOrgCode || kb.RetrieveConfig == nil || kb.EmbeddingConfig == nil {
		t.Fatalf("unexpected mapped knowledge base: %#v", kb)
	}
	if kb.KnowledgeBaseType != knowledgebase.KnowledgeBaseTypeFlowVector {
		t.Fatalf("expected knowledge_base_type=%q, got %q", knowledgebase.KnowledgeBaseTypeFlowVector, kb.KnowledgeBaseType)
	}
}

func mustInt32(t *testing.T, value int) int32 {
	t.Helper()
	result, err := convert.SafeIntToInt32(value, "test_value")
	if err != nil {
		t.Fatalf("SafeIntToInt32 failed: %v", err)
	}
	return result
}

type knowledgeBaseMapperFixture struct {
	now               time.Time
	id                int64
	code              string
	version           int32
	name              string
	description       string
	kbType            int32
	enabled           bool
	businessID        string
	syncStatus        int32
	syncMessage       string
	model             string
	vectorDB          string
	organizationCode  string
	createdUID        string
	updatedUID        string
	expectedNum       int32
	completedNum      int32
	retrieveConfig    []byte
	fragmentConfig    []byte
	embeddingConfig   []byte
	wordCount         int64
	icon              string
	sourceType        sql.NullInt32
	knowledgeBaseType string
}

func newKnowledgeBaseMapperFixture(t *testing.T) knowledgeBaseMapperFixture {
	t.Helper()
	return knowledgeBaseMapperFixture{
		now:               time.Date(2026, 3, 11, 14, 0, 0, 0, time.Local),
		id:                1,
		code:              testKnowledgeBaseCode,
		version:           1,
		name:              testKnowledgeBaseName,
		description:       testKnowledgeBaseDesc,
		kbType:            1,
		enabled:           true,
		businessID:        testKnowledgeBaseBusinessID,
		syncStatus:        int32(shared.SyncStatusPending),
		syncMessage:       "",
		model:             testEmbeddingModelLarge,
		vectorDB:          "odin_qdrant",
		organizationCode:  testKnowledgeBaseOrgCode,
		createdUID:        "creator",
		updatedUID:        "modifier",
		expectedNum:       8,
		completedNum:      4,
		retrieveConfig:    mustJSON(t, &shared.RetrieveConfig{TopK: 4}),
		fragmentConfig:    mustJSON(t, &shared.FragmentConfig{Mode: shared.FragmentModeNormal}),
		embeddingConfig:   mustJSON(t, &shared.EmbeddingConfig{ModelID: testEmbeddingModelLarge}),
		wordCount:         123,
		icon:              "book",
		sourceType:        sql.NullInt32{Int32: int32(knowledgebase.SourceTypeCustomContent), Valid: true},
		knowledgeBaseType: string(knowledgebase.KnowledgeBaseTypeFlowVector),
	}
}

func findByIDRow(f knowledgeBaseMapperFixture) mysqlsqlc.FindKnowledgeBaseByIDRow {
	return mysqlsqlc.FindKnowledgeBaseByIDRow{
		ID:                f.id,
		Code:              f.code,
		Version:           f.version,
		Name:              f.name,
		Description:       f.description,
		Type:              f.kbType,
		Enabled:           f.enabled,
		BusinessID:        f.businessID,
		SyncStatus:        f.syncStatus,
		SyncStatusMessage: f.syncMessage,
		Model:             f.model,
		VectorDb:          f.vectorDB,
		OrganizationCode:  f.organizationCode,
		CreatedUid:        f.createdUID,
		UpdatedUid:        f.updatedUID,
		ExpectedNum:       f.expectedNum,
		CompletedNum:      f.completedNum,
		RetrieveConfig:    f.retrieveConfig,
		FragmentConfig:    f.fragmentConfig,
		EmbeddingConfig:   f.embeddingConfig,
		WordCount:         f.wordCount,
		Icon:              f.icon,
		SourceType:        f.sourceType,
		KnowledgeBaseType: f.knowledgeBaseType,
		CreatedAt:         f.now,
		UpdatedAt:         f.now,
	}
}

func findByCodeRow(f knowledgeBaseMapperFixture) mysqlsqlc.FindKnowledgeBaseByCodeRow {
	return mysqlsqlc.FindKnowledgeBaseByCodeRow{
		ID:                f.id,
		Code:              f.code,
		Version:           f.version,
		Name:              f.name,
		Description:       f.description,
		Type:              f.kbType,
		Enabled:           f.enabled,
		BusinessID:        f.businessID,
		SyncStatus:        f.syncStatus,
		SyncStatusMessage: f.syncMessage,
		Model:             f.model,
		VectorDb:          f.vectorDB,
		OrganizationCode:  f.organizationCode,
		CreatedUid:        f.createdUID,
		UpdatedUid:        f.updatedUID,
		ExpectedNum:       f.expectedNum,
		CompletedNum:      f.completedNum,
		RetrieveConfig:    f.retrieveConfig,
		FragmentConfig:    f.fragmentConfig,
		EmbeddingConfig:   f.embeddingConfig,
		WordCount:         f.wordCount,
		Icon:              f.icon,
		SourceType:        f.sourceType,
		KnowledgeBaseType: f.knowledgeBaseType,
		CreatedAt:         f.now,
		UpdatedAt:         f.now,
	}
}

func findByCodeAndOrgRow(f knowledgeBaseMapperFixture) mysqlsqlc.FindKnowledgeBaseByCodeAndOrgRow {
	return mysqlsqlc.FindKnowledgeBaseByCodeAndOrgRow{
		ID:                f.id,
		Code:              f.code,
		Version:           f.version,
		Name:              f.name,
		Description:       f.description,
		Type:              f.kbType,
		Enabled:           f.enabled,
		BusinessID:        f.businessID,
		SyncStatus:        f.syncStatus,
		SyncStatusMessage: f.syncMessage,
		Model:             f.model,
		VectorDb:          f.vectorDB,
		OrganizationCode:  f.organizationCode,
		CreatedUid:        f.createdUID,
		UpdatedUid:        f.updatedUID,
		ExpectedNum:       f.expectedNum,
		CompletedNum:      f.completedNum,
		RetrieveConfig:    f.retrieveConfig,
		FragmentConfig:    f.fragmentConfig,
		EmbeddingConfig:   f.embeddingConfig,
		WordCount:         f.wordCount,
		Icon:              f.icon,
		SourceType:        f.sourceType,
		KnowledgeBaseType: f.knowledgeBaseType,
		CreatedAt:         f.now,
		UpdatedAt:         f.now,
	}
}

func listRow(f knowledgeBaseMapperFixture) mysqlsqlc.ListKnowledgeBasesRow {
	return mysqlsqlc.ListKnowledgeBasesRow{
		ID:                f.id,
		Code:              f.code,
		Version:           f.version,
		Name:              f.name,
		Description:       f.description,
		Type:              f.kbType,
		Enabled:           f.enabled,
		BusinessID:        f.businessID,
		SyncStatus:        f.syncStatus,
		SyncStatusMessage: f.syncMessage,
		Model:             f.model,
		VectorDb:          f.vectorDB,
		OrganizationCode:  f.organizationCode,
		CreatedUid:        f.createdUID,
		UpdatedUid:        f.updatedUID,
		ExpectedNum:       f.expectedNum,
		CompletedNum:      f.completedNum,
		RetrieveConfig:    f.retrieveConfig,
		FragmentConfig:    f.fragmentConfig,
		EmbeddingConfig:   f.embeddingConfig,
		WordCount:         f.wordCount,
		Icon:              f.icon,
		SourceType:        f.sourceType,
		KnowledgeBaseType: f.knowledgeBaseType,
		CreatedAt:         f.now,
		UpdatedAt:         f.now,
	}
}

func listByCodesRow(f knowledgeBaseMapperFixture) mysqlsqlc.ListKnowledgeBasesByCodesRow {
	return mysqlsqlc.ListKnowledgeBasesByCodesRow{
		ID:                f.id,
		Code:              f.code,
		Version:           f.version,
		Name:              f.name,
		Description:       f.description,
		Type:              f.kbType,
		Enabled:           f.enabled,
		BusinessID:        f.businessID,
		SyncStatus:        f.syncStatus,
		SyncStatusMessage: f.syncMessage,
		Model:             f.model,
		VectorDb:          f.vectorDB,
		OrganizationCode:  f.organizationCode,
		CreatedUid:        f.createdUID,
		UpdatedUid:        f.updatedUID,
		ExpectedNum:       f.expectedNum,
		CompletedNum:      f.completedNum,
		RetrieveConfig:    f.retrieveConfig,
		FragmentConfig:    f.fragmentConfig,
		EmbeddingConfig:   f.embeddingConfig,
		WordCount:         f.wordCount,
		Icon:              f.icon,
		SourceType:        f.sourceType,
		KnowledgeBaseType: f.knowledgeBaseType,
		CreatedAt:         f.now,
		UpdatedAt:         f.now,
	}
}

func listByBusinessIDsRow(f knowledgeBaseMapperFixture) mysqlsqlc.ListKnowledgeBasesByBusinessIDsRow {
	return mysqlsqlc.ListKnowledgeBasesByBusinessIDsRow{
		ID:                f.id,
		Code:              f.code,
		Version:           f.version,
		Name:              f.name,
		Description:       f.description,
		Type:              f.kbType,
		Enabled:           f.enabled,
		BusinessID:        f.businessID,
		SyncStatus:        f.syncStatus,
		SyncStatusMessage: f.syncMessage,
		Model:             f.model,
		VectorDb:          f.vectorDB,
		OrganizationCode:  f.organizationCode,
		CreatedUid:        f.createdUID,
		UpdatedUid:        f.updatedUID,
		ExpectedNum:       f.expectedNum,
		CompletedNum:      f.completedNum,
		RetrieveConfig:    f.retrieveConfig,
		FragmentConfig:    f.fragmentConfig,
		EmbeddingConfig:   f.embeddingConfig,
		WordCount:         f.wordCount,
		Icon:              f.icon,
		SourceType:        f.sourceType,
		KnowledgeBaseType: f.knowledgeBaseType,
		CreatedAt:         f.now,
		UpdatedAt:         f.now,
	}
}

func listByCodesAndBusinessIDsRow(f knowledgeBaseMapperFixture) mysqlsqlc.ListKnowledgeBasesByCodesAndBusinessIDsRow {
	return mysqlsqlc.ListKnowledgeBasesByCodesAndBusinessIDsRow{
		ID:                f.id,
		Code:              f.code,
		Version:           f.version,
		Name:              f.name,
		Description:       f.description,
		Type:              f.kbType,
		Enabled:           f.enabled,
		BusinessID:        f.businessID,
		SyncStatus:        f.syncStatus,
		SyncStatusMessage: f.syncMessage,
		Model:             f.model,
		VectorDb:          f.vectorDB,
		OrganizationCode:  f.organizationCode,
		CreatedUid:        f.createdUID,
		UpdatedUid:        f.updatedUID,
		ExpectedNum:       f.expectedNum,
		CompletedNum:      f.completedNum,
		RetrieveConfig:    f.retrieveConfig,
		FragmentConfig:    f.fragmentConfig,
		EmbeddingConfig:   f.embeddingConfig,
		WordCount:         f.wordCount,
		Icon:              f.icon,
		SourceType:        f.sourceType,
		CreatedAt:         f.now,
		UpdatedAt:         f.now,
	}
}

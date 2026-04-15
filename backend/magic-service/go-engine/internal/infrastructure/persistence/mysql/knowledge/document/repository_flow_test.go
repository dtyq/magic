package documentrepo_test

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	mysqlDriver "github.com/go-sql-driver/mysql"

	"magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	documentrepo "magic/internal/infrastructure/persistence/mysql/knowledge/document"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/pkg/convert"
)

func sqlPattern(query string) string {
	return `(?s)(?:-- name: .*?\n)?` + regexp.QuoteMeta(strings.TrimSpace(query))
}

func sqlContains(fragment string) string {
	return regexp.QuoteMeta(strings.TrimSpace(fragment))
}

func knowledgeBaseSnapshotForTest(kb *knowledgebase.KnowledgeBase) *sharedsnapshot.KnowledgeBaseRuntimeSnapshot {
	if kb == nil {
		return nil
	}
	return &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{
		Code:             kb.Code,
		Name:             kb.Name,
		OrganizationCode: kb.OrganizationCode,
		Model:            kb.Model,
		VectorDB:         kb.VectorDB,
		CreatedUID:       kb.CreatedUID,
		UpdatedUID:       kb.UpdatedUID,
		RetrieveConfig:   kb.RetrieveConfig,
		FragmentConfig:   kb.FragmentConfig,
		EmbeddingConfig:  kb.EmbeddingConfig,
		ResolvedRoute:    kb.ResolvedRoute,
	}
}

func TestBuildInsertDocumentParamsForTest(t *testing.T) {
	t.Parallel()

	doc := sampleDocument()
	params, err := documentrepo.BuildInsertDocumentParamsForTest(doc)
	if err != nil {
		t.Fatalf("BuildInsertDocumentParamsForTest returned error: %v", err)
	}
	if params.Code != doc.Code || params.KnowledgeBaseCode != doc.KnowledgeBaseCode || params.WordCount != mustUint64Repo(t, doc.WordCount) {
		t.Fatalf("unexpected params: %#v", params)
	}

	doc.WordCount = -1
	if _, err := documentrepo.BuildInsertDocumentParamsForTest(doc); err == nil {
		t.Fatal("expected invalid word_count error")
	}
}

func TestDocumentRepositorySaveAndUpdate(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	doc := sampleDocument()

	expectDocumentSave(t, mock, doc, 88)

	if err := repo.Save(context.Background(), doc); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}
	if doc.ID != 88 {
		t.Fatalf("expected inserted id 88, got %d", doc.ID)
	}

	expectDocumentUpdate(t, mock, doc)

	if err := repo.Update(context.Background(), doc); err != nil {
		t.Fatalf("Update returned error: %v", err)
	}

	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositoryDeleteAndSyncHelpers(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock

	mock.ExpectExec(sqlPattern(`DELETE FROM knowledge_base_documents
WHERE id = ?`)).
		WithArgs(int64(7)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(sqlPattern(`DELETE FROM knowledge_base_documents
WHERE knowledge_base_code = ?`)).
		WithArgs("KB1").
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectExec(sqlPattern(`UPDATE knowledge_base_documents
SET sync_status = ?,
    sync_status_message = ?,
    updated_at = ?
WHERE id = ?`)).
		WithArgs(mustInt32Repo(t, int(shared.SyncStatusSyncing)), "running", sqlmock.AnyArg(), int64(7)).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.Delete(context.Background(), 7); err != nil {
		t.Fatalf("Delete returned error: %v", err)
	}
	if err := repo.DeleteByKnowledgeBase(context.Background(), "KB1"); err != nil {
		t.Fatalf("DeleteByKnowledgeBase returned error: %v", err)
	}
	if err := repo.UpdateSyncStatus(context.Background(), 7, shared.SyncStatusSyncing, "running"); err != nil {
		t.Fatalf("UpdateSyncStatus returned error: %v", err)
	}
	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositoryFinders(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	rowValues := sampleDocumentRowValues(t)

	expectDocumentSelect(mock, []driver.Value{"DOC1"}, rowValues)
	expectDocumentSelect(mock, []driver.Value{"DOC1", "KB1"}, rowValues)
	expectDocumentSelect(mock, []driver.Value{int64(1)}, rowValues)
	expectDocumentSelect(mock, []driver.Value{"drive", "TF-1"}, rowValues)

	if _, err := repo.FindByCode(context.Background(), "DOC1"); err != nil {
		t.Fatalf("FindByCode returned error: %v", err)
	}
	if _, err := repo.FindByCodeAndKnowledgeBase(context.Background(), "DOC1", "KB1"); err != nil {
		t.Fatalf("FindByCodeAndKnowledgeBase returned error: %v", err)
	}
	if _, err := repo.FindByID(context.Background(), 1); err != nil {
		t.Fatalf("FindByID returned error: %v", err)
	}
	if _, err := repo.FindByThirdFile(context.Background(), "drive", "TF-1"); err != nil {
		t.Fatalf("FindByThirdFile returned error: %v", err)
	}
	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositoryThirdFileFallbackFinders(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	rowValues := sampleDocumentRowValues(t)

	expectThirdFileDirectMiss(mock, "d.third_platform_type = ? AND d.third_file_id = ? ORDER BY d.id DESC LIMIT 1", "drive", "TF-1")
	expectThirdFileDirectMiss(mock, "d.knowledge_base_code = ? AND d.third_platform_type = ? AND d.third_file_id = ? ORDER BY d.id DESC LIMIT 1", "KB1", "drive", "TF-1")
	expectKnowledgeBaseOrganizationLookup(mock, "KB1", "ORG1")
	expectThirdFileFallbackHit(
		mock,
		"d.knowledge_base_code = ? AND si.organization_code = ? AND si.provider = ? AND si.item_ref = ? ORDER BY d.id DESC LIMIT 1",
		rowValues,
		"KB1",
		"ORG1",
		"drive",
		"TF-1",
	)
	expectThirdFileDirectHit(mock, "d.organization_code = ? AND d.third_platform_type = ? AND d.third_file_id = ? ORDER BY d.id DESC", nil, "ORG1", "drive", "TF-1")
	expectThirdFileFallbackHit(mock, "d.organization_code = ? AND si.organization_code = ? AND si.provider = ? AND si.item_ref = ? ORDER BY d.id DESC", rowValues, "ORG1", "ORG1", "drive", "TF-1")

	if _, err := repo.FindByThirdFile(context.Background(), "drive", "TF-1"); !errors.Is(err, shared.ErrDocumentNotFound) {
		t.Fatalf("expected FindByThirdFile not found, got %v", err)
	}
	if _, err := repo.FindByKnowledgeBaseAndThirdFile(context.Background(), "KB1", "drive", "TF-1"); err != nil {
		t.Fatalf("FindByKnowledgeBaseAndThirdFile returned error: %v", err)
	}
	docs, err := repo.ListByThirdFileInOrg(context.Background(), "ORG1", "drive", "TF-1")
	if err != nil || len(docs) != 1 {
		t.Fatalf("unexpected ListByThirdFileInOrg docs=%#v err=%v", docs, err)
	}

	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositoryListByThirdFileInOrgMergesDirectAndFallbackHits(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	directRow := sampleDocumentRowValuesWithCode(t, "DOC-DIRECT", sql.NullTime{})
	fallbackRow := sampleDocumentRowValuesWithCode(t, "DOC-FALLBACK", sql.NullTime{})
	fallbackRow[0] = int64(2)

	expectThirdFileDirectHit(mock, "d.organization_code = ? AND d.third_platform_type = ? AND d.third_file_id = ? ORDER BY d.id DESC", directRow, "ORG1", "drive", "TF-1")
	expectThirdFileFallbackHit(mock, "d.organization_code = ? AND si.organization_code = ? AND si.provider = ? AND si.item_ref = ? ORDER BY d.id DESC", fallbackRow, "ORG1", "ORG1", "drive", "TF-1")

	docs, err := repo.ListByThirdFileInOrg(context.Background(), "ORG1", "drive", "TF-1")
	if err != nil {
		t.Fatalf("ListByThirdFileInOrg returned error: %v", err)
	}
	if len(docs) != 2 || docs[0].Code != "DOC-DIRECT" || docs[1].Code != "DOC-FALLBACK" {
		t.Fatalf("expected direct+fallback union, got %#v", docs)
	}

	assertDocumentMockExpectations(t, mock)
}

func expectThirdFileDirectMiss(mock sqlmock.Sqlmock, whereClause string, args ...driver.Value) {
	mock.ExpectQuery(sqlContains("WHERE d.deleted_at IS NULL AND " + whereClause)).
		WithArgs(args...).
		WillReturnError(sql.ErrNoRows)
}

func expectThirdFileDirectHit(mock sqlmock.Sqlmock, whereClause string, rowValues []driver.Value, args ...driver.Value) {
	rows := sqlmock.NewRows(documentRowColumns())
	if len(rowValues) > 0 {
		rows.AddRow(rowValues...)
	}
	mock.ExpectQuery(sqlContains("WHERE d.deleted_at IS NULL AND " + whereClause)).
		WithArgs(args...).
		WillReturnRows(rows)
}

func expectThirdFileFallbackHit(mock sqlmock.Sqlmock, whereClause string, rowValues []driver.Value, args ...driver.Value) {
	expectThirdFileDirectHit(mock, whereClause, rowValues, args...)
}

func expectKnowledgeBaseOrganizationLookup(mock sqlmock.Sqlmock, knowledgeBaseCode, organizationCode string) {
	mock.ExpectQuery(sqlPattern(`SELECT organization_code
FROM knowledge_base_documents
WHERE knowledge_base_code = ?
  AND deleted_at IS NULL
ORDER BY id DESC
LIMIT 1`)).
		WithArgs(knowledgeBaseCode).
		WillReturnRows(sqlmock.NewRows([]string{"organization_code"}).AddRow(organizationCode))
}

func TestDocumentRepositoryListAndCount(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	rowValues := sampleDocumentRowValues(t)
	expectDocumentListWithFilters(t, mock, rowValues)
	expectDocumentCountByKnowledgeBaseCodes(mock)

	docs, total, err := repo.List(context.Background(), &document.Query{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		Name:              "doc",
		DocType:           new(int(document.DocTypeFile)),
		Enabled:           new(true),
		SyncStatus:        new(shared.SyncStatusSynced),
		Offset:            2,
		Limit:             5,
	})
	if err != nil || total != 1 || len(docs) != 1 {
		t.Fatalf("unexpected List result docs=%#v total=%d err=%v", docs, total, err)
	}

	counts, err := repo.CountByKnowledgeBaseCodes(context.Background(), "ORG1", []string{"KB1", "KB2"})
	if err != nil || counts["KB2"] != 5 {
		t.Fatalf("unexpected counts=%#v err=%v", counts, err)
	}
	empty, err := repo.CountByKnowledgeBaseCodes(context.Background(), "ORG1", nil)
	if err != nil || len(empty) != 0 {
		t.Fatalf("unexpected empty counts=%#v err=%v", empty, err)
	}

	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositoryListByOrganizationDirectlyQueriesDocuments(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	rowValues := sampleDocumentRowValues(t)

	mock.ExpectQuery(sqlPattern(`SELECT COUNT(*)
FROM knowledge_base_documents d
WHERE d.deleted_at IS NULL
  AND (? IS NULL OR d.organization_code = ?)
  AND (? IS NULL OR d.knowledge_base_code = ?)
  AND (? IS NULL OR d.name LIKE ?)
  AND (? IS NULL OR d.doc_type = ?)
  AND (? IS NULL OR d.enabled = ?)
  AND (? IS NULL OR d.sync_status = ?)`)).
		WithArgs(
			sql.NullString{String: "ORG1", Valid: true},
			sql.NullString{String: "ORG1", Valid: true},
			sql.NullString{},
			sql.NullString{},
			sql.NullString{},
			sql.NullString{},
			sql.NullInt32{},
			sql.NullInt32{},
			sql.NullBool{},
			sql.NullBool{},
			sql.NullInt32{},
			sql.NullInt32{},
		).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	mock.ExpectQuery(sqlPattern(`SELECT d.id,
d.organization_code,
d.knowledge_base_code,
d.source_binding_id,
d.source_item_id,
d.auto_added,
d.name,
d.description,
d.code,
d.enabled,
d.doc_type,`)).
		WithArgs("ORG1", mustInt32Repo(t, 10), mustInt32Repo(t, 0)).
		WillReturnRows(sqlmock.NewRows(documentRowColumns()).AddRow(rowValues...))

	docs, total, err := repo.List(context.Background(), &document.Query{
		OrganizationCode: "ORG1",
		Offset:           0,
		Limit:            10,
	})
	if err != nil || total != 1 || len(docs) != 1 {
		t.Fatalf("unexpected List result docs=%#v total=%d err=%v", docs, total, err)
	}

	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositoryProjectSourceQueriesAvoidJoin(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock

	projectRows := sampleDocumentRowValuesWithScope(t, "DOC1", sql.NullTime{}, "project", "7", "")
	projectFileRows := sampleDocumentRowValuesWithScope(t, "DOC1", sql.NullTime{}, "project", "", "9")

	mock.ExpectQuery(sqlPattern(`SELECT id
FROM knowledge_source_bindings
WHERE knowledge_base_code = ?
  AND provider = 'project'
  AND root_type = 'project'
  AND root_ref = ?`)).
		WithArgs("KB1", "7").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int64(11)).AddRow(int64(12)))
	mock.ExpectQuery(sqlPattern(`SELECT d.id,
d.organization_code,
d.knowledge_base_code,
d.source_binding_id,
d.source_item_id,
d.auto_added,
d.name,
d.description,
d.code,`)).
		WithArgs("project", "7", "", int64(11), int64(12)).
		WillReturnRows(sqlmock.NewRows(documentRowColumns()).AddRow(projectRows...))

	mock.ExpectQuery(sqlPattern(`SELECT id
FROM knowledge_source_items
WHERE organization_code = ?
  AND provider = 'project'
  AND item_ref = ?`)).
		WithArgs("ORG1", "9").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int64(21)).AddRow(int64(22)))
	mock.ExpectQuery(sqlPattern(`SELECT d.id,
d.organization_code,
d.knowledge_base_code,
d.source_binding_id,
d.source_item_id,
d.auto_added,
d.name,
d.description,
d.code,`)).
		WithArgs("project", "", "9", int64(21), int64(22)).
		WillReturnRows(sqlmock.NewRows(documentRowColumns()).AddRow(projectFileRows...))

	projectDocs, err := repo.ListByKnowledgeBaseAndProject(context.Background(), "KB1", 7)
	if err != nil || len(projectDocs) != 1 {
		t.Fatalf("unexpected ListByKnowledgeBaseAndProject docs=%#v err=%v", projectDocs, err)
	}

	projectFileDocs, err := repo.ListByProjectFileInOrg(context.Background(), "ORG1", 9)
	if err != nil || len(projectFileDocs) != 1 {
		t.Fatalf("unexpected ListByProjectFileInOrg docs=%#v err=%v", projectFileDocs, err)
	}

	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositoryEnsureDefaultDocumentExisting(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	kb := sampleKnowledgeBase()
	defaultCode := kb.DefaultDocumentCode()
	rowValues := sampleDocumentRowValuesWithCode(t, defaultCode, sql.NullTime{})

	expectDocumentSelect(mock, []driver.Value{defaultCode, kb.Code}, rowValues)

	doc, created, err := repo.EnsureDefaultDocument(context.Background(), knowledgeBaseSnapshotForTest(kb))
	if err != nil || created || doc == nil || doc.Code != defaultCode {
		t.Fatalf("unexpected existing doc=%#v created=%v err=%v", doc, created, err)
	}
	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositoryEnsureDefaultDocumentDeletesTombstoneAndRecreates(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	kb := sampleKnowledgeBase()
	defaultCode := kb.DefaultDocumentCode()
	deletedAt := sql.NullTime{Time: time.Now(), Valid: true}
	rowValues := sampleDocumentRowValuesWithCode(t, defaultCode, deletedAt)

	expectDocumentFindByCodeAndKnowledgeBaseMiss(mock, defaultCode, kb.Code)
	expectDocumentFindIncludingDeleted(mock, kb.Code, defaultCode, rowValues)
	expectDocumentInsertDuplicateFallback(t, mock, kb, defaultCode)
	mock.ExpectExec(sqlPattern(`DELETE FROM knowledge_base_documents
WHERE id = ?`)).
		WithArgs(int64(1)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	expectDocumentInsertDefaultDocument(t, mock, kb, defaultCode, 101)

	doc, created, err := repo.EnsureDefaultDocument(context.Background(), knowledgeBaseSnapshotForTest(kb))
	if err != nil || !created || doc == nil || doc.Code != defaultCode || doc.ID != 101 {
		t.Fatalf("unexpected recreated doc=%#v created=%v err=%v", doc, created, err)
	}
	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositoryEnsureDefaultDocumentCreateDuplicateFallback(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	kb := sampleKnowledgeBase()
	defaultCode := kb.DefaultDocumentCode()
	rowValues := sampleDocumentRowValuesWithCode(t, defaultCode, sql.NullTime{})

	expectDocumentFindByCodeAndKnowledgeBaseMiss(mock, defaultCode, kb.Code)
	expectDocumentFindIncludingDeletedMiss(mock, kb.Code, defaultCode)
	expectDocumentInsertDuplicateFallback(t, mock, kb, defaultCode)
	expectDocumentSelect(mock, []driver.Value{defaultCode, kb.Code}, rowValues)

	doc, created, err := repo.EnsureDefaultDocument(context.Background(), knowledgeBaseSnapshotForTest(kb))
	if err != nil || created || doc == nil || doc.Code != defaultCode {
		t.Fatalf("unexpected duplicate fallback doc=%#v created=%v err=%v", doc, created, err)
	}
	assertDocumentMockExpectations(t, mock)
}

func TestToKnowledgeBaseDocumentForTestAndErrors(t *testing.T) {
	t.Parallel()

	row := sampleKnowledgeBaseDocumentRow(t)
	doc, err := documentrepo.ToKnowledgeBaseDocumentForTest(row)
	if err != nil {
		t.Fatalf("ToKnowledgeBaseDocumentForTest returned error: %v", err)
	}
	if doc.DocumentFile == nil || doc.DocumentFile.Extension != "md" || doc.DocMetadata["lang"] != "zh" {
		t.Fatalf("unexpected doc=%#v", doc)
	}

	row.DocMetadata = []byte(`{`)
	if _, err := documentrepo.ToKnowledgeBaseDocumentForTest(row); err == nil {
		t.Fatal("expected decode doc metadata error")
	}
}

func sampleDocument() *document.KnowledgeBaseDocument {
	return &document.KnowledgeBaseDocument{
		ID:                1,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		Name:              "doc-1",
		Description:       "desc",
		Code:              "DOC1",
		Enabled:           true,
		DocType:           int(document.DocTypeFile),
		DocMetadata:       map[string]any{"lang": "zh"},
		DocumentFile:      &document.File{Name: "doc.md", URL: "bucket/doc.md", Extension: "md"},
		ThirdPlatformType: "drive",
		ThirdFileID:       "TF-1",
		SyncStatus:        shared.SyncStatusSynced,
		SyncTimes:         1,
		SyncStatusMessage: "ok",
		EmbeddingModel:    "text-embedding-3-small",
		VectorDB:          "odin_qdrant",
		RetrieveConfig:    &shared.RetrieveConfig{TopK: 4},
		FragmentConfig:    &shared.FragmentConfig{Mode: shared.FragmentModeNormal},
		EmbeddingConfig:   &shared.EmbeddingConfig{ModelID: "text-embedding-3-small"},
		VectorDBConfig:    &shared.VectorDBConfig{Extra: map[string]json.RawMessage{"collection_name": json.RawMessage(`"kb1"`)}},
		WordCount:         42,
		CreatedUID:        "U1",
		UpdatedUID:        "U1",
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
}

func sampleKnowledgeBaseDocumentRow(t *testing.T) mysqlsqlc.KnowledgeBaseDocument {
	t.Helper()

	now := time.Date(2026, 3, 11, 9, 0, 0, 0, time.Local)
	return mysqlsqlc.KnowledgeBaseDocument{
		ID:                1,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		SourceBindingID:   0,
		SourceItemID:      0,
		AutoAdded:         false,
		Name:              "doc-1",
		Description:       "desc",
		Code:              "DOC1",
		Enabled:           true,
		DocType:           mustUint32Repo(t, int(document.DocTypeFile)),
		DocMetadata:       mustJSON(t, map[string]any{"lang": "zh"}),
		DocumentFile:      mustJSON(t, map[string]any{"name": "doc.md", "url": "bucket/doc.md", "extension": "md", "third_id": "TF-1", "source_type": "drive"}),
		SyncStatus:        mustInt32Repo(t, int(shared.SyncStatusSynced)),
		SyncTimes:         mustInt32Repo(t, 1),
		SyncStatusMessage: "ok",
		EmbeddingModel:    "text-embedding-3-small",
		VectorDb:          "odin_qdrant",
		RetrieveConfig:    mustJSON(t, &shared.RetrieveConfig{TopK: 4}),
		FragmentConfig:    mustJSON(t, &shared.FragmentConfig{Mode: shared.FragmentModeNormal}),
		EmbeddingConfig:   mustJSON(t, &shared.EmbeddingConfig{ModelID: "text-embedding-3-small"}),
		VectorDbConfig:    mustJSON(t, &shared.VectorDBConfig{Extra: map[string]json.RawMessage{"collection_name": json.RawMessage(`"kb1"`)}}),
		WordCount:         42,
		ThirdPlatformType: sql.NullString{String: "drive", Valid: true},
		ThirdFileID:       sql.NullString{String: "TF-1", Valid: true},
		CreatedUid:        "U1",
		UpdatedUid:        "U1",
		CreatedAt:         now,
		UpdatedAt:         now,
	}
}

func documentRowColumns() []string {
	return []string{
		"id", "organization_code", "knowledge_base_code", "source_binding_id", "source_item_id", "auto_added", "name", "description", "code",
		"enabled", "doc_type", "doc_metadata", "document_file",
		"sync_status", "sync_times", "sync_status_message", "embedding_model", "vector_db",
		"retrieve_config", "fragment_config", "embedding_config", "vector_db_config", "word_count", "third_platform_type", "third_file_id",
		"created_uid", "updated_uid", "created_at", "updated_at", "deleted_at",
		"source_provider", "binding_root_ref", "source_item_ref",
	}
}

func sampleDocumentRowValues(t *testing.T) []driver.Value {
	t.Helper()
	return sampleDocumentRowValuesWithScope(t, "DOC1", sql.NullTime{}, "drive", "", "TF-1")
}

func sampleDocumentRowValuesWithCode(t *testing.T, code string, deletedAt sql.NullTime) []driver.Value {
	t.Helper()
	return sampleDocumentRowValuesWithScope(t, code, deletedAt, "drive", "", "TF-1")
}

func sampleDocumentRowValuesWithScope(
	t *testing.T,
	code string,
	deletedAt sql.NullTime,
	sourceProvider string,
	bindingRootRef string,
	sourceItemRef string,
) []driver.Value {
	t.Helper()

	row := sampleKnowledgeBaseDocumentRow(t)
	row.Code = code
	return []driver.Value{
		row.ID, row.OrganizationCode, row.KnowledgeBaseCode, row.SourceBindingID, row.SourceItemID, row.AutoAdded, row.Name, row.Description, row.Code,
		row.Enabled, row.DocType, row.DocMetadata, row.DocumentFile,
		row.SyncStatus, row.SyncTimes, row.SyncStatusMessage, row.EmbeddingModel, row.VectorDb,
		row.RetrieveConfig, row.FragmentConfig, row.EmbeddingConfig, row.VectorDbConfig, row.WordCount, row.ThirdPlatformType, row.ThirdFileID,
		row.CreatedUid, row.UpdatedUid, row.CreatedAt, row.UpdatedAt, deletedAt,
		sourceProvider, bindingRootRef, sourceItemRef,
	}
}

func expectDocumentSelect(mock sqlmock.Sqlmock, args, rowValues []driver.Value) {
	mock.ExpectQuery(sqlPattern(`SELECT d.id,
d.organization_code,
d.knowledge_base_code,
d.source_binding_id,
d.source_item_id,
d.auto_added,
d.name,
d.description,
d.code,`)).
		WithArgs(args...).
		WillReturnRows(sqlmock.NewRows(documentRowColumns()).AddRow(rowValues...))
}

type documentRepositoryTestContext struct {
	repo *documentrepo.DocumentRepository
	mock sqlmock.Sqlmock
}

func newDocumentRepositoryTestContext(t *testing.T) documentRepositoryTestContext {
	t.Helper()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	return documentRepositoryTestContext{
		repo: documentrepo.NewDocumentRepositoryWithDBForTest(db, nil),
		mock: mock,
	}
}

func assertDocumentMockExpectations(t *testing.T, mock sqlmock.Sqlmock) {
	t.Helper()

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func expectDocumentSave(t *testing.T, mock sqlmock.Sqlmock, doc *document.KnowledgeBaseDocument, insertedID int64) {
	t.Helper()

	mock.ExpectExec(sqlPattern(`INSERT INTO knowledge_base_documents`)).
		WithArgs(
			doc.OrganizationCode, doc.KnowledgeBaseCode, doc.SourceBindingID, doc.SourceItemID, doc.AutoAdded, doc.Name, doc.Description, doc.Code,
			doc.Enabled, mustUint32Repo(t, doc.DocType), sqlmock.AnyArg(), sqlmock.AnyArg(),
			mustInt32Repo(t, int(doc.SyncStatus)), mustInt32Repo(t, doc.SyncTimes), doc.SyncStatusMessage, doc.EmbeddingModel, doc.VectorDB,
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), mustUint64Repo(t, doc.WordCount),
			doc.CreatedUID, doc.UpdatedUID, sqlmock.AnyArg(), sqlmock.AnyArg(),
			sql.NullString{String: doc.ThirdPlatformType, Valid: doc.ThirdPlatformType != ""},
			sql.NullString{String: doc.ThirdFileID, Valid: doc.ThirdFileID != ""},
		).
		WillReturnResult(sqlmock.NewResult(insertedID, 1))
}

func expectDocumentUpdate(t *testing.T, mock sqlmock.Sqlmock, doc *document.KnowledgeBaseDocument) {
	t.Helper()

	mock.ExpectExec(sqlPattern(`UPDATE knowledge_base_documents
SET source_binding_id = ?,
    source_item_id = ?,
    auto_added = ?,
    name = ?,
    description = ?,
    enabled = ?,
    doc_type = ?,
    doc_metadata = ?,
    document_file = ?,
    sync_status = ?,
    sync_times = ?,
    sync_status_message = ?,
    embedding_model = ?,
    vector_db = ?,
    retrieve_config = ?,
    fragment_config = ?,
    embedding_config = ?,
    vector_db_config = ?,
    word_count = ?,
    third_platform_type = ?,
    third_file_id = ?,
    updated_uid = ?,
    updated_at = ?
WHERE id = ?`)).
		WithArgs(
			doc.SourceBindingID, doc.SourceItemID, doc.AutoAdded, doc.Name, doc.Description, doc.Enabled, mustUint32Repo(t, doc.DocType),
			sqlmock.AnyArg(), sqlmock.AnyArg(),
			mustInt32Repo(t, int(doc.SyncStatus)), mustInt32Repo(t, doc.SyncTimes), doc.SyncStatusMessage, doc.EmbeddingModel,
			doc.VectorDB, sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			mustUint64Repo(t, doc.WordCount),
			sql.NullString{String: doc.ThirdPlatformType, Valid: doc.ThirdPlatformType != ""},
			sql.NullString{String: doc.ThirdFileID, Valid: doc.ThirdFileID != ""},
			doc.UpdatedUID, sqlmock.AnyArg(), doc.ID,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
}

func expectDocumentListWithFilters(t *testing.T, mock sqlmock.Sqlmock, rowValues []driver.Value) {
	t.Helper()

	countArgs := make([]driver.Value, 0, 12)
	countArgs = append(countArgs,
		sql.NullString{String: "ORG1", Valid: true},
		sql.NullString{String: "ORG1", Valid: true},
		sql.NullString{String: "KB1", Valid: true},
		sql.NullString{String: "KB1", Valid: true},
		sql.NullString{String: "%doc%", Valid: true},
		sql.NullString{String: "%doc%", Valid: true},
		sql.NullInt32{Int32: int32(document.DocTypeFile), Valid: true},
		sql.NullInt32{Int32: int32(document.DocTypeFile), Valid: true},
		sql.NullBool{Bool: true, Valid: true},
		sql.NullBool{Bool: true, Valid: true},
		sql.NullInt32{Int32: int32(shared.SyncStatusSynced), Valid: true},
		sql.NullInt32{Int32: int32(shared.SyncStatusSynced), Valid: true},
	)
	mock.ExpectQuery(sqlPattern(`SELECT COUNT(*)
FROM knowledge_base_documents d
WHERE d.deleted_at IS NULL
  AND (? IS NULL OR d.organization_code = ?)
  AND (? IS NULL OR d.knowledge_base_code = ?)
  AND (? IS NULL OR d.name LIKE ?)
  AND (? IS NULL OR d.doc_type = ?)
  AND (? IS NULL OR d.enabled = ?)
  AND (? IS NULL OR d.sync_status = ?)`)).
		WithArgs(countArgs...).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	listArgs := make([]driver.Value, 0, 8)
	listArgs = append(listArgs,
		"ORG1",
		"KB1",
		"%doc%",
		int(document.DocTypeFile),
		true,
		int(shared.SyncStatusSynced),
	)
	listArgs = append(listArgs, mustInt32Repo(t, 5), mustInt32Repo(t, 2))
	mock.ExpectQuery(sqlPattern(`SELECT d.id,
d.organization_code,
d.knowledge_base_code,
d.source_binding_id,
d.source_item_id,
d.auto_added,
d.name,
d.description,
d.code,
d.enabled,
d.doc_type,`)).
		WithArgs(listArgs...).
		WillReturnRows(sqlmock.NewRows(documentRowColumns()).AddRow(rowValues...))
}

func expectDocumentCountByKnowledgeBaseCodes(mock sqlmock.Sqlmock) {
	mock.ExpectQuery(sqlPattern(`SELECT knowledge_base_code, COUNT(*) AS count
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND organization_code = ?
  AND knowledge_base_code IN (?,?)
GROUP BY knowledge_base_code`)).
		WithArgs("ORG1", "KB1", "KB2").
		WillReturnRows(sqlmock.NewRows([]string{"knowledge_base_code", "count"}).AddRow("KB1", 3).AddRow("KB2", 5))
}

func expectDocumentFindByCodeAndKnowledgeBaseMiss(mock sqlmock.Sqlmock, code, knowledgeBaseCode string) {
	mock.ExpectQuery(sqlPattern(`SELECT d.id,
d.organization_code,
d.knowledge_base_code,
d.source_binding_id,
d.source_item_id,
d.auto_added,
d.name,
d.description,
d.code,`)).
		WithArgs(code, knowledgeBaseCode).
		WillReturnError(sql.ErrNoRows)
}

func expectDocumentFindIncludingDeleted(mock sqlmock.Sqlmock, knowledgeBaseCode, code string, rowValues []driver.Value) {
	mock.ExpectQuery(sqlPattern(`SELECT d.id,
d.organization_code,
d.knowledge_base_code,
d.source_binding_id,
d.source_item_id,
d.auto_added,
d.name,
d.description,
d.code,`)).
		WithArgs(knowledgeBaseCode, code).
		WillReturnRows(sqlmock.NewRows(documentRowColumns()).AddRow(rowValues...))
}

func expectDocumentFindIncludingDeletedMiss(mock sqlmock.Sqlmock, knowledgeBaseCode, code string) {
	mock.ExpectQuery(sqlPattern(`SELECT d.id,
d.organization_code,
d.knowledge_base_code,
d.source_binding_id,
d.source_item_id,
d.auto_added,
d.name,
d.description,
d.code,`)).
		WithArgs(knowledgeBaseCode, code).
		WillReturnError(sql.ErrNoRows)
}

func expectDocumentInsertDuplicateFallback(
	t *testing.T,
	mock sqlmock.Sqlmock,
	kb *knowledgebase.KnowledgeBase,
	defaultCode string,
) {
	t.Helper()

	mock.ExpectExec(sqlPattern(`INSERT INTO knowledge_base_documents`)).
		WithArgs(
			kb.OrganizationCode, kb.Code, int64(0), int64(0), false, "未命名文档.txt", "", defaultCode,
			true, mustUint32Repo(t, int(document.DocTypeText)), sqlmock.AnyArg(), sqlmock.AnyArg(),
			mustInt32Repo(t, int(shared.SyncStatusSynced)), mustInt32Repo(t, 0), "", kb.Model, kb.VectorDB,
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), mustUint64Repo(t, 0),
			kb.CreatedUID, kb.CreatedUID, sqlmock.AnyArg(), sqlmock.AnyArg(), sql.NullString{}, sql.NullString{},
		).
		WillReturnError(&mysqlDriver.MySQLError{Number: 1062, Message: "duplicate"})
}

func expectDocumentInsertDefaultDocument(
	t *testing.T,
	mock sqlmock.Sqlmock,
	kb *knowledgebase.KnowledgeBase,
	defaultCode string,
	insertedID int64,
) {
	t.Helper()

	mock.ExpectExec(sqlPattern(`INSERT INTO knowledge_base_documents`)).
		WithArgs(
			kb.OrganizationCode, kb.Code, int64(0), int64(0), false, "未命名文档.txt", "", defaultCode,
			true, mustUint32Repo(t, int(document.DocTypeText)), sqlmock.AnyArg(), sqlmock.AnyArg(),
			mustInt32Repo(t, int(shared.SyncStatusSynced)), mustInt32Repo(t, 0), "", kb.Model, kb.VectorDB,
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), mustUint64Repo(t, 0),
			kb.CreatedUID, kb.CreatedUID, sqlmock.AnyArg(), sqlmock.AnyArg(), sql.NullString{}, sql.NullString{},
		).
		WillReturnResult(sqlmock.NewResult(insertedID, 1))
}

func mustInt32Repo(t *testing.T, value int) int32 {
	t.Helper()
	converted, err := convert.SafeIntToInt32(value, "value")
	if err != nil {
		t.Fatalf("SafeIntToInt32 failed: %v", err)
	}
	return converted
}

func mustUint32Repo(t *testing.T, value int) uint32 {
	t.Helper()
	converted, err := convert.SafeIntToUint32(value, "value")
	if err != nil {
		t.Fatalf("SafeIntToUint32 failed: %v", err)
	}
	return converted
}

func mustUint64Repo(t *testing.T, value int) uint64 {
	t.Helper()
	converted, err := convert.SafeIntToUint64(value, "value")
	if err != nil {
		t.Fatalf("SafeIntToUint64 failed: %v", err)
	}
	return converted
}

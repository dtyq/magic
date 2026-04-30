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

	docentity "magic/internal/domain/knowledge/document/entity"
	docrepo "magic/internal/domain/knowledge/document/repository"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	"magic/internal/domain/knowledge/shared"
	documentrepo "magic/internal/infrastructure/persistence/mysql/knowledge/document"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/pkg/convert"
)

const repoTestDocumentCode = "DOC1"

func sqlPattern(query string) string {
	return `(?s)(?:-- name: .*?\n)?` + regexp.QuoteMeta(strings.TrimSpace(query))
}

func sqlContains(fragment string) string {
	return regexp.QuoteMeta(strings.TrimSpace(fragment))
}

func knowledgeBaseSnapshotForTest(kb *kbentity.KnowledgeBase) *docrepo.KnowledgeBaseRuntimeSnapshot {
	if kb == nil {
		return nil
	}
	return &docrepo.KnowledgeBaseRuntimeSnapshot{
		Code:             kb.Code,
		OrganizationCode: kb.OrganizationCode,
		Model:            kb.Model,
		VectorDB:         kb.VectorDB,
		CreatedUID:       kb.CreatedUID,
		UpdatedUID:       kb.UpdatedUID,
		RetrieveConfig:   kb.RetrieveConfig,
		FragmentConfig:   kb.FragmentConfig,
		EmbeddingConfig:  kb.EmbeddingConfig,
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

func TestDocumentRepositorySaveRecoversManagedSourceDuplicate(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	doc := sampleDocument()
	doc.Code = "managed-source-teamshare-10-20"
	doc.SourceBindingID = 10
	doc.SourceItemID = 20

	expectDocumentInsertDuplicate(t, mock, doc)
	row := sampleKnowledgeBaseDocumentRow(t)
	row.ID = 101
	row.Code = doc.Code
	row.SourceBindingID = doc.SourceBindingID
	row.SourceItemID = doc.SourceItemID
	mock.ExpectQuery(sqlContains("FindDocumentByCodeAndKnowledgeBase")).
		WithArgs(doc.Code, doc.KnowledgeBaseCode).
		WillReturnRows(sqlmock.NewRows(documentRowColumns()).AddRow(documentRowValues(row, sql.NullTime{})...))
	expectSourceBindingLookups(mock, sourceBindingLookupRow{ID: doc.SourceBindingID, Provider: "teamshare", RootRef: "ROOT"})
	expectSourceItemLookups(mock, sourceItemLookupRow{ID: doc.SourceItemID, ItemRef: "FILE1"})

	if err := repo.Save(context.Background(), doc); err != nil {
		t.Fatalf("Save duplicate recovery returned error: %v", err)
	}
	if doc.ID != 101 {
		t.Fatalf("expected duplicate recovery to hydrate existing doc id, got %d", doc.ID)
	}
	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositorySaveRejectsManagedSourceDuplicateIdentityMismatch(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	doc := sampleDocument()
	doc.Code = "managed-source-teamshare-10-20"
	doc.SourceBindingID = 10
	doc.SourceItemID = 20

	expectDocumentInsertDuplicate(t, mock, doc)
	row := sampleKnowledgeBaseDocumentRow(t)
	row.Code = doc.Code
	row.SourceBindingID = 99
	row.SourceItemID = doc.SourceItemID
	mock.ExpectQuery(sqlContains("FindDocumentByCodeAndKnowledgeBase")).
		WithArgs(doc.Code, doc.KnowledgeBaseCode).
		WillReturnRows(sqlmock.NewRows(documentRowColumns()).AddRow(documentRowValues(row, sql.NullTime{})...))
	expectSourceBindingLookups(mock, sourceBindingLookupRow{ID: 99, Provider: "teamshare", RootRef: "ROOT"})
	expectSourceItemLookups(mock, sourceItemLookupRow{ID: doc.SourceItemID, ItemRef: "FILE1"})

	err := repo.Save(context.Background(), doc)
	if err == nil || !strings.Contains(err.Error(), "managed source document identity conflict") {
		t.Fatalf("expected managed source identity conflict, got %v", err)
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
	mock.ExpectExec(sqlPattern(`DELETE FROM knowledge_base_documents
WHERE knowledge_base_code = ?
  AND code IN (?,?)`)).
		WithArgs("KB1", "DOC-1", "DOC-2").
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
	if err := repo.DeleteByKnowledgeBaseAndCodes(context.Background(), "KB1", []string{"DOC-1", "DOC-2"}); err != nil {
		t.Fatalf("DeleteByKnowledgeBaseAndCodes returned error: %v", err)
	}
	if err := repo.UpdateSyncStatus(context.Background(), 7, shared.SyncStatusSyncing, "running"); err != nil {
		t.Fatalf("UpdateSyncStatus returned error: %v", err)
	}
	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositoryListByKnowledgeBaseAndSourceBindingIDs(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	rowValues := sampleDocumentRowValues(t)

	mock.ExpectQuery(sqlContains("ListDocumentsByKnowledgeBaseAndSourceBindingIDs")).
		WithArgs("KB1", int64(11), int64(12)).
		WillReturnRows(sqlmock.NewRows(documentRowColumns()).AddRow(rowValues...))

	docs, err := repo.ListByKnowledgeBaseAndSourceBindingIDs(context.Background(), "KB1", []int64{11, 12})
	if err != nil {
		t.Fatalf("ListByKnowledgeBaseAndSourceBindingIDs returned error: %v", err)
	}
	if len(docs) != 1 || docs[0].Code != repoTestDocumentCode {
		t.Fatalf("unexpected docs: %#v", docs)
	}
	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositoryFinders(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	rowValues := sampleDocumentRowValues(t)

	expectDocumentSelect(mock, []driver.Value{repoTestDocumentCode}, rowValues)
	expectDocumentSelect(mock, []driver.Value{repoTestDocumentCode, "KB1"}, rowValues)
	expectDocumentSelect(mock, []driver.Value{int64(1)}, rowValues)
	expectDocumentSelect(mock, []driver.Value{"drive", "TF-1"}, rowValues)

	if _, err := repo.FindByCode(context.Background(), repoTestDocumentCode); err != nil {
		t.Fatalf("FindByCode returned error: %v", err)
	}
	if _, err := repo.FindByCodeAndKnowledgeBase(context.Background(), repoTestDocumentCode, "KB1"); err != nil {
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

func TestDocumentRepositoryFindByIDAcceptsEmptyShapeJSONPayloads(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	rowValues := sampleDocumentRowValues(t)
	rowValues[12] = nil
	rowValues[13] = []byte(`[]`)
	rowValues[19] = []byte(`""`)
	rowValues[20] = []byte(`"[]"`)
	rowValues[21] = []byte(`{}`)
	rowValues[22] = []byte(`"{}"`)

	expectDocumentSelect(mock, []driver.Value{int64(1)}, rowValues)

	doc, err := repo.FindByID(context.Background(), 1)
	if err != nil {
		t.Fatalf("FindByID returned error: %v", err)
	}
	if len(doc.DocMetadata) != 0 {
		t.Fatalf("expected empty doc metadata, got %#v", doc.DocMetadata)
	}
	if doc.DocumentFile != nil {
		t.Fatalf("expected empty document file to normalize to nil, got %#v", doc.DocumentFile)
	}
	if doc.RetrieveConfig != nil || doc.FragmentConfig != nil || doc.VectorDBConfig != nil {
		t.Fatalf("expected empty-shape configs to normalize to nil, got retrieve=%#v fragment=%#v vector=%#v", doc.RetrieveConfig, doc.FragmentConfig, doc.VectorDBConfig)
	}
	if doc.EmbeddingConfig == nil {
		t.Fatal("expected raw empty object embedding config to map to non-nil pointer")
	}

	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositoryThirdFileFallbackFinders(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	rowValues := sampleDocumentRowValues(t)

	expectThirdFileDirectMiss(mock, "FindDocumentByThirdFile", "drive", "TF-1")
	expectThirdFileDirectMiss(mock, "FindDocumentByKnowledgeBaseAndThirdFile", "KB1", sql.NullString{String: "drive", Valid: true}, sql.NullString{String: "TF-1", Valid: true})
	expectKnowledgeBaseOrganizationLookup(mock, "KB1", "ORG1")
	expectSourceItemIDLookup(mock, 31, 32)
	expectThirdFileDirectHit(mock, "FindLatestDocumentByKnowledgeBaseAndSourceItemIDs", rowValues, "KB1", int64(31), int64(32))
	expectThirdFileDirectHit(mock, "ListDocumentsByOrganizationAndThirdFile", nil, "ORG1", sql.NullString{String: "drive", Valid: true}, sql.NullString{String: "TF-1", Valid: true})
	expectSourceItemIDLookup(mock, 31, 32)
	expectThirdFileDirectHit(mock, "ListDocumentsByOrganizationAndSourceItemIDs", rowValues, "ORG1", int64(31), int64(32))

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

	expectThirdFileDirectHit(mock, "ListDocumentsByOrganizationAndThirdFile", directRow, "ORG1", sql.NullString{String: "drive", Valid: true}, sql.NullString{String: "TF-1", Valid: true})
	expectSourceItemIDLookup(mock, 31, 32)
	expectThirdFileDirectHit(mock, "ListDocumentsByOrganizationAndSourceItemIDs", fallbackRow, "ORG1", int64(31), int64(32))

	docs, err := repo.ListByThirdFileInOrg(context.Background(), "ORG1", "drive", "TF-1")
	if err != nil {
		t.Fatalf("ListByThirdFileInOrg returned error: %v", err)
	}
	if len(docs) != 2 || docs[0].Code != "DOC-DIRECT" || docs[1].Code != "DOC-FALLBACK" {
		t.Fatalf("expected direct+fallback union, got %#v", docs)
	}

	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositoryListByThirdFileInOrgSortsDirectHitsByIDDesc(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	olderRow := sampleDocumentRowValuesWithCode(t, "DOC-OLDER", sql.NullTime{})
	newerRow := sampleDocumentRowValuesWithCode(t, "DOC-NEWER", sql.NullTime{})
	olderRow[0] = int64(2)
	newerRow[0] = int64(9)

	expectThirdFileDirectRows(
		mock,
		"ListDocumentsByOrganizationAndThirdFile",
		[][]driver.Value{olderRow, newerRow},
		"ORG1",
		sql.NullString{String: "drive", Valid: true},
		sql.NullString{String: "TF-1", Valid: true},
	)
	expectSourceItemIDLookup(mock)

	docs, err := repo.ListByThirdFileInOrg(context.Background(), "ORG1", "drive", "TF-1")
	if err != nil {
		t.Fatalf("ListByThirdFileInOrg returned error: %v", err)
	}
	if len(docs) != 2 || docs[0].Code != "DOC-NEWER" || docs[1].Code != "DOC-OLDER" {
		t.Fatalf("expected direct docs sorted by id desc, got %#v", docs)
	}

	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositoryListRealtimeByThirdFileInOrgFiltersByRealtimeBindingCore(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock

	allowedRow := sampleDocumentRowValuesWithRelations(t, 30, "DOC-OK", 101, 201)
	manualRow := sampleDocumentRowValuesWithRelations(t, 20, "DOC-MANUAL", 102, 202)
	wrongProviderRow := sampleDocumentRowValuesWithRelations(t, 10, "DOC-WRONG-PROVIDER", 103, 203)

	expectThirdFileDirectRows(
		mock,
		"ListDocumentsByOrganizationAndThirdFile",
		[][]driver.Value{allowedRow, manualRow},
		"ORG1",
		sql.NullString{String: "drive", Valid: true},
		sql.NullString{String: "TF-1", Valid: true},
	)
	expectSourceItemIDLookup(mock, 31, 32)
	expectThirdFileDirectRows(
		mock,
		"ListDocumentsByOrganizationAndSourceItemIDs",
		[][]driver.Value{wrongProviderRow},
		"ORG1",
		int64(31),
		int64(32),
	)
	expectRealtimeSourceBindingCoresByIDs(
		mock,
		"ORG1",
		"drive",
		[][]driver.Value{
			sourceBindingCoreRowValues(101, "ORG1", "KB1", "drive", "realtime", true),
		},
		int64(101),
		int64(102),
		int64(103),
	)
	expectSourceBindingLookups(mock, sourceBindingLookupRow{ID: 101, Provider: "drive", RootRef: "ROOT1"})
	expectSourceItemLookups(mock, sourceItemLookupRow{ID: 201, ItemRef: "TF-1"})

	docs, err := repo.ListRealtimeByThirdFileInOrg(context.Background(), "ORG1", "drive", "TF-1")
	if err != nil {
		t.Fatalf("ListRealtimeByThirdFileInOrg returned error: %v", err)
	}
	if len(docs) != 1 || docs[0].Code != "DOC-OK" {
		t.Fatalf("unexpected realtime third-file docs: %#v", docs)
	}

	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositoryHasRealtimeProjectFileDocumentInOrgFiltersByRealtimeBindingCore(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock

	manualRow := sampleDocumentRowValuesWithRelations(t, 40, "DOC-MANUAL", 201, 301)
	realtimeRow := sampleDocumentRowValuesWithRelations(t, 41, "DOC-REALTIME", 202, 302)

	expectSourceItemIDLookupFor(mock, "ORG1", "project", "9", 301, 302)
	expectThirdFileDirectRows(
		mock,
		"ListDocumentsByOrganizationAndSourceItemIDs",
		[][]driver.Value{manualRow, realtimeRow},
		"ORG1",
		int64(301),
		int64(302),
	)
	expectRealtimeSourceBindingCoresByIDs(
		mock,
		"ORG1",
		"project",
		[][]driver.Value{
			sourceBindingCoreRowValues(202, "ORG1", "KB1", "project", "realtime", true),
		},
		int64(201),
		int64(202),
	)

	got, err := repo.HasRealtimeProjectFileDocumentInOrg(context.Background(), "ORG1", 9)
	if err != nil {
		t.Fatalf("HasRealtimeProjectFileDocumentInOrg returned error: %v", err)
	}
	if !got {
		t.Fatal("expected realtime project-file document")
	}

	assertDocumentMockExpectations(t, mock)
}

func expectThirdFileDirectMiss(mock sqlmock.Sqlmock, whereClause string, args ...driver.Value) {
	mock.ExpectQuery(sqlContains(whereClause)).
		WithArgs(args...).
		WillReturnError(sql.ErrNoRows)
}

func expectThirdFileDirectHit(mock sqlmock.Sqlmock, whereClause string, rowValues []driver.Value, args ...driver.Value) {
	expectThirdFileDirectRows(mock, whereClause, [][]driver.Value{rowValues}, args...)
}

func expectThirdFileDirectRows(mock sqlmock.Sqlmock, whereClause string, rowsValues [][]driver.Value, args ...driver.Value) {
	rows := sqlmock.NewRows(documentRowColumns())
	for _, rowValues := range rowsValues {
		if len(rowValues) == 0 {
			continue
		}
		rows.AddRow(rowValues...)
	}
	mock.ExpectQuery(sqlContains(whereClause)).
		WithArgs(args...).
		WillReturnRows(rows)
}

func expectSourceItemIDLookup(mock sqlmock.Sqlmock, ids ...int64) {
	expectSourceItemIDLookupFor(mock, "ORG1", "drive", "TF-1", ids...)
}

func expectSourceItemIDLookupFor(mock sqlmock.Sqlmock, organizationCode, provider, itemRef string, ids ...int64) {
	pattern := `SELECT id
FROM knowledge_source_items
WHERE organization_code = ?
  AND provider = ?
  AND item_ref = ?`
	args := []driver.Value{organizationCode, provider, itemRef}
	rows := sqlmock.NewRows([]string{"id"})
	for _, id := range ids {
		rows.AddRow(id)
	}
	mock.ExpectQuery(sqlPattern(pattern)).
		WithArgs(args...).
		WillReturnRows(rows)
}

func expectRealtimeSourceBindingCoresByIDs(
	mock sqlmock.Sqlmock,
	organizationCode string,
	provider string,
	rowsValues [][]driver.Value,
	ids ...int64,
) {
	rows := sqlmock.NewRows(sourceBindingCoreRowColumns())
	for _, rowValues := range rowsValues {
		rows.AddRow(rowValues...)
	}
	args := make([]driver.Value, 0, len(ids))
	for _, id := range ids {
		args = append(args, id)
	}
	args = append(args, organizationCode, provider)
	mock.ExpectQuery(sqlContains("ListRealtimeKnowledgeSourceBindingsCoreByIDsAndProvider")).
		WithArgs(args...).
		WillReturnRows(rows)
}

type sourceBindingLookupRow struct {
	ID       int64
	Provider string
	RootRef  string
}

func expectSourceBindingLookups(mock sqlmock.Sqlmock, lookups ...sourceBindingLookupRow) {
	rows := sqlmock.NewRows([]string{"id", "provider", "root_ref"})
	args := make([]driver.Value, 0, len(lookups))
	for _, lookup := range lookups {
		args = append(args, lookup.ID)
		rows.AddRow(lookup.ID, lookup.Provider, lookup.RootRef)
	}
	mock.ExpectQuery(sqlContains("ListSourceBindingLookupsByIDs")).
		WithArgs(args...).
		WillReturnRows(rows)
}

type sourceItemLookupRow struct {
	ID      int64
	ItemRef string
}

func expectSourceItemLookups(mock sqlmock.Sqlmock, lookups ...sourceItemLookupRow) {
	rows := sqlmock.NewRows([]string{"id", "item_ref"})
	args := make([]driver.Value, 0, len(lookups))
	for _, lookup := range lookups {
		args = append(args, lookup.ID)
		rows.AddRow(lookup.ID, lookup.ItemRef)
	}
	mock.ExpectQuery(sqlContains("ListSourceItemLookupsByIDs")).
		WithArgs(args...).
		WillReturnRows(rows)
}

func expectKnowledgeBaseOrganizationLookup(mock sqlmock.Sqlmock, knowledgeBaseCode, organizationCode string) {
	mock.ExpectQuery(sqlContains("FindDocumentOrganizationByKnowledgeBase")).
		WithArgs(knowledgeBaseCode).
		WillReturnRows(sqlmock.NewRows([]string{"organization_code"}).AddRow(organizationCode))
}

func TestDocumentRepositoryListAndCount(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	rowValues := sampleDocumentRowValues(t)
	expectDocumentListWithFilters(t, mock, rowValues)
	expectDocumentCountByKnowledgeBaseCodes(t, mock)

	docs, total, err := repo.List(context.Background(), &docrepo.DocumentQuery{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		Name:              "doc",
		DocType:           new(int(docentity.DocumentInputKindFile)),
		Enabled:           new(true),
		SyncStatus:        new(shared.SyncStatusSynced),
		Offset:            0,
		Limit:             5,
	})
	if err != nil || total != 1 || len(docs) != 1 {
		t.Fatalf("unexpected List result docs=%#v total=%d err=%v", docs, total, err)
	}

	counts, err := repo.CountByKnowledgeBaseCodes(context.Background(), "ORG1", []string{"KB1", "KB2"})
	if err != nil || counts["KB1"] != 1 || counts["KB2"] != 1 {
		t.Fatalf("unexpected counts=%#v err=%v", counts, err)
	}
	empty, err := repo.CountByKnowledgeBaseCodes(context.Background(), "ORG1", nil)
	if err != nil || len(empty) != 0 {
		t.Fatalf("unexpected empty counts=%#v err=%v", empty, err)
	}

	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositoryCountByKnowledgeBaseCodesExtractsExtensionWithoutFullDecode(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock

	mock.ExpectQuery(sqlContains("ListDocumentFilesByKnowledgeBaseCodes")).
		WithArgs("ORG1", "KB1", "KB2", "KB3").
		WillReturnRows(sqlmock.NewRows([]string{"knowledge_base_code", "document_file"}).
			AddRow("KB1", mustJSON(t, map[string]any{"third_file_extension_name": "docx"})).
			AddRow("KB1", mustJSON(t, map[string]any{"name": "report.pdf"})).
			AddRow("KB2", mustJSON(t, map[string]any{"url": "https://example.com/demo.js"})).
			AddRow("KB2", mustJSON(t, map[string]any{"file_link": map[string]any{"url": "https://example.com/slides.pptx"}})).
			AddRow("KB3", mustJSON(t, map[string]any{"name": "legacy"})),
		)

	counts, err := repo.CountByKnowledgeBaseCodes(context.Background(), "ORG1", []string{"KB1", "KB2", "KB3"})
	if err != nil {
		t.Fatalf("CountByKnowledgeBaseCodes returned error: %v", err)
	}
	if counts["KB1"] != 2 || counts["KB2"] != 1 || counts["KB3"] != 1 {
		t.Fatalf("unexpected counts=%#v", counts)
	}

	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositoryCountByKnowledgeBaseCodesReturnsDocumentFileDecodeError(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock

	mock.ExpectQuery(sqlContains("ListDocumentFilesByKnowledgeBaseCodes")).
		WithArgs("ORG1", "KB1").
		WillReturnRows(sqlmock.NewRows([]string{"knowledge_base_code", "document_file"}).
			AddRow("KB1", []byte(`{"extension":`)),
		)

	_, err := repo.CountByKnowledgeBaseCodes(context.Background(), "ORG1", []string{"KB1"})
	if err == nil || !strings.Contains(err.Error(), "extract document extension by knowledge base code KB1") {
		t.Fatalf("expected document_file decode error, got %v", err)
	}

	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositoryListByOrganizationDirectlyQueriesDocuments(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	rowValues := sampleDocumentRowValues(t)

	mock.ExpectQuery(sqlContains("ListDocumentsByOrganization")).
		WillReturnRows(sqlmock.NewRows(documentRowColumns()).AddRow(rowValues...))

	docs, total, err := repo.List(context.Background(), &docrepo.DocumentQuery{
		OrganizationCode: "ORG1",
		Offset:           0,
		Limit:            10,
	})
	if err != nil || total != 1 || len(docs) != 1 {
		t.Fatalf("unexpected List result docs=%#v total=%d err=%v", docs, total, err)
	}

	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositoryListFiltersUnsupportedExtensionsInRepository(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	visibleRow := sampleDocumentRowValues(t)
	hiddenRow := sampleDocumentRowValues(t)
	hiddenRow[8] = "DOC-JS"
	hiddenRow[13] = mustJSON(t, map[string]any{"name": "demo.js", "url": "bucket/demo.js", "extension": "js"})

	mock.ExpectQuery(sqlContains("ListDocumentsByOrganization")).
		WillReturnRows(sqlmock.NewRows(documentRowColumns()).
			AddRow(hiddenRow...).
			AddRow(visibleRow...))

	docs, total, err := repo.List(context.Background(), &docrepo.DocumentQuery{
		OrganizationCode: "ORG1",
		Offset:           0,
		Limit:            10,
	})
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if total != 1 || len(docs) != 1 || docs[0].Code != repoTestDocumentCode {
		t.Fatalf("expected only visible document after repository filtering, got docs=%#v total=%d", docs, total)
	}

	assertDocumentMockExpectations(t, mock)
}

func TestDocumentRepositoryProjectSourceQueriesAvoidJoin(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock

	projectRows := sampleDocumentRowValuesWithScope(t, repoTestDocumentCode, sql.NullTime{}, "project", "7", "")
	projectFileRows := sampleDocumentRowValuesWithScope(t, repoTestDocumentCode, sql.NullTime{}, "project", "", "9")

	mock.ExpectQuery(sqlPattern(`SELECT id
FROM knowledge_source_bindings
WHERE knowledge_base_code = ?
  AND provider = 'project'
  AND root_type = 'project'
  AND root_ref = ?`)).
		WithArgs("KB1", "7").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int64(11)).AddRow(int64(12)))
	mock.ExpectQuery(sqlContains("ListDocumentsByKnowledgeBaseAndSourceBindingIDs")).
		WithArgs("KB1", int64(11), int64(12)).
		WillReturnRows(sqlmock.NewRows(documentRowColumns()).AddRow(projectRows...))

	mock.ExpectQuery(sqlPattern(`SELECT id
FROM knowledge_source_bindings
WHERE organization_code = ?
  AND provider = 'project'
  AND root_type = 'project'`)).
		WithArgs("ORG1").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int64(11)).AddRow(int64(12)))
	mock.ExpectQuery(sqlPattern(`SELECT id
FROM knowledge_source_items
WHERE organization_code = ?
  AND provider = ?
  AND item_ref = ?`)).
		WithArgs("ORG1", "project", "9").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int64(21)).AddRow(int64(22)))
	mock.ExpectQuery(sqlContains("ListDocumentsByOrganizationAndSourceBindingAndSourceItems")).
		WithArgs("ORG1", int64(11), int64(12), int64(21), int64(22)).
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

func TestDocumentRepositoryFindByKnowledgeBaseAndProjectFileScopesSourceItemsByOrganization(t *testing.T) {
	t.Parallel()

	testCtx := newDocumentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	rowValues := sampleDocumentRowValuesWithScope(t, repoTestDocumentCode, sql.NullTime{}, "project", "7", "9")

	expectKnowledgeBaseOrganizationLookup(mock, "KB1", "ORG1")
	mock.ExpectQuery(sqlPattern(`SELECT id
FROM knowledge_source_bindings
WHERE knowledge_base_code = ?
  AND provider = 'project'
  AND root_type = 'project'
  AND root_ref = ?`)).
		WithArgs("KB1", "9").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int64(11)).AddRow(int64(12)))
	mock.ExpectQuery(sqlPattern(`SELECT id
FROM knowledge_source_items
WHERE organization_code = ?
  AND provider = ?
  AND item_ref = ?`)).
		WithArgs("ORG1", "project", "9").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int64(21)).AddRow(int64(22)))
	mock.ExpectQuery(sqlContains("FindLatestDocumentByKnowledgeBaseAndSourceBindingAndSourceItems")).
		WithArgs("KB1", int64(11), int64(12), int64(21), int64(22)).
		WillReturnRows(sqlmock.NewRows(documentRowColumns()).AddRow(rowValues...))

	doc, err := repo.FindByKnowledgeBaseAndProjectFile(context.Background(), "KB1", 9)
	if err != nil || doc == nil || doc.Code != repoTestDocumentCode {
		t.Fatalf("unexpected FindByKnowledgeBaseAndProjectFile doc=%#v err=%v", doc, err)
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

func sampleDocument() *docentity.KnowledgeBaseDocument {
	return &docentity.KnowledgeBaseDocument{
		ID:                1,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		Name:              "doc-1",
		Description:       "desc",
		Code:              repoTestDocumentCode,
		Enabled:           true,
		DocType:           int(docentity.DocumentInputKindFile),
		DocMetadata:       map[string]any{"lang": "zh"},
		DocumentFile:      &docentity.File{Name: "doc.md", URL: "bucket/doc.md", Extension: "md"},
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
		Code:              repoTestDocumentCode,
		Version:           1,
		Enabled:           true,
		DocType:           mustUint32Repo(t, int(docentity.DocumentInputKindFile)),
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
		"version", "enabled", "doc_type", "doc_metadata", "document_file",
		"sync_status", "sync_times", "sync_status_message", "embedding_model", "vector_db",
		"retrieve_config", "fragment_config", "embedding_config", "vector_db_config", "word_count",
		"created_uid", "updated_uid", "created_at", "updated_at", "deleted_at", "third_platform_type", "third_file_id",
	}
}

func sampleDocumentRowValues(t *testing.T) []driver.Value {
	t.Helper()
	return sampleDocumentRowValuesWithScope(t, repoTestDocumentCode, sql.NullTime{}, "drive", "", "TF-1")
}

func sampleDocumentRowValuesWithRelations(
	t *testing.T,
	id int64,
	code string,
	sourceBindingID int64,
	sourceItemID int64,
) []driver.Value {
	t.Helper()

	row := sampleKnowledgeBaseDocumentRow(t)
	row.ID = id
	row.Code = code
	row.SourceBindingID = sourceBindingID
	row.SourceItemID = sourceItemID
	return documentRowValues(row, sql.NullTime{})
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
	_ = sourceProvider
	_ = bindingRootRef
	_ = sourceItemRef

	row := sampleKnowledgeBaseDocumentRow(t)
	row.Code = code
	return documentRowValues(row, deletedAt)
}

func documentRowValues(row mysqlsqlc.KnowledgeBaseDocument, deletedAt sql.NullTime) []driver.Value {
	return []driver.Value{
		row.ID, row.OrganizationCode, row.KnowledgeBaseCode, row.SourceBindingID, row.SourceItemID, row.AutoAdded, row.Name, row.Description, row.Code,
		row.Version, row.Enabled, row.DocType, row.DocMetadata, row.DocumentFile,
		row.SyncStatus, row.SyncTimes, row.SyncStatusMessage, row.EmbeddingModel, row.VectorDb,
		row.RetrieveConfig, row.FragmentConfig, row.EmbeddingConfig, row.VectorDbConfig, row.WordCount,
		row.CreatedUid, row.UpdatedUid, row.CreatedAt, row.UpdatedAt, deletedAt, row.ThirdPlatformType, row.ThirdFileID,
	}
}

func sourceBindingCoreRowColumns() []string {
	return []string{
		"id", "organization_code", "knowledge_base_code", "provider", "root_type", "root_ref",
		"sync_mode", "sync_config", "enabled", "created_uid", "updated_uid", "created_at", "updated_at",
	}
}

func sourceBindingCoreRowValues(
	id int64,
	organizationCode string,
	knowledgeBaseCode string,
	provider string,
	syncMode string,
	enabled bool,
) []driver.Value {
	now := time.Date(2026, 4, 20, 17, 0, 0, 0, time.Local)
	return []driver.Value{
		id,
		organizationCode,
		knowledgeBaseCode,
		provider,
		"project",
		"1001",
		syncMode,
		nil,
		enabled,
		"U1",
		"U1",
		now,
		now,
	}
}

func expectDocumentSelect(mock sqlmock.Sqlmock, args, rowValues []driver.Value) {
	mock.ExpectQuery(sqlContains("SELECT id, organization_code, knowledge_base_code, source_binding_id")).
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

func expectDocumentSave(t *testing.T, mock sqlmock.Sqlmock, doc *docentity.KnowledgeBaseDocument, insertedID int64) {
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

func expectDocumentInsertDuplicate(t *testing.T, mock sqlmock.Sqlmock, doc *docentity.KnowledgeBaseDocument) {
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
		WillReturnError(&mysqlDriver.MySQLError{Number: 1062, Message: "duplicate"})
}

func expectDocumentUpdate(t *testing.T, mock sqlmock.Sqlmock, doc *docentity.KnowledgeBaseDocument) {
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

	mock.ExpectQuery(sqlPattern(`SELECT id, organization_code, knowledge_base_code, source_binding_id, source_item_id, auto_added, name, description, code, version, enabled, doc_type, doc_metadata, document_file, sync_status, sync_times, sync_status_message, embedding_model, vector_db, retrieve_config, fragment_config, embedding_config, vector_db_config, word_count, created_uid, updated_uid, created_at, updated_at, deleted_at, third_platform_type, third_file_id
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND organization_code = ?
  AND knowledge_base_code = ?
  AND name LIKE ?
  AND doc_type IN`)).
		WillReturnRows(sqlmock.NewRows(documentRowColumns()).AddRow(rowValues...))
}

func expectDocumentCountByKnowledgeBaseCodes(t *testing.T, mock sqlmock.Sqlmock) {
	t.Helper()

	mock.ExpectQuery(sqlContains("ListDocumentFilesByKnowledgeBaseCodes")).
		WithArgs("ORG1", "KB1", "KB2").
		WillReturnRows(sqlmock.NewRows([]string{"knowledge_base_code", "document_file"}).
			AddRow("KB1", mustJSON(t, map[string]any{"name": "ok.md", "extension": "md"})).
			AddRow("KB1", mustJSON(t, map[string]any{"name": "code.js", "extension": "js"})).
			AddRow("KB2", mustJSON(t, map[string]any{"name": "legacy", "extension": ""})),
		)
}

func expectDocumentFindByCodeAndKnowledgeBaseMiss(mock sqlmock.Sqlmock, code, knowledgeBaseCode string) {
	mock.ExpectQuery(sqlContains("FindDocumentByCodeAndKnowledgeBase")).
		WithArgs(code, knowledgeBaseCode).
		WillReturnError(sql.ErrNoRows)
}

func expectDocumentFindIncludingDeleted(mock sqlmock.Sqlmock, knowledgeBaseCode, code string, rowValues []driver.Value) {
	mock.ExpectQuery(sqlContains("FindDocumentIncludingDeleted")).
		WithArgs(knowledgeBaseCode, code).
		WillReturnRows(sqlmock.NewRows(documentRowColumns()).AddRow(rowValues...))
}

func expectDocumentFindIncludingDeletedMiss(mock sqlmock.Sqlmock, knowledgeBaseCode, code string) {
	mock.ExpectQuery(sqlContains("FindDocumentIncludingDeleted")).
		WithArgs(knowledgeBaseCode, code).
		WillReturnError(sql.ErrNoRows)
}

func expectDocumentInsertDuplicateFallback(
	t *testing.T,
	mock sqlmock.Sqlmock,
	kb *kbentity.KnowledgeBase,
	defaultCode string,
) {
	t.Helper()

	mock.ExpectExec(sqlPattern(`INSERT INTO knowledge_base_documents`)).
		WithArgs(
			kb.OrganizationCode, kb.Code, int64(0), int64(0), false, "未命名文档.txt", "", defaultCode,
			true, mustUint32Repo(t, int(docentity.DocumentInputKindText)), sqlmock.AnyArg(), sqlmock.AnyArg(),
			mustInt32Repo(t, int(shared.SyncStatusSynced)), mustInt32Repo(t, 0), "", kb.Model, kb.VectorDB,
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), mustUint64Repo(t, 0),
			kb.CreatedUID, kb.CreatedUID, sqlmock.AnyArg(), sqlmock.AnyArg(), sql.NullString{}, sql.NullString{},
		).
		WillReturnError(&mysqlDriver.MySQLError{Number: 1062, Message: "duplicate"})
}

func expectDocumentInsertDefaultDocument(
	t *testing.T,
	mock sqlmock.Sqlmock,
	kb *kbentity.KnowledgeBase,
	defaultCode string,
	insertedID int64,
) {
	t.Helper()

	mock.ExpectExec(sqlPattern(`INSERT INTO knowledge_base_documents`)).
		WithArgs(
			kb.OrganizationCode, kb.Code, int64(0), int64(0), false, "未命名文档.txt", "", defaultCode,
			true, mustUint32Repo(t, int(docentity.DocumentInputKindText)), sqlmock.AnyArg(), sqlmock.AnyArg(),
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

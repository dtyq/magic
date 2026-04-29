package fragmentrepo_test

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"reflect"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/shared"
	sharedentity "magic/internal/domain/knowledge/shared/entity"
	fragmentrepo "magic/internal/infrastructure/persistence/mysql/knowledge/fragment"
	thirdfilemappingpkg "magic/internal/pkg/thirdfilemapping"
)

const testFragmentPointID = "point-1"

func sqlPattern(query string) string {
	return `(?s)(?:-- name: .*?\n)?` + regexp.QuoteMeta(strings.TrimSpace(query))
}

func sqlContains(fragment string) string {
	return regexp.QuoteMeta(strings.TrimSpace(fragment))
}

func TestFragmentRepositorySaveUpdateAndDeleteFlows(t *testing.T) {
	t.Parallel()

	testCtx := newFragmentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	fragment := sampleFragment()

	expectFragmentSave(t, mock, fragment, 51)

	if err := repo.Save(context.Background(), fragment); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}
	if fragment.ID != 51 {
		t.Fatalf("expected inserted id 51, got %d", fragment.ID)
	}

	expectFragmentUpdate(t, mock, fragment)
	expectFragmentUpdateSyncStatus(t, mock, fragment)
	expectFragmentDeleteFlows(t, mock, fragment)

	if err := repo.Update(context.Background(), fragment); err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if err := repo.UpdateSyncStatus(context.Background(), fragment); err != nil {
		t.Fatalf("UpdateSyncStatus returned error: %v", err)
	}
	if err := repo.Delete(context.Background(), fragment.ID); err != nil {
		t.Fatalf("Delete returned error: %v", err)
	}
	if err := repo.DeleteByDocument(context.Background(), fragment.KnowledgeCode, fragment.DocumentCode); err != nil {
		t.Fatalf("DeleteByDocument returned error: %v", err)
	}
	if err := repo.DeleteByDocumentCodes(context.Background(), fragment.KnowledgeCode, []string{fragment.DocumentCode, "DOC2"}); err != nil {
		t.Fatalf("DeleteByDocumentCodes returned error: %v", err)
	}
	if err := repo.DeleteByKnowledgeBase(context.Background(), fragment.KnowledgeCode); err != nil {
		t.Fatalf("DeleteByKnowledgeBase returned error: %v", err)
	}

	assertFragmentMockExpectations(t, mock)
}

func TestFragmentRepositoryFindListAndPendingFlows(t *testing.T) {
	t.Parallel()

	testCtx := newFragmentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	rowValues := sampleFragmentRowValues(t)

	expectFragmentQuery(mock, "FindFragmentByID", []driver.Value{int64(1)}, rowValues)
	expectFragmentFindByPointIDs(mock, []string{testFragmentPointID, "point-2"}, rowValues)
	expectFragmentFindByIDs(mock, []int64{1, 2}, rowValues)
	expectFragmentListWithFilters(t, mock, rowValues)
	expectFragmentListByDocument(t, mock, rowValues)
	expectFragmentListByKnowledgeBase(t, mock, rowValues)
	expectFragmentListByBusinessID(t, mock, rowValues)
	expectFragmentListMissingDocumentCode(t, mock, rowValues)
	expectFragmentListPendingSync(t, mock, rowValues)

	if _, err := repo.FindByID(context.Background(), 1); err != nil {
		t.Fatalf("FindByID returned error: %v", err)
	}
	if fragments, err := repo.FindByPointIDs(context.Background(), []string{testFragmentPointID, "point-2"}); err != nil || len(fragments) != 1 {
		t.Fatalf("unexpected FindByPointIDs fragments=%#v err=%v", fragments, err)
	}
	if fragments, err := repo.FindByIDs(context.Background(), []int64{1, 2}); err != nil || len(fragments) != 1 {
		t.Fatalf("unexpected FindByIDs fragments=%#v err=%v", fragments, err)
	}
	if fragments, total, err := repo.List(context.Background(), &fragmodel.Query{
		KnowledgeCode: "KB1",
		DocumentCode:  "DOC1",
		Content:       "hello",
		SyncStatus:    new(shared.SyncStatusSynced),
		Offset:        1,
		Limit:         10,
	}); err != nil || total != 1 || len(fragments) != 1 {
		t.Fatalf("unexpected List fragments=%#v total=%d err=%v", fragments, total, err)
	}
	if fragments, _, err := repo.ListByDocument(context.Background(), "KB1", "DOC1", 1, 10); err != nil || len(fragments) != 1 {
		t.Fatalf("unexpected ListByDocument fragments=%#v err=%v", fragments, err)
	}
	if fragments, _, err := repo.ListByKnowledgeBase(context.Background(), "KB1", 1, 10); err != nil || len(fragments) != 1 {
		t.Fatalf("unexpected ListByKnowledgeBase fragments=%#v err=%v", fragments, err)
	}
	if fragments, total, err := repo.List(context.Background(), &fragmodel.Query{
		KnowledgeCode: "KB1",
		BusinessID:    "BIZ1",
		Offset:        1,
		Limit:         10,
	}); err != nil || total != 1 || len(fragments) != 1 {
		t.Fatalf("unexpected List by business id fragments=%#v total=%d err=%v", fragments, total, err)
	}
	if missing, err := repo.ListMissingDocumentCode(context.Background(), fragmodel.MissingDocumentCodeQuery{
		OrganizationCode: "ORG1",
		KnowledgeCode:    "KB1",
		StartID:          0,
		Limit:            10,
	}); err != nil || len(missing) != 1 {
		t.Fatalf("unexpected ListMissingDocumentCode missing=%#v err=%v", missing, err)
	}
	if pending, err := repo.ListPendingSync(context.Background(), "KB1", 5); err != nil || len(pending) != 1 {
		t.Fatalf("unexpected ListPendingSync pending=%#v err=%v", pending, err)
	}

	assertFragmentMockExpectations(t, mock)
}

func TestFragmentRepositoryFindByIDAcceptsEmptyShapeJSONPayloads(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		payload []byte
	}{
		{name: "null", payload: nil},
		{name: "empty array", payload: []byte(`[]`)},
		{name: "empty string", payload: []byte(`""`)},
		{name: "quoted empty array", payload: []byte(`"[]"`)},
		{name: "empty object", payload: []byte(`{}`)},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			testCtx := newFragmentRepositoryTestContext(t)
			repo, mock := testCtx.repo, testCtx.mock
			rowValues := sampleFragmentRowValues(t)
			rowValues[6] = tc.payload

			expectFragmentQuery(mock, "FindFragmentByID", []driver.Value{int64(1)}, rowValues)

			fragment, err := repo.FindByID(context.Background(), 1)
			if err != nil {
				t.Fatalf("FindByID returned error: %v", err)
			}
			if fragment.Metadata["document_code"] != "DOC1" {
				t.Fatalf("expected metadata contract to be applied, got %#v", fragment.Metadata)
			}

			assertFragmentMockExpectations(t, mock)
		})
	}
}

func TestFragmentRepositoryBackfillAndCountStats(t *testing.T) {
	t.Parallel()

	testCtx := newFragmentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock

	if _, err := repo.BackfillDocumentCode(context.Background(), []int64{1}, " "); !errorsIsFragmentDocCodeRequired(err) {
		t.Fatalf("expected document code required error, got %v", err)
	}

	mock.ExpectExec(sqlPattern(`UPDATE magic_flow_knowledge_fragment
SET document_code = ?,
    updated_at = ?
WHERE deleted_at IS NULL
  AND (document_code = '' OR document_code IS NULL)
  AND id IN (?,?)`)).
		WithArgs("DOC2", sqlmock.AnyArg(), int64(1), int64(2)).
		WillReturnResult(sqlmock.NewResult(0, 2))
	expectFragmentCountStatsByKnowledgeBase(t, mock, "KB1", 6, 4, 0)
	expectFragmentCountStatsByKnowledgeBase(t, mock, "KB1", 6, 4, 0)
	expectFragmentCountStatsByKnowledgeBase(t, mock, "KB1", 6, 4, 0)

	rows, err := repo.BackfillDocumentCode(context.Background(), []int64{1, 2}, "DOC2")
	if err != nil || rows != 2 {
		t.Fatalf("unexpected BackfillDocumentCode rows=%d err=%v", rows, err)
	}
	total, synced, err := repo.CountStatsByKnowledgeBase(context.Background(), "KB1")
	if err != nil || total != 6 || synced != 4 {
		t.Fatalf("unexpected CountStatsByKnowledgeBase total=%d synced=%d err=%v", total, synced, err)
	}
	if count, err := repo.CountByKnowledgeBase(context.Background(), "KB1"); err != nil || count != 6 {
		t.Fatalf("unexpected CountByKnowledgeBase count=%d err=%v", count, err)
	}
	if count, err := repo.CountSyncedByKnowledgeBase(context.Background(), "KB1"); err != nil || count != 4 {
		t.Fatalf("unexpected CountSyncedByKnowledgeBase count=%d err=%v", count, err)
	}

	assertFragmentMockExpectations(t, mock)
}

func TestFragmentRepositoryListByDocumentAfterID(t *testing.T) {
	t.Parallel()

	testCtx := newFragmentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	rowValues := sampleFragmentRowValues(t)

	mock.ExpectQuery(sqlContains("ListFragmentsByKnowledgeAndDocumentAfterID")).
		WithArgs("KB1", "DOC1", int64(10), mustInt32Repo(t, 5)).
		WillReturnRows(sqlmock.NewRows(fragmentRowColumns()).AddRow(rowValues...))

	fragments, err := repo.ListByDocumentAfterID(context.Background(), "KB1", "DOC1", 10, 5)
	if err != nil || len(fragments) != 1 {
		t.Fatalf("unexpected ListByDocumentAfterID fragments=%#v err=%v", fragments, err)
	}

	assertFragmentMockExpectations(t, mock)
}

func TestFragmentRepositoryListThirdFileRepairGroups(t *testing.T) {
	t.Parallel()

	testCtx := newFragmentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock

	mock.ExpectQuery(sqlContains("ListActiveKnowledgeBaseCodesByOrganization")).
		WithArgs("ORG1").
		WillReturnRows(sqlmock.NewRows([]string{"code"}).AddRow("KB1").AddRow("KB2"))
	mock.ExpectQuery(sqlPattern(`SELECT knowledge_code,
	JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.file_id')) AS third_file_id,
	COALESCE(MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.knowledge_base_id')), '')), '') AS knowledge_base_id,
	COALESCE(
MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.group_ref')), '')),
MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.folder_id')), '')),
MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.parent_id')), '')),
''
) AS group_ref,
	COALESCE(MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.third_file_type')), '')), '') AS third_file_type,
	COALESCE(MIN(NULLIF(document_code, '')), '') AS document_code,
	COALESCE(MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.document_name')), '')), '') AS document_name,
	COALESCE(MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.url')), '')), '') AS preview_url,
	COALESCE(MIN(NULLIF(created_uid, '')), '') AS created_uid,
	COALESCE(MIN(NULLIF(updated_uid, '')), '') AS updated_uid,
	COUNT(*) AS fragment_count,
	COALESCE(SUM(CASE WHEN document_code = '' OR document_code IS NULL THEN 1 ELSE 0 END), 0) AS missing_document_code_count
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.file_id')) <> ''
  AND knowledge_code IN (?,?)
GROUP BY knowledge_code, JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.file_id'))
ORDER BY knowledge_code ASC, third_file_id ASC
LIMIT ? OFFSET ?`)).
		WithArgs("KB1", "KB2", mustInt32Repo(t, 10), mustInt32Repo(t, 0)).
		WillReturnRows(
			sqlmock.NewRows([]string{
				"knowledge_code", "third_file_id", "knowledge_base_id", "group_ref", "third_file_type",
				"document_code", "document_name", "preview_url", "created_uid", "updated_uid",
				"fragment_count", "missing_document_code_count",
			}).
				AddRow("KB1", []byte("file-1"), "kb-legacy", "folder-1", "project_file", "DOC1", "Document 1", "https://example.test/doc-1", "U1", "U2", int64(3), int64(1)),
		)

	groups, err := repo.ListThirdFileRepairGroups(context.Background(), thirdfilemappingpkg.RepairGroupQuery{
		OrganizationCode: "ORG1",
		Limit:            10,
		Offset:           0,
	})
	if err != nil || len(groups) != 1 {
		t.Fatalf("unexpected ListThirdFileRepairGroups groups=%#v err=%v", groups, err)
	}
	if groups[0].KnowledgeCode != "KB1" || groups[0].ThirdFileID != "file-1" || groups[0].MissingDocumentCodeCount != 1 {
		t.Fatalf("unexpected repair group: %#v", groups[0])
	}

	assertFragmentMockExpectations(t, mock)
}

func TestFragmentRepositoryBackfillDocumentCodeByThirdFile(t *testing.T) {
	t.Parallel()

	testCtx := newFragmentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock

	mock.ExpectQuery(sqlContains("FindKnowledgeBaseByCodeAndOrg")).
		WithArgs("KB1", "ORG1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "code", "version", "name", "description", "type", "enabled", "business_id",
			"sync_status", "sync_status_message", "model", "vector_db", "organization_code",
			"created_uid", "updated_uid", "expected_num", "completed_num",
			"retrieve_config", "fragment_config", "embedding_config",
			"word_count", "icon", "source_type", "knowledge_base_type", "created_at", "updated_at", "deleted_at",
		}).AddRow(
			int64(1), "KB1", int32(1), "kb", "", int32(1), true, "",
			int32(0), "", "m", "vdb", "ORG1",
			"u1", "u1", int32(0), int32(0),
			[]byte(`null`), []byte(`null`), []byte(`null`),
			int64(0), "", sql.NullInt32{}, "flow_vector", time.Now(), time.Now(), sql.NullTime{},
		))
	mock.ExpectExec(sqlPattern(`UPDATE magic_flow_knowledge_fragment
SET document_code = ?,
    updated_at = ?
WHERE deleted_at IS NULL
  AND (document_code = '' OR document_code IS NULL)
  AND knowledge_code = ?
  AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.file_id')) = CAST(? AS CHAR(255))`)).
		WithArgs("DOC1", sqlmock.AnyArg(), "KB1", "file-1").
		WillReturnResult(sqlmock.NewResult(0, 2))

	rows, err := repo.BackfillDocumentCodeByThirdFile(context.Background(), thirdfilemappingpkg.BackfillByThirdFileInput{
		OrganizationCode: "ORG1",
		KnowledgeCode:    "KB1",
		ThirdFileID:      "file-1",
		DocumentCode:     "DOC1",
	})
	if err != nil || rows != 2 {
		t.Fatalf("unexpected BackfillDocumentCodeByThirdFile rows=%d err=%v", rows, err)
	}

	assertFragmentMockExpectations(t, mock)
}

func TestFragmentRepositoryListThirdFileRepairOrganizationCodes(t *testing.T) {
	t.Parallel()

	testCtx := newFragmentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock

	mock.ExpectQuery(sqlPattern(`SELECT DISTINCT knowledge_code
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.file_id')) <> ''
ORDER BY knowledge_code ASC`)).
		WillReturnRows(
			sqlmock.NewRows([]string{"knowledge_code"}).
				AddRow("KB1").
				AddRow(" KB2 "),
		)
	mock.ExpectQuery(sqlContains("ListActiveKnowledgeBaseOrganizationsByCodes")).
		WithArgs("KB1", " KB2 ").
		WillReturnRows(
			sqlmock.NewRows([]string{"organization_code"}).
				AddRow("ORG1").
				AddRow(" ORG2 "),
		)

	organizationCodes, err := repo.ListThirdFileRepairOrganizationCodes(context.Background())
	if err != nil {
		t.Fatalf("ListThirdFileRepairOrganizationCodes returned error: %v", err)
	}
	if got, want := organizationCodes, []string{"ORG1", "ORG2"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected organization codes got=%#v want=%#v", got, want)
	}

	assertFragmentMockExpectations(t, mock)
}

func sampleFragment() *fragmodel.KnowledgeBaseFragment {
	now := time.Date(2026, 3, 11, 11, 0, 0, 0, time.Local)
	fragment := fragmodel.NewFragment("KB1", "DOC1", "hello world", map[string]any{"section_title": "Intro"}, "U1")
	fragment.ID = 1
	fragment.PointID = testFragmentPointID
	fragment.BusinessID = "BIZ1"
	fragment.SyncStatus = sharedentity.SyncStatusSynced
	fragment.SyncTimes = 1
	fragment.SyncStatusMessage = "ok"
	fragment.WordCount = 11
	fragment.CreatedAt = now
	fragment.UpdatedAt = now
	return fragment
}

func fragmentRowColumns() []string {
	return []string{
		"id", "knowledge_code", "document_code", "parent_fragment_id", "version", "content",
		"metadata", "business_id", "sync_status", "sync_times", "sync_status_message",
		"point_id", "vector", "word_count", "created_uid", "updated_uid", "created_at", "updated_at", "deleted_at",
	}
}

func sampleFragmentRowValues(t *testing.T) []driver.Value {
	t.Helper()

	now := time.Date(2026, 3, 11, 11, 0, 0, 0, time.Local)
	metadata, err := json.Marshal(map[string]any{
		"document_name": "demo.md",
		"section_title": "Intro",
	})
	if err != nil {
		t.Fatalf("marshal fragment metadata: %v", err)
	}
	return []driver.Value{
		int64(1), "KB1", "DOC1",
		sql.NullInt64{},
		uint32(1),
		"hello world", metadata, "BIZ1",
		mustInt32Repo(t, int(shared.SyncStatusSynced)), mustInt32Repo(t, 1), "ok", testFragmentPointID,
		sql.NullString{},
		mustUint64Repo(t, 11),
		"U1", "U1", now, now,
		sql.NullTime{},
	}
}

func expectFragmentQuery(mock sqlmock.Sqlmock, queryName string, args, rowValues []driver.Value) {
	mock.ExpectQuery(sqlContains(queryName)).
		WithArgs(args...).
		WillReturnRows(sqlmock.NewRows(fragmentRowColumns()).AddRow(rowValues...))
}

func errorsIsFragmentDocCodeRequired(err error) bool {
	return errors.Is(err, shared.ErrFragmentDocumentCodeRequired)
}

type fragmentRepositoryTestContext struct {
	repo *fragmentrepo.FragmentRepository
	mock sqlmock.Sqlmock
}

func newFragmentRepositoryTestContext(t *testing.T) fragmentRepositoryTestContext {
	t.Helper()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	return fragmentRepositoryTestContext{
		repo: fragmentrepo.NewFragmentRepositoryWithDBForTest(db, nil),
		mock: mock,
	}
}

func assertFragmentMockExpectations(t *testing.T, mock sqlmock.Sqlmock) {
	t.Helper()

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func expectFragmentSave(t *testing.T, mock sqlmock.Sqlmock, fragment *fragmodel.KnowledgeBaseFragment, insertedID int64) {
	t.Helper()

	mock.ExpectExec(sqlPattern(`INSERT INTO magic_flow_knowledge_fragment (
  knowledge_code, document_code, content, metadata, business_id,
  sync_status, sync_times, sync_status_message, point_id, word_count,
  created_uid, updated_uid, created_at, updated_at
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)`)).
		WithArgs(
			fragment.KnowledgeCode, fragment.DocumentCode, fragment.Content, sqlmock.AnyArg(), fragment.BusinessID,
			mustInt32Repo(t, int(fragment.SyncStatus)), mustInt32Repo(t, fragment.SyncTimes), fragment.SyncStatusMessage, fragment.PointID,
			mustUint64Repo(t, fragment.WordCount), fragment.CreatedUID, fragment.UpdatedUID,
			sqlmock.AnyArg(), sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(insertedID, 1))
}

func expectFragmentUpdate(t *testing.T, mock sqlmock.Sqlmock, fragment *fragmodel.KnowledgeBaseFragment) {
	t.Helper()

	mock.ExpectExec(sqlContains("UpdateFragment")).
		WithArgs(
			fragment.Content,
			sqlmock.AnyArg(),
			fragment.PointID,
			mustUint64Repo(t, fragment.WordCount),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			fragment.UpdatedUID,
			sqlmock.AnyArg(),
			fragment.ID,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
}

func expectFragmentUpdateSyncStatus(t *testing.T, mock sqlmock.Sqlmock, fragment *fragmodel.KnowledgeBaseFragment) {
	t.Helper()

	mock.ExpectExec(sqlContains("UpdateFragmentSyncStatus")).
		WithArgs(
			mustInt32Repo(t, int(fragment.SyncStatus)),
			mustInt32Repo(t, fragment.SyncTimes),
			fragment.SyncStatusMessage,
			sqlmock.AnyArg(),
			fragment.ID,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
}

func expectFragmentDeleteFlows(t *testing.T, mock sqlmock.Sqlmock, fragment *fragmodel.KnowledgeBaseFragment) {
	t.Helper()

	mock.ExpectExec(sqlPattern(`DELETE FROM magic_flow_knowledge_fragment
WHERE id = ?`)).
		WithArgs(fragment.ID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(sqlPattern(`DELETE FROM magic_flow_knowledge_fragment
WHERE knowledge_code = ?
  AND document_code = ?`)).
		WithArgs(fragment.KnowledgeCode, fragment.DocumentCode).
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectExec(sqlPattern(`DELETE FROM magic_flow_knowledge_fragment
WHERE knowledge_code = ?
  AND document_code IN (?,?)`)).
		WithArgs(fragment.KnowledgeCode, fragment.DocumentCode, "DOC2").
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectExec(sqlPattern(`DELETE FROM magic_flow_knowledge_fragment
WHERE knowledge_code = ?`)).
		WithArgs(fragment.KnowledgeCode).
		WillReturnResult(sqlmock.NewResult(0, 3))
}

func expectFragmentFindByIDs(mock sqlmock.Sqlmock, ids []int64, rowValues []driver.Value) {
	mock.ExpectQuery(sqlContains("FindFragmentsByIDs")).
		WithArgs(ids[0], ids[1]).
		WillReturnRows(sqlmock.NewRows(fragmentRowColumns()).AddRow(rowValues...))
}

func expectFragmentListWithFilters(t *testing.T, mock sqlmock.Sqlmock, rowValues []driver.Value) {
	t.Helper()

	mock.ExpectQuery(sqlContains("CountFragmentsByKnowledgeAndDocumentFiltered")).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	mock.ExpectQuery(sqlContains("ListFragmentsByKnowledgeAndDocumentFiltered")).
		WillReturnRows(sqlmock.NewRows(fragmentRowColumns()).AddRow(rowValues...))
}

func expectFragmentListByDocument(t *testing.T, mock sqlmock.Sqlmock, rowValues []driver.Value) {
	t.Helper()

	mock.ExpectQuery(sqlPattern(`SELECT COUNT(*)
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND knowledge_code = ?
  AND document_code = ?`)).
		WithArgs("KB1", "DOC1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	mock.ExpectQuery(sqlContains("ListFragmentsByKnowledgeAndDocument")).
		WithArgs("KB1", "DOC1", mustInt32Repo(t, 10), mustInt32Repo(t, 1)).
		WillReturnRows(sqlmock.NewRows(fragmentRowColumns()).AddRow(rowValues...))
}

func expectFragmentFindByPointIDs(mock sqlmock.Sqlmock, pointIDs []string, rowValues []driver.Value) {
	mock.ExpectQuery(sqlContains("FindFragmentsByPointIDs")).
		WithArgs(pointIDs[0], pointIDs[1]).
		WillReturnRows(sqlmock.NewRows(fragmentRowColumns()).AddRow(rowValues...))
}

func expectFragmentListByKnowledgeBase(t *testing.T, mock sqlmock.Sqlmock, rowValues []driver.Value) {
	t.Helper()

	mock.ExpectQuery(sqlContains("CountFragmentsByKnowledge")).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	mock.ExpectQuery(sqlContains("ListFragmentsByKnowledge")).
		WillReturnRows(sqlmock.NewRows(fragmentRowColumns()).AddRow(rowValues...))
}

func expectFragmentListByBusinessID(t *testing.T, mock sqlmock.Sqlmock, rowValues []driver.Value) {
	t.Helper()

	mock.ExpectQuery(sqlContains("CountFragmentsByKnowledgeAndBusinessID")).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	mock.ExpectQuery(sqlContains("ListFragmentsByKnowledgeAndBusinessID")).
		WillReturnRows(sqlmock.NewRows(fragmentRowColumns()).AddRow(rowValues...))
}

func expectFragmentListMissingDocumentCode(t *testing.T, mock sqlmock.Sqlmock, rowValues []driver.Value) {
	t.Helper()

	mock.ExpectQuery(sqlContains("ListActiveKnowledgeBaseCodesByOrganization")).
		WithArgs("ORG1").
		WillReturnRows(sqlmock.NewRows([]string{"code"}).AddRow("KB1").AddRow("KB2"))
	mock.ExpectQuery(sqlContains("ListFragmentsMissingDocumentCodeByKnowledge")).
		WithArgs("KB1", int64(0), mustInt32Repo(t, 10)).
		WillReturnRows(sqlmock.NewRows(fragmentRowColumns()).AddRow(rowValues...))
}

func expectFragmentListPendingSync(t *testing.T, mock sqlmock.Sqlmock, rowValues []driver.Value) {
	t.Helper()

	mock.ExpectQuery(sqlContains("ListPendingFragments")).
		WithArgs(
			"KB1",
			mustInt32Repo(t, int(shared.SyncStatusPending)),
			mustInt32Repo(t, int(shared.SyncStatusSyncFailed)),
			mustInt32Repo(t, 5),
		).
		WillReturnRows(sqlmock.NewRows(fragmentRowColumns()).AddRow(rowValues...))
}

func expectFragmentCountStatsByKnowledgeBase(
	t *testing.T,
	mock sqlmock.Sqlmock,
	knowledgeCode string,
	total int64,
	syncedV2 int64,
	syncedV1 int64,
) {
	t.Helper()

	mock.ExpectQuery(sqlPattern(`
SELECT
	COUNT(*) AS fragment_count,
	COALESCE(SUM(CASE WHEN sync_status = ? THEN 1 ELSE 0 END), 0) AS synced_v2_count,
	COALESCE(SUM(CASE WHEN sync_status = ? THEN 1 ELSE 0 END), 0) AS synced_v1_count
FROM magic_flow_knowledge_fragment
WHERE knowledge_code = ?
  AND deleted_at IS NULL`)).
		WithArgs(mustInt32Repo(t, int(shared.SyncStatusSynced)), mustInt32Repo(t, 2), knowledgeCode).
		WillReturnRows(
			sqlmock.NewRows([]string{"fragment_count", "synced_v2_count", "synced_v1_count"}).
				AddRow(total, syncedV2, syncedV1),
		)
}

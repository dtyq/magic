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
)

const testFragmentPointID = "point-1"

func sqlPattern(query string) string {
	return `(?s)(?:-- name: .*?\n)?` + regexp.QuoteMeta(strings.TrimSpace(query))
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

	expectFragmentQuery(mock, `SELECT id, knowledge_code, document_code, content,`, []driver.Value{int64(1)}, rowValues)
	expectFragmentFindByPointID(t, mock, rowValues)
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
	if _, err := repo.FindByPointID(context.Background(), "KB1", "DOC1", testFragmentPointID); err != nil {
		t.Fatalf("FindByPointID returned error: %v", err)
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

func TestFragmentRepositoryListContextByDocuments(t *testing.T) {
	t.Parallel()

	testCtx := newFragmentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	rowValues := sampleFragmentRowValues(t)
	expectFragmentListContextByDocuments(t, mock, rowValues)

	grouped, err := repo.ListContextByDocuments(context.Background(), []fragmodel.DocumentKey{
		{KnowledgeCode: "KB1", DocumentCode: "DOC1"},
		{KnowledgeCode: "KB1", DocumentCode: "DOC1"},
		{KnowledgeCode: "KB1", DocumentCode: "DOC2"},
	}, 128)
	if err != nil {
		t.Fatalf("ListContextByDocuments returned error: %v", err)
	}
	if len(grouped) != 1 {
		t.Fatalf("expected grouped result for one mocked document, got %#v", grouped)
	}
	if fragments := grouped[fragmodel.DocumentKey{KnowledgeCode: "KB1", DocumentCode: "DOC1"}]; len(fragments) != 1 {
		t.Fatalf("expected one fragment for DOC1, got %#v", fragments)
	}

	assertFragmentMockExpectations(t, mock)
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

func TestFragmentRepositoryListThirdFileRepairOrganizationCodes(t *testing.T) {
	t.Parallel()

	testCtx := newFragmentRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock

	mock.ExpectQuery(sqlPattern(`SELECT DISTINCT kb.organization_code
FROM magic_flow_knowledge_fragment AS f
INNER JOIN magic_flow_knowledge AS kb
	ON kb.code = f.knowledge_code
	AND kb.deleted_at IS NULL
WHERE f.deleted_at IS NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(f.metadata, '$.file_id')) <> ''
ORDER BY kb.organization_code ASC`)).
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
		"id", "knowledge_code", "document_code", "content", "metadata", "business_id",
		"sync_status", "sync_times", "sync_status_message", "point_id", "word_count",
		"created_uid", "updated_uid", "created_at", "updated_at", "deleted_at",
	}
}

func sampleFragmentRowValues(t *testing.T) []driver.Value {
	t.Helper()

	now := time.Date(2026, 3, 11, 11, 0, 0, 0, time.Local)
	metadata, err := json.Marshal(map[string]any{"section_title": "Intro"})
	if err != nil {
		t.Fatalf("marshal fragment metadata: %v", err)
	}
	return []driver.Value{
		int64(1), "KB1", "DOC1", "hello world", metadata, "BIZ1",
		mustInt32Repo(t, int(shared.SyncStatusSynced)), mustInt32Repo(t, 1), "ok", testFragmentPointID, mustUint64Repo(t, 11),
		"U1", "U1", now, now,
		sql.NullTime{},
	}
}

func expectFragmentQuery(mock sqlmock.Sqlmock, prefix string, args, rowValues []driver.Value) {
	mock.ExpectQuery(sqlPattern(prefix)).
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

	mock.ExpectExec(sqlPattern(`UPDATE magic_flow_knowledge_fragment
SET content = ?,
    metadata = ?,
    point_id = ?,
    word_count = ?,
    updated_uid = ?,
    updated_at = ?
WHERE id = ?
  AND deleted_at IS NULL`)).
		WithArgs(
			fragment.Content,
			sqlmock.AnyArg(),
			fragment.PointID,
			mustUint64Repo(t, fragment.WordCount),
			fragment.UpdatedUID,
			sqlmock.AnyArg(),
			fragment.ID,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
}

func expectFragmentUpdateSyncStatus(t *testing.T, mock sqlmock.Sqlmock, fragment *fragmodel.KnowledgeBaseFragment) {
	t.Helper()

	mock.ExpectExec(sqlPattern(`UPDATE magic_flow_knowledge_fragment
SET sync_status = ?,
    sync_times = ?,
    sync_status_message = ?,
    updated_at = ?
WHERE id = ?
  AND deleted_at IS NULL`)).
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
WHERE knowledge_code = ?`)).
		WithArgs(fragment.KnowledgeCode).
		WillReturnResult(sqlmock.NewResult(0, 3))
}

func expectFragmentFindByIDs(mock sqlmock.Sqlmock, ids []int64, rowValues []driver.Value) {
	mock.ExpectQuery(sqlPattern(`SELECT
	id,
	knowledge_code,
	document_code,
	content,
	COALESCE(metadata, CAST('null' AS JSON)) AS metadata,
	business_id,
	sync_status,
	sync_times,
	sync_status_message,
	point_id,
	word_count,
	created_uid,
	updated_uid,
	created_at,
	updated_at,
	deleted_at
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND id IN (?,?)
ORDER BY id ASC`)).
		WithArgs(ids[0], ids[1]).
		WillReturnRows(sqlmock.NewRows(fragmentRowColumns()).AddRow(rowValues...))
}

func expectFragmentListWithFilters(t *testing.T, mock sqlmock.Sqlmock, rowValues []driver.Value) {
	t.Helper()

	countArgs := []driver.Value{
		"KB1",
		"KB1",
		"DOC1",
		"DOC1",
		nil,
		nil,
		"%hello%",
		"%hello%",
		mustInt32Repo(t, int(shared.SyncStatusSynced)),
		mustInt32Repo(t, int(shared.SyncStatusSynced)),
	}
	mock.ExpectQuery(sqlPattern(`SELECT COUNT(*)
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND (? IS NULL OR knowledge_code = ?)
  AND (? IS NULL OR document_code = ?)
  AND (? IS NULL OR business_id = ?)
  AND (? IS NULL OR content LIKE ?)
  AND (? IS NULL OR sync_status = ?)`)).
		WithArgs(countArgs...).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	listArgs := make([]driver.Value, 0, len(countArgs)+2)
	listArgs = append(listArgs, countArgs...)
	listArgs = append(listArgs, mustInt32Repo(t, 10), mustInt32Repo(t, 1))
	mock.ExpectQuery(sqlPattern(`SELECT id, knowledge_code, document_code, content,
       COALESCE(metadata, CAST('null' AS JSON)) AS metadata, business_id,
       sync_status, sync_times, sync_status_message, point_id, word_count,
       created_uid, updated_uid, created_at, updated_at, deleted_at
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND (? IS NULL OR knowledge_code = ?)
  AND (? IS NULL OR document_code = ?)
  AND (? IS NULL OR business_id = ?)
  AND (? IS NULL OR content LIKE ?)
  AND (? IS NULL OR sync_status = ?)
ORDER BY id ASC
LIMIT ? OFFSET ?`)).
		WithArgs(listArgs...).
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

	mock.ExpectQuery(sqlPattern(`SELECT id, knowledge_code, document_code, content,
       COALESCE(metadata, CAST('null' AS JSON)) AS metadata, business_id,
       sync_status, sync_times, sync_status_message, point_id, word_count,
       created_uid, updated_uid, created_at, updated_at, deleted_at
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND knowledge_code = ?
  AND document_code = ?
ORDER BY id ASC
LIMIT ? OFFSET ?`)).
		WithArgs("KB1", "DOC1", mustInt32Repo(t, 10), mustInt32Repo(t, 1)).
		WillReturnRows(sqlmock.NewRows(fragmentRowColumns()).AddRow(rowValues...))
}

func expectFragmentFindByPointID(t *testing.T, mock sqlmock.Sqlmock, rowValues []driver.Value) {
	t.Helper()

	mock.ExpectQuery(sqlPattern(`SELECT id,
	knowledge_code,
	COALESCE(document_code, '') AS document_code,
	content,
	COALESCE(metadata, CAST('null' AS JSON)) AS metadata,
	business_id,
	sync_status,
	sync_times,
	sync_status_message,
	point_id,
	word_count,
	created_uid,
	updated_uid,
	created_at,
	updated_at,
	deleted_at
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND knowledge_code = ?
  AND document_code = ?
ORDER BY id ASC`)).
		WithArgs("KB1", "DOC1").
		WillReturnRows(sqlmock.NewRows(fragmentRowColumns()).AddRow(rowValues...))
}

func expectFragmentListContextByDocuments(t *testing.T, mock sqlmock.Sqlmock, rowValues []driver.Value) {
	t.Helper()

	mock.ExpectQuery(sqlPattern(`SELECT
	id,
	knowledge_code,
	COALESCE(document_code, '') AS document_code,
	content,
	COALESCE(metadata, CAST('null' AS JSON)) AS metadata,
	business_id,
	sync_status,
	sync_times,
	sync_status_message,
	point_id,
	word_count,
	created_uid,
	updated_uid,
	created_at,
	updated_at,
	deleted_at
FROM (SELECT
		id,
		knowledge_code,
		document_code,
		content,
		metadata,
		business_id,
		sync_status,
		sync_times,
		sync_status_message,
		point_id,
		word_count,
		created_uid,
		updated_uid,
		created_at,
		updated_at,
		deleted_at,
		ROW_NUMBER() OVER (PARTITION BY document_code ORDER BY id ASC) AS rn
	FROM magic_flow_knowledge_fragment
	WHERE deleted_at IS NULL
	  AND knowledge_code = ?
	  AND document_code IN (?,?)) AS ranked
WHERE rn <= ?
ORDER BY document_code ASC, id ASC`)).
		WithArgs("KB1", "DOC1", "DOC2", 128).
		WillReturnRows(sqlmock.NewRows(fragmentRowColumns()).AddRow(rowValues...))
}

func expectFragmentListByKnowledgeBase(t *testing.T, mock sqlmock.Sqlmock, rowValues []driver.Value) {
	t.Helper()

	countArgs := []driver.Value{
		"KB1",
		"KB1",
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
	}
	mock.ExpectQuery(sqlPattern(`SELECT COUNT(*)
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND (? IS NULL OR knowledge_code = ?)
  AND (? IS NULL OR document_code = ?)
  AND (? IS NULL OR business_id = ?)
  AND (? IS NULL OR content LIKE ?)
  AND (? IS NULL OR sync_status = ?)`)).
		WithArgs(countArgs...).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	listArgs := make([]driver.Value, 0, len(countArgs)+2)
	listArgs = append(listArgs, countArgs...)
	listArgs = append(listArgs, mustInt32Repo(t, 10), mustInt32Repo(t, 1))
	mock.ExpectQuery(sqlPattern(`SELECT id, knowledge_code, document_code, content,
       COALESCE(metadata, CAST('null' AS JSON)) AS metadata, business_id,
       sync_status, sync_times, sync_status_message, point_id, word_count,
       created_uid, updated_uid, created_at, updated_at, deleted_at
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND (? IS NULL OR knowledge_code = ?)
  AND (? IS NULL OR document_code = ?)
  AND (? IS NULL OR business_id = ?)
  AND (? IS NULL OR content LIKE ?)
  AND (? IS NULL OR sync_status = ?)
ORDER BY id ASC
LIMIT ? OFFSET ?`)).
		WithArgs(listArgs...).
		WillReturnRows(sqlmock.NewRows(fragmentRowColumns()).AddRow(rowValues...))
}

func expectFragmentListByBusinessID(t *testing.T, mock sqlmock.Sqlmock, rowValues []driver.Value) {
	t.Helper()

	countArgs := []driver.Value{
		"KB1",
		"KB1",
		nil,
		nil,
		"BIZ1",
		"BIZ1",
		nil,
		nil,
		nil,
		nil,
	}
	mock.ExpectQuery(sqlPattern(`SELECT COUNT(*)
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND (? IS NULL OR knowledge_code = ?)
  AND (? IS NULL OR document_code = ?)
  AND (? IS NULL OR business_id = ?)
  AND (? IS NULL OR content LIKE ?)
  AND (? IS NULL OR sync_status = ?)`)).
		WithArgs(countArgs...).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	listArgs := make([]driver.Value, 0, len(countArgs)+2)
	listArgs = append(listArgs, countArgs...)
	listArgs = append(listArgs, mustInt32Repo(t, 10), mustInt32Repo(t, 1))
	mock.ExpectQuery(sqlPattern(`SELECT id, knowledge_code, document_code, content,
       COALESCE(metadata, CAST('null' AS JSON)) AS metadata, business_id,
       sync_status, sync_times, sync_status_message, point_id, word_count,
       created_uid, updated_uid, created_at, updated_at, deleted_at
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND (? IS NULL OR knowledge_code = ?)
  AND (? IS NULL OR document_code = ?)
  AND (? IS NULL OR business_id = ?)
  AND (? IS NULL OR content LIKE ?)
  AND (? IS NULL OR sync_status = ?)
ORDER BY id ASC
LIMIT ? OFFSET ?`)).
		WithArgs(listArgs...).
		WillReturnRows(sqlmock.NewRows(fragmentRowColumns()).AddRow(rowValues...))
}

func expectFragmentListMissingDocumentCode(t *testing.T, mock sqlmock.Sqlmock, rowValues []driver.Value) {
	t.Helper()

	mock.ExpectQuery(sqlPattern(`SELECT
	f.id,
	f.knowledge_code,
	COALESCE(f.document_code, '') AS document_code,
	f.content,
	COALESCE(f.metadata, CAST('null' AS JSON)) AS metadata,
	f.business_id,
	f.sync_status,
	f.sync_times,
	f.sync_status_message,
	f.point_id,
	f.word_count,
	f.created_uid,
	f.updated_uid,
	f.created_at,
	f.updated_at,
	f.deleted_at
FROM magic_flow_knowledge_fragment AS f
INNER JOIN magic_flow_knowledge AS kb
	ON kb.code = f.knowledge_code
	AND kb.deleted_at IS NULL
WHERE f.deleted_at IS NULL
  AND (f.document_code = '' OR f.document_code IS NULL)
  AND f.id > ?
  AND kb.organization_code = ?
  AND f.knowledge_code = ?
ORDER BY f.id ASC
LIMIT ?`)).
		WithArgs(int64(0), "ORG1", "KB1", mustInt32Repo(t, 10)).
		WillReturnRows(sqlmock.NewRows(fragmentRowColumns()).AddRow(rowValues...))
}

func expectFragmentListPendingSync(t *testing.T, mock sqlmock.Sqlmock, rowValues []driver.Value) {
	t.Helper()

	mock.ExpectQuery(sqlPattern(`SELECT id, knowledge_code, document_code, content,
       COALESCE(metadata, CAST('null' AS JSON)) AS metadata, business_id,
       sync_status, sync_times, sync_status_message, point_id, word_count,
       created_uid, updated_uid, created_at, updated_at, deleted_at
FROM magic_flow_knowledge_fragment
WHERE knowledge_code = ?
  AND sync_status IN (?, ?)
  AND deleted_at IS NULL
ORDER BY id ASC
LIMIT ?`)).
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

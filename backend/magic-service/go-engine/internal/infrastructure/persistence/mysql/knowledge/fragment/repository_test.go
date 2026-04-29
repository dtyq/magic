package fragmentrepo_test

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/shared"
	sharedentity "magic/internal/domain/knowledge/shared/entity"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	fragmentrepo "magic/internal/infrastructure/persistence/mysql/knowledge/fragment"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
)

func TestToFragmentFromListBackfillSectionFields(t *testing.T) {
	t.Parallel()
	metadata, err := json.Marshal(map[string]any{
		"document_name": "录音功能优化讨论.md",
		"section_path":  "录音功能优化讨论会议纪要 > 基本信息",
		"section_title": "基本信息",
		"section_level": 2,
		"chunk_index":   3,
	})
	if err != nil {
		t.Fatalf("marshal metadata: %v", err)
	}

	row := mysqlsqlc.MagicFlowKnowledgeFragment{
		ID:                1,
		KnowledgeCode:     "kb",
		DocumentCode:      "doc",
		Content:           "content",
		Metadata:          metadata,
		BusinessID:        "",
		SyncStatus:        0,
		SyncTimes:         0,
		SyncStatusMessage: "",
		PointID:           "point",
		WordCount:         10,
		CreatedUid:        "u1",
		UpdatedUid:        "u1",
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	fragment, err := fragmentrepo.ToFragmentFromListForTest(row)
	if err != nil {
		t.Fatalf("toFragmentFromList: %v", err)
	}
	if fragment.SectionPath != "录音功能优化讨论会议纪要 > 基本信息" {
		t.Fatalf("unexpected section path: %s", fragment.SectionPath)
	}
	if fragment.DocumentName != "录音功能优化讨论.md" {
		t.Fatalf("unexpected document name: %s", fragment.DocumentName)
	}
	if fragment.SectionTitle != "基本信息" {
		t.Fatalf("unexpected section title: %s", fragment.SectionTitle)
	}
	if fragment.SectionLevel != 2 {
		t.Fatalf("unexpected section level: %d", fragment.SectionLevel)
	}
	if fragment.ChunkIndex != 3 {
		t.Fatalf("unexpected chunk index: %d", fragment.ChunkIndex)
	}
}

func TestFragmentRepositorySaveBatchUsesSingleBulkInsert(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() {
		_ = db.Close()
	}()

	client := mysqlclient.NewSQLCClientWithDB(db, nil, false)
	repo := fragmentrepo.NewFragmentRepository(client, nil)

	first := fragmodel.NewFragment("kb", "doc", "first", map[string]any{"section_title": "A"}, "u1")
	first.PointID = "point-1"
	second := fragmodel.NewFragment("kb", "doc", "second", map[string]any{"section_title": "B"}, "u1")
	second.PointID = "point-2"

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO magic_flow_knowledge_fragment (
knowledge_code, document_code, content, metadata, business_id,
sync_status, sync_times, sync_status_message, point_id, word_count,
created_uid, updated_uid, created_at, updated_at
) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)).
		WillReturnResult(sqlmock.NewResult(41, 2))
	mock.ExpectCommit()

	if err := repo.SaveBatch(context.Background(), []*fragmodel.KnowledgeBaseFragment{first, second}); err != nil {
		t.Fatalf("SaveBatch: %v", err)
	}
	if first.ID != 41 {
		t.Fatalf("unexpected first fragment id: %d", first.ID)
	}
	if second.ID != 42 {
		t.Fatalf("unexpected second fragment id: %d", second.ID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestFragmentRepositoryUpdateSyncStatusBatchUsesSingleUpdate(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() {
		_ = db.Close()
	}()

	client := mysqlclient.NewSQLCClientWithDB(db, nil, false)
	repo := fragmentrepo.NewFragmentRepository(client, nil)

	now := time.Date(2026, 3, 10, 16, 0, 0, 0, time.Local)
	first := &fragmodel.KnowledgeBaseFragment{ID: 101, SyncStatus: sharedentity.SyncStatusSynced, UpdatedAt: now}
	second := &fragmodel.KnowledgeBaseFragment{ID: 102, SyncStatus: sharedentity.SyncStatusSynced, UpdatedAt: now}

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE magic_flow_knowledge_fragment
SET sync_status = ?,
    sync_times = ?,
    sync_status_message = ?,
    updated_at = ?
WHERE id = ?
  AND deleted_at IS NULL`)).
		WithArgs(int32(shared.SyncStatusSynced), int32(0), "", now, int64(101)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE magic_flow_knowledge_fragment
SET sync_status = ?,
    sync_times = ?,
    sync_status_message = ?,
    updated_at = ?
WHERE id = ?
  AND deleted_at IS NULL`)).
		WithArgs(int32(shared.SyncStatusSynced), int32(0), "", now, int64(102)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	if err := repo.UpdateSyncStatusBatch(context.Background(), []*fragmodel.KnowledgeBaseFragment{first, second}); err != nil {
		t.Fatalf("UpdateSyncStatusBatch: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestFragmentRepositoryUpdateBatchUsesSingleBulkUpdate(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() {
		_ = db.Close()
	}()

	client := mysqlclient.NewSQLCClientWithDB(db, nil, false)
	repo := fragmentrepo.NewFragmentRepository(client, nil)

	first := fragmodel.NewFragment("kb", "doc", "first", map[string]any{"section_title": "A"}, "u1")
	first.ID = 11
	first.PointID = "point-1"
	first.SyncStatus = sharedentity.SyncStatusPending

	second := fragmodel.NewFragment("kb", "doc", "second", map[string]any{"section_title": "B"}, "u2")
	second.ID = 12
	second.PointID = "point-2"
	second.SyncStatus = sharedentity.SyncStatusPending

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE magic_flow_knowledge_fragment
SET content = ?,
    metadata = ?,
    point_id = ?,
    word_count = ?,
    sync_status = ?,
    sync_times = ?,
    sync_status_message = ?,
    updated_uid = ?,
    updated_at = ?
WHERE id = ?
  AND deleted_at IS NULL`)).
		WithArgs("first", sqlmock.AnyArg(), "point-1", mustUint64Repo(t, first.WordCount), int32(shared.SyncStatusPending), int32(0), "", "u1", sqlmock.AnyArg(), int64(11)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE magic_flow_knowledge_fragment
SET content = ?,
    metadata = ?,
    point_id = ?,
    word_count = ?,
    sync_status = ?,
    sync_times = ?,
    sync_status_message = ?,
    updated_uid = ?,
    updated_at = ?
WHERE id = ?
  AND deleted_at IS NULL`)).
		WithArgs("second", sqlmock.AnyArg(), "point-2", mustUint64Repo(t, second.WordCount), int32(shared.SyncStatusPending), int32(0), "", "u2", sqlmock.AnyArg(), int64(12)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	if err := repo.UpdateBatch(context.Background(), []*fragmodel.KnowledgeBaseFragment{first, second}); err != nil {
		t.Fatalf("UpdateBatch: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestFragmentRepositoryDeleteByIDsUsesSingleDelete(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() {
		_ = db.Close()
	}()

	client := mysqlclient.NewSQLCClientWithDB(db, nil, false)
	repo := fragmentrepo.NewFragmentRepository(client, nil)

	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM magic_flow_knowledge_fragment
WHERE id IN (?,?)`)).
		WithArgs(int64(11), int64(12)).
		WillReturnResult(sqlmock.NewResult(0, 2))

	if err := repo.DeleteByIDs(context.Background(), []int64{11, 12}); err != nil {
		t.Fatalf("DeleteByIDs: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestFragmentRepositorySaveRejectsEmptyDocumentCode(t *testing.T) {
	t.Parallel()

	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() {
		_ = db.Close()
	}()

	client := mysqlclient.NewSQLCClientWithDB(db, nil, false)
	repo := fragmentrepo.NewFragmentRepository(client, nil)

	err = repo.Save(context.Background(), fragmodel.NewFragment("kb", "", "content", nil, "u1"))
	if !errors.Is(err, shared.ErrFragmentDocumentCodeRequired) {
		t.Fatalf("expected ErrFragmentDocumentCodeRequired, got %v", err)
	}
}

func TestFragmentRepositorySaveBatchRejectsEmptyDocumentCode(t *testing.T) {
	t.Parallel()

	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() {
		_ = db.Close()
	}()

	client := mysqlclient.NewSQLCClientWithDB(db, nil, false)
	repo := fragmentrepo.NewFragmentRepository(client, nil)

	fragments := []*fragmodel.KnowledgeBaseFragment{
		fragmodel.NewFragment("kb", "doc-1", "first", nil, "u1"),
		fragmodel.NewFragment("kb", "", "second", nil, "u1"),
	}
	err = repo.SaveBatch(context.Background(), fragments)
	if !errors.Is(err, shared.ErrFragmentDocumentCodeRequired) {
		t.Fatalf("expected ErrFragmentDocumentCodeRequired, got %v", err)
	}
}

func TestFragmentRepositorySaveBatchRejectsInvalidUTF8Content(t *testing.T) {
	t.Parallel()

	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() {
		_ = db.Close()
	}()

	client := mysqlclient.NewSQLCClientWithDB(db, nil, false)
	repo := fragmentrepo.NewFragmentRepository(client, nil)

	fragments := []*fragmodel.KnowledgeBaseFragment{
		fragmodel.NewFragment("kb", "doc-1", "first", nil, "u1"),
		fragmodel.NewFragment("kb", "doc-1", string([]byte{0xE8, 0x86}), nil, "u1"),
	}
	err = repo.SaveBatch(context.Background(), fragments)
	if err == nil || !strings.Contains(err.Error(), "invalid utf-8") {
		t.Fatalf("expected invalid utf-8 error, got %v", err)
	}
}

func TestFragmentRepositoryUpdateBatchRejectsInvalidUTF8Content(t *testing.T) {
	t.Parallel()

	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() {
		_ = db.Close()
	}()

	client := mysqlclient.NewSQLCClientWithDB(db, nil, false)
	repo := fragmentrepo.NewFragmentRepository(client, nil)

	fragment := fragmodel.NewFragment("kb", "doc-1", string([]byte{0xE8, 0x86}), nil, "u1")
	fragment.ID = 11

	err = repo.UpdateBatch(context.Background(), []*fragmodel.KnowledgeBaseFragment{fragment})
	if err == nil || !strings.Contains(err.Error(), "invalid utf-8") {
		t.Fatalf("expected invalid utf-8 error, got %v", err)
	}
}

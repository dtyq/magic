package sourcebindingrepo_test

import (
	"context"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"

	sourcebindingentity "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingrepository "magic/internal/domain/knowledge/sourcebinding/repository"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	sourcebindingrepo "magic/internal/infrastructure/persistence/mysql/knowledge/sourcebinding"
)

func TestRepositoryListBindingsByKnowledgeBaseAcceptsEmptyShapeSyncConfig(t *testing.T) {
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

			db, mock, err := sqlmock.New()
			if err != nil {
				t.Fatalf("sqlmock.New: %v", err)
			}
			defer func() { _ = db.Close() }()

			repo := sourcebindingrepo.NewRepository(mysqlclient.NewSQLCClientWithDB(db, nil, false))
			now := time.Date(2026, 4, 20, 15, 0, 0, 0, time.Local)

			mock.ExpectQuery(regexp.QuoteMeta("-- name: ListKnowledgeSourceBindingsCoreByKnowledgeBase :many")).
				WithArgs("KB1").
				WillReturnRows(sqlmock.NewRows(sourceBindingRowColumns()).AddRow(
					int64(1),
					"ORG1",
					"KB1",
					"project",
					"project",
					"1001",
					"manual",
					tc.payload,
					true,
					"U1",
					"U1",
					now,
					now,
				))
			mock.ExpectQuery(regexp.QuoteMeta("-- name: ListKnowledgeSourceBindingTargetsByBindingIDs :many")).
				WithArgs(int64(1)).
				WillReturnRows(sqlmock.NewRows(sourceBindingTargetRowColumns()))

			bindings, err := repo.ListBindingsByKnowledgeBase(context.Background(), "KB1")
			if err != nil {
				t.Fatalf("ListBindingsByKnowledgeBase returned error: %v", err)
			}
			if len(bindings) != 1 {
				t.Fatalf("expected 1 binding, got %d", len(bindings))
			}
			if len(bindings[0].SyncConfig) != 0 {
				t.Fatalf("expected empty sync config, got %#v", bindings[0].SyncConfig)
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatalf("unmet expectations: %v", err)
			}
		})
	}
}

func TestRepositoryListRealtimeProjectBindingsByProjectAcceptsNullSyncConfig(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := sourcebindingrepo.NewRepository(mysqlclient.NewSQLCClientWithDB(db, nil, false))
	now := time.Date(2026, 4, 20, 15, 30, 0, 0, time.Local)

	mock.ExpectQuery(regexp.QuoteMeta("-- name: ListRealtimeProjectSourceBindingsCoreByProject :many")).
		WithArgs("ORG1", "1001").
		WillReturnRows(sqlmock.NewRows(sourceBindingRowColumns()).AddRow(
			int64(2),
			"ORG1",
			"KB1",
			"project",
			"project",
			"1001",
			"realtime",
			nil,
			true,
			"U1",
			"U1",
			now,
			now,
		))
	mock.ExpectQuery(regexp.QuoteMeta("-- name: ListKnowledgeSourceBindingTargetsByBindingIDs :many")).
		WithArgs(int64(2)).
		WillReturnRows(sqlmock.NewRows(sourceBindingTargetRowColumns()))

	bindings, err := repo.ListRealtimeProjectBindingsByProject(context.Background(), "ORG1", 1001)
	if err != nil {
		t.Fatalf("ListRealtimeProjectBindingsByProject returned error: %v", err)
	}
	if len(bindings) != 1 || len(bindings[0].SyncConfig) != 0 {
		t.Fatalf("unexpected bindings: %#v", bindings)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRepositoryListRealtimeTeamshareBindingsByKnowledgeBaseLoadsTargets(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := sourcebindingrepo.NewRepository(mysqlclient.NewSQLCClientWithDB(db, nil, false))
	now := time.Date(2026, 4, 20, 15, 35, 0, 0, time.Local)

	mock.ExpectQuery(regexp.QuoteMeta("-- name: ListRealtimeTeamshareSourceBindingsCoreByKnowledgeBase :many")).
		WithArgs("ORG1", "teamshare", "KB-TS").
		WillReturnRows(sqlmock.NewRows(sourceBindingRowColumns()).AddRow(
			int64(3),
			"ORG1",
			"KB1",
			"teamshare",
			"knowledge_base",
			"KB-TS",
			"realtime",
			nil,
			true,
			"U1",
			"U1",
			now,
			now,
		))
	mock.ExpectQuery(regexp.QuoteMeta("-- name: ListKnowledgeSourceBindingTargetsByBindingIDs :many")).
		WithArgs(int64(3)).
		WillReturnRows(sqlmock.NewRows(sourceBindingTargetRowColumns()).AddRow(
			int64(31),
			int64(3),
			"folder",
			"FOLDER-1",
			now,
			now,
		))

	bindings, err := repo.ListRealtimeTeamshareBindingsByKnowledgeBase(context.Background(), "ORG1", "teamshare", "KB-TS")
	if err != nil {
		t.Fatalf("ListRealtimeTeamshareBindingsByKnowledgeBase returned error: %v", err)
	}
	if len(bindings) != 1 || len(bindings[0].Targets) != 1 {
		t.Fatalf("unexpected bindings: %#v", bindings)
	}
	if bindings[0].Targets[0].TargetType != sourcebindingentity.TargetTypeFolder || bindings[0].Targets[0].TargetRef != "FOLDER-1" {
		t.Fatalf("unexpected target: %#v", bindings[0].Targets[0])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRepositoryHasRealtimeProjectBindingForFileCalculatesTargetsInGo(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 4, 20, 15, 45, 0, 0, time.Local)
	tests := []sourceBindingFileGateCase{
		{
			name:        "whole project binding allows file",
			bindingID:   11,
			syncMode:    "realtime",
			enabled:     true,
			wantAllowed: true,
		},
		{
			name:        "explicit file target allows file",
			bindingID:   12,
			syncMode:    "realtime",
			enabled:     true,
			targetType:  "file",
			targetRef:   "9001",
			wantAllowed: true,
		},
		{
			name:        "non file target does not allow file",
			bindingID:   13,
			syncMode:    "realtime",
			enabled:     true,
			targetType:  "directory",
			targetRef:   "9001",
			wantAllowed: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			runHasRealtimeProjectBindingForFileCase(t, tt, now)
		})
	}
}

type sourceBindingFileGateCase struct {
	name        string
	bindingID   int64
	syncMode    string
	enabled     bool
	targetType  string
	targetRef   string
	wantAllowed bool
}

func runHasRealtimeProjectBindingForFileCase(
	t *testing.T,
	tt sourceBindingFileGateCase,
	now time.Time,
) {
	t.Helper()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := sourcebindingrepo.NewRepository(mysqlclient.NewSQLCClientWithDB(db, nil, false))
	expectRealtimeProjectBindingCandidate(mock, tt, now)
	expectSourceBindingTargetsForFileGate(mock, tt, now)

	got, err := repo.HasRealtimeProjectBindingForFile(context.Background(), "ORG1", 1001, 9001)
	if err != nil {
		t.Fatalf("HasRealtimeProjectBindingForFile returned error: %v", err)
	}
	if got != tt.wantAllowed {
		t.Fatalf("HasRealtimeProjectBindingForFile=%v, want %v", got, tt.wantAllowed)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func expectRealtimeProjectBindingCandidate(
	mock sqlmock.Sqlmock,
	tt sourceBindingFileGateCase,
	now time.Time,
) {
	mock.ExpectQuery(regexp.QuoteMeta("-- name: ListRealtimeProjectSourceBindingsCoreByProject :many")).
		WithArgs("ORG1", "1001").
		WillReturnRows(sqlmock.NewRows(sourceBindingRowColumns()).AddRow(
			tt.bindingID,
			"ORG1",
			"KB1",
			"project",
			"project",
			"1001",
			tt.syncMode,
			nil,
			tt.enabled,
			"U1",
			"U1",
			now,
			now,
		))
}

func expectSourceBindingTargetsForFileGate(
	mock sqlmock.Sqlmock,
	tt sourceBindingFileGateCase,
	now time.Time,
) {
	targetRows := sqlmock.NewRows(sourceBindingTargetRowColumns())
	if tt.targetType != "" {
		targetRows.AddRow(100+tt.bindingID, tt.bindingID, tt.targetType, tt.targetRef, now, now)
	}
	mock.ExpectQuery(regexp.QuoteMeta("-- name: ListKnowledgeSourceBindingTargetsByBindingIDs :many")).
		WithArgs(tt.bindingID).
		WillReturnRows(targetRows)
}

func TestRepositoryListBindingsByKnowledgeBases(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := sourcebindingrepo.NewRepository(mysqlclient.NewSQLCClientWithDB(db, nil, false))
	now := time.Date(2026, 4, 20, 16, 0, 0, 0, time.Local)

	mock.ExpectQuery(regexp.QuoteMeta("-- name: ListKnowledgeSourceBindingsCoreByKnowledgeBases :many")).
		WithArgs("KB1", "KB2").
		WillReturnRows(sqlmock.NewRows(sourceBindingRowColumns()).
			AddRow(int64(1), "ORG1", "KB1", "project", "project", "1001", "manual", nil, true, "U1", "U1", now, now).
			AddRow(int64(2), "ORG1", "KB2", "project", "project", "1002", "manual", nil, true, "U1", "U1", now, now))
	mock.ExpectQuery(regexp.QuoteMeta("-- name: ListKnowledgeSourceBindingTargetsByBindingIDs :many")).
		WithArgs(int64(1), int64(2)).
		WillReturnRows(sqlmock.NewRows(sourceBindingTargetRowColumns()))

	got, err := repo.ListBindingsByKnowledgeBases(context.Background(), []string{"KB1", "KB2", "KB1"})
	if err != nil {
		t.Fatalf("ListBindingsByKnowledgeBases() error = %v", err)
	}
	if len(got["KB1"]) != 1 || got["KB1"][0].RootRef != "1001" {
		t.Fatalf("unexpected KB1 bindings: %#v", got["KB1"])
	}
	if len(got["KB2"]) != 1 || got["KB2"][0].RootRef != "1002" {
		t.Fatalf("unexpected KB2 bindings: %#v", got["KB2"])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRepositoryApplyKnowledgeBaseBindings(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := sourcebindingrepo.NewRepository(mysqlclient.NewSQLCClientWithDB(db, nil, false))
	expectApplyKnowledgeBaseBindings(mock)

	saved, err := repo.ApplyKnowledgeBaseBindings(context.Background(), newApplyKnowledgeBaseBindingsInput())
	if err != nil {
		t.Fatalf("ApplyKnowledgeBaseBindings returned error: %v", err)
	}
	if len(saved) != 2 || saved[0].ID != 11 || saved[1].ID != 77 {
		t.Fatalf("unexpected saved bindings: %#v", saved)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRepositoryDeleteBindingsByKnowledgeBaseUsesJoinDelete(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := sourcebindingrepo.NewRepository(mysqlclient.NewSQLCClientWithDB(db, nil, false))

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("-- name: DeleteSourceBindingTargetsByKnowledgeBase :execrows")).
		WithArgs("KB1").
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectExec(regexp.QuoteMeta("-- name: DeleteSourceBindingItemsByKnowledgeBase :execrows")).
		WithArgs("KB1").
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectExec(regexp.QuoteMeta("-- name: DeleteSourceBindingsByKnowledgeBase :execrows")).
		WithArgs("KB1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	if err := repo.DeleteBindingsByKnowledgeBase(context.Background(), "KB1"); err != nil {
		t.Fatalf("DeleteBindingsByKnowledgeBase returned error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRepositoryUpsertSourceItemsUsesGroupedRefQueries(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := sourcebindingrepo.NewRepository(mysqlclient.NewSQLCClientWithDB(db, nil, false))
	now := time.Date(2026, 4, 21, 10, 0, 0, 0, time.Local)

	mock.ExpectExec(regexp.QuoteMeta("-- name: UpsertKnowledgeSourceItemsBatch3 :execrows")).
		WithArgs(
			"ORG1", "project", "project", "300", "", "file", "42", "keep-42.md", "md", "", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			"ORG2", "teamshare", "wiki", "TS-KB-1", "", "file", "TS-1", "teamshare-1.md", "md", "", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			"ORG1", "project", "project", "300", "", "file", "43", "new-43.md", "md", "", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(0, 3))
	mock.ExpectQuery(regexp.QuoteMeta("-- name: ListKnowledgeSourceItemsByOrganizationAndProviderAndItemRefs :many")).
		WithArgs("ORG1", "project", "42", "43").
		WillReturnRows(sqlmock.NewRows(sourceItemRowColumns()).
			AddRow(int64(101), "ORG1", "project", "project", "300", "", "file", "42", "keep-42.md", "md", "", nil, nil, now, now).
			AddRow(int64(102), "ORG1", "project", "project", "300", "", "file", "43", "new-43.md", "md", "", nil, nil, now, now))
	mock.ExpectQuery(regexp.QuoteMeta("-- name: ListKnowledgeSourceItemsByOrganizationAndProviderAndItemRefs :many")).
		WithArgs("ORG2", "teamshare", "TS-1").
		WillReturnRows(sqlmock.NewRows(sourceItemRowColumns()).
			AddRow(int64(201), "ORG2", "teamshare", "wiki", "TS-KB-1", "", "file", "TS-1", "teamshare-1.md", "md", "", nil, nil, now, now))

	items, err := repo.UpsertSourceItems(context.Background(), []sourcebindingentity.SourceItem{
		{
			OrganizationCode: "ORG1",
			Provider:         "project",
			RootType:         "project",
			RootRef:          "300",
			ItemType:         "file",
			ItemRef:          "42",
			DisplayName:      "keep-42.md",
			Extension:        "md",
		},
		{
			OrganizationCode: "ORG2",
			Provider:         "teamshare",
			RootType:         "wiki",
			RootRef:          "TS-KB-1",
			ItemType:         "file",
			ItemRef:          "TS-1",
			DisplayName:      "teamshare-1.md",
			Extension:        "md",
		},
		{
			OrganizationCode: "ORG1",
			Provider:         "project",
			RootType:         "project",
			RootRef:          "300",
			ItemType:         "file",
			ItemRef:          "43",
			DisplayName:      "new-43.md",
			Extension:        "md",
		},
	})
	if err != nil {
		t.Fatalf("UpsertSourceItems returned error: %v", err)
	}
	if len(items) != 3 || items[0].ID != 101 || items[1].ID != 201 || items[2].ID != 102 {
		t.Fatalf("unexpected upserted items: %#v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func sourceBindingRowColumns() []string {
	return []string{
		"id", "organization_code", "knowledge_base_code", "provider", "root_type", "root_ref",
		"sync_mode", "sync_config", "enabled", "created_uid", "updated_uid", "created_at", "updated_at",
	}
}

func sourceBindingTargetRowColumns() []string {
	return []string{"id", "binding_id", "target_type", "target_ref", "created_at", "updated_at"}
}

func sourceItemRowColumns() []string {
	return []string{
		"id", "organization_code", "provider", "root_type", "root_ref", "group_ref", "item_type", "item_ref",
		"display_name", "extension", "content_hash", "snapshot_meta", "last_resolved_at", "created_at", "updated_at",
	}
}

func expectApplyKnowledgeBaseBindings(mock sqlmock.Sqlmock) {
	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("-- name: DeleteSourceBindingTargetsByBindingIDs :execrows")).
		WithArgs(int64(9)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(regexp.QuoteMeta("-- name: DeleteSourceBindingItemsByBindingIDs :execrows")).
		WithArgs(int64(9)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(regexp.QuoteMeta("-- name: DeleteSourceBindingsByBindingIDs :execrows")).
		WithArgs(int64(9)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(regexp.QuoteMeta("-- name: UpsertKnowledgeSourceBindingsBatch2 :execrows")).
		WithArgs(
			"ORG1", "KB1", "project", "project", "1001", "manual", sqlmock.AnyArg(), true, "", "U2", sqlmock.AnyArg(), sqlmock.AnyArg(),
			"ORG1", "KB1", "project", "project", "1002", "manual", sqlmock.AnyArg(), true, "U2", "U2", sqlmock.AnyArg(), sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectQuery(regexp.QuoteMeta("-- name: ListKnowledgeSourceBindingsCoreByKnowledgeBase :many")).
		WithArgs("KB1").
		WillReturnRows(sqlmock.NewRows(sourceBindingRowColumns()).
			AddRow(11, "ORG1", "KB1", "project", "project", "1001", "manual", nil, true, "U1", "U2", time.Now(), time.Now()).
			AddRow(77, "ORG1", "KB1", "project", "project", "1002", "manual", nil, true, "U2", "U2", time.Now(), time.Now()))
	mock.ExpectExec(regexp.QuoteMeta("-- name: DeleteSourceBindingTargetsByBindingIDs :execrows")).
		WithArgs(int64(11), int64(77)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(regexp.QuoteMeta("-- name: DeleteSourceBindingItemsByBindingIDs :execrows")).
		WithArgs(int64(11), int64(77)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(regexp.QuoteMeta("-- name: InsertKnowledgeSourceBindingTargetsBatch2 :execrows")).
		WithArgs(
			int64(11), "file", "42", sqlmock.AnyArg(), sqlmock.AnyArg(),
			int64(77), "file", "43", sqlmock.AnyArg(), sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectExec(regexp.QuoteMeta("-- name: InsertKnowledgeSourceBindingItemsBatch2 :execrows")).
		WithArgs(
			int64(11), int64(101), "target", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			int64(77), int64(102), "target", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()
}

func newApplyKnowledgeBaseBindingsInput() sourcebindingrepository.ApplyKnowledgeBaseBindingsInput {
	updatedAt := time.Now()
	createdAt := time.Now()
	return sourcebindingrepository.ApplyKnowledgeBaseBindingsInput{
		KnowledgeBaseCode: "KB1",
		DeleteBindingIDs:  []int64{9},
		UpsertBindings: []sourcebindingrepository.ApplyKnowledgeBaseBinding{
			{
				Binding: sourcebindingentity.Binding{
					ID:                11,
					OrganizationCode:  "ORG1",
					KnowledgeBaseCode: "KB1",
					Provider:          "project",
					RootType:          "project",
					RootRef:           "1001",
					SyncMode:          "manual",
					Enabled:           true,
					UpdatedUID:        "U2",
					Targets:           []sourcebindingentity.BindingTarget{{TargetType: "file", TargetRef: "42"}},
				},
				Items: []sourcebindingentity.BindingItem{{SourceItemID: 101, ResolveReason: "target", LastResolvedAt: &updatedAt}},
			},
			{
				Binding: sourcebindingentity.Binding{
					OrganizationCode:  "ORG1",
					KnowledgeBaseCode: "KB1",
					Provider:          "project",
					RootType:          "project",
					RootRef:           "1002",
					SyncMode:          "manual",
					Enabled:           true,
					CreatedUID:        "U2",
					UpdatedUID:        "U2",
					Targets:           []sourcebindingentity.BindingTarget{{TargetType: "file", TargetRef: "43"}},
				},
				Items: []sourcebindingentity.BindingItem{{SourceItemID: 102, ResolveReason: "target", LastResolvedAt: &createdAt}},
			},
		},
	}
}

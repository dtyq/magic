package supermagicprojectrepo_test

import (
	"context"
	"reflect"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"

	projectrepository "magic/internal/domain/supermagicproject/repository"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	supermagicprojectrepo "magic/internal/infrastructure/persistence/mysql/supermagicproject"
)

func TestRepositoryListWorkspaceMappings(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := supermagicprojectrepo.NewRepository(mysqlclient.NewSQLCClientWithDB(db, nil, false))

	mock.ExpectQuery(regexp.QuoteMeta("-- name: ListSuperMagicProjectWorkspaceMappings :many")).
		WithArgs("ORG-1", int64(11), int64(22)).
		WillReturnRows(sqlmock.NewRows([]string{"id", "workspace_id"}).
			AddRow(int64(11), int64(101)).
			AddRow(int64(22), nil))

	got, err := repo.ListWorkspaceMappings(context.Background(), "ORG-1", []int64{11, 22})
	if err != nil {
		t.Fatalf("ListWorkspaceMappings() error = %v", err)
	}

	want := []projectrepository.ProjectWorkspaceMapping{
		{ProjectID: 11, WorkspaceID: 101},
	}
	if len(got) != len(want) || got[0] != want[0] {
		t.Fatalf("ListWorkspaceMappings() = %#v, want %#v", got, want)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRepositoryListSharedProjectIDs(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := supermagicprojectrepo.NewRepository(mysqlclient.NewSQLCClientWithDB(db, nil, false))

	mock.ExpectQuery(regexp.QuoteMeta("-- name: ListSuperMagicSharedProjectCandidates :many")).
		WithArgs("ORG-1", int64(11), int64(22), int64(33), int64(44), int64(55), int64(66), int64(77)).
		WillReturnRows(sqlmock.NewRows([]string{"id", "workspace_id", "is_collaboration_enabled"}).
			AddRow(int64(11), int64(101), int8(1)).
			AddRow(int64(22), int64(102), int8(1)).
			AddRow(int64(33), nil, int8(1)).
			AddRow(int64(44), int64(101), int8(0)).
			AddRow(int64(55), int64(103), int8(1)).
			AddRow(int64(66), int64(104), int8(1)).
			AddRow(int64(77), int64(105), int8(1)))

	mock.ExpectQuery(regexp.QuoteMeta("-- name: ListSuperMagicWorkspacesByIDs :many")).
		WithArgs(int64(101), int64(102), int64(103), int64(104), int64(105)).
		WillReturnRows(sqlmock.NewRows([]string{"id", "user_id"}).
			AddRow(int64(101), "OTHER-1").
			AddRow(int64(102), "USER-1").
			AddRow(int64(103), "OTHER-3").
			AddRow(int64(105), "OTHER-5"))

	mock.ExpectQuery(regexp.QuoteMeta("-- name: ListSuperMagicProjectMembersByProjectIDs :many")).
		WithArgs(int64(11), int64(55), int64(77)).
		WillReturnRows(sqlmock.NewRows([]string{"project_id", "organization_code", "status", "role", "deleted_at"}).
			AddRow(int64(11), "ORG-1", int8(1), "viewer", nil).
			AddRow(int64(11), "ORG-1", int8(1), "viewer", nil).
			AddRow(int64(55), "ORG-2", int8(1), "manage", nil).
			AddRow(int64(55), "ORG-1", int8(1), "editor", nil).
			AddRow(int64(77), "ORG-1", int8(0), "viewer", nil).
			AddRow(int64(77), "ORG-1", int8(1), "owner", nil).
			AddRow(int64(77), "ORG-1", int8(1), "manage", time.Date(2026, time.April, 27, 0, 0, 0, 0, time.UTC)))

	got, err := repo.ListSharedProjectIDs(
		context.Background(),
		"ORG-1",
		"USER-1",
		[]int64{11, 22, 33, 44, 55, 66, 77},
	)
	if err != nil {
		t.Fatalf("ListSharedProjectIDs() error = %v", err)
	}

	want := []int64{11, 55}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("ListSharedProjectIDs() = %#v, want %#v", got, want)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRepositoryListSharedProjectIDsNoCandidates(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := supermagicprojectrepo.NewRepository(mysqlclient.NewSQLCClientWithDB(db, nil, false))

	mock.ExpectQuery(regexp.QuoteMeta("-- name: ListSuperMagicSharedProjectCandidates :many")).
		WithArgs("ORG-1", int64(11), int64(22)).
		WillReturnRows(sqlmock.NewRows([]string{"id", "workspace_id", "is_collaboration_enabled"}).
			AddRow(int64(11), nil, int8(1)).
			AddRow(int64(22), int64(101), int8(0)))

	got, err := repo.ListSharedProjectIDs(context.Background(), "ORG-1", "USER-1", []int64{11, 22})
	if err != nil {
		t.Fatalf("ListSharedProjectIDs() error = %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected empty result, got %#v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRepositoryListSharedProjectIDsEmptyUserID(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	repo := supermagicprojectrepo.NewRepository(mysqlclient.NewSQLCClientWithDB(db, nil, false))

	got, err := repo.ListSharedProjectIDs(context.Background(), "ORG-1", " ", []int64{11})
	if err != nil {
		t.Fatalf("ListSharedProjectIDs() error = %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected empty result, got %#v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

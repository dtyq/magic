package projectfilemeta_test

import (
	"context"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"

	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	projectfilemeta "magic/internal/infrastructure/persistence/mysql/projectfilemeta"
)

func TestRepositoryListAncestorFolderIDsBuildsPathInGo(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	repo := projectfilemeta.NewRepository(mysqlclient.NewSQLCClientWithDB(db, nil, false))
	expectTaskFileParentLink(mock, 300, 99, int64(200), false, nil)
	expectTaskFileParentLinksByProject(mock, 99,
		taskFileParentLinkRow{fileID: 200, parentID: int64(150), isDirectory: true},
		taskFileParentLinkRow{fileID: 150, parentID: int64(100), isDirectory: false},
		taskFileParentLinkRow{fileID: 100, parentID: nil, isDirectory: true},
	)

	ids, err := repo.ListAncestorFolderIDs(context.Background(), 300)
	if err != nil {
		t.Fatalf("ListAncestorFolderIDs returned error: %v", err)
	}
	if len(ids) != 2 || ids[0] != 200 || ids[1] != 100 {
		t.Fatalf("unexpected ancestor ids: %#v", ids)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRepositoryListAncestorFolderIDsStopsAtDeletedAncestor(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	repo := projectfilemeta.NewRepository(mysqlclient.NewSQLCClientWithDB(db, nil, false))
	expectTaskFileParentLink(mock, 300, 99, int64(200), false, nil)
	expectTaskFileParentLinksByProject(mock, 99)

	ids, err := repo.ListAncestorFolderIDs(context.Background(), 300)
	if err != nil {
		t.Fatalf("ListAncestorFolderIDs returned error: %v", err)
	}
	if len(ids) != 0 {
		t.Fatalf("unexpected ancestor ids: %#v", ids)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

type taskFileParentLinkRow struct {
	fileID      uint64
	parentID    any
	isDirectory bool
}

func expectTaskFileParentLink(mock sqlmock.Sqlmock, fileID, projectID uint64, parentID any, isDirectory bool, deletedAt any) {
	mock.ExpectQuery(regexp.QuoteMeta("-- name: FindTaskFileParentLinkByID :one")).
		WithArgs(fileID).
		WillReturnRows(sqlmock.NewRows([]string{"file_id", "project_id", "parent_id", "is_directory", "deleted_at"}).
			AddRow(fileID, projectID, parentID, isDirectory, deletedAt))
}

func expectTaskFileParentLinksByProject(mock sqlmock.Sqlmock, projectID uint64, links ...taskFileParentLinkRow) {
	rows := sqlmock.NewRows([]string{"file_id", "parent_id", "is_directory"})
	for _, link := range links {
		rows.AddRow(link.fileID, link.parentID, link.isDirectory)
	}
	mock.ExpectQuery(regexp.QuoteMeta("-- name: ListTaskFileParentLinksByProjectID :many")).
		WithArgs(projectID).
		WillReturnRows(rows)
}

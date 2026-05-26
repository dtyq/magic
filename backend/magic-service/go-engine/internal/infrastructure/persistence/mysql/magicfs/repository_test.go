package magicfs_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"

	domainmagicfs "magic/internal/domain/magicfs"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqlmagicfs "magic/internal/infrastructure/persistence/mysql/magicfs"
)

func TestRepositoryGetMetadataVersion(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer closeMockDB(t, db, mock)

	repo := mysqlmagicfs.NewRepository(mysqlclient.NewSQLCClientWithDB(db, nil, false))
	mock.ExpectQuery("SELECT metadata_version").
		WithArgs(uint64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"metadata_version"}).AddRow(uint32(9)))

	version, err := repo.GetMetadataVersion(context.Background(), 42)
	if err != nil {
		t.Fatalf("GetMetadataVersion returned error: %v", err)
	}
	if version != 9 {
		t.Fatalf("expected version 9, got %d", version)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestRepositoryGetMetadataVersionNotFound(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer closeMockDB(t, db, mock)

	repo := mysqlmagicfs.NewRepository(mysqlclient.NewSQLCClientWithDB(db, nil, false))
	mock.ExpectQuery("SELECT metadata_version").
		WithArgs(uint64(42)).
		WillReturnError(sql.ErrNoRows)

	_, err = repo.GetMetadataVersion(context.Background(), 42)
	if !errors.Is(err, domainmagicfs.ErrFileNotFound) {
		t.Fatalf("expected ErrFileNotFound, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func closeMockDB(t *testing.T, db *sql.DB, mock sqlmock.Sqlmock) {
	t.Helper()

	mock.ExpectClose()
	if err := db.Close(); err != nil {
		t.Fatalf("db.Close: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

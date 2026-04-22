package mysql_test

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"

	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/persistence/mysql"
)

var (
	errMySQLExecBoom    = errors.New("exec boom")
	errMySQLPrepareBoom = errors.New("prepare boom")
	errMySQLQueryBoom   = errors.New("query boom")
	errMySQLExecFailed  = errors.New("exec failed")
	errMySQLQueryFailed = errors.New("query failed")
)

type mysqlTestContext struct {
	db     *sql.DB
	mock   sqlmock.Sqlmock
	logger *logging.SugaredLogger
}

func newMySQLTestContext(t *testing.T) mysqlTestContext {
	t.Helper()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	return mysqlTestContext{
		db:   db,
		mock: mock,
		logger: logging.NewFromConfig(autoloadcfg.LoggingConfig{
			Level:  autoloadcfg.LogLevel(slog.LevelDebug.String()),
			Format: autoloadcfg.LogFormatJSON,
		}),
	}
}

func TestDBLoggerOperations(t *testing.T) {
	t.Parallel()

	testCtx := newMySQLTestContext(t)
	dbLogger := mysql.NewDBLogger(testCtx.db, testCtx.logger)

	testCtx.mock.ExpectExec(regexp.QuoteMeta("UPDATE demo SET name = ? WHERE id = ?")).
		WithArgs("alice", 7).
		WillReturnResult(sqlmock.NewResult(0, 1))
	testCtx.mock.ExpectPrepare(regexp.QuoteMeta("SELECT 1"))
	testCtx.mock.ExpectQuery(regexp.QuoteMeta("SELECT id FROM demo WHERE id = ?")).
		WithArgs(7).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(7))
	testCtx.mock.ExpectQuery(regexp.QuoteMeta("SELECT id FROM demo WHERE id = ?")).
		WithArgs(9).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(9))

	if _, err := dbLogger.ExecContext(context.Background(), "UPDATE demo SET name = ? WHERE id = ?", "alice", 7); err != nil {
		t.Fatalf("ExecContext() error = %v", err)
	}
	stmt, err := dbLogger.PrepareContext(context.Background(), "SELECT 1")
	if err != nil {
		t.Fatalf("PrepareContext() error = %v", err)
	}
	defer func() {
		if closeErr := stmt.Close(); closeErr != nil {
			t.Fatalf("stmt.Close() error = %v", closeErr)
		}
	}()

	rows, err := dbLogger.QueryContext(context.Background(), "SELECT id FROM demo WHERE id = ?", 7)
	if err != nil {
		t.Fatalf("QueryContext() error = %v", err)
	}
	defer func() {
		_ = rows.Close()
	}()

	var queryID int
	if rows.Next() {
		if scanErr := rows.Scan(&queryID); scanErr != nil {
			t.Fatalf("rows.Scan() error = %v", scanErr)
		}
	}
	if queryID != 7 {
		t.Fatalf("unexpected query id: %d", queryID)
	}
	if rowsErr := rows.Err(); rowsErr != nil {
		t.Fatalf("rows.Err() error = %v", rowsErr)
	}

	row := dbLogger.QueryRowContext(context.Background(), "SELECT id FROM demo WHERE id = ?", 9)
	var rowID int
	if err := row.Scan(&rowID); err != nil {
		t.Fatalf("row.Scan() error = %v", err)
	}
	if rowID != 9 {
		t.Fatalf("unexpected row id: %d", rowID)
	}

	if err := testCtx.mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestDBLoggerErrorPaths(t *testing.T) {
	t.Parallel()

	testCtx := newMySQLTestContext(t)
	dbLogger := mysql.NewDBLogger(testCtx.db, testCtx.logger)

	testCtx.mock.ExpectExec(regexp.QuoteMeta("DELETE FROM demo WHERE id = ?")).
		WithArgs(7).
		WillReturnError(errMySQLExecBoom)
	testCtx.mock.ExpectPrepare(regexp.QuoteMeta("SELECT broken")).
		WillReturnError(errMySQLPrepareBoom)
	testCtx.mock.ExpectQuery(regexp.QuoteMeta("SELECT broken")).
		WillReturnError(errMySQLQueryBoom)

	if _, err := dbLogger.ExecContext(context.Background(), "DELETE FROM demo WHERE id = ?", 7); !errors.Is(err, errMySQLExecBoom) {
		t.Fatalf("expected wrapped exec error, got %v", err)
	}
	stmt, err := dbLogger.PrepareContext(context.Background(), "SELECT broken")
	if !errors.Is(err, errMySQLPrepareBoom) {
		t.Fatalf("expected wrapped prepare error, got %v", err)
	}
	if stmt != nil {
		defer func() {
			_ = stmt.Close()
		}()
	}
	rows, err := dbLogger.QueryContext(context.Background(), "SELECT broken")
	if !errors.Is(err, errMySQLQueryBoom) {
		t.Fatalf("expected wrapped query error, got %v", err)
	}
	if rows != nil {
		defer func() {
			_ = rows.Close()
		}()
		if rowsErr := rows.Err(); rowsErr != nil {
			t.Fatalf("rows.Err() error = %v", rowsErr)
		}
	}

	if err := testCtx.mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestSQLCClientWrappers(t *testing.T) {
	t.Parallel()

	testCtx := newMySQLTestContext(t)
	client := mysql.NewSQLCClientWithDB(testCtx.db, testCtx.logger, true)

	if client.DB() != testCtx.db {
		t.Fatal("DB() should return original db")
	}
	if client.Q() == nil {
		t.Fatal("Q() should not return nil")
	}
	if client.WithTx(nil) == nil {
		t.Fatal("WithTx(nil) should reuse base queries")
	}

	testCtx.mock.ExpectExec(regexp.QuoteMeta("UPDATE demo SET active = ? WHERE id = ?")).
		WithArgs(true, 1).
		WillReturnResult(sqlmock.NewResult(0, 1))
	testCtx.mock.ExpectQuery(regexp.QuoteMeta("SELECT id FROM demo WHERE id = ?")).
		WithArgs(1).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	testCtx.mock.ExpectQuery(regexp.QuoteMeta("SELECT id FROM demo WHERE id = ?")).
		WithArgs(2).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(2))
	testCtx.mock.ExpectBegin()
	testCtx.mock.ExpectExec(regexp.QuoteMeta("UPDATE demo SET active = ? WHERE id = ?")).
		WithArgs(false, 2).
		WillReturnResult(sqlmock.NewResult(0, 1))
	testCtx.mock.ExpectRollback()

	if _, err := client.ExecContext(context.Background(), "UPDATE demo SET active = ? WHERE id = ?", true, 1); err != nil {
		t.Fatalf("ExecContext() error = %v", err)
	}
	rows, err := client.QueryContext(context.Background(), "SELECT id FROM demo WHERE id = ?", 1)
	if err != nil {
		t.Fatalf("QueryContext() error = %v", err)
	}
	defer func() {
		_ = rows.Close()
	}()

	var queryID int
	if rows.Next() {
		if scanErr := rows.Scan(&queryID); scanErr != nil {
			t.Fatalf("rows.Scan() error = %v", scanErr)
		}
	}
	if queryID != 1 {
		t.Fatalf("unexpected query id: %d", queryID)
	}
	if rowsErr := rows.Err(); rowsErr != nil {
		t.Fatalf("rows.Err() error = %v", rowsErr)
	}

	var rowID int
	if err := client.QueryRowContext(context.Background(), "SELECT id FROM demo WHERE id = ?", 2).Scan(&rowID); err != nil {
		t.Fatalf("QueryRowContext().Scan() error = %v", err)
	}
	if rowID != 2 {
		t.Fatalf("unexpected row id: %d", rowID)
	}

	tx, err := testCtx.db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatalf("db.BeginTx() error = %v", err)
	}
	if client.WithTx(tx) == nil {
		t.Fatal("WithTx(tx) should not return nil")
	}
	if _, err := client.ExecTxContext(context.Background(), tx, "UPDATE demo SET active = ? WHERE id = ?", false, 2); err != nil {
		t.Fatalf("ExecTxContext() error = %v", err)
	}
	if rollbackErr := tx.Rollback(); rollbackErr != nil {
		t.Fatalf("tx.Rollback() error = %v", rollbackErr)
	}

	if err := testCtx.mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestSQLCClientErrorPathsAndClose(t *testing.T) {
	t.Parallel()

	testCtx := newMySQLTestContext(t)
	client := mysql.NewSQLCClientWithDB(testCtx.db, testCtx.logger, false)

	testCtx.mock.ExpectExec(regexp.QuoteMeta("DELETE FROM demo WHERE id = ?")).
		WithArgs(9).
		WillReturnError(errMySQLExecFailed)
	testCtx.mock.ExpectExec(regexp.QuoteMeta("DELETE FROM demo WHERE id = ?")).
		WithArgs(9).
		WillReturnError(errMySQLExecFailed)
	testCtx.mock.ExpectQuery(regexp.QuoteMeta("SELECT bad")).
		WillReturnError(errMySQLQueryFailed)

	if _, err := client.ExecContext(context.Background(), "DELETE FROM demo WHERE id = ?", 9); !errors.Is(err, errMySQLExecFailed) {
		t.Fatalf("expected wrapped exec error, got %v", err)
	}
	if _, err := client.ExecTxContext(context.Background(), nil, "DELETE FROM demo WHERE id = ?", 9); !errors.Is(err, errMySQLExecFailed) {
		t.Fatalf("expected wrapped exec tx error via fallback, got %v", err)
	}
	rows, err := client.QueryContext(context.Background(), "SELECT bad")
	if !errors.Is(err, errMySQLQueryFailed) {
		t.Fatalf("expected wrapped query error, got %v", err)
	}
	if rows != nil {
		defer func() {
			_ = rows.Close()
		}()
		if rowsErr := rows.Err(); rowsErr != nil {
			t.Fatalf("rows.Err() error = %v", rowsErr)
		}
	}
	testCtx.mock.ExpectClose()
	if err := client.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}

	if err := testCtx.mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

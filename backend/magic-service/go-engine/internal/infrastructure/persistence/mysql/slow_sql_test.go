package mysql_test

import (
	"bufio"
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"

	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/persistence/mysql"
)

func TestSQLCClientLogsSlowSQLWhenFullSQLLoggingDisabled(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error = %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	var logBuffer bytes.Buffer
	logger := logging.NewFromConfigWithWriter(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevel(slog.LevelInfo.String()),
		Format: autoloadcfg.LogFormatJSON,
	}, &logBuffer)
	client := mysql.NewSQLCClientWithDB(db, logger, false)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT id FROM demo WHERE id = ?")).
		WithArgs(7).
		WillDelayFor(8 * time.Millisecond).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(7))

	rows, err := client.QueryContext(context.Background(), "SELECT id FROM demo WHERE id = ?", 7)
	if err != nil {
		t.Fatalf("QueryContext() error = %v", err)
	}
	defer func() {
		_ = rows.Close()
	}()

	var id int
	if rows.Next() {
		if scanErr := rows.Scan(&id); scanErr != nil {
			t.Fatalf("rows.Scan() error = %v", scanErr)
		}
	}
	if id != 7 {
		t.Fatalf("unexpected id: %d", id)
	}
	if rowsErr := rows.Err(); rowsErr != nil {
		t.Fatalf("rows.Err() error = %v", rowsErr)
	}

	entries := decodeJSONLogEntries(t, &logBuffer)
	if len(entries) != 1 {
		t.Fatalf("expected 1 slow sql log entry, got %d: %s", len(entries), logBuffer.String())
	}

	entry := entries[0]
	msg, _ := entry["msg"].(string)
	if !strings.HasPrefix(msg, logging.PrefixEngineException("[mysql:")) || !strings.Contains(msg, "SELECT id FROM demo WHERE id = 7") {
		t.Fatalf("expected compact slow sql message, got %#v", entry["msg"])
	}
	if entry["op"] != "query" {
		t.Fatalf("expected op=query, got %#v", entry["op"])
	}
	if entry["slow_sql_threshold_ms"] != float64(5) {
		t.Fatalf("expected slow_sql_threshold_ms=5, got %#v", entry["slow_sql_threshold_ms"])
	}
	sqlRendered, _ := entry["sql"].(string)
	if !strings.Contains(sqlRendered, "SELECT id FROM demo WHERE id = 7") {
		t.Fatalf("expected rendered sql in log, got %q", sqlRendered)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestSQLCClientLogsFastSQLSummaryWhenFullSQLLoggingEnabled(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error = %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	var logBuffer bytes.Buffer
	logger := logging.NewFromConfigWithWriter(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevel(slog.LevelDebug.String()),
		Format: autoloadcfg.LogFormatJSON,
	}, &logBuffer)
	client := mysql.NewSQLCClientWithDB(db, logger, true)

	query := `-- name: FindDemo :one
SELECT demo.id, demo.code, demo.name, demo.description, demo.created_at
FROM demo
WHERE code = ?
ORDER BY id DESC
LIMIT 1`
	mock.ExpectQuery(regexp.QuoteMeta(query)).
		WithArgs("demo-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "code", "name", "description", "created_at"}).
			AddRow(1, "demo-1", "name", "desc", time.Date(2026, 4, 19, 11, 46, 8, 0, time.Local)))

	row := client.QueryRowContext(context.Background(), query, "demo-1")
	var (
		id          int64
		code        string
		name        string
		description string
		createdAt   time.Time
	)
	if err := row.Scan(&id, &code, &name, &description, &createdAt); err != nil {
		t.Fatalf("row.Scan() error = %v", err)
	}

	entries := decodeJSONLogEntries(t, &logBuffer)
	if len(entries) != 1 {
		t.Fatalf("expected 1 debug sql log entry, got %d: %s", len(entries), logBuffer.String())
	}

	entry := entries[0]
	msg, _ := entry["msg"].(string)
	if !strings.Contains(msg, buildFoldedSelectSummaryForSlowSQLTest("demo", " WHERE code = 'demo-1' ORDER BY id DESC LIMIT 1")) {
		t.Fatalf("expected folded summary sql in message, got %q", msg)
	}
	if _, ok := entry["sql"]; ok {
		t.Fatalf("expected no full sql field on fast success log, got %#v", entry["sql"])
	}
	if _, ok := entry["sql_template"]; ok {
		t.Fatalf("expected no sql_template on fast success log, got %#v", entry["sql_template"])
	}
	if _, ok := entry["sql_rendered"]; ok {
		t.Fatalf("expected no sql_rendered on fast success log, got %#v", entry["sql_rendered"])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestSQLCClientLogsQueryErrorWithFullSQL(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error = %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	var logBuffer bytes.Buffer
	logger := logging.NewFromConfigWithWriter(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevel(slog.LevelInfo.String()),
		Format: autoloadcfg.LogFormatJSON,
	}, &logBuffer)
	client := mysql.NewSQLCClientWithDB(db, logger, false)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT broken WHERE id = ?")).
		WithArgs(7).
		WillReturnError(errMySQLQueryFailed)

	rows, err := client.QueryContext(context.Background(), "SELECT broken WHERE id = ?", 7)
	if rows != nil {
		t.Cleanup(func() {
			_ = rows.Close()
		})
		if rowsErr := rows.Err(); rowsErr != nil && !errors.Is(rowsErr, errMySQLQueryFailed) {
			t.Fatalf("unexpected rows.Err(): %v", rowsErr)
		}
	}
	if !errors.Is(err, errMySQLQueryFailed) {
		t.Fatalf("expected wrapped query error, got %v", err)
	}

	entries := decodeJSONLogEntries(t, &logBuffer)
	if len(entries) != 1 {
		t.Fatalf("expected 1 error sql log entry, got %d: %s", len(entries), logBuffer.String())
	}

	entry := entries[0]
	msg, _ := entry["msg"].(string)
	if !strings.HasPrefix(msg, logging.PrefixEngineException("[mysql:")) {
		t.Fatalf("expected compact error sql message, got %q", msg)
	}
	sqlValue, _ := entry["sql"].(string)
	if sqlValue != "SELECT broken WHERE id = 7" {
		t.Fatalf("expected full executed sql, got %q", sqlValue)
	}
	if entry["error"] == nil {
		t.Fatalf("expected error field, got %#v", entry["error"])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestSQLCClientLogsSensitiveQueryErrorWithDesensitizedSQL(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error = %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	var logBuffer bytes.Buffer
	logger := logging.NewFromConfigWithWriter(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevel(slog.LevelInfo.String()),
		Format: autoloadcfg.LogFormatJSON,
	}, &logBuffer)
	client := mysql.NewSQLCClientWithDB(db, logger, false)

	query := "SELECT id, content FROM `magic_chat_messages` WHERE user_id = ?"
	mock.ExpectQuery(regexp.QuoteMeta(query)).
		WithArgs("user-secret").
		WillReturnError(errMySQLQueryFailed)

	rows, err := client.QueryContext(context.Background(), query, "user-secret")
	if rows != nil {
		t.Cleanup(func() {
			_ = rows.Close()
		})
		if rowsErr := rows.Err(); rowsErr != nil && !errors.Is(rowsErr, errMySQLQueryFailed) {
			t.Fatalf("unexpected rows.Err(): %v", rowsErr)
		}
	}
	if !errors.Is(err, errMySQLQueryFailed) {
		t.Fatalf("expected wrapped query error, got %v", err)
	}

	entries := decodeJSONLogEntries(t, &logBuffer)
	if len(entries) != 1 {
		t.Fatalf("expected 1 error sql log entry, got %d: %s", len(entries), logBuffer.String())
	}

	entry := entries[0]
	wantSQL := "SELECT [敏感数据] FROM magic_chat_messages [查询已脱敏]"
	msg, _ := entry["msg"].(string)
	if !strings.Contains(msg, wantSQL) {
		t.Fatalf("expected desensitized sql in message, got %q", msg)
	}
	sqlValue, _ := entry["sql"].(string)
	if sqlValue != wantSQL {
		t.Fatalf("expected desensitized sql field, got %q", sqlValue)
	}
	if strings.Contains(msg, "user-secret") || strings.Contains(sqlValue, "user-secret") {
		t.Fatalf("expected sensitive query arg to be removed, got msg=%q sql=%q", msg, sqlValue)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestSQLCClientSkipsExcludedTableSQLLog(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error = %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	var logBuffer bytes.Buffer
	logger := logging.NewFromConfigWithWriter(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevel(slog.LevelInfo.String()),
		Format: autoloadcfg.LogFormatJSON,
	}, &logBuffer)
	client := mysql.NewSQLCClientWithDB(db, logger, false)

	query := "INSERT INTO `async_event_records` (`payload`) VALUES (?)"
	mock.ExpectExec(regexp.QuoteMeta(query)).
		WithArgs("secret").
		WillReturnError(errMySQLQueryFailed)

	_, err = client.ExecContext(context.Background(), query, "secret")
	if !errors.Is(err, errMySQLQueryFailed) {
		t.Fatalf("expected wrapped exec error, got %v", err)
	}
	if got := strings.TrimSpace(logBuffer.String()); got != "" {
		t.Fatalf("expected no sql log for excluded table, got %s", got)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func buildFoldedSelectSummaryForSlowSQLTest(tableSource, tail string) string {
	return strings.Join([]string{"SELECT", "*", "FROM", tableSource}, " ") + tail
}

func TestSQLCClientLogsQueryRowErrorWithFullSQL(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error = %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	var logBuffer bytes.Buffer
	logger := logging.NewFromConfigWithWriter(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevel(slog.LevelInfo.String()),
		Format: autoloadcfg.LogFormatJSON,
	}, &logBuffer)
	client := mysql.NewSQLCClientWithDB(db, logger, false)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT broken WHERE id = ?")).
		WithArgs(8).
		WillReturnError(errMySQLQueryFailed)

	row := client.QueryRowContext(context.Background(), "SELECT broken WHERE id = ?", 8)
	if err := row.Err(); !errors.Is(err, errMySQLQueryFailed) {
		t.Fatalf("expected query row error, got %v", err)
	}

	entries := decodeJSONLogEntries(t, &logBuffer)
	if len(entries) != 1 {
		t.Fatalf("expected 1 query row error sql log entry, got %d: %s", len(entries), logBuffer.String())
	}

	entry := entries[0]
	sqlValue, _ := entry["sql"].(string)
	if sqlValue != "SELECT broken WHERE id = 8" {
		t.Fatalf("expected full executed sql, got %q", sqlValue)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestSQLCClientDoesNotLogErrNoRowsAsError(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error = %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	var logBuffer bytes.Buffer
	logger := logging.NewFromConfigWithWriter(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevel(slog.LevelInfo.String()),
		Format: autoloadcfg.LogFormatJSON,
	}, &logBuffer)
	client := mysql.NewSQLCClientWithDB(db, logger, false)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT id FROM demo WHERE id = ?")).
		WithArgs(99).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))

	row := client.QueryRowContext(context.Background(), "SELECT id FROM demo WHERE id = ?", 99)
	var id int
	if err := row.Scan(&id); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("expected sql.ErrNoRows, got %v", err)
	}
	if got := strings.TrimSpace(logBuffer.String()); got != "" {
		t.Fatalf("expected no sql log for ErrNoRows, got %s", got)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestSQLCClientSkipsFastSQLLogWhenFullSQLLoggingDisabled(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error = %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	var logBuffer bytes.Buffer
	logger := logging.NewFromConfigWithWriter(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevel(slog.LevelInfo.String()),
		Format: autoloadcfg.LogFormatJSON,
	}, &logBuffer)
	client := mysql.NewSQLCClientWithDB(db, logger, false)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT id FROM demo WHERE id = ?")).
		WithArgs(1).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

	rows, err := client.QueryContext(context.Background(), "SELECT id FROM demo WHERE id = ?", 1)
	if err != nil {
		t.Fatalf("QueryContext() error = %v", err)
	}
	defer func() {
		_ = rows.Close()
	}()

	var id int
	if rows.Next() {
		if scanErr := rows.Scan(&id); scanErr != nil {
			t.Fatalf("rows.Scan() error = %v", scanErr)
		}
	}
	if id != 1 {
		t.Fatalf("unexpected id: %d", id)
	}
	if rowsErr := rows.Err(); rowsErr != nil {
		t.Fatalf("rows.Err() error = %v", rowsErr)
	}

	if got := strings.TrimSpace(logBuffer.String()); got != "" {
		t.Fatalf("expected no log output for fast sql, got %s", got)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func decodeJSONLogEntries(t *testing.T, buffer *bytes.Buffer) []map[string]any {
	t.Helper()

	scanner := bufio.NewScanner(bytes.NewReader(buffer.Bytes()))
	entries := make([]map[string]any, 0)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var entry map[string]any
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			t.Fatalf("json.Unmarshal(%q) error = %v", line, err)
		}
		entries = append(entries, entry)
	}
	if err := scanner.Err(); err != nil {
		t.Fatalf("scanner.Err() error = %v", err)
	}
	return entries
}

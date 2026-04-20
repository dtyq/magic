package mysql_test

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
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
	if entry["msg"] != "slowSql" {
		t.Fatalf("expected slowSql message, got %#v", entry["msg"])
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

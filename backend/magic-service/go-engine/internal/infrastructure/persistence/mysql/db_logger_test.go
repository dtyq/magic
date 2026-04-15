package mysql_test

import (
	"strings"
	"testing"
	"time"

	"magic/internal/infrastructure/persistence/mysql"
)

func TestRenderSQLWithArgs(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 3, 10, 14, 51, 25, 123456000, time.Local)
	got := mysql.RenderSQLWithArgsForTest(
		"INSERT INTO demo(name, active, created_at, payload, n) VALUES (?, ?, ?, ?, ?)",
		[]any{"O'Reilly", true, now, []byte(`{"a":1}`), 7},
	)
	want := "INSERT INTO demo(name, active, created_at, payload, n) VALUES ('O''Reilly', TRUE, '2026-03-10 14:51:25.123456', '{\"a\":1}', 7)"
	if got != want {
		t.Fatalf("unexpected rendered sql:\nwant: %s\ngot:  %s", want, got)
	}
}

func TestRenderSQLWithArgs_IgnoresQuestionMarkInsideQuotes(t *testing.T) {
	t.Parallel()

	got := mysql.RenderSQLWithArgsForTest(
		"SELECT '?' AS literal, col FROM demo WHERE id = ?",
		[]any{9},
	)
	want := "SELECT '?' AS literal, col FROM demo WHERE id = 9"
	if got != want {
		t.Fatalf("unexpected rendered sql:\nwant: %s\ngot:  %s", want, got)
	}
}

func TestBuildSQLFields_TruncatesRenderedSQL(t *testing.T) {
	t.Parallel()

	fields := mysql.BuildSQLFieldsForTest(
		"query",
		time.Second,
		"SELECT ?",
		[]any{strings.Repeat("x", 3000)},
	)

	got := toFieldMap(fields)
	sqlRendered, _ := got["sql_rendered"].(string)
	if !strings.Contains(sqlRendered, "(truncated)") {
		t.Fatalf("expected rendered sql to be truncated, got %q", sqlRendered)
	}

	sqlValue, _ := got["sql"].(string)
	if sqlValue != sqlRendered {
		t.Fatalf("expected sql and sql_rendered to stay in sync, sql=%q sql_rendered=%q", sqlValue, sqlRendered)
	}
}

func TestBuildSQLFields_TruncatesSQLWithoutArgs(t *testing.T) {
	t.Parallel()

	fields := mysql.BuildSQLFieldsForTest(
		"query",
		time.Second,
		"SELECT '"+strings.Repeat("x", 3000)+"'",
		nil,
	)

	got := toFieldMap(fields)
	sqlRendered, _ := got["sql_rendered"].(string)
	if !strings.Contains(sqlRendered, "(truncated)") {
		t.Fatalf("expected sql without args to be truncated, got %q", sqlRendered)
	}
}

func toFieldMap(fields []any) map[string]any {
	result := make(map[string]any, len(fields)/2)
	for i := 0; i+1 < len(fields); i += 2 {
		key, ok := fields[i].(string)
		if !ok {
			continue
		}
		result[key] = fields[i+1]
	}
	return result
}

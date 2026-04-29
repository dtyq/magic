package mysql_test

import (
	"fmt"
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

func TestBuildSQLFields_TruncatesSlowRenderedSQL(t *testing.T) {
	t.Parallel()

	fields := mysql.BuildSQLFieldsForTest(
		"query",
		time.Second,
		"SELECT ?",
		[]any{strings.Repeat("x", 3000)},
	)

	got := toFieldMap(fields)
	sqlValue, _ := got["sql"].(string)
	if !strings.Contains(sqlValue, "(truncated)") {
		t.Fatalf("expected slow rendered sql to be truncated, got %q", sqlValue)
	}
	if _, ok := got["sql_template"]; ok {
		t.Fatalf("expected sql_template to be absent, got %#v", got["sql_template"])
	}
	if _, ok := got["sql_rendered"]; ok {
		t.Fatalf("expected sql_rendered to be absent, got %#v", got["sql_rendered"])
	}
	if _, ok := got["args_count"]; ok {
		t.Fatalf("expected args_count to be absent, got %#v", got["args_count"])
	}
}

func TestBuildSQLFields_TruncatesFastSQLWithoutArgs(t *testing.T) {
	t.Parallel()

	fields := mysql.BuildSQLFieldsForTest(
		"query",
		time.Millisecond,
		"SELECT '"+strings.Repeat("x", 3000)+"'",
		nil,
	)

	got := toFieldMap(fields)
	sqlValue, _ := got["sql"].(string)
	if !strings.Contains(sqlValue, "(truncated)") {
		t.Fatalf("expected sql without args to be truncated, got %q", sqlValue)
	}
}

func TestSummarizeSQLForLog_FoldsSimpleExpandedSelect(t *testing.T) {
	t.Parallel()

	got := mysql.SummarizeSQLForLogForTest(`-- name: FindDemo :one
SELECT demo.id, demo.code, demo.name, demo.description, demo.created_at
FROM demo
WHERE code = 'demo-1'
ORDER BY id DESC
LIMIT 1`)
	want := buildFoldedSelectSummaryForTest("demo", " WHERE code = 'demo-1' ORDER BY id DESC LIMIT 1")
	if got != want {
		t.Fatalf("SummarizeSQLForLogForTest() = %q, want %q", got, want)
	}
}

func TestSummarizeSQLForLog_FoldsBeforeTruncating(t *testing.T) {
	t.Parallel()

	columns := make([]string, 0, 120)
	for i := range 120 {
		columns = append(columns, fmt.Sprintf("magic_flow_knowledge.column_%03d", i))
	}

	query := "-- name: FindKnowledgeBaseByCodeAndOrg :one\nSELECT " + strings.Join(columns, ", ") + "\nFROM magic_flow_knowledge\nWHERE code = 'KNOWLEDGE-a52a588d4b104f-ca8bdce9' AND organization_code = 'DT001' AND deleted_at IS NULL\nORDER BY id DESC\nLIMIT 1"
	got := mysql.SummarizeSQLForLogForTest(query)
	want := buildFoldedSelectSummaryForTest("magic_flow_knowledge", " WHERE code = 'KNOWLEDGE-a52a588d4b104f-ca8bdce9' AND organization_code = 'DT001' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1")
	if got != want {
		t.Fatalf("SummarizeSQLForLogForTest() = %q, want %q", got, want)
	}
	if strings.Contains(got, "(truncated)") {
		t.Fatalf("expected folded summary to avoid truncation marker, got %q", got)
	}
}

func TestSummarizeSQLForLog_KeepsComplexSelect(t *testing.T) {
	t.Parallel()

	got := mysql.SummarizeSQLForLogForTest(`-- name: ListJoined :many
SELECT users.id, teams.name, permissions.action, users.created_at, teams.updated_at
FROM users INNER JOIN teams ON teams.id = users.team_id
WHERE users.id = 1`)
	if strings.Contains(got, buildFoldedSelectSummaryForTest("users", "")) {
		t.Fatalf("expected complex query summary to keep explicit columns, got %q", got)
	}
	if !strings.Contains(got, "INNER JOIN teams") {
		t.Fatalf("expected join to stay in summary, got %q", got)
	}
}

func TestBuildSQLLogMessageForTest(t *testing.T) {
	t.Parallel()

	got := mysql.BuildSQLLogMessageForTest(time.Millisecond*1234+time.Microsecond*560, "SELECT id FROM demo WHERE id = ?", []any{7})
	want := "[mysql:1234.56ms] SELECT id FROM demo WHERE id = 7"
	if got != want {
		t.Fatalf("BuildSQLLogMessageForTest() = %q, want %q", got, want)
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

func buildFoldedSelectSummaryForTest(tableSource, tail string) string {
	return strings.Join([]string{"SELECT", "*", "FROM", tableSource}, " ") + tail
}

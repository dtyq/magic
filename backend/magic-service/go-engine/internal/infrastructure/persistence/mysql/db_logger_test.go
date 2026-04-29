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

func TestFilterSQLForLog_DesensitizesSensitiveSelect(t *testing.T) {
	t.Parallel()

	got, skip := mysql.FilterSQLForLogForTest("SELECT id, content FROM `magic`.`magic_chat_messages` WHERE user_id = 'u-1' AND token = 'secret'")
	if skip {
		t.Fatal("expected sensitive select to be logged after desensitizing")
	}

	want := "SELECT [敏感数据] FROM magic_chat_messages [查询已脱敏]"
	if got != want {
		t.Fatalf("unexpected desensitized select:\nwant: %s\ngot:  %s", want, got)
	}
	if strings.Contains(got, "secret") || strings.Contains(got, "u-1") {
		t.Fatalf("expected sensitive values to be removed, got %q", got)
	}
}

func TestFilterSQLForLog_DesensitizesSensitiveInsert(t *testing.T) {
	t.Parallel()

	got, skip := mysql.FilterSQLForLogForTest("INSERT INTO `magic_chat_messages` (`id`, `message`, `sender`) VALUES (42, 'hello', 'u-1')")
	if skip {
		t.Fatal("expected sensitive insert to be logged after desensitizing")
	}

	want := "INSERT INTO `magic_chat_messages` (`id`, `message`, `sender`) VALUES (42, ***)"
	if got != want {
		t.Fatalf("unexpected desensitized insert:\nwant: %s\ngot:  %s", want, got)
	}
	if strings.Contains(got, "hello") || strings.Contains(got, "u-1") {
		t.Fatalf("expected inserted values to be removed, got %q", got)
	}
}

func TestFilterSQLForLog_DesensitizesSensitiveUpdate(t *testing.T) {
	t.Parallel()

	got, skip := mysql.FilterSQLForLogForTest("UPDATE magic_chat_message_versions SET content = 'hello', user_id = 'u-1' WHERE id = 9")
	if skip {
		t.Fatal("expected sensitive update to be logged after desensitizing")
	}

	want := "UPDATE magic_chat_message_versions SET content = '***', user_id = '***' WHERE id = 9"
	if got != want {
		t.Fatalf("unexpected desensitized update:\nwant: %s\ngot:  %s", want, got)
	}
	if strings.Contains(got, "hello") || strings.Contains(got, "u-1") {
		t.Fatalf("expected updated values to be removed, got %q", got)
	}
}

func TestFilterSQLForLog_DesensitizesSensitiveJSONUpdate(t *testing.T) {
	t.Parallel()

	got, skip := mysql.FilterSQLForLogForTest(`UPDATE magic_flow_memory_histories SET payload = '{"token":"secret"}' WHERE id = 9`)
	if skip {
		t.Fatal("expected sensitive json update to be logged after desensitizing")
	}

	want := "UPDATE magic_flow_memory_histories SET [复杂JSON数据已脱敏] WHERE id = 9"
	if got != want {
		t.Fatalf("unexpected desensitized json update:\nwant: %s\ngot:  %s", want, got)
	}
	if strings.Contains(got, "secret") || strings.Contains(got, "token") {
		t.Fatalf("expected json payload to be removed, got %q", got)
	}
}

func TestFilterSQLForLog_SkipsExcludedTable(t *testing.T) {
	t.Parallel()

	got, skip := mysql.FilterSQLForLogForTest("INSERT INTO `async_event_records` (`id`, `payload`) VALUES (1, 'secret')")
	if !skip {
		t.Fatalf("expected excluded table to be skipped, got sql %q", got)
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

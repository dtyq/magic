package mysql

import "time"

func RenderSQLWithArgsForTest(query string, args []any) string {
	return renderSQLWithArgs(query, args)
}

func BuildSQLFieldsForTest(op string, duration time.Duration, query string, args []any) []any {
	return buildSQLFields(op, duration, query, args)
}

func SummarizeSQLForLogForTest(query string) string {
	return summarizeSQLForLog(query)
}

func BuildSQLLogMessageForTest(duration time.Duration, query string, args []any) string {
	return buildSQLLogMessage(duration, renderSQLWithArgs(query, args))
}

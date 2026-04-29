// Package mysql 提供 MySQL 数据库持久化实现。
package mysql

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"reflect"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"magic/internal/infrastructure/logging"
	sqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/internal/pkg/logkey"
)

const (
	maxSQLLogLength     = 1024
	sqlNullLiteral      = "NULL"
	sqlTruncationSuffix = "...(truncated)"
	slowSQLThreshold    = 5 * time.Millisecond
	sqlLogPrefix        = "mysql"
	sqlFoldColumnCount  = 5
)

// DBLogger 包装 DBTX 接口以记录 SQL 查询日志
type DBLogger struct {
	inner     sqlc.DBTX
	logger    *logging.SugaredLogger
	logAllSQL bool
	logErrors bool
}

// NewDBLogger 创建新的 DBLogger
func NewDBLogger(inner sqlc.DBTX, logger *logging.SugaredLogger) *DBLogger {
	return NewDBLoggerWithMode(inner, logger, true)
}

// NewDBLoggerWithMode 创建新的 DBLogger，并控制是否记录全量 SQL 成功/失败日志。
func NewDBLoggerWithMode(inner sqlc.DBTX, logger *logging.SugaredLogger, logAllSQL bool) *DBLogger {
	return &DBLogger{
		inner:     inner,
		logger:    logger,
		logAllSQL: logAllSQL,
		logErrors: true,
	}
}

// ExecContext 实现 DBTX 接口
func (l *DBLogger) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	start := time.Now()
	res, err := l.inner.ExecContext(ctx, query, args...)
	duration := time.Since(start)

	if err != nil {
		l.logSQLResult(ctx, sqlResultLogInput{
			op:       "exec",
			duration: duration,
			query:    query,
			args:     args,
			err:      err,
		})
		return res, fmt.Errorf("exec context failed: %w", err)
	}

	l.logSQLResult(ctx, sqlResultLogInput{
		op:       "exec",
		duration: duration,
		query:    query,
		args:     args,
	})
	return res, nil
}

// PrepareContext 实现 DBTX 接口
func (l *DBLogger) PrepareContext(ctx context.Context, query string) (*sql.Stmt, error) {
	start := time.Now()
	stmt, err := l.inner.PrepareContext(ctx, query)
	duration := time.Since(start)

	if err != nil {
		l.logSQLResult(ctx, sqlResultLogInput{
			op:       "prepare",
			duration: duration,
			query:    query,
			err:      err,
		})
		return stmt, fmt.Errorf("prepare context failed: %w", err)
	}

	l.logSQLResult(ctx, sqlResultLogInput{
		op:       "prepare",
		duration: duration,
		query:    query,
	})
	return stmt, nil
}

// QueryContext 实现 DBTX 接口
func (l *DBLogger) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	start := time.Now()
	rows, err := l.inner.QueryContext(ctx, query, args...)
	duration := time.Since(start)

	if err != nil {
		l.logSQLResult(ctx, sqlResultLogInput{
			op:       "query",
			duration: duration,
			query:    query,
			args:     args,
			err:      err,
		})
		return rows, fmt.Errorf("query context failed: %w", err)
	}

	l.logSQLResult(ctx, sqlResultLogInput{
		op:       "query",
		duration: duration,
		query:    query,
		args:     args,
	})
	return rows, nil
}

// QueryRowContext 实现 DBTX 接口
func (l *DBLogger) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	start := time.Now()
	row := l.inner.QueryRowContext(ctx, query, args...)
	duration := time.Since(start)
	rowErr := row.Err()
	if errors.Is(rowErr, sql.ErrNoRows) {
		rowErr = nil
	}

	l.logSQLResult(ctx, sqlResultLogInput{
		op:       "query_row",
		duration: duration,
		query:    query,
		args:     args,
		err:      rowErr,
	})

	return row
}

func buildSQLFields(op string, duration time.Duration, query string, args []any) []any {
	sqlRendered := normalizeSQLForLog(renderSQLWithArgs(query, args))
	return buildSQLFieldsFromRendered(op, duration, sqlRendered)
}

func buildSQLFieldsFromRendered(op string, duration time.Duration, sqlRendered string) []any {
	return []any{
		"type", "sql",
		"op", op,
		logkey.DurationMS, logkey.DurationToMS(duration),
		logkey.SQL, sqlRendered,
	}
}

type sqlResultLogInput struct {
	op       string
	duration time.Duration
	query    string
	args     []any
	err      error
}

func (l *DBLogger) logSQLResult(ctx context.Context, input sqlResultLogInput) {
	if l.logger == nil {
		return
	}

	needsSlowLog := input.duration > slowSQLThreshold
	needsErrorLog := input.err != nil && l.logErrors
	needsDebugLog := l.logAllSQL && !needsSlowLog && !needsErrorLog
	if !needsSlowLog && !needsErrorLog && !needsDebugLog {
		return
	}

	if needsDebugLog && !needsSlowLog && !needsErrorLog {
		l.logger.DebugContext(ctx, buildSQLSummaryMessage(input.duration, input.query, input.args))
		return
	}

	details := buildSQLLogDetails(input.duration, input.query, input.args)
	fields := buildSQLFieldsFromRendered(input.op, input.duration, details.renderedSQL)
	if needsSlowLog {
		slowFields := append(slices.Clone(fields), logkey.SlowSQLThresholdMS, logkey.DurationToMS(slowSQLThreshold))
		if input.err != nil {
			slowFields = append(slowFields, logkey.Error, input.err)
		}
		l.logger.WarnContext(ctx, details.message, slowFields...)
	}

	if needsErrorLog {
		l.logger.ErrorContext(ctx, details.message, append(fields, logkey.Error, input.err)...)
		return
	}
}

type sqlLogDetails struct {
	message     string
	renderedSQL string
}

func buildSQLLogDetails(duration time.Duration, query string, args []any) sqlLogDetails {
	renderedSQL := renderSQLWithArgs(query, args)
	return sqlLogDetails{
		message:     buildSQLLogMessage(duration, renderedSQL),
		renderedSQL: normalizeSQLForLog(renderedSQL),
	}
}

func buildSQLSummaryMessage(duration time.Duration, query string, args []any) string {
	return buildSQLLogMessage(duration, renderSQLWithArgs(query, args))
}

func buildSQLLogMessage(duration time.Duration, renderedSQL string) string {
	return fmt.Sprintf("[%s:%.2fms] %s", sqlLogPrefix, logkey.DurationToMS(duration), summarizeSQLForLog(renderedSQL))
}

func normalizeSQLForLog(query string) string {
	return truncateSQLForLog(compactSQLForLog(query))
}

func compactSQLForLog(query string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(query)), " ")
}

func truncateSQLForLog(query string) string {
	if utf8.RuneCountInString(query) <= maxSQLLogLength {
		return query
	}

	suffixRunes := utf8.RuneCountInString(sqlTruncationSuffix)
	if maxSQLLogLength <= suffixRunes {
		return string([]rune(sqlTruncationSuffix)[:maxSQLLogLength])
	}

	runes := []rune(query)
	return string(runes[:maxSQLLogLength-suffixRunes]) + sqlTruncationSuffix
}

func summarizeSQLForLog(query string) string {
	compact := compactSQLForLog(stripLeadingSQLComments(query))
	if compact == "" {
		return compact
	}
	if folded, ok := foldSimpleSelectColumns(compact); ok {
		return truncateSQLForLog(compactSQLForLog(folded))
	}
	return truncateSQLForLog(compact)
}

func stripLeadingSQLComments(query string) string {
	lines := strings.Split(query, "\n")
	start := 0
	for start < len(lines) {
		trimmed := strings.TrimSpace(lines[start])
		if trimmed == "" || strings.HasPrefix(trimmed, "--") {
			start++
			continue
		}
		break
	}
	return strings.Join(lines[start:], "\n")
}

func foldSimpleSelectColumns(query string) (string, bool) {
	upperQuery := strings.ToUpper(query)
	if !strings.HasPrefix(upperQuery, "SELECT ") {
		return "", false
	}
	if strings.HasPrefix(upperQuery, "WITH ") ||
		findTopLevelKeyword(query, " JOIN ") >= 0 ||
		findTopLevelKeyword(query, " UNION ") >= 0 ||
		findTopLevelKeyword(query, " INTERSECT ") >= 0 ||
		findTopLevelKeyword(query, " EXCEPT ") >= 0 ||
		strings.Contains(upperQuery, "(SELECT ") ||
		strings.Contains(upperQuery, "( SELECT ") {
		return "", false
	}

	fromIdx := findTopLevelKeyword(query, " FROM ")
	if fromIdx < len("SELECT ") {
		return "", false
	}

	selectPart := strings.TrimSpace(query[len("SELECT "):fromIdx])
	if selectPart == "" || strings.Contains(selectPart, "*") {
		return "", false
	}

	fromRemainder := query[fromIdx+len(" FROM "):]
	tableSource, tail := splitFromRemainder(fromRemainder)
	if !isSimpleTableSource(tableSource) {
		return "", false
	}

	columns := splitCSV(selectPart)
	if len(columns) < sqlFoldColumnCount {
		return "", false
	}
	for _, column := range columns {
		if !isSimpleSelectColumn(column, tableSource) {
			return "", false
		}
	}

	return buildFoldedSelectSummary(tableSource, tail), true
}

func splitFromRemainder(fromRemainder string) (string, string) {
	nextClause := findFirstTopLevelKeyword(fromRemainder, []string{
		" WHERE ",
		" GROUP BY ",
		" HAVING ",
		" ORDER BY ",
		" LIMIT ",
		" FOR UPDATE",
		" LOCK IN SHARE MODE",
		" INTO ",
	})
	if nextClause == -1 {
		return strings.TrimSpace(fromRemainder), ""
	}
	return strings.TrimSpace(fromRemainder[:nextClause]), fromRemainder[nextClause:]
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			return nil
		}
		result = append(result, part)
	}
	return result
}

func isSimpleTableSource(source string) bool {
	if source == "" || strings.ContainsAny(source, " ,()") {
		return false
	}
	return isQualifiedIdentifier(stripBackticks(source))
}

func isSimpleSelectColumn(column, source string) bool {
	if column == "" || strings.ContainsAny(column, " ()+-/*%<>=!|&^?:") {
		return false
	}
	if strings.Contains(strings.ToUpper(column), " AS ") {
		return false
	}

	normalizedColumn := stripBackticks(column)
	parts := strings.Split(normalizedColumn, ".")
	if len(parts) == 0 {
		return false
	}

	columnName := parts[len(parts)-1]
	if !isIdentifier(columnName) {
		return false
	}
	if len(parts) == 1 {
		return true
	}

	prefix := strings.Join(parts[:len(parts)-1], ".")
	if !isQualifiedIdentifier(prefix) {
		return false
	}

	normalizedSource := stripBackticks(source)
	return prefix == normalizedSource || prefix == lastIdentifierSegment(normalizedSource)
}

func isQualifiedIdentifier(value string) bool {
	parts := strings.Split(value, ".")
	if len(parts) == 0 {
		return false
	}
	for _, part := range parts {
		if !isIdentifier(part) {
			return false
		}
	}
	return true
}

func isIdentifier(value string) bool {
	if value == "" {
		return false
	}
	for _, r := range value {
		if r != '_' && !unicode.IsLetter(r) && !unicode.IsDigit(r) {
			return false
		}
	}
	return true
}

func lastIdentifierSegment(value string) string {
	if idx := strings.LastIndex(value, "."); idx >= 0 {
		return value[idx+1:]
	}
	return value
}

func stripBackticks(value string) string {
	return strings.ReplaceAll(value, "`", "")
}

func buildFoldedSelectSummary(tableSource, tail string) string {
	return strings.Join([]string{"SELECT", "*", "FROM", tableSource}, " ") + tail
}

func findFirstTopLevelKeyword(query string, keywords []string) int {
	first := -1
	for _, keyword := range keywords {
		idx := findTopLevelKeyword(query, keyword)
		if idx == -1 {
			continue
		}
		if first == -1 || idx < first {
			first = idx
		}
	}
	return first
}

func findTopLevelKeyword(query, keyword string) int {
	if keyword == "" || len(query) < len(keyword) {
		return -1
	}

	var quoted byte
	depth := 0
	for i := 0; i < len(query); i++ {
		ch := query[i]
		if quoted != 0 {
			quoted, i = advanceQuotedState(query, i, quoted)
			continue
		}

		switch ch {
		case '\'', '"', '`':
			quoted = ch
		case '(':
			depth++
		case ')':
			if depth > 0 {
				depth--
			}
		default:
			if depth == 0 && matchesKeywordAt(query, keyword, i) {
				return i
			}
		}
	}
	return -1
}

func advanceQuotedState(query string, idx int, quoted byte) (byte, int) {
	if query[idx] != quoted {
		return quoted, idx
	}
	if isRepeatedQuote(query, idx, quoted) {
		return quoted, idx + 1
	}
	if idx > 0 && query[idx-1] == '\\' {
		return quoted, idx
	}

	return 0, idx
}

func isRepeatedQuote(query string, idx int, quoted byte) bool {
	return quoted != '`' && idx+1 < len(query) && query[idx+1] == quoted
}

func matchesKeywordAt(query, keyword string, idx int) bool {
	return idx+len(keyword) <= len(query) && strings.EqualFold(query[idx:idx+len(keyword)], keyword)
}

func renderSQLWithArgs(query string, args []any) string {
	if len(args) == 0 {
		return query
	}

	state := newSQLRenderState(len(query), len(args))
	for i := range len(query) {
		state.append(query[i], args)
	}
	return state.String()
}

func formatSQLArg(arg any) string {
	if arg == nil {
		return sqlNullLiteral
	}

	if value, ok := resolveDriverValue(arg); ok {
		return formatSQLArg(value)
	}

	if formatted, ok := formatDirectSQLArg(arg); ok {
		return formatted
	}

	return formatReflectSQLArg(reflect.ValueOf(arg), arg)
}

func resolveDriverValue(arg any) (any, bool) {
	valuer, ok := arg.(driver.Valuer)
	if !ok {
		return nil, false
	}
	value, err := valuer.Value()
	if err != nil {
		return nil, false
	}
	return value, true
}

func formatDirectSQLArg(arg any) (string, bool) {
	switch v := arg.(type) {
	case string:
		return quoteSQLString(v), true
	case []byte:
		return formatSQLBytes(v), true
	case time.Time:
		return quoteSQLString(v.Format("2006-01-02 15:04:05.999999")), true
	case *time.Time:
		if v == nil {
			return sqlNullLiteral, true
		}
		return formatSQLArg(*v), true
	case bool:
		return formatSQLBool(v), true
	case fmt.Stringer:
		return quoteSQLString(v.String()), true
	default:
		return "", false
	}
}

func formatReflectSQLArg(rv reflect.Value, fallback any) string {
	switch rv.Kind() {
	case reflect.Pointer:
		if rv.IsNil() {
			return sqlNullLiteral
		}
		return formatSQLArg(rv.Elem().Interface())
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return strconv.FormatInt(rv.Int(), 10)
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return strconv.FormatUint(rv.Uint(), 10)
	case reflect.Float32, reflect.Float64:
		return strconv.FormatFloat(rv.Float(), 'f', -1, 64)
	case reflect.String:
		return quoteSQLString(rv.String())
	case reflect.Bool:
		return formatSQLBool(rv.Bool())
	default:
		return quoteSQLString(fmt.Sprintf("%v", fallback))
	}
}

func formatSQLBytes(value []byte) string {
	if !utf8.Valid(value) {
		return quoteSQLString(fmt.Sprintf("<binary:%d bytes>", len(value)))
	}
	return quoteSQLString(string(value))
}

func formatSQLBool(value bool) string {
	if value {
		return "TRUE"
	}
	return "FALSE"
}

func quoteSQLString(value string) string {
	replacer := strings.NewReplacer(
		"\\", "\\\\",
		"'", "''",
		"\n", "\\n",
		"\r", "\\r",
		"\t", "\\t",
	)
	return "'" + replacer.Replace(value) + "'"
}

type sqlRenderState struct {
	builder    strings.Builder
	argIndex   int
	inSingle   bool
	inDouble   bool
	inBacktick bool
	escaped    bool
}

func newSQLRenderState(queryLen, argsCount int) *sqlRenderState {
	state := &sqlRenderState{}
	state.builder.Grow(queryLen + argsCount*8)
	return state
}

func (s *sqlRenderState) append(ch byte, args []any) {
	if s.handleEscaped(ch) || s.handleQuote(ch) || s.handlePlaceholder(ch, args) {
		return
	}
	s.builder.WriteByte(ch)
}

func (s *sqlRenderState) handleEscaped(ch byte) bool {
	if s.escaped {
		s.builder.WriteByte(ch)
		s.escaped = false
		return true
	}
	if ch != '\\' || (!s.inSingle && !s.inDouble) {
		return false
	}
	s.builder.WriteByte(ch)
	s.escaped = true
	return true
}

func (s *sqlRenderState) handleQuote(ch byte) bool {
	switch ch {
	case '\'':
		if !s.inDouble && !s.inBacktick {
			s.inSingle = !s.inSingle
		}
	case '"':
		if !s.inSingle && !s.inBacktick {
			s.inDouble = !s.inDouble
		}
	case '`':
		if !s.inSingle && !s.inDouble {
			s.inBacktick = !s.inBacktick
		}
	default:
		return false
	}
	s.builder.WriteByte(ch)
	return true
}

func (s *sqlRenderState) handlePlaceholder(ch byte, args []any) bool {
	if ch != '?' || s.inSingle || s.inDouble || s.inBacktick || s.argIndex >= len(args) {
		return false
	}
	s.builder.WriteString(formatSQLArg(args[s.argIndex]))
	s.argIndex++
	return true
}

func (s *sqlRenderState) String() string {
	return s.builder.String()
}

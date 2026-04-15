// Package mysql 提供 MySQL 数据库持久化实现。
package mysql

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"fmt"
	"reflect"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"magic/internal/infrastructure/logging"
	sqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/internal/pkg/logkey"
)

const (
	maxSQLLogLength     = 1024
	sqlNullLiteral      = "NULL"
	sqlTruncationSuffix = "...(truncated)"
	slowSQLLogMessage   = "slowSql"
	slowSQLThreshold    = 5 * time.Millisecond
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
		logErrors: logAllSQL,
	}
}

// ExecContext 实现 DBTX 接口
func (l *DBLogger) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	start := time.Now()
	res, err := l.inner.ExecContext(ctx, query, args...)
	duration := time.Since(start)

	if err != nil {
		l.logSQLResult(ctx, sqlResultLogInput{
			successMsg: "SQL Exec Success",
			errorMsg:   "SQL Exec Failed",
			op:         "exec",
			duration:   duration,
			query:      query,
			args:       args,
			err:        err,
		})
		return res, fmt.Errorf("exec context failed: %w", err)
	}

	l.logSQLResult(ctx, sqlResultLogInput{
		successMsg: "SQL Exec Success",
		op:         "exec",
		duration:   duration,
		query:      query,
		args:       args,
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
			successMsg: "SQL Prepare Success",
			errorMsg:   "SQL Prepare Failed",
			op:         "prepare",
			duration:   duration,
			query:      query,
			err:        err,
		})
		return stmt, fmt.Errorf("prepare context failed: %w", err)
	}

	l.logSQLResult(ctx, sqlResultLogInput{
		successMsg: "SQL Prepare Success",
		op:         "prepare",
		duration:   duration,
		query:      query,
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
			successMsg: "SQL Query Success",
			errorMsg:   "SQL Query Failed",
			op:         "query",
			duration:   duration,
			query:      query,
			args:       args,
			err:        err,
		})
		return rows, fmt.Errorf("query context failed: %w", err)
	}

	l.logSQLResult(ctx, sqlResultLogInput{
		successMsg: "SQL Query Success",
		op:         "query",
		duration:   duration,
		query:      query,
		args:       args,
	})
	return rows, nil
}

// QueryRowContext 实现 DBTX 接口
func (l *DBLogger) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	start := time.Now()
	row := l.inner.QueryRowContext(ctx, query, args...)
	duration := time.Since(start)

	l.logSQLResult(ctx, sqlResultLogInput{
		successMsg: "SQL QueryRow Executed",
		op:         "query_row",
		duration:   duration,
		query:      query,
		args:       args,
	})

	return row
}

func buildSQLFields(op string, duration time.Duration, query string, args []any) []any {
	sqlTemplate := normalizeSQLForLog(query)
	sqlRendered := normalizeSQLForLog(renderSQLWithArgs(query, args))
	return []any{
		"type", "sql",
		"op", op,
		logkey.DurationMS, logkey.DurationToMS(duration),
		logkey.SQL, sqlRendered,
		logkey.SQLTemplate, sqlTemplate,
		logkey.SQLRendered, sqlRendered,
		logkey.ArgsCount, len(args),
	}
}

type sqlResultLogInput struct {
	successMsg string
	errorMsg   string
	op         string
	duration   time.Duration
	query      string
	args       []any
	err        error
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

	fields := buildSQLFields(input.op, input.duration, input.query, input.args)
	if needsSlowLog {
		slowFields := append(slices.Clone(fields), logkey.SlowSQLThresholdMS, logkey.DurationToMS(slowSQLThreshold))
		if input.err != nil {
			slowFields = append(slowFields, logkey.Error, input.err)
		}
		l.logger.WarnContext(ctx, slowSQLLogMessage, slowFields...)
	}

	if needsErrorLog {
		l.logger.ErrorContext(ctx, input.errorMsg, append(fields, logkey.Error, input.err)...)
		return
	}

	if needsDebugLog {
		l.logger.DebugContext(ctx, input.successMsg, fields...)
	}
}

func normalizeSQLForLog(query string) string {
	compact := strings.Join(strings.Fields(strings.TrimSpace(query)), " ")
	if utf8.RuneCountInString(compact) <= maxSQLLogLength {
		return compact
	}

	suffixRunes := utf8.RuneCountInString(sqlTruncationSuffix)
	if maxSQLLogLength <= suffixRunes {
		return string([]rune(sqlTruncationSuffix)[:maxSQLLogLength])
	}

	runes := []rune(compact)
	return string(runes[:maxSQLLogLength-suffixRunes]) + sqlTruncationSuffix
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

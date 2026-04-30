package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"strings"
	"time"

	// 为 database/sql 注册 MySQL 驱动
	_ "github.com/go-sql-driver/mysql"

	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/infrastructure/logging"
	sqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
)

// SQLCClient 是基于 database/sql 的轻量封装，供 sqlc 使用。
type SQLCClient struct {
	db      *sql.DB
	dbtx    sqlc.DBTX
	queries *sqlc.Queries
	logger  *logging.SugaredLogger
	logSQL  bool
}

const defaultMySQLDSNParams = "charset=utf8mb4&parseTime=true&loc=Local"

// BuildDSN 根据配置构造 MySQL DSN，并补齐与 PHP 一致的本地时区/字符集解析参数。
func BuildDSN(cfg *autoloadcfg.MySQLConfig) string {
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?%s",
		cfg.Username,
		cfg.AuthValue,
		cfg.Host,
		cfg.Port,
		cfg.Database,
		normalizeMySQLDSNParams(cfg.Params),
	)
}

// NewSQLCClient 使用 database/sql 创建新的 MySQL 客户端。
func NewSQLCClient(cfg *autoloadcfg.MySQLConfig, logger *logging.SugaredLogger) (*SQLCClient, error) {
	dsn := BuildDSN(cfg)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open MySQL connection: %w", err)
	}

	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(time.Duration(cfg.ConnMaxLifetime) * time.Second)

	if err := db.PingContext(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to ping MySQL: %w", err)
	}

	enableSQLLog := cfg.LogSql
	return NewSQLCClientWithDB(db, logger, enableSQLLog), nil
}

// NewSQLCClientWithDB 使用给定 *sql.DB 创建客户端，适合测试和复用现有连接。
func NewSQLCClientWithDB(db *sql.DB, logger *logging.SugaredLogger, logSQL bool) *SQLCClient {
	var dbtx sqlc.DBTX = db
	if logger != nil {
		dbtx = NewDBLoggerWithMode(db, logger, logSQL)
	}

	return &SQLCClient{
		db:      db,
		dbtx:    dbtx,
		queries: sqlc.New(dbtx),
		logger:  logger,
		logSQL:  logSQL,
	}
}

// DB 暴露底层 *sql.DB，供过渡期使用。
func (c *SQLCClient) DB() *sql.DB { return c.db }

// Q 返回生成的 sqlc 查询句柄。
func (c *SQLCClient) Q() *sqlc.Queries { return c.queries }

// WithTx 创建绑定事务的查询句柄，并继承 SQL 日志包装行为。
func (c *SQLCClient) WithTx(tx *sql.Tx) *sqlc.Queries {
	if tx == nil {
		return c.queries
	}
	var dbtx sqlc.DBTX = tx
	if c.logger != nil {
		dbtx = NewDBLoggerWithMode(tx, c.logger, c.logSQL)
	}
	return sqlc.New(dbtx)
}

// ExecContext 执行 SQL 并复用统一日志能力。
func (c *SQLCClient) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	res, err := c.dbtx.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("exec context failed: %w", err)
	}
	return res, nil
}

// ExecTxContext 在给定事务中执行 SQL，并复用统一日志能力。
func (c *SQLCClient) ExecTxContext(ctx context.Context, tx *sql.Tx, query string, args ...any) (sql.Result, error) {
	if tx == nil {
		return c.ExecContext(ctx, query, args...)
	}

	var dbtx sqlc.DBTX = tx
	if c.logger != nil {
		dbtx = NewDBLoggerWithMode(tx, c.logger, c.logSQL)
	}

	res, err := dbtx.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("exec tx context failed: %w", err)
	}
	return res, nil
}

// QueryContext 查询多行并复用统一日志能力。
func (c *SQLCClient) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	rows, err := c.dbtx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query context failed: %w", err)
	}
	return rows, nil
}

// QueryRowContext 查询单行并复用统一日志能力。
func (c *SQLCClient) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	return c.dbtx.QueryRowContext(ctx, query, args...)
}

// Close 关闭底层数据库连接。
func (c *SQLCClient) Close() error {
	if err := c.db.Close(); err != nil {
		return fmt.Errorf("failed to close MySQL connection: %w", err)
	}
	return nil
}

// normalizeMySQLDSNParams 只补齐客户端本地解析参数，不改 MySQL session time_zone。
func normalizeMySQLDSNParams(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return defaultMySQLDSNParams
	}

	values, err := url.ParseQuery(raw)
	if err != nil {
		return appendMissingMySQLParams(raw)
	}

	ensureMySQLParam(values, "charset", "utf8mb4")
	ensureMySQLParam(values, "parseTime", "true")
	ensureMySQLParam(values, "loc", "Local")
	return values.Encode()
}

func appendMissingMySQLParams(raw string) string {
	params := raw
	if !containsMySQLParam(raw, "charset") {
		params += "&charset=utf8mb4"
	}
	if !containsMySQLParam(raw, "parseTime") {
		params += "&parseTime=true"
	}
	if !containsMySQLParam(raw, "loc") {
		params += "&loc=Local"
	}
	return strings.TrimPrefix(params, "&")
}

func ensureMySQLParam(values url.Values, key, value string) {
	if hasMySQLParam(values, key) {
		return
	}
	values.Set(key, value)
}

func hasMySQLParam(values url.Values, key string) bool {
	for currentKey := range values {
		if strings.EqualFold(currentKey, key) {
			return true
		}
	}
	return false
}

func containsMySQLParam(raw, key string) bool {
	for part := range strings.SplitSeq(raw, "&") {
		currentKey, _, _ := strings.Cut(part, "=")
		if strings.EqualFold(strings.TrimSpace(currentKey), key) {
			return true
		}
	}
	return false
}

// Package logkey 定义结构化日志键的标准常量。
package logkey

const (
	// Error 是日志中错误对象的标准键
	Error = "error"
	// RequestID 是请求链路 ID 的标准键
	RequestID = "request_id"
	// Path 是文件路径或 URL 路径的键
	Path = "path"
	// ID 是通用标识符键
	ID = "id"
	// Count 是数量或长度的键
	Count = "count"
	// Duration 是耗时的键
	Duration = "duration"
	// DurationMS 是毫秒耗时的键
	DurationMS = "duration_ms"
	// SQL 是 SQL 语句键
	SQL = "sql"
	// SQLTemplate 是 SQL 模板语句键。
	SQLTemplate = "sql_template"
	// SQLRendered 是展开参数后的 SQL 语句键。
	SQLRendered = "sql_rendered"
	// ArgsCount 是参数数量键
	ArgsCount = "args_count"
	// SlowSQLThresholdMS 是慢 SQL 阈值毫秒键。
	SlowSQLThresholdMS = "slow_sql_threshold_ms"
	// PayloadBytes 是日志负载字节数键
	PayloadBytes = "payload_bytes"
	// PayloadSHA256 是日志负载哈希键
	PayloadSHA256 = "payload_sha256"
	// PayloadTruncated 标记日志负载是否被截断
	PayloadTruncated = "payload_truncated"
)

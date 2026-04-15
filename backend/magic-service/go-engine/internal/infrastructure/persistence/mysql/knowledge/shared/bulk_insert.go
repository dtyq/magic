// Package shared 提供知识库 MySQL 仓储之间复用的 SQL 构造辅助函数。
package shared

import "strings"

const (
	bulkInsertMaxPlaceholders = 900
	bulkInsertRowOverhead     = 4
)

// MaxBulkInsertRows 返回单次批量写入允许的最大行数。
func MaxBulkInsertRows(columnsPerRow int) int {
	if columnsPerRow <= 0 {
		return 1
	}
	rows := bulkInsertMaxPlaceholders / columnsPerRow
	if rows <= 0 {
		return 1
	}
	return rows
}

// BuildBulkInsertSQL 生成批量插入 SQL。
func BuildBulkInsertSQL(prefix, suffix string, columnsPerRow, rowCount int) string {
	if rowCount <= 0 {
		return prefix + suffix
	}

	var builder strings.Builder
	builder.Grow(len(prefix) + len(suffix) + rowCount*(columnsPerRow*2+bulkInsertRowOverhead))
	builder.WriteString(prefix)
	for rowIndex := range rowCount {
		if rowIndex > 0 {
			builder.WriteByte(',')
		}
		builder.WriteByte('(')
		for columnIndex := range columnsPerRow {
			if columnIndex > 0 {
				builder.WriteByte(',')
			}
			builder.WriteByte('?')
		}
		builder.WriteByte(')')
	}
	builder.WriteString(suffix)
	return builder.String()
}

// BuildInClausePlaceholders 生成 IN 子句中的占位符列表。
func BuildInClausePlaceholders(count int) string {
	if count <= 0 {
		return ""
	}
	return strings.TrimRight(strings.Repeat("?,", count), ",")
}

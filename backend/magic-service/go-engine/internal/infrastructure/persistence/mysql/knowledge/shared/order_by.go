package shared

import "maps"

const (
	sqlOrderDirectionAsc  = "ASC"
	sqlOrderDirectionDesc = "DESC"
)

// OrderWhitelist 将动态排序收口到预定义字段白名单，避免调用方透传任意列名。
type OrderWhitelist[T comparable] struct {
	fallbackColumn string
	columns        map[T]string
}

// NewOrderWhitelist 构造排序字段白名单。
func NewOrderWhitelist[T comparable](fallbackColumn string, columns map[T]string) OrderWhitelist[T] {
	return OrderWhitelist[T]{
		fallbackColumn: fallbackColumn,
		columns:        maps.Clone(columns),
	}
}

// Resolve 返回字段对应的安全列名，非法值统一回退到默认列。
func (w OrderWhitelist[T]) Resolve(field T) string {
	if column, ok := w.columns[field]; ok {
		return column
	}
	return w.fallbackColumn
}

// Clause 构造安全的 ORDER BY 子句。
func (w OrderWhitelist[T]) Clause(field T, ascending bool) string {
	direction := sqlOrderDirectionDesc
	if ascending {
		direction = sqlOrderDirectionAsc
	}
	return w.Resolve(field) + " " + direction
}

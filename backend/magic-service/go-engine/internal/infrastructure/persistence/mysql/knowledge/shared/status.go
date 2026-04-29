// Package shared 提供知识库 MySQL 仓储之间复用的状态与基础转换辅助函数。
package shared

import (
	"database/sql"
	"fmt"

	"magic/pkg/convert"
)

// OptionalString 将字符串包装为 sql.NullString，空字符串视为无效。
func OptionalString(value string) sql.NullString {
	if value == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: value, Valid: true}
}

// SyncStatusToInt32 将领域层同步状态转换为 int32。
func SyncStatusToInt32[T ~int](status T, fieldName string) (int32, error) {
	converted, err := convert.SafeIntToInt32(int(status), fieldName)
	if err != nil {
		return 0, fmt.Errorf("convert sync status: %w", err)
	}
	return converted, nil
}

// NullableSyncStatusToInt32 将可选的同步状态转换为 sql.NullInt32。
func NullableSyncStatusToInt32[T ~int](status *T, fieldName string) (sql.NullInt32, error) {
	if status == nil {
		return sql.NullInt32{}, nil
	}
	converted, err := SyncStatusToInt32(*status, fieldName)
	if err != nil {
		return sql.NullInt32{}, err
	}
	return sql.NullInt32{Int32: converted, Valid: true}, nil
}

// SafeUint64ToInt 安全地将 uint64 转换为 int。
func SafeUint64ToInt(value uint64, fieldName string) (int, error) {
	result, err := convert.SafeUint64ToInt(value, fieldName)
	if err != nil {
		return 0, fmt.Errorf("convert uint64 to int: %w", err)
	}
	return result, nil
}

// Package jsoncompat 提供数据库 JSON 字段的兼容解码能力。
package jsoncompat

import (
	"bytes"
	"fmt"

	pkgjsoncompat "magic/internal/pkg/jsoncompat"
)

const jsonObjectLiteral = "{}"

// DecodeObjectMap 将 JSON 解析为 map 对象。
// 对于 null、空白、{}、[]、""、"null"、"{}"、"[]" 等空形态 JSON，返回空 map 且不报错。
// 其他非对象 JSON 或非法 JSON 报错。
func DecodeObjectMap(raw []byte, fieldName string) (map[string]any, error) {
	result := make(map[string]any)
	if err := pkgjsoncompat.UnmarshalObjectOrEmpty(raw, result, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal %s: %w", fieldName, err)
	}
	return result, nil
}

// DecodeObjectPtr 将 JSON 解析为对象指针。
// 对于原始对象 JSON（包括 {}），返回对象指针。
// 对于 null、空白、[]、""、"null"、"{}"、"[]" 等空形态 JSON，返回 nil 且不报错。
// 其他非对象 JSON 或非法 JSON 报错。
func DecodeObjectPtr[T any](raw []byte, fieldName string) (*T, error) {
	trimmed := bytes.TrimSpace(raw)
	if string(trimmed) == jsonObjectLiteral {
		var value T
		if err := pkgjsoncompat.UnmarshalObjectOrEmpty(trimmed, value, &value); err != nil {
			return nil, fmt.Errorf("failed to unmarshal %s: %w", fieldName, err)
		}
		return &value, nil
	}
	if pkgjsoncompat.IsEmptyObjectLikeJSON(trimmed) {
		var empty *T
		return empty, nil
	}
	var value T
	if err := pkgjsoncompat.UnmarshalObjectOrEmpty(trimmed, value, &value); err != nil {
		return nil, fmt.Errorf("failed to unmarshal %s: %w", fieldName, err)
	}
	return &value, nil
}

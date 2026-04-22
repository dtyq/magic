// Package jsoncompat 提供数据库 JSON 字段的兼容解码能力。
package jsoncompat

import (
	"bytes"
	"encoding/json"
	"fmt"
)

const jsonNullLiteral = "null"

// DecodeObjectMap 将 JSON 解析为 map 对象。
// 对于 null、空白、非对象 JSON（数组/标量），返回空 map 且不报错；非法 JSON 报错。
func DecodeObjectMap(raw []byte, fieldName string) (map[string]any, error) {
	result := make(map[string]any)

	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || string(trimmed) == jsonNullLiteral {
		return result, nil
	}

	var decoded any
	if err := json.Unmarshal(trimmed, &decoded); err != nil {
		return nil, fmt.Errorf("failed to unmarshal %s: %w", fieldName, err)
	}

	objectValue, ok := decoded.(map[string]any)
	if !ok {
		return result, nil
	}

	return objectValue, nil
}

// DecodeObjectPtr 将 JSON 解析为对象指针。
// 对于 null、空白、非对象 JSON（数组/标量），返回 nil 且不报错；非法 JSON 报错。
func DecodeObjectPtr[T any](raw []byte, fieldName string) (*T, error) {
	var empty *T

	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || string(trimmed) == jsonNullLiteral {
		return empty, nil
	}

	var decoded any
	if err := json.Unmarshal(trimmed, &decoded); err != nil {
		return nil, fmt.Errorf("failed to unmarshal %s: %w", fieldName, err)
	}

	if _, ok := decoded.(map[string]any); !ok {
		return empty, nil
	}

	value := new(T)
	if err := json.Unmarshal(trimmed, value); err != nil {
		return nil, fmt.Errorf("failed to unmarshal %s: %w", fieldName, err)
	}
	return value, nil
}

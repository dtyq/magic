// Package jsoncompat 提供对历史脏 JSON 结构的兼容解码能力。
package jsoncompat

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

// ErrInvalidObjectCompatJSON 表示输入既不是 JSON 对象，也不是约定可兼容的空值形态。
var ErrInvalidObjectCompatJSON = errors.New("json value must be object, empty array, null or empty string")

// IsEmptyObjectLikeJSON 判断输入是否属于应兼容为空对象的 JSON 形态。
// 兼容值包括：空白、null、{}、[]、""、"   "、"null"、"{}"、"[]"。
func IsEmptyObjectLikeJSON(data []byte) bool {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 ||
		bytes.Equal(trimmed, []byte("null")) ||
		bytes.Equal(trimmed, []byte("{}")) ||
		bytes.Equal(trimmed, []byte("[]")) {
		return true
	}

	if trimmed[0] != '"' {
		return false
	}

	var raw string
	if err := json.Unmarshal(trimmed, &raw); err != nil {
		return false
	}

	switch strings.TrimSpace(raw) {
	case "", "null", "{}", "[]":
		return true
	default:
		return false
	}
}

// UnmarshalObjectOrEmpty 兼容 PHP 将对象位错误编码成 []、null、"" 的场景。
// 当输入为 {}、[]、null、空字符串时，统一回落为调用方提供的 empty 值。
func UnmarshalObjectOrEmpty[T any](data []byte, empty T, out *T) error {
	trimmed := bytes.TrimSpace(data)
	if IsEmptyObjectLikeJSON(trimmed) {
		*out = empty
		return nil
	}

	if trimmed[0] != '{' {
		return ErrInvalidObjectCompatJSON
	}

	*out = empty
	return wrapObjectCompatJSONError(json.Unmarshal(trimmed, out))
}

// UnmarshalObjectPtrOrNil 将对象 JSON 解码为指针。
// 当输入为兼容空值形态时返回 nil，其他情况要求必须为 JSON 对象。
func UnmarshalObjectPtrOrNil[T any](data []byte) (*T, error) {
	if IsEmptyObjectLikeJSON(data) {
		var empty *T
		return empty, nil
	}

	var decoded T
	if err := UnmarshalObjectOrEmpty(data, decoded, &decoded); err != nil {
		return nil, err
	}
	return &decoded, nil
}

func wrapObjectCompatJSONError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, ErrInvalidObjectCompatJSON) {
		return err
	}
	return fmt.Errorf("%w: %w", ErrInvalidObjectCompatJSON, err)
}

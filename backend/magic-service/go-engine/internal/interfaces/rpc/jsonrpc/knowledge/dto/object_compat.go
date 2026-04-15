package dto

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	pkgjsoncompat "magic/internal/pkg/jsoncompat"
)

func decodeOptionalObjectCompat[T any](raw json.RawMessage, fieldName string) (*T, error) {
	value, err := pkgjsoncompat.UnmarshalObjectPtrOrNil[T](raw)
	if err != nil {
		return nil, fmt.Errorf("unmarshal %s: %w", fieldName, err)
	}
	return value, nil
}

func decodeOptionalObjectCompatPreserveEmptyObject[T any](raw json.RawMessage, fieldName string) (*T, error) {
	trimmed := bytes.TrimSpace(raw)
	switch {
	case len(trimmed) == 0,
		bytes.Equal(trimmed, []byte("null")),
		bytes.Equal(trimmed, []byte("[]")):
		return decodeOptionalObjectCompat[T](json.RawMessage("null"), fieldName)
	case len(trimmed) > 0 && trimmed[0] == '"':
		var rawString string
		if err := json.Unmarshal(trimmed, &rawString); err != nil {
			return nil, fmt.Errorf("unmarshal %s: %w", fieldName, err)
		}
		switch strings.TrimSpace(rawString) {
		case "", "null", "[]", "{}":
			return decodeOptionalObjectCompat[T](json.RawMessage("null"), fieldName)
		}
	}

	var decoded T
	if err := pkgjsoncompat.UnmarshalObjectOrEmpty(trimmed, decoded, &decoded); err != nil {
		return nil, fmt.Errorf("unmarshal %s: %w", fieldName, err)
	}
	return &decoded, nil
}

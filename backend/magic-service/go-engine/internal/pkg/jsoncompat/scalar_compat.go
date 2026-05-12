// Package jsoncompat 提供对历史脏 JSON 标量结构的兼容解码能力。
package jsoncompat

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"
)

var (
	errInvalidCompatInteger  = errors.New("invalid compat integer")
	errInvalidCompatFloat    = errors.New("invalid compat float")
	errInvalidCompatBool     = errors.New("invalid compat bool")
	errInvalidCompatID       = errors.New("invalid compat id")
	errUnsupportedCompatType = errors.New("unsupported compat scalar type")
)

const maxSafeJSONInteger = 1<<53 - 1

const (
	maxCompatInt64 = int64(^uint64(0) >> 1)
	minCompatInt64 = -maxCompatInt64 - 1
)

// DecodeOptionalInt 兼容解码 int 标量，接受 JSON number / string / null / ""。
func DecodeOptionalInt(data []byte, fieldName string) (*int, bool, error) {
	value, provided, err := decodeOptionalInt64(data, fieldName)
	if err != nil {
		return nil, false, err
	}
	if !provided || value == nil {
		return nil, provided, nil
	}
	intValue := int(*value)
	return &intValue, true, nil
}

// DecodeOptionalInt64 兼容解码 int64 标量，接受 JSON number / string / null / ""。
func DecodeOptionalInt64(data []byte, fieldName string) (*int64, bool, error) {
	return decodeOptionalInt64(data, fieldName)
}

// DecodeOptionalIDInt64 兼容解码 int64 ID，接受 JSON number / string / null / ""。
func DecodeOptionalIDInt64(data []byte, fieldName string) (*int64, bool, error) {
	decoded, provided, err := decodeOptionalScalarWithUseNumber(data, fieldName)
	if err != nil || !provided {
		return nil, provided, err
	}
	return IDInt64FromAny(decoded, fieldName)
}

// DecodeOptionalIDString 兼容解码字符串 ID，接受 JSON number / string / null / ""。
func DecodeOptionalIDString(data []byte, fieldName string) (string, bool, error) {
	decoded, provided, err := decodeOptionalScalarWithUseNumber(data, fieldName)
	if err != nil || !provided {
		return "", provided, err
	}
	return IDStringFromAny(decoded, fieldName)
}

// IDInt64FromAny 将动态值解释为 int64 ID。
func IDInt64FromAny(value any, fieldName string) (*int64, bool, error) {
	if intValue, ok := idInt64FromSignedAny(value); ok {
		return &intValue, true, nil
	}
	if intValue, ok, err := idInt64FromUnsignedAny(value, fieldName); ok || err != nil {
		if err != nil {
			return nil, false, err
		}
		return &intValue, true, nil
	}

	switch typed := value.(type) {
	case nil:
		return nil, true, nil
	case string:
		normalized := strings.TrimSpace(typed)
		if normalized == "" {
			return nil, true, nil
		}
		intValue, err := strconv.ParseInt(normalized, 10, 64)
		if err != nil {
			return nil, false, fmt.Errorf("unmarshal %s: %w: %q", fieldName, errInvalidCompatID, typed)
		}
		return &intValue, true, nil
	case json.Number:
		intValue, err := parseJSONNumberAsInt64(typed, fieldName, errInvalidCompatID)
		if err != nil {
			return nil, false, err
		}
		return &intValue, true, nil
	case float32:
		return idInt64FromFloat(float64(typed), fieldName)
	case float64:
		return idInt64FromFloat(typed, fieldName)
	default:
		return nil, false, fmt.Errorf("unmarshal %s: %w: %T", fieldName, errUnsupportedCompatType, value)
	}
}

func idInt64FromSignedAny(value any) (int64, bool) {
	switch typed := value.(type) {
	case int:
		return int64(typed), true
	case int8:
		return int64(typed), true
	case int16:
		return int64(typed), true
	case int32:
		return int64(typed), true
	case int64:
		return typed, true
	default:
		return 0, false
	}
}

func idInt64FromUnsignedAny(value any, fieldName string) (int64, bool, error) {
	switch typed := value.(type) {
	case uint:
		return uint64ToCompatInt64(uint64(typed), fieldName)
	case uint8:
		return int64(typed), true, nil
	case uint16:
		return int64(typed), true, nil
	case uint32:
		return int64(typed), true, nil
	case uint64:
		return uint64ToCompatInt64(typed, fieldName)
	default:
		return 0, false, nil
	}
}

func uint64ToCompatInt64(value uint64, fieldName string) (int64, bool, error) {
	if value > uint64(maxCompatInt64) {
		return 0, false, fmt.Errorf("unmarshal %s: %w: %v", fieldName, errInvalidCompatID, value)
	}
	return int64(value), true, nil
}

// IDStringFromAny 将动态值解释为字符串 ID。
func IDStringFromAny(value any, fieldName string) (string, bool, error) {
	switch typed := value.(type) {
	case nil:
		return "", true, nil
	case string:
		return strings.TrimSpace(typed), true, nil
	case json.Number:
		stringValue, err := parseJSONNumberAsIDString(typed, fieldName)
		if err != nil {
			return "", false, err
		}
		return stringValue, true, nil
	case int:
		return strconv.FormatInt(int64(typed), 10), true, nil
	case int8:
		return strconv.FormatInt(int64(typed), 10), true, nil
	case int16:
		return strconv.FormatInt(int64(typed), 10), true, nil
	case int32:
		return strconv.FormatInt(int64(typed), 10), true, nil
	case int64:
		return strconv.FormatInt(typed, 10), true, nil
	case uint:
		return strconv.FormatUint(uint64(typed), 10), true, nil
	case uint8:
		return strconv.FormatUint(uint64(typed), 10), true, nil
	case uint16:
		return strconv.FormatUint(uint64(typed), 10), true, nil
	case uint32:
		return strconv.FormatUint(uint64(typed), 10), true, nil
	case uint64:
		return strconv.FormatUint(typed, 10), true, nil
	case float32:
		return idStringFromFloat(float64(typed), fieldName)
	case float64:
		return idStringFromFloat(typed, fieldName)
	default:
		return "", false, fmt.Errorf("unmarshal %s: %w: %T", fieldName, errUnsupportedCompatType, value)
	}
}

// DecodeOptionalFloat64 兼容解码 float64 标量，接受 JSON number / string / null / ""。
func DecodeOptionalFloat64(data []byte, fieldName string) (*float64, bool, error) {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 {
		return nil, false, nil
	}

	var decoded any
	if err := json.Unmarshal(trimmed, &decoded); err != nil {
		return nil, false, fmt.Errorf("unmarshal %s: %w", fieldName, err)
	}

	switch value := decoded.(type) {
	case nil:
		return nil, true, nil
	case float64:
		return &value, true, nil
	case string:
		normalized := strings.TrimSpace(value)
		if normalized == "" {
			return nil, true, nil
		}
		floatValue, err := strconv.ParseFloat(normalized, 64)
		if err != nil {
			return nil, false, fmt.Errorf("unmarshal %s: %w: %q", fieldName, errInvalidCompatFloat, value)
		}
		return &floatValue, true, nil
	default:
		return nil, false, fmt.Errorf("unmarshal %s: %w: %T", fieldName, errUnsupportedCompatType, decoded)
	}
}

// DecodeOptionalBool 兼容解码 bool 标量，接受 JSON bool / string / number / null / ""。
// 字符串布尔使用显式语义：true/false/1/0/on/off/yes/no。
func DecodeOptionalBool(data []byte, fieldName string) (*bool, bool, error) {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 {
		return nil, false, nil
	}

	var decoded any
	if err := json.Unmarshal(trimmed, &decoded); err != nil {
		return nil, false, fmt.Errorf("unmarshal %s: %w", fieldName, err)
	}

	switch value := decoded.(type) {
	case nil:
		return nil, true, nil
	case bool:
		return &value, true, nil
	case float64:
		boolValue, ok := parseExplicitBool(strconv.FormatFloat(value, 'f', -1, 64))
		if !ok {
			return nil, false, fmt.Errorf("unmarshal %s: %w: %v", fieldName, errInvalidCompatBool, value)
		}
		return &boolValue, true, nil
	case string:
		normalized := strings.TrimSpace(value)
		if normalized == "" {
			return nil, true, nil
		}
		boolValue, ok := parseExplicitBool(normalized)
		if !ok {
			return nil, false, fmt.Errorf("unmarshal %s: %w: %q", fieldName, errInvalidCompatBool, value)
		}
		return &boolValue, true, nil
	default:
		return nil, false, fmt.Errorf("unmarshal %s: %w: %T", fieldName, errUnsupportedCompatType, decoded)
	}
}

// DecodeOptionalBoolPHPTruth 兼容 PHP `(bool)` 真值语义。
func DecodeOptionalBoolPHPTruth(data []byte, fieldName string) (*bool, bool, error) {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 {
		return nil, false, nil
	}

	var decoded any
	if err := json.Unmarshal(trimmed, &decoded); err != nil {
		return nil, false, fmt.Errorf("unmarshal %s: %w", fieldName, err)
	}

	switch value := decoded.(type) {
	case nil:
		return nil, true, nil
	case bool:
		return &value, true, nil
	case float64:
		boolValue := value != 0
		return &boolValue, true, nil
	case string:
		normalized := strings.TrimSpace(value)
		if normalized == "" {
			return nil, true, nil
		}
		boolValue := normalized != "0"
		return &boolValue, true, nil
	default:
		return nil, false, fmt.Errorf("unmarshal %s: %w: %T", fieldName, errUnsupportedCompatType, decoded)
	}
}

func decodeOptionalInt64(data []byte, fieldName string) (*int64, bool, error) {
	decoded, provided, err := decodeOptionalScalarWithUseNumber(data, fieldName)
	if err != nil || !provided {
		return nil, provided, err
	}

	switch value := decoded.(type) {
	case nil:
		return nil, true, nil
	case json.Number:
		intValue, err := strconv.ParseInt(value.String(), 10, 64)
		if err == nil {
			return &intValue, true, nil
		}
		floatValue, floatErr := strconv.ParseFloat(value.String(), 64)
		if floatErr != nil {
			return nil, false, fmt.Errorf("unmarshal %s: %w: %v", fieldName, errInvalidCompatInteger, value)
		}
		intValue = int64(floatValue)
		if float64(intValue) != floatValue {
			return nil, false, fmt.Errorf("unmarshal %s: %w: %v", fieldName, errInvalidCompatInteger, value)
		}
		return &intValue, true, nil
	case string:
		normalized := strings.TrimSpace(value)
		if normalized == "" {
			return nil, true, nil
		}
		intValue, err := strconv.ParseInt(normalized, 10, 64)
		if err != nil {
			return nil, false, fmt.Errorf("unmarshal %s: %w: %q", fieldName, errInvalidCompatInteger, value)
		}
		return &intValue, true, nil
	default:
		return nil, false, fmt.Errorf("unmarshal %s: %w: %T", fieldName, errUnsupportedCompatType, decoded)
	}
}

func decodeOptionalScalarWithUseNumber(data []byte, fieldName string) (any, bool, error) {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 {
		return nil, false, nil
	}

	decoder := json.NewDecoder(bytes.NewReader(trimmed))
	decoder.UseNumber()

	var decoded any
	if err := decoder.Decode(&decoded); err != nil {
		return nil, false, fmt.Errorf("unmarshal %s: %w", fieldName, err)
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return nil, false, fmt.Errorf("unmarshal %s: %w", fieldName, errInvalidCompatInteger)
	}
	return decoded, true, nil
}

func parseJSONNumberAsInt64(value json.Number, fieldName string, kind error) (int64, error) {
	intValue, err := strconv.ParseInt(value.String(), 10, 64)
	if err == nil {
		return intValue, nil
	}

	floatValue, floatErr := strconv.ParseFloat(value.String(), 64)
	if floatErr != nil {
		return 0, fmt.Errorf("unmarshal %s: %w: %v", fieldName, kind, value)
	}
	return validateIntegralFloat64(floatValue, fieldName, kind)
}

func parseJSONNumberAsIDString(value json.Number, fieldName string) (string, error) {
	raw := strings.TrimSpace(value.String())
	if raw == "" {
		return "", nil
	}
	if !strings.ContainsAny(raw, ".eE") {
		return raw, nil
	}
	intValue, err := parseJSONNumberAsInt64(value, fieldName, errInvalidCompatID)
	if err != nil {
		return "", err
	}
	return strconv.FormatInt(intValue, 10), nil
}

func idInt64FromFloat(value float64, fieldName string) (*int64, bool, error) {
	intValue, err := validateIntegralFloat64(value, fieldName, errInvalidCompatID)
	if err != nil {
		return nil, false, err
	}
	return &intValue, true, nil
}

func idStringFromFloat(value float64, fieldName string) (string, bool, error) {
	intValue, err := validateIntegralFloat64(value, fieldName, errInvalidCompatID)
	if err != nil {
		return "", false, err
	}
	return strconv.FormatInt(intValue, 10), true, nil
}

func validateIntegralFloat64(value float64, fieldName string, kind error) (int64, error) {
	switch {
	case math.IsNaN(value), math.IsInf(value, 0):
		return 0, fmt.Errorf("unmarshal %s: %w: %v", fieldName, kind, value)
	case value < float64(minCompatInt64) || value > float64(maxCompatInt64):
		return 0, fmt.Errorf("unmarshal %s: %w: %v", fieldName, kind, value)
	case math.Abs(value) > maxSafeJSONInteger:
		return 0, fmt.Errorf("unmarshal %s: %w: %v", fieldName, kind, value)
	}

	intValue := int64(value)
	if float64(intValue) != value {
		return 0, fmt.Errorf("unmarshal %s: %w: %v", fieldName, kind, value)
	}
	return intValue, nil
}

func parseExplicitBool(raw string) (bool, bool) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "1", "true", "on", "yes":
		return true, true
	case "0", "false", "off", "no":
		return false, true
	default:
		return false, false
	}
}

// Package convert 提供带有安全检查的类型转换工具。
//
// 此包提供四种类型的转换：
//  1. 安全转换：验证输入并在值无效时返回错误
//  2. 严格解析：从任意类型转换并返回错误
//  3. 宽松转换：从任意类型转换，失败时返回零值
//  4. 截断转换：将值限制在有效范围内，而不是返回错误
//
// 使用示例：
//
//	// 带有验证的安全转换
//	limit, err := convert.SafeIntToUint64(userInput, "limit") // 示例
//	if err != nil { // 示例
//	    return fmt.Errorf("invalid limit: %w", err) // 示例
//	} // 示例
//
//	// 带错误返回的严格转换
//	count, err := convert.ParseInt(row["count"]) // 示例
//	if err != nil { // 示例
//	    return fmt.Errorf("invalid count: %w", err) // 示例
//	} // 示例
//
//	// 截断转换
//	int32Val := convert.ClampToInt32(largeInt) // 示例
package convert

import (
	"database/sql"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
)

var (
	// ErrValueNegative 当值必须为非负数但为负数时返回
	ErrValueNegative = errors.New("value cannot be negative")
	// ErrValueOutOfInt32Range 当值超出 int32 范围时返回
	ErrValueOutOfInt32Range = errors.New("value out of int32 range")
	// ErrValueOutOfUint32Range 当值超出 uint32 范围时返回
	ErrValueOutOfUint32Range = errors.New("value out of uint32 range")
	// ErrValueOutOfUint64Range 当值超出 uint64 范围时返回
	ErrValueOutOfUint64Range = errors.New("value out of uint64 range")
	// ErrInvalidFormat 当字符串格式无效时返回
	ErrInvalidFormat = errors.New("invalid format")
	// ErrUnsupportedType 当输入类型不受支持时返回
	ErrUnsupportedType = errors.New("unsupported type")
	// ErrValueOutOfRange 当值超出目标类型有效范围时返回
	ErrValueOutOfRange = errors.New("value out of range")
	// ErrNonFiniteNumber 当浮点值为 NaN 或 Inf 时返回
	ErrNonFiniteNumber = errors.New("non-finite number")
	// ErrNullValue 当输入为 null/空值时返回
	ErrNullValue = errors.New("null value")
)

// ============================================================================
// 带有验证的安全转换（失败时返回错误）
// ============================================================================

// SafeIntToUint32 将 int 转换为 uint32 并进行验证。
// 如果值为负数或超出 uint32 范围，则返回错误。
func SafeIntToUint32(v int, fieldName string) (uint32, error) {
	if v < 0 {
		return 0, fmt.Errorf("%w: %s: %d", ErrValueNegative, fieldName, v)
	}
	if v > math.MaxUint32 {
		return 0, fmt.Errorf("%w: %s: %d", ErrValueOutOfUint32Range, fieldName, v)
	}
	return uint32(v), nil
}

// SafeIntToUint64 将 int 转换为 uint64 并进行验证。
// 如果值为负数，则返回错误。
// 此函数在转换前显式验证范围以满足 gosec G115。
func SafeIntToUint64(v int, fieldName string) (uint64, error) {
	if v < 0 {
		return 0, fmt.Errorf("%w: %s: %d", ErrValueNegative, fieldName, v)
	}
	// 转换是安全的：已验证 v >= 0，因此不会发生负数到 uint64 的溢出
	return uint64(v), nil
}

// SafeIntToInt32 将 int 转换为 int32 并进行验证。
// 如果值超出 int32 范围，则返回错误。
// 此函数在转换前显式验证范围以满足 gosec G115。
func SafeIntToInt32(v int, fieldName string) (int32, error) {
	if v < math.MinInt32 || v > math.MaxInt32 {
		return 0, fmt.Errorf("%w: %s: %d", ErrValueOutOfInt32Range, fieldName, v)
	}
	// 转换是安全的：已验证 v 在 int32 范围内
	return int32(v), nil
}

// SafeInt64ToInt32 将 int64 转换为 int32 并进行验证。
// 如果值超出 int32 范围，则返回错误。
func SafeInt64ToInt32(v int64, fieldName string) (int32, error) {
	if v < math.MinInt32 || v > math.MaxInt32 {
		return 0, fmt.Errorf("%w: %s: %d", ErrValueOutOfInt32Range, fieldName, v)
	}
	return int32(v), nil
}

// SafeUint64ToInt 将 uint64 转换为 int 并进行验证。
// 如果值超出 int 范围，则返回错误。
func SafeUint64ToInt(v uint64, fieldName string) (int, error) {
	if v > uint64(math.MaxInt) {
		return 0, fmt.Errorf("%w: %s: %d", ErrValueOutOfUint64Range, fieldName, v)
	}
	return int(v), nil
}

// ============================================================================
// 截断转换（将值限制在有效范围内）
// ============================================================================

// ClampToInt32 将 int 截断到 int32 范围内。
// 超出范围的值将被限制为 math.MinInt32 或 math.MaxInt32。
func ClampToInt32(v int) int32 {
	if v > math.MaxInt32 {
		return math.MaxInt32
	}
	if v < math.MinInt32 {
		return math.MinInt32
	}
	return int32(v)
}

// ClampToInt64 将 uint64 截断到 int64 范围内。
// 超出范围的值将被限制为 math.MaxInt64。
func ClampToInt64(v uint64) int64 {
	if v > math.MaxInt64 {
		return math.MaxInt64
	}
	return int64(v)
}

// ClampToUint32 将 uint64 截断到 uint32 范围内。
// 超出范围的值将被限制为 math.MaxUint32。
func ClampToUint32(v uint64) uint32 {
	if v > math.MaxUint32 {
		return math.MaxUint32
	}
	return uint32(v)
}

// ClampToInt 将 int64 截断到 int 范围内。
// 在 64 位系统上通常不需要截断，但在 32 位系统上可能需要。
func ClampToInt(v int64) int {
	if v > int64(math.MaxInt) {
		return math.MaxInt
	}
	if v < int64(math.MinInt) {
		return math.MinInt
	}
	return int(v)
}

// ============================================================================
// 严格转换（失败时返回错误）
// ============================================================================

// ParseInt 将任意基础数值类型转换为 int，失败时返回错误。
func ParseInt(v any) (int, error) {
	switch val := v.(type) {
	case int:
		return val, nil
	case int64:
		if val < int64(math.MinInt) || val > int64(math.MaxInt) {
			return 0, fmt.Errorf("%w: int64 to int: %d", ErrValueOutOfRange, val)
		}
		return int(val), nil
	case int32:
		return int(val), nil
	case int16:
		return int(val), nil
	case int8:
		return int(val), nil
	case uint:
		return parseIntFromUint64(uint64(val))
	case uint64:
		return parseIntFromUint64(val)
	case uint32:
		return int(val), nil
	case uint16:
		return int(val), nil
	case uint8:
		return int(val), nil
	case float64:
		return parseIntFromFloat64(val)
	case float32:
		return parseIntFromFloat64(float64(val))
	case string:
		return parseIntFromString(val)
	case []byte:
		return parseIntFromString(string(val))
	case bool:
		if val {
			return 1, nil
		}
		return 0, nil
	default:
		return 0, unsupportedTypeError(v)
	}
}

func parseIntFromUint64(v uint64) (int, error) {
	if v > uint64(math.MaxInt) {
		return 0, fmt.Errorf("%w: uint64 to int: %d", ErrValueOutOfRange, v)
	}
	return int(v), nil
}

func parseIntFromFloat64(v float64) (int, error) {
	if err := validateFiniteFloat64(v); err != nil {
		return 0, err
	}
	if v > float64(math.MaxInt) || v < float64(math.MinInt) {
		return 0, fmt.Errorf("%w: float64 to int: %v", ErrValueOutOfRange, v)
	}
	return int(v), nil
}

func parseIntFromString(s string) (int, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, fmt.Errorf("%w: empty string", ErrInvalidFormat)
	}
	i, err := strconv.Atoi(s)
	if err != nil {
		return 0, fmt.Errorf("%w: %q", ErrInvalidFormat, s)
	}
	return i, nil
}

// ParseInt64 将任意基础数值类型转换为 int64，失败时返回错误。
func ParseInt64(v any) (int64, error) {
	switch val := v.(type) {
	case int64:
		return val, nil
	case int:
		return int64(val), nil
	case int32:
		return int64(val), nil
	case int16:
		return int64(val), nil
	case int8:
		return int64(val), nil
	case uint:
		return parseInt64FromUint64(uint64(val))
	case uint64:
		return parseInt64FromUint64(val)
	case uint32:
		return int64(val), nil
	case uint16:
		return int64(val), nil
	case uint8:
		return int64(val), nil
	case float64:
		return parseInt64FromFloat64(val)
	case float32:
		return parseInt64FromFloat64(float64(val))
	case string:
		return parseInt64FromString(val)
	case []byte:
		return parseInt64FromString(string(val))
	case bool:
		if val {
			return 1, nil
		}
		return 0, nil
	default:
		return 0, unsupportedTypeError(v)
	}
}

func parseInt64FromUint64(v uint64) (int64, error) {
	if v > math.MaxInt64 {
		return 0, fmt.Errorf("%w: uint64 to int64: %d", ErrValueOutOfRange, v)
	}
	return int64(v), nil
}

func parseInt64FromFloat64(v float64) (int64, error) {
	if err := validateFiniteFloat64(v); err != nil {
		return 0, err
	}
	if v > float64(math.MaxInt64) || v < float64(math.MinInt64) {
		return 0, fmt.Errorf("%w: float64 to int64: %v", ErrValueOutOfRange, v)
	}
	return int64(v), nil
}

func parseInt64FromString(s string) (int64, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, fmt.Errorf("%w: empty string", ErrInvalidFormat)
	}
	i, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%w: %q", ErrInvalidFormat, s)
	}
	return i, nil
}

// ParseFloat64 将任意基础数值类型转换为 float64，失败时返回错误。
func ParseFloat64(v any) (float64, error) {
	switch val := v.(type) {
	case float64:
		if err := validateFiniteFloat64(val); err != nil {
			return 0, err
		}
		return val, nil
	case float32:
		f := float64(val)
		if err := validateFiniteFloat64(f); err != nil {
			return 0, err
		}
		return f, nil
	case int:
		return float64(val), nil
	case int64:
		return float64(val), nil
	case int32:
		return float64(val), nil
	case int16:
		return float64(val), nil
	case int8:
		return float64(val), nil
	case uint:
		return float64(val), nil
	case uint64:
		return float64(val), nil
	case uint32:
		return float64(val), nil
	case uint16:
		return float64(val), nil
	case uint8:
		return float64(val), nil
	case string:
		return parseFloat64FromString(val)
	case []byte:
		return parseFloat64FromString(string(val))
	case bool:
		if val {
			return 1.0, nil
		}
		return 0.0, nil
	default:
		return 0, unsupportedTypeError(v)
	}
}

func parseFloat64FromString(s string) (float64, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, fmt.Errorf("%w: empty string", ErrInvalidFormat)
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, fmt.Errorf("%w: %q", ErrInvalidFormat, s)
	}
	if err := validateFiniteFloat64(f); err != nil {
		return 0, err
	}
	return f, nil
}

// ParseTimePtr 将任意时间类型转换为 *time.Time。
// 支持 time.Time、*time.Time、sql.NullTime、*sql.NullTime、string 和 []byte。
func ParseTimePtr(v any) (*time.Time, error) {
	switch t := v.(type) {
	case nil:
		return nil, ErrNullValue
	case time.Time:
		return &t, nil
	case *time.Time:
		if t == nil {
			return nil, ErrNullValue
		}
		return t, nil
	case sql.NullTime:
		if !t.Valid {
			return nil, ErrNullValue
		}
		v := t.Time
		return &v, nil
	case *sql.NullTime:
		if t == nil || !t.Valid {
			return nil, ErrNullValue
		}
		v := t.Time
		return &v, nil
	case string:
		return parseTimeFromString(t)
	case []byte:
		return parseTimeFromString(string(t))
	default:
		return nil, unsupportedTypeError(v)
	}
}

func parseTimeFromString(s string) (*time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, fmt.Errorf("%w: empty string", ErrInvalidFormat)
	}

	layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05.999999",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}

	for _, layout := range layouts {
		var (
			parsed time.Time
			err    error
		)
		if strings.Contains(layout, "Z07") {
			parsed, err = time.Parse(layout, s)
		} else {
			parsed, err = time.ParseInLocation(layout, s, time.Local)
		}
		if err == nil {
			return &parsed, nil
		}
	}

	return nil, fmt.Errorf("%w: %q", ErrInvalidFormat, s)
}

// ParseUint64 将任意基础数值类型转换为 uint64，失败时返回错误。
func ParseUint64(v any) (uint64, error) {
	switch val := v.(type) {
	case uint64:
		return val, nil
	case uint:
		return uint64(val), nil
	case uint32:
		return uint64(val), nil
	case uint16:
		return uint64(val), nil
	case uint8:
		return uint64(val), nil
	case int:
		return parseUint64FromInt64(int64(val))
	case int64:
		return parseUint64FromInt64(val)
	case int32:
		return parseUint64FromInt64(int64(val))
	case int16:
		return parseUint64FromInt64(int64(val))
	case int8:
		return parseUint64FromInt64(int64(val))
	case float64:
		return parseUint64FromFloat64(val)
	case float32:
		return parseUint64FromFloat64(float64(val))
	case string:
		return parseUint64FromString(val)
	case []byte:
		return parseUint64FromString(string(val))
	case bool:
		if val {
			return 1, nil
		}
		return 0, nil
	default:
		return 0, unsupportedTypeError(v)
	}
}

func parseUint64FromInt64(v int64) (uint64, error) {
	if v < 0 {
		return 0, fmt.Errorf("%w: int64 to uint64: %d", ErrValueNegative, v)
	}
	return uint64(v), nil
}

func parseUint64FromFloat64(v float64) (uint64, error) {
	if err := validateFiniteFloat64(v); err != nil {
		return 0, err
	}
	if v < 0 {
		return 0, fmt.Errorf("%w: float64 to uint64: %v", ErrValueNegative, v)
	}
	if v > float64(math.MaxUint64) {
		return 0, fmt.Errorf("%w: float64 to uint64: %v", ErrValueOutOfRange, v)
	}
	return uint64(v), nil
}

func parseUint64FromString(s string) (uint64, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, fmt.Errorf("%w: empty string", ErrInvalidFormat)
	}
	u, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%w: %q", ErrInvalidFormat, s)
	}
	return u, nil
}

func validateFiniteFloat64(v float64) error {
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return fmt.Errorf("%w: %v", ErrNonFiniteNumber, v)
	}
	return nil
}

func unsupportedTypeError(v any) error {
	return fmt.Errorf("%w: %T", ErrUnsupportedType, v)
}

// ============================================================================
// 任意类型的宽松转换（失败时返回零值）
// ============================================================================

// ToInt 将任意基础数值类型转换为 int，失败时返回 0。
// 浮点数会截断小数部分。NaN/Inf、超范围、格式错误或不支持类型时返回 0。
func ToInt(v any) int {
	i, err := ParseInt(v)
	if err != nil {
		return 0
	}
	return i
}

// ToInt64 将任意基础数值类型转换为 int64，失败时返回 0。
// 浮点数会截断小数部分。NaN/Inf、超范围、格式错误或不支持类型时返回 0。
func ToInt64(v any) int64 {
	i, err := ParseInt64(v)
	if err != nil {
		return 0
	}
	return i
}

// ToFloat64 将任意基础数值类型转换为 float64，失败时返回 0.0。
// NaN/Inf、格式错误或不支持类型时返回 0.0。
func ToFloat64(v any) float64 {
	f, err := ParseFloat64(v)
	if err != nil {
		return 0
	}
	return f
}

// ToTimePtr 将任意时间类型转换为 *time.Time，失败时返回 nil。
// 支持 time.Time、*time.Time、sql.NullTime、*sql.NullTime、string 和 []byte。
func ToTimePtr(v any) *time.Time {
	t, err := ParseTimePtr(v)
	if err != nil {
		return nil
	}
	return t
}

// ToBool 将任意类型转换为 bool，失败时返回 false。
// 支持 bool、数字类型（非零为 true）和字符串（"true"、"1"、"yes" 为 true）。
func ToBool(v any) bool {
	switch val := v.(type) {
	case bool:
		return val
	case int:
		return val != 0
	case int64:
		return val != 0
	case int32:
		return val != 0
	case int16:
		return val != 0
	case int8:
		return val != 0
	case uint:
		return val != 0
	case uint64:
		return val != 0
	case uint32:
		return val != 0
	case uint16:
		return val != 0
	case uint8:
		return val != 0
	case float64:
		return val != 0
	case float32:
		return val != 0
	case string:
		return boolFromString(val)
	case []byte:
		return boolFromString(string(val))
	default:
		return false
	}
}

// boolFromString 将字符串转换为 bool。
func boolFromString(s string) bool {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "true", "1", "yes", "on":
		return true
	default:
		return false
	}
}

// ToString 将任意类型转换为 string，失败时返回空字符串。
// 支持基础类型的字符串转换。
func ToString(v any) string {
	switch val := v.(type) {
	case string:
		return val
	case []byte:
		return string(val)
	case int:
		return strconv.Itoa(val)
	case int64:
		return strconv.FormatInt(val, 10)
	case int32:
		return strconv.FormatInt(int64(val), 10)
	case int16:
		return strconv.FormatInt(int64(val), 10)
	case int8:
		return strconv.FormatInt(int64(val), 10)
	case uint:
		return strconv.FormatUint(uint64(val), 10)
	case uint64:
		return strconv.FormatUint(val, 10)
	case uint32:
		return strconv.FormatUint(uint64(val), 10)
	case uint16:
		return strconv.FormatUint(uint64(val), 10)
	case uint8:
		return strconv.FormatUint(uint64(val), 10)
	case float64:
		return strconv.FormatFloat(val, 'f', -1, 64)
	case float32:
		return strconv.FormatFloat(float64(val), 'f', -1, 32)
	case bool:
		return strconv.FormatBool(val)
	case fmt.Stringer:
		return val.String()
	default:
		return ""
	}
}

// ToUint64 将任意基础数值类型转换为 uint64，失败时返回 0。
// 负数、NaN/Inf、超范围、格式错误或不支持类型时返回 0。
func ToUint64(v any) uint64 {
	u, err := ParseUint64(v)
	if err != nil {
		return 0
	}
	return u
}

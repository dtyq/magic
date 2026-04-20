package convert_test

import (
	"database/sql"
	"errors"
	"fmt"
	"math"
	"testing"
	"time"

	"magic/pkg/convert"
)

// ============================================================================
// 安全转换测试
// ============================================================================

func TestSafeIntToUint64(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name      string
		input     int
		fieldName string
		want      uint64
		wantErr   bool
	}{
		{
			name:      "positive value",
			input:     100,
			fieldName: "test",
			want:      100,
			wantErr:   false,
		},
		{
			name:      "zero value",
			input:     0,
			fieldName: "test",
			want:      0,
			wantErr:   false,
		},
		{
			name:      "negative value returns error",
			input:     -1,
			fieldName: "test",
			want:      0,
			wantErr:   true,
		},
		{
			name:      "max int",
			input:     math.MaxInt,
			fieldName: "test",
			want:      uint64(math.MaxInt),
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := convert.SafeIntToUint64(tt.input, tt.fieldName)
			if (err != nil) != tt.wantErr {
				t.Errorf("SafeIntToUint64() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("SafeIntToUint64() = %v, want %v", got, tt.want)
			}
			if tt.wantErr && !errors.Is(err, convert.ErrValueNegative) {
				t.Errorf("SafeIntToUint64() error should wrap ErrValueNegative, got %v", err)
			}
		})
	}
}

func TestSafeIntToInt32(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name      string
		input     int
		fieldName string
		want      int32
		wantErr   bool
	}{
		{
			name:      "within range",
			input:     100,
			fieldName: "test",
			want:      100,
			wantErr:   false,
		},
		{
			name:      "zero value",
			input:     0,
			fieldName: "test",
			want:      0,
			wantErr:   false,
		},
		{
			name:      "max int32",
			input:     math.MaxInt32,
			fieldName: "test",
			want:      math.MaxInt32,
			wantErr:   false,
		},
		{
			name:      "min int32",
			input:     math.MinInt32,
			fieldName: "test",
			want:      math.MinInt32,
			wantErr:   false,
		},
		{
			name:      "above int32 max returns error",
			input:     math.MaxInt32 + 1,
			fieldName: "test",
			want:      0,
			wantErr:   true,
		},
		{
			name:      "below int32 min returns error",
			input:     math.MinInt32 - 1,
			fieldName: "test",
			want:      0,
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := convert.SafeIntToInt32(tt.input, tt.fieldName)
			if (err != nil) != tt.wantErr {
				t.Errorf("SafeIntToInt32() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("SafeIntToInt32() = %v, want %v", got, tt.want)
			}
			if tt.wantErr && !errors.Is(err, convert.ErrValueOutOfInt32Range) {
				t.Errorf("SafeIntToInt32() error should wrap ErrValueOutOfInt32Range, got %v", err)
			}
		})
	}
}

func TestSafeInt64ToInt32(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name      string
		input     int64
		fieldName string
		want      int32
		wantErr   bool
	}{
		{"within range", 100, "test", 100, false},
		{"max int32", math.MaxInt32, "test", math.MaxInt32, false},
		{"min int32", math.MinInt32, "test", math.MinInt32, false},
		{"above max", math.MaxInt32 + 1, "test", 0, true},
		{"below min", math.MinInt32 - 1, "test", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := convert.SafeInt64ToInt32(tt.input, tt.fieldName)
			if (err != nil) != tt.wantErr {
				t.Errorf("SafeInt64ToInt32() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("SafeInt64ToInt32() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSafeUint64ToInt(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name      string
		input     uint64
		fieldName string
		want      int
		wantErr   bool
	}{
		{"within range", 100, "test", 100, false},
		{"zero", 0, "test", 0, false},
		{"max int", uint64(math.MaxInt), "test", math.MaxInt, false},
		{"overflow", uint64(math.MaxInt) + 1, "test", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := convert.SafeUint64ToInt(tt.input, tt.fieldName)
			if (err != nil) != tt.wantErr {
				t.Errorf("SafeUint64ToInt() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("SafeUint64ToInt() = %v, want %v", got, tt.want)
			}
		})
	}
}

// ============================================================================
// 截断转换测试
// ============================================================================

func TestClampToInt32(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		input int
		want  int32
	}{
		{"within range", 100, 100},
		{"zero", 0, 0},
		{"negative", -100, -100},
		{"max int32", math.MaxInt32, math.MaxInt32},
		{"min int32", math.MinInt32, math.MinInt32},
		{"above max", math.MaxInt32 + 1000, math.MaxInt32},
		{"below min", math.MinInt32 - 1000, math.MinInt32},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := convert.ClampToInt32(tt.input)
			if got != tt.want {
				t.Errorf("ClampToInt32(%v) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestClampToInt64(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		input uint64
		want  int64
	}{
		{"within range", 100, 100},
		{"zero", 0, 0},
		{"max int64", uint64(math.MaxInt64), math.MaxInt64},
		{"above max int64", uint64(math.MaxInt64) + 1, math.MaxInt64},
		{"max uint64", math.MaxUint64, math.MaxInt64},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := convert.ClampToInt64(tt.input)
			if got != tt.want {
				t.Errorf("ClampToInt64(%v) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestClampToUint32(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		input uint64
		want  uint32
	}{
		{"within range", 100, 100},
		{"zero", 0, 0},
		{"max uint32", math.MaxUint32, math.MaxUint32},
		{"above max", uint64(math.MaxUint32) + 1, math.MaxUint32},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := convert.ClampToUint32(tt.input)
			if got != tt.want {
				t.Errorf("ClampToUint32(%v) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestClampToInt(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		input int64
		want  int
	}{
		{"within range", 100, 100},
		{"zero", 0, 0},
		{"negative", -100, -100},
		{"max int", int64(math.MaxInt), math.MaxInt},
		{"min int", int64(math.MinInt), math.MinInt},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := convert.ClampToInt(tt.input)
			if got != tt.want {
				t.Errorf("ClampToInt(%v) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

// ============================================================================
// 宽松转换测试
// ============================================================================

func TestToInt(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		input any
		want  int
	}{
		{"int", 42, 42},
		{"int64", int64(42), 42},
		{"int32", int32(42), 42},
		{"int16", int16(42), 42},
		{"int8", int8(42), 42},
		{"uint", uint(42), 42},
		{"uint64", uint64(42), 42},
		{"uint32", uint32(42), 42},
		{"uint16", uint16(42), 42},
		{"uint8", uint8(42), 42},
		{"float64", float64(42.9), 42},
		{"float32", float32(42.9), 42},
		{"string valid", "123", 123},
		{"string invalid", "invalid", 0},
		{"bool true", true, 1},
		{"bool false", false, 0},
		{"nil returns zero", nil, 0},
		{"uint64 overflow", uint64(math.MaxInt) + 1, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := convert.ToInt(tt.input)
			if got != tt.want {
				t.Errorf("ToInt(%v) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestToInt64(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		input any
		want  int64
	}{
		{"int64", int64(42), 42},
		{"int", 42, 42},
		{"int32", int32(42), 42},
		{"int16", int16(42), 42},
		{"int8", int8(42), 42},
		{"uint", uint(42), 42},
		{"uint64", uint64(42), 42},
		{"uint32", uint32(42), 42},
		{"uint16", uint16(42), 42},
		{"uint8", uint8(42), 42},
		{"float64", float64(42.9), 42},
		{"float32", float32(42.9), 42},
		{"string valid", "123", 123},
		{"string invalid", "invalid", 0},
		{"bool true", true, 1},
		{"bool false", false, 0},
		{"nil returns zero", nil, 0},
		{"uint64 overflow", uint64(math.MaxInt64) + 1, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := convert.ToInt64(tt.input)
			if got != tt.want {
				t.Errorf("ToInt64(%v) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestParseInt(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name    string
		input   any
		want    int
		wantErr error
	}{
		{"int", 42, 42, nil},
		{"uint64", uint64(42), 42, nil},
		{"string", "123", 123, nil},
		{"bytes", []byte("123"), 123, nil},
		{"bool true", true, 1, nil},
		{"nan", math.NaN(), 0, convert.ErrNonFiniteNumber},
		{"unsupported", time.Second, 0, convert.ErrUnsupportedType},
		{"overflow", uint64(math.MaxInt) + 1, 0, convert.ErrValueOutOfRange},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := convert.ParseInt(tt.input)
			if tt.wantErr != nil {
				if err == nil {
					t.Fatalf("ParseInt(%v) expected error %v, got nil", tt.input, tt.wantErr)
				}
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("ParseInt(%v) error = %v, want %v", tt.input, err, tt.wantErr)
				}
				return
			}

			if err != nil {
				t.Fatalf("ParseInt(%v) unexpected error: %v", tt.input, err)
			}
			if got != tt.want {
				t.Fatalf("ParseInt(%v) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestParseTimePtr(t *testing.T) {
	t.Parallel()
	now := time.Now().Truncate(time.Second)
	nowNull := sql.NullTime{Time: now, Valid: true}
	invalidNull := sql.NullTime{Valid: false}

	tests := []struct {
		name    string
		input   any
		wantNil bool
		wantErr error
	}{
		{"time.Time", now, false, nil},
		{"*time.Time", &now, false, nil},
		{"sql.NullTime", nowNull, false, nil},
		{"invalid sql.NullTime", invalidNull, true, convert.ErrNullValue},
		{"bytes", []byte("2025-01-01 10:11:12"), false, nil},
		{"invalid string", "not-a-time", true, convert.ErrInvalidFormat},
		{"unsupported", 42, true, convert.ErrUnsupportedType},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := convert.ParseTimePtr(tt.input)
			if tt.wantErr != nil {
				if err == nil {
					t.Fatalf("ParseTimePtr(%v) expected error %v, got nil", tt.input, tt.wantErr)
				}
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("ParseTimePtr(%v) error = %v, want %v", tt.input, err, tt.wantErr)
				}
				return
			}

			if err != nil {
				t.Fatalf("ParseTimePtr(%v) unexpected error: %v", tt.input, err)
			}
			if tt.wantNil && got != nil {
				t.Fatalf("ParseTimePtr(%v) = %v, want nil", tt.input, got)
			}
			if !tt.wantNil && got == nil {
				t.Fatalf("ParseTimePtr(%v) = nil, want non-nil", tt.input)
			}
		})
	}
}

func TestToFloat64(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		input any
		want  float64
	}{
		{"float64", float64(42.5), 42.5},
		{"float32", float32(42.5), float64(float32(42.5))},
		{"int", 42, 42.0},
		{"int64", int64(42), 42.0},
		{"int32", int32(42), 42.0},
		{"int16", int16(42), 42.0},
		{"int8", int8(42), 42.0},
		{"uint", uint(42), 42.0},
		{"uint64", uint64(42), 42.0},
		{"uint32", uint32(42), 42.0},
		{"uint16", uint16(42), 42.0},
		{"uint8", uint8(42), 42.0},
		{"string valid", "123.45", 123.45},
		{"string invalid", "invalid", 0.0},
		{"string NaN", "NaN", 0.0},
		{"string Inf", "+Inf", 0.0},
		{"bool true", true, 1.0},
		{"bool false", false, 0.0},
		{"nil returns zero", nil, 0.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := convert.ToFloat64(tt.input)
			if got != tt.want {
				t.Errorf("ToFloat64(%v) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestToTimePtr(t *testing.T) {
	t.Parallel()
	now := time.Now()
	nowPtr := &now
	tests := []struct {
		name    string
		input   any
		wantNil bool
	}{
		{"valid time.Time", now, false},
		{"valid *time.Time", nowPtr, false},
		{"valid sql.NullTime", sql.NullTime{Time: now, Valid: true}, false},
		{"string returns nil", "invalid", true},
		{"bytes valid time", []byte("2025-01-01 10:11:12"), false},
		{"nil returns nil", nil, true},
		{"int returns nil", 42, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := convert.ToTimePtr(tt.input)
			if tt.wantNil {
				if got != nil {
					t.Errorf("ToTimePtr(%v) = %v, want nil", tt.input, got)
				}
			} else {
				if got == nil {
					t.Errorf("ToTimePtr(%v) = nil, want non-nil", tt.input)
				}
			}
		})
	}
}

func TestToBool(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		input any
		want  bool
	}{
		{"bool true", true, true},
		{"bool false", false, false},
		{"int 1", 1, true},
		{"int 0", 0, false},
		{"int -1", -1, true},
		{"int64 1", int64(1), true},
		{"int64 0", int64(0), false},
		{"int32 1", int32(1), true},
		{"int16 1", int16(1), true},
		{"int8 1", int8(1), true},
		{"uint 1", uint(1), true},
		{"uint 0", uint(0), false},
		{"uint64 1", uint64(1), true},
		{"uint32 1", uint32(1), true},
		{"uint16 1", uint16(1), true},
		{"uint8 1", uint8(1), true},
		{"float64 1.0", float64(1.0), true},
		{"float64 0.0", float64(0.0), false},
		{"float32 1.0", float32(1.0), true},
		{"string true", "true", true},
		{"string True", "True", true},
		{"string TRUE", "TRUE", true},
		{"string 1", "1", true},
		{"string yes", "yes", true},
		{"string Yes", "Yes", true},
		{"string YES", "YES", true},
		{"string on", "on", true},
		{"string On", "On", true},
		{"string ON", "ON", true},
		{"string false", "false", false},
		{"string 0", "0", false},
		{"string no", "no", false},
		{"bytes yes", []byte("YES"), true},
		{"string empty", "", false},
		{"nil", nil, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := convert.ToBool(tt.input)
			if got != tt.want {
				t.Errorf("ToBool(%v) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

// stringer 用于测试 fmt.Stringer 接口
type stringer struct {
	value string
}

func (s stringer) String() string {
	return s.value
}

func TestToString(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		input any
		want  string
	}{
		{"string", "hello", "hello"},
		{"bytes", []byte("hello"), "hello"},
		{"int", 42, "42"},
		{"int64", int64(42), "42"},
		{"int32", int32(42), "42"},
		{"int16", int16(42), "42"},
		{"int8", int8(42), "42"},
		{"uint", uint(42), "42"},
		{"uint64", uint64(42), "42"},
		{"uint32", uint32(42), "42"},
		{"uint16", uint16(42), "42"},
		{"uint8", uint8(42), "42"},
		{"float64", float64(42.5), "42.5"},
		{"float32", float32(42.5), "42.5"},
		{"bool true", true, "true"},
		{"bool false", false, "false"},
		{"stringer", stringer{"custom"}, "custom"},
		{"nil", nil, ""},
		{"negative int", -42, "-42"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := convert.ToString(tt.input)
			if got != tt.want {
				t.Errorf("ToString(%v) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestToUint64(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		input any
		want  uint64
	}{
		{"uint64", uint64(42), 42},
		{"uint", uint(42), 42},
		{"uint32", uint32(42), 42},
		{"uint16", uint16(42), 42},
		{"uint8", uint8(42), 42},
		{"int positive", 42, 42},
		{"int zero", 0, 0},
		{"int negative", -1, 0},
		{"int64 positive", int64(42), 42},
		{"int64 negative", int64(-1), 0},
		{"int32 positive", int32(42), 42},
		{"int16 positive", int16(42), 42},
		{"int8 positive", int8(42), 42},
		{"float64 positive", float64(42.9), 42},
		{"float64 negative", float64(-1.0), 0},
		{"float64 inf", math.Inf(1), 0},
		{"float32 positive", float32(42.9), 42},
		{"string valid", "123", 123},
		{"string invalid", "invalid", 0},
		{"bytes valid", []byte("123"), 123},
		{"nil", nil, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := convert.ToUint64(tt.input)
			if got != tt.want {
				t.Errorf("ToUint64(%v) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

// ============================================================================
// 错误类型测试
// ============================================================================

func TestErrorTypes(t *testing.T) {
	t.Parallel()
	// 测试错误类型可以被正确识别
	_, err := convert.SafeIntToUint64(-1, "test")
	if !errors.Is(err, convert.ErrValueNegative) {
		t.Error("expected ErrValueNegative")
	}

	_, err = convert.SafeIntToInt32(math.MaxInt32+1, "test")
	if !errors.Is(err, convert.ErrValueOutOfInt32Range) {
		t.Error("expected ErrValueOutOfInt32Range")
	}

	_, err = convert.SafeUint64ToInt(uint64(math.MaxInt)+1, "test")
	if !errors.Is(err, convert.ErrValueOutOfUint64Range) {
		t.Error("expected ErrValueOutOfUint64Range")
	}

	_, err = convert.ParseInt("abc")
	if !errors.Is(err, convert.ErrInvalidFormat) {
		t.Error("expected ErrInvalidFormat")
	}

	_, err = convert.ParseInt(math.Inf(1))
	if !errors.Is(err, convert.ErrNonFiniteNumber) {
		t.Error("expected ErrNonFiniteNumber")
	}

	_, err = convert.ParseUint64(-1)
	if !errors.Is(err, convert.ErrValueNegative) {
		t.Error("expected ErrValueNegative")
	}

	_, err = convert.ParseTimePtr(nil)
	if !errors.Is(err, convert.ErrNullValue) {
		t.Error("expected ErrNullValue")
	}
}

// ============================================================================
// 边界条件测试
// ============================================================================

func TestEdgeCases(t *testing.T) {
	t.Parallel()
	// 空字符串
	if convert.ToInt("") != 0 {
		t.Error("empty string should return 0")
	}
	if convert.ToInt64("") != 0 {
		t.Error("empty string should return 0")
	}
	if convert.ToFloat64("") != 0 {
		t.Error("empty string should return 0")
	}
	if convert.ToUint64("") != 0 {
		t.Error("empty string should return 0")
	}

	// 特殊浮点数
	if convert.ToFloat64("NaN") != 0 {
		t.Error("NaN string should return 0")
	}
	if convert.ToInt(math.Inf(1)) != 0 {
		t.Error("Inf should return 0 for int")
	}
	if convert.ToUint64(math.Inf(1)) != 0 {
		t.Error("Inf should return 0 for uint64")
	}

	// 负数转 uint64
	if convert.ToUint64(-100) != 0 {
		t.Error("negative int should return 0 for uint64")
	}
}

// ============================================================================
// 基准测试
// ============================================================================

func BenchmarkSafeIntToUint64(b *testing.B) {
	for range b.N {
		_, _ = convert.SafeIntToUint64(1000, "test")
	}
}

func BenchmarkSafeIntToInt32(b *testing.B) {
	for range b.N {
		_, _ = convert.SafeIntToInt32(1000, "test")
	}
}

func BenchmarkClampToInt32(b *testing.B) {
	for range b.N {
		_ = convert.ClampToInt32(1000000000)
	}
}

func BenchmarkToInt(b *testing.B) {
	val := any(int64(42))
	for range b.N {
		_ = convert.ToInt(val)
	}
}

func BenchmarkToInt64(b *testing.B) {
	val := any(42)
	for range b.N {
		_ = convert.ToInt64(val)
	}
}

func BenchmarkToBool(b *testing.B) {
	val := any("true")
	for range b.N {
		_ = convert.ToBool(val)
	}
}

func BenchmarkToString(b *testing.B) {
	val := any(42)
	for range b.N {
		_ = convert.ToString(val)
	}
}

func BenchmarkToUint64(b *testing.B) {
	val := any(int64(42))
	for range b.N {
		_ = convert.ToUint64(val)
	}
}

// ============================================================================
// 示例测试
// ============================================================================

func ExampleSafeIntToUint64() {
	val, err := convert.SafeIntToUint64(100, "limit")
	if err != nil {
		fmt.Println("error:", err)
		return
	}
	fmt.Println(val)
	// Output: 100
}

func ExampleClampToInt32() {
	val := convert.ClampToInt32(math.MaxInt32 + 1000)
	fmt.Println(val)
	// Output: 2147483647
}

func ExampleToBool() {
	fmt.Println(convert.ToBool("true"))
	fmt.Println(convert.ToBool(1))
	fmt.Println(convert.ToBool("no"))
	// Output:
	// true
	// true
	// false
}

func ExampleToString() {
	fmt.Println(convert.ToString(42))
	fmt.Println(convert.ToString(true))
	fmt.Println(convert.ToString(3.14))
	// Output:
	// 42
	// true
	// 3.14
}

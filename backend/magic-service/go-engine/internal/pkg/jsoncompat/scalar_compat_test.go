package jsoncompat_test

import (
	"encoding/json"
	"testing"

	"magic/internal/pkg/jsoncompat"
)

func TestDecodeOptionalIDInt64(t *testing.T) {
	t.Parallel()

	t.Run("string number", func(t *testing.T) {
		t.Parallel()

		got, provided, err := jsoncompat.DecodeOptionalIDInt64([]byte(`"42"`), "id")
		if err != nil || !provided || got == nil || *got != 42 {
			t.Fatalf("expected string number to decode, got value=%v provided=%v err=%v", got, provided, err)
		}
	})

	t.Run("large json number", func(t *testing.T) {
		t.Parallel()

		got, provided, err := jsoncompat.DecodeOptionalIDInt64([]byte(`904787325064802305`), "id")
		if err != nil || !provided || got == nil || *got != 904787325064802305 {
			t.Fatalf("expected large json number preserved, got value=%v provided=%v err=%v", got, provided, err)
		}
	})

	t.Run("non integer number", func(t *testing.T) {
		t.Parallel()

		if _, _, err := jsoncompat.DecodeOptionalIDInt64([]byte(`42.5`), "id"); err == nil {
			t.Fatal("expected non integer id to fail")
		}
	})

	t.Run("overflow", func(t *testing.T) {
		t.Parallel()

		if _, _, err := jsoncompat.DecodeOptionalIDInt64([]byte(`9223372036854775808`), "id"); err == nil {
			t.Fatal("expected overflow id to fail")
		}
	})
}

func TestDecodeOptionalIDString(t *testing.T) {
	t.Parallel()

	t.Run("plain string", func(t *testing.T) {
		t.Parallel()

		got, provided, err := jsoncompat.DecodeOptionalIDString([]byte(`"FILE-1"`), "id")
		if err != nil || !provided || got != "FILE-1" {
			t.Fatalf("expected plain string id preserved, got value=%q provided=%v err=%v", got, provided, err)
		}
	})

	t.Run("large json number", func(t *testing.T) {
		t.Parallel()

		got, provided, err := jsoncompat.DecodeOptionalIDString([]byte(`904787325064802305`), "id")
		if err != nil || !provided || got != "904787325064802305" {
			t.Fatalf("expected large json number string preserved, got value=%q provided=%v err=%v", got, provided, err)
		}
	})

	t.Run("non integer number", func(t *testing.T) {
		t.Parallel()

		if _, _, err := jsoncompat.DecodeOptionalIDString([]byte(`42.5`), "id"); err == nil {
			t.Fatal("expected non integer numeric id to fail")
		}
	})
}

func TestIDHelpersFromAny(t *testing.T) {
	t.Parallel()

	number := json.Number("904787325064802305")
	tests := []struct {
		name      string
		value     any
		wantStr   string
		wantInt   int64
		wantIntOK bool
		wantErr   bool
	}{
		{name: "string", value: "FILE-1", wantStr: "FILE-1"},
		{name: "json.Number", value: number, wantStr: "904787325064802305", wantInt: 904787325064802305, wantIntOK: true},
		{name: "int64", value: int64(42), wantStr: "42", wantInt: 42, wantIntOK: true},
		{name: "uint64", value: uint64(43), wantStr: "43", wantInt: 43, wantIntOK: true},
		{name: "safe float64 integer", value: float64(44), wantStr: "44", wantInt: 44, wantIntOK: true},
		{name: "non integer float64", value: 44.5, wantErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			gotStr, _, err := jsoncompat.IDStringFromAny(tc.value, "id")
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected IDStringFromAny to fail")
				}
				return
			}
			if err != nil || gotStr != tc.wantStr {
				t.Fatalf("unexpected IDStringFromAny result value=%q err=%v", gotStr, err)
			}

			gotInt, _, err := jsoncompat.IDInt64FromAny(tc.value, "id")
			if tc.wantIntOK {
				if err != nil || gotInt == nil || *gotInt != tc.wantInt {
					t.Fatalf("unexpected IDInt64FromAny result value=%v err=%v", gotInt, err)
				}
				return
			}
			if err == nil {
				t.Fatalf("expected IDInt64FromAny to reject value %#v", tc.value)
			}
		})
	}
}

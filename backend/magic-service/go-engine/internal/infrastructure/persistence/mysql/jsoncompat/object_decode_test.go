package jsoncompat_test

import (
	"testing"

	"magic/internal/infrastructure/persistence/mysql/jsoncompat"
)

func TestDecodeObjectMap(t *testing.T) {
	t.Parallel()

	type testCase struct {
		name      string
		input     string
		wantLen   int
		wantError bool
	}

	cases := []testCase{
		{name: "null", input: "null", wantLen: 0},
		{name: "empty", input: "", wantLen: 0},
		{name: "space", input: "   ", wantLen: 0},
		{name: "object", input: `{"a":1}`, wantLen: 1},
		{name: "empty_object", input: `{}`, wantLen: 0},
		{name: "array", input: `[]`, wantLen: 0},
		{name: "string", input: `""`, wantLen: 0},
		{name: "number", input: `123`, wantLen: 0},
		{name: "bool", input: `true`, wantLen: 0},
		{name: "invalid", input: `{"a":`, wantError: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := jsoncompat.DecodeObjectMap([]byte(tc.input), "test_field")
			if tc.wantError {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Fatalf("DecodeObjectMap returned error: %v", err)
			}
			if len(got) != tc.wantLen {
				t.Fatalf("unexpected map length: got=%d want=%d", len(got), tc.wantLen)
			}
		})
	}
}

func TestDecodeObjectPtr(t *testing.T) {
	t.Parallel()

	type sample struct {
		Name string `json:"name"`
	}
	type testCase struct {
		name      string
		input     string
		wantNil   bool
		wantName  string
		wantError bool
	}

	cases := []testCase{
		{name: "null", input: "null", wantNil: true},
		{name: "empty", input: "", wantNil: true},
		{name: "space", input: "   ", wantNil: true},
		{name: "object", input: `{"name":"ok"}`, wantName: "ok"},
		{name: "empty_object", input: `{}`, wantName: ""},
		{name: "array", input: `[]`, wantNil: true},
		{name: "string", input: `""`, wantNil: true},
		{name: "number", input: `123`, wantNil: true},
		{name: "bool", input: `true`, wantNil: true},
		{name: "invalid", input: `{"name":`, wantError: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := jsoncompat.DecodeObjectPtr[sample]([]byte(tc.input), "test_field")
			if tc.wantError {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Fatalf("DecodeObjectPtr returned error: %v", err)
			}
			if tc.wantNil {
				if got != nil {
					t.Fatalf("expected nil pointer, got %#v", got)
				}
				return
			}

			if got == nil {
				t.Fatal("expected non-nil pointer, got nil")
			}
			if got.Name != tc.wantName {
				t.Fatalf("unexpected name: got=%q want=%q", got.Name, tc.wantName)
			}
		})
	}
}

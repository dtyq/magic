package jsoncompat_test

import (
	"encoding/json"
	"errors"
	"testing"

	"magic/internal/pkg/jsoncompat"
)

func TestUnmarshalObjectOrEmptyAcceptsObjectLikeInputs(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		payload string
		want    map[string]string
	}{
		{
			name:    "object",
			payload: `{"k":"v"}`,
			want:    map[string]string{"k": "v"},
		},
		{
			name:    "empty object",
			payload: `{}`,
			want:    map[string]string{},
		},
		{
			name:    "empty array",
			payload: `[]`,
			want:    map[string]string{},
		},
		{
			name:    "null",
			payload: `null`,
			want:    map[string]string{},
		},
		{
			name:    "empty string",
			payload: `""`,
			want:    map[string]string{},
		},
		{
			name:    "blank string",
			payload: `"   "`,
			want:    map[string]string{},
		},
		{
			name:    "string null marker",
			payload: `"null"`,
			want:    map[string]string{},
		},
		{
			name:    "string empty object marker",
			payload: `"{}"`,
			want:    map[string]string{},
		},
		{
			name:    "string empty array marker",
			payload: `"[]"`,
			want:    map[string]string{},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			assertUnmarshalObjectOrEmptyResult(t, tc.payload, tc.want)
		})
	}
}

func TestUnmarshalObjectOrEmptyRejectsInvalidInputs(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name    string
		payload string
	}{
		{name: "non-empty string invalid", payload: `"oops"`},
		{name: "non-empty array invalid", payload: `["x"]`},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := map[string]string{"seed": "value"}
			err := jsoncompat.UnmarshalObjectOrEmpty([]byte(tc.payload), map[string]string{}, &got)
			if !errors.Is(err, jsoncompat.ErrInvalidObjectCompatJSON) {
				t.Fatalf("expected error %v, got %v", jsoncompat.ErrInvalidObjectCompatJSON, err)
			}
		})
	}
}

func assertUnmarshalObjectOrEmptyResult(t *testing.T, payload string, want map[string]string) {
	t.Helper()

	got := map[string]string{"seed": "value"}
	if err := jsoncompat.UnmarshalObjectOrEmpty([]byte(payload), map[string]string{}, &got); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != len(want) {
		t.Fatalf("expected len=%d, got %d, value=%#v", len(want), len(got), got)
	}
	for k, wantValue := range want {
		if got[k] != wantValue {
			t.Fatalf("expected key %q=%q, got %#v", k, wantValue, got)
		}
	}
}

func TestUnmarshalObjectOrEmptySupportsStructTarget(t *testing.T) {
	t.Parallel()

	type payload struct {
		Enabled bool `json:"enabled"`
	}

	var got payload
	if err := jsoncompat.UnmarshalObjectOrEmpty([]byte(`{"enabled":true}`), payload{}, &got); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !got.Enabled {
		t.Fatalf("expected enabled=true, got %#v", got)
	}

	got = payload{Enabled: true}
	if err := jsoncompat.UnmarshalObjectOrEmpty([]byte(`[]`), payload{}, &got); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Enabled {
		t.Fatalf("expected zero-value struct after empty array fallback, got %#v", got)
	}
}

func TestUnmarshalObjectOrEmptyMatchesStdlibObjectDecode(t *testing.T) {
	t.Parallel()

	raw := []byte(`{"name":"demo","count":"1"}`)
	want := map[string]string{}
	if err := json.Unmarshal(raw, &want); err != nil {
		t.Fatalf("stdlib unmarshal failed: %v", err)
	}

	got := map[string]string{}
	if err := jsoncompat.UnmarshalObjectOrEmpty(raw, map[string]string{}, &got); err != nil {
		t.Fatalf("compat unmarshal failed: %v", err)
	}

	if len(got) != len(want) || got["name"] != want["name"] || got["count"] != want["count"] {
		t.Fatalf("expected %#v, got %#v", want, got)
	}
}

func TestUnmarshalObjectPtrOrNil(t *testing.T) {
	t.Parallel()

	type payload struct {
		Name string `json:"name"`
	}

	testCases := []struct {
		name    string
		payload string
		wantNil bool
		want    *payload
		wantErr error
	}{
		{
			name:    "object",
			payload: `{"name":"demo"}`,
			want:    &payload{Name: "demo"},
		},
		{
			name:    "empty array",
			payload: `[]`,
			wantNil: true,
		},
		{
			name:    "string empty array",
			payload: `"[]"`,
			wantNil: true,
		},
		{
			name:    "null",
			payload: `null`,
			wantNil: true,
		},
		{
			name:    "invalid scalar",
			payload: `1`,
			wantErr: jsoncompat.ErrInvalidObjectCompatJSON,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := jsoncompat.UnmarshalObjectPtrOrNil[payload]([]byte(tc.payload))
			if tc.wantErr != nil {
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("expected error %v, got %v", tc.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tc.wantNil {
				if got != nil {
					t.Fatalf("expected nil, got %#v", got)
				}
				return
			}
			if got == nil || *got != *tc.want {
				t.Fatalf("expected %#v, got %#v", tc.want, got)
			}
		})
	}
}

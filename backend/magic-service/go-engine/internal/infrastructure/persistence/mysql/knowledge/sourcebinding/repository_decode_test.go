package sourcebindingrepo_test

import (
	"testing"

	sourcebindingrepo "magic/internal/infrastructure/persistence/mysql/knowledge/sourcebinding"
)

func TestDecodeObjectMapCompat(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		payload []byte
		wantLen int
	}{
		{name: "null", payload: []byte("null"), wantLen: 0},
		{name: "empty array", payload: []byte("[]"), wantLen: 0},
		{name: "empty string", payload: []byte(`""`), wantLen: 0},
		{name: "object", payload: []byte(`{"key":"value"}`), wantLen: 1},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := sourcebindingrepo.DecodeObjectMapForTest(tc.payload)
			if len(got) != tc.wantLen {
				t.Fatalf("len(got) = %d, want %d", len(got), tc.wantLen)
			}
		})
	}
}

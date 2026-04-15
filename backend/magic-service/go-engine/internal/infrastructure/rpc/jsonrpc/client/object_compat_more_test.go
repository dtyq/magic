package client_test

import (
	"testing"

	ipcclient "magic/internal/infrastructure/rpc/jsonrpc/client"
)

func TestUnmarshalMagicAccessTokenDataForTestCompat(t *testing.T) {
	t.Parallel()
	runObjectCompatCasesForMap(
		t,
		ipcclient.UnmarshalMagicAccessTokenDataForTest,
		`{"access_token":"token"}`,
	)
}

func TestUnmarshalThirdPlatformDocumentFileForTestCompat(t *testing.T) {
	t.Parallel()
	runObjectCompatCasesForMap(
		t,
		ipcclient.UnmarshalThirdPlatformDocumentFileForTest,
		`{"id":"file-1"}`,
	)
}

func runObjectCompatCasesForMap[T any](
	t *testing.T,
	unmarshal func([]byte) (map[string]T, error),
	objectPayload string,
) {
	t.Helper()

	cases := []struct {
		name    string
		payload string
		wantLen int
		wantErr bool
	}{
		{name: "object", payload: objectPayload, wantLen: 1},
		{name: "empty array", payload: `[]`, wantLen: 0},
		{name: "null", payload: `null`, wantLen: 0},
		{name: "empty string", payload: `""`, wantLen: 0},
		{name: "blank string", payload: `"   "`, wantLen: 0},
		{name: "non empty string", payload: `"oops"`, wantErr: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := unmarshal([]byte(tc.payload))
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unmarshal() error = %v", err)
			}
			if len(got) != tc.wantLen {
				t.Fatalf("len(got) = %d, want %d", len(got), tc.wantLen)
			}
		})
	}
}

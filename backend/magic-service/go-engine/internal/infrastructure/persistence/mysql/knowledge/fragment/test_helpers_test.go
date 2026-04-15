package fragmentrepo_test

import (
	"testing"

	"magic/pkg/convert"
)

func mustInt32Repo(t *testing.T, value int) int32 {
	t.Helper()
	converted, err := convert.SafeIntToInt32(value, "value")
	if err != nil {
		t.Fatalf("SafeIntToInt32 failed: %v", err)
	}
	return converted
}

func mustUint64Repo(t *testing.T, value int) uint64 {
	t.Helper()
	converted, err := convert.SafeIntToUint64(value, "value")
	if err != nil {
		t.Fatalf("SafeIntToUint64 failed: %v", err)
	}
	return converted
}

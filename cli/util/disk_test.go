package util

import (
	"testing"
)

func TestHumanSize(t *testing.T) {
	tests := []struct {
		bytes uint64
		want  string
	}{
		{0, "0 Bytes"},
		{1, "1 Bytes"},
		{1023, "1023 Bytes"},
		{1024, "1.0 KiB"},
		{1124, "1.1 KiB"},
		{1024 * 1024, "1.0 MiB"},
		{1124 * 1024, "1.1 MiB"},
		{1024 * 1024 * 1024, "1.0 GiB"},
		{1024 * 1024 * 1024 * 1024, "1.0 TiB"},
		{1024 * 1024 * 1024 * 1024 * 1024, "1.0 PiB"},
		{1024 * 1024 * 1024 * 1024 * 1024 * 1024, "1.0 EiB"},
	}

	for _, test := range tests {
		got := HumanSize(test.bytes)
		if got != test.want {
			t.Errorf("HumanSize(%d) = %s, want %s", test.bytes, got, test.want)
		}
	}
}

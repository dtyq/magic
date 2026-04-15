package logkey_test

import (
	"testing"
	"time"

	"magic/internal/pkg/logkey"
)

func TestRoundDurationMS(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		in   float64
		want float64
	}{
		{
			name: "rounds up",
			in:   207.338917,
			want: 207.34,
		},
		{
			name: "rounds down",
			in:   207.331,
			want: 207.33,
		},
		{
			name: "zero",
			in:   0,
			want: 0,
		},
		{
			name: "negative",
			in:   -1.235,
			want: -1.24,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := logkey.RoundDurationMS(tt.in)
			if got != tt.want {
				t.Fatalf("RoundDurationMS(%v) = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}

func TestDurationToMS(t *testing.T) {
	t.Parallel()
	got := logkey.DurationToMS(time.Microsecond * 123456)
	const want = 123.46
	if got != want {
		t.Fatalf("DurationToMS() = %v, want %v", got, want)
	}
}

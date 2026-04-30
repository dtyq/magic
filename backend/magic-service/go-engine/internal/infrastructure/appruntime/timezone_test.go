package appruntime_test

import (
	"os"
	"testing"
	"time"

	"magic/internal/infrastructure/appruntime"
)

func TestSetProcessTimezone(t *testing.T) {
	originalLocal := time.Local
	originalTZ, hadTZ := os.LookupEnv("TZ")
	t.Cleanup(func() {
		time.Local = originalLocal
		if hadTZ {
			_ = os.Setenv("TZ", originalTZ)
			return
		}
		_ = os.Unsetenv("TZ")
	})

	if err := appruntime.SetProcessTimezone("Asia/Shanghai"); err != nil {
		t.Fatalf("SetProcessTimezone() error = %v", err)
	}

	if got := time.Local.String(); got != "Asia/Shanghai" {
		t.Fatalf("time.Local = %q, want %q", got, "Asia/Shanghai")
	}

	if got := os.Getenv("TZ"); got != "Asia/Shanghai" {
		t.Fatalf("TZ = %q, want %q", got, "Asia/Shanghai")
	}

	if _, offset := time.Now().Zone(); offset != 8*60*60 {
		t.Fatalf("time.Now() offset = %d, want %d", offset, 8*60*60)
	}
}

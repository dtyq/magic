package health_test

import (
	"context"
	"strings"
	"testing"

	"magic/internal/infrastructure/health"
)

type fakePing struct {
	err error
}

func (f fakePing) PingContext(ctx context.Context) error {
	return f.err
}

func TestMySQLHealthChecker(t *testing.T) {
	t.Parallel()
	checker := health.NewMySQLHealthChecker(fakePing{err: nil})
	if err := checker.HealthCheck(context.Background()); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
	checker = health.NewMySQLHealthChecker(fakePing{err: errBoom})
	if err := checker.HealthCheck(context.Background()); err == nil || !strings.Contains(err.Error(), "mysql ping failed") {
		t.Fatalf("unexpected error: %v", err)
	}
}

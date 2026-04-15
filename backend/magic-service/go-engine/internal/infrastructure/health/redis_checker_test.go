package health_test

import (
	"context"
	"strings"
	"testing"

	"magic/internal/infrastructure/health"
)

type fakePinger struct {
	err error
}

func (f fakePinger) Ping(ctx context.Context) error {
	return f.err
}

func TestRedisHealthChecker(t *testing.T) {
	t.Parallel()
	checker := health.NewRedisHealthChecker(fakePinger{err: nil})
	if err := checker.HealthCheck(context.Background()); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
	checker = health.NewRedisHealthChecker(fakePinger{err: errBoom})
	if err := checker.HealthCheck(context.Background()); err == nil || !strings.Contains(err.Error(), "redis ping failed") {
		t.Fatalf("unexpected error: %v", err)
	}
}

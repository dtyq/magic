package health_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"magic/internal/infrastructure/health"
)

type fakeChecker struct {
	err error
}

func (f fakeChecker) HealthCheck(ctx context.Context) error {
	return f.err
}

func TestCheckService_HealthCheck(t *testing.T) {
	t.Parallel()
	svc := health.NewHealthCheckService(map[string]health.Checker{
		"ok":  fakeChecker{err: nil},
		"bad": fakeChecker{err: errFail},
	})
	res, err := svc.HealthCheck(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res["ok"] != true || res["bad"] != false {
		t.Fatalf("unexpected results: %#v", res)
	}
}

func TestCheckService_HealthCheckDetailed(t *testing.T) {
	t.Parallel()
	svc := health.NewHealthCheckService(map[string]health.Checker{
		"ok":  fakeChecker{err: nil},
		"bad": fakeChecker{err: errFail},
	})
	results := svc.HealthCheckDetailed(context.Background())
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}
	for _, r := range results {
		if r.Timestamp.IsZero() {
			t.Fatalf("expected timestamp")
		}
	}
}

func TestCheckService_Close(t *testing.T) {
	t.Parallel()
	svc := health.NewHealthCheckService(nil)
	if err := svc.Close(context.Background()); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
	_ = time.Second
}

func TestCheckService_CloseRunsClosers(t *testing.T) {
	t.Parallel()
	closer := &fakeCloser{}
	svc := health.NewHealthCheckService(nil, closer)

	if err := svc.Close(context.Background()); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
	if !closer.closed {
		t.Fatal("expected closer to be called")
	}
}

func TestCheckService_CloseReturnsCloserError(t *testing.T) {
	t.Parallel()
	svc := health.NewHealthCheckService(nil, &fakeCloser{err: errFail})

	if err := svc.Close(context.Background()); !errors.Is(err, errFail) {
		t.Fatalf("expected closer error, got %v", err)
	}
}

type fakeCloser struct {
	closed bool
	err    error
}

func (f *fakeCloser) Close(context.Context) error {
	f.closed = true
	return f.err
}

package external_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"magic/internal/domain/knowledge/embedding"
	"magic/internal/infrastructure/external"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/ratelimit"
)

const testEmbeddingRateLimitKey = "embedding:compute"

type fakeEmbeddingClient struct {
	lastModel     string
	getCalls      int
	batchCalls    int
	providerCalls int
	err           error
}

func (f *fakeEmbeddingClient) GetEmbedding(ctx context.Context, input, model string, businessParams *ctxmeta.BusinessParams) ([]float64, error) {
	f.lastModel = model
	f.getCalls++
	if f.err != nil {
		return nil, f.err
	}
	return []float64{1, 2}, nil
}

func (f *fakeEmbeddingClient) GetBatchEmbeddings(ctx context.Context, inputs []string, model string, businessParams *ctxmeta.BusinessParams) ([][]float64, error) {
	f.lastModel = model
	f.batchCalls++
	if f.err != nil {
		return nil, f.err
	}
	return [][]float64{{1}, {2}}, nil
}

func (f *fakeEmbeddingClient) SetAccessToken(string) {}

func (f *fakeEmbeddingClient) ListProviders(ctx context.Context, businessParams *ctxmeta.BusinessParams) ([]*embedding.Provider, error) {
	f.providerCalls++
	if f.err != nil {
		return nil, f.err
	}
	return []*embedding.Provider{{ID: "p"}}, nil
}

type embeddingRateLimiterStub struct {
	calls   int
	key     string
	timeout time.Duration
	result  ratelimit.Result
	err     error
}

func (s *embeddingRateLimiterStub) Wait(_ context.Context, key string, timeout time.Duration) (ratelimit.Result, error) {
	s.calls++
	s.key = key
	s.timeout = timeout
	return s.result, s.err
}

func TestEmbeddingService_DefaultModel(t *testing.T) {
	t.Parallel()
	client := &fakeEmbeddingClient{}
	svc := external.NewEmbeddingService(client, "default")
	_, err := svc.GetEmbedding(context.Background(), "input", "", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if client.lastModel != "default" {
		t.Fatalf("expected default model, got %s", client.lastModel)
	}
}

func TestEmbeddingService_WrapError(t *testing.T) {
	t.Parallel()
	client := &fakeEmbeddingClient{err: errBoom}
	svc := external.NewEmbeddingService(client, "default")
	if _, err := svc.GetEmbedding(context.Background(), "input", "m", nil); err == nil || !strings.Contains(err.Error(), "get embedding") {
		t.Fatalf("expected wrapped error, got %v", err)
	}
}

func TestEmbeddingService_ListProviders(t *testing.T) {
	t.Parallel()
	client := &fakeEmbeddingClient{}
	svc := external.NewEmbeddingService(client, "default")
	providers, err := svc.ListProviders(context.Background(), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(providers) != 1 || providers[0].ID != "p" {
		t.Fatalf("unexpected providers: %#v", providers)
	}
}

func TestEmbeddingService_GetBatchEmbeddings(t *testing.T) {
	t.Parallel()
	client := &fakeEmbeddingClient{}
	svc := external.NewEmbeddingService(client, "default")

	embeddings, err := svc.GetBatchEmbeddings(context.Background(), []string{"a", "b"}, "", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if client.lastModel != "default" {
		t.Fatalf("expected default model, got %s", client.lastModel)
	}
	if len(embeddings) != 2 {
		t.Fatalf("unexpected embeddings: %#v", embeddings)
	}

	client.err = errBoom
	if _, err := svc.GetBatchEmbeddings(context.Background(), []string{"a"}, "m", nil); err == nil || !strings.Contains(err.Error(), "get batch embeddings") {
		t.Fatalf("expected wrapped error, got %v", err)
	}
}

func TestEmbeddingServiceWaitsForRateLimitBeforeGetEmbedding(t *testing.T) {
	t.Parallel()

	client := &fakeEmbeddingClient{}
	limiter := &embeddingRateLimiterStub{result: ratelimit.Result{Allowed: true}}
	svc := external.NewEmbeddingService(client, "default")
	svc.SetRateLimiter(limiter, external.EmbeddingRateLimitConfig{
		Key:         testEmbeddingRateLimitKey,
		WaitTimeout: 10 * time.Second,
	})

	_, err := svc.GetEmbedding(context.Background(), "input", "", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if limiter.calls != 1 || limiter.key != testEmbeddingRateLimitKey || limiter.timeout != 10*time.Second {
		t.Fatalf("unexpected limiter call count=%d key=%q timeout=%s", limiter.calls, limiter.key, limiter.timeout)
	}
	if client.getCalls != 1 {
		t.Fatalf("expected one embedding call, got %d", client.getCalls)
	}
}

func TestEmbeddingServiceWaitsOnceForRateLimitBeforeBatch(t *testing.T) {
	t.Parallel()

	client := &fakeEmbeddingClient{}
	limiter := &embeddingRateLimiterStub{result: ratelimit.Result{Allowed: true}}
	svc := external.NewEmbeddingService(client, "default")
	svc.SetRateLimiter(limiter, external.EmbeddingRateLimitConfig{Key: testEmbeddingRateLimitKey})

	_, err := svc.GetBatchEmbeddings(context.Background(), []string{"a", "b", "c"}, "", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if limiter.calls != 1 {
		t.Fatalf("expected one limiter call for one batch request, got %d", limiter.calls)
	}
	if client.batchCalls != 1 {
		t.Fatalf("expected one batch embedding call, got %d", client.batchCalls)
	}
}

func TestEmbeddingServiceRateLimitTimeoutSkipsClient(t *testing.T) {
	t.Parallel()

	client := &fakeEmbeddingClient{}
	limiter := &embeddingRateLimiterStub{err: ratelimit.ErrWaitTimeout}
	svc := external.NewEmbeddingService(client, "default")
	svc.SetRateLimiter(limiter, external.EmbeddingRateLimitConfig{Key: testEmbeddingRateLimitKey})

	_, err := svc.GetEmbedding(context.Background(), "input", "", nil)
	if err == nil {
		t.Fatal("expected error")
	}
	if !errors.Is(err, ratelimit.ErrWaitTimeout) {
		t.Fatalf("expected ErrWaitTimeout in error chain, got %v", err)
	}
	if client.getCalls != 0 {
		t.Fatalf("expected client call to be skipped after limiter timeout, got %d", client.getCalls)
	}
}

func TestEmbeddingServiceListProvidersSkipsRateLimiter(t *testing.T) {
	t.Parallel()

	client := &fakeEmbeddingClient{}
	limiter := &embeddingRateLimiterStub{err: ratelimit.ErrWaitTimeout}
	svc := external.NewEmbeddingService(client, "default")
	svc.SetRateLimiter(limiter, external.EmbeddingRateLimitConfig{Key: testEmbeddingRateLimitKey})

	providers, err := svc.ListProviders(context.Background(), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(providers) != 1 {
		t.Fatalf("unexpected providers: %#v", providers)
	}
	if limiter.calls != 0 {
		t.Fatalf("expected ListProviders not to wait on limiter, got %d calls", limiter.calls)
	}
	if client.providerCalls != 1 {
		t.Fatalf("expected one provider call, got %d", client.providerCalls)
	}
}

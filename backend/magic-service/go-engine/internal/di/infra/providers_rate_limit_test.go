package infra_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	miniredis "github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/di/infra"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/infrastructure/external"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ratelimit"
)

const embeddingDefaultBurst = 30

func TestProvideEmbeddingServiceRateLimitToggle(t *testing.T) {
	t.Parallel()

	var calls atomic.Int32
	factory := newEmbeddingClientFactoryForTest(t, &calls)
	logger := logging.New()

	disabled := infra.ProvideEmbeddingService(&autoloadcfg.Config{}, nil, factory, "default", logger)
	if _, err := disabled.GetEmbedding(context.Background(), "input", "", nil); err != nil {
		t.Fatalf("disabled limiter should call embedding client: %v", err)
	}
	if calls.Load() != 1 {
		t.Fatalf("expected disabled limiter to call embedding client once, got %d", calls.Load())
	}

	enabledCfg := &autoloadcfg.Config{}
	enabledCfg.Embedding.RateLimitEnabled = true
	enabled := infra.ProvideEmbeddingService(enabledCfg, nil, factory, "default", logger)
	_, err := enabled.GetEmbedding(context.Background(), "input", "", nil)
	if !errors.Is(err, ratelimit.ErrUnavailable) {
		t.Fatalf("expected unavailable limiter error, got %v", err)
	}
	if calls.Load() != 1 {
		t.Fatalf("expected unavailable limiter to skip embedding client, got %d calls", calls.Load())
	}
}

func TestProvideEmbeddingServiceDefaultRateLimitBurst(t *testing.T) {
	t.Parallel()

	var calls atomic.Int32
	factory := newEmbeddingClientFactoryForTest(t, &calls)
	redisServer, redisClient := newRateLimitRedis(t)
	redisServer.SetTime(time.Unix(1_800_000_000, 0))

	cfg := &autoloadcfg.Config{}
	cfg.Embedding.RateLimitEnabled = true
	service := infra.ProvideEmbeddingService(cfg, redisClient, factory, "default", logging.New())

	for range embeddingDefaultBurst {
		if _, err := service.GetEmbedding(context.Background(), "input", "", nil); err != nil {
			t.Fatalf("expected default burst request to pass: %v", err)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond)
	defer cancel()
	_, err := service.GetEmbedding(ctx, "input", "", nil)
	if err == nil {
		t.Fatal("expected request after default burst to wait and fail with context timeout")
	}
	if calls.Load() != embeddingDefaultBurst {
		t.Fatalf("expected request after burst not to call embedding client, got %d calls", calls.Load())
	}
}

func TestProvideVolcengineOCRClientHardRateLimitCannotBeDisabled(t *testing.T) {
	t.Parallel()

	redisServer, redisClient := newRateLimitRedis(t)
	redisServer.SetTime(time.Unix(1_800_000_000, 0))

	cfg := &autoloadcfg.Config{}
	cfg.OCR.RateLimitEnabled = false
	cfg.OCR.RateLimitQPS = 100
	cfg.OCR.RateLimitBurst = 100
	client := infra.ProvideVolcengineOCRClient(cfg, redisClient, ocrConfigProviderForTest{}, nil, nil, logging.New())

	var calls atomic.Int32
	client.SetInvokeHookForTest(func(context.Context, string, string) (string, error) {
		calls.Add(1)
		return "ok", nil
	})

	if _, err := client.OCR(context.Background(), "https://example.com/demo.pdf", "pdf"); err != nil {
		t.Fatalf("first OCR call should pass: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond)
	defer cancel()
	_, err := client.OCR(ctx, "https://example.com/demo.pdf", "pdf")
	if err == nil {
		t.Fatal("expected second OCR call to be blocked by hard limiter")
	}
	if !documentdomain.IsOCROverloaded(err) {
		t.Fatalf("expected OCR overload error, got %v", err)
	}
	if calls.Load() != 1 {
		t.Fatalf("expected second OCR call not to invoke provider, got %d calls", calls.Load())
	}
}

func TestProvideVolcengineOCRClientRedisUnavailableSkipsInvoke(t *testing.T) {
	t.Parallel()

	cfg := &autoloadcfg.Config{}
	cfg.OCR.RateLimitEnabled = false
	client := infra.ProvideVolcengineOCRClient(cfg, nil, ocrConfigProviderForTest{}, nil, nil, logging.New())

	var calls atomic.Int32
	client.SetInvokeHookForTest(func(context.Context, string, string) (string, error) {
		calls.Add(1)
		return "ok", nil
	})

	_, err := client.OCR(context.Background(), "https://example.com/demo.pdf", "pdf")
	if err == nil {
		t.Fatal("expected limiter unavailable error")
	}
	if !errors.Is(err, ratelimit.ErrUnavailable) || !documentdomain.IsOCROverloaded(err) {
		t.Fatalf("expected unavailable OCR overload error, got %v", err)
	}
	if calls.Load() != 0 {
		t.Fatalf("expected OCR invoke to be skipped when limiter is unavailable, got %d calls", calls.Load())
	}
}

type ocrConfigProviderForTest struct{}

func (ocrConfigProviderForTest) GetOCRConfig(context.Context) (*documentdomain.OCRAbilityConfig, error) {
	return &documentdomain.OCRAbilityConfig{
		Enabled:      true,
		ProviderCode: documentdomain.OCRProviderVolcengine,
		Providers: []documentdomain.OCRProviderConfig{
			{
				Provider:  documentdomain.OCRProviderVolcengine,
				Enable:    true,
				AccessKey: "ak",
				SecretKey: "sk",
			},
		},
	}, nil
}

func newEmbeddingClientFactoryForTest(t *testing.T, calls *atomic.Int32) *external.EmbeddingClientFactory {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/embeddings" {
			t.Fatalf("unexpected embedding path: %s", r.URL.Path)
		}
		calls.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"embedding":[1]}]}`))
	}))
	t.Cleanup(server.Close)

	return external.NewEmbeddingClientFactory(
		nil,
		server.URL,
		external.EmbeddingClientTypeOpenAI,
		logging.New(),
		nil,
	)
}

func newRateLimitRedis(t *testing.T) (*miniredis.Miniredis, *redis.Client) {
	t.Helper()

	server, err := miniredis.Run()
	if err != nil {
		t.Fatalf("start miniredis: %v", err)
	}
	t.Cleanup(server.Close)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	return server, client
}

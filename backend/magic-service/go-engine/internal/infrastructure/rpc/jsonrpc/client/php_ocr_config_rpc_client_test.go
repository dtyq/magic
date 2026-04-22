package client_test

import (
	"context"
	"errors"
	"testing"
	"time"

	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/infrastructure/logging"
	client "magic/internal/infrastructure/rpc/jsonrpc/client"
)

func TestPHPOCRConfigRPCClientGetOCRConfigNoClient(t *testing.T) {
	t.Parallel()

	ocrClient := client.NewPHPOCRConfigRPCClient(nil, logging.New())
	_, err := ocrClient.GetOCRConfig(context.Background())
	if !errors.Is(err, client.ErrNoClientConnected) {
		t.Fatalf("expected ErrNoClientConnected, got %v", err)
	}
}

func TestPHPOCRConfigRPCClientGetOCRConfigCaches(t *testing.T) {
	t.Parallel()

	ocrClient := client.NewPHPOCRConfigRPCClient(nil, logging.New())
	now := time.Now()
	callCount := 0
	ocrClient.SetTTLForTest(time.Minute)
	ocrClient.SetNowHookForTest(func() time.Time { return now })
	ocrClient.SetClientReadyHookForTest(func() bool { return true })
	ocrClient.SetFetchHookForTest(func(_ context.Context) (*documentdomain.OCRAbilityConfig, error) {
		callCount++
		return &documentdomain.OCRAbilityConfig{
			Enabled:      true,
			ProviderCode: "Volcengine",
			Providers: []documentdomain.OCRProviderConfig{
				{Provider: "Volcengine", Enable: true, AccessKey: "ak", SecretKey: "sk"},
			},
		}, nil
	})

	cfg1, err := ocrClient.GetOCRConfig(context.Background())
	if err != nil {
		t.Fatalf("first GetOCRConfig returned error: %v", err)
	}
	cfg2, err := ocrClient.GetOCRConfig(context.Background())
	if err != nil {
		t.Fatalf("second GetOCRConfig returned error: %v", err)
	}
	if callCount != 1 {
		t.Fatalf("expected 1 rpc call, got %d", callCount)
	}
	if cfg1 == cfg2 {
		t.Fatalf("expected cloned configs, got same pointer")
	}
	if cfg1.ProviderCode != documentdomain.OCRProviderVolcengine || len(cfg2.Providers) != 1 {
		t.Fatalf("unexpected configs: %#v %#v", cfg1, cfg2)
	}

	now = now.Add(2 * time.Minute)
	if _, err := ocrClient.GetOCRConfig(context.Background()); err != nil {
		t.Fatalf("expired GetOCRConfig returned error: %v", err)
	}
	if callCount != 2 {
		t.Fatalf("expected cache miss after ttl, got %d calls", callCount)
	}
}

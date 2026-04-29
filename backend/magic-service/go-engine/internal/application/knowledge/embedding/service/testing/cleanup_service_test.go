package embedapp_test

import (
	"testing"
	"time"

	embeddingapp "magic/internal/application/knowledge/embedding/service"
	"magic/internal/domain/knowledge/embedding"
	"magic/internal/infrastructure/logging"
	lockpkg "magic/internal/pkg/lock"
)

func TestDefaultCleanupConfig(t *testing.T) {
	t.Parallel()

	cfg := embeddingapp.DefaultCleanupConfig()
	if cfg.CleanupInterval != 24*time.Hour {
		t.Fatalf("expected 24h interval, got %v", cfg.CleanupInterval)
	}
	if cfg.CleanupTimeout != 30*time.Minute {
		t.Fatalf("expected 30m timeout, got %v", cfg.CleanupTimeout)
	}
	if !cfg.AutoCleanupEnabled {
		t.Fatal("expected auto cleanup enabled")
	}
	if cfg.CleanupCriteria == nil || cfg.CleanupCriteria.BatchSize == 0 {
		t.Fatalf("expected cleanup criteria initialized, got %#v", cfg.CleanupCriteria)
	}
}

func TestNewEmbeddingCacheCleanupServiceUsesDefaultConfig(t *testing.T) {
	t.Parallel()

	svc, err := embeddingapp.NewEmbeddingCacheCleanupService(nil, nil, lockpkg.NewLocalSinglePodJobRunner(), logging.New())
	if err != nil {
		t.Fatalf("new cleanup service: %v", err)
	}
	if svc == nil || svc.GetCleanupConfig() == nil {
		t.Fatalf("expected service with config, got %#v", svc)
	}
}

func TestCleanupResultString(t *testing.T) {
	t.Parallel()

	result := &embeddingapp.CleanupResult{
		DeletedCount: 2,
		Duration:     2 * time.Second,
		BeforeStats:  &embedding.CacheStatistics{StorageSizeBytes: 10 * embedding.BytesPerMB},
		AfterStats:   &embedding.CacheStatistics{StorageSizeBytes: 4 * embedding.BytesPerMB},
	}

	got := result.String()
	want := "Deleted 2 entries in 2s (10.00 MB → 4.00 MB, saved 6.00 MB)"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestUpdateAndGetCleanupConfig(t *testing.T) {
	t.Parallel()

	svc, err := embeddingapp.NewEmbeddingCacheCleanupService(nil, nil, lockpkg.NewLocalSinglePodJobRunner(), logging.New())
	if err != nil {
		t.Fatalf("new cleanup service: %v", err)
	}
	oldCfg := svc.GetCleanupConfig()
	newCfg := &embeddingapp.CleanupConfig{CleanupInterval: time.Hour}

	svc.UpdateCleanupConfig(nil)
	if svc.GetCleanupConfig() != oldCfg {
		t.Fatal("expected nil config update to be ignored")
	}
	svc.UpdateCleanupConfig(newCfg)
	if svc.GetCleanupConfig() != newCfg {
		t.Fatal("expected config to be replaced")
	}
}

package app_test

import (
	"testing"

	autoloadcfg "magic/internal/config/autoload"
	diapp "magic/internal/di/app"
)

func TestProvideEmbeddingDefaultModel_UsesDefaultWhenEmpty(t *testing.T) {
	t.Parallel()
	cfg := &autoloadcfg.Config{}
	model := diapp.ProvideEmbeddingDefaultModel(cfg)
	if model != autoloadcfg.EmbeddingDefaultModel("text-embedding-3-small") {
		t.Fatalf("expected default model, got %q", model)
	}
}

func TestProvideEmbeddingDefaultModel_UsesConfigValue(t *testing.T) {
	t.Parallel()
	cfg := &autoloadcfg.Config{
		MagicModelGateway: autoloadcfg.MagicModelGatewayConfig{
			DefaultEmbeddingModel: "text-embedding-3-large",
		},
	}
	model := diapp.ProvideEmbeddingDefaultModel(cfg)
	if model != autoloadcfg.EmbeddingDefaultModel("text-embedding-3-large") {
		t.Fatalf("expected config model, got %q", model)
	}
}

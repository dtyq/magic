package shared_test

import (
	"testing"

	"magic/internal/domain/knowledge/shared"
)

func TestDefaultRetrieveConfigMatchesPHPDefaults(t *testing.T) {
	t.Parallel()

	cfg := shared.DefaultRetrieveConfig()
	if cfg == nil {
		t.Fatal("expected default retrieve config")
	}
	if cfg.Version != 1 || cfg.SearchMethod != "hybrid_search" || cfg.TopK != 10 {
		t.Fatalf("unexpected basic defaults: %#v", cfg)
	}
	if cfg.ScoreThreshold != 0.5 || cfg.ScoreThresholdEnabled {
		t.Fatalf("unexpected threshold defaults: %#v", cfg)
	}
	if cfg.RerankingMode != "weighted_score" || cfg.RerankingEnable {
		t.Fatalf("unexpected reranking defaults: %#v", cfg)
	}
	assertDefaultRetrieveWeights(t, cfg)
	assertDefaultRerankingModel(t, cfg)
}

func assertDefaultRetrieveWeights(t *testing.T, cfg *shared.RetrieveConfig) {
	t.Helper()

	if cfg.Weights == nil || cfg.Weights.VectorSetting == nil || cfg.Weights.KeywordSetting == nil || cfg.Weights.GraphSetting == nil {
		t.Fatalf("expected complete default weights, got %#v", cfg.Weights)
	}
	if cfg.Weights.VectorSetting.VectorWeight != 0.75 || cfg.Weights.KeywordSetting.KeywordWeight != 0.25 {
		t.Fatalf("unexpected vector/keyword weights: %#v", cfg.Weights)
	}
	if cfg.Weights.GraphSetting.RelationWeight != 0.5 || cfg.Weights.GraphSetting.MaxDepth != 2 {
		t.Fatalf("unexpected graph weights: %#v", cfg.Weights.GraphSetting)
	}
	if !cfg.Weights.GraphSetting.IncludeProperties || cfg.Weights.GraphSetting.Timeout != 5 || cfg.Weights.GraphSetting.RetryCount != 3 {
		t.Fatalf("unexpected graph execution defaults: %#v", cfg.Weights.GraphSetting)
	}
}

func assertDefaultRerankingModel(t *testing.T, cfg *shared.RetrieveConfig) {
	t.Helper()

	if cfg.RerankingModel == nil || cfg.RerankingModel.RerankingModelName != "" || cfg.RerankingModel.RerankingProviderName != "" {
		t.Fatalf("unexpected reranking model defaults: %#v", cfg.RerankingModel)
	}
}

func TestDefaultFragmentConfigUsesAutoSemantic(t *testing.T) {
	t.Parallel()

	cfg := shared.DefaultFragmentConfig()
	if cfg == nil {
		t.Fatal("expected default fragment config")
	}
	if cfg.Mode != shared.FragmentModeAuto {
		t.Fatalf("expected auto fragment mode, got %#v", cfg)
	}
	if cfg.Normal != nil || cfg.Hierarchy != nil {
		t.Fatalf("expected empty auto config, got %#v", cfg)
	}
}

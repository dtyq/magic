package shared

const (
	defaultRetrieveConfigVersion        = 1
	defaultRetrieveConfigSearchMethod   = "hybrid_search"
	defaultRetrieveConfigTopK           = 10
	defaultRetrieveConfigScoreThreshold = 0.5
	defaultRetrieveConfigRerankingMode  = "weighted_score"
	defaultGraphRelationWeight          = 0.5
	defaultGraphMaxDepth                = 2
	defaultGraphTimeout                 = 5.0
	defaultGraphRetryCount              = 3
)

// CloneRetrieveConfig 深拷贝检索配置。
func CloneRetrieveConfig(cfg *RetrieveConfig) *RetrieveConfig {
	if cfg == nil {
		return nil
	}

	cloned := *cfg
	if cfg.Weights != nil {
		weights := *cfg.Weights
		if cfg.Weights.VectorSetting != nil {
			vectorSetting := *cfg.Weights.VectorSetting
			weights.VectorSetting = &vectorSetting
		}
		if cfg.Weights.KeywordSetting != nil {
			keywordSetting := *cfg.Weights.KeywordSetting
			weights.KeywordSetting = &keywordSetting
		}
		if cfg.Weights.GraphSetting != nil {
			graphSetting := *cfg.Weights.GraphSetting
			weights.GraphSetting = &graphSetting
		}
		cloned.Weights = &weights
	}
	if cfg.RerankingModel != nil {
		rerankingModel := *cfg.RerankingModel
		cloned.RerankingModel = &rerankingModel
	}
	return &cloned
}

// DefaultRetrieveConfig 返回知识库默认检索配置。
func DefaultRetrieveConfig() *RetrieveConfig {
	return &RetrieveConfig{
		Version:               defaultRetrieveConfigVersion,
		SearchMethod:          defaultRetrieveConfigSearchMethod,
		TopK:                  defaultRetrieveConfigTopK,
		ScoreThreshold:        defaultRetrieveConfigScoreThreshold,
		ScoreThresholdEnabled: false,
		RerankingMode:         defaultRetrieveConfigRerankingMode,
		RerankingEnable:       false,
		Weights: &RetrieveWeights{
			VectorSetting: &VectorWeightSetting{
				VectorWeight:          1.0,
				EmbeddingModelName:    "",
				EmbeddingProviderName: "",
			},
			KeywordSetting: &KeywordWeightSetting{
				KeywordWeight: 0.0,
			},
			GraphSetting: &GraphWeightSetting{
				RelationWeight:    defaultGraphRelationWeight,
				MaxDepth:          defaultGraphMaxDepth,
				IncludeProperties: true,
				Timeout:           defaultGraphTimeout,
				RetryCount:        defaultGraphRetryCount,
			},
		},
		RerankingModel: &RerankingModelConfig{
			RerankingModelName:    "",
			RerankingProviderName: "",
		},
	}
}

// DefaultFragmentConfig 返回知识库默认切片配置。
func DefaultFragmentConfig() *FragmentConfig {
	return &FragmentConfig{
		Mode: FragmentModeAuto,
	}
}

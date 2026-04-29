package shared

import (
	"encoding/json"
)

// CloneEmbeddingConfig 深拷贝 embedding 配置。
func CloneEmbeddingConfig(cfg *EmbeddingConfig) *EmbeddingConfig {
	if cfg == nil {
		return nil
	}

	cloned := &EmbeddingConfig{
		ModelID: cfg.ModelID,
	}
	if len(cfg.Extra) > 0 {
		cloned.Extra = make(map[string]json.RawMessage, len(cfg.Extra))
		for key, value := range cfg.Extra {
			cloned.Extra[key] = append(json.RawMessage(nil), value...)
		}
	}
	return cloned
}

package retrieval

import (
	"hash/fnv"
	"os"
	"strconv"
	"strings"
)

const (
	defaultRolloutEnabled = true
	defaultRolloutPercent = 100
	rolloutEnabledEnvKey  = "RAG_RETRIEVAL_ENHANCE_ENABLED"
	rolloutPercentEnvKey  = "RAG_RETRIEVAL_ENHANCE_ROLLOUT_PERCENT"
)

func isEnhancedRetrievalEnabled(kb knowledgeBaseRuntimeSnapshot) bool {
	if !resolveRolloutEnabled() {
		return false
	}
	percent := resolveRolloutPercent()
	if percent <= 0 {
		return false
	}
	if percent >= 100 {
		return true
	}
	if kb.Code == "" && kb.Name == "" {
		return true
	}
	key := strings.TrimSpace(kb.Code)
	if key == "" {
		key = strings.TrimSpace(kb.Name)
	}
	if key == "" {
		return true
	}
	return bucketForKey(key) < percent
}

func resolveRolloutEnabled() bool {
	raw := strings.TrimSpace(os.Getenv(rolloutEnabledEnvKey))
	if raw == "" {
		return defaultRolloutEnabled
	}
	enabled, err := strconv.ParseBool(raw)
	if err == nil {
		return enabled
	}
	switch strings.ToLower(raw) {
	case "0", "off", "disable", "disabled":
		return false
	default:
		return defaultRolloutEnabled
	}
}

func resolveRolloutPercent() int {
	raw := strings.TrimSpace(os.Getenv(rolloutPercentEnvKey))
	if raw == "" {
		return defaultRolloutPercent
	}
	percent, err := strconv.Atoi(raw)
	if err != nil {
		return defaultRolloutPercent
	}
	return max(0, min(100, percent))
}

func bucketForKey(key string) int {
	hasher := fnv.New32a()
	_, _ = hasher.Write([]byte(key))
	return int(hasher.Sum32() % 100)
}

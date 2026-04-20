package autoload

import (
	"net/url"
	"strings"
)

// QdrantConfig 保存 Qdrant gRPC 连接设置。
type QdrantConfig struct {
	BaseURI             string `json:"base_uri,omitempty"`
	Host                string `json:"host"`
	Port                int    `json:"port"`
	AuthValue           string `mapstructure:"apiKey" json:"auth_value,omitempty"`
	TargetSparseBackend string `json:"target_sparse_backend,omitempty"`
	MaxConcurrentWrites int    `json:"max_concurrent_writes,omitempty"`
	LogTimingEnabled    bool   `json:"log_timing_enabled,omitempty"`
	LogSlowThresholdMs  int    `json:"log_slow_threshold_ms,omitempty"`
	// gRPC 连接设置
	KeepAliveTime    int `json:"keepalive_time"`
	KeepAliveTimeout int `json:"keepalive_timeout"`
	MaxMessageSizeMB int `json:"max_message_size_mb"`
}

// EffectiveHost 返回 Qdrant 最终连接 Host。
// 若 base_uri 可解析出 host，则优先使用该 host；否则回退 host 字段。
func (c QdrantConfig) EffectiveHost() string {
	if parsedHost := resolveHostFromBaseURI(c.BaseURI); parsedHost != "" {
		return parsedHost
	}
	return strings.TrimSpace(c.Host)
}

func resolveHostFromBaseURI(baseURI string) string {
	uri := strings.TrimSpace(baseURI)
	if uri == "" {
		return ""
	}

	candidates := []string{uri}
	if !strings.Contains(uri, "://") {
		candidates = append(candidates, "http://"+uri)
	}

	for _, candidate := range candidates {
		parsed, err := url.Parse(candidate)
		if err != nil {
			continue
		}
		if host := strings.TrimSpace(parsed.Hostname()); host != "" {
			return host
		}
	}

	return ""
}

package infra_test

import (
	"testing"

	autoloadcfg "magic/internal/config/autoload"
	diinfra "magic/internal/di/infra"
)

func TestResolveQdrantEndpointPreferBaseURIHost(t *testing.T) {
	t.Parallel()

	cfg := autoloadcfg.QdrantConfig{
		BaseURI:   "http://10.0.0.2:6333",
		Host:      "localhost",
		Port:      6334,
		AuthValue: "odin-key",
	}

	host, port, apiKey := diinfra.ResolveQdrantEndpointForTest(cfg)
	if host != "10.0.0.2" {
		t.Fatalf("expected host 10.0.0.2, got %q", host)
	}
	if port != 6334 {
		t.Fatalf("expected port 6334, got %d", port)
	}
	if apiKey != "odin-key" {
		t.Fatalf("expected apiKey odin-key, got %q", apiKey)
	}
}

func TestResolveQdrantEndpointFallbackToHostWhenBaseURIMissing(t *testing.T) {
	t.Parallel()

	cfg := autoloadcfg.QdrantConfig{
		Host: "qdrant.internal",
		Port: 6334,
	}

	host, _, _ := diinfra.ResolveQdrantEndpointForTest(cfg)
	if host != "qdrant.internal" {
		t.Fatalf("expected fallback host qdrant.internal, got %q", host)
	}
}

func TestResolveQdrantEndpointFallbackToHostWhenBaseURIInvalid(t *testing.T) {
	t.Parallel()

	cfg := autoloadcfg.QdrantConfig{
		BaseURI: "://invalid-uri",
		Host:    "fallback-host",
		Port:    6334,
	}

	host, _, _ := diinfra.ResolveQdrantEndpointForTest(cfg)
	if host != "fallback-host" {
		t.Fatalf("expected fallback host fallback-host, got %q", host)
	}
}

func TestResolveQdrantEndpointFallbackLegacyAPIKey(t *testing.T) {
	t.Setenv("QDRANT_API_KEY", "legacy-key")

	cfg := autoloadcfg.QdrantConfig{
		BaseURI:   "http://10.0.0.2:6333",
		Host:      "localhost",
		Port:      6334,
		AuthValue: "",
	}

	_, _, apiKey := diinfra.ResolveQdrantEndpointForTest(cfg)
	if apiKey != "legacy-key" {
		t.Fatalf("expected fallback api key legacy-key, got %q", apiKey)
	}
}

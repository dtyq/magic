package autoload_test

import (
	"testing"

	autoloadcfg "magic/internal/config/autoload"
)

func TestQdrantConfigEffectiveHost(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		cfg  autoloadcfg.QdrantConfig
		want string
	}{
		{
			name: "prefer host parsed from base uri",
			cfg: autoloadcfg.QdrantConfig{
				BaseURI: "http://10.0.0.2:6333",
				Host:    "localhost",
			},
			want: "10.0.0.2",
		},
		{
			name: "parse host from base uri without scheme",
			cfg: autoloadcfg.QdrantConfig{
				BaseURI: "10.0.0.2:6333",
				Host:    "localhost",
			},
			want: "10.0.0.2",
		},
		{
			name: "fallback to host when base uri invalid",
			cfg: autoloadcfg.QdrantConfig{
				BaseURI: "://invalid-uri",
				Host:    "fallback-host",
			},
			want: "fallback-host",
		},
		{
			name: "parse ipv6 host from base uri",
			cfg: autoloadcfg.QdrantConfig{
				BaseURI: "http://[::1]:6333",
				Host:    "fallback-host",
			},
			want: "::1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := tt.cfg.EffectiveHost()
			if got != tt.want {
				t.Fatalf("EffectiveHost() = %q, want %q", got, tt.want)
			}
		})
	}
}

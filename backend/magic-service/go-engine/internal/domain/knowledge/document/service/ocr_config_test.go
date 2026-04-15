package document_test

import (
	"errors"
	"testing"

	documentdomain "magic/internal/domain/knowledge/document/service"
)

func TestOCRAbilityConfigResolveVolcengineConfig(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name string
		cfg  *documentdomain.OCRAbilityConfig
	}{
		{
			name: "explicit provider code",
			cfg: &documentdomain.OCRAbilityConfig{
				Enabled:      true,
				ProviderCode: "Volcengine",
				Providers: []documentdomain.OCRProviderConfig{
					{
						Provider:  "Volcengine",
						Enable:    true,
						AccessKey: "ak",
						SecretKey: "sk",
					},
				},
			},
		},
		{
			name: "fallback to enabled provider when provider code missing",
			cfg: &documentdomain.OCRAbilityConfig{
				Enabled: true,
				Providers: []documentdomain.OCRProviderConfig{
					{
						Provider:  "Volcengine",
						Enable:    true,
						AccessKey: "ak",
						SecretKey: "sk",
					},
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ocrConfig, provider, err := tc.cfg.ResolveVolcengineConfig()
			if err != nil {
				t.Fatalf("ResolveVolcengineConfig returned error: %v", err)
			}
			if provider != documentdomain.OCRProviderVolcengine {
				t.Fatalf("unexpected provider: %q", provider)
			}
			if ocrConfig == nil || ocrConfig.Identity != "ak" || ocrConfig.Signature != "sk" {
				t.Fatalf("unexpected config: %#v", ocrConfig)
			}
		})
	}
}

func TestOCRAbilityConfigResolveVolcengineConfig_Errors(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name string
		cfg  *documentdomain.OCRAbilityConfig
		want error
	}{
		{
			name: "disabled",
			cfg:  &documentdomain.OCRAbilityConfig{},
			want: documentdomain.ErrOCRDisabled,
		},
		{
			name: "unsupported provider code",
			cfg: &documentdomain.OCRAbilityConfig{
				Enabled:      true,
				ProviderCode: "Official",
			},
			want: documentdomain.ErrOCRProviderUnsupported,
		},
		{
			name: "missing enabled provider",
			cfg: &documentdomain.OCRAbilityConfig{
				Enabled:      true,
				ProviderCode: "Volcengine",
				Providers: []documentdomain.OCRProviderConfig{
					{Provider: "Volcengine", Enable: false, AccessKey: "ak", SecretKey: "sk"},
				},
			},
			want: documentdomain.ErrOCRProviderNotFound,
		},
		{
			name: "missing credentials",
			cfg: &documentdomain.OCRAbilityConfig{
				Enabled:      true,
				ProviderCode: "Volcengine",
				Providers: []documentdomain.OCRProviderConfig{
					{Provider: "Volcengine", Enable: true},
				},
			},
			want: documentdomain.ErrOCRCredentialsIncomplete,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			_, _, err := tc.cfg.ResolveVolcengineConfig()
			if !errors.Is(err, tc.want) {
				t.Fatalf("expected %v, got %v", tc.want, err)
			}
		})
	}
}

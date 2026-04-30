package document_test

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
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

func TestOCRAbilityConfigSerializationDoesNotExposeCredentials(t *testing.T) {
	t.Parallel()

	cfg := &documentdomain.OCRAbilityConfig{
		Enabled:      true,
		ProviderCode: documentdomain.OCRProviderVolcengine,
		Providers: []documentdomain.OCRProviderConfig{
			{
				Provider:  documentdomain.OCRProviderVolcengine,
				Enable:    true,
				AccessKey: "ocr-access-secret",
				SecretKey: "ocr-secret-secret",
			},
		},
	}

	abilityPayload, err := json.Marshal(cfg)
	if err != nil {
		t.Fatalf("marshal ocr ability config: %v", err)
	}
	providerPayload, err := json.Marshal(cfg.Providers[0])
	if err != nil {
		t.Fatalf("marshal ocr provider config: %v", err)
	}
	debugPayload := fmt.Sprintf("%+v %#v %+v %#v %s %s", cfg, cfg, cfg.Providers[0], cfg.Providers[0], cfg.LogValue(), cfg.Providers[0].LogValue())

	assertNoOCRCredential(t, string(abilityPayload))
	assertNoOCRCredential(t, string(providerPayload))
	assertNoOCRCredential(t, debugPayload)
}

func TestOCRProviderConfigUnmarshalKeepsCredentialsForRuntime(t *testing.T) {
	t.Parallel()

	var cfg documentdomain.OCRProviderConfig
	if err := json.Unmarshal([]byte(`{"provider":"Volcengine","enable":true,"access_key":"ak-runtime","secret_key":"sk-runtime"}`), &cfg); err != nil {
		t.Fatalf("unmarshal ocr provider config: %v", err)
	}
	if cfg.AccessKey != "ak-runtime" || cfg.SecretKey != "sk-runtime" {
		t.Fatalf("expected runtime credentials to be decoded, got %#v", cfg)
	}
}

func assertNoOCRCredential(t *testing.T, payload string) {
	t.Helper()

	for _, forbidden := range []string{
		"ocr-access-secret",
		"ocr-secret-secret",
		"access_key",
		"secret_key",
	} {
		if strings.Contains(payload, forbidden) {
			t.Fatalf("expected payload not to contain %q, got %s", forbidden, payload)
		}
	}
}

package aiability_test

import (
	"context"
	"errors"
	"testing"

	"magic/internal/pkg/aiability"
)

var (
	errAbilityConfig = errors.New("ability config failed")
	errModelConfig   = errors.New("model config failed")
)

func TestResolveModelConfigUsesAbilityOrganization(t *testing.T) {
	t.Parallel()

	abilityProvider := fakeAbilityProvider{
		config: aiability.AbilityConfig{
			Enabled:          true,
			OrganizationCode: "official-org",
			Config:           map[string]any{"model_id": "qwen-vl"},
		},
	}
	modelProvider := &fakeModelProvider{config: fakeModelConfig{ModelID: "qwen-vl"}}

	config, err := aiability.ResolveModelConfig(context.Background(), aiability.ResolveModelConfigInput{
		OrganizationCode: "request-org",
		AbilityCode:      "knowledge_base_visual_understanding",
		ModelType:        "llm",
		AbilityProvider:  abilityProvider,
		ModelProvider:    modelProvider,
	})
	if err != nil {
		t.Fatalf("ResolveModelConfig returned error: %v", err)
	}
	value, ok := config.Value.(fakeModelConfig)
	if !ok {
		t.Fatalf("model config type = %T", config.Value)
	}
	if value.ModelID != "qwen-vl" {
		t.Fatalf("model id = %q, want qwen-vl", value.ModelID)
	}
	if modelProvider.organizationCode != "official-org" {
		t.Fatalf("model organization_code = %q, want official-org", modelProvider.organizationCode)
	}
	if modelProvider.modelType != "llm" {
		t.Fatalf("model type = %q, want llm", modelProvider.modelType)
	}
}

func TestResolveModelConfigFallsBackToRequestOrganization(t *testing.T) {
	t.Parallel()

	modelProvider := &fakeModelProvider{}
	_, err := aiability.ResolveModelConfig(context.Background(), aiability.ResolveModelConfigInput{
		OrganizationCode: "request-org",
		AbilityCode:      "knowledge_base_visual_understanding",
		ModelType:        "llm",
		AbilityProvider: fakeAbilityProvider{config: aiability.AbilityConfig{
			Enabled: true,
			Config:  map[string]any{"model_id": "qwen-vl"},
		}},
		ModelProvider: modelProvider,
	})
	if err != nil {
		t.Fatalf("ResolveModelConfig returned error: %v", err)
	}
	if modelProvider.organizationCode != "request-org" {
		t.Fatalf("model organization_code = %q, want request-org", modelProvider.organizationCode)
	}
}

func TestResolveModelConfigAbilityDisabled(t *testing.T) {
	t.Parallel()

	_, err := aiability.ResolveModelConfig(context.Background(), aiability.ResolveModelConfigInput{
		OrganizationCode: "request-org",
		AbilityCode:      "knowledge_base_visual_understanding",
		AbilityProvider: fakeAbilityProvider{config: aiability.AbilityConfig{
			Enabled: false,
			Config:  map[string]any{"model_id": "qwen-vl"},
		}},
		ModelProvider: &fakeModelProvider{},
	})
	if !errors.Is(err, aiability.ErrAbilityDisabled) {
		t.Fatalf("error = %v, want ErrAbilityDisabled", err)
	}
}

func TestResolveModelConfigModelIDEmpty(t *testing.T) {
	t.Parallel()

	_, err := aiability.ResolveModelConfig(context.Background(), aiability.ResolveModelConfigInput{
		OrganizationCode: "request-org",
		AbilityCode:      "knowledge_base_visual_understanding",
		AbilityProvider: fakeAbilityProvider{config: aiability.AbilityConfig{
			Enabled: true,
			Config:  map[string]any{"model_id": ""},
		}},
		ModelProvider: &fakeModelProvider{},
	})
	if !errors.Is(err, aiability.ErrAbilityModelIDEmpty) {
		t.Fatalf("error = %v, want ErrAbilityModelIDEmpty", err)
	}
}

func TestResolveModelConfigWrapsProviderErrors(t *testing.T) {
	t.Parallel()

	_, err := aiability.ResolveModelConfig(context.Background(), aiability.ResolveModelConfigInput{
		OrganizationCode: "request-org",
		AbilityCode:      "knowledge_base_visual_understanding",
		AbilityProvider:  fakeAbilityProvider{err: errAbilityConfig},
		ModelProvider:    &fakeModelProvider{},
	})
	if !errors.Is(err, aiability.ErrAbilityConfigUnavailable) || !errors.Is(err, errAbilityConfig) {
		t.Fatalf("ability error = %v, want wrapped config error", err)
	}

	_, err = aiability.ResolveModelConfig(context.Background(), aiability.ResolveModelConfigInput{
		OrganizationCode: "request-org",
		AbilityCode:      "knowledge_base_visual_understanding",
		AbilityProvider: fakeAbilityProvider{config: aiability.AbilityConfig{
			Enabled: true,
			Config:  map[string]any{"model_id": "qwen-vl"},
		}},
		ModelProvider: &fakeModelProvider{err: errModelConfig},
	})
	if !errors.Is(err, aiability.ErrModelConfigUnavailable) || !errors.Is(err, errModelConfig) {
		t.Fatalf("model error = %v, want wrapped config error", err)
	}
}

type fakeModelConfig struct {
	ModelID string
}

type fakeAbilityProvider struct {
	config aiability.AbilityConfig
	err    error
}

func (f fakeAbilityProvider) GetAbilityConfig(context.Context, string, string) (aiability.AbilityConfig, error) {
	if f.err != nil {
		return aiability.AbilityConfig{}, f.err
	}
	return f.config, nil
}

type fakeModelProvider struct {
	config           fakeModelConfig
	err              error
	organizationCode string
	modelID          string
	modelType        string
}

func (f *fakeModelProvider) GetModelConfig(
	_ context.Context,
	organizationCode string,
	modelID string,
	modelType string,
) (aiability.ModelConfig, error) {
	f.organizationCode = organizationCode
	f.modelID = modelID
	f.modelType = modelType
	if f.err != nil {
		return aiability.ModelConfig{}, f.err
	}
	if f.config.ModelID == "" {
		f.config.ModelID = modelID
	}
	return aiability.ModelConfig{Value: f.config}, nil
}

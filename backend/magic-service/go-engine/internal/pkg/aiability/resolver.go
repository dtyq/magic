// Package aiability provides shared helpers for resolving AI ability model configs.
package aiability

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

var (
	// ErrAbilityConfigUnavailable 表示能力配置读取不可用。
	ErrAbilityConfigUnavailable = errors.New("ai ability config unavailable")
	// ErrAbilityDisabled 表示能力配置已关闭。
	ErrAbilityDisabled = errors.New("ai ability disabled")
	// ErrAbilityModelIDEmpty 表示能力配置中缺少 model_id。
	ErrAbilityModelIDEmpty = errors.New("ai ability model_id empty")
	// ErrModelConfigUnavailable 表示模型调用配置读取不可用。
	ErrModelConfigUnavailable = errors.New("ai ability model config unavailable")
)

// AbilityConfig 是 AI 能力配置解析所需的最小字段集合。
type AbilityConfig struct {
	OrganizationCode string
	Enabled          bool
	Config           map[string]any
}

// ModelSelection 表示从能力配置解析出的模型选择结果。
type ModelSelection struct {
	OrganizationCode string
	ModelID          string
}

// ModelConfig 包装调用方的模型配置对象。
type ModelConfig struct {
	Value any
}

// AbilityConfigProvider 读取指定 AI 能力配置。
type AbilityConfigProvider interface {
	GetAbilityConfig(ctx context.Context, organizationCode, abilityCode string) (AbilityConfig, error)
}

// AbilityConfigProviderFunc 允许用函数适配 AbilityConfigProvider。
type AbilityConfigProviderFunc func(ctx context.Context, organizationCode, abilityCode string) (AbilityConfig, error)

// GetAbilityConfig 读取指定 AI 能力配置。
func (fn AbilityConfigProviderFunc) GetAbilityConfig(
	ctx context.Context,
	organizationCode string,
	abilityCode string,
) (AbilityConfig, error) {
	return fn(ctx, organizationCode, abilityCode)
}

// ModelConfigProvider 读取指定模型调用配置。
type ModelConfigProvider interface {
	GetModelConfig(ctx context.Context, organizationCode, modelID, modelType string) (ModelConfig, error)
}

// ModelConfigProviderFunc 允许用函数适配 ModelConfigProvider。
type ModelConfigProviderFunc func(ctx context.Context, organizationCode, modelID, modelType string) (ModelConfig, error)

// GetModelConfig 读取指定模型调用配置。
func (fn ModelConfigProviderFunc) GetModelConfig(
	ctx context.Context,
	organizationCode string,
	modelID string,
	modelType string,
) (ModelConfig, error) {
	return fn(ctx, organizationCode, modelID, modelType)
}

// ResolveModelSelectionInput 描述模型选择解析入参。
type ResolveModelSelectionInput struct {
	OrganizationCode string
	AbilityCode      string
	AbilityProvider  AbilityConfigProvider
}

// ResolveModelConfigInput 描述模型调用配置解析入参。
type ResolveModelConfigInput struct {
	OrganizationCode string
	AbilityCode      string
	ModelType        string
	AbilityProvider  AbilityConfigProvider
	ModelProvider    ModelConfigProvider
}

// ResolveModelSelection 从能力配置中解析实际应使用的模型 ID 和组织编码。
func ResolveModelSelection(ctx context.Context, input ResolveModelSelectionInput) (ModelSelection, error) {
	organizationCode := strings.TrimSpace(input.OrganizationCode)
	abilityCode := strings.TrimSpace(input.AbilityCode)
	if input.AbilityProvider == nil {
		return ModelSelection{}, ErrAbilityConfigUnavailable
	}

	ability, err := input.AbilityProvider.GetAbilityConfig(ctx, organizationCode, abilityCode)
	if err != nil {
		return ModelSelection{}, fmt.Errorf("%w: %w", ErrAbilityConfigUnavailable, err)
	}
	if !ability.Enabled {
		return ModelSelection{}, ErrAbilityDisabled
	}

	modelID := modelIDFromAbilityConfig(ability.Config)
	if modelID == "" {
		return ModelSelection{}, ErrAbilityModelIDEmpty
	}

	modelOrganizationCode := strings.TrimSpace(ability.OrganizationCode)
	if modelOrganizationCode == "" {
		modelOrganizationCode = organizationCode
	}
	return ModelSelection{
		OrganizationCode: modelOrganizationCode,
		ModelID:          modelID,
	}, nil
}

// ResolveModelConfig 先从能力配置解析模型，再读取模型调用配置。
func ResolveModelConfig(ctx context.Context, input ResolveModelConfigInput) (ModelConfig, error) {
	selection, err := ResolveModelSelection(ctx, ResolveModelSelectionInput{
		OrganizationCode: input.OrganizationCode,
		AbilityCode:      input.AbilityCode,
		AbilityProvider:  input.AbilityProvider,
	})
	if err != nil {
		return ModelConfig{}, err
	}
	if input.ModelProvider == nil {
		return ModelConfig{}, ErrModelConfigUnavailable
	}

	modelConfig, err := input.ModelProvider.GetModelConfig(
		ctx,
		selection.OrganizationCode,
		selection.ModelID,
		strings.TrimSpace(input.ModelType),
	)
	if err != nil {
		return ModelConfig{}, fmt.Errorf("%w: %w", ErrModelConfigUnavailable, err)
	}
	return modelConfig, nil
}

func modelIDFromAbilityConfig(config map[string]any) string {
	if len(config) == 0 {
		return ""
	}
	value, ok := config["model_id"]
	if !ok {
		value = config["modelId"]
	}
	if value == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(value))
}

package document

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"magic/internal/domain/knowledge/shared"
)

var (
	// ErrOCRDisabled 表示 OCR 能力未启用。
	ErrOCRDisabled = errors.New("ocr ability is disabled")
	// ErrOCRProviderNotFound 表示未找到启用的 OCR provider。
	ErrOCRProviderNotFound = errors.New("no enabled ocr provider found")
	// ErrOCRProviderUnsupported 表示当前 provider 暂不支持。
	ErrOCRProviderUnsupported = errors.New("ocr provider is not supported")
	// ErrOCRCredentialsIncomplete 表示 provider 凭证缺失。
	ErrOCRCredentialsIncomplete = errors.New("ocr provider credentials are incomplete")
	// ErrUnsupportedOCRFileType 表示 OCR 不支持当前文件类型。
	ErrUnsupportedOCRFileType = errors.New("ocr file type is not supported")
)

const (
	// OCRProviderVolcengine 表示当前支持的火山 OCR provider。
	OCRProviderVolcengine = "Volcengine"
)

// OCRConfigProviderPort 定义 OCR 配置真值获取能力。
type OCRConfigProviderPort interface {
	GetOCRConfig(ctx context.Context) (*OCRAbilityConfig, error)
}

// OCRAbilityConfig 描述 OCR 能力配置。
type OCRAbilityConfig struct {
	Enabled      bool                `json:"enabled"`
	ProviderCode string              `json:"provider_code"`
	Providers    []OCRProviderConfig `json:"providers"`
}

// OCRProviderConfig 描述单个 OCR provider 配置。
type OCRProviderConfig struct {
	Provider  string `json:"provider"`
	Enable    bool   `json:"enable"`
	AccessKey string `json:"access_key"`
	SecretKey string `json:"secret_key"`
}

// OCROverloadedError 表示 OCR provider 当前限流或配额过载，适合稍后重试。
type OCROverloadedError struct {
	Provider string
	Err      error
}

// NewOCROverloadedError 创建 OCR 过载错误。
func NewOCROverloadedError(provider string, err error) error {
	if err == nil {
		return nil
	}
	return &OCROverloadedError{
		Provider: strings.TrimSpace(provider),
		Err:      err,
	}
}

func (e *OCROverloadedError) Error() string {
	if e == nil {
		return ""
	}
	if e.Provider == "" {
		return fmt.Sprintf("ocr provider overloaded: %v", e.Err)
	}
	return fmt.Sprintf("ocr provider %s overloaded: %v", e.Provider, e.Err)
}

func (e *OCROverloadedError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

// IsOCROverloaded 判断错误链中是否包含 OCR 过载错误。
func IsOCROverloaded(err error) bool {
	var overload *OCROverloadedError
	return errors.As(err, &overload)
}

// ResolveVolcengineConfig 校验 OCR 能力并提取火山 OCR 配置。
func (c *OCRAbilityConfig) ResolveVolcengineConfig() (*shared.OCRConfig, string, error) {
	if c == nil || !c.Enabled {
		return nil, "", ErrOCRDisabled
	}
	providerCode := strings.TrimSpace(c.ProviderCode)
	if !hasEnabledOCRProvider(c.Providers, providerCode) {
		if fallback := firstEnabledOCRProvider(c.Providers); fallback != "" {
			providerCode = fallback
		}
	}
	if !strings.EqualFold(providerCode, OCRProviderVolcengine) {
		return nil, "", ErrOCRProviderUnsupported
	}

	for _, provider := range c.Providers {
		if !provider.Enable || !strings.EqualFold(strings.TrimSpace(provider.Provider), OCRProviderVolcengine) {
			continue
		}

		accessKey := strings.TrimSpace(provider.AccessKey)
		secretKey := strings.TrimSpace(provider.SecretKey)
		if accessKey == "" || secretKey == "" {
			return nil, "", ErrOCRCredentialsIncomplete
		}

		return &shared.OCRConfig{
			Identity:  accessKey,
			Signature: secretKey,
		}, OCRProviderVolcengine, nil
	}

	return nil, "", ErrOCRProviderNotFound
}

func hasEnabledOCRProvider(providers []OCRProviderConfig, providerCode string) bool {
	providerCode = strings.TrimSpace(providerCode)
	if providerCode == "" {
		return false
	}
	for _, provider := range providers {
		if provider.Enable && strings.EqualFold(strings.TrimSpace(provider.Provider), providerCode) {
			return true
		}
	}
	return false
}

func firstEnabledOCRProvider(providers []OCRProviderConfig) string {
	for _, provider := range providers {
		if provider.Enable {
			return strings.TrimSpace(provider.Provider)
		}
	}
	return ""
}

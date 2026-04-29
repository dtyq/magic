package document

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
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
	AccessKey string `json:"-"`
	SecretKey string `json:"-"`
}

func (c OCRAbilityConfig) String() string {
	return fmt.Sprintf(
		"OCRAbilityConfig{Enabled:%t ProviderCode:%q ProviderCount:%d}",
		c.Enabled,
		c.ProviderCode,
		len(c.Providers),
	)
}

// GoString 返回不包含 OCR 凭据的调试字符串。
func (c OCRAbilityConfig) GoString() string {
	return c.String()
}

// LogValue 返回不包含 OCR 凭据的结构化日志值。
func (c OCRAbilityConfig) LogValue() slog.Value {
	return slog.GroupValue(
		slog.Bool("enabled", c.Enabled),
		slog.String("provider_code", c.ProviderCode),
		slog.Int("provider_count", len(c.Providers)),
	)
}

func (c OCRProviderConfig) String() string {
	return fmt.Sprintf(
		"OCRProviderConfig{Provider:%q Enable:%t CredentialsConfigured:%t}",
		c.Provider,
		c.Enable,
		ocrCredentialsConfigured(c.AccessKey, c.SecretKey),
	)
}

// GoString 返回不包含 OCR 凭据的调试字符串。
func (c OCRProviderConfig) GoString() string {
	return c.String()
}

// LogValue 返回不包含 OCR 凭据的结构化日志值。
func (c OCRProviderConfig) LogValue() slog.Value {
	return slog.GroupValue(
		slog.String("provider", c.Provider),
		slog.Bool("enable", c.Enable),
		slog.Bool("credentials_configured", ocrCredentialsConfigured(c.AccessKey, c.SecretKey)),
	)
}

// MarshalJSON 序列化时排除 OCR 凭据。
func (c OCRProviderConfig) MarshalJSON() ([]byte, error) {
	type safeOCRProviderConfig struct {
		Provider string `json:"provider"`
		Enable   bool   `json:"enable"`
	}
	payload, err := json.Marshal(safeOCRProviderConfig{
		Provider: c.Provider,
		Enable:   c.Enable,
	})
	if err != nil {
		return nil, fmt.Errorf("marshal ocr provider config: %w", err)
	}
	return payload, nil
}

// UnmarshalJSON 保留从内部 RPC 载入 OCR 凭据的能力。
func (c *OCRProviderConfig) UnmarshalJSON(data []byte) error {
	type wireOCRProviderConfig struct {
		Provider  string `json:"provider"`
		Enable    bool   `json:"enable"`
		AccessKey string `json:"access_key"`
		SecretKey string `json:"secret_key"`
	}
	var decoded wireOCRProviderConfig
	if err := json.Unmarshal(data, &decoded); err != nil {
		return fmt.Errorf("unmarshal ocr provider config: %w", err)
	}
	c.Provider = decoded.Provider
	c.Enable = decoded.Enable
	c.AccessKey = decoded.AccessKey
	c.SecretKey = decoded.SecretKey
	return nil
}

func ocrCredentialsConfigured(accessKey, secretKey string) bool {
	return strings.TrimSpace(accessKey) != "" && strings.TrimSpace(secretKey) != ""
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

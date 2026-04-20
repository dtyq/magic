package client

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"magic/internal/constants"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
)

const defaultOCRConfigCacheTTL = 30 * time.Second

// PHPOCRConfigRPCClient 通过 IPC 调用 PHP 获取 OCR 配置真值。
type PHPOCRConfigRPCClient struct {
	server              *unixsocket.Server
	logger              *logging.SugaredLogger
	ttl                 time.Duration
	now                 func() time.Time
	isClientReady       func() bool
	callGetOCRConfigRPC func(context.Context, *ocrConfigResponse) error

	mu        sync.RWMutex
	cached    *documentdomain.OCRAbilityConfig
	expiresAt time.Time
}

type ocrConfigResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		Enabled      bool   `json:"enabled"`
		ProviderCode string `json:"provider_code"`
		Providers    []struct {
			Provider  string `json:"provider"`
			Enable    bool   `json:"enable"`
			AccessKey string `json:"access_key"`
			SecretKey string `json:"secret_key"`
		} `json:"providers"`
	} `json:"data"`
}

// NewPHPOCRConfigRPCClient 创建 OCR 配置 RPC 客户端。
func NewPHPOCRConfigRPCClient(server *unixsocket.Server, logger *logging.SugaredLogger) *PHPOCRConfigRPCClient {
	return &PHPOCRConfigRPCClient{
		server:        server,
		logger:        logger,
		ttl:           defaultOCRConfigCacheTTL,
		now:           time.Now,
		isClientReady: func() bool { return server != nil && server.GetRPCClientCount() > 0 },
		callGetOCRConfigRPC: func(ctx context.Context, out *ocrConfigResponse) error {
			return unixsocket.CallRPCTypedWithContext(ctx, server, constants.MethodKnowledgeOCRConfig, map[string]any{}, out)
		},
	}
}

// GetOCRConfig 获取 OCR 配置，并使用短 TTL 进程内缓存。
func (c *PHPOCRConfigRPCClient) GetOCRConfig(ctx context.Context) (*documentdomain.OCRAbilityConfig, error) {
	if c == nil {
		return nil, ErrNoClientConnected
	}
	if cached := c.cachedConfig(); cached != nil {
		return cached, nil
	}
	if c.isClientReady == nil || !c.isClientReady() {
		return nil, ErrNoClientConnected
	}

	var result ocrConfigResponse
	if err := c.callGetOCRConfigRPC(ctx, &result); err != nil {
		if c.logger != nil {
			c.logger.ErrorContext(ctx, "获取 OCR 配置失败", "error", err)
		}
		return nil, errorsJoinPHPRequest(err)
	}
	if result.Code != 0 {
		return nil, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}

	cfg := &documentdomain.OCRAbilityConfig{
		Enabled:      result.Data.Enabled,
		ProviderCode: strings.TrimSpace(result.Data.ProviderCode),
		Providers:    make([]documentdomain.OCRProviderConfig, 0, len(result.Data.Providers)),
	}
	for _, provider := range result.Data.Providers {
		cfg.Providers = append(cfg.Providers, documentdomain.OCRProviderConfig{
			Provider:  strings.TrimSpace(provider.Provider),
			Enable:    provider.Enable,
			AccessKey: strings.TrimSpace(provider.AccessKey),
			SecretKey: strings.TrimSpace(provider.SecretKey),
		})
	}

	c.setCachedConfig(cfg)
	return cloneOCRAbilityConfig(cfg), nil
}

func (c *PHPOCRConfigRPCClient) cachedConfig() *documentdomain.OCRAbilityConfig {
	if c == nil {
		return nil
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.cached == nil || c.now == nil || c.now().After(c.expiresAt) {
		return nil
	}
	return cloneOCRAbilityConfig(c.cached)
}

func (c *PHPOCRConfigRPCClient) setCachedConfig(cfg *documentdomain.OCRAbilityConfig) {
	if c == nil || cfg == nil {
		return
	}
	if c.now == nil {
		c.now = time.Now
	}
	c.mu.Lock()
	c.cached = cloneOCRAbilityConfig(cfg)
	c.expiresAt = c.now().Add(c.ttl)
	c.mu.Unlock()
}

func cloneOCRAbilityConfig(cfg *documentdomain.OCRAbilityConfig) *documentdomain.OCRAbilityConfig {
	if cfg == nil {
		return nil
	}
	cloned := &documentdomain.OCRAbilityConfig{
		Enabled:      cfg.Enabled,
		ProviderCode: cfg.ProviderCode,
		Providers:    make([]documentdomain.OCRProviderConfig, len(cfg.Providers)),
	}
	copy(cloned.Providers, cfg.Providers)
	return cloned
}

func errorsJoinPHPRequest(err error) error {
	return fmt.Errorf("%w: %w", ErrPHPRequestFailed, err)
}

// SetNowHookForTest 设置时间测试钩子。
func (c *PHPOCRConfigRPCClient) SetNowHookForTest(fn func() time.Time) {
	if c == nil || fn == nil {
		return
	}
	c.now = fn
}

// SetTTLForTest 设置缓存 TTL。
func (c *PHPOCRConfigRPCClient) SetTTLForTest(ttl time.Duration) {
	if c == nil {
		return
	}
	c.ttl = ttl
}

// SetClientReadyHookForTest 设置连接状态测试钩子。
func (c *PHPOCRConfigRPCClient) SetClientReadyHookForTest(fn func() bool) {
	if c == nil || fn == nil {
		return
	}
	c.isClientReady = fn
}

// SetFetchHookForTest 设置 OCR 配置抓取测试钩子。
func (c *PHPOCRConfigRPCClient) SetFetchHookForTest(
	fn func(context.Context) (*documentdomain.OCRAbilityConfig, error),
) {
	if c == nil || fn == nil {
		return
	}
	c.callGetOCRConfigRPC = func(ctx context.Context, out *ocrConfigResponse) error {
		cfg, err := fn(ctx)
		if err != nil {
			return err
		}
		if cfg == nil {
			out.Code = 0
			return nil
		}
		out.Code = 0
		out.Data.Enabled = cfg.Enabled
		out.Data.ProviderCode = cfg.ProviderCode
		out.Data.Providers = make([]struct {
			Provider  string `json:"provider"`
			Enable    bool   `json:"enable"`
			AccessKey string `json:"access_key"`
			SecretKey string `json:"secret_key"`
		}, 0, len(cfg.Providers))
		for _, provider := range cfg.Providers {
			out.Data.Providers = append(out.Data.Providers, struct {
				Provider  string `json:"provider"`
				Enable    bool   `json:"enable"`
				AccessKey string `json:"access_key"`
				SecretKey string `json:"secret_key"`
			}{
				Provider:  provider.Provider,
				Enable:    provider.Enable,
				AccessKey: provider.AccessKey,
				SecretKey: provider.SecretKey,
			})
		}
		return nil
	}
}

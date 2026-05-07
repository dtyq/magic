package client

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"magic/internal/constants"
	documentdomain "magic/internal/domain/knowledge/document/metadata"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
)

const defaultOCRConfigCacheTTL = 30 * time.Second

// PHPOCRConfigRPCClient 通过 IPC 调用 PHP 获取 OCR 配置真值。
type PHPOCRConfigRPCClient struct {
	server                *unixsocket.Server
	logger                *logging.SugaredLogger
	ttl                   time.Duration
	now                   func() time.Time
	isClientReady         func() bool
	callGetOCRConfigRPC   func(context.Context, *ocrConfigResponse) error
	callReportOCRUsageRPC func(context.Context, ocrUsageRequest, *ocrUsageResponse) error

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

type ocrUsageRequest struct {
	Provider          string         `json:"provider"`
	OrganizationCode  string         `json:"organization_code"`
	UserID            string         `json:"user_id"`
	PageCount         int            `json:"page_count"`
	FileType          string         `json:"file_type"`
	BusinessParams    map[string]any `json:"business_params"`
	BusinessID        string         `json:"business_id"`
	SourceID          string         `json:"source_id"`
	KnowledgeBaseCode string         `json:"knowledge_base_code"`
	DocumentCode      string         `json:"document_code"`
	RequestID         string         `json:"request_id"`
	EventID           string         `json:"event_id"`
	OCRCallType       string         `json:"ocr_call_type"`
}

type ocrUsageResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
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
		callReportOCRUsageRPC: func(ctx context.Context, request ocrUsageRequest, out *ocrUsageResponse) error {
			return unixsocket.CallRPCTypedWithContext(ctx, server, constants.MethodKnowledgeOCRReportUsage, request, out)
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
			c.logger.KnowledgeErrorContext(ctx, "获取 OCR 配置失败", "error", err)
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

// ReportOCRUsage 通过 PHP IPC 上报 OCR 实际识别页数。
func (c *PHPOCRConfigRPCClient) ReportOCRUsage(ctx context.Context, usage documentdomain.OCRUsage) error {
	if c == nil {
		return ErrNoClientConnected
	}
	if c.isClientReady == nil || !c.isClientReady() {
		return ErrNoClientConnected
	}

	request := buildOCRUsageRequest(usage)
	var result ocrUsageResponse
	if err := c.callReportOCRUsageRPC(ctx, request, &result); err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(ctx, "上报 OCR 用量失败", "error", err)
		}
		return errorsJoinPHPRequest(err)
	}
	if result.Code != 0 {
		return fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}
	return nil
}

func buildOCRUsageRequest(usage documentdomain.OCRUsage) ocrUsageRequest {
	businessParams := map[string]any{
		"event_id":            strings.TrimSpace(usage.EventID),
		"request_id":          strings.TrimSpace(usage.RequestID),
		"knowledge_base_code": strings.TrimSpace(usage.KnowledgeBaseCode),
		"document_code":       strings.TrimSpace(usage.DocumentCode),
		"business_id":         strings.TrimSpace(usage.BusinessID),
		"source_id":           strings.TrimSpace(usage.SourceID),
		"ocr_call_type":       strings.TrimSpace(usage.CallType),
		"page_count":          usage.PageCount,
	}
	return ocrUsageRequest{
		Provider:          strings.TrimSpace(usage.Provider),
		OrganizationCode:  strings.TrimSpace(usage.OrganizationCode),
		UserID:            strings.TrimSpace(usage.UserID),
		PageCount:         usage.PageCount,
		FileType:          strings.TrimSpace(usage.FileType),
		BusinessParams:    businessParams,
		BusinessID:        strings.TrimSpace(usage.BusinessID),
		SourceID:          strings.TrimSpace(usage.SourceID),
		KnowledgeBaseCode: strings.TrimSpace(usage.KnowledgeBaseCode),
		DocumentCode:      strings.TrimSpace(usage.DocumentCode),
		RequestID:         strings.TrimSpace(usage.RequestID),
		EventID:           strings.TrimSpace(usage.EventID),
		OCRCallType:       strings.TrimSpace(usage.CallType),
	}
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

// SetReportUsageHookForTest 设置 OCR 用量上报测试钩子。
func (c *PHPOCRConfigRPCClient) SetReportUsageHookForTest(fn func(context.Context, documentdomain.OCRUsage) error) {
	if c == nil || fn == nil {
		return
	}
	c.callReportOCRUsageRPC = func(ctx context.Context, request ocrUsageRequest, out *ocrUsageResponse) error {
		err := fn(ctx, documentdomain.OCRUsage{
			EventID:           request.EventID,
			Provider:          request.Provider,
			OrganizationCode:  request.OrganizationCode,
			UserID:            request.UserID,
			PageCount:         request.PageCount,
			FileType:          request.FileType,
			BusinessID:        request.BusinessID,
			SourceID:          request.SourceID,
			KnowledgeBaseCode: request.KnowledgeBaseCode,
			DocumentCode:      request.DocumentCode,
			RequestID:         request.RequestID,
			CallType:          request.OCRCallType,
		})
		if err != nil {
			return err
		}
		out.Code = 0
		return nil
	}
}

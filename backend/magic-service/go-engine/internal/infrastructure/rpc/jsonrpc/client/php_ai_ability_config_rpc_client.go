package client

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"magic/internal/constants"
	document "magic/internal/domain/knowledge/document/metadata"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
)

// defaultAIAbilityConfigCacheTTL is the short TTL applied to successful IPC
// responses to avoid hammering PHP on hot knowledge parsing paths. Errors and
// disabled-ability responses are NEVER cached so a transient IPC blip does not
// poison subsequent requests.
const defaultAIAbilityConfigCacheTTL = 30 * time.Second

// PHPAIAbilityConfigRPCClient 通过 IPC 获取通用 AI 能力配置。
type PHPAIAbilityConfigRPCClient struct {
	server           *unixsocket.Server
	logger           *logging.SugaredLogger
	ttl              time.Duration
	now              func() time.Time
	isClientReady    func() bool
	callGetConfigRPC func(ctx context.Context, request aiAbilityConfigRequest, out *aiAbilityConfigResponse) error

	mu    sync.RWMutex
	cache map[string]aiAbilityConfigCacheEntry
}

type aiAbilityConfigCacheEntry struct {
	value     document.AIAbilityConfig
	expiresAt time.Time
}

type aiAbilityConfigRequest struct {
	OrganizationCode string `json:"organization_code"`
	AbilityCode      string `json:"ability_code"`
}

type aiAbilityConfigResponse struct {
	Code    int                 `json:"code"`
	Message string              `json:"message"`
	Data    aiAbilityConfigData `json:"data"`
}

type aiAbilityConfigData struct {
	Enabled          bool           `json:"enabled"`
	Code             string         `json:"code"`
	OrganizationCode string         `json:"organization_code"`
	Config           map[string]any `json:"config"`
}

// AIAbilityConfigRequestForTest 暴露 AI 能力配置请求供外部测试使用。
type AIAbilityConfigRequestForTest = aiAbilityConfigRequest

// AIAbilityConfigDataForTest 暴露 AI 能力配置响应数据供外部测试使用。
type AIAbilityConfigDataForTest = aiAbilityConfigData

// NewPHPAIAbilityConfigRPCClient 创建 AI 能力配置 RPC 客户端。
func NewPHPAIAbilityConfigRPCClient(server *unixsocket.Server, logger *logging.SugaredLogger) *PHPAIAbilityConfigRPCClient {
	return &PHPAIAbilityConfigRPCClient{
		server:        server,
		logger:        logger,
		ttl:           defaultAIAbilityConfigCacheTTL,
		now:           time.Now,
		cache:         make(map[string]aiAbilityConfigCacheEntry),
		isClientReady: func() bool { return server != nil && server.GetRPCClientCount() > 0 },
		callGetConfigRPC: func(ctx context.Context, request aiAbilityConfigRequest, out *aiAbilityConfigResponse) error {
			return unixsocket.CallRPCTypedWithContext(ctx, server, constants.MethodAIAbilityConfigGet, request, out)
		},
	}
}

// GetConfig 获取指定能力的配置，带 30s 进程内缓存（仅缓存成功响应）。
func (c *PHPAIAbilityConfigRPCClient) GetConfig(ctx context.Context, organizationCode, abilityCode string) (document.AIAbilityConfig, error) {
	return c.fetchConfig(ctx, organizationCode, abilityCode)
}

// GetVisualAbilityConfig 获取知识库视觉理解使用的 AI 能力配置。
func (c *PHPAIAbilityConfigRPCClient) GetVisualAbilityConfig(
	ctx context.Context,
	organizationCode string,
	abilityCode string,
) (document.AIAbilityConfig, error) {
	return c.fetchConfig(ctx, organizationCode, abilityCode)
}

func (c *PHPAIAbilityConfigRPCClient) fetchConfig(
	ctx context.Context,
	organizationCode string,
	abilityCode string,
) (document.AIAbilityConfig, error) {
	if c == nil {
		return document.AIAbilityConfig{}, ErrNoClientConnected
	}
	orgCode := strings.TrimSpace(organizationCode)
	code := strings.TrimSpace(abilityCode)
	if cached, ok := c.cachedConfig(orgCode, code); ok {
		return cloneAbilityConfig(cached), nil
	}
	if c.isClientReady == nil || !c.isClientReady() {
		return document.AIAbilityConfig{}, ErrNoClientConnected
	}

	var result aiAbilityConfigResponse
	request := aiAbilityConfigRequest{
		OrganizationCode: orgCode,
		AbilityCode:      code,
	}
	if err := c.callGetConfigRPC(ctx, request, &result); err != nil {
		if c.logger != nil {
			c.logger.ErrorContext(ctx, "获取 AI 能力配置失败", "error", err, "ability_code", request.AbilityCode)
		}
		return document.AIAbilityConfig{}, fmt.Errorf("%w: %w", ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		return document.AIAbilityConfig{}, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}

	value := document.AIAbilityConfig{
		Code:             strings.TrimSpace(result.Data.Code),
		OrganizationCode: strings.TrimSpace(result.Data.OrganizationCode),
		Enabled:          result.Data.Enabled,
		Config:           result.Data.Config,
	}
	c.setCachedConfig(orgCode, code, value)
	return cloneAbilityConfig(value), nil
}

func (c *PHPAIAbilityConfigRPCClient) cacheKey(organizationCode, abilityCode string) string {
	return organizationCode + "|" + abilityCode
}

func (c *PHPAIAbilityConfigRPCClient) cachedConfig(organizationCode, abilityCode string) (document.AIAbilityConfig, bool) {
	if c == nil {
		return document.AIAbilityConfig{}, false
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	entry, ok := c.cache[c.cacheKey(organizationCode, abilityCode)]
	if !ok {
		return document.AIAbilityConfig{}, false
	}
	if c.now == nil || c.now().After(entry.expiresAt) {
		return document.AIAbilityConfig{}, false
	}
	return cloneAbilityConfig(entry.value), true
}

func (c *PHPAIAbilityConfigRPCClient) setCachedConfig(organizationCode, abilityCode string, value document.AIAbilityConfig) {
	if c == nil {
		return
	}
	if c.now == nil {
		c.now = time.Now
	}
	c.mu.Lock()
	if c.cache == nil {
		c.cache = make(map[string]aiAbilityConfigCacheEntry)
	}
	c.cache[c.cacheKey(organizationCode, abilityCode)] = aiAbilityConfigCacheEntry{
		value:     cloneAbilityConfig(value),
		expiresAt: c.now().Add(c.ttl),
	}
	c.mu.Unlock()
}

func cloneAbilityConfig(src document.AIAbilityConfig) document.AIAbilityConfig {
	dst := document.AIAbilityConfig{
		Code:             src.Code,
		OrganizationCode: src.OrganizationCode,
		Enabled:          src.Enabled,
	}
	if src.Config != nil {
		dst.Config = cloneAnyMap(src.Config)
	}
	return dst
}

func cloneAnyMap(in map[string]any) map[string]any {
	out := make(map[string]any, len(in))
	for k, v := range in {
		out[k] = cloneAnyValue(v)
	}
	return out
}

func cloneAnyValue(v any) any {
	switch t := v.(type) {
	case map[string]any:
		return cloneAnyMap(t)
	case []any:
		copied := make([]any, len(t))
		for i, item := range t {
			copied[i] = cloneAnyValue(item)
		}
		return copied
	default:
		return v
	}
}

// SetNowHookForTest sets a deterministic time source for tests.
func (c *PHPAIAbilityConfigRPCClient) SetNowHookForTest(fn func() time.Time) {
	if c == nil || fn == nil {
		return
	}
	c.now = fn
}

// SetTTLForTest overrides the cache TTL for tests.
func (c *PHPAIAbilityConfigRPCClient) SetTTLForTest(ttl time.Duration) {
	if c == nil {
		return
	}
	c.ttl = ttl
}

// SetClientReadyHookForTest overrides the connection readiness probe for tests.
func (c *PHPAIAbilityConfigRPCClient) SetClientReadyHookForTest(fn func() bool) {
	if c == nil || fn == nil {
		return
	}
	c.isClientReady = fn
}

// SetAIAbilityConfigClientReadyFuncForTest 替换 AI 能力配置客户端连接状态判断逻辑。
func (c *PHPAIAbilityConfigRPCClient) SetAIAbilityConfigClientReadyFuncForTest(fn func() bool) {
	c.SetClientReadyHookForTest(fn)
}

// SetFetchHookForTest replaces the underlying IPC call for tests.
func (c *PHPAIAbilityConfigRPCClient) SetFetchHookForTest(
	fn func(ctx context.Context, organizationCode, abilityCode string) (document.AIAbilityConfig, error),
) {
	if c == nil || fn == nil {
		return
	}
	c.callGetConfigRPC = func(ctx context.Context, request aiAbilityConfigRequest, out *aiAbilityConfigResponse) error {
		cfg, err := fn(ctx, request.OrganizationCode, request.AbilityCode)
		if err != nil {
			return err
		}
		out.Code = 0
		out.Data.Enabled = cfg.Enabled
		out.Data.Code = cfg.Code
		out.Data.OrganizationCode = cfg.OrganizationCode
		out.Data.Config = cfg.Config
		return nil
	}
}

// SetCallAIAbilityConfigRPCForTest 替换 AI 能力配置 RPC 调用逻辑。
func (c *PHPAIAbilityConfigRPCClient) SetCallAIAbilityConfigRPCForTest(
	fn func(context.Context, AIAbilityConfigRequestForTest, *RPCResultForTest[AIAbilityConfigDataForTest]) error,
) {
	if c == nil || fn == nil {
		return
	}
	c.callGetConfigRPC = func(ctx context.Context, request aiAbilityConfigRequest, out *aiAbilityConfigResponse) error {
		testOut := &RPCResultForTest[AIAbilityConfigDataForTest]{
			Code:    out.Code,
			Message: out.Message,
			Data:    out.Data,
		}
		if err := fn(ctx, request, testOut); err != nil {
			return err
		}
		out.Code = testOut.Code
		out.Message = testOut.Message
		out.Data = testOut.Data
		return nil
	}
}

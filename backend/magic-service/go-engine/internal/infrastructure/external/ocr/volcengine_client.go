// Package ocr 提供 OCR 客户端实现
package ocr

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/ledongthuc/pdf"
	"github.com/volcengine/volc-sdk-golang/base"
	"github.com/volcengine/volc-sdk-golang/service/visual"
	"golang.org/x/net/http/httpproxy"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/ratelimit"
)

var (
	// ErrOCRFailed 表示 OCR 失败时的错误。
	ErrOCRFailed = errors.New("ocr failed")

	errPDFSourceNil                     = errors.New("pdf source is nil")
	errPDFSourceSizeInvalid             = errors.New("invalid pdf source size")
	errPDFSourceRandomAccessUnsupported = errors.New("pdf source does not support random access")
	errPDFPageCountInvalid              = errors.New("invalid pdf page count")
)

const (
	errOCRUnavailableMessage = "OCR recognition is unavailable"

	// SuccessCode 表示火山 OCR API 成功时返回的代码。
	SuccessCode = 10000

	ocrActionVersion        = "2021-08-23"
	ocrFormVersion          = "v3"
	ocrPageNumLimit         = 100
	ocrRateLimitCode        = 50429
	defaultOCRHost          = "visual.volcengineapi.com"
	defaultOCRScheme        = "https"
	volcHTTPProxyEnv        = "VOLC_HTTP_PROXY"
	volcHTTPSProxyEnv       = "VOLC_HTTPS_PROXY"
	volcNoProxyEnv          = "VOLC_NO_PROXY"
	volcengineBytesCacheMod = "ocr:volcengine:bytes"
	ocrSourceHashBufferSize = 1 << 20
	defaultRateLimitKey     = "ocr:Volcengine"
	defaultRateLimitWait    = 10 * time.Second
)

const (
	normalizedOCRPDFType   = "pdf"
	normalizedOCRImageType = "image"
	ocrCallTypeURL         = "url"
	ocrCallTypeSource      = "source"
	ocrCallTypeBytes       = "bytes"
)

// RateLimiter describes the generic limiter capability needed by OCR.
type RateLimiter interface {
	Wait(ctx context.Context, key string, timeout time.Duration) (ratelimit.Result, error)
}

// RateLimitConfig describes OCR rate limit behavior.
type RateLimitConfig struct {
	Key         string
	WaitTimeout time.Duration
}

// VolcengineOCRClient 火山引擎 OCR 客户端
type VolcengineOCRClient struct {
	configProvider documentdomain.OCRConfigProviderPort
	cacheRepo      documentdomain.OCRResultCacheRepository
	logger         *logging.SugaredLogger
	invokeOCRByURL func(context.Context, *shared.OCRConfig, string, string) (string, error)
	invokeOCRBytes func(context.Context, *shared.OCRConfig, []byte, string) (string, error)
	rateLimiter    RateLimiter
	rateLimit      RateLimitConfig
	usageReporter  documentdomain.OCRUsageReporterPort
}

// NewVolcengineOCRClient 创建火山引擎 OCR 客户端
func NewVolcengineOCRClient(
	configProvider documentdomain.OCRConfigProviderPort,
	cacheRepo documentdomain.OCRResultCacheRepository,
	logger *logging.SugaredLogger,
) *VolcengineOCRClient {
	return &VolcengineOCRClient{
		configProvider: configProvider,
		cacheRepo:      cacheRepo,
		logger:         logger,
		invokeOCRByURL: callVolcengineOCR,
		invokeOCRBytes: callVolcengineOCRBytes,
	}
}

// SetRateLimiter injects an optional OCR rate limiter.
func (c *VolcengineOCRClient) SetRateLimiter(limiter RateLimiter, config RateLimitConfig) {
	if c == nil {
		return
	}
	c.rateLimiter = limiter
	c.rateLimit = normalizeRateLimitConfig(config)
}

// SetUsageReporter injects an optional OCR usage reporter.
func (c *VolcengineOCRClient) SetUsageReporter(reporter documentdomain.OCRUsageReporterPort) {
	if c == nil {
		return
	}
	c.usageReporter = reporter
}

// OCR 解析文件 URL 获取文本
func (c *VolcengineOCRClient) OCR(ctx context.Context, fileURL, fileType string) (string, error) {
	if c == nil || c.configProvider == nil {
		return "", documentdomain.ErrOCRDisabled
	}
	ocrFileType, err := normalizeOCRFileType(fileType)
	if err != nil {
		return "", err
	}

	abilityConfig, err := c.configProvider.GetOCRConfig(ctx)
	if err != nil {
		return "", fmt.Errorf("load ocr config: %w", err)
	}
	ocrConfig, provider, err := abilityConfig.ResolveVolcengineConfig()
	if err != nil {
		return "", fmt.Errorf("resolve ocr provider config: %w", err)
	}

	if err := c.waitRateLimit(ctx, provider); err != nil {
		return "", err
	}
	content, err := c.invokeOCRByURL(ctx, ocrConfig, fileURL, ocrFileType)
	if err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(ctx, "火山 OCR 调用失败", "provider", provider, "file_type", ocrFileType, "url", fileURL, "error", err)
		}
		return "", newOCRExecutionError(
			fmt.Errorf("invoke volcengine ocr: %w", err),
		)
	}

	c.reportOCRUsage(ctx, provider, ocrFileType, ocrCallTypeURL, 1)
	return content, nil
}

// OCRSource 基于已下载的源文件内容执行 OCR，并按内容 hash 缓存结果。
func (c *VolcengineOCRClient) OCRSource(ctx context.Context, fileURL string, file io.Reader, fileType string) (string, error) {
	if c == nil || c.configProvider == nil {
		return "", documentdomain.ErrOCRDisabled
	}
	if file == nil {
		return "", fmt.Errorf("%w: empty source", ErrOCRFailed)
	}
	ocrFileType, err := normalizeOCRFileType(fileType)
	if err != nil {
		return "", err
	}

	abilityConfig, err := c.configProvider.GetOCRConfig(ctx)
	if err != nil {
		return "", fmt.Errorf("load ocr config: %w", err)
	}
	ocrConfig, provider, err := abilityConfig.ResolveVolcengineConfig()
	if err != nil {
		return "", fmt.Errorf("resolve ocr provider config: %w", err)
	}

	cacheHash, size, err := buildOCRSourceCacheHash(provider, fileType, file)
	if err != nil {
		return "", fmt.Errorf("read ocr source: %w", err)
	}
	if size == 0 {
		return "", fmt.Errorf("%w: empty source", ErrOCRFailed)
	}
	if cached, ok := c.lookupCachedBytesPayload(ctx, cacheHash); ok {
		return cached, nil
	}

	if err := c.waitRateLimit(ctx, provider); err != nil {
		return "", err
	}
	content, err := c.invokeOCRByURL(ctx, ocrConfig, fileURL, ocrFileType)
	if err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(ctx, "火山 OCR 调用失败", "provider", provider, "file_type", ocrFileType, "url", fileURL, "error", err)
		}
		return "", newOCRExecutionError(
			fmt.Errorf("invoke volcengine ocr: %w", err),
		)
	}

	pageCount := c.resolveOCRSourcePageCount(ctx, file, ocrFileType, size)
	c.reportOCRUsage(ctx, provider, ocrFileType, ocrCallTypeSource, pageCount)
	c.persistCachedBytesPayload(ctx, cacheHash, provider, fileType, content)
	return content, nil
}

// OCRBytes 解析图片字节流获取文本。
func (c *VolcengineOCRClient) OCRBytes(ctx context.Context, data []byte, fileType string) (string, error) {
	if c == nil || c.configProvider == nil {
		return "", documentdomain.ErrOCRDisabled
	}
	if len(data) == 0 {
		return "", fmt.Errorf("%w: empty image data", ErrOCRFailed)
	}

	ocrFileType, err := normalizeOCRFileType(fileType)
	if err != nil {
		return "", err
	}
	if ocrFileType != "image" {
		return "", fmt.Errorf("%w: %s", documentdomain.ErrUnsupportedOCRFileType, fileType)
	}

	abilityConfig, err := c.configProvider.GetOCRConfig(ctx)
	if err != nil {
		return "", fmt.Errorf("load ocr config: %w", err)
	}
	ocrConfig, provider, err := abilityConfig.ResolveVolcengineConfig()
	if err != nil {
		return "", fmt.Errorf("resolve ocr provider config: %w", err)
	}

	hash := buildOCRBytesCacheHash(provider, fileType, data)
	if cached, ok := c.lookupCachedBytesPayload(ctx, hash); ok {
		return cached, nil
	}

	if err := c.waitRateLimit(ctx, provider); err != nil {
		return "", err
	}
	content, err := c.invokeOCRBytes(ctx, ocrConfig, data, ocrFileType)
	if err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(ctx, "火山 OCR 字节流调用失败", "provider", provider, "file_type", ocrFileType, "error", err)
		}
		return "", newOCRExecutionError(
			fmt.Errorf("invoke volcengine ocr bytes: %w", err),
		)
	}

	c.reportOCRUsage(ctx, provider, ocrFileType, ocrCallTypeBytes, 1)
	c.persistCachedBytesPayload(ctx, hash, provider, fileType, content)
	return content, nil
}

func (c *VolcengineOCRClient) reportOCRUsage(
	ctx context.Context,
	provider string,
	fileType string,
	callType string,
	pageCount int,
) {
	if c == nil || c.usageReporter == nil {
		return
	}
	usageMeta, ok := documentdomain.OCRUsageContextFromContext(ctx)
	if !ok {
		c.logSkipOCRUsageReport(ctx, provider, fileType, callType, "usage context missing")
		return
	}
	usage := documentdomain.OCRUsage{
		EventID:           uuid.NewString(),
		Provider:          strings.TrimSpace(provider),
		OrganizationCode:  strings.TrimSpace(usageMeta.OrganizationCode),
		UserID:            strings.TrimSpace(usageMeta.UserID),
		PageCount:         normalizeOCRUsagePageCount(fileType, pageCount),
		FileType:          strings.TrimSpace(fileType),
		BusinessID:        strings.TrimSpace(usageMeta.BusinessID),
		SourceID:          strings.TrimSpace(usageMeta.SourceID),
		KnowledgeBaseCode: strings.TrimSpace(usageMeta.KnowledgeBaseCode),
		DocumentCode:      strings.TrimSpace(usageMeta.DocumentCode),
		CallType:          strings.TrimSpace(callType),
	}
	if usage.BusinessID == "" {
		usage.BusinessID = usage.KnowledgeBaseCode
	}
	if usage.SourceID == "" {
		usage.SourceID = usage.DocumentCode
	}
	if requestID, found := ctxmeta.RequestIDFromContext(ctx); found {
		usage.RequestID = requestID
	}
	if usage.Provider == "" || usage.OrganizationCode == "" || usage.UserID == "" || usage.PageCount <= 0 {
		c.logSkipOCRUsageReport(ctx, provider, fileType, callType, "usage required field missing")
		return
	}
	if err := c.usageReporter.ReportOCRUsage(ctx, usage); err != nil && c.logger != nil {
		c.logger.KnowledgeWarnContext(
			ctx,
			"Report ocr usage failed",
			"provider", usage.Provider,
			"file_type", usage.FileType,
			"call_type", usage.CallType,
			"page_count", usage.PageCount,
			"knowledge_base_code", usage.KnowledgeBaseCode,
			"document_code", usage.DocumentCode,
			"error", err,
		)
	}
}

func (c *VolcengineOCRClient) logSkipOCRUsageReport(ctx context.Context, provider, fileType, callType, reason string) {
	if c == nil || c.logger == nil {
		return
	}
	c.logger.KnowledgeWarnContext(
		ctx,
		"Skip ocr usage report",
		"provider", provider,
		"file_type", fileType,
		"call_type", callType,
		"reason", reason,
	)
}

func (c *VolcengineOCRClient) resolveOCRSourcePageCount(
	ctx context.Context,
	file io.Reader,
	fileType string,
	size int64,
) int {
	if fileType != normalizedOCRPDFType {
		return 1
	}
	pageCount, err := readPDFPageCount(file, size)
	if err != nil {
		if c != nil && c.logger != nil {
			c.logger.KnowledgeWarnContext(
				ctx,
				"Read ocr pdf page count failed, fallback to one page",
				"file_type", fileType,
				"source_size", size,
				"error", err,
			)
		}
		return 1
	}
	return normalizeOCRUsagePageCount(fileType, pageCount)
}

func (c *VolcengineOCRClient) waitRateLimit(ctx context.Context, provider string) error {
	if c == nil || c.rateLimiter == nil {
		return nil
	}
	config := normalizeRateLimitConfig(c.rateLimit)
	result, err := c.rateLimiter.Wait(ctx, config.Key, config.WaitTimeout)
	if err == nil {
		c.logRateLimitAcquired(ctx, provider, config, result)
		return nil
	}
	c.logRateLimitFailed(ctx, provider, config, result, err)
	return newOCRExecutionError(
		documentdomain.NewOCROverloadedError(
			provider,
			fmt.Errorf("wait ocr rate limit token: %w", err),
		),
	)
}

func normalizeRateLimitConfig(config RateLimitConfig) RateLimitConfig {
	if strings.TrimSpace(config.Key) == "" {
		config.Key = defaultRateLimitKey
	}
	if config.WaitTimeout <= 0 {
		config.WaitTimeout = defaultRateLimitWait
	}
	return config
}

func (c *VolcengineOCRClient) logRateLimitAcquired(
	ctx context.Context,
	provider string,
	config RateLimitConfig,
	result ratelimit.Result,
) {
	if c == nil || c.logger == nil || result.Waited <= 0 {
		return
	}
	c.logger.InfoContext(
		ctx,
		"Acquire ocr rate limit token",
		"provider", provider,
		"key", config.Key,
		"wait_timeout_ms", config.WaitTimeout.Milliseconds(),
		"waited_ms", result.Waited.Milliseconds(),
		"remaining_tokens", result.Remaining,
	)
}

func (c *VolcengineOCRClient) logRateLimitFailed(
	ctx context.Context,
	provider string,
	config RateLimitConfig,
	result ratelimit.Result,
	err error,
) {
	if c == nil || c.logger == nil {
		return
	}
	message := "Wait ocr rate limit token failed"
	if errors.Is(err, ratelimit.ErrWaitTimeout) {
		message = "OCR rate limit wait timeout"
	}
	c.logger.KnowledgeWarnContext(
		ctx,
		message,
		"provider", provider,
		"key", config.Key,
		"wait_timeout_ms", config.WaitTimeout.Milliseconds(),
		"waited_ms", result.Waited.Milliseconds(),
		"retry_after_ms", result.RetryAfter.Milliseconds(),
		"remaining_tokens", result.Remaining,
		"error", err,
	)
}

func (c *VolcengineOCRClient) lookupCachedBytesPayload(ctx context.Context, cacheHash string) (string, bool) {
	if c == nil || c.cacheRepo == nil || strings.TrimSpace(cacheHash) == "" {
		return "", false
	}
	cached, err := c.cacheRepo.FindBytesCache(ctx, cacheHash, volcengineBytesCacheMod)
	if err != nil {
		if errors.Is(err, documentdomain.ErrOCRCacheNotFound) {
			return "", false
		}
		if c.logger != nil {
			c.logger.KnowledgeWarnContext(ctx, "读取 OCR 字节流缓存失败，跳过缓存", "text_hash", cacheHash, "error", err)
		}
		return "", false
	}
	if cached == nil {
		return "", false
	}
	if err := c.cacheRepo.Touch(ctx, cached.ID); err != nil && c.logger != nil {
		c.logger.KnowledgeWarnContext(ctx, "更新 OCR 字节流缓存访问统计失败", "cache_id", cached.ID, "error", err)
	}
	return cached.Content, true
}

func (c *VolcengineOCRClient) persistCachedBytesPayload(
	ctx context.Context,
	cacheHash, provider, fileType, content string,
) {
	if c == nil || c.cacheRepo == nil || strings.TrimSpace(cacheHash) == "" {
		return
	}
	if err := c.cacheRepo.UpsertBytesCache(ctx, &documentdomain.OCRResultCache{
		TextHash:       cacheHash,
		EmbeddingModel: volcengineBytesCacheMod,
		Content:        content,
		FileType:       normalizeCacheFileType(fileType),
	}); err != nil && c.logger != nil {
		c.logger.KnowledgeWarnContext(ctx, "写入 OCR 字节流缓存失败", "provider", provider, "text_hash", cacheHash, "error", err)
	}
}

func buildOCRBytesCacheHash(provider, fileType string, data []byte) string {
	keyPrefix := provider + "\n" + normalizeCacheFileType(fileType) + "\n"
	hash := sha256.New()
	_, _ = hash.Write([]byte(keyPrefix))
	_, _ = hash.Write(data)
	return hex.EncodeToString(hash.Sum(nil))
}

func buildOCRSourceCacheHash(provider, fileType string, file io.Reader) (string, int64, error) {
	hash := sha256.New()
	_, _ = hash.Write([]byte(provider + "\n" + normalizeCacheFileType(fileType) + "\n"))

	written, err := io.CopyBuffer(hash, file, make([]byte, ocrSourceHashBufferSize))
	if err != nil {
		return "", written, fmt.Errorf("stream ocr source into hash: %w", err)
	}
	return hex.EncodeToString(hash.Sum(nil)), written, nil
}

func readPDFPageCount(file io.Reader, size int64) (int, error) {
	if file == nil {
		return 0, errPDFSourceNil
	}
	if size <= 0 {
		return 0, fmt.Errorf("%w: %d", errPDFSourceSizeInvalid, size)
	}
	readerAt, ok := file.(io.ReaderAt)
	if !ok {
		return 0, fmt.Errorf("%w: %T", errPDFSourceRandomAccessUnsupported, file)
	}
	reader, err := pdf.NewReader(readerAt, size)
	if err != nil {
		return 0, fmt.Errorf("open pdf reader: %w", err)
	}
	pageCount := reader.NumPage()
	if pageCount <= 0 {
		return 0, fmt.Errorf("%w: %d", errPDFPageCountInvalid, pageCount)
	}
	return pageCount, nil
}

func normalizeOCRUsagePageCount(fileType string, pageCount int) int {
	if pageCount <= 0 {
		return 1
	}
	if fileType == normalizedOCRImageType {
		return 1
	}
	if fileType == normalizedOCRPDFType && pageCount > ocrPageNumLimit {
		return ocrPageNumLimit
	}
	return pageCount
}

func normalizeCacheFileType(fileType string) string {
	return strings.ToLower(strings.TrimSpace(fileType))
}

func normalizeOCRFileType(fileType string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(fileType)) {
	case normalizedOCRPDFType:
		return normalizedOCRPDFType, nil
	case "jpg", "jpeg", "png", "bmp":
		return normalizedOCRImageType, nil
	default:
		return "", fmt.Errorf("%w: %s", documentdomain.ErrUnsupportedOCRFileType, fileType)
	}
}

func callVolcengineOCR(ctx context.Context, config *shared.OCRConfig, fileURL, fileType string) (string, error) {
	return callVolcengineOCRWithForm(ctx, config, fileType, func(form url.Values) {
		form.Add("image_url", fileURL)
	})
}

func callVolcengineOCRBytes(ctx context.Context, config *shared.OCRConfig, data []byte, fileType string) (string, error) {
	return callVolcengineOCRWithForm(ctx, config, fileType, func(form url.Values) {
		form.Add("image_base64", base64.StdEncoding.EncodeToString(data))
	})
}

func callVolcengineOCRWithForm(
	ctx context.Context,
	config *shared.OCRConfig,
	fileType string,
	fillForm func(url.Values),
) (string, error) {
	client := visual.NewInstance()
	client.Client.Client = newVolcengineHTTPClient()
	client.Client.ApiInfoList["OCRPdf"] = &base.ApiInfo{
		Method:  "POST",
		Path:    "/",
		Query:   url.Values{"Action": []string{"OCRPdf"}, "Version": []string{ocrActionVersion}},
		Form:    url.Values{},
		Header:  nil,
		Timeout: 60 * time.Second,
	}

	client.Client.SetAccessKey(config.Identity)
	client.Client.SetSecretKey(config.Signature)
	host, scheme := resolveVolcengineEndpoint(config.Endpoint)
	client.Client.SetHost(host)
	client.Client.SetScheme(scheme)

	form := url.Values{}
	form.Add("version", ocrFormVersion)
	form.Add("page_num", strconv.Itoa(ocrPageNumLimit))
	form.Add("file_type", fileType)
	fillForm(form)

	resp, _, err := client.Client.CtxPost(ctx, "OCRPdf", nil, form)
	if err != nil {
		wrapped := fmt.Errorf("call ocr api failed: %w", err)
		if isVolcengineOCRRateLimitedError(wrapped) {
			return "", fmt.Errorf("%w", documentdomain.NewOCROverloadedError(documentdomain.OCRProviderVolcengine, wrapped))
		}
		return "", wrapped
	}

	var result struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			Markdown string `json:"markdown"`
		} `json:"data"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return "", fmt.Errorf("unmarshal ocr response failed: %w", err)
	}
	if result.Code == SuccessCode {
		return result.Data.Markdown, nil
	}
	failure := fmt.Errorf("%w: code=%d, message=%s", ErrOCRFailed, result.Code, extractOCRFailureMessage(resp, result.Message))
	if result.Code == ocrRateLimitCode || isVolcengineOCRRateLimitedError(failure) {
		return "", fmt.Errorf("%w", documentdomain.NewOCROverloadedError(documentdomain.OCRProviderVolcengine, failure))
	}
	return "", failure
}

func resolveVolcengineEndpoint(endpoint string) (host, scheme string) {
	scheme = defaultOCRScheme
	host = defaultOCRHost

	trimmed := strings.TrimSpace(endpoint)
	if trimmed == "" {
		return host, scheme
	}

	if parsed, err := url.Parse(trimmed); err == nil && parsed.Host != "" {
		return parsed.Host, firstNonEmpty(strings.TrimSpace(parsed.Scheme), defaultOCRScheme)
	}

	return trimmed, scheme
}

func newVolcengineHTTPClient() *http.Client {
	return &http.Client{
		Transport: &http.Transport{
			MaxIdleConns:        1000,
			MaxIdleConnsPerHost: 100,
			IdleConnTimeout:     10 * time.Second,
			Proxy:               resolveVolcengineProxy(),
		},
	}
}

func resolveVolcengineProxy() func(*http.Request) (*url.URL, error) {
	config := &httpproxy.Config{
		HTTPProxy:  firstNonEmpty(os.Getenv(volcHTTPProxyEnv), os.Getenv("HTTP_PROXY"), os.Getenv("http_proxy")),
		HTTPSProxy: firstNonEmpty(os.Getenv(volcHTTPSProxyEnv), os.Getenv("HTTPS_PROXY"), os.Getenv("https_proxy")),
		NoProxy:    firstNonEmpty(os.Getenv(volcNoProxyEnv), os.Getenv("NO_PROXY"), os.Getenv("no_proxy")),
		CGI:        os.Getenv("REQUEST_METHOD") != "",
	}
	proxyFunc := config.ProxyFunc()
	return func(req *http.Request) (*url.URL, error) {
		return proxyFunc(req.URL)
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func isVolcengineOCRRateLimitedError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "http code 429") ||
		strings.Contains(message, "code=50429") ||
		strings.Contains(message, `"code":50429`) ||
		strings.Contains(message, "api limit") ||
		strings.Contains(message, "rate limit") ||
		strings.Contains(message, "too many requests")
}

func extractOCRFailureMessage(resp []byte, fallback string) string {
	message := strings.TrimSpace(fallback)
	if message != "" {
		return message
	}

	var payload map[string]json.RawMessage
	if err := json.Unmarshal(resp, &payload); err != nil {
		return ""
	}
	rawMessage, ok := payload["Message"]
	if !ok {
		return ""
	}
	_ = json.Unmarshal(rawMessage, &message)
	return strings.TrimSpace(message)
}

type ocrExecutionError struct {
	userMessage string
	err         error
}

func newOCRExecutionError(err error) error {
	if err == nil {
		return nil
	}
	return &ocrExecutionError{
		userMessage: errOCRUnavailableMessage,
		err:         err,
	}
}

func (e *ocrExecutionError) Error() string {
	if e == nil {
		return ""
	}
	if e.err != nil {
		return e.err.Error()
	}
	return e.userMessage
}

func (e *ocrExecutionError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.err
}

func (e *ocrExecutionError) ExecutionUserMessage() string {
	if e == nil {
		return ""
	}
	return e.userMessage
}

// SetInvokeHookForTest 设置 OCR 调用测试钩子。
func (c *VolcengineOCRClient) SetInvokeHookForTest(fn func(context.Context, string, string) (string, error)) {
	if c == nil || fn == nil {
		return
	}
	c.invokeOCRByURL = func(ctx context.Context, _ *shared.OCRConfig, fileURL, fileType string) (string, error) {
		return fn(ctx, fileURL, fileType)
	}
}

// SetInvokeBytesHookForTest 设置 OCR 字节流调用测试钩子。
func (c *VolcengineOCRClient) SetInvokeBytesHookForTest(fn func(context.Context, []byte, string) (string, error)) {
	if c == nil || fn == nil {
		return
	}
	c.invokeOCRBytes = func(ctx context.Context, _ *shared.OCRConfig, data []byte, fileType string) (string, error) {
		return fn(ctx, data, fileType)
	}
}

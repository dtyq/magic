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
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/volcengine/volc-sdk-golang/base"
	"github.com/volcengine/volc-sdk-golang/service/visual"
	"golang.org/x/net/http/httpproxy"

	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/infrastructure/logging"
)

// ErrOCRFailed 表示 OCR 失败时的错误。
var ErrOCRFailed = errors.New("ocr failed")

var errUnexpectedHeadStatus = errors.New("unexpected head status")

const (
	errOCRUnavailableMessage = "OCR recognition is unavailable"

	// SuccessCode 表示火山 OCR API 成功时返回的代码。
	SuccessCode = 10000

	ocrActionVersion        = "2021-08-23"
	ocrFormVersion          = "v3"
	ocrPageNum              = "100"
	defaultOCRHost          = "visual.volcengineapi.com"
	defaultOCRScheme        = "https"
	volcHTTPProxyEnv        = "VOLC_HTTP_PROXY"
	volcHTTPSProxyEnv       = "VOLC_HTTPS_PROXY"
	volcNoProxyEnv          = "VOLC_NO_PROXY"
	volcengineURLCacheModel = "ocr:volcengine:url"
	volcengineBytesCacheMod = "ocr:volcengine:bytes"
)

type headerSnapshot struct {
	LastModified  string
	Etag          string
	ContentLength string
}

// VolcengineOCRClient 火山引擎 OCR 客户端
type VolcengineOCRClient struct {
	configProvider documentdomain.OCRConfigProviderPort
	cacheRepo      documentdomain.OCRResultCacheRepository
	logger         *logging.SugaredLogger
	fetchHeaders   func(context.Context, string) (headerSnapshot, error)
	invokeOCRByURL func(context.Context, *shared.OCRConfig, string, string) (string, error)
	invokeOCRBytes func(context.Context, *shared.OCRConfig, []byte, string) (string, error)
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
		fetchHeaders:   fetchRemoteHeaders,
		invokeOCRByURL: callVolcengineOCR,
		invokeOCRBytes: callVolcengineOCRBytes,
	}
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

	headers, cached, ok := c.lookupCachedPayload(ctx, provider, fileURL, fileType)
	if ok {
		return cached.Content, nil
	}

	content, err := c.invokeOCRByURL(ctx, ocrConfig, fileURL, ocrFileType)
	if err != nil {
		if c.logger != nil {
			c.logger.ErrorContext(ctx, "火山 OCR 调用失败", "provider", provider, "file_type", ocrFileType, "url", fileURL, "error", err)
		}
		return "", newOCRExecutionError(
			errOCRUnavailableMessage,
			fmt.Errorf("invoke volcengine ocr: %w", err),
		)
	}

	c.persistCachedPayload(ctx, provider, fileURL, fileType, headers, content)
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

	content, err := c.invokeOCRBytes(ctx, ocrConfig, data, ocrFileType)
	if err != nil {
		if c.logger != nil {
			c.logger.ErrorContext(ctx, "火山 OCR 字节流调用失败", "provider", provider, "file_type", ocrFileType, "error", err)
		}
		return "", newOCRExecutionError(
			errOCRUnavailableMessage,
			fmt.Errorf("invoke volcengine ocr bytes: %w", err),
		)
	}

	c.persistCachedBytesPayload(ctx, hash, provider, fileType, content)
	return content, nil
}

func (c *VolcengineOCRClient) lookupCachedPayload(
	ctx context.Context,
	provider, fileURL, fileType string,
) (headerSnapshot, *documentdomain.OCRResultCache, bool) {
	if c == nil || c.cacheRepo == nil {
		return headerSnapshot{}, nil, false
	}

	headers, err := c.fetchHeaders(ctx, fileURL)
	if err != nil {
		if c.logger != nil {
			c.logger.WarnContext(ctx, "获取 OCR 源文件头失败，跳过缓存", "url", fileURL, "error", err)
		}
		return headerSnapshot{}, nil, false
	}

	cacheHash := buildOCRURLCacheHash(provider, fileType, fileURL)
	cached, err := c.cacheRepo.FindURLCache(ctx, cacheHash, volcengineURLCacheModel)
	if err != nil {
		if errors.Is(err, documentdomain.ErrOCRCacheNotFound) {
			return headers, nil, false
		}
		if c.logger != nil {
			c.logger.WarnContext(ctx, "读取 OCR 缓存失败，跳过缓存", "url", fileURL, "error", err)
		}
		return headers, nil, false
	}
	if cached == nil || !isValidCachedPayload(headers, cached) {
		return headers, cached, false
	}
	if err := c.cacheRepo.Touch(ctx, cached.ID); err != nil && c.logger != nil {
		c.logger.WarnContext(ctx, "更新 OCR 缓存访问统计失败", "cache_id", cached.ID, "url", fileURL, "error", err)
	}
	return headers, cached, true
}

func (c *VolcengineOCRClient) persistCachedPayload(
	ctx context.Context,
	provider, fileURL, fileType string,
	headers headerSnapshot,
	content string,
) {
	if c == nil || c.cacheRepo == nil {
		return
	}
	if err := c.cacheRepo.UpsertURLCache(ctx, &documentdomain.OCRResultCache{
		TextHash:       buildOCRURLCacheHash(provider, fileType, fileURL),
		EmbeddingModel: volcengineURLCacheModel,
		Content:        content,
		FileType:       normalizeCacheFileType(fileType),
		Etag:           headers.Etag,
		LastModified:   headers.LastModified,
		ContentLength:  headers.ContentLength,
	}); err != nil && c.logger != nil {
		c.logger.WarnContext(ctx, "写入 OCR 缓存失败", "url", fileURL, "error", err)
	}
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
			c.logger.WarnContext(ctx, "读取 OCR 字节流缓存失败，跳过缓存", "text_hash", cacheHash, "error", err)
		}
		return "", false
	}
	if cached == nil {
		return "", false
	}
	if err := c.cacheRepo.Touch(ctx, cached.ID); err != nil && c.logger != nil {
		c.logger.WarnContext(ctx, "更新 OCR 字节流缓存访问统计失败", "cache_id", cached.ID, "error", err)
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
		c.logger.WarnContext(ctx, "写入 OCR 字节流缓存失败", "provider", provider, "text_hash", cacheHash, "error", err)
	}
}

func isValidCachedPayload(headers headerSnapshot, cached *documentdomain.OCRResultCache) bool {
	if cached == nil {
		return false
	}
	if headers.LastModified != "" && headers.Etag != "" {
		return cached.LastModified == headers.LastModified && cached.Etag == headers.Etag
	}
	if headers.ContentLength != "" {
		return cached.ContentLength == headers.ContentLength
	}
	return false
}

func buildOCRURLCacheHash(provider, fileType, fileURL string) string {
	return hashOCRCacheInput(provider, normalizeCacheFileType(fileType), strings.TrimSpace(fileURL))
}

func buildOCRBytesCacheHash(provider, fileType string, data []byte) string {
	keyPrefix := provider + "\n" + normalizeCacheFileType(fileType) + "\n"
	hash := sha256.New()
	_, _ = hash.Write([]byte(keyPrefix))
	_, _ = hash.Write(data)
	return hex.EncodeToString(hash.Sum(nil))
}

func hashOCRCacheInput(parts ...string) string {
	hash := sha256.Sum256([]byte(strings.Join(parts, "\n")))
	return hex.EncodeToString(hash[:])
}

func normalizeCacheFileType(fileType string) string {
	return strings.ToLower(strings.TrimSpace(fileType))
}

func normalizeOCRFileType(fileType string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(fileType)) {
	case "pdf":
		return "pdf", nil
	case "jpg", "jpeg", "png", "bmp":
		return "image", nil
	default:
		return "", fmt.Errorf("%w: %s", documentdomain.ErrUnsupportedOCRFileType, fileType)
	}
}

func fetchRemoteHeaders(ctx context.Context, fileURL string) (headerSnapshot, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, fileURL, nil)
	if err != nil {
		return headerSnapshot{}, fmt.Errorf("build head request: %w", err)
	}
	resp, err := http.DefaultTransport.RoundTrip(req)
	if err != nil {
		return headerSnapshot{}, fmt.Errorf("head request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusBadRequest {
		return headerSnapshot{}, fmt.Errorf("%w: %d", errUnexpectedHeadStatus, resp.StatusCode)
	}
	return headerSnapshot{
		LastModified:  strings.TrimSpace(resp.Header.Get("Last-Modified")),
		Etag:          strings.TrimSpace(resp.Header.Get("Etag")),
		ContentLength: strings.TrimSpace(resp.Header.Get("Content-Length")),
	}, nil
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
	form.Add("page_num", ocrPageNum)
	form.Add("file_type", fileType)
	fillForm(form)

	resp, _, err := client.Client.CtxPost(ctx, "OCRPdf", nil, form)
	if err != nil {
		return "", fmt.Errorf("call ocr api failed: %w", err)
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
	return "", fmt.Errorf("%w: code=%d, message=%s", ErrOCRFailed, result.Code, extractOCRFailureMessage(resp, result.Message))
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

func newOCRExecutionError(userMessage string, err error) error {
	if strings.TrimSpace(userMessage) == "" && err == nil {
		return nil
	}
	return &ocrExecutionError{
		userMessage: strings.TrimSpace(userMessage),
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

// SetHeaderHookForTest 设置获取远程头信息的测试钩子。
func (c *VolcengineOCRClient) SetHeaderHookForTest(
	fn func(context.Context, string) (lastModified, etag, contentLength string, err error),
) {
	if c == nil || fn == nil {
		return
	}
	c.fetchHeaders = func(ctx context.Context, fileURL string) (headerSnapshot, error) {
		lastModified, etag, contentLength, err := fn(ctx, fileURL)
		if err != nil {
			return headerSnapshot{}, err
		}
		return headerSnapshot{
			LastModified:  lastModified,
			Etag:          etag,
			ContentLength: contentLength,
		}, nil
	}
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

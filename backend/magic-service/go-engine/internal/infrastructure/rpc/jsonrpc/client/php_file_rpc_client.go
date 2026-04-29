package client

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	neturl "net/url"
	"strings"
	"time"

	"magic/internal/constants"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
)

var (
	// ErrFileObjectNotFound 表示文件对象不存在。
	ErrFileObjectNotFound = errors.New("object not found")
	// ErrFileSourceUnreachable 表示文件源不可达。
	ErrFileSourceUnreachable = errors.New("source unreachable")
	errFilePathEmpty         = errors.New("file path is empty")
	errFilePathInvalid       = errors.New("file path is empty after normalization")
	errFileOrgCodeEmpty      = errors.New("organization code is empty in file path")
	errFileOrgScopeMissing   = errors.New("organization scope is missing in file path")
)

// PHPFileRPCClient 通过 IPC 调用 PHP 文件服务。
type PHPFileRPCClient struct {
	server            *unixsocket.Server
	logger            *logging.SugaredLogger
	callGetLink       func(context.Context, map[string]any, *fileGetLinkResponse) error
	callStat          func(context.Context, map[string]any, *fileStatResponse) error
	isClientConnected func() bool
	getLinkHook       func(context.Context, map[string]any) (code int, message, url string, err error)
	statHook          func(context.Context, map[string]any) (code int, message string, exists bool, err error)
}

type fileGetLinkResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		URL string `json:"url"`
	} `json:"data"`
}

type fileStatResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		Exists bool  `json:"exists"`
		Size   int64 `json:"size"`
	} `json:"data"`
}

// NewPHPFileRPCClient 创建 PHP 文件服务 RPC 客户端。
func NewPHPFileRPCClient(server *unixsocket.Server, logger *logging.SugaredLogger) *PHPFileRPCClient {
	client := &PHPFileRPCClient{
		server: server,
		logger: logger,
	}
	client.callGetLink = func(ctx context.Context, params map[string]any, out *fileGetLinkResponse) error {
		return unixsocket.CallRPCTypedWithContext(ctx, server, constants.MethodFileGetLink, params, out)
	}
	client.callStat = func(ctx context.Context, params map[string]any, out *fileStatResponse) error {
		return unixsocket.CallRPCTypedWithContext(ctx, server, constants.MethodFileStat, params, out)
	}
	client.isClientConnected = func() bool {
		return server != nil && server.GetRPCClientCount() > 0
	}
	return client
}

// SetGetLinkHookForTest 设置 getLink 测试钩子。
func (c *PHPFileRPCClient) SetGetLinkHookForTest(fn func(context.Context, map[string]any) (code int, message, url string, err error)) {
	c.getLinkHook = fn
}

// SetStatHookForTest 设置 stat 测试钩子。
func (c *PHPFileRPCClient) SetStatHookForTest(fn func(context.Context, map[string]any) (code int, message string, exists bool, err error)) {
	c.statHook = fn
}

// SetConnectedHookForTest 设置连接状态测试钩子。
func (c *PHPFileRPCClient) SetConnectedHookForTest(fn func() bool) {
	c.isClientConnected = fn
}

// Fetch 获取文件流（通过 getLink -> HTTP GET）。
func (c *PHPFileRPCClient) Fetch(ctx context.Context, path string) (io.ReadCloser, error) {
	if isHTTPURL(path) {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimSpace(path), nil)
		if err != nil {
			return nil, fmt.Errorf("%w: create request failed: %w", ErrFileSourceUnreachable, err)
		}
		resp, err := roundTrip(req)
		if err != nil {
			return nil, fmt.Errorf("%w: do request failed: %w", ErrFileSourceUnreachable, err)
		}
		if resp.StatusCode == http.StatusOK {
			return resp.Body, nil
		}
		_ = resp.Body.Close()
		if resp.StatusCode == http.StatusNotFound {
			return nil, fmt.Errorf("%w: status=%d", ErrFileObjectNotFound, resp.StatusCode)
		}
		return nil, fmt.Errorf("%w: status=%d", ErrFileSourceUnreachable, resp.StatusCode)
	}

	link, err := c.GetLink(ctx, path, http.MethodGet, 10*time.Minute)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, link, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: create request failed: %w", ErrFileSourceUnreachable, err)
	}
	resp, err := roundTrip(req)
	if err != nil {
		return nil, fmt.Errorf("%w: do request failed: %w", ErrFileSourceUnreachable, err)
	}
	if resp.StatusCode == http.StatusOK {
		return resp.Body, nil
	}
	_ = resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("%w: status=%d", ErrFileObjectNotFound, resp.StatusCode)
	}
	return nil, fmt.Errorf("%w: status=%d", ErrFileSourceUnreachable, resp.StatusCode)
}

// GetLink 获取文件访问链接。
func (c *PHPFileRPCClient) GetLink(ctx context.Context, path, method string, expire time.Duration) (string, error) {
	if isHTTPURL(path) {
		return strings.TrimSpace(path), nil
	}
	if !c.connected() {
		return "", ErrNoClientConnected
	}
	filePath, organizationCode, err := normalizeRPCFilePath(path)
	if err != nil {
		return "", errors.Join(ErrFileSourceUnreachable, err)
	}
	if method == "" {
		method = http.MethodGet
	}
	expireSeconds := int64(expire.Seconds())
	if expireSeconds <= 0 {
		expireSeconds = int64((10 * time.Minute).Seconds())
	}

	params := map[string]any{
		"organization_code": organizationCode,
		"file_path":         filePath,
		"bucket_type":       "private",
		"method":            strings.ToUpper(method),
		"expire_seconds":    expireSeconds,
	}
	result, err := c.requestGetLink(ctx, params, filePath)
	if err != nil {
		return "", err
	}
	if result.Code != 0 {
		return "", classifyFileRPCCode(result.Code, result.Message)
	}

	link := strings.TrimSpace(result.Data.URL)
	if link == "" {
		return "", fmt.Errorf("%w: empty link", ErrFileSourceUnreachable)
	}
	return link, nil
}

// Stat 检查对象是否可达。
func (c *PHPFileRPCClient) Stat(ctx context.Context, path string) error {
	if isHTTPURL(path) {
		req, err := http.NewRequestWithContext(ctx, http.MethodHead, strings.TrimSpace(path), nil)
		if err != nil {
			return fmt.Errorf("%w: create request failed: %w", ErrFileSourceUnreachable, err)
		}
		resp, err := roundTrip(req)
		if err != nil {
			return fmt.Errorf("%w: do request failed: %w", ErrFileSourceUnreachable, err)
		}
		_ = resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			return nil
		}
		if resp.StatusCode == http.StatusNotFound {
			return fmt.Errorf("%w: status=%d", ErrFileObjectNotFound, resp.StatusCode)
		}
		return fmt.Errorf("%w: status=%d", ErrFileSourceUnreachable, resp.StatusCode)
	}
	if !c.connected() {
		return ErrNoClientConnected
	}
	filePath, organizationCode, err := normalizeRPCFilePath(path)
	if err != nil {
		return errors.Join(ErrFileSourceUnreachable, err)
	}

	params := map[string]any{
		"organization_code": organizationCode,
		"file_path":         filePath,
		"bucket_type":       "private",
	}
	result, err := c.requestStat(ctx, params, filePath)
	if err != nil {
		return err
	}
	if result.Code != 0 {
		return classifyFileRPCCode(result.Code, result.Message)
	}
	if !result.Data.Exists {
		return fmt.Errorf("%w: exists=false", ErrFileObjectNotFound)
	}
	return nil
}

// FileSize 返回源文件大小，无法获取时返回错误并交由读取阶段兜底限制。
func (c *PHPFileRPCClient) FileSize(ctx context.Context, path string) (int64, error) {
	if isHTTPURL(path) {
		return c.httpURLFileSize(ctx, path)
	}
	if !c.connected() {
		return 0, ErrNoClientConnected
	}
	filePath, organizationCode, err := normalizeRPCFilePath(path)
	if err != nil {
		return 0, errors.Join(ErrFileSourceUnreachable, err)
	}

	params := map[string]any{
		"organization_code": organizationCode,
		"file_path":         filePath,
		"bucket_type":       "private",
	}
	result, err := c.requestStat(ctx, params, filePath)
	if err != nil {
		return 0, err
	}
	if result.Code != 0 {
		return 0, classifyFileRPCCode(result.Code, result.Message)
	}
	if !result.Data.Exists {
		return 0, fmt.Errorf("%w: exists=false", ErrFileObjectNotFound)
	}
	if result.Data.Size <= 0 {
		return 0, fmt.Errorf("%w: file size unavailable", ErrFileSourceUnreachable)
	}
	return result.Data.Size, nil
}

func (c *PHPFileRPCClient) httpURLFileSize(ctx context.Context, path string) (int64, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, strings.TrimSpace(path), nil)
	if err != nil {
		return 0, fmt.Errorf("%w: create request failed: %w", ErrFileSourceUnreachable, err)
	}
	resp, err := roundTrip(req)
	if err != nil {
		return 0, fmt.Errorf("%w: do request failed: %w", ErrFileSourceUnreachable, err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		return contentLengthOrError(resp.ContentLength)
	}
	if resp.StatusCode == http.StatusNotFound {
		return 0, fmt.Errorf("%w: status=%d", ErrFileObjectNotFound, resp.StatusCode)
	}
	return 0, fmt.Errorf("%w: status=%d", ErrFileSourceUnreachable, resp.StatusCode)
}

func contentLengthOrError(contentLength int64) (int64, error) {
	if contentLength <= 0 {
		return 0, fmt.Errorf("%w: content length unavailable", ErrFileSourceUnreachable)
	}
	return contentLength, nil
}

func (c *PHPFileRPCClient) connected() bool {
	return c != nil && c.isClientConnected != nil && c.isClientConnected()
}

func normalizeRPCFilePath(raw string) (filePath, organizationCode string, err error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", "", errFilePathEmpty
	}
	if isHTTPURL(trimmed) {
		parsed, parseErr := neturl.Parse(trimmed)
		if parseErr != nil {
			return "", "", fmt.Errorf("invalid url: %w", parseErr)
		}
		trimmed = strings.TrimLeft(parsed.Path, "/")
	}
	trimmed = strings.TrimLeft(trimmed, "/")
	if trimmed == "" {
		return "", "", errFilePathInvalid
	}

	parts := strings.SplitN(trimmed, "/", 2)
	if len(parts) < 2 || strings.TrimSpace(parts[1]) == "" {
		return "", "", errFileOrgScopeMissing
	}
	org := strings.TrimSpace(parts[0])
	if org == "" {
		return "", "", errFileOrgCodeEmpty
	}
	return trimmed, org, nil
}

func isHTTPURL(value string) bool {
	lower := strings.ToLower(strings.TrimSpace(value))
	return strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://")
}

func classifyFileRPCCode(code int, message string) error {
	if code == http.StatusNotFound {
		return fmt.Errorf("%w: %s", ErrFileObjectNotFound, message)
	}
	return fmt.Errorf("%w: code=%d, message=%s", ErrFileSourceUnreachable, code, message)
}

func (c *PHPFileRPCClient) requestGetLink(ctx context.Context, params map[string]any, path string) (*fileGetLinkResponse, error) {
	result := &fileGetLinkResponse{}
	if c.getLinkHook != nil {
		code, message, url, err := c.getLinkHook(ctx, params)
		if err != nil {
			return nil, errors.Join(ErrFileSourceUnreachable, err)
		}
		result.Code = code
		result.Message = message
		result.Data.URL = url
		return result, nil
	}
	if err := c.callGetLink(ctx, params, result); err != nil {
		if c.logger != nil {
			c.logger.ErrorContext(ctx, "调用 PHP 文件服务 getLink 失败", "path", path, "error", err)
		}
		return nil, errors.Join(ErrFileSourceUnreachable, err)
	}
	return result, nil
}

func (c *PHPFileRPCClient) requestStat(ctx context.Context, params map[string]any, path string) (*fileStatResponse, error) {
	result := &fileStatResponse{}
	if c.statHook != nil {
		code, message, exists, err := c.statHook(ctx, params)
		if err != nil {
			return nil, errors.Join(ErrFileSourceUnreachable, err)
		}
		result.Code = code
		result.Message = message
		result.Data.Exists = exists
		return result, nil
	}
	if err := c.callStat(ctx, params, result); err != nil {
		if c.logger != nil {
			c.logger.ErrorContext(ctx, "调用 PHP 文件服务 stat 失败", "path", path, "error", err)
		}
		return nil, errors.Join(ErrFileSourceUnreachable, err)
	}
	return result, nil
}

func roundTrip(req *http.Request) (*http.Response, error) {
	resp, err := http.DefaultTransport.RoundTrip(req)
	if err != nil {
		return nil, fmt.Errorf("round trip request: %w", err)
	}
	return resp, nil
}

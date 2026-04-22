// Package file 提供文件存储客户端实现
package file

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	neturl "net/url"
	"strings"
	"time"

	"github.com/volcengine/ve-tos-golang-sdk/v2/tos"
	"github.com/volcengine/ve-tos-golang-sdk/v2/tos/enum"

	"magic/internal/domain/knowledge/shared"
)

// ErrFetchURLFailed 表示抓取 URL 失败时的错误。
var ErrFetchURLFailed = errors.New("fetch url failed")

var (
	// ErrBucketNotFound 表示存储桶不存在。
	ErrBucketNotFound = errors.New("bucket not found")
	// ErrObjectNotFound 表示对象不存在。
	ErrObjectNotFound = errors.New("object not found")
	// ErrSourceUnreachable 表示源不可达（网络、鉴权或其他异常）。
	ErrSourceUnreachable = errors.New("source unreachable")
)

// TOSFileClient 火山引擎 TOS 文件客户端
type TOSFileClient struct {
	client     *tos.ClientV2
	config     *shared.StorageConfig
	headObject func(context.Context, *tos.HeadObjectV2Input) (*tos.HeadObjectV2Output, error)
}

// Fetch 获取文件内容流
func (c *TOSFileClient) Fetch(ctx context.Context, path string) (io.ReadCloser, error) {
	// 如果是 URL，直接 HTTP Get (兼容 HTTP/HTTPS)
	if isURL(path) {
		targetURL, err := normalizeRemoteURL(path)
		if err != nil {
			return nil, err
		}
		req, err := http.NewRequestWithContext(ctx, "GET", targetURL, nil)
		if err != nil {
			return nil, fmt.Errorf("create request failed: %w", err)
		}
		resp, err := roundTrip(req)
		if err != nil {
			return nil, fmt.Errorf("do request failed: %w", err)
		}
		if resp.StatusCode != http.StatusOK {
			_ = resp.Body.Close()
			return nil, fmt.Errorf("%w: status=%d", ErrFetchURLFailed, resp.StatusCode)
		}
		return resp.Body, nil
	}

	// 否则作为 TOS Object Key
	output, err := c.client.GetObjectV2(ctx, &tos.GetObjectV2Input{
		Bucket: c.config.Bucket,
		Key:    path,
	})
	if err != nil {
		return nil, fmt.Errorf("get tos object failed: %w", err)
	}
	return output.Content, nil
}

// GetLink 获取文件预签名 URL
func (c *TOSFileClient) GetLink(ctx context.Context, path, method string, expire time.Duration) (string, error) {
	if isURL(path) {
		return path, nil
	}

	// 转换 method string 到 enum.HttpMethodType
	var httpMethod enum.HttpMethodType
	switch strings.ToUpper(method) {
	case "GET":
		httpMethod = enum.HttpMethodGet
	case "PUT":
		httpMethod = enum.HttpMethodPut
	case "POST":
		httpMethod = enum.HttpMethodPost
	case "DELETE":
		httpMethod = enum.HttpMethodDelete
	default:
		httpMethod = enum.HttpMethodGet
	}

	output, err := c.client.PreSignedURL(&tos.PreSignedURLInput{
		HTTPMethod: httpMethod,
		Bucket:     c.config.Bucket,
		Key:        path,
		Expires:    int64(expire.Seconds()),
	})
	if err != nil {
		return "", fmt.Errorf("presign tos url failed: %w", err)
	}
	return output.SignedUrl, nil
}

// Stat 检查文件源是否可达/存在。
func (c *TOSFileClient) Stat(ctx context.Context, path string) error {
	if c == nil || c.config == nil {
		return fmt.Errorf("%w: storage client not initialized", ErrSourceUnreachable)
	}
	if isURL(path) {
		return c.statRemoteURL(ctx, path)
	}
	if strings.TrimSpace(path) == "" {
		return fmt.Errorf("%w: empty object key", ErrSourceUnreachable)
	}
	if c.client == nil {
		return fmt.Errorf("%w: tos client not initialized", ErrSourceUnreachable)
	}

	if c.headObject == nil {
		return fmt.Errorf("%w: head object function not initialized", ErrSourceUnreachable)
	}

	_, err := c.headObject(ctx, &tos.HeadObjectV2Input{
		Bucket: c.config.Bucket,
		Key:    path,
	})
	if err == nil {
		return nil
	}
	return classifyTOSStatError(err)
}

func isURL(path string) bool {
	return len(path) > 4 && (path[:4] == "http")
}

func normalizeRemoteURL(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", ErrFetchURLFailed
	}
	parsed, err := neturl.ParseRequestURI(trimmed)
	if err != nil {
		return "", fmt.Errorf("%w: invalid url", ErrFetchURLFailed)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", fmt.Errorf("%w: unsupported scheme", ErrFetchURLFailed)
	}
	if strings.TrimSpace(parsed.Host) == "" {
		return "", fmt.Errorf("%w: missing host", ErrFetchURLFailed)
	}

	normalized := parsed.String()
	clone := map[string]string{"url": normalized}
	return clone["url"], nil
}

func roundTrip(req *http.Request) (*http.Response, error) {
	resp, err := http.DefaultTransport.RoundTrip(req)
	if err != nil {
		return nil, fmt.Errorf("round trip request: %w", err)
	}
	return resp, nil
}

func (c *TOSFileClient) statRemoteURL(ctx context.Context, rawURL string) error {
	targetURL, err := normalizeRemoteURL(rawURL)
	if err != nil {
		return errors.Join(ErrSourceUnreachable, err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, targetURL, nil)
	if err != nil {
		return fmt.Errorf("%w: create request failed: %w", ErrSourceUnreachable, err)
	}
	resp, err := roundTrip(req)
	if err != nil {
		return fmt.Errorf("%w: do request failed: %w", ErrSourceUnreachable, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode >= 200 && resp.StatusCode < 400 {
		return nil
	}
	if resp.StatusCode == http.StatusNotFound {
		return fmt.Errorf("%w: status=%d", ErrObjectNotFound, resp.StatusCode)
	}
	return fmt.Errorf("%w: status=%d", ErrSourceUnreachable, resp.StatusCode)
}

func classifyTOSStatError(err error) error {
	errMsg := strings.ToLower(err.Error())
	code := strings.ToLower(strings.TrimSpace(tos.Code(err)))
	statusCode := tos.StatusCode(err)

	if code == "nosuchbucket" ||
		strings.Contains(errMsg, "specified bucket does not exist") ||
		strings.Contains(errMsg, "bucket not found") ||
		strings.Contains(errMsg, "ec=0006-") {
		return errors.Join(ErrBucketNotFound, err)
	}

	if code == "nosuchkey" ||
		code == "notfound" ||
		statusCode == http.StatusNotFound ||
		strings.Contains(errMsg, "no such key") ||
		strings.Contains(errMsg, "object not found") ||
		strings.Contains(errMsg, "ec=0017-") {
		return errors.Join(ErrObjectNotFound, err)
	}

	return errors.Join(ErrSourceUnreachable, err)
}

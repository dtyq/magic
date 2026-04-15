package external

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	neturl "net/url"
	"strings"
	"time"

	"golang.org/x/net/html"

	embeddingdomain "magic/internal/domain/knowledge/embedding"
)

var (
	// ErrTooManyRedirects 表示重定向次数过多时的错误
	ErrTooManyRedirects = errors.New("stopped after too many redirects")
	// ErrURLEmpty 表示 URL 为空时的错误
	ErrURLEmpty = errors.New("URL cannot be empty")
	// ErrURLInvalid 表示 URL 格式非法。
	ErrURLInvalid = errors.New("invalid URL")
	// ErrURLSchemeUnsupported 表示 URL 协议不受支持。
	ErrURLSchemeUnsupported = errors.New("unsupported URL scheme")
	// ErrUnexpectedStatusCode 表示 HTTP 状态码异常时的错误
	ErrUnexpectedStatusCode = errors.New("unexpected status code")
)

// 编译时检查是否实现了接口
var _ embeddingdomain.ContentLoader = (*ContentLoader)(nil)

const (
	defaultTimeout = 30 * time.Second
	maxContentSize = 10 * 1024 * 1024 // 10MB 上限
	maxRedirects   = 10
	maxHTMLDepth   = 100
	userAgent      = "Magic-ContentLoader/1.0"
)

// ContentLoader Infrastructure 服务，负责从外部源加载内容
type ContentLoader struct {
	client *http.Client
}

// NewContentLoader 创建新的内容加载器
func NewContentLoader() *ContentLoader {
	return &ContentLoader{
		client: &http.Client{
			Timeout: defaultTimeout,
			CheckRedirect: func(_ *http.Request, via []*http.Request) error {
				if len(via) >= maxRedirects {
					return fmt.Errorf("%w: %d", ErrTooManyRedirects, maxRedirects)
				}
				return nil
			},
		},
	}
}

// NewContentLoaderWithClient 使用自定义 HTTP client 创建内容加载器。
// client 为 nil 时回退到默认 client。
func NewContentLoaderWithClient(client *http.Client) *ContentLoader {
	if client == nil {
		return NewContentLoader()
	}
	return &ContentLoader{client: client}
}

// LoadFromURL 从 URL 加载内容
func (l *ContentLoader) LoadFromURL(ctx context.Context, rawURL string) (string, error) {
	if rawURL == "" {
		return "", ErrURLEmpty
	}
	targetURL, err := normalizeTargetURL(rawURL)
	if err != nil {
		return "", err
	}

	// 创建请求
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

	// 发送请求
	resp, err := l.send(req)
	if err != nil {
		return "", fmt.Errorf("failed to fetch URL: %w", err)
	}
	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil {
			// 日志记录关闭错误，但不影响主流程
			_ = closeErr
		}
	}()

	// 检查状态码
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("%w: %d", ErrUnexpectedStatusCode, resp.StatusCode)
	}

	// 限制读取大小
	limitReader := io.LimitReader(resp.Body, maxContentSize)
	body, err := io.ReadAll(limitReader)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	// 检测内容类型并提取文本
	contentType := resp.Header.Get("Content-Type")
	if strings.Contains(contentType, "text/html") || strings.Contains(contentType, "application/xhtml") {
		return l.extractTextFromHTML(string(body))
	}

	// 默认返回原始文本
	return strings.TrimSpace(string(body)), nil
}

// extractTextFromHTML 从 HTML 中提取纯文本
func (l *ContentLoader) extractTextFromHTML(htmlContent string) (string, error) {
	doc, err := html.Parse(strings.NewReader(htmlContent))
	if err != nil {
		return "", fmt.Errorf("failed to parse HTML: %w", err)
	}

	var textBuilder strings.Builder
	var extract func(*html.Node, int)
	extract = func(n *html.Node, depth int) {
		if depth > maxHTMLDepth {
			return
		}

		if n.Type == html.TextNode {
			text := strings.TrimSpace(n.Data)
			if text != "" {
				textBuilder.WriteString(text)
				textBuilder.WriteString(" ")
			}
		}

		// 跳过不需要的标签
		if n.Type == html.ElementNode {
			switch n.Data {
			case "script", "style", "noscript", "iframe", "object", "embed":
				return
			}
		}

		for c := n.FirstChild; c != nil; c = c.NextSibling {
			extract(c, depth+1)
		}
	}

	extract(doc, 0)
	result := textBuilder.String()

	// 清理多余空格
	result = strings.Join(strings.Fields(result), " ")
	return strings.TrimSpace(result), nil
}

func normalizeTargetURL(rawURL string) (string, error) {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return "", ErrURLEmpty
	}
	parsed, err := neturl.ParseRequestURI(trimmed)
	if err != nil {
		return "", errors.Join(ErrURLInvalid, err)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", fmt.Errorf("%w: %s", ErrURLSchemeUnsupported, parsed.Scheme)
	}
	if strings.TrimSpace(parsed.Host) == "" {
		return "", ErrURLEmpty
	}

	normalized := parsed.String()
	clone := map[string]string{"url": normalized}
	return clone["url"], nil
}

func (l *ContentLoader) send(req *http.Request) (*http.Response, error) {
	transport := l.client.Transport
	if transport == nil {
		transport = http.DefaultTransport
	}

	requestCtx := req.Context()
	if l.client.Timeout > 0 {
		if _, ok := req.Context().Deadline(); !ok {
			ctx, cancel := context.WithTimeout(req.Context(), l.client.Timeout)
			defer cancel()
			requestCtx = ctx
		}
	}

	currentReq := req.Clone(requestCtx)
	via := make([]*http.Request, 0, maxRedirects)

	for {
		resp, err := transport.RoundTrip(currentReq)
		if err != nil {
			return nil, fmt.Errorf("round trip request: %w", err)
		}
		if !isRedirectStatus(resp.StatusCode) {
			return resp, nil
		}

		location := strings.TrimSpace(resp.Header.Get("Location"))
		if location == "" {
			return resp, nil
		}
		if len(via) >= maxRedirects {
			_ = resp.Body.Close()
			return nil, fmt.Errorf("%w: %d", ErrTooManyRedirects, maxRedirects)
		}

		nextURL, err := currentReq.URL.Parse(location)
		if err != nil {
			_ = resp.Body.Close()
			return nil, errors.Join(ErrURLInvalid, err)
		}
		nextReq := currentReq.Clone(requestCtx)
		nextReq.URL = nextURL
		if shouldChangeToGET(resp.StatusCode, currentReq.Method) {
			nextReq.Method = http.MethodGet
			nextReq.Body = nil
			nextReq.GetBody = nil
			nextReq.ContentLength = 0
		}

		via = append(via, currentReq)
		if l.client.CheckRedirect != nil {
			if err := l.client.CheckRedirect(nextReq, via); err != nil {
				_ = resp.Body.Close()
				return nil, fmt.Errorf("check redirect: %w", err)
			}
		}

		_ = resp.Body.Close()
		currentReq = nextReq
	}
}

func isRedirectStatus(code int) bool {
	switch code {
	case http.StatusMovedPermanently, http.StatusFound, http.StatusSeeOther, http.StatusTemporaryRedirect, http.StatusPermanentRedirect:
		return true
	default:
		return false
	}
}

func shouldChangeToGET(code int, method string) bool {
	switch code {
	case http.StatusMovedPermanently, http.StatusFound, http.StatusSeeOther:
		return method != http.MethodGet && method != http.MethodHead
	default:
		return false
	}
}

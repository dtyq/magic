package proxy

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/sirupsen/logrus"
)

type Client struct {
	baseURL *url.URL
}

type Request struct {
	Method     string
	TargetPath string
	Query      string
	Headers    map[string]string
}

type ProxyOptions struct {
	Headers map[string]string
}

func NewClient(baseURL string) (*Client, error) {
	parsedURL, err := url.Parse(baseURL)
	if err != nil {
		return nil, fmt.Errorf("invalid base URL: %v", err)
	}

	return &Client{
		baseURL: parsedURL,
	}, nil
}

func (c *Client) ProxyHTTP(w http.ResponseWriter, r *http.Request, targetPath string, opts ProxyOptions) {
	proxy := httputil.NewSingleHostReverseProxy(c.baseURL)

	proxy.Director = func(req *http.Request) {
		req.URL.Scheme = c.baseURL.Scheme
		req.URL.Host = c.baseURL.Host
		req.URL.Path = targetPath
		req.URL.RawQuery = r.URL.RawQuery
		req.Host = c.baseURL.Host

		req.Header.Set("X-Forwarded-Host", r.Header.Get("Host"))
		req.Header.Set("X-Forwarded-Proto", "http")
		if clientIP := getClientIP(r); clientIP != "" {
			req.Header.Set("X-Forwarded-For", clientIP)
		}

		if opts.Headers != nil {
			for key, value := range opts.Headers {
				req.Header.Set(key, value)
			}
		}
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, req *http.Request, err error) {
		logrus.Errorf("Proxy error: %v", err)
		w.WriteHeader(http.StatusBadGateway)
		w.Write([]byte(fmt.Sprintf("Proxy error: %v", err)))
	}

	proxy.ServeHTTP(w, r)
}

func getClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return xff
	}

	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	return r.RemoteAddr
}

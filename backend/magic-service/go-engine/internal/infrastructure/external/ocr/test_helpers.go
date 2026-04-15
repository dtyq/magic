package ocr

import (
	"net/http"
	"net/url"
)

// ResolveVolcengineEndpointForTest 暴露 endpoint 解析逻辑供测试使用。
func ResolveVolcengineEndpointForTest(endpoint string) (string, string) {
	return resolveVolcengineEndpoint(endpoint)
}

// ResolveVolcengineProxyForTest 暴露代理解析逻辑供测试使用。
func ResolveVolcengineProxyForTest(req *http.Request) (*url.URL, error) {
	return resolveVolcengineProxy()(req)
}

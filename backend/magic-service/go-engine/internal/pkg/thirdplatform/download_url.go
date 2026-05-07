// Package thirdplatform 定义第三方文档解析的共享请求/响应模型。
package thirdplatform

import (
	"net/url"
	"strings"
)

// SelectDownloadURL 从候选下载地址中选择最合适的一条，并兼容旧的单地址字段。
func SelectDownloadURL(extension string, downloadURLs []string, fallback string) string {
	candidates := compactDownloadURLs(downloadURLs)
	normalizedExtension := normalizeDownloadExtension(extension)
	if normalizedExtension != "" {
		suffix := "/." + normalizedExtension
		for i := len(candidates) - 1; i >= 0; i-- {
			if hasDownloadPathSuffix(candidates[i], suffix) {
				return candidates[i]
			}
		}
	}
	if len(candidates) > 0 {
		return candidates[len(candidates)-1]
	}
	return strings.TrimSpace(fallback)
}

func compactDownloadURLs(downloadURLs []string) []string {
	if len(downloadURLs) == 0 {
		return nil
	}
	candidates := make([]string, 0, len(downloadURLs))
	for _, candidate := range downloadURLs {
		candidate = strings.TrimSpace(candidate)
		if candidate == "" {
			continue
		}
		candidates = append(candidates, candidate)
	}
	return candidates
}

func normalizeDownloadExtension(extension string) string {
	extension = strings.TrimSpace(strings.ToLower(extension))
	return strings.TrimPrefix(extension, ".")
}

func hasDownloadPathSuffix(rawURL, suffix string) bool {
	parsed, err := url.Parse(rawURL)
	path := rawURL
	if err == nil && parsed != nil && parsed.Path != "" {
		path = parsed.Path
	} else if beforeQuery, _, ok := strings.Cut(rawURL, "?"); ok {
		path = beforeQuery
	}
	return strings.HasSuffix(strings.ToLower(path), strings.ToLower(suffix))
}

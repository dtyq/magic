package httpapi

import (
	"net/http"
	"strings"
)

type stripPathPrefixHandler struct {
	prefix string
	next   http.Handler
}

// NewStripPathPrefixHandler wraps next and strips prefix from matching request paths.
func NewStripPathPrefixHandler(prefix string, next http.Handler) http.Handler {
	normalizedPrefix := normalizeStripPathPrefix(prefix)
	if normalizedPrefix == "" {
		return next
	}

	return stripPathPrefixHandler{
		prefix: normalizedPrefix,
		next:   next,
	}
}

func (h stripPathPrefixHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r == nil || r.URL == nil || !pathHasStripPrefix(r.URL.Path, h.prefix) {
		h.next.ServeHTTP(w, r)
		return
	}

	nextRequest := new(http.Request)
	*nextRequest = *r
	nextURL := *r.URL
	nextURL.Path = stripPathPrefix(nextURL.Path, h.prefix)
	nextURL.RawPath = ""
	nextRequest.URL = &nextURL

	h.next.ServeHTTP(w, nextRequest)
}

func normalizeStripPathPrefix(prefix string) string {
	prefix = strings.TrimSpace(prefix)
	if prefix == "" || prefix == "/" {
		return ""
	}
	if !strings.HasPrefix(prefix, "/") {
		prefix = "/" + prefix
	}
	return strings.TrimRight(prefix, "/")
}

func pathHasStripPrefix(path, prefix string) bool {
	return path == prefix || strings.HasPrefix(path, prefix+"/")
}

func stripPathPrefix(path, prefix string) string {
	if path == prefix {
		return "/"
	}
	strippedPath := strings.TrimPrefix(path, prefix)
	if strippedPath == "" {
		return "/"
	}
	return strippedPath
}

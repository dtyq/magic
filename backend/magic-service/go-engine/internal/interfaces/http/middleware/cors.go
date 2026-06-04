// Package middleware 提供 HTTP 中间件函数
package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"magic/internal/pkg/ctxmeta"
)

// CORS 创建 CORS 中间件
func CORS(_ []string) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.Header("Access-Control-Allow-Origin", allowOrigin(ctx.Request))
		ctx.Header("Access-Control-Allow-Credentials", "true")
		ctx.Header("Access-Control-Allow-Headers", allowHeaders(ctx.Request))
		ctx.Header("Access-Control-Allow-Methods", allowMethods(ctx.Request))
		ctx.Header("Vary", "Origin, Access-Control-Request-Headers, Access-Control-Request-Method")

		if ctx.Request.Method == http.MethodOptions {
			ctx.AbortWithStatus(http.StatusNoContent)
			return
		}

		ctx.Next()
	}
}

func allowOrigin(request *http.Request) string {
	if origin := request.Header.Get("Origin"); origin != "" {
		return origin
	}
	return "*"
}

func allowHeaders(request *http.Request) string {
	if headers := request.Header.Get("Access-Control-Request-Headers"); headers != "" {
		return headers
	}
	return "*"
}

func allowMethods(request *http.Request) string {
	if method := request.Header.Get("Access-Control-Request-Method"); method != "" {
		return method
	}
	return "*"
}

// RequestID 创建请求 ID 中间件
func RequestID() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		requestID := normalizeRequestID(ctx.Request.Header.Get("X-Request-ID"))
		if requestID == "" {
			requestID = generateRequestID()
		}

		reqCtx := ctxmeta.WithRequestID(ctx.Request.Context(), requestID)
		ctx.Request = ctx.Request.WithContext(reqCtx)

		ctx.Header("X-Request-ID", requestID)
		ctx.Set("request_id", requestID)
		ctx.Next()
	}
}

// generateRequestID 生成简单的请求 ID
func generateRequestID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return fmt.Sprintf("req_%d", time.Now().UnixNano())
	}
	return "req_" + hex.EncodeToString(b[:])
}

func normalizeRequestID(v string) string {
	s := strings.TrimSpace(v)
	if s == "" {
		return ""
	}
	s = sanitizeRequestID(s)
	if s == "" {
		return ""
	}
	const maxRequestIDLen = 128
	if len(s) > maxRequestIDLen {
		return s[:maxRequestIDLen]
	}
	return s
}

func sanitizeRequestID(v string) string {
	var b strings.Builder
	b.Grow(len(v))
	for _, ch := range v {
		isLetter := ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z'
		isDigit := ch >= '0' && ch <= '9'
		if isLetter || isDigit || ch == '-' || ch == '_' || ch == '.' {
			b.WriteRune(ch)
		}
	}
	return b.String()
}

package middleware

import (
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/logkey"
)

// slogWriter 将 gin 的 writer 适配到 slog
type slogWriter struct {
	level  string
	logger *logging.SugaredLogger
}

func (w *slogWriter) Write(p []byte) (int, error) {
	msg := strings.TrimSpace(string(p))
	if msg == "" {
		return len(p), nil
	}
	switch w.level {
	case "error":
		w.logger.Errorw(msg, "component", "gin")
	case "warn":
		w.logger.Warnw(msg, "component", "gin")
	default:
		w.logger.Infow(msg, "component", "gin")
	}
	return len(p), nil
}

// GinErrorWriter 返回转发到 slog error 的 io.Writer
func GinErrorWriter(logger *logging.SugaredLogger) io.Writer {
	return &slogWriter{level: "error", logger: logger}
}

// SlogAccessLogger 使用 slog 记录 HTTP 访问日志并附带结构化字段
func SlogAccessLogger(logger *logging.SugaredLogger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		ctx := c.Request.Context()
		latency := time.Since(start)
		status := c.Writer.Status()
		fields := []any{
			"type", "http_access",
			"client_ip", c.ClientIP(),
			"status", status,
			logkey.DurationMS, logkey.DurationToMS(latency),
			"method", c.Request.Method,
			logkey.Path, c.Request.URL.Path,
			"proto", c.Request.Proto,
			"user_agent", c.Request.UserAgent(),
			"response_bytes", c.Writer.Size(),
		}
		if c.Errors != nil && c.Errors.String() != "" {
			fields = append(fields, logkey.Error, c.Errors.String())
		}

		// 级别映射
		if status >= http.StatusInternalServerError {
			logger.ErrorContext(ctx, "HTTP request processed", fields...)
			return
		}
		if status >= http.StatusBadRequest {
			logger.WarnContext(ctx, "HTTP request processed", fields...)
			return
		}
		logger.InfoContext(ctx, "HTTP request processed", fields...)
	}
}

package middleware

import (
	"github.com/gin-gonic/gin"

	"github.com/dtyq/sandbox-components/pkg/response"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/config"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
)

func TokenAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		cfg := config.GetConfig()

		if !cfg.IsTokenAuthEnabled() {
			logger.Info("Token authentication disabled, skipping validation")
			c.Next()
			return
		}

		token := c.GetHeader("token")
		if token == "" {
			logger.Warn("Missing token header in sandbox request")
			response.ErrorResponse(c, "Unauthorized: missing token", nil)
			c.Abort()
			return
		}

		if token != cfg.APIToken {
			logger.Warn("Invalid token provided for sandbox request")
			response.ErrorResponse(c, "Unauthorized: invalid token", nil)
			c.Abort()
			return
		}

		logger.Info("Token authentication successful")
		c.Next()
	}
}

func RequestLoggingMiddleware() gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		logger.Infof("Request received: method=%s, path=%s, query=%s, ip=%s, user_agent=%s",
			c.Request.Method, c.Request.URL.Path, c.Request.URL.RawQuery, c.ClientIP(), c.Request.UserAgent())

		c.Next()

		logger.Infof("Request completed: method=%s, path=%s, status=%d",
			c.Request.Method, c.Request.URL.Path, c.Writer.Status())
	})
}

// Package handlers 提供应用的 HTTP 请求处理器。
package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
)

// HealthChecker 定义系统健康检查能力
type HealthChecker interface {
	HealthCheck(ctx context.Context) (map[string]bool, error)
}

// HealthHandler 处理健康检查请求。
type HealthHandler struct {
	checker HealthChecker
}

// NewHealthHandler 创建 HealthHandler 实例。
func NewHealthHandler(checker HealthChecker) *HealthHandler {
	return &HealthHandler{
		checker: checker,
	}
}

// Check 处理健康检查接口。
func (h *HealthHandler) Check(c *gin.Context) {
	ctx := c.Request.Context()
	results, _ := h.checker.HealthCheck(ctx)

	allHealthy := true
	for _, healthy := range results {
		if !healthy {
			allHealthy = false
			break
		}
	}

	status := http.StatusOK
	if !allHealthy {
		status = http.StatusServiceUnavailable
	}

	c.JSON(status, gin.H{
		"success":    allHealthy,
		"components": results,
	})
}

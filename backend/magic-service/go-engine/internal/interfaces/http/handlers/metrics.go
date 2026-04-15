package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// MetricsProvider 定义指标处理接口
type MetricsProvider interface {
	Handler() gin.HandlerFunc
}

// MetricsHandler 处理指标请求。
type MetricsHandler struct {
	provider MetricsProvider
}

// NewMetricsHandler 创建 MetricsHandler 实例。
func NewMetricsHandler(provider MetricsProvider) *MetricsHandler {
	return &MetricsHandler{
		provider: provider,
	}
}

// Handle 处理指标接口。
func (h *MetricsHandler) Handle(c *gin.Context) {
	if h.provider != nil {
		h.provider.Handler()(c)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "metrics_disabled"})
}

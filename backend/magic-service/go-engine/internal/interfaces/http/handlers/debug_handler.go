package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	embeddingapp "magic/internal/application/knowledge/embedding/service"
)

// DebugHandler 处理调试请求。
type DebugHandler struct {
	embeddingAppService *embeddingapp.EmbeddingAppService
}

// NewDebugHandler 创建 DebugHandler 实例。
func NewDebugHandler(embeddingAppService *embeddingapp.EmbeddingAppService) *DebugHandler {
	return &DebugHandler{
		embeddingAppService: embeddingAppService,
	}
}

// ListProviders 触发 IPC 调用以获取 embedding 提供方列表。
func (h *DebugHandler) ListProviders(c *gin.Context) {
	ctx := c.Request.Context()
	providers, err := h.embeddingAppService.ListProviders(ctx, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"providers": providers,
	})
}

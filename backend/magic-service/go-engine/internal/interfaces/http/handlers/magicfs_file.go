package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	magicfsapp "magic/internal/application/magicfs/service"
)

// MagicFSFileHandler 处理 MagicFS 文件 HTTP 请求。
type MagicFSFileHandler struct {
	service *magicfsapp.FileVersionService
}

// NewMagicFSFileHandler 创建 MagicFSFileHandler。
func NewMagicFSFileHandler(service *magicfsapp.FileVersionService) *MagicFSFileHandler {
	return &MagicFSFileHandler{service: service}
}

// GetVersion 返回 MagicFS 文件元数据版本号。
func (h *MagicFSFileHandler) GetVersion(c *gin.Context) {
	version, err := h.service.GetFileVersion(c.Request.Context(), cloneHeaders(c.Request.Header), c.Param("id"))
	if err != nil {
		h.writeError(c, err)
		return
	}
	writeSuccess(c, gin.H{
		"version": version,
	})
}

func (h *MagicFSFileHandler) writeError(c *gin.Context, err error) {
	apiErr := magicfsapp.APIErrorFromError(err)
	status := http.StatusOK
	if apiErr.System {
		status = http.StatusInternalServerError
	}
	writeAPIResponse(c, status, apiErr.Code, apiErr.Message, nil)
}

func cloneHeaders(headers map[string][]string) map[string][]string {
	if len(headers) == 0 {
		return map[string][]string{}
	}
	cloned := make(map[string][]string, len(headers))
	for key, values := range headers {
		cloned[key] = append([]string(nil), values...)
	}
	return cloned
}

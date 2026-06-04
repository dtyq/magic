package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const apiSuccessCode = 1000

// APIResponse 对齐 magic-service low_code HTTP 响应结构。
type APIResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data"`
}

func writeSuccess(c *gin.Context, data any) {
	writeAPIResponse(c, http.StatusOK, apiSuccessCode, "ok", data)
}

func writeError(c *gin.Context, status int, message string) {
	writeAPIResponse(c, status, status, message, nil)
}

func writeAPIResponse(c *gin.Context, status, code int, message string, data any) {
	c.JSON(status, APIResponse{
		Code:    code,
		Message: message,
		Data:    data,
	})
}

func readOrganizationCode(c *gin.Context) string {
	if c == nil {
		return ""
	}
	for _, key := range []string{"organization-code", "Organization-Code", "organization_code"} {
		value := strings.TrimSpace(c.GetHeader(key))
		if value != "" {
			return value
		}
	}
	return ""
}

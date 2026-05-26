package handlers

import (
	"net/http"

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

func writeAPIResponse(c *gin.Context, status, code int, message string, data any) {
	c.JSON(status, APIResponse{
		Code:    code,
		Message: message,
		Data:    data,
	})
}

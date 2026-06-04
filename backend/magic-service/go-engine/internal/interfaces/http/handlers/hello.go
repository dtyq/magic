package handlers

import "github.com/gin-gonic/gin"

// HelloHandler 处理 Go HTTP 直连链路探测请求。
type HelloHandler struct{}

// NewHelloHandler 创建 HelloHandler 实例。
func NewHelloHandler() *HelloHandler {
	return &HelloHandler{}
}

// SayHello 返回固定响应，用于验证 /go/api 到 Go HTTP 服务的链路。
func (h *HelloHandler) SayHello(c *gin.Context) {
	writeSuccess(c, gin.H{
		"message": "hello world",
	})
}

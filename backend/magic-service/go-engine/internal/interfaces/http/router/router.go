// Package router 提供应用路由配置。
package router

import (
	"net/http/pprof"
	"strings"

	"github.com/gin-gonic/gin"
)

// Dependencies 保存路由初始化所需的依赖。
type Dependencies struct {
	Engine         *gin.Engine
	BasePath       string
	PprofEnabled   bool
	HealthHandler  HealthRouteHandler
	MetricsHandler MetricsRouteHandler
	DebugHandler   DebugRouteHandler
}

// HealthRouteHandler 定义健康检查路由处理器。
type HealthRouteHandler interface {
	Check(*gin.Context)
}

// MetricsRouteHandler 定义指标路由处理器。
type MetricsRouteHandler interface {
	Handle(*gin.Context)
}

// DebugRouteHandler 定义调试路由处理器。
type DebugRouteHandler interface {
	ListProviders(*gin.Context)
}

// SetupRoutes 注册应用的全部路由
func SetupRoutes(deps Dependencies) {
	// 根路由
	deps.Engine.GET("/health", deps.HealthHandler.Check)
	deps.Engine.GET("/metrics", deps.MetricsHandler.Handle)
	deps.Engine.GET("/debug/providers", deps.DebugHandler.ListProviders)
	if deps.PprofEnabled {
		registerPprofRoutes(deps.Engine)
	}

	// API 分组
	base := normalizeBasePath(deps.BasePath)
	api := deps.Engine.Group(base)

	// 未来模块占位
	_ = api.Group("/memory")
	_ = api.Group("/search")
}

func registerPprofRoutes(engine *gin.Engine) {
	debug := engine.Group("/debug/pprof")
	debug.GET("/", gin.WrapF(pprof.Index))
	debug.GET("/cmdline", gin.WrapF(pprof.Cmdline))
	debug.GET("/profile", gin.WrapF(pprof.Profile))
	debug.POST("/symbol", gin.WrapF(pprof.Symbol))
	debug.GET("/symbol", gin.WrapF(pprof.Symbol))
	debug.GET("/trace", gin.WrapF(pprof.Trace))
	debug.GET("/allocs", gin.WrapH(pprof.Handler("allocs")))
	debug.GET("/block", gin.WrapH(pprof.Handler("block")))
	debug.GET("/goroutine", gin.WrapH(pprof.Handler("goroutine")))
	debug.GET("/heap", gin.WrapH(pprof.Handler("heap")))
	debug.GET("/mutex", gin.WrapH(pprof.Handler("mutex")))
	debug.GET("/threadcreate", gin.WrapH(pprof.Handler("threadcreate")))
}

func normalizeBasePath(base string) string {
	base = strings.TrimSpace(base)
	if base == "" {
		return "/api/v1"
	}
	if !strings.HasPrefix(base, "/") {
		base = "/" + base
	}
	return strings.TrimRight(base, "/")
}

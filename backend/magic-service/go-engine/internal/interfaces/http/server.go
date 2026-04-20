// Package httpapi 提供 HTTP 服务的初始化与管理
package httpapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"magic/internal/constants"
	"magic/internal/infrastructure/logging"
	"magic/internal/interfaces/http/handlers"
	"magic/internal/interfaces/http/middleware"
	"magic/internal/interfaces/http/router"
	rpcRoutes "magic/internal/interfaces/rpc/jsonrpc/knowledge/routes"
	jsonrpc "magic/internal/pkg/jsonrpc"
)

// Mode 表示 HTTP 服务运行模式（debug/release/test）。
type Mode string

const (
	// ModeRelease 表示 gin release 模式
	ModeRelease Mode = "release"
	// ModeTest 表示 gin test 模式
	ModeTest Mode = "test"
	// 注：ModeDebug 已移除，因未使用
)

// ServerConfig 保存 HTTP 服务配置。
type ServerConfig struct {
	Enabled        bool
	Host           string
	Port           int
	Mode           Mode
	BasePath       string
	Env            string // 环境：dev、staging、production 等
	PprofEnabled   bool
	Neo4jURI       string
	QdrantHost     string
	QdrantPort     int
	AllowedOrigins []string
}

// MetricsService 定义指标中间件与处理器接口
// 定义在此处以避免直接依赖基础设施层
type MetricsService interface {
	Middleware() gin.HandlerFunc
	Handler() gin.HandlerFunc
}

// RPCServer 定义 RPC 服务接口（如 Unix Socket 传输适配器）
type RPCServer interface {
	Start() error
	Close() error
	RegisterHandler(method string, handler jsonrpc.ServerHandler)
}

// RetrievalWarmupService 定义启动后异步检索预热能力。
type RetrievalWarmupService interface {
	WarmupRetrieval(ctx context.Context) error
}

// CacheCleanupService 定义缓存清理后台服务能力。
type CacheCleanupService interface {
	StartCleanupDaemon(ctx context.Context) error
}

// ServerDependencies 服务器依赖参数
type ServerDependencies struct {
	Config              *ServerConfig
	CacheCleanupService CacheCleanupService
	RetrievalWarmup     RetrievalWarmupService
	InfraServices       InfraServices
	Logger              *logging.SugaredLogger
	Metrics             MetricsService
	RPCServer           RPCServer
	RPCHandlers         RPCHandlers
	DebugHandler        *handlers.DebugHandler
}

// RPCHandlers RPC 处理器集合
type RPCHandlers struct {
	Knowledge rpcRoutes.HandlerProvider
	Fragment  rpcRoutes.HandlerProvider
	Document  rpcRoutes.HandlerProvider
	Embedding rpcRoutes.HandlerProvider
}

// InfraServices 定义 Server 依赖的基础设施服务能力，避免直接依赖基础设施层具体实现
type InfraServices interface {
	HealthCheck(ctx context.Context) (map[string]bool, error)
	Close(ctx context.Context) error
}

// Server 表示 HTTP 服务
type Server struct {
	engine     *gin.Engine
	httpServer *http.Server
	config     *ServerConfig
	stateMu    sync.Mutex

	// 服务
	infraServices InfraServices
	metrics       MetricsService
	rpcServer     RPCServer
	rpcHandlers   RPCHandlers

	// 后台服务
	cacheCleanupService CacheCleanupService
	retrievalWarmup     RetrievalWarmupService
	backgroundCancel    context.CancelFunc

	// 处理器
	healthHandler  *handlers.HealthHandler
	metricsHandler *handlers.MetricsHandler
	debugHandler   *handlers.DebugHandler

	// 日志
	logger *logging.SugaredLogger

	stopSignal sync.Once
	stopCh     chan struct{}
}

// NewServerWithDependencies 构建带依赖的 Server 实例
func NewServerWithDependencies(deps *ServerDependencies) *Server {
	switch deps.Config.Mode {
	case ModeRelease:
		gin.SetMode(gin.ReleaseMode)
	case ModeTest:
		gin.SetMode(gin.TestMode)
	default:
		gin.SetMode(gin.DebugMode)
	}
	engine := gin.New()

	return &Server{
		engine:              engine,
		config:              deps.Config,
		infraServices:       deps.InfraServices,
		cacheCleanupService: deps.CacheCleanupService,
		retrievalWarmup:     deps.RetrievalWarmup,
		logger:              deps.Logger,
		metrics:             deps.Metrics,
		rpcServer:           deps.RPCServer,
		rpcHandlers:         deps.RPCHandlers,
		healthHandler:       handlers.NewHealthHandler(deps.InfraServices),
		metricsHandler:      handlers.NewMetricsHandler(deps.Metrics),
		debugHandler:        deps.DebugHandler,
		stopCh:              make(chan struct{}),
	}
}

// Initialize 准备服务依赖、中间件与路由。
func (s *Server) Initialize() error {
	s.initializeAPIs()
	s.setupMiddleware()
	s.setupRoutes()
	s.setupRPCRoutes()

	return nil
}

func (s *Server) initializeAPIs() {
	// 空操作，memoryAPI 已构建
}

func (s *Server) setupRPCRoutes() {
	if s.rpcServer == nil {
		return
	}

	rpcRoutes.SetupRPCRoutes(rpcRoutes.Dependencies{
		Server:           s.rpcServer,
		KnowledgeHandler: s.rpcHandlers.Knowledge,
		FragmentHandler:  s.rpcHandlers.Fragment,
		DocumentHandler:  s.rpcHandlers.Document,
		EmbeddingHandler: s.rpcHandlers.Embedding,
	})
}

func (s *Server) setupMiddleware() {
	// Recovery 中间件
	s.engine.Use(gin.RecoveryWithWriter(middleware.GinErrorWriter(s.logger)))

	// Request ID 中间件
	s.engine.Use(middleware.RequestID())

	s.engine.Use(middleware.SlogAccessLogger(s.logger))

	// Metrics 中间件
	if s.metrics != nil {
		s.engine.Use(s.metrics.Middleware())
	}

	// CORS 中间件
	s.engine.Use(middleware.CORS(s.config.AllowedOrigins))

	// 限流中间件（可选）
	// s.engine.Use(middleware.RateLimit()) // 示例
}

func (s *Server) setupRoutes() {
	// 无日志处理 favicon.ico 请求
	s.engine.GET("/favicon.ico", func(c *gin.Context) {
		c.Status(http.StatusNoContent) // 204 No Content（无内容）
	})

	router.SetupRoutes(router.Dependencies{
		Engine:         s.engine,
		BasePath:       s.config.BasePath,
		PprofEnabled:   s.config.PprofEnabled,
		HealthHandler:  s.healthHandler,
		MetricsHandler: s.metricsHandler,
		DebugHandler:   s.debugHandler,
	})

	// 静态文件服务（如需）
	// s.engine.Static("/static", "./static") // 示例
}

// Start 启动 HTTP 服务。
func (s *Server) Start(ctx context.Context) error {
	// 先完成初始化
	if err := s.Initialize(); err != nil {
		return err
	}

	s.startBackgroundServices(ctx)
	defer s.stopBackgroundServices()

	// 启动 RPC 服务
	if s.rpcServer != nil {
		if err := s.rpcServer.Start(); err != nil {
			s.logger.ErrorContext(ctx, "Failed to start RPC server", "error", err)
		}
	}

	if !s.config.Enabled {
		s.logger.InfoContext(ctx, "HTTP server disabled; running in IPC-only mode")
		select {
		case <-ctx.Done():
			return nil
		case <-s.stopCh:
			return nil
		}
	}

	// 创建 HTTP 服务
	httpServer := &http.Server{
		Addr:              fmt.Sprintf("%s:%d", s.config.Host, s.config.Port),
		Handler:           s.engine,
		ReadHeaderTimeout: constants.DefaultReadWriteTimeout,
		WriteTimeout:      constants.DefaultReadWriteTimeout,
		IdleTimeout:       constants.DefaultIdleTimeout,
	}
	s.setHTTPServer(httpServer)
	defer s.clearHTTPServer(httpServer)

	// 启动服务
	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("failed to start server: %w", err)
	}

	return nil
}

// Stop 优雅关闭 HTTP 服务并关闭基础设施服务。
func (s *Server) Stop(ctx context.Context) error {
	s.signalStop()
	s.stopBackgroundServices()

	// 开发模式：快速关闭以避免热重载时端口冲突
	if strings.EqualFold(s.config.Env, "dev") {
		if httpServer := s.getHTTPServer(); httpServer != nil {
			// 立即关闭，不等待进行中的请求
			_ = httpServer.Close()
		}
		if s.rpcServer != nil {
			_ = s.rpcServer.Close()
		}
		s.closeInfraServices(ctx)
		return nil
	}

	// 先停止缓存清理守护进程
	if s.cacheCleanupService != nil {
		s.logger.InfoContext(ctx, "Stopping cache cleanup daemon...")
		// 留出时间以便优雅清理
		const gracefulShutdownWait = 2 * time.Second
		time.Sleep(gracefulShutdownWait)
		s.logger.InfoContext(ctx, "Cache cleanup daemon stopped")
	}

	// 停止 HTTP 服务（优雅）
	if httpServer := s.getHTTPServer(); httpServer != nil {
		if err := httpServer.Shutdown(ctx); err != nil {
			return fmt.Errorf("failed to shutdown server: %w", err)
		}
	}

	// 停止 RPC 服务
	if s.rpcServer != nil {
		if err := s.rpcServer.Close(); err != nil {
			s.logger.WarnContext(ctx, "failed to shutdown RPC server", "error", err)
		}
	}

	// 关闭生命周期服务（会关闭所有连接）
	s.closeInfraServices(ctx)

	return nil
}

func (s *Server) signalStop() {
	s.stopSignal.Do(func() {
		close(s.stopCh)
	})
}

func (s *Server) closeInfraServices(ctx context.Context) {
	if s.infraServices == nil {
		return
	}
	if err := s.infraServices.Close(ctx); err != nil {
		s.logger.WarnContext(ctx, "failed to close infra services", "error", err)
	}
}

func (s *Server) startBackgroundServices(ctx context.Context) {
	if s.cacheCleanupService == nil && s.retrievalWarmup == nil {
		return
	}

	backgroundCtx, backgroundCancel := context.WithCancel(ctx)
	s.setBackgroundCancel(backgroundCancel)

	if s.cacheCleanupService != nil {
		go func() {
			if err := s.cacheCleanupService.StartCleanupDaemon(backgroundCtx); err != nil {
				s.logger.ErrorContext(backgroundCtx, "Cache cleanup daemon failed", "error", err)
			}
		}()
		s.logger.DebugContext(ctx, "Cache cleanup daemon started in background")
	}
	if s.retrievalWarmup != nil {
		go func() {
			if err := s.retrievalWarmup.WarmupRetrieval(backgroundCtx); err != nil && !errors.Is(err, context.Canceled) {
				s.logger.WarnContext(backgroundCtx, "Retrieval warmup failed", "error", err)
			}
		}()
	}
}

func (s *Server) stopBackgroundServices() {
	if backgroundCancel := s.takeBackgroundCancel(); backgroundCancel != nil {
		backgroundCancel()
	}
}

func (s *Server) setBackgroundCancel(cancel context.CancelFunc) {
	s.stateMu.Lock()
	defer s.stateMu.Unlock()
	s.backgroundCancel = cancel
}

func (s *Server) takeBackgroundCancel() context.CancelFunc {
	s.stateMu.Lock()
	defer s.stateMu.Unlock()
	cancel := s.backgroundCancel
	s.backgroundCancel = nil
	return cancel
}

func (s *Server) setHTTPServer(httpServer *http.Server) {
	s.stateMu.Lock()
	defer s.stateMu.Unlock()
	s.httpServer = httpServer
}

func (s *Server) getHTTPServer() *http.Server {
	s.stateMu.Lock()
	defer s.stateMu.Unlock()
	return s.httpServer
}

func (s *Server) clearHTTPServer(httpServer *http.Server) {
	s.stateMu.Lock()
	defer s.stateMu.Unlock()
	if s.httpServer == httpServer {
		s.httpServer = nil
	}
}

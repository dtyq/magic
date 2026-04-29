// Package httpapi 提供 HTTP 服务的初始化与管理
package httpapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"

	"magic/internal/constants"
	"magic/internal/infrastructure/logging"
	"magic/internal/interfaces/http/handlers"
	"magic/internal/interfaces/http/middleware"
	"magic/internal/interfaces/http/router"
	rpcRoutes "magic/internal/interfaces/rpc/jsonrpc/knowledge/routes"
	jsonrpc "magic/internal/pkg/jsonrpc"
	"magic/internal/pkg/runguard"
)

// Mode 表示 HTTP 服务运行模式（debug/release/test）。
type Mode string

const (
	// ModeDebug 表示 gin debug 模式
	ModeDebug Mode = "debug"
	// ModeRelease 表示 gin release 模式
	ModeRelease Mode = "release"
	// ModeTest 表示 gin test 模式
	ModeTest Mode = "test"
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

// TaskQueueService 定义后台任务队列消费能力。
type TaskQueueService interface {
	Start(ctx context.Context) error
}

// TaskQueueLifecycleService 定义带显式停止等待能力的后台任务队列服务。
type TaskQueueLifecycleService interface {
	TaskQueueService
	Stop(ctx context.Context) error
}

// ServerDependencies 服务器依赖参数
type ServerDependencies struct {
	Config              *ServerConfig
	CacheCleanupService CacheCleanupService
	TaskQueueService    TaskQueueService
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
	taskQueueService    TaskQueueService
	retrievalWarmup     RetrievalWarmupService
	backgroundCancel    context.CancelFunc
	backgroundWG        sync.WaitGroup

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
	gin.SetMode(resolveGinMode(deps.Config.Mode))
	engine := gin.New()

	return &Server{
		engine:              engine,
		config:              deps.Config,
		infraServices:       deps.InfraServices,
		cacheCleanupService: deps.CacheCleanupService,
		taskQueueService:    deps.TaskQueueService,
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

func resolveGinMode(configMode Mode) string {
	switch normalizeMode(configMode) {
	case ModeRelease:
		return gin.ReleaseMode
	case ModeTest:
		return gin.TestMode
	case ModeDebug:
		return gin.DebugMode
	}

	if isLocalAppEnv(os.Getenv("APP_ENV")) {
		return gin.DebugMode
	}

	return gin.ReleaseMode
}

func normalizeMode(mode Mode) Mode {
	return Mode(strings.ToLower(strings.TrimSpace(string(mode))))
}

func isLocalAppEnv(env string) bool {
	return strings.EqualFold(strings.TrimSpace(env), "local")
}

// Initialize 准备服务依赖、中间件、路由与 RPC 处理器。
func (s *Server) Initialize() error {
	s.initializeHTTP()
	s.initializeRPC()

	return nil
}

func (s *Server) initializeHTTP() {
	s.initializeAPIs()
	s.setupMiddleware()
	s.setupRoutes()
}

func (s *Server) initializeRPC() {
	s.setupRPCRoutes()
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
	if s.config.Enabled {
		// 仅在启用 HTTP 时初始化 HTTP 中间件与路由，避免 IPC-only 模式产生 Gin 路由注册副作用。
		if err := s.Initialize(); err != nil {
			return err
		}
	} else {
		s.initializeRPC()
	}

	s.startBackgroundServices(ctx)
	defer s.stopBackgroundServices(ctx)

	// 启动 RPC 服务
	if s.rpcServer != nil {
		if err := s.rpcServer.Start(); err != nil {
			s.logger.ErrorContext(ctx, "Failed to start RPC server", "error", err, "pid", os.Getpid())
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

	// 开发模式：快速关闭以避免热重载时端口冲突
	if strings.EqualFold(s.config.Env, "dev") {
		if httpServer := s.getHTTPServer(); httpServer != nil {
			// 立即关闭，不等待进行中的请求
			_ = httpServer.Close()
		}
		if s.rpcServer != nil {
			_ = s.rpcServer.Close()
		}
		s.stopBackgroundServices(ctx)
		s.closeInfraServices(ctx)
		return nil
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

	s.stopBackgroundServices(ctx)

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
	if s.cacheCleanupService == nil && s.retrievalWarmup == nil && s.taskQueueService == nil {
		return
	}

	backgroundCtx, backgroundCancel := context.WithCancel(ctx)
	s.setBackgroundCancel(backgroundCancel)

	if s.cacheCleanupService != nil {
		s.backgroundWG.Go(func() {
			defer runguard.Recover(backgroundCtx, s.backgroundPanicOptions("http.background.cache_cleanup", runguard.ExitProcess))
			if err := s.cacheCleanupService.StartCleanupDaemon(backgroundCtx); err != nil {
				s.logger.KnowledgeErrorContext(backgroundCtx, "Cache cleanup daemon failed", "error", err)
			}
		})
	}
	if s.retrievalWarmup != nil {
		s.backgroundWG.Go(func() {
			defer runguard.Recover(backgroundCtx, s.backgroundPanicOptions("http.background.retrieval_warmup", runguard.Continue))
			if err := s.retrievalWarmup.WarmupRetrieval(backgroundCtx); err != nil && !errors.Is(err, context.Canceled) {
				s.logger.KnowledgeWarnContext(backgroundCtx, "Retrieval warmup failed", "error", err)
			}
		})
	}
	if s.taskQueueService != nil {
		s.backgroundWG.Go(func() {
			defer runguard.Recover(backgroundCtx, s.backgroundPanicOptions("http.background.task_queue", runguard.ExitProcess))
			if err := s.taskQueueService.Start(backgroundCtx); err != nil && !errors.Is(err, context.Canceled) {
				s.logger.KnowledgeErrorContext(backgroundCtx, "Task queue service failed", "error", err)
			}
		})
	}
}

func (s *Server) backgroundPanicOptions(scope string, policy runguard.Policy) runguard.Options {
	return runguard.Options{
		Scope:  scope,
		Policy: policy,
		OnPanic: func(ctx context.Context, report runguard.Report) {
			if s.logger != nil {
				s.logger.KnowledgeErrorContext(ctx, "HTTP background goroutine panic recovered", report.Fields...)
			}
		},
		Exit: os.Exit,
	}
}

func (s *Server) stopBackgroundServices(ctx context.Context) {
	backgroundCancel := s.takeBackgroundCancel()
	if backgroundCancel == nil {
		return
	}

	backgroundCancel()
	if lifecycle, ok := s.taskQueueService.(TaskQueueLifecycleService); ok && lifecycle != nil {
		if err := lifecycle.Stop(ctx); err != nil {
			s.logger.KnowledgeWarnContext(ctx, "failed to stop task queue service", "error", err)
		}
	}
	s.waitBackgroundServices(ctx)
}

func (s *Server) waitBackgroundServices(ctx context.Context) {
	done := make(chan struct{})
	go func() {
		s.backgroundWG.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-ctx.Done():
		s.logger.WarnContext(ctx, "timed out waiting for background services to stop", "error", ctx.Err())
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

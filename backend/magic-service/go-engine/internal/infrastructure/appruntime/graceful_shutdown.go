// Package appruntime 提供应用运行期管理工具
package appruntime

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.uber.org/zap"

	"magic/internal/constants"
)

// GracefulShutdownManager 管理应用的优雅关闭
type GracefulShutdownManager struct {
	shutdownHandlers []ShutdownHandler
	logger           *zap.Logger
	startedAt        time.Time
}

// ShutdownHandler 定义需要优雅关闭的组件接口
type ShutdownHandler interface {
	Stop(ctx context.Context) error
}

// NewGracefulShutdownManager 创建新的优雅关闭管理器
func NewGracefulShutdownManager() *GracefulShutdownManager {
	logger, _ := zap.NewProduction()
	return &GracefulShutdownManager{
		shutdownHandlers: make([]ShutdownHandler, 0),
		logger:           logger,
		startedAt:        time.Now(),
	}
}

// RegisterShutdownHandler 注册需要优雅关闭的组件
func (g *GracefulShutdownManager) RegisterShutdownHandler(handler ShutdownHandler) {
	g.shutdownHandlers = append(g.shutdownHandlers, handler)
}

// WaitForShutdownSignal 等待关闭信号并执行优雅关闭
func (g *GracefulShutdownManager) WaitForShutdownSignal() {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, shutdownSignals()...)
	defer signal.Stop(quit)
	g.waitForShutdownSignal(quit)
}

func shutdownSignals() []os.Signal {
	return []os.Signal{
		syscall.SIGINT,
		syscall.SIGTERM,
		syscall.SIGHUP,
		syscall.SIGQUIT,
	}
}

func (g *GracefulShutdownManager) waitForShutdownSignal(quit <-chan os.Signal) {
	// 等待关闭信号
	sig := <-quit
	shutdownStartedAt := time.Now()
	if g.logger != nil {
		g.logger.Info("Go engine shutdown signal received",
			zap.String("signal", sig.String()),
			zap.Int("pid", os.Getpid()),
			zap.Float64("uptime_seconds", time.Since(g.startedAt).Seconds()),
		)
	} else {
		log.Printf("Go engine shutdown signal received: signal=%s pid=%d", sig.String(), os.Getpid())
	}
	if g.logger != nil {
		g.logger.Info("Shutting down server...")
	} else {
		log.Println("Shutting down server...")
	}

	// 创建关闭上下文
	ctx, cancel := context.WithTimeout(context.Background(), constants.DefaultShutdownTimeout)

	// 执行所有关闭处理器
	for i, handler := range g.shutdownHandlers {
		handlerStartedAt := time.Now()
		if err := handler.Stop(ctx); err != nil {
			if g.logger != nil {
				g.logger.Error("Shutdown handler failed",
					zap.Int("index", i),
					zap.Float64("duration_ms", float64(time.Since(handlerStartedAt))/float64(time.Millisecond)),
					zap.Error(err),
				)
			} else {
				log.Printf("Shutdown handler %d failed: %v", i, err)
			}
			continue
		}
		if g.logger != nil {
			g.logger.Info("Shutdown handler completed",
				zap.Int("index", i),
				zap.Float64("duration_ms", float64(time.Since(handlerStartedAt))/float64(time.Millisecond)),
			)
		}
	}

	// 退出前取消 context
	cancel()

	if g.logger != nil {
		g.logger.Info("Server exited",
			zap.String("signal", sig.String()),
			zap.Float64("shutdown_duration_ms", float64(time.Since(shutdownStartedAt))/float64(time.Millisecond)),
			zap.Float64("uptime_seconds", time.Since(g.startedAt).Seconds()),
		)
		_ = g.logger.Sync()
	} else {
		log.Println("Server exited")
	}
}

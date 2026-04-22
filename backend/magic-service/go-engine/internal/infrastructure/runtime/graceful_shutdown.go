// Package appruntime 提供应用运行期管理工具
package appruntime

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"go.uber.org/zap"

	"magic/internal/constants"
)

// GracefulShutdownManager 管理应用的优雅关闭
type GracefulShutdownManager struct {
	shutdownHandlers []ShutdownHandler
	logger           *zap.Logger
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
	}
}

// RegisterShutdownHandler 注册需要优雅关闭的组件
func (g *GracefulShutdownManager) RegisterShutdownHandler(handler ShutdownHandler) {
	g.shutdownHandlers = append(g.shutdownHandlers, handler)
}

// WaitForShutdownSignal 等待关闭信号并执行优雅关闭
func (g *GracefulShutdownManager) WaitForShutdownSignal() {
	// 等待关闭信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	if g.logger != nil {
		g.logger.Info("Shutting down server...")
	} else {
		log.Println("Shutting down server...")
	}

	// 创建关闭上下文
	ctx, cancel := context.WithTimeout(context.Background(), constants.DefaultShutdownTimeout)

	// 执行所有关闭处理器
	for i, handler := range g.shutdownHandlers {
		if err := handler.Stop(ctx); err != nil {
			if g.logger != nil {
				g.logger.Error("Shutdown handler failed", zap.Int("index", i), zap.Error(err))
			} else {
				log.Printf("Shutdown handler %d failed: %v", i, err)
			}
		}
	}

	// 退出前取消 context
	cancel()

	if g.logger != nil {
		g.logger.Info("Server exited")
		_ = g.logger.Sync()
	} else {
		log.Println("Server exited")
	}

	// 显式退出以确保进程终止
	os.Exit(0)
}

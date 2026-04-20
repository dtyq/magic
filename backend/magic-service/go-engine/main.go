// Package main 是 magic service go engine 应用程序的入口点
package main

import (
	"context"
	"os"

	"magic/internal/infrastructure/logging"
	runtime "magic/internal/infrastructure/runtime"
	http "magic/internal/interfaces/http"
	"magic/internal/pkg/i18n"
	"magic/internal/pkg/logkey"
	"magic/internal/pkg/selfcheck"
)

// initializeApplication 使用Wire初始化应用程序的所有依赖
// Wire会生成wire_gen.go文件，包含真正的实现
func initializeApplication() (*http.Server, func(), error) {
	// 这个函数会被Wire生成的代码替代
	return InitializeApplication()
}

func main() {
	if handled, exitCode := selfcheck.Run(os.Args[1:], os.Stdout, os.Stderr); handled {
		os.Exit(exitCode)
	}

	ctx := context.Background()

	// 初始化 i18n
	i18n.Init()

	// 初始化主 logger（在 Wire 之前）
	logger := logging.New().Named("main")
	logger.InfoContext(ctx, "Starting Magic Service Go Engine...")

	// 初始化应用程序
	server, cleanup, err := initializeApplication()
	if err != nil {
		logger.FatalContext(ctx, "Failed to initialize application", logkey.Error, err)
	}
	defer func() {
		if cleanup != nil {
			cleanup()
		}
	}()

	// 创建优雅关闭管理器
	shutdownManager := runtime.NewGracefulShutdownManager()
	shutdownManager.RegisterShutdownHandler(server)

	// 启动服务器
	go func() {
		if err := server.Start(ctx); err != nil {
			logger.FatalContext(ctx, "Failed to start server", logkey.Error, err)
		}
	}()

	// 等待关闭信号并优雅关闭
	shutdownManager.WaitForShutdownSignal()
}

// Package main 是 magic service go engine 应用程序的入口点
package main

import (
	"context"
	"fmt"
	"os"
	"runtime/debug"
	"time"

	"magic/internal/infrastructure/appruntime"
	"magic/internal/infrastructure/logging"
	http "magic/internal/interfaces/http"
	"magic/internal/pkg/i18n"
	"magic/internal/pkg/logkey"
	"magic/internal/pkg/memoryguard"
	"magic/internal/pkg/selfcheck"
)

// initializeApplication 使用Wire初始化应用程序的所有依赖
// Wire会生成wire_gen.go文件，包含真正的实现
func initializeApplication() (*http.Server, func(), error) {
	// 这个函数会被Wire生成的代码替代
	return InitializeApplication()
}

func main() {
	if err := appruntime.SetDefaultProcessTimezone(); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "failed to set process timezone: %v\n", err)
		os.Exit(1)
	}

	if handled, exitCode := selfcheck.Run(os.Args[1:], os.Stdout, os.Stderr); handled {
		os.Exit(exitCode)
	}

	ctx := context.Background()
	processStartedAt := time.Now()

	// 初始化 i18n
	i18n.Init()

	// 初始化主 logger（在 Wire 之前）
	logger := logging.New().Named("main")
	defer recoverAndExit(ctx, logger, "Go engine main goroutine panic", processStartedAt)
	logProcessStarting(ctx, logger, processStartedAt)
	logGoMemoryLimit(ctx, logger)

	// 初始化应用程序
	initStartedAt := time.Now()
	server, cleanup, err := initializeApplication()
	if err != nil {
		logger.FatalContext(ctx, "Failed to initialize application",
			logkey.Error, err,
			"pid", os.Getpid(),
			"uptime_seconds", time.Since(processStartedAt).Seconds(),
		)
	}
	logger.InfoContext(ctx, "Go engine application initialized",
		logkey.DurationMS, logkey.DurationToMS(time.Since(initStartedAt)),
		"pid", os.Getpid(),
	)
	rollbackCleanup := cleanup
	defer func() {
		if rollbackCleanup != nil {
			rollbackCleanup()
		}
	}()

	// 创建优雅关闭管理器
	shutdownManager := appruntime.NewGracefulShutdownManager()
	shutdownManager.RegisterShutdownHandler(server)

	// 启动服务器
	startServerAsync(ctx, logger, server, processStartedAt)

	// 等待关闭信号并优雅关闭
	shutdownManager.WaitForShutdownSignal()
	rollbackCleanup = nil
}

func logGoMemoryLimit(ctx context.Context, logger *logging.SugaredLogger) {
	limit, applied, err := memoryguard.ConfigureGoMemLimitFromCgroup()
	if err != nil || !applied {
		return
	}
	logger.InfoContext(ctx, "Go runtime memory limit configured",
		"gomemlimit_bytes", limit,
		"pid", os.Getpid(),
	)
}

func logProcessStarting(ctx context.Context, logger *logging.SugaredLogger, processStartedAt time.Time) {
	logger.InfoContext(ctx, "Go engine process starting",
		"pid", os.Getpid(),
		"ppid", os.Getppid(),
		"args", os.Args,
		"config_file", os.Getenv("CONFIG_FILE"),
		"started_at", processStartedAt.Format(time.RFC3339),
	)
}

func startServerAsync(ctx context.Context, logger *logging.SugaredLogger, server *http.Server, processStartedAt time.Time) {
	go func() {
		defer recoverAndExit(ctx, logger, "Go engine server goroutine panic", processStartedAt)

		if err := server.Start(ctx); err != nil {
			logger.FatalContext(ctx, "Failed to start server",
				logkey.Error, err,
				"pid", os.Getpid(),
				"uptime_seconds", time.Since(processStartedAt).Seconds(),
			)
		}
		logger.InfoContext(ctx, "Go engine server returned",
			"pid", os.Getpid(),
			"uptime_seconds", time.Since(processStartedAt).Seconds(),
		)
	}()
}

func recoverAndExit(ctx context.Context, logger *logging.SugaredLogger, message string, processStartedAt time.Time) {
	if recovered := recover(); recovered != nil {
		logger.ErrorContext(ctx, message,
			"panic", fmt.Sprint(recovered),
			"stack", string(debug.Stack()),
			"pid", os.Getpid(),
			"uptime_seconds", time.Since(processStartedAt).Seconds(),
		)
		os.Exit(1)
	}
}

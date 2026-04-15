// Package logging 提供基于 slog 的应用日志。
// 通过 New() 或 NewFromConfig() 进行依赖注入：
//   - logger := logging.New()                 // 示例
//   - logger := logging.NewFromConfig(cfg.Logging) // 示例
package logging

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"

	configloader "magic/internal/config"
	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/logkey"
)

const (
	// keyValuePairSize 表示键值对元素数量（key + value）
	keyValuePairSize = 2
)

// SugaredLogger 使用 slog 模拟 zap 的 SugaredLogger 方法。
// SugaredLogger 包装 slog.Logger，提供类似 zap 的 Sugared API。
type SugaredLogger struct {
	l    *slog.Logger
	name string // 日志名称（如组件/模块名），零额外开销
}

// DebugContext 记录带上下文与结构化字段的 debug 日志。
func (s *SugaredLogger) DebugContext(ctx context.Context, msg string, keysAndValues ...any) {
	s.logCtx(ctx, slog.LevelDebug, msg, keysAndValues...)
}

// InfoContext 记录带上下文与结构化字段的 info 日志。
func (s *SugaredLogger) InfoContext(ctx context.Context, msg string, keysAndValues ...any) {
	s.logCtx(ctx, slog.LevelInfo, msg, keysAndValues...)
}

// WarnContext 记录带上下文与结构化字段的 warning 日志。
func (s *SugaredLogger) WarnContext(ctx context.Context, msg string, keysAndValues ...any) {
	s.logCtx(ctx, slog.LevelWarn, msg, keysAndValues...)
}

// ErrorContext 记录带上下文与结构化字段的 error 日志。
func (s *SugaredLogger) ErrorContext(ctx context.Context, msg string, keysAndValues ...any) {
	s.logCtx(ctx, slog.LevelError, msg, keysAndValues...)
}

// FatalContext 记录带上下文的 error 日志并终止进程。
func (s *SugaredLogger) FatalContext(ctx context.Context, msg string, keysAndValues ...any) {
	s.logCtx(ctx, slog.LevelError, msg, keysAndValues...)
	os.Exit(1)
}

// Debugw 记录带键值对的 debug 日志（无上下文）。
func (s *SugaredLogger) Debugw(msg string, keysAndValues ...any) {
	s.logCtx(context.Background(), slog.LevelDebug, msg, keysAndValues...)
}

// Infow 记录带键值对的 info 日志（无上下文）。
func (s *SugaredLogger) Infow(msg string, keysAndValues ...any) {
	s.logCtx(context.Background(), slog.LevelInfo, msg, keysAndValues...)
}

// Warnw 记录带键值对的 warning 日志（无上下文）。
func (s *SugaredLogger) Warnw(msg string, keysAndValues ...any) {
	s.logCtx(context.Background(), slog.LevelWarn, msg, keysAndValues...)
}

// Errorw 记录带键值对的 error 日志（无上下文）。
func (s *SugaredLogger) Errorw(msg string, keysAndValues ...any) {
	s.logCtx(context.Background(), slog.LevelError, msg, keysAndValues...)
}

// Fatalw 记录 error 日志并终止进程（无上下文）。
func (s *SugaredLogger) Fatalw(msg string, keysAndValues ...any) {
	s.logCtx(context.Background(), slog.LevelError, msg, keysAndValues...)
	os.Exit(1)
}

//nolint:contextcheck // 该方法是日志入口，允许接收并兜底处理外部传入的 ctx。
func (s *SugaredLogger) logCtx(ctx context.Context, level slog.Level, msg string, keysAndValues ...any) {
	if ctx == nil {
		ctx = context.Background()
	}

	// 若级别被禁用则直接返回
	if !s.l.Enabled(ctx, level) {
		return
	}

	// 直接构建 attrs，并统计无效的 kv
	kvLen := len(keysAndValues)
	capacity := kvLen/keyValuePairSize + 2 // 预留 logger + request_id
	attrs := make([]slog.Attr, 0, capacity)

	seenKeys := make(map[string]int, kvLen/keyValuePairSize+2)

	if s.name != "" {
		attrs = appendAttrWithDedup(attrs, seenKeys, "logger", s.name)
	}

	if requestID, ok := ctxmeta.RequestIDFromContext(ctx); ok {
		attrs = appendAttrWithDedup(attrs, seenKeys, logkey.RequestID, requestID)
	}

	badKV := 0

	for i := 0; i < kvLen; i += keyValuePairSize {
		if i+1 >= kvLen { // 参数数量为奇数
			badKV++
			break
		}
		key, ok := keysAndValues[i].(string)
		if !ok || strings.TrimSpace(key) == "" { // 非字符串 key
			badKV++
			continue
		}

		attrs = appendAttrWithDedup(attrs, seenKeys, key, keysAndValues[i+1])
	}
	if badKV > 0 {
		attrs = appendAttrWithDedup(attrs, seenKeys, "bad_kv", badKV)
	}

	s.l.LogAttrs(ctx, level, msg, attrs...)
}

func appendAttrWithDedup(attrs []slog.Attr, seenKeys map[string]int, key string, value any) []slog.Attr {
	if count, exists := seenKeys[key]; exists {
		seenKeys[key] = count + 1
		key = fmt.Sprintf("%s_%d", key, count+1)
	} else {
		seenKeys[key] = 0
	}
	return append(attrs, slog.Any(key, value))
}

// New 基于环境变量与默认配置创建新的 logger 实例。
// 推荐通过依赖注入使用该方式创建 logger。
func New() *SugaredLogger {
	appCfg := configloader.New()
	return NewFromConfig(appCfg.Logging)
}

// Named 创建指定名称的 logger。
// 名称通常是组件、服务或包名。
// 示例：logger.Named("UserService") 或 logger.Named("repository.UserRepo")
// 推荐用于标识日志来源（零性能开销）。
func (s *SugaredLogger) Named(name string) *SugaredLogger {
	return &SugaredLogger{
		l:    s.l,
		name: name,
	}
}

// With 创建带有额外持久字段的子 logger。
// 这些字段会添加到该 logger 的所有日志中。
func (s *SugaredLogger) With(keysAndValues ...any) *SugaredLogger {
	// 构建持久化 attrs
	kvLen := len(keysAndValues)
	attrs := make([]any, 0, kvLen)

	for i := 0; i < kvLen; i += 2 {
		if i+1 >= kvLen {
			break
		}
		if key, ok := keysAndValues[i].(string); ok && strings.TrimSpace(key) != "" {
			attrs = append(attrs, key, keysAndValues[i+1])
		}
	}

	return &SugaredLogger{
		l:    s.l.With(attrs...),
		name: s.name,
	}
}

// NewFromConfig 使用给定配置创建新的 logger 实例。
// 推荐用于自定义配置的 logger 创建。
func NewFromConfig(cfg autoloadcfg.LoggingConfig) *SugaredLogger {
	return NewFromConfigWithWriter(cfg, os.Stdout)
}

// NewFromConfigWithWriter 使用给定配置和 writer 创建新的 logger 实例。
func NewFromConfigWithWriter(cfg autoloadcfg.LoggingConfig, out io.Writer) *SugaredLogger {
	level := parseLevel(string(cfg.Level), slog.LevelInfo)
	opts := &slog.HandlerOptions{
		Level: level,
	}

	var h slog.Handler
	switch strings.ToLower(string(cfg.Format)) {
	case string(autoloadcfg.LogFormatMagic):
		h = newMagicTextHandler(out, opts)
	case string(autoloadcfg.LogFormatText):
		h = slog.NewTextHandler(out, opts)
	default:
		h = slog.NewJSONHandler(out, opts)
	}
	h = newTruncatingHandler(h, defaultLogValueLimit)

	baseLogger := slog.New(h)
	// 统一默认 slog，避免直接 slog.* 与封装 logger 输出不一致。
	slog.SetDefault(baseLogger)

	return &SugaredLogger{
		l:    baseLogger,
		name: "", // 默认为空，使用 Named() 设置
	}
}

// parseLevel 将字符串转换为 slog.Level，支持标准名称与少量别名。
// 未知输入回退到 defaultLevel。
func parseLevel(levelStr string, defaultLevel slog.Level) slog.Level {
	s := strings.TrimSpace(strings.ToLower(levelStr))
	if s == "" {
		return defaultLevel
	}
	// 尽量使用 slog 的原生文本解析
	var lvl slog.Level
	if err := lvl.UnmarshalText([]byte(s)); err == nil {
		return lvl
	}
	// 常见别名
	if s == "warning" {
		return slog.LevelWarn
	}
	return defaultLevel
}

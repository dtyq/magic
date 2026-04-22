package logging_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"testing"

	autoloadcfg "magic/internal/config/autoload"
	logging "magic/internal/infrastructure/logging"
)

func TestParseLevelAndLoggerBuilders(t *testing.T) {
	t.Parallel()

	if got := logging.ParseLevelForTest("warning", slog.LevelInfo); got != slog.LevelWarn {
		t.Fatalf("ParseLevelForTest(warning) = %v", got)
	}
	if got := logging.ParseLevelForTest("debug", slog.LevelInfo); got != slog.LevelDebug {
		t.Fatalf("ParseLevelForTest(debug) = %v", got)
	}
	if got := logging.ParseLevelForTest("unknown", slog.LevelWarn); got != slog.LevelWarn {
		t.Fatalf("ParseLevelForTest(unknown) = %v", got)
	}

	for _, cfg := range []autoloadcfg.LoggingConfig{
		{Level: autoloadcfg.LogLevel("debug"), Format: autoloadcfg.LogFormatJSON},
		{Level: autoloadcfg.LogLevel("debug"), Format: autoloadcfg.LogFormatText},
		{Level: autoloadcfg.LogLevel("debug"), Format: autoloadcfg.LogFormatMagic},
	} {
		if logger := logging.NewFromConfig(cfg); logger == nil {
			t.Fatalf("NewFromConfig(%+v) returned nil logger", cfg)
		}
	}
}

func TestSugaredLoggerWithPersistentFieldsAndBadKV(t *testing.T) {
	t.Parallel()

	var buf bytes.Buffer
	logger := logging.NewSugaredLoggerForTest(
		slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug}),
		"base",
	).With("scope", "alpha", "", "skip").Named("child")
	logger.Debugw("hello", "k", "v1", "k", "v2", 123)

	var got map[string]any
	if err := json.Unmarshal(buf.Bytes(), &got); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if got["logger"] != "child" || got["scope"] != "alpha" || got["k"] != "v1" || got["k_1"] != "v2" {
		t.Fatalf("unexpected logged fields: %#v", got)
	}
	if got["bad_kv"] != float64(1) {
		t.Fatalf("expected bad_kv=1, got %#v", got["bad_kv"])
	}
}

func TestMagicTextHandlerWithAttrsAndGroups(t *testing.T) {
	t.Parallel()

	var buf bytes.Buffer
	handler := logging.NewMagicTextHandlerForTest(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})
	logger := logging.NewSugaredLoggerForTest(handler.WithGroup("req").WithAttrs([]slog.Attr{slog.String("trace_id", "trace-1")}), "demo")
	logger.InfoContext(context.Background(), "msg", "payload", map[string]any{"name": "demo"})

	line := buf.String()
	if !strings.Contains(line, `"req.trace_id":"trace-1"`) {
		t.Fatalf("expected grouped trace id in payload, got %q", line)
	}
	if !strings.Contains(line, `"req.payload":{"name":"demo"}`) {
		t.Fatalf("expected payload in line, got %q", line)
	}
}

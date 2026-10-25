package logging_test

import (
	"bytes"
	"context"
	"log/slog"
	"regexp"
	"strings"
	"testing"

	logging "magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
)

const (
	expectedWarningLevel = "WARNING"
	expectedErrorLevel   = "ERROR"
)

func TestMagicTextHandler_FormatAndNoColorInBuffer(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	logger := logging.NewSugaredLoggerForTest(
		logging.NewMagicTextHandlerForTest(&buf, &slog.HandlerOptions{Level: slog.LevelDebug}),
		"rpc.client",
	)

	ctx := ctxmeta.WithRequestID(context.Background(), "req_abc")
	logger.ErrorContext(ctx, "RPC runtime connect failed", "endpoint", "runtime/magic_engine.sock", "error", "boom")

	line := strings.TrimSpace(buf.String())
	if line == "" {
		t.Fatalf("expected log output")
	}
	if strings.Contains(line, "\x1b[") {
		t.Fatalf("buffer output should not contain ANSI color codes: %q", line)
	}

	pattern := `^\[ERROR\]\[req_abc\]\[\d+\]\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]\[rpc\.client\]\[goEngineException: RPC runtime connect failed\]\{.*\}$`
	if ok := regexp.MustCompile(pattern).MatchString(line); !ok {
		t.Fatalf("unexpected log format: %q", line)
	}
	if !strings.Contains(line, `"endpoint":"runtime/magic_engine.sock"`) {
		t.Fatalf("expected endpoint in context: %q", line)
	}
}

func TestMagicTextHandler_TraceIDUsesSearchablePrefix(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	logger := logging.NewSugaredLoggerForTest(
		logging.NewMagicTextHandlerForTest(&buf, &slog.HandlerOptions{Level: slog.LevelDebug}),
		"app",
	).With("trace_id", "8ec7b527d38f3977")

	logger.InfoContext(context.Background(), "message")

	line := strings.TrimSpace(buf.String())
	if !strings.Contains(line, "[trace_id:8ec7b527d38f3977]") {
		t.Fatalf("expected searchable trace id prefix, got %q", line)
	}
	if strings.Contains(line, "[8ec7b527d38f3977]") {
		t.Fatalf("trace id should not use the legacy bare bracket format: %q", line)
	}
}

func TestLevelName(t *testing.T) {
	t.Parallel()
	if got := logging.LevelNameForTest(slog.LevelWarn); got != expectedWarningLevel {
		t.Fatalf("unexpected warn level name: %s", got)
	}
	if got := logging.LevelNameForTest(slog.LevelError); got != expectedErrorLevel {
		t.Fatalf("unexpected error level name: %s", got)
	}
}

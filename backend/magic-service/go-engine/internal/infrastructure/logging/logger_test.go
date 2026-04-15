package logging_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"testing"

	logging "magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/logkey"
)

func TestLoggerInjectsRequestIDFromContext(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	l := logging.NewSugaredLoggerForTest(
		slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug}),
		"unit",
	)

	ctx := ctxmeta.WithRequestID(context.Background(), "req_test_1")
	l.InfoContext(ctx, "hello", "event", "demo")

	var got map[string]any
	if err := json.Unmarshal(buf.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal log line: %v", err)
	}
	if got[logkey.RequestID] != "req_test_1" {
		t.Fatalf("unexpected request_id: %#v", got[logkey.RequestID])
	}
	if got["logger"] != "unit" {
		t.Fatalf("unexpected logger name: %#v", got["logger"])
	}
	if got["event"] != "demo" {
		t.Fatalf("unexpected event field: %#v", got["event"])
	}
}

func TestLoggerDedupKeys(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	l := logging.NewSugaredLoggerForTest(
		slog.NewJSONHandler(&buf, &slog.HandlerOptions{
			Level: slog.LevelDebug,
		}),
		"",
	)

	l.InfoContext(context.Background(), "dup", "k", "v1", "k", "v2")

	var got map[string]any
	if err := json.Unmarshal(buf.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal log line: %v", err)
	}
	if got["k"] != "v1" {
		t.Fatalf("unexpected first key value: %#v", got["k"])
	}
	if got["k_1"] != "v2" {
		t.Fatalf("unexpected deduped key value: %#v", got["k_1"])
	}
}

package logging_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"testing"

	logging "magic/internal/infrastructure/logging"
)

func TestTruncatingHandler_TruncatesMessageAndFields(t *testing.T) {
	t.Parallel()

	var buf bytes.Buffer
	logger := logging.NewSugaredLoggerForTest(
		logging.NewTruncatingHandlerForTest(
			slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug}),
		),
		"unit",
	)

	longText := strings.Repeat("超", 3000)
	logger.InfoContext(
		context.Background(),
		longText,
		"payload", map[string]any{"text": longText},
		"bytes", []byte(longText),
	)

	var got map[string]any
	if err := json.Unmarshal(buf.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal log line: %v", err)
	}

	message, _ := got["msg"].(string)
	if !strings.Contains(message, "(truncated)") {
		t.Fatalf("expected truncated message, got %q", message)
	}
	if message == longText {
		t.Fatalf("expected message to be truncated")
	}

	payload, ok := got["payload"].(map[string]any)
	if !ok {
		t.Fatalf("expected payload map, got %#v", got["payload"])
	}
	payloadText, _ := payload["text"].(string)
	if !strings.Contains(payloadText, "(truncated)") {
		t.Fatalf("expected nested payload to be truncated, got %q", payloadText)
	}

	bytesText, _ := got["bytes"].(string)
	if !strings.Contains(bytesText, "(truncated)") {
		t.Fatalf("expected bytes payload to be truncated, got %q", bytesText)
	}
}

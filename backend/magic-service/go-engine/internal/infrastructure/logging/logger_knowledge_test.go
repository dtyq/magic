package logging_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"testing"

	logging "magic/internal/infrastructure/logging"
)

func TestPrefixEngineException(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		msg  string
		want string
	}{
		{
			name: "empty",
			msg:  "",
			want: "goEngineException",
		},
		{
			name: "plain",
			msg:  "cache failed",
			want: "goEngineException: cache failed",
		},
		{
			name: "already prefixed",
			msg:  "goEngineException: cache failed",
			want: "goEngineException: cache failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := logging.PrefixEngineException(tt.msg); got != tt.want {
				t.Fatalf("PrefixEngineException(%q) = %q, want %q", tt.msg, got, tt.want)
			}
		})
	}
}

func TestWarnContextPrefixesMessage(t *testing.T) {
	t.Parallel()

	var buf bytes.Buffer
	logger := logging.NewSugaredLoggerForTest(
		slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug}),
		"knowledge.test",
	)

	logger.WarnContext(context.Background(), "vector sync failed", "document_code", "DOC-1")

	var got map[string]any
	if err := json.Unmarshal(buf.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal log line: %v", err)
	}
	if got["msg"] != "goEngineException: vector sync failed" {
		t.Fatalf("unexpected msg: %#v", got["msg"])
	}
	if got["document_code"] != "DOC-1" {
		t.Fatalf("unexpected document_code: %#v", got["document_code"])
	}
}

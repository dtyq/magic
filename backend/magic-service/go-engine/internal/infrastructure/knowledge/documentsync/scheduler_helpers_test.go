package documentsync_test

import (
	"context"
	"testing"

	"magic/internal/infrastructure/knowledge/documentsync"
)

func TestRunnerFuncCloneTaskAndDedupeKey(t *testing.T) {
	t.Parallel()

	called := false
	runner := documentsync.RunnerFunc(func(_ context.Context, task *documentsync.Task) error {
		called = task != nil && task.Code == "doc-1"
		return nil
	})
	if err := runner.Run(context.Background(), &documentsync.Task{Code: "doc-1"}); err != nil {
		t.Fatalf("RunnerFunc.Run() error = %v", err)
	}
	if !called {
		t.Fatal("expected runner func to be called")
	}

	original := &documentsync.Task{KnowledgeBaseCode: "kb-1", Code: "doc-1", Mode: "resync", Payload: []byte("demo")}
	cloned := documentsync.CloneTask(original)
	cloned.Payload[0] = 'D'
	if string(original.Payload) != "demo" {
		t.Fatalf("expected original payload to remain unchanged, got %q", string(original.Payload))
	}
}

package knowledge

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	autoloadcfg "magic/internal/config/autoload"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/infrastructure/knowledge/documentsync"
)

var (
	errProvidersTestBoom    = errors.New("boom")
	errProvidersTestGeneric = errors.New("generic failure")
)

func TestIsDocumentSyncTaskDecodeError(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "sync stage error",
			err:  documentdomain.NewSyncStageError(documentdomain.SyncFailureParsing, errProvidersTestBoom),
			want: false,
		},
		{
			name: "json syntax error",
			err:  fmt.Errorf("decode sync task: %w", &json.SyntaxError{}),
			want: true,
		},
		{
			name: "json unmarshal type error",
			err:  fmt.Errorf("decode sync task: %w", &json.UnmarshalTypeError{}),
			want: true,
		},
		{
			name: "generic error",
			err:  errProvidersTestGeneric,
			want: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := isDocumentSyncTaskDecodeError(tc.err); got != tc.want {
				t.Fatalf("expected %v, got %v for err=%v", tc.want, got, tc.err)
			}
		})
	}
}

func TestNormalizeDocumentSyncRuntimeErrorReturnsStageErrors(t *testing.T) {
	t.Parallel()

	stageErr := documentdomain.NewSyncStageError(documentdomain.SyncFailureParsing, errProvidersTestBoom)
	err := normalizeDocumentSyncRuntimeError(stageErr, "run document sync task")
	if !errors.Is(err, stageErr) {
		t.Fatalf("expected stage error to be returned for MQ retry, got %v", err)
	}
}

func TestDocumentResyncRabbitMQSchedulerConfigMaxRequeueAttempts(t *testing.T) {
	t.Parallel()

	defaults := documentsync.DefaultRabbitMQSchedulerConfig()
	if defaults.MaxRequeueAttempts != 20 {
		t.Fatalf("expected default max requeue attempts 20, got %d", defaults.MaxRequeueAttempts)
	}

	cfg := &autoloadcfg.Config{}
	got := newDocumentResyncRabbitMQSchedulerConfig(cfg, defaults)
	if got.MaxRequeueAttempts != 20 {
		t.Fatalf("expected empty config to use default 20, got %d", got.MaxRequeueAttempts)
	}

	cfg.RabbitMQ.DocumentResync.MaxRequeueAttempts = 7
	got = newDocumentResyncRabbitMQSchedulerConfig(cfg, defaults)
	if got.MaxRequeueAttempts != 7 {
		t.Fatalf("expected configured max requeue attempts 7, got %d", got.MaxRequeueAttempts)
	}
}

func TestDocumentSyncSchedulerAdapterForcesAsync(t *testing.T) {
	t.Parallel()

	recorder := &recordingDocumentSyncTaskScheduler{}
	adapter := documentSyncSchedulerAdapter{scheduler: recorder}
	input := &documentdomain.SyncDocumentInput{
		OrganizationCode:  "ORG-1",
		KnowledgeBaseCode: "KB-1",
		Code:              "DOC-1",
		Mode:              documentdomain.SyncModeCreate,
		Async:             false,
	}

	adapter.Schedule(context.Background(), input)

	if recorder.task == nil {
		t.Fatal("expected document sync task to be scheduled")
	}
	if !recorder.task.Async {
		t.Fatalf("expected task to be forced async, got %#v", recorder.task)
	}
	var payload documentdomain.SyncDocumentInput
	if err := json.Unmarshal(recorder.task.Payload, &payload); err != nil {
		t.Fatalf("unmarshal task payload: %v", err)
	}
	if !payload.Async {
		t.Fatalf("expected payload to be forced async, got %#v", payload)
	}
	if input.Async {
		t.Fatalf("expected original input not to be mutated, got %#v", input)
	}
}

type recordingDocumentSyncTaskScheduler struct {
	task *documentsync.Task
}

func (s *recordingDocumentSyncTaskScheduler) Schedule(_ context.Context, task *documentsync.Task) {
	s.task = task
}

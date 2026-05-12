package documentsync

import (
	"encoding/json"
	"testing"
)

func TestDecodeRabbitMQTaskDeliveryRejectsLegacyWakeup(t *testing.T) {
	t.Parallel()

	body, err := json.Marshal(map[string]any{
		"wakeup_id":  "wake-1",
		"dedupe_key": "KB:DOC:resync",
		"task_kind":  TaskKindDocumentSync,
	})
	if err != nil {
		t.Fatalf("marshal legacy wakeup: %v", err)
	}

	task, reason := decodeRabbitMQTaskDelivery(body)
	if task != nil {
		t.Fatalf("expected nil task, got %#v", task)
	}
	if reason != "legacy_wakeup_message" {
		t.Fatalf("expected legacy_wakeup_message, got %q", reason)
	}
}

func TestDecodeRabbitMQTaskDeliveryAcceptsDocumentSyncTask(t *testing.T) {
	t.Parallel()

	async := true
	payload := json.RawMessage(`{"knowledge_base_code":"KB-1","code":"DOC-1","mode":"resync","async":true}`)
	body, err := json.Marshal(RabbitMQTaskMessage{
		Kind:              TaskKindDocumentSync,
		KnowledgeBaseCode: "KB-1",
		DocumentCode:      "DOC-1",
		Mode:              resyncMode,
		Async:             &async,
		Payload:           &payload,
	})
	if err != nil {
		t.Fatalf("marshal task: %v", err)
	}

	task, reason := decodeRabbitMQTaskDelivery(body)
	if reason != "" {
		t.Fatalf("expected no skip reason, got %q", reason)
	}
	if task == nil || task.Kind != TaskKindDocumentSync || task.KnowledgeBaseCode != "KB-1" || task.Code != "DOC-1" {
		t.Fatalf("unexpected decoded task: %#v", task)
	}
}

func TestFallbackRabbitMQTaskRetryKeyStableAndQueueScoped(t *testing.T) {
	t.Parallel()

	task := &Task{
		Kind:              TaskKindDocumentSync,
		KnowledgeBaseCode: "KB-1",
		Code:              "DOC-1",
		Mode:              resyncMode,
		Payload:           []byte(`{"code":"DOC-1"}`),
	}

	first := fallbackRabbitMQTaskRetryKey("queue-a", task)
	second := fallbackRabbitMQTaskRetryKey("queue-a", CloneTask(task))
	if first == "" || first != second {
		t.Fatalf("expected stable fallback key, first=%q second=%q", first, second)
	}

	otherQueue := fallbackRabbitMQTaskRetryKey("queue-b", task)
	if first == otherQueue {
		t.Fatalf("expected queue scoped fallback key, got same key %q", first)
	}
}

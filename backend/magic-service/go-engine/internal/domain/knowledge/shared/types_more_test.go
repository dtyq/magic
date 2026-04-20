package shared_test

import (
	"encoding/json"
	"errors"
	"testing"

	shared "magic/internal/domain/knowledge/shared"
)

func TestEmbeddingConfigJSONRoundTrip(t *testing.T) {
	t.Parallel()

	var cfg shared.EmbeddingConfig
	if err := json.Unmarshal([]byte(`{"model_id":"m1","provider":"openai"}`), &cfg); err != nil {
		t.Fatalf("unmarshal embedding config failed: %v", err)
	}
	if cfg.ModelID != "m1" || string(cfg.Extra["provider"]) != `"openai"` {
		t.Fatalf("unexpected embedding config: %#v", cfg)
	}

	data, err := json.Marshal(&cfg)
	if err != nil {
		t.Fatalf("marshal embedding config failed: %v", err)
	}
	if string(data) != `{"model_id":"m1","provider":"openai"}` && string(data) != `{"provider":"openai","model_id":"m1"}` {
		t.Fatalf("unexpected marshaled embedding config: %s", data)
	}
}

func TestEmbeddingAndVectorDBConfigNilReceiver(t *testing.T) {
	t.Parallel()

	var embedding *shared.EmbeddingConfig
	if err := embedding.UnmarshalJSON([]byte(`{}`)); !errors.Is(err, shared.ErrNilReceiver) {
		t.Fatalf("expected nil receiver error, got %v", err)
	}

	var vectorDB *shared.VectorDBConfig
	if err := vectorDB.UnmarshalJSON([]byte(`{}`)); !errors.Is(err, shared.ErrNilReceiver) {
		t.Fatalf("expected nil receiver error, got %v", err)
	}
}

func TestVectorDBConfigJSONAndSyncStatusString(t *testing.T) {
	t.Parallel()

	var cfg shared.VectorDBConfig
	if err := json.Unmarshal([]byte(`{"host":"qdrant"}`), &cfg); err != nil {
		t.Fatalf("unmarshal vector db config failed: %v", err)
	}
	if string(cfg.Extra["host"]) != `"qdrant"` {
		t.Fatalf("unexpected vector db config: %#v", cfg)
	}

	data, err := json.Marshal(&cfg)
	if err != nil {
		t.Fatalf("marshal vector db config failed: %v", err)
	}
	if string(data) != `{"host":"qdrant"}` {
		t.Fatalf("unexpected vector db json: %s", data)
	}

	if shared.SyncStatusSynced.String() != "synced" || shared.SyncStatus(999).String() != "unknown" {
		t.Fatalf("unexpected sync status string")
	}
}

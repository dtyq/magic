package shared_test

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
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

func TestCloneEmbeddingConfigClonesRawMessageBytes(t *testing.T) {
	t.Parallel()

	cfg := &shared.EmbeddingConfig{
		ModelID: "m1",
		Extra: map[string]json.RawMessage{
			"provider": json.RawMessage(`"openai"`),
		},
	}

	cloned := shared.CloneEmbeddingConfig(cfg)
	raw := cloned.Extra["provider"]
	raw[1] = 'x'

	if string(cfg.Extra["provider"]) != `"openai"` {
		t.Fatalf("expected source raw message to stay isolated, got %s", cfg.Extra["provider"])
	}
	if string(cloned.Extra["provider"]) != `"xpenai"` {
		t.Fatalf("expected cloned raw message to be mutable independently, got %s", cloned.Extra["provider"])
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

func TestOCRConfigSerializationDoesNotExposeCredentials(t *testing.T) {
	t.Parallel()

	cfg := shared.OCRConfig{
		Identity:  "ocr-access-secret",
		Signature: "ocr-secret-secret",
		Region:    "cn-north-1",
		Endpoint:  "visual.example.com",
	}
	payload, err := json.Marshal(cfg)
	if err != nil {
		t.Fatalf("marshal ocr config: %v", err)
	}
	debugPayload := fmt.Sprintf("%+v %#v %s", cfg, cfg, cfg.LogValue())

	assertSharedOCRPayloadHasNoCredential(t, string(payload))
	assertSharedOCRPayloadHasNoCredential(t, debugPayload)
	if !strings.Contains(string(payload), "visual.example.com") {
		t.Fatalf("expected non-sensitive endpoint to be serialized, got %s", payload)
	}
}

func assertSharedOCRPayloadHasNoCredential(t *testing.T, payload string) {
	t.Helper()

	for _, forbidden := range []string{
		"ocr-access-secret",
		"ocr-secret-secret",
		"identity",
		"signature",
	} {
		if strings.Contains(payload, forbidden) {
			t.Fatalf("expected payload not to contain %q, got %s", forbidden, payload)
		}
	}
}

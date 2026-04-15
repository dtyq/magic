package entity_test

import (
	"encoding/json"
	"errors"
	"testing"

	"magic/internal/domain/knowledge/shared/entity"
)

func TestEmbeddingConfigJSON(t *testing.T) {
	t.Parallel()

	var cfg entity.EmbeddingConfig
	if err := json.Unmarshal([]byte(`{"model_id":"m1","extra":{"a":1}}`), &cfg); err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}
	if cfg.ModelID != "m1" {
		t.Fatalf("expected model_id=m1, got %q", cfg.ModelID)
	}
	if len(cfg.Extra) != 1 {
		t.Fatalf("expected extra field retained, got %#v", cfg.Extra)
	}

	data, err := json.Marshal(&cfg)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}
	if string(data) != `{"extra":{"a":1},"model_id":"m1"}` && string(data) != `{"model_id":"m1","extra":{"a":1}}` {
		t.Fatalf("unexpected json: %s", string(data))
	}
}

func TestEmbeddingConfigNilAndNullBehavior(t *testing.T) {
	t.Parallel()

	var nilCfg *entity.EmbeddingConfig
	if data, err := json.Marshal(nilCfg); err != nil || string(data) != "null" {
		t.Fatalf("expected nil marshal=null, got data=%s err=%v", string(data), err)
	}

	cfg := &entity.EmbeddingConfig{ModelID: "m1"}
	if err := json.Unmarshal([]byte("null"), cfg); err != nil {
		t.Fatalf("expected null unmarshal success, got %v", err)
	}
	if cfg.ModelID != "" || cfg.Extra != nil {
		t.Fatalf("expected config reset on null, got %#v", cfg)
	}

	var receiver *entity.EmbeddingConfig
	err := receiver.UnmarshalJSON([]byte(`{}`))
	if !errors.Is(err, entity.ErrNilReceiver) {
		t.Fatalf("expected ErrNilReceiver, got %v", err)
	}
}

func TestVectorDBConfigJSON(t *testing.T) {
	t.Parallel()

	var cfg entity.VectorDBConfig
	if err := json.Unmarshal([]byte(`{"collection":"kb"}`), &cfg); err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}
	if len(cfg.Extra) != 1 {
		t.Fatalf("expected extra field retained, got %#v", cfg.Extra)
	}

	data, err := json.Marshal(&cfg)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}
	if string(data) != `{"collection":"kb"}` {
		t.Fatalf("unexpected json: %s", string(data))
	}

	if err := json.Unmarshal([]byte("null"), &cfg); err != nil {
		t.Fatalf("expected null unmarshal success, got %v", err)
	}
	if cfg.Extra != nil {
		t.Fatalf("expected extra cleared on null, got %#v", cfg.Extra)
	}

	var receiver *entity.VectorDBConfig
	err = receiver.UnmarshalJSON([]byte(`{}`))
	if !errors.Is(err, entity.ErrNilReceiver) {
		t.Fatalf("expected ErrNilReceiver, got %v", err)
	}
}

package jrpc_test

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	jsonrpc "magic/internal/pkg/jsonrpc"
)

func TestRequestEncodeDecode(t *testing.T) {
	t.Parallel()
	req := jsonrpc.NewRequest("method", json.RawMessage(`{"a":1}`), "id1")
	data, err := req.Encode()
	if err != nil {
		t.Fatalf("encode request: %v", err)
	}
	decoded, err := jsonrpc.DecodeRequest(data)
	if err != nil {
		t.Fatalf("decode request: %v", err)
	}
	if decoded.Method != "method" || decoded.JSONRPC != jsonrpc.Version {
		t.Fatalf("unexpected decoded request: %+v", decoded)
	}
	if decoded.ID != "id1" {
		t.Fatalf("expected id1, got %v", decoded.ID)
	}
}

func TestRequestEncodeDecodeWithContext(t *testing.T) {
	t.Parallel()
	req := jsonrpc.NewRequestWithContext(
		"method",
		json.RawMessage(`{"a":1}`),
		"id1",
		json.RawMessage(`{"request_id":"req-1"}`),
	)
	data, err := req.Encode()
	if err != nil {
		t.Fatalf("encode request: %v", err)
	}
	decoded, err := jsonrpc.DecodeRequest(data)
	if err != nil {
		t.Fatalf("decode request: %v", err)
	}
	if string(decoded.Context) != `{"request_id":"req-1"}` {
		t.Fatalf("unexpected request context: %s", string(decoded.Context))
	}
}

func TestDecodeRequestErrors(t *testing.T) {
	t.Parallel()
	if _, err := jsonrpc.DecodeRequest([]byte("{")); err == nil {
		t.Fatalf("expected error for invalid json")
	}

	badVersion := []byte(`{"jsonrpc":"1.0","method":"m"}`)
	if _, err := jsonrpc.DecodeRequest(badVersion); err == nil || !errors.Is(err, jsonrpc.ErrInvalidJSONRPCVersion) {
		t.Fatalf("expected ErrInvalidJSONRPCVersion, got %v", err)
	}

	missingMethod := []byte(`{"jsonrpc":"2.0","method":""}`)
	if _, err := jsonrpc.DecodeRequest(missingMethod); err == nil || !errors.Is(err, jsonrpc.ErrMethodRequired) {
		t.Fatalf("expected ErrMethodRequired, got %v", err)
	}
}

func TestResponseEncodeDecode(t *testing.T) {
	t.Parallel()
	resp, err := jsonrpc.NewResponse("id", map[string]any{"ok": true})
	if err != nil {
		t.Fatalf("new response: %v", err)
	}
	data, err := resp.Encode()
	if err != nil {
		t.Fatalf("encode response: %v", err)
	}
	decoded, err := jsonrpc.DecodeResponse(data)
	if err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if decoded.JSONRPC != jsonrpc.Version {
		t.Fatalf("unexpected jsonrpc version: %s", decoded.JSONRPC)
	}
	if decoded.ID != "id" {
		t.Fatalf("unexpected id: %v", decoded.ID)
	}
}

func TestDecodeResponseErrors(t *testing.T) {
	t.Parallel()
	badVersion := []byte(`{"jsonrpc":"1.0","id":1,"result":{}}`)
	if _, err := jsonrpc.DecodeResponse(badVersion); err == nil || !errors.Is(err, jsonrpc.ErrInvalidJSONRPCVersion) {
		t.Fatalf("expected ErrInvalidJSONRPCVersion, got %v", err)
	}

	missingResult := []byte(`{"jsonrpc":"2.0","id":1}`)
	if _, err := jsonrpc.DecodeResponse(missingResult); err == nil || !errors.Is(err, jsonrpc.ErrResultRequired) {
		t.Fatalf("expected ErrResultRequired, got %v", err)
	}
}

func TestNewResponse_MarshalError(t *testing.T) {
	t.Parallel()
	_, err := jsonrpc.NewResponse("id", make(chan int))
	if err == nil {
		t.Fatalf("expected marshal error")
	}
}

func TestDecodeResult(t *testing.T) {
	t.Parallel()
	var out map[string]any
	if err := jsonrpc.DecodeResult(json.RawMessage(" "), &out); err != nil {
		t.Fatalf("expected nil error for empty, got %v", err)
	}
	if err := jsonrpc.DecodeResult(json.RawMessage("null"), &out); err != nil {
		t.Fatalf("expected nil error for null, got %v", err)
	}
	data := json.RawMessage(`{"k":"v"}`)
	if err := jsonrpc.DecodeResult(data, &out); err != nil {
		t.Fatalf("decode result: %v", err)
	}
	if out["k"] != "v" {
		t.Fatalf("unexpected decode result: %v", out)
	}
	if err := jsonrpc.DecodeResult(json.RawMessage(`{"k":`), &out); err == nil {
		t.Fatalf("expected error for invalid json")
	}
}

func TestIsNotification(t *testing.T) {
	t.Parallel()
	req := &jsonrpc.Request{ID: nil}
	if !req.IsNotification() {
		t.Fatalf("expected notification")
	}
	req.ID = "1"
	if req.IsNotification() {
		t.Fatalf("expected non-notification")
	}
}

func TestErrorError(t *testing.T) {
	t.Parallel()
	err := &jsonrpc.Error{Code: 1, Message: "bad"}
	if !strings.Contains(err.Error(), "bad") {
		t.Fatalf("unexpected error string: %s", err.Error())
	}
	err = &jsonrpc.Error{Code: 1, Message: "bad", Data: map[string]any{"k": "v"}}
	if !strings.Contains(err.Error(), "data") {
		t.Fatalf("expected data in error string, got: %s", err.Error())
	}
}

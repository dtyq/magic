package ipcrpc_test

import (
	"encoding/json"
	"io"
	"net"
	"testing"

	jsonrpc "magic/internal/infrastructure/rpc/jsonrpc"
	common "magic/internal/pkg/jsonrpc"
)

type sampleParams struct {
	Name string `json:"name"`
}

func TestPendingKey(t *testing.T) {
	t.Parallel()
	if _, ok := jsonrpc.PendingKeyForTest(nil); ok {
		t.Fatalf("expected false for nil")
	}
	if k, ok := jsonrpc.PendingKeyForTest(1); !ok || k != "n:1" {
		t.Fatalf("unexpected key: %v %v", k, ok)
	}
	if k, ok := jsonrpc.PendingKeyForTest(int64(2)); !ok || k != "n:2" {
		t.Fatalf("unexpected key: %v %v", k, ok)
	}
	if k, ok := jsonrpc.PendingKeyForTest(1.0); !ok || k != "n:1" {
		t.Fatalf("unexpected key: %v %v", k, ok)
	}
	if k, ok := jsonrpc.PendingKeyForTest(1.5); !ok || k != "f:1.5" {
		t.Fatalf("unexpected key: %v %v", k, ok)
	}
	if k, ok := jsonrpc.PendingKeyForTest(json.Number("3")); !ok || k != "n:3" {
		t.Fatalf("unexpected key: %v %v", k, ok)
	}
	if k, ok := jsonrpc.PendingKeyForTest("id"); !ok || k != "s:id" {
		t.Fatalf("unexpected key: %v %v", k, ok)
	}
}

func TestDecodeParams(t *testing.T) {
	t.Parallel()
	var out sampleParams
	if err := jsonrpc.DecodeParamsForTest(nil, &out); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	raw := json.RawMessage(`{"name":"a"}`)
	if err := jsonrpc.DecodeParamsForTest(raw, &out); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out.Name != "a" {
		t.Fatalf("unexpected name: %s", out.Name)
	}
	if err := jsonrpc.DecodeParamsForTest(json.RawMessage(`{"name":`), &out); err == nil {
		t.Fatalf("expected error")
	}
	params := map[string]any{"name": "b"}
	if err := jsonrpc.DecodeParamsForTest(params, &out); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out.Name != "b" {
		t.Fatalf("unexpected name: %s", out.Name)
	}
}

func TestIsClosedErr(t *testing.T) {
	t.Parallel()
	if !jsonrpc.IsClosedErrForTest(io.EOF) {
		t.Fatalf("expected true for EOF")
	}
	if !jsonrpc.IsClosedErrForTest(net.ErrClosed) {
		t.Fatalf("expected true for net.ErrClosed")
	}
}

func TestRequestIDFromRequestContext(t *testing.T) {
	t.Parallel()
	req := &common.Request{
		Context: json.RawMessage(`{"request_id":"ctx-id"}`),
		Params:  json.RawMessage(`{"request_id":"param-id"}`),
	}
	if got := jsonrpc.RequestIDFromRequestContextForTest(req); got != "ctx-id" {
		t.Fatalf("expected context request_id, got %q", got)
	}

	req = &common.Request{
		Context: json.RawMessage(`{"trace_id":"trace-1"}`),
		Params:  json.RawMessage(`{"request_id":"param-id"}`),
	}
	if got := jsonrpc.RequestIDFromRequestContextForTest(req); got != "param-id" {
		t.Fatalf("expected params request_id fallback, got %q", got)
	}

	req = &common.Request{
		Context: json.RawMessage(`{"request_id":123}`),
	}
	if got := jsonrpc.RequestIDFromRequestContextForTest(req); got != "123" {
		t.Fatalf("expected numeric request_id string, got %q", got)
	}

	req = &common.Request{
		Context: json.RawMessage(`not-json`),
		Params:  json.RawMessage(`{}`),
	}
	if got := jsonrpc.RequestIDFromRequestContextForTest(req); got != "" {
		t.Fatalf("expected empty request_id for invalid payload, got %q", got)
	}
}

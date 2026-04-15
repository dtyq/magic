package jrpc_test

import (
	"strings"
	"testing"

	jsonrpc "magic/internal/pkg/jsonrpc"
)

func TestGetErrorMessage(t *testing.T) {
	t.Parallel()
	if jsonrpc.GetErrorMessage(jsonrpc.ErrCodeInvalidParams) == "" {
		t.Fatalf("expected message")
	}
	if jsonrpc.GetErrorMessage(9999) == "" {
		t.Fatalf("expected default message")
	}
}

func TestBusinessError(t *testing.T) {
	t.Parallel()
	err := jsonrpc.NewBusinessError(jsonrpc.ErrCodeNotFound, "missing")
	if err.Code != jsonrpc.ErrCodeNotFound {
		t.Fatalf("unexpected code: %d", err.Code)
	}
	if !strings.Contains(err.Error(), "missing") {
		t.Fatalf("unexpected error string: %s", err.Error())
	}

	err2 := jsonrpc.NewBusinessErrorWithMessage(jsonrpc.ErrCodeConflict, "custom", nil)
	if err2.Message != "custom" {
		t.Fatalf("unexpected message: %s", err2.Message)
	}

	rpcErr := err.ToRPCError()
	if rpcErr.Code != err.Code || rpcErr.Message != err.Message {
		t.Fatalf("unexpected rpc error: %+v", rpcErr)
	}
}

func TestWrapError(t *testing.T) {
	t.Parallel()
	orig := errBoom
	wrapped := jsonrpc.WrapError(jsonrpc.ErrCodeInternalError, orig)
	if wrapped.Code != jsonrpc.ErrCodeInternalError {
		t.Fatalf("unexpected code: %d", wrapped.Code)
	}
	data, ok := wrapped.Data.(string)
	if wrapped.Data == nil || !ok || !strings.Contains(data, "boom") {
		t.Fatalf("unexpected data: %#v", wrapped.Data)
	}
}

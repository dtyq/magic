package ipcrpc_test

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	jsonrpc "magic/internal/infrastructure/rpc/jsonrpc"
	common "magic/internal/pkg/jsonrpc"
)

var (
	errDBCredentialsExposed      = errors.New("db credentials exposed")
	errSessionHandlerUnreachable = errors.New("session handler should not return after induced runtime fault")
)

func TestSessionSendErrorIncludesData(t *testing.T) {
	t.Parallel()
	body, err := jsonrpc.SendErrorPacketForTest(7, common.ErrCodeInternalError, common.GetErrorMessage(common.ErrCodeInternalError), "root-cause")
	if err != nil {
		t.Fatalf("send error packet failed: %v", err)
	}

	resp, err := common.DecodeResponse(body)
	if err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	if resp.Error == nil {
		t.Fatal("expected rpc error in response")
	}
	if resp.Error.Code != common.ErrCodeInternalError {
		t.Fatalf("expected code=%d, got %d", common.ErrCodeInternalError, resp.Error.Code)
	}
	if resp.Error.Message != common.GetErrorMessage(common.ErrCodeInternalError) {
		t.Fatalf("expected message=%s, got %q", common.GetErrorMessage(common.ErrCodeInternalError), resp.Error.Message)
	}
	if resp.Error.Data != "root-cause" {
		t.Fatalf("expected error data root-cause, got %#v", resp.Error.Data)
	}
}

func TestExecuteHandler_DefaultErrorShouldReturnInternalError(t *testing.T) {
	t.Parallel()
	req, err := jsonrpc.EncodeRequestForTest("svc.test.unknown", map[string]any{"k": "v"}, 9)
	if err != nil {
		t.Fatalf("encode request failed: %v", err)
	}

	body, err := jsonrpc.ExecuteHandlerPacketForTest(req, func(_ context.Context, _ string, _ json.RawMessage) (any, error) {
		return nil, errDBCredentialsExposed
	})
	if err != nil {
		t.Fatalf("execute handler failed: %v", err)
	}

	resp, err := common.DecodeResponse(body)
	if err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	if resp.Error == nil {
		t.Fatal("expected rpc error in response")
	}
	if resp.Error.Code != common.ErrCodeInternalError {
		t.Fatalf("expected code=%d, got %d", common.ErrCodeInternalError, resp.Error.Code)
	}
	if resp.Error.Message != common.GetErrorMessage(common.ErrCodeInternalError) {
		t.Fatalf("expected message=%s, got %q", common.GetErrorMessage(common.ErrCodeInternalError), resp.Error.Message)
	}
	if strings.Contains(resp.Error.Message, "credentials") {
		t.Fatalf("expected sanitized message, got %q", resp.Error.Message)
	}
}

func TestExecuteHandler_PanicShouldReturnInternalError(t *testing.T) {
	t.Parallel()
	req, err := jsonrpc.EncodeRequestForTest("svc.test.panic", map[string]any{"k": "v"}, 10)
	if err != nil {
		t.Fatalf("encode request failed: %v", err)
	}

	body, err := jsonrpc.ExecuteHandlerPacketForTest(req, func(_ context.Context, _ string, _ json.RawMessage) (any, error) {
		triggerNilPointerDerefForSessionErrorTest()
		return nil, errSessionHandlerUnreachable
	})
	if err != nil {
		t.Fatalf("execute handler failed: %v", err)
	}

	resp, err := common.DecodeResponse(body)
	if err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	if resp.Error == nil {
		t.Fatal("expected rpc error in response")
	}
	if resp.Error.Code != common.ErrCodeInternalError {
		t.Fatalf("expected code=%d, got %d", common.ErrCodeInternalError, resp.Error.Code)
	}
	if resp.Error.Message != common.GetErrorMessage(common.ErrCodeInternalError) {
		t.Fatalf("expected message=%s, got %q", common.GetErrorMessage(common.ErrCodeInternalError), resp.Error.Message)
	}
	if strings.Contains(resp.Error.Message, "panic secret") {
		t.Fatalf("expected sanitized panic message, got %q", resp.Error.Message)
	}
}

func triggerNilPointerDerefForSessionErrorTest() {
	var ptr *int
	_ = *ptr
}

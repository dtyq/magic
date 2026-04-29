package jrpc_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	jsonrpc "magic/internal/pkg/jsonrpc"
)

type sampleReq struct {
	Name string `json:"name"`
}

type sampleValidatedReq struct {
	Name string `json:"name"`
}

type sampleIntegerReq struct {
	Count int     `json:"count"`
	IDs   []int64 `json:"ids"`
}

func (r sampleValidatedReq) Validate() error {
	if r.Name == "" {
		return jsonrpc.NewBusinessErrorWithMessage(jsonrpc.ErrCodeInvalidParams, "name is required", nil)
	}
	return nil
}

type sampleResp struct {
	OK bool `json:"ok"`
}

func TestWrapTyped_Success(t *testing.T) {
	t.Parallel()
	h := func(ctx context.Context, req *sampleReq) (*sampleResp, error) {
		if req.Name == "" {
			return nil, errMissingName
		}
		return &sampleResp{OK: true}, nil
	}
	wrapped := jsonrpc.WrapTyped(h)
	res, err := wrapped(context.Background(), "m", json.RawMessage(`{"name":"a"}`))
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	resp, ok := res.(*sampleResp)
	if !ok || resp == nil || !resp.OK {
		t.Fatalf("unexpected response: %#v", res)
	}
}

func TestWrapTyped_InvalidParams(t *testing.T) {
	t.Parallel()
	h := func(ctx context.Context, req *sampleReq) (*sampleResp, error) {
		return &sampleResp{OK: true}, nil
	}
	wrapped := jsonrpc.WrapTyped(h)
	_, err := wrapped(context.Background(), "m", json.RawMessage(`{"name":`))
	if err == nil {
		t.Fatalf("expected error")
	}
	var bizErr *jsonrpc.BusinessError
	if !errors.As(err, &bizErr) {
		t.Fatalf("expected BusinessError, got %T", err)
	}
	if bizErr.Code != jsonrpc.ErrCodeInvalidParams {
		t.Fatalf("expected ErrCodeInvalidParams, got %d", bizErr.Code)
	}
}

func TestWrapTyped_TypedNilResponse(t *testing.T) {
	t.Parallel()
	h := func(ctx context.Context, req *sampleReq) (*sampleResp, error) {
		return (*sampleResp)(nil), nil
	}
	wrapped := jsonrpc.WrapTyped(h)
	res, err := wrapped(context.Background(), "m", nil)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if res != nil {
		t.Fatalf("expected nil response, got %#v", res)
	}
}

func TestWrapTyped_EmptyParams(t *testing.T) {
	t.Parallel()
	h := func(ctx context.Context, req *sampleReq) (*sampleResp, error) {
		if req.Name != "" {
			return nil, errExpectedEmpty
		}
		return &sampleResp{OK: true}, nil
	}
	wrapped := jsonrpc.WrapTyped(h)
	res, err := wrapped(context.Background(), "m", json.RawMessage{})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if res == nil {
		t.Fatalf("expected non-nil response")
	}
}

func TestWrapTyped_ValidateFailure(t *testing.T) {
	t.Parallel()

	h := func(ctx context.Context, req *sampleValidatedReq) (*sampleResp, error) {
		return &sampleResp{OK: true}, nil
	}
	wrapped := jsonrpc.WrapTyped(h)
	_, err := wrapped(context.Background(), "m", json.RawMessage(`{}`))
	if err == nil {
		t.Fatal("expected error")
	}

	var bizErr *jsonrpc.BusinessError
	if !errors.As(err, &bizErr) {
		t.Fatalf("expected BusinessError, got %T", err)
	}
	if bizErr.Code != jsonrpc.ErrCodeInvalidParams {
		t.Fatalf("expected ErrCodeInvalidParams, got %d", bizErr.Code)
	}
	if bizErr.Message != "name is required" {
		t.Fatalf("expected validate message, got %q", bizErr.Message)
	}
}

func TestWrapTyped_StringifiedIntegersAreRejectedByDefault(t *testing.T) {
	t.Parallel()

	h := func(ctx context.Context, req *sampleIntegerReq) (*sampleResp, error) {
		return &sampleResp{OK: true}, nil
	}

	wrapped := jsonrpc.WrapTyped(h)
	_, err := wrapped(context.Background(), "m", json.RawMessage(`{"count":"64","ids":["1","2"]}`))
	if err == nil {
		t.Fatal("expected error")
	}

	var bizErr *jsonrpc.BusinessError
	if !errors.As(err, &bizErr) {
		t.Fatalf("expected BusinessError, got %T", err)
	}
	if bizErr.Code != jsonrpc.ErrCodeInvalidParams {
		t.Fatalf("expected ErrCodeInvalidParams, got %d", bizErr.Code)
	}
}

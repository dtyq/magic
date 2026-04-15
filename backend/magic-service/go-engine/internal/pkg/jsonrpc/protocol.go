// Package jrpc 提供 JSON-RPC 2.0 协议实现
package jrpc

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
)

// Version JSON-RPC 版本
const Version = "2.0"

// ErrInvalidJSONRPCVersion 请求版本非法
var (
	ErrInvalidJSONRPCVersion = errors.New("invalid JSON-RPC version")
	ErrMethodRequired        = errors.New("invalid JSON-RPC request: method is required")
	ErrResultRequired        = errors.New("invalid JSON-RPC response: result or error is required")
)

// Request 表示 JSON-RPC 2.0 请求
type Request struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
	Context json.RawMessage `json:"context,omitempty"`
	ID      any             `json:"id,omitempty"` // string、number 或 null
}

// Response 表示 JSON-RPC 2.0 响应
type Response struct {
	JSONRPC string          `json:"jsonrpc"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *Error          `json:"error,omitempty"`
	ID      any             `json:"id"`
}

// Error 表示 JSON-RPC 2.0 错误对象
type Error struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

// 标准错误码
const (
	ParseError     = -32700
	InvalidRequest = -32600
	MethodNotFound = -32601
	InvalidParams  = -32602
	InternalError  = -32603
)

// NewRequest 创建一个新的请求
func NewRequest(method string, params json.RawMessage, id any) *Request {
	return NewRequestWithContext(method, params, id, nil)
}

// NewRequestWithContext 创建一个带 context 的请求。
func NewRequestWithContext(method string, params json.RawMessage, id any, reqContext json.RawMessage) *Request {
	return &Request{
		JSONRPC: Version,
		Method:  method,
		Params:  params,
		Context: reqContext,
		ID:      id,
	}
}

// NewResponse 创建一个成功响应
func NewResponse(id, result any) (*Response, error) {
	raw, err := json.Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("marshal response result failed: %w", err)
	}
	return &Response{
		JSONRPC: Version,
		Result:  raw,
		ID:      id,
	}, nil
}

// NewErrorResponse 创建一个错误响应
func NewErrorResponse(id any, code int, message string, data any) *Response {
	return &Response{
		JSONRPC: Version,
		Error: &Error{
			Code:    code,
			Message: message,
			Data:    data,
		},
		ID: id,
	}
}

// Encode 将请求编码为 JSON
func (r *Request) Encode() ([]byte, error) {
	data, err := json.Marshal(r)
	if err != nil {
		return nil, fmt.Errorf("failed to encode request: %w", err)
	}
	return data, nil
}

// Encode 将响应编码为 JSON
func (r *Response) Encode() ([]byte, error) {
	data, err := json.Marshal(r)
	if err != nil {
		return nil, fmt.Errorf("failed to encode response: %w", err)
	}
	return data, nil
}

// DecodeRequest 从 JSON 解码请求
func DecodeRequest(data []byte) (*Request, error) {
	var req Request
	if err := json.Unmarshal(data, &req); err != nil {
		return nil, fmt.Errorf("failed to decode request: %w", err)
	}
	if req.JSONRPC != Version {
		return nil, fmt.Errorf("%w: %s", ErrInvalidJSONRPCVersion, req.JSONRPC)
	}
	if req.Method == "" {
		return nil, ErrMethodRequired
	}
	return &req, nil
}

// DecodeResponse 从 JSON 解码响应
func DecodeResponse(data []byte) (*Response, error) {
	var resp Response
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	if resp.JSONRPC != Version {
		return nil, fmt.Errorf("%w: %s", ErrInvalidJSONRPCVersion, resp.JSONRPC)
	}
	if resp.Error == nil && len(bytes.TrimSpace(resp.Result)) == 0 {
		return nil, ErrResultRequired
	}
	return &resp, nil
}

// DecodeResult 将 RawMessage 解码为目标类型
func DecodeResult[T any](data json.RawMessage, out *T) error {
	if len(bytes.TrimSpace(data)) == 0 || bytes.Equal(bytes.TrimSpace(data), []byte("null")) {
		return nil
	}
	if err := json.Unmarshal(data, out); err != nil {
		return fmt.Errorf("failed to decode result: %w", err)
	}
	return nil
}

// IsNotification 检查请求是否是通知
func (r *Request) IsNotification() bool {
	return r.ID == nil
}

// Error 实现 error 接口
func (e *Error) Error() string {
	if e.Data != nil {
		return fmt.Sprintf("JSON-RPC error %d: %s (data: %v)", e.Code, e.Message, e.Data)
	}
	return fmt.Sprintf("JSON-RPC error %d: %s", e.Code, e.Message)
}

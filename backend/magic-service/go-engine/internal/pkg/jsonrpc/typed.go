package jrpc

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
)

type requestValidator interface {
	Validate() error
}

// TypedHandler 定义强类型的处理函数
// Req: 请求参数结构体
// Resp: 响应数据结构体 (可以是任何类型，通常是指针或切片)
type TypedHandler[Req any, Resp any] func(ctx context.Context, req *Req) (Resp, error)

// WrapTyped 将强类型 Handler 转换为通用的 ServerHandler
// 这个泛型函数负责将通用的 params any 转换为具体的 *Req 类型
// WrapTyped 将强类型 Handler 转换为通用的 ServerHandler
// 这个泛型函数负责将通用的 params json.RawMessage 转换为具体的 *Req 类型
func WrapTyped[Req, Resp any](h TypedHandler[Req, Resp]) ServerHandler {
	return func(ctx context.Context, method string, params json.RawMessage) (any, error) {
		var req Req

		if err := bindParams(params, &req); err != nil {
			return nil, err
		}
		if validator, ok := any(&req).(requestValidator); ok {
			if err := validator.Validate(); err != nil {
				var bizErr *BusinessError
				if errors.As(err, &bizErr) {
					return nil, bizErr
				}
				return nil, fmt.Errorf("validate request: %w", err)
			}
		}

		// 调用强类型 Handler
		resp, err := h(ctx, &req)
		if err != nil {
			return nil, err
		}

		// 检查 resp 是否为 nil interface
		if isNil(resp) {
			return nil, nil
		}

		return resp, nil
	}
}

// bindParams 绑定参数
func bindParams[Req any](params json.RawMessage, req *Req) error {
	if len(params) == 0 {
		return nil
	}

	if err := json.Unmarshal(params, req); err != nil {
		return NewBusinessErrorWithMessage(ErrCodeInvalidParams, "unmarshal params failed: "+err.Error(), nil)
	}
	return nil
}

// isNil 检查接口值是否为 nil (包括 typed nil)
func isNil(i any) bool {
	if i == nil {
		return true
	}
	v := reflect.ValueOf(i)
	switch v.Kind() {
	case reflect.Chan, reflect.Func, reflect.Map, reflect.Pointer, reflect.Interface, reflect.Slice:
		return v.IsNil()
	default:
		return false
	}
}

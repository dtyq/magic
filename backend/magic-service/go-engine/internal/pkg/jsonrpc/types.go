package jrpc

import (
	"context"
	"encoding/json"
)

// ServerHandler 处理 RPC 请求的函数类型
type ServerHandler func(ctx context.Context, method string, params json.RawMessage) (any, error)

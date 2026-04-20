package ipcrpc

import (
	"encoding/json"
	"errors"
	"fmt"

	common "magic/internal/pkg/jsonrpc"
)

type payloadLogSummary struct {
	Bytes int
}

func shouldLogMethod(method string) bool {
	return method != methodHello && method != methodPing
}

func encodePayload(payload any) payloadLogSummary {
	if payload == nil {
		return payloadLogSummary{}
	}

	var raw []byte
	switch v := payload.(type) {
	case json.RawMessage:
		raw = []byte(v)
	case []byte:
		raw = v
	default:
		data, err := json.Marshal(v)
		if err != nil {
			raw = fmt.Appendf(nil, "%v", v)
		} else {
			raw = data
		}
	}

	size := len(raw)
	return payloadLogSummary{
		Bytes: size,
	}
}

func rpcErrorPayload(err error) any {
	if err == nil {
		return nil
	}
	var rpcErr *common.Error
	if errors.As(err, &rpcErr) {
		return map[string]any{
			"code":    rpcErr.Code,
			"message": rpcErr.Message,
			"data":    rpcErr.Data,
		}
	}
	var bizErr *common.BusinessError
	if errors.As(err, &bizErr) {
		return map[string]any{
			"code":    bizErr.Code,
			"message": bizErr.Message,
			"data":    bizErr.Data,
		}
	}
	return err.Error()
}

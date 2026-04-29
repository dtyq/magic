package ipcrpc

import (
	"encoding/json"
	"errors"
	"fmt"

	common "magic/internal/pkg/jsonrpc"
)

type payloadLogSummary struct {
	Bytes        int
	RawJSONBytes int
	FrameBytes   int
	FrameCodec   string
}

func shouldLogMethod(method string) bool {
	return method != methodHello && method != methodPing
}

func frameSummaryToPayloadLogSummary(frameSummary ipcFrameSummary) payloadLogSummary {
	return payloadLogSummary{
		Bytes:        frameSummary.RawJSONBytes,
		RawJSONBytes: frameSummary.RawJSONBytes,
		FrameBytes:   frameSummary.FrameBytes,
		FrameCodec:   frameSummary.Codec,
	}
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
	summary := payloadLogSummary{
		Bytes:        size,
		RawJSONBytes: size,
	}
	frameSummary, err := summarizeIPCFrame(raw)
	if err == nil {
		summary.FrameBytes = frameSummary.FrameBytes
		summary.FrameCodec = frameSummary.Codec
	}
	return summary
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

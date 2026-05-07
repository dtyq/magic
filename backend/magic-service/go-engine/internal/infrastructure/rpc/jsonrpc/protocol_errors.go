package ipcrpc

// 协议错误码 (JSON-RPC 自定义错误范围 -32000 ~ -32099)
const (
	ErrCodeHandshakeRequired = -32001
	ErrCodeAuthFailed        = -32002
	ErrCodeVersionMismatch   = -32003
	ErrCodePayloadTooLarge   = -32004
	ErrCodeOverloaded        = -32005
)

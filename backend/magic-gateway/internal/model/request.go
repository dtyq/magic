package model

// SignRequest represents the unified request payload for signing
type SignRequest struct {
	Data     string `json:"data" binding:"required"`
	SignType string `json:"sign_type,omitempty"` // 可选：签名类型 (hmac, ed25519, hash)，默认为hmac
}

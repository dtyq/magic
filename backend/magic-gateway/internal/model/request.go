package model

// SignRequest represents the unified request payload for signing
type SignRequest struct {
	Data string `json:"data" binding:"required"`
}

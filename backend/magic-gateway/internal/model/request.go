package model

// MetadataSignRequest represents the request payload for metadata signing
type MetadataSignRequest struct {
	Metadata map[string]interface{} `json:"metadata" binding:"required"`
}

// PayloadSignRequest represents the request payload for payload signing
type PayloadSignRequest struct {
	Payload string `json:"payload" binding:"required"`
}

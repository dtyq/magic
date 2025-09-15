package model

// MetadataSignResponse represents the response payload for metadata signing
type MetadataSignResponse struct {
	Signature string `json:"signature"`
}

// PayloadSignResponse represents the response payload for payload signing
type PayloadSignResponse struct {
	Signature string `json:"signature"`
}

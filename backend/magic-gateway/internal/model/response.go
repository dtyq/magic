package model

// SignResponse represents the unified response for signing operations
type SignResponse struct {
	Signature string `json:"signature"`
}

// UserInfoResponse represents the response payload for user info
type UserInfoResponse struct {
	UserID           string `json:"user_id"`
	OrganizationCode string `json:"organization_code"`
}

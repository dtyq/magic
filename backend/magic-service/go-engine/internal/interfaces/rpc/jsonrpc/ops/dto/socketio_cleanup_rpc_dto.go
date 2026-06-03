// Package dto defines operational JSON-RPC request and response payloads.
package dto

// DataIsolation carries the caller organization context.
type DataIsolation struct {
	OrganizationCode string `json:"organization_code"`
	OrganizationID   string `json:"organization_id,omitempty"`
	UserID           string `json:"user_id,omitempty"`
}

// ResolveOrganizationCode returns the canonical organization code.
func (di DataIsolation) ResolveOrganizationCode() string {
	if di.OrganizationCode != "" {
		return di.OrganizationCode
	}
	return di.OrganizationID
}

// SocketIORedisCleanupRequest 表示 Socket.IO Redis key 异步清理请求。
type SocketIORedisCleanupRequest struct {
	DataIsolation DataIsolation `json:"data_isolation"`
	Prefix        string        `json:"prefix"`
	Cursor        uint64        `json:"cursor"`
	Count         int64         `json:"count"`
	Apply         bool          `json:"apply"`
	SampleLimit   int           `json:"sample_limit"`
}

// SocketIORedisCleanupResponse 表示 Socket.IO Redis key 异步清理状态。
type SocketIORedisCleanupResponse struct {
	JobID          string   `json:"job_id"`
	Status         string   `json:"status"`
	Prefix         string   `json:"prefix"`
	Pattern        string   `json:"pattern"`
	Apply          bool     `json:"apply"`
	Count          int64    `json:"count"`
	Cursor         uint64   `json:"cursor"`
	Matched        int64    `json:"matched"`
	Deleted        int64    `json:"deleted"`
	Pages          int64    `json:"pages"`
	SampleKeys     []string `json:"sample_keys"`
	Owner          string   `json:"owner"`
	HeartbeatAt    string   `json:"heartbeat_at,omitempty"`
	LastProgressAt string   `json:"last_progress_at,omitempty"`
	StartedAt      string   `json:"started_at,omitempty"`
	UpdatedAt      string   `json:"updated_at,omitempty"`
	FinishedAt     string   `json:"finished_at,omitempty"`
	Error          string   `json:"error,omitempty"`
	Done           bool     `json:"done"`
}

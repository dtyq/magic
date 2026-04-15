package autoload

// IPCConfig 保存 IPC 的 Unix 域套接字配置。
type IPCConfig struct {
	EngineSocket         string `json:"engine_socket"`
	PHPSocket            string `json:"php_socket"`
	ProtocolVersion      int    `json:"protocol_version"`
	HandshakeCode        string `mapstructure:"authToken" json:"handshake_code"`
	MaxMessageBytes      int    `json:"max_message_bytes"`
	ReadTimeout          int    `json:"read_timeout"`
	WriteTimeout         int    `json:"write_timeout"`
	HeartbeatInterval    int    `json:"heartbeat_interval"`
	HeartbeatTimeout     int    `json:"heartbeat_timeout"`
	MaxPendingRequests   int    `json:"max_pending_requests"`
	DiscardCapMultiplier int    `json:"discard_cap_multiplier"`
	DiscardChunkSize     int    `json:"discard_chunk_size"`
	DiscardTimeout       int    `json:"discard_timeout"`
	OversizeMaxBurst     int    `json:"oversize_max_burst"`
}

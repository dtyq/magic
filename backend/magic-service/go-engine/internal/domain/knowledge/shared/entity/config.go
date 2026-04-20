// Package entity 定义知识库领域共享实体与配置。
package entity

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
)

// ErrNilReceiver 表示 JSON 反序列化时接收者为 nil。
var ErrNilReceiver = errors.New("nil receiver")

// EmbeddingConfig 嵌入配置（最小字段集 + 兼容未知字段）
type EmbeddingConfig struct {
	ModelID string `json:"model_id,omitempty"`
	// Extra 保留未知字段，避免静默丢字段
	Extra map[string]json.RawMessage `json:"-"`
}

// UnmarshalJSON 解析 JSON 并保留未知字段
func (c *EmbeddingConfig) UnmarshalJSON(data []byte) error {
	if c == nil {
		return fmt.Errorf("embedding config: %w", ErrNilReceiver)
	}
	if isNullJSON(data) {
		c.ModelID = ""
		c.Extra = nil
		return nil
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("unmarshal embedding config: %w", err)
	}

	c.ModelID = ""
	c.Extra = nil

	if v, ok := raw["model_id"]; ok {
		if err := json.Unmarshal(v, &c.ModelID); err != nil {
			return fmt.Errorf("unmarshal embedding config model_id: %w", err)
		}
		delete(raw, "model_id")
	}

	if len(raw) > 0 {
		c.Extra = raw
	}

	return nil
}

// MarshalJSON 输出 JSON 并带上未知字段
func (c *EmbeddingConfig) MarshalJSON() ([]byte, error) {
	if c == nil {
		return []byte("null"), nil
	}

	out := make(map[string]json.RawMessage, len(c.Extra)+1)
	maps.Copy(out, c.Extra)

	if c.ModelID != "" {
		b, err := json.Marshal(c.ModelID)
		if err != nil {
			return nil, fmt.Errorf("marshal embedding config model_id: %w", err)
		}
		out["model_id"] = b
	}

	if len(out) == 0 {
		return []byte("{}"), nil
	}

	b, err := json.Marshal(out)
	if err != nil {
		return nil, fmt.Errorf("marshal embedding config: %w", err)
	}
	return b, nil
}

// VectorDBConfig 向量数据库配置（保留未知字段）
type VectorDBConfig struct {
	// Extra 保留未知字段，避免静默丢字段
	Extra map[string]json.RawMessage `json:"-"`
}

// UnmarshalJSON 解析 JSON 并保留未知字段
func (c *VectorDBConfig) UnmarshalJSON(data []byte) error {
	if c == nil {
		return fmt.Errorf("vector db config: %w", ErrNilReceiver)
	}
	if isNullJSON(data) {
		c.Extra = nil
		return nil
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("unmarshal vector db config: %w", err)
	}

	if len(raw) == 0 {
		c.Extra = nil
		return nil
	}

	c.Extra = raw
	return nil
}

// MarshalJSON 输出 JSON 并带上未知字段
func (c *VectorDBConfig) MarshalJSON() ([]byte, error) {
	if c == nil {
		return []byte("null"), nil
	}
	if len(c.Extra) == 0 {
		return []byte("{}"), nil
	}
	b, err := json.Marshal(c.Extra)
	if err != nil {
		return nil, fmt.Errorf("marshal vector db config: %w", err)
	}
	return b, nil
}

func isNullJSON(data []byte) bool {
	trimmed := bytes.TrimSpace(data)
	return len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null"))
}

// OCRConfig OCR 服务配置。
type OCRConfig struct {
	Identity  string `json:"identity"`
	Signature string `json:"signature"`
	Region    string `json:"region"`
	Endpoint  string `json:"endpoint"`
}

// StorageConfig 存储服务配置。
type StorageConfig struct {
	Endpoint  string `json:"endpoint"`
	Region    string `json:"region"`
	Identity  string `json:"identity"`
	Signature string `json:"signature"`
	Bucket    string `json:"bucket"`
	Type      string `json:"type"`
}

// SyncStatus 同步状态枚举。
type SyncStatus int

const (
	// SyncStatusPending 待同步。
	SyncStatusPending SyncStatus = 0
	// SyncStatusSynced 已同步。
	SyncStatusSynced SyncStatus = 1
	// SyncStatusSyncFailed 同步失败。
	SyncStatusSyncFailed SyncStatus = 2
	// SyncStatusSyncing 同步中。
	SyncStatusSyncing SyncStatus = 3
	// SyncStatusDeleted 已删除。
	SyncStatusDeleted SyncStatus = 4
	// SyncStatusDeleteFailed 删除失败。
	SyncStatusDeleteFailed SyncStatus = 5
	// SyncStatusRebuilding 重建中。
	SyncStatusRebuilding SyncStatus = 6
)

// String 返回同步状态的字符串表示。
func (s SyncStatus) String() string {
	switch s {
	case SyncStatusPending:
		return "pending"
	case SyncStatusSyncing:
		return "syncing"
	case SyncStatusSynced:
		return "synced"
	case SyncStatusSyncFailed:
		return "sync_failed"
	case SyncStatusDeleted:
		return "deleted"
	case SyncStatusDeleteFailed:
		return "delete_failed"
	case SyncStatusRebuilding:
		return "rebuilding"
	default:
		return "unknown"
	}
}

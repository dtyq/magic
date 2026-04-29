package shared

import "strings"

// PayloadIndexKind 表示 payload 索引类型。
type PayloadIndexKind string

const (
	// PayloadIndexKindKeyword 表示 keyword payload index。
	PayloadIndexKindKeyword PayloadIndexKind = "keyword"
	// PayloadIndexKindInteger 表示 integer payload index。
	PayloadIndexKindInteger PayloadIndexKind = "integer"
)

// PayloadIndexSpec 描述一条 payload 索引声明。
type PayloadIndexSpec struct {
	FieldName string           `json:"field_name"`
	Kind      PayloadIndexKind `json:"kind"`
}

// NormalizePayloadIndexKind 归一化 payload 索引类型。
func NormalizePayloadIndexKind(kind PayloadIndexKind) PayloadIndexKind {
	switch PayloadIndexKind(strings.ToLower(strings.TrimSpace(string(kind)))) {
	case PayloadIndexKindKeyword:
		return PayloadIndexKindKeyword
	case PayloadIndexKindInteger:
		return PayloadIndexKindInteger
	default:
		return ""
	}
}

// Normalize 归一化索引声明。
func (s PayloadIndexSpec) Normalize() PayloadIndexSpec {
	s.FieldName = strings.TrimSpace(s.FieldName)
	s.Kind = NormalizePayloadIndexKind(s.Kind)
	return s
}

// Valid 判断索引声明是否合法。
func (s PayloadIndexSpec) Valid() bool {
	normalized := s.Normalize()
	return normalized.FieldName != "" && normalized.Kind != ""
}

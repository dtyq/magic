package entity

import (
	"encoding/json"
	"strings"
)

// AgentKnowledgeBaseBinding 描述数字员工到知识库的绑定及其关联级配置。
type AgentKnowledgeBaseBinding struct {
	KnowledgeBaseCode string
	Metadata          AgentKnowledgeBaseBindingMetadata
}

// AgentKnowledgeBaseBindingMetadata 是只作用于某个数字员工关联关系的展示与启停配置。
type AgentKnowledgeBaseBindingMetadata struct {
	DisplayName        string `json:"display_name,omitempty"`
	DisplayDescription string `json:"display_description,omitempty"`
	DisplayIcon        string `json:"display_icon,omitempty"`
	Enabled            *bool  `json:"enabled,omitempty"`
}

// AgentKnowledgeBaseBindingMetadataPatch 描述关联级配置的 patch 输入。
type AgentKnowledgeBaseBindingMetadataPatch struct {
	DisplayName        *string
	DisplayDescription *string
	DisplayIcon        *string
	Enabled            *bool
}

// DecodeAgentKnowledgeBaseBindingMetadata 解析绑定 metadata。
// 历史空值、非法 JSON、非法 enabled 都按默认值处理，避免脏数据影响运行时检索。
func DecodeAgentKnowledgeBaseBindingMetadata(raw []byte) AgentKnowledgeBaseBindingMetadata {
	if len(strings.TrimSpace(string(raw))) == 0 {
		return AgentKnowledgeBaseBindingMetadata{}
	}

	var payload map[string]json.RawMessage
	if err := json.Unmarshal(raw, &payload); err != nil {
		return AgentKnowledgeBaseBindingMetadata{}
	}

	var metadata AgentKnowledgeBaseBindingMetadata
	decodeStringField(payload, "display_name", &metadata.DisplayName)
	decodeStringField(payload, "display_description", &metadata.DisplayDescription)
	decodeStringField(payload, "display_icon", &metadata.DisplayIcon)
	if rawEnabled, ok := payload["enabled"]; ok {
		var enabled bool
		if err := json.Unmarshal(rawEnabled, &enabled); err == nil {
			metadata.Enabled = &enabled
		}
	}
	return metadata
}

// ApplyPatch 应用可选字段 patch。
func (m AgentKnowledgeBaseBindingMetadata) ApplyPatch(
	patch AgentKnowledgeBaseBindingMetadataPatch,
) AgentKnowledgeBaseBindingMetadata {
	if patch.DisplayName != nil {
		m.DisplayName = strings.TrimSpace(*patch.DisplayName)
	}
	if patch.DisplayDescription != nil {
		m.DisplayDescription = strings.TrimSpace(*patch.DisplayDescription)
	}
	if patch.DisplayIcon != nil {
		m.DisplayIcon = strings.TrimSpace(*patch.DisplayIcon)
	}
	if patch.Enabled != nil {
		enabled := *patch.Enabled
		m.Enabled = &enabled
	}
	return m
}

// IsEnabled 返回关联级启停配置，缺失时默认启用。
func (m AgentKnowledgeBaseBindingMetadata) IsEnabled() bool {
	return m.Enabled == nil || *m.Enabled
}

// JSONBytes 返回用于持久化的 JSON。
func (m AgentKnowledgeBaseBindingMetadata) JSONBytes() []byte {
	data, err := json.Marshal(m)
	if err != nil {
		return []byte("{}")
	}
	return data
}

func decodeStringField(payload map[string]json.RawMessage, key string, target *string) {
	raw, ok := payload[key]
	if !ok {
		return
	}
	var value string
	if err := json.Unmarshal(raw, &value); err == nil {
		*target = strings.TrimSpace(value)
	}
}

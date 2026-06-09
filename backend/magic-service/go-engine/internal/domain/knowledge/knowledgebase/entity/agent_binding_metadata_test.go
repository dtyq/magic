package entity_test

import (
	"testing"

	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
)

func TestDecodeAgentKnowledgeBaseBindingMetadataDefaultsEnabled(t *testing.T) {
	t.Parallel()

	cases := map[string][]byte{
		"empty":         nil,
		"missing":       []byte(`{"display_name":"别名"}`),
		"invalid_bool":  []byte(`{"enabled":"false"}`),
		"invalid_json":  []byte(`not-json`),
		"explicit_true": []byte(`{"enabled":true}`),
	}
	for name, raw := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			if !kbentity.DecodeAgentKnowledgeBaseBindingMetadata(raw).IsEnabled() {
				t.Fatalf("expected metadata to default enabled")
			}
		})
	}
}

func TestAgentKnowledgeBaseBindingMetadataPatchCanDisableAndClearDisplay(t *testing.T) {
	t.Parallel()

	enabled := true
	disabled := false
	empty := ""
	name := "员工内名称"
	metadata := kbentity.AgentKnowledgeBaseBindingMetadata{DisplayName: name, Enabled: &enabled}

	metadata = metadata.ApplyPatch(kbentity.AgentKnowledgeBaseBindingMetadataPatch{
		DisplayName: &empty,
		Enabled:     &disabled,
	})

	if metadata.DisplayName != "" {
		t.Fatalf("expected display name cleared, got %q", metadata.DisplayName)
	}
	if metadata.IsEnabled() {
		t.Fatalf("expected binding disabled")
	}
}

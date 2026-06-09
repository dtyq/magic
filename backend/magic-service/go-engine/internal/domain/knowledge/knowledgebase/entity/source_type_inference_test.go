package entity_test

import (
	"testing"

	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
)

func TestInferFlowSourceTypeFromTeamshareBinding(t *testing.T) {
	t.Parallel()

	got, err := kbentity.InferFlowSourceTypeFromBindingHints([]kbentity.SourceBindingHint{{
		Provider: "teamshare",
		RootType: "knowledge_base",
	}})
	if err != nil {
		t.Fatalf("InferFlowSourceTypeFromBindingHints returned error: %v", err)
	}
	if got == nil || *got != int(kbentity.SourceTypeLegacyEnterpriseWiki) {
		t.Fatalf("expected legacy enterprise source type, got %#v", got)
	}
}

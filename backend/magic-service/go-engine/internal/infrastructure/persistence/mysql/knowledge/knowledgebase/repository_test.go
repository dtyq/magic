package knowledgebaserepo_test

import (
	"testing"

	"magic/internal/domain/knowledge/knowledgebase/service"
	knowledgebaserepo "magic/internal/infrastructure/persistence/mysql/knowledge/knowledgebase"
)

func TestResolveKnowledgeBaseListFilterModeForTest(t *testing.T) {
	t.Parallel()

	mode := knowledgebaserepo.ResolveKnowledgeBaseListFilterModeForTest(&knowledgebase.Query{
		Codes:       []string{"KB1"},
		BusinessIDs: []string{"BIZ1"},
	})
	if mode != "codes_and_business_ids" {
		t.Fatalf("expected combined filter mode, got %q", mode)
	}

	mode = knowledgebaserepo.ResolveKnowledgeBaseListFilterModeForTest(&knowledgebase.Query{
		Codes: []string{"KB1"},
	})
	if mode != "codes" {
		t.Fatalf("expected codes filter mode, got %q", mode)
	}

	mode = knowledgebaserepo.ResolveKnowledgeBaseListFilterModeForTest(&knowledgebase.Query{
		BusinessIDs: []string{"BIZ1"},
	})
	if mode != "business_ids" {
		t.Fatalf("expected business_ids filter mode, got %q", mode)
	}
}

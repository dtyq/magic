package rebuild_test

import (
	"testing"

	domainrebuild "magic/internal/domain/knowledge/rebuild"
)

func TestNormalizeScopeKnowledgeBaseClearsDocumentCode(t *testing.T) {
	t.Parallel()

	scope := domainrebuild.NormalizeScope(domainrebuild.Scope{
		Mode:              domainrebuild.ScopeModeKnowledgeBase,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentCode:      "DOC1",
		UserID:            "usi_test",
	})

	if scope.Mode != domainrebuild.ScopeModeKnowledgeBase {
		t.Fatalf("expected knowledge_base mode, got %s", scope.Mode)
	}
	if scope.OrganizationCode != "ORG1" || scope.KnowledgeBaseCode != "KB1" {
		t.Fatalf("unexpected scope: %#v", scope)
	}
	if scope.DocumentCode != "" {
		t.Fatalf("expected document_code cleared, got %#v", scope)
	}
}

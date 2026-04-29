package document_test

import (
	"testing"

	docentity "magic/internal/domain/knowledge/document/entity"
	document "magic/internal/domain/knowledge/document/service"
)

func TestBuildManagedSourceDocumentCode(t *testing.T) {
	t.Parallel()

	got := document.BuildManagedSourceDocumentCode(" TeamShare/Open ", 12, 34)
	if got != "managed-source-teamshare-open-12-34" {
		t.Fatalf("BuildManagedSourceDocumentCode() = %q", got)
	}
	if got := document.BuildManagedSourceDocumentCode("teamshare", 0, 34); got != "" {
		t.Fatalf("expected empty code for invalid source binding id, got %q", got)
	}
}

func TestIsManagedSourceDocumentIdentity(t *testing.T) {
	t.Parallel()

	doc := &docentity.KnowledgeBaseDocument{
		OrganizationCode: "ORG1",
		SourceBindingID:  11,
		SourceItemID:     22,
	}
	if !document.IsManagedSourceDocumentIdentity(doc, " ORG1 ", 11, 22) {
		t.Fatal("expected source identity to match")
	}
	if document.IsManagedSourceDocumentIdentity(doc, "ORG2", 11, 22) {
		t.Fatal("expected organization mismatch to fail")
	}
}

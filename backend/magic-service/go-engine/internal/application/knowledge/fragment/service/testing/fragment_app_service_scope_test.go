package fragapp_test

import (
	"errors"
	"testing"

	appservice "magic/internal/application/knowledge/fragment/service"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/shared"
)

func TestValidateFragmentScopeRejectsForeignKnowledge(t *testing.T) {
	t.Parallel()

	fragment := &fragmodel.KnowledgeBaseFragment{
		ID:               1,
		OrganizationCode: "ORG1",
		KnowledgeCode:    "KB1",
		DocumentCode:     "DOC1",
	}

	err := appservice.ValidateFragmentScopeForTest(fragment, "ORG1", "KB2", "DOC1")
	if !errors.Is(err, shared.ErrFragmentNotFound) {
		t.Fatalf("expected ErrFragmentNotFound, got %v", err)
	}
}

func TestValidateFragmentScopeRejectsForeignDocument(t *testing.T) {
	t.Parallel()

	fragment := &fragmodel.KnowledgeBaseFragment{
		ID:               1,
		OrganizationCode: "ORG1",
		KnowledgeCode:    "KB1",
		DocumentCode:     "DOC1",
	}

	err := appservice.ValidateFragmentScopeForTest(fragment, "ORG1", "KB1", "DOC2")
	if !errors.Is(err, shared.ErrFragmentNotFound) {
		t.Fatalf("expected ErrFragmentNotFound, got %v", err)
	}
}

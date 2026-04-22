package kbapp_test

import (
	"errors"
	"testing"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	kbapp "magic/internal/application/knowledge/knowledgebase/service"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/service"
)

func TestValidateAndNormalizeSourceBindingsUsesDomainSemanticValidation(t *testing.T) {
	t.Parallel()

	sourceType := int(knowledgebasedomain.SourceTypeProject)
	_, err := kbapp.ValidateAndNormalizeSourceBindingsForTest(
		knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee,
		&sourceType,
		[]kbdto.SourceBindingInput{{
			Provider: sourcebindingdomain.ProviderProject,
			RootType: sourcebindingdomain.RootTypeProject,
			RootRef:  "300",
			Targets: []kbdto.SourceBindingTargetInput{{
				TargetType: "workspace",
				TargetRef:  "1",
			}},
		}},
	)
	if !errors.Is(err, kbapp.ErrSourceBindingTargetTypeInvalid) {
		t.Fatalf("expected ErrSourceBindingTargetTypeInvalid, got %v", err)
	}
}

func TestValidateAndNormalizeSourceBindingsNormalizesIntoDomainBindings(t *testing.T) {
	t.Parallel()

	sourceType := int(knowledgebasedomain.SourceTypeEnterpriseWiki)
	bindings, err := kbapp.ValidateAndNormalizeSourceBindingsForTest(
		knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee,
		&sourceType,
		[]kbdto.SourceBindingInput{{
			Provider: " TEAMSHARE ",
			RootType: " KNOWLEDGE_BASE ",
			RootRef:  " KB-1 ",
			Targets: []kbdto.SourceBindingTargetInput{{
				TargetType: "group",
				TargetRef:  " G-1 ",
			}},
		}},
	)
	if err != nil {
		t.Fatalf("validateAndNormalizeSourceBindings returned error: %v", err)
	}
	if len(bindings) != 1 {
		t.Fatalf("expected one binding, got %d", len(bindings))
	}
	if bindings[0].Provider != sourcebindingdomain.ProviderTeamshare {
		t.Fatalf("unexpected provider: %#v", bindings[0])
	}
	if bindings[0].RootType != sourcebindingdomain.RootTypeKnowledgeBase {
		t.Fatalf("unexpected root type: %#v", bindings[0])
	}
	if bindings[0].Targets[0].TargetType != sourcebindingdomain.TargetTypeFolder {
		t.Fatalf("expected normalized folder target, got %#v", bindings[0].Targets[0])
	}
}

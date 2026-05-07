package kbapp_test

import (
	"errors"
	"testing"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	kbapp "magic/internal/application/knowledge/knowledgebase/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
)

func TestValidateAndNormalizeSourceBindingsUsesDomainSemanticValidation(t *testing.T) {
	t.Parallel()

	sourceType := int(kbentity.SourceTypeProject)
	_, err := kbapp.ValidateAndNormalizeSourceBindingsForTest(
		kbentity.KnowledgeBaseTypeDigitalEmployee,
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

	sourceType := int(kbentity.SourceTypeEnterpriseWiki)
	bindings, err := kbapp.ValidateAndNormalizeSourceBindingsForTest(
		kbentity.KnowledgeBaseTypeDigitalEmployee,
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

func TestValidateAndNormalizeSourceBindingsDefaultsEmptyTargetTypeToFile(t *testing.T) {
	t.Parallel()

	sourceType := int(kbentity.SourceTypeEnterpriseWiki)
	bindings, err := kbapp.ValidateAndNormalizeSourceBindingsForTest(
		kbentity.KnowledgeBaseTypeDigitalEmployee,
		&sourceType,
		[]kbdto.SourceBindingInput{{
			Provider: sourcebindingdomain.ProviderTeamshare,
			RootType: sourcebindingdomain.RootTypeKnowledgeBase,
			RootRef:  "KB-1",
			Targets: []kbdto.SourceBindingTargetInput{{
				TargetRef: "FILE-1",
			}},
		}},
	)
	if err != nil {
		t.Fatalf("validateAndNormalizeSourceBindings returned error: %v", err)
	}
	if len(bindings) != 1 || len(bindings[0].Targets) != 1 {
		t.Fatalf("expected one binding with one target, got %#v", bindings)
	}
	if bindings[0].Targets[0].TargetType != sourcebindingdomain.TargetTypeFile {
		t.Fatalf("expected empty target_type defaulted to file, got %#v", bindings[0].Targets[0])
	}
}

func TestValidateAndNormalizeSourceBindingsAcceptsEnterpriseSemanticForBothRawValues(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name              string
		knowledgeBaseType kbentity.Type
		sourceType        int
	}{
		{
			name:              "flow_enterprise_legacy_raw",
			knowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector,
			sourceType:        int(kbentity.SourceTypeLegacyEnterpriseWiki),
		},
		{
			name:              "flow_enterprise_digital_raw",
			knowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector,
			sourceType:        int(kbentity.SourceTypeEnterpriseWiki),
		},
		{
			name:              "digital_enterprise_legacy_raw",
			knowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
			sourceType:        int(kbentity.SourceTypeLegacyEnterpriseWiki),
		},
		{
			name:              "digital_enterprise_raw",
			knowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
			sourceType:        int(kbentity.SourceTypeEnterpriseWiki),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			bindings, err := kbapp.ValidateAndNormalizeSourceBindingsForTest(
				tc.knowledgeBaseType,
				&tc.sourceType,
				[]kbdto.SourceBindingInput{{
					Provider: sourcebindingdomain.ProviderTeamshare,
					RootType: sourcebindingdomain.RootTypeKnowledgeBase,
					RootRef:  "KB-1",
				}},
			)
			if err != nil {
				t.Fatalf("validateAndNormalizeSourceBindings returned error: %v", err)
			}
			if len(bindings) != 1 {
				t.Fatalf("expected one binding, got %d", len(bindings))
			}
			if bindings[0].Provider != sourcebindingdomain.ProviderTeamshare || bindings[0].RootType != sourcebindingdomain.RootTypeKnowledgeBase {
				t.Fatalf("unexpected binding: %#v", bindings[0])
			}
		})
	}
}

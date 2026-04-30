package knowledgebase_test

import (
	"errors"
	"testing"

	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
)

func TestNormalizeSourceTypeDefaultsByKnowledgeBaseType(t *testing.T) {
	t.Parallel()

	for _, knowledgeBaseType := range []kbentity.Type{
		kbentity.KnowledgeBaseTypeFlowVector,
		kbentity.KnowledgeBaseTypeDigitalEmployee,
	} {
		t.Run(string(knowledgeBaseType), func(t *testing.T) {
			t.Parallel()

			normalized, err := kbentity.NormalizeSourceType(knowledgeBaseType, nil)
			if err != nil {
				t.Fatalf("NormalizeSourceType returned error: %v", err)
			}
			if normalized == nil || *normalized != int(kbentity.SourceTypeLocalFile) {
				t.Fatalf("expected default source_type=%d, got %#v", int(kbentity.SourceTypeLocalFile), normalized)
			}
		})
	}
}

func TestNormalizeSourceTypeRejectsInvalidValue(t *testing.T) {
	t.Parallel()

	invalid := 99
	_, err := kbentity.NormalizeSourceType(kbentity.KnowledgeBaseTypeDigitalEmployee, &invalid)
	if !errors.Is(err, kbentity.ErrInvalidSourceType) {
		t.Fatalf("expected ErrInvalidSourceType, got %v", err)
	}
}

func TestNormalizeSourceTypeRejectsFlowOnlyNonEnterpriseCrossProductLineValues(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name              string
		knowledgeBaseType kbentity.Type
		sourceType        int
	}{
		{
			name:              "flow_rejects_custom_content",
			knowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector,
			sourceType:        int(kbentity.SourceTypeCustomContent),
		},
		{
			name:              "flow_rejects_project",
			knowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector,
			sourceType:        int(kbentity.SourceTypeProject),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			_, err := kbentity.NormalizeSourceType(tc.knowledgeBaseType, &tc.sourceType)
			if !errors.Is(err, kbentity.ErrInvalidSourceType) {
				t.Fatalf("expected ErrInvalidSourceType, got %v", err)
			}
		})
	}
}

func TestNormalizeSourceTypeAcceptsSupportedValuesByKnowledgeBaseType(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name              string
		knowledgeBaseType kbentity.Type
		sourceType        int
	}{
		{"flow_local", kbentity.KnowledgeBaseTypeFlowVector, int(kbentity.SourceTypeLocalFile)},
		{"flow_enterprise_legacy", kbentity.KnowledgeBaseTypeFlowVector, int(kbentity.SourceTypeLegacyEnterpriseWiki)},
		{"flow_enterprise_digital_raw", kbentity.KnowledgeBaseTypeFlowVector, int(kbentity.SourceTypeEnterpriseWiki)},
		{"digital_local", kbentity.KnowledgeBaseTypeDigitalEmployee, int(kbentity.SourceTypeLocalFile)},
		{"digital_custom", kbentity.KnowledgeBaseTypeDigitalEmployee, int(kbentity.SourceTypeCustomContent)},
		{"digital_project", kbentity.KnowledgeBaseTypeDigitalEmployee, int(kbentity.SourceTypeProject)},
		{"digital_enterprise_legacy", kbentity.KnowledgeBaseTypeDigitalEmployee, int(kbentity.SourceTypeLegacyEnterpriseWiki)},
		{"digital_enterprise", kbentity.KnowledgeBaseTypeDigitalEmployee, int(kbentity.SourceTypeEnterpriseWiki)},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			normalized, err := kbentity.NormalizeSourceType(tc.knowledgeBaseType, &tc.sourceType)
			if err != nil {
				t.Fatalf("NormalizeSourceType returned error: %v", err)
			}
			if normalized == nil || *normalized != tc.sourceType {
				t.Fatalf("expected normalized source_type=%d, got %#v", tc.sourceType, normalized)
			}
		})
	}
}

func TestKnowledgeBaseTypeHelpers(t *testing.T) {
	t.Parallel()

	if !kbentity.IsFlowVectorSourceType(int(kbentity.SourceTypeLocalFile)) {
		t.Fatal("expected local file to be recognized as flow vector source type")
	}
	if !kbentity.IsFlowVectorSourceType(int(kbentity.SourceTypeLegacyEnterpriseWiki)) {
		t.Fatal("expected legacy enterprise wiki to be recognized as flow vector source type")
	}
	if !kbentity.IsFlowVectorSourceType(int(kbentity.SourceTypeEnterpriseWiki)) {
		t.Fatal("expected digital enterprise wiki raw value to be recognized as flow vector source type")
	}
	if !kbentity.IsDigitalEmployeeSourceType(int(kbentity.SourceTypeProject)) {
		t.Fatal("expected project to be recognized as digital employee source type")
	}
	if !kbentity.IsDigitalEmployeeSourceType(int(kbentity.SourceTypeLegacyEnterpriseWiki)) {
		t.Fatal("expected legacy enterprise wiki raw value to be recognized as digital employee source type")
	}
	if kbentity.IsFlowVectorSourceType(int(kbentity.SourceTypeCustomContent)) {
		t.Fatal("custom content should not be recognized as flow vector source type")
	}
}

func TestResolveSemanticSourceType(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name              string
		knowledgeBaseType kbentity.Type
		sourceType        int
		expected          kbentity.SemanticSourceType
	}{
		{"flow_local", kbentity.KnowledgeBaseTypeFlowVector, int(kbentity.SourceTypeLocalFile), kbentity.SemanticSourceTypeLocal},
		{"flow_enterprise_legacy", kbentity.KnowledgeBaseTypeFlowVector, int(kbentity.SourceTypeLegacyEnterpriseWiki), kbentity.SemanticSourceTypeEnterprise},
		{"flow_enterprise_digital_raw", kbentity.KnowledgeBaseTypeFlowVector, int(kbentity.SourceTypeEnterpriseWiki), kbentity.SemanticSourceTypeEnterprise},
		{"digital_local", kbentity.KnowledgeBaseTypeDigitalEmployee, int(kbentity.SourceTypeLocalFile), kbentity.SemanticSourceTypeLocal},
		{"digital_custom", kbentity.KnowledgeBaseTypeDigitalEmployee, int(kbentity.SourceTypeCustomContent), kbentity.SemanticSourceTypeCustomContent},
		{"digital_project", kbentity.KnowledgeBaseTypeDigitalEmployee, int(kbentity.SourceTypeProject), kbentity.SemanticSourceTypeProject},
		{"digital_enterprise_legacy", kbentity.KnowledgeBaseTypeDigitalEmployee, int(kbentity.SourceTypeLegacyEnterpriseWiki), kbentity.SemanticSourceTypeEnterprise},
		{"digital_enterprise", kbentity.KnowledgeBaseTypeDigitalEmployee, int(kbentity.SourceTypeEnterpriseWiki), kbentity.SemanticSourceTypeEnterprise},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			actual, err := kbentity.ResolveSemanticSourceType(tc.knowledgeBaseType, tc.sourceType)
			if err != nil {
				t.Fatalf("ResolveSemanticSourceType returned error: %v", err)
			}
			if actual != tc.expected {
				t.Fatalf("expected semantic source type %q, got %q", tc.expected, actual)
			}
		})
	}
}

func TestNormalizeExistingSourceTypeForKnowledgeBaseType(t *testing.T) {
	t.Parallel()

	oldFlowEnterprise := int(kbentity.SourceTypeLegacyEnterpriseWiki)
	normalized, err := kbentity.NormalizeExistingSourceTypeForKnowledgeBaseType(
		kbentity.KnowledgeBaseTypeDigitalEmployee,
		&oldFlowEnterprise,
	)
	if err != nil {
		t.Fatalf("NormalizeExistingSourceTypeForKnowledgeBaseType returned error: %v", err)
	}
	if normalized == nil || *normalized != oldFlowEnterprise {
		t.Fatalf("expected normalized digital enterprise source_type=%d, got %#v", oldFlowEnterprise, normalized)
	}

	oldDigitalEnterprise := int(kbentity.SourceTypeEnterpriseWiki)
	normalized, err = kbentity.NormalizeExistingSourceTypeForKnowledgeBaseType(
		kbentity.KnowledgeBaseTypeFlowVector,
		&oldDigitalEnterprise,
	)
	if err != nil {
		t.Fatalf("NormalizeExistingSourceTypeForKnowledgeBaseType returned error: %v", err)
	}
	if normalized == nil || *normalized != oldDigitalEnterprise {
		t.Fatalf("expected normalized flow enterprise source_type=%d, got %#v", oldDigitalEnterprise, normalized)
	}

	projectSourceType := int(kbentity.SourceTypeProject)
	normalized, err = kbentity.NormalizeExistingSourceTypeForKnowledgeBaseType(
		kbentity.KnowledgeBaseTypeFlowVector,
		&projectSourceType,
	)
	if !errors.Is(err, kbentity.ErrExplicitFlowSourceTypeRequired) {
		t.Fatalf("expected ErrExplicitFlowSourceTypeRequired, got normalized=%#v err=%v", normalized, err)
	}
}

func TestNormalizeOrInferSourceType(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name              string
		knowledgeBaseType kbentity.Type
		sourceType        *int
		bindingHints      []kbentity.SourceBindingHint
		wantSourceType    int
		wantErr           error
	}{
		{
			name:              "digital_missing_source_type",
			knowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
			wantErr:           kbentity.ErrDigitalEmployeeSourceTypeRequired,
		},
		{
			name:              "flow_without_bindings_defaults_local",
			knowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector,
			wantSourceType:    int(kbentity.SourceTypeLocalFile),
		},
		{
			name:              "flow_local_binding_defaults_local",
			knowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector,
			bindingHints: []kbentity.SourceBindingHint{
				{Provider: "local_upload", RootType: "file"},
			},
			wantSourceType: int(kbentity.SourceTypeLocalFile),
		},
		{
			name:              "flow_enterprise_binding_infers_enterprise",
			knowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector,
			bindingHints: []kbentity.SourceBindingHint{
				{Provider: "teamshare", RootType: "knowledge_base"},
			},
			wantSourceType: int(kbentity.SourceTypeLegacyEnterpriseWiki),
		},
		{
			name:              "flow_mixed_bindings_rejected",
			knowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector,
			bindingHints: []kbentity.SourceBindingHint{
				{Provider: "local_upload", RootType: "file"},
				{Provider: "teamshare", RootType: "knowledge_base"},
			},
			wantErr: kbentity.ErrAmbiguousFlowSourceType,
		},
		{
			name:              "explicit_source_type_wins",
			knowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector,
			sourceType:        func() *int { value := int(kbentity.SourceTypeLegacyEnterpriseWiki); return &value }(),
			bindingHints: []kbentity.SourceBindingHint{
				{Provider: "local_upload", RootType: "file"},
			},
			wantSourceType: int(kbentity.SourceTypeLegacyEnterpriseWiki),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			normalized, err := kbentity.NormalizeOrInferSourceType(
				tc.knowledgeBaseType,
				tc.sourceType,
				tc.bindingHints,
			)
			if tc.wantErr != nil {
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("expected error %v, got %v", tc.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("NormalizeOrInferSourceType returned error: %v", err)
			}
			if normalized == nil || *normalized != tc.wantSourceType {
				t.Fatalf("expected source_type=%d, got %#v", tc.wantSourceType, normalized)
			}
		})
	}
}

func TestValidateManualDocumentCreateAllowed(t *testing.T) {
	t.Parallel()

	projectSourceType := int(kbentity.SourceTypeProject)
	if err := kbentity.ValidateManualDocumentCreateAllowed(
		kbentity.KnowledgeBaseTypeDigitalEmployee,
		&projectSourceType,
	); !errors.Is(err, kbentity.ErrManualDocumentCreateNotAllowed) {
		t.Fatalf("expected ErrManualDocumentCreateNotAllowed for project digital employee knowledge base, got %v", err)
	}

	enterpriseSourceType := int(kbentity.SourceTypeEnterpriseWiki)
	if err := kbentity.ValidateManualDocumentCreateAllowed(
		kbentity.KnowledgeBaseTypeDigitalEmployee,
		&enterpriseSourceType,
	); !errors.Is(err, kbentity.ErrManualDocumentCreateNotAllowed) {
		t.Fatalf("expected ErrManualDocumentCreateNotAllowed for enterprise digital employee knowledge base, got %v", err)
	}

	legacyEnterpriseSourceType := int(kbentity.SourceTypeLegacyEnterpriseWiki)
	if err := kbentity.ValidateManualDocumentCreateAllowed(
		kbentity.KnowledgeBaseTypeDigitalEmployee,
		&legacyEnterpriseSourceType,
	); !errors.Is(err, kbentity.ErrManualDocumentCreateNotAllowed) {
		t.Fatalf("expected ErrManualDocumentCreateNotAllowed for legacy enterprise digital employee knowledge base, got %v", err)
	}

	customSourceType := int(kbentity.SourceTypeCustomContent)
	if err := kbentity.ValidateManualDocumentCreateAllowed(
		kbentity.KnowledgeBaseTypeDigitalEmployee,
		&customSourceType,
	); err != nil {
		t.Fatalf("expected custom digital employee knowledge base to allow manual document create, got %v", err)
	}

	flowEnterpriseSourceType := int(kbentity.SourceTypeLegacyEnterpriseWiki)
	if err := kbentity.ValidateManualDocumentCreateAllowed(
		kbentity.KnowledgeBaseTypeFlowVector,
		&flowEnterpriseSourceType,
	); err != nil {
		t.Fatalf("expected flow knowledge base to allow manual document create, got %v", err)
	}
}

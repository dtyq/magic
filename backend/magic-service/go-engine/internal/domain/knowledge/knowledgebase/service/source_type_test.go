package knowledgebase_test

import (
	"errors"
	"testing"

	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
)

func TestNormalizeSourceTypeDefaultsByKnowledgeBaseType(t *testing.T) {
	t.Parallel()

	for _, knowledgeBaseType := range []knowledgebasedomain.Type{
		knowledgebasedomain.KnowledgeBaseTypeFlowVector,
		knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee,
	} {
		t.Run(string(knowledgeBaseType), func(t *testing.T) {
			t.Parallel()

			normalized, err := knowledgebasedomain.NormalizeSourceType(knowledgeBaseType, nil)
			if err != nil {
				t.Fatalf("NormalizeSourceType returned error: %v", err)
			}
			if normalized == nil || *normalized != int(knowledgebasedomain.SourceTypeLocalFile) {
				t.Fatalf("expected default source_type=%d, got %#v", int(knowledgebasedomain.SourceTypeLocalFile), normalized)
			}
		})
	}
}

func TestNormalizeSourceTypeRejectsInvalidValue(t *testing.T) {
	t.Parallel()

	invalid := 99
	_, err := knowledgebasedomain.NormalizeSourceType(knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee, &invalid)
	if !errors.Is(err, knowledgebasedomain.ErrInvalidSourceType) {
		t.Fatalf("expected ErrInvalidSourceType, got %v", err)
	}
}

func TestNormalizeSourceTypeRejectsCrossProductLineValues(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name              string
		knowledgeBaseType knowledgebasedomain.Type
		sourceType        int
	}{
		{
			name:              "digital_employee_rejects_flow_enterprise_value",
			knowledgeBaseType: knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee,
			sourceType:        int(knowledgebasedomain.SourceTypeLegacyEnterpriseWiki),
		},
		{
			name:              "flow_rejects_digital_enterprise_value",
			knowledgeBaseType: knowledgebasedomain.KnowledgeBaseTypeFlowVector,
			sourceType:        int(knowledgebasedomain.SourceTypeEnterpriseWiki),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			_, err := knowledgebasedomain.NormalizeSourceType(tc.knowledgeBaseType, &tc.sourceType)
			if !errors.Is(err, knowledgebasedomain.ErrInvalidSourceType) {
				t.Fatalf("expected ErrInvalidSourceType, got %v", err)
			}
		})
	}
}

func TestNormalizeSourceTypeAcceptsSupportedValuesByKnowledgeBaseType(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name              string
		knowledgeBaseType knowledgebasedomain.Type
		sourceType        int
	}{
		{"flow_local", knowledgebasedomain.KnowledgeBaseTypeFlowVector, int(knowledgebasedomain.SourceTypeLocalFile)},
		{"flow_enterprise", knowledgebasedomain.KnowledgeBaseTypeFlowVector, int(knowledgebasedomain.SourceTypeLegacyEnterpriseWiki)},
		{"digital_local", knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee, int(knowledgebasedomain.SourceTypeLocalFile)},
		{"digital_custom", knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee, int(knowledgebasedomain.SourceTypeCustomContent)},
		{"digital_project", knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee, int(knowledgebasedomain.SourceTypeProject)},
		{"digital_enterprise", knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee, int(knowledgebasedomain.SourceTypeEnterpriseWiki)},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			normalized, err := knowledgebasedomain.NormalizeSourceType(tc.knowledgeBaseType, &tc.sourceType)
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

	if !knowledgebasedomain.IsFlowVectorSourceType(int(knowledgebasedomain.SourceTypeLocalFile)) {
		t.Fatal("expected local file to be recognized as flow vector source type")
	}
	if !knowledgebasedomain.IsFlowVectorSourceType(int(knowledgebasedomain.SourceTypeLegacyEnterpriseWiki)) {
		t.Fatal("expected legacy enterprise wiki to be recognized as flow vector source type")
	}
	if !knowledgebasedomain.IsDigitalEmployeeSourceType(int(knowledgebasedomain.SourceTypeProject)) {
		t.Fatal("expected project to be recognized as digital employee source type")
	}
	if knowledgebasedomain.IsFlowVectorSourceType(int(knowledgebasedomain.SourceTypeCustomContent)) {
		t.Fatal("custom content should not be recognized as flow vector source type")
	}
}

func TestResolveSemanticSourceType(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name              string
		knowledgeBaseType knowledgebasedomain.Type
		sourceType        int
		expected          knowledgebasedomain.SemanticSourceType
	}{
		{"flow_local", knowledgebasedomain.KnowledgeBaseTypeFlowVector, int(knowledgebasedomain.SourceTypeLocalFile), knowledgebasedomain.SemanticSourceTypeLocal},
		{"flow_enterprise", knowledgebasedomain.KnowledgeBaseTypeFlowVector, int(knowledgebasedomain.SourceTypeLegacyEnterpriseWiki), knowledgebasedomain.SemanticSourceTypeEnterprise},
		{"digital_local", knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee, int(knowledgebasedomain.SourceTypeLocalFile), knowledgebasedomain.SemanticSourceTypeLocal},
		{"digital_custom", knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee, int(knowledgebasedomain.SourceTypeCustomContent), knowledgebasedomain.SemanticSourceTypeCustomContent},
		{"digital_project", knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee, int(knowledgebasedomain.SourceTypeProject), knowledgebasedomain.SemanticSourceTypeProject},
		{"digital_enterprise", knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee, int(knowledgebasedomain.SourceTypeEnterpriseWiki), knowledgebasedomain.SemanticSourceTypeEnterprise},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			actual, err := knowledgebasedomain.ResolveSemanticSourceType(tc.knowledgeBaseType, tc.sourceType)
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

	oldFlowEnterprise := int(knowledgebasedomain.SourceTypeLegacyEnterpriseWiki)
	normalized, err := knowledgebasedomain.NormalizeExistingSourceTypeForKnowledgeBaseType(
		knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee,
		&oldFlowEnterprise,
	)
	if err != nil {
		t.Fatalf("NormalizeExistingSourceTypeForKnowledgeBaseType returned error: %v", err)
	}
	if normalized == nil || *normalized != int(knowledgebasedomain.SourceTypeEnterpriseWiki) {
		t.Fatalf("expected normalized digital enterprise source_type=%d, got %#v", int(knowledgebasedomain.SourceTypeEnterpriseWiki), normalized)
	}

	oldDigitalEnterprise := int(knowledgebasedomain.SourceTypeEnterpriseWiki)
	normalized, err = knowledgebasedomain.NormalizeExistingSourceTypeForKnowledgeBaseType(
		knowledgebasedomain.KnowledgeBaseTypeFlowVector,
		&oldDigitalEnterprise,
	)
	if err != nil {
		t.Fatalf("NormalizeExistingSourceTypeForKnowledgeBaseType returned error: %v", err)
	}
	if normalized == nil || *normalized != int(knowledgebasedomain.SourceTypeLegacyEnterpriseWiki) {
		t.Fatalf("expected normalized flow enterprise source_type=%d, got %#v", int(knowledgebasedomain.SourceTypeLegacyEnterpriseWiki), normalized)
	}

	projectSourceType := int(knowledgebasedomain.SourceTypeProject)
	normalized, err = knowledgebasedomain.NormalizeExistingSourceTypeForKnowledgeBaseType(
		knowledgebasedomain.KnowledgeBaseTypeFlowVector,
		&projectSourceType,
	)
	if !errors.Is(err, knowledgebasedomain.ErrExplicitFlowSourceTypeRequired) {
		t.Fatalf("expected ErrExplicitFlowSourceTypeRequired, got normalized=%#v err=%v", normalized, err)
	}
}

func TestNormalizeOrInferSourceType(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name              string
		knowledgeBaseType knowledgebasedomain.Type
		sourceType        *int
		bindingHints      []knowledgebasedomain.SourceBindingHint
		wantSourceType    int
		wantErr           error
	}{
		{
			name:              "digital_missing_source_type",
			knowledgeBaseType: knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee,
			wantErr:           knowledgebasedomain.ErrDigitalEmployeeSourceTypeRequired,
		},
		{
			name:              "flow_without_bindings_defaults_local",
			knowledgeBaseType: knowledgebasedomain.KnowledgeBaseTypeFlowVector,
			wantSourceType:    int(knowledgebasedomain.SourceTypeLocalFile),
		},
		{
			name:              "flow_local_binding_defaults_local",
			knowledgeBaseType: knowledgebasedomain.KnowledgeBaseTypeFlowVector,
			bindingHints: []knowledgebasedomain.SourceBindingHint{
				{Provider: "local_upload", RootType: "file"},
			},
			wantSourceType: int(knowledgebasedomain.SourceTypeLocalFile),
		},
		{
			name:              "flow_enterprise_binding_infers_enterprise",
			knowledgeBaseType: knowledgebasedomain.KnowledgeBaseTypeFlowVector,
			bindingHints: []knowledgebasedomain.SourceBindingHint{
				{Provider: "teamshare", RootType: "knowledge_base"},
			},
			wantSourceType: int(knowledgebasedomain.SourceTypeLegacyEnterpriseWiki),
		},
		{
			name:              "flow_mixed_bindings_rejected",
			knowledgeBaseType: knowledgebasedomain.KnowledgeBaseTypeFlowVector,
			bindingHints: []knowledgebasedomain.SourceBindingHint{
				{Provider: "local_upload", RootType: "file"},
				{Provider: "teamshare", RootType: "knowledge_base"},
			},
			wantErr: knowledgebasedomain.ErrAmbiguousFlowSourceType,
		},
		{
			name:              "explicit_source_type_wins",
			knowledgeBaseType: knowledgebasedomain.KnowledgeBaseTypeFlowVector,
			sourceType:        func() *int { value := int(knowledgebasedomain.SourceTypeLegacyEnterpriseWiki); return &value }(),
			bindingHints: []knowledgebasedomain.SourceBindingHint{
				{Provider: "local_upload", RootType: "file"},
			},
			wantSourceType: int(knowledgebasedomain.SourceTypeLegacyEnterpriseWiki),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			normalized, err := knowledgebasedomain.NormalizeOrInferSourceType(
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

	projectSourceType := int(knowledgebasedomain.SourceTypeProject)
	if err := knowledgebasedomain.ValidateManualDocumentCreateAllowed(
		knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee,
		&projectSourceType,
	); !errors.Is(err, knowledgebasedomain.ErrManualDocumentCreateNotAllowed) {
		t.Fatalf("expected ErrManualDocumentCreateNotAllowed for project digital employee knowledge base, got %v", err)
	}

	enterpriseSourceType := int(knowledgebasedomain.SourceTypeEnterpriseWiki)
	if err := knowledgebasedomain.ValidateManualDocumentCreateAllowed(
		knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee,
		&enterpriseSourceType,
	); !errors.Is(err, knowledgebasedomain.ErrManualDocumentCreateNotAllowed) {
		t.Fatalf("expected ErrManualDocumentCreateNotAllowed for enterprise digital employee knowledge base, got %v", err)
	}

	customSourceType := int(knowledgebasedomain.SourceTypeCustomContent)
	if err := knowledgebasedomain.ValidateManualDocumentCreateAllowed(
		knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee,
		&customSourceType,
	); err != nil {
		t.Fatalf("expected custom digital employee knowledge base to allow manual document create, got %v", err)
	}

	flowEnterpriseSourceType := int(knowledgebasedomain.SourceTypeLegacyEnterpriseWiki)
	if err := knowledgebasedomain.ValidateManualDocumentCreateAllowed(
		knowledgebasedomain.KnowledgeBaseTypeFlowVector,
		&flowEnterpriseSourceType,
	); err != nil {
		t.Fatalf("expected flow knowledge base to allow manual document create, got %v", err)
	}
}

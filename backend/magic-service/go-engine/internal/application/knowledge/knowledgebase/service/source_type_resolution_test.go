package kbapp_test

import (
	"context"
	"errors"
	"testing"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	kbapp "magic/internal/application/knowledge/knowledgebase/service"
	docentity "magic/internal/domain/knowledge/document/entity"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
	"magic/internal/pkg/thirdplatform"
)

func TestNormalizeCreateCommandForTestFlowDefaultsLocalWithoutBindings(t *testing.T) {
	t.Parallel()

	command := mustNormalizeCreateCommand(t, &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
	})
	assertSourceType(t, command.SourceType, int(kbentity.SourceTypeLocalFile))
}

func TestNormalizeCreateCommandForTestFlowInfersLocalFromBindings(t *testing.T) {
	t.Parallel()

	command := mustNormalizeCreateCommand(t, &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		SourceBindings: []kbdto.SourceBindingInput{
			localBindingInput("ORG-1/doc.md"),
		},
	})
	assertSourceType(t, command.SourceType, int(kbentity.SourceTypeLocalFile))
}

func TestNormalizeCreateCommandForTestFlowInfersLocalFromLegacyDocumentFiles(t *testing.T) {
	t.Parallel()

	command := mustNormalizeCreateCommand(t, &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		LegacyDocumentFiles: []kbdto.LegacyDocumentFileInput{
			{
				"name": "doc.md",
				"key":  "ORG-1/doc.md",
				"type": 1,
			},
		},
	})
	assertSourceType(t, command.SourceType, int(kbentity.SourceTypeLocalFile))
	if len(command.SourceBindings) != 1 {
		t.Fatalf("expected one normalized source binding, got %#v", command.SourceBindings)
	}
	if command.SourceBindings[0].Provider != sourcebindingdomain.ProviderLocalUpload ||
		command.SourceBindings[0].RootType != sourcebindingdomain.RootTypeFile ||
		command.SourceBindings[0].RootRef != "ORG-1/doc.md" {
		t.Fatalf("expected local legacy document file normalized to local_upload file binding, got %#v", command.SourceBindings[0])
	}
}

func TestNormalizeCreateCommandForTestFlowInfersEnterpriseFromBindings(t *testing.T) {
	t.Parallel()

	command := mustNormalizeCreateCommand(t, &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		SourceBindings: []kbdto.SourceBindingInput{
			enterpriseBindingInput("TS-KB-2"),
		},
	})
	assertSourceType(t, command.SourceType, int(kbentity.SourceTypeLegacyEnterpriseWiki))
}

func TestNormalizeCreateCommandForTestFlowInfersEnterpriseFromLegacyDocumentFiles(t *testing.T) {
	t.Parallel()

	expander := sourceTypeTestThirdPlatformExpander{
		files: []*docentity.File{{
			ThirdID:         "FILE-1",
			KnowledgeBaseID: "TS-KB-8",
		}},
	}
	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	svc.SetThirdPlatformExpander(expander)

	command, err := kbapp.NormalizeCreateCommandForTest(context.Background(), svc, &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		LegacyDocumentFiles: []kbdto.LegacyDocumentFileInput{
			{
				"type":          2,
				"platform_type": sourcebindingdomain.ProviderTeamshare,
				"third_file_id": "FILE-1",
			},
		},
	})
	if err != nil {
		t.Fatalf("NormalizeCreateCommandForTest returned error: %v", err)
	}
	assertSourceType(t, command.SourceType, int(kbentity.SourceTypeLegacyEnterpriseWiki))
	if len(command.SourceBindings) != 1 {
		t.Fatalf("expected one enterprise binding, got %#v", command.SourceBindings)
	}
	if command.SourceBindings[0].Provider != sourcebindingdomain.ProviderTeamshare ||
		command.SourceBindings[0].RootType != sourcebindingdomain.RootTypeKnowledgeBase ||
		command.SourceBindings[0].RootRef != "TS-KB-8" {
		t.Fatalf("expected enterprise knowledge base binding, got %#v", command.SourceBindings[0])
	}
	if len(command.SourceBindings[0].Targets) != 1 ||
		command.SourceBindings[0].Targets[0].TargetType != sourcebindingdomain.TargetTypeFile ||
		command.SourceBindings[0].Targets[0].TargetRef != "FILE-1" {
		t.Fatalf("expected FILE-1 normalized as file target, got %#v", command.SourceBindings[0].Targets)
	}
}

func TestNormalizeCreateCommandForTestFlowAcceptsExplicitEnterpriseSourceTypeWithoutAgentCodes(t *testing.T) {
	t.Parallel()

	command := mustNormalizeCreateCommand(t, &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		SourceType: func() *int {
			value := int(kbentity.SourceTypeLegacyEnterpriseWiki)
			return &value
		}(),
		SourceBindings: []kbdto.SourceBindingInput{
			enterpriseBindingInput("TS-KB-3"),
		},
	})
	assertSourceType(t, command.SourceType, int(kbentity.SourceTypeLegacyEnterpriseWiki))
}

func TestNormalizeCreateCommandForTestFlowAcceptsDigitalEnterpriseRawSourceTypeWithoutAgentCodes(t *testing.T) {
	t.Parallel()

	command := mustNormalizeCreateCommand(t, &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		SourceType: func() *int {
			value := int(kbentity.SourceTypeEnterpriseWiki)
			return &value
		}(),
		SourceBindings: []kbdto.SourceBindingInput{
			enterpriseBindingInput("TS-KB-3A"),
		},
	})
	assertSourceType(t, command.SourceType, int(kbentity.SourceTypeEnterpriseWiki))
}

func TestNormalizeCreateCommandForTestFlowRejectsMixedBindings(t *testing.T) {
	t.Parallel()

	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	_, err := kbapp.NormalizeCreateCommandForTest(context.Background(), svc, &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		SourceBindings: []kbdto.SourceBindingInput{
			localBindingInput("ORG-1/doc.md"),
			enterpriseBindingInput("TS-KB-4"),
		},
	})
	if !errors.Is(err, kbentity.ErrAmbiguousFlowSourceType) {
		t.Fatalf("expected ErrAmbiguousFlowSourceType, got %v", err)
	}
}

func TestNormalizeCreateCommandForTestDigitalEmployeeRequiresSourceType(t *testing.T) {
	t.Parallel()

	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	svc.SetSuperMagicAgentReader(sourceTypeTestSuperMagicAgentReader{codes: map[string]struct{}{"SMA-1": {}}})
	svc.SetSuperMagicAgentAccessChecker(sourceTypeTestSuperMagicAgentAccessChecker{codes: map[string]struct{}{"SMA-1": {}}})

	_, err := kbapp.NormalizeCreateCommandForTest(context.Background(), svc, &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		AgentCodes:       []string{"SMA-1"},
	})
	if !errors.Is(err, kbentity.ErrDigitalEmployeeSourceTypeRequired) {
		t.Fatalf("expected ErrDigitalEmployeeSourceTypeRequired, got %v", err)
	}
}

func TestNormalizeCreateCommandForTestDigitalEmployeeAcceptsLegacyEnterpriseSourceType(t *testing.T) {
	t.Parallel()

	sourceType := int(kbentity.SourceTypeLegacyEnterpriseWiki)
	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	svc.SetSuperMagicAgentReader(sourceTypeTestSuperMagicAgentReader{codes: map[string]struct{}{"SMA-1": {}}})
	svc.SetSuperMagicAgentAccessChecker(sourceTypeTestSuperMagicAgentAccessChecker{codes: map[string]struct{}{"SMA-1": {}}})

	command, err := kbapp.NormalizeCreateCommandForTest(context.Background(), svc, &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		AgentCodes:       []string{"SMA-1"},
		SourceType:       &sourceType,
	})
	if err != nil {
		t.Fatalf("NormalizeCreateCommandForTest returned error: %v", err)
	}
	assertSourceType(t, command.SourceType, sourceType)
}

func TestNormalizeUpdateCommandForTestDigitalEmployeeIgnoresSourceTypeWithoutReplacingSource(t *testing.T) {
	t.Parallel()

	sourceType := int(kbentity.SourceTypeLocalFile)
	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	svc.SetKnowledgeBaseBindingRepository(sourceTypeTestKnowledgeBaseBindingRepository{
		agentCodesByKnowledgeBase: map[string][]string{"KB-1": {"SMA-1"}},
	})

	command, err := kbapp.NormalizeUpdateCommandForTest(context.Background(), svc, &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Code:             "KB-1",
		SourceType:       &sourceType,
	}, &kbentity.KnowledgeBase{
		Code:              "KB-1",
		KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		SourceType:        &sourceType,
	})
	if err != nil {
		t.Fatalf("NormalizeUpdateCommandForTest returned error: %v", err)
	}
	if command.SourceType != nil {
		t.Fatalf("expected update to ignore source_type patch, got %#v", command.SourceType)
	}
	if command.ValidationSourceType != nil {
		t.Fatalf("expected no validation source_type without replacing source, got %#v", command.ValidationSourceType)
	}
}

func TestNormalizeUpdateCommandForTestFlowIgnoresSourceTypeWithoutReplacingSource(t *testing.T) {
	t.Parallel()

	sourceType := int(kbentity.SourceTypeEnterpriseWiki)
	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	svc.SetKnowledgeBaseBindingRepository(sourceTypeTestKnowledgeBaseBindingRepository{})

	command, err := kbapp.NormalizeUpdateCommandForTest(context.Background(), svc, &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Code:             "KB-1",
		SourceType:       &sourceType,
	}, &kbentity.KnowledgeBase{
		Code:              "KB-1",
		KnowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector,
	})
	if err != nil {
		t.Fatalf("NormalizeUpdateCommandForTest returned error: %v", err)
	}
	if command.SourceType != nil {
		t.Fatalf("expected update to ignore source_type patch, got %#v", command.SourceType)
	}
	if command.ValidationSourceType != nil {
		t.Fatalf("expected no validation source_type without replacing source, got %#v", command.ValidationSourceType)
	}
}

func TestNormalizeUpdateCommandForTestDigitalEmployeeReplaceSourceUsesCurrentSourceType(t *testing.T) {
	t.Parallel()

	currentSourceType := int(kbentity.SourceTypeLegacyEnterpriseWiki)
	inputSourceType := int(kbentity.SourceTypeLocalFile)
	inputBindings := []kbdto.SourceBindingInput{enterpriseBindingInput("TS-KB-5")}
	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	svc.SetKnowledgeBaseBindingRepository(sourceTypeTestKnowledgeBaseBindingRepository{
		agentCodesByKnowledgeBase: map[string][]string{"KB-1": {"SMA-1"}},
	})

	command, err := kbapp.NormalizeUpdateCommandForTest(context.Background(), svc, &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Code:             "KB-1",
		SourceType:       &inputSourceType,
		SourceBindings:   &inputBindings,
	}, &kbentity.KnowledgeBase{
		Code:              "KB-1",
		KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		SourceType:        &currentSourceType,
	})
	if err != nil {
		t.Fatalf("NormalizeUpdateCommandForTest returned error: %v", err)
	}
	if command.SourceType != nil {
		t.Fatalf("expected update to ignore source_type patch, got %#v", command.SourceType)
	}
	assertSourceType(t, command.ValidationSourceType, currentSourceType)
}

func TestNormalizeUpdateCommandForTestFlowReplaceSourceUsesCurrentSourceType(t *testing.T) {
	t.Parallel()

	currentSourceType := int(kbentity.SourceTypeLegacyEnterpriseWiki)
	inputBindings := []kbdto.SourceBindingInput{enterpriseBindingInput("TS-KB-5")}
	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	svc.SetKnowledgeBaseBindingRepository(sourceTypeTestKnowledgeBaseBindingRepository{})

	command, err := kbapp.NormalizeUpdateCommandForTest(context.Background(), svc, &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Code:             "KB-1",
		SourceBindings:   &inputBindings,
	}, &kbentity.KnowledgeBase{
		Code:              "KB-1",
		KnowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector,
		SourceType:        &currentSourceType,
	})
	if err != nil {
		t.Fatalf("NormalizeUpdateCommandForTest returned error: %v", err)
	}
	if command.SourceType != nil {
		t.Fatalf("expected update to ignore source_type patch, got %#v", command.SourceType)
	}
	assertSourceType(t, command.ValidationSourceType, currentSourceType)
}

func TestNormalizeUpdateCommandForTestFlowUsesLegacyDocumentFilesAsReplaceSource(t *testing.T) {
	t.Parallel()

	legacyDocumentFiles := []kbdto.LegacyDocumentFileInput{
		{
			"name": "doc.md",
			"key":  "ORG-1/doc.md",
			"type": 1,
		},
	}
	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	svc.SetKnowledgeBaseBindingRepository(sourceTypeTestKnowledgeBaseBindingRepository{})

	command, err := kbapp.NormalizeUpdateCommandForTest(context.Background(), svc, &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode:    "ORG-1",
		UserID:              "user-1",
		Code:                "KB-1",
		LegacyDocumentFiles: &legacyDocumentFiles,
	}, &kbentity.KnowledgeBase{
		Code:              "KB-1",
		KnowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector,
	})
	if err != nil {
		t.Fatalf("NormalizeUpdateCommandForTest returned error: %v", err)
	}
	if !command.ReplaceSource {
		t.Fatal("expected legacy document_files update to replace source bindings")
	}
	if command.SourceType != nil {
		t.Fatalf("expected update to ignore source_type patch, got %#v", command.SourceType)
	}
	assertSourceType(t, command.ValidationSourceType, int(kbentity.SourceTypeLocalFile))
	if len(command.SourceBindings) != 1 || command.SourceBindings[0].RootRef != "ORG-1/doc.md" {
		t.Fatalf("expected legacy document file normalized on update, got %#v", command.SourceBindings)
	}
}

func TestNormalizeUpdateCommandForTestFlowWithoutReplacingSourceDoesNotUseCurrentSourceType(t *testing.T) {
	t.Parallel()

	currentSourceType := int(kbentity.SourceTypeEnterpriseWiki)
	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	svc.SetKnowledgeBaseBindingRepository(sourceTypeTestKnowledgeBaseBindingRepository{})

	command, err := kbapp.NormalizeUpdateCommandForTest(context.Background(), svc, &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Code:             "KB-1",
	}, &kbentity.KnowledgeBase{
		Code:              "KB-1",
		KnowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector,
		SourceType:        &currentSourceType,
	})
	if err != nil {
		t.Fatalf("NormalizeUpdateCommandForTest returned error: %v", err)
	}
	if command.SourceType != nil {
		t.Fatalf("expected update to ignore source_type patch, got %#v", command.SourceType)
	}
	if command.ValidationSourceType != nil {
		t.Fatalf("expected no validation source_type without replacing source, got %#v", command.ValidationSourceType)
	}
}

func TestNormalizeUpdateCommandForTestFlowReplaceSourceRejectsCrossSemanticBindings(t *testing.T) {
	t.Parallel()

	currentSourceType := int(kbentity.SourceTypeEnterpriseWiki)
	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	svc.SetKnowledgeBaseBindingRepository(sourceTypeTestKnowledgeBaseBindingRepository{})

	_, err := kbapp.NormalizeUpdateCommandForTest(context.Background(), svc, &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Code:             "KB-1",
		SourceBindings:   &[]kbdto.SourceBindingInput{localBindingInput("ORG-1/doc.md")},
	}, &kbentity.KnowledgeBase{
		Code:              "KB-1",
		KnowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector,
		SourceType:        &currentSourceType,
	})
	if !errors.Is(err, kbapp.ErrSourceBindingSemanticMismatch) {
		t.Fatalf("expected ErrSourceBindingSemanticMismatch, got %v", err)
	}
}

func TestNormalizeUpdateCommandForTestFlowReplaceSourceUsesCurrentSourceTypeEvenWhenInputProvided(t *testing.T) {
	t.Parallel()

	currentSourceType := int(kbentity.SourceTypeEnterpriseWiki)
	inputSourceType := int(kbentity.SourceTypeLocalFile)
	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	svc.SetKnowledgeBaseBindingRepository(sourceTypeTestKnowledgeBaseBindingRepository{})

	command, err := kbapp.NormalizeUpdateCommandForTest(context.Background(), svc, &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Code:             "KB-1",
		SourceType:       &inputSourceType,
		SourceBindings:   &[]kbdto.SourceBindingInput{enterpriseBindingInput("TS-KB-8")},
	}, &kbentity.KnowledgeBase{
		Code:              "KB-1",
		KnowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector,
		SourceType:        &currentSourceType,
	})
	if err != nil {
		t.Fatalf("NormalizeUpdateCommandForTest returned error: %v", err)
	}
	if command.SourceType != nil {
		t.Fatalf("expected update to ignore source_type patch, got %#v", command.SourceType)
	}
	assertSourceType(t, command.ValidationSourceType, int(kbentity.SourceTypeEnterpriseWiki))
}

func mustNormalizeCreateCommand(t *testing.T, input *kbdto.CreateKnowledgeBaseInput) *kbapp.NormalizedCreateCommandForTest {
	t.Helper()

	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	command, err := kbapp.NormalizeCreateCommandForTest(context.Background(), svc, input)
	if err != nil {
		t.Fatalf("NormalizeCreateCommandForTest returned error: %v", err)
	}
	return command
}

func localBindingInput(rootRef string) kbdto.SourceBindingInput {
	return kbdto.SourceBindingInput{
		Provider: sourcebindingdomain.ProviderLocalUpload,
		RootType: sourcebindingdomain.RootTypeFile,
		RootRef:  rootRef,
	}
}

func enterpriseBindingInput(rootRef string) kbdto.SourceBindingInput {
	return kbdto.SourceBindingInput{
		Provider: sourcebindingdomain.ProviderTeamshare,
		RootType: sourcebindingdomain.RootTypeKnowledgeBase,
		RootRef:  rootRef,
		SyncMode: sourcebindingdomain.SyncModeManual,
	}
}

func assertSourceType(t *testing.T, sourceType *int, expected int) {
	t.Helper()
	if sourceType == nil || *sourceType != expected {
		t.Fatalf("expected source_type=%d, got %#v", expected, sourceType)
	}
}

type sourceTypeTestThirdPlatformExpander struct {
	files []*docentity.File
}

func (e sourceTypeTestThirdPlatformExpander) Expand(context.Context, string, string, []map[string]any) ([]*docentity.File, error) {
	return append([]*docentity.File(nil), e.files...), nil
}

func (sourceTypeTestThirdPlatformExpander) Resolve(context.Context, thirdplatform.DocumentResolveInput) (*thirdplatform.DocumentResolveResult, error) {
	return &thirdplatform.DocumentResolveResult{}, nil
}

func (sourceTypeTestThirdPlatformExpander) ListKnowledgeBases(context.Context, thirdplatform.KnowledgeBaseListInput) ([]thirdplatform.KnowledgeBaseItem, error) {
	return nil, nil
}

func (sourceTypeTestThirdPlatformExpander) ListTreeNodes(context.Context, thirdplatform.TreeNodeListInput) ([]thirdplatform.TreeNode, error) {
	return nil, nil
}

type sourceTypeTestSuperMagicAgentReader struct {
	codes map[string]struct{}
}

func (r sourceTypeTestSuperMagicAgentReader) ListExistingCodesByOrg(context.Context, string, []string) (map[string]struct{}, error) {
	result := make(map[string]struct{}, len(r.codes))
	for code := range r.codes {
		result[code] = struct{}{}
	}
	return result, nil
}

type sourceTypeTestSuperMagicAgentAccessChecker struct {
	codes map[string]struct{}
}

func (c sourceTypeTestSuperMagicAgentAccessChecker) ListManageableCodes(context.Context, string, string, []string) (map[string]struct{}, error) {
	result := make(map[string]struct{}, len(c.codes))
	for code := range c.codes {
		result[code] = struct{}{}
	}
	return result, nil
}

type sourceTypeTestKnowledgeBaseBindingRepository struct {
	agentCodesByKnowledgeBase map[string][]string
}

func (r sourceTypeTestKnowledgeBaseBindingRepository) ReplaceBindings(
	context.Context,
	string,
	kbentity.BindingType,
	string,
	string,
	[]string,
) ([]string, error) {
	return []string{}, nil
}

func (r sourceTypeTestKnowledgeBaseBindingRepository) ListBindIDsByKnowledgeBase(
	_ context.Context,
	knowledgeBaseCode string,
	_ kbentity.BindingType,
) ([]string, error) {
	return append([]string(nil), r.agentCodesByKnowledgeBase[knowledgeBaseCode]...), nil
}

func (r sourceTypeTestKnowledgeBaseBindingRepository) ListBindIDsByKnowledgeBases(
	_ context.Context,
	knowledgeBaseCodes []string,
	_ kbentity.BindingType,
) (map[string][]string, error) {
	result := make(map[string][]string, len(knowledgeBaseCodes))
	for _, knowledgeBaseCode := range knowledgeBaseCodes {
		result[knowledgeBaseCode] = append([]string(nil), r.agentCodesByKnowledgeBase[knowledgeBaseCode]...)
	}
	return result, nil
}

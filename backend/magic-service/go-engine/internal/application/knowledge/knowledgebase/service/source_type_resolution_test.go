package kbapp_test

import (
	"context"
	"errors"
	"testing"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	kbapp "magic/internal/application/knowledge/knowledgebase/service"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/service"
)

func TestNormalizeCreateCommandForTestFlowDefaultsLocalWithoutBindings(t *testing.T) {
	t.Parallel()

	command := mustNormalizeCreateCommand(t, &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
	})
	assertSourceType(t, command.SourceType, int(knowledgebasedomain.SourceTypeLocalFile))
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
	assertSourceType(t, command.SourceType, int(knowledgebasedomain.SourceTypeLocalFile))
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
	assertSourceType(t, command.SourceType, int(knowledgebasedomain.SourceTypeLegacyEnterpriseWiki))
}

func TestNormalizeCreateCommandForTestFlowAcceptsExplicitEnterpriseSourceTypeWithoutAgentCodes(t *testing.T) {
	t.Parallel()

	command := mustNormalizeCreateCommand(t, &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		SourceType: func() *int {
			value := int(knowledgebasedomain.SourceTypeLegacyEnterpriseWiki)
			return &value
		}(),
		SourceBindings: []kbdto.SourceBindingInput{
			enterpriseBindingInput("TS-KB-3"),
		},
	})
	assertSourceType(t, command.SourceType, int(knowledgebasedomain.SourceTypeLegacyEnterpriseWiki))
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
	if !errors.Is(err, knowledgebasedomain.ErrAmbiguousFlowSourceType) {
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
	if !errors.Is(err, knowledgebasedomain.ErrDigitalEmployeeSourceTypeRequired) {
		t.Fatalf("expected ErrDigitalEmployeeSourceTypeRequired, got %v", err)
	}
}

func TestNormalizeCreateCommandForTestDigitalEmployeeRejectsFlowEnterpriseSourceType(t *testing.T) {
	t.Parallel()

	sourceType := int(knowledgebasedomain.SourceTypeLegacyEnterpriseWiki)
	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	svc.SetSuperMagicAgentReader(sourceTypeTestSuperMagicAgentReader{codes: map[string]struct{}{"SMA-1": {}}})
	svc.SetSuperMagicAgentAccessChecker(sourceTypeTestSuperMagicAgentAccessChecker{codes: map[string]struct{}{"SMA-1": {}}})

	_, err := kbapp.NormalizeCreateCommandForTest(context.Background(), svc, &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		AgentCodes:       []string{"SMA-1"},
		SourceType:       &sourceType,
	})
	if !errors.Is(err, knowledgebasedomain.ErrInvalidSourceType) {
		t.Fatalf("expected ErrInvalidSourceType, got %v", err)
	}
}

func TestNormalizeUpdateCommandForTestDigitalEmployeeRequiresSourceType(t *testing.T) {
	t.Parallel()

	sourceType := int(knowledgebasedomain.SourceTypeLocalFile)
	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	svc.SetKnowledgeBaseBindingRepository(sourceTypeTestKnowledgeBaseBindingRepository{
		agentCodesByKnowledgeBase: map[string][]string{"KB-1": {"SMA-1"}},
	})

	_, err := kbapp.NormalizeUpdateCommandForTest(context.Background(), svc, &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Code:             "KB-1",
	}, &knowledgebasedomain.KnowledgeBase{
		Code:              "KB-1",
		KnowledgeBaseType: knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee,
		SourceType:        &sourceType,
	})
	if !errors.Is(err, knowledgebasedomain.ErrDigitalEmployeeSourceTypeRequired) {
		t.Fatalf("expected ErrDigitalEmployeeSourceTypeRequired, got %v", err)
	}
}

func TestNormalizeUpdateCommandForTestFlowRejectsDigitalEnterpriseSourceType(t *testing.T) {
	t.Parallel()

	sourceType := int(knowledgebasedomain.SourceTypeEnterpriseWiki)
	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	svc.SetKnowledgeBaseBindingRepository(sourceTypeTestKnowledgeBaseBindingRepository{})

	_, err := kbapp.NormalizeUpdateCommandForTest(context.Background(), svc, &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Code:             "KB-1",
		SourceType:       &sourceType,
	}, &knowledgebasedomain.KnowledgeBase{
		Code:              "KB-1",
		KnowledgeBaseType: knowledgebasedomain.KnowledgeBaseTypeFlowVector,
	})
	if !errors.Is(err, knowledgebasedomain.ErrInvalidSourceType) {
		t.Fatalf("expected ErrInvalidSourceType, got %v", err)
	}
}

func TestNormalizeUpdateCommandForTestDigitalEmployeeRejectsFlowEnterpriseSourceType(t *testing.T) {
	t.Parallel()

	currentSourceType := int(knowledgebasedomain.SourceTypeLocalFile)
	inputSourceType := int(knowledgebasedomain.SourceTypeLegacyEnterpriseWiki)
	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	svc.SetKnowledgeBaseBindingRepository(sourceTypeTestKnowledgeBaseBindingRepository{
		agentCodesByKnowledgeBase: map[string][]string{"KB-1": {"SMA-1"}},
	})

	_, err := kbapp.NormalizeUpdateCommandForTest(context.Background(), svc, &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Code:             "KB-1",
		SourceType:       &inputSourceType,
	}, &knowledgebasedomain.KnowledgeBase{
		Code:              "KB-1",
		KnowledgeBaseType: knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee,
		SourceType:        &currentSourceType,
	})
	if !errors.Is(err, knowledgebasedomain.ErrInvalidSourceType) {
		t.Fatalf("expected ErrInvalidSourceType, got %v", err)
	}
}

func TestNormalizeUpdateCommandForTestFlowInfersEnterpriseFromNewBindings(t *testing.T) {
	t.Parallel()

	inputBindings := []kbdto.SourceBindingInput{enterpriseBindingInput("TS-KB-5")}
	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	svc.SetKnowledgeBaseBindingRepository(sourceTypeTestKnowledgeBaseBindingRepository{})

	command, err := kbapp.NormalizeUpdateCommandForTest(context.Background(), svc, &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Code:             "KB-1",
		SourceBindings:   &inputBindings,
	}, &knowledgebasedomain.KnowledgeBase{
		Code:              "KB-1",
		KnowledgeBaseType: knowledgebasedomain.KnowledgeBaseTypeFlowVector,
	})
	if err != nil {
		t.Fatalf("NormalizeUpdateCommandForTest returned error: %v", err)
	}
	assertSourceType(t, command.SourceType, int(knowledgebasedomain.SourceTypeLegacyEnterpriseWiki))
}

func TestNormalizeUpdateCommandForTestFlowInfersEnterpriseFromExistingBindings(t *testing.T) {
	t.Parallel()

	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	svc.SetKnowledgeBaseBindingRepository(sourceTypeTestKnowledgeBaseBindingRepository{})
	svc.SetSourceBindingRepository(sourceTypeTestSourceBindingRepository{
		bindings: []sourcebindingdomain.Binding{enterpriseBinding("TS-KB-6")},
	})

	command, err := kbapp.NormalizeUpdateCommandForTest(context.Background(), svc, &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Code:             "KB-1",
	}, &knowledgebasedomain.KnowledgeBase{
		Code:              "KB-1",
		KnowledgeBaseType: knowledgebasedomain.KnowledgeBaseTypeFlowVector,
	})
	if err != nil {
		t.Fatalf("NormalizeUpdateCommandForTest returned error: %v", err)
	}
	assertSourceType(t, command.SourceType, int(knowledgebasedomain.SourceTypeLegacyEnterpriseWiki))
}

func TestNormalizeUpdateCommandForTestFlowRejectsMixedExistingBindings(t *testing.T) {
	t.Parallel()

	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	svc.SetKnowledgeBaseBindingRepository(sourceTypeTestKnowledgeBaseBindingRepository{})
	svc.SetSourceBindingRepository(sourceTypeTestSourceBindingRepository{
		bindings: []sourcebindingdomain.Binding{
			localBinding("ORG-1/doc.md"),
			enterpriseBinding("TS-KB-7"),
		},
	})

	_, err := kbapp.NormalizeUpdateCommandForTest(context.Background(), svc, &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Code:             "KB-1",
	}, &knowledgebasedomain.KnowledgeBase{
		Code:              "KB-1",
		KnowledgeBaseType: knowledgebasedomain.KnowledgeBaseTypeFlowVector,
	})
	if !errors.Is(err, knowledgebasedomain.ErrAmbiguousFlowSourceType) {
		t.Fatalf("expected ErrAmbiguousFlowSourceType, got %v", err)
	}
}

func TestNormalizeUpdateCommandForTestFlowFallsBackToCurrentSourceType(t *testing.T) {
	t.Parallel()

	currentSourceType := int(knowledgebasedomain.SourceTypeEnterpriseWiki)
	svc := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	svc.SetKnowledgeBaseBindingRepository(sourceTypeTestKnowledgeBaseBindingRepository{})

	command, err := kbapp.NormalizeUpdateCommandForTest(context.Background(), svc, &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Code:             "KB-1",
	}, &knowledgebasedomain.KnowledgeBase{
		Code:              "KB-1",
		KnowledgeBaseType: knowledgebasedomain.KnowledgeBaseTypeFlowVector,
		SourceType:        &currentSourceType,
	})
	if err != nil {
		t.Fatalf("NormalizeUpdateCommandForTest returned error: %v", err)
	}
	assertSourceType(t, command.SourceType, int(knowledgebasedomain.SourceTypeLegacyEnterpriseWiki))
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

func localBinding(rootRef string) sourcebindingdomain.Binding {
	return sourcebindingdomain.Binding{
		Provider: sourcebindingdomain.ProviderLocalUpload,
		RootType: sourcebindingdomain.RootTypeFile,
		RootRef:  rootRef,
	}
}

func enterpriseBinding(rootRef string) sourcebindingdomain.Binding {
	return sourcebindingdomain.Binding{
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
	knowledgebasedomain.BindingType,
	string,
	string,
	[]string,
) ([]string, error) {
	return []string{}, nil
}

func (r sourceTypeTestKnowledgeBaseBindingRepository) ListBindIDsByKnowledgeBase(
	_ context.Context,
	knowledgeBaseCode string,
	_ knowledgebasedomain.BindingType,
) ([]string, error) {
	return append([]string(nil), r.agentCodesByKnowledgeBase[knowledgeBaseCode]...), nil
}

func (r sourceTypeTestKnowledgeBaseBindingRepository) ListBindIDsByKnowledgeBases(
	_ context.Context,
	knowledgeBaseCodes []string,
	_ knowledgebasedomain.BindingType,
) (map[string][]string, error) {
	result := make(map[string][]string, len(knowledgeBaseCodes))
	for _, knowledgeBaseCode := range knowledgeBaseCodes {
		result[knowledgeBaseCode] = append([]string(nil), r.agentCodesByKnowledgeBase[knowledgeBaseCode]...)
	}
	return result, nil
}

type sourceTypeTestSourceBindingRepository struct {
	bindings []sourcebindingdomain.Binding
}

func (r sourceTypeTestSourceBindingRepository) ReplaceBindings(
	context.Context,
	string,
	[]sourcebindingdomain.Binding,
) ([]sourcebindingdomain.Binding, error) {
	return append([]sourcebindingdomain.Binding(nil), r.bindings...), nil
}

func (r sourceTypeTestSourceBindingRepository) SaveBindings(
	context.Context,
	string,
	[]sourcebindingdomain.Binding,
) ([]sourcebindingdomain.Binding, error) {
	return append([]sourcebindingdomain.Binding(nil), r.bindings...), nil
}

func (r sourceTypeTestSourceBindingRepository) DeleteBindingsByKnowledgeBase(context.Context, string) error {
	return nil
}

func (r sourceTypeTestSourceBindingRepository) ListBindingsByKnowledgeBase(context.Context, string) ([]sourcebindingdomain.Binding, error) {
	return append([]sourcebindingdomain.Binding(nil), r.bindings...), nil
}

func (r sourceTypeTestSourceBindingRepository) UpsertSourceItem(
	context.Context,
	sourcebindingdomain.SourceItem,
) (*sourcebindingdomain.SourceItem, error) {
	item := sourcebindingdomain.SourceItem{}
	return &item, nil
}

func (r sourceTypeTestSourceBindingRepository) ReplaceBindingItems(
	context.Context,
	int64,
	[]sourcebindingdomain.BindingItem,
) error {
	return nil
}

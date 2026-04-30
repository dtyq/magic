package sourcebinding_test

import (
	"context"
	"errors"
	"maps"
	"testing"

	sourcebinding "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingservice "magic/internal/domain/knowledge/sourcebinding/service"
	thirdfilemappingpkg "magic/internal/pkg/thirdfilemapping"
)

type repairKnowledgeBaseLoaderStub struct {
	result *sourcebindingservice.RepairKnowledgeBase
	err    error
}

func (s *repairKnowledgeBaseLoaderStub) LoadRepairKnowledgeBase(
	context.Context,
	string,
	string,
) (*sourcebindingservice.RepairKnowledgeBase, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.result, nil
}

type repairBindingRepositoryStub struct {
	listBindings     []sourcebinding.Binding
	replacedBindings []sourcebinding.Binding
	savedBindings    []sourcebinding.Binding
}

func (s *repairBindingRepositoryStub) ListBindingsByKnowledgeBase(
	context.Context,
	string,
) ([]sourcebinding.Binding, error) {
	return append([]sourcebinding.Binding(nil), s.listBindings...), nil
}

func (s *repairBindingRepositoryStub) ReplaceBindings(
	_ context.Context,
	_ string,
	bindings []sourcebinding.Binding,
) ([]sourcebinding.Binding, error) {
	s.replacedBindings = append([]sourcebinding.Binding(nil), bindings...)
	result := make([]sourcebinding.Binding, 0, len(bindings))
	for idx, binding := range bindings {
		cloned := binding
		cloned.ID = int64(idx + 1)
		result = append(result, cloned)
	}
	return result, nil
}

func (s *repairBindingRepositoryStub) SaveBindings(
	_ context.Context,
	_ string,
	bindings []sourcebinding.Binding,
) ([]sourcebinding.Binding, error) {
	s.savedBindings = append([]sourcebinding.Binding(nil), bindings...)
	result := make([]sourcebinding.Binding, 0, len(bindings))
	for idx, binding := range bindings {
		cloned := binding
		cloned.ID = int64(idx + 1)
		result = append(result, cloned)
	}
	return result, nil
}

type repairDocumentStoreStub struct {
	preExistingDocCodes map[string]string
	currentDocCodes     map[string]string
	destroyCalls        []repairDestroyKnowledgeBaseDocumentsCall
	listCalls           int
}

type repairDestroyKnowledgeBaseDocumentsCall struct {
	knowledgeBaseCode string
	organizationCode  string
}

func (s *repairDocumentStoreStub) ListManagedDocumentCodeByThirdFile(
	context.Context,
	string,
	string,
) (map[string]string, error) {
	s.listCalls++
	if s.listCalls == 1 {
		return cloneRepairDocumentCodeMap(s.preExistingDocCodes), nil
	}
	return cloneRepairDocumentCodeMap(s.currentDocCodes), nil
}

func (s *repairDocumentStoreStub) DestroyKnowledgeBaseDocuments(
	_ context.Context,
	knowledgeBaseCode string,
	organizationCode string,
) error {
	s.destroyCalls = append(s.destroyCalls, repairDestroyKnowledgeBaseDocumentsCall{
		knowledgeBaseCode: knowledgeBaseCode,
		organizationCode:  organizationCode,
	})
	return nil
}

type repairMaterializerStub struct {
	lastInput sourcebindingservice.MaterializationInput
	result    int
}

func (s *repairMaterializerStub) Materialize(
	_ context.Context,
	input sourcebindingservice.MaterializationInput,
) (int, error) {
	s.lastInput = input
	return s.result, nil
}

type repairBackfillerStub struct {
	rows      map[string]int64
	errByFile map[string]error
	inputs    []sourcebindingservice.RepairBackfillInput
}

var errRepairBackfillFailed = errors.New("backfill failed")

func (s *repairBackfillerStub) BackfillDocumentCodeByThirdFile(
	_ context.Context,
	input sourcebindingservice.RepairBackfillInput,
) (int64, error) {
	s.inputs = append(s.inputs, input)
	if err := s.errByFile[input.ThirdFileID]; err != nil {
		return 0, err
	}
	return s.rows[input.ThirdFileID], nil
}

func TestRepairServiceReplacesBindingsAndRebuildsLegacyDocuments(t *testing.T) {
	t.Parallel()

	repo := &repairBindingRepositoryStub{}
	documents := &repairDocumentStoreStub{
		currentDocCodes: map[string]string{"FILE-1": "DOC-NEW"},
	}
	materializer := &repairMaterializerStub{result: 1}
	backfiller := &repairBackfillerStub{
		rows: map[string]int64{"FILE-1": 2},
	}

	svc := sourcebindingservice.NewRepairService(
		&repairKnowledgeBaseLoaderStub{
			result: &sourcebindingservice.RepairKnowledgeBase{
				Code:             "KB-1",
				OrganizationCode: "ORG-1",
				CreatedUID:       "owner-1",
				UpdatedUID:       "editor-1",
			},
		},
		repo,
		documents,
		materializer,
		backfiller,
	)

	result, err := svc.RepairKnowledge(context.Background(), sourcebindingservice.RepairKnowledgeInput{
		OrganizationCode:  "ORG-1",
		KnowledgeBaseCode: "KB-1",
		UserID:            "user-1",
		ThirdPlatformType: sourcebinding.ProviderTeamshare,
		Groups: []thirdfilemappingpkg.RepairGroup{{
			ThirdFileID:              "FILE-1",
			KnowledgeBaseID:          "TS-KB-1",
			MissingDocumentCodeCount: 2,
		}},
	})
	if err != nil {
		t.Fatalf("RepairKnowledge returned error: %v", err)
	}
	if result.CandidateBindings != 1 || result.AddedBindings != 1 || result.MaterializedDocs != 1 || result.BackfilledRows != 2 {
		t.Fatalf("unexpected repair result: %#v", result)
	}
	if len(repo.replacedBindings) != 1 || repo.replacedBindings[0].RootType != sourcebinding.RootTypeKnowledgeBase {
		t.Fatalf("expected knowledge-base replace binding, got %#v", repo.replacedBindings)
	}
	if len(documents.destroyCalls) != 1 ||
		documents.destroyCalls[0].knowledgeBaseCode != "KB-1" ||
		documents.destroyCalls[0].organizationCode != "ORG-1" {
		t.Fatalf("expected legacy documents destroyed before materialize, got %#v", documents.destroyCalls)
	}
	if materializer.lastInput.KnowledgeBaseUserID != "editor-1" || materializer.lastInput.KnowledgeBaseOwner != "owner-1" {
		t.Fatalf("unexpected materialization input: %#v", materializer.lastInput)
	}
	if len(backfiller.inputs) != 1 || backfiller.inputs[0].DocumentCode != "DOC-NEW" {
		t.Fatalf("expected backfill to use rebuilt doc code, got %#v", backfiller.inputs)
	}
}

func TestRepairServiceAppendsBindingsAndCollectsSoftFailures(t *testing.T) {
	t.Parallel()

	repo := &repairBindingRepositoryStub{
		listBindings: []sourcebinding.Binding{{
			ID:       9,
			Provider: sourcebinding.ProviderTeamshare,
			RootType: sourcebinding.RootTypeFile,
			RootRef:  "FILE-EXIST",
			Enabled:  true,
			SyncMode: sourcebinding.SyncModeManual,
		}},
	}
	documents := &repairDocumentStoreStub{
		preExistingDocCodes: map[string]string{"FILE-EXIST": "DOC-EXIST"},
		currentDocCodes: map[string]string{
			"FILE-EXIST": "DOC-EXIST",
			"FILE-NEW":   "DOC-NEW",
		},
	}
	materializer := &repairMaterializerStub{result: 1}
	backfiller := &repairBackfillerStub{
		rows:      map[string]int64{"FILE-EXIST": 1},
		errByFile: map[string]error{"FILE-NEW": errRepairBackfillFailed},
	}

	svc := sourcebindingservice.NewRepairService(
		&repairKnowledgeBaseLoaderStub{
			result: &sourcebindingservice.RepairKnowledgeBase{
				Code:             "KB-1",
				OrganizationCode: "ORG-1",
			},
		},
		repo,
		documents,
		materializer,
		backfiller,
	)

	result, err := svc.RepairKnowledge(context.Background(), sourcebindingservice.RepairKnowledgeInput{
		OrganizationCode:  "ORG-1",
		KnowledgeBaseCode: "KB-1",
		UserID:            "user-1",
		ThirdPlatformType: sourcebinding.ProviderTeamshare,
		Groups: []thirdfilemappingpkg.RepairGroup{
			{ThirdFileID: "FILE-EXIST", MissingDocumentCodeCount: 1},
			{ThirdFileID: "FILE-NEW", MissingDocumentCodeCount: 1},
			{ThirdFileID: "FILE-NO-DOC", MissingDocumentCodeCount: 1},
		},
	})
	if err != nil {
		t.Fatalf("RepairKnowledge returned error: %v", err)
	}
	if result.CandidateBindings != 2 || result.AddedBindings != 2 || result.BackfilledRows != 1 || result.ReusedDocuments != 1 {
		t.Fatalf("unexpected repair result: %#v", result)
	}
	if len(repo.savedBindings) != 2 || repo.savedBindings[0].RootRef != "FILE-NEW" || repo.savedBindings[1].RootRef != "FILE-NO-DOC" {
		t.Fatalf("expected appended file bindings, got %#v", repo.savedBindings)
	}
	if len(documents.destroyCalls) != 0 {
		t.Fatalf("expected append path not to destroy legacy docs, got %#v", documents.destroyCalls)
	}
	if len(result.Failures) != 2 {
		t.Fatalf("expected two soft failures, got %#v", result.Failures)
	}
	if result.Failures[0].ThirdFileID != "FILE-NEW" || !errors.Is(result.Failures[0].Err, errRepairBackfillFailed) {
		t.Fatalf("expected FILE-NEW backfill failure, got %#v", result.Failures[0])
	}
	if result.Failures[1].ThirdFileID != "FILE-NO-DOC" || !errors.Is(result.Failures[1].Err, sourcebindingservice.ErrRepairSourceBindingDocumentNotMapped) {
		t.Fatalf("expected FILE-NO-DOC mapping failure, got %#v", result.Failures[1])
	}
}

func cloneRepairDocumentCodeMap(input map[string]string) map[string]string {
	if len(input) == 0 {
		return map[string]string{}
	}
	output := make(map[string]string, len(input))
	maps.Copy(output, input)
	return output
}

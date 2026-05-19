package service_test

import (
	"context"
	"testing"

	revectorizeapp "magic/internal/application/knowledge/revectorize/service"
	revectorizeshared "magic/internal/application/knowledge/shared/revectorize"
	documentdomain "magic/internal/domain/knowledge/document/service"
)

const testKnowledgeCode = "KB-teamshare-1"

func TestKnowledgeRevectorizeAppServiceTeamshareStartVectorSchedulesManagedDocuments(t *testing.T) {
	t.Parallel()

	kbSupport := &knowledgeBaseSupportStub{
		prepareResult: &revectorizeshared.TeamshareStartResult{KnowledgeCode: testKnowledgeCode},
		managedDocuments: []*revectorizeshared.ManagedDocument{
			{Code: "DOC-1"},
			{Code: "DOC-2"},
		},
	}
	documentSupport := &documentSupportStub{}
	progressStore := &progressStoreStub{
		startResult: &revectorizeshared.SessionProgress{
			KnowledgeBaseCode: testKnowledgeCode,
			SessionID:         "SESSION-1",
			ExpectedNum:       2,
			CompletedNum:      0,
		},
	}

	svc := revectorizeapp.NewKnowledgeRevectorizeAppService(kbSupport, documentSupport, progressStore, nil)
	result, err := svc.TeamshareStartVector(context.Background(), &revectorizeshared.TeamshareStartInput{
		OrganizationCode: "ORG-1",
		UserID:           "USER-1",
		KnowledgeID:      "TS-1",
	})
	if err != nil {
		t.Fatalf("TeamshareStartVector returned error: %v", err)
	}
	if result == nil || result.KnowledgeCode != testKnowledgeCode || result.ID != testKnowledgeCode {
		t.Fatalf("unexpected result: %#v", result)
	}
	if kbSupport.lastPrepareInput == nil || kbSupport.lastPrepareInput.KnowledgeID != "TS-1" {
		t.Fatalf("expected prepare called with teamshare input, got %#v", kbSupport.lastPrepareInput)
	}
	assertTeamshareStartVectorSessionState(t, progressStore.startDocumentCodes, kbSupport.lastSaveProcess)
	assertTeamshareScheduledInputs(t, documentSupport.inputs)
}

func TestKnowledgeRevectorizeAppServiceTeamshareStartVectorHandlesEmptyKnowledgeBase(t *testing.T) {
	t.Parallel()

	kbSupport := &knowledgeBaseSupportStub{
		prepareResult:    &revectorizeshared.TeamshareStartResult{KnowledgeCode: "KB-empty"},
		managedDocuments: nil,
	}
	documentSupport := &documentSupportStub{}
	progressStore := &progressStoreStub{
		startResult: &revectorizeshared.SessionProgress{
			KnowledgeBaseCode: "KB-empty",
			SessionID:         "SESSION-EMPTY",
			ExpectedNum:       0,
			CompletedNum:      0,
		},
	}

	svc := revectorizeapp.NewKnowledgeRevectorizeAppService(kbSupport, documentSupport, progressStore, nil)
	result, err := svc.TeamshareStartVector(context.Background(), &revectorizeshared.TeamshareStartInput{
		OrganizationCode: "ORG-1",
		UserID:           "USER-1",
		KnowledgeID:      "TS-EMPTY",
	})
	if err != nil {
		t.Fatalf("TeamshareStartVector returned error: %v", err)
	}
	if result == nil || result.ID != "KB-empty" {
		t.Fatalf("unexpected result: %#v", result)
	}
	if kbSupport.lastSaveProcess == nil || kbSupport.lastSaveProcess.ExpectedNum != 0 || kbSupport.lastSaveProcess.CompletedNum != 0 {
		t.Fatalf("unexpected save process input: %#v", kbSupport.lastSaveProcess)
	}
	if len(documentSupport.inputs) != 0 {
		t.Fatalf("expected no scheduled inputs for empty knowledge base, got %#v", documentSupport.inputs)
	}
}

func assertTeamshareStartVectorSessionState(
	t *testing.T,
	documentCodes []string,
	saveProcess *revectorizeshared.SaveProcessInput,
) {
	t.Helper()

	if len(documentCodes) != 2 || documentCodes[0] != "DOC-1" || documentCodes[1] != "DOC-2" {
		t.Fatalf("unexpected progress session document codes: %#v", documentCodes)
	}
	if saveProcess == nil || saveProcess.Code != testKnowledgeCode || saveProcess.ExpectedNum != 2 || saveProcess.CompletedNum != 0 {
		t.Fatalf("unexpected save process input: %#v", saveProcess)
	}
}

func assertTeamshareScheduledInputs(t *testing.T, inputs []*documentdomain.SyncDocumentInput) {
	t.Helper()

	if len(inputs) != 2 {
		t.Fatalf("expected two scheduled document tasks, got %#v", inputs)
	}
	for _, input := range inputs {
		if input.Mode != documentdomain.SyncModeResync || !input.Async || !input.SingleDocumentThirdPlatformResync {
			t.Fatalf("unexpected scheduled sync input: %#v", input)
		}
		if input.RevectorizeSource != documentdomain.RevectorizeSourceTeamshareKnowledgeStartVector {
			t.Fatalf("unexpected revectorize source: %#v", input)
		}
		if input.RevectorizeSessionID != "SESSION-1" {
			t.Fatalf("expected session id SESSION-1, got %#v", input)
		}
	}
}

type knowledgeBaseSupportStub struct {
	prepareResult    *revectorizeshared.TeamshareStartResult
	prepareErr       error
	managedDocuments []*revectorizeshared.ManagedDocument
	managedErr       error
	saveProcessErr   error

	lastPrepareInput *revectorizeshared.TeamshareStartInput
	lastSaveProcess  *revectorizeshared.SaveProcessInput
}

func (s *knowledgeBaseSupportStub) PrepareTeamshareKnowledgeRevectorize(
	_ context.Context,
	input *revectorizeshared.TeamshareStartInput,
) (*revectorizeshared.TeamshareStartResult, error) {
	s.lastPrepareInput = input
	return s.prepareResult, s.prepareErr
}

func (s *knowledgeBaseSupportStub) ListManagedDocumentsForKnowledgeBase(
	_ context.Context,
	_ string,
) ([]*revectorizeshared.ManagedDocument, error) {
	return s.managedDocuments, s.managedErr
}

func (s *knowledgeBaseSupportStub) SaveRevectorizeProgress(
	_ context.Context,
	input *revectorizeshared.SaveProcessInput,
) error {
	s.lastSaveProcess = input
	return s.saveProcessErr
}

type documentSupportStub struct {
	inputs []*documentdomain.SyncDocumentInput
}

func (s *documentSupportStub) ScheduleSync(_ context.Context, input *documentdomain.SyncDocumentInput) {
	s.inputs = append(s.inputs, input)
}

type progressStoreStub struct {
	startResult        *revectorizeshared.SessionProgress
	startErr           error
	startDocumentCodes []string
}

func (s *progressStoreStub) StartSession(
	_ context.Context,
	_ string,
	_ string,
	documentCodes []string,
) (*revectorizeshared.SessionProgress, error) {
	s.startDocumentCodes = append([]string(nil), documentCodes...)
	return s.startResult, s.startErr
}

func (s *progressStoreStub) AdvanceDocument(
	context.Context,
	string,
	string,
	string,
	func(*revectorizeshared.SessionProgress) error,
) (bool, error) {
	return false, nil
}

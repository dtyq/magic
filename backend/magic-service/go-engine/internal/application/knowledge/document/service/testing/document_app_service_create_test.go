package docapp_test

import (
	"context"
	"errors"
	"testing"

	docdto "magic/internal/application/knowledge/document/dto"
	appservice "magic/internal/application/knowledge/document/service"
	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	shared "magic/internal/domain/knowledge/shared"
)

const (
	customContentOrgCode       = "ORG1"
	customContentUserID        = "USER1"
	customContentKnowledgeCode = "KB1"
	customContentFileName      = "custom-content.md"
	customContentFileKey       = "DT001/open/demo/custom-content.md"
)

func TestDocumentAppServiceCreateUsesFragmentConfigAndSchedulesSync(t *testing.T) {
	t.Parallel()

	domain := &documentDomainServiceStub{}
	scheduler := &documentSyncSchedulerStub{}
	svc := appservice.NewDocumentAppServiceForTest(t,
		domain,
		newCustomContentKnowledgeBaseReader(),
		scheduler,
	)

	result, err := svc.Create(context.Background(), newCustomContentCreateInput())
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil {
		t.Fatal("expected result not nil")
	}
	if len(domain.savedDocs) != 1 {
		t.Fatalf("expected one saved document, got %d", len(domain.savedDocs))
	}

	assertCreatedManagedDocument(t, domain.savedDocs[0])
	assertCreateScheduledSync(t, scheduler)
}

func TestDocumentAppServiceCreateSaveError(t *testing.T) {
	t.Parallel()

	svc := appservice.NewDocumentAppServiceForTest(t,
		&documentDomainServiceStub{saveErr: errDocumentUpdateFailed},
		newCustomContentKnowledgeBaseReader(),
		nil,
	)

	_, err := svc.Create(context.Background(), newCustomContentCreateInput())
	if !errors.Is(err, errDocumentUpdateFailed) {
		t.Fatalf("expected save error, got %v", err)
	}
}

func TestDocumentCreate_AutoSyncSchedulesBackgroundSync(t *testing.T) {
	t.Parallel()

	scheduler := &documentSyncSchedulerStub{}
	svc := appservice.NewDocumentAppServiceForTest(t,
		&documentDomainServiceStub{},
		&knowledgeBaseReaderStub{
			showByCodeAndOrgResult: &kbentity.KnowledgeBase{
				Code:     "KB1",
				Model:    "text-embedding-3-small",
				VectorDB: "odin_qdrant",
			},
		},
		scheduler,
	)

	documentDTO, err := svc.Create(context.Background(), &docdto.CreateDocumentInput{
		OrganizationCode:  "DT001",
		UserID:            "usi_test",
		KnowledgeBaseCode: "KB1",
		Name:              "doc-1.md",
		DocumentFile:      &docfilehelper.DocumentFileDTO{Name: "doc-1.md", Key: "org/doc-1.md", URL: "org/doc-1.md"},
		AutoSync:          true,
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if documentDTO == nil || documentDTO.Code == "" {
		t.Fatalf("expected created document dto, got %#v", documentDTO)
	}
	if scheduler.scheduleCalls != 1 || len(scheduler.inputs) != 1 {
		t.Fatalf("expected one scheduled input, got calls=%d inputs=%d", scheduler.scheduleCalls, len(scheduler.inputs))
	}
	if scheduler.inputs[0].Mode != documentdomain.SyncModeCreate {
		t.Fatalf("expected sync mode=create, got %q", scheduler.inputs[0].Mode)
	}
	if !scheduler.inputs[0].Async {
		t.Fatalf("expected scheduled create sync to be async, got %#v", scheduler.inputs[0])
	}
	if scheduler.inputs[0].Code != documentDTO.Code {
		t.Fatalf("expected scheduled code %q, got %q", documentDTO.Code, scheduler.inputs[0].Code)
	}
}

func TestDocumentCreate_WaitForSyncResultStillSchedulesBackgroundSync(t *testing.T) {
	t.Parallel()

	domain := &documentDomainServiceStub{}
	scheduler := &documentSyncSchedulerStub{}
	fragmentSvc := &fragmentDestroyServiceStub{}
	svc := appservice.NewDocumentAppServiceForTest(
		t,
		domain,
		newCustomContentKnowledgeBaseReader(),
		scheduler,
		fragmentSvc,
	)

	input := newCustomContentCreateInput()
	input.WaitForSyncResult = true

	documentDTO, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if documentDTO == nil {
		t.Fatal("expected created document dto")
	}
	if scheduler.scheduleCalls != 1 || len(scheduler.inputs) != 1 {
		t.Fatalf("expected wait-for-sync create to schedule background work, got calls=%d inputs=%d", scheduler.scheduleCalls, len(scheduler.inputs))
	}
	if !scheduler.inputs[0].Async || scheduler.inputs[0].Mode != documentdomain.SyncModeCreate {
		t.Fatalf("unexpected scheduled sync input: %#v", scheduler.inputs[0])
	}
	if fragmentSvc.syncFragmentBatchCalls != 0 {
		t.Fatalf("expected no inline fragment sync, got %d", fragmentSvc.syncFragmentBatchCalls)
	}
}

func TestDocumentAppServiceScheduleSyncForcesAsyncWithoutMutatingInput(t *testing.T) {
	t.Parallel()

	scheduler := &documentSyncSchedulerStub{}
	svc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{}, newCustomContentKnowledgeBaseReader(), scheduler)

	input := &documentdomain.SyncDocumentInput{
		OrganizationCode:  customContentOrgCode,
		KnowledgeBaseCode: customContentKnowledgeCode,
		Code:              "DOC-1",
		Mode:              documentdomain.SyncModeCreate,
		Async:             false,
	}
	svc.ScheduleSync(context.Background(), input)

	if scheduler.scheduleCalls != 1 || len(scheduler.inputs) != 1 {
		t.Fatalf("expected one scheduled input, got calls=%d inputs=%d", scheduler.scheduleCalls, len(scheduler.inputs))
	}
	if !scheduler.inputs[0].Async {
		t.Fatalf("expected scheduled input to be forced async, got %#v", scheduler.inputs[0])
	}
	if input.Async {
		t.Fatalf("expected original input not to be mutated, got %#v", input)
	}
}

func TestDocumentCreate_FailureDoesNotScheduleSync(t *testing.T) {
	t.Parallel()

	scheduler := &documentSyncSchedulerStub{}
	svc := appservice.NewDocumentAppServiceForTest(t,
		&documentDomainServiceStub{saveErr: errDocumentUpdateFailed},
		&knowledgeBaseReaderStub{
			showByCodeAndOrgResult: &kbentity.KnowledgeBase{
				Code:     "KB1",
				Model:    "text-embedding-3-small",
				VectorDB: "odin_qdrant",
			},
		},
		scheduler,
	)

	_, err := svc.Create(context.Background(), &docdto.CreateDocumentInput{
		OrganizationCode:  "DT001",
		UserID:            "usi_test",
		KnowledgeBaseCode: "KB1",
		Name:              "doc-1.md",
		DocumentFile:      &docfilehelper.DocumentFileDTO{Name: "doc-1.md", Key: "org/doc-1.md", URL: "org/doc-1.md"},
		AutoSync:          true,
	})
	if !errors.Is(err, errDocumentUpdateFailed) {
		t.Fatalf("expected save error, got %v", err)
	}
	if scheduler.scheduleCalls != 0 || len(scheduler.inputs) != 0 {
		t.Fatalf("expected no scheduled syncs on create failure, got calls=%d inputs=%d", scheduler.scheduleCalls, len(scheduler.inputs))
	}
}

func TestDocumentAppServiceCreateRejectsManualDocumentForSourceBoundDigitalEmployeeKnowledgeBase(t *testing.T) {
	t.Parallel()

	projectSourceType := int(kbentity.SourceTypeProject)
	domain := &documentDomainServiceStub{}
	svc := appservice.NewDocumentAppServiceForTest(t, domain, &knowledgeBaseReaderStub{
		showByCodeAndOrgResult: &kbentity.KnowledgeBase{
			Code:              customContentKnowledgeCode,
			OrganizationCode:  customContentOrgCode,
			Model:             "kb-model",
			VectorDB:          "odin_qdrant",
			SourceType:        &projectSourceType,
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		},
		routeModel: "effective-model",
	}, nil)
	svc.SetKnowledgeBaseBindingRepository(&knowledgeBaseBindingRepositoryStub{
		bindIDsByKnowledgeBase: map[string][]string{
			customContentKnowledgeCode: {"SMA-1"},
		},
	})

	_, err := svc.Create(context.Background(), newCustomContentCreateInput())
	if !errors.Is(err, kbentity.ErrManualDocumentCreateNotAllowed) {
		t.Fatalf("expected ErrManualDocumentCreateNotAllowed, got %v", err)
	}
	if len(domain.savedDocs) != 0 {
		t.Fatalf("expected no saved docs, got %d", len(domain.savedDocs))
	}
}

func TestDocumentAppServiceCreateManagedDocumentAllowsSourceBoundAutoCreate(t *testing.T) {
	t.Parallel()

	projectSourceType := int(kbentity.SourceTypeProject)
	domain := &documentDomainServiceStub{}
	svc := appservice.NewDocumentAppServiceForTest(t, domain, &knowledgeBaseReaderStub{
		showByCodeAndOrgResult: &kbentity.KnowledgeBase{
			Code:              customContentKnowledgeCode,
			OrganizationCode:  customContentOrgCode,
			Model:             "kb-model",
			VectorDB:          "odin_qdrant",
			SourceType:        &projectSourceType,
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		},
		routeModel: "effective-model",
	}, nil)
	svc.SetKnowledgeBaseBindingRepository(&knowledgeBaseBindingRepositoryStub{
		bindIDsByKnowledgeBase: map[string][]string{
			customContentKnowledgeCode: {"SMA-1"},
		},
	})
	managedDocuments := svc.ManagedDocumentApp()
	if managedDocuments == nil {
		t.Fatal("expected managed document app")
	}

	result, err := managedDocuments.CreateManagedDocument(context.Background(), &documentdomain.CreateManagedDocumentInput{
		OrganizationCode:  customContentOrgCode,
		UserID:            customContentUserID,
		KnowledgeBaseCode: customContentKnowledgeCode,
		SourceBindingID:   1,
		SourceItemID:      1,
		AutoAdded:         true,
		Name:              customContentFileName,
		DocType:           int(docentity.DocumentInputKindText),
		DocumentFile: &docentity.File{
			Name: customContentFileName,
			URL:  customContentFileKey,
		},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil {
		t.Fatal("expected managed document result not nil")
	}
	if len(domain.savedDocs) != 1 {
		t.Fatalf("expected one saved document, got %d", len(domain.savedDocs))
	}
}

func newCustomContentKnowledgeBaseReader() *knowledgeBaseReaderStub {
	return &knowledgeBaseReaderStub{
		showByCodeAndOrgResult: &kbentity.KnowledgeBase{
			Code:             customContentKnowledgeCode,
			OrganizationCode: customContentOrgCode,
			Model:            "kb-model",
			VectorDB:         "odin_qdrant",
			FragmentConfig: &shared.FragmentConfig{
				Mode: shared.FragmentModeAuto,
			},
		},
		routeModel: "effective-model",
	}
}

func newCustomContentCreateInput() *docdto.CreateDocumentInput {
	return &docdto.CreateDocumentInput{
		OrganizationCode:  customContentOrgCode,
		UserID:            customContentUserID,
		KnowledgeBaseCode: customContentKnowledgeCode,
		Name:              customContentFileName,
		DocType:           int(docentity.DocumentInputKindText),
		DocMetadata: map[string]any{
			"source": "custom_content",
		},
		DocumentFile: &docfilehelper.DocumentFileDTO{
			Name: customContentFileName,
			Key:  customContentFileKey,
		},
		FragmentConfig: &confighelper.FragmentConfigDTO{
			Mode: int(shared.FragmentModeNormal),
			Normal: &confighelper.NormalFragmentConfigDTO{
				TextPreprocessRule: []int{1, 2},
				SegmentRule: &confighelper.SegmentRuleDTO{
					Separator:    "\\n\\n",
					ChunkSize:    800,
					ChunkOverlap: 10,
				},
			},
		},
		AutoSync: true,
	}
}

func assertCreatedManagedDocument(t *testing.T, saved *docentity.KnowledgeBaseDocument) {
	t.Helper()

	if saved.DocumentFile == nil || saved.DocumentFile.URL != customContentFileKey {
		t.Fatalf("unexpected saved document file: %#v", saved.DocumentFile)
	}
	if saved.DocumentFile.Extension != "md" {
		t.Fatalf("expected md extension, got %#v", saved.DocumentFile)
	}
	if saved.FragmentConfig == nil || saved.FragmentConfig.Mode != shared.FragmentModeNormal {
		t.Fatalf("expected create fragment config to override kb default, got %#v", saved.FragmentConfig)
	}
	if saved.FragmentConfig.Normal == nil || saved.FragmentConfig.Normal.SegmentRule == nil {
		t.Fatalf("expected normal segment rule persisted, got %#v", saved.FragmentConfig)
	}
	if saved.FragmentConfig.Normal.SegmentRule.ChunkSize != 800 || saved.FragmentConfig.Normal.SegmentRule.ChunkOverlap != 10 {
		t.Fatalf("unexpected saved segment rule: %#v", saved.FragmentConfig.Normal.SegmentRule)
	}
	if saved.EmbeddingModel != "effective-model" {
		t.Fatalf("expected effective model, got %q", saved.EmbeddingModel)
	}
	if saved.DocMetadata["source"] != "custom_content" {
		t.Fatalf("expected custom metadata source, got %#v", saved.DocMetadata)
	}
}

func assertCreateScheduledSync(t *testing.T, scheduler *documentSyncSchedulerStub) {
	t.Helper()

	if scheduler.scheduleCalls != 1 || len(scheduler.inputs) != 1 {
		t.Fatalf("expected one sync schedule, got calls=%d inputs=%d", scheduler.scheduleCalls, len(scheduler.inputs))
	}
	if scheduler.inputs[0].KnowledgeBaseCode != customContentKnowledgeCode || scheduler.inputs[0].OrganizationCode != customContentOrgCode {
		t.Fatalf("unexpected scheduled sync input: %#v", scheduler.inputs[0])
	}
	if scheduler.inputs[0].Code == "" {
		t.Fatalf("expected scheduled document code, got %#v", scheduler.inputs[0])
	}
	if !scheduler.inputs[0].Async {
		t.Fatalf("expected scheduled create sync to be async, got %#v", scheduler.inputs[0])
	}
}

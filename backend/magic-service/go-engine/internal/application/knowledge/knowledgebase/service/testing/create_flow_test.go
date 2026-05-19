package kbapp_test

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"strings"
	"testing"

	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	service "magic/internal/application/knowledge/knowledgebase/service"
	kbaccess "magic/internal/domain/knowledge/access/service"
	docentity "magic/internal/domain/knowledge/document/entity"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingrepository "magic/internal/domain/knowledge/sourcebinding/repository"
	"magic/internal/pkg/thirdplatform"
)

var (
	errCreateDoc2     = errors.New("create doc-2 failed")
	errNotImplemented = errors.New("not implemented")
	errGrantOwner     = errors.New("grant owner failed")
)

const testThirdPlatformParentTypeKnowledgeBase = "knowledge_base"

type thirdPlatformBindingExpansionCase struct {
	name                string
	binding             kbdto.SourceBindingInput
	expectedKnowledgeID string
	expectedThirdFileID string
	expectedThirdType   string
}

func TestKnowledgeBaseCreate_WithSourceBindingsCreatesThenSchedulesSync(t *testing.T) {
	t.Parallel()

	events := []string{}
	domainSvc := &fakeKnowledgeBaseDomainService{events: &events, effectiveModel: "text-embedding-3-small"}
	documentManager := &fakeKnowledgeBaseDocumentManager{events: &events}
	svc := service.NewKnowledgeBaseAppServiceForTest(t, domainSvc, documentManager, nil, nil, "text-embedding-3-small")
	svc.SetSourceBindingRepository(&fakeSourceBindingRepository{})

	_, err := svc.Create(context.Background(), &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "DT001",
		UserID:           "usi_test",
		Name:             "kb-test",
		Description:      "desc",
		Type:             1,
		SourceBindings: []kbdto.SourceBindingInput{
			localUploadSourceBinding(&docfilehelper.DocumentFileDTO{Name: "doc-1.md", URL: "org/doc-1.md", Key: "org/doc-1.md"}),
			localUploadSourceBinding(&docfilehelper.DocumentFileDTO{Name: "doc-2.md", URL: "org/doc-2.md", Key: "org/doc-2.md"}),
		},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	expectedEvents := []string{
		"kb-save",
		"doc-create:doc-1.md",
		"doc-create:doc-2.md",
		"doc-sync:doc-1.md-code",
		"doc-sync:doc-2.md-code",
	}
	assertEventSequence(t, events, expectedEvents)
	if len(documentManager.scheduledInputs) != 2 {
		t.Fatalf("expected 2 scheduled syncs, got %d", len(documentManager.scheduledInputs))
	}
	if documentManager.scheduledInputs[0].Mode != "create" {
		t.Fatalf("expected first scheduled mode=create, got %q", documentManager.scheduledInputs[0].Mode)
	}
	if documentManager.scheduledInputs[0].BusinessParams == nil || documentManager.scheduledInputs[0].BusinessParams.BusinessID == "" {
		t.Fatalf("expected business params to be populated, got %#v", documentManager.scheduledInputs[0].BusinessParams)
	}
}

func TestKnowledgeBaseCreate_WithLegacyDocumentFilesCreatesThenSchedulesSync(t *testing.T) {
	t.Parallel()

	events := []string{}
	domainSvc := &fakeKnowledgeBaseDomainService{events: &events, effectiveModel: "text-embedding-3-small"}
	documentManager := &fakeKnowledgeBaseDocumentManager{events: &events}
	svc := service.NewKnowledgeBaseAppServiceForTest(t, domainSvc, documentManager, nil, nil, "text-embedding-3-small")
	svc.SetSourceBindingRepository(&fakeSourceBindingRepository{})

	_, err := svc.Create(context.Background(), &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "DT001",
		UserID:           "usi_test",
		Name:             "kb-test",
		Description:      "desc",
		Type:             1,
		LegacyDocumentFiles: []kbdto.LegacyDocumentFileInput{
			{
				"name": "doc-1.md",
				"key":  "org/doc-1.md",
				"type": 1,
			},
			{
				"name": "doc-2.md",
				"key":  "org/doc-2.md",
				"type": 1,
			},
		},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	expectedEvents := []string{
		"kb-save",
		"doc-create:doc-1.md",
		"doc-create:doc-2.md",
		"doc-sync:doc-1.md-code",
		"doc-sync:doc-2.md-code",
	}
	assertEventSequence(t, events, expectedEvents)
	if len(documentManager.createdInputs) != 2 {
		t.Fatalf("expected 2 created documents, got %d", len(documentManager.createdInputs))
	}
	if documentManager.createdInputs[0].DocumentFile == nil || documentManager.createdInputs[0].DocumentFile.FileKey != "org/doc-1.md" {
		t.Fatalf("expected first legacy document file forwarded to document create, got %#v", documentManager.createdInputs[0].DocumentFile)
	}
}

func TestKnowledgeBaseCreate_WithThirdPlatformSourceBindingUsesExpandedDocumentFile(t *testing.T) {
	t.Parallel()

	events := []string{}
	domainSvc := &fakeKnowledgeBaseDomainService{events: &events, effectiveModel: "text-embedding-3-small"}
	documentManager := &fakeKnowledgeBaseDocumentManager{events: &events}
	svc := service.NewKnowledgeBaseAppServiceForTest(t, domainSvc, documentManager, nil, nil, "text-embedding-3-small")
	svc.SetSourceBindingRepository(&fakeSourceBindingRepository{})
	svc.SetThirdPlatformExpander(&fakeThirdPlatformExpander{
		results: []*docentity.File{{
			Type:       "third_platform",
			Name:       "doc-1",
			ThirdID:    "third-file-1",
			SourceType: "teamshare",
		}},
	})

	_, err := svc.Create(context.Background(), &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "DT001",
		UserID:           "usi_test",
		Name:             "kb-test",
		Description:      "desc",
		Type:             1,
		SourceBindings: []kbdto.SourceBindingInput{
			{
				Provider: sourcebindingdomain.ProviderTeamshare,
				RootType: sourcebindingdomain.RootTypeFile,
				RootRef:  "third-file-1",
			},
		},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(documentManager.createdInputs) != 1 {
		t.Fatalf("expected one created input, got %d", len(documentManager.createdInputs))
	}

	createdInput := documentManager.createdInputs[0]
	if createdInput.DocumentFile == nil || createdInput.DocumentFile.ThirdID != "third-file-1" {
		t.Fatalf("expected expanded document file third id, got %#v", createdInput)
	}
	if createdInput.DocumentFile.SourceType != sourcebindingdomain.ProviderTeamshare {
		t.Fatalf("expected expanded source type teamshare, got %#v", createdInput)
	}
}

func TestKnowledgeBaseCreate_WithThirdPlatformBindingExpansionSemantics(t *testing.T) {
	t.Parallel()

	testCases := []thirdPlatformBindingExpansionCase{
		{
			name: "whole knowledge base",
			binding: kbdto.SourceBindingInput{
				Provider: sourcebindingdomain.ProviderTeamshare,
				RootType: sourcebindingdomain.RootTypeKnowledgeBase,
				RootRef:  testTeamshareKnowledgeID,
			},
			expectedKnowledgeID: testTeamshareKnowledgeID,
			expectedThirdFileID: testTeamshareKnowledgeID,
		},
		{
			name: "folder target",
			binding: kbdto.SourceBindingInput{
				Provider: sourcebindingdomain.ProviderTeamshare,
				RootType: sourcebindingdomain.RootTypeKnowledgeBase,
				RootRef:  testTeamshareKnowledgeID,
				Targets: []kbdto.SourceBindingTargetInput{{
					TargetType: sourcebindingdomain.TargetTypeFolder,
					TargetRef:  "folder-1",
				}},
			},
			expectedKnowledgeID: testTeamshareKnowledgeID,
			expectedThirdFileID: "folder-1",
			expectedThirdType:   "folder",
		},
		{
			name: "file target defaults to file semantics",
			binding: kbdto.SourceBindingInput{
				Provider: sourcebindingdomain.ProviderTeamshare,
				RootType: sourcebindingdomain.RootTypeKnowledgeBase,
				RootRef:  testTeamshareKnowledgeID,
				Targets: []kbdto.SourceBindingTargetInput{{
					TargetRef: "file-1",
				}},
			},
			expectedKnowledgeID: testTeamshareKnowledgeID,
			expectedThirdFileID: "file-1",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertThirdPlatformBindingExpansionCase(t, tc)
		})
	}
}

func assertThirdPlatformBindingExpansionCase(t *testing.T, tc thirdPlatformBindingExpansionCase) {
	t.Helper()

	events := []string{}
	domainSvc := &fakeKnowledgeBaseDomainService{events: &events, effectiveModel: "text-embedding-3-small"}
	documentManager := &fakeKnowledgeBaseDocumentManager{events: &events}
	expander := &fakeThirdPlatformExpander{
		results: []*docentity.File{{
			Type:            "third_platform",
			Name:            "doc-1",
			ThirdID:         tc.expectedThirdFileID,
			SourceType:      sourcebindingdomain.ProviderTeamshare,
			KnowledgeBaseID: tc.expectedKnowledgeID,
		}},
	}
	svc := service.NewKnowledgeBaseAppServiceForTest(t, domainSvc, documentManager, nil, nil, "text-embedding-3-small")
	svc.SetSourceBindingRepository(&fakeSourceBindingRepository{})
	svc.SetThirdPlatformExpander(expander)

	_, err := svc.Create(context.Background(), &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "DT001",
		UserID:           "usi_test",
		Name:             "kb-test",
		Description:      "desc",
		Type:             1,
		SourceBindings:   []kbdto.SourceBindingInput{tc.binding},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(documentManager.createdInputs) != 1 {
		t.Fatalf("expected one created input, got %#v", documentManager.createdInputs)
	}
	createdFile := documentManager.createdInputs[0].DocumentFile
	if createdFile == nil {
		t.Fatalf("expected created document file, got %#v", documentManager.createdInputs[0])
	}
	if createdFile.KnowledgeBaseID != tc.expectedKnowledgeID {
		t.Fatalf("expected knowledge_base_id=%q, got %#v", tc.expectedKnowledgeID, createdFile)
	}
	if createdFile.ThirdID != tc.expectedThirdFileID {
		t.Fatalf("expected third id=%q, got %#v", tc.expectedThirdFileID, createdFile)
	}
	if tc.expectedThirdType == "folder" {
		if expander.lastParentType != "folder" || expander.lastParentRef != tc.expectedThirdFileID {
			t.Fatalf("expected folder traversal %q/%q, got %q/%q", "folder", tc.expectedThirdFileID, expander.lastParentType, expander.lastParentRef)
		}
		return
	}
	if tc.binding.RootType == sourcebindingdomain.RootTypeKnowledgeBase && len(tc.binding.Targets) == 0 {
		if expander.lastParentType != testThirdPlatformParentTypeKnowledgeBase || expander.lastParentRef != tc.expectedKnowledgeID {
			t.Fatalf("expected knowledge base traversal %q/%q, got %q/%q", testThirdPlatformParentTypeKnowledgeBase, tc.expectedKnowledgeID, expander.lastParentType, expander.lastParentRef)
		}
		return
	}
	if expander.lastResolveInput == nil {
		t.Fatalf("expected resolve input to be populated")
	}
	payload := expander.lastResolveInput.DocumentFile
	if payload["knowledge_base_id"] != tc.expectedKnowledgeID {
		t.Fatalf("expected resolve knowledge_base_id=%q, got %#v", tc.expectedKnowledgeID, payload)
	}
	if payload["third_file_id"] != tc.expectedThirdFileID || payload["third_id"] != tc.expectedThirdFileID {
		t.Fatalf("expected resolve third ids=%q, got %#v", tc.expectedThirdFileID, payload)
	}
}

func TestKnowledgeBaseCreate_WithThirdPlatformBindingRecursivelyTraversesFolders(t *testing.T) {
	t.Parallel()

	events := []string{}
	domainSvc := &fakeKnowledgeBaseDomainService{events: &events, effectiveModel: "text-embedding-3-small"}
	documentManager := &fakeKnowledgeBaseDocumentManager{events: &events}
	expander := &fakeThirdPlatformExpander{
		nodesByParent: map[string][]thirdplatform.TreeNode{
			"knowledge_base:" + testTeamshareKnowledgeID: {
				{
					KnowledgeBaseID: testTeamshareKnowledgeID,
					ThirdFileID:     "folder-1",
					ParentID:        testTeamshareKnowledgeID,
					Name:            "folder-1",
					IsDirectory:     true,
				},
				{
					KnowledgeBaseID: testTeamshareKnowledgeID,
					ThirdFileID:     "root-unsupported",
					ParentID:        testTeamshareKnowledgeID,
					Name:            "skip.exe",
					Extension:       "exe",
				},
			},
			"folder:folder-1": {
				{
					KnowledgeBaseID: testTeamshareKnowledgeID,
					ThirdFileID:     "doc-1",
					ParentID:        "folder-1",
					Name:            "doc-1.md",
					Extension:       "md",
				},
			},
		},
	}
	svc := service.NewKnowledgeBaseAppServiceForTest(t, domainSvc, documentManager, nil, nil, "text-embedding-3-small")
	svc.SetSourceBindingRepository(&fakeSourceBindingRepository{})
	svc.SetThirdPlatformExpander(expander)

	_, err := svc.Create(context.Background(), &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "DT001",
		UserID:           "usi_test",
		Name:             "kb-test",
		Description:      "desc",
		Type:             1,
		SourceBindings: []kbdto.SourceBindingInput{{
			Provider: sourcebindingdomain.ProviderTeamshare,
			RootType: sourcebindingdomain.RootTypeKnowledgeBase,
			RootRef:  testTeamshareKnowledgeID,
		}},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(documentManager.createdInputs) != 1 {
		t.Fatalf("expected one supported created input, got %#v", documentManager.createdInputs)
	}
	if got := documentManager.createdInputs[0].DocumentFile.ThirdID; got != "doc-1" {
		t.Fatalf("expected nested document third id doc-1, got %#v", documentManager.createdInputs[0].DocumentFile)
	}
	if len(expander.parentCalls) != 2 {
		t.Fatalf("expected two tree traversals, got %#v", expander.parentCalls)
	}
	if expander.parentCalls[0] != "knowledge_base:"+testTeamshareKnowledgeID || expander.parentCalls[1] != "folder:folder-1" {
		t.Fatalf("unexpected traversal sequence: %#v", expander.parentCalls)
	}
}

func TestKnowledgeBaseCreate_WithExistingBusinessIDReturnsConflict(t *testing.T) {
	t.Parallel()

	events := []string{}
	sourceType := int(kbentity.SourceTypeLocalFile)
	existing := &kbentity.KnowledgeBase{
		ID:               1,
		Code:             "KB-EXIST",
		Name:             "old-name",
		Description:      "old-desc",
		Type:             1,
		Enabled:          true,
		BusinessID:       "BIZ-1",
		OrganizationCode: "DT001",
		CreatedUID:       "creator",
		UpdatedUID:       "modifier",
		SourceType:       &sourceType,
	}
	domainSvc := &fakeKnowledgeBaseDomainService{
		events:         &events,
		effectiveModel: "text-embedding-3-small",
		showKB:         existing,
		listKBS:        []*kbentity.KnowledgeBase{existing},
	}
	svc := service.NewKnowledgeBaseAppServiceForTest(t, domainSvc, nil, nil, nil, "text-embedding-3-small")

	result, err := svc.Create(context.Background(), &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "DT001",
		UserID:           "usi_test",
		Name:             "new-name",
		Description:      "new-desc",
		Type:             1,
		BusinessID:       "BIZ-1",
		Icon:             "icon-1",
		SourceType:       &sourceType,
	})
	if !errors.Is(err, service.ErrKnowledgeBaseBusinessIDAlreadyExists) {
		t.Fatalf("expected business-id conflict, got result=%#v err=%v", result, err)
	}
	if result != nil {
		t.Fatalf("expected nil result on conflict, got %#v", result)
	}
	if domainSvc.updatedKB != nil {
		t.Fatalf("expected create not to update existing knowledge base, got %#v", domainSvc.updatedKB)
	}
	if len(events) != 0 {
		t.Fatalf("expected no write events, got %#v", events)
	}
}

func TestKnowledgeBaseCreate_GrantsOwnerBeforeSourceBindingSync(t *testing.T) {
	t.Parallel()

	events := []string{}
	domainSvc := &fakeKnowledgeBaseDomainService{events: &events, effectiveModel: "text-embedding-3-small"}
	documentManager := &fakeKnowledgeBaseDocumentManager{events: &events}
	ownerGrantPort := &fakeKnowledgeBaseOwnerGrantPort{events: &events}
	svc := service.NewKnowledgeBaseAppServiceForTest(t, domainSvc, documentManager, nil, nil, "text-embedding-3-small")
	svc.SetSourceBindingRepository(&fakeSourceBindingRepository{})
	svc.SetKnowledgeBasePermissionWriter(ownerGrantPort)

	_, err := svc.Create(context.Background(), &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "DT001",
		UserID:           "usi_test",
		Name:             "kb-test",
		Description:      "desc",
		Type:             1,
		SourceBindings: []kbdto.SourceBindingInput{
			localUploadSourceBinding(&docfilehelper.DocumentFileDTO{Name: "doc-1.md", URL: "org/doc-1.md", Key: "org/doc-1.md"}),
		},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	expectedEvents := []string{
		"kb-save",
		"owner-grant",
		"doc-create:doc-1.md",
		"doc-sync:doc-1.md-code",
	}
	assertEventSequence(t, events, expectedEvents)
	if ownerGrantPort.lastKnowledgeBaseCode == "" {
		t.Fatal("expected owner grant to receive generated knowledge base code")
	}
}

func TestKnowledgeBaseCreate_RollbacksKnowledgeBaseOnOwnerGrantFailure(t *testing.T) {
	t.Parallel()

	events := []string{}
	domainSvc := &fakeKnowledgeBaseDomainService{events: &events, effectiveModel: "text-embedding-3-small"}
	documentManager := &fakeKnowledgeBaseDocumentManager{events: &events}
	ownerGrantPort := &fakeKnowledgeBaseOwnerGrantPort{events: &events, err: errGrantOwner}
	svc := service.NewKnowledgeBaseAppServiceForTest(t, domainSvc, documentManager, nil, nil, "text-embedding-3-small")
	svc.SetSourceBindingRepository(&fakeSourceBindingRepository{events: &events})
	svc.SetKnowledgeBasePermissionWriter(ownerGrantPort)

	_, err := svc.Create(context.Background(), &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "DT001",
		UserID:           "usi_test",
		Name:             "kb-test",
		Description:      "desc",
		Type:             1,
		SourceBindings: []kbdto.SourceBindingInput{
			localUploadSourceBinding(&docfilehelper.DocumentFileDTO{Name: "doc-1.md", URL: "org/doc-1.md", Key: "org/doc-1.md"}),
		},
	})
	if !errors.Is(err, errGrantOwner) {
		t.Fatalf("expected grant owner error, got %v", err)
	}

	expectedEvents := []string{
		"kb-save",
		"owner-grant",
		"binding-delete",
		"kb-destroy",
	}
	assertEventSequence(t, events, expectedEvents)
}

func TestKnowledgeBaseCreate_RollbacksDocumentsAndKnowledgeBaseOnDocumentFailure(t *testing.T) {
	t.Parallel()

	events := []string{}
	domainSvc := &fakeKnowledgeBaseDomainService{events: &events, effectiveModel: "text-embedding-3-small"}
	documentManager := &fakeKnowledgeBaseDocumentManager{
		events: &events,
		createErrByName: map[string]error{
			"doc-2.md": errCreateDoc2,
		},
	}
	svc := service.NewKnowledgeBaseAppServiceForTest(t, domainSvc, documentManager, nil, nil, "text-embedding-3-small")
	svc.SetSourceBindingRepository(&fakeSourceBindingRepository{})

	_, err := svc.Create(context.Background(), &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "DT001",
		UserID:           "usi_test",
		Name:             "kb-test",
		Description:      "desc",
		Type:             1,
		SourceBindings: []kbdto.SourceBindingInput{
			localUploadSourceBinding(&docfilehelper.DocumentFileDTO{Name: "doc-1.md", URL: "org/doc-1.md", Key: "org/doc-1.md"}),
			localUploadSourceBinding(&docfilehelper.DocumentFileDTO{Name: "doc-2.md", URL: "org/doc-2.md", Key: "org/doc-2.md"}),
		},
	})
	if err == nil {
		t.Fatal("expected error but got nil")
	}

	expectedEvents := []string{
		"kb-save",
		"doc-create:doc-1.md",
		"doc-create:doc-2.md",
		"doc-destroy:doc-1.md-code",
		"kb-destroy",
	}
	assertEventSequence(t, events, expectedEvents)
	if len(documentManager.scheduledInputs) != 0 {
		t.Fatalf("expected no scheduled syncs on failure, got %d", len(documentManager.scheduledInputs))
	}
}

type fakeKnowledgeBaseDomainService struct {
	events         *[]string
	effectiveModel string
	showKB         *kbentity.KnowledgeBase
	listKBS        []*kbentity.KnowledgeBase
	updatedKB      *kbentity.KnowledgeBase
}

func (f *fakeKnowledgeBaseDomainService) PrepareForSave(_ context.Context, kb *kbentity.KnowledgeBase) error {
	*f.events = append(*f.events, "kb-prepare-save")
	if kb.ID == 0 {
		kb.ID = 1
	}
	return nil
}

func (f *fakeKnowledgeBaseDomainService) Save(_ context.Context, kb *kbentity.KnowledgeBase) error {
	*f.events = append(*f.events, "kb-save")
	if kb.ID == 0 {
		kb.ID = 1
	}
	return nil
}

func (f *fakeKnowledgeBaseDomainService) Update(_ context.Context, kb *kbentity.KnowledgeBase) error {
	*f.events = append(*f.events, "kb-update")
	f.updatedKB = cloneKnowledgeBase(kb)
	return nil
}

func (f *fakeKnowledgeBaseDomainService) UpdateProgress(context.Context, *kbentity.KnowledgeBase) error {
	return nil
}

func (f *fakeKnowledgeBaseDomainService) ShowByCodeAndOrg(context.Context, string, string) (*kbentity.KnowledgeBase, error) {
	if f.showKB != nil {
		return cloneKnowledgeBase(f.showKB), nil
	}
	return nil, errNotImplemented
}

func (f *fakeKnowledgeBaseDomainService) List(context.Context, *kbrepository.Query) ([]*kbentity.KnowledgeBase, int64, error) {
	if f.listKBS != nil {
		items := make([]*kbentity.KnowledgeBase, 0, len(f.listKBS))
		for _, kb := range f.listKBS {
			items = append(items, cloneKnowledgeBase(kb))
		}
		return items, int64(len(items)), nil
	}
	return nil, 0, errNotImplemented
}

func (f *fakeKnowledgeBaseDomainService) Destroy(_ context.Context, _ *kbentity.KnowledgeBase) error {
	*f.events = append(*f.events, "kb-destroy")
	return nil
}

func (f *fakeKnowledgeBaseDomainService) DeleteVectorData(context.Context, *kbentity.KnowledgeBase) error {
	return nil
}

func (f *fakeKnowledgeBaseDomainService) ResolveRuntimeRoute(_ context.Context, kb *kbentity.KnowledgeBase) sharedroute.ResolvedRoute {
	collectionName := ""
	model := f.effectiveModel
	if kb != nil {
		collectionName = kb.CollectionName()
		if model == "" {
			model = kb.Model
		}
	}
	return sharedroute.ResolvedRoute{
		LogicalCollectionName:  collectionName,
		PhysicalCollectionName: collectionName,
		VectorCollectionName:   collectionName,
		TermCollectionName:     collectionName,
		Model:                  model,
	}
}

type fakeKnowledgeBaseDocumentManager struct {
	createErrByName map[string]error
	events          *[]string
	createdInputs   []*service.CreateManagedDocumentInput
	scheduledInputs []*service.SyncDocumentInput
}

func (f *fakeKnowledgeBaseDocumentManager) CreateManagedDocument(
	_ context.Context,
	input *service.CreateManagedDocumentInput,
) (*service.ManagedDocument, error) {
	*f.events = append(*f.events, fmt.Sprintf("doc-create:%s", input.Name))
	f.createdInputs = append(f.createdInputs, cloneManagedCreateInput(input))
	if err := f.createErrByName[input.Name]; err != nil {
		return nil, err
	}
	return &service.ManagedDocument{Code: input.Name + "-code"}, nil
}

func (f *fakeKnowledgeBaseDocumentManager) ListManagedDocumentsByKnowledgeBaseAndProject(
	context.Context,
	string,
	int64,
) ([]*service.ManagedDocument, error) {
	return nil, nil
}

func (f *fakeKnowledgeBaseDocumentManager) ListManagedDocumentsByKnowledgeBase(
	context.Context,
	string,
) ([]*service.ManagedDocument, error) {
	return nil, nil
}

func (f *fakeKnowledgeBaseDocumentManager) DestroyManagedDocument(_ context.Context, code, _ string) error {
	*f.events = append(*f.events, fmt.Sprintf("doc-destroy:%s", code))
	return nil
}

func (f *fakeKnowledgeBaseDocumentManager) DestroyKnowledgeBaseDocuments(
	_ context.Context,
	knowledgeBaseCode string,
	organizationCode string,
) error {
	*f.events = append(*f.events, fmt.Sprintf("doc-destroy-kb:%s:%s", organizationCode, knowledgeBaseCode))
	return nil
}

func (f *fakeKnowledgeBaseDocumentManager) ScheduleManagedDocumentSync(_ context.Context, input *service.SyncDocumentInput) {
	*f.events = append(*f.events, fmt.Sprintf("doc-sync:%s", input.Code))
	f.scheduledInputs = append(f.scheduledInputs, cloneManagedSyncInput(input))
}

type fakeSourceBindingRepository struct {
	events           *[]string
	sourceItemIDs    map[string]int64
	nextSourceItemID int64
}

func (f *fakeSourceBindingRepository) ReplaceBindings(_ context.Context, _ string, bindings []sourcebindingdomain.Binding) ([]sourcebindingdomain.Binding, error) {
	results := make([]sourcebindingdomain.Binding, 0, len(bindings))
	for idx, binding := range bindings {
		cloned := binding
		if cloned.ID <= 0 {
			cloned.ID = int64(idx + 1)
		}
		results = append(results, cloned)
	}
	return results, nil
}

func (f *fakeSourceBindingRepository) SaveBindings(ctx context.Context, knowledgeBaseCode string, bindings []sourcebindingdomain.Binding) ([]sourcebindingdomain.Binding, error) {
	return f.ReplaceBindings(ctx, knowledgeBaseCode, bindings)
}

func (f *fakeSourceBindingRepository) ApplyKnowledgeBaseBindings(
	ctx context.Context,
	input sourcebindingrepository.ApplyKnowledgeBaseBindingsInput,
) ([]sourcebindingdomain.Binding, error) {
	bindings := make([]sourcebindingdomain.Binding, 0, len(input.UpsertBindings))
	for _, binding := range input.UpsertBindings {
		bindings = append(bindings, binding.Binding)
	}
	return f.ReplaceBindings(ctx, input.KnowledgeBaseCode, bindings)
}

func (f *fakeSourceBindingRepository) DeleteBindingsByKnowledgeBase(context.Context, string) error {
	if f.events != nil {
		*f.events = append(*f.events, "binding-delete")
	}
	return nil
}

func (f *fakeSourceBindingRepository) ListBindingsByKnowledgeBase(context.Context, string) ([]sourcebindingdomain.Binding, error) {
	return nil, nil
}

func (f *fakeSourceBindingRepository) ListBindingsByKnowledgeBases(context.Context, []string) (map[string][]sourcebindingdomain.Binding, error) {
	return map[string][]sourcebindingdomain.Binding{}, nil
}

func (f *fakeSourceBindingRepository) ListRealtimeProjectBindingsByProject(context.Context, string, int64) ([]sourcebindingdomain.Binding, error) {
	return nil, nil
}

func (f *fakeSourceBindingRepository) ListRealtimeTeamshareBindingsByKnowledgeBase(context.Context, string, string, string) ([]sourcebindingdomain.Binding, error) {
	return nil, nil
}

func (f *fakeSourceBindingRepository) HasRealtimeProjectBindingForFile(context.Context, string, int64, int64) (bool, error) {
	return false, nil
}

func (f *fakeSourceBindingRepository) UpsertSourceItem(_ context.Context, item sourcebindingdomain.SourceItem) (*sourcebindingdomain.SourceItem, error) {
	if f.sourceItemIDs == nil {
		f.sourceItemIDs = make(map[string]int64)
	}
	if id, exists := f.sourceItemIDs[item.ItemRef]; exists {
		item.ID = id
		return &item, nil
	}
	f.nextSourceItemID++
	if f.nextSourceItemID == 0 {
		f.nextSourceItemID = 1
	}
	item.ID = f.nextSourceItemID
	f.sourceItemIDs[item.ItemRef] = item.ID
	return &item, nil
}

func (f *fakeSourceBindingRepository) UpsertSourceItems(
	ctx context.Context,
	items []sourcebindingdomain.SourceItem,
) ([]*sourcebindingdomain.SourceItem, error) {
	result := make([]*sourcebindingdomain.SourceItem, 0, len(items))
	for _, item := range items {
		saved, err := f.UpsertSourceItem(ctx, item)
		if err != nil {
			return nil, err
		}
		result = append(result, saved)
	}
	return result, nil
}

func (f *fakeSourceBindingRepository) ReplaceBindingItems(context.Context, int64, []sourcebindingdomain.BindingItem) error {
	return nil
}

func (f *fakeSourceBindingRepository) ListBindingItemsByKnowledgeBase(context.Context, string) ([]sourcebindingdomain.BindingItem, error) {
	return nil, nil
}

type fakeKnowledgeBaseOwnerGrantPort struct {
	events                *[]string
	err                   error
	lastOrganizationCode  string
	lastCurrentUserID     string
	lastKnowledgeBaseCode string
	lastOwnerUserID       string
}

func (f *fakeKnowledgeBaseOwnerGrantPort) Initialize(
	_ context.Context,
	actor kbaccess.Actor,
	input kbaccess.InitializeInput,
) error {
	if f.events != nil {
		*f.events = append(*f.events, "owner-grant")
	}
	f.lastOrganizationCode = actor.OrganizationCode
	f.lastCurrentUserID = actor.UserID
	f.lastKnowledgeBaseCode = input.KnowledgeBaseCode
	f.lastOwnerUserID = input.OwnerUserID
	return f.err
}

func (f *fakeKnowledgeBaseOwnerGrantPort) GrantOwner(
	_ context.Context,
	actor kbaccess.Actor,
	knowledgeBaseCode string,
	ownerUserID string,
) error {
	f.lastOrganizationCode = actor.OrganizationCode
	f.lastCurrentUserID = actor.UserID
	f.lastKnowledgeBaseCode = knowledgeBaseCode
	f.lastOwnerUserID = ownerUserID
	return f.err
}

func (f *fakeKnowledgeBaseOwnerGrantPort) Cleanup(context.Context, kbaccess.Actor, string) error {
	return nil
}

type fakeThirdPlatformExpander struct {
	results              []*docentity.File
	nodes                []thirdplatform.TreeNode
	nodesByParent        map[string][]thirdplatform.TreeNode
	knowledgeBases       []thirdplatform.KnowledgeBaseItem
	resolveResult        *thirdplatform.DocumentResolveResult
	resolveResultByFile  map[string]*thirdplatform.DocumentResolveResult
	err                  error
	knowledgeBasesErr    error
	errByUser            map[string]error
	errByThirdFileID     map[string]error
	lastOrganizationCode string
	lastUserID           string
	lastDocumentFiles    []map[string]any
	lastResolveInput     *thirdplatform.DocumentResolveInput
	lastParentType       string
	lastParentRef        string
	parentCalls          []string
}

func (f *fakeThirdPlatformExpander) Expand(_ context.Context, organizationCode, userID string, documentFiles []map[string]any) ([]*docentity.File, error) {
	f.lastOrganizationCode = organizationCode
	f.lastUserID = userID
	f.lastDocumentFiles = make([]map[string]any, 0, len(documentFiles))
	for _, documentFile := range documentFiles {
		f.lastDocumentFiles = append(f.lastDocumentFiles, maps.Clone(documentFile))
	}
	if err, ok := f.errByUser[userID]; ok && err != nil {
		return nil, err
	}
	if f.err != nil {
		return nil, f.err
	}
	return f.results, nil
}

func (f *fakeThirdPlatformExpander) Resolve(
	_ context.Context,
	input thirdplatform.DocumentResolveInput,
) (*thirdplatform.DocumentResolveResult, error) {
	f.lastOrganizationCode = input.OrganizationCode
	f.lastUserID = input.UserID
	clonedInput := input
	clonedInput.DocumentFile = maps.Clone(input.DocumentFile)
	f.lastResolveInput = &clonedInput
	if err, ok := f.errByThirdFileID[input.ThirdFileID]; ok && err != nil {
		return nil, err
	}
	if err, ok := f.errByUser[input.UserID]; ok && err != nil {
		return nil, err
	}
	if f.err != nil {
		return nil, f.err
	}
	if resolved, ok := f.resolveResultByFile[input.ThirdFileID]; ok && resolved != nil {
		clonedResult := *resolved
		clonedResult.DownloadURLs = append([]string(nil), resolved.DownloadURLs...)
		clonedResult.DocumentFile = maps.Clone(resolved.DocumentFile)
		return &clonedResult, nil
	}
	if f.resolveResult != nil {
		clonedResult := *f.resolveResult
		clonedResult.DownloadURLs = append([]string(nil), f.resolveResult.DownloadURLs...)
		clonedResult.DocumentFile = maps.Clone(f.resolveResult.DocumentFile)
		return &clonedResult, nil
	}
	if len(f.results) == 0 || f.results[0] == nil {
		return &thirdplatform.DocumentResolveResult{}, nil
	}
	return &thirdplatform.DocumentResolveResult{
		DocumentFile: serviceDocumentFileToMap(f.results[0]),
	}, nil
}

func (f *fakeThirdPlatformExpander) ListKnowledgeBases(context.Context, thirdplatform.KnowledgeBaseListInput) ([]thirdplatform.KnowledgeBaseItem, error) {
	if f.knowledgeBasesErr != nil {
		return nil, f.knowledgeBasesErr
	}
	return append([]thirdplatform.KnowledgeBaseItem(nil), f.knowledgeBases...), nil
}

func (f *fakeThirdPlatformExpander) ListTreeNodes(
	_ context.Context,
	input thirdplatform.TreeNodeListInput,
) ([]thirdplatform.TreeNode, error) {
	f.lastOrganizationCode = input.OrganizationCode
	f.lastUserID = input.UserID
	f.lastParentType = input.ParentType
	f.lastParentRef = input.ParentRef
	f.parentCalls = append(f.parentCalls, input.ParentType+":"+input.ParentRef)
	if err, ok := f.errByUser[input.UserID]; ok && err != nil {
		return nil, err
	}
	if f.err != nil {
		return nil, f.err
	}
	if len(f.nodesByParent) > 0 {
		return append([]thirdplatform.TreeNode(nil), f.nodesByParent[input.ParentType+":"+input.ParentRef]...), nil
	}
	if len(f.nodes) > 0 {
		return append([]thirdplatform.TreeNode(nil), f.nodes...), nil
	}
	return deriveThirdPlatformNodesFromFiles(input.ParentType, input.ParentRef, f.results), nil
}

func serviceDocumentFileToMap(file *docentity.File) map[string]any {
	if file == nil {
		return nil
	}
	return map[string]any{
		"type":              file.Type,
		"name":              file.Name,
		"url":               file.URL,
		"file_key":          file.FileKey,
		"size":              file.Size,
		"extension":         firstNonEmpty(file.Extension, "md"),
		"third_id":          file.ThirdID,
		"third_file_id":     file.ThirdID,
		"source_type":       file.SourceType,
		"knowledge_base_id": file.KnowledgeBaseID,
	}
}

func deriveThirdPlatformNodesFromFiles(parentType, parentRef string, files []*docentity.File) []thirdplatform.TreeNode {
	nodes := make([]thirdplatform.TreeNode, 0, len(files))
	for _, file := range files {
		if file == nil {
			continue
		}
		knowledgeBaseID := file.KnowledgeBaseID
		if knowledgeBaseID == "" && parentType == "knowledge_base" {
			knowledgeBaseID = parentRef
		}
		nodes = append(nodes, thirdplatform.TreeNode{
			KnowledgeBaseID: knowledgeBaseID,
			ThirdFileID:     file.ThirdID,
			ParentID:        parentRef,
			Name:            file.Name,
			Extension:       firstNonEmpty(file.Extension, "md"),
			IsDirectory:     false,
		})
	}
	return nodes
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func localUploadSourceBinding(documentFile *docfilehelper.DocumentFileDTO) kbdto.SourceBindingInput {
	rawDocumentFile := map[string]any{}
	if documentFile != nil {
		rawDocumentFile = map[string]any{
			"type":        documentFile.Type,
			"name":        documentFile.Name,
			"url":         documentFile.URL,
			"size":        documentFile.Size,
			"extension":   documentFile.Extension,
			"third_id":    documentFile.ThirdID,
			"source_type": documentFile.SourceType,
			"key":         documentFile.Key,
		}
		if documentFile.FileLink != nil {
			rawDocumentFile["file_link"] = map[string]any{"url": documentFile.FileLink.URL}
		}
	}
	rootRef := ""
	if documentFile != nil {
		rootRef = firstNonEmptyString(documentFile.URL, documentFile.Key, documentFile.Name)
	}
	return kbdto.SourceBindingInput{
		Provider: sourcebindingdomain.ProviderLocalUpload,
		RootType: sourcebindingdomain.RootTypeFile,
		RootRef:  rootRef,
		SyncConfig: map[string]any{
			"document_file": rawDocumentFile,
		},
	}
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func assertEventSequence(t *testing.T, got, want []string) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("unexpected event count: got=%v want=%v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("unexpected event sequence at %d: got=%v want=%v", i, got, want)
		}
	}
}

func cloneManagedSyncInput(input *service.SyncDocumentInput) *service.SyncDocumentInput {
	if input == nil {
		return nil
	}
	cloned := *input
	if input.BusinessParams != nil {
		businessParams := *input.BusinessParams
		cloned.BusinessParams = &businessParams
	}
	return &cloned
}

func cloneManagedCreateInput(input *service.CreateManagedDocumentInput) *service.CreateManagedDocumentInput {
	if input == nil {
		return nil
	}

	cloned := *input
	if input.DocumentFile != nil {
		documentFile := *input.DocumentFile
		cloned.DocumentFile = &documentFile
	}
	if input.DocMetadata != nil {
		docMetadata := make(map[string]any, len(input.DocMetadata))
		maps.Copy(docMetadata, input.DocMetadata)
		cloned.DocMetadata = docMetadata
	}
	return &cloned
}

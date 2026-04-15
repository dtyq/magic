package kbapp_test

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"testing"

	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	service "magic/internal/application/knowledge/knowledgebase/service"
	documentdomain "magic/internal/domain/knowledge/document/service"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/service"
	"magic/internal/pkg/thirdplatform"
)

var (
	errCreateDoc2     = errors.New("create doc-2 failed")
	errNotImplemented = errors.New("not implemented")
	errGrantOwner     = errors.New("grant owner failed")
)

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

func TestKnowledgeBaseCreate_WithThirdPlatformSourceBindingUsesExpandedDocumentFile(t *testing.T) {
	t.Parallel()

	events := []string{}
	domainSvc := &fakeKnowledgeBaseDomainService{events: &events, effectiveModel: "text-embedding-3-small"}
	documentManager := &fakeKnowledgeBaseDocumentManager{events: &events}
	svc := service.NewKnowledgeBaseAppServiceForTest(t, domainSvc, documentManager, nil, nil, "text-embedding-3-small")
	svc.SetSourceBindingRepository(&fakeSourceBindingRepository{})
	svc.SetThirdPlatformExpander(&fakeThirdPlatformExpander{
		results: []*documentdomain.File{{
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

func TestKnowledgeBaseCreate_WithExistingBusinessIDReturnsConflict(t *testing.T) {
	t.Parallel()

	events := []string{}
	sourceType := int(knowledgebasedomain.SourceTypeLocalFile)
	existing := &knowledgebasedomain.KnowledgeBase{
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
		listKBS:        []*knowledgebasedomain.KnowledgeBase{existing},
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

func TestKnowledgeBaseCreate_GrantsOwnerAfterSourceBindings(t *testing.T) {
	t.Parallel()

	events := []string{}
	domainSvc := &fakeKnowledgeBaseDomainService{events: &events, effectiveModel: "text-embedding-3-small"}
	documentManager := &fakeKnowledgeBaseDocumentManager{events: &events}
	ownerGrantPort := &fakeKnowledgeBaseOwnerGrantPort{events: &events}
	svc := service.NewKnowledgeBaseAppServiceForTest(t, domainSvc, documentManager, nil, nil, "text-embedding-3-small")
	svc.SetSourceBindingRepository(&fakeSourceBindingRepository{})
	svc.SetOwnerGrantPort(ownerGrantPort)

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
		"doc-create:doc-1.md",
		"doc-sync:doc-1.md-code",
		"owner-grant",
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
	svc.SetOwnerGrantPort(ownerGrantPort)

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
		"doc-create:doc-1.md",
		"doc-sync:doc-1.md-code",
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
	showKB         *knowledgebasedomain.KnowledgeBase
	listKBS        []*knowledgebasedomain.KnowledgeBase
	updatedKB      *knowledgebasedomain.KnowledgeBase
}

func (f *fakeKnowledgeBaseDomainService) PrepareForSave(_ context.Context, kb *knowledgebasedomain.KnowledgeBase) error {
	*f.events = append(*f.events, "kb-prepare-save")
	if kb.ID == 0 {
		kb.ID = 1
	}
	return nil
}

func (f *fakeKnowledgeBaseDomainService) Save(_ context.Context, kb *knowledgebasedomain.KnowledgeBase) error {
	*f.events = append(*f.events, "kb-save")
	if kb.ID == 0 {
		kb.ID = 1
	}
	return nil
}

func (f *fakeKnowledgeBaseDomainService) Update(_ context.Context, kb *knowledgebasedomain.KnowledgeBase) error {
	*f.events = append(*f.events, "kb-update")
	f.updatedKB = cloneKnowledgeBase(kb)
	return nil
}

func (f *fakeKnowledgeBaseDomainService) UpdateProgress(context.Context, *knowledgebasedomain.KnowledgeBase) error {
	return nil
}

func (f *fakeKnowledgeBaseDomainService) ShowByCodeAndOrg(context.Context, string, string) (*knowledgebasedomain.KnowledgeBase, error) {
	if f.showKB != nil {
		return cloneKnowledgeBase(f.showKB), nil
	}
	return nil, errNotImplemented
}

func (f *fakeKnowledgeBaseDomainService) List(context.Context, *knowledgebasedomain.Query) ([]*knowledgebasedomain.KnowledgeBase, int64, error) {
	if f.listKBS != nil {
		items := make([]*knowledgebasedomain.KnowledgeBase, 0, len(f.listKBS))
		for _, kb := range f.listKBS {
			items = append(items, cloneKnowledgeBase(kb))
		}
		return items, int64(len(items)), nil
	}
	return nil, 0, errNotImplemented
}

func (f *fakeKnowledgeBaseDomainService) Destroy(_ context.Context, _ *knowledgebasedomain.KnowledgeBase) error {
	*f.events = append(*f.events, "kb-destroy")
	return nil
}

func (f *fakeKnowledgeBaseDomainService) DeleteVectorData(context.Context, *knowledgebasedomain.KnowledgeBase) error {
	return nil
}

func (f *fakeKnowledgeBaseDomainService) ResolveRuntimeRoute(_ context.Context, kb *knowledgebasedomain.KnowledgeBase) sharedroute.ResolvedRoute {
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
	events *[]string
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

func (f *fakeSourceBindingRepository) DeleteBindingsByKnowledgeBase(context.Context, string) error {
	if f.events != nil {
		*f.events = append(*f.events, "binding-delete")
	}
	return nil
}

func (f *fakeSourceBindingRepository) ListBindingsByKnowledgeBase(context.Context, string) ([]sourcebindingdomain.Binding, error) {
	return nil, nil
}

func (f *fakeSourceBindingRepository) ListRealtimeProjectBindingsByProject(context.Context, string, int64) ([]sourcebindingdomain.Binding, error) {
	return nil, nil
}

func (f *fakeSourceBindingRepository) UpsertSourceItem(_ context.Context, item sourcebindingdomain.SourceItem) (*sourcebindingdomain.SourceItem, error) {
	item.ID = 1
	return &item, nil
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

func (f *fakeKnowledgeBaseOwnerGrantPort) GrantKnowledgeBaseOwner(
	_ context.Context,
	organizationCode string,
	currentUserID string,
	knowledgeBaseCode string,
	ownerUserID string,
) error {
	if f.events != nil {
		*f.events = append(*f.events, "owner-grant")
	}
	f.lastOrganizationCode = organizationCode
	f.lastCurrentUserID = currentUserID
	f.lastKnowledgeBaseCode = knowledgeBaseCode
	f.lastOwnerUserID = ownerUserID
	return f.err
}

func (f *fakeKnowledgeBaseOwnerGrantPort) DeleteKnowledgeBasePermissions(
	context.Context,
	string,
	string,
	string,
) error {
	return nil
}

type fakeThirdPlatformExpander struct {
	results              []*documentdomain.File
	err                  error
	errByUser            map[string]error
	lastOrganizationCode string
	lastUserID           string
	lastDocumentFiles    []map[string]any
}

func (f *fakeThirdPlatformExpander) Expand(_ context.Context, organizationCode, userID string, documentFiles []map[string]any) ([]*documentdomain.File, error) {
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

func (f *fakeThirdPlatformExpander) ListKnowledgeBases(context.Context, string, string) ([]thirdplatform.KnowledgeBaseItem, error) {
	return nil, nil
}

func (f *fakeThirdPlatformExpander) ListTreeNodes(context.Context, string, string, string, string) ([]thirdplatform.TreeNode, error) {
	return nil, nil
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

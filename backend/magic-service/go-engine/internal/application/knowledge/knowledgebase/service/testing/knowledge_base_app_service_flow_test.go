package kbapp_test

import (
	"context"
	"encoding/json"
	"errors"
	"maps"
	"reflect"
	"strings"
	"testing"

	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	pagehelper "magic/internal/application/knowledge/helper/page"
	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	service "magic/internal/application/knowledge/knowledgebase/service"
	autoloadcfg "magic/internal/config/autoload"
	kbaccess "magic/internal/domain/knowledge/access/service"
	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingrepository "magic/internal/domain/knowledge/sourcebinding/repository"
	taskfiledomain "magic/internal/domain/taskfile/service"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/projectfile"
	thirdfilemappingpkg "magic/internal/pkg/thirdfilemapping"
	"magic/internal/pkg/thirdplatform"
)

const (
	testAppKnowledgeBaseCode  = "KB-1"
	testAppKnowledgeBaseCode2 = "KB-2"
	testSyncModeCreate        = "create"
	effectiveEmbeddingModel   = "text-embedding-3-large"
	testKnowledgeBaseUpdater  = "kb-updater"
	testOrganizationCode1     = "ORG-1"
	testOrganizationCode2     = "ORG-2"
	testTeamshareKnowledgeID  = "TS-KB-1"
)

var (
	errCreateDocumentFailed     = errors.New("create document failed")
	errDestroyDocumentFailed    = errors.New("destroy document failed")
	errKnowledgeBaseLookupTest  = errors.New("knowledge base lookup failed")
	errVectorDeleteFailed       = errors.New("vector delete failed")
	errDestroyCoordinatorFailed = errors.New("destroy coordinator failed")
	errStatsFailed              = errors.New("stats failed")
	errOwnerGrantFailed         = errors.New("owner grant failed")
	errBindingLookupFailed      = errors.New("binding lookup failed")
	errTeamshareFilePermission  = errors.New("PHP RPC request failed: code=500, message=组织对但是没有文件权限，你需要申请文件权限")
	errTaskFileReaderBoom       = errors.New("task file reader boom")
)

func TestKnowledgeBaseAppServiceCreateSchedulesDocumentSync(t *testing.T) {
	t.Parallel()

	events := []string{}
	domain := &recordingKnowledgeBaseDomainService{effectiveModel: effectiveEmbeddingModel, events: &events}
	docManager := &recordingKnowledgeBaseDocumentManager{
		createResults: []*service.ManagedDocument{
			{Code: "DOC-1"},
			{Code: "DOC-2"},
		},
		events: &events,
	}
	ownerGrantPort := &recordingKnowledgeBaseOwnerGrantPort{events: &events}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, docManager, nil, nil, effectiveEmbeddingModel)
	app.SetSourceBindingRepository(&fakeSourceBindingRepository{})
	app.SetKnowledgeBasePermissionWriter(ownerGrantPort)

	file := &docfilehelper.DocumentFileDTO{
		Name:       "doc-1.md",
		URL:        "https://example.com/doc-1",
		Key:        "org/doc-1.md",
		SourceType: sourcebindingdomain.ProviderLocalUpload,
	}
	input := &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Name:             "知识库",
		Description:      "desc",
		Type:             1,
		Model:            "text-embedding-3-small",
		VectorDB:         " ",
		EmbeddingConfig:  &confighelper.EmbeddingConfig{ModelID: "text-embedding-3-small"},
		SourceBindings: []kbdto.SourceBindingInput{
			localUploadSourceBinding(file),
			localUploadSourceBinding(&docfilehelper.DocumentFileDTO{Name: "  doc-2.md  ", URL: "org/doc-2.md", Key: "org/doc-2.md"}),
		},
	}

	result, err := app.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	assertCreateSchedulesDocumentSyncResult(t, result, domain, docManager, file, events)
}

func assertCreateSchedulesDocumentSyncResult(
	t *testing.T,
	result *kbdto.KnowledgeBaseDTO,
	domain *recordingKnowledgeBaseDomainService,
	docManager *recordingKnowledgeBaseDocumentManager,
	file *docfilehelper.DocumentFileDTO,
	events []string,
) {
	t.Helper()

	if result == nil {
		t.Fatal("expected result not nil")
	}
	if result.UserOperation != 1 {
		t.Fatalf("expected create result user_operation=1, got %#v", result)
	}
	if domain.savedKB == nil {
		t.Fatal("expected domain Save to receive knowledge base")
	}
	if !strings.HasPrefix(domain.savedKB.Code, service.KnowledgeBaseCodePrefixForTest()+"-") {
		t.Fatalf("expected generated code prefix, got %q", domain.savedKB.Code)
	}
	if domain.savedKB.VectorDB != service.DefaultKnowledgeBaseVectorDBForTest() {
		t.Fatalf("expected default vector db %q, got %q", service.DefaultKnowledgeBaseVectorDBForTest(), domain.savedKB.VectorDB)
	}
	if domain.savedKB.Model != effectiveEmbeddingModel {
		t.Fatalf("expected effective model %q before save, got %q", effectiveEmbeddingModel, domain.savedKB.Model)
	}
	if domain.savedKB.EmbeddingConfig == nil || domain.savedKB.EmbeddingConfig.ModelID != effectiveEmbeddingModel {
		t.Fatalf("expected embedding config model %q, got %#v", effectiveEmbeddingModel, domain.savedKB.EmbeddingConfig)
	}
	if len(docManager.createInputs) != 2 {
		t.Fatalf("expected 2 create document calls, got %d", len(docManager.createInputs))
	}
	if len(docManager.syncInputs) != 2 {
		t.Fatalf("expected 2 scheduled syncs, got %d", len(docManager.syncInputs))
	}
	expectedEvents := []string{
		"kb-save",
		"owner-grant",
		"doc-create:doc-1.md",
		"doc-create:doc-2.md",
		"doc-sync:DOC-1",
		"doc-sync:DOC-2",
	}
	if !reflect.DeepEqual(events, expectedEvents) {
		t.Fatalf("expected create call sequence %#v, got %#v", expectedEvents, events)
	}
	if docManager.createInputs[0].KnowledgeBaseCode != domain.savedKB.Code {
		t.Fatalf("expected document create to use generated kb code %q, got %q", domain.savedKB.Code, docManager.createInputs[0].KnowledgeBaseCode)
	}
	if docManager.createInputs[1].Name != "doc-2.md" {
		t.Fatalf("expected trimmed document name, got %q", docManager.createInputs[1].Name)
	}
	if docManager.syncInputs[0].Mode != testSyncModeCreate {
		t.Fatalf("expected sync mode=create, got %q", docManager.syncInputs[0].Mode)
	}

	file.Name = "mutated"
	file.URL = "https://example.com/mutated"
	assertCreateDocumentFileCloned(t, docManager.createInputs[0].DocumentFile, "doc-1.md", "https://example.com/doc-1")
}

func TestKnowledgeBaseAppServiceCreateWithoutDocumentManagerRollsBack(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{effectiveModel: effectiveEmbeddingModel}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetSourceBindingRepository(&fakeSourceBindingRepository{})

	_, err := app.Create(context.Background(), &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Name:             "知识库",
		Type:             1,
		SourceBindings:   []kbdto.SourceBindingInput{localUploadSourceBinding(&docfilehelper.DocumentFileDTO{Name: "doc.md", URL: "org/doc.md", Key: "org/doc.md"})},
	})
	if !errors.Is(err, service.ErrKnowledgeBaseDocumentManagerRequired) {
		t.Fatalf("expected ErrKnowledgeBaseDocumentManagerRequired, got %v", err)
	}
	if domain.destroyedKB == nil {
		t.Fatal("expected rollback destroy to be called")
	}
}

func TestKnowledgeBaseAppServiceCreateRollsBackCreatedDocumentsOnFailure(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{effectiveModel: effectiveEmbeddingModel}
	docManager := &recordingKnowledgeBaseDocumentManager{
		createResults: []*service.ManagedDocument{{Code: "DOC-1"}},
		createErrAt:   1,
		createErr:     errCreateDocumentFailed,
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, docManager, nil, nil, "")
	app.SetSourceBindingRepository(&fakeSourceBindingRepository{})

	_, err := app.Create(context.Background(), &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Name:             "知识库",
		Type:             1,
		SourceBindings: []kbdto.SourceBindingInput{
			localUploadSourceBinding(&docfilehelper.DocumentFileDTO{Name: "doc-1.md", URL: "org/doc-1.md", Key: "org/doc-1.md"}),
			localUploadSourceBinding(&docfilehelper.DocumentFileDTO{Name: "doc-2.md", URL: "org/doc-2.md", Key: "org/doc-2.md"}),
		},
	})
	if err == nil || !strings.Contains(err.Error(), "failed to create knowledge base document") {
		t.Fatalf("expected wrapped create document error, got %v", err)
	}
	if len(docManager.destroyInputs) != 1 {
		t.Fatalf("expected one created document to be rolled back, got %d", len(docManager.destroyInputs))
	}
	if docManager.destroyInputs[0].code != "DOC-1" {
		t.Fatalf("expected rolled back document DOC-1, got %q", docManager.destroyInputs[0].code)
	}
	if domain.destroyedKB == nil {
		t.Fatal("expected knowledge base rollback destroy")
	}
	if len(docManager.syncInputs) != 0 {
		t.Fatalf("expected no sync scheduling on failure, got %d", len(docManager.syncInputs))
	}
}

func TestKnowledgeBaseAppServiceCreateRequiresEffectiveEmbeddingModel(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")

	_, err := app.Create(context.Background(), &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Name:             "知识库",
		Type:             1,
	})
	if !errors.Is(err, service.ErrEmbeddingModelRequired) {
		t.Fatalf("expected ErrEmbeddingModelRequired, got %v", err)
	}
	if domain.savedKB != nil {
		t.Fatalf("expected save to be skipped, got %#v", domain.savedKB)
	}
}

func TestKnowledgeBaseAppServiceCreateRejectsUnmanageableSuperMagicAgent(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{effectiveModel: effectiveEmbeddingModel}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetSuperMagicAgentReader(&recordingSuperMagicAgentReader{
		existingIDs:   map[string]struct{}{"1": {}, "2": {}},
		manageableIDs: map[string]struct{}{"1": {}},
	})

	sourceType := 1
	_, err := app.Create(context.Background(), &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Name:             "数字员工知识库",
		Type:             1,
		SourceType:       &sourceType,
		AgentCodes:       []string{"1", "2"},
	})
	if !errors.Is(err, service.ErrSuperMagicAgentNotManageable) {
		t.Fatalf("expected ErrSuperMagicAgentNotManageable, got %v", err)
	}
	if !strings.Contains(err.Error(), "2") {
		t.Fatalf("expected error to contain unmanageable agent id, got %v", err)
	}
}

func TestKnowledgeBaseAppServiceUpdateUsesExistingAgentBindings(t *testing.T) {
	t.Parallel()

	sourceType := 1
	inputSourceType := int(kbentity.SourceTypeEnterpriseWiki)
	domain := &recordingKnowledgeBaseDomainService{
		effectiveModel: effectiveEmbeddingModel,
		showKB: &kbentity.KnowledgeBase{
			ID:                99,
			Code:              testAppKnowledgeBaseCode,
			Name:              "数字员工知识库",
			OrganizationCode:  "ORG-1",
			SourceType:        &sourceType,
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetKnowledgeBaseBindingRepository(&recordingKnowledgeBaseBindingRepository{
		bindIDsByKnowledgeBase: map[string][]string{testAppKnowledgeBaseCode: {"1"}},
	})

	result, err := app.Update(context.Background(), &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Code:             testAppKnowledgeBaseCode,
		Name:             "更新名称",
		SourceType:       &inputSourceType,
	})
	if err != nil {
		t.Fatalf("expected update success, got %v", err)
	}
	if result == nil || result.Code != testAppKnowledgeBaseCode {
		t.Fatalf("unexpected result: %#v", result)
	}
	if domain.updatedKB == nil || domain.updatedKB.SourceType == nil || *domain.updatedKB.SourceType != sourceType {
		t.Fatalf("expected source_type preserved, got %#v", domain.updatedKB)
	}
}

func TestKnowledgeBaseAppServiceCreateUsesResolvedRoute(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		effectiveModel:     effectiveEmbeddingModel,
		resolvedCollection: "shared_collection",
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")

	result, err := app.Create(context.Background(), &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Name:             "知识库",
		Type:             1,
	})
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if result == nil {
		t.Fatal("expected result not nil")
	}
	if domain.resolveRuntimeRouteCalls != 1 {
		t.Fatalf("expected one route resolution, got %d", domain.resolveRuntimeRouteCalls)
	}
	if domain.savedKB == nil || domain.savedResolvedVectorCollectionName != "shared_collection" {
		t.Fatalf("expected saved kb to carry resolved vector collection, got saved=%#v resolved_collection=%q", domain.savedKB, domain.savedResolvedVectorCollectionName)
	}
}

func TestKnowledgeBaseAppServiceCreateRollsBackViaStableDestroyWhenOwnerGrantFails(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		effectiveModel: effectiveEmbeddingModel,
	}
	destroyCoordinator := &recordingDestroyCoordinator{}
	ownerGrantPort := &recordingKnowledgeBaseOwnerGrantPort{err: errOwnerGrantFailed}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetDestroyCoordinator(destroyCoordinator)
	app.SetKnowledgeBasePermissionWriter(ownerGrantPort)

	_, err := app.Create(context.Background(), &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Name:             "知识库",
		Type:             1,
	})
	if !errors.Is(err, errOwnerGrantFailed) {
		t.Fatalf("expected owner grant error, got %v", err)
	}
	if ownerGrantPort.lastKnowledgeBaseCode == "" {
		t.Fatal("expected owner grant to receive generated knowledge base code")
	}
	if domain.deletedVectorKB == nil || domain.deletedVectorKB.Code == "" {
		t.Fatalf("expected vector delete rollback, got %#v", domain.deletedVectorKB)
	}
	if destroyCoordinator.destroyedKnowledgeBaseCode == "" {
		t.Fatal("expected destroy coordinator rollback")
	}
	if destroyCoordinator.destroyedKnowledgeBaseCode != ownerGrantPort.lastKnowledgeBaseCode {
		t.Fatalf("expected rollback code %q, got %q", ownerGrantPort.lastKnowledgeBaseCode, destroyCoordinator.destroyedKnowledgeBaseCode)
	}
	if domain.destroyedKB != nil {
		t.Fatalf("expected stable rollback path not plain domain destroy, got %#v", domain.destroyedKB)
	}
}

func TestKnowledgeBaseAppServiceCreateWithProjectBindingsSelected(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{effectiveModel: effectiveEmbeddingModel}
	docManager := &recordingKnowledgeBaseDocumentManager{}
	sourceBindingRepo := &recordingSourceBindingRepository{}
	projectFileResolver := &projectFileResolverStub{
		resolveResults: map[int64]*projectfile.ResolveResult{
			11: {
				Status:           "active",
				OrganizationCode: "ORG-1",
				ProjectID:        100,
				ProjectFileID:    11,
				FileName:         "selected-1.md",
				Content:          "content-11",
				ContentHash:      "hash-11",
				DocType:          1,
				DocumentFile:     map[string]any{"type": "external", "name": "selected-1.md", "url": "project://11", "extension": "md"},
			},
			22: {
				Status:           "active",
				OrganizationCode: "ORG-1",
				ProjectID:        100,
				ProjectFileID:    22,
				FileName:         "selected-2.md",
				Content:          "content-22",
				ContentHash:      "hash-22",
				DocType:          1,
				DocumentFile:     map[string]any{"type": "external", "name": "selected-2.md", "url": "project://22", "extension": "md"},
			},
		},
	}

	sourceType := int(kbentity.SourceTypeProject)
	app := newProjectBindingCreateApp(t, domain, docManager, sourceBindingRepo, projectFileResolver)
	_, err := app.Create(context.Background(), newProjectBindingCreateInput(&sourceType, "100", []kbdto.SourceBindingTargetInput{
		{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "11"},
		{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "22"},
	}))
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if len(sourceBindingRepo.lastReplaceBindings) != 1 {
		t.Fatalf("expected one source binding, got %d", len(sourceBindingRepo.lastReplaceBindings))
	}
	if got := sourceBindingRepo.lastReplaceBindings[0].Provider; got != sourcebindingdomain.ProviderProject {
		t.Fatalf("expected project provider, got %q", got)
	}
	if got := len(sourceBindingRepo.lastReplaceBindings[0].Targets); got != 2 {
		t.Fatalf("expected two selected targets, got %d", got)
	}
	if len(docManager.createInputs) != 2 {
		t.Fatalf("expected 2 managed project documents, got %d", len(docManager.createInputs))
	}
	if docManager.createInputs[0].AutoAdded || docManager.createInputs[1].AutoAdded {
		t.Fatalf("expected selected bindings not auto-added, got %#v", docManager.createInputs)
	}
	if got := projectFileResolver.resolveCalls; got != 0 {
		t.Fatalf("expected create path not to resolve project files synchronously, got %d calls", got)
	}
	if docManager.createInputs[0].ProjectID != 100 || docManager.createInputs[0].ProjectFileID != 11 {
		t.Fatalf("expected first managed document to keep project identity, got %#v", docManager.createInputs[0])
	}
	if len(docManager.syncInputs) != 2 || docManager.syncInputs[0].BusinessParams == nil || docManager.syncInputs[0].Mode != documentdomain.SyncModeCreate {
		t.Fatalf("expected create sync scheduling with business params, got %#v", docManager.syncInputs)
	}
}

func TestKnowledgeBaseAppServiceCreateWithProjectBindingsAll(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{effectiveModel: effectiveEmbeddingModel}
	docManager := &recordingKnowledgeBaseDocumentManager{}
	sourceBindingRepo := &recordingSourceBindingRepository{}
	projectFileResolver := &projectFileResolverStub{
		listByProjectResults: map[int64][]projectfile.ListItem{
			200: {
				{ProjectID: 200, ProjectFileID: 31},
				{ProjectID: 200, ProjectFileID: 32},
			},
		},
		resolveResults: map[int64]*projectfile.ResolveResult{
			31: {
				Status:           "active",
				OrganizationCode: "ORG-1",
				ProjectID:        200,
				ProjectFileID:    31,
				FileName:         "all-1.md",
				Content:          "content-31",
				ContentHash:      "hash-31",
				DocType:          1,
				DocumentFile:     map[string]any{"type": "external", "name": "all-1.md", "url": "project://31", "extension": "md"},
			},
			32: {
				Status:           "active",
				OrganizationCode: "ORG-1",
				ProjectID:        200,
				ProjectFileID:    32,
				FileName:         "all-2.md",
				Content:          "content-32",
				ContentHash:      "hash-32",
				DocType:          1,
				DocumentFile:     map[string]any{"type": "external", "name": "all-2.md", "url": "project://32", "extension": "md"},
			},
		},
	}

	sourceType := int(kbentity.SourceTypeProject)
	app := newProjectBindingCreateApp(t, domain, docManager, sourceBindingRepo, projectFileResolver)
	_, err := app.Create(context.Background(), newProjectBindingCreateInput(&sourceType, "200", nil))
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if projectFileResolver.listVisibleLeafFileIDsByProjectCalls != 1 {
		t.Fatalf("expected one visible project file listing call, got %d", projectFileResolver.listVisibleLeafFileIDsByProjectCalls)
	}
	if got := projectFileResolver.resolveCalls; got != 0 {
		t.Fatalf("expected whole-project create path not to resolve project files synchronously, got %d calls", got)
	}
	if len(docManager.createInputs) != 2 {
		t.Fatalf("expected 2 managed project documents, got %d", len(docManager.createInputs))
	}
	if !docManager.createInputs[0].AutoAdded || !docManager.createInputs[1].AutoAdded {
		t.Fatalf("expected all bindings to auto-add documents, got %#v", docManager.createInputs)
	}
}

func TestKnowledgeBaseAppServiceCreateWithProjectBindingsAllUnderHiddenRoot(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{effectiveModel: effectiveEmbeddingModel}
	docManager := &recordingKnowledgeBaseDocumentManager{}
	sourceBindingRepo := &recordingSourceBindingRepository{}
	projectFileResolver := &projectFileResolverStub{
		resolveResults: map[int64]*projectfile.ResolveResult{
			61: newResolvedProjectFile(600, 61, "root-visible.md"),
			62: newResolvedProjectFile(600, 62, "nested-visible.md"),
		},
	}
	taskFileSvc := taskfiledomain.NewDomainService(&hiddenRootTaskFileReaderStub{
		rootByProjectID: map[int64]*projectfile.Meta{
			600: {ProjectID: 600, ProjectFileID: 6000, IsDirectory: true, IsHidden: true},
		},
		childrenByParentBatch: map[int64][]*projectfile.Meta{
			6000: {
				{ProjectID: 600, ProjectFileID: 61, ParentID: 6000, FileName: "root-visible.md"},
				{ProjectID: 600, ProjectFileID: 6100, ParentID: 6000, FileName: "docs", IsDirectory: true},
			},
			6100: {
				{ProjectID: 600, ProjectFileID: 62, ParentID: 6100, FileName: "nested-visible.md"},
			},
		},
		metasByID: map[int64]*projectfile.Meta{
			61:   {ProjectID: 600, ProjectFileID: 61, ParentID: 6000, FileName: "root-visible.md"},
			62:   {ProjectID: 600, ProjectFileID: 62, ParentID: 6100, FileName: "nested-visible.md"},
			6100: {ProjectID: 600, ProjectFileID: 6100, ParentID: 6000, FileName: "docs", IsDirectory: true},
			6000: {ProjectID: 600, ProjectFileID: 6000, IsDirectory: true, IsHidden: true},
		},
	})

	sourceType := int(kbentity.SourceTypeProject)
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, docManager, nil, nil, effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	app.SetProjectFileResolver(projectFileResolver)
	app.SetTaskFileService(taskFileSvc)
	app.SetKnowledgeBaseBindingRepository(&recordingKnowledgeBaseBindingRepository{})
	app.SetSuperMagicAgentReader(&recordingSuperMagicAgentReader{
		existingIDs: map[string]struct{}{"1": {}},
	})

	_, err := app.Create(context.Background(), newProjectBindingCreateInput(&sourceType, "600", nil))
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if len(docManager.createInputs) != 2 {
		t.Fatalf("expected 2 managed project documents under hidden root, got %d", len(docManager.createInputs))
	}
	if got := projectFileResolver.resolveCalls; got != 0 {
		t.Fatalf("expected hidden-root create path not to resolve project files synchronously, got %d calls", got)
	}
	if docManager.createInputs[0].Name != "root-visible.md" || docManager.createInputs[1].Name != "nested-visible.md" {
		t.Fatalf("unexpected created documents: %#v", docManager.createInputs)
	}
}

func TestKnowledgeBaseAppServiceCreateWithProjectFolderBindingUnderHiddenRoot(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{effectiveModel: effectiveEmbeddingModel}
	docManager := &recordingKnowledgeBaseDocumentManager{}
	sourceBindingRepo := &recordingSourceBindingRepository{}
	projectFileResolver := &projectFileResolverStub{
		resolveResults: map[int64]*projectfile.ResolveResult{
			72: newResolvedProjectFile(700, 72, "folder-visible.md"),
		},
	}
	taskFileSvc := taskfiledomain.NewDomainService(&hiddenRootTaskFileReaderStub{
		rootByProjectID: map[int64]*projectfile.Meta{
			700: {ProjectID: 700, ProjectFileID: 7000, IsDirectory: true, IsHidden: true},
		},
		childrenByParentBatch: map[int64][]*projectfile.Meta{
			7200: {
				{ProjectID: 700, ProjectFileID: 72, ParentID: 7200, FileName: "folder-visible.md"},
			},
		},
		metasByID: map[int64]*projectfile.Meta{
			72:   {ProjectID: 700, ProjectFileID: 72, ParentID: 7200, FileName: "folder-visible.md"},
			7200: {ProjectID: 700, ProjectFileID: 7200, ParentID: 7000, FileName: "docs", IsDirectory: true},
			7000: {ProjectID: 700, ProjectFileID: 7000, IsDirectory: true, IsHidden: true},
		},
	})

	sourceType := int(kbentity.SourceTypeProject)
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, docManager, nil, nil, effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	app.SetProjectFileResolver(projectFileResolver)
	app.SetTaskFileService(taskFileSvc)
	app.SetKnowledgeBaseBindingRepository(&recordingKnowledgeBaseBindingRepository{})
	app.SetSuperMagicAgentReader(&recordingSuperMagicAgentReader{
		existingIDs: map[string]struct{}{"1": {}},
	})

	_, err := app.Create(context.Background(), newProjectBindingCreateInput(&sourceType, "700", []kbdto.SourceBindingTargetInput{
		{TargetType: sourcebindingdomain.TargetTypeFolder, TargetRef: "7200"},
	}))
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if len(docManager.createInputs) != 1 {
		t.Fatalf("expected 1 managed project document from hidden-root folder, got %d", len(docManager.createInputs))
	}
	if got := projectFileResolver.resolveCalls; got != 0 {
		t.Fatalf("expected hidden-root folder create path not to resolve project files synchronously, got %d calls", got)
	}
	if docManager.createInputs[0].Name != "folder-visible.md" {
		t.Fatalf("unexpected created document: %#v", docManager.createInputs[0])
	}
	if docManager.createInputs[0].AutoAdded {
		t.Fatalf("expected explicit folder selection not auto-added, got %#v", docManager.createInputs[0])
	}
}

func TestKnowledgeBaseAppServiceCreateWithProjectBindingsSkipsHiddenFiles(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{effectiveModel: effectiveEmbeddingModel}
	docManager := &recordingKnowledgeBaseDocumentManager{}
	sourceBindingRepo := &recordingSourceBindingRepository{}
	projectFileResolver := &projectFileResolverStub{
		resolveResults: map[int64]*projectfile.ResolveResult{
			41: {
				Status:           "active",
				OrganizationCode: "ORG-1",
				ProjectID:        300,
				ProjectFileID:    41,
				FileName:         "visible.md",
				Content:          "content-41",
				ContentHash:      "hash-41",
				DocType:          1,
				DocumentFile:     map[string]any{"type": "external", "name": "visible.md", "url": "project://41", "extension": "md"},
			},
			42: {
				Status:           "active",
				OrganizationCode: "ORG-1",
				ProjectID:        300,
				ProjectFileID:    42,
				FileName:         "hidden.md",
				Content:          "content-42",
				ContentHash:      "hash-42",
				DocType:          1,
				DocumentFile:     map[string]any{"type": "external", "name": "hidden.md", "url": "project://42", "extension": "md"},
			},
		},
		visibleFilesByID: map[int64]bool{
			41: true,
			42: false,
		},
	}

	sourceType := int(kbentity.SourceTypeProject)
	app := newProjectBindingCreateApp(t, domain, docManager, sourceBindingRepo, projectFileResolver)
	_, err := app.Create(context.Background(), newProjectBindingCreateInput(&sourceType, "300", []kbdto.SourceBindingTargetInput{
		{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "41"},
		{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "42"},
	}))
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if len(docManager.createInputs) != 1 {
		t.Fatalf("expected only visible file to materialize, got %d", len(docManager.createInputs))
	}
	if projectFileResolver.loadVisibleMetaCalls != 2 {
		t.Fatalf("expected explicit file targets to load visible meta twice, got %d", projectFileResolver.loadVisibleMetaCalls)
	}
	if got := projectFileResolver.resolveCalls; got != 0 {
		t.Fatalf("expected explicit file targets not to trigger synchronous resolve, got %d calls", got)
	}
	if docManager.createInputs[0].Name != "visible.md" {
		t.Fatalf("expected visible file 41, got %#v", docManager.createInputs[0])
	}
}

func TestKnowledgeBaseAppServiceCreateWithProjectBindingsSkipsUnsupportedFiles(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{effectiveModel: effectiveEmbeddingModel}
	docManager := &recordingKnowledgeBaseDocumentManager{}
	sourceBindingRepo := &recordingSourceBindingRepository{}
	projectFileResolver := &projectFileResolverStub{
		visibleMetasByID: map[int64]*projectfile.Meta{
			41: {Status: projectfile.ResolveStatusActive, OrganizationCode: "ORG-1", ProjectID: 300, ProjectFileID: 41, FileName: "visible.md"},
			42: {Status: projectfile.ResolveStatusActive, OrganizationCode: "ORG-1", ProjectID: 300, ProjectFileID: 42, FileName: "custom.svg", FileExtension: "svg"},
		},
	}

	sourceType := int(kbentity.SourceTypeProject)
	app := newProjectBindingCreateApp(t, domain, docManager, sourceBindingRepo, projectFileResolver)
	_, err := app.Create(context.Background(), newProjectBindingCreateInput(&sourceType, "300", []kbdto.SourceBindingTargetInput{
		{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "41"},
		{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "42"},
	}))
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if len(docManager.createInputs) != 1 {
		t.Fatalf("expected only supported file to materialize, got %#v", docManager.createInputs)
	}
	if got := projectFileResolver.resolveCalls; got != 0 {
		t.Fatalf("expected unsupported filtering to happen without synchronous resolve, got %d calls", got)
	}
	if docManager.createInputs[0].Name != "visible.md" {
		t.Fatalf("expected supported file 41, got %#v", docManager.createInputs[0])
	}
	if len(docManager.syncInputs) != 1 || docManager.syncInputs[0].Code == "" {
		t.Fatalf("expected one sync request for supported file, got %#v", docManager.syncInputs)
	}
}

func TestKnowledgeBaseAppServiceCreateWithProjectBindingsUsesBatchVisibleFileIDs(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{effectiveModel: effectiveEmbeddingModel}
	docManager := &recordingKnowledgeBaseDocumentManager{}
	sourceBindingRepo := &recordingSourceBindingRepository{}
	projectFileResolver := &projectFileResolverStub{
		resolveResults: map[int64]*projectfile.ResolveResult{
			41: newResolvedProjectFile(300, 41, "visible-41.md"),
			42: newResolvedProjectFile(300, 42, "visible-42.md"),
		},
		visibleLeafFileIDsByProject: map[int64][]int64{
			300: {41, 42},
		},
	}

	sourceType := int(kbentity.SourceTypeProject)
	app := newProjectBindingCreateApp(t, domain, docManager, sourceBindingRepo, projectFileResolver)
	_, err := app.Create(context.Background(), newProjectBindingCreateInput(&sourceType, "300", nil))
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if projectFileResolver.listVisibleLeafFileIDsByProjectCalls != 1 {
		t.Fatalf("expected one batch visible-file listing, got %d", projectFileResolver.listVisibleLeafFileIDsByProjectCalls)
	}
	if projectFileResolver.isVisibleFileCalls != 0 {
		t.Fatalf("expected project-wide materialization to trust batch visible-file result, got %d visibility rechecks", projectFileResolver.isVisibleFileCalls)
	}
	if projectFileResolver.loadVisibleMetaCalls != 2 {
		t.Fatalf("expected project-wide materialization to load visible meta for each file, got %d", projectFileResolver.loadVisibleMetaCalls)
	}
	if got := projectFileResolver.resolveCalls; got != 0 {
		t.Fatalf("expected project-wide materialization not to trigger synchronous resolve, got %d calls", got)
	}
	if len(docManager.createInputs) != 2 {
		t.Fatalf("expected two managed documents, got %#v", docManager.createInputs)
	}
}

func TestKnowledgeBaseAppServiceCreateWithProjectBindingsAllUnsupported(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{effectiveModel: effectiveEmbeddingModel}
	docManager := &recordingKnowledgeBaseDocumentManager{}
	sourceBindingRepo := &recordingSourceBindingRepository{}
	projectFileResolver := &projectFileResolverStub{
		visibleLeafFileIDsByProject: map[int64][]int64{
			300: {41, 42},
		},
		visibleMetasByID: map[int64]*projectfile.Meta{
			41: {Status: projectfile.ResolveStatusActive, OrganizationCode: "ORG-1", ProjectID: 300, ProjectFileID: 41, FileName: "custom-1.svg", FileExtension: "svg"},
			42: {Status: projectfile.ResolveStatusActive, OrganizationCode: "ORG-1", ProjectID: 300, ProjectFileID: 42, FileName: "custom-2.gif", FileExtension: "gif"},
		},
	}

	sourceType := int(kbentity.SourceTypeProject)
	app := newProjectBindingCreateApp(t, domain, docManager, sourceBindingRepo, projectFileResolver)
	_, err := app.Create(context.Background(), newProjectBindingCreateInput(&sourceType, "300", nil))
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if len(docManager.createInputs) != 0 {
		t.Fatalf("expected no managed documents for unsupported files, got %#v", docManager.createInputs)
	}
	if got := projectFileResolver.resolveCalls; got != 0 {
		t.Fatalf("expected all-unsupported create path not to trigger synchronous resolve, got %d calls", got)
	}
	if len(docManager.syncInputs) != 0 {
		t.Fatalf("expected no sync requests for unsupported files, got %#v", docManager.syncInputs)
	}
}

func TestKnowledgeBaseAppServiceUpdateWithProjectBindingsReconcilesDocuments(t *testing.T) {
	t.Parallel()

	scenario := newProjectBindingReconcileScenario(t)
	sourceBindings := []kbdto.SourceBindingInput{
		{
			Provider: sourcebindingdomain.ProviderProject,
			RootType: sourcebindingdomain.RootTypeProject,
			RootRef:  "300",
			SyncMode: sourcebindingdomain.SyncModeManual,
			Targets: []kbdto.SourceBindingTargetInput{
				{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "42"},
				{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "43"},
			},
		},
	}
	inputSourceType := int(kbentity.SourceTypeEnterpriseWiki)
	result, err := scenario.app.Update(context.Background(), &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-2",
		Code:             testAppKnowledgeBaseCode,
		SourceType:       &inputSourceType,
		SourceBindings:   &sourceBindings,
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if len(scenario.sourceBindingRepo.lastReplaceBindings) != 1 {
		t.Fatalf("expected one source binding replace, got %d", len(scenario.sourceBindingRepo.lastReplaceBindings))
	}
	if result == nil || len(result.SourceBindings) != 1 {
		t.Fatalf("expected update result to include source bindings, got %#v", result)
	}
	if !reflect.DeepEqual(result.SourceBindings[0].Targets, []kbdto.SourceBindingTargetDTO{
		{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "42"},
		{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "43"},
	}) {
		t.Fatalf("expected update result targets preserved, got %#v", result.SourceBindings[0].Targets)
	}
	assertProjectBindingReconcileResult(t, scenario.docManager, "user-2")
	if scenario.sourceBindingRepo.lastApplyInput.KnowledgeBaseCode != testAppKnowledgeBaseCode {
		t.Fatalf("expected incremental apply to persist updated bindings, got %#v", scenario.sourceBindingRepo.lastApplyInput)
	}
	assertKnowledgeBaseSourceType(t, scenario.domain.updatedKB, scenario.sourceType)
}

func TestKnowledgeBaseAppServiceUpdateWithProjectBindingsRollsBackAppliedBindingsOnCreateFailure(t *testing.T) {
	t.Parallel()

	scenario := newProjectBindingReconcileScenario(t)
	scenario.docManager.createErrAt = 0
	scenario.docManager.createErr = errCreateDocumentFailed

	sourceBindings := []kbdto.SourceBindingInput{{
		Provider: sourcebindingdomain.ProviderProject,
		RootType: sourcebindingdomain.RootTypeProject,
		RootRef:  "300",
		SyncMode: sourcebindingdomain.SyncModeManual,
		Targets: []kbdto.SourceBindingTargetInput{
			{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "42"},
			{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "43"},
		},
	}}
	inputSourceType := int(kbentity.SourceTypeEnterpriseWiki)
	_, err := scenario.app.Update(context.Background(), &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-2",
		Code:             testAppKnowledgeBaseCode,
		SourceType:       &inputSourceType,
		SourceBindings:   &sourceBindings,
	})
	if err == nil || !errors.Is(err, errCreateDocumentFailed) {
		t.Fatalf("expected create failure, got %v", err)
	}
	if len(scenario.sourceBindingRepo.applyInputs) != 2 {
		t.Fatalf("expected apply + rollback applies, got %#v", scenario.sourceBindingRepo.applyInputs)
	}
	if got := scenario.sourceBindingRepo.applyInputs[1].UpsertBindings; len(got) != 1 || got[0].Binding.ID != 11 {
		t.Fatalf("expected rollback to restore previous binding, got %#v", got)
	}
	if len(scenario.docManager.destroyInputs) != 0 {
		t.Fatalf("expected rollback before deleting legacy documents, got %#v", scenario.docManager.destroyInputs)
	}
	if len(scenario.domain.updatedKBs) != 2 {
		t.Fatalf("expected knowledge base update + rollback, got %#v", scenario.domain.updatedKBs)
	}
	if scenario.domain.updatedKBs[1] == nil || scenario.domain.updatedKBs[1].Name != "old" {
		t.Fatalf("expected rollback to restore previous knowledge base snapshot, got %#v", scenario.domain.updatedKBs[1])
	}
}

func TestKnowledgeBaseAppServiceUpdateWithProjectBindingsDestroysCreatedDocsOnceOnCreateFailure(t *testing.T) {
	t.Parallel()

	scenario := newProjectBindingReconcileScenario(t)
	scenario.docManager.listByKnowledgeBase = []*service.ManagedDocument{
		{Code: testRemovedProjectBindingDocumentCode, KnowledgeBaseCode: testAppKnowledgeBaseCode, ProjectID: 300, ProjectFileID: 41, SourceBindingID: 11, SourceItemID: 99},
	}
	scenario.sourceBindingRepo.listBindingItems = []sourcebindingdomain.BindingItem{
		{BindingID: 11, SourceItemID: 99, ResolveReason: "target"},
	}
	scenario.sourceBindingRepo.sourceItemIDs = nil
	scenario.sourceBindingRepo.nextSourceItemID = 0
	scenario.docManager.createResults = []*service.ManagedDocument{
		{Code: "DOC-42", KnowledgeBaseCode: testAppKnowledgeBaseCode},
	}
	scenario.docManager.createErrAt = 1
	scenario.docManager.createErr = errCreateDocumentFailed

	sourceBindings := []kbdto.SourceBindingInput{{
		Provider: sourcebindingdomain.ProviderProject,
		RootType: sourcebindingdomain.RootTypeProject,
		RootRef:  "300",
		SyncMode: sourcebindingdomain.SyncModeManual,
		Targets: []kbdto.SourceBindingTargetInput{
			{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "42"},
			{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "43"},
		},
	}}
	inputSourceType := int(kbentity.SourceTypeEnterpriseWiki)
	_, err := scenario.app.Update(context.Background(), &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-2",
		Code:             testAppKnowledgeBaseCode,
		SourceType:       &inputSourceType,
		SourceBindings:   &sourceBindings,
	})
	if err == nil || !errors.Is(err, errCreateDocumentFailed) {
		t.Fatalf("expected create failure, got %v", err)
	}
	if len(scenario.docManager.destroyInputs) != 1 {
		t.Fatalf("expected exactly one rollback destroy, got %#v", scenario.docManager.destroyInputs)
	}
	if scenario.docManager.destroyInputs[0].code != "DOC-42" {
		t.Fatalf("expected rollback to destroy created doc once, got %#v", scenario.docManager.destroyInputs)
	}
	if len(scenario.docManager.syncInputs) != 0 {
		t.Fatalf("expected no sync scheduling on create failure, got %#v", scenario.docManager.syncInputs)
	}
}

func TestKnowledgeBaseAppServiceUpdateWithProjectBindingsSchedulesRecoveryResyncOnDeleteFailure(t *testing.T) {
	t.Parallel()

	const (
		removedDocumentCode = testRemovedProjectBindingDocumentCode
		createdDocumentCode = "DOC-43"
	)

	scenario := newProjectBindingReconcileScenario(t)
	scenario.docManager.createResults = []*service.ManagedDocument{
		{Code: createdDocumentCode, KnowledgeBaseCode: testAppKnowledgeBaseCode},
	}
	scenario.docManager.destroyErrAt = 0
	scenario.docManager.destroyErr = errDestroyDocumentFailed

	sourceBindings := []kbdto.SourceBindingInput{{
		Provider: sourcebindingdomain.ProviderProject,
		RootType: sourcebindingdomain.RootTypeProject,
		RootRef:  "300",
		SyncMode: sourcebindingdomain.SyncModeManual,
		Targets: []kbdto.SourceBindingTargetInput{
			{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "42"},
			{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "43"},
		},
	}}
	inputSourceType := int(kbentity.SourceTypeEnterpriseWiki)
	_, err := scenario.app.Update(context.Background(), &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-2",
		Code:             testAppKnowledgeBaseCode,
		SourceType:       &inputSourceType,
		SourceBindings:   &sourceBindings,
	})
	if err == nil || !errors.Is(err, errDestroyDocumentFailed) {
		t.Fatalf("expected destroy failure, got %v", err)
	}
	if len(scenario.sourceBindingRepo.applyInputs) != 2 {
		t.Fatalf("expected apply + rollback applies, got %#v", scenario.sourceBindingRepo.applyInputs)
	}
	if len(scenario.docManager.destroyInputs) != 2 {
		t.Fatalf("expected failed delete + created-doc rollback destroy, got %#v", scenario.docManager.destroyInputs)
	}
	if scenario.docManager.destroyInputs[0].code != removedDocumentCode || scenario.docManager.destroyInputs[1].code != createdDocumentCode {
		t.Fatalf("unexpected destroy order during rollback, got %#v", scenario.docManager.destroyInputs)
	}
	if len(scenario.docManager.syncInputs) != 1 {
		t.Fatalf("expected one recovery resync, got %#v", scenario.docManager.syncInputs)
	}
	if scenario.docManager.syncInputs[0].Code != removedDocumentCode || scenario.docManager.syncInputs[0].Mode != documentdomain.SyncModeResync {
		t.Fatalf("expected recovery resync for removed doc, got %#v", scenario.docManager.syncInputs[0])
	}
	if len(scenario.domain.updatedKBs) != 2 || scenario.domain.updatedKBs[1] == nil || scenario.domain.updatedKBs[1].Name != "old" {
		t.Fatalf("expected rollback to restore previous knowledge base snapshot, got %#v", scenario.domain.updatedKBs)
	}
}

type projectBindingReconcileScenario struct {
	app               *service.KnowledgeBaseAppService
	domain            *recordingKnowledgeBaseDomainService
	docManager        *recordingKnowledgeBaseDocumentManager
	sourceBindingRepo *recordingSourceBindingRepository
	sourceType        int
}

const testRemovedProjectBindingDocumentCode = "DOC-41"

func newProjectBindingReconcileScenario(tb testing.TB) projectBindingReconcileScenario {
	tb.Helper()

	sourceType := int(kbentity.SourceTypeProject)
	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			ID:                99,
			Code:              testAppKnowledgeBaseCode,
			Name:              "old",
			OrganizationCode:  "ORG-1",
			SourceType:        &sourceType,
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		},
	}
	docManager := &recordingKnowledgeBaseDocumentManager{
		listByKnowledgeBase: []*service.ManagedDocument{
			{Code: testRemovedProjectBindingDocumentCode, KnowledgeBaseCode: testAppKnowledgeBaseCode, ProjectID: 300, ProjectFileID: 41, SourceBindingID: 11, SourceItemID: 99},
			{Code: "DOC-42", KnowledgeBaseCode: testAppKnowledgeBaseCode, ProjectID: 300, ProjectFileID: 42, SourceBindingID: 11, SourceItemID: 1},
		},
	}
	app, sourceBindingRepo := newProjectBindingUpdateApp(tb, domain, docManager, map[int64]*projectfile.ResolveResult{
		42: newResolvedProjectFile(300, 42, "keep-42.md"),
		43: newResolvedProjectFile(300, 43, "new-43.md"),
	})
	sourceBindingRepo.listBindings = []sourcebindingdomain.Binding{
		{
			ID:                11,
			OrganizationCode:  "ORG-1",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
			Provider:          sourcebindingdomain.ProviderProject,
			RootType:          sourcebindingdomain.RootTypeProject,
			RootRef:           "300",
			SyncMode:          sourcebindingdomain.SyncModeManual,
			Enabled:           true,
			Targets: []sourcebindingdomain.BindingTarget{
				{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "41"},
				{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "42"},
			},
		},
	}
	sourceBindingRepo.listBindingItems = []sourcebindingdomain.BindingItem{
		{BindingID: 11, SourceItemID: 99, ResolveReason: "target"},
		{BindingID: 11, SourceItemID: 1, ResolveReason: "target"},
	}
	sourceBindingRepo.sourceItemIDs = map[string]int64{"42": 1}
	sourceBindingRepo.nextSourceItemID = 1
	app.SetKnowledgeBaseBindingRepository(&recordingKnowledgeBaseBindingRepository{
		bindIDsByKnowledgeBase: map[string][]string{testAppKnowledgeBaseCode: {"1"}},
	})
	return projectBindingReconcileScenario{
		app:               app,
		domain:            domain,
		docManager:        docManager,
		sourceBindingRepo: sourceBindingRepo,
		sourceType:        sourceType,
	}
}

func assertProjectBindingReconcileResult(
	tb testing.TB,
	docManager *recordingKnowledgeBaseDocumentManager,
	expectedSyncUserID string,
) {
	tb.Helper()

	if len(docManager.destroyInputs) != 1 || docManager.destroyInputs[0].code != testRemovedProjectBindingDocumentCode {
		tb.Fatalf("expected only removed project doc to be deleted, got %#v", docManager.destroyInputs)
	}
	if len(docManager.destroyKnowledgeBaseInputs) != 0 {
		tb.Fatalf("expected no knowledge-base-wide rebuild destroy, got %#v", docManager.destroyKnowledgeBaseInputs)
	}
	if len(docManager.createInputs) != 1 || docManager.createInputs[0].SourceItemID != 2 {
		tb.Fatalf("expected only new project document to be created, got %#v", docManager.createInputs)
	}
	if len(docManager.syncInputs) != 1 || docManager.syncInputs[0].Mode != documentdomain.SyncModeCreate {
		tb.Fatalf("expected create sync only for new document, got %#v", docManager.syncInputs)
	}
	if docManager.syncInputs[0].BusinessParams == nil || docManager.syncInputs[0].BusinessParams.UserID != expectedSyncUserID {
		tb.Fatalf("expected create sync user %q, got %#v", expectedSyncUserID, docManager.syncInputs[0])
	}
}

func TestKnowledgeBaseAppServiceUpdateWithProjectBindingsSkipsUnsupportedFiles(t *testing.T) {
	t.Parallel()

	sourceType := int(kbentity.SourceTypeProject)
	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			ID:                99,
			Code:              testAppKnowledgeBaseCode,
			Name:              "old",
			OrganizationCode:  "ORG-1",
			SourceType:        &sourceType,
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		},
	}
	docManager := &recordingKnowledgeBaseDocumentManager{}
	app, sourceBindingRepo := newProjectBindingUpdateApp(t, domain, docManager, map[int64]*projectfile.ResolveResult{
		42: newResolvedProjectFile(300, 42, "keep-42.md"),
		43: {
			Status:           projectfile.ResolveStatusUnsupported,
			OrganizationCode: "ORG-1",
			ProjectID:        300,
			ProjectFileID:    43,
			FileName:         "custom.svg",
			FileExtension:    "svg",
			DocumentFile:     map[string]any{"type": "project_file", "name": "custom.svg", "extension": "svg"},
		},
	})
	app.SetKnowledgeBaseBindingRepository(&recordingKnowledgeBaseBindingRepository{
		bindIDsByKnowledgeBase: map[string][]string{testAppKnowledgeBaseCode: {"1"}},
	})

	sourceBindings := []kbdto.SourceBindingInput{
		{
			Provider: sourcebindingdomain.ProviderProject,
			RootType: sourcebindingdomain.RootTypeProject,
			RootRef:  "300",
			SyncMode: sourcebindingdomain.SyncModeManual,
			Targets: []kbdto.SourceBindingTargetInput{
				{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "42"},
				{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "43"},
			},
		},
	}
	inputSourceType := int(kbentity.SourceTypeEnterpriseWiki)
	_, err := app.Update(context.Background(), &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-2",
		Code:             testAppKnowledgeBaseCode,
		SourceType:       &inputSourceType,
		SourceBindings:   &sourceBindings,
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if len(sourceBindingRepo.lastReplaceBindings) != 1 {
		t.Fatalf("expected one source binding replace, got %#v", sourceBindingRepo.lastReplaceBindings)
	}
	if len(docManager.createInputs) != 1 || docManager.createInputs[0].Name != "keep-42.md" {
		t.Fatalf("expected only supported project file to be rebuilt, got %#v", docManager.createInputs)
	}
	if len(docManager.syncInputs) != 1 || docManager.syncInputs[0].Mode != documentdomain.SyncModeCreate {
		t.Fatalf("expected one create sync for supported file, got %#v", docManager.syncInputs)
	}
}

func TestKnowledgeBaseAppServicePrepareRebuildDeletesUnsupportedEnterpriseFiles(t *testing.T) {
	t.Parallel()

	sourceType := int(kbentity.SourceTypeEnterpriseWiki)
	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			ID:                99,
			Code:              testAppKnowledgeBaseCode,
			Name:              "old",
			OrganizationCode:  "ORG-1",
			SourceType:        &sourceType,
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		},
	}
	docManager := &recordingKnowledgeBaseDocumentManager{
		listByKnowledgeBase: []*service.ManagedDocument{{
			Code:              "DOC-FILE-1",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
			SourceBindingID:   11,
			SourceItemID:      1,
			DocumentFile: &docentity.File{
				Type:       "third_platform",
				Name:       "legacy.docx",
				ThirdID:    "FILE-1",
				SourceType: sourcebindingdomain.ProviderTeamshare,
				Extension:  "docx",
			},
		}},
	}
	sourceBindingRepo := &recordingSourceBindingRepository{
		listBindings: []sourcebindingdomain.Binding{{
			ID:                11,
			OrganizationCode:  "ORG-1",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
			Provider:          sourcebindingdomain.ProviderTeamshare,
			RootType:          sourcebindingdomain.RootTypeFile,
			RootRef:           "FILE-1",
			SyncMode:          sourcebindingdomain.SyncModeManual,
			Enabled:           true,
		}},
		listBindingItems: []sourcebindingdomain.BindingItem{{
			BindingID:     11,
			SourceItemID:  1,
			ResolveReason: "root",
		}},
		sourceItemIDs: map[string]int64{"FILE-1": 1},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, docManager, nil, nil, effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	app.SetThirdPlatformExpander(&fakeThirdPlatformExpander{
		results: []*docentity.File{{
			Type:       "third_platform",
			Name:       "unsupported.svg",
			ThirdID:    "FILE-1",
			SourceType: sourcebindingdomain.ProviderTeamshare,
			Extension:  "svg",
		}},
	})
	app.SetKnowledgeBaseBindingRepository(&recordingKnowledgeBaseBindingRepository{
		bindIDsByKnowledgeBase: map[string][]string{testAppKnowledgeBaseCode: {"SMA-1"}},
	})

	err := app.PrepareRebuild(context.Background(), "ORG-1", service.RebuildScope{
		Mode:              service.RebuildScopeModeKnowledgeBase,
		OrganizationCode:  "ORG-1",
		KnowledgeBaseCode: testAppKnowledgeBaseCode,
		UserID:            "user-2",
	})
	if err != nil {
		t.Fatalf("PrepareRebuild returned error: %v", err)
	}
	if len(docManager.destroyKnowledgeBaseInputs) != 1 || docManager.destroyKnowledgeBaseInputs[0].knowledgeBaseCode != testAppKnowledgeBaseCode {
		t.Fatalf("expected unsupported enterprise file rebuild to clear legacy documents, got %#v", docManager.destroyKnowledgeBaseInputs)
	}
	if len(docManager.createInputs) != 0 {
		t.Fatalf("expected unsupported enterprise file not to recreate documents, got %#v", docManager.createInputs)
	}
	if len(docManager.syncInputs) != 0 {
		t.Fatalf("expected unsupported enterprise file not to schedule sync, got %#v", docManager.syncInputs)
	}
}

func TestKnowledgeBaseAppServicePrepareRebuildSkipsUnavailableTeamshareTargets(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:             testAppKnowledgeBaseCode,
			Name:             "企业知识库",
			OrganizationCode: "ORG-1",
			CreatedUID:       "kb-owner",
			UpdatedUID:       "kb-owner",
			Model:            effectiveEmbeddingModel,
			VectorDB:         "qdrant",
		},
	}
	docManager := &recordingKnowledgeBaseDocumentManager{}
	sourceBindingRepo := &recordingSourceBindingRepository{
		listBindings: []sourcebindingdomain.Binding{{
			ID:                61,
			OrganizationCode:  "ORG-1",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
			Provider:          sourcebindingdomain.ProviderTeamshare,
			RootType:          sourcebindingdomain.RootTypeKnowledgeBase,
			RootRef:           testTeamshareKnowledgeID,
			SyncMode:          sourcebindingdomain.SyncModeManual,
			Enabled:           true,
			CreatedUID:        "kb-owner",
			UpdatedUID:        "kb-owner",
			Targets: []sourcebindingdomain.BindingTarget{
				{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "FILE-KEEP"},
				{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "FILE-MISSING"},
			},
		}},
	}
	expander := &fakeThirdPlatformExpander{
		resolveResultByFile: map[string]*thirdplatform.DocumentResolveResult{
			"FILE-KEEP": {
				DocumentFile: map[string]any{
					"type":              "third_platform",
					"name":              "keep.md",
					"extension":         "md",
					"source_type":       sourcebindingdomain.ProviderTeamshare,
					"third_id":          "FILE-KEEP",
					"third_file_id":     "FILE-KEEP",
					"knowledge_base_id": testTeamshareKnowledgeID,
				},
			},
		},
		errByThirdFileID: map[string]error{
			"FILE-MISSING": thirdplatform.ErrDocumentUnavailable,
		},
	}

	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, docManager, nil, testKnowledgeBaseAppLogger(), effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	app.SetThirdPlatformExpander(expander)

	err := app.PrepareRebuild(context.Background(), "ORG-1", service.RebuildScope{
		Mode:              service.RebuildScopeModeKnowledgeBase,
		OrganizationCode:  "ORG-1",
		KnowledgeBaseCode: testAppKnowledgeBaseCode,
		UserID:            "rebuild-user",
	})
	if err != nil {
		t.Fatalf("PrepareRebuild returned error: %v", err)
	}
	if len(docManager.destroyKnowledgeBaseInputs) != 1 {
		t.Fatalf("expected legacy documents to be cleared before rebuild, got %#v", docManager.destroyKnowledgeBaseInputs)
	}
	if len(docManager.createInputs) != 1 {
		t.Fatalf("expected only one valid teamshare file to be rebuilt, got %#v", docManager.createInputs)
	}
	if docManager.createInputs[0].ThirdFileID != "FILE-KEEP" {
		t.Fatalf("expected rebuilt document to use valid third file, got %#v", docManager.createInputs[0])
	}
}

func TestKnowledgeBaseAppServicePrepareRebuildSkipsMissingProjectTargets(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:             testAppKnowledgeBaseCode,
			Name:             "项目知识库",
			OrganizationCode: "ORG-1",
			CreatedUID:       "kb-owner",
			UpdatedUID:       "kb-owner",
			Model:            effectiveEmbeddingModel,
			VectorDB:         "qdrant",
		},
	}
	docManager := &recordingKnowledgeBaseDocumentManager{}
	sourceBindingRepo := &recordingSourceBindingRepository{
		listBindings: []sourcebindingdomain.Binding{{
			ID:                71,
			OrganizationCode:  "ORG-1",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
			Provider:          sourcebindingdomain.ProviderProject,
			RootType:          sourcebindingdomain.RootTypeProject,
			RootRef:           "300",
			SyncMode:          sourcebindingdomain.SyncModeManual,
			Enabled:           true,
			CreatedUID:        "kb-owner",
			UpdatedUID:        "kb-owner",
			Targets: []sourcebindingdomain.BindingTarget{
				{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "41"},
				{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "42"},
			},
		}},
	}
	projectFiles := &projectFileResolverStub{
		visibleMetasByID: map[int64]*projectfile.Meta{
			41: {
				Status:           projectfile.ResolveStatusActive,
				OrganizationCode: "ORG-1",
				ProjectID:        300,
				ProjectFileID:    41,
				FileName:         "keep.md",
				FileExtension:    "md",
				FileKey:          "/project_300/workspace/keep.md",
			},
		},
	}

	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, docManager, nil, testKnowledgeBaseAppLogger(), effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	app.SetProjectFileResolver(projectFiles)
	app.SetTaskFileService(projectFiles)

	err := app.PrepareRebuild(context.Background(), "ORG-1", service.RebuildScope{
		Mode:              service.RebuildScopeModeKnowledgeBase,
		OrganizationCode:  "ORG-1",
		KnowledgeBaseCode: testAppKnowledgeBaseCode,
		UserID:            "rebuild-user",
	})
	if err != nil {
		t.Fatalf("PrepareRebuild returned error: %v", err)
	}
	if len(docManager.createInputs) != 1 {
		t.Fatalf("expected only one visible project file to be rebuilt, got %#v", docManager.createInputs)
	}
	if docManager.createInputs[0].ProjectFileID != 41 {
		t.Fatalf("expected rebuilt project file id=41, got %#v", docManager.createInputs[0])
	}
}

func TestKnowledgeBaseAppServicePrepareRebuildSkipsUnavailableProjectTargetsBySentinelError(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:             testAppKnowledgeBaseCode,
			Name:             "项目知识库",
			OrganizationCode: "ORG-1",
			CreatedUID:       "kb-owner",
			UpdatedUID:       "kb-owner",
			Model:            effectiveEmbeddingModel,
			VectorDB:         "qdrant",
		},
	}
	docManager := &recordingKnowledgeBaseDocumentManager{}
	sourceBindingRepo := &recordingSourceBindingRepository{
		listBindings: []sourcebindingdomain.Binding{{
			ID:                81,
			OrganizationCode:  "ORG-1",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
			Provider:          sourcebindingdomain.ProviderProject,
			RootType:          sourcebindingdomain.RootTypeProject,
			RootRef:           "300",
			SyncMode:          sourcebindingdomain.SyncModeManual,
			Enabled:           true,
			Targets: []sourcebindingdomain.BindingTarget{
				{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "41"},
				{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "42"},
			},
		}},
	}
	projectFiles := &projectFileResolverStub{
		visibleMetasByID: map[int64]*projectfile.Meta{
			41: {
				Status:           projectfile.ResolveStatusActive,
				OrganizationCode: "ORG-1",
				ProjectID:        300,
				ProjectFileID:    41,
				FileName:         "keep.md",
				FileExtension:    "md",
				FileKey:          "/project_300/workspace/keep.md",
			},
		},
		loadVisibleMetaErrByID: map[int64]error{
			42: projectfile.ErrFileUnavailable,
		},
	}

	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, docManager, nil, testKnowledgeBaseAppLogger(), effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	app.SetProjectFileResolver(projectFiles)
	app.SetTaskFileService(projectFiles)

	err := app.PrepareRebuild(context.Background(), "ORG-1", service.RebuildScope{
		Mode:              service.RebuildScopeModeKnowledgeBase,
		OrganizationCode:  "ORG-1",
		KnowledgeBaseCode: testAppKnowledgeBaseCode,
		UserID:            "rebuild-user",
	})
	if err != nil {
		t.Fatalf("PrepareRebuild returned error: %v", err)
	}
	if len(docManager.createInputs) != 1 || docManager.createInputs[0].ProjectFileID != 41 {
		t.Fatalf("expected unavailable sentinel project file to be skipped, got %#v", docManager.createInputs)
	}
}

func TestKnowledgeBaseAppServicePrepareRebuildReturnsProjectFileLookupErrors(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:             testAppKnowledgeBaseCode,
			Name:             "项目知识库",
			OrganizationCode: "ORG-1",
			CreatedUID:       "kb-owner",
			UpdatedUID:       "kb-owner",
			Model:            effectiveEmbeddingModel,
			VectorDB:         "qdrant",
		},
	}
	sourceBindingRepo := &recordingSourceBindingRepository{
		listBindings: []sourcebindingdomain.Binding{{
			ID:                91,
			OrganizationCode:  "ORG-1",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
			Provider:          sourcebindingdomain.ProviderProject,
			RootType:          sourcebindingdomain.RootTypeProject,
			RootRef:           "300",
			SyncMode:          sourcebindingdomain.SyncModeManual,
			Enabled:           true,
			Targets: []sourcebindingdomain.BindingTarget{
				{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "41"},
			},
		}},
	}
	projectFiles := &projectFileResolverStub{
		loadVisibleMetaErrByID: map[int64]error{
			41: errTaskFileReaderBoom,
		},
	}

	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, &recordingKnowledgeBaseDocumentManager{}, nil, testKnowledgeBaseAppLogger(), effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	app.SetProjectFileResolver(projectFiles)
	app.SetTaskFileService(projectFiles)

	err := app.PrepareRebuild(context.Background(), "ORG-1", service.RebuildScope{
		Mode:              service.RebuildScopeModeKnowledgeBase,
		OrganizationCode:  "ORG-1",
		KnowledgeBaseCode: testAppKnowledgeBaseCode,
		UserID:            "rebuild-user",
	})
	if err == nil || !strings.Contains(err.Error(), "task file reader boom") {
		t.Fatalf("expected project file lookup error to be returned, got %v", err)
	}
}

func TestKnowledgeBaseAppServiceRepairSourceBindingsReplacesBindingsWhenKnowledgeBaseHasNone(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:             testAppKnowledgeBaseCode,
			Name:             "旧知识库",
			OrganizationCode: "ORG-1",
			Model:            effectiveEmbeddingModel,
			VectorDB:         "qdrant",
		},
	}
	docManager := &recordingKnowledgeBaseDocumentManager{
		createResults: []*service.ManagedDocument{{
			Code:              "DOC-NEW",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
			DocumentFile:      &docentity.File{Type: "third_platform", ThirdID: "FILE-1", SourceType: sourcebindingdomain.ProviderTeamshare},
		}},
	}
	sourceBindingRepo := &recordingSourceBindingRepository{}
	fragmentRepair := &fragmentRepairServiceStub{
		organizationCodes: []string{"ORG-1"},
		groupsByOffset: map[int][]*thirdfilemappingpkg.RepairGroup{
			0: {{
				KnowledgeCode:            testAppKnowledgeBaseCode,
				ThirdFileID:              "FILE-1",
				KnowledgeBaseID:          testTeamshareKnowledgeID,
				DocumentName:             "文档-1",
				MissingDocumentCodeCount: 2,
			}},
		},
		backfillRows: 2,
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, docManager, nil, nil, effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	expander := &fakeThirdPlatformExpander{
		results: []*docentity.File{{
			Type:       "third_platform",
			Name:       "文档-1",
			ThirdID:    "FILE-1",
			SourceType: sourcebindingdomain.ProviderTeamshare,
		}},
	}
	app.SetThirdPlatformExpander(expander)
	app.SetFragmentRepairService(fragmentRepair)

	result, err := app.RepairSourceBindings(context.Background(), &kbdto.RepairSourceBindingsInput{
		OrganizationCode:  "OP-ORG",
		OrganizationCodes: []string{"ORG-1"},
		UserID:            "user-1",
		ThirdPlatformType: sourcebindingdomain.ProviderTeamshare,
	})
	if err != nil {
		t.Fatalf("RepairSourceBindings returned error: %v", err)
	}
	if result == nil || result.AddedBindings != 1 || result.MaterializedDocs != 1 || result.BackfilledRows != 2 {
		t.Fatalf("unexpected repair result: %#v", result)
	}
	if len(sourceBindingRepo.lastReplaceBindings) != 1 {
		t.Fatalf("expected one replaced binding, got %#v", sourceBindingRepo.lastReplaceBindings)
	}
	if sourceBindingRepo.lastReplaceBindings[0].RootType != sourcebindingdomain.RootTypeKnowledgeBase || sourceBindingRepo.lastReplaceBindings[0].RootRef != testTeamshareKnowledgeID {
		t.Fatalf("expected knowledge_base root binding, got %#v", sourceBindingRepo.lastReplaceBindings[0])
	}
	if len(sourceBindingRepo.lastSavedBindings) != 0 {
		t.Fatalf("expected save bindings not used, got %#v", sourceBindingRepo.lastSavedBindings)
	}
	if len(docManager.createInputs) != 1 || len(docManager.syncInputs) != 1 {
		t.Fatalf("expected one document materialized and scheduled, got create=%d sync=%d", len(docManager.createInputs), len(docManager.syncInputs))
	}
	if expander.lastParentType != "knowledge_base" || expander.lastParentRef != testTeamshareKnowledgeID {
		t.Fatalf("expected knowledge base traversal %q/%q, got %q/%q", "knowledge_base", testTeamshareKnowledgeID, expander.lastParentType, expander.lastParentRef)
	}
	if len(fragmentRepair.backfillInputs) != 1 || fragmentRepair.backfillInputs[0].DocumentCode != "DOC-NEW" {
		t.Fatalf("expected backfill to use new document code, got %#v", fragmentRepair.backfillInputs)
	}
}

func TestKnowledgeBaseAppServiceRepairSourceBindingsOnlyAppendsMissingBindings(t *testing.T) {
	t.Parallel()

	app, docManager, sourceBindingRepo, fragmentRepair := buildAppendOnlyRepairSourceBindingsApp(t)

	result, err := app.RepairSourceBindings(context.Background(), &kbdto.RepairSourceBindingsInput{
		OrganizationCode:  "OP-ORG",
		OrganizationCodes: []string{testOrganizationCode1},
		UserID:            "user-1",
		ThirdPlatformType: sourcebindingdomain.ProviderTeamshare,
	})
	if err != nil {
		t.Fatalf("RepairSourceBindings returned error: %v", err)
	}
	if result == nil || result.AddedBindings != 1 || result.BackfilledRows != 2 {
		t.Fatalf("unexpected repair result: %#v", result)
	}
	if len(sourceBindingRepo.lastReplaceBindings) != 0 {
		t.Fatalf("expected replace bindings not used, got %#v", sourceBindingRepo.lastReplaceBindings)
	}
	if len(sourceBindingRepo.lastSavedBindings) != 1 || sourceBindingRepo.lastSavedBindings[0].RootRef != "FILE-NEW" {
		t.Fatalf("expected one appended binding for FILE-NEW, got %#v", sourceBindingRepo.lastSavedBindings)
	}
	if len(docManager.destroyInputs) != 0 {
		t.Fatalf("expected existing documents not rebuilt, got %#v", docManager.destroyInputs)
	}
	if len(fragmentRepair.backfillInputs) != 2 {
		t.Fatalf("expected two backfills, got %#v", fragmentRepair.backfillInputs)
	}
}

func buildAppendOnlyRepairSourceBindingsApp(
	t *testing.T,
) (
	*service.KnowledgeBaseAppService,
	*recordingKnowledgeBaseDocumentManager,
	*recordingSourceBindingRepository,
	*fragmentRepairServiceStub,
) {
	t.Helper()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:             testAppKnowledgeBaseCode,
			Name:             "旧知识库",
			OrganizationCode: testOrganizationCode1,
			Model:            effectiveEmbeddingModel,
			VectorDB:         "qdrant",
		},
	}
	docManager := &recordingKnowledgeBaseDocumentManager{
		listByKnowledgeBase: []*service.ManagedDocument{{
			Code:              "DOC-EXIST",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
			DocumentFile:      &docentity.File{Type: "third_platform", ThirdID: "FILE-EXIST", SourceType: sourcebindingdomain.ProviderTeamshare},
		}},
		createResults: []*service.ManagedDocument{{
			Code:              "DOC-NEW",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
			DocumentFile:      &docentity.File{Type: "third_platform", ThirdID: "FILE-NEW", SourceType: sourcebindingdomain.ProviderTeamshare},
		}},
	}
	sourceBindingRepo := &recordingSourceBindingRepository{
		listBindings: []sourcebindingdomain.Binding{{
			ID:                9,
			OrganizationCode:  testOrganizationCode1,
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
			Provider:          sourcebindingdomain.ProviderTeamshare,
			RootType:          sourcebindingdomain.RootTypeFile,
			RootRef:           "FILE-EXIST",
			Enabled:           true,
			SyncMode:          sourcebindingdomain.SyncModeManual,
		}},
	}
	fragmentRepair := &fragmentRepairServiceStub{
		organizationCodes: []string{testOrganizationCode1},
		groupsByOffset: map[int][]*thirdfilemappingpkg.RepairGroup{
			0: {
				{KnowledgeCode: testAppKnowledgeBaseCode, ThirdFileID: "FILE-EXIST", MissingDocumentCodeCount: 1},
				{KnowledgeCode: testAppKnowledgeBaseCode, ThirdFileID: "FILE-NEW", MissingDocumentCodeCount: 1},
			},
		},
		backfillRows: 1,
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, docManager, nil, nil, effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	app.SetThirdPlatformExpander(&fakeThirdPlatformExpander{
		results: []*docentity.File{{
			Type:       "third_platform",
			Name:       "文档-new",
			ThirdID:    "FILE-NEW",
			SourceType: sourcebindingdomain.ProviderTeamshare,
		}},
	})
	app.SetFragmentRepairService(fragmentRepair)
	return app, docManager, sourceBindingRepo, fragmentRepair
}

func TestKnowledgeBaseAppServiceRepairSourceBindingsWithoutOrganizationCodesRepairsAllOrganizations(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:             testAppKnowledgeBaseCode,
			Name:             "旧知识库",
			OrganizationCode: testOrganizationCode1,
			Model:            effectiveEmbeddingModel,
			VectorDB:         "qdrant",
		},
	}
	docManager := &recordingKnowledgeBaseDocumentManager{
		createResults: []*service.ManagedDocument{{
			Code:              "DOC-NEW",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
			DocumentFile: &docentity.File{
				Type:       "third_platform",
				Name:       "文档-1",
				ThirdID:    "FILE-1",
				SourceType: sourcebindingdomain.ProviderTeamshare,
			},
		}},
	}
	sourceBindingRepo := &recordingSourceBindingRepository{}
	fragmentRepair := &fragmentRepairServiceStub{
		organizationCodes: []string{testOrganizationCode1, testOrganizationCode2},
		groupsByOrganizationOffset: map[string]map[int][]*thirdfilemappingpkg.RepairGroup{
			testOrganizationCode1: {
				0: {{
					KnowledgeCode:            testAppKnowledgeBaseCode,
					ThirdFileID:              "FILE-1",
					DocumentName:             "文档-1",
					MissingDocumentCodeCount: 1,
				}},
			},
			testOrganizationCode2: {},
		},
		backfillRows: 1,
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, docManager, nil, nil, effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	app.SetThirdPlatformExpander(&fakeThirdPlatformExpander{
		results: []*docentity.File{{
			Type:       "third_platform",
			Name:       "文档-1",
			ThirdID:    "FILE-1",
			SourceType: sourcebindingdomain.ProviderTeamshare,
		}},
	})
	app.SetFragmentRepairService(fragmentRepair)

	result, err := app.RepairSourceBindings(context.Background(), &kbdto.RepairSourceBindingsInput{
		OrganizationCode:  "OP-ORG",
		UserID:            "user-1",
		ThirdPlatformType: sourcebindingdomain.ProviderTeamshare,
	})
	if err != nil {
		t.Fatalf("RepairSourceBindings returned error: %v", err)
	}
	if result == nil {
		t.Fatal("expected repair result not nil")
	}
	if !reflect.DeepEqual(result.OrganizationCodes, []string{testOrganizationCode1, testOrganizationCode2}) {
		t.Fatalf("unexpected organization codes: %#v", result.OrganizationCodes)
	}
	if result.ScannedOrganizations != 2 || len(result.Organizations) != 2 {
		t.Fatalf("expected two organization summaries, got %#v", result)
	}
	if result.OrganizationCode != "" {
		t.Fatalf("expected aggregate organization_code empty, got %q", result.OrganizationCode)
	}
	if result.AddedBindings != 1 || result.MaterializedDocs != 1 || result.BackfilledRows != 1 {
		t.Fatalf("unexpected aggregate repair result: %#v", result)
	}
	if result.Organizations[0].OrganizationCode != testOrganizationCode1 ||
		result.Organizations[1].OrganizationCode != testOrganizationCode2 {
		t.Fatalf("unexpected organization summaries: %#v", result.Organizations)
	}
}

func TestKnowledgeBaseAppServicePrepareRebuildBootstrapsTeamshareFileBindings(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:             testAppKnowledgeBaseCode,
			Name:             "旧知识库",
			OrganizationCode: "ORG-1",
			CreatedUID:       "kb-creator",
			UpdatedUID:       testKnowledgeBaseUpdater,
			Model:            effectiveEmbeddingModel,
			VectorDB:         "qdrant",
		},
	}
	docManager := &recordingKnowledgeBaseDocumentManager{
		listByKnowledgeBase: []*service.ManagedDocument{{
			Code:              "DOC-LEGACY",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
			DocumentFile: &docentity.File{
				Type:            "third_platform",
				Name:            "文档-1",
				ThirdID:         "FILE-1",
				SourceType:      sourcebindingdomain.ProviderTeamshare,
				KnowledgeBaseID: testTeamshareKnowledgeID,
			},
		}},
		createResults: []*service.ManagedDocument{{
			Code:              "DOC-NEW",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
			DocumentFile: &docentity.File{
				Type:            "third_platform",
				Name:            "文档-1",
				ThirdID:         "FILE-1",
				SourceType:      sourcebindingdomain.ProviderTeamshare,
				KnowledgeBaseID: testTeamshareKnowledgeID,
			},
		}},
	}
	sourceBindingRepo := &recordingSourceBindingRepository{}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, docManager, nil, nil, effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	expander := &fakeThirdPlatformExpander{
		results: []*docentity.File{{
			Type:            "third_platform",
			Name:            "文档-1",
			ThirdID:         "FILE-1",
			SourceType:      sourcebindingdomain.ProviderTeamshare,
			KnowledgeBaseID: testTeamshareKnowledgeID,
		}},
	}
	app.SetThirdPlatformExpander(expander)

	err := app.PrepareRebuild(context.Background(), "ORG-1", service.RebuildScope{
		Mode:              service.RebuildScopeModeKnowledgeBase,
		OrganizationCode:  "ORG-1",
		KnowledgeBaseCode: testAppKnowledgeBaseCode,
		UserID:            "user-1",
	})
	if err != nil {
		t.Fatalf("PrepareRebuild returned error: %v", err)
	}
	if len(sourceBindingRepo.lastReplaceBindings) != 1 {
		t.Fatalf("expected one bootstrapped binding, got %#v", sourceBindingRepo.lastReplaceBindings)
	}
	binding := sourceBindingRepo.lastReplaceBindings[0]
	if binding.Provider != sourcebindingdomain.ProviderTeamshare || binding.RootType != sourcebindingdomain.RootTypeFile || binding.RootRef != "FILE-1" {
		t.Fatalf("unexpected bootstrapped binding: %#v", binding)
	}
	if binding.CreatedUID != testKnowledgeBaseUpdater || binding.UpdatedUID != testKnowledgeBaseUpdater {
		t.Fatalf("expected bootstrapped binding user to follow knowledge base owner, got %#v", binding)
	}
	rootContext, _ := binding.SyncConfig["root_context"].(map[string]any)
	if rootContext["knowledge_base_id"] != testTeamshareKnowledgeID {
		t.Fatalf("expected root context knowledge_base_id preserved, got %#v", binding.SyncConfig)
	}
	assertBootstrappedTeamsharePrepareRebuild(t, docManager, expander)
}

func TestKnowledgeBaseAppServicePrepareRebuildUsesExistingBindingUserForTeamshareExpansion(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:             testAppKnowledgeBaseCode,
			Name:             "已有绑定知识库",
			OrganizationCode: "ORG-1",
			Model:            effectiveEmbeddingModel,
			VectorDB:         "qdrant",
		},
	}
	docManager := &recordingKnowledgeBaseDocumentManager{
		createResults: []*service.ManagedDocument{{
			Code:              "DOC-NEW",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
		}},
	}
	sourceBindingRepo := &recordingSourceBindingRepository{
		listBindings: []sourcebindingdomain.Binding{{
			ID:                11,
			OrganizationCode:  "ORG-1",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
			Provider:          sourcebindingdomain.ProviderTeamshare,
			RootType:          sourcebindingdomain.RootTypeFile,
			RootRef:           "FILE-1",
			Enabled:           true,
			SyncMode:          sourcebindingdomain.SyncModeManual,
			CreatedUID:        "binding-creator",
			UpdatedUID:        "binding-updater",
		}},
	}
	expander := &fakeThirdPlatformExpander{
		results: []*docentity.File{{
			Type:       "third_platform",
			Name:       "文档-1",
			ThirdID:    "FILE-1",
			SourceType: sourcebindingdomain.ProviderTeamshare,
		}},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, docManager, nil, nil, effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	app.SetThirdPlatformExpander(expander)

	err := app.PrepareRebuild(context.Background(), "ORG-1", service.RebuildScope{
		Mode:              service.RebuildScopeModeKnowledgeBase,
		OrganizationCode:  "ORG-1",
		KnowledgeBaseCode: testAppKnowledgeBaseCode,
		UserID:            "rebuild-trigger-user",
	})
	if err != nil {
		t.Fatalf("PrepareRebuild returned error: %v", err)
	}
	if expander.lastUserID != "binding-updater" {
		t.Fatalf("expected teamshare expand to use binding updater, got %q", expander.lastUserID)
	}
	if len(docManager.createInputs) != 1 {
		t.Fatalf("expected one rebuilt managed document, got %#v", docManager.createInputs)
	}
	if docManager.createInputs[0].UserID != "binding-updater" {
		t.Fatalf("expected rebuilt managed document user to follow binding updater, got %#v", docManager.createInputs[0])
	}
	if len(docManager.syncInputs) != 0 {
		t.Fatalf("expected prepare rebuild to skip create sync scheduling, got %#v", docManager.syncInputs)
	}
}

func TestKnowledgeBaseAppServicePrepareRebuildFallsBackToKnowledgeBaseUserWhenBindingUserHasNoFilePermission(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:             testAppKnowledgeBaseCode,
			Name:             "Teamshare 回退知识库",
			OrganizationCode: "ORG-1",
			CreatedUID:       "kb-creator",
			UpdatedUID:       "kb-owner",
			Model:            effectiveEmbeddingModel,
			VectorDB:         "qdrant",
		},
	}
	docManager := &recordingKnowledgeBaseDocumentManager{
		createResults: []*service.ManagedDocument{{
			Code:              "DOC-NEW",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
		}},
	}
	sourceBindingRepo := &recordingSourceBindingRepository{
		listBindings: []sourcebindingdomain.Binding{{
			ID:                21,
			OrganizationCode:  "ORG-1",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
			Provider:          sourcebindingdomain.ProviderTeamshare,
			RootType:          sourcebindingdomain.RootTypeFile,
			RootRef:           "FILE-1",
			Enabled:           true,
			SyncMode:          sourcebindingdomain.SyncModeManual,
			CreatedUID:        "binding-creator",
			UpdatedUID:        "binding-updater",
		}},
	}
	expander := &fakeThirdPlatformExpander{
		results: []*docentity.File{{
			Type:       "third_platform",
			Name:       "文档-1",
			ThirdID:    "FILE-1",
			SourceType: sourcebindingdomain.ProviderTeamshare,
		}},
		errByUser: map[string]error{
			"binding-updater": errTeamshareFilePermission,
		},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, docManager, nil, nil, effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	app.SetThirdPlatformExpander(expander)

	err := app.PrepareRebuild(context.Background(), "ORG-1", service.RebuildScope{
		Mode:              service.RebuildScopeModeKnowledgeBase,
		OrganizationCode:  "ORG-1",
		KnowledgeBaseCode: testAppKnowledgeBaseCode,
		UserID:            "rebuild-trigger-user",
	})
	if err != nil {
		t.Fatalf("PrepareRebuild returned error: %v", err)
	}
	if expander.lastUserID != "kb-owner" {
		t.Fatalf("expected teamshare expand fallback user to be knowledge base owner, got %q", expander.lastUserID)
	}
	if len(docManager.createInputs) != 1 {
		t.Fatalf("expected one rebuilt managed document, got %#v", docManager.createInputs)
	}
	if docManager.createInputs[0].UserID != "kb-owner" {
		t.Fatalf("expected rebuilt managed document user to follow fallback knowledge base user, got %#v", docManager.createInputs[0])
	}
}

func TestKnowledgeBaseAppServicePrepareRebuildPreservesDocumentsWhenKnowledgeBaseScopePermissionDenied(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:             testAppKnowledgeBaseCode,
			Name:             "单库权限失败知识库",
			OrganizationCode: "ORG-1",
			CreatedUID:       "kb-owner",
			UpdatedUID:       "kb-owner",
			Model:            effectiveEmbeddingModel,
			VectorDB:         "qdrant",
		},
	}
	docManager := &recordingKnowledgeBaseDocumentManager{
		listByKnowledgeBase: []*service.ManagedDocument{{
			Code:              "DOC-LEGACY",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
		}},
	}
	sourceBindingRepo := &recordingSourceBindingRepository{
		listBindings: []sourcebindingdomain.Binding{{
			ID:                31,
			OrganizationCode:  "ORG-1",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
			Provider:          sourcebindingdomain.ProviderTeamshare,
			RootType:          sourcebindingdomain.RootTypeFile,
			RootRef:           "FILE-1",
			Enabled:           true,
			SyncMode:          sourcebindingdomain.SyncModeManual,
			CreatedUID:        "kb-owner",
			UpdatedUID:        "kb-owner",
		}},
	}
	expander := &fakeThirdPlatformExpander{
		errByUser: map[string]error{
			"kb-owner":             errTeamshareFilePermission,
			"rebuild-trigger-user": errTeamshareFilePermission,
		},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, docManager, nil, testKnowledgeBaseAppLogger(), effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	app.SetThirdPlatformExpander(expander)

	err := app.PrepareRebuild(context.Background(), "ORG-1", service.RebuildScope{
		Mode:              service.RebuildScopeModeKnowledgeBase,
		OrganizationCode:  "ORG-1",
		KnowledgeBaseCode: testAppKnowledgeBaseCode,
		UserID:            "rebuild-trigger-user",
	})
	if err == nil || !strings.Contains(err.Error(), "没有文件权限") {
		t.Fatalf("expected permission denied error, got %v", err)
	}
	if len(docManager.destroyInputs) != 0 {
		t.Fatalf("expected preflight to prevent legacy document destroy, got %#v", docManager.destroyInputs)
	}
	if len(docManager.destroyKnowledgeBaseInputs) != 0 {
		t.Fatalf("expected preflight to prevent knowledge base document destroy, got %#v", docManager.destroyKnowledgeBaseInputs)
	}
	if len(docManager.createInputs) != 0 {
		t.Fatalf("expected no rebuilt managed document on preflight failure, got %#v", docManager.createInputs)
	}
}

func TestKnowledgeBaseAppServicePrepareRebuildSkipsPermissionDeniedKnowledgeBaseInOrganizationScope(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		listKBS: []*kbentity.KnowledgeBase{{
			Code:             testAppKnowledgeBaseCode,
			Name:             "组织级权限失败知识库",
			OrganizationCode: "ORG-1",
			CreatedUID:       "kb-owner",
			UpdatedUID:       "kb-owner",
			Model:            effectiveEmbeddingModel,
			VectorDB:         "qdrant",
		}},
		listTotal: 1,
	}
	docManager := &recordingKnowledgeBaseDocumentManager{
		listByKnowledgeBase: []*service.ManagedDocument{{
			Code:              "DOC-LEGACY",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
		}},
	}
	sourceBindingRepo := &recordingSourceBindingRepository{
		listBindings: []sourcebindingdomain.Binding{{
			ID:                41,
			OrganizationCode:  "ORG-1",
			KnowledgeBaseCode: testAppKnowledgeBaseCode,
			Provider:          sourcebindingdomain.ProviderTeamshare,
			RootType:          sourcebindingdomain.RootTypeFile,
			RootRef:           "FILE-1",
			Enabled:           true,
			SyncMode:          sourcebindingdomain.SyncModeManual,
			CreatedUID:        "kb-owner",
			UpdatedUID:        "kb-owner",
		}},
	}
	expander := &fakeThirdPlatformExpander{
		errByUser: map[string]error{
			"kb-owner":             errTeamshareFilePermission,
			"rebuild-trigger-user": errTeamshareFilePermission,
		},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, docManager, nil, testKnowledgeBaseAppLogger(), effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	app.SetThirdPlatformExpander(expander)

	err := app.PrepareRebuild(context.Background(), "ORG-1", service.RebuildScope{
		Mode:             service.RebuildScopeModeOrganization,
		OrganizationCode: "ORG-1",
		UserID:           "rebuild-trigger-user",
	})
	if err != nil {
		t.Fatalf("expected organization rebuild to skip permission denied knowledge base, got %v", err)
	}
	if len(docManager.destroyInputs) != 0 {
		t.Fatalf("expected skipped knowledge base to preserve legacy documents, got %#v", docManager.destroyInputs)
	}
	if len(docManager.destroyKnowledgeBaseInputs) != 0 {
		t.Fatalf("expected skipped knowledge base to preserve knowledge base documents, got %#v", docManager.destroyKnowledgeBaseInputs)
	}
	if len(docManager.createInputs) != 0 {
		t.Fatalf("expected skipped knowledge base not to create rebuilt documents, got %#v", docManager.createInputs)
	}
}

func assertBootstrappedTeamsharePrepareRebuild(
	t *testing.T,
	docManager *recordingKnowledgeBaseDocumentManager,
	expander *fakeThirdPlatformExpander,
) {
	t.Helper()

	if len(docManager.destroyInputs) != 0 {
		t.Fatalf("expected no per-document destroy before rebuild, got %#v", docManager.destroyInputs)
	}
	if len(docManager.destroyKnowledgeBaseInputs) != 1 ||
		docManager.destroyKnowledgeBaseInputs[0].knowledgeBaseCode != testAppKnowledgeBaseCode ||
		docManager.destroyKnowledgeBaseInputs[0].organizationCode != testOrganizationCode1 {
		t.Fatalf("expected knowledge base documents batch destroyed before rebuild, got %#v", docManager.destroyKnowledgeBaseInputs)
	}
	if len(docManager.createInputs) != 1 || docManager.createInputs[0].SourceBindingID == 0 || docManager.createInputs[0].SourceItemID == 0 {
		t.Fatalf("expected rebuilt managed document with source ids, got %#v", docManager.createInputs)
	}
	if docManager.createInputs[0].ThirdPlatformType != sourcebindingdomain.ProviderTeamshare || docManager.createInputs[0].ThirdFileID != "FILE-1" {
		t.Fatalf("expected rebuilt managed document to carry teamshare third-file mapping, got %#v", docManager.createInputs[0])
	}
	if docManager.createInputs[0].UserID != testKnowledgeBaseUpdater {
		t.Fatalf("expected rebuilt managed document user to follow bootstrapped binding user, got %#v", docManager.createInputs[0])
	}
	if expander.lastUserID != testKnowledgeBaseUpdater {
		t.Fatalf("expected teamshare expand to use knowledge base user, got %q", expander.lastUserID)
	}
	if len(docManager.syncInputs) != 0 {
		t.Fatalf("expected prepare rebuild to skip create sync scheduling, got %#v", docManager.syncInputs)
	}
}

func TestKnowledgeBaseAppServicePrepareRebuildRejectsProjectKnowledgeBaseWithoutBindings(t *testing.T) {
	t.Parallel()

	sourceType := int(kbentity.SourceTypeProject)
	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:              testAppKnowledgeBaseCode,
			Name:              "项目知识库",
			OrganizationCode:  "ORG-1",
			SourceType:        &sourceType,
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, &recordingKnowledgeBaseDocumentManager{}, nil, nil, effectiveEmbeddingModel)
	app.SetSourceBindingRepository(&recordingSourceBindingRepository{})
	app.SetKnowledgeBaseBindingRepository(&recordingKnowledgeBaseBindingRepository{
		bindIDsByKnowledgeBase: map[string][]string{testAppKnowledgeBaseCode: {"1"}},
	})

	err := app.PrepareRebuild(context.Background(), "ORG-1", service.RebuildScope{
		Mode:              service.RebuildScopeModeKnowledgeBase,
		OrganizationCode:  "ORG-1",
		KnowledgeBaseCode: testAppKnowledgeBaseCode,
		UserID:            "user-1",
	})
	if !errors.Is(err, service.ErrMissingProjectSourceBindings) {
		t.Fatalf("expected ErrMissingProjectSourceBindings, got %v", err)
	}
}

func TestKnowledgeBaseAppServicePrepareRebuildReturnsBindingLookupError(t *testing.T) {
	t.Parallel()

	sourceType := int(kbentity.SourceTypeProject)
	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:              testAppKnowledgeBaseCode,
			Name:              "项目知识库",
			OrganizationCode:  "ORG-1",
			SourceType:        &sourceType,
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, &recordingKnowledgeBaseDocumentManager{}, nil, nil, effectiveEmbeddingModel)
	app.SetSourceBindingRepository(&recordingSourceBindingRepository{})
	app.SetKnowledgeBaseBindingRepository(&recordingKnowledgeBaseBindingRepository{
		batchListErr: errBindingLookupFailed,
	})

	err := app.PrepareRebuild(context.Background(), "ORG-1", service.RebuildScope{
		Mode:              service.RebuildScopeModeKnowledgeBase,
		OrganizationCode:  "ORG-1",
		KnowledgeBaseCode: testAppKnowledgeBaseCode,
		UserID:            "user-1",
	})
	if err == nil || !errors.Is(err, service.ErrMissingProjectSourceBindings) {
		t.Fatalf("expected missing project source bindings, got %v", err)
	}
}

func TestKnowledgeBaseAppServicePrepareRebuildRequiresOfficialOrganization(t *testing.T) {
	t.Parallel()

	app := service.NewKnowledgeBaseAppServiceForTest(t, &recordingKnowledgeBaseDomainService{}, &recordingKnowledgeBaseDocumentManager{}, nil, nil, effectiveEmbeddingModel)
	app.SetSourceBindingRepository(&recordingSourceBindingRepository{})
	app.SetOfficialOrganizationMemberChecker(&recordingKnowledgeBasePermissionReader{official: false})

	err := app.PrepareRebuild(context.Background(), "ORG-1", service.RebuildScope{
		Mode:             service.RebuildScopeModeOrganization,
		OrganizationCode: "ORG-1",
	})
	if err == nil || !errors.Is(err, service.ErrOfficialOrganizationMemberRequired) {
		t.Fatalf("expected official organization required error, got %v", err)
	}
}

func TestKnowledgeBaseAppServiceRepairSourceBindingsDoesNotRequireOfficialOrganization(t *testing.T) {
	t.Parallel()

	app := service.NewKnowledgeBaseAppServiceForTest(t, &recordingKnowledgeBaseDomainService{}, &recordingKnowledgeBaseDocumentManager{}, nil, nil, effectiveEmbeddingModel)
	app.SetSourceBindingRepository(&recordingSourceBindingRepository{})
	app.SetFragmentRepairService(&fragmentRepairServiceStub{
		organizationCodes: []string{testOrganizationCode1},
	})
	app.SetOfficialOrganizationMemberChecker(&recordingKnowledgeBasePermissionReader{official: false})

	result, err := app.RepairSourceBindings(context.Background(), &kbdto.RepairSourceBindingsInput{
		OrganizationCode:  "OP-ORG",
		OrganizationCodes: []string{testOrganizationCode1},
	})
	if err != nil {
		t.Fatalf("expected repair source bindings to ignore official organization checker, got %v", err)
	}
	if result == nil || len(result.Organizations) != 1 || result.Organizations[0].OrganizationCode != testOrganizationCode1 {
		t.Fatalf("unexpected repair result: %#v", result)
	}
}

func newProjectBindingUpdateApp(
	tb testing.TB,
	domain *recordingKnowledgeBaseDomainService,
	docManager *recordingKnowledgeBaseDocumentManager,
	resolveResults map[int64]*projectfile.ResolveResult,
) (*service.KnowledgeBaseAppService, *recordingSourceBindingRepository) {
	tb.Helper()

	sourceBindingRepo := &recordingSourceBindingRepository{}
	app := service.NewKnowledgeBaseAppServiceForTest(tb, domain, docManager, nil, nil, effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	projectFileResolver := &projectFileResolverStub{resolveResults: resolveResults}
	app.SetProjectFileResolver(projectFileResolver)
	app.SetTaskFileService(projectFileResolver)
	return app, sourceBindingRepo
}

func newProjectBindingCreateApp(
	tb testing.TB,
	domain *recordingKnowledgeBaseDomainService,
	docManager *recordingKnowledgeBaseDocumentManager,
	sourceBindingRepo *recordingSourceBindingRepository,
	projectFileResolver *projectFileResolverStub,
) *service.KnowledgeBaseAppService {
	tb.Helper()

	app := service.NewKnowledgeBaseAppServiceForTest(tb, domain, docManager, nil, nil, effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	app.SetProjectFileResolver(projectFileResolver)
	app.SetTaskFileService(projectFileResolver)
	app.SetKnowledgeBaseBindingRepository(&recordingKnowledgeBaseBindingRepository{})
	app.SetSuperMagicAgentReader(&recordingSuperMagicAgentReader{
		existingIDs: map[string]struct{}{"1": {}},
	})
	return app
}

func newProjectBindingCreateInput(
	sourceType *int,
	rootRef string,
	targets []kbdto.SourceBindingTargetInput,
) *kbdto.CreateKnowledgeBaseInput {
	return &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Name:             "项目知识库",
		Type:             1,
		SourceType:       sourceType,
		AgentCodes:       []string{"1"},
		SourceBindings: []kbdto.SourceBindingInput{
			{
				Provider: sourcebindingdomain.ProviderProject,
				RootType: sourcebindingdomain.RootTypeProject,
				RootRef:  rootRef,
				SyncMode: sourcebindingdomain.SyncModeManual,
				Targets:  targets,
			},
		},
	}
}

func newResolvedProjectFile(projectID, projectFileID int64, fileName string) *projectfile.ResolveResult {
	return &projectfile.ResolveResult{
		Status:           "active",
		OrganizationCode: "ORG-1",
		ProjectID:        projectID,
		ProjectFileID:    projectFileID,
		FileName:         fileName,
		Content:          "content-" + fileName,
		ContentHash:      "hash-" + fileName,
		DocType:          1,
		DocumentFile: map[string]any{
			"type":      "external",
			"name":      fileName,
			"url":       "project://" + fileName,
			"extension": "md",
		},
	}
}

func TestKnowledgeBaseAppServiceUpdateMergesMutableFields(t *testing.T) {
	t.Parallel()

	const (
		updatedName        = "new"
		updatedDescription = "new desc"
	)

	enabled := false
	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			ID:               99,
			Code:             testAppKnowledgeBaseCode,
			Name:             "old",
			Description:      "old desc",
			Enabled:          true,
			Icon:             "old-icon",
			OrganizationCode: "ORG-1",
			EmbeddingConfig:  &shared.EmbeddingConfig{ModelID: "old-model"},
			FragmentConfig: &shared.FragmentConfig{
				Mode: shared.FragmentModeNormal,
				Normal: &shared.NormalFragmentConfig{
					SegmentRule: &shared.SegmentRule{ChunkSize: 256},
				},
			},
		},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetKnowledgeBasePermissionReader(&recordingKnowledgeBasePermissionReader{
		operations: map[string]string{
			testAppKnowledgeBaseCode: "edit",
		},
	})
	input := &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-2",
		Code:             testAppKnowledgeBaseCode,
		Name:             updatedName,
		Description:      updatedDescription,
		Enabled:          &enabled,
		Icon:             "new-icon",
		RetrieveConfig:   &confighelper.RetrieveConfigDTO{TopK: 3},
		EmbeddingConfig:  &confighelper.EmbeddingConfig{ModelID: "new-model"},
		FragmentConfig: &confighelper.FragmentConfigDTO{
			Mode: int(shared.FragmentModeHierarchy),
			Hierarchy: &confighelper.HierarchyFragmentConfigDTO{
				MaxLevel:           3,
				TextPreprocessRule: []int{1, 2},
			},
		},
	}

	result, err := app.Update(context.Background(), input)
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	assertKnowledgeBaseMutableUpdateResult(t, result, domain.updatedKB, updatedName, updatedDescription)
}

func assertKnowledgeBaseMutableUpdateResult(
	t *testing.T,
	result *kbdto.KnowledgeBaseDTO,
	updatedKB *kbentity.KnowledgeBase,
	updatedName string,
	updatedDescription string,
) {
	t.Helper()

	if result == nil {
		t.Fatal("expected result not nil")
	}
	if updatedKB == nil {
		t.Fatal("expected domain Update to receive knowledge base")
	}
	if updatedKB.Name != updatedName || updatedKB.Description != updatedDescription {
		t.Fatalf("expected updated name/description, got %#v", updatedKB)
	}
	if updatedKB.Enabled {
		t.Fatalf("expected enabled=false, got true")
	}
	if updatedKB.Icon != "new-icon" {
		t.Fatalf("expected icon updated, got %q", updatedKB.Icon)
	}
	if updatedKB.UpdatedUID != "user-2" {
		t.Fatalf("expected updated uid=user-2, got %q", updatedKB.UpdatedUID)
	}
	if updatedKB.RetrieveConfig == nil || updatedKB.RetrieveConfig.TopK != 3 {
		t.Fatalf("expected retrieve config updated, got %#v", updatedKB.RetrieveConfig)
	}
	if updatedKB.FragmentConfig == nil || updatedKB.FragmentConfig.Mode != shared.FragmentModeHierarchy {
		t.Fatalf("expected hierarchy fragment config, got %#v", updatedKB.FragmentConfig)
	}
	if result.UserOperation != 4 {
		t.Fatalf("expected update result user_operation=4, got %#v", result)
	}
}

func assertKnowledgeBaseSourceType(t *testing.T, kb *kbentity.KnowledgeBase, expected int) {
	t.Helper()
	if kb == nil || kb.SourceType == nil || *kb.SourceType != expected {
		t.Fatalf("expected source_type=%d, got %#v", expected, kb)
	}
}

func TestKnowledgeBaseAppServiceUpdateAllowsSameAgentBindingsWithoutMutation(t *testing.T) {
	t.Parallel()

	const updatedName = "new"

	sourceType := int(kbentity.SourceTypeLocalFile)
	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			ID:                99,
			Code:              testAppKnowledgeBaseCode,
			Name:              "old",
			OrganizationCode:  "ORG-1",
			SourceType:        &sourceType,
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		},
	}
	bindingRepo := &recordingKnowledgeBaseBindingRepository{
		bindIDsByKnowledgeBase: map[string][]string{testAppKnowledgeBaseCode: {"SMA-1"}},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetKnowledgeBaseBindingRepository(bindingRepo)
	app.SetKnowledgeBasePermissionReader(&recordingKnowledgeBasePermissionReader{
		operations: map[string]string{testAppKnowledgeBaseCode: "edit"},
	})

	result, err := app.Update(context.Background(), &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-2",
		Code:             testAppKnowledgeBaseCode,
		Name:             updatedName,
		SourceType: func() *int {
			value := int(kbentity.SourceTypeEnterpriseWiki)
			return &value
		}(),
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if result == nil || result.Name != updatedName {
		t.Fatalf("unexpected result: %#v", result)
	}
	if domain.updatedKB == nil || domain.updatedKB.Name != updatedName {
		t.Fatalf("expected domain update with mutable fields, got %#v", domain.updatedKB)
	}
	assertKnowledgeBaseSourceType(t, domain.updatedKB, sourceType)
	if bindingRepo.lastReplaceCode != "" {
		t.Fatalf("expected agent bindings to stay untouched, got %#v", bindingRepo)
	}
}

func TestKnowledgeBaseAppServiceUpdateRejectsProjectKnowledgeBaseEnterpriseBindings(t *testing.T) {
	t.Parallel()

	assertUpdateSemanticMismatch(t, int(kbentity.SourceTypeProject), []kbdto.SourceBindingInput{{
		Provider: sourcebindingdomain.ProviderTeamshare,
		RootType: sourcebindingdomain.RootTypeKnowledgeBase,
		RootRef:  "TS-KB-1",
		SyncMode: sourcebindingdomain.SyncModeManual,
	}})
}

func TestKnowledgeBaseAppServiceUpdateRejectsEnterpriseKnowledgeBaseProjectBindings(t *testing.T) {
	t.Parallel()

	assertUpdateSemanticMismatch(t, int(kbentity.SourceTypeEnterpriseWiki), []kbdto.SourceBindingInput{{
		Provider: sourcebindingdomain.ProviderProject,
		RootType: sourcebindingdomain.RootTypeProject,
		RootRef:  "300",
		SyncMode: sourcebindingdomain.SyncModeManual,
	}})
}

func assertUpdateSemanticMismatch(t *testing.T, currentSourceType int, sourceBindings []kbdto.SourceBindingInput) {
	t.Helper()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			ID:                99,
			Code:              testAppKnowledgeBaseCode,
			Name:              "old",
			OrganizationCode:  "ORG-1",
			SourceType:        &currentSourceType,
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, &recordingKnowledgeBaseDocumentManager{}, nil, nil, "")
	app.SetKnowledgeBaseBindingRepository(&recordingKnowledgeBaseBindingRepository{
		bindIDsByKnowledgeBase: map[string][]string{testAppKnowledgeBaseCode: {"1"}},
	})

	_, err := app.Update(context.Background(), &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-2",
		Code:             testAppKnowledgeBaseCode,
		SourceBindings:   &sourceBindings,
	})
	if !errors.Is(err, service.ErrSourceBindingSemanticMismatch) {
		t.Fatalf("expected ErrSourceBindingSemanticMismatch, got %v", err)
	}
}

func TestKnowledgeBaseAppServiceSaveProcessUpdatesProgress(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			ID:               99,
			Code:             testAppKnowledgeBaseCode,
			OrganizationCode: "ORG-1",
			CreatedUID:       "user-1",
			UpdatedUID:       "user-1",
		},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetKnowledgeBasePermissionReader(&recordingKnowledgeBasePermissionReader{
		operations: map[string]string{
			testAppKnowledgeBaseCode: "admin",
		},
	})

	result, err := app.SaveProcess(context.Background(), &kbdto.SaveProcessKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-2",
		Code:             testAppKnowledgeBaseCode,
		ExpectedNum:      8,
		CompletedNum:     5,
	})
	if err != nil {
		t.Fatalf("SaveProcess returned error: %v", err)
	}
	if result == nil || result.ExpectedNum != 8 || result.CompletedNum != 5 {
		t.Fatalf("unexpected result: %#v", result)
	}
	if domain.updatedKB == nil || domain.updatedKB.ExpectedNum != 8 || domain.updatedKB.CompletedNum != 5 || domain.updatedKB.UpdatedUID != "user-2" {
		t.Fatalf("unexpected updated knowledge base: %#v", domain.updatedKB)
	}
	if result.UserOperation != 2 {
		t.Fatalf("expected save process result user_operation=2, got %#v", result)
	}
}

func TestKnowledgeBaseAppServiceShowPopulatesFallbackFragmentCounts(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:             testAppKnowledgeBaseCode,
			Name:             "知识库",
			OrganizationCode: "ORG-1",
		},
		effectiveModel: effectiveEmbeddingModel,
	}
	counter := &fallbackFragmentCounter{total: 5, synced: 3}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, counter, nil, "")
	app.SetKnowledgeBasePermissionReader(&recordingKnowledgeBasePermissionReader{
		operations: map[string]string{
			testAppKnowledgeBaseCode: "read",
		},
	})

	result, err := app.Show(context.Background(), testAppKnowledgeBaseCode, "ORG-1", "")
	if err != nil {
		t.Fatalf("Show returned error: %v", err)
	}
	if result.FragmentCount != 5 || result.ExpectedCount != 3 || result.CompletedCount != 3 {
		t.Fatalf("unexpected counts: %#v", result)
	}
	if result.Model != effectiveEmbeddingModel {
		t.Fatalf("expected effective model override, got %q", result.Model)
	}
	if counter.totalCalls != 1 || counter.syncedCalls != 1 {
		t.Fatalf("expected fallback counter calls once each, got total=%d synced=%d", counter.totalCalls, counter.syncedCalls)
	}
	if result.UserOperation != 3 {
		t.Fatalf("expected show result user_operation=3, got %#v", result)
	}
}

func TestKnowledgeBaseAppServiceShowIncludesProjectSourceBindings(t *testing.T) {
	t.Parallel()

	sourceType := int(kbentity.SourceTypeProject)
	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:             testAppKnowledgeBaseCode,
			Name:             "知识库",
			OrganizationCode: testOrganizationCode1,
			SourceType:       &sourceType,
		},
		effectiveModel: effectiveEmbeddingModel,
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetKnowledgeBasePermissionReader(&recordingKnowledgeBasePermissionReader{
		operations: map[string]string{
			testAppKnowledgeBaseCode: "read",
		},
	})
	app.SetSourceBindingRepository(&recordingSourceBindingRepository{
		listBindings: []sourcebindingdomain.Binding{
			{
				Provider:   sourcebindingdomain.ProviderProject,
				RootType:   sourcebindingdomain.RootTypeProject,
				RootRef:    "300",
				SyncMode:   sourcebindingdomain.SyncModeRealtime,
				Enabled:    true,
				SyncConfig: map[string]any{"scope": "selected"},
				Targets: []sourcebindingdomain.BindingTarget{
					{TargetType: sourcebindingdomain.TargetTypeFolder, TargetRef: "42"},
					{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "43"},
				},
			},
		},
	})

	result, err := app.Show(context.Background(), testAppKnowledgeBaseCode, testOrganizationCode1, "")
	if err != nil {
		t.Fatalf("Show returned error: %v", err)
	}
	if len(result.SourceBindings) != 1 {
		t.Fatalf("expected one source binding, got %#v", result.SourceBindings)
	}
	binding := result.SourceBindings[0]
	if binding.Provider != sourcebindingdomain.ProviderProject || binding.RootType != sourcebindingdomain.RootTypeProject || binding.RootRef != "300" {
		t.Fatalf("unexpected source binding root: %#v", binding)
	}
	if binding.SyncMode != sourcebindingdomain.SyncModeRealtime || !binding.Enabled {
		t.Fatalf("unexpected source binding sync config: %#v", binding)
	}
	if !reflect.DeepEqual(binding.SyncConfig, map[string]any{"scope": "selected"}) {
		t.Fatalf("unexpected source binding sync_config: %#v", binding.SyncConfig)
	}
	if !reflect.DeepEqual(binding.Targets, []kbdto.SourceBindingTargetDTO{
		{TargetType: sourcebindingdomain.TargetTypeFolder, TargetRef: "42"},
		{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "43"},
	}) {
		t.Fatalf("unexpected source binding targets: %#v", binding.Targets)
	}
}

func TestKnowledgeBaseAppServiceShowIncludesEnterpriseWholeBinding(t *testing.T) {
	t.Parallel()

	sourceType := int(kbentity.SourceTypeEnterpriseWiki)
	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:             testAppKnowledgeBaseCode,
			Name:             "知识库",
			OrganizationCode: testOrganizationCode1,
			SourceType:       &sourceType,
		},
		effectiveModel: effectiveEmbeddingModel,
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetKnowledgeBasePermissionReader(&recordingKnowledgeBasePermissionReader{
		operations: map[string]string{
			testAppKnowledgeBaseCode: "read",
		},
	})
	app.SetSourceBindingRepository(&recordingSourceBindingRepository{
		listBindings: []sourcebindingdomain.Binding{
			{
				Provider: sourcebindingdomain.ProviderTeamshare,
				RootType: sourcebindingdomain.RootTypeKnowledgeBase,
				RootRef:  testTeamshareKnowledgeID,
				SyncMode: sourcebindingdomain.SyncModeManual,
				Enabled:  true,
				Targets:  []sourcebindingdomain.BindingTarget{},
			},
		},
	})

	result, err := app.Show(context.Background(), testAppKnowledgeBaseCode, testOrganizationCode1, "")
	if err != nil {
		t.Fatalf("Show returned error: %v", err)
	}
	if len(result.SourceBindings) != 1 {
		t.Fatalf("expected one source binding, got %#v", result.SourceBindings)
	}
	binding := result.SourceBindings[0]
	if binding.Provider != sourcebindingdomain.ProviderTeamshare || binding.RootRef != testTeamshareKnowledgeID {
		t.Fatalf("unexpected enterprise source binding: %#v", binding)
	}
	if len(binding.Targets) != 0 {
		t.Fatalf("expected whole knowledge base binding with empty targets, got %#v", binding.Targets)
	}
}

func TestKnowledgeBaseAppServiceShowReturnsBindingLookupError(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:             testAppKnowledgeBaseCode,
			Name:             "知识库",
			OrganizationCode: "ORG-1",
		},
		effectiveModel: effectiveEmbeddingModel,
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetKnowledgeBaseBindingRepository(&recordingKnowledgeBaseBindingRepository{
		batchListErr: errBindingLookupFailed,
	})

	_, err := app.Show(context.Background(), testAppKnowledgeBaseCode, "ORG-1", "")
	if err == nil || !errors.Is(err, errBindingLookupFailed) {
		t.Fatalf("expected binding lookup error, got %v", err)
	}
}

func TestKnowledgeBaseAppServiceListBuildsPageResult(t *testing.T) {
	t.Parallel()

	enabled := true
	kbType := 2
	domain := &recordingKnowledgeBaseDomainService{
		listKBS: []*kbentity.KnowledgeBase{
			{Code: testAppKnowledgeBaseCode, Name: "A"},
			{Code: testAppKnowledgeBaseCode2, Name: "B"},
		},
		listTotal:      2,
		effectiveModel: effectiveEmbeddingModel,
	}
	counter := &fallbackFragmentCounter{total: 7, synced: 4}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, counter, nil, "")
	app.SetKnowledgeBasePermissionReader(&recordingKnowledgeBasePermissionReader{
		operations: map[string]string{
			testAppKnowledgeBaseCode:  "read",
			testAppKnowledgeBaseCode2: "edit",
		},
	})

	result, err := app.List(context.Background(), &kbdto.ListKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Name:             "关键字",
		Type:             &kbType,
		Enabled:          &enabled,
		Codes:            []string{testAppKnowledgeBaseCode},
		BusinessIDs:      []string{"BIZ-1"},
		Offset:           10,
		Limit:            20,
	})
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	assertKnowledgeBaseListPageResult(t, result)
	assertKnowledgeBaseListQuery(t, domain.lastListQuery)
	list := mustKnowledgeBaseDTOList(t, result.List)
	assertKnowledgeBaseListItems(t, list)
	assertKnowledgeBaseListFallbackStats(t, counter)
	assertKnowledgeBaseListResolvedModelCalls(t, domain.resolveRuntimeRouteCalls)
}

func TestKnowledgeBaseAppServiceListReturnsBindingLookupError(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		listKBS: []*kbentity.KnowledgeBase{
			{Code: testAppKnowledgeBaseCode, Name: "A"},
		},
		listTotal:      1,
		effectiveModel: effectiveEmbeddingModel,
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetKnowledgeBasePermissionReader(&recordingKnowledgeBasePermissionReader{
		operations: map[string]string{
			testAppKnowledgeBaseCode: "read",
		},
	})
	app.SetKnowledgeBaseBindingRepository(&recordingKnowledgeBaseBindingRepository{
		batchListErr: errBindingLookupFailed,
	})

	_, err := app.List(context.Background(), &kbdto.ListKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Offset:           0,
		Limit:            20,
	})
	if err == nil || !errors.Is(err, errBindingLookupFailed) {
		t.Fatalf("expected binding lookup error, got %v", err)
	}
}

func TestKnowledgeBaseAppServiceListFiltersByReadablePermissions(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		listKBS: []*kbentity.KnowledgeBase{
			{Code: testAppKnowledgeBaseCode, Name: "A", KnowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector},
		},
		listTotal: 1,
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetKnowledgeBasePermissionReader(&recordingKnowledgeBasePermissionReader{
		operations: map[string]string{
			testAppKnowledgeBaseCode: "read",
		},
	})

	result, err := app.List(context.Background(), &kbdto.ListKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Offset:           0,
		Limit:            20,
	})
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if domain.lastListQuery == nil || len(domain.lastListQuery.Codes) != 1 || domain.lastListQuery.Codes[0] != testAppKnowledgeBaseCode {
		t.Fatalf("expected readable codes filtered into query, got %#v", domain.lastListQuery)
	}
	if result.Total != 1 {
		t.Fatalf("expected total=1, got %d", result.Total)
	}
}

func TestKnowledgeBaseAppServiceListDefaultsMissingBindingsToFlowVectorView(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		listKBS: []*kbentity.KnowledgeBase{
			{Code: testAppKnowledgeBaseCode, Name: "A"},
		},
		listTotal: 1,
	}
	bindingRepo := &recordingKnowledgeBaseBindingRepository{}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetKnowledgeBasePermissionReader(&recordingKnowledgeBasePermissionReader{
		operations: map[string]string{
			testAppKnowledgeBaseCode:  "read",
			testAppKnowledgeBaseCode2: "read",
		},
	})
	app.SetKnowledgeBaseBindingRepository(bindingRepo)

	result, err := app.List(context.Background(), &kbdto.ListKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Codes:            []string{testAppKnowledgeBaseCode, testAppKnowledgeBaseCode2},
		Offset:           0,
		Limit:            20,
	})
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if domain.lastListQuery == nil || !reflect.DeepEqual(domain.lastListQuery.Codes, []string{testAppKnowledgeBaseCode, testAppKnowledgeBaseCode2}) {
		t.Fatalf("expected flow-vector query codes kept, got %#v", domain.lastListQuery)
	}
	if bindingRepo.batchListCalls != 1 {
		t.Fatalf("expected one batch binding lookup, got %d", bindingRepo.batchListCalls)
	}
	if result.Total != 1 {
		t.Fatalf("expected total=1, got %d", result.Total)
	}
}

func TestKnowledgeBaseAppServiceListKeepsRequestedCodesWithExternalPermission(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		listKBS: []*kbentity.KnowledgeBase{
			{Code: testAppKnowledgeBaseCode, Name: "A", BusinessID: "BIZ-1", Type: 2},
		},
		listTotal: 1,
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetKnowledgeBasePermissionReader(&recordingKnowledgeBasePermissionReader{
		operations: map[string]string{},
	})
	app.SetThirdPlatformExpander(&fakeThirdPlatformExpander{
		knowledgeBases: []thirdplatform.KnowledgeBaseItem{
			{KnowledgeBaseID: "BIZ-1", Name: "A"},
		},
	})

	result, err := app.List(context.Background(), &kbdto.ListKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Codes:            []string{testAppKnowledgeBaseCode},
		Offset:           0,
		Limit:            20,
	})
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if domain.lastListQuery == nil || !reflect.DeepEqual(domain.lastListQuery.Codes, []string{testAppKnowledgeBaseCode}) {
		t.Fatalf("expected externally manageable code to survive access filtering, got %#v", domain.lastListQuery)
	}
	if result.Total != 1 {
		t.Fatalf("expected total=1, got %d", result.Total)
	}
}

func TestKnowledgeBaseAppServiceListFiltersByDigitalEmployeeView(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		listKBS: []*kbentity.KnowledgeBase{
			{Code: testAppKnowledgeBaseCode2, Name: "B", KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee},
		},
		listTotal: 1,
	}
	bindingRepo := &recordingKnowledgeBaseBindingRepository{
		bindIDsByKnowledgeBase: map[string][]string{
			testAppKnowledgeBaseCode2: {"SMA-1"},
		},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetKnowledgeBasePermissionReader(&recordingKnowledgeBasePermissionReader{
		operations: map[string]string{
			testAppKnowledgeBaseCode:  "read",
			testAppKnowledgeBaseCode2: "read",
		},
	})
	app.SetKnowledgeBaseBindingRepository(bindingRepo)

	result, err := app.List(context.Background(), &kbdto.ListKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		AgentCodes:       []string{"SMA-1"},
		Codes:            []string{testAppKnowledgeBaseCode, testAppKnowledgeBaseCode2},
		Offset:           0,
		Limit:            20,
	})
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if domain.lastListQuery == nil || !reflect.DeepEqual(domain.lastListQuery.Codes, []string{testAppKnowledgeBaseCode2}) {
		t.Fatalf("expected readable codes passed through query, got %#v", domain.lastListQuery)
	}
	if domain.lastListQuery.KnowledgeBaseType == nil || *domain.lastListQuery.KnowledgeBaseType != kbentity.KnowledgeBaseTypeDigitalEmployee {
		t.Fatalf("expected digital-employee list query, got %#v", domain.lastListQuery)
	}
	if bindingRepo.batchListCalls != 2 {
		t.Fatalf("expected two batch binding lookups, got %d", bindingRepo.batchListCalls)
	}
	list := mustKnowledgeBaseDTOList(t, result.List)
	if len(list) != 1 || list[0].KnowledgeBaseType != string(kbentity.KnowledgeBaseTypeDigitalEmployee) {
		t.Fatalf("expected one digital employee knowledge base, got %#v", list)
	}
}

func TestKnowledgeBaseAppServiceShowRejectsWithoutReadPermission(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:              testAppKnowledgeBaseCode,
			OrganizationCode:  "ORG-1",
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetKnowledgeBasePermissionReader(&recordingKnowledgeBasePermissionReader{
		operations: map[string]string{
			testAppKnowledgeBaseCode: "none",
		},
	})

	_, err := app.Show(context.Background(), testAppKnowledgeBaseCode, "ORG-1", "user-1")
	if err == nil || !errors.Is(err, service.ErrKnowledgeBasePermissionDenied) {
		t.Fatalf("expected permission denied, got %v", err)
	}
}

func TestKnowledgeBaseAppServiceShowUsesKnowledgeBaseScope(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:              testAppKnowledgeBaseCode,
			OrganizationCode:  "ORG-1",
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetKnowledgeBaseBindingRepository(&recordingKnowledgeBaseBindingRepository{
		bindIDsByKnowledgeBase: map[string][]string{testAppKnowledgeBaseCode: {"SMA-1"}},
	})

	result, err := app.Show(context.Background(), testAppKnowledgeBaseCode, "ORG-1", "user-1")
	if err != nil {
		t.Fatalf("expected show success, got %v", err)
	}
	if result == nil || result.Code != testAppKnowledgeBaseCode {
		t.Fatalf("unexpected result: %#v", result)
	}
}

func TestKnowledgeBaseAppServiceShowRejectsEmptyUserIDWithoutBypass(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:              testAppKnowledgeBaseCode,
			OrganizationCode:  "ORG-1",
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetKnowledgeBasePermissionReader(&recordingKnowledgeBasePermissionReader{})

	_, err := app.Show(context.Background(), testAppKnowledgeBaseCode, "ORG-1", "")
	if err == nil || !errors.Is(err, service.ErrKnowledgeBasePermissionDenied) {
		t.Fatalf("expected permission denied for empty user id, got %v", err)
	}
}

func TestKnowledgeBaseAppServiceDestroyRejectsWithoutDeletePermission(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:              testAppKnowledgeBaseCode,
			OrganizationCode:  "ORG-1",
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetKnowledgeBasePermissionReader(&recordingKnowledgeBasePermissionReader{
		operations: map[string]string{
			testAppKnowledgeBaseCode: "edit",
		},
	})

	err := app.Destroy(context.Background(), testAppKnowledgeBaseCode, "ORG-1", "user-1")
	if err == nil || !errors.Is(err, service.ErrKnowledgeBasePermissionDenied) {
		t.Fatalf("expected permission denied, got %v", err)
	}
}

func TestKnowledgeBaseAppServiceDestroyUsesExternalPermissionForRequestedCode(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		filterListByQuery: true,
		listKBS: []*kbentity.KnowledgeBase{
			{
				Code:             testAppKnowledgeBaseCode,
				OrganizationCode: "ORG-1",
				BusinessID:       "BIZ-1",
				Type:             2,
			},
			{
				Code:             testAppKnowledgeBaseCode2,
				OrganizationCode: "ORG-1",
				BusinessID:       "BIZ-1",
				Type:             2,
			},
		},
		showKB: &kbentity.KnowledgeBase{
			Code:             testAppKnowledgeBaseCode,
			OrganizationCode: "ORG-1",
			BusinessID:       "BIZ-1",
			Type:             2,
		},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetKnowledgeBasePermissionReader(&recordingKnowledgeBasePermissionReader{
		operations: map[string]string{},
	})
	app.SetThirdPlatformExpander(&fakeThirdPlatformExpander{
		knowledgeBases: []thirdplatform.KnowledgeBaseItem{
			{KnowledgeBaseID: "BIZ-1", Name: "Teamshare Knowledge"},
		},
	})

	err := app.Destroy(context.Background(), testAppKnowledgeBaseCode, "ORG-1", "user-1")
	if err != nil {
		t.Fatalf("expected destroy success with external admin permission, got %v", err)
	}
	if domain.lastListQuery == nil {
		t.Fatal("expected external permission lookup to query local knowledge bases")
	}
	if !reflect.DeepEqual(domain.lastListQuery.Codes, []string{testAppKnowledgeBaseCode}) {
		t.Fatalf("expected local lookup constrained by requested code, got %#v", domain.lastListQuery.Codes)
	}
	if !reflect.DeepEqual(domain.lastListQuery.BusinessIDs, []string{"BIZ-1"}) {
		t.Fatalf("expected local lookup constrained by manageable business id, got %#v", domain.lastListQuery.BusinessIDs)
	}
	if domain.destroyedKB == nil || domain.destroyedKB.Code != testAppKnowledgeBaseCode {
		t.Fatalf("expected requested knowledge base destroyed, got %#v", domain.destroyedKB)
	}
}

func TestKnowledgeBaseAppServiceUpdateRejectsWithoutEditPermission(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{Code: testAppKnowledgeBaseCode, OrganizationCode: "ORG-1"},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetKnowledgeBasePermissionReader(&recordingKnowledgeBasePermissionReader{
		operations: map[string]string{
			testAppKnowledgeBaseCode: "read",
		},
	})

	_, err := app.Update(context.Background(), &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Code:             testAppKnowledgeBaseCode,
		Name:             "updated",
	})
	if err == nil || !errors.Is(err, service.ErrKnowledgeBasePermissionDenied) {
		t.Fatalf("expected permission denied, got %v", err)
	}
}

func TestKnowledgeBaseAppServiceDestroyUsesKnowledgeBaseScope(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:              testAppKnowledgeBaseCode,
			OrganizationCode:  "ORG-1",
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	app.SetKnowledgeBaseBindingRepository(&recordingKnowledgeBaseBindingRepository{
		bindIDsByKnowledgeBase: map[string][]string{testAppKnowledgeBaseCode: {"SMA-1"}},
	})

	err := app.Destroy(context.Background(), testAppKnowledgeBaseCode, "ORG-1", "user-1")
	if err != nil {
		t.Fatalf("expected destroy success, got %v", err)
	}
	if domain.destroyedKB == nil || domain.destroyedKB.Code != testAppKnowledgeBaseCode {
		t.Fatalf("expected knowledge base destroyed, got %#v", domain.destroyedKB)
	}
}

func TestKnowledgeBaseAppServiceDestroyLoadsThenDestroys(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{ID: 7, Code: testAppKnowledgeBaseCode, OrganizationCode: "ORG-1"},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	destroyCoordinator := &recordingDestroyCoordinator{}
	permissionPort := &recordingKnowledgeBaseOwnerGrantPort{}
	app.SetDestroyCoordinator(destroyCoordinator)
	app.SetKnowledgeBasePermissionWriter(permissionPort)

	if err := app.Destroy(context.Background(), testAppKnowledgeBaseCode, "ORG-1", ""); err != nil {
		t.Fatalf("Destroy returned error: %v", err)
	}
	if domain.lastShowCode != testAppKnowledgeBaseCode || domain.lastShowOrg != "ORG-1" {
		t.Fatalf("expected show lookup before destroy, got code=%q org=%q", domain.lastShowCode, domain.lastShowOrg)
	}
	if domain.deletedVectorKB == nil || domain.deletedVectorKB.Code != testAppKnowledgeBaseCode {
		t.Fatalf("expected vector delete for %s, got %#v", testAppKnowledgeBaseCode, domain.deletedVectorKB)
	}
	if destroyCoordinator.destroyedKnowledgeBaseID != 7 || destroyCoordinator.destroyedKnowledgeBaseCode != testAppKnowledgeBaseCode {
		t.Fatalf("expected destroy coordinator for kb=KB-1, got %#v", destroyCoordinator)
	}
	if permissionPort.deletedKnowledgeBaseCode != testAppKnowledgeBaseCode {
		t.Fatalf("expected permission cleanup for %s, got %#v", testAppKnowledgeBaseCode, permissionPort)
	}
}

func TestKnowledgeBaseAppServiceDestroyStopsWhenDeletingVectorDataFails(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB:          &kbentity.KnowledgeBase{ID: 7, Code: testAppKnowledgeBaseCode, OrganizationCode: "ORG-1"},
		deleteVectorErr: errVectorDeleteFailed,
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	destroyCoordinator := &recordingDestroyCoordinator{}
	app.SetDestroyCoordinator(destroyCoordinator)

	err := app.Destroy(context.Background(), testAppKnowledgeBaseCode, "ORG-1", "")
	if err == nil || !errors.Is(err, errVectorDeleteFailed) {
		t.Fatalf("expected wrapped vector delete error, got %v", err)
	}
	if destroyCoordinator.destroyedKnowledgeBaseCode != "" {
		t.Fatalf("expected destroy coordinator to be skipped, got %#v", destroyCoordinator)
	}
}

func TestKnowledgeBaseAppServiceDestroyStopsWhenDestroyCoordinatorFails(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{ID: 7, Code: testAppKnowledgeBaseCode, OrganizationCode: "ORG-1"},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")
	destroyCoordinator := &recordingDestroyCoordinator{destroyErr: errDestroyCoordinatorFailed}
	app.SetDestroyCoordinator(destroyCoordinator)

	err := app.Destroy(context.Background(), testAppKnowledgeBaseCode, "ORG-1", "")
	if err == nil || !errors.Is(err, errDestroyCoordinatorFailed) {
		t.Fatalf("expected wrapped destroy coordinator error, got %v", err)
	}
	if domain.deletedVectorKB == nil || domain.deletedVectorKB.Code != testAppKnowledgeBaseCode {
		t.Fatalf("expected vector delete before destroy coordinator failure, got %#v", domain.deletedVectorKB)
	}
}

func TestKnowledgeBaseAppServiceDestroyReturnsLookupError(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{showErr: errKnowledgeBaseLookupTest}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, "")

	err := app.Destroy(context.Background(), "KB-404", "ORG-1", "")
	if err == nil || !strings.Contains(err.Error(), "failed to find knowledge base") {
		t.Fatalf("expected wrapped lookup error, got %v", err)
	}
}

func TestKnowledgeBaseAppServiceConvertCountRejectsNegativeStats(t *testing.T) {
	t.Parallel()

	dto := &kbdto.KnowledgeBaseDTO{Code: testAppKnowledgeBaseCode}
	counter := &fakeFragmentCounter{total: -1, synced: 1}
	svc := service.NewKnowledgeBaseAppServiceForTest(t, nil, nil, counter, nil, "")

	service.PopulateFragmentCountsForTest(context.Background(), svc, dto)
	if dto.FragmentCount != 0 || dto.ExpectedCount != 0 || dto.CompletedCount != 0 {
		t.Fatalf("expected counts to stay zero on negative stats, got %#v", dto)
	}
}

func TestKnowledgeBaseAppServiceShowIgnoresAggregatedCountFailure(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{Code: testAppKnowledgeBaseCode, Name: "知识库"},
	}
	counter := &errorStatsFragmentCounter{err: errStatsFailed}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, counter, testKnowledgeBaseAppLogger(), "")

	result, err := app.Show(context.Background(), testAppKnowledgeBaseCode, "ORG-1", "")
	if err != nil {
		t.Fatalf("Show returned error: %v", err)
	}
	if result.FragmentCount != 0 || result.ExpectedCount != 0 || result.CompletedCount != 0 {
		t.Fatalf("expected counts to remain zero on stats error, got %#v", result)
	}
}

func TestKnowledgeBaseAppServiceEntityToDTOWithZeroOverlapSegmentRule(t *testing.T) {
	t.Parallel()

	svc := &service.KnowledgeBaseAppService{}
	kb := &kbentity.KnowledgeBase{
		Code: testAppKnowledgeBaseCode,
		FragmentConfig: &shared.FragmentConfig{
			Mode: shared.FragmentModeCustom,
			Normal: &shared.NormalFragmentConfig{
				SegmentRule: &shared.SegmentRule{
					Separator:        "\n\n",
					ChunkSize:        300,
					ChunkOverlap:     20,
					ChunkOverlapUnit: shared.ChunkOverlapUnitPercent,
				},
			},
		},
	}

	dto := service.EntityToDTOForTest(svc, kb)
	if dto == nil || dto.FragmentConfig == nil || dto.FragmentConfig.Normal == nil {
		t.Fatalf("expected normalized custom fragment config, got %#v", dto)
	}
	if dto.FragmentConfig.Mode != int(shared.FragmentModeCustom) {
		t.Fatalf("expected custom mode, got %d", dto.FragmentConfig.Mode)
	}
	if dto.FragmentConfig.Normal.SegmentRule == nil {
		t.Fatalf("expected normal segment rule, got %#v", dto.FragmentConfig.Normal)
	}
	if dto.FragmentConfig.Normal.SegmentRule.ChunkOverlap != 20 {
		t.Fatalf("expected overlap kept on custom mode, got %d", dto.FragmentConfig.Normal.SegmentRule.ChunkOverlap)
	}
	if dto.FragmentConfig.Normal.SegmentRule.ChunkOverlapUnit != shared.ChunkOverlapUnitPercent {
		t.Fatalf("expected overlap unit kept on custom mode, got %q", dto.FragmentConfig.Normal.SegmentRule.ChunkOverlapUnit)
	}
}

func TestKnowledgeBaseAppServiceInputToEntityCopiesOptionalConfigs(t *testing.T) {
	t.Parallel()

	svc := &service.KnowledgeBaseAppService{}
	kb := service.InputToEntityForTest(svc, &kbdto.CreateKnowledgeBaseInput{
		Code:             testAppKnowledgeBaseCode,
		Name:             "知识库",
		Description:      "desc",
		Type:             1,
		Model:            "text-embedding-3-large",
		VectorDB:         "odin_qdrant",
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		RetrieveConfig:   &confighelper.RetrieveConfigDTO{TopK: 5},
		FragmentConfig: &confighelper.FragmentConfigDTO{
			Mode: 1,
			Normal: &confighelper.NormalFragmentConfigDTO{
				TextPreprocessRule: []int{1},
				SegmentRule: &confighelper.SegmentRuleDTO{
					Separator:        "\n\n",
					ChunkSize:        400,
					ChunkOverlap:     40,
					ChunkOverlapUnit: shared.ChunkOverlapUnitPercent,
				},
			},
		},
	})
	if kb.RetrieveConfig == nil || kb.RetrieveConfig.TopK != 5 {
		t.Fatalf("expected retrieve config copied, got %#v", kb.RetrieveConfig)
	}
	if kb.FragmentConfig == nil || kb.FragmentConfig.Normal == nil || kb.FragmentConfig.Normal.SegmentRule == nil {
		t.Fatalf("expected fragment config copied, got %#v", kb.FragmentConfig)
	}
	if kb.FragmentConfig.Normal.SegmentRule.ChunkOverlap != 40 {
		t.Fatalf("expected chunk overlap 40, got %d", kb.FragmentConfig.Normal.SegmentRule.ChunkOverlap)
	}
	if kb.FragmentConfig.Normal.SegmentRule.ChunkOverlapUnit != shared.ChunkOverlapUnitPercent {
		t.Fatalf("expected chunk overlap unit percent, got %q", kb.FragmentConfig.Normal.SegmentRule.ChunkOverlapUnit)
	}
}

type recordingKnowledgeBaseDomainService struct {
	saveErr                           error
	prepareSaveErr                    error
	updateErr                         error
	updateProgressErr                 error
	showErr                           error
	listErr                           error
	destroyErr                        error
	deleteVectorErr                   error
	savedKB                           *kbentity.KnowledgeBase
	savedResolvedVectorCollectionName string
	updatedKB                         *kbentity.KnowledgeBase
	updatedKBs                        []*kbentity.KnowledgeBase
	showKB                            *kbentity.KnowledgeBase
	listKBS                           []*kbentity.KnowledgeBase
	listTotal                         int64
	destroyedKB                       *kbentity.KnowledgeBase
	deletedVectorKB                   *kbentity.KnowledgeBase

	lastShowCode  string
	lastShowOrg   string
	lastListQuery *kbrepository.Query

	effectiveModel           string
	filterListByQuery        bool
	resolvedCollection       string
	resolveRuntimeRouteCalls int
	events                   *[]string
}

func (r *recordingKnowledgeBaseDomainService) PrepareForSave(_ context.Context, kb *kbentity.KnowledgeBase) error {
	r.savedKB = cloneKnowledgeBase(kb)
	return r.prepareSaveErr
}

func (r *recordingKnowledgeBaseDomainService) Save(_ context.Context, kb *kbentity.KnowledgeBase) error {
	if r.events != nil {
		*r.events = append(*r.events, "kb-save")
	}
	if kb.ResolvedRoute != nil {
		r.savedResolvedVectorCollectionName = kb.ResolvedRoute.VectorCollectionName
	}
	r.savedKB = cloneKnowledgeBase(kb)
	return r.saveErr
}

func (r *recordingKnowledgeBaseDomainService) Update(_ context.Context, kb *kbentity.KnowledgeBase) error {
	r.updatedKB = cloneKnowledgeBase(kb)
	r.updatedKBs = append(r.updatedKBs, cloneKnowledgeBase(kb))
	return r.updateErr
}

func (r *recordingKnowledgeBaseDomainService) UpdateProgress(_ context.Context, kb *kbentity.KnowledgeBase) error {
	r.updatedKB = cloneKnowledgeBase(kb)
	return r.updateProgressErr
}

func (r *recordingKnowledgeBaseDomainService) ShowByCodeAndOrg(_ context.Context, code, orgCode string) (*kbentity.KnowledgeBase, error) {
	r.lastShowCode = code
	r.lastShowOrg = orgCode
	if r.showErr != nil {
		return nil, r.showErr
	}
	return cloneKnowledgeBase(r.showKB), nil
}

func (r *recordingKnowledgeBaseDomainService) List(_ context.Context, query *kbrepository.Query) ([]*kbentity.KnowledgeBase, int64, error) {
	r.lastListQuery = query
	if r.listErr != nil {
		return nil, 0, r.listErr
	}
	if !r.filterListByQuery || query == nil {
		items := cloneKnowledgeBaseList(r.listKBS)
		return items, resolveKnowledgeBaseListTotal(r.listTotal, items), nil
	}

	codeFilter := buildStringSet(query.Codes)
	businessIDFilter := buildStringSet(query.BusinessIDs)
	items := make([]*kbentity.KnowledgeBase, 0, len(r.listKBS))
	for _, kb := range r.listKBS {
		if r.matchesListQuery(kb, query, codeFilter, businessIDFilter) {
			items = append(items, cloneKnowledgeBase(kb))
		}
	}
	return items, resolveKnowledgeBaseListTotal(r.listTotal, items), nil
}

func (r *recordingKnowledgeBaseDomainService) matchesListQuery(
	kb *kbentity.KnowledgeBase,
	query *kbrepository.Query,
	codeFilter map[string]struct{},
	businessIDFilter map[string]struct{},
) bool {
	if kb == nil || query == nil {
		return false
	}
	if query.OrganizationCode != "" && kb.OrganizationCode != "" && kb.OrganizationCode != query.OrganizationCode {
		return false
	}
	if query.Type != nil && kb.Type != *query.Type {
		return false
	}
	if len(codeFilter) > 0 {
		if _, ok := codeFilter[kb.Code]; !ok {
			return false
		}
	}
	if len(businessIDFilter) > 0 {
		if _, ok := businessIDFilter[kb.BusinessID]; !ok {
			return false
		}
	}
	return true
}

func cloneKnowledgeBaseList(list []*kbentity.KnowledgeBase) []*kbentity.KnowledgeBase {
	items := make([]*kbentity.KnowledgeBase, 0, len(list))
	for _, kb := range list {
		if kb == nil {
			continue
		}
		items = append(items, cloneKnowledgeBase(kb))
	}
	return items
}

func resolveKnowledgeBaseListTotal(total int64, items []*kbentity.KnowledgeBase) int64 {
	if total != 0 {
		return total
	}
	return int64(len(items))
}

func buildStringSet(values []string) map[string]struct{} {
	if len(values) == 0 {
		return map[string]struct{}{}
	}
	result := make(map[string]struct{}, len(values))
	for _, value := range values {
		result[value] = struct{}{}
	}
	return result
}

func (r *recordingKnowledgeBaseDomainService) Destroy(_ context.Context, kb *kbentity.KnowledgeBase) error {
	r.destroyedKB = cloneKnowledgeBase(kb)
	return r.destroyErr
}

func (r *recordingKnowledgeBaseDomainService) DeleteVectorData(_ context.Context, kb *kbentity.KnowledgeBase) error {
	r.deletedVectorKB = cloneKnowledgeBase(kb)
	return r.deleteVectorErr
}

func (r *recordingKnowledgeBaseDomainService) ResolveRuntimeRoute(_ context.Context, kb *kbentity.KnowledgeBase) sharedroute.ResolvedRoute {
	r.resolveRuntimeRouteCalls++
	collection := r.resolvedCollection
	if collection == "" && kb != nil {
		collection = kb.CollectionName()
	}
	return sharedroute.ResolvedRoute{
		LogicalCollectionName:  collection,
		PhysicalCollectionName: collection,
		VectorCollectionName:   collection,
		TermCollectionName:     collection,
		Model:                  r.effectiveModel,
	}
}

type recordingKnowledgeBaseDocumentManager struct {
	createResults []*service.ManagedDocument
	createErrAt   int
	createErr     error
	destroyErrAt  int
	destroyErr    error
	events        *[]string

	createInputs               []*service.CreateManagedDocumentInput
	listByProject              map[int64][]*service.ManagedDocument
	listByKnowledgeBase        []*service.ManagedDocument
	destroyInputs              []destroyDocumentInput
	destroyKnowledgeBaseInputs []destroyKnowledgeBaseDocumentsInput
	syncInputs                 []*service.SyncDocumentInput
}

type destroyDocumentInput struct {
	code              string
	knowledgeBaseCode string
}

type destroyKnowledgeBaseDocumentsInput struct {
	knowledgeBaseCode string
	organizationCode  string
}

func (r *recordingKnowledgeBaseDocumentManager) CreateManagedDocument(
	_ context.Context,
	input *service.CreateManagedDocumentInput,
) (*service.ManagedDocument, error) {
	if r.events != nil {
		*r.events = append(*r.events, "doc-create:"+input.Name)
	}
	r.createInputs = append(r.createInputs, cloneCreateDocumentInput(input))
	index := len(r.createInputs) - 1
	if r.createErr != nil && index == r.createErrAt {
		return nil, r.createErr
	}
	var result *service.ManagedDocument
	if index < len(r.createResults) && r.createResults[index] != nil {
		result = cloneManagedDocumentDTO(r.createResults[index])
	} else {
		result = &service.ManagedDocument{Code: "DOC-DEFAULT", KnowledgeBaseCode: input.KnowledgeBaseCode}
	}
	if result.DocumentFile == nil {
		result.DocumentFile = cloneDocumentFile(input.DocumentFile)
	}
	if result.KnowledgeBaseCode == "" {
		result.KnowledgeBaseCode = input.KnowledgeBaseCode
	}
	r.listByKnowledgeBase = append(r.listByKnowledgeBase, result)
	return result, nil
}

func (r *recordingKnowledgeBaseDocumentManager) ListManagedDocumentsByKnowledgeBaseAndProject(
	_ context.Context,
	_ string,
	projectID int64,
) ([]*service.ManagedDocument, error) {
	if r.listByProject == nil {
		return nil, nil
	}
	return r.listByProject[projectID], nil
}

func (r *recordingKnowledgeBaseDocumentManager) ListManagedDocumentsByKnowledgeBase(
	_ context.Context,
	_ string,
) ([]*service.ManagedDocument, error) {
	if r.listByKnowledgeBase != nil {
		return cloneManagedDocumentDTOs(r.listByKnowledgeBase), nil
	}
	if len(r.listByProject) == 0 {
		return nil, nil
	}
	results := make([]*service.ManagedDocument, 0)
	for _, docs := range r.listByProject {
		results = append(results, docs...)
	}
	return results, nil
}

func (r *recordingKnowledgeBaseDocumentManager) DestroyManagedDocument(_ context.Context, code, knowledgeBaseCode string) error {
	r.destroyInputs = append(r.destroyInputs, destroyDocumentInput{code: code, knowledgeBaseCode: knowledgeBaseCode})
	if r.destroyErr != nil && len(r.destroyInputs)-1 == r.destroyErrAt {
		return r.destroyErr
	}
	filtered := r.listByKnowledgeBase[:0]
	for _, doc := range r.listByKnowledgeBase {
		if doc != nil && doc.Code == code && doc.KnowledgeBaseCode == knowledgeBaseCode {
			continue
		}
		filtered = append(filtered, doc)
	}
	r.listByKnowledgeBase = filtered
	return nil
}

func (r *recordingKnowledgeBaseDocumentManager) DestroyKnowledgeBaseDocuments(
	_ context.Context,
	knowledgeBaseCode string,
	organizationCode string,
) error {
	r.destroyKnowledgeBaseInputs = append(r.destroyKnowledgeBaseInputs, destroyKnowledgeBaseDocumentsInput{
		knowledgeBaseCode: knowledgeBaseCode,
		organizationCode:  organizationCode,
	})
	filtered := r.listByKnowledgeBase[:0]
	for _, doc := range r.listByKnowledgeBase {
		if doc != nil && doc.KnowledgeBaseCode == knowledgeBaseCode {
			continue
		}
		filtered = append(filtered, doc)
	}
	r.listByKnowledgeBase = filtered
	return nil
}

func (r *recordingKnowledgeBaseDocumentManager) ScheduleManagedDocumentSync(_ context.Context, input *service.SyncDocumentInput) {
	if r.events != nil {
		*r.events = append(*r.events, "doc-sync:"+input.Code)
	}
	cloned := *input
	if input.BusinessParams != nil {
		copied := *input.BusinessParams
		cloned.BusinessParams = &copied
	}
	r.syncInputs = append(r.syncInputs, &cloned)
}

type recordingSourceBindingRepository struct {
	lastReplaceKnowledgeBaseCode string
	lastReplaceBindings          []sourcebindingdomain.Binding
	lastApplyInput               sourcebindingrepository.ApplyKnowledgeBaseBindingsInput
	applyInputs                  []sourcebindingrepository.ApplyKnowledgeBaseBindingsInput
	lastSavedKnowledgeBaseCode   string
	lastSavedBindings            []sourcebindingdomain.Binding
	listBindings                 []sourcebindingdomain.Binding
	listBindingItems             []sourcebindingdomain.BindingItem
	listBindingsByKnowledgeBase  map[string][]sourcebindingdomain.Binding
	sourceItemIDs                map[string]int64
	nextSourceItemID             int64
	deletedKnowledgeBaseCode     string
	deleteErr                    error
}

type recordingDestroyCoordinator struct {
	destroyErr                 error
	destroyedKnowledgeBaseID   int64
	destroyedKnowledgeBaseCode string
}

func (r *recordingDestroyCoordinator) Destroy(_ context.Context, knowledgeBaseID int64, knowledgeBaseCode string) error {
	r.destroyedKnowledgeBaseID = knowledgeBaseID
	r.destroyedKnowledgeBaseCode = knowledgeBaseCode
	return r.destroyErr
}

type recordingKnowledgeBaseOwnerGrantPort struct {
	err                      error
	lastOrganizationCode     string
	lastCurrentUserID        string
	lastKnowledgeBaseCode    string
	lastOwnerUserID          string
	deletedKnowledgeBaseCode string
	events                   *[]string
}

type recordingKnowledgeBasePermissionReader struct {
	operations map[string]string
	err        error
	official   bool
}

func (r *recordingKnowledgeBasePermissionReader) ListOperations(context.Context, string, string, []string) (map[string]string, error) {
	if r.err != nil {
		return nil, r.err
	}
	result := make(map[string]string, len(r.operations))
	maps.Copy(result, r.operations)
	return result, nil
}

func (r *recordingKnowledgeBasePermissionReader) IsOfficialOrganizationMember(context.Context, string) (bool, error) {
	if r.err != nil {
		return false, r.err
	}
	return r.official, nil
}

func (r *recordingKnowledgeBaseOwnerGrantPort) Initialize(
	_ context.Context,
	actor kbaccess.Actor,
	input kbaccess.InitializeInput,
) error {
	if r.events != nil {
		*r.events = append(*r.events, "owner-grant")
	}
	r.lastOrganizationCode = actor.OrganizationCode
	r.lastCurrentUserID = actor.UserID
	r.lastKnowledgeBaseCode = input.KnowledgeBaseCode
	r.lastOwnerUserID = input.OwnerUserID
	return r.err
}

func (r *recordingKnowledgeBaseOwnerGrantPort) GrantOwner(
	_ context.Context,
	actor kbaccess.Actor,
	knowledgeBaseCode string,
	ownerUserID string,
) error {
	if r.events != nil {
		*r.events = append(*r.events, "owner-grant")
	}
	r.lastOrganizationCode = actor.OrganizationCode
	r.lastCurrentUserID = actor.UserID
	r.lastKnowledgeBaseCode = knowledgeBaseCode
	r.lastOwnerUserID = ownerUserID
	return r.err
}

func (r *recordingKnowledgeBaseOwnerGrantPort) Cleanup(
	_ context.Context,
	_ kbaccess.Actor,
	knowledgeBaseCode string,
) error {
	r.deletedKnowledgeBaseCode = knowledgeBaseCode
	return nil
}

func (r *recordingSourceBindingRepository) ReplaceBindings(_ context.Context, knowledgeBaseCode string, bindings []sourcebindingdomain.Binding) ([]sourcebindingdomain.Binding, error) {
	r.lastReplaceKnowledgeBaseCode = knowledgeBaseCode
	r.lastReplaceBindings = make([]sourcebindingdomain.Binding, 0, len(bindings))
	for idx, binding := range bindings {
		cloned := binding
		if cloned.ID <= 0 {
			cloned.ID = int64(idx + 1)
		}
		r.lastReplaceBindings = append(r.lastReplaceBindings, cloned)
	}
	r.listBindings = append([]sourcebindingdomain.Binding(nil), r.lastReplaceBindings...)
	return append([]sourcebindingdomain.Binding(nil), r.lastReplaceBindings...), nil
}

func (r *recordingSourceBindingRepository) SaveBindings(_ context.Context, knowledgeBaseCode string, bindings []sourcebindingdomain.Binding) ([]sourcebindingdomain.Binding, error) {
	r.lastSavedKnowledgeBaseCode = knowledgeBaseCode
	r.lastSavedBindings = make([]sourcebindingdomain.Binding, 0, len(bindings))
	for idx, binding := range bindings {
		cloned := binding
		if cloned.ID <= 0 {
			cloned.ID = int64(idx + 1)
		}
		r.lastSavedBindings = append(r.lastSavedBindings, cloned)
	}
	r.listBindings = append([]sourcebindingdomain.Binding(nil), r.lastSavedBindings...)
	return append([]sourcebindingdomain.Binding(nil), r.lastSavedBindings...), nil
}

func (r *recordingSourceBindingRepository) ApplyKnowledgeBaseBindings(
	_ context.Context,
	input sourcebindingrepository.ApplyKnowledgeBaseBindingsInput,
) ([]sourcebindingdomain.Binding, error) {
	r.lastApplyInput = input
	r.applyInputs = append(r.applyInputs, input)
	r.lastReplaceKnowledgeBaseCode = input.KnowledgeBaseCode
	r.lastReplaceBindings = make([]sourcebindingdomain.Binding, 0, len(input.UpsertBindings))
	r.listBindingItems = make([]sourcebindingdomain.BindingItem, 0)
	for idx, applyBinding := range input.UpsertBindings {
		cloned := applyBinding.Binding
		if cloned.ID <= 0 {
			cloned.ID = int64(idx + 1)
		}
		r.lastReplaceBindings = append(r.lastReplaceBindings, cloned)
		for _, item := range applyBinding.Items {
			item.BindingID = cloned.ID
			r.listBindingItems = append(r.listBindingItems, item)
		}
	}
	r.listBindings = append([]sourcebindingdomain.Binding(nil), r.lastReplaceBindings...)
	return append([]sourcebindingdomain.Binding(nil), r.lastReplaceBindings...), nil
}

func (r *recordingSourceBindingRepository) DeleteBindingsByKnowledgeBase(_ context.Context, knowledgeBaseCode string) error {
	r.deletedKnowledgeBaseCode = knowledgeBaseCode
	return r.deleteErr
}

func (r *recordingSourceBindingRepository) ListBindingsByKnowledgeBase(context.Context, string) ([]sourcebindingdomain.Binding, error) {
	return append([]sourcebindingdomain.Binding(nil), r.listBindings...), nil
}

func (r *recordingSourceBindingRepository) ListBindingsByKnowledgeBases(_ context.Context, knowledgeBaseCodes []string) (map[string][]sourcebindingdomain.Binding, error) {
	if len(r.listBindingsByKnowledgeBase) == 0 {
		return map[string][]sourcebindingdomain.Binding{}, nil
	}
	result := make(map[string][]sourcebindingdomain.Binding, len(knowledgeBaseCodes))
	for _, knowledgeBaseCode := range knowledgeBaseCodes {
		result[knowledgeBaseCode] = append([]sourcebindingdomain.Binding(nil), r.listBindingsByKnowledgeBase[knowledgeBaseCode]...)
	}
	return result, nil
}

func (r *recordingSourceBindingRepository) ListRealtimeProjectBindingsByProject(context.Context, string, int64) ([]sourcebindingdomain.Binding, error) {
	return nil, nil
}

func (r *recordingSourceBindingRepository) ListRealtimeTeamshareBindingsByKnowledgeBase(context.Context, string, string, string) ([]sourcebindingdomain.Binding, error) {
	return nil, nil
}

func (r *recordingSourceBindingRepository) HasRealtimeProjectBindingForFile(context.Context, string, int64, int64) (bool, error) {
	return false, nil
}

func (r *recordingSourceBindingRepository) UpsertSourceItem(_ context.Context, item sourcebindingdomain.SourceItem) (*sourcebindingdomain.SourceItem, error) {
	if r.sourceItemIDs == nil {
		r.sourceItemIDs = make(map[string]int64)
	}
	if id, exists := r.sourceItemIDs[item.ItemRef]; exists {
		item.ID = id
		return &item, nil
	}
	r.nextSourceItemID++
	if r.nextSourceItemID == 0 {
		r.nextSourceItemID = 1
	}
	item.ID = r.nextSourceItemID
	r.sourceItemIDs[item.ItemRef] = item.ID
	return &item, nil
}

func (r *recordingSourceBindingRepository) UpsertSourceItems(
	ctx context.Context,
	items []sourcebindingdomain.SourceItem,
) ([]*sourcebindingdomain.SourceItem, error) {
	result := make([]*sourcebindingdomain.SourceItem, 0, len(items))
	for _, item := range items {
		saved, err := r.UpsertSourceItem(ctx, item)
		if err != nil {
			return nil, err
		}
		result = append(result, saved)
	}
	return result, nil
}

func (r *recordingSourceBindingRepository) ReplaceBindingItems(context.Context, int64, []sourcebindingdomain.BindingItem) error {
	return nil
}

func (r *recordingSourceBindingRepository) ListBindingItemsByKnowledgeBase(context.Context, string) ([]sourcebindingdomain.BindingItem, error) {
	return append([]sourcebindingdomain.BindingItem(nil), r.listBindingItems...), nil
}

type projectFileResolverStub struct {
	listByProjectResults                 map[int64][]projectfile.ListItem
	resolveResults                       map[int64]*projectfile.ResolveResult
	visibleMetasByID                     map[int64]*projectfile.Meta
	loadVisibleMetaErrByID               map[int64]error
	visibleLeafFileIDsByProject          map[int64][]int64
	visibleLeafFileIDsByFolder           map[int64][]int64
	visibleTreeNodesByProject            map[int64][]projectfile.TreeNode
	visibleTreeNodesByFolder             map[int64][]projectfile.TreeNode
	visibleFilesByID                     map[int64]bool
	listVisibleLeafFileIDsByProjectCalls int
	loadVisibleMetaCalls                 int
	isVisibleFileCalls                   int
	resolveCalls                         int
}

type fragmentRepairServiceStub struct {
	organizationCodes          []string
	listOrganizationCodesErr   error
	groupsByOffset             map[int][]*thirdfilemappingpkg.RepairGroup
	groupsByOrganizationOffset map[string]map[int][]*thirdfilemappingpkg.RepairGroup
	backfillRows               int64
	backfillInputs             []thirdfilemappingpkg.BackfillByThirdFileInput
}

type recordingKnowledgeBaseBindingRepository struct {
	bindIDsByKnowledgeBase map[string][]string
	lastReplaceCode        string
	lastReplaceBindType    kbentity.BindingType
	lastReplaceBindIDs     []string
	replaceErr             error
	listErr                error
	batchListErr           error
	batchListCalls         int
}

func (r *recordingKnowledgeBaseBindingRepository) ReplaceBindings(
	_ context.Context,
	knowledgeBaseCode string,
	bindType kbentity.BindingType,
	_ string,
	_ string,
	bindIDs []string,
) ([]string, error) {
	if r.replaceErr != nil {
		return nil, r.replaceErr
	}
	r.lastReplaceCode = knowledgeBaseCode
	r.lastReplaceBindType = bindType
	r.lastReplaceBindIDs = append([]string(nil), bindIDs...)
	if r.bindIDsByKnowledgeBase == nil {
		r.bindIDsByKnowledgeBase = map[string][]string{}
	}
	r.bindIDsByKnowledgeBase[knowledgeBaseCode] = append([]string(nil), bindIDs...)
	return append([]string(nil), bindIDs...), nil
}

func (r *recordingKnowledgeBaseBindingRepository) ListBindIDsByKnowledgeBase(
	_ context.Context,
	knowledgeBaseCode string,
	_ kbentity.BindingType,
) ([]string, error) {
	if r.listErr != nil {
		return nil, r.listErr
	}
	return append([]string(nil), r.bindIDsByKnowledgeBase[knowledgeBaseCode]...), nil
}

func (r *recordingKnowledgeBaseBindingRepository) ListBindIDsByKnowledgeBases(
	_ context.Context,
	knowledgeBaseCodes []string,
	_ kbentity.BindingType,
) (map[string][]string, error) {
	if r.batchListErr != nil {
		return nil, r.batchListErr
	}
	r.batchListCalls++
	result := make(map[string][]string, len(knowledgeBaseCodes))
	for _, code := range knowledgeBaseCodes {
		result[code] = append([]string(nil), r.bindIDsByKnowledgeBase[code]...)
	}
	return result, nil
}

type recordingSuperMagicAgentReader struct {
	existingIDs   map[string]struct{}
	manageableIDs map[string]struct{}
	existingErr   error
	manageableErr error
}

func (r *recordingSuperMagicAgentReader) ListExistingCodesByOrg(context.Context, string, []string) (map[string]struct{}, error) {
	if r.existingErr != nil {
		return nil, r.existingErr
	}
	result := make(map[string]struct{}, len(r.existingIDs))
	for id := range r.existingIDs {
		result[id] = struct{}{}
	}
	return result, nil
}

func (r *recordingSuperMagicAgentReader) ListManageableCodes(context.Context, string, string, []string) (map[string]struct{}, error) {
	if r.manageableErr != nil {
		return nil, r.manageableErr
	}
	source := r.manageableIDs
	if source == nil {
		source = r.existingIDs
	}
	result := make(map[string]struct{}, len(source))
	for id := range source {
		result[id] = struct{}{}
	}
	return result, nil
}

func (s *fragmentRepairServiceStub) ListThirdFileRepairOrganizationCodes(_ context.Context) ([]string, error) {
	if s.listOrganizationCodesErr != nil {
		return nil, s.listOrganizationCodesErr
	}
	return append([]string(nil), s.organizationCodes...), nil
}

func (s *fragmentRepairServiceStub) ListThirdFileRepairGroups(_ context.Context, query thirdfilemappingpkg.RepairGroupQuery) ([]*thirdfilemappingpkg.RepairGroup, error) {
	if s.groupsByOrganizationOffset != nil {
		if grouped, ok := s.groupsByOrganizationOffset[query.OrganizationCode]; ok {
			return grouped[query.Offset], nil
		}
		return nil, nil
	}
	if s.groupsByOffset == nil {
		return nil, nil
	}
	return s.groupsByOffset[query.Offset], nil
}

func (s *fragmentRepairServiceStub) BackfillDocumentCodeByThirdFile(_ context.Context, input thirdfilemappingpkg.BackfillByThirdFileInput) (int64, error) {
	s.backfillInputs = append(s.backfillInputs, input)
	return s.backfillRows, nil
}

func cloneManagedDocumentDTOs(inputs []*service.ManagedDocument) []*service.ManagedDocument {
	results := make([]*service.ManagedDocument, 0, len(inputs))
	for _, input := range inputs {
		results = append(results, cloneManagedDocumentDTO(input))
	}
	return results
}

func cloneManagedDocumentDTO(input *service.ManagedDocument) *service.ManagedDocument {
	if input == nil {
		return nil
	}
	cloned := *input
	cloned.DocumentFile = cloneDocumentFile(input.DocumentFile)
	return &cloned
}

type hiddenRootTaskFileReaderStub struct {
	rootByProjectID       map[int64]*projectfile.Meta
	metasByID             map[int64]*projectfile.Meta
	childrenByParent      map[int64][]*projectfile.Meta
	childrenByParentBatch map[int64][]*projectfile.Meta
}

func cloneDocumentFile(input *docentity.File) *docentity.File {
	if input == nil {
		return nil
	}
	cloned := *input
	return &cloned
}

func (s *projectFileResolverStub) Resolve(_ context.Context, projectFileID int64) (*projectfile.ResolveResult, error) {
	s.resolveCalls++
	return s.resolveResults[projectFileID], nil
}

func (s *projectFileResolverStub) LoadVisibleMeta(_ context.Context, projectFileID int64) (*projectfile.Meta, error) {
	s.loadVisibleMetaCalls++
	if err, ok := s.loadVisibleMetaErrByID[projectFileID]; ok && err != nil {
		return nil, err
	}
	if s.visibleFilesByID != nil {
		if visible, exists := s.visibleFilesByID[projectFileID]; exists && !visible {
			var zeroMeta *projectfile.Meta
			return zeroMeta, nil
		}
	}
	if meta, ok := s.visibleMetasByID[projectFileID]; ok {
		return cloneProjectFileMeta(meta), nil
	}
	if resolved, ok := s.resolveResults[projectFileID]; ok && resolved != nil {
		return projectFileMetaFromResolvedResult(resolved), nil
	}
	var zeroMeta *projectfile.Meta
	return zeroMeta, nil
}

func cloneProjectFileMeta(input *projectfile.Meta) *projectfile.Meta {
	if input == nil {
		return nil
	}
	cloned := *input
	return &cloned
}

func projectFileMetaFromResolvedResult(resolved *projectfile.ResolveResult) *projectfile.Meta {
	if resolved == nil {
		return nil
	}
	return &projectfile.Meta{
		Status:           strings.TrimSpace(resolved.Status),
		OrganizationCode: strings.TrimSpace(resolved.OrganizationCode),
		ProjectID:        resolved.ProjectID,
		ProjectFileID:    resolved.ProjectFileID,
		FileKey:          strings.TrimSpace(resolved.FileKey),
		RelativeFilePath: strings.TrimSpace(resolved.RelativeFilePath),
		FileName:         strings.TrimSpace(resolved.FileName),
		FileExtension:    projectfile.NormalizeExtension(resolved.FileName, resolved.FileExtension),
		IsDirectory:      resolved.IsDirectory,
		UpdatedAt:        strings.TrimSpace(resolved.UpdatedAt),
	}
}

func (s *hiddenRootTaskFileReaderStub) FindByID(_ context.Context, projectFileID int64) (*projectfile.Meta, error) {
	return s.metasByID[projectFileID], nil
}

func (s *hiddenRootTaskFileReaderStub) FindRootDirectoryByProjectID(_ context.Context, projectID int64) (*projectfile.Meta, error) {
	return s.rootByProjectID[projectID], nil
}

func (s *hiddenRootTaskFileReaderStub) ListVisibleChildrenByParent(
	_ context.Context,
	_ int64,
	parentID int64,
	_ int,
) ([]*projectfile.Meta, error) {
	return s.childrenByParent[parentID], nil
}

func (s *hiddenRootTaskFileReaderStub) ListVisibleChildrenByParentAfter(
	_ context.Context,
	_ int64,
	parentID int64,
	_ int64,
	lastFileID int64,
	limit int,
) ([]*projectfile.Meta, error) {
	items := s.childrenByParentBatch[parentID]
	if len(items) == 0 {
		return nil, nil
	}
	start := 0
	if lastFileID > 0 {
		for idx, item := range items {
			if item != nil && item.ProjectFileID == lastFileID {
				start = idx + 1
				break
			}
		}
	}
	if start >= len(items) {
		return nil, nil
	}
	end := start + limit
	if limit <= 0 || end > len(items) {
		end = len(items)
	}
	return append([]*projectfile.Meta(nil), items[start:end]...), nil
}

func (s *projectFileResolverStub) ListByProject(_ context.Context, projectID int64) ([]projectfile.ListItem, error) {
	return s.listByProjectResults[projectID], nil
}

func (s *projectFileResolverStub) ListWorkspaces(context.Context, string, string, int, int) (*projectfile.WorkspacePage, error) {
	return &projectfile.WorkspacePage{}, nil
}

func (s *projectFileResolverStub) ListProjects(context.Context, string, string, int64, int, int) (*projectfile.ProjectPage, error) {
	return &projectfile.ProjectPage{}, nil
}

func (s *projectFileResolverStub) ListTreeNodes(context.Context, string, int64) ([]projectfile.TreeNode, error) {
	return nil, nil
}

func (s *projectFileResolverStub) IsVisibleFile(_ context.Context, projectFileID int64) (bool, error) {
	s.isVisibleFileCalls++
	if s.visibleFilesByID == nil {
		return true, nil
	}
	visible, ok := s.visibleFilesByID[projectFileID]
	if !ok {
		return true, nil
	}
	return visible, nil
}

func (s *projectFileResolverStub) ListVisibleTreeNodesByProject(_ context.Context, projectID int64) ([]projectfile.TreeNode, error) {
	return s.visibleTreeNodesByProject[projectID], nil
}

func (s *projectFileResolverStub) ListVisibleTreeNodesByFolder(_ context.Context, folderID int64) ([]projectfile.TreeNode, error) {
	return s.visibleTreeNodesByFolder[folderID], nil
}

func (s *projectFileResolverStub) ListVisibleLeafFileIDsByProject(_ context.Context, projectID int64) ([]int64, error) {
	s.listVisibleLeafFileIDsByProjectCalls++
	if s.visibleLeafFileIDsByProject != nil {
		return append([]int64(nil), s.visibleLeafFileIDsByProject[projectID]...), nil
	}
	items := s.listByProjectResults[projectID]
	result := make([]int64, 0, len(items))
	for _, item := range items {
		result = append(result, item.ProjectFileID)
	}
	return result, nil
}

func (s *projectFileResolverStub) ListVisibleLeafFileIDsByFolder(_ context.Context, folderID int64) ([]int64, error) {
	return append([]int64(nil), s.visibleLeafFileIDsByFolder[folderID]...), nil
}

func (s *projectFileResolverStub) WalkVisibleLeafFileIDsByProject(
	ctx context.Context,
	projectID int64,
	visitor func(projectFileID int64) (bool, error),
) error {
	items, err := s.ListVisibleLeafFileIDsByProject(ctx, projectID)
	if err != nil {
		return err
	}
	for _, item := range items {
		keepWalking, visitErr := visitor(item)
		if visitErr != nil {
			return visitErr
		}
		if !keepWalking {
			return nil
		}
	}
	return nil
}

func (s *projectFileResolverStub) WalkVisibleLeafFileIDsByFolder(
	ctx context.Context,
	folderID int64,
	visitor func(projectFileID int64) (bool, error),
) error {
	items, err := s.ListVisibleLeafFileIDsByFolder(ctx, folderID)
	if err != nil {
		return err
	}
	for _, item := range items {
		keepWalking, visitErr := visitor(item)
		if visitErr != nil {
			return visitErr
		}
		if !keepWalking {
			return nil
		}
	}
	return nil
}

type fallbackFragmentCounter struct {
	total       int64
	synced      int64
	totalCalls  int
	syncedCalls int
}

type errorStatsFragmentCounter struct {
	err error
}

func (f *fallbackFragmentCounter) CountByKnowledgeBase(_ context.Context, _ string) (int64, error) {
	f.totalCalls++
	return f.total, nil
}

func (f *fallbackFragmentCounter) CountSyncedByKnowledgeBase(_ context.Context, _ string) (int64, error) {
	f.syncedCalls++
	return f.synced, nil
}

func (f *errorStatsFragmentCounter) CountByKnowledgeBase(context.Context, string) (int64, error) {
	return 0, f.err
}

func (f *errorStatsFragmentCounter) CountSyncedByKnowledgeBase(context.Context, string) (int64, error) {
	return 0, f.err
}

func (f *errorStatsFragmentCounter) CountStatsByKnowledgeBase(context.Context, string) (int64, int64, error) {
	return 0, 0, f.err
}

func assertKnowledgeBaseListPageResult(t *testing.T, result *pagehelper.Result) {
	t.Helper()
	if result.Total != 2 {
		t.Fatalf("expected total=2, got %d", result.Total)
	}
}

func assertKnowledgeBaseListQuery(t *testing.T, query *kbrepository.Query) {
	t.Helper()
	if query == nil {
		t.Fatal("expected list query captured")
	}
	if query.OrganizationCode != "ORG-1" || query.Offset != 10 || query.Limit != 20 {
		t.Fatalf("unexpected list query: %#v", query)
	}
	if query.KnowledgeBaseType == nil || *query.KnowledgeBaseType != kbentity.KnowledgeBaseTypeFlowVector {
		t.Fatalf("expected flow-vector list query, got %#v", query)
	}
}

func mustKnowledgeBaseDTOList(t *testing.T, list any) []*kbdto.KnowledgeBaseDTO {
	t.Helper()
	result, ok := list.([]*kbdto.KnowledgeBaseDTO)
	if !ok {
		t.Fatalf("expected list type []*KnowledgeBaseDTO, got %T", list)
	}
	return result
}

func assertKnowledgeBaseListItems(t *testing.T, list []*kbdto.KnowledgeBaseDTO) {
	t.Helper()
	if len(list) != 2 || list[0].Code != testAppKnowledgeBaseCode || list[1].Code != testAppKnowledgeBaseCode2 {
		t.Fatalf("unexpected list content: %#v", list)
	}
	if list[0].Model != effectiveEmbeddingModel || list[1].Model != effectiveEmbeddingModel {
		t.Fatalf("expected list items to reuse effective model %q, got %#v", effectiveEmbeddingModel, list)
	}
	if list[0].KnowledgeBaseType != string(kbentity.KnowledgeBaseTypeFlowVector) || list[1].KnowledgeBaseType != string(kbentity.KnowledgeBaseTypeFlowVector) {
		t.Fatalf("expected list items to expose stored flow-vector type, got %#v", list)
	}
	if list[0].UserOperation != 3 || list[1].UserOperation != 4 {
		t.Fatalf("expected list items user_operation=3/4, got %#v", list)
	}
	assertKnowledgeBaseListItemCounts(t, list[0])
	assertKnowledgeBaseListItemCounts(t, list[1])
}

func assertKnowledgeBaseListItemCounts(t *testing.T, item *kbdto.KnowledgeBaseDTO) {
	t.Helper()
	if item.FragmentCount != 7 || item.ExpectedCount != 4 || item.CompletedCount != 4 {
		t.Fatalf("expected list item counts populated, got %#v", item)
	}
}

func assertKnowledgeBaseListFallbackStats(t *testing.T, counter *fallbackFragmentCounter) {
	t.Helper()
	if counter.totalCalls != 2 || counter.syncedCalls != 2 {
		t.Fatalf("expected fragment counter called for every list item, got total=%d synced=%d", counter.totalCalls, counter.syncedCalls)
	}
}

func assertKnowledgeBaseListResolvedModelCalls(t *testing.T, calls int) {
	t.Helper()
	if calls != 1 {
		t.Fatalf("expected one runtime route lookup for list, got %d", calls)
	}
}

func assertCreateDocumentFileCloned(t *testing.T, file *docentity.File, expectedName, expectedURL string) {
	t.Helper()
	if got := file.Name; got != expectedName {
		t.Fatalf("expected document file to be cloned, got name %q", got)
	}
	if got := file.URL; got != expectedURL {
		t.Fatalf("expected document file url to be cloned, got url %q", got)
	}
}

func cloneKnowledgeBase(kb *kbentity.KnowledgeBase) *kbentity.KnowledgeBase {
	if kb == nil {
		return nil
	}

	if copied, ok := cloneViaJSON(kb); ok {
		return copied
	}

	copied := *kb
	if kb.SourceType != nil {
		sourceType := *kb.SourceType
		copied.SourceType = &sourceType
	}
	if kb.ResolvedRoute != nil {
		route := *kb.ResolvedRoute
		copied.ResolvedRoute = &route
	}
	if kb.DeletedAt != nil {
		deletedAt := *kb.DeletedAt
		copied.DeletedAt = &deletedAt
	}
	return &copied
}

func cloneCreateDocumentInput(input *service.CreateManagedDocumentInput) *service.CreateManagedDocumentInput {
	if input == nil {
		return nil
	}

	if copied, ok := cloneViaJSON(input); ok {
		return copied
	}

	copied := *input
	if input.DocumentFile != nil {
		documentFile := *input.DocumentFile
		copied.DocumentFile = &documentFile
	}
	return &copied
}

func cloneViaJSON[T any](src *T) (*T, bool) {
	if src == nil {
		return nil, true
	}

	payload, err := json.Marshal(src)
	if err != nil {
		return nil, false
	}

	var copied T
	if err := json.Unmarshal(payload, &copied); err != nil {
		return nil, false
	}

	return &copied, true
}

func testKnowledgeBaseAppLogger() *logging.SugaredLogger {
	return logging.NewFromConfig(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevelInfo,
		Format: autoloadcfg.LogFormatJSON,
	})
}

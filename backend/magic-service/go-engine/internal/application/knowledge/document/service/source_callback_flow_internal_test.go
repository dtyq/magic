package docapp

import (
	"context"
	"errors"
	"testing"

	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingrepository "magic/internal/domain/knowledge/sourcebinding/repository"
	"magic/internal/pkg/projectfile"
	"magic/internal/pkg/thirdplatform"
)

var errSourceCallbackStubUnavailable = errors.New("source callback stub unavailable")

func TestProjectFileChangeSkipsResolveWhenFolderBindingDoesNotCoverFile(t *testing.T) {
	t.Parallel()

	sourceRepo := &sourceCallbackSourceBindingRepoStub{
		projectBindings: []sourcebindingdomain.Binding{{
			ID:                10,
			OrganizationCode:  "ORG1",
			KnowledgeBaseCode: "KB1",
			Provider:          sourcebindingdomain.ProviderProject,
			RootType:          sourcebindingdomain.RootTypeProject,
			RootRef:           "1001",
			SyncMode:          sourcebindingdomain.SyncModeRealtime,
			Enabled:           true,
			UpdatedUID:        "U1",
			Targets: []sourcebindingdomain.BindingTarget{{
				TargetType: sourcebindingdomain.TargetTypeFolder,
				TargetRef:  "999",
			}},
		}},
	}
	resolver := &sourceCallbackProjectResolverStub{}
	svc := &ProjectFileChangeAppService{support: &DocumentAppService{
		domainService:             &internalDocumentDomainServiceStub{},
		kbService:                 &internalKnowledgeBaseReaderStub{},
		sourceBindingRepo:         sourceRepo,
		projectFilePort:           resolver,
		projectFileMetadataReader: &sourceCallbackProjectMetadataReaderStub{ancestorIDs: []int64{200}},
	}}

	err := svc.handleProjectFileChange(context.Background(), 300, &projectfile.Meta{
		Status:           "active",
		OrganizationCode: "ORG1",
		ProjectID:        1001,
		ProjectFileID:    300,
		ParentID:         200,
		FileName:         "outside.md",
		FileExtension:    "md",
	})
	if err != nil {
		t.Fatalf("handleProjectFileChange returned error: %v", err)
	}
	if resolver.resolveCalls != 0 {
		t.Fatalf("expected project file Resolve not called, got %d", resolver.resolveCalls)
	}
}

func TestThirdFileCoveringBindingsUsesCurrentPathRootBeforeThirdKnowledgeID(t *testing.T) {
	t.Parallel()

	sourceRepo := &sourceCallbackSourceBindingRepoStub{
		teamshareBindings: []sourcebindingdomain.Binding{{
			ID:                20,
			OrganizationCode:  "ORG1",
			KnowledgeBaseCode: "KB-CURRENT",
			Provider:          sourcebindingdomain.ProviderTeamshare,
			RootType:          sourcebindingdomain.RootTypeKnowledgeBase,
			RootRef:           "CURRENT-KB",
			SyncMode:          sourcebindingdomain.SyncModeRealtime,
			Enabled:           true,
		}},
	}
	svc := &ThirdFileRevectorizeAppService{support: &DocumentAppService{
		sourceBindingRepo: sourceRepo,
		thirdPlatformDocumentPort: &sourceCallbackThirdPlatformPortStub{node: &thirdplatform.NodeResolveResult{
			TreeNode: thirdplatform.TreeNode{
				ID:          "FILE1",
				ThirdFileID: "FILE1",
				ParentID:    "FOLDER1",
				Name:        "current.md",
				FileType:    "7",
				Extension:   "md",
				Path: []thirdplatform.PathNode{
					{ID: "0", Type: "space"},
					{ID: "CURRENT-KB", Type: "knowledge_base"},
					{ID: "FOLDER1", Type: "folder"},
				},
			},
			DocumentFile: map[string]any{
				"knowledge_base_id": "STALE-KB",
			},
		}},
	}}

	bindings, err := svc.resolveThirdFileCoveringBindings(context.Background(), &documentdomain.ThirdFileRevectorizeInput{
		OrganizationCode:  "ORG1",
		UserID:            "usi_callback",
		ThirdPlatformType: sourcebindingdomain.ProviderTeamshare,
		ThirdFileID:       "FILE1",
		ThirdKnowledgeID:  "STALE-KB",
	})
	if err != nil {
		t.Fatalf("resolveThirdFileCoveringBindings returned error: %v", err)
	}
	if len(bindings) != 1 {
		t.Fatalf("expected binding to cover current path root, got %#v", bindings)
	}
	if sourceRepo.lastTeamshareKnowledgeBaseID != "CURRENT-KB" {
		t.Fatalf("expected current path root lookup, got %q", sourceRepo.lastTeamshareKnowledgeBaseID)
	}
}

func TestThirdFileCallbackRepairsFlowTeamshareManualBinding(t *testing.T) {
	t.Parallel()

	sourceRepo := &sourceCallbackSourceBindingRepoStub{
		bindingsByKnowledgeBase: map[string][]sourcebindingdomain.Binding{
			"KB-FLOW": {{
				ID:                31,
				OrganizationCode:  "ORG1",
				KnowledgeBaseCode: "KB-FLOW",
				Provider:          sourcebindingdomain.ProviderTeamshare,
				RootType:          sourcebindingdomain.RootTypeKnowledgeBase,
				RootRef:           "TEAMSHARE-KB",
				SyncMode:          sourcebindingdomain.SyncModeManual,
				Enabled:           true,
			}},
		},
	}
	svc := &ThirdFileRevectorizeAppService{support: &DocumentAppService{
		domainService: &internalDocumentDomainServiceStub{thirdFileDocs: []*docentity.KnowledgeBaseDocument{{
			Code:              "DOC1",
			OrganizationCode:  "ORG1",
			KnowledgeBaseCode: "KB-FLOW",
			SourceBindingID:   31,
			ThirdPlatformType: sourcebindingdomain.ProviderTeamshare,
			ThirdFileID:       "FILE1",
		}}},
		kbService: &internalKnowledgeBaseReaderStub{listResult: []*kbentity.KnowledgeBase{{
			Code:              "KB-FLOW",
			OrganizationCode:  "ORG1",
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector,
		}}},
		sourceBindingRepo: sourceRepo,
	}}

	err := svc.repairFlowTeamshareRealtimeForCallback(context.Background(), &documentdomain.ThirdFileRevectorizeInput{
		OrganizationCode:  "ORG1",
		ThirdPlatformType: sourcebindingdomain.ProviderTeamshare,
		ThirdFileID:       "FILE1",
	})
	if err != nil {
		t.Fatalf("repairFlowTeamshareRealtimeForCallback returned error: %v", err)
	}
	if len(sourceRepo.markedRealtimeBindingIDs) != 1 || sourceRepo.markedRealtimeBindingIDs[0] != 31 {
		t.Fatalf("expected flow manual binding to be repaired, got %#v", sourceRepo.markedRealtimeBindingIDs)
	}
}

func TestThirdFileCallbackDoesNotRepairDigitalEmployeeTeamshareManualBinding(t *testing.T) {
	t.Parallel()

	sourceRepo := &sourceCallbackSourceBindingRepoStub{
		bindingsByKnowledgeBase: map[string][]sourcebindingdomain.Binding{
			"KB-DIGITAL": {{
				ID:                32,
				OrganizationCode:  "ORG1",
				KnowledgeBaseCode: "KB-DIGITAL",
				Provider:          sourcebindingdomain.ProviderTeamshare,
				RootType:          sourcebindingdomain.RootTypeKnowledgeBase,
				RootRef:           "TEAMSHARE-KB",
				SyncMode:          sourcebindingdomain.SyncModeManual,
				Enabled:           true,
			}},
		},
	}
	svc := &ThirdFileRevectorizeAppService{support: &DocumentAppService{
		domainService: &internalDocumentDomainServiceStub{thirdFileDocs: []*docentity.KnowledgeBaseDocument{{
			Code:              "DOC1",
			OrganizationCode:  "ORG1",
			KnowledgeBaseCode: "KB-DIGITAL",
			SourceBindingID:   32,
			ThirdPlatformType: sourcebindingdomain.ProviderTeamshare,
			ThirdFileID:       "FILE1",
		}}},
		kbService: &internalKnowledgeBaseReaderStub{listResult: []*kbentity.KnowledgeBase{{
			Code:              "KB-DIGITAL",
			OrganizationCode:  "ORG1",
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		}}},
		sourceBindingRepo: sourceRepo,
	}}

	err := svc.repairFlowTeamshareRealtimeForCallback(context.Background(), &documentdomain.ThirdFileRevectorizeInput{
		OrganizationCode:  "ORG1",
		ThirdPlatformType: sourcebindingdomain.ProviderTeamshare,
		ThirdFileID:       "FILE1",
	})
	if err != nil {
		t.Fatalf("repairFlowTeamshareRealtimeForCallback returned error: %v", err)
	}
	if len(sourceRepo.markedRealtimeBindingIDs) != 0 {
		t.Fatalf("expected digital employee manual binding to stay manual, got %#v", sourceRepo.markedRealtimeBindingIDs)
	}
}

func TestThirdFileIdentityMissingReturnsRetryableError(t *testing.T) {
	t.Parallel()

	domainSvc := &internalDocumentDomainServiceStub{}
	svc := &ThirdFileRevectorizeAppService{support: &DocumentAppService{
		domainService:             domainSvc,
		kbService:                 &internalKnowledgeBaseReaderStub{listResult: []*kbentity.KnowledgeBase{{Code: "KB1", OrganizationCode: "ORG1", UpdatedUID: "usi_callback"}}},
		thirdPlatformDocumentPort: &sourceCallbackThirdPlatformPortStub{nodeErr: thirdplatform.ErrIdentityMissing},
	}}

	_, handled, err := svc.prepareThirdFileCurrentSource(context.Background(), &documentdomain.ThirdFileRevectorizeInput{
		OrganizationCode:  "ORG1",
		UserID:            "usi_callback",
		ThirdPlatformType: sourcebindingdomain.ProviderTeamshare,
		ThirdFileID:       "FILE1",
		ThirdKnowledgeID:  "KB1",
	}, []*docentity.KnowledgeBaseDocument{{ID: 77, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", Code: "DOC1"}})
	if !errors.Is(err, thirdplatform.ErrIdentityMissing) {
		t.Fatalf("expected identity missing error, got %v", err)
	}
	if !handled {
		t.Fatalf("expected identity missing callback to stop before plan")
	}
	if domainSvc.deleteCalls != 0 {
		t.Fatalf("expected identity missing not to delete documents, calls=%d", domainSvc.deleteCalls)
	}
}

func TestThirdFileRootMissingReturnsRetryableError(t *testing.T) {
	t.Parallel()

	domainSvc := &internalDocumentDomainServiceStub{}
	fragmentSvc := &internalFragmentDocumentServiceStub{}
	svc := &ThirdFileRevectorizeAppService{support: &DocumentAppService{
		domainService:   domainSvc,
		fragmentService: fragmentSvc,
		kbService: &internalKnowledgeBaseReaderStub{showByCodeAndOrgResult: &kbentity.KnowledgeBase{
			Code:             "KB1",
			OrganizationCode: "ORG1",
			Enabled:          true,
			UpdatedUID:       "usi_callback",
		}, listResult: []*kbentity.KnowledgeBase{{Code: "KB1", OrganizationCode: "ORG1", UpdatedUID: "usi_callback"}}},
		thirdPlatformDocumentPort: &sourceCallbackThirdPlatformPortStub{node: &thirdplatform.NodeResolveResult{
			TreeNode: thirdplatform.TreeNode{
				ID:          "FILE1",
				ThirdFileID: "FILE1",
				ParentID:    "FOLDER1",
				Name:        "current.md",
				FileType:    "7",
				Extension:   "md",
				Path: []thirdplatform.PathNode{
					{ID: "0", Type: "space"},
				},
			},
		}},
	}}

	_, handled, err := svc.prepareThirdFileCurrentSource(context.Background(), &documentdomain.ThirdFileRevectorizeInput{
		OrganizationCode:  "ORG1",
		UserID:            "usi_callback",
		ThirdPlatformType: sourcebindingdomain.ProviderTeamshare,
		ThirdFileID:       "FILE1",
		ThirdKnowledgeID:  "STALE-KB",
	}, []*docentity.KnowledgeBaseDocument{{
		ID:                77,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		Code:              "DOC1",
		SourceBindingID:   20,
		SourceItemID:      30,
	}})
	if !errors.Is(err, errThirdFileKnowledgeBaseMissing) {
		t.Fatalf("expected knowledge base missing error, got %v", err)
	}
	if !handled {
		t.Fatalf("expected root-missing callback to stop before plan")
	}
	if domainSvc.deleteCalls != 0 {
		t.Fatalf("expected root-missing callback not to delete documents, calls=%d id=%d", domainSvc.deleteCalls, domainSvc.deletedID)
	}
	if fragmentSvc.deleteByDocumentCalls != 0 || fragmentSvc.deletePointsByDocumentCalls != 0 {
		t.Fatalf("expected fragments and vectors untouched, fragment=%d vector=%d", fragmentSvc.deleteByDocumentCalls, fragmentSvc.deletePointsByDocumentCalls)
	}
}

type sourceCallbackProjectMetadataReaderStub struct {
	ancestorIDs []int64
}

func (s *sourceCallbackProjectMetadataReaderStub) FindByID(context.Context, int64) (*projectfile.Meta, error) {
	return nil, errSourceCallbackStubUnavailable
}

func (s *sourceCallbackProjectMetadataReaderStub) ListAncestorFolderIDs(context.Context, int64) ([]int64, error) {
	return append([]int64(nil), s.ancestorIDs...), nil
}

type sourceCallbackProjectResolverStub struct {
	resolveCalls int
}

func (s *sourceCallbackProjectResolverStub) Resolve(context.Context, int64) (*projectfile.ResolveResult, error) {
	s.resolveCalls++
	return &projectfile.ResolveResult{}, nil
}

func (s *sourceCallbackProjectResolverStub) ListByProject(context.Context, int64) ([]projectfile.ListItem, error) {
	return nil, nil
}

type sourceCallbackThirdPlatformPortStub struct {
	node    *thirdplatform.NodeResolveResult
	nodeErr error
}

func (s *sourceCallbackThirdPlatformPortStub) Resolve(
	context.Context,
	thirdplatform.DocumentResolveInput,
) (*thirdplatform.DocumentResolveResult, error) {
	return nil, errSourceCallbackStubUnavailable
}

func (s *sourceCallbackThirdPlatformPortStub) ResolveNode(
	context.Context,
	thirdplatform.NodeResolveInput,
) (*thirdplatform.NodeResolveResult, error) {
	if s.nodeErr != nil {
		return nil, s.nodeErr
	}
	return s.node, nil
}

type sourceCallbackSourceBindingRepoStub struct {
	projectBindings                []sourcebindingdomain.Binding
	teamshareBindings              []sourcebindingdomain.Binding
	bindingsByKnowledgeBase        map[string][]sourcebindingdomain.Binding
	markedRealtimeBindingIDs       []int64
	lastTeamshareKnowledgeBaseID   string
	lastProjectBindingOrganization string
	sourceItems                    []*sourcebindingdomain.SourceItem
}

func (s *sourceCallbackSourceBindingRepoStub) ReplaceBindings(
	context.Context,
	string,
	[]sourcebindingdomain.Binding,
) ([]sourcebindingdomain.Binding, error) {
	return nil, nil
}

func (s *sourceCallbackSourceBindingRepoStub) SaveBindings(
	context.Context,
	string,
	[]sourcebindingdomain.Binding,
) ([]sourcebindingdomain.Binding, error) {
	return nil, nil
}

func (s *sourceCallbackSourceBindingRepoStub) ApplyKnowledgeBaseBindings(
	context.Context,
	sourcebindingrepository.ApplyKnowledgeBaseBindingsInput,
) ([]sourcebindingdomain.Binding, error) {
	return nil, nil
}

func (s *sourceCallbackSourceBindingRepoStub) ListBindingsByKnowledgeBase(
	context.Context,
	string,
) ([]sourcebindingdomain.Binding, error) {
	return nil, nil
}

func (s *sourceCallbackSourceBindingRepoStub) ListBindingsByKnowledgeBases(
	_ context.Context,
	knowledgeBaseCodes []string,
) (map[string][]sourcebindingdomain.Binding, error) {
	result := make(map[string][]sourcebindingdomain.Binding, len(knowledgeBaseCodes))
	for _, code := range knowledgeBaseCodes {
		result[code] = append([]sourcebindingdomain.Binding(nil), s.bindingsByKnowledgeBase[code]...)
	}
	return result, nil
}

func (s *sourceCallbackSourceBindingRepoStub) ListRealtimeProjectBindingsByProject(
	_ context.Context,
	organizationCode string,
	_ int64,
) ([]sourcebindingdomain.Binding, error) {
	s.lastProjectBindingOrganization = organizationCode
	return append([]sourcebindingdomain.Binding(nil), s.projectBindings...), nil
}

func (s *sourceCallbackSourceBindingRepoStub) ListRealtimeTeamshareBindingsByKnowledgeBase(
	_ context.Context,
	_ string,
	_ string,
	knowledgeBaseID string,
) ([]sourcebindingdomain.Binding, error) {
	s.lastTeamshareKnowledgeBaseID = knowledgeBaseID
	return append([]sourcebindingdomain.Binding(nil), s.teamshareBindings...), nil
}

func (s *sourceCallbackSourceBindingRepoStub) ListTeamshareBindingsByKnowledgeBase(
	_ context.Context,
	_ string,
	_ string,
	knowledgeBaseID string,
) ([]sourcebindingdomain.Binding, error) {
	s.lastTeamshareKnowledgeBaseID = knowledgeBaseID
	return append([]sourcebindingdomain.Binding(nil), s.teamshareBindings...), nil
}

func (s *sourceCallbackSourceBindingRepoStub) MarkSourceBindingsRealtimeByIDs(
	_ context.Context,
	bindingIDs []int64,
) (int64, error) {
	s.markedRealtimeBindingIDs = append([]int64(nil), bindingIDs...)
	return int64(len(bindingIDs)), nil
}

func (s *sourceCallbackSourceBindingRepoStub) HasRealtimeProjectBindingForFile(
	context.Context,
	string,
	int64,
	int64,
) (bool, error) {
	return len(s.projectBindings) > 0, nil
}

func (s *sourceCallbackSourceBindingRepoStub) UpsertSourceItem(
	_ context.Context,
	item sourcebindingdomain.SourceItem,
) (*sourcebindingdomain.SourceItem, error) {
	item.ID = int64(len(s.sourceItems) + 1)
	cloned := item
	s.sourceItems = append(s.sourceItems, &cloned)
	return &cloned, nil
}

func (s *sourceCallbackSourceBindingRepoStub) UpsertSourceItems(
	ctx context.Context,
	items []sourcebindingdomain.SourceItem,
) ([]*sourcebindingdomain.SourceItem, error) {
	result := make([]*sourcebindingdomain.SourceItem, 0, len(items))
	for _, item := range items {
		created, err := s.UpsertSourceItem(ctx, item)
		if err != nil {
			return nil, err
		}
		result = append(result, created)
	}
	return result, nil
}

func (s *sourceCallbackSourceBindingRepoStub) ReplaceBindingItems(
	context.Context,
	int64,
	[]sourcebindingdomain.BindingItem,
) error {
	return nil
}

func (s *sourceCallbackSourceBindingRepoStub) ListBindingItemsByKnowledgeBase(
	context.Context,
	string,
) ([]sourcebindingdomain.BindingItem, error) {
	return nil, nil
}

var (
	_ sourceBindingRepository = (*sourceCallbackSourceBindingRepoStub)(nil)
	_ knowledgeBaseReader     = (*internalKnowledgeBaseReaderStub)(nil)
)

package kbapp_test

import (
	"context"
	"errors"
	"maps"
	"testing"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	service "magic/internal/application/knowledge/knowledgebase/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
)

var errProjectWorkspaceLookupBoom = errors.New("project workspace lookup boom")

func TestKnowledgeBaseAppServiceShowBackfillsWorkspaceID(t *testing.T) {
	t.Parallel()

	app := service.NewKnowledgeBaseAppServiceForTest(t, &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			Code:              testAppKnowledgeBaseCode,
			OrganizationCode:  testOrganizationCode1,
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector,
		},
	}, nil, nil, nil, "")
	app.SetSourceBindingRepository(&recordingSourceBindingRepository{
		listBindings: []sourcebindingdomain.Binding{
			{
				Provider:          sourcebindingdomain.ProviderProject,
				RootType:          sourcebindingdomain.RootTypeProject,
				RootRef:           "300",
				SyncMode:          sourcebindingdomain.SyncModeManual,
				Enabled:           true,
				KnowledgeBaseCode: testAppKnowledgeBaseCode,
			},
		},
	})
	projectReader := &recordingSuperMagicProjectReader{
		workspaceIDsByProject: map[int64]int64{300: 900},
		sharedProjectIDs:      map[int64]struct{}{300: {}},
	}
	app.SetSuperMagicProjectReader(projectReader)

	got, err := app.Show(context.Background(), testAppKnowledgeBaseCode, testOrganizationCode1, "user-1")
	if err != nil {
		t.Fatalf("Show() error = %v", err)
	}
	if len(got.SourceBindings) != 1 {
		t.Fatalf("expected 1 source binding, got %#v", got.SourceBindings)
	}
	if got.SourceBindings[0].WorkspaceID == nil || *got.SourceBindings[0].WorkspaceID != 900 {
		t.Fatalf("expected workspace_id=900, got %#v", got.SourceBindings[0].WorkspaceID)
	}
	if got.SourceBindings[0].WorkspaceType == nil || *got.SourceBindings[0].WorkspaceType != "shared" {
		t.Fatalf("expected workspace_type=shared, got %#v", got.SourceBindings[0].WorkspaceType)
	}
	if projectReader.calls != 1 {
		t.Fatalf("expected project reader called once, got %d", projectReader.calls)
	}
	if projectReader.lastSharedUserID != "user-1" {
		t.Fatalf("expected shared project lookup user_id=user-1, got %q", projectReader.lastSharedUserID)
	}
}

func TestKnowledgeBaseAppServiceListBackfillsWorkspaceIDBatch(t *testing.T) {
	t.Parallel()

	app := newBatchWorkspaceKnowledgeBaseApp(t)
	projectReader := &recordingSuperMagicProjectReader{
		workspaceIDsByProject: map[int64]int64{
			300: 900,
			301: 901,
		},
		sharedProjectIDs: map[int64]struct{}{
			301: {},
		},
	}
	app.SetSuperMagicProjectReader(projectReader)

	got, err := app.List(context.Background(), &kbdto.ListKnowledgeBaseInput{
		OrganizationCode: testOrganizationCode1,
		UserID:           "user-1",
		Offset:           0,
		Limit:            20,
	})
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if got.Total != 2 {
		t.Fatalf("expected total=2, got %d", got.Total)
	}

	list, ok := got.List.([]*kbdto.KnowledgeBaseDTO)
	if !ok {
		t.Fatalf("expected []*KnowledgeBaseDTO, got %T", got.List)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 knowledge bases, got %d", len(list))
	}
	assertSourceBindingWorkspace(t, list[0].SourceBindings[0], 900, "normal")
	assertSourceBindingWorkspace(t, list[1].SourceBindings[0], 901, "shared")
	if projectReader.calls != 1 {
		t.Fatalf("expected project reader called once, got %d", projectReader.calls)
	}
	if projectReader.lastSharedUserID != "user-1" {
		t.Fatalf("expected shared project lookup user_id=user-1, got %q", projectReader.lastSharedUserID)
	}
	if len(projectReader.lastSharedProjectIDs) != 2 ||
		projectReader.lastSharedProjectIDs[0] != 300 ||
		projectReader.lastSharedProjectIDs[1] != 301 {
		t.Fatalf("expected shared lookup project ids [300 301], got %#v", projectReader.lastSharedProjectIDs)
	}
}

func TestKnowledgeBaseAppServiceListIgnoresProjectWorkspaceLookupError(t *testing.T) {
	t.Parallel()

	app := service.NewKnowledgeBaseAppServiceForTest(t, &recordingKnowledgeBaseDomainService{
		listKBS: []*kbentity.KnowledgeBase{
			{Code: testAppKnowledgeBaseCode, OrganizationCode: testOrganizationCode1, KnowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector},
		},
		listTotal: 1,
	}, nil, nil, testKnowledgeBaseAppLogger(), "")
	app.SetKnowledgeBasePermissionReader(&recordingKnowledgeBasePermissionReader{
		operations: map[string]string{
			testAppKnowledgeBaseCode: "read",
		},
	})
	app.SetSourceBindingRepository(&recordingSourceBindingRepository{
		listBindingsByKnowledgeBase: map[string][]sourcebindingdomain.Binding{
			testAppKnowledgeBaseCode: {
				{
					Provider:          sourcebindingdomain.ProviderProject,
					RootType:          sourcebindingdomain.RootTypeProject,
					RootRef:           "300",
					SyncMode:          sourcebindingdomain.SyncModeManual,
					Enabled:           true,
					KnowledgeBaseCode: testAppKnowledgeBaseCode,
				},
			},
		},
	})
	app.SetSuperMagicProjectReader(&recordingSuperMagicProjectReader{err: errProjectWorkspaceLookupBoom})

	got, err := app.List(context.Background(), &kbdto.ListKnowledgeBaseInput{
		OrganizationCode: testOrganizationCode1,
		UserID:           "user-1",
		Offset:           0,
		Limit:            20,
	})
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}

	list, ok := got.List.([]*kbdto.KnowledgeBaseDTO)
	if !ok {
		t.Fatalf("expected []*KnowledgeBaseDTO, got %T", got.List)
	}
	if len(list) != 1 || len(list[0].SourceBindings) != 1 {
		t.Fatalf("unexpected list result: %#v", list)
	}
	if list[0].SourceBindings[0].WorkspaceID != nil {
		t.Fatalf("expected workspace_id omitted on lookup error, got %#v", list[0].SourceBindings[0].WorkspaceID)
	}
	if list[0].SourceBindings[0].WorkspaceType != nil {
		t.Fatalf("expected workspace_type omitted without workspace_id, got %#v", list[0].SourceBindings[0].WorkspaceType)
	}
}

func TestKnowledgeBaseAppServiceListFallsBackToNormalWorkspaceTypeOnSharedLookupError(t *testing.T) {
	t.Parallel()

	app := service.NewKnowledgeBaseAppServiceForTest(t, &recordingKnowledgeBaseDomainService{
		listKBS: []*kbentity.KnowledgeBase{
			{Code: testAppKnowledgeBaseCode, OrganizationCode: testOrganizationCode1, KnowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector},
		},
		listTotal: 1,
	}, nil, nil, testKnowledgeBaseAppLogger(), "")
	app.SetKnowledgeBasePermissionReader(&recordingKnowledgeBasePermissionReader{
		operations: map[string]string{
			testAppKnowledgeBaseCode: "read",
		},
	})
	app.SetSourceBindingRepository(&recordingSourceBindingRepository{
		listBindingsByKnowledgeBase: map[string][]sourcebindingdomain.Binding{
			testAppKnowledgeBaseCode: {
				{
					Provider:          sourcebindingdomain.ProviderProject,
					RootType:          sourcebindingdomain.RootTypeProject,
					RootRef:           "300",
					SyncMode:          sourcebindingdomain.SyncModeManual,
					Enabled:           true,
					KnowledgeBaseCode: testAppKnowledgeBaseCode,
				},
			},
		},
	})
	app.SetSuperMagicProjectReader(&recordingSuperMagicProjectReader{
		workspaceIDsByProject: map[int64]int64{300: 900},
		sharedErr:             errProjectWorkspaceLookupBoom,
	})

	got, err := app.List(context.Background(), &kbdto.ListKnowledgeBaseInput{
		OrganizationCode: testOrganizationCode1,
		UserID:           "user-1",
		Offset:           0,
		Limit:            20,
	})
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}

	list, ok := got.List.([]*kbdto.KnowledgeBaseDTO)
	if !ok {
		t.Fatalf("expected []*KnowledgeBaseDTO, got %T", got.List)
	}
	if len(list) != 1 || len(list[0].SourceBindings) != 1 {
		t.Fatalf("unexpected list result: %#v", list)
	}
	if list[0].SourceBindings[0].WorkspaceType == nil || *list[0].SourceBindings[0].WorkspaceType != "normal" {
		t.Fatalf("expected workspace_type fallback normal, got %#v", list[0].SourceBindings[0].WorkspaceType)
	}
}

func newBatchWorkspaceKnowledgeBaseApp(t *testing.T) *service.KnowledgeBaseAppService {
	t.Helper()

	app := service.NewKnowledgeBaseAppServiceForTest(t, &recordingKnowledgeBaseDomainService{
		listKBS: []*kbentity.KnowledgeBase{
			{Code: testAppKnowledgeBaseCode, OrganizationCode: testOrganizationCode1, KnowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector},
			{Code: testAppKnowledgeBaseCode2, OrganizationCode: testOrganizationCode1, KnowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector},
		},
		listTotal: 2,
	}, nil, nil, nil, "")
	app.SetKnowledgeBasePermissionReader(&recordingKnowledgeBasePermissionReader{
		operations: map[string]string{
			testAppKnowledgeBaseCode:  "read",
			testAppKnowledgeBaseCode2: "read",
		},
	})
	app.SetSourceBindingRepository(&recordingSourceBindingRepository{
		listBindingsByKnowledgeBase: map[string][]sourcebindingdomain.Binding{
			testAppKnowledgeBaseCode: {
				{
					Provider:          sourcebindingdomain.ProviderProject,
					RootType:          sourcebindingdomain.RootTypeProject,
					RootRef:           "300",
					SyncMode:          sourcebindingdomain.SyncModeManual,
					Enabled:           true,
					KnowledgeBaseCode: testAppKnowledgeBaseCode,
				},
			},
			testAppKnowledgeBaseCode2: {
				{
					Provider:          sourcebindingdomain.ProviderProject,
					RootType:          sourcebindingdomain.RootTypeProject,
					RootRef:           "301",
					SyncMode:          sourcebindingdomain.SyncModeManual,
					Enabled:           true,
					KnowledgeBaseCode: testAppKnowledgeBaseCode2,
				},
			},
		},
	})
	return app
}

func assertSourceBindingWorkspace(
	t *testing.T,
	binding kbdto.SourceBindingDTO,
	workspaceID int64,
	workspaceType string,
) {
	t.Helper()

	if binding.WorkspaceID == nil || *binding.WorkspaceID != workspaceID {
		t.Fatalf("expected workspace_id=%d, got %#v", workspaceID, binding.WorkspaceID)
	}
	if binding.WorkspaceType == nil || *binding.WorkspaceType != workspaceType {
		t.Fatalf("expected workspace_type=%s, got %#v", workspaceType, binding.WorkspaceType)
	}
}

type recordingSuperMagicProjectReader struct {
	workspaceIDsByProject map[int64]int64
	sharedProjectIDs      map[int64]struct{}
	err                   error
	sharedErr             error
	calls                 int
	lastOrganizationCode  string
	lastProjectIDs        []int64
	lastSharedUserID      string
	lastSharedProjectIDs  []int64
}

func (r *recordingSuperMagicProjectReader) ListWorkspaceIDsByProjectIDs(
	_ context.Context,
	organizationCode string,
	projectIDs []int64,
) (map[int64]int64, error) {
	r.calls++
	r.lastOrganizationCode = organizationCode
	r.lastProjectIDs = append([]int64(nil), projectIDs...)
	if r.err != nil {
		return nil, r.err
	}
	result := make(map[int64]int64, len(r.workspaceIDsByProject))
	maps.Copy(result, r.workspaceIDsByProject)
	return result, nil
}

func (r *recordingSuperMagicProjectReader) ListSharedProjectIDsByProjectIDs(
	_ context.Context,
	organizationCode string,
	userID string,
	projectIDs []int64,
) (map[int64]struct{}, error) {
	r.lastOrganizationCode = organizationCode
	r.lastSharedUserID = userID
	r.lastSharedProjectIDs = append([]int64(nil), projectIDs...)
	if r.sharedErr != nil {
		return nil, r.sharedErr
	}
	result := make(map[int64]struct{}, len(r.sharedProjectIDs))
	maps.Copy(result, r.sharedProjectIDs)
	return result, nil
}

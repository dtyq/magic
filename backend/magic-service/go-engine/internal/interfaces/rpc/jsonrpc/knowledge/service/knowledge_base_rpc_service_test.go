package service_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"testing"
	"time"

	confighelper "magic/internal/application/knowledge/helper/config"
	pagehelper "magic/internal/application/knowledge/helper/page"
	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	kbapp "magic/internal/application/knowledge/knowledgebase/service"
	apprebuild "magic/internal/application/knowledge/rebuild"
	rebuilddto "magic/internal/application/knowledge/rebuild/dto"
	revectorizeshared "magic/internal/application/knowledge/shared/revectorize"
	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/infrastructure/logging"
	"magic/internal/interfaces/rpc/jsonrpc/knowledge/dto"
	knowledgeService "magic/internal/interfaces/rpc/jsonrpc/knowledge/service"
	"magic/internal/pkg/ctxmeta"
	jsonrpc "magic/internal/pkg/jsonrpc"
)

const (
	testRebuildOrgCode          = "ORG900"
	testRebuildKBCode           = "KB001"
	testRebuildDocCode          = "DOC001"
	testKBCode                  = "KB-1"
	testKBOrgCode               = "ORG-1"
	testKnowledgeBaseRPCOrgCode = "DT001"
	testKBUserID                = "user-1"
	testRepairProvider          = "teamshare"
	testCreatorID               = "usi_creator"
	testModifierID              = "usi_modifier"
	testKnowledgeBaseTypeFlow   = "flow_vector"
	testKnowledgeBaseTypeAgent  = "digital_employee"
	testSourceTypeLocalFile     = 1
	testSourceTypeProject       = 3
	testFragmentModeCustom      = 1
	testFragmentModeAuto        = 2
	testLegacyAgentCode         = "SMA-LEGACY"
	testAsyncAcceptedStatus     = "accepted"
	testRebuildTriggeredStatus  = "triggered"
)

var errKnowledgeBaseRPCBoom = errors.New("knowledge base rpc boom")

type fakeKnowledgeBaseAppService struct {
	createResp       *kbdto.KnowledgeBaseDTO
	createErr        error
	updateResp       *kbdto.KnowledgeBaseDTO
	updateErr        error
	saveProcessResp  *kbdto.KnowledgeBaseDTO
	saveProcessErr   error
	listResp         *pagehelper.Result
	listErr          error
	nodesResp        *kbdto.ListSourceBindingNodesResult
	nodesErr         error
	showResp         *kbdto.KnowledgeBaseDTO
	showErr          error
	destroyErr       error
	repairResp       *kbdto.RepairSourceBindingsResult
	repairErr        error
	prepareErr       error
	teamshareStart   *revectorizeshared.TeamshareStartResult
	teamshareList    []*kbdto.TeamshareKnowledgeProgressDTO
	teamshareErr     error
	teamshareProg    []*kbdto.TeamshareKnowledgeProgressDTO
	teamshareProgErr error

	lastCreateInput      *kbdto.CreateKnowledgeBaseInput
	lastUpdateInput      *kbdto.UpdateKnowledgeBaseInput
	lastSaveProcessInput *kbdto.SaveProcessKnowledgeBaseInput
	lastListInput        *kbdto.ListKnowledgeBaseInput
	lastNodesInput       *kbdto.ListSourceBindingNodesInput
	lastShowCode         string
	lastShowOrg          string
	lastDestroyCode      string
	lastDestroyOrg       string
	lastRepairInput      *kbdto.RepairSourceBindingsInput
	lastRepairRequestID  string
	lastPrepareOrg       string
	lastPrepareScope     kbapp.RebuildScope
	lastPrepareRequestID string
	lastTeamshareStart   *revectorizeshared.TeamshareStartInput
	lastTeamshareList    *kbdto.TeamshareManageableInput
	lastTeamshareProg    *kbdto.TeamshareManageableProgressInput
	repairCalled         chan struct{}
	prepareCalled        chan struct{}
}

func (f *fakeKnowledgeBaseAppService) Create(_ context.Context, input *kbdto.CreateKnowledgeBaseInput) (*kbdto.KnowledgeBaseDTO, error) {
	f.lastCreateInput = input
	if f.createErr != nil {
		return nil, f.createErr
	}
	if f.createResp != nil {
		return f.createResp, nil
	}
	return &kbdto.KnowledgeBaseDTO{}, nil
}

func (f *fakeKnowledgeBaseAppService) Update(_ context.Context, input *kbdto.UpdateKnowledgeBaseInput) (*kbdto.KnowledgeBaseDTO, error) {
	f.lastUpdateInput = input
	if f.updateErr != nil {
		return nil, f.updateErr
	}
	if f.updateResp != nil {
		return f.updateResp, nil
	}
	return &kbdto.KnowledgeBaseDTO{}, nil
}

func (f *fakeKnowledgeBaseAppService) SaveProcess(_ context.Context, input *kbdto.SaveProcessKnowledgeBaseInput) (*kbdto.KnowledgeBaseDTO, error) {
	f.lastSaveProcessInput = input
	if f.saveProcessErr != nil {
		return nil, f.saveProcessErr
	}
	if f.saveProcessResp != nil {
		return f.saveProcessResp, nil
	}
	return &kbdto.KnowledgeBaseDTO{}, nil
}

func (f *fakeKnowledgeBaseAppService) Show(
	_ context.Context,
	code string,
	orgCode string,
	_ string,
) (*kbdto.KnowledgeBaseDTO, error) {
	f.lastShowCode = code
	f.lastShowOrg = orgCode
	if f.showErr != nil {
		return nil, f.showErr
	}
	return f.showResp, nil
}

func (f *fakeKnowledgeBaseAppService) List(_ context.Context, input *kbdto.ListKnowledgeBaseInput) (*pagehelper.Result, error) {
	f.lastListInput = input
	if f.listErr != nil {
		return nil, f.listErr
	}
	if f.listResp == nil {
		return &pagehelper.Result{Total: 0, List: []*kbdto.KnowledgeBaseDTO{}}, nil
	}
	return f.listResp, nil
}

func (f *fakeKnowledgeBaseAppService) ListSourceBindingNodes(_ context.Context, input *kbdto.ListSourceBindingNodesInput) (*kbdto.ListSourceBindingNodesResult, error) {
	f.lastNodesInput = input
	if f.nodesErr != nil {
		return nil, f.nodesErr
	}
	if f.nodesResp != nil {
		return f.nodesResp, nil
	}
	return &kbdto.ListSourceBindingNodesResult{}, nil
}

func (f *fakeKnowledgeBaseAppService) Destroy(
	_ context.Context,
	code string,
	orgCode string,
	_ string,
) error {
	f.lastDestroyCode = code
	f.lastDestroyOrg = orgCode
	return f.destroyErr
}

func (f *fakeKnowledgeBaseAppService) RepairSourceBindings(ctx context.Context, input *kbdto.RepairSourceBindingsInput) (*kbdto.RepairSourceBindingsResult, error) {
	f.lastRepairInput = input
	f.lastRepairRequestID, _ = ctxmeta.RequestIDFromContext(ctx)
	signalAsyncCall(f.repairCalled)
	if f.repairErr != nil {
		return nil, f.repairErr
	}
	if f.repairResp != nil {
		return f.repairResp, nil
	}
	return &kbdto.RepairSourceBindingsResult{}, nil
}

func (f *fakeKnowledgeBaseAppService) PrepareRebuild(
	ctx context.Context,
	operatorOrganizationCode string,
	scope kbapp.RebuildScope,
) error {
	f.lastPrepareOrg = operatorOrganizationCode
	f.lastPrepareScope = scope
	f.lastPrepareRequestID, _ = ctxmeta.RequestIDFromContext(ctx)
	signalAsyncCall(f.prepareCalled)
	return f.prepareErr
}

func (f *fakeKnowledgeBaseAppService) TeamshareStartVector(
	_ context.Context,
	input *revectorizeshared.TeamshareStartInput,
) (*revectorizeshared.TeamshareStartResult, error) {
	f.lastTeamshareStart = input
	if f.teamshareErr != nil {
		return nil, f.teamshareErr
	}
	if f.teamshareStart != nil {
		return f.teamshareStart, nil
	}
	return &revectorizeshared.TeamshareStartResult{KnowledgeCode: "KB-teamshare"}, nil
}

func (f *fakeKnowledgeBaseAppService) TeamshareManageable(
	_ context.Context,
	input *kbdto.TeamshareManageableInput,
) ([]*kbdto.TeamshareKnowledgeProgressDTO, error) {
	f.lastTeamshareList = input
	if f.teamshareErr != nil {
		return nil, f.teamshareErr
	}
	return f.teamshareList, nil
}

func (f *fakeKnowledgeBaseAppService) TeamshareManageableProgress(
	_ context.Context,
	input *kbdto.TeamshareManageableProgressInput,
) ([]*kbdto.TeamshareKnowledgeProgressDTO, error) {
	f.lastTeamshareProg = input
	if f.teamshareProgErr != nil {
		return nil, f.teamshareProgErr
	}
	if f.teamshareProg != nil {
		return f.teamshareProg, nil
	}
	return []*kbdto.TeamshareKnowledgeProgressDTO{}, nil
}

type fakeRebuildTrigger struct {
	resp               *apprebuild.TriggerResult
	err                error
	lastOpts           *rebuilddto.RunOptions
	lastBusinessParams *ctxmeta.BusinessParams
	lastRequestID      string
	called             chan struct{}
}

func (f *fakeRebuildTrigger) Trigger(ctx context.Context, opts rebuilddto.RunOptions) (*apprebuild.TriggerResult, error) {
	f.lastOpts = &opts
	f.lastBusinessParams, _ = ctxmeta.BusinessParamsFromContext(ctx)
	f.lastRequestID, _ = ctxmeta.RequestIDFromContext(ctx)
	signalAsyncCall(f.called)
	if f.err != nil {
		return nil, f.err
	}
	if f.resp != nil {
		return f.resp, nil
	}
	return &apprebuild.TriggerResult{Status: apprebuild.TriggerStatusTriggered, RunID: "r-default"}, nil
}

type fakeRebuildCleanupService struct {
	resp      *rebuilddto.CleanupResult
	err       error
	lastInput *rebuilddto.CleanupInput
}

func (f *fakeRebuildCleanupService) Cleanup(_ context.Context, input *rebuilddto.CleanupInput) (*rebuilddto.CleanupResult, error) {
	f.lastInput = input
	if f.err != nil {
		return nil, f.err
	}
	if f.resp != nil {
		return f.resp, nil
	}
	return &rebuilddto.CleanupResult{}, nil
}

func buildKnowledgeBaseRPCServiceForTest(
	appSvc *fakeKnowledgeBaseAppService,
	rebuildTrigger *fakeRebuildTrigger,
	rebuildCleanup ...*fakeRebuildCleanupService,
) *knowledgeService.KnowledgeBaseRPCService {
	logger := logging.NewFromConfig(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevelInfo,
		Format: autoloadcfg.LogFormatJSON,
	})
	if rebuildTrigger == nil {
		rebuildTrigger = &fakeRebuildTrigger{}
	}
	ensureFakeKnowledgeBaseAppServiceSignals(appSvc)
	ensureFakeRebuildTriggerSignals(rebuildTrigger)
	cleanupSvc := &fakeRebuildCleanupService{}
	if len(rebuildCleanup) > 0 && rebuildCleanup[0] != nil {
		cleanupSvc = rebuildCleanup[0]
	}
	return knowledgeService.NewKnowledgeBaseRPCService(appSvc, rebuildTrigger, cleanupSvc, logger)
}

func ensureFakeKnowledgeBaseAppServiceSignals(appSvc *fakeKnowledgeBaseAppService) {
	if appSvc == nil {
		return
	}
	if appSvc.repairCalled == nil {
		appSvc.repairCalled = make(chan struct{}, 1)
	}
	if appSvc.prepareCalled == nil {
		appSvc.prepareCalled = make(chan struct{}, 1)
	}
}

func ensureFakeRebuildTriggerSignals(trigger *fakeRebuildTrigger) {
	if trigger == nil {
		return
	}
	if trigger.called == nil {
		trigger.called = make(chan struct{}, 1)
	}
}

func signalAsyncCall(ch chan struct{}) {
	if ch == nil {
		return
	}
	select {
	case ch <- struct{}{}:
	default:
	}
}

func waitAsyncCall(t *testing.T, ch chan struct{}, name string) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for %s", name)
	}
}

func jsonRawMessagef(format string, args ...any) json.RawMessage {
	return json.RawMessage(fmt.Sprintf(format, args...))
}

func requireAgentCodes(t *testing.T, got []string, want ...string) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("expected agent_codes=%#v, got %#v", want, got)
	}
	for idx := range want {
		if got[idx] != want[idx] {
			t.Fatalf("expected agent_codes=%#v, got %#v", want, got)
		}
	}
}

func TestKnowledgeBaseListRPC_TypeZeroMeansNoFilter(t *testing.T) {
	t.Parallel()
	appSvc := &fakeKnowledgeBaseAppService{}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
	wrapped := jsonrpc.WrapTyped(rpcSvc.ListRPC)

	raw := jsonRawMessagef(`{
		"data_isolation": {
			"organization_code": "%s",
			"user_id": "usi_test"
		},
		"name": "abc",
		"type": 0,
		"offset": 20,
		"limit": 10
	}`, testKnowledgeBaseRPCOrgCode)

	resp, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.queries", raw)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if _, ok := resp.(*dto.KnowledgeBasePageResponse); !ok {
		t.Fatalf("expected *KnowledgeBasePageResponse response, got %T", resp)
	}
	if appSvc.lastListInput == nil {
		t.Fatal("expected list input to be captured")
	}
	if appSvc.lastListInput.Type != nil {
		t.Fatalf("expected query.Type=nil when input type=0, got %v", *appSvc.lastListInput.Type)
	}
	if appSvc.lastListInput.OrganizationCode != testKnowledgeBaseRPCOrgCode {
		t.Fatalf("expected org=%s, got %q", testKnowledgeBaseRPCOrgCode, appSvc.lastListInput.OrganizationCode)
	}
	if appSvc.lastListInput.Offset != 20 || appSvc.lastListInput.Limit != 10 {
		t.Fatalf("expected offset/limit=20/10, got %d/%d", appSvc.lastListInput.Offset, appSvc.lastListInput.Limit)
	}
}

func TestKnowledgeBaseListRPC_ResponseContractCompat(t *testing.T) {
	t.Parallel()
	appSvc := &fakeKnowledgeBaseAppService{
		listResp: &pagehelper.Result{
			Total: 1,
			List: []*kbdto.KnowledgeBaseDTO{
				{
					Code:       "KNOWLEDGE-TEST",
					Creator:    testCreatorID,
					Modifier:   testModifierID,
					CreatedUID: testCreatorID,
					UpdatedUID: testModifierID,
					AgentCodes: []string{"1001", "1002"},
					FragmentConfig: &confighelper.FragmentConfigOutputDTO{
						Mode: testFragmentModeCustom,
						Normal: &confighelper.NormalFragmentConfigOutputDTO{
							SegmentRule: &confighelper.SegmentRuleOutputDTO{
								Separator:    "\\n\\n",
								ChunkSize:    500,
								ChunkOverlap: 0,
							},
							TextPreprocessRule: []int{1},
						},
					},
				},
			},
		},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
	wrapped := jsonrpc.WrapTyped(rpcSvc.ListRPC)

	raw := jsonRawMessagef(`{
		"data_isolation": {
			"organization_code": "%s",
			"user_id": "usi_test"
		},
		"offset": 0,
		"limit": 10
	}`, testKnowledgeBaseRPCOrgCode)

	resp, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.queries", raw)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	page, ok := resp.(*dto.KnowledgeBasePageResponse)
	if !ok || page == nil {
		t.Fatalf("expected *KnowledgeBasePageResponse response, got %T", resp)
	}

	assertKnowledgeBaseListContractCompat(t, page)
}

func TestKnowledgeBaseListRPCProjectsFlowVectorCompatFields(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{
		listResp: &pagehelper.Result{
			Total: 1,
			List: []*kbdto.KnowledgeBaseDTO{
				{
					Code:              testKBCode,
					UserOperation:     3,
					KnowledgeBaseType: testKnowledgeBaseTypeFlow,
				},
			},
		},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)

	page, err := rpcSvc.ListRPC(context.Background(), &dto.ListKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: testKBOrgCode, UserID: testKBUserID},
		Offset:        0,
		Limit:         10,
	})
	if err != nil {
		t.Fatalf("ListRPC returned error: %v", err)
	}

	item := decodeSingleListItem(t, page)
	assertJSONIntField(t, item, "user_operation", 3)
	assertJSONIntField(t, item, "source_type", testSourceTypeLocalFile)
}

func TestKnowledgeBaseListRPCProjectsDigitalEmployeeFields(t *testing.T) {
	t.Parallel()

	sourceType := testSourceTypeProject
	appSvc := &fakeKnowledgeBaseAppService{
		listResp: &pagehelper.Result{
			Total: 1,
			List: []*kbdto.KnowledgeBaseDTO{
				{
					Code:              testKBCode,
					SourceType:        &sourceType,
					UserOperation:     2,
					KnowledgeBaseType: testKnowledgeBaseTypeAgent,
				},
			},
		},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)

	page, err := rpcSvc.ListRPC(context.Background(), &dto.ListKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: testKBOrgCode, UserID: testKBUserID},
		Offset:        0,
		Limit:         10,
	})
	if err != nil {
		t.Fatalf("ListRPC returned error: %v", err)
	}

	item := decodeSingleListItem(t, page)
	assertJSONFieldAbsent(t, item, "user_operation")
	assertJSONIntField(t, item, "source_type", sourceType)
}

func TestKnowledgeBaseNodesRPC_MapsPaginationCompat(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{
		nodesResp: &kbdto.ListSourceBindingNodesResult{
			Total: 41,
			List: []kbdto.SourceBindingNode{
				{
					NodeType:    "workspace",
					NodeRef:     "11",
					Name:        "工作区 A",
					HasChildren: true,
					Meta: map[string]any{
						"workspace_id": "11",
						"project_id":   "22",
						"label":        "保留原类型",
					},
				},
			},
		},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
	wrapped := jsonrpc.WrapTyped(rpcSvc.ListSourceBindingNodesRPC)

	raw := json.RawMessage(`{
		"data_isolation": {
			"organization_code": "ORG-1",
			"user_id": "user-1"
		},
		"source_type": "project",
		"parent_type": "root",
		"offset": 20,
		"limit": 10
	}`)

	resp, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.nodes", raw)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	page, ok := resp.(*dto.ListSourceBindingNodesResponse)
	if !ok || page == nil {
		t.Fatalf("expected *ListSourceBindingNodesResponse response, got %T", resp)
	}
	if appSvc.lastNodesInput == nil {
		t.Fatal("expected nodes input captured")
	}
	if appSvc.lastNodesInput.Offset != 20 || appSvc.lastNodesInput.Limit != 10 {
		t.Fatalf("expected offset/limit=20/10, got %d/%d", appSvc.lastNodesInput.Offset, appSvc.lastNodesInput.Limit)
	}
	if page.Page != 3 || page.Total != 41 || len(page.List) != 1 {
		t.Fatalf("unexpected nodes page response: %#v", page)
	}
	body, err := json.Marshal(page)
	if err != nil {
		t.Fatalf("marshal nodes page failed: %v", err)
	}
	var parsed map[string]any
	if err := json.Unmarshal(body, &parsed); err != nil {
		t.Fatalf("unmarshal nodes page failed: %v", err)
	}
	list, ok := parsed["list"].([]any)
	if !ok || len(list) != 1 {
		t.Fatalf("expected single node, got %#v", parsed["list"])
	}
	item, ok := list[0].(map[string]any)
	if !ok {
		t.Fatalf("expected object node, got %#v", list[0])
	}
	meta, ok := item["meta"].(map[string]any)
	if !ok {
		t.Fatalf("expected meta object, got %#v", item["meta"])
	}
	assertJSONStringField(t, meta, "workspace_id", "11")
	assertJSONStringField(t, meta, "project_id", "22")
	if meta["label"] != "保留原类型" {
		t.Fatalf("expected non-id field unchanged, got %#v", meta["label"])
	}
}

func TestKnowledgeBaseCreateRPCMapsSourceBindings(t *testing.T) {
	t.Parallel()
	appSvc := &fakeKnowledgeBaseAppService{
		createResp: &kbdto.KnowledgeBaseDTO{Code: testKBCode},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
	wrapped := jsonrpc.WrapTyped(rpcSvc.CreateRPC)

	raw := json.RawMessage(`{
		"data_isolation": {
			"organization_code": "ORG-1",
			"user_id": "user-1"
		},
		"name": "项目知识库",
		"type": 1,
		"source_type": 3,
		"agent_codes": ["1001"],
		"source_bindings": [
			{
				"provider": "project",
				"root_type": "project",
				"root_ref": "1001",
				"sync_mode": "realtime",
				"targets": [
					{"target_type": "file", "target_ref": "11"},
					{"target_type": "file", "target_ref": "22"}
				]
			}
		]
	}`)

	resp, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.create", raw)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if _, ok := resp.(*dto.KnowledgeBaseResponse); !ok {
		t.Fatalf("expected *KnowledgeBaseResponse response, got %T", resp)
	}
	if appSvc.lastCreateInput == nil || len(appSvc.lastCreateInput.SourceBindings) != 1 {
		t.Fatalf("expected mapped source bindings, got %#v", appSvc.lastCreateInput)
	}
	if got := appSvc.lastCreateInput.AgentCodes; len(got) != 1 || got[0] != "1001" {
		t.Fatalf("expected agent_codes to pass through, got %#v", got)
	}
	if appSvc.lastCreateInput.SourceBindings[0].Provider != "project" || appSvc.lastCreateInput.SourceBindings[0].RootRef != "1001" {
		t.Fatalf("unexpected source binding mapping: %#v", appSvc.lastCreateInput.SourceBindings[0])
	}
}

func TestKnowledgeBaseListSourceBindingNodesRPCAcceptsStringPagination(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{
		nodesResp: &kbdto.ListSourceBindingNodesResult{},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
	wrapped := jsonrpc.WrapTyped(rpcSvc.ListSourceBindingNodesRPC)

	raw := json.RawMessage(`{
		"data_isolation": {
			"organization_code": "ORG-1",
			"user_id": "user-1"
		},
		"source_type": "project",
		"parent_type": "root",
		"page": "2",
		"page_size": "20"
	}`)

	if _, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.nodes", raw); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if appSvc.lastNodesInput == nil || appSvc.lastNodesInput.Offset != 20 || appSvc.lastNodesInput.Limit != 20 {
		t.Fatalf("expected string pagination mapped to offset/limit=20/20, got %#v", appSvc.lastNodesInput)
	}
}

func TestKnowledgeBaseRepairSourceBindingsRPCMapsPayload(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{
		repairResp: &kbdto.RepairSourceBindingsResult{
			OrganizationCodes:    []string{"ORG-1", "ORG-2"},
			ThirdPlatformType:    testRepairProvider,
			ScannedOrganizations: 2,
			ScannedKnowledge:     2,
			CandidateBindings:    3,
			AddedBindings:        2,
			MaterializedDocs:     4,
			ReusedDocuments:      1,
			BackfilledRows:       8,
			Organizations: []kbdto.RepairSourceBindingsOrganizationResult{
				{OrganizationCode: "ORG-1", AddedBindings: 2},
				{OrganizationCode: "ORG-2"},
			},
		},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
	wrapped := jsonrpc.WrapTyped(rpcSvc.RepairSourceBindingsRPC)

	raw := json.RawMessage(`{
		"data_isolation": {
			"organization_code": "ORG-1",
			"user_id": "user-1"
		},
		"organization_codes": ["ORG-1", "ORG-2"],
		"third_platform_type": "teamshare",
		"batch_size": 256
	}`)

	reqCtx := ctxmeta.WithRequestID(context.Background(), "req-repair-rpc-1")
	resp, err := wrapped(reqCtx, "svc.knowledge.knowledgeBase.repairThirdFileMappings", raw)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	result, ok := resp.(*dto.RepairSourceBindingsResponse)
	if !ok {
		t.Fatalf("expected repair response, got %T", resp)
	}
	if result.Status != testAsyncAcceptedStatus || result.TaskID == "" {
		t.Fatalf("unexpected async repair response: %#v", result)
	}
	if result.OrganizationCode != testKBOrgCode {
		t.Fatalf("unexpected organization_code: %#v", result)
	}
	if !reflect.DeepEqual(result.OrganizationCodes, []string{"ORG-1", "ORG-2"}) {
		t.Fatalf("unexpected response organization codes: %#v", result.OrganizationCodes)
	}
	waitAsyncCall(t, appSvc.repairCalled, "repair source bindings background task")
	if appSvc.lastRepairInput == nil {
		t.Fatal("expected repair input captured")
	}
	if appSvc.lastRepairInput.OrganizationCode != testKBOrgCode || appSvc.lastRepairInput.UserID != testKBUserID {
		t.Fatalf("unexpected repair input: %#v", appSvc.lastRepairInput)
	}
	if !reflect.DeepEqual(appSvc.lastRepairInput.OrganizationCodes, []string{"ORG-1", "ORG-2"}) {
		t.Fatalf("unexpected repair organization codes: %#v", appSvc.lastRepairInput)
	}
	if appSvc.lastRepairInput.ThirdPlatformType != testRepairProvider || appSvc.lastRepairInput.BatchSize != 256 {
		t.Fatalf("unexpected repair payload: %#v", appSvc.lastRepairInput)
	}
	if appSvc.lastRepairRequestID != "req-repair-rpc-1" {
		t.Fatalf("expected repair request_id to be copied to background context, got %q", appSvc.lastRepairRequestID)
	}
}

func TestKnowledgeBaseRebuildCleanupRPCMapsPayload(t *testing.T) {
	t.Parallel()

	cleanupSvc := &fakeRebuildCleanupService{
		resp: &rebuilddto.CleanupResult{
			Apply:                    true,
			ForceDeleteNonEmpty:      true,
			CandidatePattern:         "all collections except magic_knowledge / magic_knowledge_active / magic_knowledge_shadow",
			AliasName:                "magic_knowledge",
			AliasTarget:              "magic_knowledge_active",
			MetaPhysicalCollection:   "magic_knowledge_active",
			CurrentRunID:             "",
			SafeToDeleteCollections:  []rebuilddto.CleanupCollectionAudit{{Name: "magic_knowledge_shadow_r1", Points: 0}},
			KeptCollections:          []rebuilddto.CleanupCollectionAudit{{Name: "magic_knowledge_r_r2", Points: 2}},
			SkipReason:               map[string]string{"magic_knowledge_r_r2": "collection still has points"},
			DeletedDualwriteState:    true,
			TotalCollections:         6,
			CandidateCollectionCount: 2,
			SafeToDeleteCount:        1,
			KeptCount:                1,
		},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(&fakeKnowledgeBaseAppService{}, nil, cleanupSvc)
	wrapped := jsonrpc.WrapTyped(rpcSvc.RebuildCleanupRPC)

	raw := json.RawMessage(`{
		"data_isolation": {
			"organization_code": "ORG-1"
		},
		"apply": true,
		"force_delete_non_empty": true
	}`)

	resp, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.rebuildCleanup", raw)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	result, ok := resp.(*dto.RebuildCleanupResponse)
	if !ok {
		t.Fatalf("expected cleanup response, got %T", resp)
	}
	if cleanupSvc.lastInput == nil || cleanupSvc.lastInput.OrganizationCode != testKBOrgCode || !cleanupSvc.lastInput.Apply || !cleanupSvc.lastInput.ForceDeleteNonEmpty {
		t.Fatalf("unexpected cleanup input: %#v", cleanupSvc.lastInput)
	}
	if result.SafeToDeleteCount != 1 || len(result.SafeToDeleteCollections) != 1 {
		t.Fatalf("unexpected cleanup result: %#v", result)
	}
	if !result.ForceDeleteNonEmpty {
		t.Fatalf("expected force_delete_non_empty in response, got %#v", result)
	}
	if result.SkipReason["magic_knowledge_r_r2"] == "" {
		t.Fatalf("expected skip reason copied, got %#v", result.SkipReason)
	}
}

func TestKnowledgeBaseRebuildCleanupRPCAcceptsStringBoolCompat(t *testing.T) {
	t.Parallel()

	cleanupSvc := &fakeRebuildCleanupService{
		resp: &rebuilddto.CleanupResult{},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(&fakeKnowledgeBaseAppService{}, nil, cleanupSvc)
	wrapped := jsonrpc.WrapTyped(rpcSvc.RebuildCleanupRPC)

	raw := json.RawMessage(`{
		"data_isolation": {
			"organization_code": "ORG-1"
		},
		"apply": "0",
		"force_delete_non_empty": "false"
	}`)

	if _, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.rebuildCleanup", raw); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if cleanupSvc.lastInput == nil || cleanupSvc.lastInput.Apply || !cleanupSvc.lastInput.ForceDeleteNonEmpty {
		t.Fatalf("expected PHP truthy bool compat applied, got %#v", cleanupSvc.lastInput)
	}
}

func TestKnowledgeBaseUpdateRPCMapsExplicitEmptySourceBindings(t *testing.T) {
	t.Parallel()
	appSvc := &fakeKnowledgeBaseAppService{
		updateResp: &kbdto.KnowledgeBaseDTO{Code: testKBCode},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
	wrapped := jsonrpc.WrapTyped(rpcSvc.UpdateRPC)

	raw := json.RawMessage(`{
		"data_isolation": {
			"organization_code": "ORG-1",
			"user_id": "user-1"
		},
		"code": "KB-1",
		"source_bindings": []
	}`)

	resp, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.update", raw)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if _, ok := resp.(*dto.KnowledgeBaseResponse); !ok {
		t.Fatalf("expected *KnowledgeBaseResponse response, got %T", resp)
	}
	if appSvc.lastUpdateInput == nil || appSvc.lastUpdateInput.SourceBindings == nil {
		t.Fatalf("expected explicit empty source bindings to be preserved, got %#v", appSvc.lastUpdateInput)
	}
	if got := len(*appSvc.lastUpdateInput.SourceBindings); got != 0 {
		t.Fatalf("expected empty source bindings, got %d", got)
	}
}

func TestKnowledgeBaseShowRPC_NotFoundMappedBusinessError(t *testing.T) {
	t.Parallel()
	appSvc := &fakeKnowledgeBaseAppService{
		showErr: fmt.Errorf("failed to find knowledge base: %w", kbapp.ErrKnowledgeBaseNotFound),
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
	wrapped := jsonrpc.WrapTyped(rpcSvc.ShowRPC)

	raw := jsonRawMessagef(`{
		"data_isolation": {
			"organization_code": "%s",
			"user_id": "usi_test"
		},
		"code": "KNOWLEDGE-NOT-FOUND"
	}`, testKnowledgeBaseRPCOrgCode)

	_, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.show", raw)
	if err == nil {
		t.Fatal("expected error")
	}

	var bizErr *jsonrpc.BusinessError
	if !errors.As(err, &bizErr) {
		t.Fatalf("expected *BusinessError, got %T", err)
	}
	if bizErr.Code != jsonrpc.ErrCodeKnowledgeBaseNotFound {
		t.Fatalf("expected code=%d, got %d", jsonrpc.ErrCodeKnowledgeBaseNotFound, bizErr.Code)
	}
}

func TestKnowledgeBaseCreateRPCRejectsRetrieveTopKAboveLimit(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
	wrapped := jsonrpc.WrapTyped(rpcSvc.CreateRPC)

	_, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.create", jsonRawMessagef(`{
		"data_isolation": {"organization_code": "%s", "user_id": "u1"},
		"name": "kb",
		"retrieve_config": {"top_k": 11}
	}`, testKnowledgeBaseRPCOrgCode))
	if err == nil {
		t.Fatal("expected error")
	}

	var bizErr *jsonrpc.BusinessError
	if !errors.As(err, &bizErr) {
		t.Fatalf("expected business error, got %T", err)
	}
	if bizErr.Code != jsonrpc.ErrCodeInvalidParams {
		t.Fatalf("expected invalid params code, got %d", bizErr.Code)
	}
	if appSvc.lastCreateInput != nil {
		t.Fatal("expected create input to remain nil on validation failure")
	}
}

func TestKnowledgeBaseCreateRPCAcceptsEmptyArrayRerankingModelCompat(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
	wrapped := jsonrpc.WrapTyped(rpcSvc.CreateRPC)

	_, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.create", jsonRawMessagef(`{
		"data_isolation": {"organization_code": "%s", "user_id": "u1"},
		"name": "kb",
		"retrieve_config": {"top_k": 3, "reranking_model": []}
	}`, testKnowledgeBaseRPCOrgCode))
	if err != nil {
		t.Fatalf("expected request to pass through, got %v", err)
	}

	if appSvc.lastCreateInput == nil || appSvc.lastCreateInput.RetrieveConfig == nil {
		t.Fatalf("expected create input retrieve_config to be forwarded, got %#v", appSvc.lastCreateInput)
	}
	if appSvc.lastCreateInput.RetrieveConfig.RerankingModel == nil {
		t.Fatalf("expected reranking_model compat value, got %#v", appSvc.lastCreateInput.RetrieveConfig)
	}
}

func TestKnowledgeBaseUpdateRPCAcceptsFragmentChunkSizeAboveLegacyLimit(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)

	_, err := rpcSvc.UpdateRPC(context.Background(), &dto.UpdateKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: testKnowledgeBaseRPCOrgCode, UserID: "u1"},
		Code:          "KB1",
		Name:          "kb",
		FragmentConfig: &confighelper.FragmentConfigDTO{
			Mode: 1,
			Normal: &confighelper.NormalFragmentConfigDTO{
				SegmentRule: &confighelper.SegmentRuleDTO{
					ChunkSize: 1001,
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("expected request to pass through, got %v", err)
	}
	if appSvc.lastUpdateInput == nil {
		t.Fatal("expected update input to be forwarded")
	}
}

func TestKnowledgeBaseUpdateRPCMapsAmbiguousFlowSourceType(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{updateErr: kbapp.ErrAmbiguousFlowSourceType}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)

	_, err := rpcSvc.UpdateRPC(context.Background(), &dto.UpdateKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: testKnowledgeBaseRPCOrgCode, UserID: "u1"},
		Code:          "KB1",
		Name:          "kb",
	})
	if err == nil {
		t.Fatal("expected error")
	}

	var bizErr *jsonrpc.BusinessError
	if !errors.As(err, &bizErr) {
		t.Fatalf("expected business error, got %T", err)
	}
	if bizErr.Code != jsonrpc.ErrCodeInvalidParams {
		t.Fatalf("expected invalid params code, got %d", bizErr.Code)
	}
	if bizErr.Message != kbapp.ErrAmbiguousFlowSourceType.Error() {
		t.Fatalf("unexpected error message: %q", bizErr.Message)
	}
}

func TestKnowledgeBaseCreateRPCAcceptsAutoModeWithoutSubConfig(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)

	_, err := rpcSvc.CreateRPC(context.Background(), &dto.CreateKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: testKnowledgeBaseRPCOrgCode, UserID: "u1"},
		Name:          "kb",
		FragmentConfig: &confighelper.FragmentConfigDTO{
			Mode: testFragmentModeAuto,
		},
	})
	if err != nil {
		t.Fatalf("expected auto mode request to pass through, got %v", err)
	}
	if appSvc.lastCreateInput == nil {
		t.Fatal("expected create input to be forwarded")
	}
}

func TestKnowledgeBaseCreateRPCRejectsHierarchyLevelAboveLimit(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
	wrapped := jsonrpc.WrapTyped(rpcSvc.CreateRPC)

	_, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.create", jsonRawMessagef(`{
		"data_isolation": {"organization_code": "%s", "user_id": "u1"},
		"name": "kb",
		"fragment_config": {
			"mode": 3,
			"hierarchy": {"max_level": 7}
		}
	}`, testKnowledgeBaseRPCOrgCode))
	if err == nil {
		t.Fatal("expected error")
	}

	var bizErr *jsonrpc.BusinessError
	if !errors.As(err, &bizErr) {
		t.Fatalf("expected business error, got %T", err)
	}
	if bizErr.Code != jsonrpc.ErrCodeInvalidParams {
		t.Fatalf("expected invalid params code, got %d", bizErr.Code)
	}
	if appSvc.lastCreateInput != nil {
		t.Fatal("expected create input to remain nil on validation failure")
	}
}

func TestKnowledgeBaseCreateRPCPassesSourceTypeToApp(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)

	resp, err := rpcSvc.CreateRPC(context.Background(), &dto.CreateKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: testKnowledgeBaseRPCOrgCode, UserID: "u1"},
		Name:          "kb",
		SourceType:    func() *int { v := 4; return &v }(),
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp == nil {
		t.Fatal("expected response")
	}
	if appSvc.lastCreateInput == nil || appSvc.lastCreateInput.SourceType == nil || *appSvc.lastCreateInput.SourceType != 4 {
		t.Fatalf("expected source_type to pass through, got %#v", appSvc.lastCreateInput)
	}
}

func TestKnowledgeBaseCreateRPCRejectsInvalidSourceType(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
	wrapped := jsonrpc.WrapTyped(rpcSvc.CreateRPC)

	_, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.create", jsonRawMessagef(`{
		"data_isolation": {"organization_code": "%s", "user_id": "u1"},
		"name": "kb",
		"source_type": 99
	}`, testKnowledgeBaseRPCOrgCode))
	if err == nil {
		t.Fatal("expected error")
	}

	var bizErr *jsonrpc.BusinessError
	if !errors.As(err, &bizErr) {
		t.Fatalf("expected business error, got %T", err)
	}
	if bizErr.Code != jsonrpc.ErrCodeInvalidParams {
		t.Fatalf("expected invalid params code, got %d", bizErr.Code)
	}
	if bizErr.Message != "source_type must be one of 1, 2, 3, 4, 1001" {
		t.Fatalf("unexpected error message: %q", bizErr.Message)
	}
	if appSvc.lastCreateInput != nil {
		t.Fatalf("expected create input to remain nil, got %#v", appSvc.lastCreateInput)
	}
}

func TestKnowledgeBaseCreateRPCMapsDigitalEmployeeSourceTypeRequired(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{createErr: kbapp.ErrDigitalEmployeeSourceTypeRequired}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)

	_, err := rpcSvc.CreateRPC(context.Background(), &dto.CreateKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: testKnowledgeBaseRPCOrgCode, UserID: "u1"},
		Name:          "kb",
		AgentCodes:    []string{"SMA-1"},
	})
	if err == nil {
		t.Fatal("expected error")
	}

	var bizErr *jsonrpc.BusinessError
	if !errors.As(err, &bizErr) {
		t.Fatalf("expected business error, got %T", err)
	}
	if bizErr.Code != jsonrpc.ErrCodeInvalidParams {
		t.Fatalf("expected invalid params code, got %d", bizErr.Code)
	}
	if bizErr.Message != kbapp.ErrDigitalEmployeeSourceTypeRequired.Error() {
		t.Fatalf("unexpected error message: %q", bizErr.Message)
	}
}

func TestKnowledgeBaseCreateRPCAcceptsAllSupportedSourceTypes(t *testing.T) {
	t.Parallel()

	supportedValues := []int{1, 2, 3, 4, 1001}
	for _, sourceType := range supportedValues {
		t.Run(fmt.Sprintf("source_type_%d", sourceType), func(t *testing.T) {
			t.Parallel()

			appSvc := &fakeKnowledgeBaseAppService{}
			rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
			wrapped := jsonrpc.WrapTyped(rpcSvc.CreateRPC)

			_, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.create", jsonRawMessagef(`{
				"data_isolation": {"organization_code": "%s", "user_id": "u1"},
				"name": "kb",
				"source_type": %d
			}`, testKnowledgeBaseRPCOrgCode, sourceType))
			if err != nil {
				t.Fatalf("expected nil error, got %v", err)
			}
			if appSvc.lastCreateInput == nil || appSvc.lastCreateInput.SourceType == nil || *appSvc.lastCreateInput.SourceType != sourceType {
				t.Fatalf("expected source_type=%d, got %#v", sourceType, appSvc.lastCreateInput)
			}
		})
	}
}

func TestKnowledgeBaseCreateRPC_PassesSourceBindings(t *testing.T) {
	t.Parallel()
	appSvc := &fakeKnowledgeBaseAppService{
		createResp: &kbdto.KnowledgeBaseDTO{Code: "KNOWLEDGE-TEST"},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
	wrapped := jsonrpc.WrapTyped(rpcSvc.CreateRPC)

	raw := jsonRawMessagef(`{
		"data_isolation": {
			"organization_code": "%s",
			"user_id": "usi_test"
		},
		"name": "test",
		"description": "desc",
		"type": 1,
		"source_type": 1,
		"source_bindings": [
			{
				"provider": "local_upload",
				"root_type": "file",
				"root_ref": "org/path/doc-1.md",
				"sync_mode": "manual",
				"sync_config": {
					"document_file": {
						"name": "doc-1.md",
						"url": "org/path/doc-1.md"
					}
				}
			},
			{
				"provider": "teamshare",
				"root_type": "file",
				"root_ref": "third-id",
				"sync_mode": "manual",
				"targets": [
					{"target_type": "file", "target_ref": "third-id"}
				]
			}
		]
	}`, testKnowledgeBaseRPCOrgCode)

	resp, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.create", raw)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if _, ok := resp.(*dto.KnowledgeBaseResponse); !ok {
		t.Fatalf("expected *KnowledgeBaseResponse response, got %T", resp)
	}
	if appSvc.lastCreateInput == nil {
		t.Fatal("expected create input to be captured")
	}
	if appSvc.lastCreateInput.SourceType == nil || *appSvc.lastCreateInput.SourceType != 1 {
		t.Fatalf("expected source_type=1, got %#v", appSvc.lastCreateInput.SourceType)
	}
	if len(appSvc.lastCreateInput.SourceBindings) != 2 {
		t.Fatalf("expected 2 source bindings, got %d", len(appSvc.lastCreateInput.SourceBindings))
	}
	if appSvc.lastCreateInput.SourceBindings[0].Provider != "local_upload" || appSvc.lastCreateInput.SourceBindings[0].RootRef != "org/path/doc-1.md" {
		t.Fatalf("unexpected first source binding: %#v", appSvc.lastCreateInput.SourceBindings[0])
	}
	documentFile, _ := appSvc.lastCreateInput.SourceBindings[0].SyncConfig["document_file"].(map[string]any)
	if documentFile["url"] != "org/path/doc-1.md" {
		t.Fatalf("unexpected first source binding sync_config: %#v", appSvc.lastCreateInput.SourceBindings[0].SyncConfig)
	}
	if appSvc.lastCreateInput.SourceBindings[1].Provider != testRepairProvider || appSvc.lastCreateInput.SourceBindings[1].RootRef != "third-id" {
		t.Fatalf("unexpected second source binding: %#v", appSvc.lastCreateInput.SourceBindings[1])
	}
}

func TestKnowledgeBaseCreateRPC_AcceptsEmptyArraySyncConfig(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{
		createResp: &kbdto.KnowledgeBaseDTO{Code: "KNOWLEDGE-TEST"},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
	wrapped := jsonrpc.WrapTyped(rpcSvc.CreateRPC)

	raw := jsonRawMessagef(`{
		"data_isolation": {
			"organization_code": "%s",
			"user_id": "usi_test"
		},
		"name": "test",
		"source_type": 3,
		"source_bindings": [
			{
				"provider": "project",
				"root_type": "project",
				"root_ref": "project-1",
				"sync_mode": "manual",
				"sync_config": [],
				"targets": []
			}
		]
	}`, testKnowledgeBaseRPCOrgCode)

	resp, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.create", raw)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if _, ok := resp.(*dto.KnowledgeBaseResponse); !ok {
		t.Fatalf("expected *KnowledgeBaseResponse response, got %T", resp)
	}
	if appSvc.lastCreateInput == nil {
		t.Fatal("expected create input to be captured")
	}
	if len(appSvc.lastCreateInput.SourceBindings) != 1 {
		t.Fatalf("expected 1 source binding, got %d", len(appSvc.lastCreateInput.SourceBindings))
	}
	if appSvc.lastCreateInput.SourceBindings[0].SyncConfig == nil {
		t.Fatal("expected sync_config to be normalized to an empty map")
	}
	if len(appSvc.lastCreateInput.SourceBindings[0].SyncConfig) != 0 {
		t.Fatalf("expected empty sync_config, got %#v", appSvc.lastCreateInput.SourceBindings[0].SyncConfig)
	}
}

func TestKnowledgeBaseCreateRPCPreservesLargeNumericIDFields(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{
		createResp: &kbdto.KnowledgeBaseDTO{Code: "KNOWLEDGE-TEST"},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
	wrapped := jsonrpc.WrapTyped(rpcSvc.CreateRPC)

	raw := jsonRawMessagef(`{
		"data_isolation": {
			"organization_code": "%s",
			"user_id": "usi_test"
		},
		"name": "test",
		"source_type": 3,
		"document_files": [
			{
				"type": 2,
				"third_file_id": 904787325064802305,
				"knowledge_base_id": 904787325064802306,
				"project_file_id": 904787325064802307
			}
		],
		"source_bindings": [
			{
				"provider": "teamshare",
				"root_type": "knowledge_base",
				"root_ref": 904787325064802308,
				"sync_mode": "manual",
				"targets": [
					{"target_type": "file", "target_ref": 904787325064802309}
				],
				"sync_config": {
					"root_context": {"knowledge_base_id": 904787325064802310},
					"document_file": {
						"third_file_id": 904787325064802311,
						"knowledge_base_id": 904787325064802312,
						"project_file_id": 904787325064802313
					}
				}
			}
		]
	}`, testKnowledgeBaseRPCOrgCode)

	if _, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.create", raw); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if appSvc.lastCreateInput == nil {
		t.Fatal("expected create input to be captured")
	}
	if len(appSvc.lastCreateInput.LegacyDocumentFiles) != 1 {
		t.Fatalf("expected legacy document_files captured, got %#v", appSvc.lastCreateInput.LegacyDocumentFiles)
	}
	documentFile := map[string]any(appSvc.lastCreateInput.LegacyDocumentFiles[0])
	if documentFile["third_file_id"] != "904787325064802305" ||
		documentFile["knowledge_base_id"] != "904787325064802306" ||
		documentFile["project_file_id"] != "904787325064802307" {
		t.Fatalf("expected create legacy document file ids preserved, got %#v", documentFile)
	}
	if len(appSvc.lastCreateInput.SourceBindings) != 1 {
		t.Fatalf("expected source binding captured, got %#v", appSvc.lastCreateInput.SourceBindings)
	}
	binding := appSvc.lastCreateInput.SourceBindings[0]
	if binding.RootRef != "904787325064802308" {
		t.Fatalf("expected create root_ref preserved, got %#v", binding.RootRef)
	}
	if len(binding.Targets) != 1 || binding.Targets[0].TargetRef != "904787325064802309" {
		t.Fatalf("expected create target_ref preserved, got %#v", binding.Targets)
	}
	rootContext, _ := binding.SyncConfig["root_context"].(map[string]any)
	if rootContext["knowledge_base_id"] != "904787325064802310" {
		t.Fatalf("expected create root_context knowledge_base_id preserved, got %#v", binding.SyncConfig)
	}
	bindingDocumentFile, _ := binding.SyncConfig["document_file"].(map[string]any)
	if bindingDocumentFile["third_file_id"] != "904787325064802311" ||
		bindingDocumentFile["knowledge_base_id"] != "904787325064802312" ||
		bindingDocumentFile["project_file_id"] != "904787325064802313" {
		t.Fatalf("expected create sync_config document_file ids preserved, got %#v", bindingDocumentFile)
	}
}

func TestKnowledgeBaseCreateRPC_AcceptsQuotedEmptyOptionalConfigs(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{
		createResp: &kbdto.KnowledgeBaseDTO{Code: "KNOWLEDGE-TEST"},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
	wrapped := jsonrpc.WrapTyped(rpcSvc.CreateRPC)

	raw := jsonRawMessagef(`{
		"data_isolation": {
			"organization_code": "%s",
			"user_id": "usi_test"
		},
		"name": "test",
		"retrieve_config": "[]",
		"fragment_config": [],
		"embedding_config": ""
	}`, testKnowledgeBaseRPCOrgCode)

	resp, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.create", raw)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if _, ok := resp.(*dto.KnowledgeBaseResponse); !ok {
		t.Fatalf("expected *KnowledgeBaseResponse response, got %T", resp)
	}
	if appSvc.lastCreateInput == nil {
		t.Fatal("expected create input to be captured")
	}
	if appSvc.lastCreateInput.RetrieveConfig != nil || appSvc.lastCreateInput.FragmentConfig != nil || appSvc.lastCreateInput.EmbeddingConfig != nil {
		t.Fatalf("expected optional configs normalized to nil, got %#v", appSvc.lastCreateInput)
	}
}

func TestKnowledgeBaseUpdateRPCPreservesLargeNumericIDFields(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{
		updateResp: &kbdto.KnowledgeBaseDTO{Code: "KNOWLEDGE-TEST"},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
	wrapped := jsonrpc.WrapTyped(rpcSvc.UpdateRPC)

	raw := jsonRawMessagef(`{
		"data_isolation": {
			"organization_code": "%s",
			"user_id": "usi_test"
		},
		"code": "KB-1",
		"document_files": [
			{
				"type": 2,
				"third_file_id": 904787325064802305,
				"knowledge_base_id": 904787325064802306,
				"project_file_id": 904787325064802307
			}
		],
		"source_bindings": [
			{
				"provider": "teamshare",
				"root_type": "knowledge_base",
				"root_ref": 904787325064802308,
				"sync_mode": "manual",
				"targets": [
					{"target_type": "file", "target_ref": 904787325064802309}
				],
				"sync_config": {
					"root_context": {"knowledge_base_id": 904787325064802310},
					"document_file": {
						"third_file_id": 904787325064802311,
						"knowledge_base_id": 904787325064802312,
						"project_file_id": 904787325064802313
					}
				}
			}
		]
	}`, testKnowledgeBaseRPCOrgCode)

	if _, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.update", raw); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if appSvc.lastUpdateInput == nil {
		t.Fatal("expected update input to be captured")
	}
	if appSvc.lastUpdateInput.LegacyDocumentFiles == nil || len(*appSvc.lastUpdateInput.LegacyDocumentFiles) != 1 {
		t.Fatalf("expected update legacy document_files captured, got %#v", appSvc.lastUpdateInput.LegacyDocumentFiles)
	}
	documentFile := map[string]any((*appSvc.lastUpdateInput.LegacyDocumentFiles)[0])
	if documentFile["third_file_id"] != "904787325064802305" ||
		documentFile["knowledge_base_id"] != "904787325064802306" ||
		documentFile["project_file_id"] != "904787325064802307" {
		t.Fatalf("expected update legacy document file ids preserved, got %#v", documentFile)
	}
	if appSvc.lastUpdateInput.SourceBindings == nil || len(*appSvc.lastUpdateInput.SourceBindings) != 1 {
		t.Fatalf("expected update source binding captured, got %#v", appSvc.lastUpdateInput.SourceBindings)
	}
	binding := (*appSvc.lastUpdateInput.SourceBindings)[0]
	if binding.RootRef != "904787325064802308" {
		t.Fatalf("expected update root_ref preserved, got %#v", binding.RootRef)
	}
	if len(binding.Targets) != 1 || binding.Targets[0].TargetRef != "904787325064802309" {
		t.Fatalf("expected update target_ref preserved, got %#v", binding.Targets)
	}
	rootContext, _ := binding.SyncConfig["root_context"].(map[string]any)
	if rootContext["knowledge_base_id"] != "904787325064802310" {
		t.Fatalf("expected update root_context knowledge_base_id preserved, got %#v", binding.SyncConfig)
	}
	bindingDocumentFile, _ := binding.SyncConfig["document_file"].(map[string]any)
	if bindingDocumentFile["third_file_id"] != "904787325064802311" ||
		bindingDocumentFile["knowledge_base_id"] != "904787325064802312" ||
		bindingDocumentFile["project_file_id"] != "904787325064802313" {
		t.Fatalf("expected update sync_config document_file ids preserved, got %#v", bindingDocumentFile)
	}
}

func TestKnowledgeBaseListRPC_InvalidParamsReturnsInvalidParamsError(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
	wrapped := jsonrpc.WrapTyped(rpcSvc.ListRPC)

	_, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.queries", json.RawMessage(`{"data_isolation":`))
	if err == nil {
		t.Fatal("expected error")
	}

	var bizErr *jsonrpc.BusinessError
	if !errors.As(err, &bizErr) {
		t.Fatalf("expected *BusinessError, got %T", err)
	}
	if bizErr.Code != jsonrpc.ErrCodeInvalidParams {
		t.Fatalf("expected code=%d, got %d", jsonrpc.ErrCodeInvalidParams, bizErr.Code)
	}
}

func TestKnowledgeBaseUpdateRPCMapsInput(t *testing.T) {
	t.Parallel()

	sourceType := testSourceTypeProject
	appSvc := &fakeKnowledgeBaseAppService{
		updateResp: &kbdto.KnowledgeBaseDTO{
			Code:              "KB-1",
			SourceType:        &sourceType,
			UserOperation:     4,
			KnowledgeBaseType: testKnowledgeBaseTypeAgent,
		},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)

	resp, err := rpcSvc.UpdateRPC(context.Background(), &dto.UpdateKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: testKBOrgCode, UserID: testKBUserID},
		Code:          testKBCode,
		Name:          "知识库",
		Description:   "desc",
		Icon:          "book",
	})
	if err != nil {
		t.Fatalf("UpdateRPC returned error: %v", err)
	}
	if resp == nil || resp.Code != testKBCode {
		t.Fatalf("unexpected response: %#v", resp)
	}
	if appSvc.lastUpdateInput == nil || appSvc.lastUpdateInput.OrganizationCode != testKBOrgCode || appSvc.lastUpdateInput.UserID != testKBUserID {
		t.Fatalf("unexpected update input: %#v", appSvc.lastUpdateInput)
	}

	body := decodeKnowledgeBaseResponse(t, resp)
	assertJSONFieldAbsent(t, body, "user_operation")
	assertJSONIntField(t, body, "source_type", sourceType)
}

func TestKnowledgeBaseSaveProcessRPCMapsInput(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{
		saveProcessResp: &kbdto.KnowledgeBaseDTO{
			Code:              testKBCode,
			ExpectedNum:       10,
			CompletedNum:      3,
			UserOperation:     2,
			KnowledgeBaseType: testKnowledgeBaseTypeFlow,
		},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)

	resp, err := rpcSvc.SaveProcessRPC(context.Background(), &dto.SaveProcessKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: testKBOrgCode, UserID: testKBUserID},
		Code:          testKBCode,
		ExpectedNum:   10,
		CompletedNum:  3,
	})
	if err != nil {
		t.Fatalf("SaveProcessRPC returned error: %v", err)
	}
	if resp == nil || resp.Code != testKBCode || resp.CompletedNum != 3 {
		t.Fatalf("unexpected response: %#v", resp)
	}
	if appSvc.lastSaveProcessInput == nil || appSvc.lastSaveProcessInput.OrganizationCode != testKBOrgCode || appSvc.lastSaveProcessInput.CompletedNum != 3 {
		t.Fatalf("unexpected save process input: %#v", appSvc.lastSaveProcessInput)
	}

	body := decodeKnowledgeBaseResponse(t, resp)
	assertJSONIntField(t, body, "user_operation", 2)
	assertJSONIntField(t, body, "source_type", testSourceTypeLocalFile)
}

func TestKnowledgeBaseCreateRPCMapsInput(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{
		createResp: &kbdto.KnowledgeBaseDTO{
			Code:              "KB-1",
			UserOperation:     1,
			KnowledgeBaseType: testKnowledgeBaseTypeFlow,
		},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)

	resp, err := rpcSvc.CreateRPC(context.Background(), &dto.CreateKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: testKBOrgCode, UserID: testKBUserID},
		Code:          testKBCode,
		Name:          "知识库",
		Description:   "desc",
		Type:          1,
		Model:         "m1",
		VectorDB:      "qdrant",
		BusinessID:    "biz-1",
		Icon:          "book",
	})
	if err != nil {
		t.Fatalf("CreateRPC returned error: %v", err)
	}
	if resp == nil || resp.Code != testKBCode {
		t.Fatalf("unexpected response: %#v", resp)
	}
	if appSvc.lastCreateInput == nil || appSvc.lastCreateInput.OrganizationCode != testKBOrgCode || appSvc.lastCreateInput.BusinessID != "biz-1" {
		t.Fatalf("unexpected create input: %#v", appSvc.lastCreateInput)
	}

	body := decodeKnowledgeBaseResponse(t, resp)
	assertJSONIntField(t, body, "user_operation", 1)
	assertJSONIntField(t, body, "source_type", testSourceTypeLocalFile)
}

func TestKnowledgeBaseCreateAndUpdateRPCMapOptionalConfigs(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{
		createResp: &kbdto.KnowledgeBaseDTO{Code: testKBCode},
		updateResp: &kbdto.KnowledgeBaseDTO{Code: testKBCode},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
	retrieveConfig := &confighelper.RetrieveConfigDTO{TopK: 3}
	fragmentConfig := &confighelper.FragmentConfigDTO{
		Mode: testFragmentModeCustom,
		Normal: &confighelper.NormalFragmentConfigDTO{
			SegmentRule: &confighelper.SegmentRuleDTO{
				Separator:    "\n\n",
				ChunkSize:    500,
				ChunkOverlap: 50,
			},
		},
	}

	if _, err := rpcSvc.CreateRPC(context.Background(), &dto.CreateKnowledgeBaseRequest{
		DataIsolation:  dto.DataIsolation{OrganizationCode: testKBOrgCode, UserID: testKBUserID},
		Code:           testKBCode,
		Name:           "知识库",
		RetrieveConfig: retrieveConfig,
		FragmentConfig: fragmentConfig,
	}); err != nil {
		t.Fatalf("create rpc: %v", err)
	}
	if appSvc.lastCreateInput == nil || appSvc.lastCreateInput.RetrieveConfig != retrieveConfig || appSvc.lastCreateInput.FragmentConfig != fragmentConfig {
		t.Fatalf("unexpected create optional configs: %#v", appSvc.lastCreateInput)
	}

	if _, err := rpcSvc.UpdateRPC(context.Background(), &dto.UpdateKnowledgeBaseRequest{
		DataIsolation:  dto.DataIsolation{OrganizationCode: testKBOrgCode, UserID: testKBUserID},
		Code:           testKBCode,
		RetrieveConfig: retrieveConfig,
		FragmentConfig: fragmentConfig,
	}); err != nil {
		t.Fatalf("update rpc: %v", err)
	}
	if appSvc.lastUpdateInput == nil || appSvc.lastUpdateInput.RetrieveConfig != retrieveConfig || appSvc.lastUpdateInput.FragmentConfig != fragmentConfig {
		t.Fatalf("unexpected update optional configs: %#v", appSvc.lastUpdateInput)
	}
}

func TestKnowledgeBaseRPCMapsAppErrors(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{
		createErr: errKnowledgeBaseRPCBoom,
		updateErr: errKnowledgeBaseRPCBoom,
		listErr:   errKnowledgeBaseRPCBoom,
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)

	if _, err := rpcSvc.CreateRPC(context.Background(), &dto.CreateKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: testKBOrgCode, UserID: testKBUserID},
		Name:          "知识库",
	}); err == nil {
		t.Fatal("expected create error")
	}
	if _, err := rpcSvc.UpdateRPC(context.Background(), &dto.UpdateKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: testKBOrgCode, UserID: testKBUserID},
		Code:          testKBCode,
	}); err == nil {
		t.Fatal("expected update error")
	}
	if _, err := rpcSvc.ListRPC(context.Background(), &dto.ListKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: testKBOrgCode, UserID: testKBUserID},
	}); err == nil {
		t.Fatal("expected list error")
	}
}

func TestKnowledgeBaseListRPCTypeFilterAndError(t *testing.T) {
	t.Parallel()

	typeFilter := 2
	appSvc := &fakeKnowledgeBaseAppService{listErr: errKnowledgeBaseRPCBoom}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)

	_, err := rpcSvc.ListRPC(context.Background(), &dto.ListKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: testKBOrgCode, UserID: testKBUserID},
		Type:          &typeFilter,
	})
	if err == nil {
		t.Fatal("expected list error")
	}
	if appSvc.lastListInput == nil || appSvc.lastListInput.Type == nil || *appSvc.lastListInput.Type != typeFilter {
		t.Fatalf("unexpected type filter mapping: %#v", appSvc.lastListInput)
	}
}

func TestKnowledgeBaseListRPCMapsAgentCodes(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)

	_, err := rpcSvc.ListRPC(context.Background(), &dto.ListKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: testKBOrgCode, UserID: testKBUserID},
		AgentCodes:    []string{"SMA-1"},
	})
	if err != nil {
		t.Fatalf("ListRPC returned error: %v", err)
	}
	if appSvc.lastListInput == nil || len(appSvc.lastListInput.AgentCodes) != 1 || appSvc.lastListInput.AgentCodes[0] != "SMA-1" {
		t.Fatalf("unexpected agent_codes mapping: %#v", appSvc.lastListInput)
	}
}

func TestKnowledgeBaseRPCCompatAgentCode(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{
		createResp: &kbdto.KnowledgeBaseDTO{Code: testKBCode},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)

	create := jsonrpc.WrapTyped(rpcSvc.CreateRPC)
	if _, err := create(context.Background(), "svc.knowledge.knowledgeBase.create", jsonRawMessagef(`{
		"data_isolation": {"organization_code": "ORG-1", "user_id": "user-1"},
		"name": "知识库",
		"agent_code": "%s"
	}`, testLegacyAgentCode)); err != nil {
		t.Fatalf("create rpc: %v", err)
	}
	requireAgentCodes(t, appSvc.lastCreateInput.AgentCodes, testLegacyAgentCode)

	list := jsonrpc.WrapTyped(rpcSvc.ListRPC)
	if _, err := list(context.Background(), "svc.knowledge.knowledgeBase.queries", jsonRawMessagef(`{
		"data_isolation": {"organization_code": "ORG-1", "user_id": "user-1"},
		"agent_code": "%s",
		"offset": 0,
		"limit": 10
	}`, testLegacyAgentCode)); err != nil {
		t.Fatalf("list rpc: %v", err)
	}
	requireAgentCodes(t, appSvc.lastListInput.AgentCodes, testLegacyAgentCode)
}

func TestKnowledgeBaseRPCIgnoresAgentScopeFields(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{
		updateResp: &kbdto.KnowledgeBaseDTO{Code: testKBCode},
		showResp:   &kbdto.KnowledgeBaseDTO{Code: testKBCode},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)
	update := jsonrpc.WrapTyped(rpcSvc.UpdateRPC)
	if _, err := update(context.Background(), "svc.knowledge.knowledgeBase.update", jsonRawMessagef(`{
		"data_isolation": {"organization_code": "ORG-1", "user_id": "user-1"},
		"code": "KB-1",
		"agent_code": "%s"
	}`, testLegacyAgentCode)); err != nil {
		t.Fatalf("expected update to ignore agent_code, got %v", err)
	}

	show := jsonrpc.WrapTyped(rpcSvc.ShowRPC)
	if _, err := show(context.Background(), "svc.knowledge.knowledgeBase.show", jsonRawMessagef(`{
		"data_isolation": {"organization_code": "ORG-1", "user_id": "user-1"},
		"code": "KB-1",
		"agent_code": "%s"
	}`, testLegacyAgentCode)); err != nil {
		t.Fatalf("expected show to ignore agent_code, got %v", err)
	}

	destroy := jsonrpc.WrapTyped(rpcSvc.DestroyRPC)
	if _, err := destroy(context.Background(), "svc.knowledge.knowledgeBase.destroy", jsonRawMessagef(`{
		"data_isolation": {"organization_code": "ORG-1", "user_id": "user-1"},
		"code": "KB-1",
		"agent_code": "%s"
	}`, testLegacyAgentCode)); err != nil {
		t.Fatalf("expected destroy to ignore agent_code, got %v", err)
	}
}

func TestKnowledgeBaseDestroyRPC(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)

	resp, err := rpcSvc.DestroyRPC(context.Background(), &dto.DestroyKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: "ORG-1", UserID: "user-1"},
		Code:          "KB-1",
	})
	if err != nil {
		t.Fatalf("DestroyRPC returned error: %v", err)
	}
	if resp == nil || !(*resp)["success"] {
		t.Fatalf("unexpected destroy response: %#v", resp)
	}
	if appSvc.lastDestroyCode != "KB-1" || appSvc.lastDestroyOrg != "ORG-1" {
		t.Fatalf(
			"unexpected destroy args: code=%q org=%q",
			appSvc.lastDestroyCode,
			appSvc.lastDestroyOrg,
		)
	}
}

func TestKnowledgeBaseShowRPC(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{
		showResp: &kbdto.KnowledgeBaseDTO{
			Code:              testKBCode,
			UserOperation:     4,
			KnowledgeBaseType: testKnowledgeBaseTypeFlow,
		},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)

	resp, err := rpcSvc.ShowRPC(context.Background(), &dto.ShowKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: testKBOrgCode, UserID: testKBUserID},
		Code:          testKBCode,
	})
	if err != nil {
		t.Fatalf("ShowRPC returned error: %v", err)
	}
	if appSvc.lastShowCode != testKBCode || appSvc.lastShowOrg != testKBOrgCode {
		t.Fatalf("unexpected show agent_codes mapping: %#v", appSvc)
	}

	body := decodeKnowledgeBaseResponse(t, resp)
	assertJSONIntField(t, body, "user_operation", 4)
	assertJSONIntField(t, body, "source_type", testSourceTypeLocalFile)
}

func TestKnowledgeBaseShowRPCProjectsDigitalEmployeeFields(t *testing.T) {
	t.Parallel()

	sourceType := testSourceTypeProject
	appSvc := &fakeKnowledgeBaseAppService{
		showResp: &kbdto.KnowledgeBaseDTO{
			Code:              testKBCode,
			SourceType:        &sourceType,
			UserOperation:     2,
			KnowledgeBaseType: testKnowledgeBaseTypeAgent,
		},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)

	resp, err := rpcSvc.ShowRPC(context.Background(), &dto.ShowKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: testKBOrgCode, UserID: testKBUserID},
		Code:          testKBCode,
	})
	if err != nil {
		t.Fatalf("ShowRPC returned error: %v", err)
	}

	body := decodeKnowledgeBaseResponse(t, resp)
	assertJSONFieldAbsent(t, body, "user_operation")
	assertJSONIntField(t, body, "source_type", sourceType)
}

func TestKnowledgeBaseDestroyRPCMapsBusinessError(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{
		destroyErr: fmt.Errorf("failed to destroy knowledge base: %w", kbapp.ErrKnowledgeBaseNotFound),
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)

	_, err := rpcSvc.DestroyRPC(context.Background(), &dto.DestroyKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: "ORG-1", UserID: "user-1"},
		Code:          "KB-404",
	})
	if err == nil {
		t.Fatal("expected error")
	}
	var bizErr *jsonrpc.BusinessError
	if !errors.As(err, &bizErr) {
		t.Fatalf("expected business error, got %T", err)
	}
	if bizErr.Code != jsonrpc.ErrCodeKnowledgeBaseNotFound {
		t.Fatalf("expected not found code, got %d", bizErr.Code)
	}
}

func TestKnowledgeBaseTeamshareStartVectorRPC(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{
		teamshareStart: &revectorizeshared.TeamshareStartResult{KnowledgeCode: "KB-teamshare-1"},
	}
	trigger := &fakeRebuildTrigger{}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, trigger)

	resp, err := rpcSvc.TeamshareStartVectorRPC(context.Background(), &dto.TeamshareStartVectorRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: testKnowledgeBaseRPCOrgCode, UserID: testKBUserID},
		KnowledgeID:   "TS-KB-1",
	})
	if err != nil {
		t.Fatalf("TeamshareStartVectorRPC returned error: %v", err)
	}
	if resp == nil || resp.ID != "KB-teamshare-1" {
		t.Fatalf("unexpected response: %#v", resp)
	}
	if appSvc.lastTeamshareStart == nil ||
		appSvc.lastTeamshareStart.OrganizationCode != testKnowledgeBaseRPCOrgCode ||
		appSvc.lastTeamshareStart.UserID != testKBUserID ||
		appSvc.lastTeamshareStart.KnowledgeID != "TS-KB-1" {
		t.Fatalf("unexpected teamshare start input: %#v", appSvc.lastTeamshareStart)
	}
	if trigger.lastOpts != nil || trigger.lastBusinessParams != nil {
		t.Fatalf("expected teamshare start-vector not to trigger rebuild, got opts=%#v business=%#v", trigger.lastOpts, trigger.lastBusinessParams)
	}
}

func TestKnowledgeBaseTeamshareManageableRPC(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{
		teamshareList: []*kbdto.TeamshareKnowledgeProgressDTO{{
			KnowledgeCode: "KNOWLEDGE-1",
			KnowledgeType: 2,
			BusinessID:    "TS-KB-1",
			Name:          "知识库 1",
			Description:   "desc",
			VectorStatus:  1,
			ExpectedNum:   10,
			CompletedNum:  3,
		}},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)

	resp, err := rpcSvc.TeamshareManageableRPC(context.Background(), &dto.TeamshareManageableRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: testKnowledgeBaseRPCOrgCode, UserID: testKBUserID},
	})
	if err != nil {
		t.Fatalf("TeamshareManageableRPC returned error: %v", err)
	}
	if appSvc.lastTeamshareList == nil ||
		appSvc.lastTeamshareList.OrganizationCode != testKnowledgeBaseRPCOrgCode ||
		appSvc.lastTeamshareList.UserID != testKBUserID {
		t.Fatalf("unexpected teamshare manageable input: %#v", appSvc.lastTeamshareList)
	}
	if resp == nil || len(resp.List) != 1 || resp.List[0].KnowledgeCode != "KNOWLEDGE-1" {
		t.Fatalf("unexpected response: %#v", resp)
	}
}

func TestKnowledgeBaseTeamshareManageableProgressRPC(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{
		teamshareProg: []*kbdto.TeamshareKnowledgeProgressDTO{{
			KnowledgeCode: "KNOWLEDGE-TEMP",
			KnowledgeType: 2,
			BusinessID:    "TS-KB-1",
			VectorStatus:  2,
			ExpectedNum:   10,
			CompletedNum:  10,
		}},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, nil)

	resp, err := rpcSvc.TeamshareManageableProgressRPC(context.Background(), &dto.TeamshareManageableProgressRequest{
		DataIsolation:  dto.DataIsolation{OrganizationCode: testKnowledgeBaseRPCOrgCode, UserID: testKBUserID},
		KnowledgeCodes: []string{"KNOWLEDGE-TEMP"},
	})
	if err != nil {
		t.Fatalf("TeamshareManageableProgressRPC returned error: %v", err)
	}
	if appSvc.lastTeamshareProg == nil ||
		!reflect.DeepEqual(appSvc.lastTeamshareProg.KnowledgeCodes, []string{"KNOWLEDGE-TEMP"}) {
		t.Fatalf("unexpected teamshare manageable progress input: %#v", appSvc.lastTeamshareProg)
	}
	if resp == nil || len(resp.List) != 1 || resp.List[0].VectorStatus != 2 {
		t.Fatalf("unexpected response: %#v", resp)
	}
}

func TestKnowledgeBaseRebuildRPCRequiresTrigger(t *testing.T) {
	t.Parallel()

	rpcSvc := knowledgeService.NewKnowledgeBaseRPCService(&fakeKnowledgeBaseAppService{}, nil, nil, logging.New())

	_, err := rpcSvc.RebuildRPC(context.Background(), &dto.RebuildKnowledgeBaseRequest{})
	if err == nil {
		t.Fatal("expected rebuild init error")
	}
}

func TestKnowledgeBaseRebuildRPCMapsTriggerError(t *testing.T) {
	t.Parallel()

	trigger := &fakeRebuildTrigger{err: errKnowledgeBaseRPCBoom}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(&fakeKnowledgeBaseAppService{}, trigger)
	_, err := rpcSvc.RebuildRPC(context.Background(), &dto.RebuildKnowledgeBaseRequest{
		Scope:            string(rebuilddto.ScopeModeAll),
		OrganizationCode: testKBOrgCode,
	})
	if err == nil {
		t.Fatal("expected rebuild trigger error")
	}
}

func TestNewKnowledgeBaseRPCServiceFromConcrete(t *testing.T) {
	t.Parallel()

	if svc := knowledgeService.NewKnowledgeBaseRPCServiceFromConcrete(nil, nil, nil, nil); svc == nil {
		t.Fatal("expected constructor result not nil")
	}
}

func TestKnowledgeBaseRebuildRPCTriggeredAllScope(t *testing.T) {
	t.Parallel()
	appSvc := &fakeKnowledgeBaseAppService{}
	trigger := &fakeRebuildTrigger{
		resp: &apprebuild.TriggerResult{Status: apprebuild.TriggerStatusTriggered, RunID: "r-triggered"},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, trigger)
	wrapped := jsonrpc.WrapTyped(rpcSvc.RebuildRPC)

	raw := jsonRawMessagef(`{
		"data_isolation": {
			"organization_code": "%s",
			"user_id": "usi_test"
		}
	}`, testKnowledgeBaseRPCOrgCode)
	reqCtx := ctxmeta.WithRequestID(context.Background(), "req-rebuild-rpc-1")
	resp, err := wrapped(reqCtx, "svc.knowledge.knowledgeBase.rebuild", raw)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	result, ok := resp.(*dto.RebuildKnowledgeBaseResponse)
	if !ok {
		t.Fatalf("expected *RebuildKnowledgeBaseResponse, got %T", resp)
	}
	if result.Status != testRebuildTriggeredStatus || result.RunID == "" {
		t.Fatalf("unexpected response: %#v", result)
	}
	if result.Scope != string(rebuilddto.ScopeModeAll) {
		t.Fatalf("expected scope=all, got %s", result.Scope)
	}
	if result.RequestedMode != string(rebuilddto.ModeAuto) {
		t.Fatalf("expected mode=auto, got %s", result.RequestedMode)
	}
	if result.TargetModel != "" {
		t.Fatalf("expected empty target model when request omits it, got %q", result.TargetModel)
	}
	waitAsyncCall(t, appSvc.prepareCalled, "knowledge rebuild prepare")
	waitAsyncCall(t, trigger.called, "knowledge rebuild trigger")
	if trigger.lastOpts == nil || trigger.lastOpts.Scope.Mode != rebuilddto.ScopeModeAll {
		t.Fatalf("unexpected trigger opts: %#v", trigger.lastOpts)
	}
	if result.RunID != "r-triggered" {
		t.Fatalf("expected trigger run_id to be returned, got %q", result.RunID)
	}
	if trigger.lastOpts.ResumeRunID == "" {
		t.Fatal("expected generated resume run_id to be forwarded to trigger")
	}
	if appSvc.lastPrepareOrg != testKnowledgeBaseRPCOrgCode || appSvc.lastPrepareScope.Mode != kbapp.RebuildScopeModeAll {
		t.Fatalf("unexpected prepare input: org=%q scope=%#v", appSvc.lastPrepareOrg, appSvc.lastPrepareScope)
	}
	if appSvc.lastPrepareRequestID != "req-rebuild-rpc-1" {
		t.Fatalf("expected prepare request_id to be copied to background context, got %q", appSvc.lastPrepareRequestID)
	}
	if trigger.lastRequestID != "req-rebuild-rpc-1" {
		t.Fatalf("expected trigger request_id to be copied to background context, got %q", trigger.lastRequestID)
	}
}

func TestKnowledgeBaseRebuildRPCOrganizationScopeMapping(t *testing.T) {
	t.Parallel()
	appSvc := &fakeKnowledgeBaseAppService{}
	trigger := &fakeRebuildTrigger{
		resp: &apprebuild.TriggerResult{Status: apprebuild.TriggerStatusTriggered, RunID: "r-org"},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, trigger)
	wrapped := jsonrpc.WrapTyped(rpcSvc.RebuildRPC)

	raw := jsonRawMessagef(`{
			"data_isolation": {
				"organization_code": "%s",
				"user_id": "usi_test"
			},
			"scope": "organization",
			"knowledge_organization_code": "ORG900",
			"mode": "bluegreen",
			"target_model": "text-embedding-3-large",
			"target_dimension": 3072,
		"concurrency": 4,
		"batch_size": 128,
		"retry": 2
	}`, testKnowledgeBaseRPCOrgCode)
	resp, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.rebuild", raw)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	result, ok := resp.(*dto.RebuildKnowledgeBaseResponse)
	if !ok {
		t.Fatalf("expected *RebuildKnowledgeBaseResponse, got %T", resp)
	}
	if result.Scope != string(rebuilddto.ScopeModeOrganization) {
		t.Fatalf("expected scope=organization, got %s", result.Scope)
	}
	if result.Status != testRebuildTriggeredStatus || result.RunID == "" {
		t.Fatalf("unexpected async rebuild response: %#v", result)
	}
	waitAsyncCall(t, appSvc.prepareCalled, "knowledge rebuild prepare")
	waitAsyncCall(t, trigger.called, "knowledge rebuild trigger")
	if trigger.lastOpts == nil {
		t.Fatal("expected trigger opts captured")
	}
	if trigger.lastOpts.Scope.Mode != rebuilddto.ScopeModeOrganization || trigger.lastOpts.Scope.OrganizationCode != testRebuildOrgCode {
		t.Fatalf("unexpected scope mapping: %#v", trigger.lastOpts.Scope)
	}
	if trigger.lastOpts.Mode != rebuilddto.ModeBlueGreen || trigger.lastOpts.TargetDimension != 3072 {
		t.Fatalf("unexpected mode or dimension mapping: %#v", trigger.lastOpts)
	}
	if trigger.lastBusinessParams == nil {
		t.Fatal("expected business params passed through context")
	}
	if trigger.lastBusinessParams.OrganizationCode != testKnowledgeBaseRPCOrgCode || trigger.lastBusinessParams.UserID != "usi_test" || trigger.lastBusinessParams.BusinessID != "" {
		t.Fatalf("unexpected rebuild business params: %#v", trigger.lastBusinessParams)
	}
	if appSvc.lastPrepareOrg != testKnowledgeBaseRPCOrgCode || appSvc.lastPrepareScope.Mode != kbapp.RebuildScopeModeOrganization {
		t.Fatalf("unexpected prepare scope mapping: org=%q scope=%#v", appSvc.lastPrepareOrg, appSvc.lastPrepareScope)
	}
}

func TestKnowledgeBaseRebuildRPCDocumentScopeMapping(t *testing.T) {
	t.Parallel()
	assertRebuildScopeMapping(t, "document", rebuilddto.ScopeModeDocument, testRebuildOrgCode, testRebuildKBCode, testRebuildDocCode)
}

func TestKnowledgeBaseRebuildRPCKnowledgeBaseScopeMapping(t *testing.T) {
	t.Parallel()
	assertRebuildScopeMapping(t, "knowledge_base", rebuilddto.ScopeModeKnowledgeBase, testRebuildOrgCode, testRebuildKBCode, "")
}

func TestKnowledgeBaseRebuildRPCInjectsKnowledgeBaseBusinessIDIntoContext(t *testing.T) {
	t.Parallel()

	appSvc := &fakeKnowledgeBaseAppService{}
	trigger := &fakeRebuildTrigger{
		resp: &apprebuild.TriggerResult{Status: apprebuild.TriggerStatusTriggered, RunID: "r-kb"},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, trigger)
	wrapped := jsonrpc.WrapTyped(rpcSvc.RebuildRPC)

	raw := jsonRawMessagef(`{
		"data_isolation": {
			"organization_code": "%s",
			"user_id": "usi_test"
		},
		"scope": "knowledge_base",
		"knowledge_organization_code": %q,
		"knowledge_base_code": %q
	}`, testKnowledgeBaseRPCOrgCode, testRebuildOrgCode, testRebuildKBCode)
	if _, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.rebuild", raw); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	waitAsyncCall(t, appSvc.prepareCalled, "knowledge rebuild prepare")
	waitAsyncCall(t, trigger.called, "knowledge rebuild trigger")
	if trigger.lastBusinessParams == nil {
		t.Fatal("expected business params passed through context")
	}
	if trigger.lastBusinessParams.OrganizationCode != testKnowledgeBaseRPCOrgCode || trigger.lastBusinessParams.UserID != "usi_test" || trigger.lastBusinessParams.BusinessID != testRebuildKBCode {
		t.Fatalf("unexpected rebuild business params: %#v", trigger.lastBusinessParams)
	}
}

func assertRebuildScopeMapping(
	t *testing.T,
	scopeLiteral string,
	expectedMode rebuilddto.ScopeMode,
	orgCode string,
	knowledgeBaseCode string,
	documentCode string,
) {
	t.Helper()

	appSvc := &fakeKnowledgeBaseAppService{}
	trigger := &fakeRebuildTrigger{
		resp: &apprebuild.TriggerResult{Status: apprebuild.TriggerStatusTriggered, RunID: "r-scope"},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, trigger)
	wrapped := jsonrpc.WrapTyped(rpcSvc.RebuildRPC)

	raw := jsonRawMessagef(`{
		"data_isolation": {
			"organization_code": "%s",
			"user_id": "usi_test"
		},
		"scope": %q,
		"knowledge_organization_code": %q,
		"knowledge_base_code": %q,
		"document_code": %q,
		"mode": "bluegreen"
	}`, testKnowledgeBaseRPCOrgCode, scopeLiteral, orgCode, knowledgeBaseCode, documentCode)
	resp, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.rebuild", raw)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	result, ok := resp.(*dto.RebuildKnowledgeBaseResponse)
	if !ok {
		t.Fatalf("expected *RebuildKnowledgeBaseResponse, got %T", resp)
	}
	if result.Scope != string(expectedMode) {
		t.Fatalf("expected scope=%s, got %s", expectedMode, result.Scope)
	}
	if result.Status != testRebuildTriggeredStatus || result.RunID == "" {
		t.Fatalf("unexpected async rebuild response: %#v", result)
	}
	waitAsyncCall(t, appSvc.prepareCalled, "knowledge rebuild prepare")
	waitAsyncCall(t, trigger.called, "knowledge rebuild trigger")
	if trigger.lastOpts == nil {
		t.Fatal("expected trigger opts captured")
	}
	if trigger.lastOpts.Scope.Mode != expectedMode {
		t.Fatalf("unexpected scope mode: %#v", trigger.lastOpts.Scope)
	}
	if trigger.lastOpts.Scope.OrganizationCode != orgCode ||
		trigger.lastOpts.Scope.KnowledgeBaseCode != knowledgeBaseCode ||
		trigger.lastOpts.Scope.DocumentCode != documentCode {
		t.Fatalf("unexpected scope mapping: %#v", trigger.lastOpts.Scope)
	}
	if result.RunID != "r-scope" {
		t.Fatalf("expected trigger run_id to be returned, got %q", result.RunID)
	}
	if trigger.lastOpts.ResumeRunID == "" {
		t.Fatal("expected generated resume run_id to be forwarded to trigger")
	}
}

func TestKnowledgeBaseRebuildRPCAlreadyRunning(t *testing.T) {
	t.Parallel()
	appSvc := &fakeKnowledgeBaseAppService{}
	trigger := &fakeRebuildTrigger{
		resp: &apprebuild.TriggerResult{Status: apprebuild.TriggerStatusAlreadyRunning, RunID: "r-running"},
	}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, trigger)
	wrapped := jsonrpc.WrapTyped(rpcSvc.RebuildRPC)

	raw := jsonRawMessagef(`{
		"data_isolation": {
			"organization_code": "%s",
			"user_id": "usi_test"
		}
	}`, testKnowledgeBaseRPCOrgCode)
	resp, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.rebuild", raw)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	result, ok := resp.(*dto.RebuildKnowledgeBaseResponse)
	if !ok {
		t.Fatalf("expected *RebuildKnowledgeBaseResponse, got %T", resp)
	}
	if result.Status != string(apprebuild.TriggerStatusAlreadyRunning) || result.RunID == "" {
		t.Fatalf("unexpected response: %#v", result)
	}
	waitAsyncCall(t, appSvc.prepareCalled, "knowledge rebuild prepare")
	waitAsyncCall(t, trigger.called, "knowledge rebuild trigger")
}

func TestKnowledgeBaseRebuildRPCInvalidOrganizationScopeReturnsInvalidParams(t *testing.T) {
	t.Parallel()
	appSvc := &fakeKnowledgeBaseAppService{}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, &fakeRebuildTrigger{})
	wrapped := jsonrpc.WrapTyped(rpcSvc.RebuildRPC)

	_, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.rebuild", jsonRawMessagef(`{
		"data_isolation": {
			"organization_code": "%s",
			"user_id": "usi_test"
		},
		"scope": "organization"
	}`, testKnowledgeBaseRPCOrgCode))
	if err == nil {
		t.Fatal("expected error")
	}

	var bizErr *jsonrpc.BusinessError
	if !errors.As(err, &bizErr) {
		t.Fatalf("expected *BusinessError, got %T", err)
	}
	if bizErr.Code != jsonrpc.ErrCodeInvalidParams {
		t.Fatalf("expected code=%d, got %d", jsonrpc.ErrCodeInvalidParams, bizErr.Code)
	}
}

func TestKnowledgeBaseRebuildRPCInvalidDocumentScopeReturnsInvalidParams(t *testing.T) {
	t.Parallel()
	appSvc := &fakeKnowledgeBaseAppService{}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, &fakeRebuildTrigger{})
	wrapped := jsonrpc.WrapTyped(rpcSvc.RebuildRPC)

	_, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.rebuild", jsonRawMessagef(`{
			"data_isolation": {
				"organization_code": "%s",
				"user_id": "usi_test"
			},
			"scope": "document",
			"knowledge_organization_code": "ORG900",
			"knowledge_base_code": "KB001"
		}`, testKnowledgeBaseRPCOrgCode))
	if err == nil {
		t.Fatal("expected error")
	}

	var bizErr *jsonrpc.BusinessError
	if !errors.As(err, &bizErr) {
		t.Fatalf("expected *BusinessError, got %T", err)
	}
	if bizErr.Code != jsonrpc.ErrCodeInvalidParams {
		t.Fatalf("expected code=%d, got %d", jsonrpc.ErrCodeInvalidParams, bizErr.Code)
	}
}

func TestKnowledgeBaseRebuildRPCInvalidKnowledgeBaseScopeReturnsInvalidParams(t *testing.T) {
	t.Parallel()
	appSvc := &fakeKnowledgeBaseAppService{}
	rpcSvc := buildKnowledgeBaseRPCServiceForTest(appSvc, &fakeRebuildTrigger{})
	wrapped := jsonrpc.WrapTyped(rpcSvc.RebuildRPC)

	_, err := wrapped(context.Background(), "svc.knowledge.knowledgeBase.rebuild", jsonRawMessagef(`{
			"data_isolation": {
				"organization_code": "%s",
				"user_id": "usi_test"
			},
			"scope": "knowledge_base",
			"knowledge_organization_code": "ORG900"
		}`, testKnowledgeBaseRPCOrgCode))
	if err == nil {
		t.Fatal("expected error")
	}

	var bizErr *jsonrpc.BusinessError
	if !errors.As(err, &bizErr) {
		t.Fatalf("expected *BusinessError, got %T", err)
	}
	if bizErr.Code != jsonrpc.ErrCodeInvalidParams {
		t.Fatalf("expected code=%d, got %d", jsonrpc.ErrCodeInvalidParams, bizErr.Code)
	}
}

func assertKnowledgeBaseListContractCompat(t *testing.T, page *dto.KnowledgeBasePageResponse) {
	t.Helper()

	item := decodeSingleListItem(t, page)
	assertCreatorModifierFields(t, item)
	assertFragmentConfigContract(t, item)
	assertKnowledgeBaseBindingFields(t, item)
}

func decodeSingleListItem(t *testing.T, page *dto.KnowledgeBasePageResponse) map[string]any {
	t.Helper()

	body, err := json.Marshal(page)
	if err != nil {
		t.Fatalf("marshal page result failed: %v", err)
	}

	var parsed map[string]any
	if err := json.Unmarshal(body, &parsed); err != nil {
		t.Fatalf("unmarshal page result failed: %v", err)
	}

	listAny, ok := parsed["list"].([]any)
	if !ok || len(listAny) != 1 {
		t.Fatalf("expected single list item, got %#v", parsed["list"])
	}
	item, ok := listAny[0].(map[string]any)
	if !ok {
		t.Fatalf("list item is not object: %#v", listAny[0])
	}
	return item
}

func decodeKnowledgeBaseResponse(t *testing.T, resp *dto.KnowledgeBaseResponse) map[string]any {
	t.Helper()

	body, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal knowledge base response failed: %v", err)
	}

	var parsed map[string]any
	if err := json.Unmarshal(body, &parsed); err != nil {
		t.Fatalf("unmarshal knowledge base response failed: %v", err)
	}

	return parsed
}

func assertJSONIntField(t *testing.T, body map[string]any, key string, expected int) {
	t.Helper()

	value, ok := body[key].(float64)
	if !ok || int(value) != expected {
		t.Fatalf("expected %s=%d, got %#v", key, expected, body[key])
	}
}

func assertJSONStringField(t *testing.T, body map[string]any, key, expected string) {
	t.Helper()

	value, ok := body[key].(string)
	if !ok || value != expected {
		t.Fatalf("expected %s=%q, got %#v", key, expected, body[key])
	}
}

func assertJSONFieldAbsent(t *testing.T, body map[string]any, key string) {
	t.Helper()

	if _, exists := body[key]; exists {
		t.Fatalf("expected %s omitted, got %#v", key, body[key])
	}
}

func assertCreatorModifierFields(t *testing.T, item map[string]any) {
	t.Helper()

	if item["creator"] != testCreatorID || item["modifier"] != testModifierID {
		t.Fatalf("unexpected creator/modifier: %#v", item)
	}
	if item["created_uid"] != testCreatorID || item["updated_uid"] != testModifierID {
		t.Fatalf("unexpected created_uid/updated_uid: %#v", item)
	}
}

func assertFragmentConfigContract(t *testing.T, item map[string]any) {
	t.Helper()

	fragmentConfig, ok := item["fragment_config"].(map[string]any)
	if !ok {
		t.Fatalf("fragment_config not found: %#v", item)
	}
	if _, exists := fragmentConfig["parent_child"]; exists {
		t.Fatalf("expected parent_child omitted: %#v", fragmentConfig)
	}
	if got, ok := fragmentConfig["mode"].(float64); !ok || int(got) != testFragmentModeCustom {
		t.Fatalf("expected custom mode: %#v", fragmentConfig)
	}
	normal, ok := fragmentConfig["normal"].(map[string]any)
	if !ok {
		t.Fatalf("normal not found: %#v", fragmentConfig)
	}
	segmentRule, ok := normal["segment_rule"].(map[string]any)
	if !ok {
		t.Fatalf("segment_rule not found: %#v", normal)
	}
	if val, exists := segmentRule["chunk_overlap"]; !exists || val != float64(0) {
		t.Fatalf("expected chunk_overlap=0 kept in response, got %#v", val)
	}
	if val, exists := segmentRule["chunk_overlap_unit"]; !exists || val != "absolute" {
		t.Fatalf("expected chunk_overlap_unit=absolute kept in response, got %#v", val)
	}
}

func assertKnowledgeBaseBindingFields(t *testing.T, item map[string]any) {
	t.Helper()

	agentIDs, ok := item["agent_codes"].([]any)
	if !ok || len(agentIDs) != 2 || agentIDs[0] != "1001" || agentIDs[1] != "1002" {
		t.Fatalf("unexpected agent_codes: %#v", item)
	}
}

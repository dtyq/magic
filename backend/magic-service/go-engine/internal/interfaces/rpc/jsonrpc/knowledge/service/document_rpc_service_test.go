package service_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	docdto "magic/internal/application/knowledge/document/dto"
	documentapp "magic/internal/application/knowledge/document/service"
	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	pagehelper "magic/internal/application/knowledge/helper/page"
	"magic/internal/infrastructure/logging"
	"magic/internal/interfaces/rpc/jsonrpc/knowledge/dto"
	knowledgesvc "magic/internal/interfaces/rpc/jsonrpc/knowledge/service"
	"magic/internal/pkg/ctxmeta"
	jsonrpc "magic/internal/pkg/jsonrpc"
)

var (
	errBucketNotFound  = errors.New("bucket not found")
	errDocumentRPCBoom = errors.New("document rpc boom")
	errDocumentRPCStub = errors.New("document rpc stub error")
)

const (
	testDocumentKBCode       = "KB1"
	testDocumentCode         = "DOC1"
	testDocumentOrgCode      = "ORG1"
	testDocumentPlatformType = "teamshare"
	testDocumentThirdFileID  = "FILE-1"
)

type mockDocumentAppService struct {
	scheduleCalls         int
	syncErr               error
	syncCalls             int
	reVectorizedErr       error
	projectFileErr        error
	createErr             error
	createResp            *docdto.DocumentDTO
	updateErr             error
	updateResp            *docdto.DocumentDTO
	listErr               error
	listResp              *pagehelper.Result
	getByThirdFileErr     error
	getByThirdFileResp    []*docdto.DocumentDTO
	countErr              error
	destroyErr            error
	showErr               error
	showResp              *docdto.DocumentDTO
	originalFileLinkErr   error
	lastCreateInput       *docdto.CreateDocumentInput
	lastGetByThirdFile    *docdto.GetDocumentsByThirdFileIDInput
	lastListInput         *docdto.ListDocumentInput
	lastScheduledInput    *documentapp.SyncDocumentInput
	lastScheduleRequestID string
	lastSyncInput         *documentapp.SyncDocumentInput
	lastUpdateInput       *docdto.UpdateDocumentInput
	lastShowCode          string
	lastShowKBCode        string
	lastShowOrgCode       string
	lastShowUserID        string
	lastOriginalLinkCode  string
	lastOriginalLinkKB    string
	lastOriginalLinkOrg   string
	lastOriginalLinkUser  string
	lastCountOrgCode      string
	lastCountKBCodes      []string
	lastDestroyCode       string
	lastDestroyKBCode     string
	lastDestroyOrgCode    string
	lastDestroyUserID     string
	lastReVectorizedInput *docdto.ReVectorizedByThirdFileIDInput
	lastProjectFileInput  *docdto.NotifyProjectFileChangeInput
}

func (m *mockDocumentAppService) Create(_ context.Context, input *docdto.CreateDocumentInput) (*docdto.DocumentDTO, error) {
	m.lastCreateInput = input
	if m.createErr != nil {
		return nil, m.createErr
	}
	if m.createResp != nil {
		return m.createResp, nil
	}
	return &docdto.DocumentDTO{}, nil
}

func (m *mockDocumentAppService) Update(_ context.Context, input *docdto.UpdateDocumentInput) (*docdto.DocumentDTO, error) {
	m.lastUpdateInput = input
	if m.updateErr != nil {
		return nil, m.updateErr
	}
	if m.updateResp != nil {
		return m.updateResp, nil
	}
	return &docdto.DocumentDTO{}, nil
}

func (m *mockDocumentAppService) Show(_ context.Context, code, knowledgeBaseCode, organizationCode, userID string) (*docdto.DocumentDTO, error) {
	m.lastShowCode = code
	m.lastShowKBCode = knowledgeBaseCode
	m.lastShowOrgCode = organizationCode
	m.lastShowUserID = userID
	if m.showErr != nil {
		return nil, m.showErr
	}
	if m.showResp != nil {
		return m.showResp, nil
	}
	return &docdto.DocumentDTO{}, nil
}

func (m *mockDocumentAppService) GetOriginalFileLink(
	_ context.Context,
	code, knowledgeBaseCode, organizationCode, userID string,
) (*docdto.OriginalFileLinkDTO, error) {
	m.lastOriginalLinkCode = code
	m.lastOriginalLinkKB = knowledgeBaseCode
	m.lastOriginalLinkOrg = organizationCode
	m.lastOriginalLinkUser = userID
	if m.originalFileLinkErr != nil {
		return nil, m.originalFileLinkErr
	}
	return &docdto.OriginalFileLinkDTO{
		Available: true,
		URL:       "https://example.com/doc.md",
		Name:      "doc.md",
		Key:       "ORG1/doc.md",
		Type:      "external",
	}, nil
}

func (m *mockDocumentAppService) List(_ context.Context, input *docdto.ListDocumentInput) (*pagehelper.Result, error) {
	m.lastListInput = input
	if m.listErr != nil {
		return nil, m.listErr
	}
	if m.listResp != nil {
		return m.listResp, nil
	}
	return &pagehelper.Result{}, nil
}

func (m *mockDocumentAppService) GetByThirdFileID(_ context.Context, input *docdto.GetDocumentsByThirdFileIDInput) ([]*docdto.DocumentDTO, error) {
	m.lastGetByThirdFile = input
	if m.getByThirdFileErr != nil {
		return nil, m.getByThirdFileErr
	}
	if m.getByThirdFileResp != nil {
		return m.getByThirdFileResp, nil
	}
	return []*docdto.DocumentDTO{
		{
			Code:              "DOC1",
			KnowledgeBaseCode: "KB1",
			ThirdPlatformType: input.ThirdPlatformType,
			ThirdFileID:       input.ThirdFileID,
		},
	}, nil
}

func (m *mockDocumentAppService) CountByKnowledgeBaseCodes(_ context.Context, organizationCode string, knowledgeBaseCodes []string) (map[string]int64, error) {
	m.lastCountOrgCode = organizationCode
	m.lastCountKBCodes = append([]string(nil), knowledgeBaseCodes...)
	if m.countErr != nil {
		return nil, m.countErr
	}
	return map[string]int64{"KB1": 3}, nil
}

func (m *mockDocumentAppService) Destroy(_ context.Context, code, knowledgeBaseCode, organizationCode, userID string) error {
	m.lastDestroyCode = code
	m.lastDestroyKBCode = knowledgeBaseCode
	m.lastDestroyOrgCode = organizationCode
	m.lastDestroyUserID = userID
	return m.destroyErr
}

func (m *mockDocumentAppService) Sync(_ context.Context, input *documentapp.SyncDocumentInput) error {
	m.syncCalls++
	m.lastSyncInput = input
	return m.syncErr
}

func (m *mockDocumentAppService) ScheduleSync(ctx context.Context, input *documentapp.SyncDocumentInput) {
	m.scheduleCalls++
	m.lastScheduledInput = input
	m.lastScheduleRequestID, _ = ctxmeta.RequestIDFromContext(ctx)
}

func (m *mockDocumentAppService) ReVectorizedByThirdFileID(_ context.Context, input *docdto.ReVectorizedByThirdFileIDInput) error {
	m.lastReVectorizedInput = input
	return m.reVectorizedErr
}

func (m *mockDocumentAppService) NotifyProjectFileChange(_ context.Context, input *docdto.NotifyProjectFileChangeInput) error {
	m.lastProjectFileInput = input
	return m.projectFileErr
}

func TestUpdateRPCPassesKnowledgeBaseCode(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	_, err := handler.UpdateRPC(context.Background(), &dto.UpdateDocumentRequest{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		Code:              "DOC1",
		KnowledgeBaseCode: testDocumentKBCode,
		Name:              "updated",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if appSvc.lastUpdateInput == nil {
		t.Fatal("expected update input to be captured")
	}
	if appSvc.lastUpdateInput.KnowledgeBaseCode != testDocumentKBCode {
		t.Fatalf("expected knowledge base code %s, got %q", testDocumentKBCode, appSvc.lastUpdateInput.KnowledgeBaseCode)
	}
	if appSvc.lastUpdateInput.WaitForSyncResult {
		t.Fatal("expected update RPC to schedule resync asynchronously")
	}
}

func TestNewDocumentRPCService(t *testing.T) {
	t.Parallel()

	if handler := knowledgesvc.NewDocumentRPCService(nil, logging.New()); handler == nil {
		t.Fatal("expected non-nil document rpc handler")
	}
}

func TestCreateRPCEnablesAutoSync(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	_, err := handler.CreateRPC(context.Background(), &dto.CreateDocumentRequest{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		KnowledgeBaseCode: testDocumentKBCode,
		Name:              "doc-1.md",
		DocumentFile: &docfilehelper.DocumentFileDTO{
			Name: "doc-1.md",
			Key:  "org/path/doc-1.md",
			URL:  "org/path/doc-1.md",
		},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if appSvc.lastCreateInput == nil {
		t.Fatal("expected create input to be captured")
	}
	if !appSvc.lastCreateInput.AutoSync {
		t.Fatal("expected create RPC to enable auto sync")
	}
	if appSvc.lastCreateInput.WaitForSyncResult {
		t.Fatal("expected create RPC to schedule sync asynchronously")
	}
}

func TestDocumentRPCMapsTopLevelStrategyConfig(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())
	strategyConfig := &confighelper.StrategyConfigDTO{
		ParsingType:     1,
		ImageExtraction: false,
		TableExtraction: true,
		ImageOCR:        true,
	}

	if _, err := handler.CreateRPC(context.Background(), &dto.CreateDocumentRequest{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		KnowledgeBaseCode: testDocumentKBCode,
		Name:              "doc-1.md",
		StrategyConfig:    strategyConfig,
	}); err != nil {
		t.Fatalf("create rpc: %v", err)
	}
	if appSvc.lastCreateInput == nil || appSvc.lastCreateInput.StrategyConfig != strategyConfig {
		t.Fatalf("expected create strategy config forwarded, got %#v", appSvc.lastCreateInput)
	}

	if _, err := handler.UpdateRPC(context.Background(), &dto.UpdateDocumentRequest{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		Code:              "DOC1",
		KnowledgeBaseCode: testDocumentKBCode,
		StrategyConfig:    strategyConfig,
	}); err != nil {
		t.Fatalf("update rpc: %v", err)
	}
	if appSvc.lastUpdateInput == nil || appSvc.lastUpdateInput.StrategyConfig != strategyConfig {
		t.Fatalf("expected update strategy config forwarded, got %#v", appSvc.lastUpdateInput)
	}
}

func TestDocumentRPCIgnoresAgentScopeFields(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	create := jsonrpc.WrapTyped(handler.CreateRPC)
	if _, err := create(context.Background(), "svc.knowledge.document.create", jsonRawMessagef(`{
		"organization_code": "ORG1",
		"user_id": "U1",
		"knowledge_base_code": "KB1",
		"name": "doc-1.md",
		"agent_code": "%s"
	}`, testLegacyAgentCode)); err != nil {
		t.Fatalf("expected create to ignore agent_code, got %v", err)
	}

	update := jsonrpc.WrapTyped(handler.UpdateRPC)
	if _, err := update(context.Background(), "svc.knowledge.document.update", jsonRawMessagef(`{
		"organization_code": "ORG1",
		"user_id": "U1",
		"code": "DOC1",
		"knowledge_base_code": "KB1",
		"agent_code": "%s"
	}`, testLegacyAgentCode)); err != nil {
		t.Fatalf("expected update to ignore agent_code, got %v", err)
	}

	syncDocument := jsonrpc.WrapTyped(handler.SyncRPC)
	if _, err := syncDocument(context.Background(), "svc.knowledge.document.sync", jsonRawMessagef(`{
		"data_isolation": {"organization_code": "ORG1", "user_id": "U1"},
		"business_params": {"organization_code": "ORG1", "user_id": "U1"},
		"knowledge_base_code": "KB1",
		"code": "DOC1",
		"agent_code": "%s"
	}`, testLegacyAgentCode)); err != nil {
		t.Fatalf("expected sync to ignore agent_code, got %v", err)
	}

	show := jsonrpc.WrapTyped(handler.ShowRPC)
	if _, err := show(context.Background(), "svc.knowledge.document.show", jsonRawMessagef(`{
		"data_isolation": {"organization_code": "ORG1", "user_id": "U1"},
		"code": "DOC1",
		"knowledge_base_code": "KB1",
		"agent_code": "%s"
	}`, testLegacyAgentCode)); err != nil {
		t.Fatalf("expected show to ignore agent_code, got %v", err)
	}

	originalLink := jsonrpc.WrapTyped(handler.GetOriginalFileLinkRPC)
	if _, err := originalLink(context.Background(), "svc.knowledge.document.getOriginalFileLink", jsonRawMessagef(`{
		"data_isolation": {"organization_code": "ORG1", "user_id": "U1"},
		"code": "DOC1",
		"knowledge_base_code": "KB1",
		"agent_code": "%s"
	}`, testLegacyAgentCode)); err != nil {
		t.Fatalf("expected getOriginalFileLink to ignore agent_code, got %v", err)
	}

	list := jsonrpc.WrapTyped(handler.ListRPC)
	if _, err := list(context.Background(), "svc.knowledge.document.queries", jsonRawMessagef(`{
		"organization_code": "ORG1",
		"knowledge_base_code": "KB1",
		"agent_code": "%s",
		"page": {"offset": 0, "limit": 10}
	}`, testLegacyAgentCode)); err != nil {
		t.Fatalf("expected list to ignore agent_code, got %v", err)
	}

	destroy := jsonrpc.WrapTyped(handler.DestroyRPC)
	if _, err := destroy(context.Background(), "svc.knowledge.document.destroy", jsonRawMessagef(`{
		"data_isolation": {"organization_code": "ORG1", "user_id": "U1"},
		"code": "DOC1",
		"knowledge_base_code": "KB1",
		"agent_code": "%s"
	}`, testLegacyAgentCode)); err != nil {
		t.Fatalf("expected destroy to ignore agent_code, got %v", err)
	}
}

func TestDocumentListAndSyncRPCCompatAcceptStringScalars(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{
		listResp: &pagehelper.Result{},
	}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	list := jsonrpc.WrapTyped(handler.ListRPC)
	if _, err := list(context.Background(), "svc.knowledge.document.queries", json.RawMessage(`{
		"data_isolation": {"organization_code": "ORG1", "user_id": "U1"},
		"organization_code": "ORG1",
		"knowledge_base_code": "KB1",
		"sync_status": "2",
		"page": "3",
		"page_size": "25"
	}`)); err != nil {
		t.Fatalf("expected list string pagination compat, got %v", err)
	}
	if appSvc.lastListInput == nil || appSvc.lastListInput.Offset != 50 || appSvc.lastListInput.Limit != 25 {
		t.Fatalf("expected string pagination mapped to offset/limit=50/25, got %#v", appSvc.lastListInput)
	}

	syncDocument := jsonrpc.WrapTyped(handler.SyncRPC)
	if _, err := syncDocument(context.Background(), "svc.knowledge.document.sync", json.RawMessage(`{
		"data_isolation": {"organization_code": "ORG1", "user_id": "U1"},
		"business_params": {"organization_code": "ORG1", "user_id": "U1"},
		"knowledge_base_code": "KB1",
		"code": "DOC1",
		"sync": "false"
	}`)); err != nil {
		t.Fatalf("expected sync string bool compat, got %v", err)
	}
	if appSvc.syncCalls != 0 {
		t.Fatalf("expected sync not to be called, got %d", appSvc.syncCalls)
	}
	if appSvc.scheduleCalls != 1 || appSvc.lastScheduledInput == nil || !appSvc.lastScheduledInput.Async {
		t.Fatalf("expected compat sync request to schedule asynchronously, got calls=%d input=%#v", appSvc.scheduleCalls, appSvc.lastScheduledInput)
	}
}

func TestNotifyProjectFileChangeRPCCompatAcceptsStringProjectFileID(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())
	notifyChange := jsonrpc.WrapTyped(handler.NotifyProjectFileChangeRPC)

	if _, err := notifyChange(context.Background(), "svc.knowledge.projectFile.notifyChange", json.RawMessage(`{
		"project_file_id": "42"
	}`)); err != nil {
		t.Fatalf("expected project_file_id string compat, got %v", err)
	}
	if appSvc.lastProjectFileInput == nil || appSvc.lastProjectFileInput.ProjectFileID != 42 {
		t.Fatalf("expected project_file_id=42, got %#v", appSvc.lastProjectFileInput)
	}
}

func TestNotifyProjectFileChangeRPCCompatPreservesLargeNumericProjectFileID(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())
	notifyChange := jsonrpc.WrapTyped(handler.NotifyProjectFileChangeRPC)

	if _, err := notifyChange(context.Background(), "svc.knowledge.projectFile.notifyChange", json.RawMessage(`{
		"project_file_id": 904787325064802305
	}`)); err != nil {
		t.Fatalf("expected large numeric project_file_id compat, got %v", err)
	}
	if appSvc.lastProjectFileInput == nil || appSvc.lastProjectFileInput.ProjectFileID != 904787325064802305 {
		t.Fatalf("expected project_file_id=904787325064802305, got %#v", appSvc.lastProjectFileInput)
	}
}

func TestNotifyProjectFileChangeRPCCompatPassesDeletedContext(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())
	notifyChange := jsonrpc.WrapTyped(handler.NotifyProjectFileChangeRPC)

	if _, err := notifyChange(context.Background(), "svc.knowledge.projectFile.notifyChange", json.RawMessage(`{
		"project_file_id": "42",
		"organization_code": "ORG1",
		"project_id": "900",
		"status": "deleted"
	}`)); err != nil {
		t.Fatalf("expected deleted context compat, got %v", err)
	}
	if appSvc.lastProjectFileInput == nil ||
		appSvc.lastProjectFileInput.ProjectFileID != 42 ||
		appSvc.lastProjectFileInput.OrganizationCode != testDocumentOrgCode ||
		appSvc.lastProjectFileInput.ProjectID != 900 ||
		appSvc.lastProjectFileInput.Status != "deleted" {
		t.Fatalf("expected deleted context preserved, got %#v", appSvc.lastProjectFileInput)
	}
}

func TestDocumentCreateRPCResponseContractCompat(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{
		createResp: &docdto.DocumentDTO{
			ID:                11,
			OrganizationCode:  "ORG1",
			KnowledgeBaseCode: testDocumentKBCode,
			CreatedUID:        "usi_creator",
			UpdatedUID:        "usi_modifier",
			Name:              "doc-1.md",
			Code:              testDocumentCode,
			DocType:           1,
			SyncStatus:        1,
			CreatedAt:         "2026-04-06 10:00:00",
			UpdatedAt:         "2026-04-06 10:10:00",
		},
	}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	resp, err := handler.CreateRPC(context.Background(), &dto.CreateDocumentRequest{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		KnowledgeBaseCode: testDocumentKBCode,
		Name:              "doc-1.md",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	assertDocumentContractCompat(t, resp)
}

func TestShowRPCPassesKnowledgeBaseCodeAndOrganization(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	_, err := handler.ShowRPC(context.Background(), &dto.ShowDocumentRequest{
		Code:              testDocumentCode,
		KnowledgeBaseCode: testDocumentKBCode,
		DataIsolation: dto.DataIsolation{
			OrganizationCode: testDocumentOrgCode,
			UserID:           "U1",
		},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if appSvc.lastShowCode != testDocumentCode {
		t.Fatalf("expected code DOC1, got %q", appSvc.lastShowCode)
	}
	if appSvc.lastShowKBCode != testDocumentKBCode {
		t.Fatalf("expected knowledge base code %s, got %q", testDocumentKBCode, appSvc.lastShowKBCode)
	}
	if appSvc.lastShowOrgCode != testDocumentOrgCode {
		t.Fatalf("expected organization code ORG1, got %q", appSvc.lastShowOrgCode)
	}
	if appSvc.lastShowUserID != "U1" {
		t.Fatalf("expected user id U1, got %q", appSvc.lastShowUserID)
	}
}

func TestGetOriginalFileLinkRPCPassesExpectedPayload(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	result, err := handler.GetOriginalFileLinkRPC(context.Background(), &dto.GetOriginalFileLinkRequest{
		Code:              testDocumentCode,
		KnowledgeBaseCode: testDocumentKBCode,
		DataIsolation: dto.DataIsolation{
			OrganizationCode: testDocumentOrgCode,
			UserID:           "U1",
		},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if appSvc.lastOriginalLinkCode != testDocumentCode || appSvc.lastOriginalLinkKB != testDocumentKBCode || appSvc.lastOriginalLinkOrg != testDocumentOrgCode || appSvc.lastOriginalLinkUser != "U1" {
		t.Fatalf("unexpected original-file-link input: code=%q kb=%q org=%q user=%q", appSvc.lastOriginalLinkCode, appSvc.lastOriginalLinkKB, appSvc.lastOriginalLinkOrg, appSvc.lastOriginalLinkUser)
	}
	if result == nil || !result.Available || result.Type != "external" {
		t.Fatalf("unexpected result: %#v", result)
	}
}

func TestGetByThirdFileIdRPCPassesExpectedPayload(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	result, err := handler.GetByThirdFileIdRPC(context.Background(), &dto.GetDocumentsByThirdFileIdRequest{
		DataIsolation: dto.DataIsolation{
			OrganizationCode: testDocumentOrgCode,
			UserID:           "U1",
		},
		KnowledgeBaseCode: testDocumentKBCode,
		ThirdPlatformType: testDocumentPlatformType,
		ThirdFileID:       testDocumentThirdFileID,
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if appSvc.lastGetByThirdFile == nil {
		t.Fatal("expected get-by-third-file input to be captured")
	}
	if appSvc.lastGetByThirdFile.OrganizationCode != testDocumentOrgCode {
		t.Fatalf("expected organization code %s, got %q", testDocumentOrgCode, appSvc.lastGetByThirdFile.OrganizationCode)
	}
	if appSvc.lastGetByThirdFile.KnowledgeBaseCode != testDocumentKBCode {
		t.Fatalf("expected knowledge base code %s, got %q", testDocumentKBCode, appSvc.lastGetByThirdFile.KnowledgeBaseCode)
	}
	if appSvc.lastGetByThirdFile.ThirdPlatformType != testDocumentPlatformType || appSvc.lastGetByThirdFile.ThirdFileID != testDocumentThirdFileID {
		t.Fatalf("unexpected get-by-third-file input: %#v", appSvc.lastGetByThirdFile)
	}
	if len(result) != 1 || result[0] == nil || result[0].ThirdFileID != testDocumentThirdFileID {
		t.Fatalf("unexpected result: %#v", result)
	}
}

func TestDocumentRPCShowAndValidationErrors(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{showErr: errDocumentRPCBoom}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	if _, err := handler.ShowRPC(context.Background(), &dto.ShowDocumentRequest{
		Code:              "DOC1",
		KnowledgeBaseCode: testDocumentKBCode,
		DataIsolation:     dto.DataIsolation{OrganizationCode: "ORG1"},
	}); err == nil {
		t.Fatal("expected show error")
	}

	appSvc = &mockDocumentAppService{}
	handler = knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())
	wrappedCreate := jsonrpc.WrapTyped(handler.CreateRPC)
	if _, err := wrappedCreate(context.Background(), "svc.knowledge.document.create", json.RawMessage(`{
		"organization_code": "ORG1",
		"user_id": "U1",
		"knowledge_base_code": "KB1",
		"name": "doc-1.md",
		"retrieve_config": {"top_k": 11}
	}`)); err == nil {
		t.Fatal("expected create validation error")
	}
	if appSvc.lastCreateInput != nil {
		t.Fatal("expected create input to stay nil on validation error")
	}

	wrappedUpdate := jsonrpc.WrapTyped(handler.UpdateRPC)
	if _, err := wrappedUpdate(context.Background(), "svc.knowledge.document.update", json.RawMessage(`{
		"organization_code": "ORG1",
		"user_id": "U1",
		"code": "DOC1",
		"knowledge_base_code": "KB1",
		"retrieve_config": {"top_k": 11}
	}`)); err == nil {
		t.Fatal("expected update validation error")
	}
	if appSvc.lastUpdateInput != nil {
		t.Fatal("expected update input to stay nil on validation error")
	}

	appSvc = &mockDocumentAppService{getByThirdFileErr: errDocumentRPCBoom}
	handler = knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())
	if _, err := handler.GetByThirdFileIdRPC(context.Background(), &dto.GetDocumentsByThirdFileIdRequest{
		DataIsolation:     dto.DataIsolation{OrganizationCode: "ORG1"},
		ThirdPlatformType: testDocumentPlatformType,
		ThirdFileID:       testDocumentThirdFileID,
	}); err == nil {
		t.Fatal("expected get-by-third-file error")
	}

	appSvc = &mockDocumentAppService{originalFileLinkErr: errDocumentRPCBoom}
	handler = knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())
	if _, err := handler.GetOriginalFileLinkRPC(context.Background(), &dto.GetOriginalFileLinkRequest{
		Code:              "DOC1",
		KnowledgeBaseCode: testDocumentKBCode,
		DataIsolation:     dto.DataIsolation{OrganizationCode: "ORG1"},
	}); err == nil {
		t.Fatal("expected original-file-link error")
	}
}

func TestSyncRPCPassesBusinessParams(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	result, err := handler.SyncRPC(context.Background(), &dto.SyncDocumentRequest{
		KnowledgeBaseCode: "KB1",
		Code:              "DOC1",
		Mode:              "create",
		RevectorizeSource: documentapp.RevectorizeSourceSingleDocumentManual,
		DataIsolation: dto.DataIsolation{
			OrganizationCode: "ORG1",
			UserID:           "U1",
		},
		BusinessParams: dto.BusinessParams{
			OrganizationCode: "ORG1",
			UserID:           "U1",
			BusinessID:       "KB1",
		},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil || !(*result)["success"] {
		t.Fatalf("expected success result, got %#v", result)
	}
	if appSvc.syncCalls != 0 {
		t.Fatalf("expected sync not to be called, got %d", appSvc.syncCalls)
	}
	if appSvc.scheduleCalls != 1 || appSvc.lastScheduledInput == nil {
		t.Fatalf("expected scheduled sync input captured, got calls=%d input=%#v", appSvc.scheduleCalls, appSvc.lastScheduledInput)
	}
	if !appSvc.lastScheduledInput.Async {
		t.Fatalf("expected scheduled sync input to be async, got %#v", appSvc.lastScheduledInput)
	}
	if appSvc.lastScheduledInput.BusinessParams == nil || appSvc.lastScheduledInput.BusinessParams.UserID != "U1" {
		t.Fatalf("unexpected business params: %#v", appSvc.lastScheduledInput.BusinessParams)
	}
	if appSvc.lastScheduledInput.RevectorizeSource != documentapp.RevectorizeSourceSingleDocumentManual {
		t.Fatalf("unexpected revectorize source: %#v", appSvc.lastScheduledInput)
	}
}

func assertSyncRPCResyncSchedulesAsyncByDefault(t *testing.T, expectedAsyncDesc string) {
	t.Helper()

	appSvc := &mockDocumentAppService{}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	result, err := handler.SyncRPC(context.Background(), &dto.SyncDocumentRequest{
		KnowledgeBaseCode: "KB1",
		Code:              "DOC1",
		Mode:              "resync",
		DataIsolation: dto.DataIsolation{
			OrganizationCode: "ORG1",
			UserID:           "U1",
		},
		BusinessParams: dto.BusinessParams{
			OrganizationCode: "ORG1",
			UserID:           "U1",
			BusinessID:       "KB1",
		},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil || !(*result)["success"] {
		t.Fatalf("expected success result, got %#v", result)
	}
	if appSvc.scheduleCalls != 1 {
		t.Fatalf("expected schedule to be called once, got %d", appSvc.scheduleCalls)
	}
	if appSvc.syncCalls != 0 {
		t.Fatalf("expected sync not to be called, got %d", appSvc.syncCalls)
	}
	if appSvc.lastScheduledInput == nil || !appSvc.lastScheduledInput.Async {
		t.Fatalf("expected %s scheduled input, got %#v", expectedAsyncDesc, appSvc.lastScheduledInput)
	}
}

func TestSyncRPCResyncSchedulesWithoutAsyncFlag(t *testing.T) {
	t.Parallel()

	assertSyncRPCResyncSchedulesAsyncByDefault(t, "async")
}

func TestSyncRPCResyncKeepsRequestIDForSchedule(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	reqCtx := ctxmeta.WithRequestID(context.Background(), "req-doc-sync-1")
	result, err := handler.SyncRPC(reqCtx, &dto.SyncDocumentRequest{
		KnowledgeBaseCode: "KB1",
		Code:              "DOC1",
		Mode:              "resync",
		DataIsolation: dto.DataIsolation{
			OrganizationCode: "ORG1",
			UserID:           "U1",
		},
		BusinessParams: dto.BusinessParams{
			OrganizationCode: "ORG1",
			UserID:           "U1",
			BusinessID:       "KB1",
		},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil || !(*result)["success"] {
		t.Fatalf("expected success result, got %#v", result)
	}
	if appSvc.lastScheduleRequestID != "req-doc-sync-1" {
		t.Fatalf("expected schedule request_id req-doc-sync-1, got %q", appSvc.lastScheduleRequestID)
	}
}

func TestSyncRPCResyncSchedulesAsynchronouslyByDefault(t *testing.T) {
	t.Parallel()

	assertSyncRPCResyncSchedulesAsyncByDefault(t, "asynchronous")
}

func TestSyncRPCAlwaysSchedulesAndIgnoresInlineSyncError(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{syncErr: errors.Join(documentapp.ErrDocumentSourcePrecheckFailed, errBucketNotFound)}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	result, err := handler.SyncRPC(context.Background(), &dto.SyncDocumentRequest{
		KnowledgeBaseCode: "KB1",
		Code:              "DOC1",
		DataIsolation: dto.DataIsolation{
			OrganizationCode: "ORG1",
			UserID:           "U1",
		},
		BusinessParams: dto.BusinessParams{
			OrganizationCode: "ORG1",
			UserID:           "U1",
			BusinessID:       "KB1",
		},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil || !(*result)["success"] {
		t.Fatalf("expected success result, got %#v", result)
	}
	if appSvc.syncCalls != 0 {
		t.Fatalf("expected inline sync not to be called, got %d", appSvc.syncCalls)
	}
	if appSvc.scheduleCalls != 1 || appSvc.lastScheduledInput == nil || !appSvc.lastScheduledInput.Async {
		t.Fatalf("expected async schedule, got calls=%d input=%#v", appSvc.scheduleCalls, appSvc.lastScheduledInput)
	}
}

func TestReVectorizedByThirdFileIdRPCMapsInput(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	result, err := handler.ReVectorizedByThirdFileIdRPC(context.Background(), &dto.ReVectorizedByThirdFileIdRequest{
		DataIsolation: dto.DataIsolation{
			OrganizationCode:              "ORG1",
			UserID:                        "U1",
			ThirdPlatformUserID:           "TP-U1",
			ThirdPlatformOrganizationCode: "TP-ORG1",
		},
		ThirdPlatformType: "teamshare",
		ThirdFileID:       "FILE-1",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil || !(*result)["success"] {
		t.Fatalf("expected success result, got %#v", result)
	}
	if appSvc.lastReVectorizedInput == nil {
		t.Fatal("expected re-vectorized input to be captured")
	}
	if appSvc.lastReVectorizedInput.OrganizationCode != testDocumentOrgCode ||
		appSvc.lastReVectorizedInput.UserID != "U1" ||
		appSvc.lastReVectorizedInput.ThirdPlatformUserID != "TP-U1" ||
		appSvc.lastReVectorizedInput.ThirdPlatformOrganizationCode != "TP-ORG1" ||
		appSvc.lastReVectorizedInput.ThirdPlatformType != "teamshare" ||
		appSvc.lastReVectorizedInput.ThirdFileID != "FILE-1" {
		t.Fatalf("unexpected input: %#v", appSvc.lastReVectorizedInput)
	}
}

func TestReVectorizedByThirdFileIdRPCMapsError(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{reVectorizedErr: errDocumentRPCStub}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	if _, err := handler.ReVectorizedByThirdFileIdRPC(context.Background(), &dto.ReVectorizedByThirdFileIdRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: "ORG1"},
		ThirdFileID:   "FILE-1",
	}); err == nil {
		t.Fatal("expected error")
	}
}

func TestDocumentListAndCountAndDestroyRPC(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{
		listResp: &pagehelper.Result{
			Total: 1,
			List: []*docdto.DocumentDTO{
				{
					ID:                11,
					OrganizationCode:  "ORG1",
					KnowledgeBaseCode: testDocumentKBCode,
					CreatedUID:        "usi_creator",
					UpdatedUID:        "usi_modifier",
					Name:              "doc-1.md",
					Code:              testDocumentCode,
					DocType:           1,
					SyncStatus:        1,
					CreatedAt:         "2026-04-06 10:00:00",
					UpdatedAt:         "2026-04-06 10:10:00",
				},
			},
		},
	}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	listResp, err := handler.ListRPC(context.Background(), &dto.ListDocumentRequest{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		Name:              "doc",
		Page: dto.PageParams{
			Offset: 3,
			Limit:  10,
		},
	})
	if err != nil {
		t.Fatalf("expected list success, got %v", err)
	}
	if appSvc.lastListInput == nil || appSvc.lastListInput.Name != "doc" || appSvc.lastListInput.Offset != 3 || appSvc.lastListInput.Limit != 10 {
		t.Fatalf("unexpected list input: %#v", appSvc.lastListInput)
	}
	if listResp == nil || len(listResp.List) != 1 {
		t.Fatalf("unexpected list response: %#v", listResp)
	}
	assertDocumentContractCompat(t, listResp.List[0])

	counts, err := handler.CountByKnowledgeBaseCodesRPC(context.Background(), &dto.CountByKnowledgeBaseCodesRequest{
		KnowledgeBaseCodes: []string{"KB1"},
		DataIsolation: dto.DataIsolation{
			OrganizationID: "ORG_LEGACY",
		},
	})
	if err != nil {
		t.Fatalf("expected count success, got %v", err)
	}
	if counts["KB1"] != 3 || appSvc.lastCountOrgCode != "ORG_LEGACY" || len(appSvc.lastCountKBCodes) != 1 {
		t.Fatalf("unexpected count result=%#v app=%#v", counts, appSvc)
	}

	result, err := handler.DestroyRPC(context.Background(), &dto.DestroyDocumentRequest{
		DataIsolation:     dto.DataIsolation{OrganizationCode: "ORG1"},
		Code:              "DOC1",
		KnowledgeBaseCode: testDocumentKBCode,
	})
	if err != nil {
		t.Fatalf("expected destroy success, got %v", err)
	}
	if result == nil || !(*result)["success"] {
		t.Fatalf("unexpected destroy result: %#v", result)
	}
	if appSvc.lastDestroyCode != "DOC1" || appSvc.lastDestroyKBCode != testDocumentKBCode || appSvc.lastDestroyOrgCode != testDocumentOrgCode || appSvc.lastDestroyUserID != "" {
		t.Fatalf("unexpected destroy input: %#v", appSvc)
	}
}

func TestDocumentDestroyRPCMapsManagedDeleteError(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{
		destroyErr: documentapp.ErrManagedDocumentSingleDeleteNotAllowed,
	}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	_, err := handler.DestroyRPC(context.Background(), &dto.DestroyDocumentRequest{
		DataIsolation:     dto.DataIsolation{OrganizationCode: "ORG1"},
		Code:              testDocumentCode,
		KnowledgeBaseCode: testDocumentKBCode,
	})
	if err == nil {
		t.Fatal("expected destroy error")
	}

	var bizErr *jsonrpc.BusinessError
	if !errors.As(err, &bizErr) {
		t.Fatalf("expected business error, got %T %v", err, err)
	}
	if bizErr.Code != jsonrpc.ErrCodeInvalidParams {
		t.Fatalf("expected invalid params, got %#v", bizErr)
	}
	if bizErr.Message != documentapp.ErrManagedDocumentSingleDeleteNotAllowed.Error() {
		t.Fatalf("unexpected business message: %#v", bizErr)
	}
}

func assertDocumentContractCompat(t *testing.T, resp *dto.DocumentResponse) {
	t.Helper()

	if resp == nil {
		t.Fatal("expected non-nil document response")
	}
	if resp.KnowledgeBaseCode != testDocumentKBCode {
		t.Fatalf("expected knowledge_base_code=%s, got %#v", testDocumentKBCode, resp)
	}
	if resp.DocType != 1 {
		t.Fatalf("expected doc_type=1, got %#v", resp)
	}
	if resp.CreatorInfo == nil || resp.CreatorInfo.ID != "usi_creator" {
		t.Fatalf("unexpected creator_info: %#v", resp.CreatorInfo)
	}
	if resp.ModifierInfo == nil || resp.ModifierInfo.ID != "usi_modifier" {
		t.Fatalf("unexpected modifier_info: %#v", resp.ModifierInfo)
	}
	if resp.Version == 0 {
		t.Fatalf("expected non-zero version, got %#v", resp)
	}
}

func TestDocumentResponseIncludesTopLevelStrategyConfig(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{
		showResp: &docdto.DocumentDTO{
			Code:              testDocumentCode,
			KnowledgeBaseCode: testDocumentKBCode,
			CreatedUID:        "usi_creator",
			UpdatedUID:        "usi_modifier",
			DocType:           1,
			CreatedAt:         "2026-04-06 10:00:00",
			UpdatedAt:         "2026-04-06 10:10:00",
			StrategyConfig: &confighelper.StrategyConfigDTO{
				ParsingType:     1,
				ImageExtraction: false,
				TableExtraction: true,
				ImageOCR:        true,
			},
		},
	}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	resp, err := handler.ShowRPC(context.Background(), &dto.ShowDocumentRequest{
		Code:              testDocumentCode,
		KnowledgeBaseCode: testDocumentKBCode,
		DataIsolation: dto.DataIsolation{
			OrganizationCode: testDocumentOrgCode,
			UserID:           "U1",
		},
	})
	if err != nil {
		t.Fatalf("show rpc: %v", err)
	}
	if resp == nil || resp.StrategyConfig == nil {
		t.Fatalf("expected top-level strategy config, got %#v", resp)
	}
}

func TestShowRPCProjectsThirdPlatformDocumentFileCompatFields(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{
		showResp: &docdto.DocumentDTO{
			Code:              testDocumentCode,
			KnowledgeBaseCode: testDocumentKBCode,
			CreatedUID:        "usi_creator",
			UpdatedUID:        "usi_modifier",
			DocType:           1,
			CreatedAt:         "2026-04-06 10:00:00",
			UpdatedAt:         "2026-04-06 10:10:00",
			ThirdPlatformType: testDocumentPlatformType,
			ThirdFileID:       testDocumentThirdFileID,
			DocumentFile: &docfilehelper.DocumentFileDTO{
				Type:       "third_platform",
				Name:       "teamshare.xlsx",
				URL:        "",
				ThirdID:    testDocumentThirdFileID,
				SourceType: testDocumentPlatformType,
				Extension:  "xlsx",
			},
		},
	}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	resp, err := handler.ShowRPC(context.Background(), &dto.ShowDocumentRequest{
		Code:              testDocumentCode,
		KnowledgeBaseCode: testDocumentKBCode,
		DataIsolation: dto.DataIsolation{
			OrganizationCode: testDocumentOrgCode,
			UserID:           "U1",
		},
	})
	if err != nil {
		t.Fatalf("show rpc: %v", err)
	}

	documentFile := assertDocumentFileCompat(t, resp)
	if documentFile["type"] != 2 {
		t.Fatalf("expected document_file.type=2, got %#v", documentFile["type"])
	}
	if documentFile["third_id"] != testDocumentThirdFileID || documentFile["third_file_id"] != testDocumentThirdFileID {
		t.Fatalf("expected third file aliases, got %#v", documentFile)
	}
	if documentFile["source_type"] != testDocumentPlatformType || documentFile["platform_type"] != testDocumentPlatformType {
		t.Fatalf("expected platform aliases, got %#v", documentFile)
	}
}

func TestListRPCBackfillsThirdPlatformDocumentFileCompatFieldsFromTopLevel(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{
		listResp: &pagehelper.Result{
			Total: 1,
			List: []*docdto.DocumentDTO{
				{
					ID:                11,
					OrganizationCode:  "ORG1",
					KnowledgeBaseCode: testDocumentKBCode,
					CreatedUID:        "usi_creator",
					UpdatedUID:        "usi_modifier",
					Name:              "doc-1.md",
					Code:              testDocumentCode,
					DocType:           1,
					SyncStatus:        1,
					CreatedAt:         "2026-04-06 10:00:00",
					UpdatedAt:         "2026-04-06 10:10:00",
					ThirdPlatformType: testDocumentPlatformType,
					ThirdFileID:       testDocumentThirdFileID,
					DocumentFile: &docfilehelper.DocumentFileDTO{
						Type: "third_platform",
						Name: "teamshare.xlsx",
					},
				},
			},
		},
	}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	resp, err := handler.ListRPC(context.Background(), &dto.ListDocumentRequest{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testDocumentKBCode,
		Page: dto.PageParams{
			Offset: 0,
			Limit:  10,
		},
	})
	if err != nil {
		t.Fatalf("list rpc: %v", err)
	}
	if resp == nil || len(resp.List) != 1 {
		t.Fatalf("unexpected list response: %#v", resp)
	}

	documentFile := assertDocumentFileCompat(t, resp.List[0])
	if documentFile["type"] != 2 {
		t.Fatalf("expected document_file.type=2, got %#v", documentFile["type"])
	}
	if documentFile["third_id"] != testDocumentThirdFileID || documentFile["third_file_id"] != testDocumentThirdFileID {
		t.Fatalf("expected top-level third file fallback, got %#v", documentFile)
	}
	if documentFile["source_type"] != testDocumentPlatformType || documentFile["platform_type"] != testDocumentPlatformType {
		t.Fatalf("expected top-level platform fallback, got %#v", documentFile)
	}
}

func TestCreateRPCProjectsExternalDocumentFileCompatType(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{
		createResp: &docdto.DocumentDTO{
			ID:                11,
			OrganizationCode:  "ORG1",
			KnowledgeBaseCode: testDocumentKBCode,
			CreatedUID:        "usi_creator",
			UpdatedUID:        "usi_modifier",
			Name:              "doc-1.md",
			Code:              testDocumentCode,
			DocType:           1,
			SyncStatus:        1,
			CreatedAt:         "2026-04-06 10:00:00",
			UpdatedAt:         "2026-04-06 10:10:00",
			DocumentFile: &docfilehelper.DocumentFileDTO{
				Type: "external",
				Name: "doc-1.md",
				Key:  "org/doc-1.md",
				URL:  "org/doc-1.md",
			},
		},
	}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	resp, err := handler.CreateRPC(context.Background(), &dto.CreateDocumentRequest{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		KnowledgeBaseCode: testDocumentKBCode,
		Name:              "doc-1.md",
	})
	if err != nil {
		t.Fatalf("create rpc: %v", err)
	}

	documentFile := assertDocumentFileCompat(t, resp)
	if documentFile["type"] != 1 {
		t.Fatalf("expected document_file.type=1, got %#v", documentFile["type"])
	}
	if documentFile["key"] != "org/doc-1.md" {
		t.Fatalf("expected key preserved, got %#v", documentFile["key"])
	}
}

func assertDocumentFileCompat(t *testing.T, resp *dto.DocumentResponse) map[string]any {
	t.Helper()

	documentFile, ok := resp.DocumentFile.(map[string]any)
	if !ok {
		t.Fatalf("expected document_file map, got %#v", resp.DocumentFile)
	}

	return documentFile
}

func TestCreateRPCAcceptsFragmentChunkSizeAboveLegacyLimit(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	_, err := handler.CreateRPC(context.Background(), &dto.CreateDocumentRequest{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		KnowledgeBaseCode: "KB1",
		Name:              "doc-1.md",
		FragmentConfig: &confighelper.FragmentConfigDTO{
			Mode: 1,
			Normal: &confighelper.NormalFragmentConfigDTO{
				SegmentRule: &confighelper.SegmentRuleDTO{ChunkSize: 1001},
			},
		},
	})
	if err != nil {
		t.Fatalf("expected request to pass through, got %v", err)
	}
	if appSvc.lastCreateInput == nil {
		t.Fatal("expected create input to be forwarded")
	}
}

func TestDocumentRPCMapsCreateUpdateAndListErrors(t *testing.T) {
	t.Parallel()

	appSvc := &mockDocumentAppService{
		createErr:  errDocumentRPCBoom,
		updateErr:  errDocumentRPCBoom,
		listErr:    errDocumentRPCBoom,
		countErr:   errDocumentRPCBoom,
		destroyErr: errDocumentRPCBoom,
	}
	handler := knowledgesvc.NewDocumentRPCServiceWithDependencies(appSvc, logging.New())

	if _, err := handler.CreateRPC(context.Background(), &dto.CreateDocumentRequest{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		KnowledgeBaseCode: testDocumentKBCode,
		Name:              "doc-1.md",
	}); err == nil {
		t.Fatal("expected create error")
	}
	if _, err := handler.UpdateRPC(context.Background(), &dto.UpdateDocumentRequest{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		Code:              "DOC1",
		KnowledgeBaseCode: testDocumentKBCode,
	}); err == nil {
		t.Fatal("expected update error")
	}
	if _, err := handler.ListRPC(context.Background(), &dto.ListDocumentRequest{OrganizationCode: "ORG1"}); err == nil {
		t.Fatal("expected list error")
	}
	if _, err := handler.CountByKnowledgeBaseCodesRPC(context.Background(), &dto.CountByKnowledgeBaseCodesRequest{
		DataIsolation:      dto.DataIsolation{OrganizationCode: "ORG1"},
		KnowledgeBaseCodes: []string{"KB1"},
	}); err == nil {
		t.Fatal("expected count error")
	}
	if _, err := handler.DestroyRPC(context.Background(), &dto.DestroyDocumentRequest{
		DataIsolation:     dto.DataIsolation{OrganizationCode: "ORG1"},
		Code:              "DOC1",
		KnowledgeBaseCode: testDocumentKBCode,
	}); err == nil {
		t.Fatal("expected destroy error")
	}
}

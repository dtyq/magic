package service_test

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	fragdto "magic/internal/application/knowledge/fragment/dto"
	fragmentapp "magic/internal/application/knowledge/fragment/service"
	confighelper "magic/internal/application/knowledge/helper/config"
	pagehelper "magic/internal/application/knowledge/helper/page"
	"magic/internal/infrastructure/logging"
	"magic/internal/interfaces/rpc/jsonrpc/knowledge/dto"
	knowledgesvc "magic/internal/interfaces/rpc/jsonrpc/knowledge/service"
	jsonrpc "magic/internal/pkg/jsonrpc"
)

const testFragmentKBCode = "KB1"

type mockFragmentAppService struct {
	lastCreateInput       *fragdto.CreateFragmentInput
	lastRuntimeCreate     *fragdto.RuntimeCreateFragmentInput
	lastListInput         *fragdto.ListFragmentInput
	lastPreviewInput      *fragdto.PreviewFragmentInput
	lastSimilarityInput   *fragdto.SimilarityInput
	lastRuntimeSimilarity *fragdto.RuntimeSimilarityInput
	lastAgentSimilarity   *fragdto.AgentSimilarityInput
	createCalls           int
	runtimeCreateCalls    int
	destroyCalls          int
	runtimeDestroyCalls   int
	syncCalls             int
	createErr             error
	runtimeCreateErr      error
	showErr               error
	listErr               error
	destroyErr            error
	runtimeDestroyErr     error
	syncErr               error
	similarityErr         error
	previewErr            error
	agentSimilarityErr    error
	agentSimilarityResult *fragdto.AgentSimilarityResultDTO
}

func (m *mockFragmentAppService) Create(_ context.Context, input *fragdto.CreateFragmentInput) (*fragdto.FragmentDTO, error) {
	m.createCalls++
	m.lastCreateInput = input
	if m.createErr != nil {
		return nil, m.createErr
	}
	return &fragdto.FragmentDTO{
		ID:            1,
		KnowledgeCode: testFragmentKBCode,
		Creator:       "creator-1",
		Modifier:      "modifier-1",
		CreatedUID:    "created-uid-1",
		UpdatedUID:    "updated-uid-1",
		DocumentType:  2,
	}, nil
}

func (m *mockFragmentAppService) RuntimeCreate(_ context.Context, input *fragdto.RuntimeCreateFragmentInput) (*fragdto.FragmentDTO, error) {
	m.runtimeCreateCalls++
	m.lastRuntimeCreate = input
	if m.runtimeCreateErr != nil {
		return nil, m.runtimeCreateErr
	}
	return &fragdto.FragmentDTO{ID: 11, KnowledgeCode: testFragmentKBCode}, nil
}

func (m *mockFragmentAppService) Show(_ context.Context, _ int64, _, _, _ string) (*fragdto.FragmentDTO, error) {
	if m.showErr != nil {
		return nil, m.showErr
	}
	return &fragdto.FragmentDTO{
		ID:            7,
		KnowledgeCode: testFragmentKBCode,
		Creator:       "creator-1",
		Modifier:      "modifier-1",
		CreatedUID:    "created-uid-1",
		UpdatedUID:    "updated-uid-1",
		DocumentType:  2,
	}, nil
}

func (m *mockFragmentAppService) List(_ context.Context, input *fragdto.ListFragmentInput) (*pagehelper.Result, error) {
	m.lastListInput = input
	if m.listErr != nil {
		return nil, m.listErr
	}
	return &pagehelper.Result{
		List:  []*fragdto.FragmentDTO{},
		Total: 0,
	}, nil
}

func (m *mockFragmentAppService) ListV2(_ context.Context, input *fragdto.ListFragmentInput) (*fragdto.FragmentPageResultDTO, error) {
	m.lastListInput = input
	if m.listErr != nil {
		return nil, m.listErr
	}
	return &fragdto.FragmentPageResultDTO{
		List: []*fragdto.FragmentListItemDTO{
			{
				ID:                7,
				KnowledgeBaseCode: testFragmentKBCode,
				KnowledgeCode:     testFragmentKBCode,
				Creator:           "creator-1",
				Modifier:          "modifier-1",
				CreatedUID:        "created-uid-1",
				UpdatedUID:        "updated-uid-1",
				DocumentType:      2,
				DocType:           2,
			},
		},
	}, nil
}

func (m *mockFragmentAppService) Destroy(_ context.Context, _ int64, _, _, _ string) error {
	m.destroyCalls++
	return m.destroyErr
}

func (m *mockFragmentAppService) RuntimeDestroyByBusinessID(_ context.Context, _ *fragdto.RuntimeDestroyByBusinessIDInput) error {
	m.runtimeDestroyCalls++
	return m.runtimeDestroyErr
}

func (m *mockFragmentAppService) RuntimeDestroyByMetadataFilter(_ context.Context, _ *fragdto.RuntimeDestroyByMetadataFilterInput) error {
	m.runtimeDestroyCalls++
	return m.runtimeDestroyErr
}

func (m *mockFragmentAppService) Sync(context.Context, *fragdto.SyncFragmentInput) (*fragdto.FragmentDTO, error) {
	m.syncCalls++
	if m.syncErr != nil {
		return nil, m.syncErr
	}
	return &fragdto.FragmentDTO{}, nil
}

func (m *mockFragmentAppService) Similarity(_ context.Context, input *fragdto.SimilarityInput) ([]*fragdto.SimilarityResultDTO, error) {
	m.lastSimilarityInput = input
	if m.similarityErr != nil {
		return nil, m.similarityErr
	}
	return []*fragdto.SimilarityResultDTO{
		{
			ID:                8,
			KnowledgeBaseCode: testFragmentKBCode,
			KnowledgeCode:     testFragmentKBCode,
			DocumentCode:      "DOC1",
			DocumentName:      "demo.md",
			DocumentType:      2,
			DocType:           2,
			Content:           "hello similarity",
			Score:             0.91,
			WordCount:         12,
		},
	}, nil
}

func (m *mockFragmentAppService) RuntimeSimilarity(_ context.Context, input *fragdto.RuntimeSimilarityInput) ([]*fragdto.SimilarityResultDTO, error) {
	m.lastRuntimeSimilarity = input
	if m.similarityErr != nil {
		return nil, m.similarityErr
	}
	return []*fragdto.SimilarityResultDTO{{
		ID:                18,
		KnowledgeBaseCode: testFragmentKBCode,
		KnowledgeCode:     testFragmentKBCode,
		DocumentCode:      "DOC1",
		DocumentName:      "demo.md",
		DocumentType:      2,
		DocType:           2,
		Content:           "hello runtime similarity",
		Score:             0.92,
		WordCount:         14,
	}}, nil
}

func (m *mockFragmentAppService) SimilarityByAgent(_ context.Context, input *fragdto.AgentSimilarityInput) (*fragdto.AgentSimilarityResultDTO, error) {
	m.lastAgentSimilarity = input
	if m.agentSimilarityErr != nil {
		return nil, m.agentSimilarityErr
	}
	if m.agentSimilarityResult != nil {
		return m.agentSimilarityResult, nil
	}
	return &fragdto.AgentSimilarityResultDTO{
		HitCount:    1,
		ContextText: "[KB1:DOC1:8] demo.md: hello similarity",
		Hits: []*fragdto.SimilarityResultDTO{
			{
				ID:                8,
				CitationID:        "KB1:DOC1:8",
				KnowledgeBaseCode: testFragmentKBCode,
				KnowledgeCode:     testFragmentKBCode,
				DocumentCode:      "DOC1",
				DocumentName:      "demo.md",
				DocumentType:      2,
				DocType:           2,
				Content:           "hello similarity",
				Score:             0.91,
				WordCount:         12,
			},
		},
	}, nil
}

func (m *mockFragmentAppService) Preview(_ context.Context, input *fragdto.PreviewFragmentInput) ([]*fragdto.FragmentDTO, error) {
	m.lastPreviewInput = input
	if m.previewErr != nil {
		return nil, m.previewErr
	}
	return nil, nil
}

func (m *mockFragmentAppService) PreviewV2(_ context.Context, input *fragdto.PreviewFragmentInput) (*fragdto.FragmentPageResultDTO, error) {
	m.lastPreviewInput = input
	if m.previewErr != nil {
		return nil, m.previewErr
	}
	return &fragdto.FragmentPageResultDTO{
		List: []*fragdto.FragmentListItemDTO{
			{
				ID:                9,
				KnowledgeBaseCode: testFragmentKBCode,
				KnowledgeCode:     testFragmentKBCode,
				Creator:           "creator-1",
				Modifier:          "modifier-1",
				CreatedUID:        "created-uid-1",
				UpdatedUID:        "updated-uid-1",
				DocumentType:      2,
				DocType:           2,
			},
		},
		DocumentNodes: []fragdto.DocumentNodeDTO{{ID: 1, Text: "node"}},
	}, nil
}

func TestFragmentCreateRPCMapsInput(t *testing.T) {
	t.Parallel()

	appSvc := &mockFragmentAppService{}
	handler := knowledgesvc.NewFragmentRPCServiceWithDependencies(appSvc, logging.New())
	_, err := handler.CreateRPC(context.Background(), &dto.CreateFragmentRequest{
		KnowledgeCode: "kb-1",
		DocumentCode:  "",
		Content:       "hello",
		Metadata:      map[string]any{"file_id": "FILE-1"},
		BusinessID:    "BIZ-1",
		DataIsolation: dto.DataIsolation{
			OrganizationCode: "ORG1",
			UserID:           "U1",
		},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if appSvc.createCalls != 1 {
		t.Fatalf("expected create app service called once, got %d", appSvc.createCalls)
	}
	if appSvc.lastCreateInput == nil || appSvc.lastCreateInput.BusinessID != "BIZ-1" || appSvc.lastCreateInput.OrganizationCode != "ORG1" {
		t.Fatalf("unexpected create input: %#v", appSvc.lastCreateInput)
	}
}

func TestFragmentRPCIgnoresAgentScopeFields(t *testing.T) {
	t.Parallel()

	appSvc := &mockFragmentAppService{}
	handler := knowledgesvc.NewFragmentRPCServiceWithDependencies(appSvc, logging.New())

	create := jsonrpc.WrapTyped(handler.CreateRPC)
	if _, err := create(context.Background(), "svc.knowledge.fragment.create", jsonRawMessagef(`{
		"data_isolation": {"organization_code": "ORG1", "user_id": "U1"},
		"knowledge_code": "KB1",
		"content": "hello",
		"business_id": "BIZ-1",
		"agent_code": "%s"
	}`, testLegacyAgentCode)); err != nil {
		t.Fatalf("expected create to ignore agent_code, got %v", err)
	}

	show := jsonrpc.WrapTyped(handler.ShowRPC)
	if _, err := show(context.Background(), "svc.knowledge.fragment.show", jsonRawMessagef(`{
		"data_isolation": {"organization_code": "ORG1", "user_id": "U1"},
		"id": 7,
		"knowledge_code": "KB1",
		"document_code": "DOC1",
		"agent_code": "%s"
	}`, testLegacyAgentCode)); err != nil {
		t.Fatalf("expected show to ignore agent_code, got %v", err)
	}

	list := jsonrpc.WrapTyped(handler.ListRPC)
	if _, err := list(context.Background(), "svc.knowledge.fragment.queries", jsonRawMessagef(`{
		"data_isolation": {"organization_code": "ORG1", "user_id": "U1"},
		"knowledge_code": "KB1",
		"document_code": "DOC1",
		"agent_code": "%s",
		"page": {"offset": 0, "limit": 10}
	}`, testLegacyAgentCode)); err != nil {
		t.Fatalf("expected list to ignore agent_code, got %v", err)
	}

	destroy := jsonrpc.WrapTyped(handler.DestroyRPC)
	if _, err := destroy(context.Background(), "svc.knowledge.fragment.destroy", jsonRawMessagef(`{
		"data_isolation": {"organization_code": "ORG1", "user_id": "U1"},
		"id": 7,
		"knowledge_code": "KB1",
		"document_code": "DOC1",
		"agent_code": "%s"
	}`, testLegacyAgentCode)); err != nil {
		t.Fatalf("expected destroy to ignore agent_code, got %v", err)
	}

	similarity := jsonrpc.WrapTyped(handler.SimilarityRPC)
	if _, err := similarity(context.Background(), "svc.knowledge.fragment.similarity", jsonRawMessagef(`{
		"data_isolation": {"organization_code": "ORG1", "user_id": "U1"},
		"business_params": {"organization_code": "ORG1", "user_id": "U1"},
		"knowledge_code": "KB1",
		"query": "hello",
		"agent_code": "%s"
	}`, testLegacyAgentCode)); err != nil {
		t.Fatalf("expected similarity to ignore agent_code, got %v", err)
	}
}

func TestNewFragmentRPCService(t *testing.T) {
	t.Parallel()

	if handler := knowledgesvc.NewFragmentRPCService(nil, logging.New()); handler == nil {
		t.Fatal("expected non-nil fragment rpc handler")
	}
}

func TestFragmentDestroyRPC(t *testing.T) {
	t.Parallel()

	appSvc := &mockFragmentAppService{}
	handler := knowledgesvc.NewFragmentRPCServiceWithDependencies(appSvc, logging.New())
	result, err := handler.DestroyRPC(context.Background(), &dto.DestroyFragmentRequest{
		ID:            7,
		KnowledgeCode: "kb-1",
		DocumentCode:  "doc-1",
		DataIsolation: dto.DataIsolation{OrganizationCode: "ORG1"},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil || !(*result)["success"] {
		t.Fatalf("expected success response, got %#v", result)
	}
	if appSvc.destroyCalls != 1 {
		t.Fatalf("expected destroy app service called once, got %d", appSvc.destroyCalls)
	}
}

func TestFragmentDestroyRPCMapsBusinessError(t *testing.T) {
	t.Parallel()

	appSvc := &mockFragmentAppService{destroyErr: errEmbeddingBoom}
	handler := knowledgesvc.NewFragmentRPCServiceWithDependencies(appSvc, logging.New())
	_, err := handler.DestroyRPC(context.Background(), &dto.DestroyFragmentRequest{
		ID:            7,
		KnowledgeCode: "kb-1",
		DocumentCode:  "doc-1",
		DataIsolation: dto.DataIsolation{OrganizationCode: "ORG1"},
	})
	if err == nil {
		t.Fatal("expected error but got nil")
	}

	var bizErr *jsonrpc.BusinessError
	if !errors.As(err, &bizErr) {
		t.Fatalf("expected business error, got %T", err)
	}
	if appSvc.destroyCalls != 1 {
		t.Fatalf("expected destroy app service called once, got %d", appSvc.destroyCalls)
	}
}

func TestFragmentPreviewRPCAcceptsChunkSizeAboveLegacyLimit(t *testing.T) {
	t.Parallel()

	appSvc := &mockFragmentAppService{}
	handler := knowledgesvc.NewFragmentRPCServiceWithDependencies(appSvc, logging.New())
	result, err := handler.PreviewRPC(context.Background(), &dto.PreviewFragmentRequest{
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
	if appSvc.lastPreviewInput == nil {
		t.Fatal("expected preview input to be forwarded")
	}
	if result == nil {
		t.Fatal("expected preview result")
	}
	if len(result.List) != 1 || result.List[0].KnowledgeBaseCode != testFragmentKBCode || result.List[0].DocType != result.List[0].DocumentType {
		t.Fatalf("unexpected preview result: %#v", result)
	}
}

func TestFragmentPreviewRPCMapsTopLevelStrategyConfig(t *testing.T) {
	t.Parallel()

	appSvc := &mockFragmentAppService{}
	handler := knowledgesvc.NewFragmentRPCServiceWithDependencies(appSvc, logging.New())
	strategyConfig := &confighelper.StrategyConfigDTO{
		ParsingType:     1,
		ImageExtraction: false,
		TableExtraction: true,
		ImageOCR:        true,
	}

	if _, err := handler.PreviewRPC(context.Background(), &dto.PreviewFragmentRequest{
		StrategyConfig: strategyConfig,
	}); err != nil {
		t.Fatalf("preview rpc: %v", err)
	}
	if appSvc.lastPreviewInput == nil || appSvc.lastPreviewInput.StrategyConfig != strategyConfig {
		t.Fatalf("expected strategy config forwarded, got %#v", appSvc.lastPreviewInput)
	}
}

func TestFragmentSimilarityRPCRejectsTopKAboveLimit(t *testing.T) {
	t.Parallel()

	appSvc := &mockFragmentAppService{}
	handler := knowledgesvc.NewFragmentRPCServiceWithDependencies(appSvc, logging.New())
	wrapped := jsonrpc.WrapTyped(handler.SimilarityRPC)
	_, err := wrapped(context.Background(), "svc.knowledge.fragment.similarity", json.RawMessage(`{
		"top_k": 11,
		"data_isolation": {"organization_code": "ORG1", "user_id": "U1"},
		"business_params": {"organization_code": "ORG1", "user_id": "U1"},
		"knowledge_code": "KB1",
		"query": "hello"
	}`))
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
	if appSvc.lastSimilarityInput != nil {
		t.Fatal("expected similarity input to remain nil on validation failure")
	}
}

func TestFragmentSimilarityRPCUsesAppDefaultTopK(t *testing.T) {
	t.Parallel()

	appSvc := &mockFragmentAppService{}
	handler := knowledgesvc.NewFragmentRPCServiceWithDependencies(appSvc, logging.New())
	_, err := handler.SimilarityRPC(context.Background(), &dto.SimilarityRequest{
		TopK: 3,
		Filters: &dto.SimilarityFilters{
			DocumentCodes: []string{"DOC1"},
			DocumentTypes: []int{2},
			SectionPaths:  []string{"A > B"},
			SectionLevels: []int{2},
			Tags:          []string{"tag-1"},
			TimeRange:     &dto.SimilarityTimeRange{StartUnix: 1, EndUnix: 2},
		},
		DataIsolation: dto.DataIsolation{
			OrganizationCode: "ORG1",
			UserID:           "U1",
		},
		BusinessParams: dto.BusinessParams{
			OrganizationCode: "ORG1",
			UserID:           "U1",
		},
	})
	if err != nil {
		t.Fatalf("expected request to pass through, got %v", err)
	}
	if appSvc.lastSimilarityInput == nil {
		t.Fatal("expected similarity input to be forwarded")
	}
	if appSvc.lastSimilarityInput.TopK != 0 {
		t.Fatalf("expected forwarded topK to use app default sentinel 0, got %d", appSvc.lastSimilarityInput.TopK)
	}
	if appSvc.lastSimilarityInput.Filters == nil || appSvc.lastSimilarityInput.Filters.TimeRange == nil || appSvc.lastSimilarityInput.Filters.TimeRange.EndUnix != 2 {
		t.Fatalf("expected similarity filters to be forwarded, got %#v", appSvc.lastSimilarityInput.Filters)
	}
	result, err := handler.SimilarityRPC(context.Background(), &dto.SimilarityRequest{
		TopK: 3,
		DataIsolation: dto.DataIsolation{
			OrganizationCode: "ORG1",
			UserID:           "U1",
		},
		BusinessParams: dto.BusinessParams{
			OrganizationCode: "ORG1",
			UserID:           "U1",
		},
	})
	if err != nil {
		t.Fatalf("expected similarity result, got %v", err)
	}
	if len(result.List) != 1 || result.List[0].ID != "8" || result.List[0].KnowledgeBaseCode != testFragmentKBCode || result.List[0].DocType != result.List[0].DocumentType {
		t.Fatalf("unexpected similarity response: %#v", result)
	}
}

func TestFragmentSimilarityByAgentRPC(t *testing.T) {
	t.Parallel()

	appSvc := &mockFragmentAppService{}
	handler := knowledgesvc.NewFragmentRPCServiceWithDependencies(appSvc, logging.New())
	result, err := handler.SimilarityByAgentRPC(context.Background(), &dto.AgentSimilarityRequest{
		DataIsolation: dto.DataIsolation{
			OrganizationCode: "ORG1",
			UserID:           "U1",
		},
		AgentCode: "SMA-001",
		Query:     "修复 package manage 页面报错",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if appSvc.lastAgentSimilarity == nil || appSvc.lastAgentSimilarity.AgentCode != "SMA-001" {
		t.Fatalf("expected agent similarity input to be forwarded, got %#v", appSvc.lastAgentSimilarity)
	}
	if appSvc.lastAgentSimilarity.BusinessParams == nil ||
		appSvc.lastAgentSimilarity.BusinessParams.OrganizationCode != "ORG1" ||
		appSvc.lastAgentSimilarity.BusinessParams.UserID != "U1" {
		t.Fatalf("expected business params to be forwarded, got %#v", appSvc.lastAgentSimilarity.BusinessParams)
	}
	if result == nil || result.HitCount != 1 || len(result.Documents) != 1 {
		t.Fatalf("unexpected agent similarity response: %#v", result)
	}
	document := result.Documents[0]
	if document.KnowledgeCode != testFragmentKBCode || document.DocumentCode != "DOC1" || document.DocumentName != "demo.md" {
		t.Fatalf("unexpected document projection: %#v", document)
	}
	if len(document.Snippets) != 1 || document.Snippets[0].Text != "hello similarity" || document.Snippets[0].Score != 0.91 {
		t.Fatalf("unexpected nested snippets: %#v", document.Snippets)
	}
	assertAgentSimilarityResponsePayload(t, result)
}

func assertAgentSimilarityResponsePayload(t *testing.T, result *dto.AgentSimilarityResponse) {
	t.Helper()

	payload, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("marshal response: %v", err)
	}
	var decoded map[string]any
	if err := json.Unmarshal(payload, &decoded); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	for _, key := range []string{"query_used", "context_text", "hits", "metadata", "snippets"} {
		if _, ok := decoded[key]; ok {
			t.Fatalf("response should not include %q: %s", key, string(payload))
		}
	}
	for _, fragment := range []string{`"citation_id"`, `"metadata"`} {
		if strings.Contains(string(payload), fragment) {
			t.Fatalf("response should not include %s: %s", fragment, string(payload))
		}
	}
}

func TestFragmentSimilarityByAgentRPCGroupsDocuments(t *testing.T) {
	t.Parallel()

	appSvc := &mockFragmentAppService{
		agentSimilarityResult: &fragdto.AgentSimilarityResultDTO{
			Hits: []*fragdto.SimilarityResultDTO{
				nil,
				{
					ID:                42,
					KnowledgeBaseCode: "KB-FALLBACK",
					DocumentCode:      "DOC-FALLBACK",
					DocumentName:      "fallback.md",
					Content:           "fallback content",
					Score:             0.724,
				},
				{
					ID:                43,
					KnowledgeBaseCode: "KB-FALLBACK",
					DocumentCode:      "DOC-FALLBACK",
					DocumentName:      "fallback.md",
					Content:           "second fallback content",
					Score:             0.626,
				},
				{
					ID:            44,
					KnowledgeCode: "KB-SECOND",
					DocumentCode:  "DOC-SECOND",
					DocumentName:  "second.md",
					Content:       "second document content",
					Score:         0.524,
				},
			},
		},
	}
	handler := knowledgesvc.NewFragmentRPCServiceWithDependencies(appSvc, logging.New())
	result, err := handler.SimilarityByAgentRPC(context.Background(), &dto.AgentSimilarityRequest{
		DataIsolation: dto.DataIsolation{
			OrganizationCode: "ORG1",
			UserID:           "U1",
		},
		AgentCode: "SMA-001",
		Query:     "录音纪要",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil || result.HitCount != 3 || len(result.Documents) != 2 {
		t.Fatalf("unexpected fallback response: %#v", result)
	}
	firstDocument := result.Documents[0]
	if firstDocument.KnowledgeCode != "KB-FALLBACK" || firstDocument.DocumentCode != "DOC-FALLBACK" || firstDocument.DocumentName != "fallback.md" {
		t.Fatalf("unexpected fallback document: %#v", firstDocument)
	}
	if len(firstDocument.Snippets) != 2 ||
		firstDocument.Snippets[0].Text != "fallback content" ||
		firstDocument.Snippets[0].Score != 0.72 ||
		firstDocument.Snippets[1].Text != "second fallback content" ||
		firstDocument.Snippets[1].Score != 0.63 {
		t.Fatalf("expected snippets to preserve hit order: %#v", firstDocument.Snippets)
	}
	secondDocument := result.Documents[1]
	if secondDocument.KnowledgeCode != "KB-SECOND" || secondDocument.DocumentCode != "DOC-SECOND" || secondDocument.DocumentName != "second.md" {
		t.Fatalf("unexpected second document: %#v", secondDocument)
	}
	if len(secondDocument.Snippets) != 1 ||
		secondDocument.Snippets[0].Text != "second document content" ||
		secondDocument.Snippets[0].Score != 0.52 {
		t.Fatalf("unexpected second document snippets: %#v", secondDocument.Snippets)
	}
}

func TestFragmentShowAndListRPC(t *testing.T) {
	t.Parallel()

	appSvc := &mockFragmentAppService{}
	handler := knowledgesvc.NewFragmentRPCServiceWithDependencies(appSvc, logging.New())

	if _, err := handler.ShowRPC(context.Background(), &dto.ShowFragmentRequest{
		ID: 7,
		DataIsolation: dto.DataIsolation{
			OrganizationID: "ORG1",
		},
		KnowledgeCode: "KB1",
		DocumentCode:  "DOC1",
	}); err != nil {
		t.Fatalf("expected show success, got %v", err)
	}

	listResult, err := handler.ListRPC(context.Background(), &dto.ListFragmentRequest{
		DataIsolation: dto.DataIsolation{
			OrganizationCode: "ORG1",
		},
		KnowledgeCode: "KB1",
		DocumentCode:  "DOC1",
		Page: dto.PageParams{
			Offset: 1,
			Limit:  5,
		},
	})
	if err != nil {
		t.Fatalf("expected list success, got %v", err)
	}
	if listResult == nil {
		t.Fatal("expected list result")
	}
	if len(listResult.List) != 1 || listResult.List[0].KnowledgeBaseCode != testFragmentKBCode || listResult.List[0].Creator != "creator-1" || listResult.List[0].DocType != listResult.List[0].DocumentType {
		t.Fatalf("unexpected list result: %#v", listResult)
	}
}

func TestFragmentSyncRPCDisabled(t *testing.T) {
	t.Parallel()

	appSvc := &mockFragmentAppService{syncErr: errEmbeddingBoom}
	handler := knowledgesvc.NewFragmentRPCServiceWithDependencies(appSvc, logging.New())

	_, err := handler.SyncRPC(context.Background(), &dto.SyncFragmentRequest{
		FragmentID:     7,
		KnowledgeCode:  "KB1",
		DataIsolation:  dto.DataIsolation{OrganizationCode: "ORG1"},
		BusinessParams: dto.BusinessParams{OrganizationCode: "ORG1", UserID: "U1", BusinessID: "B1"},
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
	if bizErr.Message != fragmentapp.ErrFragmentWriteDisabled.Error() {
		t.Fatalf("expected disabled message, got %q", bizErr.Message)
	}
	if appSvc.syncCalls != 0 {
		t.Fatalf("expected sync app service not called, got %d", appSvc.syncCalls)
	}
}

func TestFragmentRPCMapsShowListSimilarityAndPreviewErrors(t *testing.T) {
	t.Parallel()

	appSvc := &mockFragmentAppService{
		showErr:       errEmbeddingBoom,
		listErr:       errEmbeddingBoom,
		similarityErr: errEmbeddingBoom,
		previewErr:    errEmbeddingBoom,
	}
	handler := knowledgesvc.NewFragmentRPCServiceWithDependencies(appSvc, logging.New())

	if _, err := handler.ShowRPC(context.Background(), &dto.ShowFragmentRequest{}); err == nil {
		t.Fatal("expected show error")
	}
	if _, err := handler.ListRPC(context.Background(), &dto.ListFragmentRequest{}); err == nil {
		t.Fatal("expected list error")
	}
	if _, err := handler.SimilarityRPC(context.Background(), &dto.SimilarityRequest{
		BusinessParams: dto.BusinessParams{OrganizationCode: "ORG1"},
		DataIsolation:  dto.DataIsolation{OrganizationCode: "ORG1"},
	}); err == nil {
		t.Fatal("expected similarity error")
	}
	if _, err := handler.PreviewRPC(context.Background(), &dto.PreviewFragmentRequest{}); err == nil {
		t.Fatal("expected preview error")
	}
}

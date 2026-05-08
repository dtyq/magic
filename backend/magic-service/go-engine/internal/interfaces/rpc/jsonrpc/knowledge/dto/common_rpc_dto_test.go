package dto_test

import (
	"encoding/json"
	"testing"

	"magic/internal/interfaces/rpc/jsonrpc/knowledge/dto"
)

const errUserIDRequired = "[31001] data_isolation.user_id is required"

func TestBusinessParamsResolveOrganizationCode(t *testing.T) {
	t.Parallel()

	if got := (dto.BusinessParams{OrganizationCode: "org-new", OrganizationID: "org-old"}).ResolveOrganizationCode(); got != "org-new" {
		t.Fatalf("expected organization_code preferred, got %q", got)
	}
	if got := (dto.BusinessParams{OrganizationID: "org-old"}).ResolveOrganizationCode(); got != "org-old" {
		t.Fatalf("expected organization_id fallback, got %q", got)
	}
}

func TestDataIsolationResolveOrganizationCode(t *testing.T) {
	t.Parallel()

	if got := (dto.DataIsolation{OrganizationCode: "org-new", OrganizationID: "org-old"}).ResolveOrganizationCode(); got != "org-new" {
		t.Fatalf("expected organization_code preferred, got %q", got)
	}
	if got := (dto.DataIsolation{OrganizationID: "org-old"}).ResolveOrganizationCode(); got != "org-old" {
		t.Fatalf("expected organization_id fallback, got %q", got)
	}
}

func TestDataIsolationUnmarshalAcceptsThirdPlatformFields(t *testing.T) {
	t.Parallel()

	var got dto.DataIsolation
	err := json.Unmarshal([]byte(`{
		"organization_code": "ORG-1",
		"user_id": "user-1",
		"third_platform_user_id": "tp-user-1",
		"third_platform_organization_code": "tp-org-1"
	}`), &got)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if got.ThirdPlatformUserID != "tp-user-1" {
		t.Fatalf("expected third_platform_user_id preserved, got %q", got.ThirdPlatformUserID)
	}
	if got.ThirdPlatformOrganizationCode != "tp-org-1" {
		t.Fatalf("expected third_platform_organization_code preserved, got %q", got.ThirdPlatformOrganizationCode)
	}
}

func TestCreateKnowledgeBaseRequestValidateRequiresUserID(t *testing.T) {
	t.Parallel()

	err := (dto.CreateKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: "ORG-1"},
		Name:          "知识库",
	}).Validate()
	if err == nil || err.Error() != errUserIDRequired {
		t.Fatalf("expected user_id required error, got %v", err)
	}
}

func TestCreateKnowledgeBaseRequestValidateRejectsBlankAgentCodes(t *testing.T) {
	t.Parallel()

	err := (dto.CreateKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: "ORG-1", UserID: "user-1"},
		Name:          "知识库",
		AgentCodes:    []string{"   "},
	}).Validate()
	if err == nil || err.Error() != "[31001] agent_codes[0] is required" {
		t.Fatalf("expected blank agent_codes error, got %v", err)
	}
}

func TestCreateKnowledgeBaseRequestValidateRejectsBlankName(t *testing.T) {
	t.Parallel()

	err := (dto.CreateKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: "ORG-1", UserID: "user-1"},
		Name:          "   ",
	}).Validate()
	if err == nil || err.Error() != "[31001] name is required" {
		t.Fatalf("expected blank name error, got %v", err)
	}
}

func TestCreateKnowledgeBaseRequestValidateAllowsMissingSourceTypeBeforeProductLineResolution(t *testing.T) {
	t.Parallel()

	err := (dto.CreateKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: "ORG-1", UserID: "user-1"},
		Name:          "知识库",
		AgentCodes:    []string{"SMA-1"},
	}).Validate()
	if err != nil {
		t.Fatalf("expected RPC validation to defer source_type requiredness to app layer, got %v", err)
	}
}

func TestCreateKnowledgeBaseRequestValidateAcceptsUnifiedKnowledgeBaseSourceTypeSet(t *testing.T) {
	t.Parallel()

	for _, sourceType := range []int{1, 2, 3, 4, 1001} {
		err := (dto.CreateKnowledgeBaseRequest{
			DataIsolation: dto.DataIsolation{OrganizationCode: "ORG-1", UserID: "user-1"},
			Name:          "知识库",
			SourceType:    &sourceType,
		}).Validate()
		if err != nil {
			t.Fatalf("expected source_type=%d accepted at RPC boundary, got %v", sourceType, err)
		}
	}
}

func TestShowKnowledgeBaseRequestValidateRequiresUserID(t *testing.T) {
	t.Parallel()

	err := (dto.ShowKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: "ORG-1"},
		Code:          "KB-1",
	}).Validate()
	if err == nil || err.Error() != errUserIDRequired {
		t.Fatalf("expected show user_id required error, got %v", err)
	}
}

func TestListKnowledgeBaseRequestValidateRequiresUserID(t *testing.T) {
	t.Parallel()

	err := (dto.ListKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: "ORG-1"},
		Limit:         10,
	}).Validate()
	if err == nil || err.Error() != errUserIDRequired {
		t.Fatalf("expected list user_id required error, got %v", err)
	}
}

func TestDestroyKnowledgeBaseRequestValidateRequiresUserID(t *testing.T) {
	t.Parallel()

	err := (dto.DestroyKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: "ORG-1"},
		Code:          "KB-1",
	}).Validate()
	if err == nil || err.Error() != errUserIDRequired {
		t.Fatalf("expected destroy user_id required error, got %v", err)
	}
}

func TestInferableRequestsIgnoreAgentScopeFields(t *testing.T) {
	t.Parallel()

	t.Run("knowledge base show ignores agent_code", func(t *testing.T) {
		t.Parallel()

		var req dto.ShowKnowledgeBaseRequest
		err := json.Unmarshal([]byte(`{
			"data_isolation": {"organization_code": "ORG-1", "user_id": "user-1"},
			"code": "KB-1",
			"agent_code": "SMA-1"
		}`), &req)
		if err != nil {
			t.Fatalf("expected agent_code ignored, got %v", err)
		}
	})

	t.Run("document show ignores agent_codes", func(t *testing.T) {
		t.Parallel()

		var req dto.ShowDocumentRequest
		err := json.Unmarshal([]byte(`{
			"data_isolation": {"organization_code": "ORG-1", "user_id": "user-1"},
			"code": "DOC-1",
			"knowledge_base_code": "KB-1",
			"agent_codes": ["SMA-1"]
		}`), &req)
		if err != nil {
			t.Fatalf("expected agent_codes ignored, got %v", err)
		}
	})

	t.Run("fragment similarity ignores agent_code", func(t *testing.T) {
		t.Parallel()

		var req dto.SimilarityRequest
		err := json.Unmarshal([]byte(`{
			"data_isolation": {"organization_code": "ORG-1", "user_id": "user-1"},
			"business_params": {"organization_code": "ORG-1", "user_id": "user-1"},
			"knowledge_code": "KB-1",
			"query": "hello",
			"agent_code": "SMA-1"
		}`), &req)
		if err != nil {
			t.Fatalf("expected agent_code ignored, got %v", err)
		}
	})
}

func TestListSourceBindingNodesRequestValidateRequiresUserID(t *testing.T) {
	t.Parallel()

	err := (dto.ListSourceBindingNodesRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: "ORG-1"},
		SourceType:    "project",
		ParentType:    "root",
		Limit:         20,
	}).Validate()
	if err == nil || err.Error() != errUserIDRequired {
		t.Fatalf("expected nodes user_id required error, got %v", err)
	}
}

func TestListSourceBindingNodesRequestCompatMapsPageWindow(t *testing.T) {
	t.Parallel()

	var req dto.ListSourceBindingNodesRequest
	err := json.Unmarshal([]byte(`{
		"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
		"source_type":"teamshare",
		"parent_type":"knowledge_base",
		"parent_ref":"KB-1",
		"page":3,
		"page_size":15
	}`), &req)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if req.Offset != 30 || req.Limit != 15 {
		t.Fatalf("expected page/page_size mapped to offset=30 limit=15, got %#v", req)
	}
}

func TestListSourceBindingNodesRequestCompatUsesExplicitOffsetLimit(t *testing.T) {
	t.Parallel()

	var req dto.ListSourceBindingNodesRequest
	err := json.Unmarshal([]byte(`{
		"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
		"source_type":"teamshare",
		"parent_type":"knowledge_base",
		"parent_ref":"KB-1",
		"page":3,
		"page_size":15,
		"offset":5,
		"limit":7
	}`), &req)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if req.Offset != 5 || req.Limit != 7 {
		t.Fatalf("expected explicit offset/limit preferred, got %#v", req)
	}
}

func TestListSourceBindingNodesRequestCompatAcceptsStringPagination(t *testing.T) {
	t.Parallel()

	var req dto.ListSourceBindingNodesRequest
	err := json.Unmarshal([]byte(`{
		"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
		"source_type":"project",
		"parent_type":"root",
		"page":"2",
		"page_size":"20"
	}`), &req)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if req.Offset != 20 || req.Limit != 20 {
		t.Fatalf("expected string page/page_size mapped to offset=20 limit=20, got %#v", req)
	}
}

func TestListKnowledgeBaseRequestCompatAcceptsSearchTypeAndStringPagination(t *testing.T) {
	t.Parallel()

	var req dto.ListKnowledgeBaseRequest
	err := json.Unmarshal([]byte(`{
		"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
		"search_type":"3",
		"page":"2",
		"page_size":"50"
	}`), &req)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if req.Enabled == nil || *req.Enabled {
		t.Fatalf("expected search_type=3 mapped to enabled=false, got %#v", req.Enabled)
	}
	if req.Offset != 50 || req.Limit != 50 {
		t.Fatalf("expected string page/page_size mapped to offset=50 limit=50, got %#v", req)
	}
}

func TestRebuildCleanupRequestCompatUsesPHPBoolTruthiness(t *testing.T) {
	t.Parallel()

	var req dto.RebuildCleanupRequest
	err := json.Unmarshal([]byte(`{
		"data_isolation":{"organization_code":"ORG-1"},
		"apply":"0",
		"force_delete_non_empty":"false"
	}`), &req)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if req.Apply {
		t.Fatalf("expected apply to be false, got %#v", req)
	}
	if !req.ForceDeleteNonEmpty {
		t.Fatalf("expected force_delete_non_empty to keep PHP truthiness, got %#v", req)
	}
}

func TestListDocumentRequestCompatAcceptsTopLevelStringPagination(t *testing.T) {
	t.Parallel()

	var req dto.ListDocumentRequest
	err := json.Unmarshal([]byte(`{
		"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
		"organization_code":"ORG-1",
		"knowledge_base_code":"KB-1",
		"sync_status":"2",
		"page":"3",
		"page_size":"25"
	}`), &req)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if req.SyncStatus == nil || *req.SyncStatus != 2 {
		t.Fatalf("expected sync_status=2, got %#v", req.SyncStatus)
	}
	if req.Page.Offset != 50 || req.Page.Limit != 25 {
		t.Fatalf("expected string page/page_size mapped to offset=50 limit=25, got %#v", req.Page)
	}
}

func TestSyncDocumentRequestCompatAcceptsStringAsync(t *testing.T) {
	t.Parallel()

	var req dto.SyncDocumentRequest
	err := json.Unmarshal([]byte(`{
		"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
		"business_params":{"organization_code":"ORG-1","user_id":"user-1"},
		"knowledge_base_code":"KB-1",
		"code":"DOC-1",
		"async":"true"
	}`), &req)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if !req.Async {
		t.Fatalf("expected async=true for PHP truth semantics, got %#v", req)
	}
}

func TestListFragmentRequestCompatAcceptsTopLevelStringPagination(t *testing.T) {
	t.Parallel()

	var req dto.ListFragmentRequest
	err := json.Unmarshal([]byte(`{
		"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
		"knowledge_code":"KB-1",
		"document_code":"DOC-1",
		"sync_status":"1",
		"version":"2",
		"page":"4",
		"page_size":"10"
	}`), &req)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if req.SyncStatus == nil || *req.SyncStatus != 1 || req.Version == nil || *req.Version != 2 {
		t.Fatalf("unexpected compat scalar fields: %#v", req)
	}
	if req.Page.Offset != 30 || req.Page.Limit != 10 {
		t.Fatalf("expected string page/page_size mapped to offset=30 limit=10, got %#v", req.Page)
	}
}

func TestFragmentCarrierRequestsCompatAcceptStringIDs(t *testing.T) {
	t.Parallel()

	t.Run("show", func(t *testing.T) {
		t.Parallel()

		var req dto.ShowFragmentRequest
		err := json.Unmarshal([]byte(`{
			"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
			"id":"7",
			"knowledge_code":"KB-1",
			"document_code":"DOC-1"
		}`), &req)
		if err != nil {
			t.Fatalf("json.Unmarshal() error = %v", err)
		}
		if req.ID != 7 {
			t.Fatalf("expected id=7, got %#v", req)
		}
	})

	t.Run("destroy", func(t *testing.T) {
		t.Parallel()

		var req dto.DestroyFragmentRequest
		err := json.Unmarshal([]byte(`{
			"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
			"id":"8",
			"knowledge_code":"KB-1",
			"document_code":"DOC-1"
		}`), &req)
		if err != nil {
			t.Fatalf("json.Unmarshal() error = %v", err)
		}
		if req.ID != 8 {
			t.Fatalf("expected id=8, got %#v", req)
		}
	})

	t.Run("sync", func(t *testing.T) {
		t.Parallel()

		var req dto.SyncFragmentRequest
		err := json.Unmarshal([]byte(`{
			"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
			"knowledge_code":"KB-1",
			"fragment_id":"9",
			"business_params":{"organization_code":"ORG-1","user_id":"user-1"}
		}`), &req)
		if err != nil {
			t.Fatalf("json.Unmarshal() error = %v", err)
		}
		if req.FragmentID != 9 {
			t.Fatalf("expected fragment_id=9, got %#v", req)
		}
	})

	t.Run("sync legacy id", func(t *testing.T) {
		t.Parallel()

		var req dto.SyncFragmentRequest
		err := json.Unmarshal([]byte(`{
			"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
			"knowledge_code":"KB-1",
			"id":"11",
			"business_params":{"organization_code":"ORG-1","user_id":"user-1"}
		}`), &req)
		if err != nil {
			t.Fatalf("json.Unmarshal() error = %v", err)
		}
		if req.FragmentID != 11 {
			t.Fatalf("expected legacy id to map to fragment_id=11, got %#v", req)
		}
	})
}

func TestSyncFragmentBatchRequestCompatAcceptsStringIDs(t *testing.T) {
	t.Parallel()

	var req dto.SyncFragmentBatchRequest
	err := json.Unmarshal([]byte(`{
		"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
		"knowledge_code":"KB-1",
		"fragment_ids":["1","2","3"]
	}`), &req)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if len(req.FragmentIDs) != 3 || req.FragmentIDs[0] != 1 || req.FragmentIDs[2] != 3 {
		t.Fatalf("expected fragment_ids converted, got %#v", req.FragmentIDs)
	}
}

func TestFragmentCarrierRequestsCompatPreserveLargeNumericIDs(t *testing.T) {
	t.Parallel()

	t.Run("show", func(t *testing.T) {
		t.Parallel()

		var req dto.ShowFragmentRequest
		err := json.Unmarshal([]byte(`{
			"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
			"id":904787325064802305,
			"knowledge_code":"KB-1",
			"document_code":"DOC-1"
		}`), &req)
		if err != nil {
			t.Fatalf("json.Unmarshal() error = %v", err)
		}
		if req.ID != 904787325064802305 {
			t.Fatalf("expected id preserved, got %#v", req)
		}
	})

	t.Run("batch", func(t *testing.T) {
		t.Parallel()

		var req dto.SyncFragmentBatchRequest
		err := json.Unmarshal([]byte(`{
			"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
			"knowledge_code":"KB-1",
			"fragment_ids":[904787325064802305,904787325064802306]
		}`), &req)
		if err != nil {
			t.Fatalf("json.Unmarshal() error = %v", err)
		}
		if len(req.FragmentIDs) != 2 || req.FragmentIDs[0] != 904787325064802305 || req.FragmentIDs[1] != 904787325064802306 {
			t.Fatalf("expected large fragment_ids preserved, got %#v", req.FragmentIDs)
		}
	})

	t.Run("sync", func(t *testing.T) {
		t.Parallel()

		var req dto.SyncFragmentRequest
		err := json.Unmarshal([]byte(`{
			"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
			"knowledge_code":"KB-1",
			"fragment_id":904787325064802305,
			"business_params":{"organization_code":"ORG-1","user_id":"user-1"}
		}`), &req)
		if err != nil {
			t.Fatalf("json.Unmarshal() error = %v", err)
		}
		if req.FragmentID != 904787325064802305 {
			t.Fatalf("expected fragment_id preserved, got %#v", req)
		}
	})

	t.Run("sync legacy id", func(t *testing.T) {
		t.Parallel()

		var req dto.SyncFragmentRequest
		err := json.Unmarshal([]byte(`{
			"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
			"knowledge_code":"KB-1",
			"id":904787325064802305,
			"business_params":{"organization_code":"ORG-1","user_id":"user-1"}
		}`), &req)
		if err != nil {
			t.Fatalf("json.Unmarshal() error = %v", err)
		}
		if req.FragmentID != 904787325064802305 {
			t.Fatalf("expected legacy id preserved, got %#v", req)
		}
	})
}

func TestSimilarityFiltersCompatAcceptsStringNumericFields(t *testing.T) {
	t.Parallel()

	var req dto.SimilarityRequest
	err := json.Unmarshal([]byte(`{
		"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
		"business_params":{"organization_code":"ORG-1","user_id":"user-1"},
		"knowledge_code":"KB-1",
		"query":"hello",
		"filters":{
			"document_types":["1","2"],
			"section_levels":["3"],
			"time_range":{"start_unix":"10","end_unix":"20"}
		}
	}`), &req)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if req.Filters == nil {
		t.Fatal("expected filters")
	}
	if len(req.Filters.DocumentTypes) != 2 || req.Filters.DocumentTypes[0] != 1 || req.Filters.DocumentTypes[1] != 2 {
		t.Fatalf("unexpected document_types %#v", req.Filters.DocumentTypes)
	}
	if len(req.Filters.SectionLevels) != 1 || req.Filters.SectionLevels[0] != 3 {
		t.Fatalf("unexpected section_levels %#v", req.Filters.SectionLevels)
	}
	if req.Filters.TimeRange == nil || req.Filters.TimeRange.StartUnix != 10 || req.Filters.TimeRange.EndUnix != 20 {
		t.Fatalf("unexpected time_range %#v", req.Filters.TimeRange)
	}
}

func TestNotifyProjectFileChangeRequestCompatAcceptsStringProjectFileID(t *testing.T) {
	t.Parallel()

	var req dto.NotifyProjectFileChangeRequest
	err := json.Unmarshal([]byte(`{"project_file_id":"42"}`), &req)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if req.ProjectFileID != 42 {
		t.Fatalf("expected project_file_id=42, got %#v", req)
	}
}

func TestNotifyProjectFileChangeRequestCompatPreservesLargeNumericProjectFileID(t *testing.T) {
	t.Parallel()

	var req dto.NotifyProjectFileChangeRequest
	err := json.Unmarshal([]byte(`{"project_file_id":904787325064802305}`), &req)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if req.ProjectFileID != 904787325064802305 {
		t.Fatalf("expected project_file_id=904787325064802305, got %#v", req)
	}
}

func TestNotifyProjectFileChangeRequestCompatAcceptsDeletedContext(t *testing.T) {
	t.Parallel()

	var req dto.NotifyProjectFileChangeRequest
	err := json.Unmarshal([]byte(`{
		"project_file_id":"42",
		"organization_code":"ORG1",
		"project_id":"900",
		"status":"deleted"
	}`), &req)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if req.ProjectFileID != 42 ||
		req.OrganizationCode != "ORG1" ||
		req.ProjectID != 900 ||
		req.Status != "deleted" {
		t.Fatalf("expected deleted context preserved, got %#v", req)
	}
}

func TestSourceBindingPayloadCompatUsesPHPBoolTruthiness(t *testing.T) {
	t.Parallel()

	var payload dto.SourceBindingPayload
	err := json.Unmarshal([]byte(`{
		"provider":"teamshare",
		"root_type":"space",
		"root_ref":"SPACE-1",
		"sync_mode":"incremental",
		"enabled":"false"
	}`), &payload)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if payload.Enabled == nil || !*payload.Enabled {
		t.Fatalf("expected enabled=\"false\" to keep PHP truthiness, got %#v", payload.Enabled)
	}
}

func TestSourceBindingPayloadCompatAcceptsNumericIDFields(t *testing.T) {
	t.Parallel()

	var payload dto.SourceBindingPayload
	err := json.Unmarshal([]byte(`{
		"provider":"teamshare",
		"root_type":"knowledge_base",
		"root_ref":904787325064802305,
		"workspace_id":904787325064802306,
		"sync_mode":"manual",
		"targets":[{"target_type":"file","target_ref":904787325064802307}],
		"sync_config":{
			"root_context":{"knowledge_base_id":904787325064802308},
			"document_file":{
				"third_file_id":904787325064802309,
				"knowledge_base_id":904787325064802310,
				"project_file_id":904787325064802311
			}
		}
	}`), &payload)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if payload.RootRef != "904787325064802305" {
		t.Fatalf("expected root_ref preserved, got %#v", payload.RootRef)
	}
	if payload.WorkspaceID == nil || *payload.WorkspaceID != "904787325064802306" {
		t.Fatalf("expected workspace_id preserved, got %#v", payload.WorkspaceID)
	}
	if len(payload.Targets) != 1 || payload.Targets[0].TargetRef != "904787325064802307" {
		t.Fatalf("expected target_ref preserved, got %#v", payload.Targets)
	}
	rootContext, _ := map[string]any(payload.SyncConfig)["root_context"].(map[string]any)
	if rootContext["knowledge_base_id"] != "904787325064802308" {
		t.Fatalf("expected root_context knowledge_base_id preserved, got %#v", payload.SyncConfig)
	}
	documentFile, _ := map[string]any(payload.SyncConfig)["document_file"].(map[string]any)
	if documentFile["third_file_id"] != "904787325064802309" ||
		documentFile["knowledge_base_id"] != "904787325064802310" ||
		documentFile["project_file_id"] != "904787325064802311" {
		t.Fatalf("expected nested document_file ids preserved, got %#v", documentFile)
	}
}

func TestListSourceBindingNodesRequestCompatAcceptsNumericParentRef(t *testing.T) {
	t.Parallel()

	var req dto.ListSourceBindingNodesRequest
	err := json.Unmarshal([]byte(`{
		"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
		"source_type":"teamshare",
		"parent_type":"knowledge_base",
		"parent_ref":904787325064802305
	}`), &req)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if req.ParentRef != "904787325064802305" {
		t.Fatalf("expected parent_ref preserved, got %#v", req.ParentRef)
	}
}

func TestNotifyProjectFileChangeRequestCompatRejectsInvalidString(t *testing.T) {
	t.Parallel()

	var req dto.NotifyProjectFileChangeRequest
	err := json.Unmarshal([]byte(`{"project_file_id":"not-a-number"}`), &req)
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestRebuildKnowledgeBaseRequestValidateDoesNotRequireUserID(t *testing.T) {
	t.Parallel()

	err := (dto.RebuildKnowledgeBaseRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: "ORG-1"},
	}).Validate()
	if err != nil {
		t.Fatalf("expected rebuild request without user_id to pass validation, got %v", err)
	}
}

func TestRepairSourceBindingsRequestValidateDoesNotRequireUserID(t *testing.T) {
	t.Parallel()

	err := (dto.RepairSourceBindingsRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: "ORG-1"},
	}).Validate()
	if err != nil {
		t.Fatalf("expected repair request without user_id to pass validation, got %v", err)
	}
}

func TestRepairSourceBindingsRequestValidateOrganizationCodes(t *testing.T) {
	t.Parallel()

	err := (dto.RepairSourceBindingsRequest{
		DataIsolation:     dto.DataIsolation{OrganizationCode: "ORG-1"},
		OrganizationCodes: []string{"ORG-1", "ORG-2"},
	}).Validate()
	if err != nil {
		t.Fatalf("expected repair request with organization_codes to pass validation, got %v", err)
	}

	err = (dto.RepairSourceBindingsRequest{
		DataIsolation:     dto.DataIsolation{OrganizationCode: "ORG-1"},
		OrganizationCodes: []string{"ORG-1", " "},
	}).Validate()
	if err == nil {
		t.Fatal("expected blank organization code to fail validation")
	}
}

func TestRebuildCleanupRequestValidateDoesNotRequireUserID(t *testing.T) {
	t.Parallel()

	err := (dto.RebuildCleanupRequest{
		DataIsolation: dto.DataIsolation{OrganizationCode: "ORG-1"},
	}).Validate()
	if err != nil {
		t.Fatalf("expected rebuild cleanup request without user_id to pass validation, got %v", err)
	}
}

func TestStrategyConfigCompatTreatsEmptyContainersAsNilForPreviewFragmentRequest(t *testing.T) {
	t.Parallel()

	t.Run("empty array", func(t *testing.T) {
		t.Parallel()
		req := unmarshalStrategyConfigCompatTarget(t, `{"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},"strategy_config":[]}`, &dto.PreviewFragmentRequest{})
		assertPreviewFragmentStrategyConfigNil(t, req)
	})

	t.Run("quoted empty array", func(t *testing.T) {
		t.Parallel()
		req := unmarshalStrategyConfigCompatTarget(t, `{"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},"strategy_config":"[]"}`, &dto.PreviewFragmentRequest{})
		assertPreviewFragmentStrategyConfigNil(t, req)
	})
}

func TestStrategyConfigCompatPreservesAcceptEncodingForPreviewFragmentRequest(t *testing.T) {
	t.Parallel()

	req := unmarshalStrategyConfigCompatTarget(t, `{
		"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
		"document_code":"DOC-1",
		"accept_encoding":"gzip, deflate, br",
		"strategy_config":{"parsing_type":1},
		"fragment_config":{"mode":2}
	}`, &dto.PreviewFragmentRequest{})

	previewReq, ok := req.(*dto.PreviewFragmentRequest)
	if !ok {
		t.Fatalf("expected PreviewFragmentRequest, got %T", req)
	}

	if previewReq.AcceptEncoding != "gzip, deflate, br" {
		t.Fatalf("expected accept_encoding to be preserved, got %q", previewReq.AcceptEncoding)
	}
}

func TestStrategyConfigCompatTreatsEmptyContainersAsNilForCreateDocumentRequest(t *testing.T) {
	t.Parallel()

	req := unmarshalStrategyConfigCompatTarget(t, `{"organization_code":"ORG-1","user_id":"user-1","knowledge_base_code":"KB-1","name":"doc","strategy_config":{}}`, &dto.CreateDocumentRequest{})
	createReq, ok := req.(*dto.CreateDocumentRequest)
	if !ok {
		t.Fatalf("expected CreateDocumentRequest, got %T", req)
	}
	if createReq.StrategyConfig != nil {
		t.Fatalf("expected nil strategy_config, got %#v", createReq.StrategyConfig)
	}
}

func TestStrategyConfigCompatPreservesExplicitConfigForUpdateDocumentRequest(t *testing.T) {
	t.Parallel()

	req := unmarshalStrategyConfigCompatTarget(t, `{"organization_code":"ORG-1","user_id":"user-1","knowledge_base_code":"KB-1","code":"DOC-1","strategy_config":{"parsing_type":1,"image_extraction":false,"table_extraction":true,"image_ocr":true}}`, &dto.UpdateDocumentRequest{})
	updateReq, ok := req.(*dto.UpdateDocumentRequest)
	if !ok {
		t.Fatalf("expected UpdateDocumentRequest, got %T", req)
	}
	cfg := updateReq.StrategyConfig
	if cfg == nil {
		t.Fatal("expected non-nil strategy_config")
	}
	if cfg.ParsingType != 1 || cfg.ImageExtraction || !cfg.TableExtraction || !cfg.ImageOCR {
		t.Fatalf("unexpected strategy_config %#v", cfg)
	}
}

func TestCreateDocumentRequestCompatMapsLegacyAliases(t *testing.T) {
	t.Parallel()

	req := unmarshalStrategyConfigCompatTarget(t, `{
		"organization_code":"ORG-1",
		"user_id":"user-1",
		"knowledge_code":"KB-1",
		"name":"doc",
		"type":1001,
		"metadata":{"source":"legacy"},
		"document_file":{"type":1,"name":"demo.md","key":"demo.md","third_file_id":"FILE-1","platform_type":"teamshare"},
		"embedding_config":{"model_id":"text-embedding-3-small"}
	}`, &dto.CreateDocumentRequest{})
	createReq, ok := req.(*dto.CreateDocumentRequest)
	if !ok {
		t.Fatalf("expected CreateDocumentRequest, got %T", req)
	}
	if createReq.KnowledgeBaseCode != "KB-1" || createReq.DocType != 1001 {
		t.Fatalf("unexpected request compat mapping %#v", createReq)
	}
	if createReq.DocMetadata["source"] != "legacy" {
		t.Fatalf("expected metadata alias mapping, got %#v", createReq.DocMetadata)
	}
	if createReq.ThirdPlatformType != "teamshare" || createReq.ThirdFileID != "FILE-1" {
		t.Fatalf("expected top-level third file compat, got %#v", createReq)
	}
	if createReq.EmbeddingModel != "text-embedding-3-small" {
		t.Fatalf("expected embedding model from embedding_config, got %#v", createReq)
	}
}

func TestCreateDocumentRequestCompatUsesDocumentFileNameWhenTopLevelNameMissing(t *testing.T) {
	t.Parallel()

	req := unmarshalStrategyConfigCompatTarget(t, `{
		"organization_code":"ORG-1",
		"user_id":"user-1",
		"knowledge_base_code":"KB-1",
		"document_file":{"name":"demo.md","key":"ORG-1/demo.md"}
	}`, &dto.CreateDocumentRequest{})
	createReq, ok := req.(*dto.CreateDocumentRequest)
	if !ok {
		t.Fatalf("expected CreateDocumentRequest, got %T", req)
	}
	if createReq.Name != "demo.md" {
		t.Fatalf("expected name from document_file.name, got %q", createReq.Name)
	}
	if err := createReq.Validate(); err != nil {
		t.Fatalf("expected request to validate, got %v", err)
	}
}

func TestCreateDocumentRequestCompatKeepsTopLevelNamePriority(t *testing.T) {
	t.Parallel()

	req := unmarshalStrategyConfigCompatTarget(t, `{
		"organization_code":"ORG-1",
		"user_id":"user-1",
		"knowledge_base_code":"KB-1",
		"name":"display-name",
		"document_file":{"name":"demo.md","key":"ORG-1/demo.md"}
	}`, &dto.CreateDocumentRequest{})
	createReq, ok := req.(*dto.CreateDocumentRequest)
	if !ok {
		t.Fatalf("expected CreateDocumentRequest, got %T", req)
	}
	if createReq.Name != "display-name" {
		t.Fatalf("expected top-level name priority, got %q", createReq.Name)
	}
	if err := createReq.Validate(); err != nil {
		t.Fatalf("expected request to validate, got %v", err)
	}
}

func TestCreateDocumentRequestValidateRejectsMissingNameWhenNoDocumentFileName(t *testing.T) {
	t.Parallel()

	req := unmarshalStrategyConfigCompatTarget(t, `{
		"organization_code":"ORG-1",
		"user_id":"user-1",
		"knowledge_base_code":"KB-1",
		"document_file":{"key":"ORG-1/demo.md"}
	}`, &dto.CreateDocumentRequest{})
	createReq, ok := req.(*dto.CreateDocumentRequest)
	if !ok {
		t.Fatalf("expected CreateDocumentRequest, got %T", req)
	}
	if err := createReq.Validate(); err == nil || err.Error() != "[31001] name is required" {
		t.Fatalf("expected name required error, got %v", err)
	}
}

func TestUpdateDocumentRequestCompatMapsLegacyAliases(t *testing.T) {
	t.Parallel()

	req := unmarshalStrategyConfigCompatTarget(t, `{
		"organization_code":"ORG-1",
		"user_id":"user-1",
		"knowledge_code":"KB-1",
		"code":"DOC-1",
		"status":1,
		"type":1002,
		"metadata":{"source":"legacy"}
	}`, &dto.UpdateDocumentRequest{})
	updateReq, ok := req.(*dto.UpdateDocumentRequest)
	if !ok {
		t.Fatalf("expected UpdateDocumentRequest, got %T", req)
	}
	if updateReq.KnowledgeBaseCode != "KB-1" || updateReq.DocType == nil || *updateReq.DocType != 1002 {
		t.Fatalf("unexpected update compat mapping %#v", updateReq)
	}
	if updateReq.Enabled == nil || !*updateReq.Enabled {
		t.Fatalf("expected enabled derived from status, got %#v", updateReq.Enabled)
	}
	if updateReq.DocMetadata["source"] != "legacy" {
		t.Fatalf("expected metadata alias mapping, got %#v", updateReq.DocMetadata)
	}
}

func unmarshalStrategyConfigCompatTarget(t *testing.T, payload string, req any) any {
	t.Helper()

	if err := json.Unmarshal([]byte(payload), req); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	return req
}

func assertPreviewFragmentStrategyConfigNil(t *testing.T, req any) {
	t.Helper()

	previewReq, ok := req.(*dto.PreviewFragmentRequest)
	if !ok {
		t.Fatalf("expected PreviewFragmentRequest, got %T", req)
	}
	if previewReq.StrategyConfig != nil {
		t.Fatalf("expected nil strategy_config, got %#v", previewReq.StrategyConfig)
	}
}

func TestCreateKnowledgeBaseRequestObjectCompat(t *testing.T) {
	t.Parallel()

	t.Run("empty optional configs decode to nil", func(t *testing.T) {
		t.Parallel()

		var req dto.CreateKnowledgeBaseRequest
		err := json.Unmarshal([]byte(`{
			"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
			"name":"kb",
			"retrieve_config":"[]",
			"fragment_config":[],
			"embedding_config":""
		}`), &req)
		if err != nil {
			t.Fatalf("json.Unmarshal() error = %v", err)
		}
		if req.RetrieveConfig != nil || req.FragmentConfig != nil || req.EmbeddingConfig != nil {
			t.Fatalf("expected optional configs to be nil, got %#v", req)
		}
	})

	t.Run("nested reranking model quoted empty array", func(t *testing.T) {
		t.Parallel()

		var req dto.CreateKnowledgeBaseRequest
		err := json.Unmarshal([]byte(`{
			"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
			"name":"kb",
			"retrieve_config":{"top_k":3,"reranking_model":"[]"}
		}`), &req)
		if err != nil {
			t.Fatalf("json.Unmarshal() error = %v", err)
		}
		if req.RetrieveConfig == nil || req.RetrieveConfig.RerankingModel == nil {
			t.Fatalf("expected reranking_model compat decode, got %#v", req.RetrieveConfig)
		}
	})

	t.Run("source binding sync config quoted empty array", func(t *testing.T) {
		t.Parallel()

		var req dto.CreateKnowledgeBaseRequest
		err := json.Unmarshal([]byte(`{
			"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
			"name":"kb",
			"source_bindings":[
				{
					"provider":"project",
					"root_type":"project",
					"root_ref":"project-1",
					"sync_mode":"manual",
					"sync_config":"[]"
				}
			]
		}`), &req)
		if err != nil {
			t.Fatalf("json.Unmarshal() error = %v", err)
		}
		if got := map[string]any(req.SourceBindings[0].SyncConfig); got == nil || len(got) != 0 {
			t.Fatalf("expected empty sync_config map, got %#v", got)
		}
	})
}

func TestCreateKnowledgeBaseRequestObjectCompatLegacyDocumentFiles(t *testing.T) {
	t.Parallel()

	var req dto.CreateKnowledgeBaseRequest
	err := json.Unmarshal([]byte(`{
		"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
		"name":"kb",
		"document_files":[
			{
				"type":2,
				"platform_type":"teamshare",
				"third_file_id":"FILE-1"
			}
		]
	}`), &req)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if len(req.DocumentFiles) != 1 || req.SourceBindings != nil {
		t.Fatalf("expected legacy document_files preserved and source_bindings empty, got %#v", req)
	}
	if got := map[string]any(req.DocumentFiles[0]); got["third_file_id"] != "FILE-1" {
		t.Fatalf("expected raw third_file_id preserved, got %#v", got)
	}
}

func TestCreateKnowledgeBaseRequestObjectCompatPreservesLargeNumericLegacyDocumentFileIDs(t *testing.T) {
	t.Parallel()

	var req dto.CreateKnowledgeBaseRequest
	err := json.Unmarshal([]byte(`{
		"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
		"name":"kb",
		"document_files":[
			{
				"type":2,
				"third_file_id":904787325064802305,
				"knowledge_base_id":904787325064802306,
				"project_file_id":904787325064802307
			}
		]
	}`), &req)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	got := map[string]any(req.DocumentFiles[0])
	if got["third_file_id"] != "904787325064802305" ||
		got["knowledge_base_id"] != "904787325064802306" ||
		got["project_file_id"] != "904787325064802307" {
		t.Fatalf("expected legacy document file ids preserved, got %#v", got)
	}
}

func TestUpdateKnowledgeBaseRequestObjectCompatKeepsEmptyObjects(t *testing.T) {
	t.Parallel()

	var req dto.UpdateKnowledgeBaseRequest
	err := json.Unmarshal([]byte(`{
		"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
		"code":"KB-1",
		"retrieve_config":{},
		"fragment_config":{},
		"embedding_config":{}
	}`), &req)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if req.RetrieveConfig == nil || req.FragmentConfig == nil || req.EmbeddingConfig == nil {
		t.Fatalf("expected empty objects to remain non-nil, got %#v", req)
	}
}

func TestUpdateKnowledgeBaseRequestObjectCompatKeepsLegacyNilSemantics(t *testing.T) {
	t.Parallel()

	var req dto.UpdateKnowledgeBaseRequest
	err := json.Unmarshal([]byte(`{
		"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
		"code":"KB-1",
		"retrieve_config":"[]",
		"fragment_config":[],
		"embedding_config":""
	}`), &req)
	if err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if req.RetrieveConfig != nil || req.FragmentConfig != nil || req.EmbeddingConfig != nil {
		t.Fatalf("expected legacy empty values to decode to nil, got %#v", req)
	}
}

func TestUpdateKnowledgeBaseRequestObjectCompatDocumentFiles(t *testing.T) {
	t.Parallel()

	t.Run("empty array means explicit replace", func(t *testing.T) {
		t.Parallel()

		var req dto.UpdateKnowledgeBaseRequest
		err := json.Unmarshal([]byte(`{
			"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
			"code":"KB-1",
			"document_files":[]
		}`), &req)
		if err != nil {
			t.Fatalf("json.Unmarshal() error = %v", err)
		}
		if req.DocumentFiles == nil || len(*req.DocumentFiles) != 0 {
			t.Fatalf("expected explicit empty legacy document_files replace marker, got %#v", req.DocumentFiles)
		}
	})

	t.Run("preserve large numeric ids", func(t *testing.T) {
		t.Parallel()

		var req dto.UpdateKnowledgeBaseRequest
		err := json.Unmarshal([]byte(`{
			"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
			"code":"KB-1",
			"document_files":[
				{
					"type":2,
					"third_file_id":904787325064802305,
					"knowledge_base_id":904787325064802306,
					"project_file_id":904787325064802307
				}
			]
		}`), &req)
		if err != nil {
			t.Fatalf("json.Unmarshal() error = %v", err)
		}
		if req.DocumentFiles == nil || len(*req.DocumentFiles) != 1 {
			t.Fatalf("expected document_files preserved, got %#v", req.DocumentFiles)
		}
		got := map[string]any((*req.DocumentFiles)[0])
		if got["third_file_id"] != "904787325064802305" ||
			got["knowledge_base_id"] != "904787325064802306" ||
			got["project_file_id"] != "904787325064802307" {
			t.Fatalf("expected update legacy document file ids preserved, got %#v", got)
		}
	})
}

func TestPreviewFragmentRequestValidateChunkOverlapUnit(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name    string
		payload string
		wantErr string
	}{
		{
			name: "invalid unit",
			payload: `{
				"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
				"fragment_config":{"mode":1,"normal":{"segment_rule":{"chunk_size":800,"chunk_overlap":10,"chunk_overlap_unit":"ratio"}}}
			}`,
			wantErr: "[31001] fragment_config.normal.segment_rule.chunk_overlap_unit must be one of absolute, percent",
		},
		{
			name: "percent overflow",
			payload: `{
				"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
				"fragment_config":{"mode":1,"normal":{"segment_rule":{"chunk_size":800,"chunk_overlap":101,"chunk_overlap_unit":"percent"}}}
			}`,
			wantErr: "[31001] fragment_config.normal.segment_rule.chunk_overlap must be less than or equal to 100 when chunk_overlap_unit=percent",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var req dto.PreviewFragmentRequest
			if err := json.Unmarshal([]byte(tc.payload), &req); err != nil {
				t.Fatalf("json.Unmarshal() error = %v", err)
			}
			if err := req.Validate(); err == nil || err.Error() != tc.wantErr {
				t.Fatalf("Validate() error = %v, want %q", err, tc.wantErr)
			}
		})
	}
}

func TestPreviewFragmentRequestValidateParsingTypeCompat(t *testing.T) {
	t.Parallel()

	var req dto.PreviewFragmentRequest
	if err := json.Unmarshal([]byte(`{
		"data_isolation":{"organization_code":"ORG-1","user_id":"user-1"},
		"strategy_config":{"parsing_type":2,"image_extraction":true,"table_extraction":true,"image_ocr":true}
	}`), &req); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if err := req.Validate(); err != nil {
		t.Fatalf("expected parsing_type=2 to pass validation, got %v", err)
	}
}

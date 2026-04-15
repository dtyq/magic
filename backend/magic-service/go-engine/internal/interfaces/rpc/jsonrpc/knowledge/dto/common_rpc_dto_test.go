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
	}).Validate()
	if err == nil || err.Error() != errUserIDRequired {
		t.Fatalf("expected nodes user_id required error, got %v", err)
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

func TestUpdateKnowledgeBaseRequestObjectCompat(t *testing.T) {
	t.Parallel()

	t.Run("empty objects remain non nil for clear patch", func(t *testing.T) {
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
	})

	t.Run("legacy empty values still decode to nil", func(t *testing.T) {
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

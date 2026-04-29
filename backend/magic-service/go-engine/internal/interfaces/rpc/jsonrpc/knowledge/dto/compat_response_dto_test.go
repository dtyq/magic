package dto_test

import (
	"encoding/json"
	"strings"
	"testing"

	docdto "magic/internal/application/knowledge/document/dto"
	fragdto "magic/internal/application/knowledge/fragment/dto"
	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	"magic/internal/constants"
	dto "magic/internal/interfaces/rpc/jsonrpc/knowledge/dto"
)

const (
	testKnowledgeBaseTypeFlowVector      = "flow_vector"
	testKnowledgeBaseTypeDigitalEmployee = "digital_employee"
	testFragmentModeCustom               = 1
	testFragmentModeAuto                 = 2
	testPreciseMarkdownDocType           = 2
)

func TestNewKnowledgeBaseResponseProjectsFlowDefaultAutoToLegacyGenericMode(t *testing.T) {
	t.Parallel()

	resp := dto.NewKnowledgeBaseResponse(&kbdto.KnowledgeBaseDTO{
		Code:              "KB-1",
		KnowledgeBaseType: testKnowledgeBaseTypeFlowVector,
		FragmentConfig:    &confighelper.FragmentConfigOutputDTO{Mode: testFragmentModeAuto},
	}, 0)
	if resp == nil {
		t.Fatal("expected response")
	}

	retrieveConfig, ok := resp.RetrieveConfig.(*confighelper.RetrieveConfigDTO)
	if !ok || retrieveConfig == nil {
		t.Fatalf("expected compat retrieve config, got %#v", resp.RetrieveConfig)
	}
	if retrieveConfig.SearchMethod != "hybrid_search" || retrieveConfig.TopK != 10 {
		t.Fatalf("unexpected compat retrieve config: %#v", retrieveConfig)
	}

	fragmentConfig, ok := resp.FragmentConfig.(*confighelper.FragmentConfigOutputDTO)
	if !ok || fragmentConfig == nil || fragmentConfig.Normal == nil || fragmentConfig.Normal.SegmentRule == nil {
		t.Fatalf("expected compat flow fragment config, got %#v", resp.FragmentConfig)
	}
	if fragmentConfig.Mode != testFragmentModeCustom {
		t.Fatalf("expected legacy flow custom mode, got %#v", fragmentConfig)
	}
	if fragmentConfig.Normal.SegmentRule.Separator != "\\n\\n" || fragmentConfig.Normal.SegmentRule.ChunkSize != 500 || fragmentConfig.Normal.SegmentRule.ChunkOverlap != 50 {
		t.Fatalf("unexpected compat flow segment rule: %#v", fragmentConfig.Normal.SegmentRule)
	}
	if fragmentConfig.Normal.SegmentRule.ChunkOverlapUnit != confighelper.ChunkOverlapUnitAbsolute {
		t.Fatalf("unexpected chunk overlap unit: %#v", fragmentConfig.Normal.SegmentRule)
	}
	if len(fragmentConfig.Normal.TextPreprocessRule) != 1 || fragmentConfig.Normal.TextPreprocessRule[0] != 1 {
		t.Fatalf("unexpected text preprocess rule: %#v", fragmentConfig.Normal.TextPreprocessRule)
	}
}

func TestNewKnowledgeBaseResponseProjectsDigitalEmployeeDefaultAuto(t *testing.T) {
	t.Parallel()

	resp := dto.NewKnowledgeBaseResponse(&kbdto.KnowledgeBaseDTO{
		Code:              "KB-1",
		KnowledgeBaseType: testKnowledgeBaseTypeDigitalEmployee,
	}, 0)
	if resp == nil {
		t.Fatal("expected response")
	}

	fragmentConfig, ok := resp.FragmentConfig.(*confighelper.FragmentConfigOutputDTO)
	if !ok || fragmentConfig == nil {
		t.Fatalf("expected compat digital fragment config, got %#v", resp.FragmentConfig)
	}
	if fragmentConfig.Mode != testFragmentModeAuto || fragmentConfig.Normal != nil || fragmentConfig.Hierarchy != nil {
		t.Fatalf("unexpected digital employee fragment config: %#v", fragmentConfig)
	}
}

func TestNewDocumentResponseProjectsFlowNilConfigsToLegacyDefaults(t *testing.T) {
	t.Parallel()

	resp := dto.NewDocumentResponse(&docdto.DocumentDTO{
		Code:              "DOC-1",
		KnowledgeBaseCode: "KB-1",
		KnowledgeBaseType: testKnowledgeBaseTypeFlowVector,
	})
	if resp == nil {
		t.Fatal("expected response")
	}

	retrieveConfig, ok := resp.RetrieveConfig.(*confighelper.RetrieveConfigDTO)
	if !ok || retrieveConfig == nil {
		t.Fatalf("expected compat retrieve config, got %#v", resp.RetrieveConfig)
	}
	if retrieveConfig.SearchMethod != "hybrid_search" || retrieveConfig.TopK != 10 {
		t.Fatalf("unexpected compat retrieve config: %#v", retrieveConfig)
	}

	fragmentConfig, ok := resp.FragmentConfig.(*confighelper.FragmentConfigDTO)
	if !ok || fragmentConfig == nil || fragmentConfig.Normal == nil || fragmentConfig.Normal.SegmentRule == nil {
		t.Fatalf("expected compat flow fragment config, got %#v", resp.FragmentConfig)
	}
	if fragmentConfig.Mode != testFragmentModeCustom {
		t.Fatalf("expected legacy flow custom mode, got %#v", fragmentConfig)
	}
	if fragmentConfig.Normal.SegmentRule.Separator != "\\n\\n" || fragmentConfig.Normal.SegmentRule.ChunkSize != 500 || fragmentConfig.Normal.SegmentRule.ChunkOverlap != 50 {
		t.Fatalf("unexpected compat flow segment rule: %#v", fragmentConfig.Normal.SegmentRule)
	}
	if fragmentConfig.Normal.SegmentRule.ChunkOverlapUnit != confighelper.ChunkOverlapUnitAbsolute {
		t.Fatalf("unexpected chunk overlap unit: %#v", fragmentConfig.Normal.SegmentRule)
	}
}

func TestNewDocumentResponseProjectsDigitalEmployeeNilConfigsToAuto(t *testing.T) {
	t.Parallel()

	resp := dto.NewDocumentResponse(&docdto.DocumentDTO{
		Code:              "DOC-1",
		KnowledgeBaseCode: "KB-1",
		KnowledgeBaseType: testKnowledgeBaseTypeDigitalEmployee,
	})
	if resp == nil {
		t.Fatal("expected response")
	}

	fragmentConfig, ok := resp.FragmentConfig.(*confighelper.FragmentConfigDTO)
	if !ok || fragmentConfig == nil {
		t.Fatalf("expected compat digital fragment config, got %#v", resp.FragmentConfig)
	}
	if fragmentConfig.Mode != testFragmentModeAuto || fragmentConfig.Normal != nil || fragmentConfig.Hierarchy != nil {
		t.Fatalf("unexpected digital employee fragment config: %#v", fragmentConfig)
	}
}

func TestNewDocumentResponseProjectsDigitalEmployeeStrategyConfigToCompatProtocol(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name                string
		metadataParsingType int
		wantParsingType     int
	}{
		{
			name:                "quick",
			metadataParsingType: 0,
			wantParsingType:     0,
		},
		{
			name:                "precise",
			metadataParsingType: 1,
			wantParsingType:     1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			resp := dto.NewDocumentResponse(&docdto.DocumentDTO{
				Code:              "DOC-1",
				KnowledgeBaseCode: "KB-1",
				KnowledgeBaseType: testKnowledgeBaseTypeDigitalEmployee,
				DocMetadata: map[string]any{
					"strategy_config": map[string]any{
						"parsing_type":     tt.metadataParsingType,
						"image_extraction": false,
						"table_extraction": tt.metadataParsingType == 1,
						"image_ocr":        tt.metadataParsingType == 1,
					},
				},
			})
			if resp == nil {
				t.Fatal("expected response")
			}

			strategy, ok := resp.StrategyConfig.(*confighelper.StrategyConfigDTO)
			if !ok || strategy == nil {
				t.Fatalf("expected compat strategy config, got %#v", resp.StrategyConfig)
			}
			if strategy.ParsingType != tt.wantParsingType {
				t.Fatalf("expected digital employee protocol value %d, got %#v", tt.wantParsingType, strategy)
			}
		})
	}
}

func TestNewDocumentResponseProjectsFlowEmptyFragmentConfigObjectToLegacyDefaults(t *testing.T) {
	t.Parallel()

	resp := dto.NewDocumentResponse(&docdto.DocumentDTO{
		Code:              "DOC-1",
		KnowledgeBaseCode: "KB-1",
		KnowledgeBaseType: testKnowledgeBaseTypeFlowVector,
		FragmentConfig:    &confighelper.FragmentConfigDTO{},
	})
	if resp == nil {
		t.Fatal("expected response")
	}

	fragmentConfig, ok := resp.FragmentConfig.(*confighelper.FragmentConfigDTO)
	if !ok || fragmentConfig == nil || fragmentConfig.Normal == nil || fragmentConfig.Normal.SegmentRule == nil {
		t.Fatalf("expected compat flow fragment config, got %#v", resp.FragmentConfig)
	}
	if fragmentConfig.Mode != testFragmentModeCustom {
		t.Fatalf("expected legacy flow custom mode, got %#v", fragmentConfig)
	}
}

func TestNewDocumentResponseProjectsFlowAutoWithEmptyHierarchyToLegacyDefaults(t *testing.T) {
	t.Parallel()

	resp := dto.NewDocumentResponse(&docdto.DocumentDTO{
		Code:              "DOC-1",
		KnowledgeBaseCode: "KB-1",
		KnowledgeBaseType: testKnowledgeBaseTypeFlowVector,
		FragmentConfig: &confighelper.FragmentConfigDTO{
			Mode:      testFragmentModeAuto,
			Hierarchy: &confighelper.HierarchyFragmentConfigDTO{},
		},
	})
	if resp == nil {
		t.Fatal("expected response")
	}

	fragmentConfig, ok := resp.FragmentConfig.(*confighelper.FragmentConfigDTO)
	if !ok || fragmentConfig == nil || fragmentConfig.Normal == nil || fragmentConfig.Normal.SegmentRule == nil {
		t.Fatalf("expected compat flow fragment config, got %#v", resp.FragmentConfig)
	}
	if fragmentConfig.Mode != testFragmentModeCustom {
		t.Fatalf("expected legacy flow custom mode, got %#v", fragmentConfig)
	}
}

func TestNewDocumentResponseIncludesProjectFileCompatFields(t *testing.T) {
	t.Parallel()

	resp := dto.NewDocumentResponse(&docdto.DocumentDTO{
		Code:          "DOC-1",
		ProjectFileID: 42,
		DocumentFile: &docfilehelper.DocumentFileDTO{
			Type:          "project_file",
			Name:          "demo.md",
			Key:           "ORG1/project_7/workspace/docs/demo.md",
			URL:           "",
			ProjectFileID: 42,
		},
	})
	if resp == nil {
		t.Fatal("expected response")
	}

	documentFile, ok := resp.DocumentFile.(map[string]any)
	if !ok {
		t.Fatalf("expected compat document_file map, got %#v", resp.DocumentFile)
	}
	if documentFile["project_file_id"] != "42" {
		t.Fatalf("expected project_file_id preserved, got %#v", documentFile["project_file_id"])
	}
	if documentFile["relative_file_path"] != "docs/demo.md" {
		t.Fatalf("expected inferred relative_file_path, got %#v", documentFile["relative_file_path"])
	}
}

func TestNewDocumentResponseProjectsDocTypeAsKnowledgeSourceType(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name              string
		knowledgeBaseType string
		sourceType        int
		wantDocType       int
	}{
		{
			name:              "digital local",
			knowledgeBaseType: testKnowledgeBaseTypeDigitalEmployee,
			sourceType:        constants.KnowledgeBaseSourceTypeDigitalEmployeeLocalFile,
			wantDocType:       constants.KnowledgeBaseSourceTypeDigitalEmployeeLocalFile,
		},
		{
			name:              "digital custom",
			knowledgeBaseType: testKnowledgeBaseTypeDigitalEmployee,
			sourceType:        constants.KnowledgeBaseSourceTypeDigitalEmployeeCustomContent,
			wantDocType:       constants.KnowledgeBaseSourceTypeDigitalEmployeeCustomContent,
		},
		{
			name:              "digital project",
			knowledgeBaseType: testKnowledgeBaseTypeDigitalEmployee,
			sourceType:        constants.KnowledgeBaseSourceTypeDigitalEmployeeProject,
			wantDocType:       constants.KnowledgeBaseSourceTypeDigitalEmployeeProject,
		},
		{
			name:              "digital enterprise",
			knowledgeBaseType: testKnowledgeBaseTypeDigitalEmployee,
			sourceType:        constants.KnowledgeBaseSourceTypeDigitalEmployeeEnterpriseWiki,
			wantDocType:       constants.KnowledgeBaseSourceTypeDigitalEmployeeEnterpriseWiki,
		},
		{
			name:              "flow local",
			knowledgeBaseType: testKnowledgeBaseTypeFlowVector,
			sourceType:        constants.KnowledgeBaseSourceTypeLegacyLocalFile,
			wantDocType:       constants.KnowledgeBaseSourceTypeLegacyLocalFile,
		},
		{
			name:              "flow enterprise",
			knowledgeBaseType: testKnowledgeBaseTypeFlowVector,
			sourceType:        constants.KnowledgeBaseSourceTypeLegacyEnterpriseWiki,
			wantDocType:       constants.KnowledgeBaseSourceTypeLegacyEnterpriseWiki,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			resp := dto.NewDocumentResponse(&docdto.DocumentDTO{
				KnowledgeBaseType: tc.knowledgeBaseType,
				SourceType:        &tc.sourceType,
				DocType:           testPreciseMarkdownDocType,
			})
			if resp == nil {
				t.Fatal("expected response")
			}
			if resp.DocType != tc.wantDocType {
				t.Fatalf("expected response doc_type=%d, got %#v", tc.wantDocType, resp)
			}
		})
	}
}

func TestNewDocumentResponseInfersEnterpriseDocTypeFromTeamshareFile(t *testing.T) {
	t.Parallel()

	resp := dto.NewDocumentResponse(&docdto.DocumentDTO{
		KnowledgeBaseType: testKnowledgeBaseTypeDigitalEmployee,
		DocType:           testPreciseMarkdownDocType,
		DocumentFile: &docfilehelper.DocumentFileDTO{
			Type:          "third_platform",
			Name:          "企业文档",
			Extension:     "md",
			SourceType:    "teamshare",
			ThirdFileType: "16",
		},
	})
	if resp == nil {
		t.Fatal("expected response")
	}
	if resp.DocType != constants.KnowledgeBaseSourceTypeDigitalEmployeeEnterpriseWiki {
		t.Fatalf("expected digital enterprise doc_type=4, got %#v", resp)
	}

	documentFile, ok := resp.DocumentFile.(map[string]any)
	if !ok {
		t.Fatalf("expected compat document_file map, got %#v", resp.DocumentFile)
	}
	if documentFile["extension"] != "md" || documentFile["third_file_extension_name"] != "md" {
		t.Fatalf("expected extension fields preserved, got %#v", documentFile)
	}
	if documentFile["third_file_type"] != "16" || documentFile["teamshare_file_type"] != "16" {
		t.Fatalf("expected teamshare file type aliases, got %#v", documentFile)
	}
}

func TestNewKnowledgeBaseResponseProjectsFlowEmptyFragmentConfigObjectToLegacyDefaults(t *testing.T) {
	t.Parallel()

	resp := dto.NewKnowledgeBaseResponse(&kbdto.KnowledgeBaseDTO{
		Code:              "KB-1",
		KnowledgeBaseType: testKnowledgeBaseTypeFlowVector,
		FragmentConfig:    &confighelper.FragmentConfigOutputDTO{},
	}, 0)
	if resp == nil {
		t.Fatal("expected response")
	}

	fragmentConfig, ok := resp.FragmentConfig.(*confighelper.FragmentConfigOutputDTO)
	if !ok || fragmentConfig == nil || fragmentConfig.Normal == nil || fragmentConfig.Normal.SegmentRule == nil {
		t.Fatalf("expected compat flow fragment config, got %#v", resp.FragmentConfig)
	}
	if fragmentConfig.Mode != testFragmentModeCustom {
		t.Fatalf("expected legacy flow custom mode, got %#v", fragmentConfig)
	}
}

func TestNewKnowledgeBaseResponseIncludesSourceBindings(t *testing.T) {
	t.Parallel()

	workspaceID := int64(900)
	resp := dto.NewKnowledgeBaseResponse(&kbdto.KnowledgeBaseDTO{
		Code:              "KB-1",
		KnowledgeBaseType: testKnowledgeBaseTypeDigitalEmployee,
		SourceBindings: []kbdto.SourceBindingDTO{
			{
				Provider:    "project",
				RootType:    "project",
				RootRef:     "300",
				WorkspaceID: &workspaceID,
				SyncMode:    "realtime",
				Enabled:     true,
				SyncConfig:  map[string]any{"scope": "selected"},
				Targets: []kbdto.SourceBindingTargetDTO{
					{TargetType: "folder", TargetRef: "42"},
					{TargetType: "file", TargetRef: "43"},
				},
			},
		},
	}, 0)
	if resp == nil {
		t.Fatal("expected response")
	}
	if len(resp.SourceBindings) != 1 {
		t.Fatalf("expected one source binding, got %#v", resp.SourceBindings)
	}
	if resp.SourceBindings[0].Provider != "project" || resp.SourceBindings[0].RootRef != "300" {
		t.Fatalf("unexpected source binding root: %#v", resp.SourceBindings[0])
	}
	if resp.SourceBindings[0].WorkspaceID == nil || *resp.SourceBindings[0].WorkspaceID != "900" {
		t.Fatalf("unexpected source binding workspace id: %#v", resp.SourceBindings[0].WorkspaceID)
	}
	if got := map[string]any(resp.SourceBindings[0].SyncConfig); got["scope"] != "selected" {
		t.Fatalf("unexpected source binding sync config: %#v", got)
	}
	if len(resp.SourceBindings[0].Targets) != 2 || resp.SourceBindings[0].Targets[1].TargetRef != "43" {
		t.Fatalf("unexpected source binding targets: %#v", resp.SourceBindings[0].Targets)
	}
}

func TestNewKnowledgeBaseResponseOmitsEmptySourceBindings(t *testing.T) {
	t.Parallel()

	resp := dto.NewKnowledgeBaseResponse(&kbdto.KnowledgeBaseDTO{
		Code:              "KB-1",
		KnowledgeBaseType: testKnowledgeBaseTypeFlowVector,
	}, 0)
	if resp == nil {
		t.Fatal("expected response")
	}

	payload, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal knowledge base response: %v", err)
	}
	if strings.Contains(string(payload), "source_bindings") {
		t.Fatalf("expected empty source_bindings omitted, got %s", payload)
	}
}

func TestNewKnowledgeBaseResponseSourceBindingWorkspaceIDZeroAsString(t *testing.T) {
	t.Parallel()

	workspaceID := int64(0)
	resp := dto.NewKnowledgeBaseResponse(&kbdto.KnowledgeBaseDTO{
		Code:              "KB-1",
		KnowledgeBaseType: testKnowledgeBaseTypeDigitalEmployee,
		SourceBindings: []kbdto.SourceBindingDTO{
			{
				Provider:    "project",
				RootType:    "project",
				RootRef:     "300",
				WorkspaceID: &workspaceID,
				SyncMode:    "realtime",
				Enabled:     true,
			},
		},
	}, 0)
	if resp == nil {
		t.Fatal("expected response")
	}
	if resp.SourceBindings[0].WorkspaceID == nil || *resp.SourceBindings[0].WorkspaceID != "0" {
		t.Fatalf("expected zero workspace id string, got %#v", resp.SourceBindings[0].WorkspaceID)
	}
}

func TestNewDocumentResponseStringifiesIDFields(t *testing.T) {
	t.Parallel()

	resp := dto.NewDocumentResponse(&docdto.DocumentDTO{
		ID:              101,
		SourceBindingID: 202,
		SourceItemID:    303,
		ProjectID:       404,
		ProjectFileID:   505,
	})
	if resp == nil {
		t.Fatal("expected response")
	}
	if resp.ID != "101" || resp.SourceBindingID != "202" || resp.SourceItemID != "303" ||
		resp.ProjectID != "404" || resp.ProjectFileID != "505" {
		t.Fatalf("expected stringified document ids, got %#v", resp)
	}
}

func TestNewFragmentResponseStringifiesID(t *testing.T) {
	t.Parallel()

	resp := dto.NewFragmentResponse(&fragdto.FragmentDTO{ID: 606, KnowledgeCode: "KB-1"})
	if resp == nil {
		t.Fatal("expected response")
	}
	if resp.ID != "606" {
		t.Fatalf("expected stringified fragment id, got %#v", resp.ID)
	}
}

func TestNewFragmentResponseProjectsDocTypeAsKnowledgeSourceType(t *testing.T) {
	t.Parallel()

	digitalEnterprise := constants.KnowledgeBaseSourceTypeDigitalEmployeeEnterpriseWiki
	resp := dto.NewFragmentResponse(&fragdto.FragmentDTO{
		ID:                606,
		KnowledgeCode:     "KB-1",
		KnowledgeBaseType: testKnowledgeBaseTypeDigitalEmployee,
		SourceType:        &digitalEnterprise,
		DocumentType:      testPreciseMarkdownDocType,
	})
	if resp == nil {
		t.Fatal("expected response")
	}
	if resp.DocumentType != testPreciseMarkdownDocType || resp.DocType != constants.KnowledgeBaseSourceTypeDigitalEmployeeEnterpriseWiki {
		t.Fatalf("expected document_type=2 and doc_type=4, got %#v", resp)
	}

	flowEnterprise := constants.KnowledgeBaseSourceTypeLegacyEnterpriseWiki
	listResp := dto.NewFragmentListResponse(&fragdto.FragmentListItemDTO{
		ID:                607,
		KnowledgeCode:     "KB-2",
		KnowledgeBaseCode: "KB-2",
		KnowledgeBaseType: testKnowledgeBaseTypeFlowVector,
		SourceType:        &flowEnterprise,
		DocumentType:      testPreciseMarkdownDocType,
		DocType:           testPreciseMarkdownDocType,
	})
	if listResp == nil {
		t.Fatal("expected list response")
	}
	if listResp.DocumentType != testPreciseMarkdownDocType || listResp.DocType != constants.KnowledgeBaseSourceTypeLegacyEnterpriseWiki {
		t.Fatalf("expected document_type=2 and flow doc_type=1001, got %#v", listResp)
	}
}

func TestNewSimilarityResponseProjectsDocTypeAsKnowledgeSourceType(t *testing.T) {
	t.Parallel()

	digitalEnterprise := constants.KnowledgeBaseSourceTypeDigitalEmployeeEnterpriseWiki
	resp := dto.NewSimilarityResponse(&fragdto.SimilarityResultDTO{
		ID:                608,
		KnowledgeCode:     "KB-1",
		KnowledgeBaseCode: "KB-1",
		KnowledgeBaseType: testKnowledgeBaseTypeDigitalEmployee,
		SourceType:        &digitalEnterprise,
		DocumentType:      testPreciseMarkdownDocType,
		DocType:           testPreciseMarkdownDocType,
	})
	if resp == nil {
		t.Fatal("expected response")
	}
	if resp.DocumentType != testPreciseMarkdownDocType || resp.DocType != constants.KnowledgeBaseSourceTypeDigitalEmployeeEnterpriseWiki {
		t.Fatalf("expected document_type=2 and doc_type=4, got %#v", resp)
	}

	flowEnterprise := constants.KnowledgeBaseSourceTypeLegacyEnterpriseWiki
	flowResp := dto.NewSimilarityResponse(&fragdto.SimilarityResultDTO{
		ID:                609,
		KnowledgeCode:     "KB-2",
		KnowledgeBaseCode: "KB-2",
		KnowledgeBaseType: testKnowledgeBaseTypeFlowVector,
		SourceType:        &flowEnterprise,
		DocumentType:      testPreciseMarkdownDocType,
		DocType:           testPreciseMarkdownDocType,
	})
	if flowResp == nil {
		t.Fatal("expected flow response")
	}
	if flowResp.DocumentType != testPreciseMarkdownDocType || flowResp.DocType != constants.KnowledgeBaseSourceTypeLegacyEnterpriseWiki {
		t.Fatalf("expected document_type=2 and flow doc_type=1001, got %#v", flowResp)
	}
}

func TestNewSimilarityResponseKeepsScoreNearContentAndMetadata(t *testing.T) {
	t.Parallel()

	resp := dto.NewSimilarityResponse(&fragdto.SimilarityResultDTO{
		ID:                1,
		Content:           "退款流程配置",
		Score:             0.81,
		WordCount:         4,
		Metadata:          map[string]any{"retrieval_ranking": map[string]any{"fusion_score": 0.42}},
		KnowledgeBaseCode: "KB-1",
		KnowledgeCode:     "KB-1",
		DocumentCode:      "DOC-1",
		DocumentName:      "退款文档",
		DocumentType:      5,
		DocType:           5,
	})
	if resp == nil {
		t.Fatal("expected response")
	}

	payload, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal similarity response: %v", err)
	}
	body := string(payload)

	contentIndex := strings.Index(body, "\"content\"")
	scoreIndex := strings.Index(body, "\"score\"")
	metadataIndex := strings.Index(body, "\"metadata\"")
	wordCountIndex := strings.Index(body, "\"word_count\"")
	if contentIndex < 0 || scoreIndex < 0 || metadataIndex < 0 || wordCountIndex < 0 {
		t.Fatalf("expected content/score/metadata/word_count in payload, got %s", body)
	}
	if contentIndex >= scoreIndex || scoreIndex >= metadataIndex || metadataIndex >= wordCountIndex {
		t.Fatalf("expected content->score->metadata->word_count order, got %s", body)
	}
}

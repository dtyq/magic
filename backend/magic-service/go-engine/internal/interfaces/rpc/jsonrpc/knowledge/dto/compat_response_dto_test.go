package dto_test

import (
	"testing"

	docdto "magic/internal/application/knowledge/document/dto"
	confighelper "magic/internal/application/knowledge/helper/config"
	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	dto "magic/internal/interfaces/rpc/jsonrpc/knowledge/dto"
)

const (
	testKnowledgeBaseTypeFlowVector      = "flow_vector"
	testKnowledgeBaseTypeDigitalEmployee = "digital_employee"
	testFragmentModeCustom               = 1
	testFragmentModeAuto                 = 2
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

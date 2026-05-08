package kbapp_test

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"testing"
	"time"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	service "magic/internal/application/knowledge/knowledgebase/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
)

func TestKnowledgeBaseEntityToDTO_MapsCreatorModifier(t *testing.T) {
	t.Parallel()
	svc := &service.KnowledgeBaseAppService{}
	sourceType := int(kbentity.SourceTypeCustomContent)
	kb := &kbentity.KnowledgeBase{
		Code:       "KNOWLEDGE-TEST",
		CreatedUID: "usi_creator",
		UpdatedUID: "usi_modifier",
		SourceType: &sourceType,
		CreatedAt:  time.Unix(1772001461, 0),
		UpdatedAt:  time.Unix(1772001501, 0),
	}

	dto := service.EntityToDTOForTest(svc, kb)
	if dto == nil {
		t.Fatal("expected dto not nil")
	}
	if dto.Creator != "usi_creator" {
		t.Fatalf("expected creator=usi_creator, got %q", dto.Creator)
	}
	if dto.Modifier != "usi_modifier" {
		t.Fatalf("expected modifier=usi_modifier, got %q", dto.Modifier)
	}
	if dto.CreatedUID != "usi_creator" {
		t.Fatalf("expected created_uid=usi_creator, got %q", dto.CreatedUID)
	}
	if dto.UpdatedUID != "usi_modifier" {
		t.Fatalf("expected updated_uid=usi_modifier, got %q", dto.UpdatedUID)
	}
	if dto.SourceType == nil || *dto.SourceType != sourceType {
		t.Fatalf("expected source_type=%d, got %#v", sourceType, dto.SourceType)
	}
}

func TestInputToEntity_DefaultsSourceTypeToLocalFile(t *testing.T) {
	t.Parallel()
	svc := &service.KnowledgeBaseAppService{}

	entity := service.InputToEntityForTest(svc, &kbdto.CreateKnowledgeBaseInput{
		Code:             "KNOWLEDGE-TEST",
		Name:             "知识库",
		OrganizationCode: "ORG-1",
		UserID:           "u1",
	})

	normalized, err := kbentity.NormalizeSourceType(kbentity.KnowledgeBaseTypeFlowVector, entity.SourceType)
	if err != nil {
		t.Fatalf("NormalizeSourceType returned error: %v", err)
	}
	if normalized == nil || *normalized != int(kbentity.SourceTypeLocalFile) {
		t.Fatalf("expected default source_type=%d, got %#v", int(kbentity.SourceTypeLocalFile), normalized)
	}
}

func TestKnowledgeBaseEntityToDTO_VectorSettingIncludesEmptyFields(t *testing.T) {
	t.Parallel()
	svc := &service.KnowledgeBaseAppService{}
	kb := &kbentity.KnowledgeBase{
		Code: "KNOWLEDGE-TEST",
		RetrieveConfig: &shared.RetrieveConfig{
			Weights: &shared.RetrieveWeights{
				VectorSetting: &shared.VectorWeightSetting{
					VectorWeight:          1,
					EmbeddingModelName:    "",
					EmbeddingProviderName: "",
				},
				KeywordSetting: &shared.KeywordWeightSetting{
					KeywordWeight: 0,
				},
				GraphSetting: &shared.GraphWeightSetting{
					RelationWeight:    0.5,
					MaxDepth:          2,
					IncludeProperties: true,
					Timeout:           5,
					RetryCount:        3,
				},
			},
		},
		CreatedAt: time.Unix(1772001461, 0),
		UpdatedAt: time.Unix(1772001501, 0),
	}

	dto := service.EntityToDTOForTest(svc, kb)
	body, err := json.Marshal(dto)
	if err != nil {
		t.Fatalf("marshal dto failed: %v", err)
	}

	var parsed map[string]any
	if err := json.Unmarshal(body, &parsed); err != nil {
		t.Fatalf("unmarshal dto failed: %v", err)
	}

	retrieveConfig, ok := parsed["retrieve_config"].(map[string]any)
	if !ok {
		t.Fatalf("retrieve_config not found in response: %s", string(body))
	}
	weights, ok := retrieveConfig["weights"].(map[string]any)
	if !ok {
		t.Fatalf("weights not found in retrieve_config: %s", string(body))
	}
	vectorSetting, ok := weights["vector_setting"].(map[string]any)
	if !ok {
		t.Fatalf("vector_setting not found in weights: %s", string(body))
	}

	if _, exists := vectorSetting["embedding_model_name"]; !exists {
		t.Fatalf("expected embedding_model_name in vector_setting: %s", string(body))
	}
	if _, exists := vectorSetting["embedding_provider_name"]; !exists {
		t.Fatalf("expected embedding_provider_name in vector_setting: %s", string(body))
	}
	if vectorSetting["embedding_model_name"] != "" {
		t.Fatalf("expected embedding_model_name empty string, got %#v", vectorSetting["embedding_model_name"])
	}
	if vectorSetting["embedding_provider_name"] != "" {
		t.Fatalf("expected embedding_provider_name empty string, got %#v", vectorSetting["embedding_provider_name"])
	}
}

func TestKnowledgeBaseEntityToDTO_FragmentConfigOutputOmitsRemovedParentChildField(t *testing.T) {
	t.Parallel()
	svc := &service.KnowledgeBaseAppService{}
	kb := &kbentity.KnowledgeBase{
		Code: "KNOWLEDGE-TEST",
		FragmentConfig: &shared.FragmentConfig{
			Mode: shared.FragmentModeCustom,
			Normal: &shared.NormalFragmentConfig{
				TextPreprocessRule: []int{1},
				SegmentRule: &shared.SegmentRule{
					Separator:    "\\n\\n",
					ChunkSize:    500,
					ChunkOverlap: 0,
				},
			},
		},
		CreatedAt: time.Unix(1772001461, 0),
		UpdatedAt: time.Unix(1772001501, 0),
	}

	dto := service.EntityToDTOForTest(svc, kb)
	if dto == nil || dto.FragmentConfig == nil || dto.FragmentConfig.Normal == nil {
		t.Fatalf("expected fragment config output, got %#v", dto)
	}
	if dto.FragmentConfig.Mode != int(shared.FragmentModeCustom) {
		t.Fatalf("expected mode=custom, got %#v", dto.FragmentConfig.Mode)
	}
	if dto.FragmentConfig.Normal.SegmentRule == nil {
		t.Fatalf("expected segment rule, got %#v", dto.FragmentConfig.Normal)
	}
	if dto.FragmentConfig.Normal.SegmentRule.ChunkOverlap != 0 {
		t.Fatalf("expected chunk_overlap=0 kept, got %d", dto.FragmentConfig.Normal.SegmentRule.ChunkOverlap)
	}

	body, err := json.Marshal(dto)
	if err != nil {
		t.Fatalf("marshal dto failed: %v", err)
	}

	var parsed map[string]any
	if err := json.Unmarshal(body, &parsed); err != nil {
		t.Fatalf("unmarshal dto failed: %v", err)
	}

	fragmentConfig, ok := parsed["fragment_config"].(map[string]any)
	if !ok {
		t.Fatalf("fragment_config not found in response: %s", string(body))
	}
	if _, exists := fragmentConfig["parent_child"]; exists {
		t.Fatalf("expected parent_child omitted in response: %s", string(body))
	}
	normal, ok := fragmentConfig["normal"].(map[string]any)
	if !ok {
		t.Fatalf("normal not found in response: %s", string(body))
	}
	segmentRule, ok := normal["segment_rule"].(map[string]any)
	if !ok {
		t.Fatalf("segment_rule not found in response: %s", string(body))
	}
	val, exists := segmentRule["chunk_overlap"]
	if !exists {
		t.Fatalf("expected chunk_overlap=0, got missing field")
	}
	chunkOverlap, ok := val.(float64)
	if !ok || chunkOverlap != 0 {
		t.Fatalf("expected chunk_overlap=0, got %#v", val)
	}
	if unit, exists := segmentRule["chunk_overlap_unit"]; !exists || unit != "absolute" {
		t.Fatalf("expected chunk_overlap_unit=absolute, got %#v", unit)
	}
}

func TestKnowledgeBasePopulateFragmentCounts_UsesAggregatedStats(t *testing.T) {
	t.Parallel()
	counter := &fakeFragmentCounter{
		total:  1,
		synced: 1,
	}
	appSvc := service.NewKnowledgeBaseAppService(nil, counter, nil, "")
	dto := &kbdto.KnowledgeBaseDTO{Code: "KNOWLEDGE-TEST"}

	service.PopulateFragmentCountsForTest(context.Background(), appSvc, dto)

	if dto.FragmentCount != 1 {
		t.Fatalf("expected fragment_count=1, got %d", dto.FragmentCount)
	}
	if dto.ExpectedCount != 1 {
		t.Fatalf("expected expected_count=1, got %d", dto.ExpectedCount)
	}
	if dto.CompletedCount != 1 {
		t.Fatalf("expected completed_count=1, got %d", dto.CompletedCount)
	}
	if counter.statsCalls != 1 {
		t.Fatalf("expected aggregated stats call once, got %d", counter.statsCalls)
	}
	if counter.totalCalls != 0 || counter.syncedCalls != 0 {
		t.Fatalf("expected no fallback count calls, got total=%d synced=%d", counter.totalCalls, counter.syncedCalls)
	}
}

func TestNormalizeVectorDB_DefaultWhenEmpty(t *testing.T) {
	t.Parallel()
	defaultVectorDB := service.DefaultKnowledgeBaseVectorDBForTest()
	if got := service.NormalizeVectorDBForTest(""); got != defaultVectorDB {
		t.Fatalf("expected default vector_db=%q, got %q", defaultVectorDB, got)
	}
	if got := service.NormalizeVectorDBForTest("  custom_db  "); got != "custom_db" {
		t.Fatalf("expected trimmed vector_db=custom_db, got %q", got)
	}
}

func TestEnsureKnowledgeBaseCode_GenerateWhenEmpty(t *testing.T) {
	t.Parallel()
	codePrefix := service.KnowledgeBaseCodePrefixForTest()
	code := service.EnsureKnowledgeBaseCodeForTest("  ")
	if !strings.HasPrefix(code, codePrefix+"-") {
		t.Fatalf("expected code prefix %q, got %q", codePrefix+"-", code)
	}
	pattern := `^KNOWLEDGE-[a-f0-9]{14}-[a-f0-9]{8}$`
	if !regexp.MustCompile(pattern).MatchString(code) {
		t.Fatalf("generated code does not match pattern %q: %q", pattern, code)
	}
}

func TestEnsureKnowledgeBaseCode_KeepProvidedValue(t *testing.T) {
	t.Parallel()
	const explicitCode = "KNOWLEDGE-explicit"
	if got := service.EnsureKnowledgeBaseCodeForTest(explicitCode); got != explicitCode {
		t.Fatalf("expected explicit code %q, got %q", explicitCode, got)
	}
}

func TestInputToEntity_AssignsCode(t *testing.T) {
	t.Parallel()
	const explicitCode = "KNOWLEDGE-assigned"
	svc := &service.KnowledgeBaseAppService{}

	kb := service.InputToEntityForTest(svc, &kbdto.CreateKnowledgeBaseInput{
		Code:             explicitCode,
		Name:             "test",
		Description:      "test",
		Type:             1,
		Model:            "text-embedding-3-large",
		VectorDB:         "odin_qdrant",
		OrganizationCode: "DT001",
		UserID:           "usi_test",
	})

	if kb.Code != explicitCode {
		t.Fatalf("expected entity code %q, got %q", explicitCode, kb.Code)
	}
}

func TestKnowledgeBaseEntityToDTOWithContext_UsesEffectiveRouteModel(t *testing.T) {
	t.Parallel()
	svc := service.NewKnowledgeBaseAppServiceForTest(t, &routeAwareKnowledgeBaseDomainService{effectiveModel: effectiveEmbeddingModel}, nil, nil, nil, "")
	kb := &kbentity.KnowledgeBase{
		Code:            "KNOWLEDGE-TEST",
		Model:           "text-embedding-3-small",
		EmbeddingConfig: &shared.EmbeddingConfig{ModelID: "text-embedding-3-small"},
	}

	dto, err := service.EntityToDTOWithContextForTest(context.Background(), svc, kb)
	if err != nil {
		t.Fatalf("expected dto conversion success, got error: %v", err)
	}
	if dto == nil {
		t.Fatal("expected dto not nil")
	}
	if dto.Model != effectiveEmbeddingModel {
		t.Fatalf("expected effective model text-embedding-3-large, got %q", dto.Model)
	}
	if dto.EmbeddingConfig == nil || dto.EmbeddingConfig.ModelID != effectiveEmbeddingModel {
		t.Fatalf("expected embedding_config.model_id overridden, got %#v", dto.EmbeddingConfig)
	}
}

type fakeFragmentCounter struct {
	total       int64
	synced      int64
	totalCalls  int
	syncedCalls int
	statsCalls  int
}

type routeAwareKnowledgeBaseDomainService struct {
	effectiveModel string
}

var errRouteAwareNotImplemented = errors.New("route aware test double: not implemented")

func (f *routeAwareKnowledgeBaseDomainService) PrepareForSave(context.Context, *kbentity.KnowledgeBase) error {
	return nil
}

func (f *routeAwareKnowledgeBaseDomainService) Save(context.Context, *kbentity.KnowledgeBase) error {
	return nil
}

func (f *routeAwareKnowledgeBaseDomainService) Update(context.Context, *kbentity.KnowledgeBase) error {
	return nil
}

func (f *routeAwareKnowledgeBaseDomainService) UpdateProgress(context.Context, *kbentity.KnowledgeBase) error {
	return nil
}

func (f *routeAwareKnowledgeBaseDomainService) ShowByCodeAndOrg(context.Context, string, string) (*kbentity.KnowledgeBase, error) {
	return nil, errRouteAwareNotImplemented
}

func (f *routeAwareKnowledgeBaseDomainService) List(context.Context, *kbrepository.Query) ([]*kbentity.KnowledgeBase, int64, error) {
	return nil, 0, errRouteAwareNotImplemented
}

func (f *routeAwareKnowledgeBaseDomainService) Destroy(context.Context, *kbentity.KnowledgeBase) error {
	return nil
}

func (f *routeAwareKnowledgeBaseDomainService) DeleteVectorData(context.Context, *kbentity.KnowledgeBase) error {
	return nil
}

func (f *routeAwareKnowledgeBaseDomainService) ResolveRuntimeRoute(_ context.Context, kb *kbentity.KnowledgeBase) sharedroute.ResolvedRoute {
	collectionName := ""
	if kb != nil {
		collectionName = kb.CollectionName()
	}
	return sharedroute.ResolvedRoute{
		LogicalCollectionName:  collectionName,
		PhysicalCollectionName: collectionName,
		VectorCollectionName:   collectionName,
		TermCollectionName:     collectionName,
		Model:                  f.effectiveModel,
	}
}

func (f *fakeFragmentCounter) CountByKnowledgeBase(_ context.Context, _ string) (int64, error) {
	f.totalCalls++
	return f.total, nil
}

func (f *fakeFragmentCounter) CountSyncedByKnowledgeBase(_ context.Context, _ string) (int64, error) {
	f.syncedCalls++
	return f.synced, nil
}

func (f *fakeFragmentCounter) CountStatsByKnowledgeBase(_ context.Context, _ string) (int64, int64, error) {
	f.statsCalls++
	return f.total, f.synced, nil
}

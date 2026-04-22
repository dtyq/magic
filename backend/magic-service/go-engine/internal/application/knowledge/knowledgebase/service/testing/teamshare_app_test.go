package kbapp_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	miniredis "github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	service "magic/internal/application/knowledge/knowledgebase/service"
	documentdomain "magic/internal/domain/knowledge/document/service"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/service"
	"magic/internal/pkg/thirdplatform"
)

func TestTeamshareManageableGeneratesStableTempCodeAndWritesRedisMappings(t *testing.T) {
	t.Parallel()

	redisServer, redisClient := newTeamshareTestRedis(t)
	defer redisServer.Close()

	domain := &recordingKnowledgeBaseDomainService{}
	expander := &teamshareKnowledgeExpander{
		knowledgeBases: []thirdplatform.KnowledgeBaseItem{{
			KnowledgeBaseID: testTeamshareKnowledgeID,
			Name:            "天书知识库",
			Description:     "来自 Teamshare",
		}},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, effectiveEmbeddingModel)
	app.SetThirdPlatformExpander(expander)
	app.SetTeamshareTempCodeMapper(service.NewRedisTeamshareTempCodeMapper(redisClient))

	first, err := app.TeamshareManageable(context.Background(), &kbdto.TeamshareManageableInput{
		OrganizationCode: testOrganizationCode1,
		UserID:           testKnowledgeBaseUpdater,
	})
	if err != nil {
		t.Fatalf("TeamshareManageable returned error: %v", err)
	}
	second, err := app.TeamshareManageable(context.Background(), &kbdto.TeamshareManageableInput{
		OrganizationCode: testOrganizationCode1,
		UserID:           testKnowledgeBaseUpdater,
	})
	if err != nil {
		t.Fatalf("TeamshareManageable second call returned error: %v", err)
	}
	if len(first) != 1 || len(second) != 1 {
		t.Fatalf("unexpected manageable result: first=%#v second=%#v", first, second)
	}
	if first[0].KnowledgeCode == "" || !strings.HasPrefix(first[0].KnowledgeCode, service.KnowledgeBaseCodePrefixForTest()+"-") {
		t.Fatalf("expected temp knowledge code, got %#v", first[0])
	}
	if first[0].KnowledgeCode != second[0].KnowledgeCode {
		t.Fatalf("expected stable temp code, got %q and %q", first[0].KnowledgeCode, second[0].KnowledgeCode)
	}
	if first[0].BusinessID != testTeamshareKnowledgeID || first[0].VectorStatus != 0 {
		t.Fatalf("unexpected manageable payload: %#v", first[0])
	}

	forwardValue, err := redisClient.Get(context.Background(), "knowledge-code:generate:2:"+testTeamshareKnowledgeID).Result()
	if err != nil {
		t.Fatalf("expected forward mapping in redis: %v", err)
	}
	if forwardValue != first[0].KnowledgeCode {
		t.Fatalf("unexpected forward mapping value: %q", forwardValue)
	}
	reverseValue, err := redisClient.Get(context.Background(), "knowledge-code:teamshare-temp:2:"+first[0].KnowledgeCode).Result()
	if err != nil {
		t.Fatalf("expected reverse mapping in redis: %v", err)
	}
	if reverseValue != testTeamshareKnowledgeID {
		t.Fatalf("unexpected reverse mapping value: %q", reverseValue)
	}
}

func TestTeamshareManageablePrefersRealKnowledgeCode(t *testing.T) {
	t.Parallel()

	redisServer, redisClient := newTeamshareTestRedis(t)
	defer redisServer.Close()

	domain := &recordingKnowledgeBaseDomainService{
		filterListByQuery: true,
		listKBS: []*knowledgebasedomain.KnowledgeBase{{
			Code:             testAppKnowledgeBaseCode,
			Type:             2,
			BusinessID:       testTeamshareKnowledgeID,
			Name:             "本地知识库",
			Description:      "local",
			OrganizationCode: testOrganizationCode1,
			ExpectedNum:      10,
			CompletedNum:     3,
		}},
	}
	expander := &teamshareKnowledgeExpander{
		knowledgeBases: []thirdplatform.KnowledgeBaseItem{{
			KnowledgeBaseID: testTeamshareKnowledgeID,
			Name:            "远端名称",
			Description:     "远端描述",
		}},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, effectiveEmbeddingModel)
	app.SetThirdPlatformExpander(expander)
	app.SetTeamshareTempCodeMapper(service.NewRedisTeamshareTempCodeMapper(redisClient))

	list, err := app.TeamshareManageable(context.Background(), &kbdto.TeamshareManageableInput{
		OrganizationCode: testOrganizationCode1,
		UserID:           testKnowledgeBaseUpdater,
	})
	if err != nil {
		t.Fatalf("TeamshareManageable returned error: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("unexpected manageable list: %#v", list)
	}
	if list[0].KnowledgeCode != testAppKnowledgeBaseCode || list[0].VectorStatus != 1 {
		t.Fatalf("expected real local code and in-progress status, got %#v", list[0])
	}
	if _, err := redisClient.Get(context.Background(), "knowledge-code:generate:2:"+testTeamshareKnowledgeID).Result(); !errors.Is(err, redis.Nil) {
		t.Fatalf("expected no temp code mapping for imported knowledge, got err=%v", err)
	}
}

func TestTeamshareManageableProgressReturnsLocalTruthForRealCode(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		filterListByQuery: true,
		listKBS: []*knowledgebasedomain.KnowledgeBase{{
			Code:             testAppKnowledgeBaseCode,
			Type:             2,
			BusinessID:       testTeamshareKnowledgeID,
			Name:             "本地知识库",
			Description:      "done",
			OrganizationCode: testOrganizationCode1,
			ExpectedNum:      6,
			CompletedNum:     6,
		}},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, effectiveEmbeddingModel)

	list, err := app.TeamshareManageableProgress(context.Background(), &kbdto.TeamshareManageableProgressInput{
		OrganizationCode: testOrganizationCode1,
		UserID:           testKnowledgeBaseUpdater,
		KnowledgeCodes:   []string{testAppKnowledgeBaseCode},
	})
	if err != nil {
		t.Fatalf("TeamshareManageableProgress returned error: %v", err)
	}
	if len(list) != 1 || list[0].KnowledgeCode != testAppKnowledgeBaseCode || list[0].VectorStatus != 2 {
		t.Fatalf("unexpected progress result: %#v", list)
	}
}

func TestTeamshareManageableProgressReturnsZeroForPendingTempCode(t *testing.T) {
	t.Parallel()

	redisServer, redisClient := newTeamshareTestRedis(t)
	defer redisServer.Close()

	mapper := service.NewRedisTeamshareTempCodeMapper(redisClient)
	tempCode, err := mapper.EnsureKnowledgeCode(context.Background(), testTeamshareKnowledgeID)
	if err != nil {
		t.Fatalf("EnsureKnowledgeCode returned error: %v", err)
	}

	app := service.NewKnowledgeBaseAppServiceForTest(t, &recordingKnowledgeBaseDomainService{}, nil, nil, nil, effectiveEmbeddingModel)
	app.SetTeamshareTempCodeMapper(mapper)

	list, err := app.TeamshareManageableProgress(context.Background(), &kbdto.TeamshareManageableProgressInput{
		OrganizationCode: testOrganizationCode1,
		UserID:           testKnowledgeBaseUpdater,
		KnowledgeCodes:   []string{tempCode},
	})
	if err != nil {
		t.Fatalf("TeamshareManageableProgress returned error: %v", err)
	}
	if len(list) != 1 || list[0].KnowledgeCode != tempCode || list[0].BusinessID != testTeamshareKnowledgeID {
		t.Fatalf("unexpected progress result: %#v", list)
	}
	if list[0].VectorStatus != 0 || list[0].ExpectedNum != 0 || list[0].CompletedNum != 0 {
		t.Fatalf("expected zero-value progress for pending temp code, got %#v", list[0])
	}
}

func TestTeamshareManageableProgressResolvesImportedKnowledgeByTempCode(t *testing.T) {
	t.Parallel()

	redisServer, redisClient := newTeamshareTestRedis(t)
	defer redisServer.Close()

	mapper := service.NewRedisTeamshareTempCodeMapper(redisClient)
	tempCode, err := mapper.EnsureKnowledgeCode(context.Background(), testTeamshareKnowledgeID)
	if err != nil {
		t.Fatalf("EnsureKnowledgeCode returned error: %v", err)
	}

	domain := &recordingKnowledgeBaseDomainService{
		filterListByQuery: true,
		listKBS: []*knowledgebasedomain.KnowledgeBase{{
			Code:             testAppKnowledgeBaseCode,
			Type:             2,
			BusinessID:       testTeamshareKnowledgeID,
			Name:             "已接管知识库",
			Description:      "processing",
			OrganizationCode: testOrganizationCode1,
			ExpectedNum:      9,
			CompletedNum:     4,
		}},
	}
	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, nil, nil, nil, effectiveEmbeddingModel)
	app.SetTeamshareTempCodeMapper(mapper)

	list, err := app.TeamshareManageableProgress(context.Background(), &kbdto.TeamshareManageableProgressInput{
		OrganizationCode: testOrganizationCode1,
		UserID:           testKnowledgeBaseUpdater,
		KnowledgeCodes:   []string{tempCode},
	})
	if err != nil {
		t.Fatalf("TeamshareManageableProgress returned error: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("unexpected progress result: %#v", list)
	}
	if list[0].KnowledgeCode != tempCode || list[0].BusinessID != testTeamshareKnowledgeID || list[0].Name != "已接管知识库" {
		t.Fatalf("expected temp code to map to local truth, got %#v", list[0])
	}
	if list[0].VectorStatus != 1 || list[0].CompletedNum != 4 {
		t.Fatalf("unexpected mapped progress payload: %#v", list[0])
	}
}

func TestTeamshareManageableProgressReturnsZeroForUnknownCode(t *testing.T) {
	t.Parallel()

	app := service.NewKnowledgeBaseAppServiceForTest(t, &recordingKnowledgeBaseDomainService{}, nil, nil, nil, effectiveEmbeddingModel)
	app.SetTeamshareTempCodeMapper(&teamshareTempCodeMapperStub{})

	list, err := app.TeamshareManageableProgress(context.Background(), &kbdto.TeamshareManageableProgressInput{
		OrganizationCode: testOrganizationCode1,
		UserID:           testKnowledgeBaseUpdater,
		KnowledgeCodes:   []string{"KNOWLEDGE-UNKNOWN"},
	})
	if err != nil {
		t.Fatalf("TeamshareManageableProgress returned error: %v", err)
	}
	if len(list) != 1 || list[0].KnowledgeCode != "KNOWLEDGE-UNKNOWN" || list[0].BusinessID != "" || list[0].VectorStatus != 0 {
		t.Fatalf("unexpected progress result: %#v", list)
	}
}

func TestTeamshareStartVectorCreatesKnowledgeWithoutImmediateSync(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		effectiveModel:    effectiveEmbeddingModel,
		filterListByQuery: true,
	}
	docManager := &recordingKnowledgeBaseDocumentManager{}
	sourceBindingRepo := &recordingSourceBindingRepository{}
	ownerGrantPort := &recordingKnowledgeBaseOwnerGrantPort{}
	expander := &teamshareKnowledgeExpander{
		knowledgeBases: []thirdplatform.KnowledgeBaseItem{{
			KnowledgeBaseID: testTeamshareKnowledgeID,
			Name:            "Teamshare 知识库",
			Description:     "首次导入",
		}},
		expandResults: []*documentdomain.File{{
			Type:            "third_platform",
			Name:            "文档-1",
			ThirdID:         "FILE-1",
			SourceType:      sourcebindingdomain.ProviderTeamshare,
			KnowledgeBaseID: testTeamshareKnowledgeID,
		}},
	}

	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, docManager, nil, nil, effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	app.SetThirdPlatformExpander(expander)
	app.SetOwnerGrantPort(ownerGrantPort)
	app.SetOfficialOrganizationMemberChecker(&recordingKnowledgeBasePermissionReader{official: false})

	result, err := app.TeamshareStartVector(context.Background(), &kbdto.TeamshareStartVectorInput{
		OrganizationCode: testOrganizationCode1,
		UserID:           testKnowledgeBaseUpdater,
		KnowledgeID:      testTeamshareKnowledgeID,
	})
	if err != nil {
		t.Fatalf("TeamshareStartVector returned error: %v", err)
	}
	if result == nil || result.KnowledgeCode == "" {
		t.Fatalf("unexpected start-vector result: %#v", result)
	}
	if domain.savedKB == nil || domain.savedKB.BusinessID != testTeamshareKnowledgeID {
		t.Fatalf("expected knowledge base saved locally, got %#v", domain.savedKB)
	}
	if domain.savedKB.RetrieveConfig == nil || domain.savedKB.FragmentConfig == nil {
		t.Fatalf("expected created knowledge base configs normalized, got %#v", domain.savedKB)
	}
	if domain.savedKB.FragmentConfig.Mode != shared.FragmentModeAuto {
		t.Fatalf("expected auto fragment config, got %#v", domain.savedKB.FragmentConfig)
	}
	if result.KnowledgeCode != domain.savedKB.Code {
		t.Fatalf("expected start-vector to return managed knowledge code %q, got %#v", domain.savedKB.Code, result)
	}
	if ownerGrantPort.lastKnowledgeBaseCode == "" {
		t.Fatal("expected owner permission granted for newly created teamshare knowledge")
	}
	if len(sourceBindingRepo.lastReplaceBindings) != 1 {
		t.Fatalf("expected one teamshare source binding, got %#v", sourceBindingRepo.lastReplaceBindings)
	}
	binding := sourceBindingRepo.lastReplaceBindings[0]
	if binding.RootType != sourcebindingdomain.RootTypeKnowledgeBase || binding.RootRef != testTeamshareKnowledgeID {
		t.Fatalf("unexpected teamshare binding: %#v", binding)
	}
	if len(docManager.syncInputs) != 0 {
		t.Fatalf("expected no immediate sync scheduling, got %#v", docManager.syncInputs)
	}
	if len(docManager.createInputs) != 1 {
		t.Fatalf("expected prepare rebuild to materialize one managed document, got %#v", docManager.createInputs)
	}
}

func TestTeamshareStartVectorUpsertsByBusinessIDWithoutDuplicateCreate(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{
		effectiveModel:    effectiveEmbeddingModel,
		filterListByQuery: true,
	}
	docManager := &recordingKnowledgeBaseDocumentManager{}
	sourceBindingRepo := &recordingSourceBindingRepository{}
	ownerGrantPort := &recordingKnowledgeBaseOwnerGrantPort{}
	expander := &teamshareKnowledgeExpander{
		knowledgeBases: []thirdplatform.KnowledgeBaseItem{{
			KnowledgeBaseID: testTeamshareKnowledgeID,
			Name:            "Teamshare 知识库",
			Description:     "首次导入",
		}},
		expandResults: []*documentdomain.File{{
			Type:            "third_platform",
			Name:            "文档-1",
			ThirdID:         "FILE-1",
			SourceType:      sourcebindingdomain.ProviderTeamshare,
			KnowledgeBaseID: testTeamshareKnowledgeID,
		}},
	}

	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, docManager, nil, nil, effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	app.SetThirdPlatformExpander(expander)
	app.SetOwnerGrantPort(ownerGrantPort)

	if _, err := app.TeamshareStartVector(context.Background(), &kbdto.TeamshareStartVectorInput{
		OrganizationCode: testOrganizationCode1,
		UserID:           testKnowledgeBaseUpdater,
		KnowledgeID:      testTeamshareKnowledgeID,
	}); err != nil {
		t.Fatalf("first TeamshareStartVector returned error: %v", err)
	}

	existing := cloneKnowledgeBase(domain.savedKB)
	existing.Description = "旧描述"
	existing.RetrieveConfig = nil
	existing.FragmentConfig = nil
	domain.listKBS = []*knowledgebasedomain.KnowledgeBase{existing}
	domain.savedKB = nil
	ownerGrantPort.lastKnowledgeBaseCode = ""
	expander.knowledgeBases = []thirdplatform.KnowledgeBaseItem{{
		KnowledgeBaseID: testTeamshareKnowledgeID,
		Name:            "Teamshare 知识库",
		Description:     "更新后的描述",
	}}

	if _, err := app.TeamshareStartVector(context.Background(), &kbdto.TeamshareStartVectorInput{
		OrganizationCode: testOrganizationCode1,
		UserID:           testKnowledgeBaseUpdater,
		KnowledgeID:      testTeamshareKnowledgeID,
	}); err != nil {
		t.Fatalf("second TeamshareStartVector returned error: %v", err)
	}

	if domain.savedKB != nil {
		t.Fatalf("expected second start-vector to avoid duplicate create, got savedKB=%#v", domain.savedKB)
	}
	if domain.updatedKB == nil || domain.updatedKB.Code != existing.Code || domain.updatedKB.Description != "更新后的描述" {
		t.Fatalf("expected existing knowledge to be updated in place, got %#v", domain.updatedKB)
	}
	if domain.updatedKB.RetrieveConfig == nil || domain.updatedKB.FragmentConfig == nil {
		t.Fatalf("expected updated knowledge base configs normalized, got %#v", domain.updatedKB)
	}
	if ownerGrantPort.lastKnowledgeBaseCode != "" {
		t.Fatalf("expected update path not to grant owner again, got %q", ownerGrantPort.lastKnowledgeBaseCode)
	}
}

func newTeamshareTestRedis(t *testing.T) (*miniredis.Miniredis, *redis.Client) {
	t.Helper()

	server, err := miniredis.Run()
	if err != nil {
		t.Fatalf("start miniredis: %v", err)
	}
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() {
		_ = client.Close()
	})
	return server, client
}

type teamshareKnowledgeExpander struct {
	knowledgeBases   []thirdplatform.KnowledgeBaseItem
	expandResults    []*documentdomain.File
	err              error
	lastListOrg      string
	lastListUser     string
	lastExpandOrg    string
	lastExpandUser   string
	lastDocumentFile []map[string]any
}

func (e *teamshareKnowledgeExpander) Expand(
	_ context.Context,
	organizationCode string,
	userID string,
	documentFiles []map[string]any,
) ([]*documentdomain.File, error) {
	e.lastExpandOrg = organizationCode
	e.lastExpandUser = userID
	e.lastDocumentFile = append([]map[string]any(nil), documentFiles...)
	if e.err != nil {
		return nil, e.err
	}
	return e.expandResults, nil
}

func (e *teamshareKnowledgeExpander) ListKnowledgeBases(
	_ context.Context,
	organizationCode string,
	userID string,
) ([]thirdplatform.KnowledgeBaseItem, error) {
	e.lastListOrg = organizationCode
	e.lastListUser = userID
	if e.err != nil {
		return nil, e.err
	}
	return append([]thirdplatform.KnowledgeBaseItem(nil), e.knowledgeBases...), nil
}

func (e *teamshareKnowledgeExpander) ListTreeNodes(context.Context, string, string, string, string) ([]thirdplatform.TreeNode, error) {
	return nil, nil
}

type teamshareTempCodeMapperStub struct {
	businessIDs map[string]string
}

func (s *teamshareTempCodeMapperStub) EnsureKnowledgeCode(context.Context, string) (string, error) {
	return "", nil
}

func (s *teamshareTempCodeMapperStub) LookupBusinessIDs(context.Context, []string) (map[string]string, error) {
	if s.businessIDs == nil {
		return map[string]string{}, nil
	}
	return s.businessIDs, nil
}

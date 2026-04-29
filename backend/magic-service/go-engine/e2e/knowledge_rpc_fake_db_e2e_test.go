package e2e_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"slices"
	"sync"
	"testing"
	"time"

	docdto "magic/internal/application/knowledge/document/dto"
	fragmentapp "magic/internal/application/knowledge/fragment/service"
	pagehelper "magic/internal/application/knowledge/helper/page"
	kbapp "magic/internal/application/knowledge/knowledgebase/service"
	apprebuild "magic/internal/application/knowledge/rebuild"
	rebuilddto "magic/internal/application/knowledge/rebuild/dto"
	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/constants"
	documentdomain "magic/internal/domain/knowledge/document/service"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragretrieval "magic/internal/domain/knowledge/fragment/retrieval"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
	sharedentity "magic/internal/domain/knowledge/shared/entity"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	"magic/internal/infrastructure/logging"
	rpcdto "magic/internal/interfaces/rpc/jsonrpc/knowledge/dto"
	knowledgeroutes "magic/internal/interfaces/rpc/jsonrpc/knowledge/routes"
	knowledgeService "magic/internal/interfaces/rpc/jsonrpc/knowledge/service"
	"magic/internal/pkg/ctxmeta"
	jsonrpc "magic/internal/pkg/jsonrpc"
)

var errNotImplemented = errors.New("not implemented")

const (
	testOrgCode             = "DT001"
	testUserID              = "usi_test"
	testEmbeddingModelSmall = "text-embedding-3-small"
	testRebuildKBCode       = "KNOWLEDGE-699e98b2e82652-76141421"
	testOtherKBCode         = "KNOWLEDGE-OTHER"
	testRebuildRunID        = "r-e2e-rebuild"
	testKnowledgeBaseOwner  = "owner"
)

// fakeKnowledgeBaseRepoForE2E 仅替代 DB 仓储层：
// 1) list/show 走真实返回与参数记录，用于断言跨层透传
// 2) 其余方法显式返回未实现，避免测试误调用被静默吞掉
type fakeKnowledgeBaseRepoForE2E struct {
	listResult []*kbentity.KnowledgeBase
	listTotal  int64
	listErr    error

	showResult *kbentity.KnowledgeBase
	showErr    error

	lastQuery *kbrepository.Query
	lastCode  string
	lastOrg   string
}

type fakeFragmentServiceForE2E struct {
	listByDocument   map[string][]*fragmodel.KnowledgeBaseFragment
	similarityResult []*fragmodel.SimilarityResult
	lastListQuery    *fragmodel.Query
	lastSimilarity   fragretrieval.SimilarityRequest
}

type fakeKnowledgeBaseReaderForFragmentE2E struct {
	showResult *kbentity.KnowledgeBase
	showErr    error
}

type fakeKnowledgeBasePermissionReaderForE2E struct {
	repo *fakeKnowledgeBaseRepoForE2E
}

type fakeDocumentStateStoreForE2E struct {
	mu          sync.Mutex
	byKnowledge map[string][]*docdto.DocumentDTO
}

type fakeDocumentQueryAppForE2E struct {
	store                *fakeDocumentStateStoreForE2E
	lastListInput        *docdto.ListDocumentInput
	lastGetByThirdFileID *docdto.GetDocumentsByThirdFileIDInput
}

type fakeRebuildTriggerForE2E struct {
	store          *fakeDocumentStateStoreForE2E
	now            func() time.Time
	runID          string
	calls          int
	lastRunOptions rebuilddto.RunOptions
}

type rebuildReadyKnowledgeBaseAppForE2E struct{}

func (*rebuildReadyKnowledgeBaseAppForE2E) PrepareRebuild(context.Context, string, kbapp.RebuildScope) error {
	return nil
}

func (f *fakeKnowledgeBaseRepoForE2E) Save(_ context.Context, _ *kbentity.KnowledgeBase) error {
	return errNotImplemented
}

func (f *fakeKnowledgeBaseRepoForE2E) Update(_ context.Context, _ *kbentity.KnowledgeBase) error {
	return errNotImplemented
}

func (f *fakeKnowledgeBaseRepoForE2E) FindByID(_ context.Context, _ int64) (*kbentity.KnowledgeBase, error) {
	return nil, errNotImplemented
}

func (f *fakeKnowledgeBaseRepoForE2E) FindByCode(_ context.Context, _ string) (*kbentity.KnowledgeBase, error) {
	return nil, errNotImplemented
}

func (f *fakeKnowledgeBaseRepoForE2E) FindByCodeAndOrg(_ context.Context, code, orgCode string) (*kbentity.KnowledgeBase, error) {
	f.lastCode = code
	f.lastOrg = orgCode
	if f.showErr != nil {
		return nil, f.showErr
	}
	return f.showResult, nil
}

func (f *fakeKnowledgeBaseRepoForE2E) List(_ context.Context, query *kbrepository.Query) ([]*kbentity.KnowledgeBase, int64, error) {
	f.lastQuery = query
	if f.listErr != nil {
		return nil, 0, f.listErr
	}
	if f.listResult == nil {
		return []*kbentity.KnowledgeBase{}, 0, nil
	}
	return f.listResult, f.listTotal, nil
}

func (f *fakeKnowledgeBaseRepoForE2E) Delete(_ context.Context, _ int64) error {
	return errNotImplemented
}

func (f *fakeKnowledgeBaseRepoForE2E) UpdateSyncStatus(_ context.Context, _ int64, _ shared.SyncStatus, _ string) error {
	return errNotImplemented
}

func (f *fakeKnowledgeBaseRepoForE2E) UpdateProgress(_ context.Context, _ int64, _, _ int) error {
	return errNotImplemented
}

func (f *fakeFragmentServiceForE2E) Save(context.Context, *fragmodel.KnowledgeBaseFragment) error {
	return errNotImplemented
}

func (f *fakeFragmentServiceForE2E) Show(context.Context, int64) (*fragmodel.KnowledgeBaseFragment, error) {
	return nil, errNotImplemented
}

func (f *fakeFragmentServiceForE2E) FindByPointIDs(_ context.Context, pointIDs []string) ([]*fragmodel.KnowledgeBaseFragment, error) {
	if len(pointIDs) == 0 {
		return []*fragmodel.KnowledgeBaseFragment{}, nil
	}
	byPointID := make(map[string]*fragmodel.KnowledgeBaseFragment, len(pointIDs))
	for _, fragments := range f.listByDocument {
		for _, fragment := range fragments {
			if fragment == nil || fragment.PointID == "" {
				continue
			}
			byPointID[fragment.PointID] = fragment
		}
	}
	result := make([]*fragmodel.KnowledgeBaseFragment, 0, len(pointIDs))
	for _, pointID := range pointIDs {
		if fragment, ok := byPointID[pointID]; ok {
			result = append(result, fragment)
		}
	}
	return result, nil
}

func (f *fakeFragmentServiceForE2E) ListContextByDocuments(
	_ context.Context,
	documentKeys []fragmodel.DocumentKey,
	limit int,
) (map[fragmodel.DocumentKey][]*fragmodel.KnowledgeBaseFragment, error) {
	result := make(map[fragmodel.DocumentKey][]*fragmodel.KnowledgeBaseFragment, len(documentKeys))
	for _, key := range documentKeys {
		fragments := append([]*fragmodel.KnowledgeBaseFragment(nil), f.listByDocument[key.DocumentCode]...)
		if limit > 0 && len(fragments) > limit {
			fragments = fragments[:limit]
		}
		result[key] = fragments
	}
	return result, nil
}

func (f *fakeFragmentServiceForE2E) List(_ context.Context, query *fragmodel.Query) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	f.lastListQuery = query
	if f.listByDocument == nil {
		return []*fragmodel.KnowledgeBaseFragment{}, 0, nil
	}
	fragments := f.listByDocument[query.DocumentCode]
	if len(fragments) == 0 {
		return []*fragmodel.KnowledgeBaseFragment{}, 0, nil
	}

	start := min(query.Offset, len(fragments))
	end := min(query.Offset+query.Limit, len(fragments))
	if query.Limit <= 0 {
		start = 0
		end = len(fragments)
	}
	return fragments[start:end], int64(len(fragments)), nil
}

func (f *fakeFragmentServiceForE2E) Destroy(context.Context, *fragmodel.KnowledgeBaseFragment, string) error {
	return errNotImplemented
}

func (*fakeFragmentServiceForE2E) DestroyBatch(context.Context, []*fragmodel.KnowledgeBaseFragment, string) error {
	return nil
}

func (*fakeFragmentServiceForE2E) SetPayloadByPointIDs(context.Context, string, map[string]map[string]any) error {
	return nil
}

func (*fakeFragmentServiceForE2E) ListPointIDsByFilter(context.Context, string, *fragmodel.VectorFilter, int) ([]string, error) {
	return []string{}, nil
}

func (f *fakeFragmentServiceForE2E) SyncFragment(context.Context, any, *fragmodel.KnowledgeBaseFragment, *ctxmeta.BusinessParams) error {
	return errNotImplemented
}

func (f *fakeFragmentServiceForE2E) Similarity(
	_ context.Context,
	_ any,
	req fragretrieval.SimilarityRequest,
) ([]*fragmodel.SimilarityResult, error) {
	f.lastSimilarity = req
	return f.similarityResult, nil
}

func (*fakeFragmentServiceForE2E) WarmupRetrieval(context.Context) error {
	return nil
}

func (f *fakeKnowledgeBaseReaderForFragmentE2E) Show(context.Context, string) (*kbentity.KnowledgeBase, error) {
	if f.showErr != nil {
		return nil, f.showErr
	}
	return f.showResult, nil
}

func (f *fakeKnowledgeBaseReaderForFragmentE2E) ShowByCodeAndOrg(context.Context, string, string) (*kbentity.KnowledgeBase, error) {
	if f.showErr != nil {
		return nil, f.showErr
	}
	return f.showResult, nil
}

func (f *fakeKnowledgeBaseReaderForFragmentE2E) List(
	_ context.Context,
	query *kbrepository.Query,
) ([]*kbentity.KnowledgeBase, int64, error) {
	if f.showErr != nil {
		return nil, 0, f.showErr
	}
	if f.showResult == nil {
		return []*kbentity.KnowledgeBase{}, 0, nil
	}
	if query != nil && len(query.Codes) > 0 && !slices.Contains(query.Codes, f.showResult.Code) {
		return []*kbentity.KnowledgeBase{}, 0, nil
	}
	return []*kbentity.KnowledgeBase{f.showResult}, 1, nil
}

func (f *fakeKnowledgeBaseReaderForFragmentE2E) ResolveRuntimeRoute(_ context.Context, kb *kbentity.KnowledgeBase) sharedroute.ResolvedRoute {
	collectionName := constants.KnowledgeBaseCollectionName
	if kb != nil && kb.CollectionName() != "" {
		collectionName = kb.CollectionName()
	} else if f != nil && f.showResult != nil && f.showResult.CollectionName() != "" {
		collectionName = f.showResult.CollectionName()
	}

	return sharedroute.ResolvedRoute{
		LogicalCollectionName:  collectionName,
		PhysicalCollectionName: collectionName,
		VectorCollectionName:   collectionName,
		TermCollectionName:     collectionName,
		Model:                  testEmbeddingModelSmall,
	}
}

func (s *fakeDocumentStateStoreForE2E) listByKnowledgeBase(knowledgeBaseCode string, offset, limit int) ([]*docdto.DocumentDTO, int64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	documents := s.byKnowledge[knowledgeBaseCode]
	if len(documents) == 0 {
		return []*docdto.DocumentDTO{}, 0
	}

	start := min(offset, len(documents))
	end := min(offset+limit, len(documents))
	if limit <= 0 {
		start = 0
		end = len(documents)
	}

	page := make([]*docdto.DocumentDTO, 0, end-start)
	for _, document := range documents[start:end] {
		page = append(page, cloneDocumentDTO(document))
	}

	return page, int64(len(documents))
}

func (s *fakeDocumentStateStoreForE2E) markAllSynced(knowledgeBaseCode string, updatedAt time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()

	documents := s.byKnowledge[knowledgeBaseCode]
	for _, document := range documents {
		document.SyncStatus = int(shared.SyncStatusSynced)
		document.SyncStatusMessage = ""
		document.UpdatedAt = updatedAt.Format(time.DateTime)
	}
}

func (s *fakeDocumentStateStoreForE2E) listByThirdFile(
	knowledgeBaseCode,
	thirdPlatformType,
	thirdFileID string,
) []*docdto.DocumentDTO {
	s.mu.Lock()
	defer s.mu.Unlock()

	results := make([]*docdto.DocumentDTO, 0)
	appendMatches := func(documents []*docdto.DocumentDTO) {
		for _, document := range documents {
			if document == nil {
				continue
			}
			if knowledgeBaseCode != "" && document.KnowledgeBaseCode != knowledgeBaseCode {
				continue
			}
			if document.ThirdPlatformType != thirdPlatformType || document.ThirdFileID != thirdFileID {
				continue
			}
			results = append(results, cloneDocumentDTO(document))
		}
	}

	if knowledgeBaseCode != "" {
		appendMatches(s.byKnowledge[knowledgeBaseCode])
		return results
	}
	for _, documents := range s.byKnowledge {
		appendMatches(documents)
	}
	return results
}

func (f *fakeDocumentQueryAppForE2E) Create(context.Context, *docdto.CreateDocumentInput) (*docdto.DocumentDTO, error) {
	return nil, errNotImplemented
}

func (f *fakeDocumentQueryAppForE2E) Update(context.Context, *docdto.UpdateDocumentInput) (*docdto.DocumentDTO, error) {
	return nil, errNotImplemented
}

func (f *fakeDocumentQueryAppForE2E) Show(context.Context, string, string, string, string) (*docdto.DocumentDTO, error) {
	return nil, errNotImplemented
}

func (f *fakeDocumentQueryAppForE2E) GetOriginalFileLink(context.Context, string, string, string, string) (*docdto.OriginalFileLinkDTO, error) {
	return &docdto.OriginalFileLinkDTO{}, nil
}

func (f *fakeDocumentQueryAppForE2E) List(_ context.Context, input *docdto.ListDocumentInput) (*pagehelper.Result, error) {
	f.lastListInput = input
	list, total := f.store.listByKnowledgeBase(input.KnowledgeBaseCode, input.Offset, input.Limit)
	return &pagehelper.Result{
		List:  list,
		Total: total,
	}, nil
}

func (f *fakeDocumentQueryAppForE2E) GetByThirdFileID(_ context.Context, input *docdto.GetDocumentsByThirdFileIDInput) ([]*docdto.DocumentDTO, error) {
	f.lastGetByThirdFileID = input
	return f.store.listByThirdFile(input.KnowledgeBaseCode, input.ThirdPlatformType, input.ThirdFileID), nil
}

func (f *fakeDocumentQueryAppForE2E) CountByKnowledgeBaseCodes(context.Context, string, []string) (map[string]int64, error) {
	return nil, errNotImplemented
}

func (f *fakeDocumentQueryAppForE2E) Destroy(context.Context, string, string, string, string) error {
	return errNotImplemented
}

func (f *fakeDocumentQueryAppForE2E) Sync(context.Context, *documentdomain.SyncDocumentInput) error {
	return errNotImplemented
}

func (f *fakeDocumentQueryAppForE2E) ReVectorizedByThirdFileID(context.Context, *docdto.ReVectorizedByThirdFileIDInput) error {
	return errNotImplemented
}

func (f *fakeDocumentQueryAppForE2E) NotifyProjectFileChange(context.Context, *docdto.NotifyProjectFileChangeInput) error {
	return errNotImplemented
}

func (f *fakeDocumentQueryAppForE2E) ScheduleSync(context.Context, *documentdomain.SyncDocumentInput) {
}

func (f *fakeKnowledgeBasePermissionReaderForE2E) ListOperations(
	_ context.Context,
	_ string,
	_ string,
	knowledgeBaseCodes []string,
) (map[string]string, error) {
	result := make(map[string]string, max(len(knowledgeBaseCodes), 1))
	for _, code := range knowledgeBaseCodes {
		result[code] = testKnowledgeBaseOwner
	}
	if len(knowledgeBaseCodes) > 0 {
		return result, nil
	}

	if f != nil && f.repo != nil && f.repo.showResult != nil && f.repo.showResult.Code != "" {
		result[f.repo.showResult.Code] = testKnowledgeBaseOwner
	}
	if f != nil && f.repo != nil {
		for _, kb := range f.repo.listResult {
			if kb == nil || kb.Code == "" {
				continue
			}
			result[kb.Code] = testKnowledgeBaseOwner
		}
	}
	if len(result) == 0 {
		result["KB-E2E"] = testKnowledgeBaseOwner
	}
	return result, nil
}

func (f *fakeRebuildTriggerForE2E) Trigger(_ context.Context, opts rebuilddto.RunOptions) (*apprebuild.TriggerResult, error) {
	f.calls++
	f.lastRunOptions = opts
	if f.store != nil {
		now := time.Now()
		if f.now != nil {
			now = f.now()
		}
		f.store.markAllSynced(opts.Scope.KnowledgeBaseCode, now)
	}
	return &apprebuild.TriggerResult{
		Status: apprebuild.TriggerStatusTriggered,
		RunID:  f.runID,
	}, nil
}

type captureRouter struct {
	handlers map[string]jsonrpc.ServerHandler
}

type fragmentCounterForE2E interface {
	CountByKnowledgeBase(ctx context.Context, knowledgeCode string) (int64, error)
	CountSyncedByKnowledgeBase(ctx context.Context, knowledgeCode string) (int64, error)
}

type fakeFragmentCounterForE2E struct {
	total       int64
	synced      int64
	totalCalls  int
	syncedCalls int
	statsCalls  int
}

func (f *fakeFragmentCounterForE2E) CountByKnowledgeBase(_ context.Context, _ string) (int64, error) {
	f.totalCalls++
	return f.total, nil
}

func (f *fakeFragmentCounterForE2E) CountSyncedByKnowledgeBase(_ context.Context, _ string) (int64, error) {
	f.syncedCalls++
	return f.synced, nil
}

func (f *fakeFragmentCounterForE2E) CountStatsByKnowledgeBase(_ context.Context, _ string) (int64, int64, error) {
	f.statsCalls++
	return f.total, f.synced, nil
}

func (r *captureRouter) RegisterHandler(method string, handler jsonrpc.ServerHandler) {
	if r.handlers == nil {
		r.handlers = make(map[string]jsonrpc.ServerHandler)
	}
	r.handlers[method] = handler
}

func setupKnowledgeHandlersForE2E(repo *fakeKnowledgeBaseRepoForE2E) map[string]jsonrpc.ServerHandler {
	return setupKnowledgeHandlersForE2EWithCounter(repo, nil)
}

func setupKnowledgeHandlersForE2EWithCounter(repo *fakeKnowledgeBaseRepoForE2E, counter fragmentCounterForE2E) map[string]jsonrpc.ServerHandler {
	// 这里故意使用真实 routes + rpc + app + domain 装配，
	// 只 fake repo，验证“接口层到应用层到领域层”的连通行为。
	logger := logging.NewFromConfig(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevelInfo,
		Format: autoloadcfg.LogFormatJSON,
	})
	domain := knowledgebasedomain.NewDomainService(repo, nil, nil, "text-embedding-3-large", "", logger)
	app := kbapp.NewKnowledgeBaseAppService(domain, counter, logger, "text-embedding-3-large")
	app.SetKnowledgeBasePermissionReader(&fakeKnowledgeBasePermissionReaderForE2E{repo: repo})
	rpc := knowledgeService.NewKnowledgeBaseRPCService(app, nil, nil, logger)

	router := &captureRouter{}
	knowledgeroutes.SetupRPCRoutes(knowledgeroutes.Dependencies{
		Server:           router,
		KnowledgeHandler: rpc,
	})

	return router.handlers
}

func setupKnowledgeAndDocumentHandlersForE2E(
	rebuildTrigger *fakeRebuildTriggerForE2E,
	documentApp *fakeDocumentQueryAppForE2E,
) map[string]jsonrpc.ServerHandler {
	logger := logging.NewFromConfig(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevelInfo,
		Format: autoloadcfg.LogFormatJSON,
	})
	kbRPC := knowledgeService.NewKnowledgeBaseRPCService(&rebuildReadyKnowledgeBaseAppForE2E{}, rebuildTrigger, nil, logger)
	documentRPC := knowledgeService.NewDocumentRPCServiceWithDependencies(documentApp, logger)

	router := &captureRouter{}
	knowledgeroutes.SetupRPCRoutes(knowledgeroutes.Dependencies{
		Server:           router,
		KnowledgeHandler: kbRPC,
		DocumentHandler:  documentRPC,
	})

	return router.handlers
}

func setupFragmentHandlersForE2E(
	tb testing.TB,
	fragmentService *fakeFragmentServiceForE2E,
	kbReader *fakeKnowledgeBaseReaderForFragmentE2E,
) map[string]jsonrpc.ServerHandler {
	tb.Helper()

	logger := logging.NewFromConfig(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevelInfo,
		Format: autoloadcfg.LogFormatJSON,
	})
	app := fragmentapp.NewFragmentAppServiceForTest(tb, fragmentapp.AppServiceForTestOptions{
		FragmentService:       fragmentService,
		KBService:             kbReader,
		DefaultEmbeddingModel: testEmbeddingModelSmall,
		Logger:                logger,
	})
	rpc := knowledgeService.NewFragmentRPCService(app, logger)

	router := &captureRouter{}
	knowledgeroutes.SetupRPCRoutes(knowledgeroutes.Dependencies{
		Server:          router,
		FragmentHandler: rpc,
	})
	return router.handlers
}

func mustGetHandler(t *testing.T, handlers map[string]jsonrpc.ServerHandler, method string) jsonrpc.ServerHandler {
	t.Helper()

	handler, ok := handlers[method]
	if !ok || handler == nil {
		t.Fatalf("handler for method %q not found", method)
	}
	return handler
}

func TestE2E_KnowledgeBaseList_TypeZeroMeansNoFilter(t *testing.T) {
	// 兼容 PHP 语义：type=0 表示不过滤类型，最终仓储查询应为 nil。
	t.Parallel()

	repo := &fakeKnowledgeBaseRepoForE2E{}
	handlers := setupKnowledgeHandlersForE2E(repo)
	handler := mustGetHandler(t, handlers, constants.MethodKnowledgeBaseList)

	raw := json.RawMessage(fmt.Sprintf(`{
		"data_isolation": {
			"organization_code": %q,
			"user_id": "usi_test"
		},
		"type": 0,
		"offset": 20,
		"limit": 10
	}`, testOrgCode))

	resp, err := handler(context.Background(), constants.MethodKnowledgeBaseList, raw)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if _, ok := resp.(*rpcdto.KnowledgeBasePageResponse); !ok {
		t.Fatalf("expected *KnowledgeBasePageResponse response, got %T", resp)
	}
	if repo.lastQuery == nil {
		t.Fatal("expected repo query to be captured")
	}
	if repo.lastQuery.Type != nil {
		t.Fatalf("expected query.Type=nil when input type=0, got %v", *repo.lastQuery.Type)
	}
	if repo.lastQuery.OrganizationCode != testOrgCode {
		t.Fatalf("expected org=%s, got %q", testOrgCode, repo.lastQuery.OrganizationCode)
	}
	if repo.lastQuery.Offset != 20 || repo.lastQuery.Limit != 10 {
		t.Fatalf("expected offset/limit=20/10, got %d/%d", repo.lastQuery.Offset, repo.lastQuery.Limit)
	}
}

func TestE2E_KnowledgeBaseList_ResponseContractCompat(t *testing.T) {
	// 验证关键输出契约在 RPC 链路上不回归：
	// creator/modifier 与 created_uid/updated_uid 同时存在，
	// fragment_config 不再暴露已移除的 parent_child 字段。
	t.Parallel()

	repo := newListContractRepo()
	handlers := setupKnowledgeHandlersForE2E(repo)
	handler := mustGetHandler(t, handlers, constants.MethodKnowledgeBaseList)

	raw := json.RawMessage(fmt.Sprintf(`{
		"data_isolation": {
			"organization_code": %q,
			"user_id": "usi_test"
		},
		"offset": 0,
		"limit": 10
	}`, testOrgCode))

	resp, err := handler(context.Background(), constants.MethodKnowledgeBaseList, raw)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	page, ok := resp.(*rpcdto.KnowledgeBasePageResponse)
	if !ok || page == nil {
		t.Fatalf("expected *KnowledgeBasePageResponse response, got %T", resp)
	}

	item := decodeSingleListItem(t, page)
	assertCreatorModifierFields(t, item)
	assertFragmentConfigContract(t, item)
}

func TestE2E_KnowledgeBaseShow_ResolveOrganizationIDFallback(t *testing.T) {
	// 兼容历史入参：organization_code 为空时，回退使用 organization_id。
	t.Parallel()

	repo := &fakeKnowledgeBaseRepoForE2E{
		showResult: &kbentity.KnowledgeBase{
			Code:      "KNOWLEDGE-TEST",
			CreatedAt: time.Unix(1772001461, 0),
			UpdatedAt: time.Unix(1772001501, 0),
		},
	}
	handlers := setupKnowledgeHandlersForE2E(repo)
	handler := mustGetHandler(t, handlers, constants.MethodKnowledgeBaseShow)

	raw := json.RawMessage(`{
		"data_isolation": {
			"organization_code": "",
			"organization_id": "DT001_LEGACY",
			"user_id": "usi_test"
		},
		"code": "KNOWLEDGE-TEST"
	}`)

	resp, err := handler(context.Background(), constants.MethodKnowledgeBaseShow, raw)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if _, ok := resp.(*rpcdto.KnowledgeBaseResponse); !ok {
		t.Fatalf("expected *KnowledgeBaseResponse response, got %T", resp)
	}
	if repo.lastOrg != "DT001_LEGACY" {
		t.Fatalf("expected fallback org code DT001_LEGACY, got %q", repo.lastOrg)
	}
	if repo.lastCode != "KNOWLEDGE-TEST" {
		t.Fatalf("expected code KNOWLEDGE-TEST, got %q", repo.lastCode)
	}
}

func TestE2E_KnowledgeBaseShow_ResponseIncludesFragmentCounts(t *testing.T) {
	t.Parallel()

	repo := &fakeKnowledgeBaseRepoForE2E{
		showResult: &kbentity.KnowledgeBase{
			Code:      "KNOWLEDGE-TEST",
			CreatedAt: time.Unix(1772001461, 0),
			UpdatedAt: time.Unix(1772001501, 0),
		},
	}
	counter := &fakeFragmentCounterForE2E{
		total:  1,
		synced: 1,
	}
	handlers := setupKnowledgeHandlersForE2EWithCounter(repo, counter)
	handler := mustGetHandler(t, handlers, constants.MethodKnowledgeBaseShow)

	raw := json.RawMessage(fmt.Sprintf(`{
		"data_isolation": {
			"organization_code": %q,
			"user_id": "usi_test"
		},
		"code": "KNOWLEDGE-TEST"
	}`, testOrgCode))

	resp, err := handler(context.Background(), constants.MethodKnowledgeBaseShow, raw)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	kb, ok := resp.(*rpcdto.KnowledgeBaseResponse)
	if !ok {
		t.Fatalf("expected *KnowledgeBaseResponse response, got %T", resp)
	}
	if kb.FragmentCount != 1 {
		t.Fatalf("expected fragment_count=1, got %d", kb.FragmentCount)
	}
	if kb.ExpectedCount != 1 {
		t.Fatalf("expected expected_count=1, got %d", kb.ExpectedCount)
	}
	if kb.CompletedCount != 1 {
		t.Fatalf("expected completed_count=1, got %d", kb.CompletedCount)
	}
	if counter.statsCalls != 1 {
		t.Fatalf("expected aggregated stats call once, got %d", counter.statsCalls)
	}
	if counter.totalCalls != 0 || counter.syncedCalls != 0 {
		t.Fatalf("expected no fallback count calls, got total=%d synced=%d", counter.totalCalls, counter.syncedCalls)
	}
}

func TestE2E_KnowledgeBaseShow_NotFoundMappedBusinessError(t *testing.T) {
	// 统一错误契约：仓储未找到应映射为固定业务错误码，供 PHP 稳定处理。
	t.Parallel()

	repo := &fakeKnowledgeBaseRepoForE2E{
		showErr: shared.ErrKnowledgeBaseNotFound,
	}
	handlers := setupKnowledgeHandlersForE2E(repo)
	handler := mustGetHandler(t, handlers, constants.MethodKnowledgeBaseShow)

	raw := json.RawMessage(fmt.Sprintf(`{
		"data_isolation": {
			"organization_code": %q,
			"user_id": "usi_test"
		},
		"code": "KNOWLEDGE-NOT-FOUND"
	}`, testOrgCode))

	_, err := handler(context.Background(), constants.MethodKnowledgeBaseShow, raw)
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

func TestE2E_KnowledgeBaseList_InvalidParamsReturnsInvalidParamsError(t *testing.T) {
	// 通过 routes 注册出来的 WrapTyped handler 直接校验参数绑定错误映射。
	t.Parallel()

	repo := &fakeKnowledgeBaseRepoForE2E{}
	handlers := setupKnowledgeHandlersForE2E(repo)
	handler := mustGetHandler(t, handlers, constants.MethodKnowledgeBaseList)

	_, err := handler(context.Background(), constants.MethodKnowledgeBaseList, json.RawMessage(`{"data_isolation":`))
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

func TestE2E_FragmentQueries_StableFragmentAndPointCountsByDocument(t *testing.T) {
	t.Parallel()

	service := &fakeFragmentServiceForE2E{
		listByDocument: map[string][]*fragmodel.KnowledgeBaseFragment{
			"DOCUMENT-69ac149778b8f6c6f3bad": buildFragmentsForDocument("KB1", "DOCUMENT-69ac149778b8f6c6f3bad", "录音功能优化讨论.md", 2, 29),
			"DOCUMENT-69a2ab53ad2039dc391f1": buildFragmentsForDocument("KB1", "DOCUMENT-69a2ab53ad2039dc391f1", "目前团队人员.md", 2, 1),
			"DOCUMENT-699e98b5cf7a405a1aa82": buildFragmentsForDocument("KB1", "DOCUMENT-699e98b5cf7a405a1aa82", "目前团队人员.md", 2, 1),
		},
	}
	handlers := setupFragmentHandlersForE2E(t, service, &fakeKnowledgeBaseReaderForFragmentE2E{
		showResult: &kbentity.KnowledgeBase{Code: "KB1"},
	})
	handler := mustGetHandler(t, handlers, constants.MethodFragmentList)

	testCases := []struct {
		documentCode string
		expected     int
	}{
		{documentCode: "DOCUMENT-69ac149778b8f6c6f3bad", expected: 29},
		{documentCode: "DOCUMENT-69a2ab53ad2039dc391f1", expected: 1},
		{documentCode: "DOCUMENT-699e98b5cf7a405a1aa82", expected: 1},
	}

	for _, tc := range testCases {
		raw := json.RawMessage(fmt.Sprintf(`{
			"data_isolation": {
				"organization_code": %q,
				"user_id": "usi_test"
			},
			"knowledge_code": "KB1",
			"document_code": %q,
			"page": {
				"offset": 0,
				"limit": 100
			}
		}`, testOrgCode, tc.documentCode))

		resp, err := handler(context.Background(), constants.MethodFragmentList, raw)
		if err != nil {
			t.Fatalf("document=%s expected nil error, got %v", tc.documentCode, err)
		}

		page, ok := resp.(*rpcdto.FragmentPageResponse)
		if !ok || page == nil {
			t.Fatalf("document=%s expected *FragmentPageResponse, got %T", tc.documentCode, resp)
		}
		if int(page.Total) != tc.expected {
			t.Fatalf("document=%s expected total=%d, got %d", tc.documentCode, tc.expected, page.Total)
		}

		fragments := page.List
		if len(fragments) != tc.expected {
			t.Fatalf("document=%s expected page length=%d, got %d", tc.documentCode, tc.expected, len(fragments))
		}

		uniquePointIDs := make(map[string]struct{}, len(fragments))
		for _, fragment := range fragments {
			if fragment.SyncStatus != int(shared.SyncStatusSynced) {
				t.Fatalf("document=%s expected synced fragment, got status=%d", tc.documentCode, fragment.SyncStatus)
			}
			if fragment.PointID == "" {
				t.Fatalf("document=%s expected non-empty point id", tc.documentCode)
			}
			uniquePointIDs[fragment.PointID] = struct{}{}
		}
		if len(uniquePointIDs) != tc.expected {
			t.Fatalf("document=%s expected unique point count=%d, got %d", tc.documentCode, tc.expected, len(uniquePointIDs))
		}
	}
}

func TestE2E_FragmentSimilarity_ReturnsExpectedRecallContent(t *testing.T) {
	t.Parallel()

	service := &fakeFragmentServiceForE2E{
		similarityResult: []*fragmodel.SimilarityResult{
			{
				Content:       "录音功能优化讨论：支持更稳定的转写和回放链路。",
				Score:         0.92,
				KnowledgeCode: "KB1",
				DocumentCode:  "DOCUMENT-69ac149778b8f6c6f3bad",
				DocumentName:  "录音功能优化讨论.md",
				DocumentType:  2,
				Metadata: map[string]any{
					"section_title": "功能优化讨论",
				},
			},
		},
	}
	handlers := setupFragmentHandlersForE2E(t, service, &fakeKnowledgeBaseReaderForFragmentE2E{
		showResult: &kbentity.KnowledgeBase{Code: "KB1"},
	})
	handler := mustGetHandler(t, handlers, constants.MethodFragmentSimilarity)

	raw := json.RawMessage(fmt.Sprintf(`{
		"data_isolation": {
			"organization_code": %q,
			"user_id": "usi_test"
		},
		"business_params": {
			"organization_code": %q,
			"user_id": "usi_test"
		},
		"knowledge_code": "KB1",
		"query": "录音功能优化讨论"
	}`, testOrgCode, testOrgCode))

	resp, err := handler(context.Background(), constants.MethodFragmentSimilarity, raw)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	resultsPage, ok := resp.(*rpcdto.SimilarityPageResponse)
	if !ok {
		t.Fatalf("expected *SimilarityPageResponse response, got %T", resp)
	}
	results := resultsPage.List
	if len(results) != 1 {
		t.Fatalf("expected one similarity result, got %d", len(results))
	}

	result := results[0]
	if result.ID != "0" {
		t.Fatalf("expected zero fragment id string from fake similarity result, got %q", result.ID)
	}
	if result.KnowledgeBaseCode != "KB1" || result.DocType != result.DocumentType {
		t.Fatalf("unexpected similarity compat fields: %#v", result)
	}
	if result.DocumentCode != "DOCUMENT-69ac149778b8f6c6f3bad" {
		t.Fatalf("expected recalled document code, got %q", result.DocumentCode)
	}
	if result.DocumentName != "录音功能优化讨论.md" {
		t.Fatalf("expected recalled document name, got %q", result.DocumentName)
	}
	if result.Score <= 0 {
		t.Fatalf("expected positive score, got %f", result.Score)
	}
	if result.Content == "" || result.WordCount <= 0 {
		t.Fatalf("expected non-empty recalled content and word count, got content=%q word_count=%d", result.Content, result.WordCount)
	}
	if service.lastSimilarity.Query != "录音功能优化讨论" {
		t.Fatalf("expected forwarded query, got %q", service.lastSimilarity.Query)
	}
	if service.lastSimilarity.TopK != 10 {
		t.Fatalf("expected app default topK=10, got %d", service.lastSimilarity.TopK)
	}
	if result.Metadata["section_title"] != "功能优化讨论" {
		t.Fatalf("expected section title metadata, got %#v", result.Metadata)
	}
}

func TestE2E_RebuildTrigger_ThenDocumentQueries_ConvergesFailedToSuccess(t *testing.T) {
	t.Parallel()

	initialUpdatedAt := time.Unix(1773307581, 0)
	rebuiltAt := initialUpdatedAt.Add(3 * time.Second)

	store := &fakeDocumentStateStoreForE2E{
		byKnowledge: map[string][]*docdto.DocumentDTO{
			testRebuildKBCode: {
				newDocumentDTOForE2E(testRebuildKBCode, "DOCUMENT-69ac149778b8f6c6f3bad", "录音功能优化讨论.md", "embedding failed", initialUpdatedAt),
				newDocumentDTOForE2E(testRebuildKBCode, "DOCUMENT-69a2ab53ad2039dc391f1", "目前团队人员.md", "duplicate fragment identity", initialUpdatedAt),
				newDocumentDTOForE2E(testRebuildKBCode, "DOCUMENT-699e98b5cf7a405a1aa82", "目前团队人员.md", "duplicate fragment identity", initialUpdatedAt),
			},
			testOtherKBCode: {
				newDocumentDTOForE2E(testOtherKBCode, "DOCUMENT-OTHER", "其他知识库文档.md", "should stay failed", initialUpdatedAt),
			},
		},
	}
	documentApp := &fakeDocumentQueryAppForE2E{store: store}
	rebuildTrigger := &fakeRebuildTriggerForE2E{
		store: store,
		now:   func() time.Time { return rebuiltAt },
		runID: testRebuildRunID,
	}
	handlers := setupKnowledgeAndDocumentHandlersForE2E(rebuildTrigger, documentApp)
	rebuildHandler := mustGetHandler(t, handlers, constants.MethodKnowledgeBaseRebuild)
	documentListHandler := mustGetHandler(t, handlers, constants.MethodDocumentList)

	before := listDocumentsForKnowledgeBase(t, documentListHandler, testOrgCode, testRebuildKBCode)
	assertDocumentsFailedState(t, before, initialUpdatedAt)

	rebuildResp, err := rebuildHandler(context.Background(), constants.MethodKnowledgeBaseRebuild, json.RawMessage(fmt.Sprintf(`{
			"data_isolation": {
				"organization_code": %q,
				"user_id": %q
			},
			"scope": "knowledge_base",
			"knowledge_organization_code": %q,
			"knowledge_base_code": %q,
			"target_model": %q
		}`, testOrgCode, testUserID, testOrgCode, testRebuildKBCode, testEmbeddingModelSmall)))
	if err != nil {
		t.Fatalf("expected nil rebuild error, got %v", err)
	}

	assertRebuildResponse(t, rebuildResp)
	assertRebuildTriggerCaptured(t, rebuildTrigger)

	after := listDocumentsForKnowledgeBase(t, documentListHandler, testOrgCode, testRebuildKBCode)
	assertDocumentsSyncedState(t, after, rebuiltAt)
	assertDocumentListInput(t, documentApp.lastListInput, testRebuildKBCode)

	other := listDocumentsForKnowledgeBase(t, documentListHandler, testOrgCode, testOtherKBCode)
	assertDocumentsFailedState(t, other, initialUpdatedAt)
	if other[0].SyncStatusMessage != "should stay failed" {
		t.Fatalf("expected other knowledge base message unchanged, got %q", other[0].SyncStatusMessage)
	}
}

func decodeSingleListItem(t *testing.T, page *rpcdto.KnowledgeBasePageResponse) map[string]any {
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

func newListContractRepo() *fakeKnowledgeBaseRepoForE2E {
	// 构造一条最小但能覆盖兼容点的知识库数据。
	return &fakeKnowledgeBaseRepoForE2E{
		listResult: []*kbentity.KnowledgeBase{
			{
				ID:               1,
				Code:             "KNOWLEDGE-TEST",
				Name:             "测试知识库",
				Description:      "测试知识库",
				Type:             1,
				Enabled:          true,
				OrganizationCode: testOrgCode,
				CreatedUID:       "usi_creator",
				UpdatedUID:       "usi_modifier",
				FragmentConfig: &shared.FragmentConfig{
					Mode: shared.FragmentModeCustom,
					Normal: &shared.NormalFragmentConfig{
						SegmentRule: &shared.SegmentRule{
							Separator:    "\\n\\n",
							ChunkSize:    500,
							ChunkOverlap: 0,
						},
						TextPreprocessRule: []int{1},
					},
				},
				CreatedAt: time.Unix(1772001461, 0),
				UpdatedAt: time.Unix(1772001501, 0),
			},
		},
		listTotal: 1,
	}
}

func assertCreatorModifierFields(t *testing.T, item map[string]any) {
	t.Helper()

	if item["creator"] != "usi_creator" || item["modifier"] != "usi_modifier" {
		t.Fatalf("unexpected creator/modifier: %#v", item)
	}
	if item["created_uid"] != "usi_creator" || item["updated_uid"] != "usi_modifier" {
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
	if got, ok := fragmentConfig["mode"].(float64); !ok || int(got) != 1 {
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
}

func buildFragmentsForDocument(knowledgeCode, documentCode, documentName string, documentType, count int) []*fragmodel.KnowledgeBaseFragment {
	fragments := make([]*fragmodel.KnowledgeBaseFragment, 0, count)
	now := time.Unix(1773307584, 0)
	for i := range count {
		fragments = append(fragments, &fragmodel.KnowledgeBaseFragment{
			ID:               int64(i + 1),
			OrganizationCode: testOrgCode,
			KnowledgeCode:    knowledgeCode,
			DocumentCode:     documentCode,
			DocumentName:     documentName,
			DocumentType:     documentType,
			Content:          fmt.Sprintf("%s fragment %d", documentName, i),
			Metadata: map[string]any{
				"section_title": fmt.Sprintf("section-%d", i),
			},
			SyncStatus: sharedentity.SyncStatusSynced,
			PointID:    fmt.Sprintf("%s-point-%d", documentCode, i),
			WordCount:  100,
			CreatedAt:  now,
			UpdatedAt:  now,
		})
	}
	return fragments
}

func newDocumentDTOForE2E(
	knowledgeBaseCode string,
	documentCode string,
	documentName string,
	syncMessage string,
	updatedAt time.Time,
) *docdto.DocumentDTO {
	return &docdto.DocumentDTO{
		ID:                int64(len(documentCode)),
		OrganizationCode:  testOrgCode,
		KnowledgeBaseCode: knowledgeBaseCode,
		Name:              documentName,
		Code:              documentCode,
		Enabled:           true,
		DocType:           2,
		SyncStatus:        int(shared.SyncStatusSyncFailed),
		SyncStatusMessage: syncMessage,
		CreatedAt:         updatedAt.Add(-time.Hour).Format(time.DateTime),
		UpdatedAt:         updatedAt.Format(time.DateTime),
	}
}

func assertDocumentsFailedState(t *testing.T, documents []*rpcdto.DocumentResponse, updatedAt time.Time) {
	t.Helper()

	if len(documents) == 0 {
		t.Fatal("expected non-empty document list")
	}
	for _, document := range documents {
		if document.SyncStatus != int(shared.SyncStatusSyncFailed) {
			t.Fatalf("expected failed document, got code=%s status=%d", document.Code, document.SyncStatus)
		}
		if document.SyncStatusMessage == "" {
			t.Fatalf("expected failed document to keep error message, got code=%s", document.Code)
		}
		if document.UpdatedAt != updatedAt.Format(time.DateTime) {
			t.Fatalf("expected updated_at=%s, got %s", updatedAt.Format(time.DateTime), document.UpdatedAt)
		}
	}
}

func assertDocumentsSyncedState(t *testing.T, documents []*rpcdto.DocumentResponse, updatedAt time.Time) {
	t.Helper()

	if len(documents) == 0 {
		t.Fatal("expected non-empty document list")
	}
	for _, document := range documents {
		if document.SyncStatus != int(shared.SyncStatusSynced) {
			t.Fatalf("expected synced document, got code=%s status=%d", document.Code, document.SyncStatus)
		}
		if document.SyncStatusMessage != "" {
			t.Fatalf("expected cleared sync_status_message, got code=%s message=%q", document.Code, document.SyncStatusMessage)
		}
		if document.UpdatedAt != updatedAt.Format(time.DateTime) {
			t.Fatalf("expected updated_at=%s, got %s", updatedAt.Format(time.DateTime), document.UpdatedAt)
		}
	}
}

func assertRebuildResponse(t *testing.T, rebuildResp any) {
	t.Helper()

	rebuildResult, ok := rebuildResp.(*rpcdto.RebuildKnowledgeBaseResponse)
	if !ok {
		t.Fatalf("expected *RebuildKnowledgeBaseResponse, got %T", rebuildResp)
	}
	if rebuildResult.Status != apprebuild.TriggerStatusTriggered {
		t.Fatalf("expected rebuild status=%q, got %q", apprebuild.TriggerStatusTriggered, rebuildResult.Status)
	}
	if rebuildResult.RunID != testRebuildRunID {
		t.Fatalf("expected run_id=%s, got %q", testRebuildRunID, rebuildResult.RunID)
	}
	if rebuildResult.Scope != string(rebuilddto.ScopeModeKnowledgeBase) {
		t.Fatalf("expected scope=%q, got %q", rebuilddto.ScopeModeKnowledgeBase, rebuildResult.Scope)
	}
	if rebuildResult.RequestedMode != string(rebuilddto.ModeAuto) {
		t.Fatalf("expected requested_mode=%q, got %q", rebuilddto.ModeAuto, rebuildResult.RequestedMode)
	}
	if rebuildResult.TargetModel != testEmbeddingModelSmall {
		t.Fatalf("expected target_model=%s, got %q", testEmbeddingModelSmall, rebuildResult.TargetModel)
	}
}

func assertRebuildTriggerCaptured(t *testing.T, rebuildTrigger *fakeRebuildTriggerForE2E) {
	t.Helper()

	if rebuildTrigger.calls != 1 {
		t.Fatalf("expected rebuild trigger once, got %d", rebuildTrigger.calls)
	}
	if rebuildTrigger.lastRunOptions.Scope.Mode != rebuilddto.ScopeModeKnowledgeBase {
		t.Fatalf("expected trigger scope mode=%q, got %q", rebuilddto.ScopeModeKnowledgeBase, rebuildTrigger.lastRunOptions.Scope.Mode)
	}
	if rebuildTrigger.lastRunOptions.Scope.OrganizationCode != testOrgCode {
		t.Fatalf("expected trigger organization_code=%s, got %q", testOrgCode, rebuildTrigger.lastRunOptions.Scope.OrganizationCode)
	}
	if rebuildTrigger.lastRunOptions.Scope.KnowledgeBaseCode != testRebuildKBCode {
		t.Fatalf("expected trigger knowledge_base_code forwarded, got %q", rebuildTrigger.lastRunOptions.Scope.KnowledgeBaseCode)
	}
	if rebuildTrigger.lastRunOptions.Scope.UserID != testUserID {
		t.Fatalf("expected trigger user_id=%s, got %q", testUserID, rebuildTrigger.lastRunOptions.Scope.UserID)
	}
	if rebuildTrigger.lastRunOptions.TargetModel != testEmbeddingModelSmall {
		t.Fatalf("expected trigger target_model forwarded, got %q", rebuildTrigger.lastRunOptions.TargetModel)
	}
}

func assertDocumentListInput(t *testing.T, input *docdto.ListDocumentInput, knowledgeBaseCode string) {
	t.Helper()

	if input == nil {
		t.Fatal("expected document list input to be captured")
	}
	if input.OrganizationCode != testOrgCode {
		t.Fatalf("expected list organization_code=%s, got %q", testOrgCode, input.OrganizationCode)
	}
	if input.KnowledgeBaseCode != knowledgeBaseCode {
		t.Fatalf("expected list knowledge_base_code=%s, got %q", knowledgeBaseCode, input.KnowledgeBaseCode)
	}
}

func cloneDocumentDTO(document *docdto.DocumentDTO) *docdto.DocumentDTO {
	if document == nil {
		return nil
	}
	cloned := *document
	if document.DocMetadata != nil {
		cloned.DocMetadata = make(map[string]any, len(document.DocMetadata))
		maps.Copy(cloned.DocMetadata, document.DocMetadata)
	}
	return &cloned
}

func listDocumentsForKnowledgeBase(
	t *testing.T,
	handler jsonrpc.ServerHandler,
	organizationCode string,
	knowledgeBaseCode string,
) []*rpcdto.DocumentResponse {
	t.Helper()

	raw := json.RawMessage(fmt.Sprintf(`{
		"organization_code": %q,
		"knowledge_base_code": %q,
		"page": {
			"offset": 0,
			"limit": 100
		}
	}`, organizationCode, knowledgeBaseCode))

	resp, err := handler(context.Background(), constants.MethodDocumentList, raw)
	if err != nil {
		t.Fatalf("knowledge_base=%s expected nil error, got %v", knowledgeBaseCode, err)
	}

	page, ok := resp.(*rpcdto.DocumentPageResponse)
	if !ok || page == nil {
		t.Fatalf("knowledge_base=%s expected *DocumentPageResponse, got %T", knowledgeBaseCode, resp)
	}

	documents := page.List
	if int64(len(documents)) != page.Total {
		t.Fatalf("knowledge_base=%s expected page total=%d, got %d", knowledgeBaseCode, len(documents), page.Total)
	}
	return documents
}

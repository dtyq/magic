package docapp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"testing"

	docdto "magic/internal/application/knowledge/document/dto"
	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	docentity "magic/internal/domain/knowledge/document/entity"
	docrepo "magic/internal/domain/knowledge/document/repository"
	documentdomain "magic/internal/domain/knowledge/document/service"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	"magic/internal/domain/knowledge/shared"
	sharedentity "magic/internal/domain/knowledge/shared/entity"
	"magic/internal/domain/knowledge/shared/parseddocument"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/knowledgeroute"
	"magic/internal/pkg/thirdplatform"
	"magic/internal/pkg/tokenizer"
)

var errResolveTypeFailed = errors.New("resolve type failed")

var (
	errInternalDocumentStubNotFound = errors.New("internal document stub not found")
	errThirdPlatformResolveBoom     = errors.New("third platform resolve boom")
	errThirdPlatformGatewayDown     = errors.New("third platform gateway down")
	errParseDocumentFailed          = errors.New("parse document failed")
	errEnsureCollectionFailed       = errors.New("ensure collection failed")
)

const routeModel = "route-model"

type internalDocumentDomainServiceStub struct {
	showResult            *docentity.KnowledgeBaseDocument
	showByCodeAndKBResult *docentity.KnowledgeBaseDocument
	updateCalls           int
	updateErr             error
	lastUpdatedDoc        *docentity.KnowledgeBaseDocument
	increaseVersionRows   int64
	increaseVersionErr    error
	deleteCalls           int
	deletedID             int64
}

func (s *internalDocumentDomainServiceStub) Save(context.Context, *docentity.KnowledgeBaseDocument) error {
	return nil
}

func (s *internalDocumentDomainServiceStub) Update(context.Context, *docentity.KnowledgeBaseDocument) error {
	s.updateCalls++
	if s.showResult != nil {
		s.lastUpdatedDoc = s.showResult
	}
	if s.showByCodeAndKBResult != nil {
		s.lastUpdatedDoc = s.showByCodeAndKBResult
	}
	return s.updateErr
}

func (s *internalDocumentDomainServiceStub) Show(context.Context, string) (*docentity.KnowledgeBaseDocument, error) {
	if s.showResult != nil {
		return s.showResult, nil
	}
	return nil, errInternalDocumentStubNotFound
}

func (s *internalDocumentDomainServiceStub) ShowByCodeAndKnowledgeBase(context.Context, string, string) (*docentity.KnowledgeBaseDocument, error) {
	if s.showByCodeAndKBResult != nil {
		return s.showByCodeAndKBResult, nil
	}
	return nil, errInternalDocumentStubNotFound
}

func (s *internalDocumentDomainServiceStub) FindByKnowledgeBaseAndThirdFile(context.Context, string, string, string) (*docentity.KnowledgeBaseDocument, error) {
	return nil, errInternalDocumentStubNotFound
}

func (s *internalDocumentDomainServiceStub) FindByKnowledgeBaseAndProjectFile(context.Context, string, int64) (*docentity.KnowledgeBaseDocument, error) {
	return nil, errInternalDocumentStubNotFound
}

func (s *internalDocumentDomainServiceStub) ResolveThirdFileDocumentPlan(context.Context, documentdomain.ThirdFileDocumentPlanInput) (documentdomain.ThirdFileDocumentPlan, error) {
	return documentdomain.ThirdFileDocumentPlan{}, errInternalDocumentStubNotFound
}

func (s *internalDocumentDomainServiceStub) ResolveRealtimeThirdFileDocumentPlan(context.Context, documentdomain.ThirdFileDocumentPlanInput) (documentdomain.ThirdFileDocumentPlan, error) {
	return documentdomain.ThirdFileDocumentPlan{}, errInternalDocumentStubNotFound
}

func (s *internalDocumentDomainServiceStub) ListByThirdFileInOrg(context.Context, string, string, string) ([]*docentity.KnowledgeBaseDocument, error) {
	return nil, nil
}

func (s *internalDocumentDomainServiceStub) ListRealtimeByThirdFileInOrg(context.Context, string, string, string) ([]*docentity.KnowledgeBaseDocument, error) {
	return nil, nil
}

func (s *internalDocumentDomainServiceStub) HasRealtimeThirdFileDocumentInOrg(context.Context, string, string, string) (bool, error) {
	return false, nil
}

func (s *internalDocumentDomainServiceStub) ListByProjectFileInOrg(context.Context, string, int64) ([]*docentity.KnowledgeBaseDocument, error) {
	return nil, nil
}

func (s *internalDocumentDomainServiceStub) ListRealtimeByProjectFileInOrg(context.Context, string, int64) ([]*docentity.KnowledgeBaseDocument, error) {
	return nil, nil
}

func (s *internalDocumentDomainServiceStub) HasRealtimeProjectFileDocumentInOrg(context.Context, string, int64) (bool, error) {
	return false, nil
}

func (s *internalDocumentDomainServiceStub) ListByKnowledgeBaseAndProject(context.Context, string, int64) ([]*docentity.KnowledgeBaseDocument, error) {
	return nil, nil
}

func (s *internalDocumentDomainServiceStub) List(context.Context, *docrepo.DocumentQuery) ([]*docentity.KnowledgeBaseDocument, int64, error) {
	return nil, 0, nil
}

func (s *internalDocumentDomainServiceStub) ListByKnowledgeBase(context.Context, string, int, int) ([]*docentity.KnowledgeBaseDocument, int64, error) {
	return nil, 0, nil
}

func (s *internalDocumentDomainServiceStub) CountByKnowledgeBaseCodes(context.Context, string, []string) (map[string]int64, error) {
	return nil, errInternalDocumentStubNotFound
}

func (s *internalDocumentDomainServiceStub) Delete(_ context.Context, id int64) error {
	s.deleteCalls++
	s.deletedID = id
	return nil
}

func (s *internalDocumentDomainServiceStub) UpdateSyncStatus(context.Context, *docentity.KnowledgeBaseDocument) error {
	return nil
}

func (s *internalDocumentDomainServiceStub) MarkSyncing(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error {
	doc.MarkSyncing()
	return s.Update(ctx, doc)
}

func (s *internalDocumentDomainServiceStub) MarkSynced(ctx context.Context, doc *docentity.KnowledgeBaseDocument, wordCount int) error {
	doc.MarkSynced(wordCount)
	return s.Update(ctx, doc)
}

func (s *internalDocumentDomainServiceStub) MarkSyncedWithContent(ctx context.Context, doc *docentity.KnowledgeBaseDocument, content string) error {
	return s.MarkSynced(ctx, doc, len([]rune(content)))
}

func (s *internalDocumentDomainServiceStub) MarkSyncFailed(ctx context.Context, doc *docentity.KnowledgeBaseDocument, message string) error {
	doc.MarkSyncFailed(message)
	return s.Update(ctx, doc)
}

func (s *internalDocumentDomainServiceStub) MarkSyncFailedWithError(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	reason string,
	err error,
) error {
	return s.MarkSyncFailed(ctx, doc, documentdomain.BuildSyncFailureMessage(reason, err))
}

func (s *internalDocumentDomainServiceStub) IncreaseVersion(context.Context, *docentity.KnowledgeBaseDocument) (int64, error) {
	return s.increaseVersionRows, s.increaseVersionErr
}

func TestDocumentAppServiceFailSyncDeferredMark(t *testing.T) {
	t.Parallel()

	doc := &docentity.KnowledgeBaseDocument{SyncStatus: shared.SyncStatusSyncing}
	domain := &internalDocumentDomainServiceStub{}
	svc := &DocumentAppService{
		domainService: domain,
		logger:        logging.New(),
	}

	err := svc.failSync(
		WithDeferredSyncFailureMark(context.Background()),
		doc,
		documentdomain.SyncFailureParsing,
		errParseDocumentFailed,
	)
	if err == nil {
		t.Fatal("expected sync stage error")
	}
	var stageErr *documentdomain.SyncStageError
	if !errors.As(err, &stageErr) || stageErr == nil {
		t.Fatalf("expected sync stage error, got %v", err)
	}
	if domain.updateCalls != 0 {
		t.Fatalf("expected deferred failure not to update document, got %d updates", domain.updateCalls)
	}
	if doc.SyncStatus != shared.SyncStatusSyncing {
		t.Fatalf("expected document to remain syncing, got %v", doc.SyncStatus)
	}
}

func TestDocumentAppServiceFailSyncDirectMarksFailed(t *testing.T) {
	t.Parallel()

	doc := &docentity.KnowledgeBaseDocument{SyncStatus: shared.SyncStatusSyncing}
	domain := &internalDocumentDomainServiceStub{}
	svc := &DocumentAppService{
		domainService: domain,
		logger:        logging.New(),
	}

	err := svc.failSync(context.Background(), doc, documentdomain.SyncFailureParsing, errParseDocumentFailed)
	if err == nil {
		t.Fatal("expected sync stage error")
	}
	if domain.updateCalls != 1 {
		t.Fatalf("expected direct failure to update document once, got %d", domain.updateCalls)
	}
	if doc.SyncStatus != shared.SyncStatusSyncFailed {
		t.Fatalf("expected document marked failed, got %v", doc.SyncStatus)
	}
}

type internalParseServiceStub struct {
	parseDocumentResult           *parseddocument.ParsedDocument
	parseDocumentErr              error
	resolveFileType               string
	resolveFileTypeErr            error
	lastResolveTarget             string
	lastParseOptions              documentdomain.ParseOptions
	parseDocumentWithOptionsCalls int
	parseDocumentReaderCalls      int
	lastReaderContent             string
}

func (s *internalParseServiceStub) ValidateSource(context.Context, string) error {
	return nil
}

func (s *internalParseServiceStub) Parse(context.Context, string, string) (string, error) {
	return "", nil
}

func (s *internalParseServiceStub) ParseDocument(context.Context, string, string) (*parseddocument.ParsedDocument, error) {
	if s.parseDocumentErr != nil {
		return nil, s.parseDocumentErr
	}
	if s.parseDocumentResult != nil {
		return s.parseDocumentResult, nil
	}
	return parseddocument.NewPlainTextParsedDocument("txt", "default"), nil
}

func (s *internalParseServiceStub) ParseDocumentWithOptions(
	ctx context.Context,
	rawURL string,
	ext string,
	options documentdomain.ParseOptions,
) (*parseddocument.ParsedDocument, error) {
	s.lastParseOptions = options
	s.parseDocumentWithOptionsCalls++
	return s.ParseDocument(ctx, rawURL, ext)
}

func (s *internalParseServiceStub) ParseDocumentReaderWithOptions(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
	options documentdomain.ParseOptions,
) (*parseddocument.ParsedDocument, error) {
	s.lastParseOptions = options
	s.parseDocumentReaderCalls++
	if s.parseDocumentErr != nil {
		return nil, s.parseDocumentErr
	}
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("read parse reader input: %w", err)
	}
	s.lastReaderContent = string(data)
	if s.parseDocumentResult != nil {
		return s.parseDocumentResult, nil
	}
	return parseddocument.NewPlainTextParsedDocument(fileType, s.lastReaderContent), nil
}

func (s *internalParseServiceStub) ResolveFileType(_ context.Context, target string) (string, error) {
	s.lastResolveTarget = target
	if s.resolveFileTypeErr != nil {
		return "", s.resolveFileTypeErr
	}
	return s.resolveFileType, nil
}

type internalThirdPlatformDocumentPortStub struct {
	content      string
	rawContent   string
	sourceKind   string
	downloadURL  string
	downloadURLs []string
	docType      int
	file         map[string]any
	err          error
	lastInput    map[string]any
}

func (s *internalThirdPlatformDocumentPortStub) Resolve(_ context.Context, input thirdplatform.DocumentResolveInput) (*thirdplatform.DocumentResolveResult, error) {
	s.lastInput = map[string]any{
		"organization_code":   input.OrganizationCode,
		"user_id":             input.UserID,
		"knowledge_base_code": input.KnowledgeBaseCode,
		"third_platform_type": input.ThirdPlatformType,
		"third_file_id":       input.ThirdFileID,
		"document_file":       input.DocumentFile,
	}
	if s.err != nil {
		return nil, s.err
	}
	sourceKind := s.sourceKind
	rawContent := s.rawContent
	if rawContent == "" {
		rawContent = s.content
	}
	if sourceKind == "" {
		switch {
		case rawContent != "":
			sourceKind = thirdplatform.DocumentSourceKindRawContent
		case strings.TrimSpace(s.downloadURL) != "":
			sourceKind = thirdplatform.DocumentSourceKindDownloadURL
		}
	}
	return &thirdplatform.DocumentResolveResult{
		SourceKind:   sourceKind,
		RawContent:   rawContent,
		DownloadURL:  s.downloadURL,
		DownloadURLs: append([]string(nil), s.downloadURLs...),
		Content:      s.content,
		DocType:      s.docType,
		DocumentFile: s.file,
	}, nil
}

type internalFragmentDocumentServiceStub struct {
	saveBatchCalls              int
	updateCalls                 int
	updateBatchCalls            int
	listCalls                   int
	listByDocumentCalls         int
	listExistingPointIDsCalls   int
	syncFragmentBatchCalls      int
	deletePointDataCalls        int
	deletePointDataBatchCalls   int
	destroyCalls                int
	destroyBatchCalls           int
	deletePointsByDocumentCalls int
	deleteByDocumentCalls       int
	lastSaveBatchSize           int
	lastSyncBatchSize           int
	lastUpdateBatchSize         int
	lastCollectionName          string
	lastKnowledgeCode           string
	lastDocumentCode            string
	lastListQuery               *fragmodel.Query
	lastSyncKnowledgeBase       *sharedsnapshot.KnowledgeBaseRuntimeSnapshot
	lastPointID                 string
	lastListedPointIDs          []string
	listResult                  []*fragmodel.KnowledgeBaseFragment
	listTotal                   int64
	listErr                     error
	listByDocumentResult        []*fragmodel.KnowledgeBaseFragment
	existingPointIDs            map[string]struct{}
	callOrder                   *[]string
}

func (s *internalFragmentDocumentServiceStub) SaveBatch(_ context.Context, fragments []*fragmodel.KnowledgeBaseFragment) error {
	s.saveBatchCalls++
	s.lastSaveBatchSize = len(fragments)
	if s.callOrder != nil {
		*s.callOrder = append(*s.callOrder, "save_batch")
	}
	return nil
}

func (s *internalFragmentDocumentServiceStub) Update(context.Context, *fragmodel.KnowledgeBaseFragment) error {
	s.updateCalls++
	return nil
}

func (s *internalFragmentDocumentServiceStub) UpdateBatch(_ context.Context, fragments []*fragmodel.KnowledgeBaseFragment) error {
	s.updateBatchCalls++
	s.lastUpdateBatchSize = len(fragments)
	if s.callOrder != nil {
		*s.callOrder = append(*s.callOrder, "update_batch")
	}
	return nil
}

func (s *internalFragmentDocumentServiceStub) List(_ context.Context, query *fragmodel.Query) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	s.listCalls++
	s.lastListQuery = query
	return s.listResult, s.listTotal, s.listErr
}

func (s *internalFragmentDocumentServiceStub) ListByDocument(
	_ context.Context,
	knowledgeCode,
	documentCode string,
	offset,
	limit int,
) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	s.listByDocumentCalls++
	s.lastKnowledgeCode = knowledgeCode
	s.lastDocumentCode = documentCode
	end := min(offset+limit, len(s.listByDocumentResult))
	if offset >= len(s.listByDocumentResult) {
		return nil, int64(len(s.listByDocumentResult)), nil
	}
	return s.listByDocumentResult[offset:end], int64(len(s.listByDocumentResult)), nil
}

func (s *internalFragmentDocumentServiceStub) ListByDocumentAfterID(
	_ context.Context,
	knowledgeCode,
	documentCode string,
	afterID int64,
	limit int,
) ([]*fragmodel.KnowledgeBaseFragment, error) {
	s.listByDocumentCalls++
	s.lastKnowledgeCode = knowledgeCode
	s.lastDocumentCode = documentCode
	result := make([]*fragmodel.KnowledgeBaseFragment, 0, limit)
	for _, fragment := range s.listByDocumentResult {
		if fragment == nil || fragment.ID <= afterID {
			continue
		}
		result = append(result, fragment)
		if len(result) >= limit {
			break
		}
	}
	return result, nil
}

func (s *internalFragmentDocumentServiceStub) ListExistingPointIDs(_ context.Context, collectionName string, pointIDs []string) (map[string]struct{}, error) {
	s.listExistingPointIDsCalls++
	s.lastCollectionName = collectionName
	s.lastListedPointIDs = append([]string(nil), pointIDs...)
	if s.callOrder != nil {
		*s.callOrder = append(*s.callOrder, "list_existing_point_ids")
	}
	result := make(map[string]struct{}, len(s.existingPointIDs))
	for pointID := range s.existingPointIDs {
		result[pointID] = struct{}{}
	}
	return result, nil
}

func (s *internalFragmentDocumentServiceStub) SyncFragmentBatch(
	_ context.Context,
	kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot,
	fragments []*fragmodel.KnowledgeBaseFragment,
	_ *ctxmeta.BusinessParams,
) error {
	s.syncFragmentBatchCalls++
	s.lastSyncBatchSize = len(fragments)
	s.lastSyncKnowledgeBase = kb
	if s.callOrder != nil {
		*s.callOrder = append(*s.callOrder, "sync_fragment_batch")
	}
	return nil
}

func (s *internalFragmentDocumentServiceStub) DeletePointData(_ context.Context, collectionName, _, pointID string) error {
	s.deletePointDataCalls++
	s.lastCollectionName = collectionName
	s.lastPointID = pointID
	return nil
}

func (s *internalFragmentDocumentServiceStub) DeletePointDataBatch(_ context.Context, collectionName, _ string, pointIDs []string) error {
	s.deletePointDataBatchCalls++
	s.lastCollectionName = collectionName
	if len(pointIDs) > 0 {
		s.lastPointID = pointIDs[0]
	}
	return nil
}

func (s *internalFragmentDocumentServiceStub) DeletePointsByDocument(
	_ context.Context,
	collectionName,
	_,
	_,
	documentCode string,
) error {
	s.deletePointsByDocumentCalls++
	s.lastCollectionName = collectionName
	s.lastDocumentCode = documentCode
	return nil
}

func (s *internalFragmentDocumentServiceStub) DeleteByDocument(_ context.Context, knowledgeCode, documentCode string) error {
	s.deleteByDocumentCalls++
	s.lastKnowledgeCode = knowledgeCode
	s.lastDocumentCode = documentCode
	return nil
}

func (s *internalFragmentDocumentServiceStub) Destroy(_ context.Context, fragment *fragmodel.KnowledgeBaseFragment, collectionName string) error {
	s.destroyCalls++
	s.lastCollectionName = collectionName
	if fragment != nil {
		s.lastDocumentCode = fragment.DocumentCode
	}
	return nil
}

func (s *internalFragmentDocumentServiceStub) DestroyBatch(_ context.Context, fragments []*fragmodel.KnowledgeBaseFragment, collectionName string) error {
	s.destroyBatchCalls++
	s.lastCollectionName = collectionName
	if len(fragments) > 0 && fragments[0] != nil {
		s.lastDocumentCode = fragments[0].DocumentCode
	}
	return nil
}

type internalKnowledgeBaseReaderStub struct {
	showByCodeAndOrgResult      *kbentity.KnowledgeBase
	listResult                  []*kbentity.KnowledgeBase
	listTotal                   int64
	listErr                     error
	lastListQuery               *kbrepository.Query
	effectiveModel              string
	effectiveCollection         string
	effectiveTermCollection     string
	effectiveSparseBackend      string
	ensureCollectionExistsErr   error
	ensureCollectionExistsCalls int
	lastEnsuredKnowledgeBase    *kbentity.KnowledgeBase
	lastUpdatedProgress         *kbentity.KnowledgeBase
	updateProgressErr           error
	callOrder                   *[]string
}

func (s *internalKnowledgeBaseReaderStub) ShowByCodeAndOrg(context.Context, string, string) (*kbentity.KnowledgeBase, error) {
	return s.showByCodeAndOrgResult, nil
}

func (s *internalKnowledgeBaseReaderStub) Show(context.Context, string) (*kbentity.KnowledgeBase, error) {
	return s.showByCodeAndOrgResult, nil
}

func (s *internalKnowledgeBaseReaderStub) List(_ context.Context, query *kbrepository.Query) ([]*kbentity.KnowledgeBase, int64, error) {
	s.lastListQuery = query
	if s.listResult == nil && s.listErr == nil && query != nil && len(query.Codes) > 0 {
		results := make([]*kbentity.KnowledgeBase, 0, len(query.Codes))
		for _, code := range query.Codes {
			results = append(results, &kbentity.KnowledgeBase{
				Code:    strings.TrimSpace(code),
				Enabled: true,
				Model:   "text-embedding-3-small",
			})
		}
		return results, int64(len(results)), nil
	}
	return s.listResult, s.listTotal, s.listErr
}

func (s *internalKnowledgeBaseReaderStub) ResolveRuntimeRoute(_ context.Context, kb *kbentity.KnowledgeBase) sharedroute.ResolvedRoute {
	collectionName := ""
	if kb != nil {
		collectionName = kb.CollectionName()
	}
	if s.effectiveCollection != "" {
		collectionName = s.effectiveCollection
	}
	termCollectionName := collectionName
	if s.effectiveTermCollection != "" {
		termCollectionName = s.effectiveTermCollection
	}
	return sharedroute.ResolvedRoute{
		LogicalCollectionName:  collectionName,
		PhysicalCollectionName: collectionName,
		VectorCollectionName:   collectionName,
		TermCollectionName:     termCollectionName,
		Model:                  s.effectiveModel,
		SparseBackend:          s.effectiveSparseBackend,
	}
}

func (s *internalKnowledgeBaseReaderStub) EnsureCollectionExists(_ context.Context, kb *kbentity.KnowledgeBase) error {
	s.ensureCollectionExistsCalls++
	s.lastEnsuredKnowledgeBase = kb
	if s.callOrder != nil {
		*s.callOrder = append(*s.callOrder, "ensure_collection_exists")
	}
	return s.ensureCollectionExistsErr
}

func (s *internalKnowledgeBaseReaderStub) UpdateProgress(_ context.Context, kb *kbentity.KnowledgeBase) error {
	s.lastUpdatedProgress = kb
	return s.updateProgressErr
}

func TestDocumentFileDTOUnmarshalJSONCompat(t *testing.T) {
	t.Parallel()

	payload := map[string]any{
		"type":                      2,
		"name":                      "Spec",
		"key":                       "bucket/spec.md",
		"file_link":                 map[string]any{"url": "https://example.com/spec.md"},
		"third_file_extension_name": ".MD",
		"third_file_id":             "third-1",
		"platform_type":             "lark",
		"size":                      float64(12),
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	var dto docfilehelper.DocumentFileDTO
	if err := json.Unmarshal(raw, &dto); err != nil {
		t.Fatalf("unmarshal file dto: %v", err)
	}

	if dto.Type != docFileTypeThirdParty {
		t.Fatalf("expected third platform type, got %q", dto.Type)
	}
	if dto.URL != "https://example.com/spec.md" {
		t.Fatalf("expected file link url fallback, got %q", dto.URL)
	}
	if dto.Extension != "md" || dto.ThirdID != "third-1" || dto.SourceType != "lark" {
		t.Fatalf("unexpected dto: %#v", dto)
	}
	if dto.FileLink == nil || dto.FileLink.URL != "https://example.com/spec.md" {
		t.Fatalf("expected file link populated, got %#v", dto.FileLink)
	}

	if got := documentdomain.NormalizeDocumentFileType(" third-platform "); got != docFileTypeThirdParty {
		t.Fatalf("unexpected normalized type: %q", got)
	}
	if got := documentdomain.NormalizeDocumentFileType(float64(1)); got != docFileTypeExternal {
		t.Fatalf("unexpected numeric normalized type: %q", got)
	}
}

func TestDocumentFileExtensionHelpers(t *testing.T) {
	t.Parallel()

	if got := documentdomain.InferDocumentFileExtensionLight(nil); got != "" {
		t.Fatalf("expected empty ext, got %q", got)
	}
	if got := documentdomain.InferDocumentFileExtensionLight(&docentity.File{Name: "report.PDF"}); got != "pdf" {
		t.Fatalf("expected pdf from name, got %q", got)
	}
	if got := documentdomain.InferDocumentFileExtensionLight(&docentity.File{URL: "https://example.com/a.docx"}); got != "docx" {
		t.Fatalf("expected docx from url, got %q", got)
	}
	if got := documentdomain.InferDocumentFileExtensionLight(&docentity.File{FileKey: "ORG1/path/to/readme.md"}); got != "md" {
		t.Fatalf("expected md from file key, got %q", got)
	}

	svc := &DocumentAppService{
		parseService: &internalParseServiceStub{resolveFileType: "pptx"},
		logger:       logging.New(),
	}
	if _, err := svc.resolveDocumentFileExtension(context.Background(), nil); !errors.Is(err, errDocumentFileNil) {
		t.Fatalf("expected nil file error, got %v", err)
	}
	if _, err := svc.resolveDocumentFileExtension(context.Background(), &docentity.File{}); !errors.Is(err, errDocumentFileURLEmpty) {
		t.Fatalf("expected empty url error, got %v", err)
	}

	noParseSvc := &DocumentAppService{}
	if _, err := noParseSvc.resolveDocumentFileExtension(context.Background(), &docentity.File{URL: "https://example.com/a"}); !errors.Is(err, errDocumentParseNil) {
		t.Fatalf("expected nil parse error, got %v", err)
	}

	resolveErrSvc := &DocumentAppService{
		parseService: &internalParseServiceStub{resolveFileTypeErr: errResolveTypeFailed},
	}
	if _, err := resolveErrSvc.resolveDocumentFileExtension(context.Background(), &docentity.File{URL: "https://example.com/a"}); !errors.Is(err, errResolveTypeFailed) {
		t.Fatalf("expected wrapped resolve error, got %v", err)
	}

	docFromName := &docentity.KnowledgeBaseDocument{DocumentFile: &docentity.File{Name: "manual.md"}}
	svc.ensureDocumentFileExtensionForPersist(context.Background(), docFromName)
	if docFromName.DocumentFile.Extension != "md" {
		t.Fatalf("expected ext inferred from name, got %#v", docFromName.DocumentFile)
	}

	docFromResolver := &docentity.KnowledgeBaseDocument{
		DocumentFile: &docentity.File{URL: "https://example.com/no-ext"},
	}
	svc.ensureDocumentFileExtensionForSync(context.Background(), docFromResolver)
	if docFromResolver.DocumentFile.Extension != "pptx" {
		t.Fatalf("expected ext from resolver, got %#v", docFromResolver.DocumentFile)
	}
	if parseStub, ok := svc.parseService.(*internalParseServiceStub); !ok || parseStub.lastResolveTarget != "https://example.com/no-ext" {
		t.Fatalf("expected resolver target recorded, got %#v", svc.parseService)
	}

	projectSvc := &DocumentAppService{
		parseService: &internalParseServiceStub{resolveFileTypeErr: errResolveTypeFailed},
		logger:       logging.New(),
	}
	projectDoc := &docentity.KnowledgeBaseDocument{
		DocumentFile: &docentity.File{
			Type:    "project_file",
			Name:    "录音文本时间区间提取方案",
			FileKey: "ORG1/project/录音文本时间区间提取方案.md",
		},
	}
	projectSvc.ensureDocumentFileExtensionForSync(context.Background(), projectDoc)
	if projectDoc.DocumentFile.Extension != "md" {
		t.Fatalf("expected ext inferred from project file key, got %#v", projectDoc.DocumentFile)
	}
	if parseStub, ok := projectSvc.parseService.(*internalParseServiceStub); !ok || parseStub.lastResolveTarget != "" {
		t.Fatalf("expected project file to skip remote resolve, got %#v", projectSvc.parseService)
	}
}

func TestEntityToDTOBackfillsDocumentFileKeyFromStorageURL(t *testing.T) {
	t.Parallel()

	dto := EntityToDTO(&docentity.KnowledgeBaseDocument{
		Code: "DOC-STORAGE-KEY",
		DocumentFile: &docentity.File{
			Type: "external",
			Name: "录音文本时间区间提取方案.md",
			URL:  "DT001/organization/demo/录音文本时间区间提取方案.md",
		},
	})
	if dto == nil || dto.DocumentFile == nil {
		t.Fatalf("expected dto with document_file, got %#v", dto)
	}
	if dto.DocumentFile.Key != "DT001/organization/demo/录音文本时间区间提取方案.md" {
		t.Fatalf("expected storage url to backfill key, got %#v", dto.DocumentFile)
	}
}

func TestEntityToDTOKeepsExternalURLOutOfDocumentFileKey(t *testing.T) {
	t.Parallel()

	dto := EntityToDTO(&docentity.KnowledgeBaseDocument{
		Code: "DOC-REMOTE-URL",
		DocumentFile: &docentity.File{
			Type: "external",
			Name: "spec.md",
			URL:  "https://example.com/spec.md",
		},
	})
	if dto == nil || dto.DocumentFile == nil {
		t.Fatalf("expected dto with document_file, got %#v", dto)
	}
	if dto.DocumentFile.Key != "" {
		t.Fatalf("expected remote url not to backfill key, got %#v", dto.DocumentFile)
	}
}

func TestDocumentAppServiceParseDocumentContentThirdPlatformSuccess(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	domainStub := &internalDocumentDomainServiceStub{}
	portStub := &internalThirdPlatformDocumentPortStub{
		content: "line1\r\n\r\n\r\nline2",
		docType: int(docentity.DocumentInputKindFile),
		file: map[string]any{
			"url":         "https://example.com/resolved.md",
			"extension":   "md",
			"third_id":    "third-2",
			"source_type": "lark",
		},
	}
	svc := &DocumentAppService{
		domainService:             domainStub,
		parseService:              &internalParseServiceStub{},
		thirdPlatformDocumentPort: portStub,
		logger:                    logging.New(),
	}
	doc := &docentity.KnowledgeBaseDocument{
		Code:              "DOC1",
		Name:              "Doc",
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		ThirdPlatformType: "lark",
		ThirdFileID:       "third-2",
		UpdatedUID:        "U1",
		DocumentFile:      &docentity.File{Type: docFileTypeThirdParty},
	}

	parsed, content, err := svc.parseDocumentContent(ctx, doc, &ctxmeta.BusinessParams{UserID: "U2"}, nil)
	if err != nil {
		t.Fatalf("parse third platform: %v", err)
	}
	if parsed == nil || content != "line1\n\nline2" {
		t.Fatalf("unexpected parsed=%#v content=%q", parsed, content)
	}
	if parseSvc, ok := svc.parseService.(*internalParseServiceStub); !ok || parseSvc.parseDocumentReaderCalls != 1 || parseSvc.lastReaderContent != "line1\r\n\r\n\r\nline2" {
		t.Fatalf("expected raw content to go through Go reader parser, got %#v", svc.parseService)
	}
	if portStub.lastInput == nil || portStub.lastInput["user_id"] != "U2" {
		t.Fatalf("expected business params user id, got %#v", portStub.lastInput)
	}
	if doc.DocType != int(docentity.DocumentInputKindFile) || doc.DocumentFile.URL != "https://example.com/resolved.md" {
		t.Fatalf("unexpected doc after resolve: %#v", doc)
	}
}

func TestDocumentAppServiceParseDocumentContentFallbackToURL(t *testing.T) {
	t.Parallel()

	svc := &DocumentAppService{
		domainService:             &internalDocumentDomainServiceStub{},
		parseService:              &internalParseServiceStub{parseDocumentResult: parseddocument.NewPlainTextParsedDocument("txt", "alpha\r\n\r\n\r\nbeta")},
		thirdPlatformDocumentPort: &internalThirdPlatformDocumentPortStub{err: errThirdPlatformResolveBoom},
		logger:                    logging.New(),
	}
	doc := &docentity.KnowledgeBaseDocument{
		Code:              "DOC2",
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		ThirdFileID:       "third-3",
		DocumentFile:      &docentity.File{Type: docFileTypeThirdParty, URL: "https://example.com/doc.txt", Extension: "txt"},
	}

	parsed, content, err := svc.parseDocumentContent(context.Background(), doc, nil, nil)
	if err != nil {
		t.Fatalf("fallback parse: %v", err)
	}
	if parsed == nil || content != "alpha\n\nbeta" {
		t.Fatalf("unexpected fallback content: %q", content)
	}
}

func TestDocumentAppServiceParseDocumentContentPassesParseOptionsFromMetadata(t *testing.T) {
	t.Parallel()

	parseSvc := &internalParseServiceStub{
		parseDocumentResult: parseddocument.NewPlainTextParsedDocument("md", "alpha"),
	}
	svc := &DocumentAppService{
		domainService: &internalDocumentDomainServiceStub{},
		parseService:  parseSvc,
		logger:        logging.New(),
	}
	doc := &docentity.KnowledgeBaseDocument{
		Code: "DOC-OPTIONS",
		DocMetadata: map[string]any{
			documentdomain.ParseStrategyConfigKey: map[string]any{
				"parsing_type":     documentdomain.ParsingTypeQuick,
				"image_extraction": true,
				"table_extraction": true,
				"image_ocr":        true,
			},
		},
		DocumentFile: &docentity.File{URL: "https://example.com/doc.md", Extension: "md"},
	}

	_, _, err := svc.parseDocumentContent(context.Background(), doc, nil, nil)
	if err != nil {
		t.Fatalf("parse with options: %v", err)
	}
	if parseSvc.parseDocumentWithOptionsCalls != 1 {
		t.Fatalf("expected ParseDocumentWithOptions called once, got %d", parseSvc.parseDocumentWithOptionsCalls)
	}
	if parseSvc.lastParseOptions.ParsingType != documentdomain.ParsingTypeQuick {
		t.Fatalf("expected quick parse mode, got %#v", parseSvc.lastParseOptions)
	}
	if parseSvc.lastParseOptions.ImageExtraction || parseSvc.lastParseOptions.TableExtraction || parseSvc.lastParseOptions.ImageOCR {
		t.Fatalf("expected quick parse to disable extra extraction, got %#v", parseSvc.lastParseOptions)
	}
}

func TestDocumentAppServiceParseDocumentContentUsesBusinessFileNameForTabularDocument(t *testing.T) {
	t.Parallel()

	parseSvc := &internalParseServiceStub{
		parseDocumentResult: &parseddocument.ParsedDocument{
			SourceType: parseddocument.SourceTabular,
			PlainText: strings.Join([]string{
				"文件名: 1775908129904-0s6pzx-rag_.xlsx",
				"工作表: 截图数据",
				"表格: 截图数据 表1",
				"行号: 2",
				"门店编码：V90901",
			}, "\n"),
			Blocks: []parseddocument.ParsedBlock{
				{
					Type: parseddocument.BlockTypeTableRow,
					Content: strings.Join([]string{
						"文件名: 1775908129904-0s6pzx-rag_.xlsx",
						"工作表: 截图数据",
						"表格: 截图数据 表1",
						"行号: 2",
						"门店编码：V90901",
					}, "\n"),
					Metadata: map[string]any{
						parseddocument.MetaFileName:     "1775908129904-0s6pzx-rag_.xlsx",
						parseddocument.MetaSourceFormat: "xlsx",
						parseddocument.MetaSheetName:    "截图数据",
						parseddocument.MetaTableTitle:   "截图数据 表1",
						parseddocument.MetaRowIndex:     2,
						parseddocument.MetaFields: []map[string]any{
							{
								"header":      "门店编码",
								"header_path": "门店编码",
								"value":       "V90901",
							},
						},
					},
				},
			},
			DocumentMeta: map[string]any{
				parseddocument.MetaSourceFormat: "xlsx",
				parseddocument.MetaFileName:     "1775908129904-0s6pzx-rag_.xlsx",
			},
		},
	}
	svc := &DocumentAppService{
		domainService: &internalDocumentDomainServiceStub{},
		parseService:  parseSvc,
		logger:        logging.New(),
	}
	doc := &docentity.KnowledgeBaseDocument{
		Code: "DOC-TABULAR-NAME",
		DocumentFile: &docentity.File{
			Name:      "rag 门店数据验证.xlsx",
			URL:       "https://example.com/1775908129904-0s6pzx-rag_.xlsx",
			Extension: "xlsx",
		},
	}

	parsed, content, err := svc.parseDocumentContent(context.Background(), doc, nil, nil)
	if err != nil {
		t.Fatalf("parse tabular content: %v", err)
	}
	if got := parsed.DocumentMeta[parseddocument.MetaFileName]; got != "rag 门店数据验证.xlsx" {
		t.Fatalf("expected parsed document meta file_name updated, got %#v", parsed.DocumentMeta)
	}
	if !strings.Contains(content, "文件名: rag 门店数据验证.xlsx") {
		t.Fatalf("expected sync content to use business file name, got %q", content)
	}
	if strings.Contains(content, "1775908129904-0s6pzx-rag_.xlsx") {
		t.Fatalf("expected random object key file name removed from sync content, got %q", content)
	}
}

func TestDocumentAppServiceParseDocumentContentFailurePaths(t *testing.T) {
	t.Parallel()

	t.Run("third platform failure without url", func(t *testing.T) {
		t.Parallel()

		svc := &DocumentAppService{
			thirdPlatformDocumentPort: &internalThirdPlatformDocumentPortStub{err: errThirdPlatformGatewayDown},
			logger:                    logging.New(),
		}
		doc := &docentity.KnowledgeBaseDocument{
			Code:              "DOC3",
			OrganizationCode:  "ORG1",
			KnowledgeBaseCode: "KB1",
			ThirdFileID:       "third-4",
			DocumentFile:      &docentity.File{Type: docFileTypeThirdParty},
		}

		_, _, err := svc.parseDocumentContent(context.Background(), doc, nil, nil)
		if err == nil {
			t.Fatal("expected parse error")
		}
		var stageErr *documentdomain.SyncStageError
		if !errors.As(err, &stageErr) || stageErr == nil || stageErr.Reason != documentdomain.SyncFailureResolveThirdPlatform {
			t.Fatalf("expected resolve-third-platform stage error, got %v", err)
		}
		if doc.SyncStatus != 0 {
			t.Fatalf("expected parse helper to avoid status side effect, got %#v", doc)
		}
	})

	t.Run("url parse error", func(t *testing.T) {
		t.Parallel()

		svc := &DocumentAppService{
			parseService: &internalParseServiceStub{parseDocumentErr: errParseDocumentFailed},
			logger:       logging.New(),
		}
		doc := &docentity.KnowledgeBaseDocument{
			Code:         "DOC4",
			DocumentFile: &docentity.File{URL: "https://example.com/doc.txt", Extension: "txt"},
		}

		_, _, err := svc.parseDocumentContent(context.Background(), doc, nil, nil)
		if err == nil {
			t.Fatal("expected parse error")
		}
		var stageErr *documentdomain.SyncStageError
		if !errors.As(err, &stageErr) || stageErr == nil || stageErr.Reason != documentdomain.SyncFailureParsing {
			t.Fatalf("expected parsing stage error, got %v", err)
		}
		if doc.SyncStatus != 0 {
			t.Fatalf("expected parse helper to avoid status side effect, got %#v", doc)
		}
	})
}

func TestDocumentAppServiceParseDocumentContentFailsUnsupportedFileTypePrecheck(t *testing.T) {
	t.Parallel()

	parseSvc := &internalParseServiceStub{}
	svc := &DocumentAppService{
		parseService: parseSvc,
		logger:       logging.New(),
	}
	doc := &docentity.KnowledgeBaseDocument{
		Code:         "DOC-UNSUPPORTED",
		DocumentFile: &docentity.File{URL: "https://example.com/demo.js", Extension: "js"},
	}

	_, _, err := svc.parseDocumentContent(context.Background(), doc, nil, nil)
	if err == nil {
		t.Fatal("expected parse error")
	}
	var stageErr *documentdomain.SyncStageError
	if !errors.As(err, &stageErr) || stageErr == nil || stageErr.Reason != documentdomain.SyncFailureParsing {
		t.Fatalf("expected parsing stage error, got %v", err)
	}
	if !errors.Is(err, documentdomain.ErrUnsupportedKnowledgeBaseFileType) {
		t.Fatalf("expected unsupported file type error, got %v", err)
	}
	if parseSvc.parseDocumentWithOptionsCalls != 0 || parseSvc.parseDocumentReaderCalls != 0 {
		t.Fatalf("expected unsupported file precheck to stop before parse service, got %#v", parseSvc)
	}
}

func TestDocumentAppServiceInputToEntityAndDTOWithContext(t *testing.T) {
	t.Parallel()

	sourceType := int(kbentity.SourceTypeProject)
	kb := &kbentity.KnowledgeBase{
		Code:       "KB1",
		VectorDB:   "qdrant",
		Model:      "kb-model",
		CreatedUID: "U1",
		SourceType: &sourceType,
		EmbeddingConfig: &shared.EmbeddingConfig{
			ModelID: "kb-model",
		},
		RetrieveConfig: &shared.RetrieveConfig{TopK: 5},
		FragmentConfig: &shared.FragmentConfig{
			Mode: shared.FragmentModeNormal,
			Normal: &shared.NormalFragmentConfig{
				SegmentRule: &shared.SegmentRule{ChunkSize: 128, ChunkOverlap: 16, Separator: "\n"},
			},
		},
	}
	input := &docdto.CreateDocumentInput{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		KnowledgeBaseCode: "KB1",
		Name:              "Doc",
		Description:       "Desc",
		DocType:           int(docentity.DocumentInputKindFile),
		DocumentFile:      &docfilehelper.DocumentFileDTO{Name: "doc.md", URL: "https://example.com/doc.md"},
	}

	svc := &DocumentAppService{
		kbService: &internalKnowledgeBaseReaderStub{
			showByCodeAndOrgResult: kb,
			effectiveModel:         routeModel,
		},
		tokenizer: tokenizer.NewService(),
		logger:    logging.New(),
	}

	doc := svc.inputToEntity(createDocumentInputToManaged(input), kb, routeModel)
	if doc.VectorDB != "qdrant" || doc.EmbeddingModel != routeModel {
		t.Fatalf("unexpected inherited doc config: %#v", doc)
	}
	if doc.RetrieveConfig == nil || doc.FragmentConfig == nil || doc.EmbeddingConfig == nil {
		t.Fatalf("expected inherited configs, got %#v", doc)
	}

	dto := svc.entityToDTOWithContext(context.Background(), doc)
	if dto == nil || dto.EmbeddingModel != routeModel || dto.EmbeddingConfig == nil || dto.EmbeddingConfig.ModelID != routeModel {
		t.Fatalf("unexpected dto: %#v", dto)
	}
	if dto.SourceType == nil || *dto.SourceType != sourceType {
		t.Fatalf("expected knowledge base source type in dto, got %#v", dto)
	}
}

func TestDocumentAppServiceTokenizerFlows(t *testing.T) {
	t.Parallel()

	tokenizerSvc := tokenizer.NewService()
	if _, err := tokenizerSvc.EncoderForModel(routeModel); err != nil {
		t.Fatalf("prewarm tokenizer: %v", err)
	}

	t.Run("BuildFragmentsAndCleanup", func(t *testing.T) {
		t.Parallel()
		assertDocumentAppServiceBuildFragmentsAndCleanup(t, tokenizerSvc)
	})

	t.Run("BuildFragmentsAutoHierarchyUsesDocumentSplitter", func(t *testing.T) {
		t.Parallel()
		assertDocumentAppServiceBuildFragmentsAutoHierarchyUsesDocumentSplitter(t, tokenizerSvc)
	})
	runBuildFragmentsKnowledgeBaseTypeSubtests(t, tokenizerSvc)

	t.Run("SyncCreateFlow", func(t *testing.T) {
		t.Parallel()
		assertDocumentAppServiceSyncCreateFlow(t, tokenizerSvc)
	})

	t.Run("SyncStopsWhenEnsureCollectionExistsFails", func(t *testing.T) {
		t.Parallel()
		assertDocumentAppServiceSyncStopsWhenEnsureCollectionExistsFails(t, tokenizerSvc)
	})

	t.Run("SyncDoesNotSkipDuplicatedResyncDuringRebuildOverride", func(t *testing.T) {
		t.Parallel()
		assertDocumentAppServiceSyncDoesNotSkipDuplicatedResyncDuringRebuildOverride(t, tokenizerSvc)
	})

	t.Run("SyncResyncUsesIncrementalPlan", func(t *testing.T) {
		t.Parallel()
		assertDocumentAppServiceSyncResyncUsesIncrementalPlan(t, tokenizerSvc)
	})

	t.Run("SyncResyncForceBackfillsUnchangedFragmentsWhenPointMissing", func(t *testing.T) {
		t.Parallel()
		assertDocumentAppServiceSyncResyncForceBackfillsUnchangedFragmentsWhenPointMissing(t, tokenizerSvc)
	})

	t.Run("SyncResyncWithRebuildOverrideForceBackfillsUnchangedFragments", func(t *testing.T) {
		t.Parallel()
		assertDocumentAppServiceSyncResyncWithRebuildOverrideForceBackfillsUnchangedFragments(t, tokenizerSvc)
	})

	t.Run("SyncResyncWithRebuildOverrideSkipsUnchangedFragmentsWhenPointAlreadyExists", func(t *testing.T) {
		t.Parallel()
		assertDocumentAppServiceSyncResyncWithRebuildOverrideSkipsUnchangedFragmentsWhenPointAlreadyExists(t, tokenizerSvc)
	})

	t.Run("SyncUsesRuntimeKnowledgeBaseCopyForResolvedRoute", func(t *testing.T) {
		t.Parallel()
		assertDocumentAppServiceSyncUsesRuntimeKnowledgeBaseCopyForResolvedRoute(t, tokenizerSvc)
	})

	t.Run("SyncUsesSourceOverrideWithoutThirdPlatformResolve", func(t *testing.T) {
		t.Parallel()
		assertDocumentAppServiceSyncUsesSourceOverrideWithoutThirdPlatformResolve(t, tokenizerSvc)
	})

	t.Run("SyncUsesStructuredSourceOverrideForTabularSplit", func(t *testing.T) {
		t.Parallel()
		assertDocumentAppServiceSyncUsesStructuredSourceOverrideForTabularSplit(t, tokenizerSvc)
	})
}

func runBuildFragmentsKnowledgeBaseTypeSubtests(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	tests := []struct {
		name                   string
		knowledgeBaseType      kbentity.Type
		wantEffectiveSplitMode string
	}{
		{
			name:                   "BuildFragmentsFlowVectorForcesAutoMode",
			knowledgeBaseType:      kbentity.KnowledgeBaseTypeFlowVector,
			wantEffectiveSplitMode: "normal",
		},
		{
			name:                   "BuildFragmentsEmptyKnowledgeBaseTypeForcesAutoMode",
			knowledgeBaseType:      "",
			wantEffectiveSplitMode: "normal",
		},
		{
			name:                   "BuildFragmentsDigitalEmployeeKeepsHierarchyMode",
			knowledgeBaseType:      kbentity.KnowledgeBaseTypeDigitalEmployee,
			wantEffectiveSplitMode: "normal_fallback",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			assertDocumentAppServiceBuildFragmentsKnowledgeBaseTypeControlsMode(
				t,
				tokenizerSvc,
				tt.knowledgeBaseType,
				tt.wantEffectiveSplitMode,
			)
		})
	}
}

func TestEntityToDTOMapsTopLevelStrategyConfigFromMetadata(t *testing.T) {
	t.Parallel()

	dto := EntityToDTO(&docentity.KnowledgeBaseDocument{
		Code:              "DOC-STRATEGY",
		KnowledgeBaseCode: "KB1",
		DocType:           int(docentity.DocumentInputKindFile),
		DocMetadata: map[string]any{
			documentdomain.ParseStrategyConfigKey: map[string]any{
				"parsing_type":     documentdomain.ParsingTypePrecise,
				"image_extraction": false,
				"table_extraction": true,
				"image_ocr":        true,
			},
		},
	})
	if dto == nil || dto.StrategyConfig == nil {
		t.Fatalf("expected strategy config mapped, got %#v", dto)
	}
	if dto.StrategyConfig.ParsingType != documentdomain.ParsingTypePrecise ||
		dto.StrategyConfig.ImageExtraction ||
		!dto.StrategyConfig.TableExtraction ||
		!dto.StrategyConfig.ImageOCR {
		t.Fatalf("unexpected strategy config %#v", dto.StrategyConfig)
	}
}

func TestCreateDocumentInputToManagedUsesTopLevelStrategyConfig(t *testing.T) {
	t.Parallel()

	managed := createDocumentInputToManaged(&docdto.CreateDocumentInput{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		KnowledgeBaseCode: "KB1",
		Name:              "Doc",
		DocType:           int(docentity.DocumentInputKindFile),
		DocMetadata: map[string]any{
			"source": "knowledge-demo",
			documentdomain.ParseStrategyConfigKey: map[string]any{
				"parsing_type":     documentdomain.ParsingTypeQuick,
				"image_extraction": false,
				"table_extraction": false,
				"image_ocr":        false,
			},
		},
		StrategyConfig: &confighelper.StrategyConfigDTO{
			ParsingType:     documentdomain.ParsingTypePrecise,
			ImageExtraction: false,
			TableExtraction: true,
			ImageOCR:        true,
		},
	})

	if managed == nil {
		t.Fatal("expected managed input")
	}
	if managed.DocMetadata["source"] != "knowledge-demo" {
		t.Fatalf("expected source metadata preserved, got %#v", managed.DocMetadata)
	}
	strategy, ok := managed.DocMetadata[documentdomain.ParseStrategyConfigKey].(map[string]any)
	if !ok {
		t.Fatalf("expected strategy metadata mapped, got %#v", managed.DocMetadata)
	}
	if strategy["parsing_type"] != documentdomain.ParsingTypePrecise ||
		strategy["image_extraction"] != false ||
		strategy["table_extraction"] != true ||
		strategy["image_ocr"] != true {
		t.Fatalf("unexpected managed strategy metadata %#v", strategy)
	}
}

func assertDocumentAppServiceBuildFragmentsAndCleanup(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	kb := &kbentity.KnowledgeBase{
		Code: "KB1",
		FragmentConfig: &shared.FragmentConfig{
			Mode: shared.FragmentModeNormal,
			Normal: &shared.NormalFragmentConfig{
				SegmentRule: &shared.SegmentRule{ChunkSize: 128, ChunkOverlap: 16, Separator: "\n"},
			},
		},
	}
	svc := &DocumentAppService{
		tokenizer: tokenizerSvc,
		logger:    logging.New(),
	}
	fragments, err := svc.buildFragments(
		context.Background(),
		&docentity.KnowledgeBaseDocument{
			Code:              "DOC1",
			Name:              "Doc",
			DocType:           int(docentity.DocumentInputKindFile),
			DocMetadata:       map[string]any{"topic": "rag"},
			KnowledgeBaseCode: "KB1",
			OrganizationCode:  "ORG1",
			UpdatedUID:        "U1",
			DocumentFile:      &docentity.File{Extension: "md"},
		},
		kb,
		parseddocument.NewPlainTextParsedDocument("md", "第一段内容\n\n第二段内容"),
		routeModel,
	)
	if err != nil {
		t.Fatalf("build fragments: %v", err)
	}
	if len(fragments) == 0 || fragments[0].PointID == "" || fragments[0].ContentHash == "" {
		t.Fatalf("unexpected fragments: %#v", fragments)
	}

	fragmentStub := &internalFragmentDocumentServiceStub{}
	cleanupSvc := &DocumentAppService{
		fragmentService: fragmentStub,
		logger:          logging.New(),
	}
	cleanupDoc := &docentity.KnowledgeBaseDocument{
		Code:              "DOC1",
		KnowledgeBaseCode: "KB1",
		OrganizationCode:  "ORG1",
	}
	cleanupSvc.cleanupFragmentsByDocument(context.Background(), cleanupDoc, "collection_docs")
	if fragmentStub.deletePointsByDocumentCalls != 1 || fragmentStub.deleteByDocumentCalls != 1 {
		t.Fatalf("unexpected cleanup by document calls: %#v", fragmentStub)
	}
}

func assertDocumentAppServiceBuildFragmentsAutoHierarchyUsesDocumentSplitter(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	kb := &kbentity.KnowledgeBase{
		Code: "KB-AUTO",
		FragmentConfig: &shared.FragmentConfig{
			Mode: shared.FragmentModeAuto,
			Hierarchy: &shared.HierarchyFragmentConfig{
				MaxLevel: 3,
			},
		},
	}
	doc := &docentity.KnowledgeBaseDocument{
		Code:              "DOC-AUTO",
		Name:              "hierarchy.md",
		DocType:           int(docentity.DocumentInputKindFile),
		DocMetadata:       map[string]any{"topic": "hierarchy"},
		KnowledgeBaseCode: "KB-AUTO",
		OrganizationCode:  "ORG1",
		UpdatedUID:        "U1",
		DocumentFile:      &docentity.File{Name: "hierarchy.md", Extension: "md"},
	}
	svc := &DocumentAppService{
		tokenizer: tokenizerSvc,
		logger:    logging.New(),
	}

	fragments, err := svc.buildFragments(
		context.Background(),
		doc,
		kb,
		parseddocument.NewPlainTextParsedDocument("md", "# 一级标题\n一级内容\n## 二级标题\n二级内容\n### 三级标题\n三级内容\n#### 四级标题\n四级内容\n##### 五级标题\n五级内容"),
		routeModel,
	)
	if err != nil {
		t.Fatalf("build fragments: %v", err)
	}
	if len(fragments) == 0 {
		t.Fatal("expected hierarchy fragments")
	}
	assertAutoHierarchyFragments(t, fragments)
}

func assertDocumentAppServiceBuildFragmentsKnowledgeBaseTypeControlsMode(
	t *testing.T,
	tokenizerSvc *tokenizer.Service,
	knowledgeBaseType kbentity.Type,
	wantEffectiveSplitMode string,
) {
	t.Helper()

	kb := &kbentity.KnowledgeBase{
		Code:              "KB-TYPE",
		KnowledgeBaseType: knowledgeBaseType,
		FragmentConfig: &shared.FragmentConfig{
			Mode: shared.FragmentModeHierarchy,
			Hierarchy: &shared.HierarchyFragmentConfig{
				MaxLevel: 5,
			},
		},
	}
	doc := &docentity.KnowledgeBaseDocument{
		Code:              "DOC-TYPE",
		Name:              "plain.txt",
		DocType:           int(docentity.DocumentInputKindFile),
		DocMetadata:       map[string]any{"topic": "plain"},
		KnowledgeBaseCode: "KB-TYPE",
		OrganizationCode:  "ORG1",
		UpdatedUID:        "U1",
		DocumentFile:      &docentity.File{Name: "plain.txt", Extension: "txt"},
		FragmentConfig: &shared.FragmentConfig{
			Mode: shared.FragmentModeHierarchy,
			Hierarchy: &shared.HierarchyFragmentConfig{
				MaxLevel: 5,
			},
		},
	}
	svc := &DocumentAppService{
		tokenizer: tokenizerSvc,
		logger:    logging.New(),
	}

	fragments, err := svc.buildFragments(
		context.Background(),
		doc,
		kb,
		parseddocument.NewPlainTextParsedDocument("txt", strings.Repeat("第一段内容。", 120)),
		routeModel,
	)
	if err != nil {
		t.Fatalf("build fragments: %v", err)
	}
	if len(fragments) == 0 {
		t.Fatal("expected fragments")
	}
	if got := fragments[0].Metadata["effective_split_mode"]; got != wantEffectiveSplitMode {
		t.Fatalf("unexpected effective split mode %v, want %q", got, wantEffectiveSplitMode)
	}
}

func assertAutoHierarchyFragments(t *testing.T, fragments []*fragmodel.KnowledgeBaseFragment) {
	t.Helper()
	first := fragments[0]
	if first.SplitVersion == "fragment_local_v1" {
		t.Fatalf("expected document splitter version, got local splitter: %#v", first)
	}
	if got := first.Metadata["effective_split_mode"]; got != "hierarchy_auto" {
		t.Fatalf("expected hierarchy_auto metadata, got %#v", got)
	}
	if got := first.Metadata["hierarchy_detector"]; got != "markdown_ast" {
		t.Fatalf("expected markdown_ast detector, got %#v", got)
	}
	if got := first.Metadata["tree_node_id"]; got == "" || got == nil {
		t.Fatalf("expected hierarchy tree node metadata, got %#v", got)
	}
	if first.SectionLevel < 0 || first.SectionPath == "" {
		t.Fatalf("expected hierarchy section fields, got %#v", first)
	}
	for _, fragment := range fragments {
		if fragment.SectionLevel > 3 {
			t.Fatalf("expected default hierarchy level <=3, got %#v", fragment)
		}
		if strings.Contains(fragment.SectionPath, "五级标题") {
			t.Fatalf("expected fifth level to merge into level 3, got %#v", fragment)
		}
	}

	foundLevel4Body := false
	foundMergedLevel5 := false
	for _, fragment := range fragments {
		if fragment.SectionPath != "一级标题 > 二级标题 > 三级标题 > 四级标题" {
			continue
		}
		if strings.Contains(fragment.Content, "四级内容") {
			foundLevel4Body = true
		}
		if strings.Contains(fragment.Content, "##### 五级标题") && strings.Contains(fragment.Content, "五级内容") {
			foundMergedLevel5 = true
		}
	}
	if !foundLevel4Body {
		t.Fatalf("expected level-4 fragment to keep own body text, got %#v", fragments)
	}
	if !foundMergedLevel5 {
		t.Fatalf("expected fifth-level segment to merge under level-4 section path, got %#v", fragments)
	}
}

func assertDocumentAppServiceSyncCreateFlow(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	doc := &docentity.KnowledgeBaseDocument{
		Code:              "DOC1",
		Name:              "Doc",
		DocType:           int(docentity.DocumentInputKindFile),
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentFile:      &docentity.File{Name: "doc.md", URL: "https://example.com/doc.md"},
	}
	domainStub := &internalDocumentDomainServiceStub{showByCodeAndKBResult: doc}
	callOrder := make([]string, 0, 4)
	fragmentStub := &internalFragmentDocumentServiceStub{callOrder: &callOrder}
	kb := &kbentity.KnowledgeBase{Code: "KB1", Model: routeModel}
	kbStub := &internalKnowledgeBaseReaderStub{
		showByCodeAndOrgResult: kb,
		effectiveModel:         routeModel,
		callOrder:              &callOrder,
	}
	svc := &DocumentAppService{
		domainService:   domainStub,
		kbService:       kbStub,
		fragmentService: fragmentStub,
		parseService:    &internalParseServiceStub{parseDocumentResult: parseddocument.NewPlainTextParsedDocument("md", "第一段\n\n第二段")},
		tokenizer:       tokenizerSvc,
		logger:          logging.New(),
	}

	if err := svc.Sync(context.Background(), &documentdomain.SyncDocumentInput{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		Code:              "DOC1",
		Mode:              syncModeCreate,
	}); err != nil {
		t.Fatalf("sync create: %v", err)
	}
	if doc.SyncStatus != shared.SyncStatusSynced || doc.WordCount == 0 {
		t.Fatalf("unexpected doc after sync: %#v", doc)
	}
	if fragmentStub.saveBatchCalls != 1 || fragmentStub.syncFragmentBatchCalls != 1 {
		t.Fatalf("expected fragment batch save+sync, got %#v", fragmentStub)
	}
	if fragmentStub.deletePointsByDocumentCalls != 1 || fragmentStub.deleteByDocumentCalls != 1 {
		t.Fatalf("expected cleanup by document for create mode, got %#v", fragmentStub)
	}
	if kbStub.ensureCollectionExistsCalls != 1 ||
		kbStub.lastEnsuredKnowledgeBase == nil ||
		kbStub.lastEnsuredKnowledgeBase.Code != kb.Code ||
		kbStub.lastEnsuredKnowledgeBase.ResolvedRoute == nil ||
		kbStub.lastEnsuredKnowledgeBase.ResolvedRoute.Model != routeModel {
		t.Fatalf("expected create mode to ensure runtime collection once, got %#v", kbStub)
	}
	if got := strings.Join(callOrder, ","); !strings.HasPrefix(got, "ensure_collection_exists,") || !strings.Contains(got, "save_batch") || !strings.Contains(got, "sync_fragment_batch") {
		t.Fatalf("expected ensure before fragment save+sync, got %q", got)
	}
	if got := doc.DocMetadata[parseddocument.MetaSourceFormat]; got != "md" {
		t.Fatalf("expected parsed source format metadata merged, got %#v", doc.DocMetadata)
	}
}

func assertDocumentAppServiceSyncStopsWhenEnsureCollectionExistsFails(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	doc := &docentity.KnowledgeBaseDocument{
		Code:              "DOC1A",
		Name:              "Doc",
		DocType:           int(docentity.DocumentInputKindFile),
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentFile:      &docentity.File{Name: "doc.md", URL: "https://example.com/doc.md"},
	}
	domainStub := &internalDocumentDomainServiceStub{showByCodeAndKBResult: doc}
	fragmentStub := &internalFragmentDocumentServiceStub{}
	kb := &kbentity.KnowledgeBase{Code: "KB1", Model: routeModel}
	kbStub := &internalKnowledgeBaseReaderStub{
		showByCodeAndOrgResult:    kb,
		effectiveModel:            routeModel,
		ensureCollectionExistsErr: errEnsureCollectionFailed,
	}
	svc := &DocumentAppService{
		domainService:   domainStub,
		kbService:       kbStub,
		fragmentService: fragmentStub,
		parseService:    &internalParseServiceStub{parseDocumentResult: parseddocument.NewPlainTextParsedDocument("md", "alpha")},
		tokenizer:       tokenizerSvc,
		logger:          logging.New(),
	}

	err := svc.Sync(context.Background(), &documentdomain.SyncDocumentInput{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		Code:              "DOC1A",
		Mode:              syncModeCreate,
	})
	if err == nil || !strings.Contains(err.Error(), "ensure runtime collection exists") {
		t.Fatalf("expected ensure collection failure, got %v", err)
	}
	if kbStub.ensureCollectionExistsCalls != 1 {
		t.Fatalf("expected ensure collection to be called once, got %#v", kbStub)
	}
	if fragmentStub.saveBatchCalls != 0 || fragmentStub.syncFragmentBatchCalls != 0 || fragmentStub.listExistingPointIDsCalls != 0 {
		t.Fatalf("expected ensure failure to stop fragment flow, got %#v", fragmentStub)
	}
	if doc.SyncStatus != shared.SyncStatusSyncFailed || !strings.Contains(doc.SyncStatusMessage, "ensure runtime collection exists") {
		t.Fatalf("expected document marked sync failed by ensure error, got %#v", doc)
	}
}

func TestDocumentAppServiceSyncDoesNotSkipResyncWhenDocumentStatusIsSyncing(t *testing.T) {
	t.Parallel()

	doc := &docentity.KnowledgeBaseDocument{
		Code:              "DOC2",
		Name:              "doc.md",
		DocType:           int(docentity.DocumentInputKindFile),
		SyncStatus:        shared.SyncStatusSyncing,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentFile: &docentity.File{
			Name:      "doc.md",
			URL:       "https://example.com/doc.md",
			Extension: "md",
		},
	}
	parsed := parseddocument.NewPlainTextParsedDocument("md", "# title\n\nbody")
	domainStub := &internalDocumentDomainServiceStub{showByCodeAndKBResult: doc}
	fragmentStub := &internalFragmentDocumentServiceStub{}
	kb := &kbentity.KnowledgeBase{Code: "KB1", Model: routeModel}
	svc := &DocumentAppService{
		domainService:   domainStub,
		kbService:       &internalKnowledgeBaseReaderStub{showByCodeAndOrgResult: kb, effectiveModel: routeModel},
		fragmentService: fragmentStub,
		parseService:    &internalParseServiceStub{parseDocumentResult: parsed},
		tokenizer:       tokenizer.NewService(),
		logger:          logging.New(),
	}

	if err := svc.Sync(context.Background(), &documentdomain.SyncDocumentInput{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		Code:              "DOC2",
		Mode:              syncModeResync,
	}); err != nil {
		t.Fatalf("sync resync while document status is syncing: %v", err)
	}
	if domainStub.updateCalls == 0 {
		t.Fatal("expected syncing-status resync to continue executing")
	}
	if doc.SyncStatus != shared.SyncStatusSynced {
		t.Fatalf("expected syncing-status doc to finish synced, got %v", doc.SyncStatus)
	}
}

func TestDocumentAppServiceSyncMergesParsedDocumentMetaIntoDocMetadata(t *testing.T) {
	t.Parallel()

	tokenizerSvc := tokenizer.NewService()

	doc := &docentity.KnowledgeBaseDocument{
		Code:              "DOC-META",
		Name:              "Doc",
		DocType:           int(docentity.DocumentInputKindFile),
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocMetadata: map[string]any{
			"source":      "knowledge-demo",
			"source_type": "local_upload",
		},
		DocumentFile: &docentity.File{Name: "doc.docx", URL: "https://example.com/doc.docx", Extension: "docx"},
	}
	parsed := parseddocument.NewPlainTextParsedDocument("docx", "alpha\n\n图片OCR：beta")
	parsed.DocumentMeta[parseddocument.MetaEmbeddedImageCount] = 2
	parsed.DocumentMeta[parseddocument.MetaEmbeddedImageOCRSuccessCount] = 2
	parsed.DocumentMeta[parseddocument.MetaEmbeddedImageOCRFailedCount] = 0
	parsed.DocumentMeta[parseddocument.MetaEmbeddedImageOCRSkippedCount] = 0

	domainStub := &internalDocumentDomainServiceStub{showByCodeAndKBResult: doc}
	fragmentStub := &internalFragmentDocumentServiceStub{}
	kb := &kbentity.KnowledgeBase{Code: "KB1", Model: routeModel}
	svc := &DocumentAppService{
		domainService:   domainStub,
		kbService:       &internalKnowledgeBaseReaderStub{showByCodeAndOrgResult: kb, effectiveModel: routeModel},
		fragmentService: fragmentStub,
		parseService:    &internalParseServiceStub{parseDocumentResult: parsed},
		tokenizer:       tokenizerSvc,
		logger:          logging.New(),
	}

	if err := svc.Sync(context.Background(), &documentdomain.SyncDocumentInput{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		Code:              "DOC-META",
		Mode:              syncModeCreate,
	}); err != nil {
		t.Fatalf("sync create with parsed metadata: %v", err)
	}

	if got := doc.DocMetadata["source"]; got != "knowledge-demo" {
		t.Fatalf("expected business metadata preserved, got %#v", doc.DocMetadata)
	}
	if got := doc.DocMetadata[parseddocument.MetaEmbeddedImageCount]; got != 2 {
		t.Fatalf("expected embedded image count merged, got %#v", doc.DocMetadata)
	}
	if got := doc.DocMetadata[parseddocument.MetaEmbeddedImageOCRSuccessCount]; got != 2 {
		t.Fatalf("expected embedded image ocr success merged, got %#v", doc.DocMetadata)
	}
}

func assertDocumentAppServiceSyncDoesNotSkipDuplicatedResyncDuringRebuildOverride(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	doc := &docentity.KnowledgeBaseDocument{
		Code:              "DOC2B",
		Name:              "Doc",
		DocType:           int(docentity.DocumentInputKindFile),
		SyncStatus:        shared.SyncStatusSyncing,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentFile:      &docentity.File{Name: "doc.md", URL: "https://example.com/doc.md"},
	}
	kb := &kbentity.KnowledgeBase{Code: "KB1", Model: routeModel}
	domainStub := &internalDocumentDomainServiceStub{showByCodeAndKBResult: doc}
	fragmentStub := &internalFragmentDocumentServiceStub{}
	svc := &DocumentAppService{
		domainService:   domainStub,
		kbService:       &internalKnowledgeBaseReaderStub{showByCodeAndOrgResult: kb, effectiveModel: routeModel},
		fragmentService: fragmentStub,
		parseService: &internalParseServiceStub{
			parseDocumentResult: parseddocument.NewPlainTextParsedDocument("md", "alpha"),
		},
		tokenizer: tokenizerSvc,
		logger:    logging.New(),
	}

	if err := svc.Sync(context.Background(), &documentdomain.SyncDocumentInput{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		Code:              "DOC2B",
		Mode:              syncModeResync,
		RebuildOverride: &knowledgeroute.RebuildOverride{
			TargetCollection: "magic_knowledge",
			TargetModel:      routeModel,
		},
	}); err != nil {
		t.Fatalf("sync duplicated resync during rebuild override: %v", err)
	}
	if domainStub.updateCalls == 0 {
		t.Fatalf("expected rebuild override resync not to be skipped")
	}
	if fragmentStub.syncFragmentBatchCalls == 0 {
		t.Fatalf("expected rebuild override resync to continue syncing fragments")
	}
}

func assertDocumentAppServiceSyncResyncUsesIncrementalPlan(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	doc := &docentity.KnowledgeBaseDocument{
		Code:              "DOC3",
		Name:              "Doc",
		DocType:           int(docentity.DocumentInputKindFile),
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentFile:      &docentity.File{Name: "doc.md", URL: "https://example.com/doc.md"},
	}
	domainStub := &internalDocumentDomainServiceStub{
		showByCodeAndKBResult: doc,
	}
	fragmentStub := &internalFragmentDocumentServiceStub{
		listByDocumentResult: []*fragmodel.KnowledgeBaseFragment{
			{
				ID:           11,
				DocumentCode: "DOC3",
				PointID:      BuildPointIDForTest("KB1", "DOC3", BuildChunkIdentityKeyForTest("8ed3f6ad685b959ead7022518e1af76cd816f8e8ec7ccdda1ed4018e8f2223f8", 0)),
				ChunkIndex:   0,
				Content:      "alpha",
				ContentHash:  "8ed3f6ad685b959ead7022518e1af76cd816f8e8ec7ccdda1ed4018e8f2223f8",
				SectionPath:  "",
				SyncStatus:   1,
			},
		},
	}
	kb := &kbentity.KnowledgeBase{Code: "KB1", Model: routeModel}
	svc := &DocumentAppService{
		domainService:   domainStub,
		kbService:       &internalKnowledgeBaseReaderStub{showByCodeAndOrgResult: kb, effectiveModel: routeModel},
		fragmentService: fragmentStub,
		parseService:    &internalParseServiceStub{parseDocumentResult: parseddocument.NewPlainTextParsedDocument("md", "alpha")},
		tokenizer:       tokenizerSvc,
		logger:          logging.New(),
	}

	if err := svc.Sync(context.Background(), &documentdomain.SyncDocumentInput{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		Code:              "DOC3",
		Mode:              syncModeResync,
	}); err != nil {
		t.Fatalf("sync resync: %v", err)
	}
	if fragmentStub.listByDocumentCalls == 0 {
		t.Fatalf("expected resync to query existing fragments, got %#v", fragmentStub)
	}
	if fragmentStub.updateBatchCalls != 1 || fragmentStub.syncFragmentBatchCalls != 1 {
		t.Fatalf("expected incremental resync to use batch update+sync, got %#v", fragmentStub)
	}
	if fragmentStub.lastSaveBatchSize != 0 {
		t.Fatalf("expected resync not to pre-save fragments before incremental plan, got %#v", fragmentStub)
	}
	if fragmentStub.updateCalls != 0 {
		t.Fatalf("expected incremental resync not to use single-fragment update, got %#v", fragmentStub)
	}
	if fragmentStub.deletePointsByDocumentCalls != 0 || fragmentStub.deleteByDocumentCalls != 0 {
		t.Fatalf("expected resync not to full cleanup document data, got %#v", fragmentStub)
	}
}

func assertDocumentAppServiceSyncResyncWithRebuildOverrideForceBackfillsUnchangedFragments(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	doc := &docentity.KnowledgeBaseDocument{
		Code:              "DOC4",
		Name:              "Doc",
		DocType:           int(docentity.DocumentInputKindFile),
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentFile:      &docentity.File{Name: "doc.md", URL: "https://example.com/doc.md"},
	}
	kb := &kbentity.KnowledgeBase{Code: "KB1", Model: routeModel}
	parseSvc := &internalParseServiceStub{
		parseDocumentResult: parseddocument.NewPlainTextParsedDocument("md", "alpha"),
	}
	fragmentStub := &internalFragmentDocumentServiceStub{}
	svc := &DocumentAppService{
		domainService:   &internalDocumentDomainServiceStub{showByCodeAndKBResult: doc},
		kbService:       &internalKnowledgeBaseReaderStub{showByCodeAndOrgResult: kb, effectiveModel: routeModel},
		fragmentService: fragmentStub,
		parseService:    parseSvc,
		tokenizer:       tokenizerSvc,
		logger:          logging.New(),
	}

	parsedDocument, _, err := svc.parseDocumentContent(context.Background(), doc, nil, nil)
	if err != nil {
		t.Fatalf("parse document content: %v", err)
	}
	documentdomain.MergeParsedDocumentMeta(doc, parsedDocument)
	currentFragments, err := svc.buildFragments(context.Background(), doc, kb, parsedDocument, routeModel)
	if err != nil {
		t.Fatalf("build fragments: %v", err)
	}
	if len(currentFragments) != 1 {
		t.Fatalf("expected one fragment, got %d", len(currentFragments))
	}

	existing := *currentFragments[0]
	existing.ID = 41
	existing.SyncStatus = sharedentity.SyncStatusSynced
	fragmentStub.listByDocumentResult = []*fragmodel.KnowledgeBaseFragment{&existing}
	fragmentStub.existingPointIDs = map[string]struct{}{}

	if err := svc.Sync(context.Background(), &documentdomain.SyncDocumentInput{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		Code:              "DOC4",
		Mode:              syncModeResync,
		RebuildOverride: &knowledgeroute.RebuildOverride{
			TargetCollection: "magic_knowledge",
			TargetModel:      routeModel,
		},
	}); err != nil {
		t.Fatalf("sync resync with rebuild override: %v", err)
	}
	if fragmentStub.updateBatchCalls != 1 || fragmentStub.lastUpdateBatchSize != 1 {
		t.Fatalf("expected missing point backfill to batch update unchanged fragment, got %#v", fragmentStub)
	}
	if fragmentStub.syncFragmentBatchCalls != 1 || fragmentStub.lastSyncBatchSize != 1 {
		t.Fatalf("expected missing point backfill to sync unchanged fragment, got %#v", fragmentStub)
	}
	if fragmentStub.lastSaveBatchSize != 0 {
		t.Fatalf("expected rebuild resync not to pre-save duplicate fragments, got %#v", fragmentStub)
	}
	if fragmentStub.listExistingPointIDsCalls != 1 {
		t.Fatalf("expected rebuild resync to query existing point ids, got %#v", fragmentStub)
	}
}

func assertDocumentAppServiceSyncResyncForceBackfillsUnchangedFragmentsWhenPointMissing(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	doc := &docentity.KnowledgeBaseDocument{
		Code:              "DOC4A",
		Name:              "Doc",
		DocType:           int(docentity.DocumentInputKindFile),
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentFile:      &docentity.File{Name: "doc.md", URL: "https://example.com/doc.md"},
	}
	kb := &kbentity.KnowledgeBase{Code: "KB1", Model: routeModel}
	parseSvc := &internalParseServiceStub{
		parseDocumentResult: parseddocument.NewPlainTextParsedDocument("md", "alpha"),
	}
	callOrder := make([]string, 0, 6)
	fragmentStub := &internalFragmentDocumentServiceStub{callOrder: &callOrder}
	kbStub := &internalKnowledgeBaseReaderStub{
		showByCodeAndOrgResult: kb,
		effectiveModel:         routeModel,
		callOrder:              &callOrder,
	}
	svc := &DocumentAppService{
		domainService:   &internalDocumentDomainServiceStub{showByCodeAndKBResult: doc},
		kbService:       kbStub,
		fragmentService: fragmentStub,
		parseService:    parseSvc,
		tokenizer:       tokenizerSvc,
		logger:          logging.New(),
	}

	parsedDocument, _, err := svc.parseDocumentContent(context.Background(), doc, nil, nil)
	if err != nil {
		t.Fatalf("parse document content: %v", err)
	}
	documentdomain.MergeParsedDocumentMeta(doc, parsedDocument)
	currentFragments, err := svc.buildFragments(context.Background(), doc, kb, parsedDocument, routeModel)
	if err != nil {
		t.Fatalf("build fragments: %v", err)
	}
	if len(currentFragments) != 1 {
		t.Fatalf("expected one fragment, got %d", len(currentFragments))
	}

	existing := *currentFragments[0]
	existing.ID = 410
	existing.SyncStatus = sharedentity.SyncStatusSynced
	fragmentStub.listByDocumentResult = []*fragmodel.KnowledgeBaseFragment{&existing}
	fragmentStub.existingPointIDs = map[string]struct{}{}

	if err := svc.Sync(context.Background(), &documentdomain.SyncDocumentInput{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		Code:              "DOC4A",
		Mode:              syncModeResync,
	}); err != nil {
		t.Fatalf("sync resync with missing point: %v", err)
	}
	if fragmentStub.updateBatchCalls != 1 || fragmentStub.lastUpdateBatchSize != 1 {
		t.Fatalf("expected missing point backfill to batch update unchanged fragment during resync, got %#v", fragmentStub)
	}
	if fragmentStub.syncFragmentBatchCalls != 1 || fragmentStub.lastSyncBatchSize != 1 {
		t.Fatalf("expected missing point backfill to sync unchanged fragment during resync, got %#v", fragmentStub)
	}
	if fragmentStub.lastSaveBatchSize != 0 {
		t.Fatalf("expected resync not to pre-save duplicate fragments, got %#v", fragmentStub)
	}
	if fragmentStub.listExistingPointIDsCalls != 1 {
		t.Fatalf("expected resync to query existing point ids, got %#v", fragmentStub)
	}
	if kbStub.ensureCollectionExistsCalls != 1 ||
		kbStub.lastEnsuredKnowledgeBase == nil ||
		kbStub.lastEnsuredKnowledgeBase.Code != kb.Code ||
		kbStub.lastEnsuredKnowledgeBase.ResolvedRoute == nil ||
		kbStub.lastEnsuredKnowledgeBase.ResolvedRoute.Model != routeModel {
		t.Fatalf("expected resync to ensure runtime collection once, got %#v", kbStub)
	}
	if got := strings.Join(callOrder, ","); got != "ensure_collection_exists,list_existing_point_ids,update_batch,save_batch,sync_fragment_batch" {
		t.Fatalf("expected ensure before missing-point backfill resync flow, got %q", got)
	}
}

func assertDocumentAppServiceSyncResyncWithRebuildOverrideSkipsUnchangedFragmentsWhenPointAlreadyExists(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	doc := &docentity.KnowledgeBaseDocument{
		Code:              "DOC5",
		Name:              "Doc",
		DocType:           int(docentity.DocumentInputKindFile),
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentFile:      &docentity.File{Name: "doc.md", URL: "https://example.com/doc.md"},
	}
	kb := &kbentity.KnowledgeBase{Code: "KB1", Model: routeModel}
	parseSvc := &internalParseServiceStub{
		parseDocumentResult: parseddocument.NewPlainTextParsedDocument("md", "alpha"),
	}
	fragmentStub := &internalFragmentDocumentServiceStub{}
	svc := &DocumentAppService{
		domainService:   &internalDocumentDomainServiceStub{showByCodeAndKBResult: doc},
		kbService:       &internalKnowledgeBaseReaderStub{showByCodeAndOrgResult: kb, effectiveModel: routeModel},
		fragmentService: fragmentStub,
		parseService:    parseSvc,
		tokenizer:       tokenizerSvc,
		logger:          logging.New(),
	}

	parsedDocument, _, err := svc.parseDocumentContent(context.Background(), doc, nil, nil)
	if err != nil {
		t.Fatalf("parse document content: %v", err)
	}
	documentdomain.MergeParsedDocumentMeta(doc, parsedDocument)
	currentFragments, err := svc.buildFragments(context.Background(), doc, kb, parsedDocument, routeModel)
	if err != nil {
		t.Fatalf("build fragments: %v", err)
	}
	if len(currentFragments) != 1 {
		t.Fatalf("expected one fragment, got %d", len(currentFragments))
	}

	existing := *currentFragments[0]
	existing.ID = 42
	existing.SyncStatus = sharedentity.SyncStatusSynced
	fragmentStub.listByDocumentResult = []*fragmodel.KnowledgeBaseFragment{&existing}
	fragmentStub.existingPointIDs = map[string]struct{}{
		existing.PointID: {},
	}

	if err := svc.Sync(context.Background(), &documentdomain.SyncDocumentInput{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		Code:              "DOC5",
		Mode:              syncModeResync,
		RebuildOverride: &knowledgeroute.RebuildOverride{
			TargetCollection: "magic_knowledge",
			TargetModel:      routeModel,
		},
	}); err != nil {
		t.Fatalf("sync resync with existing point: %v", err)
	}
	if fragmentStub.updateBatchCalls != 1 || fragmentStub.lastUpdateBatchSize != 0 {
		t.Fatalf("expected existing points to skip batch updates, got %#v", fragmentStub)
	}
	if fragmentStub.syncFragmentBatchCalls != 1 || fragmentStub.lastSyncBatchSize != 0 {
		t.Fatalf("expected existing points to skip vector sync, got %#v", fragmentStub)
	}
	if fragmentStub.listExistingPointIDsCalls != 1 {
		t.Fatalf("expected rebuild resync to query existing point ids once, got %#v", fragmentStub)
	}
}

func assertDocumentAppServiceSyncUsesRuntimeKnowledgeBaseCopyForResolvedRoute(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	const (
		activeModel          = "active-model"
		shadowCollection     = "magic_knowledge_shadow"
		shadowTermCollection = "magic_knowledge_shadow_terms"
	)

	doc := &docentity.KnowledgeBaseDocument{
		Code:              "DOC-RUNTIME-KB",
		Name:              "Doc",
		DocType:           int(docentity.DocumentInputKindFile),
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentFile:      &docentity.File{Name: "doc.md", URL: "https://example.com/doc.md"},
	}
	kb := &kbentity.KnowledgeBase{
		Code:  "KB1",
		Model: activeModel,
		EmbeddingConfig: &shared.EmbeddingConfig{
			ModelID: activeModel,
		},
	}
	fragmentStub := &internalFragmentDocumentServiceStub{}
	svc := &DocumentAppService{
		domainService: &internalDocumentDomainServiceStub{showByCodeAndKBResult: doc},
		kbService: &internalKnowledgeBaseReaderStub{
			showByCodeAndOrgResult:  kb,
			effectiveModel:          routeModel,
			effectiveCollection:     shadowCollection,
			effectiveTermCollection: shadowTermCollection,
			effectiveSparseBackend:  shared.SparseBackendQdrantBM25ZHV1,
		},
		fragmentService: fragmentStub,
		parseService:    &internalParseServiceStub{parseDocumentResult: parseddocument.NewPlainTextParsedDocument("md", "alpha")},
		tokenizer:       tokenizerSvc,
		logger:          logging.New(),
	}

	if err := svc.Sync(context.Background(), &documentdomain.SyncDocumentInput{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		Code:              "DOC-RUNTIME-KB",
		Mode:              syncModeCreate,
	}); err != nil {
		t.Fatalf("sync with runtime kb copy: %v", err)
	}
	if fragmentStub.syncFragmentBatchCalls != 1 {
		t.Fatalf("expected fragment sync to run once, got %#v", fragmentStub)
	}
	if fragmentStub.lastSyncKnowledgeBase == nil || fragmentStub.lastSyncKnowledgeBase.ResolvedRoute == nil {
		t.Fatalf("expected fragment sync to receive resolved route, got %#v", fragmentStub.lastSyncKnowledgeBase)
	}
	if fragmentStub.lastSyncKnowledgeBase.ResolvedRoute.VectorCollectionName != shadowCollection {
		t.Fatalf("expected synced kb vector collection=%q, got %#v", shadowCollection, fragmentStub.lastSyncKnowledgeBase.ResolvedRoute)
	}
	if fragmentStub.lastSyncKnowledgeBase.ResolvedRoute.TermCollectionName != shadowTermCollection {
		t.Fatalf("expected synced kb term collection=%q, got %#v", shadowTermCollection, fragmentStub.lastSyncKnowledgeBase.ResolvedRoute)
	}
	if fragmentStub.lastSyncKnowledgeBase.Model != routeModel {
		t.Fatalf("expected synced kb model=%q, got %#v", routeModel, fragmentStub.lastSyncKnowledgeBase)
	}
	if fragmentStub.lastSyncKnowledgeBase.EmbeddingConfig == nil || fragmentStub.lastSyncKnowledgeBase.EmbeddingConfig.ModelID != routeModel {
		t.Fatalf("expected synced kb embedding config model=%q, got %#v", routeModel, fragmentStub.lastSyncKnowledgeBase.EmbeddingConfig)
	}
	if kb.ResolvedRoute != nil {
		t.Fatalf("expected original kb resolved route to stay nil, got %#v", kb.ResolvedRoute)
	}
	if kb.Model != activeModel {
		t.Fatalf("expected original kb model=%q, got %#v", activeModel, kb)
	}
	if kb.EmbeddingConfig == nil || kb.EmbeddingConfig.ModelID != activeModel {
		t.Fatalf("expected original kb embedding config model=%q, got %#v", activeModel, kb.EmbeddingConfig)
	}
}

func assertDocumentAppServiceSyncUsesSourceOverrideWithoutThirdPlatformResolve(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	doc := &docentity.KnowledgeBaseDocument{
		Code:              "DOC-SOURCE-OVERRIDE",
		Name:              "Doc",
		DocType:           int(docentity.DocumentInputKindFile),
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		ThirdPlatformType: "teamshare",
		ThirdFileID:       "FILE-1",
		DocumentFile:      &docentity.File{Type: docFileTypeThirdParty, ThirdID: "FILE-1", SourceType: "teamshare"},
	}
	kb := &kbentity.KnowledgeBase{Code: "KB1", Model: routeModel}
	fragmentStub := &internalFragmentDocumentServiceStub{}
	portStub := &internalThirdPlatformDocumentPortStub{err: errThirdPlatformResolveBoom}
	svc := &DocumentAppService{
		domainService:             &internalDocumentDomainServiceStub{showByCodeAndKBResult: doc},
		kbService:                 &internalKnowledgeBaseReaderStub{showByCodeAndOrgResult: kb, effectiveModel: routeModel},
		fragmentService:           fragmentStub,
		thirdPlatformDocumentPort: portStub,
		tokenizer:                 tokenizerSvc,
		logger:                    logging.New(),
	}

	err := svc.Sync(context.Background(), &documentdomain.SyncDocumentInput{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		Code:              "DOC-SOURCE-OVERRIDE",
		Mode:              syncModeResync,
		SourceOverride: &documentdomain.SourceOverride{
			Content: "override content",
			DocType: int(docentity.DocumentInputKindText),
			DocumentFile: map[string]any{
				"type":          docFileTypeThirdParty,
				"name":          "doc.md",
				"extension":     "md",
				"third_file_id": "FILE-1",
				"source_type":   "teamshare",
			},
		},
	})
	if err != nil {
		t.Fatalf("sync with source override: %v", err)
	}
	if portStub.lastInput != nil {
		t.Fatalf("expected source override to skip third-platform resolve, got %#v", portStub.lastInput)
	}
	if fragmentStub.syncFragmentBatchCalls != 1 {
		t.Fatalf("expected source override to continue sync flow, got %#v", fragmentStub)
	}
	if doc.DocType != int(docentity.DocumentInputKindText) || doc.DocumentFile == nil || doc.DocumentFile.Extension != "md" {
		t.Fatalf("expected document metadata to be updated by source override, got %#v", doc)
	}
}

func assertDocumentAppServiceSyncUsesStructuredSourceOverrideForTabularSplit(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	doc := newStructuredSourceOverrideTestDocument()
	kb := &kbentity.KnowledgeBase{Code: "KB1", Model: routeModel}
	fragmentStub := &internalFragmentDocumentServiceStub{}
	portStub := &internalThirdPlatformDocumentPortStub{err: errThirdPlatformResolveBoom}
	svc := &DocumentAppService{
		domainService:             &internalDocumentDomainServiceStub{showByCodeAndKBResult: doc},
		kbService:                 &internalKnowledgeBaseReaderStub{showByCodeAndOrgResult: kb, effectiveModel: routeModel},
		fragmentService:           fragmentStub,
		thirdPlatformDocumentPort: portStub,
		tokenizer:                 tokenizerSvc,
		logger:                    logging.New(),
	}

	err := svc.Sync(context.Background(), &documentdomain.SyncDocumentInput{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		Code:              "DOC-TABULAR-OVERRIDE",
		Mode:              syncModeResync,
		SourceOverride:    newStructuredTabularSourceOverrideForTest(),
	})
	if err != nil {
		t.Fatalf("sync with structured source override: %v", err)
	}
	if portStub.lastInput != nil {
		t.Fatalf("expected structured source override to skip third-platform resolve, got %#v", portStub.lastInput)
	}
	if fragmentStub.syncFragmentBatchCalls != 1 {
		t.Fatalf("expected structured source override to continue sync flow, got %#v", fragmentStub)
	}
	if fragmentStub.lastSyncBatchSize != 2 {
		t.Fatalf("expected tabular structured split to produce 2 fragments, got %#v", fragmentStub)
	}
}

func newStructuredSourceOverrideTestDocument() *docentity.KnowledgeBaseDocument {
	return &docentity.KnowledgeBaseDocument{
		Code:              "DOC-TABULAR-OVERRIDE",
		Name:              "Doc",
		DocType:           int(docentity.DocumentInputKindFile),
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		ThirdPlatformType: "teamshare",
		ThirdFileID:       "FILE-1",
		DocumentFile:      &docentity.File{Type: docFileTypeThirdParty, ThirdID: "FILE-1", SourceType: "teamshare"},
	}
}

func newStructuredTabularSourceOverrideForTest() *documentdomain.SourceOverride {
	return &documentdomain.SourceOverride{
		Content: "plain fallback should not be used",
		DocType: int(docentity.DocumentInputKindFile),
		DocumentFile: map[string]any{
			"type":          docFileTypeThirdParty,
			"name":          "rag.xlsx",
			"extension":     "xlsx",
			"third_file_id": "FILE-1",
			"source_type":   "teamshare",
		},
		ParsedDocument: &parseddocument.ParsedDocument{
			SourceType: parseddocument.SourceTabular,
			Blocks: []parseddocument.ParsedBlock{
				{
					Type:    parseddocument.BlockTypeTableRow,
					Content: "row-1",
					Metadata: map[string]any{
						parseddocument.MetaSheetName:  "sheet-1",
						parseddocument.MetaTableTitle: "table-1",
						parseddocument.MetaRowIndex:   2,
						parseddocument.MetaFields: []map[string]any{
							{"header": "门店编码", "value": "V90901"},
							{"header": "门店名称", "value": "博乐友好时尚购物中心KKV店"},
						},
					},
				},
				{
					Type:    parseddocument.BlockTypeTableRow,
					Content: "row-2",
					Metadata: map[string]any{
						parseddocument.MetaSheetName:  "sheet-1",
						parseddocument.MetaTableTitle: "table-1",
						parseddocument.MetaRowIndex:   3,
						parseddocument.MetaFields: []map[string]any{
							{"header": "门店编码", "value": "T909001"},
							{"header": "门店名称", "value": "博乐友好时尚购物中心TC店"},
						},
					},
				},
			},
		},
	}
}

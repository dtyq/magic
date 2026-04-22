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
	documentdomain "magic/internal/domain/knowledge/document/service"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
	sharedentity "magic/internal/domain/knowledge/shared/entity"
	sharedroute "magic/internal/domain/knowledge/shared/route"
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
)

const routeModel = "route-model"

type internalDocumentDomainServiceStub struct {
	showResult            *documentdomain.KnowledgeBaseDocument
	showByCodeAndKBResult *documentdomain.KnowledgeBaseDocument
	updateCalls           int
	updateErr             error
	lastUpdatedDoc        *documentdomain.KnowledgeBaseDocument
	increaseVersionRows   int64
	increaseVersionErr    error
}

func (s *internalDocumentDomainServiceStub) Save(context.Context, *documentdomain.KnowledgeBaseDocument) error {
	return nil
}

func (s *internalDocumentDomainServiceStub) Update(context.Context, *documentdomain.KnowledgeBaseDocument) error {
	s.updateCalls++
	if s.showResult != nil {
		s.lastUpdatedDoc = s.showResult
	}
	if s.showByCodeAndKBResult != nil {
		s.lastUpdatedDoc = s.showByCodeAndKBResult
	}
	return s.updateErr
}

func (s *internalDocumentDomainServiceStub) Show(context.Context, string) (*documentdomain.KnowledgeBaseDocument, error) {
	if s.showResult != nil {
		return s.showResult, nil
	}
	return nil, errInternalDocumentStubNotFound
}

func (s *internalDocumentDomainServiceStub) ShowByCodeAndKnowledgeBase(context.Context, string, string) (*documentdomain.KnowledgeBaseDocument, error) {
	if s.showByCodeAndKBResult != nil {
		return s.showByCodeAndKBResult, nil
	}
	return nil, errInternalDocumentStubNotFound
}

func (s *internalDocumentDomainServiceStub) FindByKnowledgeBaseAndThirdFile(context.Context, string, string, string) (*documentdomain.KnowledgeBaseDocument, error) {
	return nil, errInternalDocumentStubNotFound
}

func (s *internalDocumentDomainServiceStub) FindByKnowledgeBaseAndProjectFile(context.Context, string, int64) (*documentdomain.KnowledgeBaseDocument, error) {
	return nil, errInternalDocumentStubNotFound
}

func (s *internalDocumentDomainServiceStub) ResolveThirdFileDocumentPlan(context.Context, documentdomain.ThirdFileDocumentPlanInput) (documentdomain.ThirdFileDocumentPlan, error) {
	return documentdomain.ThirdFileDocumentPlan{}, errInternalDocumentStubNotFound
}

func (s *internalDocumentDomainServiceStub) ListByThirdFileInOrg(context.Context, string, string, string) ([]*documentdomain.KnowledgeBaseDocument, error) {
	return nil, nil
}

func (s *internalDocumentDomainServiceStub) ListByProjectFileInOrg(context.Context, string, int64) ([]*documentdomain.KnowledgeBaseDocument, error) {
	return nil, nil
}

func (s *internalDocumentDomainServiceStub) ListByKnowledgeBaseAndProject(context.Context, string, int64) ([]*documentdomain.KnowledgeBaseDocument, error) {
	return nil, nil
}

func (s *internalDocumentDomainServiceStub) List(context.Context, *documentdomain.Query) ([]*documentdomain.KnowledgeBaseDocument, int64, error) {
	return nil, 0, nil
}

func (s *internalDocumentDomainServiceStub) ListByKnowledgeBase(context.Context, string, int, int) ([]*documentdomain.KnowledgeBaseDocument, int64, error) {
	return nil, 0, nil
}

func (s *internalDocumentDomainServiceStub) CountByKnowledgeBaseCodes(context.Context, string, []string) (map[string]int64, error) {
	return nil, errInternalDocumentStubNotFound
}

func (s *internalDocumentDomainServiceStub) Delete(context.Context, int64) error {
	return nil
}

func (s *internalDocumentDomainServiceStub) UpdateSyncStatus(context.Context, *documentdomain.KnowledgeBaseDocument) error {
	return nil
}

func (s *internalDocumentDomainServiceStub) MarkSyncing(ctx context.Context, doc *documentdomain.KnowledgeBaseDocument) error {
	doc.MarkSyncing()
	return s.Update(ctx, doc)
}

func (s *internalDocumentDomainServiceStub) MarkSynced(ctx context.Context, doc *documentdomain.KnowledgeBaseDocument, wordCount int) error {
	doc.MarkSynced(wordCount)
	return s.Update(ctx, doc)
}

func (s *internalDocumentDomainServiceStub) MarkSyncedWithContent(ctx context.Context, doc *documentdomain.KnowledgeBaseDocument, content string) error {
	return s.MarkSynced(ctx, doc, len([]rune(content)))
}

func (s *internalDocumentDomainServiceStub) MarkSyncFailed(ctx context.Context, doc *documentdomain.KnowledgeBaseDocument, message string) error {
	doc.MarkSyncFailed(message)
	return s.Update(ctx, doc)
}

func (s *internalDocumentDomainServiceStub) MarkSyncFailedWithError(
	ctx context.Context,
	doc *documentdomain.KnowledgeBaseDocument,
	reason string,
	err error,
) error {
	return s.MarkSyncFailed(ctx, doc, documentdomain.BuildSyncFailureMessage(reason, err))
}

func (s *internalDocumentDomainServiceStub) IncreaseVersion(context.Context, *documentdomain.KnowledgeBaseDocument) (int64, error) {
	return s.increaseVersionRows, s.increaseVersionErr
}

type internalParseServiceStub struct {
	parseDocumentResult           *documentdomain.ParsedDocument
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

func (s *internalParseServiceStub) ParseDocument(context.Context, string, string) (*documentdomain.ParsedDocument, error) {
	if s.parseDocumentErr != nil {
		return nil, s.parseDocumentErr
	}
	if s.parseDocumentResult != nil {
		return s.parseDocumentResult, nil
	}
	return documentdomain.NewPlainTextParsedDocument("txt", "default"), nil
}

func (s *internalParseServiceStub) ParseDocumentWithOptions(
	ctx context.Context,
	rawURL string,
	ext string,
	options documentdomain.ParseOptions,
) (*documentdomain.ParsedDocument, error) {
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
) (*documentdomain.ParsedDocument, error) {
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
	return documentdomain.NewPlainTextParsedDocument(fileType, s.lastReaderContent), nil
}

func (s *internalParseServiceStub) ResolveFileType(_ context.Context, target string) (string, error) {
	s.lastResolveTarget = target
	if s.resolveFileTypeErr != nil {
		return "", s.resolveFileTypeErr
	}
	return s.resolveFileType, nil
}

type internalThirdPlatformDocumentPortStub struct {
	content     string
	rawContent  string
	sourceKind  string
	downloadURL string
	docType     int
	file        map[string]any
	err         error
	lastInput   map[string]any
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
	lastSyncKnowledgeBase       *knowledgebase.KnowledgeBase
	lastPointID                 string
	lastListedPointIDs          []string
	listResult                  []*fragmodel.KnowledgeBaseFragment
	listTotal                   int64
	listErr                     error
	listByDocumentResult        []*fragmodel.KnowledgeBaseFragment
	existingPointIDs            map[string]struct{}
}

func (s *internalFragmentDocumentServiceStub) SaveBatch(_ context.Context, fragments []*fragmodel.KnowledgeBaseFragment) error {
	s.saveBatchCalls++
	s.lastSaveBatchSize = len(fragments)
	return nil
}

func (s *internalFragmentDocumentServiceStub) Update(context.Context, *fragmodel.KnowledgeBaseFragment) error {
	s.updateCalls++
	return nil
}

func (s *internalFragmentDocumentServiceStub) UpdateBatch(_ context.Context, fragments []*fragmodel.KnowledgeBaseFragment) error {
	s.updateBatchCalls++
	s.lastUpdateBatchSize = len(fragments)
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

func (s *internalFragmentDocumentServiceStub) ListExistingPointIDs(_ context.Context, collectionName string, pointIDs []string) (map[string]struct{}, error) {
	s.listExistingPointIDsCalls++
	s.lastCollectionName = collectionName
	s.lastListedPointIDs = append([]string(nil), pointIDs...)
	result := make(map[string]struct{}, len(s.existingPointIDs))
	for pointID := range s.existingPointIDs {
		result[pointID] = struct{}{}
	}
	return result, nil
}

func (s *internalFragmentDocumentServiceStub) SyncFragmentBatch(
	_ context.Context,
	kb any,
	fragments []*fragmodel.KnowledgeBaseFragment,
	_ *ctxmeta.BusinessParams,
) error {
	s.syncFragmentBatchCalls++
	s.lastSyncBatchSize = len(fragments)
	if typedKB, ok := kb.(*knowledgebase.KnowledgeBase); ok {
		s.lastSyncKnowledgeBase = typedKB
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
	showByCodeAndOrgResult  *knowledgebase.KnowledgeBase
	listResult              []*knowledgebase.KnowledgeBase
	listTotal               int64
	listErr                 error
	lastListQuery           *knowledgebase.Query
	effectiveModel          string
	effectiveCollection     string
	effectiveTermCollection string
	effectiveSparseBackend  string
}

func (s *internalKnowledgeBaseReaderStub) ShowByCodeAndOrg(context.Context, string, string) (*knowledgebase.KnowledgeBase, error) {
	return s.showByCodeAndOrgResult, nil
}

func (s *internalKnowledgeBaseReaderStub) Show(context.Context, string) (*knowledgebase.KnowledgeBase, error) {
	return s.showByCodeAndOrgResult, nil
}

func (s *internalKnowledgeBaseReaderStub) List(_ context.Context, query *knowledgebase.Query) ([]*knowledgebase.KnowledgeBase, int64, error) {
	s.lastListQuery = query
	return s.listResult, s.listTotal, s.listErr
}

func (s *internalKnowledgeBaseReaderStub) ResolveRuntimeRoute(_ context.Context, kb *knowledgebase.KnowledgeBase) sharedroute.ResolvedRoute {
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
	if got := documentdomain.InferDocumentFileExtensionLight(&documentdomain.File{Name: "report.PDF"}); got != "pdf" {
		t.Fatalf("expected pdf from name, got %q", got)
	}
	if got := documentdomain.InferDocumentFileExtensionLight(&documentdomain.File{URL: "https://example.com/a.docx"}); got != "docx" {
		t.Fatalf("expected docx from url, got %q", got)
	}
	if got := documentdomain.InferDocumentFileExtensionLight(&documentdomain.File{FileKey: "ORG1/path/to/readme.md"}); got != "md" {
		t.Fatalf("expected md from file key, got %q", got)
	}

	svc := &DocumentAppService{
		parseService: &internalParseServiceStub{resolveFileType: "pptx"},
		logger:       logging.New(),
	}
	if _, err := svc.resolveDocumentFileExtension(context.Background(), nil); !errors.Is(err, errDocumentFileNil) {
		t.Fatalf("expected nil file error, got %v", err)
	}
	if _, err := svc.resolveDocumentFileExtension(context.Background(), &documentdomain.File{}); !errors.Is(err, errDocumentFileURLEmpty) {
		t.Fatalf("expected empty url error, got %v", err)
	}

	noParseSvc := &DocumentAppService{}
	if _, err := noParseSvc.resolveDocumentFileExtension(context.Background(), &documentdomain.File{URL: "https://example.com/a"}); !errors.Is(err, errDocumentParseNil) {
		t.Fatalf("expected nil parse error, got %v", err)
	}

	resolveErrSvc := &DocumentAppService{
		parseService: &internalParseServiceStub{resolveFileTypeErr: errResolveTypeFailed},
	}
	if _, err := resolveErrSvc.resolveDocumentFileExtension(context.Background(), &documentdomain.File{URL: "https://example.com/a"}); !errors.Is(err, errResolveTypeFailed) {
		t.Fatalf("expected wrapped resolve error, got %v", err)
	}

	docFromName := &documentdomain.KnowledgeBaseDocument{DocumentFile: &documentdomain.File{Name: "manual.md"}}
	svc.ensureDocumentFileExtensionForPersist(context.Background(), docFromName)
	if docFromName.DocumentFile.Extension != "md" {
		t.Fatalf("expected ext inferred from name, got %#v", docFromName.DocumentFile)
	}

	docFromResolver := &documentdomain.KnowledgeBaseDocument{
		DocumentFile: &documentdomain.File{URL: "https://example.com/no-ext"},
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
	projectDoc := &documentdomain.KnowledgeBaseDocument{
		DocumentFile: &documentdomain.File{
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

	dto := EntityToDTO(&documentdomain.KnowledgeBaseDocument{
		Code: "DOC-STORAGE-KEY",
		DocumentFile: &documentdomain.File{
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

	dto := EntityToDTO(&documentdomain.KnowledgeBaseDocument{
		Code: "DOC-REMOTE-URL",
		DocumentFile: &documentdomain.File{
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
		docType: int(documentdomain.DocTypeFile),
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
	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC1",
		Name:              "Doc",
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		ThirdPlatformType: "lark",
		ThirdFileID:       "third-2",
		UpdatedUID:        "U1",
		DocumentFile:      &documentdomain.File{Type: docFileTypeThirdParty},
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
	if doc.DocType != int(documentdomain.DocTypeFile) || doc.DocumentFile.URL != "https://example.com/resolved.md" {
		t.Fatalf("unexpected doc after resolve: %#v", doc)
	}
}

func TestDocumentAppServiceParseDocumentContentFallbackToURL(t *testing.T) {
	t.Parallel()

	svc := &DocumentAppService{
		domainService:             &internalDocumentDomainServiceStub{},
		parseService:              &internalParseServiceStub{parseDocumentResult: documentdomain.NewPlainTextParsedDocument("txt", "alpha\r\n\r\n\r\nbeta")},
		thirdPlatformDocumentPort: &internalThirdPlatformDocumentPortStub{err: errThirdPlatformResolveBoom},
		logger:                    logging.New(),
	}
	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC2",
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		ThirdFileID:       "third-3",
		DocumentFile:      &documentdomain.File{Type: docFileTypeThirdParty, URL: "https://example.com/doc.txt", Extension: "txt"},
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
		parseDocumentResult: documentdomain.NewPlainTextParsedDocument("md", "alpha"),
	}
	svc := &DocumentAppService{
		domainService: &internalDocumentDomainServiceStub{},
		parseService:  parseSvc,
		logger:        logging.New(),
	}
	doc := &documentdomain.KnowledgeBaseDocument{
		Code: "DOC-OPTIONS",
		DocMetadata: map[string]any{
			documentdomain.ParseStrategyConfigKey: map[string]any{
				"parsing_type":     documentdomain.ParsingTypeQuick,
				"image_extraction": true,
				"table_extraction": true,
				"image_ocr":        true,
			},
		},
		DocumentFile: &documentdomain.File{URL: "https://example.com/doc.md", Extension: "md"},
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
		parseDocumentResult: &documentdomain.ParsedDocument{
			SourceType: documentdomain.ParsedDocumentSourceTabular,
			PlainText: strings.Join([]string{
				"文件名: 1775908129904-0s6pzx-rag_.xlsx",
				"工作表: 截图数据",
				"表格: 截图数据 表1",
				"行号: 2",
				"门店编码：V90901",
			}, "\n"),
			Blocks: []documentdomain.ParsedBlock{
				{
					Type: documentdomain.ParsedBlockTypeTableRow,
					Content: strings.Join([]string{
						"文件名: 1775908129904-0s6pzx-rag_.xlsx",
						"工作表: 截图数据",
						"表格: 截图数据 表1",
						"行号: 2",
						"门店编码：V90901",
					}, "\n"),
					Metadata: map[string]any{
						documentdomain.ParsedMetaFileName:     "1775908129904-0s6pzx-rag_.xlsx",
						documentdomain.ParsedMetaSourceFormat: "xlsx",
						documentdomain.ParsedMetaSheetName:    "截图数据",
						documentdomain.ParsedMetaTableTitle:   "截图数据 表1",
						documentdomain.ParsedMetaRowIndex:     2,
						documentdomain.ParsedMetaFields: []map[string]any{
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
				documentdomain.ParsedMetaSourceFormat: "xlsx",
				documentdomain.ParsedMetaFileName:     "1775908129904-0s6pzx-rag_.xlsx",
			},
		},
	}
	svc := &DocumentAppService{
		domainService: &internalDocumentDomainServiceStub{},
		parseService:  parseSvc,
		logger:        logging.New(),
	}
	doc := &documentdomain.KnowledgeBaseDocument{
		Code: "DOC-TABULAR-NAME",
		DocumentFile: &documentdomain.File{
			Name:      "rag 门店数据验证.xlsx",
			URL:       "https://example.com/1775908129904-0s6pzx-rag_.xlsx",
			Extension: "xlsx",
		},
	}

	parsed, content, err := svc.parseDocumentContent(context.Background(), doc, nil, nil)
	if err != nil {
		t.Fatalf("parse tabular content: %v", err)
	}
	if got := parsed.DocumentMeta[documentdomain.ParsedMetaFileName]; got != "rag 门店数据验证.xlsx" {
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
		doc := &documentdomain.KnowledgeBaseDocument{
			Code:              "DOC3",
			OrganizationCode:  "ORG1",
			KnowledgeBaseCode: "KB1",
			ThirdFileID:       "third-4",
			DocumentFile:      &documentdomain.File{Type: docFileTypeThirdParty},
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
		doc := &documentdomain.KnowledgeBaseDocument{
			Code:         "DOC4",
			DocumentFile: &documentdomain.File{URL: "https://example.com/doc.txt", Extension: "txt"},
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

func TestDocumentAppServiceInputToEntityAndDTOWithContext(t *testing.T) {
	t.Parallel()

	kb := &knowledgebase.KnowledgeBase{
		Code:       "KB1",
		VectorDB:   "qdrant",
		Model:      "kb-model",
		CreatedUID: "U1",
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
		DocType:           int(documentdomain.DocTypeFile),
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

	t.Run("SyncCreateFlow", func(t *testing.T) {
		t.Parallel()
		assertDocumentAppServiceSyncCreateFlow(t, tokenizerSvc)
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
}

func TestEntityToDTOMapsTopLevelStrategyConfigFromMetadata(t *testing.T) {
	t.Parallel()

	dto := EntityToDTO(&documentdomain.KnowledgeBaseDocument{
		Code:              "DOC-STRATEGY",
		KnowledgeBaseCode: "KB1",
		DocType:           int(documentdomain.DocTypeFile),
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
		DocType:           int(documentdomain.DocTypeFile),
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

	kb := &knowledgebase.KnowledgeBase{
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
		&documentdomain.KnowledgeBaseDocument{
			Code:              "DOC1",
			Name:              "Doc",
			DocType:           int(documentdomain.DocTypeFile),
			DocMetadata:       map[string]any{"topic": "rag"},
			KnowledgeBaseCode: "KB1",
			OrganizationCode:  "ORG1",
			UpdatedUID:        "U1",
			DocumentFile:      &documentdomain.File{Extension: "md"},
		},
		kb,
		documentdomain.NewPlainTextParsedDocument("md", "第一段内容\n\n第二段内容"),
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
	cleanupDoc := &documentdomain.KnowledgeBaseDocument{
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

	kb := &knowledgebase.KnowledgeBase{
		Code: "KB-AUTO",
		FragmentConfig: &shared.FragmentConfig{
			Mode: shared.FragmentModeAuto,
			Hierarchy: &shared.HierarchyFragmentConfig{
				MaxLevel: 3,
			},
		},
	}
	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC-AUTO",
		Name:              "hierarchy.md",
		DocType:           int(documentdomain.DocTypeFile),
		DocMetadata:       map[string]any{"topic": "hierarchy"},
		KnowledgeBaseCode: "KB-AUTO",
		OrganizationCode:  "ORG1",
		UpdatedUID:        "U1",
		DocumentFile:      &documentdomain.File{Name: "hierarchy.md", Extension: "md"},
	}
	svc := &DocumentAppService{
		tokenizer: tokenizerSvc,
		logger:    logging.New(),
	}

	fragments, err := svc.buildFragments(
		context.Background(),
		doc,
		kb,
		documentdomain.NewPlainTextParsedDocument("md", "# 一级标题\n一级内容\n## 二级标题\n二级内容\n### 三级标题\n三级内容\n#### 四级标题\n四级内容\n##### 五级标题\n五级内容"),
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

	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC1",
		Name:              "Doc",
		DocType:           int(documentdomain.DocTypeFile),
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentFile:      &documentdomain.File{Name: "doc.md", URL: "https://example.com/doc.md"},
	}
	domainStub := &internalDocumentDomainServiceStub{showByCodeAndKBResult: doc}
	fragmentStub := &internalFragmentDocumentServiceStub{}
	kb := &knowledgebase.KnowledgeBase{Code: "KB1", Model: routeModel}
	svc := &DocumentAppService{
		domainService:   domainStub,
		kbService:       &internalKnowledgeBaseReaderStub{showByCodeAndOrgResult: kb, effectiveModel: routeModel},
		fragmentService: fragmentStub,
		parseService:    &internalParseServiceStub{parseDocumentResult: documentdomain.NewPlainTextParsedDocument("md", "第一段\n\n第二段")},
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
	if got := doc.DocMetadata[documentdomain.ParsedMetaSourceFormat]; got != "md" {
		t.Fatalf("expected parsed source format metadata merged, got %#v", doc.DocMetadata)
	}
}

func TestDocumentAppServiceSyncDoesNotSkipResyncWhenDocumentStatusIsSyncing(t *testing.T) {
	t.Parallel()

	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC2",
		Name:              "doc.md",
		DocType:           int(documentdomain.DocTypeFile),
		SyncStatus:        shared.SyncStatusSyncing,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentFile: &documentdomain.File{
			Name:      "doc.md",
			URL:       "https://example.com/doc.md",
			Extension: "md",
		},
	}
	parsed := documentdomain.NewPlainTextParsedDocument("md", "# title\n\nbody")
	domainStub := &internalDocumentDomainServiceStub{showByCodeAndKBResult: doc}
	fragmentStub := &internalFragmentDocumentServiceStub{}
	kb := &knowledgebase.KnowledgeBase{Code: "KB1", Model: routeModel}
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

	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC-META",
		Name:              "Doc",
		DocType:           int(documentdomain.DocTypeFile),
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocMetadata: map[string]any{
			"source":      "knowledge-demo",
			"source_type": "local_upload",
		},
		DocumentFile: &documentdomain.File{Name: "doc.docx", URL: "https://example.com/doc.docx", Extension: "docx"},
	}
	parsed := documentdomain.NewPlainTextParsedDocument("docx", "alpha\n\n图片OCR：beta")
	parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageCount] = 2
	parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRSuccessCount] = 2
	parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRFailedCount] = 0
	parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRSkippedCount] = 0

	domainStub := &internalDocumentDomainServiceStub{showByCodeAndKBResult: doc}
	fragmentStub := &internalFragmentDocumentServiceStub{}
	kb := &knowledgebase.KnowledgeBase{Code: "KB1", Model: routeModel}
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
	if got := doc.DocMetadata[documentdomain.ParsedMetaEmbeddedImageCount]; got != 2 {
		t.Fatalf("expected embedded image count merged, got %#v", doc.DocMetadata)
	}
	if got := doc.DocMetadata[documentdomain.ParsedMetaEmbeddedImageOCRSuccessCount]; got != 2 {
		t.Fatalf("expected embedded image ocr success merged, got %#v", doc.DocMetadata)
	}
}

func assertDocumentAppServiceSyncDoesNotSkipDuplicatedResyncDuringRebuildOverride(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC2B",
		Name:              "Doc",
		DocType:           int(documentdomain.DocTypeFile),
		SyncStatus:        shared.SyncStatusSyncing,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentFile:      &documentdomain.File{Name: "doc.md", URL: "https://example.com/doc.md"},
	}
	kb := &knowledgebase.KnowledgeBase{Code: "KB1", Model: routeModel}
	domainStub := &internalDocumentDomainServiceStub{showByCodeAndKBResult: doc}
	fragmentStub := &internalFragmentDocumentServiceStub{}
	svc := &DocumentAppService{
		domainService:   domainStub,
		kbService:       &internalKnowledgeBaseReaderStub{showByCodeAndOrgResult: kb, effectiveModel: routeModel},
		fragmentService: fragmentStub,
		parseService: &internalParseServiceStub{
			parseDocumentResult: documentdomain.NewPlainTextParsedDocument("md", "alpha"),
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

	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC3",
		Name:              "Doc",
		DocType:           int(documentdomain.DocTypeFile),
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentFile:      &documentdomain.File{Name: "doc.md", URL: "https://example.com/doc.md"},
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
	kb := &knowledgebase.KnowledgeBase{Code: "KB1", Model: routeModel}
	svc := &DocumentAppService{
		domainService:   domainStub,
		kbService:       &internalKnowledgeBaseReaderStub{showByCodeAndOrgResult: kb, effectiveModel: routeModel},
		fragmentService: fragmentStub,
		parseService:    &internalParseServiceStub{parseDocumentResult: documentdomain.NewPlainTextParsedDocument("md", "alpha")},
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

	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC4",
		Name:              "Doc",
		DocType:           int(documentdomain.DocTypeFile),
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentFile:      &documentdomain.File{Name: "doc.md", URL: "https://example.com/doc.md"},
	}
	kb := &knowledgebase.KnowledgeBase{Code: "KB1", Model: routeModel}
	parseSvc := &internalParseServiceStub{
		parseDocumentResult: documentdomain.NewPlainTextParsedDocument("md", "alpha"),
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

	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC4A",
		Name:              "Doc",
		DocType:           int(documentdomain.DocTypeFile),
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentFile:      &documentdomain.File{Name: "doc.md", URL: "https://example.com/doc.md"},
	}
	kb := &knowledgebase.KnowledgeBase{Code: "KB1", Model: routeModel}
	parseSvc := &internalParseServiceStub{
		parseDocumentResult: documentdomain.NewPlainTextParsedDocument("md", "alpha"),
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
}

func assertDocumentAppServiceSyncResyncWithRebuildOverrideSkipsUnchangedFragmentsWhenPointAlreadyExists(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC5",
		Name:              "Doc",
		DocType:           int(documentdomain.DocTypeFile),
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentFile:      &documentdomain.File{Name: "doc.md", URL: "https://example.com/doc.md"},
	}
	kb := &knowledgebase.KnowledgeBase{Code: "KB1", Model: routeModel}
	parseSvc := &internalParseServiceStub{
		parseDocumentResult: documentdomain.NewPlainTextParsedDocument("md", "alpha"),
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

	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC-RUNTIME-KB",
		Name:              "Doc",
		DocType:           int(documentdomain.DocTypeFile),
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentFile:      &documentdomain.File{Name: "doc.md", URL: "https://example.com/doc.md"},
	}
	kb := &knowledgebase.KnowledgeBase{
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
		parseService:    &internalParseServiceStub{parseDocumentResult: documentdomain.NewPlainTextParsedDocument("md", "alpha")},
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

	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC-SOURCE-OVERRIDE",
		Name:              "Doc",
		DocType:           int(documentdomain.DocTypeFile),
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		ThirdPlatformType: "teamshare",
		ThirdFileID:       "FILE-1",
		DocumentFile:      &documentdomain.File{Type: docFileTypeThirdParty, ThirdID: "FILE-1", SourceType: "teamshare"},
	}
	kb := &knowledgebase.KnowledgeBase{Code: "KB1", Model: routeModel}
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
			DocType: int(documentdomain.DocTypeText),
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
	if doc.DocType != int(documentdomain.DocTypeText) || doc.DocumentFile == nil || doc.DocumentFile.Extension != "md" {
		t.Fatalf("expected document metadata to be updated by source override, got %#v", doc)
	}
}

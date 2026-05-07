package docapp

import (
	"context"
	"fmt"
	"maps"
	"strings"
	"testing"

	docdto "magic/internal/application/knowledge/document/dto"
	revectorizeshared "magic/internal/application/knowledge/shared/revectorize"
	kbaccess "magic/internal/domain/knowledge/access/service"
	docentity "magic/internal/domain/knowledge/document/entity"
	docrepo "magic/internal/domain/knowledge/document/repository"
	documentdomain "magic/internal/domain/knowledge/document/service"
	documentsplitter "magic/internal/domain/knowledge/document/splitter"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	"magic/internal/domain/knowledge/shared"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/pkg/tokenizer"
)

func testTokenizerService() *tokenizer.Service {
	return tokenizer.NewService()
}

func ensureTokenizerServiceForTest(svc *tokenizer.Service) *tokenizer.Service {
	if svc != nil {
		return svc
	}
	return testTokenizerService()
}

type defaultKnowledgeBaseReaderForTest struct{}

func (defaultKnowledgeBaseReaderForTest) ShowByCodeAndOrg(_ context.Context, code, orgCode string) (*kbentity.KnowledgeBase, error) {
	return &kbentity.KnowledgeBase{
		Code:             code,
		OrganizationCode: orgCode,
		Model:            "text-embedding-3-small",
	}, nil
}

func (defaultKnowledgeBaseReaderForTest) Show(_ context.Context, code string) (*kbentity.KnowledgeBase, error) {
	return &kbentity.KnowledgeBase{
		Code:  code,
		Model: "text-embedding-3-small",
	}, nil
}

func (defaultKnowledgeBaseReaderForTest) List(_ context.Context, query *kbrepository.Query) ([]*kbentity.KnowledgeBase, int64, error) {
	if query == nil || len(query.Codes) == 0 {
		return nil, 0, nil
	}
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

func (defaultKnowledgeBaseReaderForTest) ResolveRuntimeRoute(_ context.Context, kb *kbentity.KnowledgeBase) sharedroute.ResolvedRoute {
	collectionName := ""
	model := "text-embedding-3-small"
	if kb != nil {
		collectionName = kb.CollectionName()
		if strings.TrimSpace(kb.Model) != "" {
			model = strings.TrimSpace(kb.Model)
		}
	}
	return sharedroute.ResolvedRoute{
		LogicalCollectionName:  collectionName,
		PhysicalCollectionName: collectionName,
		VectorCollectionName:   collectionName,
		TermCollectionName:     collectionName,
		Model:                  model,
	}
}

func (defaultKnowledgeBaseReaderForTest) EnsureCollectionExists(context.Context, *kbentity.KnowledgeBase) error {
	return nil
}

func (defaultKnowledgeBaseReaderForTest) UpdateProgress(context.Context, *kbentity.KnowledgeBase) error {
	return nil
}

// PreviewSegmentConfigForTest 暴露给测试的切片配置。
type PreviewSegmentConfigForTest struct {
	ChunkSize          int
	ChunkOverlap       int
	Separator          string
	TextPreprocessRule []int
}

// TokenChunkForTest 暴露给测试的切片结果。
type TokenChunkForTest struct {
	Content            string
	TokenCount         int
	SectionPath        string
	SectionLevel       int
	SectionTitle       string
	TreeNodeID         string
	ParentNodeID       string
	SectionChunkIndex  int
	EffectiveSplitMode string
	HierarchyDetector  string
	Metadata           map[string]any
}

// FragmentResyncPlanForTest 暴露给外部测试的增量重同步结果。
type FragmentResyncPlanForTest struct {
	Changed         []*fragmodel.KnowledgeBaseFragment
	Added           []*fragmodel.KnowledgeBaseFragment
	Deleted         []*fragmodel.KnowledgeBaseFragment
	Unchanged       []*fragmodel.KnowledgeBaseFragment
	RekeyedPointIDs []string
}

// SplitContentWithEffectiveModePipelineForTestInput 描述自动切片测试输入。
type SplitContentWithEffectiveModePipelineForTestInput struct {
	Content        string
	SourceFileType string
	RequestedMode  shared.FragmentMode
	FragmentConfig *shared.FragmentConfig
	SegmentConfig  PreviewSegmentConfigForTest
	Model          string
}

// SplitParsedDocumentToChunksForTestInput 描述解析文档切片测试输入。
type SplitParsedDocumentToChunksForTestInput struct {
	ParsedDocument *parseddocument.ParsedDocument
	SourceFileType string
	RequestedMode  shared.FragmentMode
	FragmentConfig *shared.FragmentConfig
	SegmentConfig  PreviewSegmentConfigForTest
	Model          string
}

type legacyDocumentWriteService interface {
	Save(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error
	Update(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error
	Delete(ctx context.Context, id int64) error
	UpdateSyncStatus(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error
}

type legacyDocumentLookupService interface {
	Show(ctx context.Context, code string) (*docentity.KnowledgeBaseDocument, error)
	ShowByCodeAndKnowledgeBase(ctx context.Context, code, knowledgeBaseCode string) (*docentity.KnowledgeBaseDocument, error)
	FindByKnowledgeBaseAndThirdFile(ctx context.Context, knowledgeBaseCode, thirdPlatformType, thirdFileID string) (*docentity.KnowledgeBaseDocument, error)
	FindByKnowledgeBaseAndProjectFile(ctx context.Context, knowledgeBaseCode string, projectFileID int64) (*docentity.KnowledgeBaseDocument, error)
	ListByThirdFileInOrg(ctx context.Context, organizationCode, thirdPlatformType, thirdFileID string) ([]*docentity.KnowledgeBaseDocument, error)
	ListByProjectFileInOrg(ctx context.Context, organizationCode string, projectFileID int64) ([]*docentity.KnowledgeBaseDocument, error)
	ListByKnowledgeBaseAndProject(ctx context.Context, knowledgeBaseCode string, projectID int64) ([]*docentity.KnowledgeBaseDocument, error)
}

type legacyDocumentQueryService interface {
	List(ctx context.Context, query *docrepo.DocumentQuery) ([]*docentity.KnowledgeBaseDocument, int64, error)
	CountByKnowledgeBaseCodes(ctx context.Context, organizationCode string, knowledgeBaseCodes []string) (map[string]int64, error)
}

// KnowledgeBaseSnapshotFromDomainForTest 供测试验证知识库快照隔离。
func KnowledgeBaseSnapshotFromDomainForTest(kb *kbentity.KnowledgeBase) *sharedsnapshot.KnowledgeBaseRuntimeSnapshot {
	return knowledgeBaseSnapshotFromDomain(kb)
}

// FragDocumentFromDomainForTest 供测试验证文档投影隔离。
func FragDocumentFromDomainForTest(doc *docentity.KnowledgeBaseDocument) *fragmodel.KnowledgeBaseDocument {
	return fragDocumentFromDomain(doc)
}

type documentDomainServiceCompat struct {
	writer legacyDocumentWriteService
	lookup legacyDocumentLookupService
	query  legacyDocumentQueryService
}

func newDocumentDomainServiceCompat(legacy any) (documentDomainServiceCompat, bool) {
	writer, ok := legacy.(legacyDocumentWriteService)
	if !ok {
		return documentDomainServiceCompat{}, false
	}
	lookup, ok := legacy.(legacyDocumentLookupService)
	if !ok {
		return documentDomainServiceCompat{}, false
	}
	query, ok := legacy.(legacyDocumentQueryService)
	if !ok {
		return documentDomainServiceCompat{}, false
	}
	compat := documentDomainServiceCompat{
		writer: writer,
		lookup: lookup,
		query:  query,
	}
	return compat, true
}

func wrapCompatError(action string, err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", action, err)
}

func (c documentDomainServiceCompat) Save(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error {
	return wrapCompatError("save document", c.writer.Save(ctx, doc))
}

func (c documentDomainServiceCompat) Update(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error {
	return wrapCompatError("update document", c.writer.Update(ctx, doc))
}

func (c documentDomainServiceCompat) Delete(ctx context.Context, id int64) error {
	return wrapCompatError("delete document", c.writer.Delete(ctx, id))
}

func (c documentDomainServiceCompat) UpdateSyncStatus(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error {
	return wrapCompatError("update document sync status", c.writer.UpdateSyncStatus(ctx, doc))
}

func (c documentDomainServiceCompat) MarkSyncing(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error {
	doc.MarkSyncing()
	return wrapCompatError("mark document syncing", c.writer.Update(ctx, doc))
}

func (c documentDomainServiceCompat) MarkSynced(ctx context.Context, doc *docentity.KnowledgeBaseDocument, wordCount int) error {
	doc.MarkSynced(wordCount)
	return wrapCompatError("mark document synced", c.writer.Update(ctx, doc))
}

func (c documentDomainServiceCompat) MarkSyncedWithContent(ctx context.Context, doc *docentity.KnowledgeBaseDocument, content string) error {
	return c.MarkSynced(ctx, doc, len([]rune(strings.TrimSpace(content))))
}

func (c documentDomainServiceCompat) MarkSyncFailed(ctx context.Context, doc *docentity.KnowledgeBaseDocument, message string) error {
	doc.MarkSyncFailed(message)
	return wrapCompatError("mark document sync failed", c.writer.Update(ctx, doc))
}

func (c documentDomainServiceCompat) MarkSyncFailedWithError(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	reason string,
	err error,
) error {
	return c.MarkSyncFailed(ctx, doc, documentdomain.BuildSyncFailureMessage(reason, err))
}

func (c documentDomainServiceCompat) Show(ctx context.Context, code string) (*docentity.KnowledgeBaseDocument, error) {
	doc, err := c.lookup.Show(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("show document: %w", err)
	}
	return doc, nil
}

func (c documentDomainServiceCompat) ShowByCodeAndKnowledgeBase(ctx context.Context, code, knowledgeBaseCode string) (*docentity.KnowledgeBaseDocument, error) {
	doc, err := c.lookup.ShowByCodeAndKnowledgeBase(ctx, code, knowledgeBaseCode)
	if err != nil {
		return nil, fmt.Errorf("show document by knowledge base: %w", err)
	}
	return doc, nil
}

func (c documentDomainServiceCompat) FindByKnowledgeBaseAndThirdFile(ctx context.Context, knowledgeBaseCode, thirdPlatformType, thirdFileID string) (*docentity.KnowledgeBaseDocument, error) {
	doc, err := c.lookup.FindByKnowledgeBaseAndThirdFile(ctx, knowledgeBaseCode, thirdPlatformType, thirdFileID)
	if err != nil {
		return nil, fmt.Errorf("find document by third file: %w", err)
	}
	return doc, nil
}

func (c documentDomainServiceCompat) FindByKnowledgeBaseAndProjectFile(ctx context.Context, knowledgeBaseCode string, projectFileID int64) (*docentity.KnowledgeBaseDocument, error) {
	doc, err := c.lookup.FindByKnowledgeBaseAndProjectFile(ctx, knowledgeBaseCode, projectFileID)
	if err != nil {
		return nil, fmt.Errorf("find document by project file: %w", err)
	}
	return doc, nil
}

func (c documentDomainServiceCompat) ResolveThirdFileDocumentPlan(
	ctx context.Context,
	input documentdomain.ThirdFileDocumentPlanInput,
) (documentdomain.ThirdFileDocumentPlan, error) {
	docs, err := c.ListByThirdFileInOrg(ctx, input.OrganizationCode, input.ThirdPlatformType, input.ThirdFileID)
	if err != nil {
		return documentdomain.ThirdFileDocumentPlan{}, err
	}
	seed, err := documentdomain.BuildThirdFileRevectorizeSeed(&documentdomain.ThirdFileRevectorizeInput{
		OrganizationCode:  input.OrganizationCode,
		ThirdPlatformType: input.ThirdPlatformType,
		ThirdFileID:       input.ThirdFileID,
	}, docs)
	if err != nil {
		return documentdomain.ThirdFileDocumentPlan{}, fmt.Errorf("build third-file revectorize seed: %w", err)
	}
	return documentdomain.ThirdFileDocumentPlan{Documents: docs, Seed: seed}, nil
}

func (c documentDomainServiceCompat) ResolveRealtimeThirdFileDocumentPlan(
	ctx context.Context,
	input documentdomain.ThirdFileDocumentPlanInput,
) (documentdomain.ThirdFileDocumentPlan, error) {
	return c.ResolveThirdFileDocumentPlan(ctx, input)
}

func (c documentDomainServiceCompat) ListByThirdFileInOrg(ctx context.Context, organizationCode, thirdPlatformType, thirdFileID string) ([]*docentity.KnowledgeBaseDocument, error) {
	docs, err := c.lookup.ListByThirdFileInOrg(ctx, organizationCode, thirdPlatformType, thirdFileID)
	if err != nil {
		return nil, fmt.Errorf("list documents by third file in org: %w", err)
	}
	return docs, nil
}

func (c documentDomainServiceCompat) ListRealtimeByThirdFileInOrg(ctx context.Context, organizationCode, thirdPlatformType, thirdFileID string) ([]*docentity.KnowledgeBaseDocument, error) {
	return c.ListByThirdFileInOrg(ctx, organizationCode, thirdPlatformType, thirdFileID)
}

func (c documentDomainServiceCompat) HasRealtimeThirdFileDocumentInOrg(ctx context.Context, organizationCode, thirdPlatformType, thirdFileID string) (bool, error) {
	docs, err := c.ListRealtimeByThirdFileInOrg(ctx, organizationCode, thirdPlatformType, thirdFileID)
	if err != nil {
		return false, err
	}
	return len(docs) > 0, nil
}

func (c documentDomainServiceCompat) ListByProjectFileInOrg(ctx context.Context, organizationCode string, projectFileID int64) ([]*docentity.KnowledgeBaseDocument, error) {
	docs, err := c.lookup.ListByProjectFileInOrg(ctx, organizationCode, projectFileID)
	if err != nil {
		return nil, fmt.Errorf("list documents by project file in org: %w", err)
	}
	return docs, nil
}

func (c documentDomainServiceCompat) ListRealtimeByProjectFileInOrg(ctx context.Context, organizationCode string, projectFileID int64) ([]*docentity.KnowledgeBaseDocument, error) {
	return c.ListByProjectFileInOrg(ctx, organizationCode, projectFileID)
}

func (c documentDomainServiceCompat) HasRealtimeProjectFileDocumentInOrg(ctx context.Context, organizationCode string, projectFileID int64) (bool, error) {
	docs, err := c.ListRealtimeByProjectFileInOrg(ctx, organizationCode, projectFileID)
	if err != nil {
		return false, err
	}
	return len(docs) > 0, nil
}

func (c documentDomainServiceCompat) ListByKnowledgeBaseAndProject(ctx context.Context, knowledgeBaseCode string, projectID int64) ([]*docentity.KnowledgeBaseDocument, error) {
	docs, err := c.lookup.ListByKnowledgeBaseAndProject(ctx, knowledgeBaseCode, projectID)
	if err != nil {
		return nil, fmt.Errorf("list documents by project binding: %w", err)
	}
	return docs, nil
}

func (c documentDomainServiceCompat) List(ctx context.Context, query *docrepo.DocumentQuery) ([]*docentity.KnowledgeBaseDocument, int64, error) {
	docs, total, err := c.query.List(ctx, query)
	if err != nil {
		return nil, 0, fmt.Errorf("list documents: %w", err)
	}
	return docs, total, nil
}

func (c documentDomainServiceCompat) CountByKnowledgeBaseCodes(ctx context.Context, organizationCode string, knowledgeBaseCodes []string) (map[string]int64, error) {
	counts, err := c.query.CountByKnowledgeBaseCodes(ctx, organizationCode, knowledgeBaseCodes)
	if err != nil {
		return nil, fmt.Errorf("count documents by knowledge bases: %w", err)
	}
	return counts, nil
}

func (c documentDomainServiceCompat) ListByKnowledgeBase(ctx context.Context, knowledgeBaseCode string, offset, limit int) ([]*docentity.KnowledgeBaseDocument, int64, error) {
	return c.List(ctx, &docrepo.DocumentQuery{
		KnowledgeBaseCode: knowledgeBaseCode,
		Offset:            offset,
		Limit:             limit,
	})
}

// NewDocumentAppServiceForTest 构造仅用于测试的文档应用服务。
func NewDocumentAppServiceForTest(
	tb testing.TB,
	domainService any,
	kbService any,
	scheduler documentSyncScheduler,
	fragmentServices ...any,
) *DocumentAppService {
	tb.Helper()

	var ds documentDomainService
	if domainService != nil {
		if typed, ok := domainService.(documentDomainService); ok {
			ds = typed
		} else if compat, ok := newDocumentDomainServiceCompat(domainService); ok {
			ds = compat
		} else {
			tb.Fatalf("domainService does not implement documentDomainService: %T", domainService)
			return nil
		}
	}
	var kbs knowledgeBaseReader
	if kbService != nil {
		var ok bool
		kbs, ok = kbService.(knowledgeBaseReader)
		if !ok {
			tb.Fatalf("kbService does not implement knowledgeBaseReader: %T", kbService)
			return nil
		}
	} else {
		kbs = defaultKnowledgeBaseReaderForTest{}
	}
	var fragmentSvc fragmentDocumentService
	if len(fragmentServices) > 0 && fragmentServices[0] != nil {
		var ok bool
		fragmentSvc, ok = fragmentServices[0].(fragmentDocumentService)
		if !ok {
			tb.Fatalf("fragmentService does not implement fragmentDocumentService: %T", fragmentServices[0])
			return nil
		}
	}
	return &DocumentAppService{
		domainService:   ds,
		kbService:       kbs,
		fragmentService: fragmentSvc,
		syncScheduler:   scheduler,
		tokenizer:       testTokenizerService(),
	}
}

// DocumentEntityToDTOWithContextForTest 供测试调用 DTO 转换。
func DocumentEntityToDTOWithContextForTest(ctx context.Context, svc *DocumentAppService, doc *docentity.KnowledgeBaseDocument) *docdto.DocumentDTO {
	return svc.entityToDTOWithContext(ctx, doc)
}

// PreflightDocumentSourceForTest 供测试执行文档源预检。
func PreflightDocumentSourceForTest(ctx context.Context, svc *DocumentAppService, doc *docentity.KnowledgeBaseDocument) error {
	return svc.preflightDocumentSource(ctx, doc, nil)
}

// FetchDocumentForSyncForTest 供测试获取待同步文档。
func FetchDocumentForSyncForTest(
	ctx context.Context,
	svc *DocumentAppService,
	input *documentdomain.SyncDocumentInput,
) (*docentity.KnowledgeBaseDocument, error) {
	return svc.fetchDocumentForSync(ctx, input)
}

// SetParseServiceForTest 供测试覆盖文档解析服务依赖。
func (s *DocumentAppService) SetParseServiceForTest(parseService documentParseService) {
	if s == nil {
		return
	}
	s.parseService = parseService
}

// SetThirdPlatformDocumentPortForTest 供测试覆盖第三方文档 resolve 端口。
func (s *DocumentAppService) SetThirdPlatformDocumentPortForTest(port thirdPlatformDocumentResolver) {
	if s == nil {
		return
	}
	s.thirdPlatformDocumentPort = port
}

// SetKnowledgeBasePermissionReaderForTest 供测试覆盖知识库权限读取依赖。
func (s *DocumentAppService) SetKnowledgeBasePermissionReaderForTest(reader kbaccess.PermissionReader) {
	if s == nil {
		return
	}
	s.permissionReader = reader
}

// SetKnowledgeRevectorizeProgressStoreForTest 供测试覆盖知识库重向量化进度存储。
func (s *DocumentAppService) SetKnowledgeRevectorizeProgressStoreForTest(store revectorizeshared.ProgressStore) {
	if s == nil {
		return
	}
	s.revectorizeProgressStore = store
}

// MarkDocumentSyncingForTest 供测试标记同步中状态。
func MarkDocumentSyncingForTest(ctx context.Context, svc *DocumentAppService, doc *docentity.KnowledgeBaseDocument) error {
	return svc.markDocumentSyncing(ctx, doc)
}

// BuildDocumentFilePayloadForTest 供测试构造文档文件载荷。
func BuildDocumentFilePayloadForTest(doc *docentity.KnowledgeBaseDocument) map[string]any {
	return documentdomain.BuildDocumentFilePayload(doc)
}

// ApplyResolvedDocumentResultForTest 供测试回填第三方文档解析结果。
func ApplyResolvedDocumentResultForTest(doc *docentity.KnowledgeBaseDocument, docType int, result map[string]any) {
	documentdomain.ApplyResolvedDocumentResult(doc, docType, result)
}

// ResolveDocumentSourceFileTypeForTest 供测试解析文档源文件类型。
func ResolveDocumentSourceFileTypeForTest(doc *docentity.KnowledgeBaseDocument) string {
	return documentdomain.ResolveDocumentSourceFileType(doc)
}

// FinishSyncForTest 供测试执行同步完成流程。
func FinishSyncForTest(ctx context.Context, svc *DocumentAppService, doc *docentity.KnowledgeBaseDocument, content string) error {
	return svc.finishSync(ctx, doc, content)
}

// FailSyncForTest 供测试执行同步失败流程。
func FailSyncForTest(ctx context.Context, svc *DocumentAppService, doc *docentity.KnowledgeBaseDocument, msg string) {
	_ = svc.domainService.MarkSyncFailed(ctx, doc, msg)
}

// ShouldCleanupDocumentBeforeSyncForTest 返回同步前是否需要清理。
func ShouldCleanupDocumentBeforeSyncForTest(mode string) bool {
	return documentdomain.ShouldCleanupBeforeSync(mode)
}

// BuildChunkIdentityKeyForTest 供测试构造分片 identity。
func BuildChunkIdentityKeyForTest(sectionPath string, chunkIndex int) string {
	return fragdomain.BuildChunkIdentityKey(sectionPath, chunkIndex)
}

// BuildPointIDForTest 供测试构造向量点 ID。
func BuildPointIDForTest(knowledgeCode, documentCode, chunkIdentityKey string) string {
	return fragdomain.BuildPointID(knowledgeCode, documentCode, chunkIdentityKey)
}

// BuildFragmentResyncPlanForTest 供测试构造增量重同步计划。
func BuildFragmentResyncPlanForTest(
	oldFragments, newFragments []*fragmodel.KnowledgeBaseFragment,
) (FragmentResyncPlanForTest, error) {
	return BuildFragmentResyncPlanForTestWithForce(oldFragments, newFragments, false)
}

// BuildFragmentResyncPlanForTestWithForce 供测试构造支持强制回填的增量重同步计划。
func BuildFragmentResyncPlanForTestWithForce(
	oldFragments, newFragments []*fragmodel.KnowledgeBaseFragment,
	forceBackfill bool,
) (FragmentResyncPlanForTest, error) {
	plan, err := fragdomain.BuildFragmentResyncPlan(oldFragments, newFragments, forceBackfill)
	if err != nil {
		return FragmentResyncPlanForTest{}, fmt.Errorf("build fragment resync plan for test: %w", err)
	}
	return FragmentResyncPlanForTest{
		Changed:         plan.Changed,
		Added:           plan.Added,
		Deleted:         plan.Deleted,
		Unchanged:       plan.Unchanged,
		RekeyedPointIDs: append([]string(nil), plan.RekeyedPointIDs...),
	}, nil
}

// BuildSyncSegmentConfigForTest 供测试构造同步切片配置。
func BuildSyncSegmentConfigForTest(doc *docentity.KnowledgeBaseDocument, kb *kbentity.KnowledgeBase) PreviewSegmentConfigForTest {
	config := documentdomain.BuildSyncSegmentConfig(doc, knowledgeBaseSnapshotFromDomain(kb))
	return PreviewSegmentConfigForTest{
		ChunkSize:          config.ChunkSize,
		ChunkOverlap:       config.ChunkOverlap,
		Separator:          config.Separator,
		TextPreprocessRule: append([]int(nil), config.TextPreprocessRule...),
	}
}

// ResolveSplitModelForTest 供测试解析切片使用的模型。
func ResolveSplitModelForTest(ctx context.Context, tb testing.TB, kbService any, kb *kbentity.KnowledgeBase, fallbackModel string) string {
	tb.Helper()

	var reader knowledgeBaseReader
	if kbService != nil {
		var ok bool
		reader, ok = kbService.(knowledgeBaseReader)
		if !ok {
			tb.Fatalf("kbService does not implement knowledgeBaseReader: %T", kbService)
			return ""
		}
	}
	effectiveModel := ""
	if reader != nil {
		effectiveModel = reader.ResolveRuntimeRoute(ctx, kb).Model
	}
	return documentdomain.ResolveSplitModel(fallbackModel, effectiveModel)
}

// SplitContentByTokenPipelineWithTokenizerForTest 供测试执行 token 切片，并允许复用 tokenizer。
func SplitContentByTokenPipelineWithTokenizerForTest(
	ctx context.Context,
	content string,
	cfg PreviewSegmentConfigForTest,
	model string,
	tokenizerService *tokenizer.Service,
) ([]TokenChunkForTest, error) {
	chunks, err := documentsplitter.SplitContentByTokenPipeline(
		ctx,
		content,
		previewSegmentConfigForTestToDomain(cfg),
		model,
		ensureTokenizerServiceForTest(tokenizerService),
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("split content by token pipeline for test: %w", err)
	}
	results := make([]TokenChunkForTest, 0, len(chunks))
	for _, chunk := range chunks {
		results = append(results, tokenChunkForTest(chunk))
	}
	return results, nil
}

// SplitContentWithEffectiveModePipelineWithSourceTypeAndTokenizerForTest 供测试执行带源类型的自动切片，并允许复用 tokenizer。
func SplitContentWithEffectiveModePipelineWithSourceTypeAndTokenizerForTest(
	ctx context.Context,
	input SplitContentWithEffectiveModePipelineForTestInput,
	tokenizerService *tokenizer.Service,
) ([]TokenChunkForTest, string, string, error) {
	model := documentdomain.ResolveSplitModel(input.Model, "text-embedding-3-small")
	chunks, resolution, err := documentsplitter.SplitContentWithEffectiveModePipeline(ctx, documentsplitter.AutoSplitPipelineInput{
		Content:             input.Content,
		SourceFileType:      input.SourceFileType,
		RequestedMode:       input.RequestedMode,
		FragmentConfig:      documentdomain.CloneFragmentConfig(input.FragmentConfig),
		NormalSegmentConfig: previewSegmentConfigForTestToDomain(input.SegmentConfig),
		Model:               model,
		TokenizerService:    ensureTokenizerServiceForTest(tokenizerService),
	})
	if err != nil {
		return nil, "", "", fmt.Errorf("split content with effective mode pipeline for test: %w", err)
	}
	results := make([]TokenChunkForTest, 0, len(chunks))
	for _, chunk := range chunks {
		results = append(results, tokenChunkForTest(chunk))
	}
	return results, resolution.EffectiveSplitMode, resolution.HierarchyDetector, nil
}

// SplitParsedDocumentToChunksWithTokenizerForTest 供测试对解析文档切片，并允许复用 tokenizer。
func SplitParsedDocumentToChunksWithTokenizerForTest(
	ctx context.Context,
	input SplitParsedDocumentToChunksForTestInput,
	tokenizerService *tokenizer.Service,
) ([]TokenChunkForTest, string, error) {
	model := documentdomain.ResolveSplitModel(input.Model, "text-embedding-3-small")
	chunks, splitVersion, err := documentsplitter.SplitParsedDocumentToChunks(ctx, documentsplitter.ParsedDocumentChunkInput{
		Parsed:           input.ParsedDocument,
		SourceFileType:   input.SourceFileType,
		RequestedMode:    input.RequestedMode,
		FragmentConfig:   documentdomain.CloneFragmentConfig(input.FragmentConfig),
		SegmentConfig:    previewSegmentConfigForTestToDomain(input.SegmentConfig),
		Model:            model,
		TokenizerService: ensureTokenizerServiceForTest(tokenizerService),
	})
	if err != nil {
		return nil, "", fmt.Errorf("split parsed document to chunks for test: %w", err)
	}
	results := make([]TokenChunkForTest, 0, len(chunks))
	for _, chunk := range chunks {
		results = append(results, tokenChunkForTest(chunk))
	}
	return results, splitVersion, nil
}

// PreviewRuleRemoveURLEmailForTest 返回删除 URL 和邮箱的规则值。
func PreviewRuleRemoveURLEmailForTest() int {
	return documentsplitter.PreviewRuleRemoveURLEmail
}

// PreviewRuleReplaceWhitespaceForTest 返回替换空白的规则值。
func PreviewRuleReplaceWhitespaceForTest() int {
	return documentsplitter.PreviewRuleReplaceWhitespace
}

// ResolveTokenizerEncoderWithServiceForTest 供测试复用指定 tokenizer service 的 encoder。
func ResolveTokenizerEncoderWithServiceForTest(
	tokenizerService *tokenizer.Service,
	model string,
) (*tokenizer.Encoder, error) {
	encoder, err := ensureTokenizerServiceForTest(tokenizerService).EncoderForModel(model)
	if err != nil {
		return nil, fmt.Errorf("resolve tokenizer encoder for test: %w", err)
	}
	return encoder, nil
}

func tokenChunkForTest(chunk documentsplitter.TokenChunk) TokenChunkForTest {
	return TokenChunkForTest{
		Content:            chunk.Content,
		TokenCount:         chunk.TokenCount,
		SectionPath:        chunk.SectionPath,
		SectionLevel:       chunk.SectionLevel,
		SectionTitle:       chunk.SectionTitle,
		TreeNodeID:         chunk.TreeNodeID,
		ParentNodeID:       chunk.ParentNodeID,
		SectionChunkIndex:  chunk.SectionChunkIndex,
		EffectiveSplitMode: chunk.EffectiveSplitMode,
		HierarchyDetector:  chunk.HierarchyDetector,
		Metadata:           maps.Clone(chunk.Metadata),
	}
}

func previewSegmentConfigForTestToDomain(cfg PreviewSegmentConfigForTest) documentsplitter.PreviewSegmentConfig {
	return documentsplitter.PreviewSegmentConfig{
		ChunkSize:          cfg.ChunkSize,
		ChunkOverlap:       cfg.ChunkOverlap,
		Separator:          cfg.Separator,
		TextPreprocessRule: append([]int(nil), cfg.TextPreprocessRule...),
	}
}

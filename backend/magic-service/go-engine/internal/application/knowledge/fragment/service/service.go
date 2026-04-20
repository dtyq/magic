// Package fragapp 提供片段应用服务实现。
package fragapp

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"

	"golang.org/x/sync/singleflight"

	fragdto "magic/internal/application/knowledge/fragment/dto"
	pagehelper "magic/internal/application/knowledge/helper/page"
	thirdplatformprovider "magic/internal/application/knowledge/shared/thirdplatformprovider"
	documentdomain "magic/internal/domain/knowledge/document/service"
	documentsplitter "magic/internal/domain/knowledge/document/splitter"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragretrieval "magic/internal/domain/knowledge/fragment/retrieval"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/thirdplatform"
	"magic/internal/pkg/tokenizer"
)

// FragmentAppService 片段应用层服务
type FragmentAppService struct {
	fragmentService           fragmentAppFragmentService
	kbService                 fragmentAppKnowledgeBaseReader
	documentService           fragmentAppDocumentReader
	manualFragmentCoordinator fragmentManualCoordinator
	parseService              fragmentAppParseService
	thirdPlatformDocumentPort thirdPlatformPreviewResolver
	previewSplitter           documentsplitter.PreviewSplitter
	knowledgeBaseBindingRepo  fragmentAppKnowledgeBaseBindingReader
	superMagicAgentAccess     fragmentAppSuperMagicAgentAccessChecker
	teamshareTempCodeMapper   fragmentAppTeamshareTempCodeMapper
	tokenizer                 *tokenizer.Service
	defaultEmbeddingModel     string
	thirdPlatformProviders    *thirdplatformprovider.Registry
	legacyThirdPlatformCompat *LegacyThirdPlatformFragmentCompat
	logger                    *logging.SugaredLogger
	previewGroup              singleflight.Group
}

// ErrFragmentWriteDisabled 表示片段级写操作已被禁用，必须改为整篇文档重向量化。
var ErrFragmentWriteDisabled = shared.ErrFragmentWriteDisabled

var (
	// ErrFragmentKnowledgeBaseBindingReaderRequired 表示缺少知识库绑定读取依赖。
	ErrFragmentKnowledgeBaseBindingReaderRequired = errors.New("fragment knowledge base binding reader is required")
	// ErrFragmentSuperMagicAgentAccessCheckerRequired 表示缺少数字员工访问校验依赖。
	ErrFragmentSuperMagicAgentAccessCheckerRequired = errors.New("fragment super magic agent access checker is required")
	// ErrFragmentPermissionDenied 表示当前用户无数字员工知识检索权限。
	ErrFragmentPermissionDenied = errors.New("fragment permission denied")
	// ErrFragmentManualCoordinatorRequired 表示缺少手工片段事务协调器。
	ErrFragmentManualCoordinatorRequired = errors.New("fragment manual coordinator is required")
)

type fragmentAppFragmentReader interface {
	Show(ctx context.Context, id int64) (*fragmodel.KnowledgeBaseFragment, error)
	FindByPointIDs(ctx context.Context, pointIDs []string) ([]*fragmodel.KnowledgeBaseFragment, error)
	ListContextByDocuments(
		ctx context.Context,
		documentKeys []fragmodel.DocumentKey,
		limit int,
	) (map[fragmodel.DocumentKey][]*fragmodel.KnowledgeBaseFragment, error)
	List(ctx context.Context, query *fragmodel.Query) ([]*fragmodel.KnowledgeBaseFragment, int64, error)
	ListPointIDsByFilter(ctx context.Context, collectionName string, filter *fragmodel.VectorFilter, limit int) ([]string, error)
	Similarity(ctx context.Context, kb any, req fragretrieval.SimilarityRequest) ([]*fragmodel.SimilarityResult, error)
	WarmupRetrieval(ctx context.Context) error
}

type fragmentAppFragmentWriter interface {
	Save(ctx context.Context, fragment *fragmodel.KnowledgeBaseFragment) error
	Destroy(ctx context.Context, fragment *fragmodel.KnowledgeBaseFragment, collectionName string) error
	DestroyBatch(ctx context.Context, fragments []*fragmodel.KnowledgeBaseFragment, collectionName string) error
	SetPayloadByPointIDs(ctx context.Context, collection string, updates map[string]map[string]any) error
	SyncFragment(ctx context.Context, kb any, fragment *fragmodel.KnowledgeBaseFragment, businessParams *ctxmeta.BusinessParams) error
}

type fragmentAppFragmentService interface {
	fragmentAppFragmentReader
	fragmentAppFragmentWriter
}

type fragmentAppKnowledgeBaseReader interface {
	Show(ctx context.Context, code string) (*knowledgebasedomain.KnowledgeBase, error)
	ShowByCodeAndOrg(ctx context.Context, code, orgCode string) (*knowledgebasedomain.KnowledgeBase, error)
	List(ctx context.Context, query *knowledgebasedomain.Query) ([]*knowledgebasedomain.KnowledgeBase, int64, error)
	ResolveRuntimeRoute(ctx context.Context, kb *knowledgebasedomain.KnowledgeBase) sharedroute.ResolvedRoute
}

type fragmentAppDocumentReader interface {
	ShowByCodeAndKnowledgeBase(ctx context.Context, code, knowledgeBaseCode string) (*documentdomain.KnowledgeBaseDocument, error)
	FindByKnowledgeBaseAndThirdFile(ctx context.Context, knowledgeBaseCode, thirdPlatformType, thirdFileID string) (*documentdomain.KnowledgeBaseDocument, error)
	EnsureDefaultDocument(ctx context.Context, kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot) (*documentdomain.KnowledgeBaseDocument, bool, error)
}

type fragmentManualCoordinator interface {
	EnsureDocumentAndSaveFragment(
		ctx context.Context,
		doc *documentdomain.KnowledgeBaseDocument,
		fragment *fragmodel.KnowledgeBaseFragment,
	) (*documentdomain.KnowledgeBaseDocument, error)
}

type fragmentAppParseService interface {
	Parse(ctx context.Context, rawURL, ext string) (string, error)
	ParseDocument(ctx context.Context, rawURL, ext string) (*documentdomain.ParsedDocument, error)
	ParseDocumentReaderWithOptions(
		ctx context.Context,
		fileURL string,
		file io.Reader,
		fileType string,
		options documentdomain.ParseOptions,
	) (*documentdomain.ParsedDocument, error)
	ParseDocumentWithOptions(
		ctx context.Context,
		rawURL, ext string,
		options documentdomain.ParseOptions,
	) (*documentdomain.ParsedDocument, error)
}

type fragmentAppKnowledgeBaseBindingReader interface {
	ListBindIDsByKnowledgeBase(
		ctx context.Context,
		knowledgeBaseCode string,
		bindType knowledgebasedomain.BindingType,
	) ([]string, error)
	ListKnowledgeBaseCodesByBindID(
		ctx context.Context,
		bindType knowledgebasedomain.BindingType,
		bindID string,
		organizationCode string,
	) ([]string, error)
}

type fragmentAppSuperMagicAgentAccessChecker interface {
	ListAccessibleCodes(
		ctx context.Context,
		organizationCode string,
		userID string,
		codes []string,
	) (map[string]struct{}, error)
}

type fragmentAppTeamshareTempCodeMapper interface {
	LookupBusinessIDs(ctx context.Context, knowledgeCodes []string) (map[string]string, error)
}

type thirdPlatformPreviewResolver interface {
	Resolve(ctx context.Context, input thirdplatform.DocumentResolveInput) (*thirdplatform.DocumentResolveResult, error)
}

// AppDeps 聚合片段应用服务需要的窄协作对象。
type AppDeps struct {
	ParseService              *documentdomain.ParseService
	ThirdPlatformDocumentPort thirdPlatformPreviewResolver
	ThirdPlatformProviders    *thirdplatformprovider.Registry
	PreviewSplitter           documentsplitter.PreviewSplitter
	KnowledgeBaseBindingRepo  fragmentAppKnowledgeBaseBindingReader
	SuperMagicAgentAccess     fragmentAppSuperMagicAgentAccessChecker
	TeamshareTempCodeMapper   fragmentAppTeamshareTempCodeMapper
	ManualFragmentCoordinator fragmentManualCoordinator
	Tokenizer                 *tokenizer.Service
	DefaultEmbeddingModel     string
}

// NewFragmentAppService 创建片段应用层服务
func NewFragmentAppService(
	fragmentService *fragdomain.FragmentDomainService,
	kbService *knowledgebasedomain.DomainService,
	documentService *documentdomain.DomainService,
	deps AppDeps,
	logger *logging.SugaredLogger,
) *FragmentAppService {
	previewSplitter := deps.PreviewSplitter
	if previewSplitter == nil {
		previewSplitter = documentsplitter.NewPreviewSplitter()
	}
	service := &FragmentAppService{
		fragmentService:           fragmentService,
		kbService:                 kbService,
		documentService:           documentService,
		manualFragmentCoordinator: deps.ManualFragmentCoordinator,
		parseService:              deps.ParseService,
		thirdPlatformDocumentPort: deps.ThirdPlatformDocumentPort,
		previewSplitter:           previewSplitter,
		knowledgeBaseBindingRepo:  deps.KnowledgeBaseBindingRepo,
		superMagicAgentAccess:     deps.SuperMagicAgentAccess,
		teamshareTempCodeMapper:   deps.TeamshareTempCodeMapper,
		tokenizer:                 deps.Tokenizer,
		defaultEmbeddingModel:     resolveDefaultEmbeddingModel(deps.DefaultEmbeddingModel),
		thirdPlatformProviders:    deps.ThirdPlatformProviders,
		logger:                    logger,
	}
	service.legacyThirdPlatformCompat = NewLegacyThirdPlatformFragmentCompat(documentService, deps.ThirdPlatformProviders)
	return service
}

// WarmupRetrieval 预热检索分词器词典，避免首个查询触发懒加载。
func (s *FragmentAppService) WarmupRetrieval(ctx context.Context) error {
	if s == nil || s.fragmentService == nil {
		return nil
	}
	if err := s.fragmentService.WarmupRetrieval(ctx); err != nil {
		return fmt.Errorf("warmup fragment retrieval: %w", err)
	}
	return nil
}

// Create 创建片段
func (s *FragmentAppService) Create(ctx context.Context, input *fragdto.CreateFragmentInput) (*fragdto.FragmentDTO, error) {
	if input == nil {
		return nil, shared.ErrFragmentDocumentCodeRequired
	}
	if strings.TrimSpace(input.DocumentCode) == "" && fragdomain.ResolveLegacyThirdPlatformFileID(input.Metadata) == "" {
		return nil, shared.ErrFragmentDocumentCodeRequired
	}

	kb, err := s.kbService.ShowByCodeAndOrg(ctx, input.KnowledgeCode, input.OrganizationCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find knowledge base: %w", err)
	}
	if err := s.ensureKnowledgeBaseMatchesAgentScope(ctx, kb); err != nil {
		return nil, err
	}
	s.applyResolvedRouteToKnowledgeBase(ctx, kb)

	lifecycle, err := s.buildManualWriteLifecycle(ctx, kb, input)
	if err != nil {
		return nil, err
	}
	fragment := lifecycle.Fragment

	if s.manualFragmentCoordinator == nil {
		return nil, ErrFragmentManualCoordinatorRequired
	}
	resolvedDoc, err := s.manualFragmentCoordinator.EnsureDocumentAndSaveFragment(
		ctx,
		domainDocumentFromFrag(lifecycle.Document),
		fragment,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create fragment: %w", err)
	}
	fragment.DocumentCode = resolvedDoc.Code
	fragment.DocumentName = resolvedDoc.Name
	fragment.DocumentType = resolvedDoc.DocType
	fragment.OrganizationCode = resolvedDoc.OrganizationCode

	return s.entityToDTO(fragment), nil
}

func resolveDefaultEmbeddingModel(model string) string {
	trimmed := strings.TrimSpace(model)
	if trimmed == "" {
		return tokenizer.DefaultEncoding
	}
	return trimmed
}

// Show 查询片段详情
func (s *FragmentAppService) Show(
	ctx context.Context,
	id int64,
	organizationCode, knowledgeCode, documentCode string,
) (*fragdto.FragmentDTO, error) {
	fragment, err := s.fragmentService.Show(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to find fragment: %w", err)
	}
	if err := validateFragmentScope(fragment, organizationCode, knowledgeCode, documentCode); err != nil {
		return nil, err
	}
	if _, err := s.loadScopedKnowledgeBase(ctx, fragment.OrganizationCode, fragment.KnowledgeCode); err != nil {
		return nil, err
	}
	return s.entityToDTO(fragment), nil
}

// List 查询片段列表
func (s *FragmentAppService) List(ctx context.Context, input *fragdto.ListFragmentInput) (*pagehelper.Result, error) {
	var syncStatus *shared.SyncStatus
	if input.SyncStatus != nil {
		st := shared.SyncStatus(*input.SyncStatus)
		syncStatus = &st
	}

	query := &fragmodel.Query{
		KnowledgeCode: input.KnowledgeCode,
		DocumentCode:  input.DocumentCode,
		Content:       input.Content,
		SyncStatus:    syncStatus,
		Offset:        input.Offset,
		Limit:         input.Limit,
	}

	fragments, total, err := s.fragmentService.List(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list fragments: %w", err)
	}

	list := make([]*fragdto.FragmentDTO, len(fragments))
	for i, f := range fragments {
		list[i] = s.entityToDTO(f)
	}

	return &pagehelper.Result{Total: total, List: list}, nil
}

// ListV2 查询片段列表并返回结构化预览数据。
func (s *FragmentAppService) ListV2(ctx context.Context, input *fragdto.ListFragmentInput) (*fragdto.FragmentPageResultDTO, error) {
	if input != nil {
		allowed, err := s.isKnowledgeBaseAccessibleInAgentScope(
			ctx,
			input.OrganizationCode,
			input.KnowledgeCode,
		)
		if err != nil {
			return nil, err
		}
		if !allowed {
			return &fragdto.FragmentPageResultDTO{
				Page:          1,
				Total:         0,
				List:          []*fragdto.FragmentListItemDTO{},
				DocumentNodes: []fragdto.DocumentNodeDTO{},
			}, nil
		}
	}

	var syncStatus *shared.SyncStatus
	if input.SyncStatus != nil {
		st := shared.SyncStatus(*input.SyncStatus)
		syncStatus = &st
	}

	query := &fragmodel.Query{
		KnowledgeCode: input.KnowledgeCode,
		DocumentCode:  input.DocumentCode,
		Content:       input.Content,
		SyncStatus:    syncStatus,
		Offset:        input.Offset,
		Limit:         input.Limit,
	}

	fragments, total, err := s.fragmentService.List(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list fragments: %w", err)
	}

	list := make([]*fragdto.FragmentListItemDTO, 0, len(fragments))
	sources := make([]fragdomain.DocumentNodeSource, 0, len(fragments))
	documentTitle := ""
	for _, fragment := range fragments {
		item := buildListItemFromFragmentDTO(s.entityToDTO(fragment))
		list = append(list, item)
		chunkIndex, hasChunkIndex := metadataIntLookup(fragment.Metadata, "chunk_index")
		sectionChunkIndex, hasSectionChunkIndex := metadataIntLookup(fragment.Metadata, "section_chunk_index")
		sources = append(sources, fragdomain.DocumentNodeSource{
			Content:           fragment.Content,
			SectionPath:       fragment.SectionPath,
			SectionTitle:      fragment.SectionTitle,
			SectionLevel:      fragment.SectionLevel,
			ChunkIndex:        chunkIndex,
			HasChunkIndex:     hasChunkIndex,
			TreeNodeID:        metadataStringValue(fragment.Metadata, "tree_node_id"),
			ParentNodeID:      metadataStringValue(fragment.Metadata, "parent_node_id"),
			SectionChunkIndex: sectionChunkIndex,
			HasSectionChunk:   hasSectionChunkIndex,
		})
		if documentTitle == "" {
			documentTitle = fragment.DocumentName
		}
	}

	page := 1
	if input != nil && input.Limit > 0 {
		page = max(1, input.Offset/input.Limit+1)
	}

	return &fragdto.FragmentPageResultDTO{
		Page:          page,
		Total:         total,
		List:          list,
		DocumentNodes: buildDocumentNodeDTOs(documentTitle, sources),
	}, nil
}

// Destroy 删除片段
func (s *FragmentAppService) Destroy(
	ctx context.Context,
	id int64,
	knowledgeCode, documentCode, organizationCode string,
) error {
	fragment, err := s.fragmentService.Show(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to find fragment: %w", err)
	}
	if err := validateFragmentScope(fragment, organizationCode, knowledgeCode, documentCode); err != nil {
		return err
	}

	kb, err := s.loadScopedKnowledgeBase(ctx, organizationCode, knowledgeCode)
	if err != nil {
		return err
	}
	route := s.kbService.ResolveRuntimeRoute(ctx, kb)

	// 片段删除必须直接命中统一路由选出的运行时物理集合。
	if err := s.fragmentService.Destroy(ctx, fragment, route.VectorCollectionName); err != nil {
		return fmt.Errorf("failed to destroy fragment: %w", err)
	}
	return nil
}

// Sync 同步片段到向量库
func (s *FragmentAppService) Sync(ctx context.Context, input *fragdto.SyncFragmentInput) (*fragdto.FragmentDTO, error) {
	kb, err := s.kbService.Show(ctx, input.KnowledgeCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find knowledge base: %w", err)
	}

	fragment, err := s.fragmentService.Show(ctx, input.FragmentID)
	if err != nil {
		return nil, fmt.Errorf("failed to find fragment: %w", err)
	}
	if err := validateFragmentScope(fragment, input.OrganizationCode, input.KnowledgeCode, ""); err != nil {
		return nil, err
	}

	if err := s.fragmentService.SyncFragment(ctx, kb, fragment, input.BusinessParams); err != nil {
		return nil, fmt.Errorf("failed to sync fragment: %w", err)
	}

	return s.entityToDTO(fragment), nil
}

// Similarity 相似度搜索
func (s *FragmentAppService) Similarity(ctx context.Context, input *fragdto.SimilarityInput) ([]*fragdto.SimilarityResultDTO, error) {
	kb, err := s.loadScopedKnowledgeBase(ctx, input.OrganizationCode, input.KnowledgeCode)
	if err != nil {
		return nil, err
	}
	return s.similarityByKnowledgeBase(ctx, kb, input)
}

func (s *FragmentAppService) similarityByKnowledgeBase(
	ctx context.Context,
	kb *knowledgebasedomain.KnowledgeBase,
	input *fragdto.SimilarityInput,
) ([]*fragdto.SimilarityResultDTO, error) {
	if kb == nil {
		return nil, shared.ErrKnowledgeBaseNotFound
	}
	results, err := s.fragmentService.Similarity(
		ctx,
		kb,
		fragdomain.BuildSimilarityRequest(kb, fragdomain.SimilarityRequestInput{
			Query:          input.Query,
			TopK:           input.TopK,
			ScoreThreshold: input.ScoreThreshold,
			BusinessParams: input.BusinessParams,
			Options:        buildSimilaritySearchOptions(input),
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to search similarity: %w", err)
	}
	return s.similarityResultsToDTOs(ctx, kb, results)
}

func (s *FragmentAppService) entityToDTO(e *fragmodel.KnowledgeBaseFragment) *fragdto.FragmentDTO {
	return EntityToDTO(e)
}

func buildSimilarityDisplayContent(content string, metadata map[string]any) (string, int) {
	return BuildSimilarityDisplayContent(content, metadata)
}

func validateFragmentScope(fragment *fragmodel.KnowledgeBaseFragment, organizationCode, knowledgeCode, documentCode string) error {
	if fragment == nil {
		return shared.ErrFragmentNotFound
	}
	if organizationCode != "" && fragment.OrganizationCode != organizationCode {
		return shared.ErrFragmentNotFound
	}
	if knowledgeCode != "" && fragment.KnowledgeCode != knowledgeCode {
		return shared.ErrFragmentNotFound
	}
	if documentCode != "" && fragment.DocumentCode != documentCode {
		return shared.ErrFragmentNotFound
	}
	return nil
}

func (s *FragmentAppService) applyResolvedRouteToKnowledgeBase(ctx context.Context, kb *knowledgebasedomain.KnowledgeBase) {
	if s == nil || s.kbService == nil || kb == nil {
		return
	}
	kb.ApplyResolvedRoute(s.kbService.ResolveRuntimeRoute(ctx, kb))
}

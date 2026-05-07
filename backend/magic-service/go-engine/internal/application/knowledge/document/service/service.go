// Package docapp 提供文档应用服务实现。
package docapp

import (
	"context"
	"errors"
	"io"
	"sync"
	"time"

	revectorizeshared "magic/internal/application/knowledge/shared/revectorize"
	thirdplatformprovider "magic/internal/application/knowledge/shared/thirdplatformprovider"
	userdomain "magic/internal/domain/contact/user"
	kbaccess "magic/internal/domain/knowledge/access/service"
	docentity "magic/internal/domain/knowledge/document/entity"
	docrepo "magic/internal/domain/knowledge/document/repository"
	documentdomain "magic/internal/domain/knowledge/document/service"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	sourcebindingrepository "magic/internal/domain/knowledge/sourcebinding/repository"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/thirdplatform"
	"magic/internal/pkg/tokenizer"
)

// ErrDocumentOrgMismatch 表示文档不属于组织
var ErrDocumentOrgMismatch = errors.New("document not found in organization")

// ErrDocumentFileEmpty 表示文档文件为空时的错误。
var ErrDocumentFileEmpty = shared.ErrDocumentFileEmpty

// ErrDocumentSourcePrecheckFailed 表示同步前文档源预检失败。
var ErrDocumentSourcePrecheckFailed = errors.New("document source precheck failed")

// ErrDocumentAccessActorMissing 表示后台文档同步任务无法恢复权限主体。
var ErrDocumentAccessActorMissing = errors.New("document access actor missing")

var (
	errDocumentFileNil      = errors.New("document file is nil")
	errDocumentFileURLEmpty = errors.New("document file url is empty")
	errDocumentParseNil     = errors.New("document parse service is nil")
	errDocumentUserNotFound = errors.New("document user not found")
)

const (
	docFileTypeExternal   = "external"
	docFileTypeThirdParty = "third_platform"
)

// DocumentAppService 文档应用层服务
type DocumentAppService struct {
	domainService              documentDomainService
	kbService                  knowledgeBaseReader
	fragmentService            fragmentDocumentService
	parseService               documentParseService
	fileLinkProvider           originalFileLinkProvider
	thirdPlatformDocumentPort  thirdPlatformDocumentResolver
	projectFilePort            documentdomain.ProjectFileResolver
	projectFileMetadataReader  documentdomain.ProjectFileMetadataReader
	projectFileContentPort     documentdomain.ProjectFileContentAccessor
	thirdPlatformProviders     *thirdplatformprovider.Registry
	tokenizer                  *tokenizer.Service
	syncScheduler              documentSyncScheduler
	permissionReader           kbaccess.PermissionReader
	thirdPlatformAccess        documentKnowledgeAccessPort
	logger                     *logging.SugaredLogger
	sourceBindingRepo          sourceBindingRepository
	knowledgeBaseBindingRepo   knowledgeBaseBindingRepository
	sourceBindingCache         sourcebindingrepository.SourceBindingCandidateCache
	sourceCallbackSingleflight sourcebindingrepository.SourceCallbackSingleflight
	revectorizeProgressStore   revectorizeshared.ProgressStore
	userService                *userdomain.DomainService
	resourceLimits             documentdomain.ResourceLimits
	sourceResolveCache         sync.Map
}

type documentSyncScheduler interface {
	Schedule(ctx context.Context, input *documentdomain.SyncDocumentInput)
}

type documentMutationService interface {
	Save(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error
	Update(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error
	Delete(ctx context.Context, id int64) error
	UpdateSyncStatus(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error
}

type documentSyncStateService interface {
	MarkSyncing(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error
	MarkSynced(ctx context.Context, doc *docentity.KnowledgeBaseDocument, wordCount int) error
	MarkSyncedWithContent(ctx context.Context, doc *docentity.KnowledgeBaseDocument, content string) error
	MarkSyncFailed(ctx context.Context, doc *docentity.KnowledgeBaseDocument, message string) error
	MarkSyncFailedWithError(ctx context.Context, doc *docentity.KnowledgeBaseDocument, reason string, err error) error
}

type documentLookupService interface {
	Show(ctx context.Context, code string) (*docentity.KnowledgeBaseDocument, error)
	ShowByCodeAndKnowledgeBase(ctx context.Context, code, knowledgeBaseCode string) (*docentity.KnowledgeBaseDocument, error)
	FindByKnowledgeBaseAndThirdFile(ctx context.Context, knowledgeBaseCode, thirdPlatformType, thirdFileID string) (*docentity.KnowledgeBaseDocument, error)
	FindByKnowledgeBaseAndProjectFile(ctx context.Context, knowledgeBaseCode string, projectFileID int64) (*docentity.KnowledgeBaseDocument, error)
	ListByProjectFileInOrg(ctx context.Context, organizationCode string, projectFileID int64) ([]*docentity.KnowledgeBaseDocument, error)
	ResolveThirdFileDocumentPlan(ctx context.Context, input documentdomain.ThirdFileDocumentPlanInput) (documentdomain.ThirdFileDocumentPlan, error)
	ListByThirdFileInOrg(ctx context.Context, organizationCode, thirdPlatformType, thirdFileID string) ([]*docentity.KnowledgeBaseDocument, error)
	ListByKnowledgeBaseAndProject(ctx context.Context, knowledgeBaseCode string, projectID int64) ([]*docentity.KnowledgeBaseDocument, error)
}

type documentSourceCallbackLookupService interface {
	ListRealtimeByProjectFileInOrg(ctx context.Context, organizationCode string, projectFileID int64) ([]*docentity.KnowledgeBaseDocument, error)
	HasRealtimeProjectFileDocumentInOrg(ctx context.Context, organizationCode string, projectFileID int64) (bool, error)
	ResolveRealtimeThirdFileDocumentPlan(ctx context.Context, input documentdomain.ThirdFileDocumentPlanInput) (documentdomain.ThirdFileDocumentPlan, error)
	ListRealtimeByThirdFileInOrg(ctx context.Context, organizationCode, thirdPlatformType, thirdFileID string) ([]*docentity.KnowledgeBaseDocument, error)
	HasRealtimeThirdFileDocumentInOrg(ctx context.Context, organizationCode, thirdPlatformType, thirdFileID string) (bool, error)
}

type documentQueryService interface {
	List(ctx context.Context, query *docrepo.DocumentQuery) ([]*docentity.KnowledgeBaseDocument, int64, error)
	ListByKnowledgeBase(ctx context.Context, knowledgeBaseCode string, offset, limit int) ([]*docentity.KnowledgeBaseDocument, int64, error)
	CountByKnowledgeBaseCodes(ctx context.Context, organizationCode string, knowledgeBaseCodes []string) (map[string]int64, error)
}

type documentDomainService interface {
	documentMutationService
	documentSyncStateService
	documentLookupService
	documentSourceCallbackLookupService
	documentQueryService
}

type knowledgeBaseReader interface {
	ShowByCodeAndOrg(ctx context.Context, code, orgCode string) (*kbentity.KnowledgeBase, error)
	Show(ctx context.Context, code string) (*kbentity.KnowledgeBase, error)
	List(ctx context.Context, query *kbrepository.Query) ([]*kbentity.KnowledgeBase, int64, error)
	ResolveRuntimeRoute(ctx context.Context, kb *kbentity.KnowledgeBase) sharedroute.ResolvedRoute
	EnsureCollectionExists(ctx context.Context, kb *kbentity.KnowledgeBase) error
	UpdateProgress(ctx context.Context, kb *kbentity.KnowledgeBase) error
}

type fragmentDocumentWriter interface {
	SaveBatch(ctx context.Context, fragments []*fragmodel.KnowledgeBaseFragment) error
	Update(ctx context.Context, fragment *fragmodel.KnowledgeBaseFragment) error
	UpdateBatch(ctx context.Context, fragments []*fragmodel.KnowledgeBaseFragment) error
}

type fragmentDocumentReader interface {
	List(ctx context.Context, query *fragmodel.Query) ([]*fragmodel.KnowledgeBaseFragment, int64, error)
	ListByDocument(ctx context.Context, knowledgeCode, documentCode string, offset, limit int) ([]*fragmodel.KnowledgeBaseFragment, int64, error)
	ListByDocumentAfterID(ctx context.Context, knowledgeCode, documentCode string, afterID int64, limit int) ([]*fragmodel.KnowledgeBaseFragment, error)
	ListExistingPointIDs(ctx context.Context, collectionName string, pointIDs []string) (map[string]struct{}, error)
}

type fragmentDocumentSyncer interface {
	SyncFragmentBatch(ctx context.Context, kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot, fragments []*fragmodel.KnowledgeBaseFragment, businessParams *ctxmeta.BusinessParams) error
}

type fragmentDocumentCleaner interface {
	DeletePointData(ctx context.Context, collectionName, knowledgeCode, pointID string) error
	DeletePointDataBatch(ctx context.Context, collectionName, knowledgeCode string, pointIDs []string) error
	DeletePointsByDocument(ctx context.Context, collectionName, organizationCode, knowledgeCode, documentCode string) error
	DeleteByDocument(ctx context.Context, knowledgeCode, documentCode string) error
	Destroy(ctx context.Context, fragment *fragmodel.KnowledgeBaseFragment, collectionName string) error
	DestroyBatch(ctx context.Context, fragments []*fragmodel.KnowledgeBaseFragment, collectionName string) error
}

type fragmentDocumentService interface {
	fragmentDocumentWriter
	fragmentDocumentReader
	fragmentDocumentSyncer
	fragmentDocumentCleaner
}

type documentParseService interface {
	ValidateSource(ctx context.Context, rawURL string) error
	Parse(ctx context.Context, rawURL, ext string) (string, error)
	ParseDocument(ctx context.Context, rawURL, ext string) (*parseddocument.ParsedDocument, error)
	ParseDocumentReaderWithOptions(
		ctx context.Context,
		fileURL string,
		file io.Reader,
		fileType string,
		options documentdomain.ParseOptions,
	) (*parseddocument.ParsedDocument, error)
	ParseDocumentWithOptions(
		ctx context.Context,
		rawURL, ext string,
		options documentdomain.ParseOptions,
	) (*parseddocument.ParsedDocument, error)
	ResolveFileType(ctx context.Context, target string) (string, error)
}

type sourceBindingRepository interface {
	sourcebindingrepository.Repository
	sourcebindingrepository.ProjectFileBindingEligibilityReader
	sourcebindingrepository.TeamshareRealtimeBindingReader
}

type knowledgeBaseBindingRepository interface {
	ListBindIDsByKnowledgeBase(
		ctx context.Context,
		knowledgeBaseCode string,
		bindType kbentity.BindingType,
	) ([]string, error)
	ListBindIDsByKnowledgeBases(
		ctx context.Context,
		knowledgeBaseCodes []string,
		bindType kbentity.BindingType,
	) (map[string][]string, error)
}

type thirdPlatformDocumentResolver interface {
	Resolve(ctx context.Context, input thirdplatform.DocumentResolveInput) (*thirdplatform.DocumentResolveResult, error)
}

type thirdPlatformNodeResolver interface {
	ResolveNode(ctx context.Context, input thirdplatform.NodeResolveInput) (*thirdplatform.NodeResolveResult, error)
}

type originalFileLinkProvider interface {
	GetLink(ctx context.Context, path, method string, expire time.Duration) (string, error)
}

// AppDeps 聚合文档应用服务自身需要的协作对象，避免构造参数过长。
type AppDeps struct {
	ParseService               *documentdomain.ParseService
	ThirdPlatformDocumentPort  thirdPlatformDocumentResolver
	ProjectFilePort            documentdomain.ProjectFileResolver
	ProjectFileMetadataReader  documentdomain.ProjectFileMetadataReader
	ProjectFileContentPort     documentdomain.ProjectFileContentAccessor
	ThirdPlatformProviders     *thirdplatformprovider.Registry
	Tokenizer                  *tokenizer.Service
	SourceBindingRepo          sourceBindingRepository
	KnowledgeBaseBindingRepo   knowledgeBaseBindingRepository
	PermissionReader           kbaccess.PermissionReader
	ThirdPlatformAccess        documentKnowledgeAccessPort
	UserService                *userdomain.DomainService
	SourceBindingCache         sourcebindingrepository.SourceBindingCandidateCache
	SourceCallbackSingleflight sourcebindingrepository.SourceCallbackSingleflight
}

// NewDocumentAppService 创建文档应用层服务
func NewDocumentAppService(
	domainService *documentdomain.DomainService,
	kbService *knowledgebasedomain.DomainService,
	fragmentService *fragdomain.FragmentDomainService,
	deps AppDeps,
	logger *logging.SugaredLogger,
) *DocumentAppService {
	return &DocumentAppService{
		domainService:              domainService,
		kbService:                  kbService,
		fragmentService:            fragmentService,
		parseService:               deps.ParseService,
		thirdPlatformDocumentPort:  deps.ThirdPlatformDocumentPort,
		projectFilePort:            deps.ProjectFilePort,
		projectFileMetadataReader:  deps.ProjectFileMetadataReader,
		projectFileContentPort:     deps.ProjectFileContentPort,
		thirdPlatformProviders:     deps.ThirdPlatformProviders,
		tokenizer:                  deps.Tokenizer,
		permissionReader:           deps.PermissionReader,
		thirdPlatformAccess:        deps.ThirdPlatformAccess,
		userService:                deps.UserService,
		logger:                     logger,
		sourceBindingRepo:          deps.SourceBindingRepo,
		knowledgeBaseBindingRepo:   deps.KnowledgeBaseBindingRepo,
		sourceBindingCache:         deps.SourceBindingCache,
		sourceCallbackSingleflight: deps.SourceCallbackSingleflight,
		resourceLimits:             parseServiceResourceLimits(deps.ParseService),
	}
}

func parseServiceResourceLimits(parseService *documentdomain.ParseService) documentdomain.ResourceLimits {
	if parseService == nil {
		return documentdomain.DefaultResourceLimits()
	}
	return parseService.ResourceLimits()
}

// ResourceLimits 返回文档应用服务当前生效的资源限制。
func (s *DocumentAppService) ResourceLimits() documentdomain.ResourceLimits {
	if s == nil {
		return documentdomain.DefaultResourceLimits()
	}
	return documentdomain.NormalizeResourceLimits(s.resourceLimits)
}

// SetResourceLimits 覆盖文档应用服务资源限制。
func (s *DocumentAppService) SetResourceLimits(limits documentdomain.ResourceLimits) {
	if s == nil {
		return
	}
	s.resourceLimits = documentdomain.NormalizeResourceLimits(limits)
}

// SetSourceBindingCandidateCache 注入 source callback 使用的候选数据缓存。
func (s *DocumentAppService) SetSourceBindingCandidateCache(cache sourcebindingrepository.SourceBindingCandidateCache) {
	if s == nil {
		return
	}
	s.sourceBindingCache = cache
}

// SetSourceCallbackSingleflight 注入 source callback 短锁。
func (s *DocumentAppService) SetSourceCallbackSingleflight(locker sourcebindingrepository.SourceCallbackSingleflight) {
	if s == nil {
		return
	}
	s.sourceCallbackSingleflight = locker
}

// SetUserService 注入用户查询领域服务。
func (s *DocumentAppService) SetUserService(userService *userdomain.DomainService) {
	if s == nil {
		return
	}
	s.userService = userService
}

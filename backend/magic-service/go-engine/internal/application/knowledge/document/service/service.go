// Package docapp 提供文档应用服务实现。
package docapp

import (
	"context"
	"errors"
	"io"
	"sync"
	"time"

	thirdplatformprovider "magic/internal/application/knowledge/shared/thirdplatformprovider"
	documentdomain "magic/internal/domain/knowledge/document/service"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/service"
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

var (
	errDocumentFileNil      = errors.New("document file is nil")
	errDocumentFileURLEmpty = errors.New("document file url is empty")
	errDocumentParseNil     = errors.New("document parse service is nil")
)

const (
	docFileTypeExternal   = "external"
	docFileTypeThirdParty = "third_platform"
)

// DocumentAppService 文档应用层服务
type DocumentAppService struct {
	domainService             documentDomainService
	kbService                 knowledgeBaseReader
	fragmentService           fragmentDocumentService
	parseService              documentParseService
	fileLinkProvider          originalFileLinkProvider
	thirdPlatformDocumentPort thirdPlatformDocumentResolver
	projectFilePort           projectFileResolver
	projectFileMetadataReader projectFileMetadataReader
	projectFileContentPort    projectFileContentAccessor
	thirdPlatformProviders    *thirdplatformprovider.Registry
	tokenizer                 *tokenizer.Service
	syncScheduler             documentSyncScheduler
	thirdFileScheduler        thirdFileRevectorizeScheduler
	logger                    *logging.SugaredLogger
	sourceBindingRepo         sourceBindingRepository
	knowledgeBaseBindingRepo  knowledgeBaseBindingRepository
	sourceResolveCache        sync.Map
}

type documentSyncScheduler interface {
	Schedule(ctx context.Context, input *documentdomain.SyncDocumentInput)
}

type thirdFileRevectorizeScheduler interface {
	Schedule(ctx context.Context, input *documentdomain.ThirdFileRevectorizeInput)
}

type documentMutationService interface {
	Save(ctx context.Context, doc *documentdomain.KnowledgeBaseDocument) error
	Update(ctx context.Context, doc *documentdomain.KnowledgeBaseDocument) error
	Delete(ctx context.Context, id int64) error
	UpdateSyncStatus(ctx context.Context, doc *documentdomain.KnowledgeBaseDocument) error
}

type documentSyncStateService interface {
	MarkSyncing(ctx context.Context, doc *documentdomain.KnowledgeBaseDocument) error
	MarkSynced(ctx context.Context, doc *documentdomain.KnowledgeBaseDocument, wordCount int) error
	MarkSyncedWithContent(ctx context.Context, doc *documentdomain.KnowledgeBaseDocument, content string) error
	MarkSyncFailed(ctx context.Context, doc *documentdomain.KnowledgeBaseDocument, message string) error
	MarkSyncFailedWithError(ctx context.Context, doc *documentdomain.KnowledgeBaseDocument, reason string, err error) error
}

type documentLookupService interface {
	Show(ctx context.Context, code string) (*documentdomain.KnowledgeBaseDocument, error)
	ShowByCodeAndKnowledgeBase(ctx context.Context, code, knowledgeBaseCode string) (*documentdomain.KnowledgeBaseDocument, error)
	FindByKnowledgeBaseAndThirdFile(ctx context.Context, knowledgeBaseCode, thirdPlatformType, thirdFileID string) (*documentdomain.KnowledgeBaseDocument, error)
	FindByKnowledgeBaseAndProjectFile(ctx context.Context, knowledgeBaseCode string, projectFileID int64) (*documentdomain.KnowledgeBaseDocument, error)
	ListByProjectFileInOrg(ctx context.Context, organizationCode string, projectFileID int64) ([]*documentdomain.KnowledgeBaseDocument, error)
	ResolveThirdFileDocumentPlan(ctx context.Context, input documentdomain.ThirdFileDocumentPlanInput) (documentdomain.ThirdFileDocumentPlan, error)
	ListByThirdFileInOrg(ctx context.Context, organizationCode, thirdPlatformType, thirdFileID string) ([]*documentdomain.KnowledgeBaseDocument, error)
	ListByKnowledgeBaseAndProject(ctx context.Context, knowledgeBaseCode string, projectID int64) ([]*documentdomain.KnowledgeBaseDocument, error)
}

type documentQueryService interface {
	List(ctx context.Context, query *documentdomain.Query) ([]*documentdomain.KnowledgeBaseDocument, int64, error)
	ListByKnowledgeBase(ctx context.Context, knowledgeBaseCode string, offset, limit int) ([]*documentdomain.KnowledgeBaseDocument, int64, error)
	CountByKnowledgeBaseCodes(ctx context.Context, organizationCode string, knowledgeBaseCodes []string) (map[string]int64, error)
}

type documentDomainService interface {
	documentMutationService
	documentSyncStateService
	documentLookupService
	documentQueryService
}

type knowledgeBaseReader interface {
	ShowByCodeAndOrg(ctx context.Context, code, orgCode string) (*knowledgebasedomain.KnowledgeBase, error)
	Show(ctx context.Context, code string) (*knowledgebasedomain.KnowledgeBase, error)
	List(ctx context.Context, query *knowledgebasedomain.Query) ([]*knowledgebasedomain.KnowledgeBase, int64, error)
	ResolveRuntimeRoute(ctx context.Context, kb *knowledgebasedomain.KnowledgeBase) sharedroute.ResolvedRoute
}

type fragmentDocumentWriter interface {
	SaveBatch(ctx context.Context, fragments []*fragmodel.KnowledgeBaseFragment) error
	Update(ctx context.Context, fragment *fragmodel.KnowledgeBaseFragment) error
	UpdateBatch(ctx context.Context, fragments []*fragmodel.KnowledgeBaseFragment) error
}

type fragmentDocumentReader interface {
	List(ctx context.Context, query *fragmodel.Query) ([]*fragmodel.KnowledgeBaseFragment, int64, error)
	ListByDocument(ctx context.Context, knowledgeCode, documentCode string, offset, limit int) ([]*fragmodel.KnowledgeBaseFragment, int64, error)
	ListExistingPointIDs(ctx context.Context, collectionName string, pointIDs []string) (map[string]struct{}, error)
}

type fragmentDocumentSyncer interface {
	SyncFragmentBatch(ctx context.Context, kb any, fragments []*fragmodel.KnowledgeBaseFragment, businessParams *ctxmeta.BusinessParams) error
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
	ResolveFileType(ctx context.Context, target string) (string, error)
}

type sourceBindingRepository interface {
	ListRealtimeProjectBindingsByProject(ctx context.Context, organizationCode string, projectID int64) ([]sourcebindingdomain.Binding, error)
	UpsertSourceItem(ctx context.Context, item sourcebindingdomain.SourceItem) (*sourcebindingdomain.SourceItem, error)
}

type knowledgeBaseBindingRepository interface {
	ListBindIDsByKnowledgeBase(
		ctx context.Context,
		knowledgeBaseCode string,
		bindType knowledgebasedomain.BindingType,
	) ([]string, error)
	ListBindIDsByKnowledgeBases(
		ctx context.Context,
		knowledgeBaseCodes []string,
		bindType knowledgebasedomain.BindingType,
	) (map[string][]string, error)
}

type thirdPlatformDocumentResolver interface {
	Resolve(ctx context.Context, input thirdplatform.DocumentResolveInput) (*thirdplatform.DocumentResolveResult, error)
}

type projectFileResolver = documentdomain.ProjectFileResolver

type projectFileMetadataReader = documentdomain.ProjectFileMetadataReader

type projectFileContentAccessor = documentdomain.ProjectFileContentAccessor

type originalFileLinkProvider interface {
	GetLink(ctx context.Context, path, method string, expire time.Duration) (string, error)
}

// AppDeps 聚合文档应用服务自身需要的协作对象，避免构造参数过长。
type AppDeps struct {
	ParseService              *documentdomain.ParseService
	ThirdPlatformDocumentPort thirdPlatformDocumentResolver
	ProjectFilePort           projectFileResolver
	ProjectFileMetadataReader projectFileMetadataReader
	ProjectFileContentPort    projectFileContentAccessor
	ThirdPlatformProviders    *thirdplatformprovider.Registry
	Tokenizer                 *tokenizer.Service
	SourceBindingRepo         sourceBindingRepository
	KnowledgeBaseBindingRepo  knowledgeBaseBindingRepository
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
		domainService:             domainService,
		kbService:                 kbService,
		fragmentService:           fragmentService,
		parseService:              deps.ParseService,
		thirdPlatformDocumentPort: deps.ThirdPlatformDocumentPort,
		projectFilePort:           deps.ProjectFilePort,
		projectFileMetadataReader: deps.ProjectFileMetadataReader,
		projectFileContentPort:    deps.ProjectFileContentPort,
		thirdPlatformProviders:    deps.ThirdPlatformProviders,
		tokenizer:                 deps.Tokenizer,
		logger:                    logger,
		sourceBindingRepo:         deps.SourceBindingRepo,
		knowledgeBaseBindingRepo:  deps.KnowledgeBaseBindingRepo,
	}
}

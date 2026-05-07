// Package kbapp 提供知识库应用层服务。
package kbapp

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	userdomain "magic/internal/domain/contact/user"
	kbaccess "magic/internal/domain/knowledge/access/service"
	docentity "magic/internal/domain/knowledge/document/entity"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingrepository "magic/internal/domain/knowledge/sourcebinding/repository"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/projectfile"
	thirdfilemappingpkg "magic/internal/pkg/thirdfilemapping"
	"magic/internal/pkg/thirdplatform"
)

var (
	// ErrEmbeddingModelRequired 表示必须提供 embedding 模型。
	ErrEmbeddingModelRequired = shared.ErrEmbeddingModelRequired
	// ErrEmbeddingModelNotAllowed 表示 embedding 模型不被允许。
	ErrEmbeddingModelNotAllowed = shared.ErrEmbeddingModelNotAllowed
	// ErrKnowledgeBaseNotFound 表示知识库未找到。
	ErrKnowledgeBaseNotFound = shared.ErrKnowledgeBaseNotFound
	// ErrKnowledgeBaseCountNegative 表示计数字段为负数。
	ErrKnowledgeBaseCountNegative = errors.New("knowledge base count must be non-negative")
	// ErrKnowledgeBaseCountOverflow 表示计数字段超出 int 范围。
	ErrKnowledgeBaseCountOverflow = errors.New("knowledge base count exceeds int range")
	// ErrKnowledgeBaseDocumentFlowRequired 表示缺少知识库文档协作 flow app。
	ErrKnowledgeBaseDocumentFlowRequired = errors.New("knowledge base document flow app is required")
	// ErrKnowledgeBaseDocumentManagerRequired 兼容旧调用点，等价于 ErrKnowledgeBaseDocumentFlowRequired。
	ErrKnowledgeBaseDocumentManagerRequired = ErrKnowledgeBaseDocumentFlowRequired
	// ErrKnowledgeBaseProjectFileResolverRequired 表示缺少项目文件解析端口依赖。
	ErrKnowledgeBaseProjectFileResolverRequired = errors.New("knowledge base project file resolver is required")
	// ErrKnowledgeBaseTaskFileDomainRequired 表示缺少 task file 领域服务依赖。
	ErrKnowledgeBaseTaskFileDomainRequired = errors.New("knowledge base task file domain service is required")
	// ErrKnowledgeBaseSourceBindingRepositoryRequired 表示缺少来源绑定仓储依赖。
	ErrKnowledgeBaseSourceBindingRepositoryRequired = errors.New("knowledge base source binding repository is required")
	// ErrKnowledgeBaseBindingRepositoryRequired 表示缺少知识库绑定对象仓储依赖。
	ErrKnowledgeBaseBindingRepositoryRequired = errors.New("knowledge base binding repository is required")
	// ErrKnowledgeBaseThirdPlatformExpanderRequired 表示缺少第三方来源展开端口依赖。
	ErrKnowledgeBaseThirdPlatformExpanderRequired = errors.New("knowledge base third-platform expander is required")
	// ErrKnowledgeBaseSuperMagicAgentReaderRequired 表示缺少数字员工只读依赖。
	ErrKnowledgeBaseSuperMagicAgentReaderRequired = errors.New("knowledge base super magic agent reader is required")
	// ErrKnowledgeBaseSuperMagicAgentAccessCheckerRequired 表示缺少数字员工可管理性校验依赖。
	ErrKnowledgeBaseSuperMagicAgentAccessCheckerRequired = errors.New("knowledge base super magic agent access checker is required")
	// ErrKnowledgeBasePermissionReaderRequired 表示缺少知识库权限读取依赖。
	ErrKnowledgeBasePermissionReaderRequired = errors.New("knowledge base permission reader is required")
	// ErrTeamshareTempCodeMapperRequired 表示缺少 Teamshare 临时 code 映射依赖。
	ErrTeamshareTempCodeMapperRequired = errors.New("teamshare temp code mapper is required")
	// ErrTeamshareRebuildTriggerRequired 表示缺少 Teamshare 重建触发依赖。
	ErrTeamshareRebuildTriggerRequired = errors.New("teamshare rebuild trigger is required")
	// ErrOfficialOrganizationMemberCheckerRequired 表示缺少官方组织校验依赖。
	ErrOfficialOrganizationMemberCheckerRequired = errors.New("official organization member checker is required")
	// ErrKnowledgeBasePermissionDenied 表示当前用户无知识库访问权限。
	ErrKnowledgeBasePermissionDenied = errors.New("knowledge base permission denied")
	// ErrKnowledgeBaseBusinessIDAlreadyExists 表示同组织 business_id 已被其他知识库占用。
	ErrKnowledgeBaseBusinessIDAlreadyExists = errors.New("knowledge base business_id already exists")
	// ErrKnowledgeBaseUserNotFound 表示写入知识库的 Magic 用户不存在。
	ErrKnowledgeBaseUserNotFound = errors.New("knowledge base user not found")
	// ErrOfficialOrganizationMemberRequired 表示当前组织不允许执行运维操作。
	ErrOfficialOrganizationMemberRequired = errors.New("official organization member is required")
	// ErrKnowledgeBaseFragmentRepairRequired 表示缺少历史片段修复依赖。
	ErrKnowledgeBaseFragmentRepairRequired = errors.New("knowledge base fragment repair service is required")
	// ErrMissingProjectSourceBindings 表示 project 类型知识库未补来源绑定。
	ErrMissingProjectSourceBindings = errors.New("missing_project_source_bindings")
	// ErrUnsupportedSourceBindingProvider 表示当前来源提供方不受支持。
	ErrUnsupportedSourceBindingProvider = errors.New("unsupported source binding provider")
	// ErrInvalidProjectRootRef 表示 project 绑定的 root_ref 非法。
	ErrInvalidProjectRootRef = sourcebindingdomain.ErrInvalidProjectRootRef
	// ErrInvalidSourceBindingNodesSourceType 表示来源绑定节点查询 source_type 非法。
	ErrInvalidSourceBindingNodesSourceType = errors.New("invalid source binding nodes source_type")
	// ErrInvalidSourceBindingNodesProvider 表示来源绑定节点查询 provider 非法。
	ErrInvalidSourceBindingNodesProvider = errors.New("invalid source binding nodes provider")
	// ErrInvalidSourceBindingNodesParentType 表示来源绑定节点查询 parent_type 非法。
	ErrInvalidSourceBindingNodesParentType = errors.New("invalid source binding nodes parent_type")
	// ErrSourceBindingNodesParentRefRequired 表示来源绑定节点查询缺少 parent_ref。
	ErrSourceBindingNodesParentRefRequired = errors.New("source binding nodes parent_ref is required")
	// ErrSourceBindingSemanticMismatch 表示来源类型与绑定 provider/root_type 不匹配。
	ErrSourceBindingSemanticMismatch = sourcebindingdomain.ErrSemanticMismatch
	// ErrSourceBindingTargetTypeInvalid 表示绑定 target_type 非法。
	ErrSourceBindingTargetTypeInvalid = sourcebindingdomain.ErrTargetTypeInvalid
	// ErrSourceBindingSyncModeInvalid 表示绑定 sync_mode 非法。
	ErrSourceBindingSyncModeInvalid = sourcebindingdomain.ErrSyncModeInvalid
	// ErrSourceBindingTargetsNotAllowed 表示当前来源类型不允许带来源绑定。
	ErrSourceBindingTargetsNotAllowed = sourcebindingdomain.ErrTargetsNotAllowed
	// ErrUnsupportedRepairThirdPlatform 表示 repair 当前不支持指定平台。
	ErrUnsupportedRepairThirdPlatform = errors.New("unsupported repair third platform type")
	// ErrRepairSourceBindingsOrganizationRequired 表示 repair 缺少组织编码。
	ErrRepairSourceBindingsOrganizationRequired = errors.New("organization code is required")
	// ErrRepairSourceBindingDocumentNotMapped 表示未找到第三方文件对应的托管文档。
	ErrRepairSourceBindingDocumentNotMapped = errors.New("no managed document mapped for third file")
	// ErrInvalidAgentCode 表示数字员工编码非法。
	ErrInvalidAgentCode = errors.New("invalid agent code")
	// ErrSuperMagicAgentNotFound 表示数字员工不存在。
	ErrSuperMagicAgentNotFound = errors.New("super magic agent not found")
	// ErrSuperMagicAgentNotManageable 表示数字员工当前用户不可管理。
	ErrSuperMagicAgentNotManageable = errors.New("super magic agent is not manageable")
	// ErrDigitalEmployeeSourceTypeRequired 表示数字员工知识库必须显式传 source_type。
	ErrDigitalEmployeeSourceTypeRequired = kbentity.ErrDigitalEmployeeSourceTypeRequired
	// ErrAmbiguousFlowSourceType 表示 flow 缺失 source_type 时无法从 binding 唯一推断。
	ErrAmbiguousFlowSourceType = kbentity.ErrAmbiguousFlowSourceType
)

const (
	knowledgeBaseSyncModeCreate = "create"
	knowledgeBaseSyncModeResync = "resync"
	workspaceTypeNormal         = "normal"
	workspaceTypeShared         = "shared"
)

type fragmentCountProvider interface {
	CountByKnowledgeBase(ctx context.Context, knowledgeCode string) (int64, error)
	CountSyncedByKnowledgeBase(ctx context.Context, knowledgeCode string) (int64, error)
}

type fragmentCountStatsProvider interface {
	CountStatsByKnowledgeBase(ctx context.Context, knowledgeCode string) (total, synced int64, err error)
}

type fragmentCountBatchStatsProvider interface {
	CountStatsByKnowledgeBases(ctx context.Context, knowledgeCodes []string) (map[string]int64, map[string]int64, error)
}

type knowledgeBaseDomainService interface {
	PrepareForSave(ctx context.Context, kb *kbentity.KnowledgeBase) error
	Save(ctx context.Context, kb *kbentity.KnowledgeBase) error
	Update(ctx context.Context, kb *kbentity.KnowledgeBase) error
	UpdateProgress(ctx context.Context, kb *kbentity.KnowledgeBase) error
	ShowByCodeAndOrg(ctx context.Context, code, orgCode string) (*kbentity.KnowledgeBase, error)
	List(ctx context.Context, query *kbrepository.Query) ([]*kbentity.KnowledgeBase, int64, error)
	Destroy(ctx context.Context, kb *kbentity.KnowledgeBase) error
	DeleteVectorData(ctx context.Context, kb *kbentity.KnowledgeBase) error
	ResolveRuntimeRoute(ctx context.Context, kb *kbentity.KnowledgeBase) sharedroute.ResolvedRoute
}

// ManagedDocument 表示知识库编排所需的最小托管文档信息。
type ManagedDocument struct {
	Code              string
	KnowledgeBaseCode string
	SourceBindingID   int64
	SourceItemID      int64
	ProjectID         int64
	ProjectFileID     int64
	SyncStatus        shared.SyncStatus
	DocumentFile      *docentity.File
}

// CreateManagedDocumentInput 表示知识库创建托管文档时的最小输入。
type CreateManagedDocumentInput struct {
	OrganizationCode  string
	UserID            string
	KnowledgeBaseCode string
	Code              string
	SourceBindingID   int64
	SourceItemID      int64
	ProjectID         int64
	ProjectFileID     int64
	AutoAdded         bool
	Name              string
	Description       string
	DocType           int
	DocMetadata       map[string]any
	DocumentFile      *docentity.File
	ThirdPlatformType string
	ThirdFileID       string
	EmbeddingModel    string
	VectorDB          string
	RetrieveConfig    *shared.RetrieveConfig
	FragmentConfig    *shared.FragmentConfig
	EmbeddingConfig   *shared.EmbeddingConfig
	VectorDBConfig    *shared.VectorDBConfig
	AutoSync          bool
}

// SyncDocumentInput 表示知识库触发文档同步时的输入。
type SyncDocumentInput struct {
	OrganizationCode  string
	KnowledgeBaseCode string
	Code              string
	Mode              string
	BusinessParams    *ctxmeta.BusinessParams
}

type (
	knowledgeBaseManagedDocument            = ManagedDocument
	knowledgeBaseCreateManagedDocumentInput = CreateManagedDocumentInput
	knowledgeBaseSyncInput                  = SyncDocumentInput
)

type sourceBindingRepository interface {
	sourcebindingrepository.Repository
	DeleteBindingsByKnowledgeBase(ctx context.Context, knowledgeBaseCode string) error
}

type superMagicProjectWorkspaceReader interface {
	ListWorkspaceIDsByProjectIDs(
		ctx context.Context,
		organizationCode string,
		projectIDs []int64,
	) (map[int64]int64, error)
	ListSharedProjectIDsByProjectIDs(
		ctx context.Context,
		organizationCode string,
		userID string,
		projectIDs []int64,
	) (map[int64]struct{}, error)
}

type knowledgeBaseBindingRepository interface {
	ReplaceBindings(
		ctx context.Context,
		knowledgeBaseCode string,
		bindType kbentity.BindingType,
		organizationCode string,
		userID string,
		bindIDs []string,
	) ([]string, error)
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

type superMagicAgentReader interface {
	ListExistingCodesByOrg(ctx context.Context, organizationCode string, codes []string) (map[string]struct{}, error)
}

type superMagicAgentAccessChecker interface {
	ListManageableCodes(
		ctx context.Context,
		organizationCode string,
		userID string,
		codes []string,
	) (map[string]struct{}, error)
}

type (
	knowledgeBasePermissionReader = kbaccess.PermissionReader
	knowledgeBasePermissionWriter = kbaccess.LocalPermissionWriter
)

type officialOrganizationMemberChecker interface {
	IsOfficialOrganizationMember(ctx context.Context, organizationCode string) (bool, error)
}

type fragmentRepairService interface {
	ListThirdFileRepairOrganizationCodes(ctx context.Context) ([]string, error)
	ListThirdFileRepairGroups(ctx context.Context, query thirdfilemappingpkg.RepairGroupQuery) ([]*thirdfilemappingpkg.RepairGroup, error)
	BackfillDocumentCodeByThirdFile(ctx context.Context, input thirdfilemappingpkg.BackfillByThirdFileInput) (int64, error)
}

type thirdPlatformBindingExpander interface {
	Expand(
		ctx context.Context,
		organizationCode string,
		userID string,
		documentFiles []map[string]any,
	) ([]*docentity.File, error)
	Resolve(
		ctx context.Context,
		input thirdplatform.DocumentResolveInput,
	) (*thirdplatform.DocumentResolveResult, error)
	ListKnowledgeBases(
		ctx context.Context,
		input thirdplatform.KnowledgeBaseListInput,
	) ([]thirdplatform.KnowledgeBaseItem, error)
	ListTreeNodes(
		ctx context.Context,
		input thirdplatform.TreeNodeListInput,
	) ([]thirdplatform.TreeNode, error)
}

type projectFileResolver interface {
	Resolve(ctx context.Context, projectFileID int64) (*projectfile.ResolveResult, error)
	ListByProject(ctx context.Context, projectID int64) ([]projectfile.ListItem, error)
	ListWorkspaces(
		ctx context.Context,
		organizationCode string,
		userID string,
		offset int,
		limit int,
	) (*projectfile.WorkspacePage, error)
	ListProjects(
		ctx context.Context,
		organizationCode string,
		userID string,
		workspaceID int64,
		offset int,
		limit int,
	) (*projectfile.ProjectPage, error)
	ListTreeNodes(ctx context.Context, parentType string, parentRef int64) ([]projectfile.TreeNode, error)
}

type taskFileService interface {
	IsVisibleFile(ctx context.Context, projectFileID int64) (bool, error)
	LoadVisibleMeta(ctx context.Context, projectFileID int64) (*projectfile.Meta, error)
	ListVisibleTreeNodesByProject(ctx context.Context, projectID int64) ([]projectfile.TreeNode, error)
	ListVisibleTreeNodesByFolder(ctx context.Context, folderID int64) ([]projectfile.TreeNode, error)
	ListVisibleLeafFileIDsByProject(ctx context.Context, projectID int64) ([]int64, error)
	ListVisibleLeafFileIDsByFolder(ctx context.Context, folderID int64) ([]int64, error)
	WalkVisibleLeafFileIDsByProject(ctx context.Context, projectID int64, visitor func(projectFileID int64) (bool, error)) error
	WalkVisibleLeafFileIDsByFolder(ctx context.Context, folderID int64, visitor func(projectFileID int64) (bool, error)) error
}

type destroyCoordinator interface {
	Destroy(ctx context.Context, knowledgeBaseID int64, knowledgeBaseCode string) error
}

type writeCoordinator interface {
	Create(
		ctx context.Context,
		kb *kbentity.KnowledgeBase,
		sourceBindings []sourcebindingdomain.Binding,
		agentCodes []string,
	) ([]sourcebindingdomain.Binding, error)
	Update(
		ctx context.Context,
		kb *kbentity.KnowledgeBase,
		replaceSourceBindings bool,
		sourceBindings []sourcebindingdomain.Binding,
		replaceAgentBindings bool,
		agentCodes []string,
	) ([]sourcebindingdomain.Binding, error)
	UpdateWithAppliedSourceBindings(
		ctx context.Context,
		kb *kbentity.KnowledgeBase,
		sourceBindingInput sourcebindingrepository.ApplyKnowledgeBaseBindingsInput,
		replaceAgentBindings bool,
		agentCodes []string,
	) ([]sourcebindingdomain.Binding, error)
}

// KnowledgeBaseAppService 知识库应用层服务
type KnowledgeBaseAppService struct {
	domainService                knowledgeBaseDomainService
	documentFlow                 *KnowledgeBaseDocumentFlowApp
	sourceBindingRepo            sourceBindingRepository
	destroyCoordinator           destroyCoordinator
	writeCoordinator             writeCoordinator
	permissionReader             knowledgeBasePermissionReader
	permissionWriter             knowledgeBasePermissionWriter
	officialOrgChecker           officialOrganizationMemberChecker
	projectFilePort              projectFileResolver
	taskFileService              taskFileService
	thirdPlatformExpander        thirdPlatformBindingExpander
	teamshareTempCodes           TeamshareTempCodeMapper
	knowledgeBaseBindings        knowledgeBaseBindingRepository
	superMagicAgents             superMagicAgentReader
	superMagicAgentAccess        superMagicAgentAccessChecker
	superMagicProjectReader      superMagicProjectWorkspaceReader
	fragmentCounter              fragmentCountProvider
	fragmentRepair               fragmentRepairService
	sourceBindingTreeRootCache   SourceBindingTreeRootCache
	sourceBindingTreeRootLocator *sourceBindingTreeRootLocator
	userService                  *userdomain.DomainService
	logger                       *logging.SugaredLogger
	defaultEmbeddingModel        string
}

type knowledgeBasePermissionOperation = kbaccess.Operation

const (
	knowledgeBasePermissionNone  = kbaccess.OperationNone
	knowledgeBasePermissionOwner = kbaccess.OperationOwner
	knowledgeBasePermissionAdmin = kbaccess.OperationAdmin
	knowledgeBasePermissionRead  = kbaccess.OperationRead
	knowledgeBasePermissionEdit  = kbaccess.OperationEdit
)

// NewKnowledgeBaseAppService 创建知识库应用层服务
func NewKnowledgeBaseAppService(
	domainService *knowledgebasedomain.DomainService,
	fragmentCounter fragmentCountProvider,
	logger *logging.SugaredLogger,
	defaultEmbeddingModel string,
) *KnowledgeBaseAppService {
	var fragmentRepair fragmentRepairService
	if repair, ok := any(fragmentCounter).(fragmentRepairService); ok {
		fragmentRepair = repair
	} else if repair, ok := any(fragmentCounter).(*fragdomain.FragmentDomainService); ok {
		fragmentRepair = repair
	}

	return &KnowledgeBaseAppService{
		domainService:                domainService,
		fragmentCounter:              fragmentCounter,
		fragmentRepair:               fragmentRepair,
		sourceBindingTreeRootLocator: newSourceBindingTreeRootLocator(),
		logger:                       logger,
		defaultEmbeddingModel:        defaultEmbeddingModel,
	}
}

// SetProjectFileResolver 注入项目文件解析端口。
func (s *KnowledgeBaseAppService) SetProjectFileResolver(port projectFileResolver) {
	if s == nil {
		return
	}
	s.projectFilePort = port
}

// SetTaskFileService 注入 task file 领域服务。
func (s *KnowledgeBaseAppService) SetTaskFileService(domainSvc taskFileService) {
	if s == nil {
		return
	}
	s.taskFileService = domainSvc
}

// SetSourceBindingRepository 注入来源绑定仓储。
func (s *KnowledgeBaseAppService) SetSourceBindingRepository(repo sourceBindingRepository) {
	if s == nil {
		return
	}
	s.sourceBindingRepo = repo
}

// SetDestroyCoordinator 注入知识库删除事务协调器。
func (s *KnowledgeBaseAppService) SetDestroyCoordinator(coordinator destroyCoordinator) {
	if s == nil {
		return
	}
	s.destroyCoordinator = coordinator
}

// SetWriteCoordinator 注入知识库写入事务协调器。
func (s *KnowledgeBaseAppService) SetWriteCoordinator(coordinator writeCoordinator) {
	if s == nil {
		return
	}
	s.writeCoordinator = coordinator
}

// SetKnowledgeBasePermissionReader 注入知识库权限读取端口。
func (s *KnowledgeBaseAppService) SetKnowledgeBasePermissionReader(reader knowledgeBasePermissionReader) {
	if s == nil {
		return
	}
	s.permissionReader = reader
}

// SetKnowledgeBasePermissionWriter 注入知识库权限写入端口。
func (s *KnowledgeBaseAppService) SetKnowledgeBasePermissionWriter(writer knowledgeBasePermissionWriter) {
	if s == nil {
		return
	}
	s.permissionWriter = writer
}

// SetOfficialOrganizationMemberChecker 注入官方组织校验端口。
func (s *KnowledgeBaseAppService) SetOfficialOrganizationMemberChecker(checker officialOrganizationMemberChecker) {
	if s == nil {
		return
	}
	s.officialOrgChecker = checker
}

// SetThirdPlatformExpander 注入第三方来源展开端口。
func (s *KnowledgeBaseAppService) SetThirdPlatformExpander(expander thirdPlatformBindingExpander) {
	if s == nil {
		return
	}
	s.thirdPlatformExpander = expander
}

// SetTeamshareTempCodeMapper 注入 Teamshare 临时 knowledge_code 映射依赖。
func (s *KnowledgeBaseAppService) SetTeamshareTempCodeMapper(mapper TeamshareTempCodeMapper) {
	if s == nil {
		return
	}
	s.teamshareTempCodes = mapper
}

// SetSourceBindingTreeRootCache 注入企业知识库根目录树索引缓存。
func (s *KnowledgeBaseAppService) SetSourceBindingTreeRootCache(cache SourceBindingTreeRootCache) {
	if s == nil {
		return
	}
	s.sourceBindingTreeRootCache = cache
}

// SetKnowledgeBaseBindingRepository 注入知识库绑定对象仓储。
func (s *KnowledgeBaseAppService) SetKnowledgeBaseBindingRepository(repo knowledgeBaseBindingRepository) {
	if s == nil {
		return
	}
	s.knowledgeBaseBindings = repo
}

// SetSuperMagicAgentReader 注入数字员工只读端口。
func (s *KnowledgeBaseAppService) SetSuperMagicAgentReader(reader superMagicAgentReader) {
	if s == nil {
		return
	}
	s.superMagicAgents = reader
	if accessChecker, ok := reader.(superMagicAgentAccessChecker); ok {
		s.superMagicAgentAccess = accessChecker
	}
}

// SetSuperMagicAgentAccessChecker 注入数字员工可管理性校验端口。
func (s *KnowledgeBaseAppService) SetSuperMagicAgentAccessChecker(checker superMagicAgentAccessChecker) {
	if s == nil {
		return
	}
	s.superMagicAgentAccess = checker
}

// SetSuperMagicProjectReader 注入 super magic project 领域服务。
func (s *KnowledgeBaseAppService) SetSuperMagicProjectReader(reader superMagicProjectWorkspaceReader) {
	if s == nil {
		return
	}
	s.superMagicProjectReader = reader
}

// SetFragmentRepairService 注入历史片段修复依赖。
func (s *KnowledgeBaseAppService) SetFragmentRepairService(repair fragmentRepairService) {
	if s == nil {
		return
	}
	s.fragmentRepair = repair
}

// SetUserService 注入 Magic 用户查询领域服务。
func (s *KnowledgeBaseAppService) SetUserService(userService *userdomain.DomainService) {
	if s == nil {
		return
	}
	s.userService = userService
}

func (s *KnowledgeBaseAppService) entityToDTO(e *kbentity.KnowledgeBase) *kbdto.KnowledgeBaseDTO {
	return EntityToDTO(e)
}

func (s *KnowledgeBaseAppService) entityToDTOWithContext(
	ctx context.Context,
	e *kbentity.KnowledgeBase,
	userID string,
) (*kbdto.KnowledgeBaseDTO, error) {
	dto := s.entityToDTO(e)
	if dto == nil {
		return nil, shared.ErrKnowledgeBaseNotFound
	}
	if s == nil || s.domainService == nil {
		return dto, nil
	}

	route := s.domainService.ResolveRuntimeRoute(ctx, e)
	dto = ApplyResolvedModel(dto, route.Model)
	agentCodes, err := s.listKnowledgeBaseAgentCodes(ctx, e.Code)
	if err != nil {
		return nil, err
	}
	return s.attachKnowledgeBaseSourceBindings(
		ctx,
		applyKnowledgeBaseBindingInfo(dto, agentCodes, knowledgeBaseTypeFromKnowledgeBase(e)),
		e.Code,
		userID,
	)
}

func (s *KnowledgeBaseAppService) entityToDTOWithResolvedModel(e *kbentity.KnowledgeBase, effectiveModel string) *kbdto.KnowledgeBaseDTO {
	dto := s.entityToDTO(e)
	if dto == nil {
		return nil
	}
	return ApplyResolvedModel(dto, effectiveModel)
}

func (s *KnowledgeBaseAppService) entityToDTOWithKnownBindings(
	ctx context.Context,
	e *kbentity.KnowledgeBase,
	userID string,
	agentCodes []string,
) (*kbdto.KnowledgeBaseDTO, error) {
	if e == nil {
		return nil, ErrKnowledgeBaseNotFound
	}
	return s.attachKnowledgeBaseSourceBindings(
		ctx,
		applyKnowledgeBaseBindingInfo(
			s.entityToDTOWithResolvedModel(e, s.domainService.ResolveRuntimeRoute(ctx, e).Model),
			agentCodes,
			knowledgeBaseTypeFromKnowledgeBase(e),
		),
		e.Code,
		userID,
	)
}

func (s *KnowledgeBaseAppService) attachKnowledgeBaseSourceBindings(
	ctx context.Context,
	dto *kbdto.KnowledgeBaseDTO,
	knowledgeBaseCode string,
	userID string,
) (*kbdto.KnowledgeBaseDTO, error) {
	if dto == nil {
		return nil, ErrKnowledgeBaseNotFound
	}
	if s == nil || s.sourceBindingRepo == nil {
		return dto, nil
	}

	bindings, err := s.sourceBindingRepo.ListBindingsByKnowledgeBase(ctx, knowledgeBaseCode)
	if err != nil {
		return nil, fmt.Errorf("list knowledge base source bindings: %w", err)
	}
	dto.SourceBindings = s.toKnowledgeBaseSourceBindingDTOs(ctx, dto.OrganizationCode, userID, bindings)
	return dto, nil
}

func (s *KnowledgeBaseAppService) listKnowledgeBaseSourceBindingDTOs(
	ctx context.Context,
	organizationCode string,
	userID string,
	knowledgeBaseCodes []string,
) (map[string][]kbdto.SourceBindingDTO, error) {
	if len(knowledgeBaseCodes) == 0 || s == nil || s.sourceBindingRepo == nil {
		return map[string][]kbdto.SourceBindingDTO{}, nil
	}

	bindingsByKnowledgeBase, err := s.sourceBindingRepo.ListBindingsByKnowledgeBases(ctx, knowledgeBaseCodes)
	if err != nil {
		return nil, fmt.Errorf("list knowledge base source bindings: %w", err)
	}

	projectIDs := collectProjectRootIDs(flattenBindings(bindingsByKnowledgeBase))
	workspaceIDsByProject := s.loadWorkspaceIDsByProjectIDs(ctx, organizationCode, projectIDs)
	sharedProjectIDs := s.loadSharedProjectIDsByProjectIDs(ctx, organizationCode, userID, projectIDs)
	result := make(map[string][]kbdto.SourceBindingDTO, len(bindingsByKnowledgeBase))
	for knowledgeBaseCode, bindings := range bindingsByKnowledgeBase {
		result[knowledgeBaseCode] = toKnowledgeBaseSourceBindingDTOs(bindings, workspaceIDsByProject, sharedProjectIDs)
	}
	return result, nil
}

func (s *KnowledgeBaseAppService) toKnowledgeBaseSourceBindingDTOs(
	ctx context.Context,
	organizationCode string,
	userID string,
	bindings []sourcebindingdomain.Binding,
) []kbdto.SourceBindingDTO {
	projectIDs := collectProjectRootIDs(bindings)
	workspaceIDsByProject := s.loadWorkspaceIDsByProjectIDs(ctx, organizationCode, projectIDs)
	sharedProjectIDs := s.loadSharedProjectIDsByProjectIDs(ctx, organizationCode, userID, projectIDs)
	return toKnowledgeBaseSourceBindingDTOs(bindings, workspaceIDsByProject, sharedProjectIDs)
}

func toKnowledgeBaseSourceBindingDTOs(
	bindings []sourcebindingdomain.Binding,
	workspaceIDsByProject map[int64]int64,
	sharedProjectIDs map[int64]struct{},
) []kbdto.SourceBindingDTO {
	if len(bindings) == 0 {
		return nil
	}

	result := make([]kbdto.SourceBindingDTO, 0, len(bindings))
	for _, binding := range bindings {
		targets := make([]kbdto.SourceBindingTargetDTO, 0, len(binding.Targets))
		for _, target := range binding.Targets {
			targets = append(targets, kbdto.SourceBindingTargetDTO{
				TargetType: target.TargetType,
				TargetRef:  target.TargetRef,
			})
		}
		result = append(result, kbdto.SourceBindingDTO{
			Provider:      binding.Provider,
			RootType:      binding.RootType,
			RootRef:       binding.RootRef,
			WorkspaceID:   lookupProjectWorkspaceID(binding, workspaceIDsByProject),
			WorkspaceType: lookupProjectWorkspaceType(binding, workspaceIDsByProject, sharedProjectIDs),
			SyncMode:      binding.SyncMode,
			Enabled:       binding.Enabled,
			SyncConfig:    cloneMap(binding.SyncConfig),
			Targets:       targets,
		})
	}
	return result
}

func (s *KnowledgeBaseAppService) loadWorkspaceIDsByProjectIDs(
	ctx context.Context,
	organizationCode string,
	projectIDs []int64,
) map[int64]int64 {
	if len(projectIDs) == 0 || s == nil || s.superMagicProjectReader == nil {
		return map[int64]int64{}
	}

	workspaceIDsByProject, err := s.superMagicProjectReader.ListWorkspaceIDsByProjectIDs(ctx, organizationCode, projectIDs)
	if err != nil {
		if s.logger != nil {
			s.logger.KnowledgeWarnContext(
				ctx,
				"list workspace ids by project ids failed",
				"organization_code", organizationCode,
				"project_ids", projectIDs,
				"error", err,
			)
		}
		return map[int64]int64{}
	}
	return workspaceIDsByProject
}

func (s *KnowledgeBaseAppService) loadSharedProjectIDsByProjectIDs(
	ctx context.Context,
	organizationCode string,
	userID string,
	projectIDs []int64,
) map[int64]struct{} {
	if len(projectIDs) == 0 || s == nil || s.superMagicProjectReader == nil {
		return map[int64]struct{}{}
	}

	sharedProjectIDs, err := s.superMagicProjectReader.ListSharedProjectIDsByProjectIDs(ctx, organizationCode, userID, projectIDs)
	if err != nil {
		if s.logger != nil {
			s.logger.KnowledgeWarnContext(
				ctx,
				"list shared project ids by project ids failed",
				"organization_code", organizationCode,
				"project_ids", projectIDs,
				"error", err,
			)
		}
		return map[int64]struct{}{}
	}
	return sharedProjectIDs
}

func collectProjectRootIDs(bindings []sourcebindingdomain.Binding) []int64 {
	if len(bindings) == 0 {
		return nil
	}

	seen := make(map[int64]struct{}, len(bindings))
	projectIDs := make([]int64, 0, len(bindings))
	for _, binding := range bindings {
		if sourcebindingdomain.NormalizeProvider(binding.Provider) != sourcebindingdomain.ProviderProject {
			continue
		}
		if sourcebindingdomain.NormalizeRootType(binding.RootType) != sourcebindingdomain.RootTypeProject {
			continue
		}
		projectID, err := strconv.ParseInt(strings.TrimSpace(binding.RootRef), 10, 64)
		if err != nil || projectID <= 0 {
			continue
		}
		if _, ok := seen[projectID]; ok {
			continue
		}
		seen[projectID] = struct{}{}
		projectIDs = append(projectIDs, projectID)
	}
	return projectIDs
}

func lookupProjectWorkspaceID(binding sourcebindingdomain.Binding, workspaceIDsByProject map[int64]int64) *int64 {
	if len(workspaceIDsByProject) == 0 {
		return nil
	}
	projectID, ok := lookupProjectRootID(binding)
	if !ok {
		return nil
	}
	workspaceID, ok := workspaceIDsByProject[projectID]
	if !ok || workspaceID <= 0 {
		return nil
	}
	return &workspaceID
}

func lookupProjectWorkspaceType(
	binding sourcebindingdomain.Binding,
	workspaceIDsByProject map[int64]int64,
	sharedProjectIDs map[int64]struct{},
) *string {
	if lookupProjectWorkspaceID(binding, workspaceIDsByProject) == nil {
		return nil
	}

	projectID, ok := lookupProjectRootID(binding)
	if !ok {
		return nil
	}

	workspaceType := workspaceTypeNormal
	if _, ok := sharedProjectIDs[projectID]; ok {
		workspaceType = workspaceTypeShared
	}
	return &workspaceType
}

func lookupProjectRootID(binding sourcebindingdomain.Binding) (int64, bool) {
	if sourcebindingdomain.NormalizeProvider(binding.Provider) != sourcebindingdomain.ProviderProject {
		return 0, false
	}
	if sourcebindingdomain.NormalizeRootType(binding.RootType) != sourcebindingdomain.RootTypeProject {
		return 0, false
	}
	projectID, err := strconv.ParseInt(strings.TrimSpace(binding.RootRef), 10, 64)
	if err != nil || projectID <= 0 {
		return 0, false
	}
	return projectID, true
}

func flattenBindings(bindingsByKnowledgeBase map[string][]sourcebindingdomain.Binding) []sourcebindingdomain.Binding {
	if len(bindingsByKnowledgeBase) == 0 {
		return nil
	}

	total := 0
	for _, bindings := range bindingsByKnowledgeBase {
		total += len(bindings)
	}
	result := make([]sourcebindingdomain.Binding, 0, total)
	for _, bindings := range bindingsByKnowledgeBase {
		result = append(result, bindings...)
	}
	return result
}

func (s *KnowledgeBaseAppService) ensureKnowledgeBaseActionAllowed(
	ctx context.Context,
	organizationCode string,
	userID string,
	knowledgeBaseCode string,
	action string,
) (knowledgeBasePermissionOperation, error) {
	accessService, err := s.knowledgeAccessService()
	if err != nil {
		return knowledgeBasePermissionNone, err
	}
	result, err := accessService.Authorize(ctx, resolveKnowledgeBaseAccessActor(ctx, organizationCode, userID), action, kbaccess.Target{
		KnowledgeBaseCode: knowledgeBaseCode,
	})
	if err != nil {
		return knowledgeBasePermissionNone, fmt.Errorf("authorize knowledge base access: %w", err)
	}
	if !result.Operation.ValidateAction(action) {
		return knowledgeBasePermissionNone, fmt.Errorf("%w: action=%s knowledge_base_code=%s", ErrKnowledgeBasePermissionDenied, action, knowledgeBaseCode)
	}
	return result.Operation, nil
}

func applyKnowledgeBaseUserOperation(
	dto *kbdto.KnowledgeBaseDTO,
	operation knowledgeBasePermissionOperation,
) *kbdto.KnowledgeBaseDTO {
	if dto == nil {
		return nil
	}
	dto.UserOperation = operation.UserOperation()
	return dto
}

func (s *KnowledgeBaseAppService) ensureOfficialOrganizationMember(
	ctx context.Context,
	organizationCode string,
) error {
	if s == nil || s.officialOrgChecker == nil {
		return ErrOfficialOrganizationMemberCheckerRequired
	}
	ok, err := s.officialOrgChecker.IsOfficialOrganizationMember(ctx, organizationCode)
	if err != nil {
		return fmt.Errorf("check official organization membership: %w", err)
	}
	if !ok {
		return ErrOfficialOrganizationMemberRequired
	}
	return nil
}

func (s *KnowledgeBaseAppService) filterReadableKnowledgeBaseCodes(
	ctx context.Context,
	organizationCode string,
	userID string,
	requestedCodes []string,
) ([]string, map[string]knowledgeBasePermissionOperation, error) {
	accessService, err := s.knowledgeAccessService()
	if err != nil {
		return nil, nil, err
	}
	codes, operations, err := accessService.AccessibleCodes(ctx, resolveKnowledgeBaseAccessActor(ctx, organizationCode, userID), requestedCodes)
	if err != nil {
		return nil, nil, fmt.Errorf("resolve accessible knowledge base codes: %w", err)
	}
	return codes, operations, nil
}

func resolveKnowledgeBaseAccessActor(ctx context.Context, organizationCode, userID string) kbaccess.Actor {
	if actor, ok := ctxmeta.AccessActorFromContext(ctx); ok {
		if strings.TrimSpace(organizationCode) == "" {
			organizationCode = actor.OrganizationCode
		}
		if strings.TrimSpace(userID) == "" {
			userID = actor.UserID
		}
		return kbaccess.Actor{
			OrganizationCode:              strings.TrimSpace(organizationCode),
			UserID:                        strings.TrimSpace(userID),
			ThirdPlatformUserID:           strings.TrimSpace(actor.ThirdPlatformUserID),
			ThirdPlatformOrganizationCode: strings.TrimSpace(actor.ThirdPlatformOrganizationCode),
		}
	}
	return kbaccess.Actor{
		OrganizationCode: strings.TrimSpace(organizationCode),
		UserID:           strings.TrimSpace(userID),
	}
}

func (s *KnowledgeBaseAppService) knowledgeAccessService() (*kbaccess.Service, error) {
	if s == nil || s.permissionReader == nil {
		return nil, ErrKnowledgeBasePermissionReaderRequired
	}
	return kbaccess.NewService(
		s.permissionReader,
		s.permissionWriter,
		&knowledgeBaseExternalAccessReader{support: s},
		nil,
	), nil
}

func normalizeRepairThirdPlatformType(platformType string) string {
	normalized := strings.ToLower(strings.TrimSpace(platformType))
	if normalized == "" {
		return sourcebindingdomain.ProviderTeamshare
	}
	return normalized
}

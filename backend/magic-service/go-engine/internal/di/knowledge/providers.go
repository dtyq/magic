// Package knowledge 提供知识库模块的依赖注入 Provider。
package knowledge

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	documentapp "magic/internal/application/knowledge/document/service"
	embeddingapp "magic/internal/application/knowledge/embedding/service"
	fragmentapp "magic/internal/application/knowledge/fragment/service"
	knowledgebaseapp "magic/internal/application/knowledge/knowledgebase/service"
	revectorizeapp "magic/internal/application/knowledge/revectorize/service"
	revectorizeshared "magic/internal/application/knowledge/shared/revectorize"
	thirdplatformprovider "magic/internal/application/knowledge/shared/thirdplatformprovider"
	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/constants"
	userdomain "magic/internal/domain/contact/user"
	kbaccess "magic/internal/domain/knowledge/access/service"
	documentdomain "magic/internal/domain/knowledge/document/service"
	documentsplitter "magic/internal/domain/knowledge/document/splitter"
	embeddingdomain "magic/internal/domain/knowledge/embedding"
	fragmentdomain "magic/internal/domain/knowledge/fragment/service"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	supermagicprojectdomain "magic/internal/domain/supermagicproject/service"
	taskfiledomain "magic/internal/domain/taskfile/service"
	"magic/internal/infrastructure/knowledge/documentsync"
	sourcecallbackcache "magic/internal/infrastructure/knowledge/sourcecallbackcache"
	"magic/internal/infrastructure/logging"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqlknowledgebasebinding "magic/internal/infrastructure/persistence/mysql/knowledge/knowledgebasebinding"
	mysqlsourcebindingrepo "magic/internal/infrastructure/persistence/mysql/knowledge/sourcebinding"
	mysqlsupermagicagentrepo "magic/internal/infrastructure/persistence/mysql/knowledge/supermagicagent"
	mysqltransaction "magic/internal/infrastructure/persistence/mysql/knowledge/transaction"
	mysqlprojectfilemeta "magic/internal/infrastructure/persistence/mysql/projectfilemeta"
	mysqlsupermagicprojectrepo "magic/internal/infrastructure/persistence/mysql/supermagicproject"
	"magic/internal/infrastructure/readiness"
	ipcclient "magic/internal/infrastructure/rpc/jsonrpc/client"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
	lockpkg "magic/internal/pkg/lock"
	"magic/internal/pkg/memoryguard"
	"magic/internal/pkg/tokenizer"
)

const defaultDocumentResyncTaskTimeout = 30 * time.Minute

// ProvideEmbeddingCacheCleanupService 提供缓存清理服务
// 使用默认配置自动启动定时清理任务
func ProvideEmbeddingCacheCleanupService(
	embeddingDomainSvc *embeddingdomain.DomainService,
	cleanupCfg autoloadcfg.EmbeddingCacheCleanupConfig,
	jobRunner lockpkg.SinglePodJobRunner,
	logger *logging.SugaredLogger,
) (*embeddingapp.EmbeddingCacheCleanupService, error) {
	config := embeddingapp.DefaultCleanupConfig()
	if cleanupCfg.CleanupIntervalHours > 0 {
		config.CleanupInterval = time.Duration(cleanupCfg.CleanupIntervalHours) * time.Hour
	}
	if cleanupCfg.CleanupTimeoutMinutes > 0 {
		config.CleanupTimeout = time.Duration(cleanupCfg.CleanupTimeoutMinutes) * time.Minute
	}
	if cleanupCfg.MinAccessCount > 0 {
		config.CleanupCriteria.MinAccessCount = cleanupCfg.MinAccessCount
	}
	if cleanupCfg.MaxIdleDurationHours > 0 {
		config.CleanupCriteria.MaxIdleDuration = time.Duration(cleanupCfg.MaxIdleDurationHours) * time.Hour
	}
	if cleanupCfg.MaxCacheAgeHours > 0 {
		config.CleanupCriteria.MaxCacheAge = time.Duration(cleanupCfg.MaxCacheAgeHours) * time.Hour
	}
	if cleanupCfg.BatchSize > 0 {
		config.CleanupCriteria.BatchSize = cleanupCfg.BatchSize
	}
	config.AutoCleanupEnabled = cleanupCfg.AutoCleanupEnabled

	svc, err := embeddingapp.NewEmbeddingCacheCleanupService(embeddingDomainSvc, config, jobRunner, logger)
	if err != nil {
		return nil, fmt.Errorf("new cleanup service: %w", err)
	}
	return svc, nil
}

// BaseDeps 表示知识库应用服务的补充依赖。
type BaseDeps struct {
	SourceBindingRepo        *mysqlsourcebindingrepo.Repository
	KnowledgeBaseBindingRepo *mysqlknowledgebasebinding.Repository
	DestroyCoordinator       *mysqltransaction.KnowledgeBaseDestroyCoordinator
	WriteCoordinator         *mysqltransaction.KnowledgeBaseWriteCoordinator
	SuperMagicAgentRepo      *mysqlsupermagicagentrepo.Repository
	DomainDeps               BaseDomainDeps
	PortDeps                 BasePortDeps
}

// BaseDomainDeps 表示知识库应用依赖的领域服务集合。
type BaseDomainDeps struct {
	SuperMagicProjectService *supermagicprojectdomain.DomainService
	TaskFileService          *taskfiledomain.DomainService
	UserService              *userdomain.DomainService
}

// BaseDocumentFlowDeps 聚合知识库文档 flow app 的运行时依赖。
type BaseDocumentFlowDeps struct {
	DocumentAppService    *documentapp.DocumentAppService
	DocumentDomainService *documentdomain.DomainService
	FragmentDomainService *fragmentdomain.FragmentDomainService
	ParseService          *documentdomain.ParseService
}

// BasePortDeps 表示知识库应用服务依赖的外部只读端口。
type BasePortDeps struct {
	KnowledgeBasePermissionPort *ipcclient.PHPKnowledgeBasePermissionRPCClient
	SuperMagicAgentPort         *ipcclient.PHPSuperMagicAgentRPCClient
	ProjectFilePort             *ipcclient.PHPProjectFileRPCClient
	ThirdPlatformPort           *ipcclient.PHPThirdPlatformDocumentRPCClient
}

// BaseBindingDeps 表示知识库产品线绑定相关依赖。
type BaseBindingDeps struct {
	KnowledgeBaseBindingRepo *mysqlknowledgebasebinding.Repository
	SuperMagicAgentRepo      *mysqlsupermagicagentrepo.Repository
}

// BaseCoordinatorDeps 表示知识库数据库写入相关协调器依赖。
type BaseCoordinatorDeps struct {
	DestroyCoordinator *mysqltransaction.KnowledgeBaseDestroyCoordinator
	WriteCoordinator   *mysqltransaction.KnowledgeBaseWriteCoordinator
}

// ProvideKnowledgeBaseBindingDeps 提供知识库绑定相关依赖。
func ProvideKnowledgeBaseBindingDeps(
	knowledgeBaseBindingRepo *mysqlknowledgebasebinding.Repository,
	superMagicAgentRepo *mysqlsupermagicagentrepo.Repository,
) BaseBindingDeps {
	return BaseBindingDeps{
		KnowledgeBaseBindingRepo: knowledgeBaseBindingRepo,
		SuperMagicAgentRepo:      superMagicAgentRepo,
	}
}

// ProvideKnowledgeBaseCoordinatorDeps 提供知识库写入相关协调器依赖。
func ProvideKnowledgeBaseCoordinatorDeps(
	destroyCoordinator *mysqltransaction.KnowledgeBaseDestroyCoordinator,
	writeCoordinator *mysqltransaction.KnowledgeBaseWriteCoordinator,
) BaseCoordinatorDeps {
	return BaseCoordinatorDeps{
		DestroyCoordinator: destroyCoordinator,
		WriteCoordinator:   writeCoordinator,
	}
}

// ProvideKnowledgeBasePortDeps 提供知识库应用服务依赖的外部端口。
func ProvideKnowledgeBasePortDeps(
	knowledgeBasePermissionPort *ipcclient.PHPKnowledgeBasePermissionRPCClient,
	superMagicAgentPort *ipcclient.PHPSuperMagicAgentRPCClient,
	projectFilePort *ipcclient.PHPProjectFileRPCClient,
	thirdPlatformPort *ipcclient.PHPThirdPlatformDocumentRPCClient,
) BasePortDeps {
	return BasePortDeps{
		KnowledgeBasePermissionPort: knowledgeBasePermissionPort,
		SuperMagicAgentPort:         superMagicAgentPort,
		ProjectFilePort:             projectFilePort,
		ThirdPlatformPort:           thirdPlatformPort,
	}
}

// ProvideKnowledgeBaseDomainDeps 提供知识库应用依赖的领域服务集合。
func ProvideKnowledgeBaseDomainDeps(
	superMagicProjectService *supermagicprojectdomain.DomainService,
	taskFileService *taskfiledomain.DomainService,
	userService *userdomain.DomainService,
) BaseDomainDeps {
	return BaseDomainDeps{
		SuperMagicProjectService: superMagicProjectService,
		TaskFileService:          taskFileService,
		UserService:              userService,
	}
}

// ProvideKnowledgeBaseAppDeps 提供知识库应用服务补充依赖。
func ProvideKnowledgeBaseAppDeps(
	sourceBindingRepo *mysqlsourcebindingrepo.Repository,
	domainDeps BaseDomainDeps,
	portDeps BasePortDeps,
	coordinatorDeps BaseCoordinatorDeps,
	bindingDeps BaseBindingDeps,
) BaseDeps {
	return BaseDeps{
		SourceBindingRepo:        sourceBindingRepo,
		KnowledgeBaseBindingRepo: bindingDeps.KnowledgeBaseBindingRepo,
		DestroyCoordinator:       coordinatorDeps.DestroyCoordinator,
		WriteCoordinator:         coordinatorDeps.WriteCoordinator,
		SuperMagicAgentRepo:      bindingDeps.SuperMagicAgentRepo,
		DomainDeps:               domainDeps,
		PortDeps:                 portDeps,
	}
}

// ProvideSuperMagicProjectDomainService 提供 super magic project 领域服务。
func ProvideSuperMagicProjectDomainService(
	repo *mysqlsupermagicprojectrepo.Repository,
) *supermagicprojectdomain.DomainService {
	return supermagicprojectdomain.NewDomainService(repo)
}

// ProvideKnowledgeBaseDocumentFlowDeps 提供知识库文档协作 flow app 依赖。
func ProvideKnowledgeBaseDocumentFlowDeps(
	documentSvc *documentapp.DocumentAppService,
	documentDomainSvc *documentdomain.DomainService,
	fragmentSvc *fragmentdomain.FragmentDomainService,
	parseService *documentdomain.ParseService,
) BaseDocumentFlowDeps {
	return BaseDocumentFlowDeps{
		DocumentAppService:    documentSvc,
		DocumentDomainService: documentDomainSvc,
		FragmentDomainService: fragmentSvc,
		ParseService:          parseService,
	}
}

// ProvideKnowledgeBaseAppService 提供知识库应用服务
func ProvideKnowledgeBaseAppService(
	domainSvc *knowledgebasedomain.DomainService,
	documentFlowDeps BaseDocumentFlowDeps,
	deps BaseDeps,
	redisClient *redis.Client,
	logger *logging.SugaredLogger,
	defaultModel autoloadcfg.EmbeddingDefaultModel,
) *knowledgebaseapp.KnowledgeBaseAppService {
	appSvc := knowledgebaseapp.NewKnowledgeBaseAppService(
		domainSvc,
		documentFlowDeps.FragmentDomainService,
		logger,
		string(defaultModel),
	)
	appSvc.SetDocumentFlowApp(
		knowledgebaseapp.NewKnowledgeBaseDocumentFlowApp(
			appSvc,
			documentFlowDeps.DocumentDomainService,
			documentFlowDeps.FragmentDomainService,
			documentFlowDeps.DocumentAppService,
			documentFlowDeps.ParseService,
		),
	)
	appSvc.SetSourceBindingRepository(deps.SourceBindingRepo)
	appSvc.SetKnowledgeBaseBindingRepository(deps.KnowledgeBaseBindingRepo)
	appSvc.SetDestroyCoordinator(deps.DestroyCoordinator)
	appSvc.SetWriteCoordinator(deps.WriteCoordinator)
	appSvc.SetKnowledgeBasePermissionReader(deps.PortDeps.KnowledgeBasePermissionPort)
	appSvc.SetKnowledgeBasePermissionWriter(newKnowledgeBasePermissionWriter(deps.PortDeps.KnowledgeBasePermissionPort))
	appSvc.SetOfficialOrganizationMemberChecker(deps.PortDeps.KnowledgeBasePermissionPort)
	appSvc.SetProjectFileResolver(deps.PortDeps.ProjectFilePort)
	appSvc.SetTaskFileService(deps.DomainDeps.TaskFileService)
	appSvc.SetUserService(deps.DomainDeps.UserService)
	appSvc.SetThirdPlatformExpander(deps.PortDeps.ThirdPlatformPort)
	appSvc.SetSourceBindingTreeRootCache(knowledgebaseapp.NewRedisSourceBindingTreeRootCache(redisClient))
	appSvc.SetSuperMagicAgentReader(deps.SuperMagicAgentRepo)
	appSvc.SetSuperMagicAgentAccessChecker(deps.PortDeps.SuperMagicAgentPort)
	appSvc.SetSuperMagicProjectReader(deps.DomainDeps.SuperMagicProjectService)
	return appSvc
}

type knowledgeBasePermissionWriter struct {
	port *ipcclient.PHPKnowledgeBasePermissionRPCClient
}

func newKnowledgeBasePermissionWriter(port *ipcclient.PHPKnowledgeBasePermissionRPCClient) kbaccess.LocalPermissionWriter {
	if port == nil {
		return nil
	}
	return &knowledgeBasePermissionWriter{port: port}
}

func (w *knowledgeBasePermissionWriter) Initialize(
	ctx context.Context,
	actor kbaccess.Actor,
	input kbaccess.InitializeInput,
) error {
	if w == nil || w.port == nil {
		return nil
	}
	if err := w.port.Initialize(ctx, actor.OrganizationCode, actor.UserID, map[string]any{
		"knowledge_base_code": input.KnowledgeBaseCode,
		"owner_user_id":       input.OwnerUserID,
		"knowledge_type":      input.KnowledgeType,
		"business_id":         input.BusinessID,
		"admin_user_ids":      append([]string(nil), input.AdminUserIDs...),
	}); err != nil {
		return fmt.Errorf("initialize knowledge base permission via php rpc: %w", err)
	}
	return nil
}

func (w *knowledgeBasePermissionWriter) GrantOwner(
	ctx context.Context,
	actor kbaccess.Actor,
	knowledgeBaseCode string,
	ownerUserID string,
) error {
	if w == nil || w.port == nil {
		return nil
	}
	if err := w.port.GrantOwner(ctx, actor.OrganizationCode, actor.UserID, knowledgeBaseCode, ownerUserID); err != nil {
		return fmt.Errorf("grant knowledge base owner via php rpc: %w", err)
	}
	return nil
}

func (w *knowledgeBasePermissionWriter) Cleanup(
	ctx context.Context,
	actor kbaccess.Actor,
	knowledgeBaseCode string,
) error {
	if w == nil || w.port == nil {
		return nil
	}
	if err := w.port.Cleanup(ctx, actor.OrganizationCode, actor.UserID, knowledgeBaseCode); err != nil {
		return fmt.Errorf("cleanup knowledge base permission via php rpc: %w", err)
	}
	return nil
}

// ProvideFragmentAppDeps 提供片段应用服务所需的窄协作依赖。
func ProvideFragmentAppDeps(
	parseService *documentdomain.ParseService,
	portDeps BasePortDeps,
	thirdPlatformProviders *thirdplatformprovider.Registry,
	bindingDeps BaseBindingDeps,
	runtimeDeps FragmentAppRuntimeDeps,
	userService *userdomain.DomainService,
) fragmentapp.AppDeps {
	return fragmentapp.AppDeps{
		ParseService:              parseService,
		ProjectFileContentPort:    portDeps.ProjectFilePort,
		ThirdPlatformDocumentPort: portDeps.ThirdPlatformPort,
		ThirdPlatformProviders:    thirdPlatformProviders,
		KnowledgeBaseBindingRepo:  bindingDeps.KnowledgeBaseBindingRepo,
		PermissionReader:          portDeps.KnowledgeBasePermissionPort,
		ThirdPlatformAccess:       portDeps.ThirdPlatformPort,
		SuperMagicAgentAccess:     portDeps.SuperMagicAgentPort,
		ManualFragmentCoordinator: runtimeDeps.ManualFragmentCoordinator,
		PreviewSplitter:           documentsplitter.NewPreviewSplitter(),
		Tokenizer:                 runtimeDeps.TokenizerService,
		UserService:               userService,
		DefaultEmbeddingModel:     string(runtimeDeps.DefaultEmbeddingModel),
	}
}

// FragmentAppRuntimeDeps 表示片段应用服务依赖的运行时对象。
type FragmentAppRuntimeDeps struct {
	ManualFragmentCoordinator *mysqltransaction.ManualFragmentCoordinator
	TokenizerService          *tokenizer.Service
	DefaultEmbeddingModel     autoloadcfg.EmbeddingDefaultModel
}

// ProvideFragmentAppRuntimeDeps 提供片段应用服务运行时依赖。
func ProvideFragmentAppRuntimeDeps(
	manualFragmentCoordinator *mysqltransaction.ManualFragmentCoordinator,
	tokenizerService *tokenizer.Service,
	defaultModel autoloadcfg.EmbeddingDefaultModel,
) FragmentAppRuntimeDeps {
	return FragmentAppRuntimeDeps{
		ManualFragmentCoordinator: manualFragmentCoordinator,
		TokenizerService:          tokenizerService,
		DefaultEmbeddingModel:     defaultModel,
	}
}

// ProvideFragmentAppService 提供片段应用服务
func ProvideFragmentAppService(
	domainSvc *fragmentdomain.FragmentDomainService,
	kbDomainSvc *knowledgebasedomain.DomainService,
	documentDomainSvc *documentdomain.DomainService,
	deps fragmentapp.AppDeps,
	redisClient *redis.Client,
	logger *logging.SugaredLogger,
) *fragmentapp.FragmentAppService {
	if deps.TeamshareTempCodeMapper == nil {
		deps.TeamshareTempCodeMapper = knowledgebaseapp.NewRedisTeamshareTempCodeMapper(redisClient)
	}
	return fragmentapp.NewFragmentAppService(
		domainSvc,
		kbDomainSvc,
		documentDomainSvc,
		deps,
		logger,
	)
}

// ProvideEmbeddingAppService 提供嵌入应用服务
func ProvideEmbeddingAppService(
	domainSvc *embeddingdomain.DomainService,
	logger *logging.SugaredLogger,
	defaultModel autoloadcfg.EmbeddingDefaultModel,
) *embeddingapp.EmbeddingAppService {
	return embeddingapp.NewEmbeddingAppService(domainSvc, logger, string(defaultModel))
}

// DocumentAppRuntimeDeps 定义文档应用服务运行时依赖。
type DocumentAppRuntimeDeps struct {
	Config           *autoloadcfg.Config
	FileLinkProvider *ipcclient.PHPFileRPCClient
	SyncRuntime      *documentsync.Runtime
	ProgressStore    *revectorizeshared.RedisProgressStore
	RedisClient      *redis.Client
}

// ProvideDocumentAppRuntimeDeps 提供文档应用服务运行时依赖。
func ProvideDocumentAppRuntimeDeps(
	cfg *autoloadcfg.Config,
	fileLinkProvider *ipcclient.PHPFileRPCClient,
	syncRuntime *documentsync.Runtime,
	progressStore *revectorizeshared.RedisProgressStore,
	redisClient *redis.Client,
) DocumentAppRuntimeDeps {
	return DocumentAppRuntimeDeps{
		Config:           cfg,
		FileLinkProvider: fileLinkProvider,
		SyncRuntime:      syncRuntime,
		ProgressStore:    progressStore,
		RedisClient:      redisClient,
	}
}

// ProvideDocumentSyncRuntime 提供文档重同步运行时。
func ProvideDocumentSyncRuntime(
	rabbitMQBroker *documentsync.RabbitMQBroker,
	cfg *autoloadcfg.Config,
	logger *logging.SugaredLogger,
	ipcServer *unixsocket.Server,
	redisClient *redis.Client,
) *documentsync.Runtime {
	runtime := documentsync.NewRuntime(logger.Named("knowledge.documentsync.runtime"))

	if cfg == nil || !cfg.RabbitMQ.Enabled || !cfg.RabbitMQ.DocumentResync.Enabled || rabbitMQBroker == nil {
		return runtime
	}

	mqDefaults := documentsync.DefaultRabbitMQSchedulerConfig()
	mqScheduler := documentsync.NewRabbitMQScheduler(
		runtime,
		documentsync.RabbitMQSchedulerDeps{
			Logger:          logger.Named("knowledge.documentsync.rabbitmq"),
			Broker:          rabbitMQBroker,
			TerminalHandler: runtime,
			RetryStore:      documentsync.NewRedisRetryStore(redisClient),
			AdmissionGate: documentsync.NewMemoryAdmissionGate(
				memoryguard.NewGuard(memoryguard.Config{
					SoftLimitBytes: documentSyncResourceLimitsFromConfig(cfg).SyncMemorySoftLimitBytes,
				}),
				logger.Named("knowledge.documentsync.admission"),
				documentsync.MemoryAdmissionGateConfig{},
			),
			NonRetryableError: documentdomain.IsNonRetryableDocumentSyncError,
			ReadinessGate: readiness.NewIPCCapabilityGate(
				ipcServer,
				"php-ipc:knowledge-permission",
				constants.MethodKnowledgeBasePermissionListOperations,
			),
		},
		newDocumentResyncRabbitMQSchedulerConfig(cfg, mqDefaults),
		durationOrDefault(cfg.RabbitMQ.DocumentResync.TaskTimeoutSeconds, defaultDocumentResyncTaskTimeout),
	)
	runtime.UseScheduler(mqScheduler)
	runtime.UseBackgroundService(mqScheduler)
	return runtime
}

func newDocumentResyncRabbitMQSchedulerConfig(
	cfg *autoloadcfg.Config,
	defaults documentsync.RabbitMQSchedulerConfig,
) documentsync.RabbitMQSchedulerConfig {
	return documentsync.RabbitMQSchedulerConfig{
		QueueName:           strings.TrimSpace(cfg.RabbitMQ.Queues.DocumentResync),
		ConsumerPrefetch:    cfg.RabbitMQ.DocumentResync.ConsumerPrefetch,
		ConsumerConcurrency: cfg.RabbitMQ.DocumentResync.ConsumerConcurrency,
		MQPublishTimeout: millisDurationOrDefault(
			cfg.RabbitMQ.DocumentResync.MQPublishTimeoutMillis,
			defaults.MQPublishTimeout,
		),
		MaxRequeueAttempts: intOrDefault(
			cfg.RabbitMQ.DocumentResync.MaxRequeueAttempts,
			defaults.MaxRequeueAttempts,
		),
	}
}

func documentSyncResourceLimitsFromConfig(cfg *autoloadcfg.Config) documentdomain.ResourceLimits {
	if cfg == nil {
		return documentdomain.DefaultResourceLimits()
	}
	limits := cfg.DocumentResourceLimits
	return documentdomain.NormalizeResourceLimits(documentdomain.ResourceLimits{
		MaxSourceBytes:           limits.MaxSourceBytes,
		MaxTabularRows:           limits.MaxTabularRows,
		MaxTabularCells:          limits.MaxTabularCells,
		MaxPlainTextChars:        limits.MaxPlainTextChars,
		MaxParsedBlocks:          limits.MaxParsedBlocks,
		MaxFragmentsPerDocument:  limits.MaxFragmentsPerDocument,
		SyncMemorySoftLimitBytes: limits.SyncMemorySoftLimitBytes,
	})
}

// ProvideDocumentAppDeps 提供文档应用服务所需的窄协作依赖。
func ProvideDocumentAppDeps(
	parseService *documentdomain.ParseService,
	portDeps BasePortDeps,
	thirdPlatformProviders *thirdplatformprovider.Registry,
	tokenizerService *tokenizer.Service,
	userService *userdomain.DomainService,
	client *mysqlclient.SQLCClient,
) documentapp.AppDeps {
	deps := documentapp.AppDeps{
		ParseService:              parseService,
		ThirdPlatformDocumentPort: portDeps.ThirdPlatformPort,
		ProjectFilePort:           portDeps.ProjectFilePort,
		ProjectFileContentPort:    portDeps.ProjectFilePort,
		ThirdPlatformProviders:    thirdPlatformProviders,
		PermissionReader:          portDeps.KnowledgeBasePermissionPort,
		ThirdPlatformAccess:       portDeps.ThirdPlatformPort,
		Tokenizer:                 tokenizerService,
		UserService:               userService,
	}
	if client != nil {
		deps.SourceBindingRepo = mysqlsourcebindingrepo.NewRepository(client)
		deps.KnowledgeBaseBindingRepo = mysqlknowledgebasebinding.NewRepository(client)
		deps.ProjectFileMetadataReader = mysqlprojectfilemeta.NewRepository(client)
	}
	return deps
}

// ProvideThirdPlatformProviderRegistry 提供第三方平台 provider registry。
func ProvideThirdPlatformProviderRegistry(
	thirdPlatformDocumentPort *ipcclient.PHPThirdPlatformDocumentRPCClient,
	logger *logging.SugaredLogger,
) *thirdplatformprovider.Registry {
	return thirdplatformprovider.NewRegistry(
		thirdplatformprovider.NewTeamshareProvider(thirdPlatformDocumentPort, logger.Named("knowledge.thirdplatform.teamshare")),
	)
}

// ProvideDocumentAppService 提供文档应用服务。
func ProvideDocumentAppService(
	domainSvc *documentdomain.DomainService,
	kbService *knowledgebasedomain.DomainService,
	fragmentService *fragmentdomain.FragmentDomainService,
	deps documentapp.AppDeps,
	logger *logging.SugaredLogger,
	runtimeDeps DocumentAppRuntimeDeps,
) *documentapp.DocumentAppService {
	appSvc := documentapp.NewDocumentAppService(
		domainSvc,
		kbService,
		fragmentService,
		deps,
		logger,
	)
	appSvc.SetOriginalFileLinkProvider(runtimeDeps.FileLinkProvider)
	appSvc.SetKnowledgeRevectorizeProgressStore(runtimeDeps.ProgressStore)
	sourceCallbackCache := buildSourceCallbackRedisCache(runtimeDeps)
	appSvc.SetSourceBindingCandidateCache(sourceCallbackCache)
	appSvc.SetSourceCallbackSingleflight(sourceCallbackCache)
	registerDocumentSyncRuntimeHandlers(appSvc, runtimeDeps)
	appSvc.SetSyncScheduler(buildDocumentSyncScheduler(runtimeDeps))
	return appSvc
}

func buildSourceCallbackRedisCache(runtimeDeps DocumentAppRuntimeDeps) *sourcecallbackcache.RedisCache {
	if runtimeDeps.RedisClient == nil {
		return nil
	}
	return sourcecallbackcache.NewRedisCache(runtimeDeps.RedisClient)
}

func buildDocumentSyncScheduler(runtimeDeps DocumentAppRuntimeDeps) documentSyncSchedulerAdapter {
	// document_sync 是唯一进入 MQ 的任务类型。
	return documentSyncSchedulerAdapter{scheduler: buildKnowledgeScheduler(runtimeDeps)}
}

type documentSyncSchedulerAdapter struct {
	scheduler documentsync.Scheduler
}

func (a documentSyncSchedulerAdapter) Schedule(ctx context.Context, input *documentdomain.SyncDocumentInput) {
	if a.scheduler == nil || input == nil {
		return
	}

	cloned := *input
	cloned.Async = true

	payload, err := json.Marshal(&cloned)
	if err != nil {
		return
	}

	a.scheduler.Schedule(ctx, &documentsync.Task{
		Kind:              documentsync.TaskKindDocumentSync,
		KnowledgeBaseCode: cloned.KnowledgeBaseCode,
		Code:              cloned.Code,
		Mode:              cloned.Mode,
		Async:             true,
		Payload:           payload,
	})
}

func decodeSyncTask(task *documentsync.Task) (*documentdomain.SyncDocumentInput, error) {
	if task == nil {
		return &documentdomain.SyncDocumentInput{}, nil
	}
	if len(task.Payload) == 0 {
		return &documentdomain.SyncDocumentInput{
			KnowledgeBaseCode: task.KnowledgeBaseCode,
			Code:              task.Code,
			Mode:              task.Mode,
			Async:             task.Async,
		}, nil
	}

	var input documentdomain.SyncDocumentInput
	if err := json.Unmarshal(task.Payload, &input); err != nil {
		return nil, fmt.Errorf("unmarshal document sync task: %w", err)
	}
	return &input, nil
}

func durationOrDefault(value int, fallback time.Duration) time.Duration {
	if value <= 0 {
		return fallback
	}
	switch {
	case fallback >= time.Second:
		return time.Duration(value) * time.Second
	case fallback >= time.Millisecond:
		return time.Duration(value) * time.Millisecond
	default:
		return time.Duration(value)
	}
}

func millisDurationOrDefault(value int, fallback time.Duration) time.Duration {
	if value <= 0 {
		return fallback
	}
	return time.Duration(value) * time.Millisecond
}

func intOrDefault(value, fallback int) int {
	if value <= 0 {
		return fallback
	}
	return value
}

func buildKnowledgeScheduler(runtimeDeps DocumentAppRuntimeDeps) documentsync.Scheduler {
	return runtimeDeps.SyncRuntime
}

func registerDocumentSyncRuntimeHandlers(appSvc *documentapp.DocumentAppService, runtimeDeps DocumentAppRuntimeDeps) {
	if appSvc == nil || runtimeDeps.SyncRuntime == nil {
		return
	}

	// 运行时里只有 document_sync 真正执行单文档同步。
	runtimeDeps.SyncRuntime.RegisterRunner(documentsync.TaskKindDocumentSync, documentsync.RunnerFunc(func(ctx context.Context, task *documentsync.Task) error {
		return runDocumentSyncTask(ctx, appSvc, task)
	}))
	runtimeDeps.SyncRuntime.RegisterTerminalHandler(
		documentsync.TaskKindDocumentSync,
		documentsync.TerminalHandlerFunc(func(ctx context.Context, task *documentsync.Task, cause error) error {
			return terminateDocumentSyncTask(ctx, appSvc, task, cause)
		}),
	)
}

func runDocumentSyncTask(
	ctx context.Context,
	appSvc *documentapp.DocumentAppService,
	task *documentsync.Task,
) error {
	if task == nil {
		return nil
	}

	input, err := decodeSyncTask(task)
	if err != nil {
		if isDocumentSyncTaskDecodeError(err) {
			return nil
		}
		return err
	}

	syncErr := appSvc.Sync(documentapp.WithDeferredSyncFailureMark(ctx), input)
	if strings.TrimSpace(input.RevectorizeSessionID) == "" {
		return normalizeDocumentSyncRuntimeError(syncErr, "run document sync task")
	}

	if err := normalizeDocumentSyncRuntimeError(syncErr, "run revectorize-scoped document sync task"); err != nil {
		return err
	}

	// session-scoped document_sync 只在“真正进入终态”后才推进知识库进度。
	// 执行失败统一交给 MQ requeue；只有成功消费后才推进知识库进度。
	if err := appSvc.FinalizeKnowledgeRevectorizeTask(ctx, input); err != nil {
		return fmt.Errorf("finalize revectorize-scoped document sync task: %w", err)
	}
	return nil
}

func terminateDocumentSyncTask(
	ctx context.Context,
	appSvc *documentapp.DocumentAppService,
	task *documentsync.Task,
	cause error,
) error {
	if task == nil || appSvc == nil {
		return nil
	}
	input, err := decodeSyncTask(task)
	if err != nil {
		if isDocumentSyncTaskDecodeError(err) {
			return nil
		}
		return err
	}
	if err := appSvc.FinalizeTerminalDocumentSyncTask(ctx, input, cause); err != nil {
		return fmt.Errorf("finalize terminal document sync task: %w", err)
	}
	return nil
}

func normalizeDocumentSyncRuntimeError(syncErr error, message string) error {
	if syncErr == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", message, syncErr)
}

func isDocumentSyncTaskDecodeError(err error) bool {
	if err == nil {
		return false
	}

	var (
		syntaxErr        *json.SyntaxError
		unmarshalTypeErr *json.UnmarshalTypeError
	)

	switch {
	case errors.As(err, &syntaxErr):
		return true
	case errors.As(err, &unmarshalTypeErr):
		return true
	default:
		return false
	}
}

// ProvideKnowledgeRevectorizeProgressStore 提供知识库重向量化 session 进度存储。
func ProvideKnowledgeRevectorizeProgressStore(redisClient *redis.Client) *revectorizeshared.RedisProgressStore {
	return revectorizeshared.NewRedisProgressStore(redisClient)
}

// ProvideKnowledgeRevectorizeAppService 提供知识库级批量重向量化应用服务。
func ProvideKnowledgeRevectorizeAppService(
	knowledgeBaseApp *knowledgebaseapp.KnowledgeBaseAppService,
	documentApp *documentapp.DocumentAppService,
	progressStore *revectorizeshared.RedisProgressStore,
	logger *logging.SugaredLogger,
) *revectorizeapp.KnowledgeRevectorizeAppService {
	return revectorizeapp.NewKnowledgeRevectorizeAppService(knowledgeBaseApp, documentApp, progressStore, logger)
}

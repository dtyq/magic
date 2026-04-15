// Package knowledge 提供知识库模块的依赖注入 Provider。
package knowledge

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	documentapp "magic/internal/application/knowledge/document/service"
	embeddingapp "magic/internal/application/knowledge/embedding/service"
	fragmentapp "magic/internal/application/knowledge/fragment/service"
	knowledgebaseapp "magic/internal/application/knowledge/knowledgebase/service"
	thirdplatformprovider "magic/internal/application/knowledge/shared/thirdplatformprovider"
	autoloadcfg "magic/internal/config/autoload"
	documentdomain "magic/internal/domain/knowledge/document/service"
	documentsplitter "magic/internal/domain/knowledge/document/splitter"
	embeddingdomain "magic/internal/domain/knowledge/embedding"
	fragmentdomain "magic/internal/domain/knowledge/fragment/service"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	taskfiledomain "magic/internal/domain/taskfile/service"
	"magic/internal/infrastructure/knowledge/documentsync"
	"magic/internal/infrastructure/logging"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqlknowledgebasebinding "magic/internal/infrastructure/persistence/mysql/knowledge/knowledgebasebinding"
	mysqlsourcebindingrepo "magic/internal/infrastructure/persistence/mysql/knowledge/sourcebinding"
	mysqlsupermagicagentrepo "magic/internal/infrastructure/persistence/mysql/knowledge/supermagicagent"
	mysqltransaction "magic/internal/infrastructure/persistence/mysql/knowledge/transaction"
	mysqlprojectfilemeta "magic/internal/infrastructure/persistence/mysql/projectfilemeta"
	ipcclient "magic/internal/infrastructure/rpc/jsonrpc/client"
	lockpkg "magic/internal/pkg/lock"
	"magic/internal/pkg/tokenizer"
)

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
	TaskFileService          *taskfiledomain.DomainService
	PortDeps                 BasePortDeps
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
	PermissionPort              *ipcclient.PHPOperationPermissionRPCClient
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
	permissionPort *ipcclient.PHPOperationPermissionRPCClient,
	knowledgeBasePermissionPort *ipcclient.PHPKnowledgeBasePermissionRPCClient,
	superMagicAgentPort *ipcclient.PHPSuperMagicAgentRPCClient,
	projectFilePort *ipcclient.PHPProjectFileRPCClient,
	thirdPlatformPort *ipcclient.PHPThirdPlatformDocumentRPCClient,
) BasePortDeps {
	return BasePortDeps{
		PermissionPort:              permissionPort,
		KnowledgeBasePermissionPort: knowledgeBasePermissionPort,
		SuperMagicAgentPort:         superMagicAgentPort,
		ProjectFilePort:             projectFilePort,
		ThirdPlatformPort:           thirdPlatformPort,
	}
}

// ProvideKnowledgeBaseAppDeps 提供知识库应用服务补充依赖。
func ProvideKnowledgeBaseAppDeps(
	sourceBindingRepo *mysqlsourcebindingrepo.Repository,
	taskFileService *taskfiledomain.DomainService,
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
		TaskFileService:          taskFileService,
		PortDeps:                 portDeps,
	}
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
	appSvc.SetOwnerGrantPort(deps.PortDeps.PermissionPort)
	appSvc.SetKnowledgeBasePermissionReader(deps.PortDeps.KnowledgeBasePermissionPort)
	appSvc.SetOfficialOrganizationMemberChecker(deps.PortDeps.KnowledgeBasePermissionPort)
	appSvc.SetProjectFileResolver(deps.PortDeps.ProjectFilePort)
	appSvc.SetTaskFileService(deps.TaskFileService)
	appSvc.SetThirdPlatformExpander(deps.PortDeps.ThirdPlatformPort)
	appSvc.SetSuperMagicAgentReader(deps.SuperMagicAgentRepo)
	appSvc.SetSuperMagicAgentAccessChecker(deps.PortDeps.SuperMagicAgentPort)
	return appSvc
}

// ProvideFragmentAppDeps 提供片段应用服务所需的窄协作依赖。
func ProvideFragmentAppDeps(
	parseService *documentdomain.ParseService,
	portDeps BasePortDeps,
	thirdPlatformProviders *thirdplatformprovider.Registry,
	bindingDeps BaseBindingDeps,
	runtimeDeps FragmentAppRuntimeDeps,
) fragmentapp.AppDeps {
	return fragmentapp.AppDeps{
		ParseService:              parseService,
		ThirdPlatformDocumentPort: portDeps.ThirdPlatformPort,
		ThirdPlatformProviders:    thirdPlatformProviders,
		KnowledgeBaseBindingRepo:  bindingDeps.KnowledgeBaseBindingRepo,
		SuperMagicAgentAccess:     portDeps.SuperMagicAgentPort,
		ManualFragmentCoordinator: runtimeDeps.ManualFragmentCoordinator,
		PreviewSplitter:           documentsplitter.NewPreviewSplitter(),
		Tokenizer:                 runtimeDeps.TokenizerService,
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
	RedisClient      *redis.Client
	Config           *autoloadcfg.Config
	FileLinkProvider *ipcclient.PHPFileRPCClient
}

// ProvideDocumentAppRuntimeDeps 提供文档应用服务运行时依赖。
func ProvideDocumentAppRuntimeDeps(
	redisClient *redis.Client,
	cfg *autoloadcfg.Config,
	fileLinkProvider *ipcclient.PHPFileRPCClient,
) DocumentAppRuntimeDeps {
	return DocumentAppRuntimeDeps{
		RedisClient:      redisClient,
		Config:           cfg,
		FileLinkProvider: fileLinkProvider,
	}
}

// ProvideDocumentAppDeps 提供文档应用服务所需的窄协作依赖。
func ProvideDocumentAppDeps(
	parseService *documentdomain.ParseService,
	thirdPlatformDocumentPort *ipcclient.PHPThirdPlatformDocumentRPCClient,
	projectFilePort *ipcclient.PHPProjectFileRPCClient,
	thirdPlatformProviders *thirdplatformprovider.Registry,
	tokenizerService *tokenizer.Service,
	client *mysqlclient.SQLCClient,
) documentapp.AppDeps {
	deps := documentapp.AppDeps{
		ParseService:              parseService,
		ThirdPlatformDocumentPort: thirdPlatformDocumentPort,
		ProjectFilePort:           projectFilePort,
		ProjectFileContentPort:    projectFilePort,
		ThirdPlatformProviders:    thirdPlatformProviders,
		Tokenizer:                 tokenizerService,
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
	appSvc.SetSyncScheduler(buildDocumentSyncScheduler(appSvc, logger, runtimeDeps))
	appSvc.SetThirdFileRevectorizeScheduler(buildThirdFileRevectorizeScheduler(appSvc, logger, runtimeDeps))
	return appSvc
}

func buildDocumentSyncScheduler(
	runner documentSyncRunner,
	logger *logging.SugaredLogger,
	runtimeDeps DocumentAppRuntimeDeps,
) documentSyncSchedulerAdapter {
	infraRunner := documentsync.RunnerFunc(func(ctx context.Context, task *documentsync.Task) error {
		if runner == nil || task == nil {
			return nil
		}
		input, err := decodeSyncTask(task)
		if err != nil {
			return err
		}
		return runner.Sync(ctx, input)
	})

	return documentSyncSchedulerAdapter{scheduler: buildKnowledgeScheduler(infraRunner, logger, runtimeDeps)}
}

type documentSyncRunner interface {
	Sync(ctx context.Context, input *documentdomain.SyncDocumentInput) error
}

type thirdFileRevectorizeRunner interface {
	RunThirdFileRevectorize(ctx context.Context, input *documentdomain.ThirdFileRevectorizeInput) error
}

type documentSyncSchedulerAdapter struct {
	scheduler documentsync.Scheduler
}

func (a documentSyncSchedulerAdapter) Schedule(ctx context.Context, input *documentdomain.SyncDocumentInput) {
	if a.scheduler == nil || input == nil {
		return
	}

	payload, err := json.Marshal(input)
	if err != nil {
		return
	}

	a.scheduler.Schedule(ctx, &documentsync.Task{
		KnowledgeBaseCode: input.KnowledgeBaseCode,
		Code:              input.Code,
		Mode:              input.Mode,
		Async:             input.Async,
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

func buildThirdFileRevectorizeScheduler(
	runner thirdFileRevectorizeRunner,
	logger *logging.SugaredLogger,
	runtimeDeps DocumentAppRuntimeDeps,
) thirdFileRevectorizeSchedulerAdapter {
	infraRunner := documentsync.RunnerFunc(func(ctx context.Context, task *documentsync.Task) error {
		if runner == nil || task == nil {
			return nil
		}
		input, err := decodeThirdFileRevectorizeTask(task)
		if err != nil {
			return err
		}
		return runner.RunThirdFileRevectorize(ctx, input)
	})

	return thirdFileRevectorizeSchedulerAdapter{scheduler: buildKnowledgeScheduler(infraRunner, logger, runtimeDeps)}
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

func buildKnowledgeScheduler(
	runner documentsync.Runner,
	logger *logging.SugaredLogger,
	runtimeDeps DocumentAppRuntimeDeps,
) documentsync.Scheduler {
	if runtimeDeps.RedisClient == nil || runtimeDeps.Config == nil {
		return documentsync.NewAsyncScheduler(runner, logger, 0)
	}

	defaults := documentsync.DefaultRedisSchedulerConfig()
	return documentsync.NewRedisScheduler(
		runner,
		logger,
		runtimeDeps.RedisClient,
		lockpkg.NewRedisLockManager(runtimeDeps.RedisClient, &lockpkg.RedisConfig{
			LockPrefix:         runtimeDeps.Config.Redis.LockPrefix,
			LockTTLSeconds:     runtimeDeps.Config.Redis.LockTTLSeconds,
			SpinIntervalMillis: runtimeDeps.Config.Redis.SpinIntervalMillis,
			SpinMaxRetries:     runtimeDeps.Config.Redis.SpinMaxRetries,
		}),
		documentsync.RedisSchedulerConfig{
			DebounceWindow:    durationOrDefault(runtimeDeps.Config.Redis.DocumentResyncDebounceMillis, defaults.DebounceWindow),
			LockTTL:           durationOrDefault(runtimeDeps.Config.Redis.DocumentResyncLockTTLSeconds, defaults.LockTTL),
			HeartbeatInterval: durationOrDefault(runtimeDeps.Config.Redis.DocumentResyncHeartbeatMillis, defaults.HeartbeatInterval),
			StateTTL:          durationOrDefault(runtimeDeps.Config.Redis.DocumentResyncStateTTLSeconds, defaults.StateTTL),
			RedisOpTimeout:    durationOrDefault(runtimeDeps.Config.Redis.DocumentResyncRedisTimeoutMillis, defaults.RedisOpTimeout),
			WatchRetryTimes:   defaults.WatchRetryTimes,
		},
		0,
	)
}

type thirdFileRevectorizeSchedulerAdapter struct {
	scheduler documentsync.Scheduler
}

func (a thirdFileRevectorizeSchedulerAdapter) Schedule(ctx context.Context, input *documentdomain.ThirdFileRevectorizeInput) {
	if a.scheduler == nil || input == nil {
		return
	}

	payload, err := json.Marshal(input)
	if err != nil {
		return
	}

	key := fmt.Sprintf(
		"%s:%s:%s",
		input.OrganizationCode,
		input.ThirdPlatformType,
		input.ThirdFileID,
	)
	a.scheduler.Schedule(ctx, &documentsync.Task{
		KnowledgeBaseCode: input.OrganizationCode,
		Code:              input.ThirdPlatformType + ":" + input.ThirdFileID,
		Mode:              documentdomain.SyncModeResync,
		Async:             true,
		Key:               key,
		Payload:           payload,
	})
}

func decodeThirdFileRevectorizeTask(task *documentsync.Task) (*documentdomain.ThirdFileRevectorizeInput, error) {
	if task == nil {
		return &documentdomain.ThirdFileRevectorizeInput{}, nil
	}
	if len(task.Payload) == 0 {
		return &documentdomain.ThirdFileRevectorizeInput{}, nil
	}

	var input documentdomain.ThirdFileRevectorizeInput
	if err := json.Unmarshal(task.Payload, &input); err != nil {
		return nil, fmt.Errorf("unmarshal third-file revectorize task: %w", err)
	}
	return &input, nil
}

// Package infra 提供基础设施依赖注入 Provider。
package infra

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	configloader "magic/internal/config"
	autoloadcfg "magic/internal/config/autoload"
	userdomain "magic/internal/domain/contact/user"
	docrepo "magic/internal/domain/knowledge/document/repository"
	documentdomain "magic/internal/domain/knowledge/document/service"
	embeddingdomain "magic/internal/domain/knowledge/embedding"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	taskfiledomain "magic/internal/domain/taskfile/service"
	"magic/internal/infrastructure/external"
	"magic/internal/infrastructure/external/ocr"
	"magic/internal/infrastructure/health"
	"magic/internal/infrastructure/knowledge/documentsync"
	sourcecallbackcache "magic/internal/infrastructure/knowledge/sourcecallbackcache"
	"magic/internal/infrastructure/logging"
	metrics "magic/internal/infrastructure/metrics"
	parser "magic/internal/infrastructure/parser"
	"magic/internal/infrastructure/persistence"
	"magic/internal/infrastructure/persistence/mysql"
	mysqlcontactuserrepo "magic/internal/infrastructure/persistence/mysql/contact/user"
	mysqldocumentrepo "magic/internal/infrastructure/persistence/mysql/knowledge/document"
	mysqlocrcache "magic/internal/infrastructure/persistence/mysql/knowledge/document/ocrcache"
	mysqlembeddingcache "magic/internal/infrastructure/persistence/mysql/knowledge/embeddingcache"
	mysqlfragmentrepo "magic/internal/infrastructure/persistence/mysql/knowledge/fragment"
	mysqlknowledgebase "magic/internal/infrastructure/persistence/mysql/knowledge/knowledgebase"
	mysqlknowledgebasebinding "magic/internal/infrastructure/persistence/mysql/knowledge/knowledgebasebinding"
	mysqlsourcebindingrepo "magic/internal/infrastructure/persistence/mysql/knowledge/sourcebinding"
	mysqlsupermagicagentrepo "magic/internal/infrastructure/persistence/mysql/knowledge/supermagicagent"
	mysqltransaction "magic/internal/infrastructure/persistence/mysql/knowledge/transaction"
	mysqlrebuild "magic/internal/infrastructure/persistence/mysql/rebuild"
	mysqlsupermagicprojectrepo "magic/internal/infrastructure/persistence/mysql/supermagicproject"
	mysqltaskfilerepo "magic/internal/infrastructure/persistence/mysql/taskfile"
	redisrebuild "magic/internal/infrastructure/persistence/redis/rebuild"
	ipcclient "magic/internal/infrastructure/rpc/jsonrpc/client"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
	"magic/internal/infrastructure/vectordb/qdrant"
	"magic/internal/pkg/lock"
	"magic/internal/pkg/logkey"
	"magic/internal/pkg/ratelimit"
	"magic/internal/pkg/tokenizer"
)

// FragmentVectorDBDataRepository 表示片段向量数据仓储的具体 DI 输出类型。
type FragmentVectorDBDataRepository struct {
	*qdrant.VectorDBDataRepository[fragmodel.FragmentPayload]
}

const (
	defaultEmbeddingRateLimitQPS                = 30
	defaultEmbeddingRateLimitBurst              = 30
	defaultEmbeddingRateLimitWaitTimeoutSeconds = 10
	embeddingRateLimitRedisKeyPrefix            = "knowledge:rate_limit:"
	embeddingRateLimitKey                       = "embedding:compute"
	defaultOCRRateLimitQPS                      = 2
	defaultOCRRateLimitBurst                    = 1
	defaultOCRRateLimitWaitTimeoutSeconds       = 10
	ocrRateLimitRedisKeyPrefix                  = "knowledge:rate_limit:"
	ocrRateLimitKey                             = "ocr:Volcengine"
)

// ProvideConfig 提供配置
func ProvideConfig() *autoloadcfg.Config {
	return configloader.New()
}

// ProvideLogger 提供日志记录器
func ProvideLogger(cfg *autoloadcfg.Config) *logging.SugaredLogger {
	return logging.NewFromConfig(cfg.Logging)
}

// ProvideMySQLSQLCClient 提供基于 sqlc 的 MySQL 客户端
func ProvideMySQLSQLCClient(cfg *autoloadcfg.Config, logger *logging.SugaredLogger) (*mysql.SQLCClient, func(), error) {
	dbLogger := logger.Named("mysql.SQLCClient")
	client, err := mysql.NewSQLCClient(&cfg.MySQL, dbLogger)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create MySQL sqlc client: %w", err)
	}
	cleanup := func() {
		if err := client.Close(); err != nil {
			dbLogger.WarnContext(context.Background(), "failed to close MySQL client", logkey.Error, err)
		}
	}
	return client, cleanup, nil
}

// ProvideEmbeddingCacheRepository 提供领域层的向量缓存仓储实现
func ProvideEmbeddingCacheRepository(mysqlClient *mysql.SQLCClient, logger *logging.SugaredLogger) *mysqlembeddingcache.Repository {
	// 基础设施层实现满足领域接口
	return mysqlembeddingcache.NewRepository(mysqlClient, logger.Named("mysql.EmbeddingCacheRepository"))
}

// ProvideVectorRebuildCoordinator 提供知识库重建协调器（Redis）。
func ProvideVectorRebuildCoordinator(client *redis.Client, logger *logging.SugaredLogger) *redisrebuild.Coordinator {
	return redisrebuild.NewCoordinator(client, logger.Named("redis.VectorRebuildCoordinator"))
}

// ProvideKnowledgeRebuildStore 提供知识库重建的 MySQL 存储实现。
func ProvideKnowledgeRebuildStore(
	mysqlClient *mysql.SQLCClient,
	redisClient *redis.Client,
	logger *logging.SugaredLogger,
) *mysqlrebuild.MySQLStore {
	if redisClient == nil {
		return mysqlrebuild.NewMySQLStoreWithLogger(mysqlClient.DB(), logger.Named("mysql.KnowledgeRebuildStore"))
	}
	return mysqlrebuild.NewMySQLStoreWithLoggerAndCollectionMetaCache(mysqlClient.DB(), redisClient, logger.Named("mysql.KnowledgeRebuildStore"))
}

// ProvideEmbeddingClientFactory 提供嵌入客户端工厂
// 根据配置决定使用 PHP JSON-RPC 回调还是 OpenAI 直接调用
func ProvideEmbeddingClientFactory(
	cfg *autoloadcfg.Config,
	server *unixsocket.Server,
	logger *logging.SugaredLogger,
	accessTokenProvider external.AccessTokenProvider,
) *external.EmbeddingClientFactory {
	clientType := external.EmbeddingClientType(cfg.Embedding.ClientType)
	if clientType == "" {
		clientType = external.EmbeddingClientTypeOpenAI
	}

	return external.NewEmbeddingClientFactory(
		server,
		cfg.MagicModelGateway.BaseURL,
		clientType,
		logger.Named("external.EmbeddingClientFactory"),
		accessTokenProvider,
	)
}

// ProvideAccessTokenProvider 提供配置优先的访问令牌策略。
func ProvideAccessTokenProvider(
	cfg *autoloadcfg.Config,
	server *unixsocket.Server,
	logger *logging.SugaredLogger,
) external.AccessTokenProvider {
	ipcProvider := ipcclient.NewPHPAccessTokenRPCClient(server, logger.Named("ipcclient.PHPAccessTokenRPCClient"))
	return external.NewConfigFirstAccessTokenProvider(cfg.MagicModelGateway.MagicAccessToken, ipcProvider)
}

// ProvideThirdPlatformDocumentPort 提供第三方文档解析端口实现（Go -> PHP IPC）。
func ProvideThirdPlatformDocumentPort(
	server *unixsocket.Server,
	redisClient *redis.Client,
	logger *logging.SugaredLogger,
) *ipcclient.PHPThirdPlatformDocumentRPCClient {
	return ipcclient.NewPHPThirdPlatformDocumentRPCClient(
		server,
		logger.Named("ipcclient.PHPThirdPlatformDocumentRPCClient"),
		redisClient,
	)
}

// ProvideProjectFilePort 提供项目文件解析端口实现（Go -> PHP IPC）。
func ProvideProjectFilePort(
	server *unixsocket.Server,
	logger *logging.SugaredLogger,
) *ipcclient.PHPProjectFileRPCClient {
	return ipcclient.NewPHPProjectFileRPCClient(server, logger.Named("ipcclient.PHPProjectFileRPCClient"))
}

// ProvideTaskFileDomainService 提供 Go 侧 task file 可见性领域服务。
func ProvideTaskFileDomainService(client *mysql.SQLCClient) *taskfiledomain.DomainService {
	return taskfiledomain.NewDomainService(mysqltaskfilerepo.NewRepository(client))
}

// ProvideContactUserRepository 提供 Magic 联系人用户仓储。
func ProvideContactUserRepository(client *mysql.SQLCClient) *mysqlcontactuserrepo.Repository {
	return mysqlcontactuserrepo.NewRepository(client)
}

// ProvideContactUserDomainService 提供 Magic 联系人用户领域服务。
func ProvideContactUserDomainService(repo *mysqlcontactuserrepo.Repository) *userdomain.DomainService {
	return userdomain.NewDomainService(repo)
}

// ProvideKnowledgeBasePermissionPort 提供知识库权限只读端口实现（Go -> PHP IPC）。
func ProvideKnowledgeBasePermissionPort(
	server *unixsocket.Server,
	logger *logging.SugaredLogger,
) *ipcclient.PHPKnowledgeBasePermissionRPCClient {
	return ipcclient.NewPHPKnowledgeBasePermissionRPCClient(server, logger.Named("ipcclient.PHPKnowledgeBasePermissionRPCClient"))
}

// ProvideSuperMagicAgentPort 提供数字员工只读权限端口实现（Go -> PHP IPC）。
func ProvideSuperMagicAgentPort(
	server *unixsocket.Server,
	logger *logging.SugaredLogger,
) *ipcclient.PHPSuperMagicAgentRPCClient {
	return ipcclient.NewPHPSuperMagicAgentRPCClient(server, logger.Named("ipcclient.PHPSuperMagicAgentRPCClient"))
}

// ProvideOCRConfigProvider 提供 OCR 配置真值读取端口实现（Go -> PHP IPC）。
func ProvideOCRConfigProvider(
	server *unixsocket.Server,
	logger *logging.SugaredLogger,
) *ipcclient.PHPOCRConfigRPCClient {
	return ipcclient.NewPHPOCRConfigRPCClient(server, logger.Named("ipcclient.PHPOCRConfigRPCClient"))
}

// ProvideEmbeddingService 提供嵌入服务
func ProvideEmbeddingService(
	cfg *autoloadcfg.Config,
	redisClient *redis.Client,
	factory *external.EmbeddingClientFactory,
	defaultModel autoloadcfg.EmbeddingDefaultModel,
	logger *logging.SugaredLogger,
) *external.EmbeddingService {
	service := external.NewEmbeddingService(factory.GetClient(), string(defaultModel))
	if cfg == nil || !cfg.Embedding.RateLimitEnabled {
		return service
	}

	limiter, err := ratelimit.NewRedisTokenBucket(redisClient, newEmbeddingRateLimitConfig(cfg))
	if err != nil {
		if logger != nil {
			logger.KnowledgeWarnContext(
				context.Background(),
				"Init embedding rate limiter failed",
				"error", err,
			)
		}
		service.SetRateLimiter(
			unavailableRateLimiter{err: err},
			newEmbeddingServiceRateLimitConfig(cfg),
		)
		return service
	}
	service.SetRateLimiter(limiter, newEmbeddingServiceRateLimitConfig(cfg))
	return service
}

func newEmbeddingRateLimitConfig(cfg *autoloadcfg.Config) ratelimit.Config {
	rate := cfg.Embedding.RateLimitQPS
	if rate <= 0 {
		rate = defaultEmbeddingRateLimitQPS
	}
	burst := cfg.Embedding.RateLimitBurst
	if burst <= 0 {
		burst = defaultEmbeddingRateLimitBurst
	}
	return ratelimit.Config{
		KeyPrefix:     embeddingRateLimitRedisKeyPrefix,
		RatePerSecond: rate,
		Burst:         burst,
	}
}

func newEmbeddingServiceRateLimitConfig(cfg *autoloadcfg.Config) external.EmbeddingRateLimitConfig {
	timeout := time.Duration(cfg.Embedding.RateLimitWaitTimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = defaultEmbeddingRateLimitWaitTimeoutSeconds * time.Second
	}
	return external.EmbeddingRateLimitConfig{
		Key:         embeddingRateLimitKey,
		WaitTimeout: timeout,
	}
}

// ProvideEmbeddingDimensionResolver 提供嵌入维度解析器
func ProvideEmbeddingDimensionResolver(
	cfg *autoloadcfg.Config,
	embeddingService *external.EmbeddingService,
) embeddingdomain.DimensionResolver {
	return external.NewEmbeddingDimensionResolver(cfg, embeddingService)
}

// ProvideEmbeddingRepository 提供 EmbeddingRepository 实现
// 这是 Domain 层定义的 Repository 接口，由 Infrastructure 层实现
func ProvideEmbeddingRepository(embeddingService *external.EmbeddingService) embeddingdomain.Repository {
	return persistence.NewEmbeddingRepository(embeddingService)
}

// ProvideKnowledgeBaseRepository 提供 KnowledgeBaseRepository 实现
func ProvideKnowledgeBaseRepository(
	client *mysql.SQLCClient,
	redisClient *redis.Client,
	logger *logging.SugaredLogger,
) *mysqlknowledgebase.BaseRepository {
	if redisClient == nil {
		return mysqlknowledgebase.NewBaseRepository(client, logger.Named("mysql.KnowledgeBaseRepository"))
	}
	return mysqlknowledgebase.NewBaseRepositoryWithCollectionMetaCache(client, redisClient, logger.Named("mysql.KnowledgeBaseRepository"))
}

// ProvideFragmentRepository 提供 KnowledgeBaseFragmentRepository 实现
func ProvideFragmentRepository(client *mysql.SQLCClient, logger *logging.SugaredLogger) fragmodel.KnowledgeBaseFragmentRepository {
	return mysqlfragmentrepo.NewFragmentRepository(client, logger.Named("mysql.FragmentRepository"))
}

// ProvideDocumentRepository 提供 KnowledgeBaseDocumentRepository 实现
func ProvideDocumentRepository(client *mysql.SQLCClient, logger *logging.SugaredLogger) docrepo.KnowledgeBaseDocumentRepository {
	return mysqldocumentrepo.NewDocumentRepository(client, logger.Named("mysql.DocumentRepository"))
}

// ProvideOCRResultCacheRepository 提供 OCR 结果缓存仓储实现。
func ProvideOCRResultCacheRepository(
	client *mysql.SQLCClient,
	logger *logging.SugaredLogger,
) docrepo.OCRResultCacheRepository {
	return mysqlocrcache.NewRepository(client, logger.Named("mysql.OCRResultCacheRepository"))
}

// ProvideSourceBindingRepository 提供知识库来源绑定仓储实现。
func ProvideSourceBindingRepository(
	client *mysql.SQLCClient,
	redisClient *redis.Client,
	cfg *autoloadcfg.Config,
) *mysqlsourcebindingrepo.Repository {
	_ = cfg
	repo := mysqlsourcebindingrepo.NewRepository(client)
	if redisClient == nil {
		return repo
	}
	repo.SetSourceCallbackEligibilityInvalidator(sourcecallbackcache.NewRedisCache(redisClient))
	return repo
}

// ProvideKnowledgeBaseBindingRepository 提供知识库绑定对象仓储实现。
func ProvideKnowledgeBaseBindingRepository(client *mysql.SQLCClient) *mysqlknowledgebasebinding.Repository {
	return mysqlknowledgebasebinding.NewRepository(client)
}

// ProvideSuperMagicAgentRepository 提供数字员工只读仓储实现。
func ProvideSuperMagicAgentRepository(client *mysql.SQLCClient) *mysqlsupermagicagentrepo.Repository {
	return mysqlsupermagicagentrepo.NewRepository(client)
}

// ProvideSuperMagicProjectRepository 提供 super magic project 只读仓储实现。
func ProvideSuperMagicProjectRepository(client *mysql.SQLCClient) *mysqlsupermagicprojectrepo.Repository {
	return mysqlsupermagicprojectrepo.NewRepository(client)
}

// ProvideManualFragmentCoordinator 提供手工片段创建事务协调器。
func ProvideManualFragmentCoordinator(client *mysql.SQLCClient, logger *logging.SugaredLogger) *mysqltransaction.ManualFragmentCoordinator {
	return mysqltransaction.NewManualFragmentCoordinator(client, logger.Named("mysql.ManualFragmentCoordinator"))
}

// ProvideKnowledgeBaseDestroyCoordinator 提供知识库删除事务协调器。
func ProvideKnowledgeBaseDestroyCoordinator(client *mysql.SQLCClient) *mysqltransaction.KnowledgeBaseDestroyCoordinator {
	return mysqltransaction.NewKnowledgeBaseDestroyCoordinator(client)
}

// ProvideKnowledgeBaseWriteCoordinator 提供知识库写入事务协调器。
func ProvideKnowledgeBaseWriteCoordinator(
	client *mysql.SQLCClient,
	knowledgeBaseRepo *mysqlknowledgebase.BaseRepository,
	sourceBindingRepo *mysqlsourcebindingrepo.Repository,
	knowledgeBaseBindingRepo *mysqlknowledgebasebinding.Repository,
) *mysqltransaction.KnowledgeBaseWriteCoordinator {
	return mysqltransaction.NewKnowledgeBaseWriteCoordinator(client, knowledgeBaseRepo, sourceBindingRepo, knowledgeBaseBindingRepo)
}

// ProvideContentLoader 提供内容加载器
func ProvideContentLoader() embeddingdomain.ContentLoader {
	return external.NewContentLoader()
}

// ProvideRedisClient 提供 Redis 客户端
func ProvideRedisClient(cfg *autoloadcfg.Config, logger *logging.SugaredLogger) (*redis.Client, func(), error) {
	redisLogger := logger.Named("redis.Client")
	client, err := lock.NewRedisClient(&cfg.Redis)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create Redis client: %w", err)
	}
	cleanup := func() {
		if err := closeRedisClient(client); err != nil {
			redisLogger.WarnContext(context.Background(), "failed to close Redis client", logkey.Error, err)
		}
	}
	return client, cleanup, nil
}

// ProvideDocumentSyncRabbitMQBroker 提供文档重向量化 RabbitMQ broker。
func ProvideDocumentSyncRabbitMQBroker(
	cfg *autoloadcfg.Config,
	logger *logging.SugaredLogger,
) (*documentsync.RabbitMQBroker, func(), error) {
	if cfg == nil || !cfg.RabbitMQ.Enabled || cfg.RabbitMQ.Host == "" || cfg.RabbitMQ.Port <= 0 {
		return nil, func() {}, nil
	}

	broker := documentsync.NewRabbitMQBroker(documentsync.RabbitMQBrokerConfig{
		Enabled:  cfg.RabbitMQ.Enabled,
		Host:     cfg.RabbitMQ.Host,
		Port:     cfg.RabbitMQ.Port,
		User:     cfg.RabbitMQ.Username,
		Password: cfg.RabbitMQ.AuthValue,
		VHost:    cfg.RabbitMQ.VHost,
	}, logger.Named("documentsync.RabbitMQBroker"))
	if err := broker.ValidateConfig(); err != nil {
		logger.ErrorContext(
			context.Background(),
			"Validate document sync rabbitmq config failed",
			"host", strings.TrimSpace(cfg.RabbitMQ.Host),
			"port", cfg.RabbitMQ.Port,
			"user", strings.TrimSpace(cfg.RabbitMQ.Username),
			"vhost", strings.TrimSpace(cfg.RabbitMQ.VHost),
			"error", err,
		)
		return nil, func() {}, fmt.Errorf("validate document sync rabbitmq broker config: %w", err)
	}
	return broker, func() {
		if err := broker.Close(); err != nil {
			logger.KnowledgeWarnContext(context.Background(), "failed to close document sync rabbitmq broker", logkey.Error, err)
		}
	}, nil
}

// ProvideRedisLockManager 提供 Redis 分布式锁管理器
func ProvideRedisLockManager(client *redis.Client, cfg *autoloadcfg.Config) *lock.RedisLockManager {
	lockConfig := &lock.RedisConfig{
		LockPrefix:         cfg.Redis.LockPrefix,
		LockTTLSeconds:     cfg.Redis.LockTTLSeconds,
		SpinIntervalMillis: cfg.Redis.SpinIntervalMillis,
		SpinMaxRetries:     cfg.Redis.SpinMaxRetries,
	}
	return lock.NewRedisLockManager(client, lockConfig)
}

// ProvideSinglePodJobRunner 提供单 pod 定时任务执行器。
func ProvideSinglePodJobRunner(lockManager *lock.RedisLockManager) lock.SinglePodJobRunner {
	return lock.NewRedisSinglePodJobRunner(lockManager)
}

// ProvideMetrics 提供 Metrics 服务
func ProvideMetrics() *metrics.Metrics {
	return metrics.NewMetrics()
}

// ProvideTokenizer 提供当前应用依赖图复用的离线 tokenizer 实例。
func ProvideTokenizer() *tokenizer.Service {
	return tokenizer.NewService()
}

// ProvideRPCServerOverIPC 提供基于 IPC 传输的 RPC 服务端（默认不启动）。
func ProvideRPCServerOverIPC(cfg *autoloadcfg.Config, logger *logging.SugaredLogger) *unixsocket.Server {
	return unixsocket.NewServer(&cfg.IPC, logger.Named("unixsocket.Server"))
}

// ProvideQdrantClient 提供 Qdrant 客户端
func ProvideQdrantClient(cfg *autoloadcfg.Config, logger *logging.SugaredLogger) (*qdrant.Client, func(), error) {
	qdrantLogger := logger.Named("qdrant.Client")
	host, port, apiKey := resolveQdrantEndpoint(cfg.Qdrant)
	clientCfg := &qdrant.Config{
		Host:                host,
		Port:                port,
		BaseURI:             cfg.Qdrant.BaseURI,
		Credential:          apiKey,
		MaxConcurrentWrites: cfg.Qdrant.MaxConcurrentWrites,
		LogTimingEnabled:    cfg.Qdrant.LogTimingEnabled,
		LogSlowThresholdMs:  cfg.Qdrant.LogSlowThresholdMs,
	}
	client, err := qdrant.NewClient(clientCfg, qdrantLogger)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create Qdrant client: %w", err)
	}
	cleanup := func() {
		if err := closeQdrantClient(client); err != nil {
			qdrantLogger.KnowledgeWarnContext(context.Background(), "failed to close Qdrant client", logkey.Error, err)
		}
	}
	return client, cleanup, nil
}

func resolveQdrantEndpoint(cfg autoloadcfg.QdrantConfig) (string, int, string) {
	host := cfg.EffectiveHost()

	apiKey := strings.TrimSpace(cfg.AuthValue)
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("QDRANT_API_KEY"))
	}

	return host, cfg.Port, apiKey
}

// ProvideVectorDBManagementRepository 提供向量数据库管理仓储
func ProvideVectorDBManagementRepository(client *qdrant.Client) fragmodel.VectorDBManagementRepository {
	return qdrant.NewVectorDBManagementRepository(client)
}

// ProvideFragmentVectorDBDataRepository 提供片段向量数据库数据仓储
func ProvideFragmentVectorDBDataRepository(client *qdrant.Client) *FragmentVectorDBDataRepository {
	return &FragmentVectorDBDataRepository{
		VectorDBDataRepository: qdrant.NewVectorDBDataRepository[fragmodel.FragmentPayload](client),
	}
}

// ProvideHealthCheckService 提供健康检查服务
// 该服务协调多个基础设施组件的健康检查
func ProvideHealthCheckService(
	mysqlClient *mysql.SQLCClient,
	redisClient *redis.Client,
	embeddingCacheRepo *mysqlembeddingcache.Repository,
	qdrantClient *qdrant.Client,
	rabbitMQBroker *documentsync.RabbitMQBroker,
) *health.CheckService {
	// 适配 redis.Client 以满足 health.RedisPinger 接口
	redisPinger := &redisPingerAdapter{client: redisClient}

	checkers := map[string]health.Checker{
		"mysql": health.NewMySQLHealthChecker(mysqlClient.DB()),
		"redis": health.NewRedisHealthChecker(redisPinger),
	}
	return health.NewHealthCheckService(
		checkers,
		embeddingCacheRepo,
		newContextCloser("mysql client", func(context.Context) error {
			if mysqlClient == nil {
				return nil
			}
			return mysqlClient.Close()
		}),
		newContextCloser("redis client", func(context.Context) error {
			return closeRedisClient(redisClient)
		}),
		newContextCloser("qdrant client", func(context.Context) error {
			return closeQdrantClient(qdrantClient)
		}),
		newContextCloser("rabbitmq broker", func(context.Context) error {
			if rabbitMQBroker == nil {
				return nil
			}
			return rabbitMQBroker.Close()
		}),
	)
}

type contextCloser struct {
	name  string
	close func(ctx context.Context) error
}

func newContextCloser(name string, closeFn func(ctx context.Context) error) health.Closer {
	if closeFn == nil {
		return nil
	}
	return contextCloser{name: name, close: closeFn}
}

func (c contextCloser) Close(ctx context.Context) error {
	if c.close == nil {
		return nil
	}
	if err := c.close(ctx); err != nil {
		return fmt.Errorf("%s: %w", c.name, err)
	}
	return nil
}

func closeRedisClient(client *redis.Client) error {
	if client == nil {
		return nil
	}
	err := client.Close()
	if err != nil && !errors.Is(err, redis.ErrClosed) {
		return fmt.Errorf("close redis client: %w", err)
	}
	return nil
}

func closeQdrantClient(client *qdrant.Client) error {
	if client == nil {
		return nil
	}
	err := client.Close()
	if err != nil && status.Code(err) != codes.Canceled {
		return fmt.Errorf("close qdrant client: %w", err)
	}
	return nil
}

// redisPingerAdapter 适配 go-redis 客户端到 RedisPinger 接口
type redisPingerAdapter struct {
	client *redis.Client
}

// Ping 实现 RedisPinger 接口
func (a *redisPingerAdapter) Ping(ctx context.Context) error {
	if err := a.client.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("redis ping failed: %w", err)
	}
	return nil
}

// ProvideVolcengineOCRClient 提供火山引擎 OCR 客户端。
func ProvideVolcengineOCRClient(
	cfg *autoloadcfg.Config,
	redisClient *redis.Client,
	configProvider documentdomain.OCRConfigProviderPort,
	usageReporter documentdomain.OCRUsageReporterPort,
	cacheRepo docrepo.OCRResultCacheRepository,
	logger *logging.SugaredLogger,
) *ocr.VolcengineOCRClient {
	client := ocr.NewVolcengineOCRClient(configProvider, cacheRepo, logger.Named("ocr.VolcengineOCRClient"))
	client.SetUsageReporter(usageReporter)
	limiter, err := ratelimit.NewRedisTokenBucket(redisClient, newOCRRateLimitConfig(cfg))
	if err != nil {
		client.SetRateLimiter(
			unavailableRateLimiter{err: err},
			newOCRClientRateLimitConfig(cfg),
		)
		return client
	}
	client.SetRateLimiter(limiter, newOCRClientRateLimitConfig(cfg))
	return client
}

type unavailableRateLimiter struct {
	err error
}

func (l unavailableRateLimiter) Wait(context.Context, string, time.Duration) (ratelimit.Result, error) {
	if l.err == nil {
		return ratelimit.Result{}, ratelimit.ErrUnavailable
	}
	return ratelimit.Result{}, fmt.Errorf("%w: %w", ratelimit.ErrUnavailable, l.err)
}

func newOCRRateLimitConfig(cfg *autoloadcfg.Config) ratelimit.Config {
	rate := float64(defaultOCRRateLimitQPS)
	if cfg != nil {
		rate = cfg.OCR.RateLimitQPS
	}
	if rate <= 0 {
		rate = defaultOCRRateLimitQPS
	}
	if rate > defaultOCRRateLimitQPS {
		rate = defaultOCRRateLimitQPS
	}
	return ratelimit.Config{
		KeyPrefix:     ocrRateLimitRedisKeyPrefix,
		RatePerSecond: rate,
		Burst:         defaultOCRRateLimitBurst,
	}
}

func newOCRClientRateLimitConfig(cfg *autoloadcfg.Config) ocr.RateLimitConfig {
	var timeout time.Duration
	if cfg != nil {
		timeout = time.Duration(cfg.OCR.RateLimitWaitTimeoutSeconds) * time.Second
	}
	if timeout <= 0 {
		timeout = defaultOCRRateLimitWaitTimeoutSeconds * time.Second
	}
	return ocr.RateLimitConfig{
		Key:         ocrRateLimitKey,
		WaitTimeout: timeout,
	}
}

// ProvidePHPFileRPCClient 提供 PHP 文件服务 RPC 客户端。
func ProvidePHPFileRPCClient(
	server *unixsocket.Server,
	logger *logging.SugaredLogger,
) *ipcclient.PHPFileRPCClient {
	return ipcclient.NewPHPFileRPCClient(server, logger.Named("ipcclient.PHPFileRPCClient"))
}

// ProvideDocumentParsers 提供所有文档解析器
func ProvideDocumentParsers(
	cfg *autoloadcfg.Config,
	fileFetcher documentdomain.FileFetcher,
	ocrClient *ocr.VolcengineOCRClient,
) []documentdomain.Parser {
	maxOCRPerFile := documentdomain.NormalizeEmbeddedImageOCRLimit(cfg.OCR.MaxOCRPerFile)
	resourceLimits := documentResourceLimitsFromConfig(cfg)
	return []documentdomain.Parser{
		parser.NewCSVParserWithLimits(resourceLimits),
		parser.NewXlsxParserWithOCRAndLimits(ocrClient, maxOCRPerFile, resourceLimits),
		parser.NewDocxParserWithLimit(ocrClient, maxOCRPerFile),
		parser.NewPptxParserWithLimit(ocrClient, maxOCRPerFile),
		parser.NewPDFHybridParserWithLimit(ocrClient, maxOCRPerFile),
		parser.NewOCRParser(ocrClient),
		parser.NewPlainTextParser(),
		parser.NewMarkdownParserWithAssets(fileFetcher, ocrClient, maxOCRPerFile),
		parser.NewHTMLParserWithAssets(fileFetcher, ocrClient, maxOCRPerFile),
		parser.NewXMLParser(),
		parser.NewJSONParser(),
	}
}

// ProvideDocumentParseService 提供文档解析领域服务
func ProvideDocumentParseService(
	cfg *autoloadcfg.Config,
	fileFetcher documentdomain.FileFetcher,
	parsers []documentdomain.Parser,
	logger *logging.SugaredLogger,
) *documentdomain.ParseService {
	return documentdomain.NewParseServiceWithLimits(
		fileFetcher,
		parsers,
		logger.Named("documentdomain.ParseService"),
		documentResourceLimitsFromConfig(cfg),
	)
}

func documentResourceLimitsFromConfig(cfg *autoloadcfg.Config) documentdomain.ResourceLimits {
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

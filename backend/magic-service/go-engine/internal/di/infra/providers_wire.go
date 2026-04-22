//go:build wireinject

package infra

import (
	"github.com/google/wire"

	diknowledge "magic/internal/di/knowledge"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/embedding"
	"magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/rebuild"
	mysqldocumentrepo "magic/internal/infrastructure/persistence/mysql/knowledge/document"
	mysqlembeddingcache "magic/internal/infrastructure/persistence/mysql/knowledge/embeddingcache"
	mysqlfragmentrepo "magic/internal/infrastructure/persistence/mysql/knowledge/fragment"
	mysqlknowledgebase "magic/internal/infrastructure/persistence/mysql/knowledge/knowledgebase"
	mysqltransaction "magic/internal/infrastructure/persistence/mysql/knowledge/transaction"
	redisrebuild "magic/internal/infrastructure/persistence/redis/rebuild"
	ipcclient "magic/internal/infrastructure/rpc/jsonrpc/client"
)

// ProviderSet 聚合基础设施层的依赖注入集合。
var ProviderSet = wire.NewSet(
	ProvideConfig,
	ProvideLogger,
	ProvideMySQLSQLCClient,
	ProvideRedisClient,
	ProvideRedisLockManager,
	ProvideSinglePodJobRunner,
	ProvideVectorRebuildCoordinator,
	ProvideKnowledgeRebuildStore,
	wire.Bind(new(rebuild.VectorRebuildCoordinator), new(*redisrebuild.Coordinator)),
	wire.Bind(new(rebuild.VectorRebuildRunStateReader), new(*redisrebuild.Coordinator)),
	ProvideHealthCheckService,
	// 仓储
	ProvideEmbeddingCacheRepository,
	wire.Bind(new(embedding.CacheRepository), new(*mysqlembeddingcache.Repository)),
	wire.Bind(new(embedding.CacheAnalysisRepository), new(*mysqlembeddingcache.Repository)),
	ProvideEmbeddingRepository,
	ProvideKnowledgeBaseRepository,
	wire.Bind(new(knowledgebase.Repository), new(*mysqlknowledgebase.BaseRepository)),
	wire.Bind(new(knowledgebase.CollectionMetaReader), new(*mysqlknowledgebase.BaseRepository)),
	ProvideFragmentRepository,
	ProvideDocumentRepository,
	ProvideOCRResultCacheRepository,
	ProvideSourceBindingRepository,
	ProvideKnowledgeBaseBindingRepository,
	ProvideSuperMagicAgentRepository,
	ProvideKnowledgeBaseDestroyCoordinator,
	ProvideKnowledgeBaseWriteCoordinator,
	ProvideManualFragmentCoordinator,
	ProvideQdrantClient,
	ProvideVectorDBManagementRepository,
	ProvideFragmentVectorDBDataRepository,
	// RPC 服务（通过 IPC 传输）
	ProvideRPCServerOverIPC,
	// 外部客户端/服务
	ProvideAccessTokenProvider,
	ProvideThirdPlatformDocumentPort,
	ProvideProjectFilePort,
	ProvideTaskFileDomainService,
	ProvideOperationPermissionPort,
	ProvideKnowledgeBasePermissionPort,
	ProvideSuperMagicAgentPort,
	ProvideOCRConfigProvider,
	wire.Bind(new(diknowledge.FragmentVectorDBDataRepository), new(*FragmentVectorDBDataRepository)),
	wire.Bind(new(documentdomain.OCRConfigProviderPort), new(*ipcclient.PHPOCRConfigRPCClient)),
	ProvideEmbeddingClientFactory,
	ProvideEmbeddingService,
	ProvideEmbeddingDimensionResolver,
	ProvideContentLoader,
	ProvideMetrics,
	ProvideTokenizer,
	// 文档解析
	ProvideVolcengineOCRClient,
	ProvidePHPFileRPCClient,
	wire.Bind(new(documentdomain.FileFetcher), new(*ipcclient.PHPFileRPCClient)),
	ProvideDocumentParsers,
	ProvideDocumentParseService,
)

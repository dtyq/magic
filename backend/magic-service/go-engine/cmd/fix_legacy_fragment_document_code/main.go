// Package main 提供一次性修复历史空 document_code 片段的 CLI。
package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"github.com/redis/go-redis/v9"

	appfix "magic/internal/application/knowledge/fixlegacy"
	configloader "magic/internal/config"
	autoloadcfg "magic/internal/config/autoload"
	diapp "magic/internal/di/app"
	diinfra "magic/internal/di/infra"
	knowledge "magic/internal/di/knowledge"
	documentdomain "magic/internal/domain/knowledge/document/service"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/infrastructure/logging"
	mysql "magic/internal/infrastructure/persistence/mysql"
	"magic/internal/infrastructure/vectordb/qdrant"
)

const defaultSyncConcurrency = 4

type commandOptions struct {
	dryRun           bool
	organizationCode string
	knowledgeCode    string
	batchSize        int
	syncConcurrency  int
	startID          int64
	maxRows          int
}

type commandRunner struct {
	runner  *appfix.Runner
	cleanup func()
	logger  *logging.SugaredLogger
}

type commandClients struct {
	mysqlClient  *mysql.SQLCClient
	redisClient  *redis.Client
	qdrantClient *qdrant.Client
	cleanup      cleanupGroup
}

type cleanupGroup struct {
	funcs []func()
}

func (g cleanupGroup) Close() {
	for i := len(g.funcs) - 1; i >= 0; i-- {
		if g.funcs[i] != nil {
			g.funcs[i]()
		}
	}
}

func main() {
	os.Exit(run())
}

func run() int {
	options := parseFlags()
	ctx := context.Background()

	cmd, err := newCommandRunner()
	if err != nil {
		fmt.Fprintf(os.Stderr, "initialize fix command failed: %v\n", err)
		return 1
	}
	defer cmd.cleanup()

	result, err := cmd.runner.Run(ctx, appfix.Options{
		DryRun:           options.dryRun,
		OrganizationCode: options.organizationCode,
		KnowledgeCode:    options.knowledgeCode,
		BatchSize:        options.batchSize,
		SyncConcurrency:  options.syncConcurrency,
		StartID:          options.startID,
		MaxRows:          options.maxRows,
	})
	if err != nil {
		cmd.logger.KnowledgeErrorContext(ctx, "fix legacy fragment document code failed", "error", err)
		return 1
	}

	printResult(cmd.logger, result)
	if result.HasFailures() {
		return 1
	}
	return 0
}

func parseFlags() commandOptions {
	var options commandOptions
	flag.BoolVar(&options.dryRun, "dry_run", false, "Only scan and report, do not update MySQL or sync vector data")
	flag.StringVar(&options.organizationCode, "organization_code", "", "Restrict fix scope to one organization")
	flag.StringVar(&options.knowledgeCode, "knowledge_code", "", "Restrict fix scope to one knowledge base")
	flag.IntVar(&options.batchSize, "batch_size", 500, "Number of fragments scanned per batch")
	flag.IntVar(&options.syncConcurrency, "sync_concurrency", defaultSyncConcurrency, "Maximum concurrent knowledge-base sync workers")
	flag.Int64Var(&options.startID, "start_id", 0, "Resume from fragment id greater than this value")
	flag.IntVar(&options.maxRows, "max_rows", 0, "Maximum number of fragments to scan, 0 means no limit")
	flag.Parse()
	return options
}

func newCommandRunner() (*commandRunner, error) {
	cfg := configloader.New()
	rootLogger := logging.NewFromConfig(cfg.Logging)
	logger := rootLogger.Named("cmd.fix_legacy_fragment_document_code")

	clients, err := openCommandClients(cfg, logger)
	if err != nil {
		return nil, err
	}

	rpcServer := diinfra.ProvideRPCServerOverIPC(cfg, logger.Named("ipc"))
	accessTokenProvider := diinfra.ProvideAccessTokenProvider(cfg, rpcServer, logger.Named("access_token_provider"))
	embeddingClientFactory := diinfra.ProvideEmbeddingClientFactory(cfg, rpcServer, logger.Named("embedding_client_factory"), accessTokenProvider)
	defaultEmbeddingModel := diapp.ProvideEmbeddingDefaultModel(cfg)
	embeddingService := diinfra.ProvideEmbeddingService(
		cfg,
		clients.redisClient,
		embeddingClientFactory,
		defaultEmbeddingModel,
		logger.Named("embedding_service"),
	)
	embeddingRepo := diinfra.ProvideEmbeddingRepository(embeddingService)
	embeddingDimensionResolver := diinfra.ProvideEmbeddingDimensionResolver(cfg, embeddingService)

	embeddingCacheRepo := diinfra.ProvideEmbeddingCacheRepository(clients.mysqlClient, logger.Named("embedding_cache_repo"))
	knowledgeBaseRepo := diinfra.ProvideKnowledgeBaseRepository(clients.mysqlClient, clients.redisClient, logger.Named("knowledge_base_repo"))
	fragmentRepo := diinfra.ProvideFragmentRepository(clients.mysqlClient, logger.Named("fragment_repo"))
	documentRepo := diinfra.ProvideDocumentRepository(clients.mysqlClient, logger.Named("document_repo"))
	vectorMgmtRepo := diinfra.ProvideVectorDBManagementRepository(clients.qdrantClient)
	vectorDataRepo := diinfra.ProvideFragmentVectorDBDataRepository(clients.qdrantClient)

	embeddingDomainService := knowledge.ProvideEmbeddingDomainService(
		embeddingCacheRepo,
		embeddingCacheRepo,
		embeddingRepo,
		logger.Named("embedding_domain_service"),
	)
	knowledgeBaseDomainService := knowledge.ProvideKnowledgeBaseDomainService(
		knowledgeBaseRepo,
		vectorMgmtRepo,
		embeddingDimensionResolver,
		knowledge.ProvideKnowledgeBaseDomainConfig(defaultEmbeddingModel, cfg.Qdrant),
		logger.Named("knowledge_base_domain_service"),
	)
	fragmentDomainService := knowledge.ProvideFragmentDomainService(
		fragmentRepo,
		embeddingDomainService,
		fragdomain.FragmentDomainInfra{
			VectorMgmtRepo:        vectorMgmtRepo,
			VectorDataRepo:        vectorDataRepo,
			MetaReader:            knowledgeBaseRepo,
			DefaultEmbeddingModel: string(defaultEmbeddingModel),
			Logger:                logger.Named("fragment_domain_service"),
		},
	)
	documentDomainService := knowledge.ProvideDocumentDomainService(
		documentRepo,
		logger.Named("document_domain_service"),
	)

	return buildCommandRunner(
		knowledgeBaseDomainService,
		documentDomainService,
		fragmentDomainService,
		logger,
		clients.cleanup,
	), nil
}

func buildCommandRunner(
	knowledgeBaseDomainService *knowledgebasedomain.DomainService,
	documentDomainService *documentdomain.DomainService,
	fragmentDomainService *fragdomain.FragmentDomainService,
	logger *logging.SugaredLogger,
	cleanup cleanupGroup,
) *commandRunner {
	return &commandRunner{
		runner: newFixLegacyRunner(
			knowledgeBaseDomainService,
			documentDomainService,
			fragmentDomainService,
			logger,
		),
		cleanup: func() {
			cleanup.Close()
		},
		logger: logger,
	}
}

func openCommandClients(cfg *autoloadcfg.Config, logger *logging.SugaredLogger) (*commandClients, error) {
	mysqlClient, mysqlCleanup, err := diinfra.ProvideMySQLSQLCClient(cfg, logger.Named("mysql"))
	if err != nil {
		return nil, fmt.Errorf("provide mysql client: %w", err)
	}

	redisClient, redisCleanup, err := diinfra.ProvideRedisClient(cfg, logger.Named("redis"))
	if err != nil {
		mysqlCleanup()
		return nil, fmt.Errorf("provide redis client: %w", err)
	}

	qdrantClient, qdrantCleanup, err := diinfra.ProvideQdrantClient(cfg, logger.Named("qdrant"))
	if err != nil {
		redisCleanup()
		mysqlCleanup()
		return nil, fmt.Errorf("provide qdrant client: %w", err)
	}

	return &commandClients{
		mysqlClient:  mysqlClient,
		redisClient:  redisClient,
		qdrantClient: qdrantClient,
		cleanup: cleanupGroup{
			funcs: []func(){mysqlCleanup, redisCleanup, qdrantCleanup},
		},
	}, nil
}

func newFixLegacyRunner(
	knowledgeBaseDomainService *knowledgebasedomain.DomainService,
	documentDomainService *documentdomain.DomainService,
	fragmentDomainService *fragdomain.FragmentDomainService,
	logger *logging.SugaredLogger,
) *appfix.Runner {
	return appfix.NewRunner(
		&fragmentRunnerAdapter{service: fragmentDomainService},
		knowledgeBaseDomainService,
		documentDomainService,
		fragmentDomainService,
		logger,
	)
}

type fragmentRunnerAdapter struct {
	service *fragdomain.FragmentDomainService
}

func (a *fragmentRunnerAdapter) ListMissingDocumentCode(
	ctx context.Context,
	query appfix.ScanQuery,
) ([]*fragmodel.KnowledgeBaseFragment, error) {
	fragments, err := a.service.ListMissingDocumentCode(ctx, fragmodel.MissingDocumentCodeQuery{
		OrganizationCode: query.OrganizationCode,
		KnowledgeCode:    query.KnowledgeCode,
		StartID:          query.StartID,
		Limit:            query.Limit,
	})
	if err != nil {
		return nil, fmt.Errorf("list missing document code fragments: %w", err)
	}
	return fragments, nil
}

func (a *fragmentRunnerAdapter) BackfillDocumentCode(ctx context.Context, ids []int64, documentCode string) (int64, error) {
	rows, err := a.service.BackfillDocumentCode(ctx, ids, documentCode)
	if err != nil {
		return 0, fmt.Errorf("backfill document code: %w", err)
	}
	return rows, nil
}

func (a *fragmentRunnerAdapter) FindByIDs(ctx context.Context, ids []int64) ([]*fragmodel.KnowledgeBaseFragment, error) {
	fragments, err := a.service.FindByIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("find fragments by ids: %w", err)
	}
	return fragments, nil
}

func printResult(logger *logging.SugaredLogger, result appfix.Result) {
	logger.Infow(
		"fix legacy fragment document code completed",
		"scanned", result.Scanned,
		"candidates", result.Candidates,
		"updated", result.Updated,
		"synced", result.Synced,
		"failed", result.Failed,
		"default_documents_found", result.DefaultDocumentsFound,
		"default_documents_created", result.DefaultDocumentsCreated,
	)
	for index, failure := range result.Failures {
		logger.KnowledgeWarnw(
			"fix legacy fragment document code failure sample",
			"sample_index", index+1,
			"knowledge_code", failure.KnowledgeCode,
			"fragment_ids", failure.FragmentIDs,
			"message", failure.Message,
		)
	}
}

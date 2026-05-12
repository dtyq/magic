// Package rebuild 提供知识库重建场景的依赖注入 Provider。
package rebuild

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	documentapp "magic/internal/application/knowledge/document/service"
	apprebuild "magic/internal/application/knowledge/rebuild"
	autoloadcfg "magic/internal/config/autoload"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/embedding"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	domainrebuild "magic/internal/domain/knowledge/rebuild"
	shared "magic/internal/domain/knowledge/shared"
	"magic/internal/infrastructure/logging"
	mysqlrebuild "magic/internal/infrastructure/persistence/mysql/rebuild"
	redisrebuild "magic/internal/infrastructure/persistence/redis/rebuild"
	infrarebuild "magic/internal/infrastructure/rebuild"
	ipcclient "magic/internal/infrastructure/rpc/jsonrpc/client"
	"magic/internal/infrastructure/vectordb/qdrant"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/knowledgeroute"
)

var errInvalidTargetSparseBackend = errors.New("invalid qdrant target sparse backend")

// ProvideKnowledgeRebuildResyncer 提供知识库重建文档重同步适配器。
func ProvideKnowledgeRebuildResyncer(documentAppService *documentapp.DocumentAppService) *infrarebuild.AppDocumentResyncer {
	return infrarebuild.NewAppDocumentResyncer(&documentAppSyncer{documentAppService: documentAppService})
}

// RunnerDeps 聚合构建重建执行器所需依赖。
type RunnerDeps struct {
	Store             *mysqlrebuild.MySQLStore
	Coordinator       *redisrebuild.Coordinator
	VectorRepo        fragmodel.VectorDBManagementRepository
	Resyncer          *infrarebuild.AppDocumentResyncer
	DimensionResolver embedding.DimensionResolver
}

// ProvideKnowledgeRebuildRunnerDeps 聚合构建 Runner 所需依赖。
func ProvideKnowledgeRebuildRunnerDeps(
	store *mysqlrebuild.MySQLStore,
	coordinator *redisrebuild.Coordinator,
	vectorRepo fragmodel.VectorDBManagementRepository,
	resyncer *infrarebuild.AppDocumentResyncer,
	dimensionResolver embedding.DimensionResolver,
) RunnerDeps {
	return RunnerDeps{
		Store:             store,
		Coordinator:       coordinator,
		VectorRepo:        vectorRepo,
		Resyncer:          resyncer,
		DimensionResolver: dimensionResolver,
	}
}

// ProvideKnowledgeRebuildRunner 提供知识库重建执行器。
func ProvideKnowledgeRebuildRunner(
	deps RunnerDeps,
	cfg *autoloadcfg.Config,
	logger *logging.SugaredLogger,
) (*apprebuild.Runner, error) {
	isLocalDev := strings.EqualFold(strings.TrimSpace(os.Getenv("APP_ENV")), "dev")
	if strings.TrimSpace(cfg.Qdrant.TargetSparseBackend) != "" && fragmodel.NormalizeSparseBackend(cfg.Qdrant.TargetSparseBackend) == "" {
		return nil, fmt.Errorf("%w: %q", errInvalidTargetSparseBackend, cfg.Qdrant.TargetSparseBackend)
	}
	configuredTargetSparseBackend := fragmodel.NormalizeSparseBackend(cfg.Qdrant.TargetSparseBackend)
	selection := shared.ResolveSparseBackendSelection(resolveSparseBackendSelector(deps.VectorRepo), configuredTargetSparseBackend)
	logger.InfoContext(
		context.Background(),
		"Resolved target sparse backend",
		"requested_target_sparse_backend", selection.Requested,
		"effective_target_sparse_backend", selection.Effective,
		"reason", selection.Reason,
		"qdrant_version", selection.Version,
		"probe_status", selection.ProbeStatus,
		"query_supported", selection.QuerySupported,
	)
	return apprebuild.NewRunner(
		deps.Store,
		deps.Coordinator,
		&vectorCollectionManagerAdapter{repo: deps.VectorRepo},
		deps.Resyncer,
		deps.DimensionResolver,
		apprebuild.RunnerConfig{
			Logger:              logger.Named("knowledge.domainrebuild.Runner"),
			IsLocalDev:          isLocalDev,
			TargetSparseBackend: configuredTargetSparseBackend,
			MaxConcurrency:      cfg.Rebuild.MaxConcurrency,
		},
	), nil
}

// ProvideKnowledgeRebuildTriggerService 提供知识库重建触发服务。
func ProvideKnowledgeRebuildTriggerService(
	runner *apprebuild.Runner,
	runStateReader domainrebuild.VectorRebuildRunStateReader,
	logger *logging.SugaredLogger,
) *apprebuild.TriggerService {
	return apprebuild.NewTriggerService(runner, runStateReader, logger.Named("knowledge.domainrebuild.TriggerService"))
}

// ProvideKnowledgeRebuildCleanupService 提供重建残留清理服务。
func ProvideKnowledgeRebuildCleanupService(
	store *mysqlrebuild.MySQLStore,
	coordinator *redisrebuild.Coordinator,
	vectorRepo fragmodel.VectorDBManagementRepository,
	officialChecker *ipcclient.PHPKnowledgeBasePermissionRPCClient,
	logger *logging.SugaredLogger,
) *apprebuild.CleanupService {
	return apprebuild.NewCleanupService(
		store,
		coordinator,
		vectorRepo,
		officialChecker,
		logger.Named("knowledge.domainrebuild.CleanupService"),
	)
}

type documentAppSyncer struct {
	documentAppService *documentapp.DocumentAppService
}

func (s *documentAppSyncer) SyncDocument(
	ctx context.Context,
	organizationCode string,
	knowledgeBaseCode string,
	documentCode string,
	userID string,
	override infrarebuild.Override,
) error {
	input := &documentdomain.SyncDocumentInput{
		OrganizationCode:  organizationCode,
		KnowledgeBaseCode: knowledgeBaseCode,
		Code:              documentCode,
		Mode:              documentdomain.SyncModeResync,
		BusinessParams: &ctxmeta.BusinessParams{
			OrganizationCode: organizationCode,
			UserID:           userID,
			BusinessID:       knowledgeBaseCode,
		},
		RebuildOverride: &knowledgeroute.RebuildOverride{
			TargetCollection:     override.TargetCollection,
			TargetTermCollection: override.TargetTermCollection,
			TargetModel:          override.TargetModel,
			TargetSparseBackend:  override.TargetSparseBackend,
		},
	}
	if err := s.documentAppService.Sync(ctx, input); err != nil {
		return fmt.Errorf("sync document: %w", err)
	}
	return nil
}

type vectorCollectionManagerAdapter struct {
	repo fragmodel.VectorDBManagementRepository
}

func resolveSparseBackendSelector(repo fragmodel.VectorDBManagementRepository) shared.SparseBackendSelector {
	selector, _ := any(repo).(shared.SparseBackendSelector)
	return selector
}

func (a *vectorCollectionManagerAdapter) DefaultSparseBackend() shared.SparseBackendSelection {
	return shared.ResolveSparseBackendSelection(resolveSparseBackendSelector(a.repo), "")
}

func (a *vectorCollectionManagerAdapter) SelectSparseBackend(requested string) shared.SparseBackendSelection {
	return shared.ResolveSparseBackendSelection(resolveSparseBackendSelector(a.repo), requested)
}

func (a *vectorCollectionManagerAdapter) CreateCollection(ctx context.Context, name string, vectorSize int64) error {
	if err := a.repo.CreateCollection(ctx, name, vectorSize); err != nil {
		return fmt.Errorf("create collection %s: %w", name, err)
	}
	return nil
}

func (a *vectorCollectionManagerAdapter) CollectionExists(ctx context.Context, name string) (bool, error) {
	exists, err := a.repo.CollectionExists(ctx, name)
	if err != nil {
		return false, fmt.Errorf("check collection %s exists: %w", name, err)
	}
	return exists, nil
}

func (a *vectorCollectionManagerAdapter) GetCollectionInfo(ctx context.Context, name string) (*domainrebuild.VectorCollectionInfo, error) {
	info, err := a.repo.GetCollectionInfo(ctx, name)
	if err != nil {
		if errors.Is(err, qdrant.ErrCollectionNotFound) {
			return &domainrebuild.VectorCollectionInfo{Name: name, VectorSize: 0}, nil
		}
		return nil, fmt.Errorf("get collection %s info: %w", name, err)
	}
	if info == nil {
		return &domainrebuild.VectorCollectionInfo{Name: name, VectorSize: 0}, nil
	}
	return &domainrebuild.VectorCollectionInfo{
		Name:                info.Name,
		VectorSize:          info.VectorSize,
		Points:              info.Points,
		HasNamedDenseVector: info.HasNamedDenseVector,
		HasSparseVector:     info.HasSparseVector,
		PayloadSchemaKeys:   append([]string(nil), info.PayloadSchemaKeys...),
	}, nil
}

func (a *vectorCollectionManagerAdapter) EnsurePayloadIndexes(ctx context.Context, name string, specs []shared.PayloadIndexSpec) error {
	if err := a.repo.EnsurePayloadIndexes(ctx, name, specs); err != nil {
		return fmt.Errorf("ensure collection %s payload indexes: %w", name, err)
	}
	return nil
}

func (a *vectorCollectionManagerAdapter) GetAliasTarget(ctx context.Context, alias string) (string, bool, error) {
	target, exists, err := a.repo.GetAliasTarget(ctx, alias)
	if err != nil {
		return "", false, fmt.Errorf("get alias %s target: %w", alias, err)
	}
	return target, exists, nil
}

func (a *vectorCollectionManagerAdapter) EnsureAlias(ctx context.Context, alias, target string) error {
	if err := a.repo.EnsureAlias(ctx, alias, target); err != nil {
		return fmt.Errorf("ensure alias %s => %s: %w", alias, target, err)
	}
	return nil
}

func (a *vectorCollectionManagerAdapter) SwapAliasAtomically(ctx context.Context, alias, oldTarget, newTarget string) error {
	if err := a.repo.SwapAliasAtomically(ctx, alias, oldTarget, newTarget); err != nil {
		return fmt.Errorf("swap alias %s from %s to %s: %w", alias, oldTarget, newTarget, err)
	}
	return nil
}

func (a *vectorCollectionManagerAdapter) DeleteAlias(ctx context.Context, alias string) error {
	if err := a.repo.DeleteAlias(ctx, alias); err != nil {
		return fmt.Errorf("delete alias %s: %w", alias, err)
	}
	return nil
}

func (a *vectorCollectionManagerAdapter) ListCollections(ctx context.Context) ([]string, error) {
	collections, err := a.repo.ListCollections(ctx)
	if err != nil {
		return nil, fmt.Errorf("list collections: %w", err)
	}
	return collections, nil
}

func (a *vectorCollectionManagerAdapter) DeleteCollection(ctx context.Context, name string) error {
	err := a.repo.DeleteCollection(ctx, name)
	if err != nil && errors.Is(err, qdrant.ErrCollectionNotFound) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("delete collection %s: %w", name, err)
	}
	return nil
}

func (a *vectorCollectionManagerAdapter) DeletePointsByFilter(ctx context.Context, collectionName string) error {
	if err := a.repo.DeletePointsByFilter(ctx, collectionName, nil); err != nil {
		return fmt.Errorf("delete collection %s points by filter: %w", collectionName, err)
	}
	return nil
}

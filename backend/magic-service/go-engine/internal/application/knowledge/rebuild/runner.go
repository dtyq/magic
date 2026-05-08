package rebuild

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"time"

	rebuilddto "magic/internal/application/knowledge/rebuild/dto"
	"magic/internal/constants"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	domainrebuild "magic/internal/domain/knowledge/rebuild"
	shared "magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	"magic/internal/infrastructure/logging"
)

const (
	defaultMode              = rebuilddto.ModeAuto
	defaultConcurrency       = 2
	defaultMaxConcurrency    = 8
	defaultBatchSize         = 200
	defaultRetry             = 1
	defaultHeartbeatInterval = 15 * time.Second
	defaultReportDir         = "runtime"
	defaultLockTTL           = 30 * time.Minute
	reportDirPerm            = 0o750
	reportFilePerm           = 0o600
	goModFileName            = "go.mod"
	fixedActiveCollection    = constants.KnowledgeBaseCollectionName + "_active"
	fixedShadowCollection    = constants.KnowledgeBaseCollectionName + "_shadow"
)

var (
	errInvalidMode                       = errors.New("invalid rebuild mode")
	errRunnerAlreadyRunning              = errors.New("knowledge rebuild is already running")
	errBlueGreenTargetDimensionRequired  = errors.New("bluegreen mode requires positive target dimension")
	errTargetCollectionDimensionMismatch = errors.New("target collection dimension mismatch")
	errUnknownResync                     = errors.New("unknown resync error")
	errBlueGreenTargetSchemaIncomplete   = errors.New("bluegreen target collection schema incomplete")
	errInplaceModeMismatch               = domainrebuild.ErrInplaceModeMismatch
	errAllScopeNoDocuments               = domainrebuild.ErrAllScopeNoDocuments
	errOrganizationScopeNoDocuments      = domainrebuild.ErrOrganizationScopeNoDocuments
	errKnowledgeBaseScopeNoDocuments     = domainrebuild.ErrKnowledgeBaseScopeNoDocuments
	errDocumentScopeNoDocuments          = domainrebuild.ErrDocumentScopeNoDocuments
	errResyncFailuresBlockCutover        = domainrebuild.ErrResyncFailuresBlockCutover
	errBlueGreenTargetEmpty              = domainrebuild.ErrBlueGreenTargetEmpty
	errTriggerRunnerNil                  = errors.New("knowledge rebuild runner is nil")
	errTriggerRunStateReaderNil          = errors.New("knowledge rebuild run state reader is nil")
	errPayloadIndexEnsurerNil            = errors.New("knowledge rebuild payload index ensurer is nil")
)

const (
	// TriggerStatusTriggered 表示已成功触发新任务。
	TriggerStatusTriggered = "triggered"
	// TriggerStatusAlreadyRunning 表示已有任务在运行。
	TriggerStatusAlreadyRunning = "already_running"
)

// ModelStore 定义模型元数据与文档扫描能力。
type ModelStore interface {
	ResetSyncStatus(ctx context.Context, scope domainrebuild.Scope) (domainrebuild.MigrationStats, error)
	UpdateModel(ctx context.Context, scope domainrebuild.Scope, model string) (domainrebuild.MigrationStats, error)
	GetCollectionMeta(ctx context.Context) (sharedroute.CollectionMeta, error)
	UpsertCollectionMeta(ctx context.Context, meta sharedroute.CollectionMeta) error
	ListDocumentsBatch(ctx context.Context, scope domainrebuild.Scope, afterID int64, batchSize int) ([]domainrebuild.DocumentTask, error)
}

type runLockCoordinator interface {
	AcquireLock(ctx context.Context, owner string, ttl time.Duration) (bool, error)
	ReleaseLock(ctx context.Context, owner string) error
	RefreshLock(ctx context.Context, owner string, ttl time.Duration) (bool, error)
}

type runStateStore interface {
	SetCurrentRun(ctx context.Context, runID string) error
	ClearCurrentRun(ctx context.Context, runID string) error
	SaveJob(ctx context.Context, runID string, values map[string]any) error
	IncrMetric(ctx context.Context, runID, field string, delta int64) error
}

// StateCoordinator 定义重建状态协调能力。
type StateCoordinator interface {
	runLockCoordinator
	runStateStore
}

// CollectionManager 定义向量集合管理能力。
type CollectionManager interface {
	CreateCollection(ctx context.Context, name string, vectorSize int64) error
	CollectionExists(ctx context.Context, name string) (bool, error)
	GetCollectionInfo(ctx context.Context, name string) (*domainrebuild.VectorCollectionInfo, error)
	GetAliasTarget(ctx context.Context, alias string) (string, bool, error)
	EnsureAlias(ctx context.Context, alias, target string) error
	SwapAliasAtomically(ctx context.Context, alias, oldTarget, newTarget string) error
	DeleteAlias(ctx context.Context, alias string) error
	ListCollections(ctx context.Context) ([]string, error)
	DeleteCollection(ctx context.Context, name string) error
	DeletePointsByFilter(ctx context.Context, collectionName string) error
}

type payloadIndexEnsurer interface {
	EnsurePayloadIndexes(ctx context.Context, name string, specs []shared.PayloadIndexSpec) error
}

// EmbeddingDimensionResolver 定义 embedding 维度解析能力。
type EmbeddingDimensionResolver interface {
	ResolveDimension(ctx context.Context, model string) (int64, error)
}

// DocumentResyncer 定义文档重同步执行能力。
type DocumentResyncer interface {
	Resync(ctx context.Context, task domainrebuild.DocumentTask) error
}

type resyncSummary struct {
	Failures    []rebuilddto.FailureRecord
	TotalDocs   int64
	SuccessDocs int64
	FailedDocs  int64
}

type resyncTarget struct {
	Collection     string
	TermCollection string
	Model          string
	SparseBackend  string
}

type activeCollectionState struct {
	Alias              string
	PhysicalCollection string
	Model              string
	Dimension          int64
	Bootstrap          bool
	SchemaOK           bool
	NeedsNormalization bool
}

type resyncState struct {
	failureMu   sync.Mutex
	successDocs atomic.Int64
	failedDocs  atomic.Int64
	totalDocs   atomic.Int64
	failures    []rebuilddto.FailureRecord
}

type runExecutor interface {
	Run(ctx context.Context, opts rebuilddto.RunOptions) (*rebuilddto.RunResult, error)
}

type runStateReader interface {
	GetCurrentRun(ctx context.Context) (string, error)
}

// TriggerResult 表示触发行为的执行结果。
type TriggerResult struct {
	Status string
	RunID  string
}

// TriggerService 提供重建任务异步触发与幂等判断能力。
type TriggerService struct {
	runner      runExecutor
	stateReader runStateReader
	logger      *logging.SugaredLogger
	now         func() time.Time

	mu           sync.Mutex
	pendingRunID string
}

// RunnerConfig 描述 Runner 的运行时配置。
type RunnerConfig struct {
	Logger              *logging.SugaredLogger
	IsLocalDev          bool
	TargetSparseBackend string
	MaxConcurrency      int
}

// Runner 协调知识库重建流程。
type Runner struct {
	store                 ModelStore
	coordinator           StateCoordinator
	collections           CollectionManager
	payloadIndexes        payloadIndexEnsurer
	resyncer              DocumentResyncer
	dimensionResolver     EmbeddingDimensionResolver
	collectionMeta        *sharedroute.CollectionMetaManager
	logger                *logging.SugaredLogger
	isLocalDev            bool
	sparseBackendSelector shared.SparseBackendSelector
	targetSparseBackend   string
	maxConcurrency        int
	now                   func() time.Time
}

// NewRunner 创建知识库重建执行器。
func NewRunner(
	store ModelStore,
	coordinator StateCoordinator,
	collections CollectionManager,
	resyncer DocumentResyncer,
	dimensionResolver EmbeddingDimensionResolver,
	cfg RunnerConfig,
) *Runner {
	targetSparseBackend := fragmodel.NormalizeSparseBackend(cfg.TargetSparseBackend)
	sparseBackendSelector, _ := collections.(shared.SparseBackendSelector)
	payloadIndexes, _ := collections.(payloadIndexEnsurer)
	maxConcurrency := cfg.MaxConcurrency
	if maxConcurrency <= 0 {
		maxConcurrency = defaultMaxConcurrency
	}
	return &Runner{
		store:                 store,
		coordinator:           coordinator,
		collections:           collections,
		payloadIndexes:        payloadIndexes,
		resyncer:              resyncer,
		dimensionResolver:     dimensionResolver,
		collectionMeta:        sharedroute.NewCollectionMetaManager(store, store),
		logger:                cfg.Logger,
		isLocalDev:            cfg.IsLocalDev,
		sparseBackendSelector: sparseBackendSelector,
		targetSparseBackend:   targetSparseBackend,
		maxConcurrency:        maxConcurrency,
		now:                   time.Now,
	}
}

func (r *Runner) currentTargetSparseBackendSelection() shared.SparseBackendSelection {
	selection := shared.ResolveSparseBackendSelection(r.sparseBackendSelector, r.targetSparseBackend)
	if selection.Effective == "" {
		selection.Effective = fragmodel.SparseBackendQdrantBM25ZHV1
	}
	return selection
}

func (r *Runner) currentTargetSparseBackend() string {
	return r.currentTargetSparseBackendSelection().Effective
}

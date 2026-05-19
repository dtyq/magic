package retrieval

import (
	"context"
	"fmt"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	shared "magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
)

// EmbeddingService 定义检索服务依赖的向量生成能力。
type EmbeddingService interface {
	GetEmbedding(ctx context.Context, text, model string, businessParams *ctxmeta.BusinessParams) ([]float64, error)
}

// Infra 聚合检索领域服务所需的基础设施依赖。
type Infra struct {
	VectorDataRepo        shared.VectorDBDataRepository[fragmodel.FragmentPayload]
	MetaReader            sharedroute.CollectionMetaReader
	DefaultEmbeddingModel string
	Logger                *logging.SugaredLogger
	SegmenterProvider     *SegmenterProvider
}

// Service 提供片段检索增强相关的领域能力。
type Service struct {
	repo                  fragmodel.KnowledgeBaseFragmentReader
	embeddingSvc          EmbeddingService
	vectorDataRepo        shared.VectorDBDataRepository[fragmodel.FragmentPayload]
	sparseBackendSelector shared.SparseBackendSelector
	metaReader            sharedroute.CollectionMetaReader
	defaultEmbeddingModel string
	logger                *logging.SugaredLogger
	segmenterProvider     *SegmenterProvider
	tokenPolicyProvider   *retrievalTokenPolicyProvider
}

// NewService 创建检索领域服务。
func NewService(
	repo fragmodel.KnowledgeBaseFragmentReader,
	embeddingSvc EmbeddingService,
	infra Infra,
) *Service {
	segmenterProvider := infra.SegmenterProvider
	if segmenterProvider == nil {
		// 默认路径必须复用进程级 singleton，禁止在每个 Service 上重复初始化检索分词器。
		segmenterProvider = newDefaultRetrievalSegmenterProvider()
	}
	sparseBackendSelector, _ := any(infra.VectorDataRepo).(shared.SparseBackendSelector)
	return &Service{
		repo:                  repo,
		embeddingSvc:          embeddingSvc,
		vectorDataRepo:        infra.VectorDataRepo,
		sparseBackendSelector: sparseBackendSelector,
		metaReader:            infra.MetaReader,
		defaultEmbeddingModel: infra.DefaultEmbeddingModel,
		logger:                infra.Logger,
		segmenterProvider:     segmenterProvider,
		tokenPolicyProvider:   defaultRetrievalTokenPolicyProvider,
	}
}

func (s *Service) newRetrievalAnalyzer() retrievalAnalyzer {
	if s == nil || s.segmenterProvider == nil {
		return newRetrievalAnalyzer()
	}
	segmenter, err := s.segmenterProvider.cutter()
	policyProvider := s.tokenPolicyProvider
	if policyProvider == nil {
		policyProvider = defaultRetrievalTokenPolicyProvider
	}
	policy, policyErr := policyProvider.get()
	return newRetrievalAnalyzerFromParts(segmenter, err, policy, policyErr)
}

func (s *Service) ensureRuntimeReady(ctx context.Context) error {
	if s == nil {
		return nil
	}
	if ctx != nil {
		if err := ctx.Err(); err != nil {
			return fmt.Errorf("prepare retrieval runtime cancelled before start: %w", err)
		}
	}
	if s.segmenterProvider != nil {
		if err := s.segmenterProvider.warmup(); err != nil {
			return fmt.Errorf("warmup retrieval segmenter: %w", err)
		}
	}
	policyProvider := s.tokenPolicyProvider
	if policyProvider == nil {
		policyProvider = defaultRetrievalTokenPolicyProvider
	}
	if policyProvider != nil {
		if err := policyProvider.warmup(); err != nil {
			return fmt.Errorf("warmup retrieval token policy: %w", err)
		}
	}
	analyzer := s.newRetrievalAnalyzer()
	if err := analyzer.selfCheck(); err != nil {
		return fmt.Errorf("retrieval offline dict self-check: %w", err)
	}
	if ctx != nil {
		if err := ctx.Err(); err != nil {
			return fmt.Errorf("prepare retrieval runtime cancelled after load: %w", err)
		}
	}
	return nil
}

// Warmup 预热检索分词器词典，避免首个查询触发懒加载。
func (s *Service) Warmup(ctx context.Context) error {
	return s.ensureRuntimeReady(ctx)
}

// BuildRetrievalTextFromFragment 使用共享检索分词器构建用于检索的片段文本。
func (s *Service) BuildRetrievalTextFromFragment(fragment *fragmodel.KnowledgeBaseFragment) string {
	return buildRetrievalTextFromFragmentWithAnalyzer(fragment, s.newRetrievalAnalyzer())
}

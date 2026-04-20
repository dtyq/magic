package retrieval

import (
	"context"
	"fmt"

	shared "magic/internal/domain/knowledge/shared"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
)

// EmbeddingService 定义检索服务依赖的向量生成能力。
type EmbeddingService interface {
	GetEmbedding(ctx context.Context, text, model string, businessParams *ctxmeta.BusinessParams) ([]float64, error)
}

// Infra 聚合检索领域服务所需的基础设施依赖。
type Infra struct {
	VectorDataRepo        VectorDBDataRepository[FragmentPayload]
	MetaReader            any
	DefaultEmbeddingModel string
	Logger                *logging.SugaredLogger
	SegmenterProvider     *SegmenterProvider
}

// Service 提供片段检索增强相关的领域能力。
type Service struct {
	repo                  KnowledgeBaseFragmentReader
	embeddingSvc          EmbeddingService
	vectorDataRepo        VectorDBDataRepository[FragmentPayload]
	sparseBackendSelector shared.SparseBackendSelector
	metaReader            any
	defaultEmbeddingModel string
	logger                *logging.SugaredLogger
	segmenterProvider     *SegmenterProvider
}

// NewService 创建检索领域服务。
func NewService(
	repo KnowledgeBaseFragmentReader,
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
	}
}

func (s *Service) newRetrievalAnalyzer() retrievalAnalyzer {
	if s == nil || s.segmenterProvider == nil {
		return retrievalAnalyzer{}
	}
	segmenter, err := s.segmenterProvider.cutter()
	if err != nil {
		return retrievalAnalyzer{}
	}
	return retrievalAnalyzer{segmenter: segmenter}
}

// Warmup 预热检索分词器词典，避免首个查询触发懒加载。
func (s *Service) Warmup(ctx context.Context) error {
	if ctx != nil {
		if err := ctx.Err(); err != nil {
			return fmt.Errorf("warmup retrieval cancelled before start: %w", err)
		}
	}
	if s == nil || s.segmenterProvider == nil {
		return nil
	}
	if err := s.segmenterProvider.warmup(); err != nil {
		return fmt.Errorf("warmup retrieval segmenter: %w", err)
	}
	if ctx != nil {
		if err := ctx.Err(); err != nil {
			return fmt.Errorf("warmup retrieval cancelled after load: %w", err)
		}
	}
	return nil
}

// BuildRetrievalTextFromFragment 使用共享检索分词器构建用于检索的片段文本。
func (s *Service) BuildRetrievalTextFromFragment(fragment *KnowledgeBaseFragment) string {
	text, _ := buildRetrievalTextFromFragmentWithAnalyzer(fragment, s.newRetrievalAnalyzer())
	return text
}

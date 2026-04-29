// Package knowledge 提供知识库领域装配相关的依赖注入 Provider。
package knowledge

import (
	autoloadcfg "magic/internal/config/autoload"
	docrepo "magic/internal/domain/knowledge/document/repository"
	documentdomain "magic/internal/domain/knowledge/document/service"
	embeddingdomain "magic/internal/domain/knowledge/embedding"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragretrieval "magic/internal/domain/knowledge/fragment/retrieval"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	kbrepo "magic/internal/domain/knowledge/knowledgebase/repository"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	"magic/internal/infrastructure/logging"
)

// BaseDomainConfig 聚合知识库领域服务初始化所需的配置。
type BaseDomainConfig struct {
	DefaultEmbeddingModel autoloadcfg.EmbeddingDefaultModel
	Qdrant                autoloadcfg.QdrantConfig
}

// FragmentVectorDBDataRepository 表示片段向量数据仓储契约。
type FragmentVectorDBDataRepository interface {
	fragmodel.VectorDBDataRepository[fragmodel.FragmentPayload]
}

// ProvideEmbeddingDomainService 提供嵌入领域服务。
func ProvideEmbeddingDomainService(
	cacheRepo embeddingdomain.CacheRepository,
	analysisRepo embeddingdomain.CacheAnalysisRepository,
	embeddingRepo embeddingdomain.Repository,
	logger *logging.SugaredLogger,
) *embeddingdomain.DomainService {
	return embeddingdomain.NewDomainService(cacheRepo, analysisRepo, embeddingRepo, logger)
}

// ProvideKnowledgeBaseDomainConfig 聚合知识库领域服务所需的配置快照。
func ProvideKnowledgeBaseDomainConfig(
	defaultEmbeddingModel autoloadcfg.EmbeddingDefaultModel,
	qdrantCfg autoloadcfg.QdrantConfig,
) BaseDomainConfig {
	return BaseDomainConfig{
		DefaultEmbeddingModel: defaultEmbeddingModel,
		Qdrant:                qdrantCfg,
	}
}

// ProvideKnowledgeBaseDomainService 提供知识库领域服务。
func ProvideKnowledgeBaseDomainService(
	repo kbrepo.Repository,
	vectorRepo fragmodel.VectorDBManagementRepository,
	dimensionResolver embeddingdomain.DimensionResolver,
	cfg BaseDomainConfig,
	logger *logging.SugaredLogger,
) *knowledgebasedomain.DomainService {
	return knowledgebasedomain.NewDomainService(
		repo,
		vectorRepo,
		dimensionResolver,
		string(cfg.DefaultEmbeddingModel),
		cfg.Qdrant.TargetSparseBackend,
		logger,
	)
}

// ProvideFragmentDomainService 提供片段领域服务。
func ProvideFragmentDomainService(
	repo fragmodel.KnowledgeBaseFragmentRepository,
	embeddingSvc *embeddingdomain.DomainService,
	infra fragdomain.FragmentDomainInfra,
) *fragdomain.FragmentDomainService {
	return fragdomain.NewFragmentDomainService(repo, embeddingSvc, infra)
}

// ProvideFragmentRetrievalSegmenterProvider 提供共享检索分词器 provider。
func ProvideFragmentRetrievalSegmenterProvider() *fragretrieval.SegmenterProvider {
	return fragretrieval.NewDefaultSegmenterProvider()
}

// ProvideFragmentDomainInfra 提供片段领域服务依赖的基础设施聚合。
func ProvideFragmentDomainInfra(
	vectorMgmtRepo fragmodel.VectorDBManagementRepository,
	vectorDataRepo FragmentVectorDBDataRepository,
	metaReader sharedroute.CollectionMetaReader,
	defaultEmbeddingModel autoloadcfg.EmbeddingDefaultModel,
	segmenterProvider *fragretrieval.SegmenterProvider,
	logger *logging.SugaredLogger,
) fragdomain.FragmentDomainInfra {
	return fragdomain.FragmentDomainInfra{
		VectorMgmtRepo:        vectorMgmtRepo,
		VectorDataRepo:        vectorDataRepo,
		MetaReader:            metaReader,
		DefaultEmbeddingModel: string(defaultEmbeddingModel),
		SegmenterProvider:     segmenterProvider,
		Logger:                logger,
	}
}

// ProvideDocumentDomainService 提供文档领域服务。
func ProvideDocumentDomainService(
	repo docrepo.KnowledgeBaseDocumentRepository,
	logger *logging.SugaredLogger,
) *documentdomain.DomainService {
	return documentdomain.NewDocumentDomainService(repo, logger)
}

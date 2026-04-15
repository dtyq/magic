// Package app 提供应用级依赖注入 Provider。
package app

import (
	"fmt"

	embeddingapp "magic/internal/application/knowledge/embedding/service"
	autoloadcfg "magic/internal/config/autoload"
	diknowledge "magic/internal/di/knowledge"
	embeddingdomain "magic/internal/domain/knowledge/embedding"
	"magic/internal/infrastructure/logging"
	lockpkg "magic/internal/pkg/lock"
)

// ProvideEmbeddingDefaultModel 由应用层决定默认嵌入模型
// 优先从配置读取，若未配置则使用默认值
func ProvideEmbeddingDefaultModel(cfg *autoloadcfg.Config) autoloadcfg.EmbeddingDefaultModel {
	model := cfg.MagicModelGateway.DefaultEmbeddingModel
	if model == "" {
		model = "text-embedding-3-small" // 默认模型
	}
	return autoloadcfg.EmbeddingDefaultModel(model)
}

// ProvideQdrantConfig 提供知识库依赖的 Qdrant 配置快照。
func ProvideQdrantConfig(cfg *autoloadcfg.Config) autoloadcfg.QdrantConfig {
	return cfg.Qdrant
}

// ProvideEmbeddingCacheCleanupService 提供缓存清理服务
func ProvideEmbeddingCacheCleanupService(
	embeddingDomainSvc *embeddingdomain.DomainService,
	jobRunner lockpkg.SinglePodJobRunner,
	cfg *autoloadcfg.Config,
	logger *logging.SugaredLogger,
) (*embeddingapp.EmbeddingCacheCleanupService, error) {
	svc, err := diknowledge.ProvideEmbeddingCacheCleanupService(embeddingDomainSvc, cfg.EmbeddingCacheCleanup, jobRunner, logger)
	if err != nil {
		return nil, fmt.Errorf("provide cleanup service: %w", err)
	}
	return svc, nil
}

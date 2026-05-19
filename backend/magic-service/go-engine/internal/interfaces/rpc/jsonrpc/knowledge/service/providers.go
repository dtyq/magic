package service

import (
	"github.com/redis/go-redis/v9"

	documentapp "magic/internal/application/knowledge/document/service"
	knowledgebaseapp "magic/internal/application/knowledge/knowledgebase/service"
	apprebuild "magic/internal/application/knowledge/rebuild"
	revectorizeapp "magic/internal/application/knowledge/revectorize/service"
	"magic/internal/infrastructure/logging"
)

// KnowledgeBaseRPCDeps 聚合知识库 RPC 运行时依赖，避免 provider 参数过长。
type KnowledgeBaseRPCDeps struct {
	RevectorizeService *revectorizeapp.KnowledgeRevectorizeAppService
	RebuildTrigger     *apprebuild.TriggerService
	RebuildCleaner     *apprebuild.CleanupService
	RedisClient        *redis.Client
}

// ProvideKnowledgeBaseRPCDeps 组装知识库 RPC 运行时依赖。
func ProvideKnowledgeBaseRPCDeps(
	revectorizeService *revectorizeapp.KnowledgeRevectorizeAppService,
	rebuildTrigger *apprebuild.TriggerService,
	rebuildCleaner *apprebuild.CleanupService,
	redisClient *redis.Client,
) KnowledgeBaseRPCDeps {
	return KnowledgeBaseRPCDeps{
		RevectorizeService: revectorizeService,
		RebuildTrigger:     rebuildTrigger,
		RebuildCleaner:     rebuildCleaner,
		RedisClient:        redisClient,
	}
}

// ProvideKnowledgeBaseRPCService 组装知识库 RPC 服务。
func ProvideKnowledgeBaseRPCService(
	appService *knowledgebaseapp.KnowledgeBaseAppService,
	documentService *documentapp.DocumentAppService,
	deps KnowledgeBaseRPCDeps,
	logger *logging.SugaredLogger,
) *KnowledgeBaseRPCService {
	if appService != nil {
		appService.SetTeamshareTempCodeMapper(knowledgebaseapp.NewRedisTeamshareTempCodeMapper(deps.RedisClient))
		appService.SetSourceBindingTreeRootCache(knowledgebaseapp.NewRedisSourceBindingTreeRootCache(deps.RedisClient))
	}
	svc := NewKnowledgeBaseRPCService(appService, deps.RebuildTrigger, deps.RebuildCleaner, logger)
	svc.SetTeamshareStartCommand(deps.RevectorizeService)
	svc.SetDocumentCounter(documentService)
	return svc
}

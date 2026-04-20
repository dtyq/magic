package service

import (
	"github.com/redis/go-redis/v9"

	documentapp "magic/internal/application/knowledge/document/service"
	knowledgebaseapp "magic/internal/application/knowledge/knowledgebase/service"
	apprebuild "magic/internal/application/knowledge/rebuild"
	"magic/internal/infrastructure/logging"
)

// ProvideKnowledgeBaseRPCService 组装知识库 RPC 服务。
func ProvideKnowledgeBaseRPCService(
	appService *knowledgebaseapp.KnowledgeBaseAppService,
	documentService *documentapp.DocumentAppService,
	rebuildTrigger *apprebuild.TriggerService,
	rebuildCleaner *apprebuild.CleanupService,
	redisClient *redis.Client,
	logger *logging.SugaredLogger,
) *KnowledgeBaseRPCService {
	if appService != nil {
		appService.SetTeamshareTempCodeMapper(knowledgebaseapp.NewRedisTeamshareTempCodeMapper(redisClient))
	}
	svc := NewKnowledgeBaseRPCService(appService, rebuildTrigger, rebuildCleaner, logger)
	svc.SetDocumentCounter(documentService)
	return svc
}

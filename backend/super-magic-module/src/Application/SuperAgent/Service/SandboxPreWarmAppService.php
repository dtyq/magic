<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\LongTermMemory\Enum\AppCodeEnum;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\LongTermMemory\Service\LongTermMemoryDomainService;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\HiddenType;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AgentDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 沙箱预启动应用服务
 * 负责处理沙箱预热逻辑，包括话题内和话题外两种场景.
 * 复用 AgentAppService::ensureSandboxInitialized 方法进行沙箱创建和初始化.
 */
class SandboxPreWarmAppService extends AbstractAppService
{
    private LoggerInterface $logger;

    public function __construct(
        protected WorkspaceDomainService $workspaceDomainService,
        protected LongTermMemoryDomainService $longTermMemoryDomainService,
        protected AgentDomainService $agentDomainService,
        protected TopicDomainService $topicDomainService,
        protected TaskDomainService $taskDomainService,
        protected ProjectDomainService $projectDomainService,
        protected ProjectAppService $projectAppService,
        protected TopicAppService $topicAppService,
        protected AgentAppService $agentAppService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('sandbox-pre-warm');
    }

    /**
     * 为话题预热沙箱.
     * 当用户在某个话题内时，直接为该话题创建和初始化沙箱.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param int $topicId 话题ID
     * @param null|string $language 客户端语言（与 HTTP header language 一致，已规范为下划线格式）
     * @return array 返回沙箱信息
     */
    public function preWarmForTopic(RequestContext $requestContext, int $topicId, ?string $language = null): array
    {
        // Pre-warm has been disabled: it used to call ensureSandboxInitialized
        // with sandboxId = topicId, which permanently bound the topic to a
        // legacy "sandbox-{topicId}" pod and prevented the warm-pool fast
        // path from ever being taken on the first real chat message.
        // We now return a no-op response so the FE call stays compatible.
        $this->logger->info(sprintf('话题内沙箱预启动已禁用, 直接返回, topicId=%d', $topicId));

        return [
            'topic_id' => (string) $topicId,
            'sandbox_id' => '',
            'status' => 'disabled',
            'is_new' => false,
        ];
    }

    /**
     * 为工作区预热沙箱.
     * 当用户不在任何话题内时，创建隐藏项目和隐藏话题，然后为其创建和初始化沙箱.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param int $workspaceId 工作区ID
     * @param null|string $language 客户端语言（与 HTTP header language 一致，已规范为下划线格式）
     * @return array 返回沙箱信息
     */
    public function preWarmForWorkspace(RequestContext $requestContext, int $workspaceId, ?string $language = null): array
    {
        // Pre-warm has been disabled — see preWarmForTopic() for rationale.
        $this->logger->info(sprintf('话题外沙箱预启动已禁用, 直接返回, workspaceId=%d', $workspaceId));

        return [
            'topic_id' => '',
            'project_id' => '',
            'sandbox_id' => '',
            'status' => 'disabled',
            'is_new' => false,
            'is_hidden' => true,
        ];
    }

    /**
     * 为项目预热沙箱.
     * 为指定项目创建隐藏话题并初始化沙箱，供后续创建话题时复用.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param int $projectId 项目ID
     * @param null|string $language 客户端语言（与 HTTP header language 一致，已规范为下划线格式）
     * @return array 返回沙箱信息
     */
    public function preWarmForProject(RequestContext $requestContext, int $projectId, ?string $language = null): array
    {
        // Pre-warm has been disabled — see preWarmForTopic() for rationale.
        $this->logger->info(sprintf('项目沙箱预启动已禁用, 直接返回, projectId=%d', $projectId));

        return [
            'topic_id' => '',
            'project_id' => (string) $projectId,
            'sandbox_id' => '',
            'status' => 'disabled',
            'is_new' => false,
            'is_hidden' => true,
        ];
    }

    /**
     * Compensating action: delete a hidden project that was just created but whose paired topic
     * creation subsequently failed, leaving it orphaned with no associated topics.
     *
     * Errors during cleanup are swallowed so that the original exception is always propagated
     * to the caller without being replaced by a secondary failure.
     */
    private function cleanOrphanedHiddenProject(ProjectEntity $project, string $userId): void
    {
        try {
            $this->projectDomainService->deleteProject($project->getId(), $userId);
            $this->logger->warning(sprintf(
                'Cleaned up orphaned hidden project after topic creation failure, projectId=%d',
                $project->getId()
            ));
        } catch (Throwable $cleanupException) {
            $this->logger->error(sprintf(
                'Failed to clean up orphaned hidden project, projectId=%d: %s',
                $project->getId(),
                $cleanupException->getMessage()
            ));
        }
    }
}

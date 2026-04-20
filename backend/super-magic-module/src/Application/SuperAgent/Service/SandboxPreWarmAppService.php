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
class SandboxPreWarmAppService
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
        $this->logger->info(sprintf('开始话题内沙箱预启动, topicId=%d', $topicId));

        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();

        // 获取话题信息
        $topicEntity = $this->topicDomainService->getTopicById($topicId);
        if ($topicEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.not_found');
        }

        // 验证话题所有权
        if ($topicEntity->getUserId() !== $userId) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_ACCESS_DENIED, 'topic.access_denied');
        }

        // 创建 DataIsolation 对象
        $dataIsolation = DataIsolation::simpleMake(
            $userAuthorization->getOrganizationCode(),
            $userId
        );
        if ($language !== null && $language !== '') {
            $dataIsolation->setLanguage($language);
        }

        $projectEntity = $this->projectDomainService->getProjectNotUserId($topicEntity->getProjectId());

        // 初始化任务
        $taskEntity = $this->taskDomainService->initPreWarmTask($dataIsolation, $topicEntity);

        // 记录沙箱创建前的状态
        $hadSandboxId = ! empty($topicEntity->getSandboxId());

        // 初始化用户记忆
        $memories = $this->longTermMemoryDomainService->getEffectiveMemoriesForSandbox(
            $dataIsolation->getCurrentOrganizationCode(),
            AppCodeEnum::SUPER_MAGIC->value,
            $dataIsolation->getCurrentUserId(),
            (string) $projectEntity->getId(),
        );

        // 使用 AgentAppService 确保沙箱已初始化
        // 这个方法会自动处理沙箱的创建和初始化
        $agentContext = $this->agentDomainService->buildInitAgentContext(
            dataIsolation: $dataIsolation,
            projectEntity: $projectEntity,
            topicEntity: $topicEntity,
            taskEntity: $taskEntity,
            sandboxId: (string) $topicEntity->getId(),
            skipInitMessage: true,
            memories: $memories,
        );
        $sandboxId = $this->agentDomainService->ensureSandboxInitialized($dataIsolation, $agentContext);

        $this->logger->info(sprintf(
            '话题内沙箱预启动成功, topicId=%d, sandboxId=%s, hadSandboxId=%s',
            $topicId,
            $sandboxId,
            $hadSandboxId ? 'true' : 'false'
        ));

        return [
            'topic_id' => (string) $topicId,
            'sandbox_id' => $sandboxId,
            'status' => 'ready',
            'is_new' => ! $hadSandboxId,
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
        $this->logger->info(sprintf('开始话题外沙箱预启动, workspaceId=%d', $workspaceId));

        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();

        // 验证工作区存在性和所有权
        $workspaceEntity = $this->workspaceDomainService->getWorkspaceDetail($workspaceId);
        if ($workspaceEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND, 'workspace.not_found');
        }

        if ($workspaceEntity->getUserId() !== $userId) {
            $this->logger->error('话题外沙箱预启动：工作区归属校验失败', [
                'workspace_id' => $workspaceId,
                'workspace_owner_user_id' => $workspaceEntity->getUserId(),
                'request_user_id' => $userId,
            ]);
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_ACCESS_DENIED, 'workspace.access_denied');
        }

        // 获取或创建隐藏项目
        $hiddenProject = $this->projectAppService->ensureHiddenProject(
            $requestContext,
            $workspaceId,
            HiddenType::PRE_WARM->value
        );

        $this->logger->info(sprintf(
            '获取或创建隐藏项目成功, workspaceId=%d, projectId=%d',
            $workspaceId,
            $hiddenProject->getId()
        ));

        // Check whether the project already has a matching hidden topic.
        // This is used later to decide whether to roll back the project if topic creation fails.
        $existingTopicBeforeEnsure = $this->topicDomainService->findHiddenTopicByProjectUserAndType(
            $hiddenProject->getId(),
            $userId,
            HiddenType::PRE_WARM->value
        );

        // 获取或创建隐藏话题
        // If topic creation fails and the project had no pre-existing topic, the project is
        // orphaned (no steps created it before us). Apply a compensating delete to prevent
        // accumulating zombie hidden projects.
        try {
            $hiddenTopic = $this->topicAppService->ensureHiddenTopic(
                $requestContext,
                $hiddenProject->getId(),
                HiddenType::PRE_WARM->value
            );
        } catch (Throwable $e) {
            if ($existingTopicBeforeEnsure === null) {
                $this->cleanOrphanedHiddenProject($hiddenProject, $userId);
            }
            throw $e;
        }

        $this->logger->info(sprintf(
            '获取或创建隐藏话题成功, projectId=%d, topicId=%d',
            $hiddenProject->getId(),
            $hiddenTopic->getId()
        ));

        // 创建 DataIsolation 对象
        $dataIsolation = DataIsolation::simpleMake(
            $userAuthorization->getOrganizationCode(),
            $userId
        );
        if ($language !== null && $language !== '') {
            $dataIsolation->setLanguage($language);
        }
        $projectEntity = $this->projectDomainService->getProjectNotUserId($hiddenTopic->getProjectId());

        // 初始化任务
        $taskEntity = $this->taskDomainService->initPreWarmTask($dataIsolation, $hiddenTopic);

        // 记录沙箱创建前的状态
        $hadSandboxId = ! empty($hiddenTopic->getSandboxId());

        // 初始化用户记忆
        $memories = $this->longTermMemoryDomainService->getEffectiveMemoriesForSandbox(
            $dataIsolation->getCurrentOrganizationCode(),
            AppCodeEnum::SUPER_MAGIC->value,
            $dataIsolation->getCurrentUserId(),
            (string) $projectEntity->getId(),
        );

        // 使用 AgentAppService 确保沙箱已初始化
        // 这个方法会自动处理沙箱的创建和初始化
        $agentContext = $this->agentDomainService->buildInitAgentContext(
            dataIsolation: $dataIsolation,
            projectEntity: $projectEntity,
            topicEntity: $hiddenTopic,
            taskEntity: $taskEntity,
            sandboxId: (string) $hiddenTopic->getId(),
            skipInitMessage: true,
            memories: $memories
        );
        $sandboxId = $this->agentDomainService->ensureSandboxInitialized($dataIsolation, $agentContext);

        $this->logger->info(sprintf(
            '话题外沙箱预启动成功, topicId=%d, sandboxId=%s, hadSandboxId=%s',
            $hiddenTopic->getId(),
            $sandboxId,
            $hadSandboxId ? 'true' : 'false'
        ));

        return [
            'topic_id' => (string) $hiddenTopic->getId(),
            'project_id' => (string) $hiddenProject->getId(),
            'sandbox_id' => $sandboxId,
            'status' => 'ready',
            'is_new' => ! $hadSandboxId,
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
        $this->logger->info(sprintf('开始为项目预热沙箱, projectId=%d', $projectId));

        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();

        // 验证项目存在且当前用户有访问权限（不存在或无权限时 getProject 内部会抛异常）
        $projectEntity = $this->projectDomainService->getProject($projectId, $userId);

        // 获取或创建该项目下的预热隐藏话题（每个项目最多1个，由 ensureHiddenTopic 内部控制）
        try {
            $hiddenTopic = $this->topicAppService->ensureHiddenTopic(
                $requestContext,
                $projectId,
                HiddenType::PRE_WARM->value
            );
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                '创建项目预热隐藏话题失败, projectId=%d: %s',
                $projectId,
                $e->getMessage()
            ));
            throw $e;
        }

        $this->logger->info(sprintf(
            '获取或创建项目预热隐藏话题成功, projectId=%d, topicId=%d',
            $projectId,
            $hiddenTopic->getId()
        ));

        // 创建 DataIsolation
        $dataIsolation = DataIsolation::simpleMake(
            $userAuthorization->getOrganizationCode(),
            $userId
        );
        if ($language !== null && $language !== '') {
            $dataIsolation->setLanguage($language);
        }

        // 初始化预热任务
        $taskEntity = $this->taskDomainService->initPreWarmTask($dataIsolation, $hiddenTopic);

        // 记录沙箱创建前的状态
        $hadSandboxId = ! empty($hiddenTopic->getSandboxId());

        // 初始化用户记忆
        $memories = $this->longTermMemoryDomainService->getEffectiveMemoriesForSandbox(
            $dataIsolation->getCurrentOrganizationCode(),
            AppCodeEnum::SUPER_MAGIC->value,
            $dataIsolation->getCurrentUserId(),
            (string) $projectEntity->getId(),
        );

        // 初始化沙箱
        $agentContext = $this->agentDomainService->buildInitAgentContext(
            dataIsolation: $dataIsolation,
            projectEntity: $projectEntity,
            topicEntity: $hiddenTopic,
            taskEntity: $taskEntity,
            sandboxId: (string) $hiddenTopic->getId(),
            skipInitMessage: true,
            memories: $memories
        );
        $sandboxId = $this->agentDomainService->ensureSandboxInitialized($dataIsolation, $agentContext);

        $this->logger->info(sprintf(
            '为项目预热沙箱成功, projectId=%d, topicId=%d, sandboxId=%s, hadSandboxId=%s',
            $projectId,
            $hiddenTopic->getId(),
            $sandboxId,
            $hadSandboxId ? 'true' : 'false'
        ));

        return [
            'topic_id' => (string) $hiddenTopic->getId(),
            'project_id' => (string) $projectId,
            'sandbox_id' => $sandboxId,
            'status' => 'ready',
            'is_new' => ! $hadSandboxId,
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

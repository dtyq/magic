<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\Service;

use App\Application\Contact\UserSetting\PersonalPreferencesKeys;
use App\Application\Contact\UserSetting\UserSettingKey;
use App\Application\SuperMagic\Task\DTO\SandboxInfoDTO;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Contact\Service\MagicUserSettingDomainService;
use App\Domain\SuperMagic\Agent\Service\MagicClawRuntimePolicyDomainService;
use App\Domain\SuperMagic\File\Event\CheckpointRollbackFilesChangedEvent;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Message\Event\CheckpointRollbackMessagesChangedEvent;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageTarget;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRootFileIds;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskContext;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Task\Service\SandboxVersionDomainService;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\Response\AgentResponse;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Constant\ResponseCode;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\BatchStatusResult;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\SandboxListResult;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\SandboxStatusResult;
use App\Infrastructure\SuperMagic\Task\Locker\CheckpointRollbackLock;
use App\Infrastructure\SuperMagic\Task\Locker\SandboxLifecycleLock;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Agent应用服务
 * 负责协调Agent领域服务的调用，遵循DDD原则.
 */
readonly class AgentAppService
{
    private LoggerInterface $logger;

    public function __construct(
        private LoggerFactory $loggerFactory,
        private readonly AgentDomainService $agentDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly TaskDomainService $taskDomainService,
        private readonly SandboxVersionDomainService $sandboxVersionDomainService,
        private readonly MagicUserSettingDomainService $magicUserSettingDomainService,
        private readonly MagicUserDomainService $magicUserDomainService,
        private readonly EventDispatcherInterface $eventDispatcher,
        private readonly CheckpointRollbackLock $checkpointRollbackLock,
    ) {
        $this->logger = $this->loggerFactory->get('sandbox');
    }

    /**
     * 获取沙箱状态
     *
     * @param string $sandboxId 沙箱ID
     * @return SandboxStatusResult 沙箱状态结果
     */
    public function getSandboxStatus(string $sandboxId): SandboxStatusResult
    {
        return $this->agentDomainService->getSandboxStatus($sandboxId);
    }

    /**
     * 聚合当前沙箱运行状态与镜像版本信息.
     */
    public function getSandboxInfo(int $topicId, string $sandboxId): SandboxInfoDTO
    {
        $statusResult = $this->agentDomainService->getSandboxStatus($sandboxId);
        if (! $statusResult->isSuccess() && ! $statusResult->isNotFound()) {
            throw new SandboxOperationException(
                'Get sandbox status',
                $statusResult->getMessage(),
                $statusResult->getCode()
            );
        }

        $status = $statusResult->getStatus();
        if (! is_string($status) || $status === '' || ! SandboxStatus::isValidStatus($status)) {
            throw new SandboxOperationException(
                'Get sandbox status',
                'Sandbox status is missing or invalid',
                ResponseCode::ERROR
            );
        }

        $versionInfo = $this->sandboxVersionDomainService->checkSandboxVersion($topicId, false, $sandboxId);

        return new SandboxInfoDTO(
            sandboxId: $sandboxId,
            status: $status,
            currentVersion: $versionInfo['current_version'],
            latestVersion: $versionInfo['latest_version'],
            needsUpdate: $versionInfo['needs_update'],
        );
    }

    /**
     * 启动沙箱：直接走创建+初始化流程，不删除已有沙箱，不检查镜像版本.
     *
     * 正确流程：createSandbox → initAgent → waitForWorkspaceReady。
     * 启动时不发送初始化消息（skipInitMessages），与 restart/upgrade 行为一致。
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param int $topicId 话题ID
     * @return string 沙箱ID
     */
    public function startSandbox(DataIsolation $dataIsolation, int $topicId): string
    {
        $this->logger->info('[Sandbox][App] Starting sandbox via reinit (no delete)', [
            'topic_id' => $topicId,
        ]);

        return $this->runManualSandboxOperation($dataIsolation, $topicId, fn (): string => $this->ensureSandboxInitialized($dataIsolation, $topicId, skipInitMessages: true));
    }

    /**
     * 重启沙箱：无条件删除旧沙箱，再走完整的创建+初始化流程，不检查镜像版本.
     *
     * 正确流程：delete → createSandbox → initAgent → waitForWorkspaceReady。
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param int $topicId 话题ID
     * @param null|SandboxImageTarget $images 重建的目标镜像；null=跟随网关发布版本。
     *                                        传入指定镜像时，新沙箱必须按该版本构建（回滚演练）
     * @return string 沙箱ID
     */
    public function restartSandbox(DataIsolation $dataIsolation, int $topicId, ?SandboxImageTarget $images = null): string
    {
        $topicEntity = $this->topicDomainService->getTopicById($topicId);
        if (is_null($topicEntity)) {
            throw new BusinessException('Topic not found for ID: ' . $topicId);
        }

        if ($topicEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            throw new BusinessException('Access denied for topic ID: ' . $topicId);
        }

        $persistedSandboxId = $topicEntity->getSandboxId();
        $sandboxId = $persistedSandboxId !== '' ? $persistedSandboxId : (string) $topicId;
        $this->logger->info('[Sandbox][App] Restarting sandbox via delete + reinit', [
            'topic_id' => $topicId,
            'sandbox_id' => $sandboxId,
            'images' => $images?->describe() ?? 'follow gateway release',
        ]);

        // 删除旧沙箱；仅在网关明确返回 NOT_FOUND 时继续重建。
        try {
            $this->agentDomainService->stopSandbox($sandboxId);
            $this->logger->info('[Sandbox][App] Old sandbox deleted for restart', [
                'topic_id' => $topicId,
                'sandbox_id' => $sandboxId,
            ]);
        } catch (SandboxOperationException $e) {
            if (! ResponseCode::isNotFound($e->getCode())) {
                throw $e;
            }
            $this->logger->info('[Sandbox][App] Old sandbox does not exist, proceeding with reinit', [
                'topic_id' => $topicId,
                'sandbox_id' => $sandboxId,
            ]);
        }

        return $this->ensureSandboxInitialized($dataIsolation, $topicId, skipInitMessages: true, images: $images);
    }

    /** Keep claw-specific permission and serialization outside the shared restart implementation. */
    public function restartMagicClawSandbox(DataIsolation $dataIsolation, int $topicId): string
    {
        return $this->runManualSandboxOperation($dataIsolation, $topicId, fn (): string => $this->restartSandbox($dataIsolation, $topicId));
    }

    /**
     * 升级沙箱：检查镜像版本，有新版本时才执行重启和重建流程.
     *
     * 不直接调用网关 upgrade 接口，原因是 upgrade 接口跳过了 initAgent + waitForWorkspaceReady 步骤。
     * 正确流程：delete → createSandbox → initAgent → waitForWorkspaceReady。
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param int $topicId 话题ID
     */
    public function upgradeSandbox(DataIsolation $dataIsolation, int $topicId): string
    {
        return $this->runManualSandboxOperation($dataIsolation, $topicId, function (TopicEntity $topic) use ($dataIsolation, $topicId): string {
            $sandboxId = $topic->getSandboxId() ?: (string) $topicId;
            $versionInfo = $this->sandboxVersionDomainService->checkSandboxVersion($topicId, false, $sandboxId);
            // A previously revoked claw must be explicitly initialized before its pause is cleared.
            $claw = di(MagicClawRuntimePolicyDomainService::class)->assertTopic($topicId, true);
            if ($versionInfo['needs_update'] === false && ($claw === null || ! di(MagicClawRuntimePolicyDomainService::class)->requiresManualStart($claw))) {
                return $sandboxId;
            }
            return $this->restartSandbox($dataIsolation, $topicId);
        });
    }

    /**
     * 删除（停止）沙箱.
     *
     * @param string $sandboxId 沙箱ID
     * @return GatewayResult 删除结果
     */
    public function stopSandbox(string $sandboxId): GatewayResult
    {
        return $this->agentDomainService->stopSandboxIfExists($sandboxId);
    }

    /**
     * 检查话题沙箱的镜像版本，返回当前版本和最新版本.
     *
     * @param int $topicId 话题ID
     * @return array{current_version: string, latest_version: string, needs_update: null|bool}
     */
    public function checkSandboxVersion(int $topicId, bool $useCache = true, string $effectiveSandboxId = ''): array
    {
        return $this->sandboxVersionDomainService->checkSandboxVersion($topicId, $useCache, $effectiveSandboxId);
    }

    /**
     * 批量检查话题沙箱镜像版本，返回每个 topic_id 是否需要升级.
     *
     * @param int[] $topicIds
     * @return array<int, null|bool> topicId => needUpgrade
     */
    public function checkSandboxVersionsByTopicIds(array $topicIds, bool $useCache = true): array
    {
        return $this->sandboxVersionDomainService->checkNeedUpgradeByTopicIds($topicIds, $useCache);
    }

    /**
     * 批量获取沙箱状态
     *
     * @param array $sandboxIds 沙箱ID数组
     * @return BatchStatusResult 批量沙箱状态结果
     */
    public function getBatchSandboxStatus(array $sandboxIds): BatchStatusResult
    {
        return $this->agentDomainService->getBatchSandboxStatus($sandboxIds);
    }

    /**
     * 列出沙箱网关里真实存在的沙箱（可按状态过滤）。
     *
     * 运维脚本（如 magic-claw:restart-sandbox-all）用这个接口拿“正在运行”的沙箱集合，
     * 而不是从业务表反推，避免把已经退出、或从未创建过沙箱的记录重新拉起。
     *
     * @param string[] $statuses 只返回这些状态（如 ['Running']）；空数组表示不过滤
     */
    public function listSandboxes(array $statuses = []): SandboxListResult
    {
        return $this->agentDomainService->listSandboxes($statuses);
    }

    /**
     * 发送消息给 agent.
     */
    public function sendChatMessage(DataIsolation $dataIsolation, TaskContext $taskContext): void
    {
        $dataIsolation->initDataIsolationEnv();
        // 在 Application 层完成 mentions 规范化，Domain 层不再跨域聚合
        di(TaskContextMentionsResolver::class)->resolve($taskContext, $dataIsolation);
        $this->agentDomainService->sendChatMessage(
            dataIsolation: $dataIsolation,
            taskContext: $taskContext,
            personalPreferences: $this->getAgentPersonalPreferences($dataIsolation)
        );
    }

    /**
     * 发送中断消息给Agent.
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param string $sandboxId 沙箱ID
     * @param string $taskId 任务ID
     * @param string $reason 中断原因
     * @return AgentResponse 中断响应
     */
    public function sendInterruptMessage(
        DataIsolation $dataIsolation,
        string $sandboxId,
        string $taskId,
        string $reason,
    ): AgentResponse {
        $dataIsolation->initDataIsolationEnv();
        return $this->agentDomainService->sendInterruptMessage($dataIsolation, $sandboxId, $taskId, $reason);
    }

    /**
     * 获取工作区状态.
     *
     * @param string $sandboxId 沙箱ID
     * @return AgentResponse 工作区状态响应
     */
    public function getWorkspaceStatus(DataIsolation $dataIsolation, string $sandboxId): AgentResponse
    {
        $dataIsolation->initDataIsolationEnv();
        return $this->agentDomainService->getWorkspaceStatus($dataIsolation, $sandboxId);
    }

    /**
     * 确保沙箱已初始化且工作区处于ready状态.
     * 该方法可供 API 层（如 TopicApi）或 AgentAppService 内部调用.
     *
     * 注意：其他应用层服务（如 HandleUserMessageAppService, SandboxPreWarmAppService）
     * 不应该调用此方法，而应该直接调用 AgentDomainService.ensureSandboxInitialized()
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param int $topicId 话题ID
     * @return string 沙箱ID
     * @throws BusinessException 当初始化失败时
     */
    public function ensureSandboxInitialized(
        DataIsolation $dataIsolation,
        int $topicId,
        bool $skipInitMessages = false,
        ?SandboxImageTarget $images = null,
    ): string {
        $dataIsolation->initDataIsolationEnv();
        $this->logger->info('[Sandbox][App] Ensuring sandbox is initialized', [
            'topic_id' => $topicId,
            'skip_init_messages' => $skipInitMessages,
            'images' => $images?->describe() ?? 'follow gateway release',
        ]);

        // Prepare metadata using Trait
        $topicEntity = $this->topicDomainService->getTopicById($topicId);
        if (is_null($topicEntity)) {
            throw new BusinessException('Topic not found for ID: ' . $topicId);
        }

        if ($topicEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            throw new BusinessException('Access denied for topic ID: ' . $topicId);
        }

        $projectEntity = $this->projectDomainService->getProjectNotUserId($topicEntity->getProjectId());

        // init task
        $taskEntity = $this->taskDomainService->initDefaultTask($dataIsolation, $topicEntity);

        // 传话题已绑定的 sandbox_id（未绑定则为空），让 Domain 在没有绑定时能走 warm pool。
        // 不要漏传让其默认回退成 topic_id，否则温池话题会用 topic_id 探测 workspace 失败、
        // 误判沙箱不存在，进而重复新建一个沙箱。
        $agentContext = $this->agentDomainService->buildInitAgentContext(
            dataIsolation: $dataIsolation,
            projectEntity: $projectEntity,
            topicEntity: $topicEntity,
            taskEntity: $taskEntity,
            sandboxId: (string) $topicEntity->getSandboxId(),
            skipInitMessage: $skipInitMessages
        );

        // Delegate to domain service
        $sandboxId = $this->agentDomainService->ensureSandboxInitialized(
            $dataIsolation,
            $agentContext,
            new SandboxRootFileIds(
                (string) $this->taskFileDomainService->getProjectRootFileId($projectEntity->getId()),
                (string) $this->taskFileDomainService->findOrCreateUserRootDirectory($dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode()),
                (string) $this->taskFileDomainService->findOrCreateTopicRootDirectory($projectEntity->getId(), $topicEntity->getId(), $dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode(), $projectEntity->getUserOrganizationCode())
            ),
            images: $images
        );

        // 初始化可能切换到 Warm Pool 或重新创建沙箱，必须同步刷新 topic 与 task 的最终绑定。
        $this->topicDomainService->updateTopicSandboxId($dataIsolation, $topicId, $sandboxId);
        $this->taskDomainService->updateTaskSandboxId($dataIsolation, $taskEntity->getId(), $sandboxId);

        return $sandboxId;
    }

    /**
     * 回滚到指定的checkpoint.
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param int $topicId 话题ID
     * @param string $sandboxId 沙箱ID
     * @param string $targetMessageId 目标消息ID
     * @return AgentResponse 回滚响应
     */
    public function rollbackCheckpoint(DataIsolation $dataIsolation, int $topicId, string $sandboxId, string $targetMessageId): AgentResponse
    {
        $dataIsolation->initDataIsolationEnv();
        $this->logger->info('[Sandbox][App] Rollback checkpoint requested', [
            'sandbox_id' => $sandboxId,
            'target_message_id' => $targetMessageId,
        ]);

        $topicEntity = $this->topicDomainService->getTopicById($topicId);
        if ($topicEntity === null) {
            throw new BusinessException('Topic not found for ID: ' . $topicId);
        }
        if ($topicEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            throw new BusinessException('Access denied for topic ID: ' . $topicId);
        }

        return $this->checkpointRollbackLock->run($topicEntity->getId(), function (callable $assertOwnership) use ($dataIsolation, $sandboxId, $targetMessageId, $topicEntity): AgentResponse {
            $assertOwnership();
            // 执行沙箱回滚
            $response = $this->agentDomainService->rollbackCheckpoint($dataIsolation, $sandboxId, $targetMessageId);

            // 沙箱回滚失败，记录日志并提前返回
            if (! $response->isSuccess()) {
                $this->logger->error('[Sandbox][App] Checkpoint rollback failed', [
                    'sandbox_id' => $sandboxId,
                    'target_message_id' => $targetMessageId,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);

                // 沙箱回滚失败，不执行消息回滚
                $this->logger->info('[Sandbox][App] Skipping message rollback due to sandbox rollback failure', [
                    'sandbox_id' => $sandboxId,
                    'target_message_id' => $targetMessageId,
                ]);

                return $response;
            }

            // 沙箱回滚成功，记录日志并执行消息回滚
            $this->logger->info('[Sandbox][App] Checkpoint rollback successful', [
                'sandbox_id' => $sandboxId,
                'target_message_id' => $targetMessageId,
                'sandbox_response' => $response->getMessage(),
            ]);

            // 执行消息回滚
            $affectedSeqIds = $this->runRollbackMessageMutation(
                fn (): array => $this->topicDomainService->rollbackMessages($targetMessageId),
                $assertOwnership
            );
            $assertOwnership();
            $this->dispatchRollbackMessageChanges(
                $topicEntity,
                $dataIsolation,
                CheckpointRollbackMessagesChangedEvent::ACTION_ROLLBACK,
                $affectedSeqIds,
                $targetMessageId
            );

            $this->logger->info('[Sandbox][App] Message rollback completed successfully', [
                'sandbox_id' => $sandboxId,
                'target_message_id' => $targetMessageId,
            ]);

            return $response;
        });
    }

    /**
     * 开始回滚到指定的checkpoint（调用沙箱网关并标记消息状态）.
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param int $topicId 话题ID
     * @param string $targetMessageId 目标消息ID
     * @return string 操作结果消息
     */
    public function rollbackCheckpointStart(DataIsolation $dataIsolation, int $topicId, string $targetMessageId): string
    {
        $dataIsolation->initDataIsolationEnv();
        $this->logger->info('[Sandbox][App] Rollback checkpoint start requested', [
            'topic_id' => $topicId,
            'target_message_id' => $targetMessageId,
        ]);

        // 验证话题存在且属于当前用户
        $topicEntity = $this->topicDomainService->getTopicById($topicId);
        if (is_null($topicEntity)) {
            throw new BusinessException('Topic not found for ID: ' . $topicId);
        }

        if ($topicEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            throw new BusinessException('Access denied for topic ID: ' . $topicId);
        }

        return $this->checkpointRollbackLock->run($topicEntity->getId(), function (callable $assertOwnership) use ($dataIsolation, $topicId, $targetMessageId, $topicEntity): string {
            // Checkpoint operations may reattach to an existing sandbox; keep recovery init silent.
            $sandboxId = $this->ensureSandboxInitialized($dataIsolation, $topicId, skipInitMessages: true);
            $assertOwnership();

            // 调用沙箱网关开始回滚
            $sandboxResponse = $this->agentDomainService->rollbackCheckpointStart($dataIsolation, $sandboxId, $targetMessageId);

            if (! $sandboxResponse->isSuccess()) {
                $this->logger->error('[Sandbox][App] Sandbox rollback start failed', [
                    'sandbox_id' => $sandboxId,
                    'target_message_id' => $targetMessageId,
                    'error' => $sandboxResponse->getMessage(),
                ]);
                throw new BusinessException('Sandbox rollback start failed: ' . $sandboxResponse->getMessage());
            }

            // 沙箱操作成功后，执行消息状态标记
            $affectedSeqIds = $this->runRollbackMessageMutation(
                fn (): array => $this->topicDomainService->rollbackMessagesStart($targetMessageId),
                $assertOwnership
            );
            $assertOwnership();
            $this->dispatchRollbackMessageChanges(
                $topicEntity,
                $dataIsolation,
                CheckpointRollbackMessagesChangedEvent::ACTION_START,
                $affectedSeqIds,
                $targetMessageId
            );
            $assertOwnership();
            $this->dispatchRollbackAffectedFileChanges(
                $topicEntity,
                $dataIsolation,
                $sandboxResponse,
                'checkpoint_rollback_start'
            );

            $this->logger->info('[Sandbox][App] Message rollback start completed successfully', [
                'topic_id' => $topicId,
                'target_message_id' => $targetMessageId,
                'sandbox_response' => $sandboxResponse->getMessage(),
            ]);

            return 'Sandbox and messages rollback started successfully';
        });
    }

    /**
     * 提交回滚到指定的checkpoint（调用沙箱网关并物理删除撤回状态的消息）.
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param int $topicId 话题ID
     * @return string 操作结果消息
     */
    public function rollbackCheckpointCommit(DataIsolation $dataIsolation, int $topicId): string
    {
        $dataIsolation->initDataIsolationEnv();
        $this->logger->info('[Sandbox][App] Rollback checkpoint commit requested', [
            'topic_id' => $topicId,
        ]);

        // 验证话题存在且属于当前用户
        $topicEntity = $this->topicDomainService->getTopicById($topicId);
        if (is_null($topicEntity)) {
            throw new BusinessException('Topic not found for ID: ' . $topicId);
        }

        if ($topicEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            throw new BusinessException('Access denied for topic ID: ' . $topicId);
        }

        return $this->checkpointRollbackLock->run($topicEntity->getId(), function (callable $assertOwnership) use ($dataIsolation, $topicId, $topicEntity): string {
            // Checkpoint operations may reattach to an existing sandbox; keep recovery init silent.
            $sandboxId = $this->ensureSandboxInitialized($dataIsolation, $topicId, skipInitMessages: true);
            $assertOwnership();

            // 调用沙箱网关提交回滚
            $sandboxResponse = $this->agentDomainService->rollbackCheckpointCommit($dataIsolation, $sandboxId);

            if (! $sandboxResponse->isSuccess()) {
                $this->logger->error('[Sandbox][App] Sandbox rollback commit failed', [
                    'sandbox_id' => $sandboxId,
                    'error' => $sandboxResponse->getMessage(),
                ]);
                throw new BusinessException('Sandbox rollback commit failed: ' . $sandboxResponse->getMessage());
            }

            // 沙箱操作成功后，执行物理删除撤回状态的消息
            $affectedSeqIds = $this->runRollbackMessageMutation(
                fn (): array => $this->topicDomainService->rollbackMessagesCommit($topicId, $dataIsolation->getCurrentUserId()),
                $assertOwnership
            );
            $assertOwnership();
            $this->dispatchRollbackMessageChanges(
                $topicEntity,
                $dataIsolation,
                CheckpointRollbackMessagesChangedEvent::ACTION_COMMIT,
                $affectedSeqIds
            );

            $this->logger->info('[Sandbox][App] Message rollback commit completed successfully', [
                'topic_id' => $topicId,
                'sandbox_response' => $sandboxResponse->getMessage(),
            ]);

            return 'Sandbox and messages rollback committed successfully';
        });
    }

    /**
     * 撤销回滚操作（调用沙箱网关并将撤回状态的消息恢复为正常状态）.
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param int $topicId 话题ID
     * @return string 操作结果消息
     */
    public function rollbackCheckpointUndo(DataIsolation $dataIsolation, int $topicId): string
    {
        $dataIsolation->initDataIsolationEnv();
        $this->logger->info('[Sandbox][App] Rollback checkpoint undo requested', [
            'topic_id' => $topicId,
            'user_id' => $dataIsolation->getCurrentUserId(),
        ]);

        // 验证话题存在且属于当前用户
        $topicEntity = $this->topicDomainService->getTopicById($topicId);
        if (is_null($topicEntity)) {
            $this->logger->error('[Sandbox][App] Topic not found for undo', [
                'topic_id' => $topicId,
                'user_id' => $dataIsolation->getCurrentUserId(),
            ]);
            throw new BusinessException('Topic not found for ID: ' . $topicId);
        }

        if ($topicEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            $this->logger->error('[Sandbox][App] Access denied for topic undo', [
                'topic_id' => $topicId,
                'topic_user_id' => $topicEntity->getUserId(),
                'current_user_id' => $dataIsolation->getCurrentUserId(),
            ]);
            throw new BusinessException('Access denied for topic ID: ' . $topicId);
        }

        return $this->checkpointRollbackLock->run($topicEntity->getId(), function (callable $assertOwnership) use ($dataIsolation, $topicId, $topicEntity): string {
            // Checkpoint operations may reattach to an existing sandbox; keep recovery init silent.
            $sandboxId = $this->ensureSandboxInitialized($dataIsolation, $topicId, skipInitMessages: true);
            $assertOwnership();

            // 调用沙箱网关撤销回滚
            $sandboxResponse = $this->agentDomainService->rollbackCheckpointUndo($dataIsolation, $sandboxId);

            if (! $sandboxResponse->isSuccess()) {
                $this->logger->error('[Sandbox][App] Sandbox rollback undo failed', [
                    'sandbox_id' => $sandboxId,
                    'error' => $sandboxResponse->getMessage(),
                ]);
                throw new BusinessException('Sandbox rollback undo failed: ' . $sandboxResponse->getMessage());
            }

            // 沙箱操作成功后，执行消息撤回撤销操作（恢复为正常状态）
            $affectedSeqIds = $this->runRollbackMessageMutation(
                fn (): array => $this->topicDomainService->rollbackMessagesUndo($topicId, $dataIsolation->getCurrentUserId()),
                $assertOwnership
            );
            $assertOwnership();
            $this->dispatchRollbackMessageChanges(
                $topicEntity,
                $dataIsolation,
                CheckpointRollbackMessagesChangedEvent::ACTION_UNDO,
                $affectedSeqIds
            );
            $assertOwnership();
            $this->dispatchRollbackAffectedFileChanges(
                $topicEntity,
                $dataIsolation,
                $sandboxResponse,
                'checkpoint_rollback_undo'
            );

            $this->logger->info('[Sandbox][App] Message rollback undo completed successfully', [
                'topic_id' => $topicId,
                'user_id' => $dataIsolation->getCurrentUserId(),
                'sandbox_response' => $sandboxResponse->getMessage(),
            ]);

            return 'Sandbox and messages rollback undone successfully';
        });
    }

    /**
     * 检查回滚到指定checkpoint的可行性.
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param int $topicId 话题ID
     * @param string $targetMessageId 目标消息ID
     * @return AgentResponse 检查结果响应
     */
    public function rollbackCheckpointCheck(DataIsolation $dataIsolation, int $topicId, string $targetMessageId): AgentResponse
    {
        $dataIsolation->initDataIsolationEnv();
        $this->logger->info('[Sandbox][App] Rollback checkpoint check requested', [
            'topic_id' => $topicId,
            'target_message_id' => $targetMessageId,
        ]);

        // 验证话题存在且属于当前用户
        $topicEntity = $this->topicDomainService->getTopicById($topicId);
        if (is_null($topicEntity)) {
            $this->logger->error('[Sandbox][App] Topic not found for rollback check', [
                'topic_id' => $topicId,
                'user_id' => $dataIsolation->getCurrentUserId(),
            ]);
            throw new BusinessException('Topic not found for ID: ' . $topicId);
        }

        if ($topicEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            $this->logger->error('[Sandbox][App] Access denied for topic rollback check', [
                'topic_id' => $topicId,
                'topic_user_id' => $topicEntity->getUserId(),
                'current_user_id' => $dataIsolation->getCurrentUserId(),
            ]);
            throw new BusinessException('Access denied for topic ID: ' . $topicId);
        }

        // Checkpoint operations may reattach to an existing sandbox; keep recovery init silent.
        $sandboxId = $this->ensureSandboxInitialized($dataIsolation, $topicId, skipInitMessages: true);

        // 调用领域服务检查回滚可行性
        $response = $this->agentDomainService->rollbackCheckpointCheck($dataIsolation, $sandboxId, $targetMessageId);

        // 记录检查结果
        if ($response->isSuccess()) {
            $this->logger->info('[Sandbox][App] Checkpoint rollback check completed successfully', [
                'topic_id' => $topicId,
                'target_message_id' => $targetMessageId,
                'can_rollback' => $response->getDataValue('can_rollback'),
            ]);
        } else {
            $this->logger->warning('[Sandbox][App] Checkpoint rollback check failed', [
                'topic_id' => $topicId,
                'target_message_id' => $targetMessageId,
                'error' => $response->getMessage(),
            ]);
        }

        return $response;
    }

    /** Permission, ownership and serialization are shared by all explicit run operations. */
    private function runManualSandboxOperation(DataIsolation $dataIsolation, int $topicId, callable $operation): string
    {
        return di(SandboxLifecycleLock::class)->run($topicId, function () use ($dataIsolation, $topicId, $operation): string {
            $topic = $this->topicDomainService->getTopicById($topicId);
            if ($topic === null) {
                throw new BusinessException('Topic not found for ID: ' . $topicId);
            }
            if ($topic->getUserId() !== $dataIsolation->getCurrentUserId()
                || $topic->getUserOrganizationCode() !== $dataIsolation->getCurrentOrganizationCode()) {
                throw new BusinessException('Access denied for topic ID: ' . $topicId);
            }
            return di(MagicClawRuntimePolicyDomainService::class)->manualStart($topicId, fn (): string => $operation($topic));
        });
    }

    /**
     * @param callable(): array $mutation
     * @param callable(): void $assertOwnership
     */
    private function runRollbackMessageMutation(callable $mutation, callable $assertOwnership): array
    {
        $assertOwnership();
        return Db::transaction(function () use ($mutation, $assertOwnership): array {
            $affectedSeqIds = $mutation();
            $assertOwnership();
            return $affectedSeqIds;
        });
    }

    /**
     * 获取本次 CHAT 需要透传给 Super Magic 的个人偏好。
     *
     * Application 层负责读取 Contact Domain 的设置并筛选跨服务协议允许的字段，
     * Super Magic Domain 不直接依赖 Contact Domain，也不解析个人偏好的具体语义。
     *
     * @return array<string, mixed> 本次 CHAT 的个人偏好
     */
    private function getAgentPersonalPreferences(DataIsolation $dataIsolation): array
    {
        return [
            PersonalPreferencesKeys::LONG_TERM_MEMORY_ENABLED => $this->readLongTermMemoryEnabled($dataIsolation),
            PersonalPreferencesKeys::SHOW_FOLLOW_UP_SUGGESTIONS => $this->readShowFollowUpSuggestions($dataIsolation),
        ];
    }

    /**
     * 长期记忆开关来自用户设置。读取失败时默认开启，不中断聊天。
     */
    private function readLongTermMemoryEnabled(DataIsolation $dataIsolation): bool
    {
        try {
            $setting = $this->magicUserSettingDomainService->get(
                $dataIsolation,
                UserSettingKey::PersonalPreferences->value
            );
            $preferences = $setting?->getValue() ?? [];
            $longTermMemoryEnabled = $preferences[PersonalPreferencesKeys::LONG_TERM_MEMORY_ENABLED] ?? true;

            return is_bool($longTermMemoryEnabled) ? $longTermMemoryEnabled : true;
        } catch (Throwable $throwable) {
            $this->logger->warning('[Sandbox][App] Failed to load personal preferences, using defaults', [
                'exception_class' => $throwable::class,
                'user_id' => $dataIsolation->getCurrentUserId(),
            ]);

            return true;
        }
    }

    /**
     * 追问开关来自当前组织用户资料，不写入 magic_user_settings。
     * 明确 false 原样下发；读不到用户时默认开启。
     */
    private function readShowFollowUpSuggestions(DataIsolation $dataIsolation): bool
    {
        try {
            $userId = $dataIsolation->getCurrentUserId();
            if ($userId === '') {
                return true;
            }

            $users = $this->magicUserDomainService->getByUserIds($dataIsolation, [$userId]);
            $user = $users[$userId] ?? null;
            if (! $user instanceof MagicUserEntity) {
                return true;
            }

            return $user->getPreferences()->isShowFollowUpSuggestions();
        } catch (Throwable $throwable) {
            $this->logger->warning('[Sandbox][App] Failed to load follow-up preference, using default', [
                'exception_class' => $throwable::class,
                'user_id' => $dataIsolation->getCurrentUserId(),
            ]);

            return true;
        }
    }

    private function dispatchRollbackAffectedFileChanges(
        TopicEntity $topicEntity,
        DataIsolation $dataIsolation,
        AgentResponse $sandboxResponse,
        string $reason
    ): void {
        $projectId = $topicEntity->getProjectId();
        if ($projectId <= 0) {
            $this->logger->warning('[Sandbox][App] Skip rollback file change event because topic has no project', [
                'topic_id' => $topicEntity->getId(),
                'reason' => $reason,
            ]);
            return;
        }

        $fileChanges = $this->getRollbackAffectedFiles($sandboxResponse->getData());
        if (empty($fileChanges)) {
            $this->logger->info('[Sandbox][App] No rollback affected files returned by sandbox', [
                'topic_id' => $topicEntity->getId(),
                'project_id' => $projectId,
                'reason' => $reason,
            ]);
            return;
        }

        try {
            $this->eventDispatcher->dispatch(new CheckpointRollbackFilesChangedEvent(
                $fileChanges,
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode(),
                $projectId,
                $topicEntity->getId()
            ));

            $this->logger->info('[Sandbox][App] Rollback file change event dispatched', [
                'topic_id' => $topicEntity->getId(),
                'project_id' => $projectId,
                'file_count' => count($fileChanges),
                'reason' => $reason,
            ]);
        } catch (Throwable $throwable) {
            $this->logger->warning('[Sandbox][App] Failed to dispatch rollback file change event', [
                'topic_id' => $topicEntity->getId(),
                'project_id' => $projectId,
                'reason' => $reason,
                'error' => $throwable->getMessage(),
            ]);
        }
    }

    /**
     * @param array<int|string> $affectedSeqIds
     */
    private function dispatchRollbackMessageChanges(
        TopicEntity $topicEntity,
        DataIsolation $dataIsolation,
        string $action,
        array $affectedSeqIds,
        ?string $targetSeqId = null
    ): void {
        if (empty($affectedSeqIds)) {
            return;
        }

        try {
            $this->eventDispatcher->dispatch(new CheckpointRollbackMessagesChangedEvent(
                $action,
                $topicEntity->getId(),
                $topicEntity->getChatTopicId(),
                $topicEntity->getProjectId(),
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode(),
                $topicEntity->getChatConversationId(),
                $affectedSeqIds,
                $targetSeqId
            ));
        } catch (Throwable $throwable) {
            $this->logger->warning('[Sandbox][App] Failed to dispatch rollback message change event', [
                'topic_id' => $topicEntity->getId(),
                'action' => $action,
                'affected_count' => count($affectedSeqIds),
                'error' => $throwable->getMessage(),
            ]);
        }
    }

    /**
     * @return array<int, array{file_id: int|string, file_path: string, operation: string}>
     */
    private function getRollbackAffectedFiles(array $responseData): array
    {
        $affectedFiles = array_is_list($responseData) ? $responseData : ($responseData['affected_files'] ?? []);
        return is_array($affectedFiles) ? $affectedFiles : [];
    }
}

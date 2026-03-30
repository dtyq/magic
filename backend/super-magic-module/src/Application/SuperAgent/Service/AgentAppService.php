<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\Exception\BusinessException;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AgentDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\SandboxVersionDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Response\AgentResponse;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\BatchStatusResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\SandboxStatusResult;
use Hyperf\Logger\LoggerFactory;
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
        private readonly TaskDomainService $taskDomainService,
        private readonly SandboxVersionDomainService $sandboxVersionDomainService,
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
     * 升级沙箱：先删除旧沙箱，再走完整的创建+初始化流程.
     *
     * 不直接调用网关 upgrade 接口，原因是 upgrade 接口跳过了 initAgent + waitForWorkspaceReady 步骤。
     * 正确流程：delete → createSandbox → initAgent → waitForWorkspaceReady。
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param int $topicId 话题ID（sandbox_id 即 topic_id）
     * @return string 沙箱ID
     */
    public function upgradeSandbox(DataIsolation $dataIsolation, int $topicId): string
    {
        $this->logger->info('[Sandbox][App] Upgrading sandbox via delete + reinit', [
            'topic_id' => $topicId,
        ]);

        // 删除旧沙箱，如果已不存在则忽略错误继续重建
        try {
            $this->agentDomainService->stopSandbox((string) $topicId);
            $this->logger->info('[Sandbox][App] Old sandbox deleted for upgrade', [
                'sandbox_id' => $topicId,
            ]);
        } catch (Throwable $e) {
            $this->logger->warning('[Sandbox][App] Failed to delete sandbox during upgrade (may not exist), proceeding with reinit', [
                'sandbox_id' => $topicId,
                'error' => $e->getMessage(),
            ]);
        }

        return $this->ensureSandboxInitialized($dataIsolation, $topicId);
    }

    /**
     * 删除（停止）沙箱.
     *
     * @param string $sandboxId 沙箱ID
     * @return GatewayResult 删除结果
     */
    public function stopSandbox(string $sandboxId): GatewayResult
    {
        return $this->agentDomainService->stopSandbox($sandboxId);
    }

    /**
     * 检查话题沙箱的镜像版本，返回当前版本和最新版本.
     *
     * @param int $topicId 话题ID
     * @return array{current_version: string, latest_version: string, needs_update: bool}
     */
    public function checkSandboxVersion(int $topicId): array
    {
        return $this->sandboxVersionDomainService->checkSandboxVersion($topicId);
    }

    /**
     * 批量检查话题沙箱镜像版本，返回每个 topic_id 是否需要升级.
     *
     * @param int[] $topicIds
     * @return array<int, bool> topicId => needUpgrade
     */
    public function checkSandboxVersionsByTopicIds(array $topicIds): array
    {
        return $this->sandboxVersionDomainService->checkNeedUpgradeByTopicIds($topicIds);
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
     * 发送消息给 agent.
     */
    public function sendChatMessage(DataIsolation $dataIsolation, TaskContext $taskContext): void
    {
        $this->agentDomainService->sendChatMessage($dataIsolation, $taskContext);
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
        return $this->agentDomainService->sendInterruptMessage($dataIsolation, $sandboxId, $taskId, $reason);
    }

    /**
     * 获取工作区状态.
     *
     * @param string $sandboxId 沙箱ID
     * @return AgentResponse 工作区状态响应
     */
    public function getWorkspaceStatus(string $sandboxId): AgentResponse
    {
        return $this->agentDomainService->getWorkspaceStatus($sandboxId);
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
    ): string {
        $this->logger->info('[Sandbox][App] Ensuring sandbox is initialized', [
            'topic_id' => $topicId,
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

        $agentContext = $this->agentDomainService->buildInitAgentContext($dataIsolation, $projectEntity, $topicEntity, $taskEntity);

        // Delegate to domain service
        return $this->agentDomainService->ensureSandboxInitialized(
            $dataIsolation,
            $agentContext
        );
    }

    /**
     * 回滚到指定的checkpoint.
     *
     * @param string $sandboxId 沙箱ID
     * @param string $targetMessageId 目标消息ID
     * @return AgentResponse 回滚响应
     */
    public function rollbackCheckpoint(string $sandboxId, string $targetMessageId): AgentResponse
    {
        $this->logger->info('[Sandbox][App] Rollback checkpoint requested', [
            'sandbox_id' => $sandboxId,
            'target_message_id' => $targetMessageId,
        ]);

        // 执行沙箱回滚
        $response = $this->agentDomainService->rollbackCheckpoint($sandboxId, $targetMessageId);

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
        $this->topicDomainService->rollbackMessages($targetMessageId);

        $this->logger->info('[Sandbox][App] Message rollback completed successfully', [
            'sandbox_id' => $sandboxId,
            'target_message_id' => $targetMessageId,
        ]);

        return $response;
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

        // 确保沙箱已初始化并获取沙箱ID
        $sandboxId = $this->ensureSandboxInitialized($dataIsolation, $topicId);

        // 调用沙箱网关开始回滚
        $sandboxResponse = $this->agentDomainService->rollbackCheckpointStart($sandboxId, $targetMessageId);

        if (! $sandboxResponse->isSuccess()) {
            $this->logger->error('[Sandbox][App] Sandbox rollback start failed', [
                'sandbox_id' => $sandboxId,
                'target_message_id' => $targetMessageId,
                'error' => $sandboxResponse->getMessage(),
            ]);
            throw new BusinessException('Sandbox rollback start failed: ' . $sandboxResponse->getMessage());
        }

        // 沙箱操作成功后，执行消息状态标记
        $this->topicDomainService->rollbackMessagesStart($targetMessageId);

        $this->logger->info('[Sandbox][App] Message rollback start completed successfully', [
            'topic_id' => $topicId,
            'target_message_id' => $targetMessageId,
            'sandbox_response' => $sandboxResponse->getMessage(),
        ]);

        return 'Sandbox and messages rollback started successfully';
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

        // 确保沙箱已初始化并获取沙箱ID
        $sandboxId = $this->ensureSandboxInitialized($dataIsolation, $topicId);

        // 调用沙箱网关提交回滚
        $sandboxResponse = $this->agentDomainService->rollbackCheckpointCommit($sandboxId);

        if (! $sandboxResponse->isSuccess()) {
            $this->logger->error('[Sandbox][App] Sandbox rollback commit failed', [
                'sandbox_id' => $sandboxId,
                'error' => $sandboxResponse->getMessage(),
            ]);
            throw new BusinessException('Sandbox rollback commit failed: ' . $sandboxResponse->getMessage());
        }

        // 沙箱操作成功后，执行物理删除撤回状态的消息
        $this->topicDomainService->rollbackMessagesCommit($topicId, $dataIsolation->getCurrentUserId());

        $this->logger->info('[Sandbox][App] Message rollback commit completed successfully', [
            'topic_id' => $topicId,
            'sandbox_response' => $sandboxResponse->getMessage(),
        ]);

        return 'Sandbox and messages rollback committed successfully';
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

        // 确保沙箱已初始化并获取沙箱ID
        $sandboxId = $this->ensureSandboxInitialized($dataIsolation, $topicId);

        // 调用沙箱网关撤销回滚
        $sandboxResponse = $this->agentDomainService->rollbackCheckpointUndo($sandboxId);

        if (! $sandboxResponse->isSuccess()) {
            $this->logger->error('[Sandbox][App] Sandbox rollback undo failed', [
                'sandbox_id' => $sandboxId,
                'error' => $sandboxResponse->getMessage(),
            ]);
            throw new BusinessException('Sandbox rollback undo failed: ' . $sandboxResponse->getMessage());
        }

        // 沙箱操作成功后，执行消息撤回撤销操作（恢复为正常状态）
        $this->topicDomainService->rollbackMessagesUndo($topicId, $dataIsolation->getCurrentUserId());

        $this->logger->info('[Sandbox][App] Message rollback undo completed successfully', [
            'topic_id' => $topicId,
            'user_id' => $dataIsolation->getCurrentUserId(),
            'sandbox_response' => $sandboxResponse->getMessage(),
        ]);

        return 'Sandbox and messages rollback undone successfully';
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

        // 确保沙箱已初始化并获取沙箱ID
        $sandboxId = $this->ensureSandboxInitialized($dataIsolation, $topicId);

        // 调用领域服务检查回滚可行性
        $response = $this->agentDomainService->rollbackCheckpointCheck($sandboxId, $targetMessageId);

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
}

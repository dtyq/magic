<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\Exception\BusinessException;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ChatInstruction;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AgentDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Constant\WorkspaceStatus;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Response\AgentResponse;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\BatchStatusResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\SandboxStatusResult;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Agent应用服务
 * 负责协调Agent领域服务的调用，遵循DDD原则.
 */
class AgentAppService
{
    private LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly AgentDomainService $agentDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
    ) {
        $this->logger = $loggerFactory->get('sandbox');
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
     * 初始化Agent.
     */
    public function initializeAgent(DataIsolation $dataIsolation, TaskContext $taskContext): void
    {
        $this->agentDomainService->initializeAgent($dataIsolation, $taskContext);
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
     * 等待工作区就绪.
     * 轮询工作区状态，直到初始化完成、失败或超时.
     *
     * @param string $sandboxId 沙箱ID
     * @param int $timeoutSeconds 超时时间（秒），默认10分钟
     * @param int $intervalSeconds 轮询间隔（秒），默认2秒
     */
    public function waitForWorkspaceReady(string $sandboxId, int $timeoutSeconds = 600, int $intervalSeconds = 2): void
    {
        $this->logger->info('[Sandbox][App] Waiting for workspace to be ready', [
            'sandbox_id' => $sandboxId,
            'timeout_seconds' => $timeoutSeconds,
            'interval_seconds' => $intervalSeconds,
        ]);

        $startTime = time();
        $endTime = $startTime + $timeoutSeconds;

        while (time() < $endTime) {
            try {
                $response = $this->getWorkspaceStatus($sandboxId);
                $status = $response->getDataValue('status');

                $this->logger->debug('[Sandbox][App] Workspace status check', [
                    'sandbox_id' => $sandboxId,
                    'status' => $status,
                    'status_description' => WorkspaceStatus::getDescription($status),
                    'elapsed_seconds' => time() - $startTime,
                ]);

                // 状态为就绪时退出
                if (WorkspaceStatus::isReady($status)) {
                    $this->logger->info('[Sandbox][App] Workspace is ready', [
                        'sandbox_id' => $sandboxId,
                        'elapsed_seconds' => time() - $startTime,
                    ]);
                    return;
                }

                // 状态为错误时抛出异常
                if (WorkspaceStatus::isError($status)) {
                    $this->logger->error('[Sandbox][App] Workspace initialization failed', [
                        'sandbox_id' => $sandboxId,
                        'status' => $status,
                        'status_description' => WorkspaceStatus::getDescription($status),
                        'elapsed_seconds' => time() - $startTime,
                    ]);
                    throw new SandboxOperationException('Wait for workspace ready', 'Workspace initialization failed with status: ' . WorkspaceStatus::getDescription($status), 3001);
                }

                // 等待下一次轮询
                sleep($intervalSeconds);
            } catch (SandboxOperationException $e) {
                // 重新抛出沙箱操作异常
                throw $e;
            } catch (Throwable $e) {
                $this->logger->error('[Sandbox][App] Error while checking workspace status', [
                    'sandbox_id' => $sandboxId,
                    'error' => $e->getMessage(),
                    'elapsed_seconds' => time() - $startTime,
                ]);
                throw new SandboxOperationException('Wait for workspace ready', 'Error checking workspace status: ' . $e->getMessage(), 3002);
            }
        }

        // 超时
        $this->logger->error('[Sandbox][App] Workspace ready timeout', [
            'sandbox_id' => $sandboxId,
            'timeout_seconds' => $timeoutSeconds,
        ]);
        throw new SandboxOperationException('Wait for workspace ready', 'Workspace ready timeout after ' . $timeoutSeconds . ' seconds', 3003);
    }

    /**
     * 确保沙箱已初始化且工作区处于ready状态.
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param int $topicId 话题ID
     * @return string 沙箱ID
     * @throws BusinessException 当初始化失败时
     */
    public function ensureSandboxInitialized(DataIsolation $dataIsolation, int $topicId): string
    {
        $this->logger->info('[Sandbox][App] Ensuring sandbox is initialized', [
            'topic_id' => $topicId,
        ]);

        // 获取话题信息
        $topicEntity = $this->topicDomainService->getTopicById($topicId);
        if (is_null($topicEntity)) {
            throw new BusinessException('Topic not found for ID: ' . $topicId);
        }

        $sandboxId = $topicEntity->getSandboxId();

        // 检查工作区状态
        try {
            $response = $this->getWorkspaceStatus($sandboxId);
            $status = $response->getDataValue('status');

            // 如果工作区已经就绪，直接返回
            if (WorkspaceStatus::isReady($status)) {
                $this->logger->info('[Sandbox][App] Workspace already ready', [
                    'sandbox_id' => $sandboxId,
                    'workspace_status' => $status,
                ]);
                return $sandboxId;
            }

            // 工作区未就绪，需要重新初始化
            $this->logger->info('[Sandbox][App] Workspace not ready, will reinitialize', [
                'sandbox_id' => $sandboxId,
                'workspace_status' => $status,
            ]);
        } catch (SandboxOperationException $e) {
            // 工作区状态检查失败，需要重新初始化
            $this->logger->warning('[Sandbox][App] Failed to check workspace status, will reinitialize', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);
        }

        // 创建或重新初始化沙箱
        $sandboxId = $this->createAndInitializeSandbox($dataIsolation, $topicEntity);

        $this->logger->info('[Sandbox][App] Sandbox initialized successfully', [
            'sandbox_id' => $sandboxId,
            'topic_id' => $topicId,
        ]);

        return $sandboxId;
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

    /**
     * 升级沙箱镜像.
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param string $messageId 消息ID
     * @param string $contextType 上下文类型，默认为continue
     * @return AgentResponse 升级响应结果
     * @throws BusinessException 当升级失败时抛出异常
     */
    public function upgradeSandbox(
        DataIsolation $dataIsolation,
        string $messageId,
        string $contextType = 'continue'
    ): AgentResponse {
        $this->logger->info('[Sandbox][App] Upgrading sandbox image', [
            'message_id' => $messageId,
            'context_type' => $contextType,
            'user_id' => $dataIsolation->getCurrentUserId(),
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
        ]);

        try {
            // 调用领域服务执行升级
            $response = $this->agentDomainService->upgradeSandbox($messageId, $contextType);

            $this->logger->info('[Sandbox][App] Sandbox upgrade completed successfully', [
                'message_id' => $messageId,
                'context_type' => $contextType,
                'user_id' => $dataIsolation->getCurrentUserId(),
            ]);

            return $response;
        } catch (SandboxOperationException $e) {
            $this->logger->error('[Sandbox][App] Sandbox upgrade failed', [
                'message_id' => $messageId,
                'context_type' => $contextType,
                'user_id' => $dataIsolation->getCurrentUserId(),
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);

            throw new BusinessException('Sandbox upgrade failed: ' . $e->getMessage());
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][App] Unexpected error during sandbox upgrade', [
                'message_id' => $messageId,
                'context_type' => $contextType,
                'user_id' => $dataIsolation->getCurrentUserId(),
                'error' => $e->getMessage(),
            ]);

            throw new BusinessException('Unexpected error during sandbox upgrade: ' . $e->getMessage());
        }
    }

    /**
     * 创建并初始化沙箱.
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param TopicEntity $topicEntity 话题实体
     * @return string 沙箱ID
     */
    private function createAndInitializeSandbox(DataIsolation $dataIsolation, TopicEntity $topicEntity): string
    {
        // 获取完整的工作目录路径
        $fullPrefix = $this->taskFileDomainService->getFullPrefix($dataIsolation->getCurrentOrganizationCode());
        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $topicEntity->getWorkDir() ?? '');

        $sandboxId = $topicEntity->getSandboxId();

        // 创建沙箱容器
        $sandboxId = $this->agentDomainService->createSandbox(
            $dataIsolation,
            (string) $topicEntity->getProjectId(),
            $sandboxId,
            $fullWorkdir
        );

        // 创建TaskEntity，充分利用TopicEntity的数据
        $taskEntity = new TaskEntity();
        $taskEntity->setTopicId($topicEntity->getId());
        $taskEntity->setProjectId($topicEntity->getProjectId());
        $taskEntity->setWorkspaceId($topicEntity->getWorkspaceId());
        $taskEntity->setSandboxId($sandboxId);
        $taskEntity->setWorkDir($topicEntity->getWorkDir() ?? '');
        $taskEntity->setUserId($topicEntity->getUserId());
        $taskEntity->setTaskMode($topicEntity->getTaskMode());

        // 如果TopicEntity有当前任务ID，也设置到TaskEntity
        if ($topicEntity->getCurrentTaskId()) {
            $taskEntity->setId($topicEntity->getCurrentTaskId());
            $taskEntity->setTaskId((string) $topicEntity->getCurrentTaskId());
        }

        // 创建TaskContext，充分利用TopicEntity的所有相关数据
        $taskContext = new TaskContext(
            task: $taskEntity,
            dataIsolation: $dataIsolation,
            chatConversationId: $topicEntity->getChatConversationId(),
            chatTopicId: $topicEntity->getChatTopicId(),
            agentUserId: $topicEntity->getCreatedUid() ?: $topicEntity->getUserId(), // 使用创建者ID或用户ID
            sandboxId: $sandboxId,
            taskId: $topicEntity->getCurrentTaskId() ? (string) $topicEntity->getCurrentTaskId() : '',
            instruction: ChatInstruction::Normal,
            agentMode: $topicEntity->getTopicMode() ? $topicEntity->getTopicMode()->value : 'general',
            workspaceId: (string) $topicEntity->getWorkspaceId(),
        );

        // 初始化Agent
        $this->agentDomainService->initializeAgent($dataIsolation, $taskContext);

        // 等待工作区就绪
        $this->waitForWorkspaceReady($sandboxId, 60, 2);

        return $sandboxId;
    }
}

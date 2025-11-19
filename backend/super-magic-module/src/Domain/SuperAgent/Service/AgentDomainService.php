<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Application\Chat\Service\MagicUserInfoAppService;
use App\Application\File\Service\FileAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\DynamicConfig\DynamicConfigManager;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageMetadata;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\UserInfoValueObject;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Constant\WorkspaceStatus;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\ChatMessageRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\CheckpointRollbackCheckRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\CheckpointRollbackCommitRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\CheckpointRollbackRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\CheckpointRollbackStartRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\CheckpointRollbackUndoRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\InitAgentRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\InterruptRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Response\AgentResponse;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\SandboxAgentInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\ResponseCode;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\BatchStatusResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\SandboxStatusResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * Agent消息应用服务
 * 提供高级Agent通信功能，包括自动初始化和状态管理.
 */
class AgentDomainService
{
    private LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory,
        private SandboxGatewayInterface $gateway,
        private SandboxAgentInterface $agent,
        private readonly FileAppService $fileAppService,
        private readonly MagicUserInfoAppService $userInfoAppService,
        private readonly CloudFileRepositoryInterface $cloudFileRepository,
        private readonly DynamicConfigManager $dynamicConfigManager,
    ) {
        $this->logger = $loggerFactory->get('sandbox');
    }

    /**
     * 调用沙箱网关，创建沙箱容器，如果 sandboxId 不存在，系统会默认创建一个.
     */
    public function createSandbox(DataIsolation $dataIsolation, string $projectId, string $sandboxID, string $workDir): string
    {
        $this->logger->info('[Sandbox][App] Creating sandbox', [
            'project_id' => $projectId,
            'sandbox_id' => $sandboxID,
            'project_oss_path' => $workDir,
        ]);

        $this->gateway->setUserContext($dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode());
        $result = $this->gateway->createSandbox($projectId, $sandboxID, $workDir);

        // 添加详细的调试日志，检查 result 对象
        $this->logger->info('[Sandbox][App] Gateway result analysis', [
            'result_class' => get_class($result),
            'result_is_success' => $result->isSuccess(),
            'result_code' => $result->getCode(),
            'result_message' => $result->getMessage(),
            'result_data_raw' => $result->getData(),
            'result_data_type' => gettype($result->getData()),
            'sandbox_id_via_getDataValue' => $result->getDataValue('sandbox_id'),
            'sandbox_id_via_getData_direct' => $result->getData()['sandbox_id'] ?? 'KEY_NOT_FOUND',
        ]);

        if (! $result->isSuccess()) {
            $this->logger->error('[Sandbox][App] Failed to create sandbox', [
                'project_id' => $projectId,
                'sandbox_id' => $sandboxID,
                'error' => $result->getMessage(),
                'code' => $result->getCode(),
            ]);
            throw new SandboxOperationException('Create sandbox', $result->getMessage(), $result->getCode());
        }

        $this->logger->info('[Sandbox][App] Create sandbox success', [
            'project_id' => $projectId,
            'input_sandbox_id' => $sandboxID,
            'returned_sandbox_id' => $result->getDataValue('sandbox_id'),
        ]);

        return $result->getDataValue('sandbox_id');
    }

    /**
     * 获取沙箱状态
     *
     * @param string $sandboxId 沙箱ID
     * @return SandboxStatusResult 沙箱状态结果
     */
    public function getSandboxStatus(string $sandboxId): SandboxStatusResult
    {
        $this->logger->info('[Sandbox][App] Getting sandbox status', [
            'sandbox_id' => $sandboxId,
        ]);

        $result = $this->gateway->getSandboxStatus($sandboxId);

        if (! $result->isSuccess() && $result->getCode() !== ResponseCode::NOT_FOUND) {
            $this->logger->error('[Sandbox][App] Failed to get sandbox status', [
                'sandbox_id' => $sandboxId,
                'error' => $result->getMessage(),
                'code' => $result->getCode(),
            ]);
            // throw new SandboxOperationException('Get sandbox status', $result->getMessage(), $result->getCode());
        }

        $this->logger->info('[Sandbox][App] Sandbox status retrieved', [
            'sandbox_id' => $sandboxId,
            'status' => $result->getStatus(),
        ]);

        return $result;
    }

    /**
     * 批量获取沙箱状态
     *
     * @param array $sandboxIds 沙箱ID数组
     * @return BatchStatusResult 批量沙箱状态结果
     */
    public function getBatchSandboxStatus(array $sandboxIds): BatchStatusResult
    {
        $this->logger->info('[Sandbox][App] Getting batch sandbox status', [
            'sandbox_ids' => $sandboxIds,
            'count' => count($sandboxIds),
        ]);

        $result = $this->gateway->getBatchSandboxStatus($sandboxIds);

        if (! $result->isSuccess() && $result->getCode() !== ResponseCode::NOT_FOUND) {
            $this->logger->error('[Sandbox][App] Failed to get batch sandbox status', [
                'sandbox_ids' => $sandboxIds,
                'error' => $result->getMessage(),
                'code' => $result->getCode(),
            ]);
            throw new SandboxOperationException('Get batch sandbox status', $result->getMessage(), $result->getCode());
        }

        $this->logger->info('[Sandbox][App] Batch sandbox status retrieved', [
            'requested_count' => count($sandboxIds),
            'returned_count' => $result->getTotalCount(),
            'running_count' => $result->getRunningCount(),
        ]);

        return $result;
    }

    /**
     * @param ?string $projectOrganizationCode 项目所属组织编码，10月新增支持跨组织项目协作，所有文件都在项目组织下
     */
    public function initializeAgent(DataIsolation $dataIsolation, TaskContext $taskContext, ?string $memory = null, ?string $projectOrganizationCode = null): void
    {
        $this->logger->info('[Sandbox][App] Initializing agent', [
            'sandbox_id' => $taskContext->getSandboxId(),
            'memory_provided' => $memory !== null,
            'memory_length' => $memory ? strlen($memory) : 0,
            'project_organization_code' => $projectOrganizationCode,
        ]);

        // 1. 构建初始化信息
        $config = $this->generateInitializationInfo($dataIsolation, $taskContext, $memory, projectOrganizationCode: $projectOrganizationCode);

        // 2. 调用初始化接口
        $result = $this->agent->initAgent($taskContext->getSandboxId(), InitAgentRequest::fromArray($config));

        if (! $result->isSuccess()) {
            $this->logger->error('[Sandbox][App] Failed to initialize agent', [
                'sandbox_id' => $taskContext->getSandboxId(),
                'error' => $result->getMessage(),
                'code' => $result->getCode(),
            ]);
            throw new SandboxOperationException('Initialize agent', $result->getMessage(), $result->getCode());
        }
    }

    /**
     * 发送消息给 agent.
     */
    public function sendChatMessage(DataIsolation $dataIsolation, TaskContext $taskContext): void
    {
        $taskDynamicConfig = $taskContext->getDynamicConfig();

        // 添加任意注册到 DynamicConfigManager 的动态配置。暂时通过 TaskId 进行区分。
        $dynamicConfigs = $this->dynamicConfigManager->getByTaskId((string) $taskContext->getTask()->getId());
        foreach ($dynamicConfigs as $key => $dynamicConfig) {
            $taskDynamicConfig[$key] = $dynamicConfig;
        }

        $this->logger->info('[Sandbox][App] Sending chat message to agent', [
            'sandbox_id' => $taskContext->getSandboxId(),
            'task_id' => $taskContext->getTask()->getId(),
            'prompt' => $taskContext->getTask()->getPrompt(),
            'task_mode' => $taskContext->getTask()->getTaskMode(),
            'agent_mode' => $taskContext->getAgentMode(),
            'mentions' => $taskContext->getTask()->getMentions(),
            'mcp_config' => $taskContext->getMcpConfig(),
            'model_id' => $taskContext->getModelId(),
            'dynamic_config' => $taskDynamicConfig,
        ]);
        $mentionsJsonStruct = $this->buildMentionsJsonStruct($taskContext->getTask()->getMentions());

        // Get original prompt
        $userRequest = $taskContext->getTask()->getPrompt();

        // Check if web search should be disabled
        $extra = $taskContext->getExtra();
        if ($extra !== null && $extra->getEnableWebSearch() === false) {
            // Get language for translation
            $language = $taskContext->getDataIsolation()->getLanguage();
            $constraintText = trans('task.disable_web_search_constraint', [], $language);

            // Wrap user request in <user_request> tags and combine with constraint
            $prompt = $constraintText . "\n\n<user_request>\n" . $userRequest . "\n</user_request>";

            $this->logger->info('[Sandbox][App] Web search disabled, constraint text prepended to prompt', [
                'task_id' => $taskContext->getTask()->getId(),
                'language' => $language,
            ]);
        } else {
            // No constraint, use original prompt as is
            $prompt = $userRequest;
        }

        // 构建参数
        $chatMessage = ChatMessageRequest::create(
            messageId: $taskContext->getMessageId(),
            userId: $dataIsolation->getCurrentUserId(),
            taskId: (string) $taskContext->getTask()->getId(),
            prompt: $prompt,
            taskMode: $taskContext->getTask()->getTaskMode(),
            agentMode: $taskContext->getAgentMode(),
            mentions: $mentionsJsonStruct,
            mcpConfig: $taskContext->getMcpConfig(),
            modelId: $taskContext->getModelId(),
            dynamicConfig: $taskDynamicConfig,
        );

        $result = $this->agent->sendChatMessage($taskContext->getSandboxId(), $chatMessage);

        if (! $result->isSuccess()) {
            $this->logger->error('[Sandbox][App] Failed to send chat message to agent', [
                'sandbox_id' => $taskContext->getSandboxId(),
                'error' => $result->getMessage(),
                'code' => $result->getCode(),
            ]);
            throw new SandboxOperationException('Send chat message', $result->getMessage(), $result->getCode());
        }
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
        $this->logger->info('[Sandbox][App] Sending interrupt message to agent', [
            'sandbox_id' => $sandboxId,
            'task_id' => $taskId,
            'user_id' => $dataIsolation->getCurrentUserId(),
            'reason' => $reason,
        ]);

        // 发送中断消息
        $messageId = (string) IdGenerator::getSnowId();
        $interruptRequest = InterruptRequest::create(
            $messageId,
            $dataIsolation->getCurrentUserId(),
            $taskId,
            $reason,
        );

        $response = $this->agent->sendInterruptMessage($sandboxId, $interruptRequest);

        if (! $response->isSuccess()) {
            $this->logger->error('[Sandbox][App] Failed to send interrupt message to agent', [
                'sandbox_id' => $sandboxId,
                'task_id' => $taskId,
                'user_id' => $dataIsolation->getCurrentUserId(),
                'reason' => $reason,
                'error' => $response->getMessage(),
                'code' => $response->getCode(),
            ]);
            throw new SandboxOperationException('Send interrupt message', $response->getMessage(), $response->getCode());
        }

        $this->logger->info('[Sandbox][App] Interrupt message sent to agent successfully', [
            'sandbox_id' => $sandboxId,
            'task_id' => $taskId,
            'user_id' => $dataIsolation->getCurrentUserId(),
            'reason' => $reason,
        ]);

        return $response;
    }

    /**
     * 获取工作区状态.
     *
     * @param string $sandboxId 沙箱ID
     * @return AgentResponse 工作区状态响应
     */
    public function getWorkspaceStatus(string $sandboxId): AgentResponse
    {
        $this->logger->debug('[Sandbox][App] Getting workspace status', [
            'sandbox_id' => $sandboxId,
        ]);

        $result = $this->agent->getWorkspaceStatus($sandboxId);

        if (! $result->isSuccess()) {
            $this->logger->error('[Sandbox][App] Failed to get workspace status', [
                'sandbox_id' => $sandboxId,
                'error' => $result->getMessage(),
                'code' => $result->getCode(),
            ]);
            throw new SandboxOperationException('Get workspace status', $result->getMessage(), $result->getCode());
        }

        $this->logger->debug('[Sandbox][App] Workspace status retrieved', [
            'sandbox_id' => $sandboxId,
            'status' => $result->getDataValue('status'),
        ]);

        return $result;
    }

    /**
     * 等待工作区就绪.
     * 轮询工作区状态，直到初始化完成、失败或超时.
     *
     * @param string $sandboxId 沙箱ID
     * @param int $timeoutSeconds 超时时间（秒），默认2分钟
     * @param int $intervalSeconds 轮询间隔（秒），默认2秒
     * @throws SandboxOperationException 当初始化失败或超时时抛出异常
     */
    public function waitForSandboxReady(string $sandboxId, int $timeoutSeconds = 120, int $intervalSeconds = 2): void
    {
        $this->logger->info('[Sandbox][App] Waiting for Sandbox to be ready', [
            'sandbox_id' => $sandboxId,
            'timeout_seconds' => $timeoutSeconds,
            'interval_seconds' => $intervalSeconds,
        ]);

        $startTime = time();
        $endTime = $startTime + $timeoutSeconds;

        while (time() < $endTime) {
            try {
                $response = $this->getSandboxStatus($sandboxId);
                $status = $response->getStatus();

                $this->logger->debug('[Sandbox][App] Sandbox status check', [
                    'sandbox_id' => $sandboxId,
                    'status' => $status,
                    'elapsed_seconds' => time() - $startTime,
                ]);

                // 状态为就绪时退出
                if ($status === SandboxStatus::RUNNING) {
                    $this->logger->info('[Sandbox][App] Sandbox is ready', [
                        'sandbox_id' => $sandboxId,
                        'elapsed_seconds' => time() - $startTime,
                    ]);
                    return;
                }

                // 等待下一次轮询
                sleep($intervalSeconds);
            } catch (SandboxOperationException $e) {
                // 重新抛出沙箱操作异常
                throw $e;
            } catch (Throwable $e) {
                $this->logger->error('[Sandbox][App] Error while checking sandbox status', [
                    'sandbox_id' => $sandboxId,
                    'error' => $e->getMessage(),
                    'elapsed_seconds' => time() - $startTime,
                ]);
                throw new SandboxOperationException('Wait for sandbox ready', 'Error checking sandbox status: ' . $e->getMessage(), 3002);
            }
        }
    }

    /**
     * 等待工作区就绪.
     * 轮询工作区状态，直到初始化完成、失败或超时.
     *
     * @param string $sandboxId 沙箱ID
     * @param int $timeoutSeconds 超时时间（秒），默认5分钟
     * @param float $intervalSeconds 轮询间隔（秒），默认500ms
     * @throws SandboxOperationException 当初始化失败或超时时抛出异常
     */
    public function waitForWorkspaceReady(string $sandboxId, int $timeoutSeconds = 300, float $intervalSeconds = 0.5): void
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
                usleep((int) ($intervalSeconds * 1000000)); // 转换为微秒
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
     * 回滚到指定的checkpoint.
     *
     * @param string $sandboxId 沙箱ID
     * @param string $targetMessageId 目标消息ID
     * @return AgentResponse 回滚响应
     */
    public function rollbackCheckpoint(string $sandboxId, string $targetMessageId): AgentResponse
    {
        $this->logger->info('[Sandbox][Domain] Rolling back to checkpoint', [
            'sandbox_id' => $sandboxId,
            'target_message_id' => $targetMessageId,
        ]);

        try {
            $request = CheckpointRollbackRequest::create($targetMessageId);
            $response = $this->agent->rollbackCheckpoint($sandboxId, $request);

            if ($response->isSuccess()) {
                $this->logger->info('[Sandbox][Domain] Checkpoint rollback successful', [
                    'sandbox_id' => $sandboxId,
                    'target_message_id' => $targetMessageId,
                    'message' => $response->getMessage(),
                ]);
            } else {
                $this->logger->error('[Sandbox][Domain] Checkpoint rollback failed', [
                    'sandbox_id' => $sandboxId,
                    'target_message_id' => $targetMessageId,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][Domain] Unexpected error during checkpoint rollback', [
                'sandbox_id' => $sandboxId,
                'target_message_id' => $targetMessageId,
                'error' => $e->getMessage(),
            ]);
            throw new SandboxOperationException('Rollback checkpoint', 'Checkpoint rollback failed: ' . $e->getMessage(), 3004);
        }
    }

    /**
     * 开始回滚到指定的checkpoint（调用沙箱网关）.
     *
     * @param string $sandboxId 沙箱ID
     * @param string $targetMessageId 目标消息ID
     * @return AgentResponse 回滚响应
     */
    public function rollbackCheckpointStart(string $sandboxId, string $targetMessageId): AgentResponse
    {
        $this->logger->info('[Sandbox][Domain] Starting checkpoint rollback', [
            'sandbox_id' => $sandboxId,
            'target_message_id' => $targetMessageId,
        ]);

        try {
            $request = CheckpointRollbackStartRequest::create($targetMessageId);
            $response = $this->agent->rollbackCheckpointStart($sandboxId, $request);

            if ($response->isSuccess()) {
                $this->logger->info('[Sandbox][Domain] Checkpoint rollback start successful', [
                    'sandbox_id' => $sandboxId,
                    'target_message_id' => $targetMessageId,
                    'message' => $response->getMessage(),
                ]);
            } else {
                $this->logger->error('[Sandbox][Domain] Checkpoint rollback start failed', [
                    'sandbox_id' => $sandboxId,
                    'target_message_id' => $targetMessageId,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][Domain] Unexpected error during checkpoint rollback start', [
                'sandbox_id' => $sandboxId,
                'target_message_id' => $targetMessageId,
                'error' => $e->getMessage(),
            ]);
            throw new SandboxOperationException('Rollback checkpoint start', 'Checkpoint rollback start failed: ' . $e->getMessage(), 3005);
        }
    }

    /**
     * 提交回滚到指定的checkpoint（调用沙箱网关）.
     *
     * @param string $sandboxId 沙箱ID
     * @return AgentResponse 回滚响应
     */
    public function rollbackCheckpointCommit(string $sandboxId): AgentResponse
    {
        $this->logger->info('[Sandbox][Domain] Committing checkpoint rollback', [
            'sandbox_id' => $sandboxId,
        ]);

        try {
            $request = CheckpointRollbackCommitRequest::create();
            $response = $this->agent->rollbackCheckpointCommit($sandboxId, $request);

            if ($response->isSuccess()) {
                $this->logger->info('[Sandbox][Domain] Checkpoint rollback commit successful', [
                    'sandbox_id' => $sandboxId,
                    'message' => $response->getMessage(),
                ]);
            } else {
                $this->logger->error('[Sandbox][Domain] Checkpoint rollback commit failed', [
                    'sandbox_id' => $sandboxId,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][Domain] Unexpected error during checkpoint rollback commit', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);
            throw new SandboxOperationException('Rollback checkpoint commit', 'Checkpoint rollback commit failed: ' . $e->getMessage(), 3006);
        }
    }

    /**
     * 撤销回滚沙箱checkpoint（调用沙箱网关）.
     *
     * @param string $sandboxId 沙箱ID
     * @return AgentResponse 回滚响应
     */
    public function rollbackCheckpointUndo(string $sandboxId): AgentResponse
    {
        $this->logger->info('[Sandbox][Domain] Undoing checkpoint rollback', [
            'sandbox_id' => $sandboxId,
        ]);

        try {
            $request = CheckpointRollbackUndoRequest::create();
            $response = $this->agent->rollbackCheckpointUndo($sandboxId, $request);

            if ($response->isSuccess()) {
                $this->logger->info('[Sandbox][Domain] Checkpoint rollback undo successful', [
                    'sandbox_id' => $sandboxId,
                    'message' => $response->getMessage(),
                ]);
            } else {
                $this->logger->error('[Sandbox][Domain] Checkpoint rollback undo failed', [
                    'sandbox_id' => $sandboxId,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][Domain] Unexpected error during checkpoint rollback undo', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);
            throw new SandboxOperationException('Rollback checkpoint undo', 'Checkpoint rollback undo failed: ' . $e->getMessage(), 3007);
        }
    }

    /**
     * 检查回滚到指定checkpoint的可行性.
     *
     * @param string $sandboxId 沙箱ID
     * @param string $targetMessageId 目标消息ID
     * @return AgentResponse 检查响应
     */
    public function rollbackCheckpointCheck(string $sandboxId, string $targetMessageId): AgentResponse
    {
        $this->logger->info('[Sandbox][Domain] Checking checkpoint rollback feasibility', [
            'sandbox_id' => $sandboxId,
            'target_message_id' => $targetMessageId,
        ]);

        try {
            $request = CheckpointRollbackCheckRequest::create($targetMessageId);
            $response = $this->agent->rollbackCheckpointCheck($sandboxId, $request);

            if ($response->isSuccess()) {
                $this->logger->info('[Sandbox][Domain] Checkpoint rollback check completed', [
                    'sandbox_id' => $sandboxId,
                    'target_message_id' => $targetMessageId,
                    'can_rollback' => $response->getDataValue('can_rollback'),
                ]);
            } else {
                $this->logger->warning('[Sandbox][Domain] Checkpoint rollback check failed', [
                    'sandbox_id' => $sandboxId,
                    'target_message_id' => $targetMessageId,
                    'error' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][Domain] Unexpected error during checkpoint rollback check', [
                'sandbox_id' => $sandboxId,
                'target_message_id' => $targetMessageId,
                'error' => $e->getMessage(),
            ]);
            throw new SandboxOperationException('Rollback checkpoint check', 'Checkpoint rollback check failed: ' . $e->getMessage(), 3008);
        }
    }

    /**
     * 升级沙箱镜像.
     *
     * @param string $messageId 消息ID
     * @param string $contextType 上下文类型，默认为continue
     * @return AgentResponse 升级响应结果
     * @throws SandboxOperationException 当升级失败时抛出异常
     */
    public function upgradeSandbox(string $messageId, string $contextType = 'continue'): AgentResponse
    {
        $this->logger->info('[Sandbox][Domain] Upgrading sandbox image', [
            'message_id' => $messageId,
            'context_type' => $contextType,
        ]);

        try {
            // 调用网关服务进行升级
            $result = $this->gateway->upgradeSandbox($messageId, $contextType);

            if (! $result->isSuccess()) {
                $this->logger->error('[Sandbox][Domain] Failed to upgrade sandbox', [
                    'message_id' => $messageId,
                    'context_type' => $contextType,
                    'error' => $result->getMessage(),
                    'code' => $result->getCode(),
                ]);
                throw new SandboxOperationException('Upgrade sandbox', $result->getMessage(), $result->getCode());
            }

            $this->logger->info('[Sandbox][Domain] Sandbox upgraded successfully', [
                'message_id' => $messageId,
                'context_type' => $contextType,
            ]);

            // 将GatewayResult转换为AgentResponse
            return AgentResponse::fromGatewayResult($result);
        } catch (SandboxOperationException $e) {
            // 重新抛出沙箱操作异常
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][Domain] Unexpected error during sandbox upgrade', [
                'message_id' => $messageId,
                'context_type' => $contextType,
                'error' => $e->getMessage(),
            ]);
            throw new SandboxOperationException('Upgrade sandbox', 'Sandbox upgrade failed: ' . $e->getMessage(), 3009);
        }
    }

    /**
     * 构建初始化消息.
     *
     * @param ?string $projectOrganizationCode 项目所属组织编码，10月新增支持跨组织项目协作，所有文件都在项目组织下
     */
    private function generateInitializationInfo(DataIsolation $dataIsolation, TaskContext $taskContext, ?string $memory = null, ?string $projectOrganizationCode = null): array
    {
        // 1. 获取上传配置信息
        $storageType = StorageBucketType::SandBox->value;
        $expires = 3600; // Credential valid for 1 hour
        // Create user authorization object
        $userAuthorization = new MagicUserAuthorization();
        $userAuthorization->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        // Use unified FileAppService to get STS Token
        $projectDir = WorkDirectoryUtil::getRootDir($dataIsolation->getCurrentUserId(), $taskContext->getTask()->getProjectId());

        $stsConfig = $this->fileAppService->getStsTemporaryCredentialV2($projectOrganizationCode, $storageType, $projectDir, $expires, false);
        // 2. 构建元数据
        $userInfoArray = $this->userInfoAppService->getUserInfo($dataIsolation->getCurrentUserId(), $dataIsolation);
        $userInfo = UserInfoValueObject::fromArray($userInfoArray);
        $this->logger->info('[Sandbox][App] Language generateInitializationInfo', [
            'language' => $dataIsolation->getLanguage(),
        ]);
        $messageMetadata = new MessageMetadata(
            $taskContext->getAgentUserId(),
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode(),
            $taskContext->getChatConversationId(),
            $taskContext->getChatTopicId(),
            (string) $taskContext->getTopicId(),
            $taskContext->getInstruction()->value,
            $taskContext->getSandboxId(),
            (string) $taskContext->getTask()->getId(),
            $taskContext->getWorkspaceId(),
            (string) $taskContext->getTask()->getProjectId(),
            $dataIsolation->getLanguage() ?? '',
            $userInfo,
        );

        // chat history
        $fullPrefix = $this->cloudFileRepository->getFullPrefix($projectOrganizationCode);
        $chatWorkDir = WorkDirectoryUtil::getAgentChatHistoryDir($dataIsolation->getCurrentUserId(), $taskContext->getProjectId());
        $fullChatWorkDir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $chatWorkDir);
        $fullWorkDir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $taskContext->getTask()->getWorkDir());

        return [
            'message_id' => (string) IdGenerator::getSnowId(),
            'user_id' => $dataIsolation->getCurrentUserId(),
            'project_id' => (string) $taskContext->getTask()->getProjectId(),
            'type' => MessageType::Init->value,
            'upload_config' => $stsConfig,
            'message_subscription_config' => [
                'method' => 'POST',
                'url' => config('super-magic.sandbox.callback_host', '') . '/api/v1/super-agent/tasks/deliver-message',
                'headers' => [
                    'token' => config('super-magic.sandbox.token', ''),
                ],
            ],
            'sts_token_refresh' => [
                'method' => 'POST',
                'url' => config('super-magic.sandbox.callback_host', '') . '/api/v1/super-agent/file/refresh-sts-token',
                'headers' => [
                    'token' => config('super-magic.sandbox.token', ''),
                ],
            ],
            'metadata' => $messageMetadata->toArray(),
            'task_mode' => $taskContext->getTask()->getTaskMode(),
            'agent_mode' => $taskContext->getAgentMode(),
            'magic_service_host' => config('super-magic.sandbox.callback_host', ''),
            'memory' => $memory,
            'chat_history_dir' => $fullChatWorkDir,
            'work_dir' => $fullWorkDir,
            'model_id' => $taskContext->getModelId(),
            'fetch_history' => ! $taskContext->getIsFirstTask(),
        ];
    }

    /**
     * @param null|string $mentionsJson mentions 的 JSON 字符串
     * @return array 处理后的 mentions 数组
     */
    private function buildMentionsJsonStruct(?string $mentionsJson): array
    {
        if ($mentionsJson && json_validate($mentionsJson)) {
            $mentions = (array) Json::decode($mentionsJson);
        } else {
            $mentions = [];
        }

        if (empty($mentionsJson) || empty($mentions)) {
            return $mentions;
        }
        return $mentions;
    }
}

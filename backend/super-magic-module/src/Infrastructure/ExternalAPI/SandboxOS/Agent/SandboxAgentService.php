<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AbstractSandboxOS;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\ChatMessageRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\CheckpointRollbackCommitRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\CheckpointRollbackRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\CheckpointRollbackStartRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\CheckpointRollbackUndoRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\InitAgentRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\InterruptRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\SaveFilesRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\ScriptTaskRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Response\AgentResponse;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Exception;
use Hyperf\Logger\LoggerFactory;

/**
 * 沙箱Agent服务实现
 * 通过Gateway转发机制与Agent通信
 */
class SandboxAgentService extends AbstractSandboxOS implements SandboxAgentInterface
{
    public function __construct(
        LoggerFactory $loggerFactory,
        private SandboxGatewayInterface $gateway
    ) {
        parent::__construct($loggerFactory);
    }

    /**
     * 初始化Agent.
     */
    public function initAgent(string $sandboxId, InitAgentRequest $request): AgentResponse
    {
        $this->logger->info('[Sandbox][Agent] Initializing agent', [
            'sandbox_id' => $sandboxId,
            'user_id' => $request->getUserId(),
            'task_mode' => $request->getTaskMode(),
            'agent_mode' => $request->getAgentMode(),
        ]);

        try {
            // 通过Gateway转发到Agent API - 根据文档使用统一的 /api/v1/messages/chat 端点
            $result = $this->gateway->proxySandboxRequest(
                $sandboxId,
                'POST',
                'api/v1/messages/chat',
                $request->toArray()
            );

            $response = AgentResponse::fromGatewayResult($result);

            if ($response->isSuccess()) {
                $this->logger->info('[Sandbox][Agent] Agent initialized successfully', [
                    'sandbox_id' => $sandboxId,
                    'agent_id' => $response->getAgentId(),
                ]);
            } else {
                $this->logger->error('[Sandbox][Agent] Failed to initialize agent', [
                    'sandbox_id' => $sandboxId,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Exception $e) {
            $this->logger->error('[Sandbox][Agent] Unexpected error when initializing agent', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return AgentResponse::fromApiResponse([
                'code' => 2000,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => [],
            ]);
        }
    }

    /**
     * 发送聊天消息给Agent.
     */
    public function sendChatMessage(string $sandboxId, ChatMessageRequest $request): AgentResponse
    {
        $this->logger->debug('[Sandbox][Agent] Sending chat message to agent', [
            'sandbox_id' => $sandboxId,
            'user_id' => $request->getUserId(),
            'task_id' => $request->getTaskId(),
            'prompt_length' => strlen($request->getPrompt()),
        ]);

        try {
            // 通过Gateway转发到Agent API - 根据文档使用统一的 /api/v1/messages/chat 端点
            $result = $this->gateway->proxySandboxRequest(
                $sandboxId,
                'POST',
                'api/v1/messages/chat',
                $request->toArray()
            );

            $response = AgentResponse::fromGatewayResult($result);

            $this->logger->debug('[Sandbox][Agent] Chat message sent to agent', [
                'sandbox_id' => $sandboxId,
                'success' => $response->isSuccess(),
                'message_id' => $response->getMessageId(),
                'has_response' => $response->hasResponseMessage(),
            ]);

            return $response;
        } catch (Exception $e) {
            $this->logger->error('[Sandbox][Agent] Unexpected error when sending chat message', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);

            return AgentResponse::fromApiResponse([
                'code' => 2000,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => [],
            ]);
        }
    }

    /**
     * 发送中断消息给Agent.
     */
    public function sendInterruptMessage(string $sandboxId, InterruptRequest $request): AgentResponse
    {
        $this->logger->info('[Sandbox][Agent] Sending interrupt message to agent', [
            'sandbox_id' => $sandboxId,
            'user_id' => $request->getUserId(),
            'task_id' => $request->getTaskId(),
            'remark' => $request->getRemark(),
        ]);

        try {
            // 通过Gateway转发到Agent API - 根据文档使用统一的 /api/v1/messages/chat 端点
            $result = $this->gateway->proxySandboxRequest(
                $sandboxId,
                'POST',
                'api/v1/messages/chat',
                $request->toArray()
            );

            $response = AgentResponse::fromGatewayResult($result);

            if ($response->isSuccess()) {
                $this->logger->info('[Sandbox][Agent] Interrupt message sent successfully', [
                    'sandbox_id' => $sandboxId,
                    'user_id' => $request->getUserId(),
                    'task_id' => $request->getTaskId(),
                ]);
            } else {
                $this->logger->error('[Sandbox][Agent] Failed to send interrupt message', [
                    'sandbox_id' => $sandboxId,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Exception $e) {
            $this->logger->error('[Sandbox][Agent] Unexpected error when sending interrupt message', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);

            return AgentResponse::fromApiResponse([
                'code' => 2000,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => [],
            ]);
        }
    }

    /**
     * 获取工作区状态.
     */
    public function getWorkspaceStatus(string $sandboxId): AgentResponse
    {
        $this->logger->debug('[Sandbox][Agent] Getting workspace status', [
            'sandbox_id' => $sandboxId,
        ]);

        try {
            // 通过Gateway转发到Agent API - 获取工作区状态
            $result = $this->gateway->proxySandboxRequest(
                $sandboxId,
                'GET',
                'api/v1/workspace/status',
                []
            );

            $response = AgentResponse::fromGatewayResult($result);

            $this->logger->debug('[Sandbox][Agent] Workspace status retrieved', [
                'sandbox_id' => $sandboxId,
                'success' => $response->isSuccess(),
                'status' => $response->getDataValue('status'),
            ]);

            return $response;
        } catch (Exception $e) {
            $this->logger->error('[Sandbox][Agent] Unexpected error when getting workspace status', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);

            return AgentResponse::fromApiResponse([
                'code' => 2000,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => [],
            ]);
        }
    }

    /**
     * 保存文件到沙箱.
     */
    public function saveFiles(string $sandboxId, SaveFilesRequest $request): AgentResponse
    {
        $this->logger->info('[Sandbox][Agent] Saving files to sandbox', [
            'sandbox_id' => $sandboxId,
            'file_count' => $request->getFileCount(),
        ]);

        try {
            // 通过Gateway转发到沙箱的文件编辑API
            $result = $this->gateway->proxySandboxRequest(
                $sandboxId,
                'POST',
                'api/v1/files/save',
                $request->toArray()
            );

            $response = AgentResponse::fromGatewayResult($result);

            if ($response->isSuccess()) {
                $this->logger->info('[Sandbox][Agent] Files saved successfully', [
                    'sandbox_id' => $sandboxId,
                    'file_count' => $request->getFileCount(),
                ]);
            } else {
                $this->logger->error('[Sandbox][Agent] Failed to save files', [
                    'sandbox_id' => $sandboxId,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Exception $e) {
            $this->logger->error('[Sandbox][Agent] Unexpected error when saving files', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);

            return AgentResponse::fromApiResponse([
                'code' => 2000,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => [],
            ]);
        }
    }

    public function executeScriptTask(string $sandboxId, ScriptTaskRequest $request): AgentResponse
    {
        $this->logger->info('[Sandbox][Agent] Executing script task', [
            'sandbox_id' => $sandboxId,
            'task_id' => $request->getTaskId(),
        ]);

        try {
            // 通过Gateway转发到沙箱的文件编辑API
            $result = $this->gateway->proxySandboxRequest(
                $sandboxId,
                'POST',
                '/api/task/script-task',
                $request->toArray()
            );

            $response = AgentResponse::fromGatewayResult($result);

            if ($response->isSuccess()) {
                $this->logger->info('[Sandbox][Agent] Files saved successfully', [
                    'sandbox_id' => $sandboxId,
                    'script_name' => $request->getScriptName(),
                    'arguments' => $request->getArguments(),
                ]);
            } else {
                $this->logger->error('[Sandbox][Agent] Failed to save files', [
                    'sandbox_id' => $sandboxId,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Exception $e) {
            $this->logger->error('[Sandbox][Agent] Unexpected error when executing script task', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);

            return AgentResponse::fromApiResponse([
                'code' => 2000,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => [],
            ]);
        }
    }

    /**
     * 回滚到指定的checkpoint.
     */
    public function rollbackCheckpoint(string $sandboxId, CheckpointRollbackRequest $request): AgentResponse
    {
        $this->logger->info('[Sandbox][Agent] Rolling back to checkpoint', [
            'sandbox_id' => $sandboxId,
            'target_message_id' => $request->getTargetMessageId(),
        ]);

        try {
            // 通过Gateway转发到沙箱的checkpoint回滚API
            $result = $this->gateway->proxySandboxRequest(
                $sandboxId,
                'POST',
                'api/checkpoints/rollback',
                $request->toArray()
            );

            $response = AgentResponse::fromGatewayResult($result);

            if ($response->isSuccess()) {
                $this->logger->info('[Sandbox][Agent] Checkpoint rollback successful', [
                    'sandbox_id' => $sandboxId,
                    'target_message_id' => $request->getTargetMessageId(),
                    'message' => $response->getMessage(),
                ]);
            } else {
                $this->logger->error('[Sandbox][Agent] Failed to rollback checkpoint', [
                    'sandbox_id' => $sandboxId,
                    'target_message_id' => $request->getTargetMessageId(),
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Exception $e) {
            $this->logger->error('[Sandbox][Agent] Unexpected error when rolling back checkpoint', [
                'sandbox_id' => $sandboxId,
                'target_message_id' => $request->getTargetMessageId(),
                'error' => $e->getMessage(),
            ]);

            return AgentResponse::fromApiResponse([
                'code' => 2000,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => [],
            ]);
        }
    }

    /**
     * 开始回滚到指定的checkpoint（标记状态而非删除）.
     */
    public function rollbackCheckpointStart(string $sandboxId, CheckpointRollbackStartRequest $request): AgentResponse
    {
        $this->logger->info('[Sandbox][Agent] Starting checkpoint rollback', [
            'sandbox_id' => $sandboxId,
            'target_message_id' => $request->getTargetMessageId(),
        ]);

        try {
            // 通过Gateway转发到沙箱的checkpoint回滚开始API
            $result = $this->gateway->proxySandboxRequest(
                $sandboxId,
                'POST',
                'api/checkpoints/rollback/start',
                $request->toArray()
            );

            $response = AgentResponse::fromGatewayResult($result);

            if ($response->isSuccess()) {
                $this->logger->info('[Sandbox][Agent] Checkpoint rollback start successful', [
                    'sandbox_id' => $sandboxId,
                    'target_message_id' => $request->getTargetMessageId(),
                    'message' => $response->getMessage(),
                ]);
            } else {
                $this->logger->error('[Sandbox][Agent] Failed to start checkpoint rollback', [
                    'sandbox_id' => $sandboxId,
                    'target_message_id' => $request->getTargetMessageId(),
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Exception $e) {
            $this->logger->error('[Sandbox][Agent] Unexpected error when starting checkpoint rollback', [
                'sandbox_id' => $sandboxId,
                'target_message_id' => $request->getTargetMessageId(),
                'error' => $e->getMessage(),
            ]);

            return AgentResponse::fromApiResponse([
                'code' => 2000,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => [],
            ]);
        }
    }

    /**
     * 提交回滚到指定的checkpoint（物理删除撤回状态的消息）.
     */
    public function rollbackCheckpointCommit(string $sandboxId, CheckpointRollbackCommitRequest $request): AgentResponse
    {
        $this->logger->info('[Sandbox][Agent] Committing checkpoint rollback', [
            'sandbox_id' => $sandboxId,
        ]);

        try {
            // 通过Gateway转发到沙箱的checkpoint回滚提交API
            $result = $this->gateway->proxySandboxRequest(
                $sandboxId,
                'POST',
                'api/checkpoints/rollback/commit',
                $request->toArray()
            );

            $response = AgentResponse::fromGatewayResult($result);

            if ($response->isSuccess()) {
                $this->logger->info('[Sandbox][Agent] Checkpoint rollback commit successful', [
                    'sandbox_id' => $sandboxId,
                    'message' => $response->getMessage(),
                ]);
            } else {
                $this->logger->error('[Sandbox][Agent] Failed to commit checkpoint rollback', [
                    'sandbox_id' => $sandboxId,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Exception $e) {
            $this->logger->error('[Sandbox][Agent] Unexpected error when committing checkpoint rollback', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);

            return AgentResponse::fromApiResponse([
                'code' => 2000,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => [],
            ]);
        }
    }

    /**
     * 撤销回滚沙箱checkpoint（将撤回状态的消息恢复为正常状态）.
     */
    public function rollbackCheckpointUndo(string $sandboxId, CheckpointRollbackUndoRequest $request): AgentResponse
    {
        $this->logger->info('[Sandbox][Agent] Undoing checkpoint rollback', [
            'sandbox_id' => $sandboxId,
        ]);

        try {
            // 通过Gateway转发到沙箱的checkpoint回滚撤销API
            $result = $this->gateway->proxySandboxRequest(
                $sandboxId,
                'POST',
                'api/checkpoints/rollback/undo',
                $request->toArray()
            );

            $response = AgentResponse::fromGatewayResult($result);

            if ($response->isSuccess()) {
                $this->logger->info('[Sandbox][Agent] Checkpoint rollback undo successful', [
                    'sandbox_id' => $sandboxId,
                    'message' => $response->getMessage(),
                ]);
            } else {
                $this->logger->error('[Sandbox][Agent] Failed to undo checkpoint rollback', [
                    'sandbox_id' => $sandboxId,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Exception $e) {
            $this->logger->error('[Sandbox][Agent] Unexpected error when undoing checkpoint rollback', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);

            return AgentResponse::fromApiResponse([
                'code' => 2000,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => [],
            ]);
        }
    }
}

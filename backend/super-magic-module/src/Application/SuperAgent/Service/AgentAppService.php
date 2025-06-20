<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\SandboxAgentInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\InitAgentRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\ChatMessageRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\InterruptRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Response\AgentResponse;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;

/**
 * Agent消息应用服务
 * 提供高级Agent通信功能，包括自动初始化和状态管理
 */
class AgentMessageAppService
{
    private LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory,
        private SandboxGatewayInterface $gateway,
        private SandboxAgentInterface $agent
    ) {
        $this->logger = $loggerFactory->get('sandbox');
    }

    /**
     * 发送聊天消息给Agent
     * 如果Agent未初始化，会自动初始化
     * 
     * @param string $sandboxId 沙箱ID
     * @param string $message 消息内容
     * @param string|null $sessionId 会话ID
     * @param array $metadata 元数据
     * @return AgentResponse Agent响应
     */
    public function sendChatMessage(
        string $sandboxId,
        string $message,
        ?string $sessionId = null,
        array $metadata = []
    ): AgentResponse {
        $this->logger->info('[Sandbox][App] Sending chat message to agent', [
            'sandbox_id' => $sandboxId,
            'session_id' => $sessionId,
            'message_length' => strlen($message)
        ]);

        try {
            // 1. 创建沙箱
            $this->createSandbox($sandboxId);

            // 2. 发送初始化信息

            // 2. 尝试初始化Agent（如果需要）
            $initResult = $this->ensureAgentInitialized($sandboxId);
            if (!$initResult->isSuccess()) {
                $this->logger->error('[Sandbox][App] Failed to initialize agent for chat', [
                    'sandbox_id' => $sandboxId,
                    'init_message' => $initResult->getMessage()
                ]);

                return $initResult;
            }

            // 3. 发送聊天消息
            $messageId = (string) \App\Infrastructure\Util\IdGenerator\IdGenerator::getSnowId();
            $chatRequest = ChatMessageRequest::create(
                $messageId,
                $metadata['user_id'] ?? '',
                $metadata['task_id'] ?? '',
                $message,
                $metadata['task_mode'] ?? 'chat',
                $metadata['attachments'] ?? []
            );
            $response = $this->agent->sendChatMessage($sandboxId, $chatRequest);

            $this->logger->info('[Sandbox][App] Chat message sent to agent', [
                'sandbox_id' => $sandboxId,
                'success' => $response->isSuccess(),
                'message_id' => $response->getMessageId(),
                'response_length' => strlen($response->getResponseMessage() ?? '')
            ]);

            return $response;
        } catch (\Exception $e) {
            $this->logger->error('[Sandbox][App] Unexpected error when sending chat message', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return AgentResponse::fromApiResponse([
                'code' => 2000,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => []
            ]);
        }
    }

    /**
     * 发送中断消息给Agent
     * 
     * @param string $sandboxId 沙箱ID
     * @param string $reason 中断原因
     * @param bool $forceStop 是否强制停止
     * @return AgentResponse 中断响应
     */
    public function sendInterruptMessage(
        string $sandboxId,
        string $reason = 'User interrupt',
        bool $forceStop = false
    ): AgentResponse {
        $this->logger->info('[Sandbox][App] Sending interrupt message to agent', [
            'sandbox_id' => $sandboxId,
            'reason' => $reason,
            'force_stop' => $forceStop
        ]);

        try {
            // 检查沙箱状态
            $statusResult = $this->gateway->getSandboxStatus($sandboxId);
            if (!$statusResult->isSuccess()) {
                $this->logger->warning('[Sandbox][App] Cannot check sandbox status for interrupt', [
                    'sandbox_id' => $sandboxId,
                    'status_message' => $statusResult->getMessage()
                ]);
                // 即使状态检查失败，也尝试发送中断消息
            }

            // 发送中断消息
            $messageId = (string) \App\Infrastructure\Util\IdGenerator\IdGenerator::getSnowId();
            $interruptRequest = InterruptRequest::create(
                $messageId,
                '', // TODO: 从上下文获取用户ID
                ''  // TODO: 从上下文获取任务ID
            );
            $response = $this->agent->sendInterruptMessage($sandboxId, $interruptRequest);

            $this->logger->info('[Sandbox][App] Interrupt message sent to agent', [
                'sandbox_id' => $sandboxId,
                'success' => $response->isSuccess(),
                'reason' => $reason
            ]);

            return $response;
        } catch (\Exception $e) {
            $this->logger->error('[Sandbox][App] Unexpected error when sending interrupt message', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage()
            ]);

            return AgentResponse::fromApiResponse([
                'code' => 2000,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => []
            ]);
        }
    }

    /**
     * 调用沙箱网关，创建沙箱容器，如果 sandboxId 不存在，系统会默认创建一个
     * @param string $sandboxID
     * @return string
     */
    private function createSandbox(string $sandboxID): string
    {
        // 创建沙箱
        $result = $this->gateway->createSandbox(['sandbox_id' => $sandboxID]);

        if (!$result->isSuccess()) {
            $this->logger->error('[Sandbox][App] Failed to create sandbox', [
                'sandbox_id' => $sandboxID,
                'error' => $result->getMessage()
            ]);
            throw new RuntimeException(
                sprintf('Failed to create sandbox: %s', $result->getMessage()),
                $result->getCode()
            );
        }
        return $result->getData()['sandbox_id'];
    }

    /**
     * 确保Agent已初始化
     * 
     * @param string $sandboxId 沙箱ID
     * @return AgentResponse 初始化结果
     */
    private function ensureAgentInitialized(string $sandboxId): AgentResponse
    {
        $this->logger->debug('[Sandbox][App] Ensuring agent is initialized', [
            'sandbox_id' => $sandboxId
        ]);

        try {
            // 创建默认初始化请求
            $messageId = (string) \App\Infrastructure\Util\IdGenerator\IdGenerator::getSnowId();
            $initRequest = InitAgentRequest::create(
                $messageId,
                '', // TODO: 从上下文获取用户ID
                [], // upload_config
                [], // message_subscription_config
                [], // sts_token_refresh
                [], // metadata
                'plan' // task_mode
            );
            
            // 尝试初始化Agent
            $response = $this->agent->initAgent($sandboxId, $initRequest);

            if ($response->isSuccess()) {
                $this->logger->debug('[Sandbox][App] Agent initialized successfully', [
                    'sandbox_id' => $sandboxId,
                    'agent_id' => $response->getAgentId()
                ]);
            } else {
                $this->logger->warning('[Sandbox][App] Agent initialization may have failed', [
                    'sandbox_id' => $sandboxId,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage()
                ]);
                // 注意：某些情况下Agent可能已经初始化，初始化失败不一定是致命错误
                // 这里可以根据具体错误码判断是否继续
            }

            return $response;
        } catch (\Exception $e) {
            $this->logger->error('[Sandbox][App] Unexpected error when ensuring agent initialization', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage()
            ]);

            return AgentResponse::fromApiResponse([
                'code' => 2000,
                'message' => 'Agent initialization error: ' . $e->getMessage(),
                'data' => []
            ]);
        }
    }

    /**
     * 创建新沙箱并初始化Agent
     * 
     * @param array $sandboxConfig 沙箱配置
     * @param array $agentConfig Agent配置
     * @return array 包含沙箱ID和初始化结果
     */
    public function createSandboxWithAgent(
        array $sandboxConfig = [],
        array $agentConfig = []
    ): array {
        $this->logger->info('[Sandbox][App] Creating sandbox with agent', [
            'has_sandbox_config' => !empty($sandboxConfig),
            'has_agent_config' => !empty($agentConfig)
        ]);

        try {
            // 1. 创建沙箱
            $createResult = $this->gateway->createSandbox($sandboxConfig);
            if (!$createResult->isSuccess()) {
                $this->logger->error('[Sandbox][App] Failed to create sandbox', [
                    'code' => $createResult->getCode(),
                    'message' => $createResult->getMessage()
                ]);

                throw new \RuntimeException(
                    sprintf('Failed to create sandbox: %s', $createResult->getMessage()),
                    $createResult->getCode()
                );
            }

            $sandboxId = $createResult->getDataValue('sandbox_id');
            if (empty($sandboxId)) {
                $this->logger->error('[Sandbox][App] No sandbox ID returned from creation');
                
                throw new \RuntimeException(
                    'No sandbox ID returned from creation',
                    $createResult->getCode()
                );
            }

            $this->logger->info('[Sandbox][App] Sandbox created successfully', [
                'sandbox_id' => $sandboxId
            ]);

            // 2. 等待沙箱启动（简单轮询）
            $maxWaitTime = 30; // 最多等待30秒
            $waitInterval = 2; // 每2秒检查一次
            $waited = 0;

            while ($waited < $maxWaitTime) {
                $statusResult = $this->gateway->getSandboxStatus($sandboxId);
                if ($statusResult->isSuccess() && $statusResult->isRunning()) {
                    break;
                }

                $this->logger->debug('[Sandbox][App] Waiting for sandbox to be ready', [
                    'sandbox_id' => $sandboxId,
                    'status' => $statusResult->getStatus(),
                    'waited' => $waited
                ]);

                sleep($waitInterval);
                $waited += $waitInterval;
            }

            // 3. 初始化Agent
            $messageId = (string) \App\Infrastructure\Util\IdGenerator\IdGenerator::getSnowId();
            $initRequest = InitAgentRequest::create(
                $messageId,
                '', // TODO: 从上下文获取用户ID
                $agentConfig['upload_config'] ?? [],
                $agentConfig['message_subscription_config'] ?? [],
                $agentConfig['sts_token_refresh'] ?? [],
                $agentConfig['metadata'] ?? [],
                $agentConfig['task_mode'] ?? 'plan'
            );
            $agentResponse = $this->agent->initAgent($sandboxId, $initRequest);

            $this->logger->info('[Sandbox][App] Sandbox with agent creation completed', [
                'sandbox_id' => $sandboxId,
                'agent_success' => $agentResponse->isSuccess(),
                'agent_id' => $agentResponse->getAgentId()
            ]);

            return [
                'success' => true,
                'message' => 'Sandbox with agent created successfully',
                'sandbox_id' => $sandboxId,
                'agent_response' => $agentResponse
            ];
        } catch (\Exception $e) {
            $this->logger->error('[Sandbox][App] Unexpected error when creating sandbox with agent', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return [
                'success' => false,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'sandbox_id' => null,
                'agent_response' => null
            ];
        }
    }
} 
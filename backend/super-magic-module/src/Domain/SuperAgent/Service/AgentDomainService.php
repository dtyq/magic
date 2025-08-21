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
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageMetadata;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\UserInfoValueObject;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Constant\WorkspaceStatus;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\ChatMessageRequest;
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

    public function initializeAgent(DataIsolation $dataIsolation, TaskContext $taskContext, ?string $memory = null): void
    {
        $this->logger->info('[Sandbox][App] Initializing agent', [
            'sandbox_id' => $taskContext->getSandboxId(),
            'memory_provided' => $memory !== null,
            'memory_length' => $memory ? strlen($memory) : 0,
        ]);

        // 1. 构建初始化信息
        $config = $this->generateInitializationInfo($dataIsolation, $taskContext, $memory);

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
        $this->logger->info('[Sandbox][App] Sending chat message to agent', [
            'sandbox_id' => $taskContext->getSandboxId(),
        ]);
        $mentionsJsonStruct = $this->buildMentionsJsonStruct($taskContext->getTask()->getMentions());

        // 构建参数
        $chatMessage = ChatMessageRequest::create(
            messageId: (string) IdGenerator::getSnowId(),
            userId: $dataIsolation->getCurrentUserId(),
            taskId: (string) $taskContext->getTask()->getId(),
            prompt: $taskContext->getTask()->getPrompt(),
            taskMode: $taskContext->getTask()->getTaskMode(),
            agentMode: $taskContext->getAgentMode(),
            mentions: $mentionsJsonStruct,
            mcpConfig: $taskContext->getMcpConfig(),
            modelId: $taskContext->getModelId(),
            dynamicConfig: $taskContext->getDynamicConfig(),
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
     * 构建初始化消息.
     */
    private function generateInitializationInfo(DataIsolation $dataIsolation, TaskContext $taskContext, ?string $memory = null): array
    {
        // 1. 获取上传配置信息
        $storageType = StorageBucketType::SandBox->value;
        $expires = 3600; // Credential valid for 1 hour
        // Create user authorization object
        $userAuthorization = new MagicUserAuthorization();
        $userAuthorization->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        // Use unified FileAppService to get STS Token
        $projectDir = WorkDirectoryUtil::getRootDir($dataIsolation->getCurrentUserId(), $taskContext->getTask()->getProjectId());
        $stsConfig = $this->fileAppService->getStsTemporaryCredential($userAuthorization, $storageType, $projectDir, $expires, false);
        // 2. 构建元数据
        $userInfoArray = $this->userInfoAppService->getUserInfo($dataIsolation->getCurrentUserId(), $dataIsolation);
        $userInfo = UserInfoValueObject::fromArray($userInfoArray);
        $this->logger->info('[Sandbox][App] Language generateInitializationInfo', [
            'language' => $dataIsolation->getLanguage(),
        ]);
        $messageMetadata = new MessageMetadata(
            agentUserId: $taskContext->getAgentUserId(),
            userId: $dataIsolation->getCurrentUserId(),
            organizationCode: $dataIsolation->getCurrentOrganizationCode(),
            chatConversationId: $taskContext->getChatConversationId(),
            chatTopicId: $taskContext->getChatTopicId(),
            instruction: $taskContext->getInstruction()->value,
            sandboxId: $taskContext->getSandboxId(),
            superMagicTaskId: (string) $taskContext->getTask()->getId(),
            workspaceId: $taskContext->getWorkspaceId(),
            projectId: (string) $taskContext->getTask()->getProjectId(),
            language: $dataIsolation->getLanguage(),
            userInfo: $userInfo,
        );

        // chat history
        $fullPrefix = $this->cloudFileRepository->getFullPrefix($dataIsolation->getCurrentOrganizationCode());
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

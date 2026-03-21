<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Application\Chat\Service\MagicUserInfoAppService;
use App\Application\File\Service\FileAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\Kernel\Service\PlatformSettingsDomainService;
use App\Domain\Token\Entity\MagicTokenEntity;
use App\Domain\Token\Entity\ValueObject\MagicTokenType;
use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\SizeManager;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Carbon\Carbon;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\AgentContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\AgentInitContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ChatInstruction;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\DynamicConfig\DynamicConfigManager;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\InitializationMetadataDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageMetadata;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\UserInfoValueObject;
use Dtyq\SuperMagic\Domain\SuperAgent\Exception\WorkspaceReadyTimeoutException;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Constant\WorkspaceStatus;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\ChatMessageRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\CheckpointRollbackCheckRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\CheckpointRollbackCommitRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\CheckpointRollbackRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\CheckpointRollbackStartRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\CheckpointRollbackUndoRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\InterruptRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Response\AgentResponse;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\SandboxAgentInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\ResponseCode;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\BatchStatusResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\SandboxStatusResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Server\Exception\ServerException;
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
        private readonly SandboxGatewayInterface $gateway,
        private readonly SandboxAgentInterface $agent,
        private readonly FileAppService $fileAppService,
        private readonly MagicUserInfoAppService $userInfoAppService,
        private readonly CloudFileRepositoryInterface $cloudFileRepository,
        private readonly DynamicConfigManager $dynamicConfigManager,
        private readonly MagicTokenRepositoryInterface $magicTokenRepository,
        private readonly LockerInterface $locker
    ) {
        $this->logger = $loggerFactory->get('sandbox');
    }

    public function buildInitAgentContext(DataIsolation $dataIsolation, ProjectEntity $projectEntity, TopicEntity $topicEntity, TaskEntity $taskEntity, string $sandboxId = '', bool $skipInitMessage = false, array $memories = [])
    {
        if (empty($sandboxId)) {
            // 默认使用话题id
            $sandboxId = (string) $topicEntity->getId();
        }
        $authToken = $this->getAuthorizationByUserId($dataIsolation->getCurrentUserId());
        // todo 初始化数据, 后续有些参数需要精简去掉
        $agentInitContext = AgentInitContext::createDefault();
        $agentInitContext->setMessageId((string) IdGenerator::getSnowId());
        $agentInitContext->setUserId($dataIsolation->getCurrentUserId()); // 待废弃
        $agentInitContext->setProjectId((string) $projectEntity->getId()); // 待废弃
        $agentInitContext->setType(MessageType::Init->value);
        // 设置对象存储的 sts token
        $projectDir = WorkDirectoryUtil::getRootDir($dataIsolation->getCurrentUserId(), $projectEntity->getId());
        $stsConfig = di(FileAppService::class)->getStsTemporaryCredentialV2(
            $projectEntity->getUserOrganizationCode(),
            StorageBucketType::SandBox->value,
            $projectDir,
            3600,
            false
        );
        $agentInitContext->setUploadConfig($stsConfig);
        // 设置消息回调接口
        $subscriptionConfig = [
            'method' => 'POST',
            'url' => config('super-magic.sandbox.callback_host', '') . '/api/v1/super-agent/tasks/deliver-message',
            'headers' => [
                'token' => config('super-magic.sandbox.token', ''),
            ],
        ];
        $agentInitContext->setMessageSubscriptionConfig($subscriptionConfig);
        // 设置 sts refresh 接口
        $refreshConfig = [
            'method' => 'POST',
            'url' => config('super-magic.sandbox.callback_host', '') . '/api/v1/super-agent/file/refresh-sts-token',
            'headers' => [
                'token' => config('super-magic.sandbox.token', ''),
            ],
        ];
        $agentInitContext->setStsTokenRefresh($refreshConfig);
        // 设置 metadata (待废弃)
        $userInfoArray = di(MagicUserInfoAppService::class)->getUserInfo($dataIsolation->getCurrentUserId(), $dataIsolation);
        $userInfo = UserInfoValueObject::fromArray($userInfoArray);
        // 获取 agent user ，待废弃
        $aiUserEntity = di(MagicUserDomainService::class)->getByAiCode($dataIsolation, AgentConstant::SUPER_MAGIC_CODE);
        $metadata = new MessageMetadata(
            agentUserId: $aiUserEntity->getUserId() ?? '',
            userId: $dataIsolation->getCurrentUserId(),
            organizationCode: $dataIsolation->getCurrentOrganizationCode(),
            chatConversationId: di(TopicDomainService::class)->getAgentChatConversationId($topicEntity->getChatTopicId(), $topicEntity->getChatConversationId()),
            chatTopicId: $topicEntity->getChatTopicId(),
            topicId: (string) $topicEntity->getId(),
            instruction: ChatInstruction::Normal->value,
            sandboxId: $sandboxId,
            superMagicTaskId: (string) $taskEntity->getId(),
            workspaceId: (string) $projectEntity->getWorkspaceId() ?? '',
            projectId: (string) $projectEntity->getId() ?? '',
            language: $dataIsolation->getLanguage() ?? 'zh_CN',
            authorization: $authToken,
            userInfo: $userInfo,
            skipInitMessages: $skipInitMessage
        );
        $agentInitContext->setMetadata($metadata->toArray());
        // 设置 agent_mode （待废弃）
        $agentInitContext->setAgentMode($topicEntity->getTopicMode());
        // 设置 magic_service_host
        $agentInitContext->setMagicServiceHost(config('super-magic.sandbox.callback_host', ''));
        $agentInitContext->setMagicServiceWsHost(config('super-magic.sandbox.magic_service_ws_host', ''));
        // 设置记忆
        $agentInitContext->setMemories($memories);
        // 设置路径
        $fullPrefix = $this->cloudFileRepository->getFullPrefix($projectEntity->getUserOrganizationCode());
        $chatWorkDir = WorkDirectoryUtil::getAgentChatHistoryDir($dataIsolation->getCurrentUserId(), $projectEntity->getId());
        $fullChatWorkDir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $chatWorkDir);
        $fullWorkDir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $projectEntity->getWorkDir());
        $agentInitContext->setChatHistoryDir($fullChatWorkDir);
        $agentInitContext->setWorkDir($fullWorkDir);
        // 设置是否需要拉取聊天记录
        if (! empty($topicEntity->getCurrentTaskId())) {
            $agentInitContext->setFetchHistory(true);
        } else {
            $agentInitContext->setFetchHistory(false);
        }
        // 设置站点角色
        $language = $dataIsolation->getLanguage() ?? 'zh_CN';
        $agentRoleName = di(PlatformSettingsDomainService::class)->getAgentRoleName($language);
        $agentRoleDescription = di(PlatformSettingsDomainService::class)->getAgentRoleDescription($language);
        $agentInitContext->setAgent([
            'name' => $agentRoleName,
            'description' => $agentRoleDescription,
        ]);

        return new AgentContext(
            sandboxId: $sandboxId,
            authToken: $authToken,
            projectEntity: $projectEntity,
            topicEntity: $topicEntity,
            taskEntity: $taskEntity,
            initContext: $agentInitContext,
        );
    }

    /**
     * Ensure sandbox is initialized and workspace is ready.
     * Uses distributed lock to prevent concurrent sandbox creation.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @return string Sandbox ID
     * @throws ServerException If metadata is incomplete or lock acquisition fails
     */
    public function ensureSandboxInitialized(
        DataIsolation $dataIsolation,
        AgentContext $agentContext
    ): string {
        $topicEntity = $agentContext->getTopicEntity();

        $sandboxId = $agentContext->getSandboxId() ?? (string) $topicEntity->getId();

        $this->logger->info('[Sandbox][Domain] Ensuring sandbox is initialized', [
            'topic_id' => $topicEntity->getId(),
            'sandbox_id' => $sandboxId,
            'is_custom_sandbox_id' => $agentContext->getSandboxId(),
        ]);

        // 4. Use distributed lock to prevent concurrent creation
        $lockKey = sprintf('super_agent:sandbox:init:%s', $topicEntity->getId());
        $lockOwner = uniqid('sandbox_init_', true);
        $lockAcquired = false;

        try {
            // Attempt to acquire lock
            $this->logger->info('[Sandbox][Domain] Attempting to acquire lock for sandbox initialization', [
                'topic_id' => $topicEntity->getId(),
                'lock_key' => $lockKey,
                'lock_owner' => $lockOwner,
                'timeout_seconds' => 60,
            ]);

            // Use spin lock, wait up to 60 seconds
            $lockAcquired = $this->locker->spinLock($lockKey, $lockOwner, 60);

            if (! $lockAcquired) {
                $this->logger->error('[Sandbox][Domain] Failed to acquire lock for sandbox initialization', [
                    'topic_id' => $topicEntity->getId(),
                    'lock_key' => $lockKey,
                ]);
                throw new ServerException('Failed to acquire lock for sandbox initialization, please try again');
            }

            $this->logger->info('[Sandbox][Domain] Lock acquired successfully for sandbox initialization', [
                'topic_id' => $topicEntity->getId(),
                'lock_key' => $lockKey,
                'lock_owner' => $lockOwner,
            ]);

            // 5. Check workspace status
            try {
                $response = $this->getWorkspaceStatus($sandboxId);
                $status = $response->getDataValue('status');

                // If workspace is already ready, return directly
                if (WorkspaceStatus::isReady($status)) {
                    $this->logger->info('[Sandbox][Domain] Workspace already ready', [
                        'sandbox_id' => $sandboxId,
                        'workspace_status' => $status,
                    ]);
                    return $sandboxId;
                }

                // Workspace not ready, need to reinitialize
                $this->logger->info('[Sandbox][Domain] Workspace not ready, will reinitialize', [
                    'sandbox_id' => $sandboxId,
                    'workspace_status' => $status,
                ]);
            } catch (SandboxOperationException $e) {
                // Failed to check workspace status, need to reinitialize
                $this->logger->warning('[Sandbox][Domain] Failed to check workspace status, will reinitialize', [
                    'sandbox_id' => $sandboxId,
                    'error' => $e->getMessage(),
                ]);
            }

            // 6. Create sandbox container （后续不需要路径）
            $sandboxId = $this->createSandbox(
                dataIsolation: $dataIsolation,
                projectId: (string) $agentContext->getProjectEntity()->getId(),
                sandboxID: $agentContext->getSandboxId(),
                workDir: $agentContext?->getInitContext()->getWorkDir() ?? ''
            );

            // 7. Initialize agent
            $result = $this->agent->initAgent($sandboxId, $agentContext->getInitContext()->toArray());
            if (! $result->isSuccess()) {
                $this->logger->error('[Sandbox][App] Failed to initialize agent', [
                    'sandbox_id' => $sandboxId,
                    'error' => $result->getMessage(),
                    'code' => $result->getCode(),
                ]);
                throw new SandboxOperationException('Initialize agent', $result->getMessage(), $result->getCode());
            }

            // 8. Wait for workspace ready
            $this->waitForWorkspaceReady($sandboxId);

            $this->logger->info('[Sandbox][Domain] Sandbox initialized successfully', [
                'sandbox_id' => $sandboxId,
                'topic_id' => $topicEntity->getId(),
            ]);

            return $sandboxId;
        } finally {
            // Ensure lock is released
            if ($lockAcquired) {
                $released = $this->locker->release($lockKey, $lockOwner);
                $this->logger->info('[Sandbox][Domain] Lock released for sandbox initialization', [
                    'topic_id' => $topicEntity->getId(),
                    'lock_owner' => $lockOwner,
                    'released' => $released,
                ]);
            }
        }
    }

    /**
     * 调用沙箱网关，创建沙箱容器，如果 sandboxId 不存在，系统会默认创建一个.
     */
    public function createSandbox(DataIsolation $dataIsolation, string $projectId, string $sandboxID, string $workDir): string
    {
        $this->logger->debug('[Sandbox][App] Creating sandbox', [
            'project_id' => $projectId,
            'sandbox_id' => $sandboxID,
            'project_oss_path' => $workDir,
        ]);

        $this->gateway->setUserContext($dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode());
        $result = $this->gateway->createSandbox($projectId, $sandboxID, $workDir);

        // 添加详细的调试日志，检查 result 对象
        $this->logger->debug('[Sandbox][App] Gateway result analysis', [
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
        $this->logger->debug('[Sandbox][App] Getting sandbox status', [
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

        $this->logger->debug('[Sandbox][App] Sandbox status retrieved', [
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
        $this->logger->debug('[Sandbox][App] Getting batch sandbox status', [
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

        $this->logger->debug('[Sandbox][App] Batch sandbox status retrieved', [
            'requested_count' => count($sandboxIds),
            'returned_count' => $result->getTotalCount(),
            'running_count' => $result->getRunningCount(),
        ]);

        return $result;
    }

    /**
     * @param ?string $projectOrganizationCode 项目所属组织编码，10月新增支持跨组织项目协作，所有文件都在项目组织下
     * @param ?InitializationMetadataDTO $initMetadata 初始化元数据 DTO，用于配置初始化行为
     */
    public function initializeAgent(DataIsolation $dataIsolation, TaskContext $taskContext, ?string $projectOrganizationCode = null, ?InitializationMetadataDTO $initMetadata = null): void
    {
        $initMetadata = $initMetadata ?? new InitializationMetadataDTO();

        // todo 将 token 设置为分钟级的短效 token，并启用 refresh token 机制。（每次刷新都改变 token 和 refresh token）

        $this->logger->debug('[Sandbox][App] Initializing agent', [
            'sandbox_id' => $taskContext->getSandboxId(),
            'project_organization_code' => $projectOrganizationCode,
            'skip_init_messages' => $initMetadata->getSkipInitMessages(),
        ]);

        // 1. 构建初始化信息
        $config = $this->generateInitializationInfo($dataIsolation, $taskContext, projectOrganizationCode: $projectOrganizationCode, initMetadata: $initMetadata);

        // 2. 调用初始化接口
        $result = $this->agent->initAgent($taskContext->getSandboxId(), $config);

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

        if ($taskId = (string) $taskContext->getTask()->getId()) {
            // 添加任意注册到 DynamicConfigManager 的动态配置。暂时通过 TaskId 进行区分。
            $dynamicConfigs = $this->dynamicConfigManager->getByTaskId($taskId);
            foreach ($dynamicConfigs as $key => $dynamicConfig) {
                $taskDynamicConfig[$key] = $dynamicConfig;
            }
        }

        // Add image_model configuration if imageModelId exists
        $extra = $taskContext->getExtra();
        if ($extra !== null) {
            $imageModelId = $extra->getImageModelId();
            if (! empty($imageModelId)) {
                $sizes = [];
                if ($imageModelVersion = $taskDynamicConfig['image_model_versions'][$imageModelId] ?? null) {
                    $sizes = SizeManager::matchConfig(modelVersion: $imageModelVersion, modelId: $imageModelId)['sizes'] ?? [];
                }

                $taskDynamicConfig['image_model'] = [
                    'model_id' => $imageModelId,
                    'sizes' => $sizes,
                ];
            }
        }

        $this->logger->debug('[Sandbox][App] Sending chat message to agent', [
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

        // Get constraint text if needed
        $constraintText = $this->getPromptConstraint($taskContext);
        $prompt = $userRequest . $constraintText;

        // 构建 metadata（使用公共方法）
        $initMetadata = new InitializationMetadataDTO();
        $messageMetadata = $this->buildMessageMetadata($dataIsolation, $taskContext, $initMetadata);

        $this->logger->info('[Sandbox][App] Built metadata for chat message', [
            'task_id' => $taskContext->getTask()->getId(),
            'user_id' => $dataIsolation->getCurrentUserId(),
            'metadata' => $messageMetadata->toArray(),
        ]);

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
            metadata: $messageMetadata->toArray(),
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
        $this->logger->debug('[Sandbox][App] Sending interrupt message to agent', [
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

        $this->logger->debug('[Sandbox][App] Interrupt message sent to agent successfully', [
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
     * 检查工作区是否已就绪.
     *
     * @param string $sandboxId 沙箱ID
     * @return bool 是否就绪
     */
    public function isWorkspaceReady(string $sandboxId): bool
    {
        try {
            $response = $this->getWorkspaceStatus($sandboxId);
            $status = $response->getDataValue('status');
            return WorkspaceStatus::isReady($status);
        } catch (Throwable $e) {
            $this->logger->warning('[Sandbox][App] Failed to check workspace ready status', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Wait for workspace to be ready with optional interrupt check.
     * Polls workspace status until initialization completes, fails, times out, or is interrupted.
     *
     * @param string $sandboxId Sandbox ID
     * @param null|callable $interruptChecker Interrupt checker closure, return true to interrupt
     * @param int $maxWaitSeconds Maximum wait time in seconds (default 5 minutes)
     * @param int $checkIntervalSeconds Check interval in seconds (default 2 seconds)
     * @return bool True if workspace is ready, false if interrupted
     * @throws WorkspaceReadyTimeoutException When timeout occurs
     * @throws SandboxOperationException When initialization fails or error occurs
     */
    public function waitForWorkspaceReady(
        string $sandboxId,
        int $maxWaitSeconds = 300,
        int $checkIntervalSeconds = 2,
        ?callable $interruptChecker = null
    ): bool {
        $this->logger->debug('[Sandbox][App] Waiting for workspace to be ready', [
            'sandbox_id' => $sandboxId,
            'max_wait_seconds' => $maxWaitSeconds,
            'check_interval_seconds' => $checkIntervalSeconds,
            'has_interrupt_checker' => $interruptChecker !== null,
        ]);

        $startTime = time();

        while (true) {
            // 1. First check if interrupted (closure check)
            if ($interruptChecker !== null && $interruptChecker()) {
                $this->logger->info('[Sandbox][App] Workspace ready wait interrupted by checker', [
                    'sandbox_id' => $sandboxId,
                    'elapsed_time' => time() - $startTime,
                ]);
                return false; // Return false to indicate interrupted
            }

            // 2. Check workspace status
            try {
                $response = $this->getWorkspaceStatus($sandboxId);
                $status = $response->getDataValue('status');

                $this->logger->debug('[Sandbox][App] Workspace status check', [
                    'sandbox_id' => $sandboxId,
                    'status' => $status,
                    'status_description' => WorkspaceStatus::getDescription($status),
                    'elapsed_seconds' => time() - $startTime,
                ]);

                // Status is ready, return success
                if (WorkspaceStatus::isReady($status)) {
                    $this->logger->debug('[Sandbox][App] Workspace is ready', [
                        'sandbox_id' => $sandboxId,
                        'elapsed_seconds' => time() - $startTime,
                    ]);
                    return true;
                }

                // Status is error, throw exception
                if (WorkspaceStatus::isError($status)) {
                    $this->logger->error('[Sandbox][App] Workspace initialization failed', [
                        'sandbox_id' => $sandboxId,
                        'status' => $status,
                        'status_description' => WorkspaceStatus::getDescription($status),
                        'elapsed_seconds' => time() - $startTime,
                    ]);
                    throw new SandboxOperationException(
                        'Wait for workspace ready',
                        'Workspace initialization failed with status: ' . WorkspaceStatus::getDescription($status),
                        3001
                    );
                }
            } catch (SandboxOperationException $e) {
                // Re-throw sandbox operation exception
                throw $e;
            } catch (Throwable $e) {
                $this->logger->warning('[Sandbox][App] Error while checking workspace status', [
                    'sandbox_id' => $sandboxId,
                    'error' => $e->getMessage(),
                    'elapsed_seconds' => time() - $startTime,
                ]);
                // Continue retry, don't throw exception
            }

            // 3. Check timeout
            $elapsedTime = time() - $startTime;
            if ($elapsedTime >= $maxWaitSeconds) {
                $this->logger->error('[Sandbox][App] Workspace ready timeout', [
                    'sandbox_id' => $sandboxId,
                    'max_wait_seconds' => $maxWaitSeconds,
                    'elapsed_time' => $elapsedTime,
                ]);
                throw new WorkspaceReadyTimeoutException(
                    "Workspace not ready after {$maxWaitSeconds} seconds"
                );
            }

            // 4. Wait before retry
            sleep($checkIntervalSeconds);
        }
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
        $this->logger->debug('[Sandbox][Domain] Rolling back to checkpoint', [
            'sandbox_id' => $sandboxId,
            'target_message_id' => $targetMessageId,
        ]);

        try {
            $request = CheckpointRollbackRequest::create($targetMessageId);
            $response = $this->agent->rollbackCheckpoint($sandboxId, $request);

            if ($response->isSuccess()) {
                $this->logger->debug('[Sandbox][Domain] Checkpoint rollback successful', [
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
        $this->logger->debug('[Sandbox][Domain] Starting checkpoint rollback', [
            'sandbox_id' => $sandboxId,
            'target_message_id' => $targetMessageId,
        ]);

        try {
            $request = CheckpointRollbackStartRequest::create($targetMessageId);
            $response = $this->agent->rollbackCheckpointStart($sandboxId, $request);

            if ($response->isSuccess()) {
                $this->logger->debug('[Sandbox][Domain] Checkpoint rollback start successful', [
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
        $this->logger->debug('[Sandbox][Domain] Committing checkpoint rollback', [
            'sandbox_id' => $sandboxId,
        ]);

        try {
            $request = CheckpointRollbackCommitRequest::create();
            $response = $this->agent->rollbackCheckpointCommit($sandboxId, $request);

            if ($response->isSuccess()) {
                $this->logger->debug('[Sandbox][Domain] Checkpoint rollback commit successful', [
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
        $this->logger->debug('[Sandbox][Domain] Undoing checkpoint rollback', [
            'sandbox_id' => $sandboxId,
        ]);

        try {
            $request = CheckpointRollbackUndoRequest::create();
            $response = $this->agent->rollbackCheckpointUndo($sandboxId, $request);

            if ($response->isSuccess()) {
                $this->logger->debug('[Sandbox][Domain] Checkpoint rollback undo successful', [
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
        $this->logger->debug('[Sandbox][Domain] Checking checkpoint rollback feasibility', [
            'sandbox_id' => $sandboxId,
            'target_message_id' => $targetMessageId,
        ]);

        try {
            $request = CheckpointRollbackCheckRequest::create($targetMessageId);
            $response = $this->agent->rollbackCheckpointCheck($sandboxId, $request);

            if ($response->isSuccess()) {
                $this->logger->debug('[Sandbox][Domain] Checkpoint rollback check completed', [
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
        $this->logger->debug('[Sandbox][Domain] Upgrading sandbox image', [
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

            $this->logger->debug('[Sandbox][Domain] Sandbox upgraded successfully', [
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
     * @param ?InitializationMetadataDTO $initMetadata 初始化元数据 DTO，包含 authorization 等配置
     */
    private function generateInitializationInfo(DataIsolation $dataIsolation, TaskContext $taskContext, ?string $projectOrganizationCode = null, ?InitializationMetadataDTO $initMetadata = null): array
    {
        $initMetadata = $initMetadata ?? new InitializationMetadataDTO();

        // 1. 获取上传配置信息
        $storageType = StorageBucketType::SandBox->value;
        $expires = 3600; // Credential valid for 1 hour
        // Create user authorization object
        $userAuthorization = new MagicUserAuthorization();
        $userAuthorization->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        // Use unified FileAppService to get STS Token
        $projectDir = WorkDirectoryUtil::getRootDir($dataIsolation->getCurrentUserId(), $taskContext->getTask()->getProjectId());

        $stsConfig = $this->fileAppService->getStsTemporaryCredentialV2($projectOrganizationCode, $storageType, $projectDir, $expires, false);
        // 2. 构建元数据（使用公共方法）
        $messageMetadata = $this->buildMessageMetadata($dataIsolation, $taskContext, $initMetadata);

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
            'magic_service_ws_host' => config('super-magic.sandbox.magic_service_ws_host', ''),
            'memories' => $initMetadata->getMemories(),
            'chat_history_dir' => $fullChatWorkDir,
            'work_dir' => $fullWorkDir,
            'model_id' => $taskContext->getModelId(),
            'fetch_history' => ! $taskContext->getIsFirstTask(),
            'agent' => $this->buildAgentInfo($initMetadata),
        ];
    }

    /**
     * 构建消息元数据
     * 从 generateInitializationInfo 中抽取的公共方法，用于 init 和 chat 消息复用.
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param TaskContext $taskContext 任务上下文
     * @param InitializationMetadataDTO $initMetadata 初始化元数据（必需）
     * @return MessageMetadata 消息元数据对象
     */
    private function buildMessageMetadata(
        DataIsolation $dataIsolation,
        TaskContext $taskContext,
        InitializationMetadataDTO $initMetadata
    ): MessageMetadata {
        // 获取用户信息
        $userInfoArray = $this->userInfoAppService->getUserInfo($dataIsolation->getCurrentUserId(), $dataIsolation);
        $userInfo = UserInfoValueObject::fromArray($userInfoArray);

        $this->logger->info('[Sandbox][App] Building message metadata', [
            'user_id' => $dataIsolation->getCurrentUserId(),
            'task_id' => $taskContext->getTask()->getId(),
            'language' => $dataIsolation->getLanguage(),
        ]);

        // 获取 authorization
        $authorization = $this->getAuthorizationByUserId($dataIsolation->getCurrentUserId());

        // 构建并返回 MessageMetadata 对象
        return new MessageMetadata(
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
            $initMetadata->getAuthorization() ?? $authorization,
            $userInfo,
            $initMetadata->getSkipInitMessages() ?? false
        );
    }

    /**
     * Build agent info from metadata.
     *
     * @param InitializationMetadataDTO $initMetadata Initialization metadata
     * @return ?array Agent info array or null
     */
    private function buildAgentInfo(InitializationMetadataDTO $initMetadata): ?array
    {
        if ($initMetadata->getAgentRole() === null || $initMetadata->getAgentRole()->isEmpty()) {
            return null;
        }

        $agent = $initMetadata->getAgentRole()->toArray();

        $this->logger->debug('[Sandbox][App] Agent role initialized', [
            'agent_name' => $agent['name'],
            'agent_description' => $agent['description'],
        ]);

        return $agent;
    }

    /**
     * Get prompt constraint text based on extra configuration.
     * Returns combined constraint text based on extra settings.
     *
     * @param TaskContext $taskContext Task context containing extra and language info
     * @return string Constraint text or empty string
     */
    private function getPromptConstraint(TaskContext $taskContext): string
    {
        $extra = $taskContext->getExtra();
        if ($extra === null) {
            return '';
        }

        $language = $taskContext->getDataIsolation()->getLanguage();
        $constraints = [];

        // Check web search constraint
        if ($extra->getEnableWebSearch() === false) {
            $constraints[] = trans('prompt.disable_web_search_constraint', [], $language);
            $this->logger->debug('[Sandbox][App] Web search disabled, constraint text will be appended to prompt', [
                'task_id' => $taskContext->getTask()->getId(),
                'language' => $language,
            ]);
        }

        return empty($constraints) ? '' : implode('', $constraints);
    }

    /**
     * 根据用户ID获取 Authorization.
     * - 先以用户级别 token（MagicTokenType::User）为准，支持一个账号多个组织
     * - 若 token 已存在但剩余有效期不足 30 天，则刷新至 30 天后.
     *
     * @param string $userId 用户ID
     * @return string Authorization 字符串，如果不存在则返回空字符串
     */
    private function getAuthorizationByUserId(string $userId): string
    {
        // 先按 MagicTokenType::User + userId 查询是否有可用的 token
        $tokenEntity = $this->magicTokenRepository->getTokenByTypeAndRelationValue(MagicTokenType::User, $userId);

        // 如果已存在可用的 token，根据有效期情况刷新后返回
        if ($tokenEntity !== null) {
            $this->refreshTokenExpirationIfNeeded($tokenEntity);
            return $tokenEntity->getToken();
        }

        // 如果没有可用的 token，创建一个新的 token（有效期一个月）
        try {
            $newToken = IdGenerator::getUniqueIdSha256();
            $magicTokenEntity = new MagicTokenEntity();
            $magicTokenEntity->setType(MagicTokenType::User);
            $magicTokenEntity->setTypeRelationValue($userId);
            $magicTokenEntity->setToken($newToken);
            // 设置有效期为30天
            $expiredAt = Carbon::now()->addDays(30)->toDateTimeString();
            $magicTokenEntity->setExpiredAt($expiredAt);

            $this->magicTokenRepository->createToken($magicTokenEntity);

            return $newToken;
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][App] Failed to create user token', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);
            return '';
        }
    }

    /**
     * 当用户 token 剩余有效期不足 30 天时，统一刷新到 30 天后以减少重复签发.
     *
     * @param MagicTokenEntity $tokenEntity 已存在的用户 token
     */
    private function refreshTokenExpirationIfNeeded(MagicTokenEntity $tokenEntity): void
    {
        $now = Carbon::now();
        $threshold = $now->copy()->addDays(30);
        $expiredAt = Carbon::parse($tokenEntity->getExpiredAt());

        if ($expiredAt->greaterThanOrEqualTo($threshold)) {
            return;
        }

        $tokenEntity->setExpiredAt($threshold->toDateTimeString());
        $tokenEntity->setUpdatedAt($now->toDateTimeString());
        $this->magicTokenRepository->refreshTokenExpiration($tokenEntity);
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

        return $mentions;
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Application\LongTermMemory\Enum\AppCodeEnum;
use App\Application\MCP\SupperMagicMCP\SupperMagicAgentMCPInterface;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\SuperAgentExtra;
use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Service\MagicConversationDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Kernel\Service\PlatformSettingsDomainService;
use App\Domain\LongTermMemory\Service\LongTermMemoryDomainService;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\TaskInitializationMessageDTO;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ClientMessageAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\AgentRoleValueObject;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ChatInstruction;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\InitializationMetadataDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AgentDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Infrastructure\Utils\TaskTerminationUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Hyperf\Amqp\Annotation\Consumer;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Amqp\Result;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use PhpAmqpLib\Message\AMQPMessage;
use Psr\Container\ContainerExceptionInterface;
use Psr\Container\NotFoundExceptionInterface;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * Task initialization consumer with interrupt support at any time.
 */
#[Consumer(
    exchange: 'super-magic',
    routingKey: 'task.initialization',
    queue: 'task.initialization',
    nums: 1
)]
class TaskInitializationConsumer extends ConsumerMessage
{
    protected LoggerInterface $logger;

    private ?SupperMagicAgentMCPInterface $supperMagicAgentMCP = null;

    public function __construct(
        private readonly AgentDomainService $agentDomainService,
        private readonly TaskDomainService $taskDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly LongTermMemoryDomainService $longTermMemoryDomainService,
        private readonly PlatformSettingsDomainService $platformSettingsDomainService,
        private readonly ClientMessageAppService $clientMessageAppService,
        private readonly MagicConversationDomainService $magicConversationDomainService,
        private readonly Redis $redis,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));

        if (container()->has(SupperMagicAgentMCPInterface::class)) {
            try {
                $this->supperMagicAgentMCP = container()->get(SupperMagicAgentMCPInterface::class);
            } catch (ContainerExceptionInterface|NotFoundExceptionInterface) {
            }
        }
    }

    public function consumeMessage($data, AMQPMessage $message): Result
    {
        $messageDTO = null;
        try {
            $this->logger->info('Received task initialization message', [
                'data' => $data,
            ]);

            // Parse message DTO
            $messageDTO = TaskInitializationMessageDTO::fromArray($data);

            // [Checkpoint 1] Check termination flag first (support interrupt at any time)
            if ($this->checkTerminationFlag($messageDTO->getTaskId())) {
                $this->logger->info('[Checkpoint 1] Task already terminated, skip processing', [
                    'task_id' => $messageDTO->getTaskId(),
                ]);
                return Result::ACK;
            }

            // Build initialization parameters
            $this->buildAndInitializeAgent($messageDTO);

            $this->logger->info('Task initialization completed', [
                'task_id' => $messageDTO->getTaskId(),
            ]);

            return Result::ACK;
        } catch (Throwable $e) {
            $this->logger->error('Failed to process task initialization message', [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Send error message to client if we have the necessary information
            if ($messageDTO !== null) {
                $this->sendErrorNotificationToClient($messageDTO);
            }

            // Return ACK to avoid infinite retry
            return Result::ACK;
        }
    }

    /**
     * Check if task is terminated.
     */
    private function checkTerminationFlag(int $taskId): bool
    {
        return TaskTerminationUtil::isTaskTerminated($this->redis, $this->logger, $taskId);
    }

    /**
     * Build and initialize agent with interrupt support at any time.
     */
    private function buildAndInitializeAgent(TaskInitializationMessageDTO $messageDTO): void
    {
        // Create data isolation
        $dataIsolation = DataIsolation::create(
            $messageDTO->getOrganizationCode(),
            $messageDTO->getUserId()
        );
        $dataIsolation->setLanguage($messageDTO->getLanguage());

        // Get task entity
        $taskEntity = $this->taskDomainService->getTaskById($messageDTO->getTaskId());
        if (is_null($taskEntity)) {
            $this->logger->error('Task not found', [
                'task_id' => $messageDTO->getTaskId(),
            ]);
            return;
        }

        // [Checkpoint 2] Check termination flag again before proceeding
        /* @phpstan-ignore-next-line if.alwaysFalse - Termination flag can be set externally */
        if ($this->checkTerminationFlag($taskEntity->getId())) {
            $this->logger->info('[Checkpoint 2] Task terminated before initialization', [
                'task_id' => $taskEntity->getId(),
            ]);
            return;
        }

        // Get topic entity
        $topicEntity = $this->topicDomainService->getTopicById($messageDTO->getTopicId());
        if (is_null($topicEntity)) {
            $this->logger->error('Topic not found', [
                'topic_id' => $messageDTO->getTopicId(),
            ]);
            return;
        }

        // Get project entity
        $projectEntity = $this->projectDomainService->getProjectNotUserId(
            $messageDTO->getProjectId()
        );
        if (is_null($projectEntity)) {
            $this->logger->error('Project not found', [
                'project_id' => $messageDTO->getProjectId(),
            ]);
            return;
        }

        // Reconstruct SuperAgentExtra from extraData
        $extra = null;
        if ($messageDTO->getExtraData() !== null) {
            $extra = new SuperAgentExtra();
            $extraData = $messageDTO->getExtraData();

            if (! empty($extraData['image_model_id'])) {
                $extra->setImageModel(['model_id' => $extraData['image_model_id']]);
            }
            if (! empty($extraData['model_id'])) {
                $extra->setModel(['model_id' => $extraData['model_id']]);
            }
        }

        // Get AI Agent's conversation ID using unique index for optimal query performance
        $agentConversationId = $this->getAgentConversationId(
            $dataIsolation,
            $messageDTO->getAgentUserId()
        );

        // Build task context with all fields populated
        $taskContext = new TaskContext(
            task: $taskEntity,
            dataIsolation: $dataIsolation,
            chatConversationId: $agentConversationId,
            chatTopicId: $messageDTO->getChatTopicId(),
            agentUserId: $messageDTO->getAgentUserId(),
            sandboxId: $topicEntity->getSandboxId(),
            taskId: (string) $taskEntity->getId(),
            instruction: ChatInstruction::FollowUp,
            agentMode: $topicEntity->getTopicMode(),
            isFirstTask: empty($topicEntity->getSandboxId()),
            extra: $extra
        );

        // Add MCP config
        $mcpDataIsolation = MCPDataIsolation::create(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId()
        );
        $mcpConfig = $this->supperMagicAgentMCP?->createChatMessageRequestMcpConfig(
            $mcpDataIsolation,
            $taskContext
        ) ?? [];
        $taskContext = $taskContext->setMcpConfig($mcpConfig);

        // Create and initialize sandbox with interrupt support
        $sandboxId = $this->createAndInitializeSandbox(
            $dataIsolation,
            $taskContext,
            $projectEntity
        );

        $this->logger->info('Agent initialized successfully', [
            'task_id' => $taskEntity->getId(),
            'sandbox_id' => $sandboxId,
        ]);
    }

    /**
     * Create and initialize sandbox with interrupt support at any time.
     */
    private function createAndInitializeSandbox(
        DataIsolation $dataIsolation,
        TaskContext $taskContext,
        ProjectEntity $projectEntity
    ): string {
        $taskId = $taskContext->getTask()->getId();

        // Create sandbox container
        $fullPrefix = $this->taskFileDomainService->getFullPrefix(
            $projectEntity->getUserOrganizationCode()
        );
        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir(
            $fullPrefix,
            $taskContext->getTask()->getWorkDir()
        );

        if (empty($taskContext->getSandboxId())) {
            $sandboxId = (string) $taskContext->getTopicId();
        } else {
            $sandboxId = $taskContext->getSandboxId();
        }

        // Step 1: Create Sandbox (time-consuming operation)
        $sandboxId = $this->agentDomainService->createSandbox(
            $dataIsolation,
            (string) $taskContext->getProjectId(),
            $sandboxId,
            $fullWorkdir
        );

        // [KEY POINT] Immediately update sandbox_id to database
        // This allows interrupt API to send interrupt to Sandbox even if consumer is still processing
        $this->topicDomainService->updateTopicSandboxId(
            $dataIsolation,
            $taskContext->getTopicId(),
            $sandboxId
        );
        $this->taskDomainService->updateTaskSandboxId(
            $dataIsolation,
            $taskContext->getTask()->getId(),
            $sandboxId
        );
        $taskContext->setSandboxId($sandboxId);

        $this->logger->info('[Checkpoint 2] Sandbox created and updated, checking termination flag', [
            'task_id' => $taskId,
            'sandbox_id' => $sandboxId,
        ]);

        // [Checkpoint 2] Check termination flag after Sandbox creation
        if ($this->checkTerminationFlag($taskId)) {
            $this->logger->info('[Checkpoint 2] Task terminated after sandbox creation, stop processing', [
                'task_id' => $taskId,
                'sandbox_id' => $sandboxId,
            ]);
            return $sandboxId;
        }

        // user long term memory (structured, sandbox decides how to use it)
        $memories = $this->longTermMemoryDomainService->getEffectiveMemoriesForSandbox(
            $dataIsolation->getCurrentOrganizationCode(),
            AppCodeEnum::SUPER_MAGIC->value,
            $dataIsolation->getCurrentUserId(),
            (string) $projectEntity->getId(),
        );

        // Get agent role from platform settings
        $language = $dataIsolation->getLanguage() ?? 'zh_CN';
        $agentRoleName = $this->platformSettingsDomainService->getAgentRoleName($language);
        $agentRoleDescription = $this->platformSettingsDomainService->getAgentRoleDescription(
            $language
        );

        // Build agent role value object
        $agentRole = new AgentRoleValueObject(
            name: $agentRoleName,
            description: $agentRoleDescription
        );

        // Create initialization metadata with agent role
        $initMetadata = new InitializationMetadataDTO();
        $initMetadata->setAgentRole($agentRole);
        $initMetadata->setMemories($memories);

        $this->logger->info('[Sandbox][Consumer] Preparing agent initialization with role', [
            'sandbox_id' => $sandboxId,
            'language' => $language,
            'agent_name' => $agentRoleName,
            'agent_description' => $agentRoleDescription,
        ]);

        // Step 2: Initialize agent with metadata (time-consuming operation)
        $this->agentDomainService->initializeAgent(
            $dataIsolation,
            $taskContext,
            projectOrganizationCode: $projectEntity->getUserOrganizationCode(),
            initMetadata: $initMetadata
        );

        $this->logger->info('[Checkpoint 3] Agent initialized, checking termination flag', [
            'task_id' => $taskId,
            'sandbox_id' => $sandboxId,
        ]);

        // [Checkpoint 3] Check termination flag after Agent initialization
        /* @phpstan-ignore-next-line if.alwaysFalse - Termination flag can be set externally */
        if ($this->checkTerminationFlag($taskId)) {
            $this->logger->info('[Checkpoint 3] Task terminated after agent initialization, stop processing', [
                'task_id' => $taskId,
                'sandbox_id' => $sandboxId,
            ]);
            return $sandboxId;
        }

        // Step 3: Wait for workspace to be ready with interrupt check closure
        // This is the most time-consuming operation, so we use closure for polling check
        $this->logger->info('[Checkpoint 4] Starting to wait for workspace ready with interrupt check', [
            'task_id' => $taskId,
            'sandbox_id' => $sandboxId,
        ]);

        $isReady = $this->agentDomainService->waitForWorkspaceReady(
            $sandboxId,
            maxWaitSeconds: 60, // Check every 2 seconds
            // [Checkpoint 4] Interrupt check closure: called on every polling iteration
            interruptChecker: fn () => $this->checkTerminationFlag($taskId)
        );

        if (! $isReady) {
            // Interrupted during workspace ready wait
            $this->logger->info('[Checkpoint 4] Task interrupted during workspace ready wait', [
                'task_id' => $taskId,
                'sandbox_id' => $sandboxId,
            ]);
            return $sandboxId;
        }

        $this->logger->info('[Checkpoint 5] Workspace ready, checking termination flag before sending message', [
            'task_id' => $taskId,
            'sandbox_id' => $sandboxId,
        ]);

        // [Checkpoint 5] Final check before sending message
        /* @phpstan-ignore-next-line if.alwaysFalse - Termination flag can be set externally */
        if ($this->checkTerminationFlag($taskId)) {
            $this->logger->info('[Checkpoint 5] Task terminated before sending message', [
                'task_id' => $taskId,
                'sandbox_id' => $sandboxId,
            ]);
            return $sandboxId;
        }

        // Step 4: Send message to agent
        $this->agentDomainService->sendChatMessage($dataIsolation, $taskContext);

        $this->logger->info('[Success] Message sent to agent successfully', [
            'task_id' => $taskId,
            'sandbox_id' => $sandboxId,
        ]);

        return $sandboxId;
    }

    /**
     * Send error notification to client when initialization fails.
     */
    private function sendErrorNotificationToClient(
        TaskInitializationMessageDTO $messageDTO
    ): void {
        try {
            // Only send notification if we have chat topic ID and agent user ID
            if (empty($messageDTO->getChatTopicId()) || empty($messageDTO->getAgentUserId())) {
                $this->logger->warning('Cannot send error notification: missing required IDs', [
                    'task_id' => $messageDTO->getTaskId(),
                    'chat_topic_id' => $messageDTO->getChatTopicId(),
                    'agent_user_id' => $messageDTO->getAgentUserId(),
                ]);
                return;
            }

            // Create data isolation for query
            $dataIsolation = DataIsolation::create(
                $messageDTO->getOrganizationCode(),
                $messageDTO->getUserId()
            );

            // Get AI Agent's conversation ID using unique index
            $agentConversationId = $this->getAgentConversationId(
                $dataIsolation,
                $messageDTO->getAgentUserId()
            );

            if (empty($agentConversationId)) {
                $this->logger->warning('Cannot send error notification: agent conversation not found', [
                    'task_id' => $messageDTO->getTaskId(),
                ]);
                return;
            }

            $this->clientMessageAppService->sendErrorMessageToClient(
                topicId: $messageDTO->getTopicId(),
                taskId: (string) $messageDTO->getTaskId(),
                chatTopicId: $messageDTO->getChatTopicId(),
                chatConversationId: $agentConversationId,
                errorMessage: trans('task.initialize_error') // @phpstan-ignore-line function.notFound
            );

            $this->logger->info('Error notification sent to client', [
                'task_id' => $messageDTO->getTaskId(),
                'chat_topic_id' => $messageDTO->getChatTopicId(),
            ]);
        } catch (Throwable $notificationError) {
            $this->logger->error('Failed to send error notification to client', [
                'task_id' => $messageDTO->getTaskId(),
                'error' => $notificationError->getMessage(),
            ]);
        }
    }

    /**
     * Get AI Agent's conversation ID using unique index for optimal query performance.
     *
     * This constructs a query that uses the unique index:
     * (user_id, receive_id, receive_type, user_organization_code, receive_organization_code)
     *
     * @param DataIsolation $dataIsolation Contains organization code and human user ID
     * @param string $agentUserId AI Agent's user ID
     * @return string The conversation ID for AI Agent's conversation window
     */
    private function getAgentConversationId(DataIsolation $dataIsolation, string $agentUserId): string
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $humanUserId = $dataIsolation->getCurrentUserId();

        // Build conversation entity with all unique index fields
        $conversationDTO = new MagicConversationEntity();
        $conversationDTO->setUserId($agentUserId);                          // AI Agent as owner
        $conversationDTO->setReceiveId($humanUserId);                       // Human user as receiver
        $conversationDTO->setReceiveType(ConversationType::User);           // AI sends to human = User type
        $conversationDTO->setUserOrganizationCode($organizationCode);       // Same organization
        $conversationDTO->setReceiveOrganizationCode($organizationCode);    // Same organization

        // Query using unique index for optimal performance
        $conversationEntity = $this->magicConversationDomainService->getConversationByUserIdAndReceiveId($conversationDTO);

        if ($conversationEntity === null) {
            $this->logger->error('Agent conversation not found', [
                'agent_user_id' => $agentUserId,
                'human_user_id' => $humanUserId,
                'organization_code' => $organizationCode,
            ]);
            return '';
        }

        return $conversationEntity->getId();
    }
}

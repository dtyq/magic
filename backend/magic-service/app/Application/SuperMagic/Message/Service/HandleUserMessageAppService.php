<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Message\Service;

use App\Application\LongTermMemory\Enum\AppCodeEnum;
use App\Application\MCP\SupperMagicMCP\ProjectMcpConfigService;
use App\Application\MCP\SupperMagicMCP\SupperMagicAgentSkillInterface;
use App\Application\SuperMagic\Agent\Service\SuperMagicAgentAccessAppService;
use App\Application\SuperMagic\Common\Service\AbstractAppService;
use App\Application\SuperMagic\Message\Assembler\UserMessageDTOAssembler;
use App\Application\SuperMagic\Message\DTO\TaskMessageDTO;
use App\Application\SuperMagic\Message\DTO\UserMessageDTO;
use App\Application\SuperMagic\Task\DTO\InterruptClientNotification;
use App\Application\SuperMagic\Task\Service\AgentAppService;
use App\Application\SuperMagic\Task\Service\ReferencedProjectMountPlanner;
use App\Application\SuperMagic\Task\Service\ReferencedProjectMountService;
use App\Application\SuperMagic\Task\Service\TaskContextMentionsResolver;
use App\Application\SuperMagic\Task\Service\TaskNotificationLabelResolver;
use App\Application\SuperMagic\Task\Service\TopicTaskAppService;
use App\Application\SuperMagic\Topic\Service\TopicAgentConfigResolver;
use App\Domain\Chat\DTO\Message\ChatMessage\UserToolCallMessage;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\LongTermMemory\Service\LongTermMemoryDomainService;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Common\Entity\ValueObject\CreationSource;
use App\Domain\SuperMagic\Common\Entity\ValueObject\StorageType;
use App\Domain\SuperMagic\File\Constant\ProjectFileConstant;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileType;
use App\Domain\SuperMagic\File\Entity\ValueObject\TaskFileSource;
use App\Domain\SuperMagic\File\Event\AttachmentsProcessedEvent;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\File\Service\UpsertProjectFileNodeDTO;
use App\Domain\SuperMagic\Message\Entity\TaskMessageEntity;
use App\Domain\SuperMagic\Message\Entity\ValueObject\ChatInstruction;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Task\Entity\TaskEntity;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRootFileIds;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskContext;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskStatus;
use App\Domain\SuperMagic\Task\Event\RunTaskBeforeEvent;
use App\Domain\SuperMagic\Task\Event\RunTaskCallbackEvent;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\ErrorCode\EventErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\ErrorCode\SuperMagicErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\EventExceptionBuilder;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\UserToolCallNotFoundException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\UserToolCallRecoveryException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use App\Infrastructure\SuperMagic\Utils\TaskTerminationUtil;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\SuperMagic\Message\DTO\TopicTaskMessageDTO;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Odin\Message\Role;
use Hyperf\Redis\Redis;
use Hyperf\Server\Exception\ServerException;
use Psr\Log\LoggerInterface;
use Throwable;

use function event_dispatch;
use function Hyperf\Translation\trans;

/**
 * Handle User Message Application Service
 * Responsible for handling the complete business process of users sending messages to agents.
 */
class HandleUserMessageAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    private ?SupperMagicAgentSkillInterface $supperMagicAgentSkill = null;

    public function __construct(
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskDomainService $taskDomainService,
        private readonly MagicDepartmentUserDomainService $departmentUserDomainService,
        private readonly TopicTaskAppService $topicTaskAppService,
        private readonly TopicAgentConfigResolver $topicAgentConfigResolver,
        private readonly AgentDomainService $agentDomainService,
        private readonly AgentAppService $agentAppService,
        private readonly LongTermMemoryDomainService $longTermMemoryDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly ProjectMcpConfigService $projectMcpConfigService,
        private readonly SuperMagicAgentAccessAppService $superMagicAgentAccessAppService,
        private readonly ReferencedProjectMountPlanner $referencedProjectMountPlanner,
        private readonly ReferencedProjectMountService $referencedProjectMountService,
        private readonly Redis $redis,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
        if (container()->has(SupperMagicAgentSkillInterface::class)) {
            $this->supperMagicAgentSkill = container()->get(SupperMagicAgentSkillInterface::class);
        }
    }

    public function handleMessage(
        DataIsolation $dataIsolation,
        UserMessageDTO $message,
        ?UserToolCallMessage $toolReply = null,
        ?int $existingTaskId = null,
    ): ?InterruptClientNotification {
        $dataIsolation->initDataIsolationEnv();
        $toolReply ??= UserMessageDTOAssembler::resolveUserToolCallMessage(null, $message->getDynamicParams());
        $kind = UserMessageDTOAssembler::classifyMessage($message->getInstruction(), $toolReply);
        if ($existingTaskId !== null && $kind !== 'chat') {
            ExceptionBuilder::throw(SuperAgentErrorCode::VALIDATE_FAILED, 'task.open_api.create_messages_only');
        }
        switch ($kind) {
            case 'tool_reply':
                $this->handleUserToolCallMessage($dataIsolation, $message, $toolReply);
                return null;
            case 'interrupt':
                return $this->handleInternalMessage($dataIsolation, $message);
            default:
                $this->handleChatMessage($dataIsolation, $message, $existingTaskId);
                return null;
        }
    }

    /**
     * Handle user-initiated interrupt (internal message).
     *
     * Returns an InterruptClientNotification when the caller should push an interrupt
     * message to the client (sandbox not running); returns null when the interrupt was
     * forwarded to the running sandbox directly. The caller owns the WebSocket delivery
     * so this core method stays decoupled from client messaging.
     */
    public function handleInternalMessage(DataIsolation $dataIsolation, UserMessageDTO $dto): ?InterruptClientNotification
    {
        $dataIsolation->initDataIsolationEnv();
        // Get topic information
        $topicEntity = $this->topicDomainService->getTopicByChatTopicId($dataIsolation, $dto->getChatTopicId());

        if (is_null($topicEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }

        // 检查项目是否有权限
        $this->getAccessibleProject($topicEntity->getProjectId(), $dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode());

        // Get task information
        $taskEntity = $this->taskDomainService->getTaskById($topicEntity->getCurrentTaskId());
        if (is_null($taskEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TASK_NOT_FOUND, 'task.task_not_found');
        }
        // Update task status
        $this->topicTaskAppService->updateTaskStatus(
            dataIsolation: $dataIsolation,
            task: $taskEntity,
            status: TaskStatus::Suspended,
            errMsg: 'User manually terminated task',
        );

        // Set task termination flag in Redis to prevent agent messages from being processed
        TaskTerminationUtil::setTerminationFlag($this->redis, $this->logger, $taskEntity->getId());

        // Get sandbox status, if sandbox is running, send interrupt command
        $result = $this->agentDomainService->getSandboxStatus($topicEntity->getSandboxId());
        if ($result->getStatus() === SandboxStatus::RUNNING) {
            $this->agentDomainService->sendInterruptMessage($dataIsolation, $taskEntity->getSandboxId(), (string) $taskEntity->getId(), '');
            return null;
        }

        // Sandbox not running: tell caller to notify the client about the interrupt
        return new InterruptClientNotification(
            topicId: $topicEntity->getId(),
            taskId: (string) ($topicEntity->getCurrentTaskId() ?? '0'),
            reason: $dto->getPrompt() ?: trans('task.agent_stopped'),
        );
    }

    /*
    * user send message to agent
    */
    public function getTaskContext(DataIsolation $dataIsolation, UserMessageDTO $userMessageDTO): TaskContext
    {
        $dataIsolation->initDataIsolationEnv();
        $topicEntity = $this->topicDomainService->getTopicByChatTopicId($dataIsolation, $userMessageDTO->getChatTopicId());
        if (is_null($topicEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }

        $data = [
            'user_id' => $dataIsolation->getCurrentUserId(),
            'workspace_id' => $topicEntity->getWorkspaceId(),
            'project_id' => $topicEntity->getProjectId(),
            'topic_id' => $topicEntity->getId(),
            'task_id' => '', // Initially empty, this is agent's task id
            'task_mode' => $topicEntity->getTaskMode(),
            'sandbox_id' => $topicEntity->getSandboxId(), // Current task prioritizes reusing previous topic's sandbox id
            'prompt' => $userMessageDTO->getPrompt(),
            'attachments' => $userMessageDTO->getAttachments(),
            'mentions' => $userMessageDTO->getMentions(),
            'task_status' => TaskStatus::WAITING->value,
            'work_dir' => $topicEntity->getWorkDir() ?? '',
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        $taskEntity = TaskEntity::fromArray($data);

        // Resolve agent_code before initTopicTask
        $agentCode = $userMessageDTO->getExtra()?->getAgentCode() ?? '';

        // Initialize task
        $taskEntity = $this->taskDomainService->initTopicTask(
            dataIsolation: $dataIsolation,
            topicEntity: $topicEntity,
            taskEntity: $taskEntity,
            agentCode: $agentCode
        );

        // Check if this is the first task for the topic
        // If topic source is COPY, it's not the first task
        $isFirstTask = (empty($topicEntity->getCurrentTaskId()) || empty($topicEntity->getSandboxId()))
            && CreationSource::fromValue($topicEntity->getSource()) !== CreationSource::COPY;

        // Send message to agent
        $taskContext = new TaskContext(
            task: $taskEntity,
            dataIsolation: $dataIsolation,
            chatConversationId: $userMessageDTO->getChatConversationId(),
            chatTopicId: $userMessageDTO->getChatTopicId(),
            agentUserId: $userMessageDTO->getAgentUserId(),
            sandboxId: $topicEntity->getSandboxId(),
            taskId: (string) $taskEntity->getId(),
            instruction: ChatInstruction::FollowUp,
            agentMode: $topicEntity->getTopicMode(),
            isFirstTask: $isFirstTask,
            extra: $userMessageDTO->getExtra(),
            agentCode: $topicEntity->getAgentCode(),
        );
        return $this->appendVideoModelDynamicConfig($taskContext, $userMessageDTO->getExtra());
    }

    /*
    * user send message to agent
    */

    /**
     * Core entry: handle a user chat message and drive the agent.
     *
     * When $taskId is null/empty (WebSocket flow), a new task is created and the user
     * message is persisted here. When $taskId is provided (HTTP queue flow), the task
     * was already created and the user message already persisted/pushed to IM by the
     * producer, so this method only loads the task and sends it to the agent.
     *
     * This method intentionally does NOT send any WebSocket message on failure: it lets
     * EventException / Throwable propagate so the caller (subscriber / queue consumer)
     * owns client notifications, keeping this core method generic and reusable.
     */
    public function handleChatMessage(DataIsolation $dataIsolation, UserMessageDTO $userMessageDTO, ?int $taskId = null): void
    {
        $dataIsolation->initDataIsolationEnv();
        // Validate prompt length (MySQL text type max length is 65535 bytes, use 65000 for redundancy)
        if (strlen($userMessageDTO->getPrompt()) > 65000) {
            EventExceptionBuilder::throw(
                EventErrorCode::EVENT_DATA_VALIDATION_FAILED,
                trans('super_magic.task.prompt_length_exceeded')
            );
        }

        // Get topic information
        $topicEntity = $this->topicDomainService->getTopicByChatTopicId($dataIsolation, $userMessageDTO->getChatTopicId());
        if (is_null($topicEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }

        // 检查项目是否有权限
        $projectEntity = $this->getAccessibleProject($topicEntity->getProjectId(), $dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode());

        // Check if this is the first task for the topic
        // If topic source is COPY, it's not the first task
        $isFirstTask = (empty($topicEntity->getCurrentTaskId()) || empty($topicEntity->getSandboxId()))
            && CreationSource::fromValue($topicEntity->getSource()) !== CreationSource::COPY;

        if (empty($taskId)) {
            // Fresh path (WebSocket): create task + persist user message in this service
            $taskEntity = $this->initializeChatTask($dataIsolation, $topicEntity, $userMessageDTO);
            $topicAgentConfig = $this->topicAgentConfigResolver->resolve(
                topicEntity: $topicEntity,
                extra: $userMessageDTO->getExtra(),
            );
        } else {
            // Reuse path (HTTP queue): task already created and user message already persisted
            $taskEntity = $this->taskDomainService->getTaskById($taskId);
            if (is_null($taskEntity)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::TASK_NOT_FOUND, 'task.task_not_found');
            }
            $topicAgentConfig = $this->topicAgentConfigResolver->resolve(
                topicEntity: $topicEntity,
                extra: $userMessageDTO->getExtra(),
            );
        }

        $topicPattern = $topicAgentConfig->topicMode;
        [$allowed, $errorMessage] = $this->superMagicAgentAccessAppService->checkAgentAccess(
            SuperMagicAgentDataIsolation::create(
                $dataIsolation->getCurrentOrganizationCode(),
                $dataIsolation->getCurrentUserId()
            ),
            $topicPattern,
            $topicAgentConfig->agentCode
        );
        if (! $allowed) {
            ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, $errorMessage);
        }

        // Generate task context
        $taskContext = new TaskContext(
            task: $taskEntity,
            dataIsolation: $dataIsolation,
            chatConversationId: $userMessageDTO->getChatConversationId(),
            chatTopicId: $userMessageDTO->getChatTopicId(),
            agentUserId: $userMessageDTO->getAgentUserId(),
            sandboxId: $topicEntity->getSandboxId(),
            taskId: (string) $taskEntity->getId(),
            instruction: ChatInstruction::FollowUp,
            agentMode: $topicAgentConfig->topicMode,
            mcpConfig: [],
            modelId: $userMessageDTO->getModelId(),
            messageId: $userMessageDTO->getMessageId(),
            isFirstTask: $isFirstTask,
            extra: $userMessageDTO->getExtra(),
            agentCode: $topicAgentConfig->agentCode,
            messageSubscriptionConfig: $userMessageDTO->getMessageSubscriptionConfig(),
        );
        $taskContext = $this->appendVideoModelDynamicConfig($taskContext, $userMessageDTO->getExtra());
        // Add MCP config to task context
        $mcpDataIsolation = MCPDataIsolation::create(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId()
        );
        $mcpConfig = $this->projectMcpConfigService->buildForTask($mcpDataIsolation, $taskContext);
        $taskContext = $taskContext->setMcpConfig($mcpConfig);

        // Write agent_code into dynamicConfig independently (always pass through, regardless of skills)
        $dynamicConfig = $taskContext->getDynamicConfig();
        $dynamicConfig['agent_code'] = $topicAgentConfig->agentCode;
        $taskContext = $taskContext->setDynamicConfig($dynamicConfig);

        // Append skill dynamic config independently (separate from agent_code and MCP config)
        $this->supperMagicAgentSkill?->appendSkillDynamicConfig($dataIsolation, $taskContext);

        // Add dynamic params to task context (if present)
        if ($userMessageDTO->getDynamicParams() !== null) {
            $existingDynamicConfig = $taskContext->getDynamicConfig();
            $taskContext = $taskContext->setDynamicConfig(array_merge($existingDynamicConfig, $userMessageDTO->getDynamicParams()));
        }

        // Create and send message to agent
        try {
            $sandboxID = $this->createAndSendMessageToAgent($dataIsolation, $taskContext, $projectEntity, $topicEntity);
            $taskEntity->setSandboxId($sandboxID);

            if (TaskTerminationUtil::isTaskTerminated($this->redis, $this->logger, $taskEntity->getId())) {
                $result = $this->agentDomainService->getSandboxStatus($topicEntity->getSandboxId());
                if ($result->getStatus() === SandboxStatus::RUNNING) {
                    $this->agentDomainService->sendInterruptMessage($dataIsolation, $taskEntity->getSandboxId(), (string) $taskEntity->getId(), '');
                }
            }
        } catch (Throwable $e) {
            // The task failed before any agent message could exist, so the normal
            // RunTaskCallbackEvent flow never triggers. Settle the task here and emit
            // the terminal event so downstream state (e.g. recording summary phase)
            // never gets stuck.
            $this->settleFailedChatTask($dataIsolation, $topicEntity, $taskEntity, $projectEntity, $e);

            // Business exceptions already carry a translated, client-safe message.
            if ($e instanceof BusinessException) {
                throw $e;
            }

            // Convert technical failures into a friendly, translated message:
            // sandbox-related ones blame the runtime environment, everything else
            // is a generic task start failure. The original trace is logged via `throwable`.
            $errorCode = match (true) {
                $e instanceof SandboxOperationException, $e instanceof ServerException => SuperMagicErrorCode::SandboxInitFailed,
                default => SuperMagicErrorCode::ChatTaskStartFailed,
            };
            ExceptionBuilder::throw($errorCode, throwable: $e);
        }
    }

    /**
     * 处理用户工具调用回复，直接将消息转发给沙盒。
     * tool_call_id 对应沙盒下发的工具调用 ID；task_id 由领域服务通过 chatTopicId 推导。
     * name 透传给沙盒，PHP 层不做分支，所有工具类型走统一流程。
     */
    public function handleUserToolCallMessage(
        DataIsolation $dataIsolation,
        UserMessageDTO $userMessageDTO,
        UserToolCallMessage $userToolCallMessage,
    ): void {
        $dataIsolation->initDataIsolationEnv();
        try {
            $this->topicTaskAppService->handleUserToolCallReply(
                dataIsolation: $dataIsolation,
                chatTopicId: $userMessageDTO->getChatTopicId(),
                name: $userToolCallMessage->getName(),
                toolCallId: $userToolCallMessage->getToolCallId(),
                detail: $userToolCallMessage->getDetail() ?? [],
            );
        } catch (UserToolCallNotFoundException $e) {
            // 问题已被超时消费或重复提交：任务本身仍由沙箱侧超时恢复流程正常推进，
            // 只记录回答未送达，不作为任务错误处理，也不追加普通消息。
            $this->logger->warning('User tool call question expired or already consumed, answer dropped', [
                'chat_topic_id' => $userMessageDTO->getChatTopicId(),
                'tool_call_id' => $userToolCallMessage->getToolCallId(),
                'name' => $userToolCallMessage->getName(),
                'reason' => $e->getMessage(),
            ]);
            EventExceptionBuilder::throw(EventErrorCode::EVENT_USER_TOOL_CALL_EXPIRED, trans('super_magic.task.question_expired'));
        } catch (UserToolCallRecoveryException $e) {
            $this->logger->warning('User tool call answer is waiting for execution recovery', [
                'chat_topic_id' => $userMessageDTO->getChatTopicId(),
                'tool_call_id' => $userToolCallMessage->getToolCallId(),
                'name' => $userToolCallMessage->getName(),
                'reason' => $e->getMessage(),
            ]);
            EventExceptionBuilder::throw(
                EventErrorCode::EVENT_USER_TOOL_CALL_RECOVERY_FAILED,
                trans('super_magic.task.question_recovery_failed'),
                data: ['tool_call_id' => $userToolCallMessage->getToolCallId()]
            );
        }
    }

    /**
     * Initialize a brand-new chat task for the topic (fresh / WebSocket flow):
     * handles waiting-for-user cancellation, pre-check event dispatch, task creation
     * and user message persistence.
     */
    private function initializeChatTask(
        DataIsolation $dataIsolation,
        TopicEntity $topicEntity,
        UserMessageDTO $userMessageDTO
    ): TaskEntity {
        // If the current task is waiting for user input, cancel it before starting a new one
        $currentTaskId = $topicEntity->getCurrentTaskId();
        if (! empty($currentTaskId)) {
            $currentTaskEntity = $this->taskDomainService->getTaskById($currentTaskId);
            if ($currentTaskEntity?->getStatus() === TaskStatus::WAITING_FOR_USER) {
                $this->topicTaskAppService->handleUserToolCallCancelled(
                    dataIsolation: $dataIsolation,
                    task: $currentTaskEntity,
                );
            }
        }

        // 提前初始化 task_id
        $taskId = (string) IdGenerator::getSnowId();

        // Check message before task starts
        $this->beforeHandleChatMessage(
            $dataIsolation,
            $userMessageDTO->getInstruction(),
            $topicEntity,
            $userMessageDTO->getLanguage(),
            $userMessageDTO->getModelId(),
            $taskId,
            $userMessageDTO->getPrompt(),
            $userMessageDTO->getMentions() ?? ''
        );

        // Get task mode from DTO, fallback to topic's task mode if empty
        $taskMode = $userMessageDTO->getTaskMode();
        if ($taskMode === '') {
            $taskMode = $topicEntity->getTaskMode();
        }
        $data = [
            'id' => (int) $taskId,
            'user_id' => $dataIsolation->getCurrentUserId(),
            'workspace_id' => $topicEntity->getWorkspaceId(),
            'project_id' => $topicEntity->getProjectId(),
            'topic_id' => $topicEntity->getId(),
            'task_id' => '', // Initially empty, this is agent's task id
            'task_mode' => $taskMode,
            'sandbox_id' => $topicEntity->getSandboxId(), // Current task prioritizes reusing previous topic's sandbox id
            'prompt' => $userMessageDTO->getPrompt(),
            'attachments' => $userMessageDTO->getAttachments(),
            'mentions' => $userMessageDTO->getMentions(),
            'task_status' => TaskStatus::WAITING->value,
            'work_dir' => $topicEntity->getWorkDir() ?? '',
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        $taskEntity = TaskEntity::fromArray($data);

        $topicAgentConfig = $this->topicAgentConfigResolver->resolve(
            topicEntity: $topicEntity,
            extra: $userMessageDTO->getExtra(),
            fallbackTopicMode: $userMessageDTO->getTopicMode(),
        );

        // Initialize task
        $taskEntity = $this->taskDomainService->initTopicTask(
            dataIsolation: $dataIsolation,
            topicEntity: $topicEntity,
            taskEntity: $taskEntity,
            topicMode: $topicAgentConfig->topicMode,
            agentCode: $topicAgentConfig->agentCode
        );

        // Save user information
        $this->saveUserMessage($dataIsolation, $taskEntity, $userMessageDTO);

        return $taskEntity;
    }

    /**
     * Pre-task detection.
     */
    private function beforeHandleChatMessage(
        DataIsolation $dataIsolation,
        ChatInstruction $instruction,
        TopicEntity $topicEntity,
        string $language,
        string $modelId = '',
        string $taskId = '',
        string $prompt = '',
        string $mentions = ''
    ): void {
        // Get running topic IDs and calculate current task run count
        $runningTopicIds = $this->pullUserTopicStatus($dataIsolation);
        $currentTaskRunCount = count($runningTopicIds);
        // step by zero
        $taskRound = $this->taskDomainService->getTaskNumByTopicId($topicEntity->getId());
        // get department ids
        $departmentIds = [];
        $departmentUserEntities = $this->departmentUserDomainService->getDepartmentUsersByUserIds([$dataIsolation->getCurrentUserId()], $dataIsolation);
        foreach ($departmentUserEntities as $departmentUserEntity) {
            $departmentIds[] = $departmentUserEntity->getDepartmentId();
        }
        AsyncEventUtil::dispatch(new RunTaskBeforeEvent(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
            $topicEntity->getId(),
            $taskRound,
            $currentTaskRunCount,
            $runningTopicIds,
            $departmentIds,
            $language,
            $modelId,
            $taskId,
            $prompt,
            $mentions,
        ));
        $this->logger->debug(sprintf('Dispatched task start event, topic id: %s, round: %d, currentTaskRunCount: %d (after real status check)', $topicEntity->getId(), $taskRound, $currentTaskRunCount));
    }

    /**
     * Update topics and tasks by pulling sandbox status.
     *
     * @return int[] Running topic IDs
     */
    private function pullUserTopicStatus(DataIsolation $dataIsolation): array
    {
        // Get user's running tasks
        $topicEntities = $this->topicDomainService->getUserRunningTopics($dataIsolation);
        // Get sandbox IDs and build sandboxId to topicId mapping
        $sandboxIds = [];
        $sandboxIdToTopicId = [];
        foreach ($topicEntities as $topicEntityItem) {
            $sandboxId = $topicEntityItem->getSandboxId();
            if ($sandboxId === '') {
                continue;
            }
            $sandboxIds[] = $sandboxId;
            $sandboxIdToTopicId[$sandboxId] = $topicEntityItem->getId();
        }
        if (count($sandboxIds) === 0) {
            return [];
        }
        // Batch query status
        $result = $this->agentDomainService->getBatchSandboxStatus($sandboxIds);

        // Get running sandbox IDs from remote result
        $runningSandboxIds = $result->getRunningSandboxIds();

        // Find sandbox IDs that are not running (including missing ones)
        $updateSandboxIds = array_diff($sandboxIds, $runningSandboxIds);
        // Update topic status
        $this->topicDomainService->updateTopicStatusBySandboxIds($updateSandboxIds, TaskStatus::ERROR);
        // Update task status (via topic_id: task table is indexed by topic_id, not sandbox_id)
        $updateTopicIds = array_values(array_intersect_key($sandboxIdToTopicId, array_flip($updateSandboxIds)));
        if ($updateTopicIds !== []) {
            $this->taskDomainService->updateTaskStatusByTopicIds($updateTopicIds, TaskStatus::ERROR, 'Synchronize sandbox status');
        }

        // Collect running topic IDs
        $runningTopicIds = [];
        foreach ($runningSandboxIds as $sandboxId) {
            if (isset($sandboxIdToTopicId[$sandboxId])) {
                $runningTopicIds[] = $sandboxIdToTopicId[$sandboxId];
            }
        }
        return $runningTopicIds;
    }

    /**
     * Initialize agent environment using ensureSandboxInitialized.
     */
    private function createAndSendMessageToAgent(DataIsolation $dataIsolation, TaskContext $taskContext, ProjectEntity $projectEntity, TopicEntity $topicEntity): string
    {
        // user long term memory (structured, sandbox decides how to use it)
        $memories = $this->longTermMemoryDomainService->getEffectiveMemoriesForSandbox(
            $dataIsolation->getCurrentOrganizationCode(),
            AppCodeEnum::SUPER_MAGIC->value,
            $dataIsolation->getCurrentUserId(),
            (string) $taskContext->getProjectId(),
        );

        // 使用 ensureSandboxInitialized 确保沙箱已初始化（带锁保护，防止并发）
        // 不要在这里把 topic_id 当成 sandbox_id 传进去：那样会触发 tryWarmPoolFastPath 的
        // "已有 sandbox_id 跳过 warm 池" 守卫，导致 chat 永远走冷创建。传话题已绑定的
        // sandbox_id（未绑定则为空），由 Domain 内部决定走 warm 还是 cold 路径。
        $extraSubscriptionConfigs = $taskContext->getMessageSubscriptionConfig() !== null
            ? [$taskContext->getMessageSubscriptionConfig()]
            : [];
        $agentContext = $this->agentDomainService->buildInitAgentContext(
            dataIsolation: $dataIsolation,
            projectEntity: $projectEntity,
            topicEntity: $topicEntity,
            taskEntity: $taskContext->getTask(),
            sandboxId: (string) $topicEntity->getSandboxId(),
            memories: $memories,
            extraSubscriptionConfigs: $extraSubscriptionConfigs
        );
        // Propagate the resolved agent mode to the sandbox init context (request-level override)
        if ($agentContext->getInitContext() !== null && $taskContext->getAgentMode() !== '') {
            $agentContext->getInitContext()->setAgentMode($taskContext->getAgentMode());
        }
        $taskId = $taskContext->getTask()->getId();
        // Support interrupt at any time during sandbox initialization
        $sandboxId = $this->agentDomainService->ensureSandboxInitialized(
            $dataIsolation,
            $agentContext,
            new SandboxRootFileIds(
                (string) $this->taskFileDomainService->getProjectRootFileId($projectEntity->getId()),
                (string) $this->taskFileDomainService->findOrCreateUserRootDirectory($dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode()),
                (string) $this->taskFileDomainService->findOrCreateTopicRootDirectory($projectEntity->getId(), $topicEntity->getId(), $dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode(), $projectEntity->getUserOrganizationCode())
            ),
            interruptChecker: fn () => TaskTerminationUtil::isTaskTerminated($this->redis, $this->logger, $taskId)
        );

        // 更新 topic 和 task 的 sandbox_id
        $this->topicDomainService->updateTopicSandboxId($dataIsolation, $taskContext->getTopicId(), $sandboxId);
        $this->taskDomainService->updateTaskSandboxId($dataIsolation, $taskContext->getTask()->getId(), $sandboxId);
        $taskContext->setSandboxId($sandboxId);
        $taskContext->getTask()->setSandboxId($sandboxId);

        // Stop before sending if the task was terminated during initialization
        if (TaskTerminationUtil::isTaskTerminated($this->redis, $this->logger, $taskId)) {
            $this->logger->info('[Sandbox][App] Task terminated before sending message', [
                'sandbox_id' => $sandboxId,
                'task_id' => $taskId,
            ]);
            return $sandboxId;
        }

        $this->logger->info('[Sandbox][App] Sandbox initialized, sending message to agent', [
            'sandbox_id' => $sandboxId,
            'task_id' => $taskContext->getTask()->getId(),
        ]);

        // 在 Application 层完成 mentions 规范化，Domain 层不再跨域聚合
        di(TaskContextMentionsResolver::class)->resolve($taskContext, $dataIsolation);

        // 挂载引用项目（全有或全无——任一失败则中止）
        $mentions = Json::decode($taskContext->getTask()->getMentions() ?: '[]') ?: [];
        $crossProjectMounts = $this->referencedProjectMountPlanner->plan($mentions, $projectEntity->getId());
        $this->referencedProjectMountService->prepareAndSend(
            $dataIsolation,
            $sandboxId,
            $crossProjectMounts,
            fn (): bool => TaskTerminationUtil::isTaskTerminated($this->redis, $this->logger, $taskId),
            function () use ($dataIsolation, $taskContext, $taskId): void {
                $this->agentAppService->sendChatMessage($dataIsolation, $taskContext);
                // Update task status
                // 启动状态与发送共用准备锁，避免前一请求迟到的 RUNNING 覆盖后一请求。
                if (! TaskTerminationUtil::isTaskTerminated($this->redis, $this->logger, $taskId)) {
                    $this->topicTaskAppService->updateTaskStatus(
                        dataIsolation: $dataIsolation,
                        task: $taskContext->getTask(),
                        status: TaskStatus::RUNNING
                    );
                }
            },
        );

        return $sandboxId;
    }

    /**
     * Settle a task that failed during agent startup (sandbox init / message send).
     *
     * Marks the task as ERROR and dispatches a forced-ERROR RunTaskCallbackEvent so
     * downstream subscribers (e.g. recording summary phase settlement) receive a
     * terminal signal even though no agent message will ever arrive. Never throws.
     */
    private function settleFailedChatTask(
        DataIsolation $dataIsolation,
        TopicEntity $topicEntity,
        TaskEntity $taskEntity,
        ProjectEntity $projectEntity,
        Throwable $e
    ): void {
        try {
            $this->topicTaskAppService->updateTaskStatus(
                dataIsolation: $dataIsolation,
                task: $taskEntity,
                status: TaskStatus::ERROR,
                errMsg: $e->getMessage()
            );
        } catch (Throwable $updateError) {
            $this->logger->error('Failed to mark chat task as ERROR', [
                'task_id' => $taskEntity->getId(),
                'error' => $updateError->getMessage(),
            ]);
        }

        try {
            $messageDTO = TopicTaskMessageDTO::fromArray([
                'payload' => [
                    'task_id' => (string) $taskEntity->getId(),
                    'status' => TaskStatus::ERROR->value,
                ],
            ]);

            $labels = di(TaskNotificationLabelResolver::class)->resolve(
                task: $taskEntity,
                topic: $topicEntity,
                project: $projectEntity,
            );

            AsyncEventUtil::dispatch(new RunTaskCallbackEvent(
                $dataIsolation->getCurrentOrganizationCode(),
                $dataIsolation->getCurrentUserId(),
                $topicEntity->getId(),
                $topicEntity->getTopicName(),
                $taskEntity->getId(),
                $messageDTO,
                $dataIsolation->getLanguage() ?? '',
                $labels['project_id'],
                $labels['project_name'],
                $labels['workspace_id'],
                $labels['workspace_name']
            ));
        } catch (Throwable $dispatchError) {
            $this->logger->error('Failed to dispatch error callback event for failed chat task', [
                'task_id' => $taskEntity->getId(),
                'topic_id' => $topicEntity->getId(),
                'error' => $dispatchError->getMessage(),
            ]);
        }
    }

    /**
     * Save user information and corresponding attachments.
     */
    private function saveUserMessage(DataIsolation $dataIsolation, TaskEntity $taskEntity, UserMessageDTO $userMessageDTO): void
    {
        // Convert mentions string to array if not null
        $mentionsArray = $userMessageDTO->getMentions() !== null ? json_decode($userMessageDTO->getMentions(), true) : null;

        // Convert attachments string to array if not null
        $attachmentsArray = $userMessageDTO->getAttachments() !== null ? json_decode($userMessageDTO->getAttachments(), true) : null;

        // 合并原有的 raw_content 和 dynamic_params
        $rawContentJson = $this->mergeRawContentWithDynamicParams(
            $userMessageDTO->getRawContent(),
            $userMessageDTO->getDynamicParams()
        );

        // Create TaskMessageDTO for user message
        $taskMessageDTO = new TaskMessageDTO(
            taskId: (string) $taskEntity->getId(),
            role: Role::User->value,
            senderUid: $dataIsolation->getCurrentUserId(),
            receiverUid: $userMessageDTO->getAgentUserId(),
            messageType: $userMessageDTO->getChatMessageType(),
            content: $taskEntity->getPrompt(),
            rawContent: $rawContentJson,
            status: null,
            steps: null,
            tool: null,
            topicId: $taskEntity->getTopicId(),
            event: '',
            attachments: $attachmentsArray,
            mentions: $mentionsArray,
            showInUi: true,
            messageId: $userMessageDTO->getMessageId(),
            imSeqId: (int) $userMessageDTO->getMessageSeqId()
        );

        $taskMessageEntity = TaskMessageEntity::taskMessageDTOToTaskMessageEntity($taskMessageDTO);
        $taskMessageEntity->setProcessingStatus(TaskMessageEntity::PROCESSING_STATUS_COMPLETED);
        $this->logger->debug(sprintf('Saved user message, task id: %s, message id: %s, im seq id: %d', $taskEntity->getId(), $taskMessageEntity->getId(), $taskMessageEntity->getImSeqId()));
        $this->taskDomainService->recordTaskMessage($taskMessageEntity);

        // Process user uploaded attachments using saveProjectFile
        $this->processUserAttachments($userMessageDTO->getAttachments(), $taskEntity, $dataIsolation);
    }

    /**
     * Process user uploaded attachments using TaskFileDomainService.saveProjectFile.
     *
     * @param null|string $attachmentsStr Attachments JSON string
     * @param TaskEntity $taskEntity Task entity
     * @param DataIsolation $dataIsolation Data isolation object
     * @return array Processing result statistics
     */
    private function processUserAttachments(?string $attachmentsStr, TaskEntity $taskEntity, DataIsolation $dataIsolation): array
    {
        $stats = [
            'total' => 0,
            'success' => 0,
            'error' => 0,
        ];

        if (empty($attachmentsStr)) {
            return $stats;
        }

        try {
            // 1. Parse JSON
            $attachmentsData = json_decode($attachmentsStr, true);
            if (empty($attachmentsData) || ! is_array($attachmentsData)) {
                $this->logger->warning(sprintf(
                    'Attachment data format error, Task ID: %s, Original attachment data: %s',
                    $taskEntity->getTaskId(),
                    $attachmentsStr
                ));
                return $stats;
            }

            $stats['total'] = count($attachmentsData);

            $this->logger->debug(sprintf(
                'Starting to process user attachments using saveProjectFile, Task ID: %s, Attachment count: %d',
                $taskEntity->getTaskId(),
                $stats['total']
            ));

            // 2. Get project entity
            $projectEntity = $this->getAccessibleProject(
                $taskEntity->getProjectId(),
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode()
            );

            // 3. Process each attachment
            foreach ($attachmentsData as $attachment) {
                try {
                    $taskFileEntity = $this->convertAttachmentToTaskFileEntity($attachment, $taskEntity, $dataIsolation);
                    if ($taskFileEntity) {
                        $upsertedEntity = $this->taskFileDomainService->upsertProjectFileNode(
                            new UpsertProjectFileNodeDTO(
                                projectId: $projectEntity->getId(),
                                projectWorkDir: $projectEntity->getWorkDir(),
                                projectOrganizationCode: $projectEntity->getUserOrganizationCode(),
                                operatorUserId: $dataIsolation->getCurrentUserId(),
                                operatorOrganizationCode: $dataIsolation->getCurrentOrganizationCode(),
                                taskFileEntity: $taskFileEntity,
                                storageTypeOverride: StorageType::WORKSPACE->value,
                                isUpdated: false
                            )
                        );
                        // Dispatch AttachmentsProcessedEvent if a metadata file was upserted
                        if (ProjectFileConstant::isSetMetadataFile($upsertedEntity->getFileName())) {
                            event_dispatch(new AttachmentsProcessedEvent(
                                $upsertedEntity->getParentId(),
                                $upsertedEntity->getProjectId(),
                                $upsertedEntity->getTaskId()
                            ));
                        }
                        ++$stats['success'];

                        $this->logger->debug(sprintf(
                            'User attachment processed successfully using saveProjectFile, File ID: %d, File key: %s, Task ID: %s',
                            $taskFileEntity->getFileId(),
                            $taskFileEntity->getFileKey(),
                            $taskEntity->getTaskId()
                        ));
                    }
                } catch (Throwable $e) {
                    $this->logger->error(sprintf(
                        'Failed to process user attachment: %s, File ID: %s, Task ID: %s',
                        $e->getMessage(),
                        $attachment['file_id'] ?? 'Unknown',
                        $taskEntity->getTaskId()
                    ));
                    ++$stats['error'];
                }
            }

            $this->logger->debug(sprintf(
                'User attachment processing completed using saveProjectFile, Task ID: %s, Processing result: Total=%d, Success=%d, Failed=%d',
                $taskEntity->getTaskId(),
                $stats['total'],
                $stats['success'],
                $stats['error']
            ));

            return $stats;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Overall user attachment processing failed: %s, Task ID: %s',
                $e->getMessage(),
                $taskEntity->getTaskId()
            ));
            $stats['error'] = $stats['total'];
            return $stats;
        }
    }

    /**
     * Convert single attachment to TaskFileEntity.
     *
     * @param array $attachment Attachment data from JSON
     * @param TaskEntity $taskEntity Task entity
     * @param DataIsolation $dataIsolation Data isolation object
     * @return null|TaskFileEntity TaskFileEntity or null if conversion fails
     */
    private function convertAttachmentToTaskFileEntity(array $attachment, TaskEntity $taskEntity, DataIsolation $dataIsolation): ?TaskFileEntity
    {
        // Ensure required fields exist
        if (empty($attachment['file_key'])) {
            $this->logger->warning(sprintf(
                'Attachment missing required fields (file_id or file_key), Task ID: %s, Attachment content: %s',
                $taskEntity->getTaskId(),
                json_encode($attachment, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            ));
            return null;
        }

        // Create TaskFileEntity using attachment data directly
        $taskFileEntity = new TaskFileEntity();
        $taskFileEntity->setProjectId($taskEntity->getProjectId());
        $taskFileEntity->setTopicId($taskEntity->getTopicId());
        $taskFileEntity->setTaskId($taskEntity->getId());

        // Use attachment data directly
        $taskFileEntity->setFileKey($attachment['file_key']);
        $fileName = ! empty($attachment['filename']) ? $attachment['filename'] : (! empty($attachment['display_filename']) ? $attachment['display_filename'] : basename($attachment['file_key']));
        $taskFileEntity->setFileName($fileName);
        $taskFileEntity->setFileExtension(! empty($attachment['file_extension']) ? $attachment['file_extension'] : pathinfo($fileName, PATHINFO_EXTENSION));
        $taskFileEntity->setFileSize(! empty($attachment['file_size']) ? $attachment['file_size'] : 0);
        $taskFileEntity->setFileType(FileType::fromValue($attachment['file_tag'] ?? null)->value);
        $taskFileEntity->setStorageType(! empty($attachment['storage_type']) ? $attachment['storage_type'] : StorageType::WORKSPACE->value);
        $taskFileEntity->setSource(TaskFileSource::PROJECT_DIRECTORY);
        $taskFileEntity->setIsDirectory(false);
        $taskFileEntity->setSort(0);
        // parentId will be automatically handled by saveProjectFile

        return $taskFileEntity;
    }

    /**
     * 合并原有的 raw_content 和 dynamic_params.
     *
     * @param null|string $existingRawContent 原有的 raw_content
     * @param null|array $dynamicParams 动态参数
     * @return string 合并后的 JSON 字符串
     */
    private function mergeRawContentWithDynamicParams(?string $existingRawContent, ?array $dynamicParams): string
    {
        $existingRawContent = $existingRawContent ?? '';
        $dynamicParams = $dynamicParams ?? [];

        if (! empty($existingRawContent)) {
            // 尝试解析原有内容
            $rawData = json_decode($existingRawContent, true);
            if (is_array($rawData)) {
                // 原内容是 JSON，合并 dynamic_params
                $rawData = array_merge($rawData, $dynamicParams);
                return json_encode($rawData, JSON_UNESCAPED_UNICODE);
            }
            // 原内容不是 JSON，保留原样（不添加 dynamic_params）
            return $existingRawContent;
        }

        if (! empty($dynamicParams)) {
            // 没有原内容，只存 dynamic_params
            return json_encode($dynamicParams, JSON_UNESCAPED_UNICODE);
        }

        return '';
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\LongTermMemory\Enum\AppCodeEnum;
use App\Application\MCP\SupperMagicMCP\SupperMagicAgentMCPInterface;
use App\Application\MCP\SupperMagicMCP\SupperMagicAgentSkillInterface;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\LongTermMemory\Service\LongTermMemoryDomainService;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\ErrorCode\EventErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\EventException;
use App\Infrastructure\Core\Exception\EventExceptionBuilder;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\TaskMessageDTO;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\UserMessageDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskMessageEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ChatInstruction;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\CreationSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\FileType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\RunTaskBeforeEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AgentDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use Dtyq\SuperMagic\Infrastructure\Utils\TaskEventUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\TaskTerminationUtil;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Odin\Message\Role;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * Handle User Message Application Service
 * Responsible for handling the complete business process of users sending messages to agents.
 */
class HandleUserMessageAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    private ?SupperMagicAgentMCPInterface $supperMagicAgentMCP = null;

    private ?SupperMagicAgentSkillInterface $supperMagicAgentSkill = null;

    public function __construct(
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskDomainService $taskDomainService,
        private readonly MagicDepartmentUserDomainService $departmentUserDomainService,
        private readonly TopicTaskAppService $topicTaskAppService,
        private readonly ClientMessageAppService $clientMessageAppService,
        private readonly AgentDomainService $agentDomainService,
        private readonly LongTermMemoryDomainService $longTermMemoryDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly Redis $redis,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
        if (container()->has(SupperMagicAgentMCPInterface::class)) {
            $this->supperMagicAgentMCP = container()->get(SupperMagicAgentMCPInterface::class);
        }
        if (container()->has(SupperMagicAgentSkillInterface::class)) {
            $this->supperMagicAgentSkill = container()->get(SupperMagicAgentSkillInterface::class);
        }
    }

    public function handleInternalMessage(DataIsolation $dataIsolation, UserMessageDTO $dto): void
    {
        // Get topic information
        $topicEntity = $this->topicDomainService->getTopicByChatTopicId($dataIsolation, $dto->getChatTopicId());

        // 检查项目是否有权限
        $this->getAccessibleProject($topicEntity->getProjectId(), $dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode());

        if (is_null($topicEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }
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
        } else {
            // Send interrupt message directly to client
            $this->clientMessageAppService->sendInterruptMessageToClient(
                topicId: $topicEntity->getId(),
                taskId: (string) ($topicEntity->getCurrentTaskId() ?? '0'),
                chatTopicId: $dto->getChatTopicId(),
                chatConversationId: $dto->getChatConversationId(),
                interruptReason: $dto->getPrompt() ?: trans('task.agent_stopped')
            );
        }
    }

    /*
    * user send message to agent
    */
    public function getTaskContext(DataIsolation $dataIsolation, UserMessageDTO $userMessageDTO): TaskContext
    {
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
        return new TaskContext(
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
    }

    /*
    * user send message to agent
    */

    public function handleChatMessage(DataIsolation $dataIsolation, UserMessageDTO $userMessageDTO): void
    {
        $projectId = 0;
        $topicId = 0;
        $taskId = '';
        $errMsg = '';
        try {
            // Validate prompt length (MySQL text type max length is 65535 bytes, use 65000 for redundancy)
            $prompt = $userMessageDTO->getPrompt();
            $promptByteLength = strlen($prompt);
            if ($promptByteLength > 65000) {
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
            $topicId = $topicEntity->getId();
            $projectId = $topicEntity->getProjectId();
            // Check if this is the first task for the topic
            // If topic source is COPY, it's not the first task
            $isFirstTask = (empty($topicEntity->getCurrentTaskId()) || empty($topicEntity->getSandboxId()))
                && CreationSource::fromValue($topicEntity->getSource()) !== CreationSource::COPY;

            // 提前初始化 task_id
            $taskId = (string) IdGenerator::getSnowId();

            // 检查项目是否有权限
            $projectEntity = $this->getAccessibleProject($topicEntity->getProjectId(), $dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode());

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
                'topic_id' => $topicId,
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

            // Resolve agent_code before initTopicTask (no dependency on task initialization)
            $agentCode = $userMessageDTO->getExtra()?->getAgentCode() ?? '';

            // Initialize task
            $taskEntity = $this->taskDomainService->initTopicTask(
                dataIsolation: $dataIsolation,
                topicEntity: $topicEntity,
                taskEntity: $taskEntity,
                topicMode: $userMessageDTO->getTopicMode(),
                agentCode: $agentCode
            );

            // Save user information
            $this->saveUserMessage($dataIsolation, $taskEntity, $userMessageDTO);

            // Use resolved agent_code from topicEntity (handles SMA- prefix and persistence)
            $resolvedAgentCode = $topicEntity->getAgentCode();

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
                agentMode: $topicEntity->getTopicMode(),
                mcpConfig: [],
                modelId: $userMessageDTO->getModelId(),
                messageId: $userMessageDTO->getMessageId(),
                isFirstTask: $isFirstTask,
                extra: $userMessageDTO->getExtra(),
                agentCode: $resolvedAgentCode,
            );
            // Add MCP config to task context
            $mcpDataIsolation = MCPDataIsolation::create(
                $dataIsolation->getCurrentOrganizationCode(),
                $dataIsolation->getCurrentUserId()
            );
            $mcpConfig = $this->supperMagicAgentMCP?->createChatMessageRequestMcpConfig($mcpDataIsolation, $taskContext) ?? [];
            $taskContext = $taskContext->setMcpConfig($mcpConfig);

            // Write agent_code into dynamicConfig independently (always pass through, regardless of skills)
            $dynamicConfig = $taskContext->getDynamicConfig();
            $dynamicConfig['agent_code'] = $resolvedAgentCode;
            $taskContext = $taskContext->setDynamicConfig($dynamicConfig);

            // Append skill dynamic config independently (separate from agent_code and MCP config)
            $this->supperMagicAgentSkill?->appendSkillDynamicConfig($dataIsolation, $taskContext);

            // Add dynamic params to task context (if present)
            if ($userMessageDTO->getDynamicParams() !== null) {
                $existingDynamicConfig = $taskContext->getDynamicConfig();
                $taskContext = $taskContext->setDynamicConfig(array_merge($existingDynamicConfig, $userMessageDTO->getDynamicParams()));
            }

            // Create and send message to agent
            $sandboxID = $this->createAndSendMessageToAgent($dataIsolation, $taskContext, $projectEntity, $topicEntity);
            $taskEntity->setSandboxId($sandboxID);

            // Update task status
            if (TaskTerminationUtil::isTaskTerminated($this->redis, $this->logger, $taskEntity->getId())) {
                $result = $this->agentDomainService->getSandboxStatus($topicEntity->getSandboxId());
                if ($result->getStatus() === SandboxStatus::RUNNING) {
                    $this->agentDomainService->sendInterruptMessage($dataIsolation, $taskEntity->getSandboxId(), (string) $taskEntity->getId(), '');
                }
            } else {
                $this->topicTaskAppService->updateTaskStatus(
                    dataIsolation: $dataIsolation,
                    task: $taskEntity,
                    status: TaskStatus::RUNNING
                );
            }
        } catch (EventException $e) {
            $errMsg = $e->getMessage();
            $this->logger->warning(sprintf(
                'Initialize task, event processing failed: %s',
                $errMsg
            ));
            // Send error message directly to client
            $remindType = TaskEventUtil::getRemindTaskEventByCode($e->getCode());
            $this->clientMessageAppService->sendReminderMessageToClient(
                topicId: $topicId,
                taskId: $taskId,
                chatTopicId: $userMessageDTO->getChatTopicId(),
                chatConversationId: $userMessageDTO->getChatConversationId(),
                remind: $e->getMessage(),
                remindEvent: $remindType
            );
        } catch (Throwable $e) {
            $errMsg = $e->getMessage();
            $this->logger->error(sprintf(
                'handleChatMessage Error: %s, User: %s file: %s line: %s stack: %s',
                $errMsg,
                $dataIsolation->getCurrentUserId(),
                $e->getFile(),
                $e->getLine(),
                $e->getTraceAsString()
            ));
            // Send error message directly to client
            $this->clientMessageAppService->sendErrorMessageToClient(
                topicId: $topicId,
                taskId: $taskId,
                chatTopicId: $userMessageDTO->getChatTopicId(),
                chatConversationId: $userMessageDTO->getChatConversationId(),
                errorMessage: trans('task.initialize_error'),
            );
            throw new BusinessException('Initialize task failed', 500);
        }
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
        // Update task status
        $this->taskDomainService->updateTaskStatusBySandboxIds($updateSandboxIds, TaskStatus::ERROR, 'Synchronize sandbox status');

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
        $agentContext = $this->agentDomainService->buildInitAgentContext(
            dataIsolation: $dataIsolation,
            projectEntity: $projectEntity,
            topicEntity: $topicEntity,
            taskEntity: $taskContext->getTask(),
            sandboxId: (string) $topicEntity->getId(),
            memories: $memories
        );
        $sandboxId = $this->agentDomainService->ensureSandboxInitialized($dataIsolation, $agentContext);

        // 更新 topic 和 task 的 sandbox_id
        $this->topicDomainService->updateTopicSandboxId($dataIsolation, $taskContext->getTopicId(), $sandboxId);
        $this->taskDomainService->updateTaskSandboxId($dataIsolation, $taskContext->getTask()->getId(), $sandboxId);
        $taskContext->setSandboxId($sandboxId);

        $this->logger->info('[Sandbox][App] Sandbox initialized, sending message to agent', [
            'sandbox_id' => $sandboxId,
            'task_id' => $taskContext->getTask()->getId(),
        ]);

        // 发送消息到 agent
        $this->agentDomainService->sendChatMessage($dataIsolation, $taskContext);

        return $sandboxId;
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
                        $this->taskFileDomainService->saveProjectFile(
                            $dataIsolation,
                            $projectEntity,
                            $taskFileEntity,
                            StorageType::WORKSPACE->value,
                            false
                        );
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
        $taskFileEntity->setFileType(! empty($attachment['file_tag']) ? $attachment['file_tag'] : FileType::USER_UPLOAD->value);
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

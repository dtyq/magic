<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\LongTermMemory\Enum\AppCodeEnum;
use App\Application\MCP\SupperMagicMCP\SupperMagicAgentMCPInterface;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\LongTermMemory\Service\LongTermMemoryDomainService;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\EventException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\TaskMessageDTO;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\UserMessageDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskMessageEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ChatInstruction;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\FileType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\RunTaskBeforeEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AgentDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use Dtyq\SuperMagic\Infrastructure\Utils\TaskEventUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\TaskTerminationUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
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
        private readonly ProjectDomainService $projectDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
        if (container()->has(SupperMagicAgentMCPInterface::class)) {
            $this->supperMagicAgentMCP = container()->get(SupperMagicAgentMCPInterface::class);
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

        // Send interrupt message directly to client
        $this->clientMessageAppService->sendInterruptMessageToClient(
            topicId: $topicEntity->getId(),
            taskId: (string) $topicEntity->getCurrentTaskId() ?? '0',
            chatTopicId: $dto->getChatTopicId(),
            chatConversationId: $dto->getChatConversationId(),
            interruptReason: $dto->getPrompt() ?: trans('task.agent_stopped')
        );

        // Get sandbox status, if sandbox is running, send interrupt command
        $result = $this->agentDomainService->getSandboxStatus($topicEntity->getSandboxId());
        if ($result->getStatus() === SandboxStatus::RUNNING) {
            $this->agentDomainService->sendInterruptMessage($dataIsolation, $taskEntity->getSandboxId(), (string) $taskEntity->getId(), '任务已终止.');
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
        // Initialize task
        $taskEntity = $this->taskDomainService->initTopicTask(
            dataIsolation: $dataIsolation,
            topicEntity: $topicEntity,
            taskEntity: $taskEntity
        );

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
            agentMode: $userMessageDTO->getTopicMode(),
        );
    }

    /*
    * user send message to agent
    */

    public function handleChatMessage(DataIsolation $dataIsolation, UserMessageDTO $userMessageDTO): void
    {
        $topicId = 0;
        $taskId = '';
        $errMsg = '';
        try {
            // Get topic information
            $topicEntity = $this->topicDomainService->getTopicByChatTopicId($dataIsolation, $userMessageDTO->getChatTopicId());
            if (is_null($topicEntity)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
            }
            $topicId = $topicEntity->getId();

            // 检查项目是否有权限
            $projectEntity = $this->getAccessibleProject($topicEntity->getProjectId(), $dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode());

            // Check message before task starts
            $this->beforeHandleChatMessage($dataIsolation, $userMessageDTO->getInstruction(), $topicEntity, $userMessageDTO->getLanguage(), $userMessageDTO->getModelId());

            // Get task mode from DTO, fallback to topic's task mode if empty
            $taskMode = $userMessageDTO->getTaskMode();
            if ($taskMode === '') {
                $taskMode = $topicEntity->getTaskMode();
            }
            $data = [
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

            // Initialize task
            $taskEntity = $this->taskDomainService->initTopicTask(
                dataIsolation: $dataIsolation,
                topicEntity: $topicEntity,
                taskEntity: $taskEntity,
                topicMode: $userMessageDTO->getTopicMode()
            );
            $taskId = (string) $taskEntity->getId();

            // Save user information
            $this->saveUserMessage($dataIsolation, $taskEntity, $userMessageDTO);

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
            );
            // Add MCP config to task context
            $mcpDataIsolation = MCPDataIsolation::create(
                $dataIsolation->getCurrentOrganizationCode(),
                $dataIsolation->getCurrentUserId()
            );
            $mcpConfig = $this->supperMagicAgentMCP?->createChatMessageRequestMcpConfig($mcpDataIsolation, $taskContext) ?? [];
            $taskContext = $taskContext->setMcpConfig($mcpConfig);

            // Create and send message to agent
            $sandboxID = $this->createAndSendMessageToAgent($dataIsolation, $taskContext, $projectEntity);
            $taskEntity->setSandboxId($sandboxID);

            // Update task status
            if (TaskTerminationUtil::isTaskTerminated($this->redis, $this->logger, $taskEntity->getId())) {
                $result = $this->agentDomainService->getSandboxStatus($topicEntity->getSandboxId());
                if ($result->getStatus() === SandboxStatus::RUNNING) {
                    $this->agentDomainService->sendInterruptMessage($dataIsolation, $taskEntity->getSandboxId(), (string) $taskEntity->getId(), '任务已终止.');
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
    private function beforeHandleChatMessage(DataIsolation $dataIsolation, ChatInstruction $instruction, TopicEntity $topicEntity, string $language, string $modelId = ''): void
    {
        // get the current task run count
        $currentTaskRunCount = $this->pullUserTopicStatus($dataIsolation);
        // step by zero
        $taskRound = $this->taskDomainService->getTaskNumByTopicId($topicEntity->getId());
        // get department ids
        $departmentIds = [];
        $departmentUserEntities = $this->departmentUserDomainService->getDepartmentUsersByUserIds([$dataIsolation->getCurrentUserId()], $dataIsolation);
        foreach ($departmentUserEntities as $departmentUserEntity) {
            $departmentIds[] = $departmentUserEntity->getDepartmentId();
        }
        AsyncEventUtil::dispatch(new RunTaskBeforeEvent($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId(), $topicEntity->getId(), $taskRound, $currentTaskRunCount, $departmentIds, $language, $modelId));
        $this->logger->info(sprintf('Dispatched task start event, topic id: %s, round: %d, currentTaskRunCount: %d (after real status check)', $topicEntity->getId(), $taskRound, $currentTaskRunCount));
    }

    /**
     * Update topics and tasks by pulling sandbox status.
     */
    private function pullUserTopicStatus(DataIsolation $dataIsolation): int
    {
        // Get user's running tasks
        $topicEntities = $this->topicDomainService->getUserRunningTopics($dataIsolation);
        // Get sandbox IDs
        $sandboxIds = [];
        foreach ($topicEntities as $topicEntityItem) {
            $sandboxId = $topicEntityItem->getSandboxId();
            if ($sandboxId === '') {
                continue;
            }
            $sandboxIds[] = $sandboxId;
        }
        if (count($sandboxIds) === 0) {
            return 0;
        }
        // Batch query status
        $result = $this->agentDomainService->getBatchSandboxStatus($sandboxIds);

        // Get running sandbox IDs from remote result
        $runningSandboxIds = $result->getRunningSandboxIds();

        // Find sandbox IDs that are not running (including missing ones)
        $updateSandboxIds = array_diff($sandboxIds, $runningSandboxIds);
        // Update topic status
        $this->topicDomainService->updateTopicStatusBySandboxIds($updateSandboxIds, TaskStatus::Suspended);
        // Update task status
        $this->taskDomainService->updateTaskStatusBySandboxIds($updateSandboxIds, TaskStatus::Suspended, 'Synchronize sandbox status');

        $initialRunningCount = count($topicEntities);
        $suspendedCount = count($updateSandboxIds); // Number of tasks to suspend
        return $initialRunningCount - $suspendedCount; // Number of tasks actually running
    }

    /**
     * Initialize agent environment.
     */
    private function createAndSendMessageToAgent(DataIsolation $dataIsolation, TaskContext $taskContext, ProjectEntity $projectEntity): string
    {
        // Create sandbox container
        $fullPrefix = $this->taskFileDomainService->getFullPrefix($projectEntity->getUserOrganizationCode());
        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $taskContext->getTask()->getWorkDir());
        if (empty($taskContext->getSandboxId())) {
            $sandboxId = (string) $taskContext->getTopicId();
        } else {
            $sandboxId = $taskContext->getSandboxId();
        }
        $sandboxId = $this->agentDomainService->createSandbox($dataIsolation, (string) $taskContext->getProjectId(), $sandboxId, $fullWorkdir);
        // update topic sandbox id
        $this->topicDomainService->updateTopicSandboxId($dataIsolation, $taskContext->getTopicId(), $sandboxId);
        $this->taskDomainService->updateTaskSandboxId($dataIsolation, $taskContext->getTask()->getId(), $sandboxId);
        $taskContext->setSandboxId($sandboxId);

        // user long term memory
        $memory = $this->longTermMemoryDomainService->getEffectiveMemoriesForPrompt(
            $dataIsolation->getCurrentOrganizationCode(),
            AppCodeEnum::SUPER_MAGIC->value,
            $dataIsolation->getCurrentUserId(),
            (string) $taskContext->getProjectId(),
        );

        // Initialize agent
        $this->agentDomainService->initializeAgent($dataIsolation, $taskContext, $memory, projectOrganizationCode: $projectEntity->getUserOrganizationCode());

        // Wait for workspace to be ready
        $this->agentDomainService->waitForWorkspaceReady($taskContext->getSandboxId());

        // Send message to agent
        $this->agentDomainService->sendChatMessage($dataIsolation, $taskContext);

        // Send message to agent
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

        // Create TaskMessageDTO for user message
        $taskMessageDTO = new TaskMessageDTO(
            taskId: (string) $taskEntity->getId(),
            role: Role::User->value,
            senderUid: $dataIsolation->getCurrentUserId(),
            receiverUid: $userMessageDTO->getAgentUserId(),
            messageType: 'chat',
            content: $taskEntity->getPrompt(),
            rawContent: $userMessageDTO->getRawContent() ?? '',
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
        $this->logger->info(sprintf('Saved user message, task id: %s, message id: %s, im seq id: %d', $taskEntity->getId(), $taskMessageEntity->getId(), $taskMessageEntity->getImSeqId()));
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

            $this->logger->info(sprintf(
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

                        $this->logger->info(sprintf(
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

            $this->logger->info(sprintf(
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
}

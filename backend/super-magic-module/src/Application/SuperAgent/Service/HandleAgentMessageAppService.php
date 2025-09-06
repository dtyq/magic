<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\Exception\EventException;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\TaskMessageDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentEventEnum;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskMessageEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ChatInstruction;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\FileType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\AttachmentsProcessedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\RunTaskCallbackEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AgentDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskMessageDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use Dtyq\SuperMagic\Infrastructure\Utils\FileMetadataUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\LockKeyManageUtils;
use Dtyq\SuperMagic\Infrastructure\Utils\TaskEventUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\TaskTerminationUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\ToolProcessor;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\TopicTaskMessageDTO;
use Exception;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Odin\Message\Role;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * Handle Agent Message Application Service
 * Responsible for orchestrating the complete business process of handling Agent callback messages.
 */
class HandleAgentMessageAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly TopicTaskAppService $topicTaskAppService,
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskDomainService $taskDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly TaskMessageDomainService $taskMessageDomainService,
        private readonly FileProcessAppService $fileProcessAppService,
        private readonly ClientMessageAppService $clientMessageAppService,
        private readonly AgentDomainService $agentDomainService,
        private readonly LockerInterface $locker,
        private readonly Redis $redis,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * Handle Agent Message - Main Entry Point
     * Responsible for overall business process orchestration.
     * agent send message to user.
     * @throws Throwable
     */
    public function handleAgentMessage(TopicTaskMessageDTO $messageDTO): void
    {
        $this->logger->debug(sprintf(
            'Starting to process topic task message, task_id: %s, message content: %s',
            $messageDTO->getPayload()->getTaskId() ?? '',
            json_encode($messageDTO->toArray(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        ));

        try {
            // 1. Preparation phase: create data isolation and get entities
            $dataIsolation = $this->prepareDataIsolation($messageDTO);
            $topicEntity = $this->getTopicEntity($messageDTO, $dataIsolation);
            $taskEntity = $this->getTaskEntity($topicEntity);

            // Create task context
            $taskContext = $this->createTaskContext($dataIsolation, $taskEntity, $messageDTO);

            // 2. Message processing core
            $this->processAgentMessage($messageDTO, $taskContext);

            // 3. Status update
            $this->updateTaskStatus($messageDTO, $taskContext);

            // 4. Event dispatch
            $this->dispatchCallbackEvent($messageDTO, $taskContext, $topicEntity);

            $this->logger->info(sprintf(
                'Topic task message processing completed, message_id: %s',
                $messageDTO->getPayload()->getMessageId()
            ));
        } catch (EventException $e) {
            $this->handleEventException($e, $messageDTO, $taskContext ?? null, $topicEntity ?? null);
            throw $e;
        } catch (Throwable $e) {
            $this->handleGeneralException($e, $messageDTO);
            throw $e;
        }
    }

    /**
     * Batch handle Agent messages for a specific topic.
     * 批量处理指定话题的消息，按seq_id顺序处理.
     *
     * @param int $topicId 话题ID
     * @return int 处理的消息数量
     */
    public function batchHandleAgentMessage(int $topicId, ?int $taskId): int
    {
        $this->logger->info(sprintf('开始批量处理topic %d的消息', $topicId));

        // 1. 获取待处理的消息列表（按seq_id升序排列）
        $processableMessages = $this->taskMessageDomainService->findProcessableMessages(topicId: $topicId, taskId: $taskId);

        if (empty($processableMessages)) {
            $this->logger->info(sprintf('topic %d 没有待处理的消息', $topicId));
            return 0;
        }

        $this->logger->info(sprintf(
            'topic %d 找到 %d 条待处理消息，开始按顺序处理',
            $topicId,
            count($processableMessages)
        ));

        $processedCount = 0;
        $isTermination = false;

        // 2. 按顺序逐条处理消息
        foreach ($processableMessages as $messageEntity) {
            try {
                /*
                 * @var TaskMessageEntity $messageEntity
                 */
                // 更新状态为处理中
                $this->taskMessageDomainService->updateProcessingStatus(
                    id: $messageEntity->getId(),
                    processingStatus: TaskMessageEntity::PROCESSING_STATUS_PROCESSING
                );

                // 检查任务是否已终止
                $currentTaskId = $messageEntity->getTaskId();
                if (TaskTerminationUtil::isTaskTerminated($this->redis, $this->logger, $currentTaskId) || $messageEntity->getEvent() === AgentEventEnum::AGENT_SUSPENDED) {
                    $isTermination = true;
                    $this->logger->info(sprintf(
                        '任务 %s 已终止，跳过消息处理 message_id: %s',
                        $currentTaskId,
                        $messageEntity->getMessageId()
                    ));

                    // 标记为已完成
                    $this->taskMessageDomainService->updateProcessingStatus(
                        id: $messageEntity->getId(),
                        processingStatus: TaskMessageEntity::PROCESSING_STATUS_COMPLETED,
                        errorMessage: '任务已终止'
                    );
                    continue;
                }

                // 从raw_data重建TopicTaskMessageDTO
                $rawData = json_decode($messageEntity->getRawData() ?? '{}', true);
                if (empty($rawData)) {
                    throw new RuntimeException('无法解析原始消息数据');
                }

                $messageDTO = TopicTaskMessageDTO::fromArray($rawData);

                // 调用原有的处理逻辑
                $this->handleAgentMessage($messageDTO);

                // 标记为已完成
                $this->taskMessageDomainService->updateProcessingStatus(
                    id: $messageEntity->getId(),
                    processingStatus: TaskMessageEntity::PROCESSING_STATUS_COMPLETED
                );

                ++$processedCount;

                $this->logger->info(sprintf(
                    '成功处理消息 message_id: %s, seq_id: %d',
                    $messageEntity->getMessageId(),
                    $messageEntity->getSeqId()
                ));
            } catch (EventException $e) {
                $isTermination = true;
                $this->logger->error(sprintf(
                    '处理消息失败 message_id: %s, seq_id: %d, error: %s',
                    $messageEntity->getMessageId(),
                    $messageEntity->getSeqId(),
                    $e->getMessage()
                ));
                break;
            } catch (Throwable $e) {
                // 处理失败，更新重试次数和错误信息
                $newRetryCount = $messageEntity->getRetryCount() + 1;

                $this->taskMessageDomainService->updateProcessingStatus(
                    id: $messageEntity->getId(),
                    processingStatus: TaskMessageEntity::PROCESSING_STATUS_FAILED,
                    errorMessage: $e->getMessage(),
                    retryCount: $newRetryCount
                );

                $this->logger->error(sprintf(
                    '处理消息失败 message_id: %s, seq_id: %d, error: %s, retry_count: %d',
                    $messageEntity->getMessageId(),
                    $messageEntity->getSeqId(),
                    $e->getMessage(),
                    $newRetryCount
                ));
            }
        }

        $this->logger->info(sprintf(
            'topic %d 批量处理完成，成功处理 %d 条消息',
            $topicId,
            $processedCount
        ));

        if ($isTermination && ! empty($taskId)) {
            TaskTerminationUtil::setTerminationFlag($this->redis, $this->logger, $taskId);
            $this->logger->info(sprintf(
                '任务 %s 已终止，停止批量处理消息',
                $taskId
            ));
        }

        return $processedCount;
    }

    /**
     * Send internal message to sandbox.
     */
    public function sendInternalMessageToSandbox(
        DataIsolation $dataIsolation,
        TaskContext $taskContext,
        TopicEntity $topicEntity,
        string $msg = ''
    ): void {
        // Update task status
        $this->topicTaskAppService->updateTaskStatus(
            dataIsolation: $dataIsolation,
            task: $taskContext->getTask(),
            status: TaskStatus::Suspended,
            errMsg: $msg,
        );

        // Get sandbox status, if sandbox is running, send interrupt command
        $result = $this->agentDomainService->getSandboxStatus($topicEntity->getSandboxId());
        if ($result->getStatus() === SandboxStatus::RUNNING) {
            $this->agentDomainService->sendInterruptMessage(
                $dataIsolation,
                $taskContext->getTask()->getSandboxId(),
                (string) $taskContext->getTask()->getId(),
                $msg
            );
        } else {
            // Send interrupt message directly to client
            $this->clientMessageAppService->sendInterruptMessageToClient(
                topicId: $topicEntity->getId(),
                taskId: $topicEntity->getCurrentTaskId() ?? '0',
                chatTopicId: $taskContext->getChatTopicId(),
                chatConversationId: $taskContext->getChatConversationId(),
                interruptReason: $msg
            );
            TaskTerminationUtil::setTerminationFlag($this->redis, $this->logger, $taskContext->getTask()->getId());
        }
    }

    /**
     * Prepare data isolation object.
     */
    private function prepareDataIsolation(TopicTaskMessageDTO $messageDTO): DataIsolation
    {
        return DataIsolation::create(
            $messageDTO->getMetadata()->getOrganizationCode(),
            $messageDTO->getMetadata()->getUserId()
        );
    }

    /**
     * Get topic entity.
     */
    private function getTopicEntity(TopicTaskMessageDTO $messageDTO, DataIsolation $dataIsolation): TopicEntity
    {
        $topicEntity = $this->topicDomainService->getTopicByChatTopicId(
            $dataIsolation,
            $messageDTO->getMetadata()->getChatTopicId()
        );

        if (is_null($topicEntity)) {
            throw new RuntimeException(sprintf(
                'Topic not found by chat topic id: %s',
                $messageDTO->getMetadata()->getChatTopicId()
            ));
        }

        return $topicEntity;
    }

    /**
     * Get task entity.
     */
    private function getTaskEntity(TopicEntity $topicEntity): TaskEntity
    {
        $taskEntity = $this->taskDomainService->getTaskById($topicEntity->getCurrentTaskId());

        if (is_null($taskEntity)) {
            throw new RuntimeException(sprintf(
                'Task not found by task id: %s',
                $topicEntity->getCurrentTaskId() ?? ''
            ));
        }

        return $taskEntity;
    }

    /**
     * Create task context.
     */
    private function createTaskContext(
        DataIsolation $dataIsolation,
        TaskEntity $taskEntity,
        TopicTaskMessageDTO $messageDTO
    ): TaskContext {
        return new TaskContext(
            task: $taskEntity,
            dataIsolation: $dataIsolation,
            chatConversationId: $messageDTO->getMetadata()?->getChatConversationId(),
            chatTopicId: $messageDTO->getMetadata()?->getChatTopicId(),
            agentUserId: $messageDTO->getMetadata()?->getAgentUserId(),
            sandboxId: $messageDTO->getMetadata()?->getSandboxId(),
            taskId: $messageDTO->getPayload()?->getTaskId(),
            instruction: ChatInstruction::tryFrom($messageDTO->getMetadata()?->getInstruction()) ?? ChatInstruction::Normal
        );
    }

    /**
     * Process Agent Message - Message Processing Core.
     */
    private function processAgentMessage(TopicTaskMessageDTO $messageDTO, TaskContext $taskContext): void
    {
        // 1. Parse and validate message
        $messageData = $this->parseMessageContent($messageDTO);

        // 2. Process all attachments
        $this->processAllAttachments($messageData, $taskContext);

        // 兜底操作，如果当前任务的消息已经是完成
        if ($this->isSendMessage($taskContext)) {
            // 3. Record AI message
            $this->recordAgentMessage($messageData, $taskContext);

            // 4. Send message to client
            $this->sendMessageToClient($messageData, $taskContext);
        }
    }

    private function isSendMessage(TaskContext $taskContext): bool
    {
        $taskEntity = $this->taskDomainService->getTaskById($taskContext->getTask()->getId());
        if ($taskEntity === null) {
            $this->logger->error('Check Send Message, Task not found: ' . $taskContext->getTask()->getId());
            return false;
        }
        if ($taskEntity->getStatus() === TaskStatus::FINISHED) {
            $this->logger->error('Check Send Message, Task is finished: ' . $taskContext->getTask()->getId());
            return false;
        }

        // Check if task has been terminated by user
        if (TaskTerminationUtil::isTaskTerminated($this->redis, $this->logger, $taskEntity->getId())) {
            return false;
        }

        return true;
    }

    /**
     * Update task status.
     */
    private function updateTaskStatus(TopicTaskMessageDTO $messageDTO, TaskContext $taskContext): void
    {
        $status = $messageDTO->getPayload()->getStatus();
        $taskStatus = TaskStatus::tryFrom($status) ?? TaskStatus::ERROR;

        if (TaskStatus::tryFrom($status)) {
            $this->topicTaskAppService->updateTaskStatus(
                dataIsolation: $taskContext->getDataIsolation(),
                task: $taskContext->getTask(),
                status: $taskStatus,
                errMsg: ''
            );
        }
    }

    /**
     * Dispatch callback event.
     */
    private function dispatchCallbackEvent(
        TopicTaskMessageDTO $messageDTO,
        TaskContext $taskContext,
        TopicEntity $topicEntity
    ): void {
        AsyncEventUtil::dispatch(new RunTaskCallbackEvent(
            $taskContext->getCurrentOrganizationCode(),
            $taskContext->getCurrentUserId(),
            $taskContext->getTopicId(),
            $topicEntity->getTopicName(),
            $taskContext->getTask()->getId(),
            $messageDTO,
            $messageDTO->getMetadata()->getLanguage()
        ));
    }

    /**
     * Parse message content.
     */
    private function parseMessageContent(TopicTaskMessageDTO $messageDTO): array
    {
        $payload = $messageDTO->getPayload();

        $messageType = $payload->getType() ?: 'unknown';
        $content = $payload->getContent();
        $status = $payload->getStatus() ?: TaskStatus::RUNNING->value;
        $tool = $payload->getTool() ?? [];
        $steps = $payload->getSteps() ?? [];
        $event = $payload->getEvent();
        $attachments = $payload->getAttachments() ?? [];
        $showInUi = $payload->getShowInUi() ?? true;
        $messageId = $payload->getMessageId();

        // Validate message type
        if (! MessageType::isValid($messageType)) {
            $this->logger->warning(sprintf(
                'Received unknown message type: %s, task_id: %s',
                $messageType,
                $messageDTO->getPayload()->getTaskId()
            ));
        }

        return [
            'messageType' => $messageType,
            'content' => $content,
            'status' => $status,
            'tool' => $tool,
            'steps' => $steps,
            'event' => $event,
            'attachments' => $attachments,
            'showInUi' => $showInUi,
            'messageId' => $messageId,
        ];
    }

    /**
     * Process all attachments - Unified attachment processing entry point.
     */
    private function processAllAttachments(array &$messageData, TaskContext $taskContext): void
    {
        try {
            /** @var TaskFileEntity[] $processedEntities */
            $processedEntities = [];
            // Process tool attachments
            if (! empty($messageData['tool']['attachments'])) {
                $toolProcessedEntities = $this->processToolAttachments($messageData['tool'], $taskContext);
                $processedEntities = array_merge($processedEntities, $toolProcessedEntities);
                // Use tool processor to handle file ID matching
                ToolProcessor::processToolAttachments($messageData['tool']);
            }

            // Process message attachments and collect processed entities
            if (! empty($messageData['attachments'])) {
                $messageProcessedEntities = $this->processMessageAttachments($messageData['attachments'], $taskContext);
                $processedEntities = array_merge($processedEntities, $messageProcessedEntities);
            }

            // Process tool content storage
            $this->processToolContentStorage($messageData['tool'], $taskContext);

            // Special status handling: generate output content tool when task is finished
            if ($messageData['status'] === TaskStatus::FINISHED->value) {
                $outputTool = ToolProcessor::generateOutputContentTool($messageData['attachments']);
                if ($outputTool !== null) {
                    $messageData['tool'] = $outputTool;
                }
            }

            // Dispatch AttachmentsProcessedEvent for special file processing (like project.js)
            if (! empty($processedEntities)) {
                AsyncEventUtil::dispatch(new AttachmentsProcessedEvent($processedEntities, $taskContext));
                $this->logger->info(sprintf(
                    'Dispatched AttachmentsProcessedEvent for %d processed attachments, task_id: %s',
                    count($processedEntities),
                    $taskContext->getTask()->getTaskId()
                ));
            }
        } catch (Exception $e) {
            $this->logger->error(sprintf('Exception occurred while processing attachments: %s', $e->getMessage()));
        }
    }

    /**
     * Record agent message.
     */
    private function recordAgentMessage(array $messageData, TaskContext $taskContext): void
    {
        $task = $taskContext->getTask();

        // 先查找是否已存在该消息（通过topic_id + message_id）
        $existingMessage = $this->taskMessageDomainService->findByTopicIdAndMessageId(
            $task->getTopicId(),
            $messageData['messageId']
        );

        if ($existingMessage) {
            // 消息已存在，直接在 app 层更新现有实体的字段
            $this->logger->info(sprintf(
                '消息已存在，更新业务字段 topic_id: %d, message_id: %s',
                $task->getTopicId(),
                $messageData['messageId']
            ));

            // 直接更新现有实体的字段
            $existingMessage->setSenderType(Role::Assistant->value)
                ->setSenderUid($taskContext->getAgentUserId())
                ->setReceiverUid($task->getUserId())
                ->setType($messageData['messageType'])
                ->setTaskId((string) $task->getId())
                ->setStatus($messageData['status'])
                ->setContent($messageData['content'])
                ->setSteps($messageData['steps'])
                ->setTool($messageData['tool'])
                ->setAttachments($messageData['attachments'])
                ->setEvent($messageData['event'])
                ->setShowInUi($messageData['showInUi']);

            $this->taskMessageDomainService->updateExistingMessage($existingMessage);
        } else {
            // 消息不存在，创建新实体并插入新记录
            $this->logger->info(sprintf(
                '消息不存在，插入新记录 topic_id: %d, message_id: %s',
                $task->getTopicId(),
                $messageData['messageId']
            ));

            // 创建 TaskMessageDTO for AI message
            $taskMessageDTO = new TaskMessageDTO(
                taskId: (string) $task->getId(),
                role: Role::Assistant->value,
                senderUid: $taskContext->getAgentUserId(),
                receiverUid: $task->getUserId(),
                messageType: $messageData['messageType'],
                content: $messageData['content'],
                status: $messageData['status'],
                steps: $messageData['steps'],
                tool: $messageData['tool'],
                topicId: $task->getTopicId(),
                event: $messageData['event'],
                attachments: $messageData['attachments'],
                mentions: null,
                showInUi: $messageData['showInUi'],
                messageId: $messageData['messageId']
            );

            $taskMessageEntity = TaskMessageEntity::taskMessageDTOToTaskMessageEntity($taskMessageDTO);
            $this->taskDomainService->recordTaskMessage($taskMessageEntity);
        }
    }

    /**
     * Send message to client.
     */
    private function sendMessageToClient(array $messageData, TaskContext $taskContext): void
    {
        if (! $messageData['showInUi']) {
            return;
        }

        $task = $taskContext->getTask();

        $this->clientMessageAppService->sendMessageToClient(
            topicId: $task->getTopicId(),
            taskId: (string) $task->getId(),
            chatTopicId: $taskContext->getChatTopicId(),
            chatConversationId: $taskContext->getChatConversationId(),
            content: $messageData['content'],
            messageType: $messageData['messageType'],
            status: $messageData['status'],
            event: $messageData['event'],
            steps: $messageData['steps'],
            tool: $messageData['tool'],
            attachments: $messageData['attachments']
        );
    }

    /**
     * Process tool attachments, save them to task file table and chat file table.
     * @return TaskFileEntity[] Array of successfully processed file entities
     */
    private function processToolAttachments(?array &$tool, TaskContext $taskContext): array
    {
        if (empty($tool['attachments'])) {
            return [];
        }

        $task = $taskContext->getTask();
        $dataIsolation = $taskContext->getDataIsolation();
        $processedEntities = [];

        foreach ($tool['attachments'] as $i => $iValue) {
            $result = $this->processSingleAttachment(
                $iValue,
                $task,
                $dataIsolation
            );

            $tool['attachments'][$i] = $result['attachment'];

            // Collect successfully processed entities
            if ($result['taskFileEntity'] !== null) {
                $processedEntities[] = $result['taskFileEntity'];
            }
        }

        return $processedEntities;
    }

    /**
     * Process message attachments.
     * @return TaskFileEntity[] Array of successfully processed file entities
     */
    private function processMessageAttachments(?array &$attachments, TaskContext $taskContext): array
    {
        if (empty($attachments)) {
            return [];
        }

        $task = $taskContext->getTask();
        $dataIsolation = $taskContext->getDataIsolation();
        $processedEntities = [];

        foreach ($attachments as $i => $iValue) {
            $result = $this->processSingleAttachment(
                $iValue,
                $task,
                $dataIsolation
            );

            // Update the attachment array with processed attachment
            $attachments[$i] = $result['attachment'];

            // Collect successfully processed entities
            if ($result['taskFileEntity'] !== null) {
                $processedEntities[] = $result['taskFileEntity'];
            }
        }

        return $processedEntities;
    }

    /**
     * Process single attachment, save to task file table and chat file table.
     * @return array{attachment: array, taskFileEntity: null|TaskFileEntity}
     */
    private function processSingleAttachment(array $attachment, TaskEntity $task, DataIsolation $dataIsolation): array
    {
        // Check required fields
        if (empty($attachment['file_key']) || empty($attachment['file_extension']) || empty($attachment['filename'])) {
            $this->logger->warning(sprintf(
                'Attachment information incomplete, skipping processing, task_id: %s, attachment content: %s',
                $task->getTaskId(),
                json_encode($attachment, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            ));
            return ['attachment' => [], 'taskFileEntity' => null];
        }

        // Setup spin lock for file_key to prevent concurrent processing
        $lockKey = LockKeyManageUtils::getFileKeyLock($attachment['file_key']);
        $lockOwner = IdGenerator::getUniqueId32();
        $lockExpireSeconds = 5; // 5 seconds timeout as requested
        $lockAcquired = false;

        try {
            // Attempt to acquire distributed spin lock
            $lockAcquired = $this->locker->spinLock($lockKey, $lockOwner, $lockExpireSeconds);
            if (! $lockAcquired) {
                $this->logger->warning(sprintf(
                    'Failed to acquire lock for file_key processing: %s, task_id: %s, filename: %s',
                    $attachment['file_key'],
                    $task->getTaskId(),
                    $attachment['filename']
                ));
                return ['attachment' => $attachment, 'taskFileEntity' => null];
            }

            $this->logger->info(sprintf(
                'Lock acquired for file_key processing: %s, task_id: %s, filename: %s',
                $attachment['file_key'],
                $task->getTaskId(),
                $attachment['filename']
            ));

            // 1. Get context information for directory creation
            $projectId = $task->getProjectId();
            $workDir = $task->getWorkDir();

            // 2. Call domain service to get correct parent_id
            $parentId = $this->taskFileDomainService->findOrCreateDirectoryAndGetParentId(
                $projectId,
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode(),
                $attachment['file_key'],
                $workDir
            );

            // 3. Call FileProcessAppService with parentId
            if (WorkDirectoryUtil::isSnapshotFile($attachment['file_key'])) {
                $storageType = StorageType::SNAPSHOT->value;
            } else {
                $storageType = StorageType::WORKSPACE->value;
            }
            /** @var TaskFileEntity $taskFileEntity */
            [$fileId, $taskFileEntity] = $this->fileProcessAppService->processFileByFileKey(
                $attachment['file_key'],
                $dataIsolation,
                $attachment,
                $task->getProjectId(),
                $task->getTopicId(),
                (int) $task->getId(),
                $attachment['file_tag'] ?? FileType::PROCESS->value,
                $storageType, // Default storage type
                TaskFileSource::AGENT->value,  // Default source
                $parentId // Pass the parent_id
            );

            // Save file ID to attachment information
            $attachment['file_id'] = (string) $fileId;
            $attachment['topic_id'] = $task->getTopicId();
            $attachment['updated_at'] = $taskFileEntity->getUpdatedAt();
            $attachment['metadata'] = FileMetadataUtil::getMetadataObject($taskFileEntity->getMetadata());

            $this->logger->info(sprintf(
                'Attachment processed successfully with lock protection, file_id: %s, task_id: %s, filename: %s',
                $fileId,
                $task->getTaskId(),
                $attachment['filename']
            ));

            return ['attachment' => $attachment, 'taskFileEntity' => $taskFileEntity];
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Exception processing attachment with lock protection: %s, filename: %s, task_id: %s, file_key: %s',
                $e->getMessage(),
                $attachment['filename'] ?? 'unknown',
                $task->getTaskId(),
                $attachment['file_key']
            ));

            return ['attachment' => $attachment, 'taskFileEntity' => null];
        } finally {
            // Ensure lock is always released
            if ($lockAcquired) {
                if ($this->locker->release($lockKey, $lockOwner)) {
                    $this->logger->debug(sprintf(
                        'Lock released for file_key processing: %s, task_id: %s, filename: %s',
                        $attachment['file_key'],
                        $task->getTaskId(),
                        $attachment['filename']
                    ));
                } else {
                    $this->logger->error(sprintf(
                        'Failed to release lock for file_key processing: %s, task_id: %s, filename: %s. Manual intervention may be required.',
                        $attachment['file_key'],
                        $task->getTaskId(),
                        $attachment['filename']
                    ));
                }
            }
        }
    }

    /**
     * Process tool content storage to object storage.
     */
    private function processToolContentStorage(array &$tool, TaskContext $taskContext): void
    {
        // Check if object storage is enabled
        $objectStorageEnabled = config('super-magic.task.tool_message.object_storage_enabled', true);
        if (! $objectStorageEnabled) {
            return;
        }

        // Check tool content
        $content = $tool['detail']['data']['content'] ?? '';
        if (empty($content)) {
            return;
        }

        // Check if content length reaches threshold
        $minContentLength = config('super-magic.task.tool_message.min_content_length', 200);
        if (strlen($content) < $minContentLength) {
            return;
        }

        $this->logger->info(sprintf(
            'Starting to process tool content storage, tool_id: %s, content length: %d',
            $tool['id'] ?? 'unknown',
            strlen($content)
        ));

        try {
            // Build parameters
            $fileName = $tool['detail']['data']['file_name'] ?? 'tool_content.txt';
            $fileExtension = pathinfo($fileName, PATHINFO_EXTENSION) ?: 'txt';
            $fileKey = ($tool['id'] ?? 'unknown') . '.' . $fileExtension;
            $task = $taskContext->getTask();
            $workDir = WorkDirectoryUtil::getTopicMessageDir($task->getUserId(), $task->getProjectId(), $task->getTopicId());

            // Call FileProcessAppService to save content
            $fileId = $this->fileProcessAppService->saveToolMessageContent(
                fileName: $fileName,
                workDir: $workDir,
                fileKey: $fileKey,
                content: $content,
                dataIsolation: $taskContext->getDataIsolation(),
                projectId: $task->getProjectId(),
                topicId: $task->getTopicId(),
                taskId: (int) $task->getId()
            );

            // Modify tool data structure
            $tool['detail']['data']['file_id'] = (string) $fileId;
            $tool['detail']['data']['content'] = ''; // Clear content

            $this->logger->info(sprintf(
                'Tool content storage completed, tool_id: %s, file_id: %d, original content length: %d',
                $tool['id'] ?? 'unknown',
                $fileId,
                strlen($content)
            ));
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Tool content storage failed: %s, tool_id: %s, content length: %d',
                $e->getMessage(),
                $tool['id'] ?? 'unknown',
                strlen($content)
            ));
            // Storage failure does not affect main process, only log error
        }
    }

    /**
     * Handle event exception.
     */
    private function handleEventException(
        EventException $e,
        TopicTaskMessageDTO $messageDTO,
        ?TaskContext $taskContext,
        ?TopicEntity $topicEntity
    ): void {
        // 收到异常，设置中断信息
        $this->logger->error(sprintf('Exception occurred while processing message event callback: %s', $e->getMessage()));

        $dataIsolation = $taskContext->getDataIsolation();
        // Update task status
        $this->topicTaskAppService->updateTaskStatus(
            dataIsolation: $dataIsolation,
            task: $taskContext->getTask(),
            status: TaskStatus::Suspended,
            errMsg: $e->getMessage(),
        );

        $remindType = TaskEventUtil::getRemindTaskEventByCode($e->getCode());
        // Send remind message directly to client
        $this->clientMessageAppService->sendReminderMessageToClient(
            topicId: $topicEntity->getId(),
            taskId: (string) $topicEntity->getCurrentTaskId() ?? '0',
            chatTopicId: $taskContext->getChatTopicId(),
            chatConversationId: $taskContext->getChatConversationId(),
            remind: $e->getMessage(),
            remindEvent: $remindType
        );

        TaskTerminationUtil::setTerminationFlag($this->redis, $this->logger, $taskContext->getTask()->getId());

        // Get sandbox status, if sandbox is running, send interrupt command
        try {
            $result = $this->agentDomainService->getSandboxStatus($topicEntity->getSandboxId());
            if ($result->getStatus() === SandboxStatus::RUNNING) {
                $this->agentDomainService->sendInterruptMessage(
                    $dataIsolation,
                    $taskContext->getTask()->getSandboxId(),
                    (string) $taskContext->getTask()->getId(),
                    trans('task.agent_stopped')
                );
            }
        } catch (SandboxOperationException $e) {
            // ignore
            $this->logger->error(sprintf('Exception occurred while getting status, sandboxId: %s, error: %s', $topicEntity->getSandboxId(), $e->getMessage()));
        }
    }

    /**
     * Handle general exception.
     */
    private function handleGeneralException(Throwable $e, TopicTaskMessageDTO $messageDTO): void
    {
        $this->logger->error(sprintf(
            'Exception processing topic task message: %s, message_id: %s',
            $e->getMessage(),
            $messageDTO->getPayload()->getMessageId()
        ), [
            'exception' => $e,
            'message' => $messageDTO->toArray(),
        ]);
    }
}

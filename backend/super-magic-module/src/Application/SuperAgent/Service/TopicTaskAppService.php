<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\SuperMagic\Application\SuperAgent\Event\Publish\TopicMessageProcessPublisher;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskMessageEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\RunTaskAfterEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\RunTaskCallbackEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\TopicMessageProcessEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\TaskMessageModel;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\SandboxDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskMessageDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use Dtyq\SuperMagic\Infrastructure\Utils\TaskStatusValidator;
use Dtyq\SuperMagic\Infrastructure\Utils\ToolProcessor;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkFileUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\DeliverMessageResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\TopicTaskMessageDTO;
use Hyperf\Amqp\Producer;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class TopicTaskAppService extends AbstractAppService
{
    private readonly LoggerInterface $logger;

    public function __construct(
        private readonly FileProcessAppService $fileProcessAppService,
        private readonly ClientMessageAppService $clientMessageAppService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskDomainService $taskDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly TaskMessageDomainService $taskMessageDomainService,
        private readonly SandboxDomainService $sandboxDomainService,
        protected MagicUserDomainService $userDomainService,
        protected LockerInterface $locker,
        protected LoggerFactory $loggerFactory,
        protected TranslatorInterface $translator,
    ) {
        $this->logger = $this->loggerFactory->get(get_class($this));
    }

    /**
     * Deliver topic task message.
     *
     * @return array Operation result
     */
    public function deliverTopicTaskMessage(TopicTaskMessageDTO $messageDTO): array
    {
        // 获取当前任务 id
        $taskId = $messageDTO->getMetadata()->getSuperMagicTaskId();
        $taskEntity = $this->taskDomainService->getTaskById((int) $taskId);
        if (! $taskEntity) {
            $this->logger->warning('无效的task_id，无法处理消息', ['messageData' => $taskId]);
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'message_missing_task_id');
        }

        // 获取sandbox_id
        $sandboxId = $messageDTO->getMetadata()->getSandboxId();
        $metadata = $messageDTO->getMetadata();
        $language = $this->translator->getLocale();
        $metadata->setLanguage($language);
        $messageDTO->setMetadata($metadata);
        $messageId = $messageDTO->getPayload()->getMessageId();
        $seqId = $messageDTO->getPayload()->getSeqId();

        $this->logger->info('开始处理话题任务消息投递', [
            'sandbox_id' => $sandboxId,
            'message_id' => $messageDTO->getPayload()?->getMessageId(),
        ]);

        $lockKey = 'deliver_sandbox_message_lock:' . $sandboxId;
        $lockOwner = IdGenerator::getUniqueId32(); // Use unique ID as lock holder identifier
        $lockExpireSeconds = 10; // Lock expiration time (seconds) to prevent deadlock
        $lockAcquired = false;

        try {
            // Attempt to acquire distributed mutex lock
            $lockAcquired = $this->locker->spinLock($lockKey, $lockOwner, $lockExpireSeconds);
            if ($lockAcquired) {
                // 1. 根据sandbox_id获取topic_id
                $topicEntity = $this->topicDomainService->getTopicBySandboxId($sandboxId);
                if (! $topicEntity) {
                    $this->logger->error('根据sandbox_id未找到对应的topic', ['sandbox_id' => $sandboxId]);
                    ExceptionBuilder::throw(GenericErrorCode::SystemError, 'topic_not_found_by_sandbox_id');
                }

                // 判断 seq_id 是否是期望的值
                $exceptedSeqId = $this->taskMessageDomainService->getNextSeqId($topicEntity->getId(), $taskEntity->getId());
                if ($seqId !== $exceptedSeqId) {
                    $this->logger->error('seq_id 不是期望的值', ['seq_id' => $seqId, 'expected_seq_id' => $exceptedSeqId]);
                }

                $topicId = $topicEntity->getId();
                // 2. 在应用层完成DTO到实体的转换
                // Get message ID (prefer message ID from payload, generate new one if none)
                $messageId = $messageDTO->getPayload()?->getMessageId() ?: IdGenerator::getSnowId();
                $dataIsolation = DataIsolation::simpleMake($topicEntity->getUserOrganizationCode(), $topicEntity->getUserId());
                $aiUserEntity = $this->userDomainService->getByAiCode($dataIsolation, AgentConstant::SUPER_MAGIC_CODE);
                $messageEntity = $messageDTO->toTaskMessageEntity($topicId, $aiUserEntity->getUserId(), $topicEntity->getUserId());

                // 3. 存储消息到数据库（调用领域层服务）
                $this->taskMessageDomainService->storeTopicTaskMessage($messageEntity, $messageDTO->toArray());

                // 4. 发布轻量级的处理事件
                $processEvent = new TopicMessageProcessEvent($topicId, $taskEntity->getId());
                $processPublisher = new TopicMessageProcessPublisher($processEvent);

                $producer = di(Producer::class);
                $result = $producer->produce($processPublisher);

                if (! $result) {
                    $this->logger->error('发布消息处理事件失败', [
                        'topic_id' => $topicId,
                        'sandbox_id' => $sandboxId,
                        'message_id' => $messageDTO->getPayload()?->getMessageId(),
                    ]);
                    ExceptionBuilder::throw(GenericErrorCode::SystemError, 'message_process_event_publish_failed');
                }

                $this->logger->info('话题任务消息投递完成', [
                    'topic_id' => $topicId,
                    'sandbox_id' => $sandboxId,
                    'message_id' => $messageDTO->getPayload()?->getMessageId(),
                ]);
            }
        } catch (Throwable $e) {
            $this->logger->error('话题任务消息投递失败', [
                'sandbox_id' => $sandboxId,
                'message_id' => $messageDTO->getPayload()?->getMessageId(),
                'error' => $e->getMessage(),
            ]);
            throw $e;
        } finally {
            if ($lockAcquired) {
                if ($this->locker->release($lockKey, $lockOwner)) {
                    $this->logger->debug(sprintf('Lock released for sandbox %s by %s', $sandboxId, $lockOwner));
                } else {
                    // Log lock release failure, may require manual intervention
                    $this->logger->error(sprintf('Failed to release lock for sandbox %s held by %s. Manual intervention may be required.', $sandboxId, $lockOwner));
                }
            }
        }

        return DeliverMessageResponseDTO::fromResult(true, $messageId)->toArray();
    }

    public function handleTopicTaskMessage(TopicTaskMessageDTO $messageDTO): array
    {
        // 1，初始化数据
        $taskId = $messageDTO->getMetadata()->getSuperMagicTaskId();
        $taskEntity = $this->taskDomainService->getTaskById((int) $taskId);
        if (! $taskEntity) {
            $this->logger->warning('无效的task_id，无法处理消息', ['messageData' => $taskId]);
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'message_missing_task_id');
        }

        $metadata = $messageDTO->getMetadata();
        $language = $this->translator->getLocale();
        $metadata->setLanguage($language);
        $messageDTO->setMetadata($metadata);
        $dataIsolation = DataIsolation::simpleMake($metadata->getOrganizationCode(), $metadata->getUserId());
        $messageId = $messageDTO->getPayload()->getMessageId();
        $topicId = $taskEntity->getTopicId();

        $this->logger->info('开始处理话题任务消息', [
            'topic_id' => $topicId,
            'task_id' => $taskId,
            'message_id' => $messageId,
        ]);

        // 获取话题级别的锁
        $lockKey = 'handle_topic_message_lock:' . $topicId;
        $lockOwner = IdGenerator::getUniqueId32();
        $lockExpireSeconds = 15; // 锁过期时间
        $lockAcquired = false;

        try {
            // 尝试获取分布式锁
            $lockAcquired = $this->locker->spinLock($lockKey, $lockOwner, $lockExpireSeconds);
            if (! $lockAcquired) {
                $this->logger->warning('无法获取话题锁，消息处理跳过', [
                    'topic_id' => $topicId,
                    'message_id' => $messageId,
                ]);
                ExceptionBuilder::throw(GenericErrorCode::SystemError, 'unable_to_acquire_topic_lock');
            }

            // 2，存储消息
            $messageEntity = $this->taskMessageDomainService->findByTopicIdAndMessageId($topicId, $messageId);
            if (is_null($messageEntity)) {
                $messageEntity = $this->parseMessageContent($messageDTO);
                $messageEntity->setTopicId($topicId);
                $this->processToolContent($dataIsolation, $taskEntity, $messageEntity);
                $this->processMessageAttachment($dataIsolation, $taskEntity, $messageEntity);
                $this->taskMessageDomainService->storeTopicTaskMessage($messageEntity, $messageDTO->toArray(), TaskMessageModel::PROCESSING_STATUS_COMPLETED);
            }

            // 3. 推送消息给客户端（异步处理）
            if ($messageEntity->getShowInUi()) {
                $this->clientMessageAppService->sendMessageToClient(
                    messageId: $messageEntity->getId(),
                    topicId: $topicId,
                    taskId: (string) $taskEntity->getId(),
                    chatTopicId: $metadata->getChatTopicId(),
                    chatConversationId: $metadata->getChatConversationId(),
                    content: $messageEntity->getContent(),
                    messageType: $messageEntity->getType(),
                    status: $messageEntity->getStatus(),
                    event: $messageEntity->getEvent(),
                    steps: $messageEntity->getSteps() ?? [],
                    tool: $messageEntity->getTool() ?? [],
                    attachments: $messageEntity->getAttachments() ?? [],
                    correlationId: $messageDTO->getPayload()->getCorrelationId() ?? null,
                );
            }

            // 4. 更新话题状态
            $status = $messageDTO->getPayload()->getStatus();
            $taskStatus = TaskStatus::tryFrom($status) ?? TaskStatus::ERROR;
            if (TaskStatus::tryFrom($status)) {
                $this->updateTaskStatus(
                    dataIsolation: $dataIsolation,
                    task: $taskEntity,
                    status: $taskStatus,
                    errMsg: ''
                );
            }

            // 5. 派发回调事件 - 仅在任务完成或失败时触发，不包括 Stopped 状态
            if ($taskStatus === TaskStatus::FINISHED || $taskStatus === TaskStatus::ERROR) {
                $this->dispatchCallbackEvent($messageDTO, $dataIsolation, $topicId, $taskEntity);
            }

            $this->logger->info('话题任务消息处理完成', [
                'topic_id' => $topicId,
                'task_id' => $taskId,
                'message_id' => $messageId,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('话题任务消息处理失败', [
                'topic_id' => $topicId,
                'task_id' => $taskId,
                'message_id' => $messageId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        } finally {
            if ($lockAcquired) {
                if ($this->locker->release($lockKey, $lockOwner)) {
                    $this->logger->debug(sprintf('已释放话题锁 topic_id: %d, owner: %s', $topicId, $lockOwner));
                } else {
                    $this->logger->error(sprintf('释放话题锁失败 topic_id: %d, owner: %s，可能需要人工干预', $topicId, $lockOwner));
                }
            }
        }

        return DeliverMessageResponseDTO::fromResult(true, $messageId)->toArray();
    }

    /**
     * Update task status.
     */
    public function updateTaskStatus(DataIsolation $dataIsolation, TaskEntity $task, TaskStatus $status, string $errMsg = ''): void
    {
        $taskId = (string) $task?->getId();
        try {
            // Get current task status for validation
            $currentStatus = $task?->getStatus();
            // Use utility class to validate status transition
            if (! TaskStatusValidator::isTransitionAllowed($currentStatus, $status)) {
                $reason = TaskStatusValidator::getRejectReason($currentStatus, $status);
                $this->logger->info('Rejected status update', [
                    'task_id' => $taskId,
                    'current_status' => $currentStatus->value ?? 'null',
                    'new_status' => $status->value,
                    'reason' => $reason,
                    'error_msg' => $errMsg,
                ]);
                return; // Silently reject update
            }

            // Execute status update
            $this->taskDomainService->updateTaskStatus(
                $status,
                $task->getId(),
                $taskId,
                $task->getSandboxId(),
                $errMsg
            );
            $this->topicDomainService->updateTopicStatusAndSandboxId($task->getTopicId(), $task->getId(), $status, $task->getSandboxId());

            $this->projectDomainService->updateProjectStatus($task->getProjectId(), $task->getTopicId(), $status);
            // Log success
            $this->logger->info('Task status update completed', [
                'task_id' => $taskId,
                'sandbox_id' => $task->getSandboxId(),
                'previous_status' => $currentStatus->value ?? 'null',
                'new_status' => $status->value,
                'error_msg' => $errMsg,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('Failed to update task status', [
                'task_id' => $taskId,
                'sandbox_id' => $task->getSandboxId(),
                'status' => $status->value,
                'error' => $e->getMessage(),
                'error_msg' => $errMsg,
            ]);
            throw $e;
        }
    }

    public function updateTaskStatusFromSandbox(TopicEntity $topicEntity): TaskStatus
    {
        $this->logger->info(sprintf('开始检查任务状态: topic_id=%s', $topicEntity->getId()));
        $sandboxId = ! empty($topicEntity->getSandboxId()) ? $topicEntity->getSandboxId() : (string) $topicEntity->getId();

        // 调用SandboxService的getStatus接口获取容器状态
        $result = $this->sandboxDomainService->getSandboxStatus($sandboxId);

        // 如果沙箱存在且状态为 running，直接返回该沙箱
        if ($result->getStatus() === SandboxStatus::RUNNING) {
            $this->logger->info(sprintf('沙箱状态正常(running): sandboxId=%s', $topicEntity->getSandboxId()));
            return TaskStatus::RUNNING;
        }

        $errMsg = $result->getStatus();

        // 获取当前任务
        $taskId = $topicEntity->getCurrentTaskId();
        if ($taskId) {
            // 更新任务状态
            $this->taskDomainService->updateTaskStatusByTaskId($taskId, TaskStatus::ERROR, $errMsg);
        }

        // 更新话题状态
        $this->topicDomainService->updateTopicStatus($topicEntity->getId(), $taskId, TaskStatus::ERROR);

        // 触发完成事件
        AsyncEventUtil::dispatch(new RunTaskAfterEvent(
            $topicEntity->getUserOrganizationCode(),
            $topicEntity->getUserId(),
            $topicEntity->getId(),
            $taskId,
            TaskStatus::ERROR->value,
            null
        ));

        $this->logger->info(sprintf('结束检查任务状态: topic_id=%s, status=%s, error_msg=%s', $topicEntity->getId(), TaskStatus::ERROR->value, $errMsg));

        return TaskStatus::ERROR;
    }

    public function processMessageAttachment(DataIsolation $dataIsolation, TaskEntity $task, TaskMessageEntity $message): void
    {
        $fileKeys = [];
        $fileInfoMap = [];
        // 获取消息附件
        if (! empty($message->getAttachments())) {
            foreach ($message->getAttachments() as $attachment) {
                if (! empty($attachment['file_key'])) {
                    $fileKeys[] = $attachment['file_key'];
                    $fileInfoMap[$attachment['file_key']] = $attachment;
                }
            }
        }
        // 获取消息里，工具的附件
        if (! empty($message->getTool()) && ! empty($message->getTool()['attachments'])) {
            foreach ($message->getTool()['attachments'] as $attachment) {
                if (! empty($attachment['file_key'])) {
                    $fileKeys[] = $attachment['file_key'];
                    $fileInfoMap[$attachment['file_key']] = $attachment;
                }
            }
        }
        if (empty($fileKeys)) {
            return;
        }
        // 通过 file_key 查找文件 id
        $fileEntities = $this->taskFileDomainService->getByFileKeys($fileKeys);
        $fileIdMap = [];
        foreach ($fileEntities as $fileEntity) {
            $fileIdMap[$fileEntity->getFileKey()] = $fileEntity->getFileId();
        }

        // Handle missing file_keys: find which file_keys don't have corresponding records
        $missingFileKeys = array_diff($fileKeys, array_keys($fileIdMap));
        if (! empty($missingFileKeys)) {
            $projectEntity = $this->projectDomainService->getProjectNotUserId($task->getProjectId());
            if ($projectEntity) {
                // Setup spin lock for project to prevent concurrent file operations
                // Same lock strategy as SandboxFileNotificationAppService
                $lockKey = WorkDirectoryUtil::getLockerKey($projectEntity->getId());
                $lockOwner = IdGenerator::getUniqueId32();
                $lockExpireSeconds = 30;
                $lockAcquired = false;

                try {
                    // Attempt to acquire distributed spin lock
                    $lockAcquired = $this->locker->spinLock($lockKey, $lockOwner, $lockExpireSeconds);
                    if (! $lockAcquired) {
                        $this->logger->warning(sprintf(
                            'Failed to acquire lock for missing file processing, project_id: %d, task_id: %s, file_keys: %s',
                            $projectEntity->getId(),
                            $task->getTaskId(),
                            implode(', ', $missingFileKeys)
                        ));
                        ExceptionBuilder::throw(GenericErrorCode::SystemError, 'Failed to acquire file processing lock');
                    }

                    $this->logger->info(sprintf(
                        'Lock acquired for missing file processing, project_id: %d, task_id: %s, file_keys: %s',
                        $projectEntity->getId(),
                        $task->getTaskId(),
                        implode(', ', $missingFileKeys)
                    ));

                    // Re-check file existence after acquiring lock to avoid duplicate creation
                    $fileEntities = $this->taskFileDomainService->getByFileKeys($missingFileKeys);
                    $existingFileIdMap = [];
                    foreach ($fileEntities as $fileEntity) {
                        $existingFileIdMap[$fileEntity->getFileKey()] = $fileEntity->getFileId();
                    }

                    // Process only files that still don't exist
                    foreach ($missingFileKeys as $missingFileKey) {
                        // Skip if file was created by another process
                        if (isset($existingFileIdMap[$missingFileKey])) {
                            $fileIdMap[$missingFileKey] = $existingFileIdMap[$missingFileKey];
                            $this->logger->info(sprintf(
                                'File already created by another process, file_key: %s, file_id: %d',
                                $missingFileKey,
                                $existingFileIdMap[$missingFileKey]
                            ));
                            continue;
                        }

                        if (! isset($fileInfoMap[$missingFileKey])) {
                            $this->logger->error(sprintf('Missing file_key: %s', $missingFileKey));
                            continue;
                        }
                        $storageType = WorkFileUtil::isSnapshotFile($missingFileKey)
                            ? StorageType::SNAPSHOT->value
                            : StorageType::WORKSPACE->value;
                        $fileInfoMap[$missingFileKey]['storage_type'] = $storageType;
                        $fallbackFileEntity = $this->taskFileDomainService->convertMessageAttachmentToTaskFileEntity($fileInfoMap[$missingFileKey], $task);
                        $this->logger->info(sprintf(
                            'Attachment not found in database, creating file record, task_id: %s, file_key: %s',
                            $task->getTaskId(),
                            $missingFileKey
                        ));
                        $savedEntity = $this->taskFileDomainService->saveProjectFile(
                            $dataIsolation,
                            $projectEntity,
                            $fallbackFileEntity,
                            $storageType
                        );
                        $fileIdMap[$missingFileKey] = $savedEntity->getFileId();
                    }

                    $this->logger->info(sprintf(
                        'Missing file processing completed with lock protection, project_id: %d, task_id: %s',
                        $projectEntity->getId(),
                        $task->getTaskId()
                    ));
                } catch (Throwable $e) {
                    $this->logger->error(sprintf(
                        'Exception processing missing files with lock protection, project_id: %d, task_id: %s, error: %s',
                        $projectEntity->getId(),
                        $task->getTaskId(),
                        $e->getMessage()
                    ));
                    throw $e;
                } finally {
                    // Ensure lock is always released
                    if ($lockAcquired) {
                        if ($this->locker->release($lockKey, $lockOwner)) {
                            $this->logger->debug(sprintf(
                                'Lock released for missing file processing, project_id: %d, task_id: %s',
                                $projectEntity->getId(),
                                $task->getTaskId()
                            ));
                        } else {
                            $this->logger->error(sprintf(
                                'Failed to release lock for missing file processing, project_id: %d, task_id: %s. Manual intervention may be required.',
                                $projectEntity->getId(),
                                $task->getTaskId()
                            ));
                        }
                    }
                }
            } else {
                $this->logger->error(sprintf('Project not found, project_id: %s', $task->getProjectId()));
            }
        }

        // 将 file_id 赋值到 消息的附件和消息工具的附件里
        if (! empty($fileIdMap)) {
            // 处理消息附件
            $attachments = $message->getAttachments();
            if (! empty($attachments)) {
                foreach ($attachments as &$attachment) {
                    if (! empty($attachment['file_key']) && isset($fileIdMap[$attachment['file_key']])) {
                        $attachment['file_id'] = (string) $fileIdMap[$attachment['file_key']];
                    }
                }
                $message->setAttachments($attachments);
            }

            // 处理工具附件
            $tool = $message->getTool();
            if (! empty($tool) && ! empty($tool['attachments'])) {
                foreach ($tool['attachments'] as &$attachment) {
                    if (! empty($attachment['file_key']) && isset($fileIdMap[$attachment['file_key']])) {
                        $attachment['file_id'] = (string) $fileIdMap[$attachment['file_key']];
                    }
                }
                $message->setTool($tool);
            }
        }

        // Special status handling: generate output content tool when task is finished
        if ($message->getStatus() === TaskStatus::FINISHED->value) {
            $outputTool = ToolProcessor::generateOutputContentTool($message->getAttachments());
            if ($outputTool !== null) {
                $message->setTool($outputTool);
            }
        }
    }

    private function parseMessageContent(TopicTaskMessageDTO $messageDTO): TaskMessageEntity
    {
        $payload = $messageDTO->getPayload();
        $metadata = $messageDTO->getMetadata();

        // Create TaskMessageEntity with messageId
        $taskMessageEntity = new TaskMessageEntity([
            'message_id' => $payload->getMessageId(),
        ]);

        // Set basic message information
        $messageType = $payload->getType() ?: 'unknown';
        $taskMessageEntity->setType($messageType);
        $taskMessageEntity->setContent($payload->getContent() ?? '');
        $taskMessageEntity->setStatus($payload->getStatus() ?: TaskStatus::RUNNING->value);
        $taskMessageEntity->setEvent($payload->getEvent() ?? '');
        $taskMessageEntity->setShowInUi($payload->getShowInUi() ?? true);

        // Set array fields
        $taskMessageEntity->setSteps($payload->getSteps() ?? []);
        $taskMessageEntity->setTool($payload->getTool() ?? []);
        $taskMessageEntity->setAttachments($payload->getAttachments() ?? []);

        // Set task and topic information
        $taskMessageEntity->setTaskId($payload->getTaskId() ?? '');

        // Set sender/receiver information (will be set properly when we have task context)
        $taskMessageEntity->setSenderType('assistant');
        $taskMessageEntity->setSenderUid($metadata->getAgentUserId() ?? '');
        $taskMessageEntity->setReceiverUid($metadata->getUserId() ?? '');
        $taskMessageEntity->setSeqId($messageDTO->getPayload()->getSeqId());
        $taskMessageEntity->setCorrelationId($payload->getCorrelationId());

        // Validate message type
        if (! MessageType::isValid($messageType)) {
            $this->logger->warning(sprintf(
                'Received unknown message type: %s, task_id: %s',
                $messageType,
                $payload->getTaskId()
            ));
        }

        return $taskMessageEntity;
    }

    private function processToolContent(DataIsolation $dataIsolation, TaskEntity $taskEntity, TaskMessageEntity $taskMessageEntity): void
    {
        // 根据类型处理
        $tool = $taskMessageEntity->getTool();
        $detailType = $tool['detail']['type'] ?? '';
        switch ($detailType) {
            case 'image':
                // 处理图片
                $this->processToolContentImage($taskMessageEntity);
                break;
            default:
                // 默认处理文本
                $this->processToolContentStorage($dataIsolation, $taskEntity, $taskMessageEntity);
                break;
        }
    }

    private function processToolContentImage(TaskMessageEntity $taskMessageEntity): void
    {
        $tool = $taskMessageEntity->getTool();
        // 获取文件名称
        $fileName = $tool['detail']['data']['file_name'] ?? '';
        if (empty($fileName)) {
            return;
        }
        $fileKey = '';
        $attachments = $tool['attachments'] ?? [];
        foreach ($attachments as $attachment) {
            if ($attachment['filename'] === $fileName) {
                $fileKey = $attachment['file_key'];
            }
        }
        if (empty($fileKey)) {
            return;
        }
        $taskFileEntity = $this->taskFileDomainService->getByFileKey($fileKey);
        if ($taskFileEntity === null) {
            return;
        }
        $tool['detail']['data']['file_id'] = (string) $taskFileEntity->getFileId();
        $tool['detail']['data']['file_extension'] = pathinfo($fileName, PATHINFO_EXTENSION);
        $taskMessageEntity->setTool($tool);
    }

    private function processToolContentStorage(DataIsolation $dataIsolation, TaskEntity $taskEntity, TaskMessageEntity $taskMessageEntity): void
    {
        // 检查是否启用对象存储
        $objectStorageEnabled = config('super-magic.task.tool_message.object_storage_enabled', true);
        if (! $objectStorageEnabled) {
            return;
        }

        // 检查工具内容
        $tool = $taskMessageEntity->getTool();
        $content = $tool['detail']['data']['content'] ?? '';
        if (empty($content)) {
            return;
        }

        // 检查内容长度是否达到阈值
        $minContentLength = config('super-magic.task.tool_message.min_content_length', 500);
        if (strlen($content) < $minContentLength) {
            return;
        }

        $this->logger->info(sprintf(
            '开始处理工具内容存储，工具ID: %s，内容长度: %d',
            $tool['id'] ?? 'unknown',
            strlen($content)
        ));

        try {
            // 构建参数
            $fileName = $tool['detail']['data']['file_name'] ?? 'tool_content.txt';
            $fileExtension = pathinfo($fileName, PATHINFO_EXTENSION) ?: 'txt';
            $fileKey = ($tool['id'] ?? 'unknown') . '.' . $fileExtension;
            $workDir = WorkDirectoryUtil::getTopicMessageDir($taskEntity->getUserId(), $taskEntity->getProjectId(), $taskEntity->getTopicId());

            // 调用FileProcessAppService保存内容
            $fileId = $this->fileProcessAppService->saveToolMessageContent(
                fileName: $fileName,
                workDir: $workDir,
                fileKey: $fileKey,
                content: $content,
                dataIsolation: $dataIsolation,
                projectId: $taskEntity->getProjectId(),
                topicId: $taskEntity->getTopicId(),
                taskId: (int) $taskEntity->getId()
            );

            // 修改工具数据结构
            $tool['detail']['data']['file_id'] = (string) $fileId;
            $tool['detail']['data']['content'] = ''; // 清空内容

            $taskMessageEntity->setTool($tool);

            $this->logger->info(sprintf(
                '工具内容存储完成，工具ID: %s，文件ID: %d，原内容长度: %d',
                $tool['id'] ?? 'unknown',
                $fileId,
                strlen($content)
            ));
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                '工具内容存储失败: %s，工具ID: %s，内容长度: %d',
                $e->getMessage(),
                $tool['id'] ?? 'unknown',
                strlen($content)
            ));
            // 存储失败不影响主流程，只记录错误
        }
    }

    /**
     * 派发回调事件.
     */
    private function dispatchCallbackEvent(
        TopicTaskMessageDTO $messageDTO,
        DataIsolation $dataIsolation,
        int $topicId,
        TaskEntity $taskEntity
    ): void {
        $this->logger->info('派发 RunTaskCallbackEvent 事件', [
            'topic_id' => $topicId,
            'task_id' => $taskEntity->getId(),
            'message_id' => $messageDTO->getPayload()->getMessageId(),
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'user_id' => $dataIsolation->getCurrentUserId(),
        ]);
        // 派发 RunTaskCallbackEvent
        AsyncEventUtil::dispatch(new RunTaskCallbackEvent(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
            $topicId,
            '', // 话题名称传空字符串
            $taskEntity->getId(),
            $messageDTO,
            $messageDTO->getMetadata()->getLanguage()
        ));
    }
}

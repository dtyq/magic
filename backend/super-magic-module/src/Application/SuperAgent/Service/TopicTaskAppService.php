<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\SuperMagic\Application\SuperAgent\Event\Publish\TopicTaskMessagePublisher;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Infrastructure\Utils\TaskStatusValidator;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Assembler\TopicTaskMessageAssembler;
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
        private readonly ProjectDomainService $projectDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskDomainService $taskDomainService,
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
        // If there's no valid topicId, cannot acquire lock, process directly or report error
        $sandboxId = $messageDTO->getMetadata()->getSandboxId();
        $metadata = $messageDTO->getMetadata();
        $language = $this->translator->getLocale();
        $metadata->setLanguage($language);
        $messageDTO->setMetadata($metadata);
        $this->logger->info('deliverTopicTaskMessage', ['messageData' => $messageDTO->getMetadata()]);
        if (empty($sandboxId)) {
            $this->logger->warning('Cannot acquire lock without a valid sandboxId in deliverTopicTaskMessage.', ['messageData' => $messageDTO->toArray()]);
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'message_missing_topic_id_for_locking');
        }

        $lockKey = 'deliver_sandbox_message_lock:' . $sandboxId;
        $lockOwner = IdGenerator::getUniqueId32(); // Use unique ID as lock holder identifier
        $lockExpireSeconds = 10; // Lock expiration time (seconds) to prevent deadlock
        $lockAcquired = false;

        try {
            // Attempt to acquire distributed mutex lock
            $lockAcquired = $this->locker->mutexLock($lockKey, $lockOwner, $lockExpireSeconds);

            if ($lockAcquired) {
                // --- Critical section start ---
                $this->logger->debug(sprintf('Lock acquired for sandbox %s by %s', $sandboxId, $lockOwner));

                // Use assembler to convert DTO to domain event
                $topicTaskMessageEvent = TopicTaskMessageAssembler::toEvent($messageDTO);
                // Create message publisher
                $topicTaskMessagePublisher = new TopicTaskMessagePublisher($topicTaskMessageEvent);
                // Get Producer and send message
                $producer = di(Producer::class);
                $result = $producer->produce($topicTaskMessagePublisher);

                // Check send result
                if (! $result) {
                    $this->logger->error(sprintf(
                        'deliverTopicTaskMessage failed after acquiring lock, message: %s',
                        json_encode($messageDTO->toArray(), JSON_UNESCAPED_UNICODE)
                    ));
                    // Note: Even if sending fails, must ensure lock is released
                    ExceptionBuilder::throw(GenericErrorCode::SystemError, 'message_delivery_failed');
                }
                // --- Critical section end ---
                $this->logger->debug(sprintf('Message produced for sandbox %s by %s', $sandboxId, $lockOwner));
            } else {
                // Failed to acquire lock (might be held by another instance)
                $this->logger->warning(sprintf('Failed to acquire mutex lock for sandbox %s. It might be held by another instance.', $sandboxId));
                // Decide based on business requirements: throw error, retry later (e.g., put in delay queue), or log and consider failed
                ExceptionBuilder::throw(GenericErrorCode::SystemError, 'concurrent_message_delivery_failed');
            }
        } finally {
            // If lock was acquired, ensure it's released
            if ($lockAcquired) {
                if ($this->locker->release($lockKey, $lockOwner)) {
                    $this->logger->debug(sprintf('Lock released for sandbox %s by %s', $sandboxId, $lockOwner));
                } else {
                    // Log lock release failure, may require manual intervention
                    $this->logger->error(sprintf('Failed to release lock for sandbox %s held by %s. Manual intervention may be required.', $sandboxId, $lockOwner));
                }
            }
        }

        // Get message ID (prefer message ID from payload, generate new one if none)
        $messageId = $messageDTO->getPayload()?->getMessageId() ?: IdGenerator::getSnowId();

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
                $this->logger->warning('Rejected status update', [
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
                $dataIsolation,
                $task->getTopicId(),
                $status,
                $task->getId(),
                $taskId,
                $task->getSandboxId(),
                $errMsg
            );

            // update topic status
            // if ($task->getSandboxId()) {
            $this->topicDomainService->updateTopicStatusAndSandboxId($task->getTopicId(), $task->getId(), $status, $task->getSandboxId());
            // Execute sandbox update
            // $this->taskDomainService->updateTaskSandboxId($dataIsolation, $task->getId(), $task->getSandboxId());
            // } else {
            //     $this->topicDomainService->updateTopicStatus($task->getTopicId(), $task->getId(), $status);
            // }

            $topicEntity = $this->topicDomainService->getTopicById($task->getTopicId());
            if ($topicEntity) {
                $this->projectDomainService->updateProjectStatus($topicEntity->getProjectId(), $topicEntity->getId(), $status);
            }

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
}

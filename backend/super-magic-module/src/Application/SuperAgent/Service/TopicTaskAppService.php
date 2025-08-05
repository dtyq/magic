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
use Dtyq\SuperMagic\Application\SuperAgent\Event\Publish\TopicMessageProcessPublisher;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\TopicMessageProcessEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\MessageStorageDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Infrastructure\Utils\TaskStatusValidator;
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
        private readonly MessageStorageDomainService $messageStorageDomainService,
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
        // 获取sandbox_id
        $sandboxId = $messageDTO->getMetadata()->getSandboxId();
        $metadata = $messageDTO->getMetadata();
        $language = $this->translator->getLocale();
        $metadata->setLanguage($language);
        $messageDTO->setMetadata($metadata);

        $this->logger->info('开始处理话题任务消息投递', [
            'sandbox_id' => $sandboxId,
            'message_id' => $messageDTO->getPayload()?->getMessageId(),
        ]);

        if (empty($sandboxId)) {
            $this->logger->warning('无效的sandbox_id，无法处理消息', ['messageData' => $messageDTO->toArray()]);
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'message_missing_sandbox_id');
        }

        try {
            // 1. 根据sandbox_id获取topic_id
            $topicEntity = $this->topicDomainService->getTopicBySandboxId($sandboxId);
            if (! $topicEntity) {
                $this->logger->error('根据sandbox_id未找到对应的topic', ['sandbox_id' => $sandboxId]);
                ExceptionBuilder::throw(GenericErrorCode::SystemError, 'topic_not_found_by_sandbox_id');
            }

            $topicId = $topicEntity->getId();
            $this->logger->info('找到对应的topic', [
                'sandbox_id' => $sandboxId,
                'topic_id' => $topicId,
            ]);

            // 2. 在应用层完成DTO到实体的转换
            // Get message ID (prefer message ID from payload, generate new one if none)
            $messageId = $messageDTO->getPayload()?->getMessageId() ?: IdGenerator::getSnowId();
            $seqId = (int) $messageId;
            $dataIsolation = DataIsolation::simpleMake($topicEntity->getUserOrganizationCode(), $topicEntity->getUserId());
            $aiUserEntity = $this->userDomainService->getByAiCode($dataIsolation, AgentConstant::SUPER_MAGIC_CODE);
            $messageEntity = $messageDTO->toTaskMessageEntity($topicId, $aiUserEntity->getUserId(), $topicEntity->getUserId());
            $messageEntity->setSeqId($seqId);
            $messageEntity->setRawContent(json_encode($messageDTO->toArray(), JSON_UNESCAPED_UNICODE));

            // 3. 存储消息到数据库（调用领域层服务）
            $this->messageStorageDomainService->storeTopicTaskMessage($messageEntity, $messageDTO->toArray());

            // 4. 发布轻量级的处理事件
            $processEvent = new TopicMessageProcessEvent($topicId);
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
        } catch (Throwable $e) {
            $this->logger->error('话题任务消息投递失败', [
                'sandbox_id' => $sandboxId,
                'message_id' => $messageDTO->getPayload()?->getMessageId(),
                'error' => $e->getMessage(),
            ]);
            throw $e;
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

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskMessageEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskMessageRepositoryInterface;
use Hyperf\Contract\StdoutLoggerInterface;
use InvalidArgumentException;

class TaskMessageDomainService
{
    public function __construct(
        protected TaskMessageRepositoryInterface $messageRepository,
        private readonly StdoutLoggerInterface $logger
    ) {
    }

    public function getNextSeqId(int $topicId, int $taskId): int
    {
        return $this->messageRepository->getNextSeqId($topicId, $taskId);
    }

    public function updateProcessingStatus(int $id, string $processingStatus, ?string $errorMessage = null, int $retryCount = 0): void
    {
        $this->messageRepository->updateProcessingStatus($id, $processingStatus, $errorMessage, $retryCount);
    }

    public function findProcessableMessages(int $topicId, int $taskId, string $senderType = 'assistant', int $timeoutMinutes = 30, int $maxRetries = 3, int $limit = 50): array
    {
        return $this->messageRepository->findProcessableMessages($topicId, $taskId, $senderType, $timeoutMinutes, $maxRetries, $limit);
    }

    public function findByTopicIdAndMessageId(int $topicId, string $messageId): ?TaskMessageEntity
    {
        return $this->messageRepository->findByTopicIdAndMessageId($topicId, $messageId);
    }

    public function updateExistingMessage(TaskMessageEntity $message): void
    {
        $this->messageRepository->updateExistingMessage($message);
    }

    /**
     * 存储话题任务消息.
     *
     * @param TaskMessageEntity $messageEntity 消息实体
     * @param array $rawData 原始消息数据
     * @return TaskMessageEntity 存储后的消息实体
     */
    public function storeTopicTaskMessage(TaskMessageEntity $messageEntity, array $rawData): TaskMessageEntity
    {
        $this->logger->info('开始存储话题任务消息', [
            'topic_id' => $messageEntity->getTopicId(),
            'message_id' => $messageEntity->getMessageId(),
        ]);

        // 1. 获取seq_id（应该已在DTO转换时设置）
        $seqId = $messageEntity->getSeqId();
        if ($seqId === null) {
            throw new InvalidArgumentException('seq_id must be set before storing message');
        }

        // 2. 检查消息是否重复（通过seq_id + topic_id）
        $existingMessage = $this->messageRepository->findBySeqIdAndTopicId(
            $seqId,
            (int) $messageEntity->getTaskId(),
            (int) $messageEntity->getTopicId(),
        );

        if ($existingMessage) {
            $this->logger->info('消息已存在，跳过重复存储', [
                'topic_id' => $messageEntity->getTopicId(),
                'seq_id' => $seqId,
                'task_id' => $messageEntity->getTaskId(),
                'message_id' => $messageEntity->getMessageId(),
            ]);
            return $existingMessage;
        }

        // 3. 消息不存在，进行存储
        $messageEntity->setStatus(TaskMessageEntity::PROCESSING_STATUS_PENDING);
        $messageEntity->setRetryCount(0);
        $this->messageRepository->saveWithRawData(
            $rawData, // 原始数据
            $messageEntity
        );

        $this->logger->info('话题任务消息存储完成', [
            'topic_id' => $messageEntity->getTopicId(),
            'seq_id' => $seqId,
            'message_id' => $messageEntity->getMessageId(),
        ]);

        return $messageEntity;
    }
}

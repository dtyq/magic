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

/**
 * 消息存储领域服务.
 * 负责将接收到的消息数据存储到数据库.
 */
class MessageStorageDomainService
{
    public function __construct(
        private readonly TaskMessageRepositoryInterface $taskMessageRepository,
        private readonly StdoutLoggerInterface $logger
    ) {
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
        $existingMessage = $this->taskMessageRepository->findBySeqIdAndTopicId(
            $seqId,
            (int) $messageEntity->getTopicId()
        );

        if ($existingMessage) {
            $this->logger->info('消息已存在，跳过重复存储', [
                'topic_id' => $messageEntity->getTopicId(),
                'seq_id' => $seqId,
                'message_id' => $messageEntity->getMessageId(),
            ]);
            return $existingMessage;
        }

        // 3. 消息不存在，进行存储
        $messageEntity->setStatus(TaskMessageEntity::PROCESSING_STATUS_PENDING);
        $messageEntity->setRetryCount(0);
        $this->taskMessageRepository->saveWithRawData(
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

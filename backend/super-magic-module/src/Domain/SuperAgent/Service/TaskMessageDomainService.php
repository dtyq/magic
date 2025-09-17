<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskMessageEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskMessageRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\TaskMessageModel;
use Dtyq\SuperMagic\Infrastructure\Utils\ToolProcessor;
use Hyperf\Contract\StdoutLoggerInterface;
use InvalidArgumentException;

class TaskMessageDomainService
{
    public function __construct(
        protected TaskMessageRepositoryInterface $messageRepository,
        protected TaskFileRepositoryInterface $taskFileRepository,
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

    public function processMessageAttachment(TaskMessageEntity $message): void
    {
        $fileKeys = [];
        // 获取消息附件
        if (! empty($message->getAttachments())) {
            foreach ($message->getAttachments() as $attachment) {
                if (! empty($attachment['file_key'])) {
                    $fileKeys[] = $attachment['file_key'];
                }
            }
        }
        // 获取消息里，工具的附件
        if (! empty($message->getTool()) && ! empty($message->getTool()['attachments'])) {
            foreach ($message->getTool()['attachments'] as $attachment) {
                if (! empty($attachment['file_key'])) {
                    $fileKeys[] = $attachment['file_key'];
                }
            }
        }
        if (empty($fileKeys)) {
            return;
        }
        // 通过 file_key 查找文件 id
        $fileEntities = $this->taskFileRepository->getByFileKeys($fileKeys);
        $fileIdMap = [];
        foreach ($fileEntities as $fileEntity) {
            $fileIdMap[$fileEntity->getFileKey()] = $fileEntity->getFileId();
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

    /**
     * 存储话题任务消息.
     *
     * @param TaskMessageEntity $messageEntity 消息实体
     * @param array $rawData 原始消息数据
     * @param string $processStatus 处理状态
     * @return TaskMessageEntity 存储后的消息实体
     */
    public function storeTopicTaskMessage(TaskMessageEntity $messageEntity, array $rawData, string $processStatus = TaskMessageModel::PROCESSING_STATUS_PENDING): TaskMessageEntity
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
        $messageEntity->setRetryCount(0);
        $this->messageRepository->saveWithRawData(
            $rawData, // 原始数据
            $messageEntity,
            $processStatus
        );

        $this->logger->info('话题任务消息存储完成', [
            'topic_id' => $messageEntity->getTopicId(),
            'seq_id' => $seqId,
            'message_id' => $messageEntity->getMessageId(),
        ]);

        return $messageEntity;
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskMessageEntity;

interface TaskMessageRepositoryInterface
{
    /**
     * 通过ID获取消息.
     */
    public function getById(int $id): ?TaskMessageEntity;

    /**
     * 保存消息.
     */
    public function save(TaskMessageEntity $message): void;

    /**
     * 批量保存消息.
     * @param TaskMessageEntity[] $messages
     */
    public function batchSave(array $messages): void;

    /**
     * 根据任务ID获取消息列表.
     * @return TaskMessageEntity[]
     */
    public function findByTaskId(string $taskId): array;

    /**
     * 根据话题ID获取消息列表，支持分页.
     * @param int $topicId 话题ID
     * @param int $page 页码
     * @param int $pageSize 每页大小
     * @param bool $shouldPage 是否需要分页
     * @param string $sortDirection 排序方向，支持asc和desc
     * @param bool $showInUi 是否只显示UI可见的消息
     * @return array 返回包含消息列表和总数的数组 ['list' => TaskMessageEntity[], 'total' => int]
     */
    public function findByTopicId(int $topicId, int $page = 1, int $pageSize = 20, bool $shouldPage = true, string $sortDirection = 'asc', bool $showInUi = true): array;

    public function getUserFirstMessageByTopicId(int $topicId, string $userId): ?TaskMessageEntity;

    /**
     * 根据topic_id和处理状态查询消息列表，按seq_id升序排列.
     * @param int $topicId 话题ID
     * @param string $processingStatus 处理状态
     * @param string $senderType 发送者类型
     * @param int $limit 限制数量
     * @return TaskMessageEntity[]
     */
    public function findPendingMessagesByTopicId(int $topicId, string $processingStatus, string $senderType = 'assistant', int $limit = 50): array;

    /**
     * 更新消息处理状态.
     * @param int $id 消息ID
     * @param string $processingStatus 处理状态
     * @param null|string $errorMessage 错误信息
     * @param int $retryCount 重试次数
     */
    public function updateProcessingStatus(int $id, string $processingStatus, ?string $errorMessage = null, int $retryCount = 0): void;

    /**
     * 批量更新消息处理状态.
     * @param array $ids 消息ID数组
     * @param string $processingStatus 处理状态
     */
    public function batchUpdateProcessingStatus(array $ids, string $processingStatus): void;

    /**
     * 获取下一个seq_id.
     */
    public function getNextSeqId(int $topicId, int $taskId): int;

    /**
     * 保存原始消息数据并生成seq_id.
     * @param array $rawData 原始消息数据
     * @param TaskMessageEntity $message 消息实体
     */
    public function saveWithRawData(array $rawData, TaskMessageEntity $message): void;

    /**
     * 根据seq_id和topic_id查询消息.
     * @param int $seqId 序列ID
     * @param int $taskId 任务ID
     * @param int $topicId 话题ID
     * @return null|TaskMessageEntity 消息实体或null
     */
    public function findBySeqIdAndTopicId(int $seqId, int $taskId, int $topicId): ?TaskMessageEntity;

    /**
     * 根据topic_id和message_id查询消息.
     * @param int $topicId 话题ID
     * @param string $messageId 消息ID
     * @return null|TaskMessageEntity 消息实体或null
     */
    public function findByTopicIdAndMessageId(int $topicId, string $messageId): ?TaskMessageEntity;

    /**
     * 更新现有消息的业务字段.
     * @param TaskMessageEntity $message 消息实体
     */
    public function updateExistingMessage(TaskMessageEntity $message): void;

    /**
     * 获取待处理的消息列表（用于顺序批量处理）.
     *
     * 查询条件：
     * - pending: 全部处理
     * - processing: 超过指定分钟数的（认为已超时）
     * - failed: 重试次数不超过最大值的
     *
     * @param int $topicId 话题ID
     * @param string $senderType 发送者类型
     * @param int $timeoutMinutes 处理超时时间（分钟）
     * @param int $maxRetries 最大重试次数
     * @param int $limit 限制数量
     * @return TaskMessageEntity[] 按seq_id升序排列的消息列表
     */
    public function findProcessableMessages(
        int $topicId,
        int $taskId,
        string $senderType = 'assistant',
        int $timeoutMinutes = 30,
        int $maxRetries = 3,
        int $limit = 50
    ): array;
}

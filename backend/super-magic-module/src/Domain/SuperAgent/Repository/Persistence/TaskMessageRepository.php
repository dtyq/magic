<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Carbon\Carbon;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskMessageEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskMessageRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\TaskMessageModel;
use Hyperf\DbConnection\Db;
use InvalidArgumentException;
use RuntimeException;

class TaskMessageRepository implements TaskMessageRepositoryInterface
{
    public function __construct(protected TaskMessageModel $model)
    {
    }

    public function getById(int $id): ?TaskMessageEntity
    {
        $record = $this->model::query()->find($id);
        if (! $record) {
            return null;
        }
        return new TaskMessageEntity($record->toArray());
    }

    public function save(TaskMessageEntity $message): void
    {
        $this->model::query()->create($message->toArray());
    }

    public function batchSave(array $messages): void
    {
        $data = array_map(function (TaskMessageEntity $message) {
            return $message->toArray();
        }, $messages);

        $this->model::query()->insert($data);
    }

    public function findByTaskId(string $taskId): array
    {
        $query = $this->model::query()
            ->where('task_id', $taskId)
            ->orderBy('send_timestamp', 'asc');

        $result = Db::select($query->toSql(), $query->getBindings());

        return array_map(function ($record) {
            return new TaskMessageEntity((array) $record);
        }, $result);
    }

    /**
     * 根据话题ID获取消息列表，支持分页.
     *
     * @param int $topicId 话题ID
     * @param int $page 页码
     * @param int $pageSize 每页大小
     * @param bool $shouldPage 是否需要分页
     * @param string $sortDirection 排序方向，支持asc和desc
     * @param bool $showInUi 是否只显示UI可见的消息
     * @return array 返回包含消息列表和总数的数组 ['list' => TaskMessageEntity[], 'total' => int]
     */
    public function findByTopicId(int $topicId, int $page = 1, int $pageSize = 20, bool $shouldPage = true, string $sortDirection = 'asc', bool $showInUi = true): array
    {
        // 确保排序方向是有效的
        $sortDirection = strtolower($sortDirection) === 'desc' ? 'desc' : 'asc';

        // 构建基础查询 - 不使用 leftJoin，避免影响 casts 转换
        $query = $this->model::query()
            ->where('topic_id', $topicId);

        // 如果 $showInUi 为 true，则添加条件过滤
        if ($showInUi) {
            $query->where('show_in_ui', true);
        }

        $query->orderBy('id', $sortDirection);

        // 获取总记录数
        $total = $query->count();

        // 如果需要分页，则添加分页条件
        if ($shouldPage) {
            $offset = ($page - 1) * $pageSize;
            $query->offset($offset)->limit($pageSize);
        }

        // 执行查询
        $records = $query->get();

        // 将查询结果转换为实体对象
        $messages = [];
        $imSeqIds = [];
        foreach ($records as $record) {
            // toArray() 会自动应用 casts 转换
            $entity = new TaskMessageEntity($record->toArray());
            $messages[] = $entity;

            // 收集 im_seq_id 用于批量查询 im_status
            if ($entity->getImSeqId() !== null) {
                $imSeqIds[$entity->getImSeqId()] = $entity->getImSeqId();
            }
        }

        // 批量查询 im_status
        if (! empty($imSeqIds)) {
            $imStatusMap = Db::table('magic_chat_sequences')
                ->whereIn('id', array_values($imSeqIds))
                ->pluck('status', 'id')
                ->toArray();

            // 将 im_status 设置到对应的实体中
            foreach ($messages as $message) {
                if ($message->getImSeqId() !== null && isset($imStatusMap[$message->getImSeqId()])) {
                    $message->setImStatus((int) $imStatusMap[$message->getImSeqId()]);
                }
            }
        }

        // 返回结构化结果
        return [
            'list' => $messages,
            'total' => $total,
        ];
    }

    public function getUserFirstMessageByTopicId(int $topicId, string $userId): ?TaskMessageEntity
    {
        // 构建基础查询
        $query = $this->model::query()
            ->where('topic_id', $topicId)
            ->where('sender_type', 'user')
            ->where('sender_uid', $userId)
            ->orderBy('id', 'asc');
        $record = $query->first();

        if (! $record) {
            return null;
        }
        return new TaskMessageEntity($record->toArray());
    }

    public function findPendingMessagesByTopicId(int $topicId, string $processingStatus, string $senderType = 'assistant', int $limit = 50): array
    {
        $query = $this->model::query()
            ->where('topic_id', $topicId)
            ->where('processing_status', $processingStatus)
            ->where('sender_type', $senderType)
            ->orderBy('seq_id', 'asc')
            ->limit($limit);

        $result = Db::select($query->toSql(), $query->getBindings());

        return array_map(function ($record) {
            return new TaskMessageEntity((array) $record);
        }, $result);
    }

    public function updateProcessingStatus(int $id, string $processingStatus, ?string $errorMessage = null, int $retryCount = 0): void
    {
        $updateData = [
            'processing_status' => $processingStatus,
            'retry_count' => $retryCount,
            'updated_at' => Carbon::now(),
        ];

        if ($errorMessage !== null) {
            $updateData['error_message'] = $errorMessage;
        }

        if ($processingStatus === TaskMessageModel::PROCESSING_STATUS_COMPLETED) {
            $updateData['processed_at'] = Carbon::now();
        }

        $this->model::query()->where('id', $id)->update($updateData);
    }

    public function batchUpdateProcessingStatus(array $ids, string $processingStatus): void
    {
        $updateData = [
            'processing_status' => $processingStatus,
            'updated_at' => Carbon::now(),
        ];

        if ($processingStatus === TaskMessageModel::PROCESSING_STATUS_COMPLETED) {
            $updateData['processed_at'] = Carbon::now();
        }

        $this->model::query()->whereIn('id', $ids)->update($updateData);
    }

    public function getNextSeqId(int $topicId, int $taskId): int
    {
        // 利用降序索引直接获取最大 seq_id，配合 ORDER BY seq_id DESC
        $maxSeqId = $this->model::query()
            ->where('topic_id', $topicId)
            ->where('task_id', $taskId)
            ->orderByDesc('seq_id')
            ->value('seq_id');

        // 如果没有记录，返回1；否则返回最大值+1
        return ($maxSeqId ?? 0) + 1;
    }

    public function saveWithRawData(array $rawData, TaskMessageEntity $message): void
    {
        $messageArray = $message->toArray();

        // seq_id应该已经在领域服务中设置好了
        if (empty($messageArray['seq_id'])) {
            throw new InvalidArgumentException('seq_id must be set before saving');
        }

        // 保存原始数据
        $messageArray['raw_data'] = json_encode($rawData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        // 设置初始处理状态
        $messageArray['processing_status'] = TaskMessageModel::PROCESSING_STATUS_PENDING;
        $messageArray['retry_count'] = 0;

        $this->model::query()->create($messageArray);
    }

    public function findBySeqIdAndTopicId(int $seqId, int $taskId, int $topicId): ?TaskMessageEntity
    {
        $query = $this->model::query()
            ->where('seq_id', $seqId)
            ->where('topic_id', $topicId)
            ->where('task_id', $taskId)
            ->first();

        if (! $query) {
            return null;
        }

        return new TaskMessageEntity($query->toArray());
    }

    public function findByTopicIdAndMessageId(int $topicId, string $messageId): ?TaskMessageEntity
    {
        $query = $this->model::query()
            ->where('topic_id', $topicId)
            ->where('message_id', $messageId)
            ->first();

        if (! $query) {
            return null;
        }

        return new TaskMessageEntity($query->toArray());
    }

    public function updateExistingMessage(TaskMessageEntity $message): void
    {
        // Use Eloquent model instance to leverage casts automatic conversion
        $model = $this->model::query()->find($message->getId());

        if (! $model) {
            throw new RuntimeException('Task message not found for ID: ' . $message->getId());
        }

        $entityArray = $message->toArray();

        // Fill model attributes - casts will automatically handle array to JSON conversion
        $model->fill($entityArray);

        // Save using Eloquent - this will apply casts and handle timestamps automatically
        $model->save();
    }

    public function findProcessableMessages(
        int $topicId,
        int $taskId,
        string $senderType = 'assistant',
        int $timeoutMinutes = 30,
        int $maxRetries = 3,
        int $limit = 50
    ): array {
        // 简化SQL查询：只按topic_id + sender_type + 三个状态查询
        // 在代码中处理复杂逻辑，避免复杂SQL在大表上的性能问题
        $query = $this->model::query()
            ->select([
                'id',
                'seq_id',
                'processing_status',
                'updated_at',
                'retry_count',
                'raw_data',
                'message_id',
                'task_id',
            ])
            ->where('topic_id', $topicId)
            ->where('sender_type', $senderType)
            ->whereIn('processing_status', [
                TaskMessageModel::PROCESSING_STATUS_PENDING,
                TaskMessageModel::PROCESSING_STATUS_PROCESSING,
                TaskMessageModel::PROCESSING_STATUS_FAILED,
            ]);

        if ($taskId > 0) {
            $query = $query->where('task_id', $taskId);
        }

        $query->orderBy('seq_id', 'asc')->limit($limit * 2); // 适当放大limit，因为要在代码中过滤

        $records = $query->get();
        $timeoutTime = Carbon::now()->subMinutes($timeoutMinutes);
        $processableMessages = [];

        foreach ($records as $record) {
            $shouldProcess = false;

            switch ($record->processing_status) {
                case TaskMessageModel::PROCESSING_STATUS_PENDING:
                    // pending状态的全部处理
                    $shouldProcess = true;
                    break;
                case TaskMessageModel::PROCESSING_STATUS_PROCESSING:
                    // processing状态但超过指定时间的（认为是超时）
                    $updatedAt = Carbon::parse($record->updated_at);
                    $shouldProcess = $updatedAt->lt($timeoutTime);
                    break;
                case TaskMessageModel::PROCESSING_STATUS_FAILED:
                    // failed状态但重试次数不超过最大值的
                    $shouldProcess = $record->retry_count <= $maxRetries;
                    break;
            }

            if ($shouldProcess) {
                $processableMessages[] = new TaskMessageEntity($record->toArray());

                // 达到目标数量就停止
                if (count($processableMessages) >= $limit) {
                    break;
                }
            }
        }

        return $processableMessages;
    }

    /**
     * @return TaskMessageEntity[]
     */
    public function findMessagesToCopyByTopicIdAndMessageId(int $topicId, int $messageId): array
    {
        $query = $this->model::query()
            ->where('topic_id', $topicId)
            ->where('show_in_ui', true)
            ->where('id', '<=', $messageId)
            ->orderBy('id', 'asc');

        $records = $query->get();

        foreach ($records as $record) {
            $messages[] = new TaskMessageEntity($record->toArray());
        }

        return $messages ?? [];
    }

    public function batchCreateMessages(array $messageEntities): array
    {
        if (empty($messageEntities)) {
            return [];
        }

        $insertData = [];

        foreach ($messageEntities as $messageEntity) {
            // 如果ID未设置，则自动生成
            if (empty($messageEntity->getId())) {
                $messageEntity->setId(IdGenerator::getSnowId());
            }

            $insertData[] = $messageEntity->toArrayWithoutOtherField();
        }

        // 批量插入
        $this->model::query()->insert($insertData);

        return $messageEntities; // 直接返回传入的entities，因为它们已经包含了正确的ID
    }

    public function updateMessageSeqId(int $id, ?int $imSeqId): void
    {
        // 如果 im_seq_id 为空，则不执行更新
        if ($imSeqId === null) {
            return;
        }

        // 只更新 im_seq_id 字段
        $this->model::query()
            ->where('id', $id)
            ->update(['im_seq_id' => $imSeqId]);
    }
}

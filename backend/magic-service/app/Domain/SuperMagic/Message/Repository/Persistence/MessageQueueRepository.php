<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Message\Repository\Persistence;

use App\Domain\SuperMagic\Message\Entity\MessageQueueEntity;
use App\Domain\SuperMagic\Message\Entity\ValueObject\MessageQueueStatus;
use App\Domain\SuperMagic\Message\Repository\Facade\MessageQueueRepositoryInterface;
use App\Domain\SuperMagic\Message\Repository\Model\MessageQueueModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Database\Model\Builder;
use Hyperf\DbConnection\Db;

class MessageQueueRepository implements MessageQueueRepositoryInterface
{
    private const TOPICS_TABLE = 'magic_super_agent_topics';

    public function __construct(protected MessageQueueModel $model)
    {
    }

    public function create(MessageQueueEntity $messageQueue): MessageQueueEntity
    {
        // Generate snowflake ID if not set
        if ($messageQueue->getId() === 0) {
            $messageQueue->setId(IdGenerator::getSnowId());
        }

        $data = $this->convertEntityToModelData($messageQueue);
        $model = $this->model::query()->create($data);

        $entityData = $this->convertModelToEntityData($model->toArray());
        return new MessageQueueEntity($entityData);
    }

    public function update(MessageQueueEntity $messageQueue): bool
    {
        $data = $this->convertEntityToModelData($messageQueue);
        unset($data['id']); // Remove ID from update data

        return $this->model::query()
            ->where('id', $messageQueue->getId())
            ->whereNull('deleted_at')
            ->update($data) > 0;
    }

    public function delete(int $id, string $userId): bool
    {
        return $this->model::query()
            ->where('id', $id)
            ->where('user_id', $userId)
            ->where('status', MessageQueueStatus::PENDING->value)
            ->whereNull('deleted_at')
            ->update([
                'deleted_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]) > 0;
    }

    public function getPendingMessagesByTopic(int $topicId, string $userId): array
    {
        $models = $this->model::query()
            ->whereNull('deleted_at')
            ->where('topic_id', $topicId)
            ->where('user_id', $userId)
            ->where('status', MessageQueueStatus::PENDING->value)
            ->orderBy('sort_order', 'asc')->orderBy('id', 'asc')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $data = $this->convertModelToEntityData($model->toArray());
            $entities[] = new MessageQueueEntity($data);
        }

        return $entities;
    }

    public function getById(int $id, bool $includeDeleted = false): ?MessageQueueEntity
    {
        $query = $this->model::query()->where('id', $id);
        if (! $includeDeleted) {
            $query->whereNull('deleted_at');
        }
        $model = $query->first();

        if (! $model) {
            return null;
        }

        $data = $this->convertModelToEntityData($model->toArray());
        return new MessageQueueEntity($data);
    }

    public function getByIdForUser(int $id, string $userId, bool $includeDeleted = false): ?MessageQueueEntity
    {
        $query = $this->model::query()
            ->where('id', $id)
            ->where('user_id', $userId);
        if (! $includeDeleted) {
            $query->whereNull('deleted_at');
        }
        $model = $query->first();

        if (! $model) {
            return null;
        }

        $data = $this->convertModelToEntityData($model->toArray());
        return new MessageQueueEntity($data);
    }

    public function updateStatus(int $id, MessageQueueStatus $status, ?string $errorMessage = null): bool
    {
        $updateData = [
            'status' => $status->value,
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        if ($status === MessageQueueStatus::IN_PROGRESS || $status === MessageQueueStatus::COMPLETED || $status === MessageQueueStatus::FAILED) {
            $updateData['execute_time'] = date('Y-m-d H:i:s');
        }

        if ($errorMessage !== null) {
            $updateData['err_message'] = $errorMessage;
        }

        return $this->model::query()
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->update($updateData) > 0;
    }

    public function getMessagesByStatuses(
        array $conditions = [],
        array $statuses = [],
        bool $needPagination = true,
        int $pageSize = 10,
        int $page = 1,
        string $orderBy = 'id',
        string $order = 'asc',
        bool $excludeDeletedTopics = false
    ): array {
        $query = $this->model::query();

        if ($excludeDeletedTopics) {
            $query->from($this->model->getTable() . ' as mq')
                ->select('mq.*')
                ->join(self::TOPICS_TABLE . ' as t', 't.id', '=', 'mq.topic_id')
                ->whereNull('mq.deleted_at')
                ->whereNull('t.deleted_at');
        } else {
            $query->whereNull('deleted_at');
        }

        // Apply conditions
        foreach ($conditions as $key => $value) {
            $column = $this->qualifyMessageQueueColumn($key, $excludeDeletedTopics);
            if (is_array($value)) {
                $query->whereIn($column, $value);
            } else {
                $query->where($column, $value);
            }
        }

        // Apply status filter
        if (! empty($statuses)) {
            $statusValues = array_map(fn ($status) => $status->value, $statuses);
            $query->whereIn($this->qualifyMessageQueueColumn('status', $excludeDeletedTopics), $statusValues);
        }

        // Get total count
        $total = $query->count();

        // Apply ordering and pagination
        $query->orderBy($this->qualifyMessageQueueColumn($orderBy, $excludeDeletedTopics), $order)
            ->orderBy($this->qualifyMessageQueueColumn('id', $excludeDeletedTopics), $order);

        if ($needPagination) {
            $offset = ($page - 1) * $pageSize;
            $query->offset($offset)->limit($pageSize);
        }

        $models = $query->get();

        $entities = [];
        foreach ($models as $model) {
            $data = $this->convertModelToEntityData($model->toArray());
            $entities[] = new MessageQueueEntity($data);
        }

        return [
            'list' => $entities,
            'total' => $total,
        ];
    }

    public function getNextPendingMessage(string $userId, ?int $topicId = null): ?MessageQueueEntity
    {
        $query = $this->model::query()
            ->whereNull('deleted_at')
            ->where('user_id', $userId)
            ->where('status', MessageQueueStatus::PENDING->value)
            ->orderBy('sort_order', 'asc')->orderBy('id', 'asc');

        if ($topicId !== null) {
            $query->where('topic_id', $topicId);
        }

        $model = $query->first();

        if (! $model) {
            return null;
        }

        $data = $this->convertModelToEntityData($model->toArray());
        return new MessageQueueEntity($data);
    }

    public function updateWithConditions(int $id, array $data, array $conditions = []): bool
    {
        $query = $this->model::query()
            ->where('id', $id)
            ->whereNull('deleted_at');

        foreach ($conditions as $key => $value) {
            $query->where($key, $value);
        }

        $data['updated_at'] = date('Y-m-d H:i:s');

        return $query->update($data) > 0;
    }

    /**
     * Get topic IDs that have pending messages for compensation.
     * Excludes topics that already have an IN_PROGRESS message to prevent duplicate delivery.
     */
    public function getCompensationTopics(int $limit, array $organizationCodes = []): array
    {
        // Sub-query: topic IDs that already have an IN_PROGRESS message (being processed right now).
        // Excluding them at the DB level avoids unnecessary lock-contention and idempotency checks
        // in the service layer.
        $inProgressTopicIds = $this->model::query()
            ->select('topic_id')
            ->distinct()
            ->where('status', MessageQueueStatus::IN_PROGRESS->value)
            ->whereNull('deleted_at')
            ->pluck('topic_id')
            ->toArray();

        // Main query: PENDING messages whose expected execution time has arrived.
        // Join topics to avoid soft-deleted historical topics starving the compensation batch.
        $query = $this->model::query()
            ->from($this->model->getTable() . ' as mq')
            ->select('mq.topic_id')
            ->distinct()
            ->join(self::TOPICS_TABLE . ' as t', 't.id', '=', 'mq.topic_id')
            ->where('mq.status', MessageQueueStatus::PENDING->value)
            ->where('mq.except_execute_time', '<=', date('Y-m-d H:i:s'))
            ->whereNull('mq.deleted_at')
            ->whereNull('t.deleted_at');

        // Exclude topics already being processed
        if (! empty($inProgressTopicIds)) {
            $query->whereNotIn('mq.topic_id', $inProgressTopicIds);
        }

        // Apply organization code filter if provided
        if (! empty($organizationCodes)) {
            $query->whereIn('mq.organization_code', $organizationCodes);
        }

        return $query->orderBy('mq.topic_id')
            ->limit($limit)
            ->pluck('mq.topic_id')
            ->toArray();
    }

    public function cascadeDeleteUnfinishedByTopicIds(array $topicIds, string $reason): int
    {
        $topicIds = $this->normalizeIds($topicIds);
        if (empty($topicIds)) {
            return 0;
        }

        $now = date('Y-m-d H:i:s');

        return (int) $this->model::query()
            ->whereIn('topic_id', $topicIds)
            ->whereIn('status', $this->getUnfinishedStatusValues())
            ->whereNull('deleted_at')
            ->update([
                'deleted_at' => $now,
                'updated_at' => $now,
                'err_message' => $reason,
            ]);
    }

    public function cascadeDeleteUnfinishedByProjectIds(array $projectIds, string $reason): int
    {
        $projectIds = $this->normalizeIds($projectIds);
        if (empty($projectIds)) {
            return 0;
        }

        $now = date('Y-m-d H:i:s');

        return (int) $this->model::query()
            ->whereIn('project_id', $projectIds)
            ->whereIn('status', $this->getUnfinishedStatusValues())
            ->whereNull('deleted_at')
            ->update([
                'deleted_at' => $now,
                'updated_at' => $now,
                'err_message' => $reason,
            ]);
    }

    /**
     * Get earliest pending message for specific topic.
     * @param int $topicId Topic ID
     * @param null|string $maxExecuteTime Max execute time filter (optional, if null then no time filter applied)
     */
    public function getEarliestMessageByTopic(int $topicId, ?string $maxExecuteTime = null): ?MessageQueueEntity
    {
        // Get the earliest pending message for the specified topic
        $query = $this->model::query()
            ->where('topic_id', $topicId)
            ->where('status', MessageQueueStatus::PENDING->value);

        $model = $query
            ->whereNull('deleted_at')
            ->orderBy('sort_order', 'asc')
            ->orderBy('id', 'asc')
            ->first();

        // Apply time filter only if maxExecuteTime is provided
        // 先选队首再判断资格：A 未到期、B 已到期时仍等待 A，不越过当前顺序。
        if ($model && $maxExecuteTime !== null
            && ($model->except_execute_time === null || (string) $model->except_execute_time > $maxExecuteTime)) {
            return null;
        }

        return $model ? $this->convertToEntity($model) : null;
    }

    /**
     * Delay execution time for all pending messages in a topic.
     */
    public function delayTopicMessages(int $topicId, int $delayMinutes): bool
    {
        // Batch update all pending messages in the topic to delay their execution time
        return $this->model::query()
            ->where('topic_id', $topicId)
            ->where('status', MessageQueueStatus::PENDING->value)
            ->whereNull('deleted_at')
            ->update([
                'except_execute_time' => Db::raw("DATE_ADD(except_execute_time, INTERVAL {$delayMinutes} MINUTE)"),
                'updated_at' => date('Y-m-d H:i:s'),
            ]) > 0;
    }

    /**
     * Get the IN_PROGRESS message for a specific topic (idempotency check).
     */
    public function getInProgressMessageByTopic(int $topicId): ?MessageQueueEntity
    {
        $model = $this->model::query()
            ->where('topic_id', $topicId)
            ->where('status', MessageQueueStatus::IN_PROGRESS->value)
            ->whereNull('deleted_at')
            ->orderBy('id', 'asc')
            ->first();

        return $model ? $this->convertToEntity($model) : null;
    }

    public function getByClientSyncId(string $userId, string $organizationCode, int $projectId, int $topicId, string $syncId): ?MessageQueueEntity
    {
        $model = $this->model::query()
            ->where('user_id', $userId)
            ->where('organization_code', $organizationCode)
            ->where('project_id', $projectId)
            ->where('topic_id', $topicId)
            ->where(static function (Builder $query) use ($syncId): void {
                $query->where('message_content->extra->super_agent->client_queue_sync_id', $syncId)
                    ->orWhere('message_content->extra->super_agent->client_queue_create_sync_id', $syncId);
            })
            ->first();
        return $model ? $this->convertToEntity($model) : null;
    }

    public function getNextSortOrder(int $topicId): int
    {
        return 1 + (int) $this->model::query()
            ->where('topic_id', $topicId)
            ->where('status', MessageQueueStatus::PENDING->value)
            ->whereNull('deleted_at')
            ->max('sort_order');
    }

    public function restore(MessageQueueEntity $message): bool
    {
        return $this->model::query()
            ->where('id', $message->getId())
            ->where('status', MessageQueueStatus::PENDING->value)
            ->whereNotNull('deleted_at')
            ->update([
                'message_content' => $message->getMessageContent(),
                'message_type' => $message->getMessageType(),
                'deleted_at' => null,
                'updated_at' => date('Y-m-d H:i:s'),
            ]) > 0;
    }

    /** @param int[] $messageIds 调用方持有话题锁，事务内保存完整活动顺序。 */
    public function saveOrder(int $topicId, array $messageIds): void
    {
        foreach ($messageIds as $index => $id) {
            $this->model::query()->where('id', $id)->where('topic_id', $topicId)
                ->where('status', MessageQueueStatus::PENDING->value)->whereNull('deleted_at')
                ->update(['sort_order' => $index + 1]);
        }
    }

    private function qualifyMessageQueueColumn(string $column, bool $withAlias): string
    {
        if (! $withAlias || str_contains($column, '.') || str_contains($column, '(')) {
            return $column;
        }

        return 'mq.' . $column;
    }

    /**
     * @return int[]
     */
    private function getUnfinishedStatusValues(): array
    {
        return [
            MessageQueueStatus::PENDING->value,
            MessageQueueStatus::FAILED->value,
            MessageQueueStatus::IN_PROGRESS->value,
        ];
    }

    /**
     * @return int[]
     */
    private function normalizeIds(array $ids): array
    {
        $normalizedIds = [];
        foreach ($ids as $id) {
            $id = (int) $id;
            if ($id > 0 && ! in_array($id, $normalizedIds, true)) {
                $normalizedIds[] = $id;
            }
        }

        return $normalizedIds;
    }

    /**
     * Convert model data to entity data.
     */
    private function convertModelToEntityData(array $modelData): array
    {
        $entityData = [];
        foreach ($modelData as $key => $value) {
            $camelKey = $this->snakeToCamel($key);
            $entityData[$camelKey] = $value;
        }
        return $entityData;
    }

    /**
     * Convert entity data to model data.
     */
    private function convertEntityToModelData(MessageQueueEntity $entity): array
    {
        return [
            'id' => $entity->getId(),
            'sort_order' => $entity->getSortOrder(),
            'user_id' => $entity->getUserId(),
            'organization_code' => $entity->getOrganizationCode(),
            'project_id' => $entity->getProjectId(),
            'topic_id' => $entity->getTopicId(),
            'message_content' => $entity->getMessageContent(),
            'message_type' => $entity->getMessageType(),
            'status' => $entity->getStatus()->value,
            'execute_time' => $entity->getExecuteTime(),
            'except_execute_time' => $entity->getExceptExecuteTime(),
            'err_message' => $entity->getErrMessage(),
            'deleted_at' => $entity->getDeletedAt(),
            'created_at' => $entity->getCreatedAt(),
            'updated_at' => $entity->getUpdatedAt(),
        ];
    }

    /**
     * Convert snake_case to camelCase.
     */
    private function snakeToCamel(string $snake): string
    {
        return lcfirst(str_replace(' ', '', ucwords(str_replace(['_', '-'], ' ', $snake))));
    }

    /**
     * Convert model to entity.
     * @param mixed $model
     */
    private function convertToEntity($model): MessageQueueEntity
    {
        $data = $this->convertModelToEntityData($model->toArray());
        return new MessageQueueEntity($data);
    }
}

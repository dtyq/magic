<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageQueueEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageQueueStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\MessageQueueRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\MessageQueueModel;
use Hyperf\DbConnection\Db;

class MessageQueueRepository implements MessageQueueRepositoryInterface
{
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
            ->orderBy('created_at', 'asc')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $data = $this->convertModelToEntityData($model->toArray());
            $entities[] = new MessageQueueEntity($data);
        }

        return $entities;
    }

    public function getByIdForUser(int $id, string $userId): ?MessageQueueEntity
    {
        $model = $this->model::query()
            ->whereNull('deleted_at')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->first();

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
        string $order = 'asc'
    ): array {
        $query = $this->model::query()->whereNull('deleted_at');

        // Apply conditions
        foreach ($conditions as $key => $value) {
            if (is_array($value)) {
                $query->whereIn($key, $value);
            } else {
                $query->where($key, $value);
            }
        }

        // Apply status filter
        if (! empty($statuses)) {
            $statusValues = array_map(fn ($status) => $status->value, $statuses);
            $query->whereIn('status', $statusValues);
        }

        // Get total count
        $total = $query->count();

        // Apply ordering and pagination
        $query->orderBy($orderBy, $order);

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
            ->orderBy('created_at', 'asc');

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
     */
    public function getCompensationTopics(int $limit, array $organizationCodes = []): array
    {
        // High-performance query: Get distinct topic IDs with pending messages that are ready to execute
        $query = $this->model::query()
            ->select('topic_id')
            ->distinct()
            ->where('status', MessageQueueStatus::PENDING->value)
            ->where('except_execute_time', '<=', date('Y-m-d H:i:s'))
            ->whereNull('deleted_at');

        // Apply organization code filter if provided
        if (! empty($organizationCodes)) {
            $query->whereIn('organization_code', $organizationCodes);
        }

        return $query->orderBy('topic_id')
            ->limit($limit)
            ->pluck('topic_id')
            ->toArray();
    }

    /**
     * Get earliest pending message for specific topic.
     */
    public function getEarliestMessageByTopic(int $topicId): ?MessageQueueEntity
    {
        // Get the earliest pending message for the specified topic
        $model = $this->model::query()
            ->where('topic_id', $topicId)
            ->where('status', MessageQueueStatus::PENDING->value)
            ->where('except_execute_time', '<=', date('Y-m-d H:i:s'))
            ->whereNull('deleted_at')
            ->orderBy('except_execute_time', 'asc')
            ->orderBy('id', 'asc')
            ->first();

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

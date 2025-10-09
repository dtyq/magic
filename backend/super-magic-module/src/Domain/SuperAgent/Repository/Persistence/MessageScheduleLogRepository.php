<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Carbon\Carbon;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageScheduleLogEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\MessageScheduleLogRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\MessageScheduleLogModel;

/**
 * Message schedule log repository implementation.
 */
class MessageScheduleLogRepository extends AbstractRepository implements MessageScheduleLogRepositoryInterface
{
    public function __construct(
        protected MessageScheduleLogModel $messageScheduleLogModel
    ) {
    }

    /**
     * Create message schedule log.
     */
    public function create(MessageScheduleLogEntity $messageScheduleLog): MessageScheduleLogEntity
    {
        $attributes = $this->entityToModelAttributes($messageScheduleLog);
        if ($messageScheduleLog->getId() == 0) {
            $attributes['id'] = IdGenerator::getSnowId();
            $messageScheduleLog->setId($attributes['id']);
        } else {
            $attributes['id'] = $messageScheduleLog->getId();
        }

        $this->messageScheduleLogModel::query()->create($attributes);
        return $messageScheduleLog;
    }

    /**
     * Find message schedule log by ID.
     */
    public function findById(int $id): ?MessageScheduleLogEntity
    {
        /** @var null|MessageScheduleLogModel $model */
        $model = $this->messageScheduleLogModel::query()->find($id);
        if (! $model) {
            return null;
        }
        return $this->modelToEntity($model);
    }

    /**
     * Find message schedule logs by message schedule ID.
     */
    public function findByMessageScheduleId(int $messageScheduleId): array
    {
        $models = $this->messageScheduleLogModel::query()
            ->where('message_schedule_id', $messageScheduleId)
            ->orderBy('id', 'desc')
            ->get();

        return $models->map(function ($model) {
            return $this->modelToEntity($model);
        })->toArray();
    }

    /**
     * Update message schedule log status.
     */
    public function updateStatus(int $id, int $status, ?string $errorMessage = null): bool
    {
        $updateData = [
            'status' => $status,
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        if ($errorMessage !== null) {
            $updateData['error_message'] = $errorMessage;
        }

        return $this->messageScheduleLogModel::query()
            ->where('id', $id)
            ->update($updateData) > 0;
    }

    /**
     * Update execution log details.
     */
    public function updateExecutionLogDetails(int $id, array $updateData): bool
    {
        $allowedFields = ['project_id', 'topic_id', 'status', 'error_message'];
        $filteredData = array_intersect_key($updateData, array_flip($allowedFields));

        if (empty($filteredData)) {
            return false;
        }

        $filteredData['updated_at'] = date('Y-m-d H:i:s');

        return $this->messageScheduleLogModel::query()
            ->where('id', $id)
            ->update($filteredData) > 0;
    }

    /**
     * Get message schedule logs by conditions with pagination.
     */
    public function getLogsByConditions(
        array $conditions = [],
        int $page = 1,
        int $pageSize = 10,
        string $orderBy = 'executed_at',
        string $orderDirection = 'desc'
    ): array {
        $query = $this->messageScheduleLogModel::query();

        // Apply conditions
        foreach ($conditions as $field => $value) {
            if ($value !== null) {
                $query->where($field, $value);
            }
        }

        // Get total count
        $total = $query->count();

        // Apply pagination and ordering
        $models = $query->orderBy($orderBy, $orderDirection)
            ->offset(($page - 1) * $pageSize)
            ->limit($pageSize)
            ->get();

        $entities = $models->map(function ($model) {
            return $this->modelToEntity($model);
        })->toArray();

        return [
            'total' => $total,
            'list' => $entities,
            'page' => $page,
            'page_size' => $pageSize,
        ];
    }

    /**
     * Convert model to entity.
     */
    private function modelToEntity(MessageScheduleLogModel $model): MessageScheduleLogEntity
    {
        return new MessageScheduleLogEntity([
            'id' => $model->id,
            'message_schedule_id' => $model->message_schedule_id,
            'workspace_id' => $model->workspace_id,
            'project_id' => $model->project_id,
            'topic_id' => $model->topic_id,
            'task_name' => $model->task_name,
            'status' => $model->status,
            'executed_at' => $this->formatDateTime($model->executed_at),
            'error_message' => $model->error_message,
            'created_at' => $this->formatDateTime($model->created_at),
            'updated_at' => $this->formatDateTime($model->updated_at),
        ]);
    }

    /**
     * Format datetime value to string.
     * @param mixed $datetime
     */
    private function formatDateTime($datetime): ?string
    {
        if ($datetime === null) {
            return null;
        }

        if ($datetime instanceof Carbon) {
            return $datetime->toDateTimeString();
        }

        // If it's already a string, return it as is
        return (string) $datetime;
    }

    /**
     * Convert entity to model attributes.
     */
    private function entityToModelAttributes(MessageScheduleLogEntity $entity): array
    {
        return [
            'message_schedule_id' => $entity->getMessageScheduleId(),
            'workspace_id' => $entity->getWorkspaceId(),
            'project_id' => $entity->getProjectId(),
            'topic_id' => $entity->getTopicId(),
            'task_name' => $entity->getTaskName(),
            'status' => $entity->getStatus(),
            'executed_at' => $entity->getExecutedAt(),
            'error_message' => $entity->getErrorMessage(),
        ];
    }
}

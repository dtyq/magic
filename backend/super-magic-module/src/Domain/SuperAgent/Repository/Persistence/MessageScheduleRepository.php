<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageScheduleEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\MessageScheduleRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\MessageScheduleModel;
use Hyperf\DbConnection\Db;
use RuntimeException;

/**
 * Message schedule repository implementation.
 */
class MessageScheduleRepository extends AbstractRepository implements MessageScheduleRepositoryInterface
{
    public function __construct(
        protected MessageScheduleModel $messageScheduleModel
    ) {
    }

    /**
     * Find message schedule by ID.
     */
    public function findById(int $id): ?MessageScheduleEntity
    {
        /** @var null|MessageScheduleModel $model */
        $model = $this->messageScheduleModel::query()->find($id);
        if (! $model) {
            return null;
        }
        return $this->modelToEntity($model);
    }

    /**
     * Save message schedule.
     */
    public function save(MessageScheduleEntity $messageSchedule): MessageScheduleEntity
    {
        $attributes = $this->entityToModelAttributes($messageSchedule);

        if ($messageSchedule->getId() > 0) {
            /**
             * @var null|MessageScheduleModel $model
             */
            $model = $this->messageScheduleModel::query()->find($messageSchedule->getId());
            if (! $model) {
                throw new RuntimeException('Message schedule not found for update: ' . $messageSchedule->getId());
            }
            $model->fill($attributes);
            $model->save();
            return $this->modelToEntity($model);
        }

        // Create
        $attributes['id'] = IdGenerator::getSnowId();
        $messageSchedule->setId($attributes['id']);
        $this->messageScheduleModel::query()->create($attributes);
        return $messageSchedule;
    }

    /**
     * Create message schedule.
     */
    public function create(MessageScheduleEntity $messageSchedule): MessageScheduleEntity
    {
        $attributes = $this->entityToModelAttributes($messageSchedule);
        if ($messageSchedule->getId() == 0) {
            $attributes['id'] = IdGenerator::getSnowId();
            $messageSchedule->setId($attributes['id']);
        } else {
            $attributes['id'] = $messageSchedule->getId();
        }
        $this->messageScheduleModel::query()->create($attributes);
        return $messageSchedule;
    }

    /**
     * Delete message schedule (soft delete).
     */
    public function delete(MessageScheduleEntity $messageSchedule): bool
    {
        /** @var null|MessageScheduleModel $model */
        $model = $this->messageScheduleModel::query()->find($messageSchedule->getId());
        if (! $model) {
            return false;
        }

        return $model->delete();
    }

    /**
     * Get message schedules by conditions with pagination and sorting.
     */
    public function getMessageSchedulesByConditions(
        array $conditions = [],
        int $page = 1,
        int $pageSize = 10,
        string $orderBy = 'updated_at',
        string $orderDirection = 'desc'
    ): array {
        $query = $this->messageScheduleModel::query();

        // Default filter for non-deleted data
        $query->whereNull('deleted_at');

        // Apply query conditions
        foreach ($conditions as $field => $value) {
            if (is_array($value)) {
                // Support array query for message_schedule_ids
                $query->whereIn('id', $value);
            } elseif ($field === 'task_name_like') {
                // Support fuzzy search for task name
                $query->where('task_name', 'like', '%' . $value . '%');
            } else {
                // Default equal query
                $query->where($field, $value);
            }
        }

        // Get total count
        $total = $query->count();

        // Sort and paginate
        $list = $query->orderBy($orderBy, $orderDirection)
            ->offset(($page - 1) * $pageSize)
            ->limit($pageSize)
            ->get();

        // Convert to entity objects
        $entities = [];
        foreach ($list as $model) {
            /* @var MessageScheduleModel $model */
            $entities[] = $this->modelToEntity($model);
        }

        return [
            'total' => $total,
            'list' => $entities,
        ];
    }

    /**
     * Update message schedule by condition.
     */
    public function updateMessageScheduleByCondition(array $condition, array $data): bool
    {
        return $this->messageScheduleModel::query()
            ->where($condition)
            ->update($data) > 0;
    }

    /**
     * Get message schedules by user ID.
     */
    public function getMessageSchedulesByUserId(string $userId, string $organizationCode): array
    {
        $query = $this->messageScheduleModel::query()
            ->where('user_id', $userId)
            ->where('organization_code', $organizationCode)
            ->whereNull('deleted_at')
            ->orderBy('updated_at', 'desc');

        $results = Db::select($query->toSql(), $query->getBindings());
        return $this->toEntities($results);
    }

    /**
     * Get message schedules by workspace ID.
     */
    public function getMessageSchedulesByWorkspaceId(int $workspaceId, string $userId, string $organizationCode): array
    {
        $query = $this->messageScheduleModel::query()
            ->where('workspace_id', $workspaceId)
            ->where('user_id', $userId)
            ->where('organization_code', $organizationCode)
            ->whereNull('deleted_at')
            ->orderBy('updated_at', 'desc');

        $results = Db::select($query->toSql(), $query->getBindings());
        return $this->toEntities($results);
    }

    /**
     * Get message schedules by project ID.
     */
    public function getMessageSchedulesByProjectId(int $projectId, string $userId, string $organizationCode): array
    {
        $query = $this->messageScheduleModel::query()
            ->where('project_id', $projectId)
            ->where('user_id', $userId)
            ->where('organization_code', $organizationCode)
            ->whereNull('deleted_at')
            ->orderBy('updated_at', 'desc');

        $results = Db::select($query->toSql(), $query->getBindings());
        return $this->toEntities($results);
    }

    /**
     * Get message schedules by topic ID.
     */
    public function getMessageSchedulesByTopicId(int $topicId, string $userId, string $organizationCode): array
    {
        $query = $this->messageScheduleModel::query()
            ->where('topic_id', $topicId)
            ->where('user_id', $userId)
            ->where('organization_code', $organizationCode)
            ->whereNull('deleted_at')
            ->orderBy('updated_at', 'desc');

        $results = Db::select($query->toSql(), $query->getBindings());
        return $this->toEntities($results);
    }

    /**
     * Find message schedule by task scheduler crontab ID.
     */
    public function findByTaskSchedulerCrontabId(int $taskSchedulerCrontabId): ?MessageScheduleEntity
    {
        /** @var null|MessageScheduleModel $model */
        $model = $this->messageScheduleModel::query()
            ->where('task_scheduler_crontab_id', $taskSchedulerCrontabId)
            ->whereNull('deleted_at')
            ->first();

        if (! $model) {
            return null;
        }

        return $this->modelToEntity($model);
    }

    /**
     * Get enabled message schedules for a user.
     */
    public function getEnabledMessageSchedules(string $userId, string $organizationCode): array
    {
        $query = $this->messageScheduleModel::query()
            ->where('user_id', $userId)
            ->where('organization_code', $organizationCode)
            ->where('status', 1)
            ->whereNull('deleted_at')
            ->orderBy('updated_at', 'desc');

        $results = Db::select($query->toSql(), $query->getBindings());
        return $this->toEntities($results);
    }

    /**
     * Update task scheduler crontab ID.
     */
    public function updateTaskSchedulerCrontabId(int $id, ?int $taskSchedulerCrontabId): bool
    {
        $conditions = ['id' => $id];
        $data = [
            'task_scheduler_crontab_id' => $taskSchedulerCrontabId,
            'updated_at' => date('Y-m-d H:i:s'),
        ];
        return $this->updateMessageScheduleByCondition($conditions, $data);
    }

    /**
     * Batch update message schedules by condition.
     */
    public function batchUpdateByCondition(array $condition, array $data): int
    {
        return $this->messageScheduleModel::query()
            ->where($condition)
            ->update($data);
    }

    /**
     * Model to entity.
     */
    protected function modelToEntity(MessageScheduleModel $model): MessageScheduleEntity
    {
        return new MessageScheduleEntity([
            'id' => $model->id ?? 0,
            'user_id' => $model->user_id ?? '',
            'organization_code' => $model->organization_code ?? '',
            'task_name' => $model->task_name ?? '',
            'message_type' => $model->message_type ?? '',
            'message_content' => $model->message_content ?? [],
            'workspace_id' => $model->workspace_id ?? 0,
            'project_id' => $model->project_id ?? 0,
            'topic_id' => $model->topic_id ?? 0,
            'status' => $model->status ?? 0,
            'time_config' => $model->time_config ?? [],
            'task_scheduler_crontab_id' => $model->task_scheduler_crontab_id,
            'created_uid' => $model->created_uid ?? '',
            'updated_uid' => $model->updated_uid ?? '',
            'created_at' => $model->created_at ? $model->created_at->format('Y-m-d H:i:s') : null,
            'updated_at' => $model->updated_at ? $model->updated_at->format('Y-m-d H:i:s') : null,
            'deleted_at' => $model->deleted_at ? $model->deleted_at->format('Y-m-d H:i:s') : null,
        ]);
    }

    /**
     * Array results to entities.
     */
    protected function toEntities(array $results): array
    {
        return array_map(function ($row) {
            return $this->toEntity($row);
        }, $results);
    }

    /**
     * Array to entity.
     */
    protected function toEntity(array|object $data): MessageScheduleEntity
    {
        $data = is_object($data) ? (array) $data : $data;

        return new MessageScheduleEntity([
            'id' => $data['id'] ?? 0,
            'user_id' => $data['user_id'] ?? '',
            'organization_code' => $data['organization_code'] ?? '',
            'task_name' => $data['task_name'] ?? '',
            'message_type' => $data['message_type'] ?? '',
            'message_content' => is_string($data['message_content'] ?? '') ? json_decode($data['message_content'], true) : ($data['message_content'] ?? []),
            'workspace_id' => $data['workspace_id'] ?? 0,
            'project_id' => $data['project_id'] ?? 0,
            'topic_id' => $data['topic_id'] ?? 0,
            'status' => $data['status'] ?? 0,
            'time_config' => is_string($data['time_config'] ?? '') ? json_decode($data['time_config'], true) : ($data['time_config'] ?? []),
            'task_scheduler_crontab_id' => $data['task_scheduler_crontab_id'] ?? null,
            'created_uid' => $data['created_uid'] ?? '',
            'updated_uid' => $data['updated_uid'] ?? '',
            'created_at' => $data['created_at'] ?? null,
            'updated_at' => $data['updated_at'] ?? null,
            'deleted_at' => $data['deleted_at'] ?? null,
        ]);
    }

    /**
     * Entity to model attributes.
     */
    protected function entityToModelAttributes(MessageScheduleEntity $entity): array
    {
        return [
            'user_id' => $entity->getUserId(),
            'organization_code' => $entity->getOrganizationCode(),
            'task_name' => $entity->getTaskName(),
            'message_type' => $entity->getMessageType(),
            'message_content' => $entity->getMessageContent(),
            'workspace_id' => $entity->getWorkspaceId(),
            'project_id' => $entity->getProjectId(),
            'topic_id' => $entity->getTopicId(),
            'status' => $entity->getStatus(),
            'time_config' => $entity->getTimeConfig(),
            'task_scheduler_crontab_id' => $entity->getTaskSchedulerCrontabId(),
            'created_uid' => $entity->getCreatedUid(),
            'updated_uid' => $entity->getUpdatedUid(),
        ];
    }
}

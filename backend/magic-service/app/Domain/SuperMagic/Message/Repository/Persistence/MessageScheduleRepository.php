<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Message\Repository\Persistence;

use App\Domain\SuperMagic\Message\Entity\MessageScheduleEntity;
use App\Domain\SuperMagic\Message\Repository\Facade\MessageScheduleRepositoryInterface;
use App\Domain\SuperMagic\Message\Repository\Model\MessageScheduleModel;
use App\Domain\SuperMagic\Project\Repository\Model\ProjectModel;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
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

    /** @return MessageScheduleEntity[] */
    public function getCleanupCandidates(int $afterId, int $limit, ?string $organizationCode = null, array $projectIds = []): array
    {
        // Include soft-deleted schedules whose scheduler plans may still exist.
        $query = $this->messageScheduleModel::withTrashed()
            ->select(['id', 'project_id', 'organization_code', 'deleted_at'])
            ->where('id', '>', $afterId)
            ->where('project_id', '>', 0)
            ->whereDoesntHave('project');

        if ($organizationCode !== null) {
            $query->where('organization_code', $organizationCode);
        }
        if ($projectIds !== []) {
            $query->whereIn('project_id', $projectIds);
        }

        return $query->orderBy('id')->limit($limit)->get()
            ->map(fn (MessageScheduleModel $model) => $this->modelToEntity($model))->all();
    }

    public function findByIdForCleanup(int $id): ?MessageScheduleEntity
    {
        $model = $this->messageScheduleModel::withTrashed()
            ->select(['id', 'project_id', 'organization_code', 'deleted_at'])
            ->lockForUpdate()->find($id);
        return $model ? $this->modelToEntity($model) : null;
    }

    public function isProjectAvailableForCleanup(int $projectId): bool
    {
        // Serialize cleanup with project restoration, including soft-deleted rows.
        $project = ProjectModel::withTrashed()->lockForUpdate()->find($projectId);
        return $project !== null && $project->deleted_at === null;
    }

    public function markDeletedForCleanup(int $id, string $updatedUid): void
    {
        $now = date('Y-m-d H:i:s');
        $this->messageScheduleModel::query()->where('id', $id)->toBase()->update([
            'enabled' => 0,
            'deleted_at' => $now,
            'updated_at' => $now,
            'updated_uid' => $updatedUid,
        ]);
    }

    public function findByIdForUpdate(int $id): ?MessageScheduleEntity
    {
        if (Db::transactionLevel() === 0) {
            throw new RuntimeException('Schedule locking read requires a transaction');
        }
        /** @var null|MessageScheduleModel $model */
        $model = $this->messageScheduleModel::query()->where('id', $id)->lockForUpdate()->first();
        return $model ? $this->modelToEntity($model) : null;
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
        string $orderDirection = 'desc',
        array $selectFields = []
    ): array {
        $query = $this->messageScheduleModel::query();

        // Default filter for non-deleted data
        $query->whereNull('deleted_at');

        // Apply before count and pagination so list and total share the same scope.
        $query->where(static function ($query): void {
            $query->where('project_id', 0)->orWhereHas('project');
        });

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

        // Apply field selection if specified
        if (! empty($selectFields)) {
            $query->select($selectFields);
        }

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
            ->where('enabled', 1)
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
     * Batch update message schedule owner and workspace by project IDs.
     */
    public function batchUpdateOwnerAndWorkspaceByProjectIds(
        array $projectIds,
        string $fromUserId,
        string $toUserId,
        string $organizationCode,
        int $workspaceId,
        string $updatedUid,
        string $updatedAt
    ): int {
        if (empty($projectIds)) {
            return 0;
        }

        return $this->messageScheduleModel::query()
            ->whereIn('project_id', $projectIds)
            ->where('user_id', $fromUserId)
            ->where('organization_code', $organizationCode)
            ->whereNull('deleted_at')
            ->update([
                'user_id' => $toUserId,
                'workspace_id' => $workspaceId,
                'updated_uid' => $updatedUid,
                'updated_at' => $updatedAt,
            ]);
    }

    /**
     * Batch update message schedule workspace by project IDs.
     */
    public function batchUpdateWorkspaceByProjectIds(
        array $projectIds,
        string $userId,
        string $organizationCode,
        int $workspaceId,
        string $updatedUid,
        string $updatedAt
    ): int {
        if (empty($projectIds)) {
            return 0;
        }

        return $this->messageScheduleModel::query()
            ->whereIn('project_id', $projectIds)
            ->where('user_id', $userId)
            ->where('organization_code', $organizationCode)
            ->whereNull('deleted_at')
            ->update([
                'workspace_id' => $workspaceId,
                'updated_uid' => $updatedUid,
                'updated_at' => $updatedAt,
            ]);
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
            'completed' => $model->completed ?? 0,
            'enabled' => $model->enabled ?? 1,
            'deadline' => $model->deadline ? $model->deadline->format('Y-m-d H:i:s') : null,
            'remark' => $model->remark ?? '',
            'time_config' => $model->time_config ?? [],
            'plugins' => $model->plugins ?? null,
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
            'completed' => $data['completed'] ?? 0,
            'enabled' => $data['enabled'] ?? 1,
            'deadline' => $data['deadline'] ?? null,
            'remark' => $data['remark'] ?? '',
            'time_config' => is_string($data['time_config'] ?? '') ? json_decode($data['time_config'], true) : ($data['time_config'] ?? []),
            'plugins' => is_string($data['plugins'] ?? '') ? json_decode($data['plugins'], true) : ($data['plugins'] ?? null),
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
            'completed' => $entity->getCompleted(),
            'enabled' => $entity->getEnabled(),
            'deadline' => $entity->getDeadline(),
            'remark' => $entity->getRemark(),
            'time_config' => $entity->getTimeConfig(),
            'plugins' => $entity->getPlugins(),
            'task_scheduler_crontab_id' => $entity->getTaskSchedulerCrontabId(),
            'created_uid' => $entity->getCreatedUid(),
            'updated_uid' => $entity->getUpdatedUid(),
        ];
    }
}

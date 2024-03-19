<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\Response\AudioProjectExtraDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\AudioProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberRole;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectMode;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\AudioProjectRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\AudioProjectModel;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\ProjectModel;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\ProjectItemDTO;
use Hyperf\Database\Model\SoftDeletingScope;

/**
 * Audio Project Repository.
 */
class AudioProjectRepository implements AudioProjectRepositoryInterface
{
    /**
     * Find audio project by project ID.
     */
    public function findByProjectId(int $projectId): ?AudioProjectEntity
    {
        $model = AudioProjectModel::where('project_id', $projectId)->first();
        return $model ? $this->toEntity($model) : null;
    }

    /**
     * Find audio project by task key.
     */
    public function findByTaskKey(string $taskKey): ?AudioProjectEntity
    {
        $model = AudioProjectModel::where('task_key', $taskKey)->first();
        return $model ? $this->toEntity($model) : null;
    }

    /**
     * Find audio projects by project IDs (batch query).
     */
    public function findByProjectIds(array $projectIds): array
    {
        if (empty($projectIds)) {
            return [];
        }

        $models = AudioProjectModel::whereIn('project_id', $projectIds)->get();
        $result = [];

        foreach ($models as $model) {
            $result[$model->project_id] = $this->toEntity($model);
        }

        return $result;
    }

    /**
     * Find audio projects by task keys with user permission validation (batch query).
     *
     * Security: JOIN with magic_super_agent_project to ensure task belongs to user.
     *
     * @param array $taskKeys Array of task keys
     * @param string $userId User ID (for permission validation)
     * @param string $orgCode Organization code (for permission validation)
     * @return array Associative array [task_key => AudioProjectEntity]
     */
    public function findByTaskKeysWithPermission(array $taskKeys, string $userId, string $orgCode): array
    {
        if (empty($taskKeys)) {
            return [];
        }

        // Security: JOIN with project table to validate user permission
        $models = AudioProjectModel::query()
            ->join('magic_super_agent_project as p', 'magic_super_agent_audio_project.project_id', '=', 'p.id')
            ->whereIn('magic_super_agent_audio_project.task_key', $taskKeys)
            ->where('p.user_id', $userId)
            ->where('p.user_organization_code', $orgCode)
            ->whereNull('p.deleted_at')  // Exclude soft-deleted projects
            ->select('magic_super_agent_audio_project.*')  // Only select audio_project fields
            ->get();

        $result = [];

        foreach ($models as $model) {
            $result[$model->task_key] = $this->toEntity($model);
        }

        return $result;
    }

    /**
     * Find audio projects with filters (paginated).
     *
     * @param string $userId User ID
     * @param string $orgCode Organization code
     * @param array $filters Filter conditions
     * @param int $page Page number
     * @param int $pageSize Page size
     * @param string $sortBy Sort by field (created_at | updated_at)
     * @param string $sortOrder Sort order (asc | desc)
     * @return array ['list' => [], 'total' => 0, 'page' => 1, 'page_size' => 20]
     */
    public function findAudioProjectsWithFilters(
        string $userId,
        string $orgCode,
        array $filters,
        int $page,
        int $pageSize,
        string $sortBy = 'updated_at',
        string $sortOrder = 'desc'
    ): array {
        $query = ProjectModel::query()
            ->withoutGlobalScope(SoftDeletingScope::class)
            ->from('magic_super_agent_project as p')
            ->where('p.user_id', $userId)
            ->where('p.user_organization_code', $orgCode)
            ->where('p.project_mode', ProjectMode::AUDIO->value)
            ->whereNull('p.deleted_at')
            ->join(
                'magic_super_agent_audio_project as a',
                'p.id',
                '=',
                'a.project_id'
            )
            ->select([
                // Project fields
                'p.id',
                'p.workspace_id',
                'p.project_name',
                'p.project_description',
                'p.work_dir',
                'p.project_mode',
                'p.project_status',
                'p.current_topic_id',
                'p.current_topic_status',
                'p.is_hidden',
                'p.is_collaboration_enabled',
                'p.default_join_permission',
                'p.user_id',
                'p.created_at',
                'p.updated_at',
                // Audio fields
                'a.topic_id',
                'a.model_id',
                'a.task_key',
                'a.auto_summary',
                'a.source',
                'a.audio_source',
                'a.audio_file_id',
                'a.device_id',
                'a.duration',
                'a.file_size',
                'a.tags',
                'a.current_phase',
                'a.phase_status',
                'a.phase_percent',
                'a.phase_error',
            ]);

        // Apply filters
        if (! empty($filters['project_ids']) && is_array($filters['project_ids'])) {
            $query->whereIn('p.id', $filters['project_ids']);
        }

        if (! empty($filters['current_phase']) && is_array($filters['current_phase'])) {
            $query->whereIn('a.current_phase', $filters['current_phase']);
        }

        if (! empty($filters['source'])) {
            $query->where('a.source', $filters['source']);
        }

        if (! empty($filters['device_id'])) {
            $query->where('a.device_id', $filters['device_id']);
        }

        if (! empty($filters['keyword'])) {
            $query->where('p.project_name', 'like', '%' . $filters['keyword'] . '%');
        }

        // Workspace ID filter
        if (array_key_exists('workspace_id', $filters)) {
            $workspaceId = $filters['workspace_id'];
            // If workspace_id is null or 'null' string, filter by IS NULL
            if ($workspaceId === null || $workspaceId === 'null') {
                $query->whereNull('p.workspace_id');
            } else {
                // Filter by specific workspace_id
                $query->where('p.workspace_id', $workspaceId);
            }
        }
        // If 'workspace_id' key doesn't exist in $filters, don't filter

        if (! empty($filters['created_at_start'])) {
            $query->where('p.created_at', '>=', $filters['created_at_start']);
        }

        if (! empty($filters['created_at_end'])) {
            $query->where('p.created_at', '<=', $filters['created_at_end']);
        }

        // Filter by is_hidden status
        if (array_key_exists('is_hidden', $filters) && $filters['is_hidden'] !== null) {
            $query->where('p.is_hidden', $filters['is_hidden']);
        }

        // Apply sorting (with validation for security)
        $allowedSortFields = ['created_at', 'updated_at'];
        $allowedSortOrders = ['asc', 'desc'];

        if (in_array($sortBy, $allowedSortFields) && in_array($sortOrder, $allowedSortOrders)) {
            $query->orderBy('p.' . $sortBy, $sortOrder);
        } else {
            // Fallback to default sorting if invalid parameters
            $query->orderBy('p.id', 'desc');
        }

        // Get total count
        $total = $query->count();

        // Pagination (manual)
        $items = $query->offset(($page - 1) * $pageSize)
            ->limit($pageSize)
            ->get();

        return [
            'list' => $this->toAudioProjectListItems($items->all()),
            'total' => $total,
            'page' => $page,
            'page_size' => $pageSize,
        ];
    }

    /**
     * Save audio project (create or update).
     */
    public function save(AudioProjectEntity $entity): void
    {
        $data = [
            'project_id' => $entity->getProjectId(),
            'topic_id' => $entity->getTopicId(),
            'model_id' => $entity->getModelId(),
            'task_key' => $entity->getTaskKey(),
            'auto_summary' => $entity->isAutoSummary(),
            'source' => $entity->getSource(),
            'audio_source' => $entity->getAudioSource(),
            'audio_file_id' => $entity->getAudioFileId(),
            'device_id' => $entity->getDeviceId(),
            'duration' => $entity->getDuration(),
            'file_size' => $entity->getFileSize(),
            'tags' => json_encode($entity->getTags(), JSON_UNESCAPED_UNICODE),
            'current_phase' => $entity->getCurrentPhase(),
            'phase_status' => $entity->getPhaseStatus(),
            'phase_percent' => $entity->getPhasePercent(),
            'phase_error' => $entity->getPhaseError(),
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        if ($entity->getId() > 0) {
            // Update existing record (cast doesn't apply here, need manual JSON encode)
            AudioProjectModel::where('id', $entity->getId())->update($data);
        } else {
            // Create new record
            // Generate snowflake ID if not set
            if ($entity->getId() === 0) {
                $data['id'] = IdGenerator::getSnowId();
            } else {
                $data['id'] = $entity->getId();
            }
            $data['created_at'] = date('Y-m-d H:i:s');
            $model = AudioProjectModel::create($data);
            $entity->setId($model->id);
        }
    }

    /**
     * Update audio project by project ID with partial data.
     *
     * @param int $projectId Project ID
     * @param array $data Data to update (e.g., ['tags' => [...], 'duration' => 123])
     * @return int Number of affected rows
     */
    public function updateByProjectId(int $projectId, array $data): int
    {
        // Handle tags field: if it's an array, encode it to JSON
        if (isset($data['tags']) && is_array($data['tags'])) {
            $data['tags'] = json_encode($data['tags'], JSON_UNESCAPED_UNICODE);
        }

        // Automatically add updated_at timestamp
        $data['updated_at'] = date('Y-m-d H:i:s');

        // Execute update query (cast doesn't apply here)
        return AudioProjectModel::where('project_id', $projectId)->update($data);
    }

    /**
     * Delete audio project by project ID.
     */
    public function deleteByProjectId(int $projectId): void
    {
        AudioProjectModel::where('project_id', $projectId)->delete();
    }

    /**
     * Convert list to array format.
     * Use ProjectItemDTO for consistency with create project API.
     */
    private function toAudioProjectListItems(array $models): array
    {
        return array_map(function ($model) {
            // Build ProjectEntity with required fields
            $projectEntity = new ProjectEntity([
                'id' => $model->id,
                'workspace_id' => $model->workspace_id,
                'project_name' => $model->project_name,
                'project_description' => $model->project_description ?? '',
                'work_dir' => $model->work_dir ?? '',
                'project_mode' => $model->project_mode,
                'project_status' => $model->project_status ?? 1,
                'current_topic_id' => $model->current_topic_id ?? '',
                'current_topic_status' => $model->current_topic_status ?? '',
                'is_hidden' => $model->is_hidden ?? false,
                'is_collaboration_enabled' => $model->is_collaboration_enabled ?? 1,
                'default_join_permission' => MemberRole::from($model->default_join_permission ?? 'viewer'),
                'user_id' => $model->user_id ?? '',
                'created_at' => $model->created_at?->format('Y-m-d H:i:s'),
                'updated_at' => $model->updated_at?->format('Y-m-d H:i:s'),
            ]);

            // Use ProjectItemDTO for consistent response format
            $projectDTO = ProjectItemDTO::fromEntity($projectEntity);
            $projectArray = $projectDTO->toArray();

            // Add extra field with audio extension info using AudioProjectExtraDTO
            $projectArray['extra'] = AudioProjectExtraDTO::fromArray([
                'topic_id' => $model->topic_id,
                'model_id' => $model->model_id,
                'task_key' => $model->task_key,
                'auto_summary' => $model->auto_summary,
                'source' => $model->source,
                'audio_source' => $model->audio_source,
                'audio_file_id' => $model->audio_file_id,
                'device_id' => $model->device_id,
                'duration' => $model->duration,
                'file_size' => $model->file_size,
                'tags' => is_string($model->tags) ? json_decode($model->tags ?: '[]', true) : ($model->tags ?? []),
                'current_phase' => $model->current_phase,
                'phase_status' => $model->phase_status,
                'phase_percent' => $model->phase_percent,
                'phase_error' => $model->phase_error,
            ])->toArray();

            return $projectArray;
        }, $models);
    }

    /**
     * Convert Model to Entity.
     */
    private function toEntity(AudioProjectModel $model): AudioProjectEntity
    {
        $entity = new AudioProjectEntity();
        $entity->setId($model->id);
        $entity->setProjectId($model->project_id);
        $entity->setTopicId($model->topic_id);
        $entity->setModelId($model->model_id);
        $entity->setTaskKey($model->task_key);
        $entity->setAutoSummary($model->auto_summary ?? true);
        $entity->setSource($model->source);
        $entity->setAudioSource($model->audio_source ?? 'recorded');
        $entity->setAudioFileId($model->audio_file_id);
        $entity->setDeviceId($model->device_id);
        $entity->setDuration($model->duration);
        $entity->setFileSize($model->file_size);
        // Handle tags: cast may not work in all cases, manually decode if string
        $tags = $model->tags;
        if (is_string($tags)) {
            $tags = json_decode($tags ?: '[]', true) ?? [];
        }
        $entity->setTags($tags ?? []);
        $entity->setCurrentPhase($model->current_phase ?? 'waiting');
        $entity->setPhaseStatus($model->phase_status);
        $entity->setPhasePercent($model->phase_percent ?? 0);
        $entity->setPhaseError($model->phase_error);
        $entity->setCreatedAt($model->created_at?->format('Y-m-d H:i:s'));
        $entity->setUpdatedAt($model->updated_at?->format('Y-m-d H:i:s'));

        return $entity;
    }
}

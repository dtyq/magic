<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectForkEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectForkRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\ProjectForkModel;
use RuntimeException;

/**
 * Project fork repository implementation.
 */
class ProjectForkRepository extends AbstractRepository implements ProjectForkRepositoryInterface
{
    public function __construct(
        protected ProjectForkModel $projectForkModel
    ) {
    }

    /**
     * Create a new project fork record.
     */
    public function create(ProjectForkEntity $projectFork): ProjectForkEntity
    {
        $attributes = $this->entityToModelAttributes($projectFork);
        if ($projectFork->getId() == 0) {
            $attributes['id'] = IdGenerator::getSnowId();
            $projectFork->setId($attributes['id']);
        } else {
            $attributes['id'] = $projectFork->getId();
        }
        $this->projectForkModel::query()->create($attributes);
        return $projectFork;
    }

    /**
     * Save project fork entity.
     */
    public function save(ProjectForkEntity $projectFork): ProjectForkEntity
    {
        $attributes = $this->entityToModelAttributes($projectFork);

        if ($projectFork->getId() > 0) {
            /**
             * @var null|ProjectForkModel $model
             */
            $model = $this->projectForkModel::query()->find($projectFork->getId());
            if (! $model) {
                throw new RuntimeException('Project fork not found for update: ' . $projectFork->getId());
            }
            $model->fill($attributes);
            $model->save();
            return $this->modelToEntity($model);
        }

        // Create new record
        $attributes['id'] = IdGenerator::getSnowId();
        $projectFork->setId($attributes['id']);
        $this->projectForkModel::query()->create($attributes);
        return $projectFork;
    }

    /**
     * Find project fork by ID.
     */
    public function findById(int $id): ?ProjectForkEntity
    {
        /** @var null|ProjectForkModel $model */
        $model = $this->projectForkModel::query()->find($id);
        if (! $model) {
            return null;
        }
        return $this->modelToEntity($model);
    }

    /**
     * Find project fork by user and source project.
     */
    public function findByUserAndProject(string $userId, int $sourceProjectId): ?ProjectForkEntity
    {
        /** @var null|ProjectForkModel $model */
        $model = $this->projectForkModel::query()
            ->where('user_id', $userId)
            ->where('source_project_id', $sourceProjectId)
            ->first();

        if (! $model) {
            return null;
        }
        return $this->modelToEntity($model);
    }

    /**
     * Find project fork by fork project ID.
     */
    public function findByForkProjectId(int $forkProjectId): ?ProjectForkEntity
    {
        /** @var null|ProjectForkModel $model */
        $model = $this->projectForkModel::query()
            ->where('fork_project_id', $forkProjectId)
            ->first();

        if (! $model) {
            return null;
        }
        return $this->modelToEntity($model);
    }

    /**
     * Update fork status and progress.
     */
    public function updateStatus(int $id, string $status, int $progress, ?string $errMsg = null): bool
    {
        $data = [
            'status' => $status,
            'progress' => $progress,
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        if ($errMsg !== null) {
            $data['err_msg'] = $errMsg;
        }

        return $this->projectForkModel::query()
            ->where('id', $id)
            ->update($data) > 0;
    }

    /**
     * Update current processing file ID.
     */
    public function updateCurrentFileId(int $id, ?int $currentFileId): bool
    {
        return $this->projectForkModel::query()
            ->where('id', $id)
            ->update([
                'current_file_id' => $currentFileId,
                'updated_at' => date('Y-m-d H:i:s'),
            ]) > 0;
    }

    /**
     * Update processed files count and progress.
     */
    public function updateProgress(int $id, int $processedFiles, int $progress): bool
    {
        return $this->projectForkModel::query()
            ->where('id', $id)
            ->update([
                'processed_files' => $processedFiles,
                'progress' => $progress,
                'updated_at' => date('Y-m-d H:i:s'),
            ]) > 0;
    }

    /**
     * Get fork records by user ID with pagination.
     */
    public function getForksByUser(
        string $userId,
        int $page = 1,
        int $pageSize = 10,
        string $orderBy = 'created_at',
        string $orderDirection = 'desc'
    ): array {
        $query = $this->projectForkModel::query()
            ->where('user_id', $userId);

        // Get total count
        $total = $query->count();

        // Get paginated results
        $list = $query->orderBy($orderBy, $orderDirection)
            ->offset(($page - 1) * $pageSize)
            ->limit($pageSize)
            ->get();

        // Convert to entities
        $entities = [];
        foreach ($list as $model) {
            /* @var ProjectForkModel $model */
            $entities[] = $this->modelToEntity($model);
        }

        return [
            'total' => $total,
            'list' => $entities,
        ];
    }

    /**
     * Get running forks by user.
     */
    public function getRunningForksByUser(string $userId): array
    {
        $list = $this->projectForkModel::query()
            ->where('user_id', $userId)
            ->where('status', 'running')
            ->orderBy('created_at', 'desc')
            ->get();

        $entities = [];
        foreach ($list as $model) {
            /* @var ProjectForkModel $model */
            $entities[] = $this->modelToEntity($model);
        }

        return $entities;
    }

    /**
     * Delete project fork record.
     */
    public function delete(ProjectForkEntity $projectFork): bool
    {
        /** @var null|ProjectForkModel $model */
        $model = $this->projectForkModel::query()->find($projectFork->getId());
        if (! $model) {
            return false;
        }

        return $model->delete();
    }

    /**
     * Check if user has running fork for specific project.
     */
    public function hasRunningFork(string $userId, int $sourceProjectId): bool
    {
        return $this->projectForkModel::query()
            ->where('user_id', $userId)
            ->where('source_project_id', $sourceProjectId)
            ->where('status', 'running')
            ->exists();
    }

    /**
     * Get fork statistics by user.
     */
    public function getForkStatsByUser(string $userId): array
    {
        $stats = $this->projectForkModel::query()
            ->selectRaw('
                status,
                COUNT(*) as count,
                AVG(progress) as avg_progress
            ')
            ->where('user_id', $userId)
            ->groupBy('status')
            ->get()
            ->keyBy('status')
            ->toArray();

        return [
            'total' => array_sum(array_column($stats, 'count')),
            'running' => $stats['running']['count'] ?? 0,
            'finished' => $stats['finished']['count'] ?? 0,
            'failed' => $stats['failed']['count'] ?? 0,
            'avg_progress' => $stats['running']['avg_progress'] ?? 0,
        ];
    }

    public function getForkCountByProjectId(int $projectId): int
    {
        return $this->projectForkModel::query()->where('source_project_id', $projectId)->where('status', 'finished')->count();
    }

    /**
     * Convert model to entity.
     */
    protected function modelToEntity(ProjectForkModel $model): ProjectForkEntity
    {
        return new ProjectForkEntity([
            'id' => $model->id ?? 0,
            'source_project_id' => $model->source_project_id ?? 0,
            'fork_project_id' => $model->fork_project_id ?? 0,
            'target_workspace_id' => $model->target_workspace_id ?? 0,
            'user_id' => $model->user_id ?? '',
            'user_organization_code' => $model->user_organization_code ?? '',
            'status' => $model->status ?? 'running',
            'progress' => $model->progress ?? 0,
            'current_file_id' => $model->current_file_id ?? null,
            'total_files' => $model->total_files ?? 0,
            'processed_files' => $model->processed_files ?? 0,
            'err_msg' => $model->err_msg ?? null,
            'created_uid' => $model->created_uid ?? '',
            'updated_uid' => $model->updated_uid ?? '',
            'created_at' => $model->created_at ? $model->created_at->format('Y-m-d H:i:s') : null,
            'updated_at' => $model->updated_at ? $model->updated_at->format('Y-m-d H:i:s') : null,
        ]);
    }

    /**
     * Convert entity to model attributes.
     */
    protected function entityToModelAttributes(ProjectForkEntity $entity): array
    {
        return [
            'source_project_id' => $entity->getSourceProjectId(),
            'fork_project_id' => $entity->getForkProjectId(),
            'target_workspace_id' => $entity->getTargetWorkspaceId(),
            'user_id' => $entity->getUserId(),
            'user_organization_code' => $entity->getUserOrganizationCode(),
            'status' => $entity->getStatus()->value,
            'progress' => $entity->getProgress(),
            'current_file_id' => $entity->getCurrentFileId(),
            'total_files' => $entity->getTotalFiles(),
            'processed_files' => $entity->getProcessedFiles(),
            'err_msg' => $entity->getErrMsg(),
            'created_uid' => $entity->getCreatedUid(),
            'updated_uid' => $entity->getUpdatedUid(),
        ];
    }
}

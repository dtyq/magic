<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberRole;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\ProjectModel;
use RuntimeException;

/**
 * 项目仓储实现.
 */
class ProjectRepository extends AbstractRepository implements ProjectRepositoryInterface
{
    public function __construct(
        protected ProjectModel $projectModel
    ) {
    }

    /**
     * 根据ID查找项目.
     */
    public function findById(int $id): ?ProjectEntity
    {
        /** @var null|ProjectModel $model */
        $model = $this->projectModel::query()->find($id);
        if (! $model) {
            return null;
        }
        return $this->toEntity($model->toArray());
    }

    /**
     * 保存项目.
     */
    public function save(ProjectEntity $project): ProjectEntity
    {
        $attributes = $this->entityToModelAttributes($project);

        if ($project->getId() > 0) {
            /**
             * @var null|ProjectModel $model
             */
            $model = $this->projectModel::query()->find($project->getId());
            if (! $model) {
                throw new RuntimeException('Project not found for update: ' . $project->getId());
            }
            $model->fill($attributes);
            $model->save();
            return $this->toEntity($model->toArray());
        }

        // 创建
        $attributes['id'] = IdGenerator::getSnowId();
        $project->setId($attributes['id']);
        $this->projectModel::query()->create($attributes);
        return $project;
    }

    public function create(ProjectEntity $project): ProjectEntity
    {
        $attributes = $this->entityToModelAttributes($project);
        if ($project->getId() == 0) {
            $attributes['id'] = IdGenerator::getSnowId();
            $project->setId($attributes['id']);
        } else {
            $attributes['id'] = $project->getId();
        }
        $this->projectModel::query()->create($attributes);
        return $project;
    }

    /**
     * 删除项目（软删除）.
     */
    public function delete(ProjectEntity $project): bool
    {
        /** @var null|ProjectModel $model */
        $model = $this->projectModel::query()->find($project->getId());
        if (! $model) {
            return false;
        }

        return $model->delete();
    }

    /**
     * Batch find projects by IDs (no auth filter).
     *
     * @param array $ids Project IDs
     * @return ProjectEntity[]
     */
    public function findByIds(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }

        $models = $this->projectModel::query()
            ->whereIn('id', $ids)
            ->whereNull('deleted_at')
            ->orderBy('updated_at', 'desc')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = $this->toEntity($model->toArray());
        }

        return $entities;
    }

    /**
     * Find projects by IDs with user and organization filter.
     *
     * @param array $projectIds Project IDs
     * @param string $userId User ID
     * @param string $organizationCode Organization code
     * @return ProjectEntity[]
     */
    public function findByIdsWithAuth(array $projectIds, string $userId, string $organizationCode): array
    {
        if (empty($projectIds)) {
            return [];
        }

        $models = $this->projectModel::query()
            ->whereIn('id', $projectIds)
            ->where('user_id', $userId)
            ->where('user_organization_code', $organizationCode)
            ->whereNull('deleted_at')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = $this->toEntity($model->toArray());
        }

        return $entities;
    }

    /**
     * 统计工作区下的项目数量.
     */
    public function countByWorkspaceId(int $workspaceId): int
    {
        return $this->projectModel::query()
            ->where('workspace_id', $workspaceId)
            ->whereNull('deleted_at')
            ->count();
    }

    public function updateProjectByCondition(array $condition, array $data): bool
    {
        return $this->projectModel::query()
            ->where($condition)
            ->update($data) > 0;
    }

    /**
     * 根据条件获取项目列表
     * 支持分页和排序.
     */
    public function getProjectsByConditions(
        array $conditions = [],
        int $page = 1,
        int $pageSize = 10,
        string $orderBy = 'updated_at',
        string $orderDirection = 'desc'
    ): array {
        $query = $this->projectModel::query();

        // 默认过滤已删除的数据
        $query->whereNull('deleted_at');

        // 应用查询条件
        foreach ($conditions as $field => $value) {
            if (is_array($value)) {
                // 支持project_ids数组查询
                $query->whereIn('id', $value);
            } elseif ($field === 'project_name_like') {
                // Support fuzzy search for project name
                $query->where('project_name', 'like', '%' . $value . '%');
            } else {
                // 默认等于查询
                $query->where($field, $value);
            }
        }

        // 获取总数
        $total = $query->count();

        // 排序和分页
        $list = $query->orderBy($orderBy, $orderDirection)
            ->offset(($page - 1) * $pageSize)
            ->limit($pageSize)
            ->get();

        // 转换为实体对象
        $entities = [];
        foreach ($list as $model) {
            /* @var ProjectModel $model */
            $entities[] = $this->toEntity($model->toArray());
        }

        return [
            'total' => $total,
            'list' => $entities,
        ];
    }

    /**
     * 更新项目的updated_at为当前时间.
     */
    public function updateUpdatedAtToNow(int $projectId): bool
    {
        $conditions = ['id' => $projectId];
        $data = ['updated_at' => date('Y-m-d H:i:s')];
        return $this->updateProjectByCondition($conditions, $data);
    }

    /**
     * 根据工作区ID获取项目ID列表.
     *
     * @param int $workspaceId 工作区ID
     * @param string $userId 用户ID
     * @param string $organizationCode 组织代码
     * @return array 项目ID列表
     */
    public function getProjectIdsByWorkspaceId(int $workspaceId, string $userId, string $organizationCode): array
    {
        return $this->projectModel::query()
            ->where('workspace_id', $workspaceId)
            ->where('user_id', $userId)
            ->where('user_organization_code', $organizationCode)
            ->whereNull('deleted_at')
            ->pluck('id')
            ->map(function ($id) {
                return (string) $id;
            })
            ->toArray();
    }

    public function getOrganizationCodesByProjectIds(array $projectIds): array
    {
        $organizationCodes = $this->projectModel::query()
            ->whereIn('id', $projectIds)
            ->select('user_organization_code')
            ->pluck('user_organization_code')
            ->toArray();

        return array_values(array_unique($organizationCodes));
    }

    /**
     * Batch get project names by IDs.
     */
    public function getProjectNamesBatch(array $projectIds): array
    {
        if (empty($projectIds)) {
            return [];
        }

        $results = $this->projectModel::query()
            ->whereIn('id', $projectIds)
            ->whereNull('deleted_at')
            ->select(['id', 'project_name'])
            ->get();

        $projectNames = [];
        foreach ($results as $result) {
            $projectNames[(string) $result->id] = $result->project_name;
        }

        return $projectNames;
    }

    /**
     * 批量获取项目的workspace_id.
     *
     * @param array $projectIds 项目ID列表
     * @return array 项目ID => workspace_id的映射 ['project_id' => workspace_id]
     */
    public function getWorkspaceIdsByProjectIds(array $projectIds): array
    {
        if (empty($projectIds)) {
            return [];
        }

        $results = $this->projectModel::query()
            ->whereIn('id', $projectIds)
            ->whereNull('deleted_at')
            ->select(['id', 'workspace_id'])
            ->get();

        $workspaceIds = [];
        foreach ($results as $result) {
            $workspaceIds[(int) $result->id] = (int) $result->workspace_id;
        }

        return $workspaceIds;
    }

    public function batchUpdateOwner(array $projectIds, string $newUserId): int
    {
        if (empty($projectIds)) {
            return 0;
        }

        $now = date('Y-m-d H:i:s');

        return $this->projectModel::query()
            ->whereIn('id', $projectIds)
            ->update([
                'user_id' => $newUserId,
                'updated_at' => $now,
            ]);
    }

    public function batchUpdateWorkspaceAndOwner(
        array $projectIds,
        int $newWorkspaceId,
        string $newUserId
    ): int {
        if (empty($projectIds)) {
            return 0;
        }

        $now = date('Y-m-d H:i:s');

        return $this->projectModel::query()
            ->whereIn('id', $projectIds)
            ->update([
                'workspace_id' => $newWorkspaceId,
                'user_id' => $newUserId,
                'updated_at' => $now,
            ]);
    }

    public function batchUpdateWorkspace(array $projectIds, ?int $workspaceId, string $updatedAt): int
    {
        if (empty($projectIds)) {
            return 0;
        }

        return $this->projectModel::query()
            ->whereIn('id', $projectIds)
            ->whereNull('deleted_at')
            ->update([
                'workspace_id' => $workspaceId,
                'updated_at' => $updatedAt,
            ]);
    }

    public function findByUserIdAndIds(array $projectIds, string $userId): array
    {
        if (empty($projectIds)) {
            return [];
        }

        $models = $this->projectModel::query()
            ->whereIn('id', $projectIds)
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = $this->toEntity($model->toArray());
        }

        return $entities;
    }

    public function findHiddenProjectByWorkspaceAndUser(int $workspaceId, string $userId, int $hiddenType): ?ProjectEntity
    {
        $projectModel = ProjectModel::query()
            ->where('workspace_id', $workspaceId)
            ->where('user_id', $userId)
            ->where('is_hidden', true)
            ->where('hidden_type', $hiddenType)
            ->whereNull('deleted_at')
            ->first();

        if ($projectModel === null) {
            return null;
        }

        return $this->toEntity($projectModel->toArray());
    }

    public function findAllHiddenProjectsByWorkspaceAndUser(int $workspaceId, string $userId, int $hiddenType): array
    {
        $projectModels = ProjectModel::query()
            ->where('workspace_id', $workspaceId)
            ->where('user_id', $userId)
            ->where('is_hidden', true)
            ->where('hidden_type', $hiddenType)
            ->whereNull('deleted_at')
            ->orderBy('created_at', 'asc') // 按创建时间排序，旧的在前
            ->get();

        $entities = [];
        foreach ($projectModels as $model) {
            $entities[] = $this->toEntity($model->toArray());
        }

        return $entities;
    }

    /**
     * Batch count projects by workspace IDs.
     * Performance optimized with single GROUP BY query.
     *
     * @param array $workspaceIds Workspace ID array
     * @param string $userId User ID for data isolation
     * @param string $orgCode Organization code for data isolation
     * @return array ['workspace_id' => count, ...] Map of workspace ID to project count
     */
    public function countProjectsByWorkspaceIds(
        array $workspaceIds,
        string $userId,
        string $orgCode
    ): array {
        if (empty($workspaceIds)) {
            return [];
        }

        $results = ProjectModel::query()
            ->selectRaw('workspace_id, COUNT(*) as project_count')
            ->whereIn('workspace_id', $workspaceIds)
            ->where('user_id', $userId)
            ->where('user_organization_code', $orgCode)
            ->where('is_hidden', 0)
            ->whereNull('deleted_at')
            ->groupBy('workspace_id')
            ->get();

        // Convert to associative array for O(1) lookup
        $countMap = [];
        foreach ($results as $result) {
            $countMap[$result->workspace_id] = (int) $result->project_count;
        }

        return $countMap;
    }

    /**
     * Count ungrouped projects by mode for a user.
     */
    public function countUngroupedProjectsByMode(string $userId, string $userOrganizationCode, string $projectMode): int
    {
        return $this->projectModel::query()
            ->where('user_id', $userId)
            ->where('user_organization_code', $userOrganizationCode)
            ->where('project_mode', $projectMode)
            ->where('is_hidden', 0)
            ->whereNull('workspace_id')
            ->count();
    }

    /**
     * Update workspace_id to null for projects under specified workspace.
     */
    public function detachWorkspace(int $workspaceId, string $userId): bool
    {
        $this->projectModel::query()
            ->where('workspace_id', $workspaceId)
            ->whereNull('deleted_at')
            ->update([
                'workspace_id' => null,
                'updated_uid' => $userId,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

        return true;
    }

    /**
     * Update project hidden status.
     */
    public function updateHiddenStatus(int $projectId, bool $isHidden): bool
    {
        return $this->projectModel::query()
            ->where('id', $projectId)
            ->whereNull('deleted_at')
            ->update([
                'is_hidden' => $isHidden ? 1 : 0,
                'updated_at' => date('Y-m-d H:i:s'),
            ]) > 0;
    }

    /**
     * Batch enable collaboration for projects.
     */
    public function batchEnableCollaboration(array $projectIds): int
    {
        if (empty($projectIds)) {
            return 0;
        }

        return $this->projectModel::query()
            ->whereIn('id', $projectIds)
            ->whereNull('deleted_at')
            ->where('is_collaboration_enabled', 0)
            ->update([
                'is_collaboration_enabled' => 1,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
    }

    public function getProjectByTopicId(int $topicId): ?ProjectEntity
    {
        $model = ProjectModel::query()
            ->where('current_topic_id', $topicId)
            ->whereNull('deleted_at')
            ->first();
        if ($model === null) {
            return null;
        }
        return $this->toEntity($model->toArray());
    }

    /**
     * 查询项目（包含软删除）.
     *
     * @param int $id 项目ID
     */
    public function findByIdWithTrashed(int $id): ?ProjectEntity
    {
        $model = $this->projectModel::withTrashed()->find($id);

        if (! $model) {
            return null;
        }

        return $this->modelToEntityForRestore($model);
    }

    /**
     * 恢复单个项目.
     *
     * @param int $id 项目ID
     * @param string $userId 操作用户ID
     * @return bool 是否成功
     */
    public function restore(int $id, string $userId): bool
    {
        return $this->projectModel::withTrashed()
            ->where('id', $id)
            ->update([
                'deleted_at' => null,
                'updated_uid' => $userId,
                'updated_at' => date('Y-m-d H:i:s'),
            ]) > 0;
    }

    /**
     * 检查项目是否存在且未被删除.
     *
     * @param int $id 项目ID
     * @return bool 项目存在且未被删除返回true，否则返回false
     */
    public function existsAndNotDeleted(int $id): bool
    {
        return $this->projectModel::query()
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->exists();
    }

    /**
     * 查询工作区下的项目ID（排除指定ID）.
     *
     * @param int $workspaceId 工作区ID
     * @param array $excludeIds 需要排除的项目ID
     * @return array 项目ID数组
     */
    public function findProjectIdsByWorkspaceId(int $workspaceId, array $excludeIds): array
    {
        $query = $this->projectModel::query()
            ->where('workspace_id', $workspaceId)
            ->whereNull('deleted_at');

        if (! empty($excludeIds)) {
            $query->whereNotIn('id', $excludeIds);
        }

        return $query->pluck('id')->toArray();
    }

    /**
     * 批量恢复工作区下的项目（带排除）.
     *
     * @param int $workspaceId 工作区ID
     * @param array $excludeIds 需要排除的项目ID数组
     * @param string $userId 操作用户ID
     * @return int 恢复的项目数量
     */
    public function restoreByWorkspaceId(int $workspaceId, array $excludeIds, string $userId): int
    {
        $query = $this->projectModel::withTrashed()
            ->where('workspace_id', $workspaceId)
            ->whereNotNull('deleted_at');

        if (! empty($excludeIds)) {
            $query->whereNotIn('id', $excludeIds);
        }

        return $query->update([
            'deleted_at' => null,
            'updated_uid' => $userId,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
    }

    /**
     * 模型转实体.
     */
    protected function modelToEntity(ProjectModel $model): ProjectEntity
    {
        return new ProjectEntity([
            'id' => $model->id ?? 0,
            'user_id' => $model->user_id ?? '',
            'user_organization_code' => $model->user_organization_code ?? '',
            'workspace_id' => $model->workspace_id ?? null,
            'project_name' => $model->project_name ?? '',
            'project_description' => $model->project_description ?? '',
            'work_dir' => $model->work_dir ?? '',
            'project_status' => $model->project_status ?? 1,
            'current_topic_id' => $model->current_topic_id ?? '',
            'current_topic_status' => $model->current_topic_status ?? '',
            'project_mode' => $model->project_mode ?? '',
            'is_hidden' => $model->is_hidden ?? false,
            'hidden_type' => $model->hidden_type ?? null,
            'created_uid' => $model->created_uid ?? '',
            'updated_uid' => $model->updated_uid ?? '',
            'created_at' => $model->created_at ? $model->created_at->format('Y-m-d H:i:s') : null,
            'updated_at' => $model->updated_at ? $model->updated_at->format('Y-m-d H:i:s') : null,
            'deleted_at' => $model->deleted_at ? $model->deleted_at->format('Y-m-d H:i:s') : null,
        ]);
    }

    /**
     * 数组结果转实体数组.
     */
    protected function toEntities(array $results): array
    {
        return array_map(function ($row) {
            return $this->toEntity($row);
        }, $results);
    }

    /**
     * 数组转实体.
     */
    protected function toEntity(array|object $data): ProjectEntity
    {
        $data = is_object($data) ? (array) $data : $data;

        return new ProjectEntity([
            'id' => $data['id'] ?? 0,
            'user_id' => $data['user_id'] ?? '',
            'user_organization_code' => $data['user_organization_code'] ?? '',
            'workspace_id' => $data['workspace_id'] ?? null,
            'project_name' => $data['project_name'] ?? '',
            'project_mode' => $data['project_mode'] ?? '',
            'project_status' => $data['project_status'] ?? 1,
            'work_dir' => $data['work_dir'] ?? '',
            'current_topic_id' => $data['current_topic_id'] ?? '',
            'current_topic_status' => $data['current_topic_status'] ?? '',
            'is_collaboration_enabled' => $data['is_collaboration_enabled'] ?? 1,
            'is_hidden' => $data['is_hidden'] ?? false,
            'hidden_type' => $data['hidden_type'] ?? null,
            'default_join_permission' => MemberRole::fromString(empty($data['default_join_permission']) ? MemberRole::VIEWER->value : $data['default_join_permission']),
            'created_uid' => $data['created_uid'] ?? '',
            'updated_uid' => $data['updated_uid'] ?? '',
            'created_at' => $data['created_at'] ?? null,
            'updated_at' => $data['updated_at'] ?? null,
            'deleted_at' => $data['deleted_at'] ?? null,
        ]);
    }

    /**
     * 实体转模型属性.
     */
    protected function entityToModelAttributes(ProjectEntity $entity): array
    {
        return [
            'user_id' => $entity->getUserId(),
            'user_organization_code' => $entity->getUserOrganizationCode(),
            'workspace_id' => $entity->getWorkspaceId(),
            'project_name' => $entity->getProjectName(),
            'project_mode' => $entity->getProjectMode(),
            'project_status' => $entity->getProjectStatus()->value,
            'work_dir' => $entity->getWorkDir(),
            'current_topic_id' => $entity->getCurrentTopicId(),
            'current_topic_status' => $entity->getCurrentTopicStatus(),
            'is_collaboration_enabled' => $entity->getIsCollaborationEnabled() ? 1 : 0,
            'source' => $entity->getSource(),
            'is_hidden' => $entity->isHidden() ? 1 : 0,
            'hidden_type' => $entity->getHiddenType(),
            'default_join_permission' => $entity->getDefaultJoinPermission()->value,
            'created_uid' => $entity->getCreatedUid(),
            'updated_uid' => $entity->getUpdatedUid(),
            'updated_at' => $entity->getUpdatedAt(),
        ];
    }

    /**
     * Model 转 Entity（简化版，仅用于验证父级）.
     *
     * 注意：此方法从 ProjectRestoreRepository 复制而来，
     * 保持原有逻辑不变，只返回必要的字段。
     */
    private function modelToEntityForRestore(ProjectModel $model): ProjectEntity
    {
        $entity = new ProjectEntity();
        $entity->setId($model->id);
        $entity->setWorkspaceId($model->workspace_id);
        $entity->setDeletedAt($model->deleted_at ? (string) $model->deleted_at : null);

        return $entity;
    }
}

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
use Hyperf\DbConnection\Db;
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
     * 统计工作区下的项目数量.
     */
    public function countByWorkspaceId(int $workspaceId): int
    {
        return $this->projectModel::query()
            ->where('workspace_id', $workspaceId)
            ->whereNull('deleted_at')
            ->count();
    }

    /**
     * 批量获取项目信息.
     */
    public function findByIds(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }

        $query = $this->projectModel::query()
            ->whereIn('id', $ids)
            ->whereNull('deleted_at')
            ->orderBy('updated_at', 'desc');

        $results = Db::select($query->toSql(), $query->getBindings());
        return $this->toEntities($results);
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
     * 模型转实体.
     */
    protected function modelToEntity(ProjectModel $model): ProjectEntity
    {
        return new ProjectEntity([
            'id' => $model->id ?? 0,
            'user_id' => $model->user_id ?? '',
            'user_organization_code' => $model->user_organization_code ?? '',
            'workspace_id' => $model->workspace_id ?? 0,
            'project_name' => $model->project_name ?? '',
            'project_description' => $model->project_description ?? '',
            'work_dir' => $model->work_dir ?? '',
            'project_status' => $model->project_status ?? 1,
            'current_topic_id' => $model->current_topic_id ?? '',
            'current_topic_status' => $model->current_topic_status ?? '',
            'project_mode' => $model->project_mode ?? '',
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
            'workspace_id' => $data['workspace_id'] ?? 0,
            'project_name' => $data['project_name'] ?? '',
            'project_mode' => $data['project_mode'] ?? '',
            'project_status' => $data['project_status'] ?? 1,
            'work_dir' => $data['work_dir'] ?? '',
            'current_topic_id' => $data['current_topic_id'] ?? '',
            'current_topic_status' => $data['current_topic_status'] ?? '',
            'is_collaboration_enabled' => $data['is_collaboration_enabled'] ?? 0,
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
            'default_join_permission' => $entity->getDefaultJoinPermission()->value,
            'created_uid' => $entity->getCreatedUid(),
            'updated_uid' => $entity->getUpdatedUid(),
            'updated_at' => $entity->getUpdatedAt(),
        ];
    }
}

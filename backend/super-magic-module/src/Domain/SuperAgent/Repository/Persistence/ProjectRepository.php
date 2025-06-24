<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\ProjectModel;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\TopicModel;
use Hyperf\DbConnection\Db;

/**
 * 项目仓储实现
 */
class ProjectRepository extends AbstractRepository implements ProjectRepositoryInterface
{
    public function __construct(
        public ProjectModel $projectModel
    ) {
    }

    /**
     * 根据ID查找项目
     */
    public function findById(int $id): ?ProjectEntity
    {
        $model = $this->projectModel::query()->find($id);
        if (!$model) {
            return null;
        }

        return $this->modelToEntity($model->toArray());
    }

    /**
     * 根据工作区ID和用户ID查找项目列表
     */
    public function findByWorkspaceIdAndUserId(int $workspaceId, string $userId): array
    {
        $query = $this->projectModel::query()
            ->where('workspace_id', $workspaceId)
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->orderBy('updated_at', 'desc');

        $results = Db::select($query->toSql(), $query->getBindings());
        return $this->toEntities($results);
    }

    /**
     * 根据用户ID获取项目列表（支持分页）
     */
    public function findByUserId(string $userId, ?Page $page = null): array
    {
        $baseQuery = $this->projectModel::query()
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->orderBy('updated_at', 'desc');

        if ($page) {
            // 手动处理分页
            $total = $baseQuery->count();
            $offset = ($page->getPage() - 1) * $page->getPageNum();
            $results = Db::select(
                $baseQuery->offset($offset)->limit($page->getPageNum())->toSql(),
                $baseQuery->getBindings()
            );
            return [
                'list' => $this->toEntities($results),
                'total' => $total
            ];
        }

        $results = Db::select($baseQuery->toSql(), $baseQuery->getBindings());
        return $this->toEntities($results);
    }

    /**
     * 根据用户ID获取最近使用的项目列表
     */
    public function findRecentProjectsByUserId(string $userId, int $limit = 10): array
    {
        $query = $this->projectModel::query()
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->orderBy('updated_at', 'desc')
            ->limit($limit);

        $results = Db::select($query->toSql(), $query->getBindings());
        return $this->toEntities($results);
    }

    /**
     * 根据用户ID和组织编码获取项目列表
     */
    public function findByUserIdAndOrganizationCode(string $userId, string $organizationCode, ?Page $page = null): array
    {
        $baseQuery = $this->projectModel::query()
            ->where('user_id', $userId)
            ->where('user_organization_code', $organizationCode)
            ->whereNull('deleted_at')
            ->orderBy('updated_at', 'desc');

        if ($page) {
            // 手动处理分页
            $total = $baseQuery->count();
            $offset = ($page->getPage() - 1) * $page->getPageNum();
            $results = Db::select(
                $baseQuery->offset($offset)->limit($page->getPageNum())->toSql(),
                $baseQuery->getBindings()
            );
            return [
                'list' => $this->toEntities($results),
                'total' => $total
            ];
        }

        $results = Db::select($baseQuery->toSql(), $baseQuery->getBindings());
        return $this->toEntities($results);
    }

    /**
     * 保存项目
     */
    public function save(ProjectEntity $project): ProjectEntity
    {
        $attributes = $this->entityToModelAttributes($project);

        if ($project->getId() > 0) {
            // 更新
            $model = $this->projectModel::query()->find($project->getId());
            if ($model) {
                $model->fill($attributes);
                $model->save();
                return $this->modelToEntity($model->toArray());
            }
        }

        // 创建
        $attributes['id'] = IdGenerator::getSnowId();
        $project->setId($attributes['id']);
        $model = $this->projectModel::query()->create($attributes);
        return $project;
    }

    /**
     * 删除项目（软删除）
     */
    public function delete(ProjectEntity $project): bool
    {
        $model = $this->projectModel::query()->find($project->getId());
        if (!$model) {
            return false;
        }

        return $model->delete();
    }

    /**
     * 根据项目名称和工作区ID查找项目
     */
    public function findByProjectNameAndWorkspaceId(string $projectName, int $workspaceId): ?ProjectEntity
    {
        $model = $this->projectModel::query()
            ->where('project_name', $projectName)
            ->where('workspace_id', $workspaceId)
            ->whereNull('deleted_at')
            ->first();

        if (!$model) {
            return null;
        }

        return $this->modelToEntity($model->toArray());
    }

    /**
     * 检查项目是否存在
     */
    public function exists(int $id): bool
    {
        return $this->projectModel::query()
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->exists();
    }

    /**
     * 统计用户的项目数量
     */
    public function countByUserId(string $userId): int
    {
        return $this->projectModel::query()
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->count();
    }

    /**
     * 统计工作区下的项目数量
     */
    public function countByWorkspaceId(int $workspaceId): int
    {
        return $this->projectModel::query()
            ->where('workspace_id', $workspaceId)
            ->whereNull('deleted_at')
            ->count();
    }

    /**
     * 批量获取项目信息
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
     * 模型转实体
     */
    protected function modelToEntity(array $data): ProjectEntity
    {
        return new ProjectEntity([
            'id' => $data['id'] ?? 0,
            'user_id' => $data['user_id'] ?? '',
            'user_organization_code' => $data['user_organization_code'] ?? '',
            'workspace_id' => $data['workspace_id'] ?? 0,
            'project_name' => $data['project_name'] ?? '',
            'work_dir' => $data['work_dir'] ?? '',
            'current_topic_id' => $data['current_topic_id'] ?? '',
            'current_topic_status' => $data['current_topic_status'] ?? '',
            'created_uid' => $data['created_uid'] ?? '',
            'updated_uid' => $data['updated_uid'] ?? '',
            'created_at' => $data['created_at'] ?? null,
            'updated_at' => $data['updated_at'] ?? null,
            'deleted_at' => $data['deleted_at'] ?? null,
        ]);
    }

    /**
     * 数组结果转实体数组
     */
    protected function toEntities(array $results): array
    {
        return array_map(function ($row) {
            return $this->toEntity($row);
        }, $results);
    }

    /**
     * 数组转实体
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
            'work_dir' => $data['work_dir'] ?? '',
            'current_topic_id' => $data['current_topic_id'] ?? '',
            'current_topic_status' => $data['current_topic_status'] ?? '',
            'created_uid' => $data['created_uid'] ?? '',
            'updated_uid' => $data['updated_uid'] ?? '',
            'created_at' => $data['created_at'] ?? null,
            'updated_at' => $data['updated_at'] ?? null,
            'deleted_at' => $data['deleted_at'] ?? null,
        ]);
    }

    /**
     * 实体转模型属性
     */
    protected function entityToModelAttributes(ProjectEntity $entity): array
    {
        return [
            'user_id' => $entity->getUserId(),
            'user_organization_code' => $entity->getUserOrganizationCode(),
            'workspace_id' => $entity->getWorkspaceId(),
            'project_name' => $entity->getProjectName(),
            'work_dir' => $entity->getWorkDir(),
            'current_topic_id' => $entity->getCurrentTopicId(),
            'current_topic_status' => $entity->getCurrentTopicStatus(),
            'created_uid' => $entity->getCreatedUid(),
            'updated_uid' => $entity->getUpdatedUid(),
        ];
    }
}
<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\RecycleBin\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use Dtyq\SuperMagic\Domain\RecycleBin\Entity\RecycleBinEntity;
use Dtyq\SuperMagic\Domain\RecycleBin\Enum\RecycleBinResourceType;
use Dtyq\SuperMagic\Domain\RecycleBin\Repository\Facade\RecycleBinRepositoryInterface;
use Dtyq\SuperMagic\Domain\RecycleBin\Repository\Model\RecycleBinModel;
use Hyperf\Database\Model\Builder;

/**
 * 回收站仓储.
 */
class RecycleBinRepository extends AbstractRepository implements RecycleBinRepositoryInterface
{
    public function __construct(protected RecycleBinModel $model)
    {
    }

    /**
     * 插入回收站记录.
     */
    public function insert(RecycleBinEntity $entity): RecycleBinEntity
    {
        $model = new $this->model();
        $model->fill($entity->toArray());
        $model->save();

        $entity->setId($model->id);
        return $entity;
    }

    /**
     * 根据ID查询.
     */
    public function findById(int $id): ?RecycleBinEntity
    {
        /** @var null|RecycleBinModel $model */
        $model = $this->model::query()->find($id);
        return $this->modelToEntity($model);
    }

    /**
     * 根据ID删除(物理删除).
     */
    public function deleteById(int $id): bool
    {
        return $this->model::query()->where('id', $id)->delete() > 0;
    }

    /**
     * 根据资源类型和ID查找回收站记录.
     */
    public function findByResource(
        RecycleBinResourceType $resourceType,
        int $resourceId
    ): ?RecycleBinEntity {
        $model = $this->model::query()
            ->where('resource_type', $resourceType->value)
            ->where('resource_id', $resourceId)
            ->first();

        return $this->modelToEntity($model);
    }

    /**
     * 查询某个父级下在回收站有记录的资源ID列表.
     * 用于恢复项目/工作区时排除用户曾删的子资源.
     *
     * @param int $parentId 父级资源ID
     * @param RecycleBinResourceType $resourceType 子资源类型
     * @return array 资源ID数组
     */
    public function findResourceIdsByParent(
        int $parentId,
        RecycleBinResourceType $resourceType
    ): array {
        return $this->model::query()
            ->where('parent_id', $parentId)
            ->where('resource_type', $resourceType->value)
            ->pluck('resource_id')
            ->toArray();
    }

    /**
     * 批量查询多个父级下在回收站有记录的资源ID列表.
     * 用于恢复工作区时排除用户曾删的话题（需要查询多个项目下的话题）.
     *
     * @param array $parentIds 父级资源ID数组
     * @param RecycleBinResourceType $resourceType 子资源类型
     * @return array 资源ID数组
     */
    public function findResourceIdsByParents(
        array $parentIds,
        RecycleBinResourceType $resourceType
    ): array {
        if (empty($parentIds)) {
            return [];
        }

        return $this->model::query()
            ->whereIn('parent_id', $parentIds)
            ->where('resource_type', $resourceType->value)
            ->pluck('resource_id')
            ->toArray();
    }

    /**
     * 获取回收站列表(分页).
     * 使用「当前用户可访问」条件：本人创建 或（文件类型且为项目成员）.
     */
    public function getRecycleBinList(
        string $userId,
        ?int $resourceType = null,
        ?string $keyword = null,
        string $order = 'desc',
        int $page = 1,
        int $pageSize = 20
    ): array {
        $table = $this->model->getTable();
        $query = $this->applyVisibleToUserScope($this->model::query(), $userId);

        // 资源类型筛选
        if ($resourceType !== null) {
            $query->where($table . '.resource_type', $resourceType);
        }

        // 关键词搜索(resource_name LIKE)
        if ($keyword !== null) {
            $query->where($table . '.resource_name', 'like', '%' . $keyword . '%');
        }

        // 排序
        $query->orderBy($table . '.deleted_at', $order);

        // 总数（按主表 id 计数，避免 JOIN 导致重复）
        $total = $query->count($table . '.id');

        // 分页（只选主表字段）
        $offset = ($page - 1) * $pageSize;
        $models = $query->offset($offset)->limit($pageSize)->select($table . '.*')->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = $this->modelToEntity($model);
        }

        return [
            'total' => $total,
            'list' => $entities,
        ];
    }

    /**
     * 批量查询当前用户可访问的回收站记录（带类型过滤）.
     * 与列表使用同一套可访问条件，供检查父级/恢复等使用.
     *
     * @param array $ids 回收站记录ID数组
     * @param int $resourceType 资源类型（RecycleBinResourceType->value）
     * @param string $userId 当前用户ID
     * @return RecycleBinEntity[] 回收站实体数组
     */
    public function findByIdsAndTypeVisibleToUser(array $ids, int $resourceType, string $userId): array
    {
        if (empty($ids)) {
            return [];
        }

        $table = $this->model->getTable();
        $models = $this->applyVisibleToUserScope($this->model::query(), $userId)
            ->whereIn($table . '.id', $ids)
            ->where($table . '.resource_type', $resourceType)
            ->select($table . '.*')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entity = $this->modelToEntity($model);
            if ($entity !== null) {
                $entities[] = $entity;
            }
        }

        return $entities;
    }

    /**
     * 批量查询回收站记录（不过滤类型）.
     *
     * @param array $ids 回收站记录ID数组
     * @param string $userId 用户ID（权限校验）
     * @return RecycleBinEntity[] 回收站实体数组
     */
    public function findByIds(array $ids, string $userId): array
    {
        if (empty($ids)) {
            return [];
        }

        $table = $this->model->getTable();
        $models = $this->applyVisibleToUserScope($this->model::query(), $userId)
            ->whereIn($table . '.id', $ids)
            ->select($table . '.*')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entity = $this->modelToEntity($model);
            if ($entity !== null) {
                $entities[] = $entity;
            }
        }

        return $entities;
    }

    /**
     * 批量删除回收站记录（物理删除）.
     *
     * @param array $ids 回收站记录ID数组
     * @return int 删除的记录数
     */
    public function deleteByIds(array $ids): int
    {
        if (empty($ids)) {
            return 0;
        }

        return $this->model::query()
            ->whereIn('id', $ids)
            ->delete();
    }

    /**
     * 根据资源ID批量查询回收站记录（用于恢复）.
     * 每个资源在回收站中只有一条记录（恢复时会物理删除回收站记录）.
     *
     * @param array $resourceIds 资源ID数组
     * @param RecycleBinResourceType $resourceType 资源类型
     * @param string $userId 用户ID（权限校验）
     * @return RecycleBinEntity[] 回收站实体数组
     */
    public function findLatestByResourceIds(array $resourceIds, RecycleBinResourceType $resourceType, string $userId): array
    {
        if (empty($resourceIds)) {
            return [];
        }

        $table = $this->model->getTable();
        // 直接查询：每个资源在回收站中只有一条记录
        $models = $this->applyVisibleToUserScope($this->model::query(), $userId)
            ->whereIn($table . '.resource_id', $resourceIds)
            ->where($table . '.resource_type', $resourceType->value)
            ->select($table . '.*')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entity = $this->modelToEntity($model);
            if ($entity !== null) {
                $entities[] = $entity;
            }
        }

        return $entities;
    }

    /**
     * 查找过期的回收站记录ID（系统定时任务使用）.
     * 不校验用户权限，因为是系统全局清理.
     *
     * @param int $limit 限制返回数量，避免一次处理过多（默认 1000）
     * @return string[] 过期的回收站记录ID数组（字符串类型，避免大整数精度问题）
     */
    public function findExpiredRecordIds(int $limit = 1000): array
    {
        return $this->model::query()
            ->whereRaw('DATE_ADD(deleted_at, INTERVAL retain_days DAY) < NOW()')
            ->orderBy('deleted_at', 'asc')
            ->limit($limit)
            ->pluck('id')
            ->map(fn ($id) => (string) $id)
            ->toArray();
    }

    /**
     * 按 ID 批量查询回收站记录（不校验用户权限）.
     * 仅用于系统行为（如定时任务清理过期记录），不可用于用户请求.
     *
     * @param array $ids 回收站记录ID数组
     * @return RecycleBinEntity[] 回收站实体数组
     */
    public function findByIdsWithoutPermission(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }

        $models = $this->model::query()
            ->whereIn('id', $ids)
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entity = $this->modelToEntity($model);
            if ($entity !== null) {
                $entities[] = $entity;
            }
        }

        return $entities;
    }

    /**
     * 应用「当前用户可访问」条件：本人创建 或（文件类型且为项目成员）.
     * 与列表、检查父级等共用，仅文件类型走项目成员，避免话题被协作者看到.
     */
    protected function applyVisibleToUserScope(Builder $query, string $userId): Builder
    {
        $table = $this->model->getTable();
        $query->leftJoin('magic_super_agent_project_members as pm', function ($join) use ($table, $userId): void {
            $join->on($table . '.parent_id', '=', 'pm.project_id')
                ->where('pm.target_type', '=', 'User')
                ->where('pm.target_id', '=', $userId)
                ->whereNull('pm.deleted_at');
        });
        $query->where(function ($q) use ($table, $userId): void {
            $q->where($table . '.owner_id', $userId)
                ->orWhere(function ($q2) use ($table): void {
                    $q2->where($table . '.resource_type', RecycleBinResourceType::File->value)
                        ->whereNotNull('pm.id');
                });
        });
        return $query;
    }

    /**
     * Model 转 Entity.
     */
    protected function modelToEntity(?RecycleBinModel $model): ?RecycleBinEntity
    {
        if (! $model) {
            return null;
        }

        $entity = new RecycleBinEntity();
        $entity->setId($model->id)
            ->setResourceType(RecycleBinResourceType::fromValue($model->resource_type))
            ->setResourceId($model->resource_id)
            ->setResourceName($model->resource_name)
            ->setOwnerId((string) $model->owner_id)
            ->setDeletedBy((string) $model->deleted_by)
            ->setDeletedAt($model->deleted_at?->format('Y-m-d H:i:s') ?? '')
            ->setRetainDays($model->retain_days)
            ->setParentId($model->parent_id)
            ->setExtraData($model->extra_data)
            ->setCreatedAt($model->created_at?->format('Y-m-d H:i:s'))
            ->setUpdatedAt($model->updated_at?->format('Y-m-d H:i:s'));

        return $entity;
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Common\RecycleBin\Repository\Persistence;

use App\Domain\SuperMagic\Common\RecycleBin\Entity\RecycleBinEntity;
use App\Domain\SuperMagic\Common\RecycleBin\Entity\RecycleBinFileQuery;
use App\Domain\SuperMagic\Common\RecycleBin\Enum\RecycleBinResourceType;
use App\Domain\SuperMagic\Common\RecycleBin\Repository\Facade\RecycleBinRepositoryInterface;
use App\Domain\SuperMagic\Common\RecycleBin\Repository\Model\RecycleBinModel;
use App\Domain\SuperMagic\File\Repository\Model\TaskFileModel;
use App\Infrastructure\Core\AbstractRepository;
use Hyperf\Database\Model\Builder;
use Hyperf\Database\Query\Builder as QueryBuilder;

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
            ->whereNull('removed_at')
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
        int $pageSize = 20,
        ?RecycleBinFileQuery $fileQuery = null
    ): array {
        if ($fileQuery !== null) {
            return $this->getProjectFileList($userId, $fileQuery, $pageSize);
        }
        $table = $this->model->getTable();
        $ownerQuery = $this->buildOwnerVisibleQuery($userId, $resourceType, $keyword);
        $total = (clone $ownerQuery)->count($table . '.id');
        $includeCollaborativeFiles = $resourceType === null
            || $resourceType === RecycleBinResourceType::File->value;

        $collaborativeQuery = null;
        if ($includeCollaborativeFiles) {
            $collaborativeQuery = $this->buildCollaborativeFileQuery($userId, $keyword);
            $total += (clone $collaborativeQuery)->count('rb.id');
        }

        $offset = ($page - 1) * $pageSize;
        if ($collaborativeQuery === null) {
            $rows = $ownerQuery
                ->orderBy($table . '.deleted_at', $order)
                ->offset($offset)
                ->limit($pageSize)
                ->select($table . '.*')
                ->get();
        } else {
            $visibleQuery = (clone $ownerQuery)
                ->select($table . '.*')
                ->unionAll(
                    (clone $collaborativeQuery)
                        ->select('rb.*')
                );

            $rows = $this->model::query()
                ->toBase()
                ->fromSub($visibleQuery, 'visible')
                ->select('visible.*')
                ->orderBy('visible.deleted_at', $order)
                ->offset($offset)
                ->limit($pageSize)
                ->get();
        }

        $models = $this->model::query()->hydrate(
            $rows->map(static fn ($row) => (array) $row)->all()
        );

        $entities = [];
        foreach ($models as $model) {
            if (! $model instanceof RecycleBinModel) {
                continue;
            }
            $entities[] = $this->modelToEntity($model);
        }

        return [
            'total' => $total,
            'list' => $entities,
        ];
    }

    /**
     * 获取当前用户各资源类型的回收站数量.
     *
     * 类型数量固定且不同类型可见性不同，因此按类型拆分 COUNT，避免单条 SQL 中 OR + JOIN 影响索引命中。
     *
     * @return array<int, int>
     */
    public function getCountsByTypeVisibleToUser(string $userId, ?string $keyword = null, ?int $projectId = null): array
    {
        if ($projectId !== null) {
            return [RecycleBinResourceType::File->value => $this->buildOwnerVisibleQuery($userId, RecycleBinResourceType::File->value, null, $projectId)->count()
                + $this->buildCollaborativeFileQuery($userId, null, $projectId)->count(),
            ];
        }
        $counts = [];

        foreach (RecycleBinResourceType::cases() as $type) {
            if ($type === RecycleBinResourceType::File) {
                $counts[$type->value] = $this->countOwnerVisibleByType($type, $userId, $keyword)
                    + $this->countCollaborativeFilesExcludingOwner($userId, $keyword);
                continue;
            }

            $counts[$type->value] = $this->countOwnerVisibleByType($type, $userId, $keyword);
        }

        return $counts;
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
            ->whereNull($table . '.removed_at')
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
            ->whereNull($table . '.removed_at')
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

    public function markRemovedByIds(array $ids, string $removedBy): int
    {
        if (empty($ids)) {
            return 0;
        }

        $now = date('Y-m-d H:i:s');
        return $this->model::query()
            ->whereIn('id', $ids)
            ->whereNull('removed_at')
            ->update([
                'removed_at' => $now,
                'removed_by' => $removedBy,
                'updated_at' => $now,
            ]);
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
            ->whereNull($table . '.removed_at')
            ->select($table . '.*')
            ->orderBy($table . '.deleted_at', 'desc')
            ->orderBy($table . '.id', 'desc')
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
            ->whereNull('removed_at')
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

    public function findFilePurgeCandidates(int $limit = 1000): array
    {
        $models = $this->model::query()
            ->where('resource_type', RecycleBinResourceType::File->value)
            ->whereNotNull('removed_at')
            ->whereNull('purged_at')
            ->whereRaw('removed_at <= DATE_SUB(NOW(), INTERVAL 60 DAY)')
            ->orderBy('removed_at', 'asc')
            ->limit($limit)
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

    public function markPurged(int $id): bool
    {
        $now = date('Y-m-d H:i:s');
        return $this->model::query()
            ->where('id', $id)
            ->whereNull('purged_at')
            ->update([
                'purged_at' => $now,
                'updated_at' => $now,
            ]) > 0;
    }

    /**
     * 应用「当前用户可访问」条件：本人创建 或（文件类型且为项目成员）.
     * 与列表、检查父级等共用，仅文件类型走项目成员，避免话题被协作者看到.
     */
    protected function applyVisibleToUserScope(Builder $query, string $userId): Builder
    {
        $table = $this->model->getTable();
        $this->applyUserVisibleFileScope($query, $table);
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
            ->setRemovedAt($model->removed_at?->format('Y-m-d H:i:s'))
            ->setRemovedBy($model->removed_by)
            ->setPurgedAt($model->purged_at?->format('Y-m-d H:i:s'))
            ->setParentId($model->parent_id)
            ->setExtraData($model->extra_data)
            ->setCreatedAt($model->created_at?->format('Y-m-d H:i:s'))
            ->setUpdatedAt($model->updated_at?->format('Y-m-d H:i:s'));

        return $entity;
    }

    private function buildOwnerVisibleQuery(string $userId, ?int $resourceType, ?string $keyword, ?int $projectId = null): QueryBuilder
    {
        $table = $this->model->getTable();
        $query = $this->model::query()
            ->toBase()
            ->whereNull($table . '.removed_at')
            ->where($table . '.owner_id', $userId);

        if ($resourceType !== null) {
            $query->where($table . '.resource_type', $resourceType);
        }
        if ($projectId !== null) {
            $query->where($table . '.parent_id', $projectId);
        }

        $this->applyKeywordFilter($query, $table . '.resource_name', $keyword);

        $this->applyUserVisibleFileScope($query, $table);

        return $query;
    }

    private function buildCollaborativeFileQuery(string $userId, ?string $keyword, ?int $projectId = null): QueryBuilder
    {
        $table = $this->model->getTable();
        $query = $this->model::query()
            ->toBase()
            ->from($table . ' as rb')
            ->join('magic_super_agent_project_members as pm', function ($join) use ($userId): void {
                $join->on('rb.parent_id', '=', 'pm.project_id')
                    ->where('pm.target_type', '=', 'User')
                    ->where('pm.target_id', '=', $userId)
                    ->whereNull('pm.deleted_at');
            })
            ->where('rb.resource_type', RecycleBinResourceType::File->value)
            ->whereNull('rb.removed_at')
            ->where('rb.owner_id', '<>', $userId);

        if ($projectId !== null) {
            $query->where('rb.parent_id', $projectId);
        }
        $this->applyKeywordFilter($query, 'rb.resource_name', $keyword);

        $this->applyUserVisibleFileScope($query, 'rb');

        return $query;
    }

    private function countOwnerVisibleByType(RecycleBinResourceType $type, string $userId, ?string $keyword): int
    {
        $query = $this->model::query()
            ->where('resource_type', $type->value)
            ->whereNull('removed_at')
            ->where('owner_id', $userId);

        $this->applyKeywordFilter($query, 'resource_name', $keyword);

        $this->applyUserVisibleFileScope($query, $this->model->getTable());

        return (int) $query->count('id');
    }

    private function countCollaborativeFilesExcludingOwner(string $userId, ?string $keyword): int
    {
        $table = $this->model->getTable();
        $query = $this->model::query()
            ->from($table . ' as rb')
            ->join('magic_super_agent_project_members as pm', function ($join) use ($userId): void {
                $join->on('rb.parent_id', '=', 'pm.project_id')
                    ->where('pm.target_type', '=', 'User')
                    ->where('pm.target_id', '=', $userId)
                    ->whereNull('pm.deleted_at');
            })
            ->where('rb.resource_type', RecycleBinResourceType::File->value)
            ->whereNull('rb.removed_at')
            ->where('rb.owner_id', '<>', $userId);

        $this->applyKeywordFilter($query, 'rb.resource_name', $keyword);

        $this->applyUserVisibleFileScope($query, 'rb');

        return (int) $query->count('rb.id');
    }

    /**
     * 列表、数量和用户按 ID 操作共用文件范围；系统到期清理不调用此条件。
     * 例：topic 日志不显示也不计数，普通项目 report.log 仍可恢复。
     */
    private function applyUserVisibleFileScope(Builder|QueryBuilder $query, string $prefix): void
    {
        $fileModel = new TaskFileModel();
        // 回收站文件已软删除，必须保留其元数据参与分类；父目录是否存在另由恢复流程处理。
        $files = TaskFileModel::query()->withTrashed()->visibleProjectFiles()
            ->selectRaw('1')
            ->whereColumn($fileModel->qualifyColumn('file_id'), $prefix . '.resource_id')
            ->whereColumn($fileModel->qualifyColumn('project_id'), $prefix . '.parent_id')
            ->toBase();

        $baseQuery = $query instanceof Builder ? $query->getQuery() : $query;
        $baseQuery->where(static function (QueryBuilder $visible) use ($prefix, $files): void {
            $visible->where($prefix . '.resource_type', '<>', RecycleBinResourceType::File->value)
                ->addWhereExistsQuery($files, 'or');
        });
    }

    private function applyKeywordFilter(Builder|QueryBuilder $query, string $column, ?string $keyword): void
    {
        if ($keyword === null || $keyword === '') {
            return;
        }

        $query->where($column, 'like', '%' . $keyword . '%');
    }

    /**
     * 项目列表和有限搜索共用游标；原位置分类只在前端完整取得有限结果后进行。
     * 每次仍检查两路可见性，游标不授予权限；每路最多取一页再合并，避免深 offset。
     */
    private function getProjectFileList(string $userId, RecycleBinFileQuery $fileQuery, int $pageSize): array
    {
        $table = $this->model->getTable();
        $cursor = $fileQuery->readCursor($userId);
        $snapshotTime = $cursor['snapshot_time'] ?? date('Y-m-d H:i:s');
        $owner = $this->buildOwnerVisibleQuery($userId, RecycleBinResourceType::File->value, $fileQuery->keyword, $fileQuery->projectId);
        $collaborative = $this->buildCollaborativeFileQuery($userId, $fileQuery->keyword, $fileQuery->projectId);
        foreach ([$table => $owner, 'rb' => $collaborative] as $prefix => $query) {
            $query->where($prefix . '.deleted_at', '<=', $snapshotTime);
            if ($fileQuery->deletedFrom !== null) {
                $query->where($prefix . '.deleted_at', '>=', $fileQuery->deletedFrom)
                    ->where($prefix . '.deleted_at', '<', $fileQuery->deletedTo);
            }
        }

        // 只在首批固定已有记录的 ID 上界。后续新增记录即使时间相同也不混入本次查询。
        $snapshotId = $cursor['snapshot_id'] ?? max(
            (int) (clone $owner)->max($table . '.id'),
            (int) (clone $collaborative)->max('rb.id')
        );

        $total = null;
        if ($fileQuery->includeTotal) {
            $total = (clone $owner)->where($table . '.id', '<=', $snapshotId)->count()
                + (clone $collaborative)->where('rb.id', '<=', $snapshotId)->count();
        }
        foreach ([$table => $owner, 'rb' => $collaborative] as $prefix => $query) {
            $query->where($prefix . '.id', '<=', $snapshotId);
            if ($cursor !== null) {
                $query->where(static function (QueryBuilder $query) use ($prefix, $cursor): void {
                    $query->where($prefix . '.deleted_at', '<', $cursor['deleted_at'])
                        ->orWhere(static function (QueryBuilder $query) use ($prefix, $cursor): void {
                            $query->where($prefix . '.deleted_at', $cursor['deleted_at'])
                                ->where($prefix . '.id', '<', $cursor['id']);
                        });
                });
            }
            $query->select($prefix . '.*')
                ->orderByDesc($prefix . '.deleted_at')
                ->orderByDesc($prefix . '.id')
                ->limit($pageSize + 1);
        }
        $rows = $this->model::query()->toBase()->fromSub($owner->unionAll($collaborative), 'visible')
            ->orderByDesc('visible.deleted_at')->orderByDesc('visible.id')->limit($pageSize + 1)->get();
        $hasMore = $rows->count() > $pageSize;
        $models = $this->model::query()->hydrate($rows->take($pageSize)->map(static fn ($row) => (array) $row)->all());
        $entities = [];
        /** @var null|RecycleBinModel $model */
        foreach ($models as $model) {
            $entities[] = $this->modelToEntity($model);
        }
        $result = [
            'list' => $entities,
            'has_more' => $hasMore,
            'next_cursor' => $hasMore ? $fileQuery->nextCursor($userId, $entities[count($entities) - 1], $snapshotId, $snapshotTime) : null,
            'search_limits' => [
                'max_hours' => RecycleBinFileQuery::MAX_SEARCH_HOURS,
                'max_results' => RecycleBinFileQuery::MAX_SEARCH_RESULTS,
            ],
        ];
        if ($total !== null) {
            $result['total'] = $total;
        }
        return $result;
    }
}

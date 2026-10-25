<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Repository\Persistence;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Common\Entity\ValueObject\StorageType;
use App\Domain\SuperMagic\File\Contract\FileTreeChangePublisherInterface;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\File\Repository\Model\TaskFileModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Context\ApplicationContext;
use Hyperf\DbConnection\Db;
use RuntimeException;
use Throwable;

class TaskFileRepository implements TaskFileRepositoryInterface
{
    private const FILE_TREE_CHANGES_TABLE = 'magic_super_agent_task_file_tree_changes';

    private const FILE_TREE_HEADS_TABLE = 'magic_fs_file_tree_heads';

    private const MAX_FILE_TREE_DEPTH = 256;

    /**
     * 变更推送端口，惰性解析一次。
     *
     * 不走构造器注入是有意的：Hyperf 的 DefinitionSource::getParametersDefinition()
     * 会跳过所有带默认值的可选参数，所以「?Port $port = null」这种写法看起来能被注入、
     * 实际永远是 null，推送会静默失效。而且本仓库也会被直接 new（测试、历史调用方）。
     * 这里显式向容器要，容器里没有实现时（单测）安静降级成不推送。
     */
    private ?FileTreeChangePublisherInterface $changePublisher = null;

    private bool $changePublisherResolved = false;

    public function __construct(protected TaskFileModel $model)
    {
    }

    public function getById(int $id): ?TaskFileEntity
    {
        $model = $this->model::query()->where('file_id', $id)->first();
        if (! $model) {
            return null;
        }
        return new TaskFileEntity($model->toArray());
    }

    public function getFileTreeFileById(int $id): ?TaskFileEntity
    {
        $file = $this->getById($id);
        if ($file === null) {
            return $file;
        }

        // parent_id is the authoritative tree edge.  Descendant rows retain
        // their historical project/space columns when a directory crosses a
        // project boundary, so deciding whether to overlay context from those
        // columns would make the result depend on stale denormalized data.
        try {
            $rootFileId = $this->resolveRootIdFromParentChain($file);
        } catch (RuntimeException $exception) {
            // Non-MagicFS task attachments may not have a valid file-tree
            // parent chain. Preserve the legacy lookup result for those rows;
            // a caller that requires MagicFS access will reject its space type.
            if (! $this->shouldJournalFileTree($file)) {
                return $file;
            }
            throw $exception;
        }

        $root = $rootFileId === $file->getFileId()
            ? $file
            : $this->getById($rootFileId);
        if ($root === null || ! $this->shouldJournalFileTree($root)) {
            return $file;
        }
        if ($rootFileId === $file->getFileId()) {
            return $file;
        }

        // The row's own metadata remains untouched in storage.  Only the
        // effective tree context used by MagicFS authorization and creation is
        // inherited from the root reached through parent_id.
        $file->setProjectId($root->getProjectId());
        $file->setUserId($root->getUserId());
        $file->setOrganizationCode($root->getOrganizationCode());
        $file->setSpaceType($root->getSpaceType());
        $file->setTopicId($root->getTopicId());

        return $file;
    }

    public function getDirectoryByIdAndProject(int $parentId, int $projectId): ?TaskFileEntity
    {
        $model = $this->model::query()
            ->where('file_id', $parentId)
            ->where('project_id', $projectId)
            ->where('is_directory', true)
            ->first();
        if (! $model) {
            return null;
        }

        return new TaskFileEntity($model->toArray());
    }

    public function getByIdWithTrash(int $id): ?TaskFileEntity
    {
        /* @phpstan-ignore-next-line - TaskFileModel uses SoftDeletes trait which provides withTrashed() */
        $model = $this->model::withTrashed()->where('file_id', $id)->first();
        if (! $model) {
            return null;
        }
        return new TaskFileEntity($model->toArray());
    }

    public function getByIdsWithTrash(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }

        $result = [];
        $chunks = array_chunk(array_values(array_unique($ids)), 500);

        foreach ($chunks as $chunk) {
            /* @phpstan-ignore-next-line - TaskFileModel uses SoftDeletes trait which provides withTrashed() */
            $models = $this->model::withTrashed()->whereIn('file_id', $chunk)->get();

            foreach ($models as $model) {
                $entity = new TaskFileEntity($model->toArray());
                $result[$entity->getFileId()] = $entity;
            }
        }

        return $result;
    }

    public function getFilesByIds(array $fileIds, int $projectId = 0, ?string $spaceType = null): array
    {
        // 如果 ID 列表为空，直接返回空数组
        if (empty($fileIds)) {
            return [];
        }

        // 分批查询，每批 500 个 ID（与项目其他地方保持一致）
        $chunks = array_chunk($fileIds, 500);
        $list = [];

        foreach ($chunks as $chunk) {
            $query = $this->model::query()->whereIn('file_id', $chunk);

            if ($projectId > 0) {
                $query->where('project_id', $projectId);
            }

            if ($spaceType !== null) {
                $query->where('space_type', $spaceType);
            }

            // 取原始行、跳过 Eloquent 模型水合：5000 行实测模型实例化要 137ms CPU，裸取数只要 18ms
            // （见 debug/bench_magicfs_db_fetch.php）。
            //
            // 行形状一律用 (array) 归一后再按列名读：框架默认是 PDO::FETCH_OBJ，而项目里的
            // App\Listener\FetchModeListener 会把每个 statement 改成 PDO::FETCH_ASSOC，
            // 两种都要能读——之前在这里踩过"把数组当对象读"的线上报错。
            //
            // 查询条件仍由 Eloquent builder 组装，toBase() 会带上软删除等全局作用域，
            // 走上层连接的 select() 因此查询事件（SQL 审计日志）也照常触发。
            $scoped = $query->toBase();

            foreach ($this->model->getConnection()->select($scoped->toSql(), $scoped->getBindings()) as $row) {
                $list[] = TaskFileEntity::fromRow((array) $row);
            }
        }

        return $list;
    }

    public function getFilesByIdsWithTrash(array $fileIds, int $projectId = 0, ?string $spaceType = null): array
    {
        if (empty($fileIds)) {
            return [];
        }

        $chunks = array_chunk(array_values(array_unique($fileIds)), 500);
        $list = [];

        foreach ($chunks as $chunk) {
            /* @phpstan-ignore-next-line - TaskFileModel uses SoftDeletes trait which provides withTrashed() */
            $query = $this->model::withTrashed()->whereIn('file_id', $chunk);

            if ($projectId > 0) {
                $query->where('project_id', $projectId);
            }

            if ($spaceType !== null) {
                $query->where('space_type', $spaceType);
            }

            foreach ($query->get() as $model) {
                $list[] = new TaskFileEntity($model->toArray());
            }
        }

        return $list;
    }

    /**
     * @return TaskFileEntity[]
     */
    public function getTaskFilesByIds(array $ids, int $projectId = 0): array
    {
        if (empty($ids)) {
            return [];
        }

        // 分批查询，每批 500 个 ID（与项目其他地方保持一致）
        $chunks = array_chunk($ids, 500);
        $entities = [];

        foreach ($chunks as $chunk) {
            $query = $this->model::query()->whereIn('file_id', $chunk);
            if ($projectId > 0) {
                $query = $query->where('project_id', $projectId);
            }
            $models = $query->get();

            foreach ($models as $model) {
                $entities[] = new TaskFileEntity($model->toArray());
            }
        }

        return $entities;
    }

    /**
     * 根据fileKey获取文件.
     *
     * @param string $fileKey 文件键
     * @param null|int $topicId 话题ID，默认为0
     * @param bool $withTrash 是否包含已删除的文件，默认为false
     */
    public function getByFileKey(string $fileKey, ?int $topicId = 0, bool $withTrash = false): ?TaskFileEntity
    {
        // 根据withTrash参数决定查询范围
        if ($withTrash) {
            $query = $this->model::withTrashed();
        } else {
            $query = $this->model::query();
        }

        $query = $query->where('file_key', $fileKey);

        if ($topicId) {
            $query = $query->where('topic_id', $topicId);
        }

        $model = $query->first();

        if (! $model) {
            return null;
        }
        return new TaskFileEntity($model->toArray());
    }

    public function getCopiesBySourceFileId(int $sourceFileId): array
    {
        if ($sourceFileId <= 0) {
            return [];
        }

        return $this->model::query()
            ->where('source_file_id', $sourceFileId)
            ->whereNull('deleted_at')
            ->orderBy('file_id')
            ->get()
            ->map(static fn ($model): TaskFileEntity => new TaskFileEntity($model->toArray()))
            ->all();
    }

    /**
     * 根据fileKey数组批量获取文件.
     */
    public function getByFileKeys(array $fileKeys): array
    {
        if (empty($fileKeys)) {
            return [];
        }

        $models = $this->model::query()
            ->whereIn('file_key', $fileKeys)
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entity = new TaskFileEntity($model->toArray());
            $entities[$entity->getFileKey()] = $entity;
        }

        return $entities;
    }

    /**
     * 根据项目ID和fileKey获取文件.
     */
    public function getByProjectIdAndFileKey(int $projectId, string $fileKey, bool $withTrash = false): ?TaskFileEntity
    {
        $query = $withTrash ? $this->model::withTrashed() : $this->model::query();
        $model = $query
            ->where('project_id', $projectId)
            ->where('file_key', $fileKey)
            ->first();

        if (! $model) {
            return null;
        }
        return new TaskFileEntity($model->toArray());
    }

    public function getByProjectIdAndFileName(int $projectId, string $fileName): ?TaskFileEntity
    {
        $model = $this->model::query()
            ->where('project_id', $projectId)
            ->where('file_name', $fileName)
            ->where('is_directory', 0)
            ->orderByDesc('file_id')
            ->first();

        if (! $model) {
            return null;
        }

        return new TaskFileEntity($model->toArray());
    }

    public function getByProjectParentAndName(int $projectId, ?int $parentId, string $fileName, bool $withTrash = false): ?TaskFileEntity
    {
        // 根据withTrash参数决定查询范围
        if ($withTrash) {
            $query = $this->model::withTrashed();
        } else {
            $query = $this->model::query();
        }
        $query = $query->where('project_id', $projectId)->where('file_name', $fileName);

        if ($parentId === null) {
            $query->whereNull('parent_id');
        } else {
            $query->where('parent_id', $parentId);
        }

        $model = $query->first();
        if (! $model) {
            return null;
        }

        return new TaskFileEntity($model->toArray());
    }

    public function getBySpaceParentAndName(
        string $spaceType,
        int $projectId,
        ?int $parentId,
        string $fileName,
        string $userId,
        string $organizationCode,
        bool $withTrash = false,
        ?int $topicId = null
    ): ?TaskFileEntity {
        $query = $withTrash ? $this->model::withTrashed() : $this->model::query();
        $query->where('space_type', $spaceType)
            ->where('parent_id', $parentId)
            ->where('file_name', $fileName);

        // A project file tree is shared by all project members, so user_id
        // must never participate in its identity. Topic rows are similarly
        // shared within (project, topic); organization_code is retained as a
        // tenant boundary because topic roots are organization-scoped. User
        // user file tree is the only tree owned by one user.
        if ($spaceType === FileSpaceType::USER->value) {
            $query->where('project_id', 0)
                ->where('user_id', $userId)
                ->where('organization_code', $organizationCode)
                ->where('topic_id', 0);
        } elseif ($spaceType === FileSpaceType::TOPIC->value) {
            $query->where('project_id', $projectId)
                ->where('topic_id', $topicId ?? 0)
                ->where('organization_code', $organizationCode);
        } else {
            $query->where('project_id', $projectId)
                ->where('topic_id', 0);
        }
        $model = $query->first();
        return $model ? new TaskFileEntity($model->toArray()) : null;
    }

    public function getFileTreeChildByParentAndName(
        int $parentId,
        string $fileName,
        bool $withTrash = false,
        ?TaskFileEntity $parentContext = null
    ): ?TaskFileEntity {
        $query = $withTrash ? $this->model::withTrashed() : $this->model::query();
        $model = $query
            ->where('parent_id', $parentId)
            ->where('file_name', $fileName)
            ->orderBy('file_id')
            ->first();

        if ($model === null) {
            return null;
        }

        $entity = new TaskFileEntity($model->toArray());
        if ($entity->getDeletedAt() === null) {
            if ($parentContext !== null) {
                $entity->setProjectId($parentContext->getProjectId());
                $entity->setUserId($parentContext->getUserId());
                $entity->setOrganizationCode($parentContext->getOrganizationCode());
                $entity->setSpaceType($parentContext->getSpaceType());
                $entity->setTopicId($parentContext->getTopicId());
                return $entity;
            }
            return $this->getFileTreeFileById($entity->getFileId()) ?? $entity;
        }

        return $entity;
    }

    public function getUserFileTreeChildByParentAndName(
        int $parentId,
        string $fileName,
        string $userId,
        string $organizationCode,
        bool $withTrash = false
    ): ?TaskFileEntity {
        $query = $withTrash ? $this->model::withTrashed() : $this->model::query();
        $model = $query
            ->where('user_id', $userId)
            ->where('organization_code', $organizationCode)
            ->where('space_type', FileSpaceType::USER->value)
            ->where('parent_id', $parentId)
            ->where('file_name', $fileName)
            ->orderBy('file_id')
            ->first();

        return $model ? new TaskFileEntity($model->toArray()) : null;
    }

    /**
     * 根据项目、父目录和文件名批量查询直接子节点。
     *
     * @param string[] $fileNames
     * @return array<string, TaskFileEntity> 以文件名为键的文件实体
     */
    public function getByProjectParentAndNames(int $projectId, int $parentId, array $fileNames): array
    {
        $fileNames = array_values(array_unique(array_filter(
            $fileNames,
            static fn (string $fileName): bool => $fileName !== ''
        )));
        if ($fileNames === []) {
            return [];
        }

        $models = $this->model::query()
            ->where('project_id', $projectId)
            ->where('parent_id', $parentId)
            ->whereIn('file_name', $fileNames)
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entity = new TaskFileEntity($model->toArray());
            $entities[$entity->getFileName()] = $entity;
        }

        return $entities;
    }

    /**
     * Get files by project ID and file keys.
     *
     * @param int $projectId Project ID
     * @param array $fileKeys File keys
     * @return TaskFileEntity[] File entities indexed by file_key
     */
    public function getByProjectIdAndFileKeys(int $projectId, array $fileKeys): array
    {
        if (empty($fileKeys)) {
            return [];
        }

        $models = $this->model::query()
            ->where('project_id', $projectId)
            ->whereIn('file_key', $fileKeys)
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entity = new TaskFileEntity($model->toArray());
            $entities[$entity->getFileKey()] = $entity;
        }

        return $entities;
    }

    /**
     * 根据话题ID获取文件列表.
     *
     * @param int $topicId 话题ID
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @param array $fileType 文件类型过滤
     * @param string $storageType 存储类型
     * @return array{list: TaskFileEntity[], total: int} 文件列表和总数
     */
    public function getByTopicId(int $topicId, int $page, int $pageSize = 200, array $fileType = [], string $storageType = 'workspace'): array
    {
        $offset = ($page - 1) * $pageSize;

        // 构建查询
        $query = $this->model::query()->where('topic_id', $topicId);

        // 如果指定了文件类型数组且不为空，添加文件类型过滤条件
        if (! empty($fileType)) {
            $query->whereIn('file_type', $fileType);
        }

        // 如果指定了存储类型，添加存储类型过滤条件
        if (! empty($storageType)) {
            $query->where('storage_type', $storageType);
        }

        // 过滤已经被删除的， deleted_at 不为空
        $query->whereNull('deleted_at');

        // 先获取总数
        $total = $query->count();

        // 获取分页数据，使用Eloquent的get()方法让$casts生效，按层级和排序字段排序
        $models = $query->skip($offset)
            ->take($pageSize)
            ->orderBy('parent_id', 'ASC')  // 按父目录分组
            ->orderBy('sort', 'ASC')       // 按排序值排序
            ->orderBy('file_id', 'ASC')    // 排序值相同时按ID排序
            ->get();

        $list = [];
        foreach ($models as $model) {
            $list[] = new TaskFileEntity($model->toArray());
        }

        return [
            'list' => $list,
            'total' => $total,
        ];
    }

    /**
     * 根据项目ID获取文件列表.
     *
     * @param int $projectId 项目ID
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @param array $fileType 文件类型过滤
     * @param string $storageType 存储类型过滤
     * @param null|string $updatedAfter 更新时间过滤（查询此时间之后更新的文件）
     * @return array{list: TaskFileEntity[], total: int} 文件列表和总数
     */
    public function getByProjectId(int $projectId, int $page, int $pageSize = 200, array $fileType = [], string $storageType = '', ?string $updatedAfter = null): array
    {
        $offset = ($page - 1) * $pageSize;

        // 构建查询
        $query = $this->model::query()->where('project_id', $projectId);

        // 如果指定了文件类型数组且不为空，添加文件类型过滤条件
        if (! empty($fileType)) {
            $query->whereIn('file_type', $fileType);
        }

        // 如果指定了存储类型，添加存储类型过滤条件
        if (! empty($storageType)) {
            $query->where('storage_type', $storageType);
        }

        // 如果指定了更新时间过滤，添加时间过滤条件（数据库级别过滤）
        if ($updatedAfter !== null) {
            $query->where('updated_at', '>', $updatedAfter);
        }

        // 过滤已经被删除的， deleted_at 不为空
        $query->whereNull('deleted_at');

        // 先获取总数
        $total = $query->count();

        // 获取分页数据，使用Eloquent的get()方法让$casts生效，按层级和排序字段排序
        $models = $query->skip($offset)
            ->take($pageSize)
            ->orderBy('parent_id', 'ASC')  // 按父目录分组
            ->orderBy('sort', 'ASC')       // 按排序值排序
            ->orderBy('file_id', 'ASC')    // 排序值相同时按ID排序
            ->get();

        $list = [];
        foreach ($models as $model) {
            $list[] = new TaskFileEntity($model->toArray());
        }

        return [
            'list' => $list,
            'total' => $total,
        ];
    }

    public function getProjectFilesByCursor(
        int $projectId,
        string $storageType,
        ?int $afterFileId,
        int $limit,
        array $fileTypes = [],
        ?string $updatedAfter = null
    ): array {
        $query = $this->model::query()
            ->select([
                'file_id', 'task_id', 'project_id', 'topic_id', 'parent_id',
                'file_type', 'file_name', 'file_extension', 'file_key', 'file_size',
                'is_hidden', 'is_directory', 'sort', 'source',
                'updated_at', 'display_config', 'metadata',
            ])
            ->where('project_id', $projectId)
            ->whereNull('deleted_at');

        if ($storageType !== '') {
            $query->where('storage_type', $storageType);
        }
        if ($afterFileId !== null && $afterFileId > 0) {
            $query->where('file_id', '>', $afterFileId);
        }
        if (! empty($fileTypes)) {
            $query->whereIn('file_type', $fileTypes);
        }
        if ($updatedAfter !== null && $updatedAfter !== '') {
            $query->where('updated_at', '>', $updatedAfter);
        }

        $query->orderBy('file_id', 'ASC')->limit($limit);

        // Return raw associative arrays, bypass Eloquent hydration / casts / Carbon
        return Db::select($query->toSql(), $query->getBindings());
    }

    public function getProjectFileChildrenByParentCursor(
        int $projectId,
        int $parentId,
        string $storageType,
        ?int $afterSort,
        ?int $afterFileId,
        int $limit,
        array $fileTypes = [],
        string $fileName = '',
        ?string $spaceType = null,
        ?int $topicId = null,
        ?string $userId = null,
        ?string $organizationCode = null,
        bool $excludeHidden = false
    ): array {
        $query = $this->model::query()
            ->select([
                'file_id', 'user_id', 'organization_code', 'space_type',
                'task_id', 'project_id', 'topic_id', 'parent_id',
                'file_type', 'file_name', 'file_extension', 'file_key', 'file_size',
                'is_hidden', 'is_directory', 'sort', 'source',
                'storage_type', 'created_at', 'updated_at', 'display_config', 'metadata',
                'latest_version', 'metadata_version',
            ])
            ->where('project_id', $projectId)
            ->where('parent_id', $parentId)
            ->whereNull('deleted_at');

        if ($storageType !== '') {
            $query->where('storage_type', $storageType);
        }
        if ($excludeHidden) {
            $query->where('is_hidden', 0);
        }

        // space_type is the logical file-tree boundary. Keep storage_type as an
        // optional compatibility filter, but never use it as the sole scope
        // discriminator because old user-space rows may carry workspace.
        if ($spaceType !== null && $spaceType !== '') {
            $query->where('space_type', $spaceType);
            if ($spaceType === FileSpaceType::USER->value) {
                $query->where('project_id', 0)
                    ->where('topic_id', 0)
                    ->where('user_id', (string) $userId)
                    ->where('organization_code', (string) $organizationCode);
            } elseif ($spaceType === FileSpaceType::TOPIC->value) {
                $query->where('topic_id', (int) ($topicId ?? 0))
                    ->where('organization_code', (string) $organizationCode);
            } else {
                // Project files are shared. Do not filter by the creator or
                // operator; only non-topic project rows belong to this mount.
                $query->where('topic_id', 0);
            }
        } else {
            // Preserve the repository's legacy, explicitly unscoped behavior
            // for non-MagicFS callers that omit space_type.
            if ($topicId !== null) {
                $query->where('topic_id', $topicId);
            }
            if ($userId !== null && $userId !== '') {
                $query->where('user_id', $userId);
            }
            if ($organizationCode !== null && $organizationCode !== '') {
                $query->where('organization_code', $organizationCode);
            }
        }

        if ($fileName !== '') {
            $query->where('file_name', $fileName);
        }

        if (! empty($fileTypes)) {
            $query->where(static function ($query) use ($fileTypes): void {
                $query->where('is_directory', true)
                    ->orWhereIn('file_type', $fileTypes);
            });
        }

        if ($afterSort !== null && $afterFileId !== null && $afterFileId > 0) {
            $query->where(static function ($query) use ($afterSort, $afterFileId): void {
                $query->where('sort', '>', $afterSort)
                    ->orWhere(static function ($query) use ($afterSort, $afterFileId): void {
                        $query->where('sort', $afterSort)
                            ->where('file_id', '>', $afterFileId);
                    });
            });
        }

        $query->orderBy('sort', 'ASC')
            ->orderBy('file_id', 'ASC')
            ->limit($limit);

        return Db::select($query->toSql(), $query->getBindings());
    }

    public function getFileTreeChildrenByParentCursor(
        int $parentId,
        string $storageType,
        ?int $afterSort,
        ?int $afterFileId,
        int $limit,
        array $fileTypes = [],
        string $fileName = ''
    ): array {
        $query = $this->model::query()
            ->select([
                'file_id', 'user_id', 'organization_code', 'space_type',
                'task_id', 'project_id', 'topic_id', 'parent_id',
                'file_type', 'file_name', 'file_extension', 'file_key', 'file_size',
                'is_hidden', 'is_directory', 'sort', 'source',
                'storage_type', 'created_at', 'updated_at', 'display_config', 'metadata',
                'latest_version', 'metadata_version',
            ])
            ->where('parent_id', $parentId)
            ->whereNull('deleted_at');

        if ($storageType !== '') {
            $query->where('storage_type', $storageType);
        }
        if ($fileName !== '') {
            $query->where('file_name', $fileName);
        }
        if (! empty($fileTypes)) {
            $query->where(static function ($query) use ($fileTypes): void {
                $query->where('is_directory', true)
                    ->orWhereIn('file_type', $fileTypes);
            });
        }
        if ($afterSort !== null && $afterFileId !== null && $afterFileId > 0) {
            $query->where(static function ($query) use ($afterSort, $afterFileId): void {
                $query->where('sort', '>', $afterSort)
                    ->orWhere(static function ($query) use ($afterSort, $afterFileId): void {
                        $query->where('sort', $afterSort)
                            ->where('file_id', '>', $afterFileId);
                    });
            });
        }

        $query->orderBy('sort', 'ASC')
            ->orderBy('file_id', 'ASC')
            ->limit($limit);

        return Db::select($query->toSql(), $query->getBindings());
    }

    /**
     * 根据任务ID获取文件列表.
     *
     * @param int $taskId 任务ID
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @return array{list: TaskFileEntity[], total: int} 文件列表和总数
     */
    public function getByTaskId(int $taskId, int $page, int $pageSize): array
    {
        $offset = ($page - 1) * $pageSize;

        // 先获取总数
        $total = $this->model::query()
            ->where('task_id', $taskId)
            ->count();

        // 获取分页数据，使用Eloquent的get()方法让$casts生效
        $models = $this->model::query()
            ->where('task_id', $taskId)
            ->skip($offset)
            ->take($pageSize)
            ->orderBy('file_id', 'desc')
            ->get();

        $list = [];
        foreach ($models as $model) {
            $list[] = new TaskFileEntity($model->toArray());
        }

        return [
            'list' => $list,
            'total' => $total,
        ];
    }

    /**
     * 为保持向后兼容性，提供此方法.
     * @deprecated 使用 getByTopicId 和 getByTaskId 代替
     */
    public function getByTopicTaskId(int $topicTaskId, int $page, int $pageSize): array
    {
        // 由于数据结构变更，此方法不再直接适用
        // 为保持向后兼容，可以尝试查找相关数据
        // 这里实现一个简单的空结果
        return [
            'list' => [],
            'total' => 0,
        ];
    }

    public function insert(TaskFileEntity $entity): TaskFileEntity
    {
        return Db::transaction(function () use ($entity): TaskFileEntity {
            $date = date('Y-m-d H:i:s');
            $entity->setCreatedAt($date);
            $entity->setUpdatedAt($date);

            $this->ensureFileId($entity);
            $this->model::query()->create($entity->toArray());

            $this->recordFileTreeMutation(null, $entity, 'create');
            return $entity;
        });
    }

    /**
     * 插入文件，如果存在冲突则忽略.
     * 根据file_key和topic_id判断是否存在冲突
     */
    public function insertOrIgnore(TaskFileEntity $entity): ?TaskFileEntity
    {
        return Db::transaction(function () use ($entity): TaskFileEntity {
            // 首先检查是否已经存在相同的 file_key 的记录。
            $existingEntity = $this->model::query()
                ->where('file_key', $entity->getFileKey())
                ->first();
            if ($existingEntity) {
                return new TaskFileEntity($existingEntity->toArray());
            }

            $date = date('Y-m-d H:i:s');
            $entity->setCreatedAt($date);
            $entity->setUpdatedAt($date);
            $this->ensureFileId($entity);
            $this->model::query()->create($entity->toArray());
            $this->recordFileTreeMutation(null, $entity, 'create');
            return $entity;
        });
    }

    /**
     * 插入或更新文件.
     * 使用 INSERT ... ON DUPLICATE KEY UPDATE 语法
     * 当 file_key 唯一索引冲突时更新现有记录，否则插入新记录.
     *
     * 主要用于解决高并发场景下的唯一键冲突问题：
     * - 业务层先查询不存在
     * - 但在插入前，其他线程已经插入了相同的 file_key
     * - 此时使用 upsert 避免唯一键冲突报错
     */
    public function insertOrUpdate(TaskFileEntity $entity): TaskFileEntity
    {
        return Db::transaction(function () use ($entity): TaskFileEntity {
            $beforeModel = $this->model::query()
                ->where('file_key', $entity->getFileKey())
                ->first();
            $before = $beforeModel ? new TaskFileEntity($beforeModel->toArray()) : null;

            $date = date('Y-m-d H:i:s');
            if (empty($entity->getCreatedAt())) {
                $entity->setCreatedAt($date);
            }
            $entity->setUpdatedAt($date);
            $entityArray = $entity->toArray();

            $this->model::query()->upsert(
                [$entityArray],
                ['file_key'],
                array_values(array_diff(array_keys($entityArray), ['file_id', 'file_key', 'created_at']))
            );

            $afterModel = $this->model::query()
                ->where('file_key', $entity->getFileKey())
                ->first();
            $after = $afterModel ? new TaskFileEntity($afterModel->toArray()) : $entity;
            $entity->setFileId($after->getFileId());
            $entity->setCreatedAt($after->getCreatedAt());
            $this->recordFileTreeMutation($before, $after);
            return $entity;
        });
    }

    public function updateById(
        TaskFileEntity $entity,
        ?string $journalOperation = null,
        bool $emitJournal = true
    ): TaskFileEntity {
        return Db::transaction(function () use ($entity, $journalOperation, $emitJournal): TaskFileEntity {
            $beforeModel = $this->model::query()
                ->where('file_id', $entity->getFileId())
                ->first();
            $before = $beforeModel ? new TaskFileEntity($beforeModel->toArray()) : null;

            $entity->setUpdatedAt(date('Y-m-d H:i:s'));
            $this->model::query()
                ->where('file_id', $entity->getFileId())
                ->update($entity->toArray());

            $afterModel = $this->model::query()
                ->where('file_id', $entity->getFileId())
                ->first();
            if ($emitJournal && $afterModel !== null) {
                $this->recordFileTreeMutation(
                    $before,
                    new TaskFileEntity($afterModel->toArray()),
                    $journalOperation
                );
            }
            return $entity;
        });
    }

    /**
     * Initialize the durable cursor row for every existing file-tree root.
     *
     * Root IDs are read with keyset pagination, and each bounded insert uses
     * insert-or-ignore. Existing journal bounds are used when a head is
     * missing, so late initialization cannot reset a root that already has
     * changes. A concurrent root creation can win the race without having its
     * already-advanced revision overwritten by this backfill. Existing heads
     * are never modified.
     *
     * @return array{discovered_file_trees:int, initialized_file_trees:int}
     */
    public function initializeFileTreeHeads(int $batchSize = 1000): array
    {
        $batchSize = max(1, min($batchSize, 10000));
        $lastRootFileId = 0;
        $discoveredFileTrees = 0;
        $initializedFileTrees = 0;

        while (true) {
            $rootFileIds = $this->model::query()
                ->where('file_id', '>', $lastRootFileId)
                ->where(static function ($query): void {
                    $query->whereNull('parent_id')->orWhere('parent_id', 0);
                })
                ->where('is_directory', true)
                ->whereNull('deleted_at')
                ->orderBy('file_id', 'ASC')
                ->limit($batchSize)
                ->pluck('file_id')
                ->map(static fn ($fileId): int => (int) $fileId)
                ->all();
            if ($rootFileIds === []) {
                break;
            }

            $lastRootFileId = $rootFileIds[array_key_last($rootFileIds)];
            $changeBounds = Db::table(self::FILE_TREE_CHANGES_TABLE)
                ->select('root_file_id')
                ->selectRaw('MAX(revision) AS revision, MIN(revision) AS oldest_revision')
                ->whereIn('root_file_id', $rootFileIds)
                ->groupBy('root_file_id')
                ->get()
                ->keyBy('root_file_id');
            $now = date('Y-m-d H:i:s');
            $rows = array_map(
                static function (int $rootFileId) use ($changeBounds, $now): array {
                    // Array-normalized bounds: `?->` on an array row would
                    // silently fall back to the default revision instead of
                    // the persisted one.
                    $bounds = (array) ($changeBounds->get($rootFileId) ?? []);
                    $revision = (int) ($bounds['revision'] ?? 0);
                    $oldestRevision = (int) ($bounds['oldest_revision'] ?? 1);

                    return [
                        'root_file_id' => $rootFileId,
                        'revision' => max(0, $revision),
                        'oldest_revision' => max(1, $oldestRevision),
                        'updated_at' => $now,
                    ];
                },
                $rootFileIds
            );

            $discoveredFileTrees += count($rootFileIds);
            $initializedFileTrees += Db::table(self::FILE_TREE_HEADS_TABLE)->insertOrIgnore($rows);
        }

        return [
            'discovered_file_trees' => $discoveredFileTrees,
            'initialized_file_trees' => $initializedFileTrees,
        ];
    }

    /**
     * Backfill metadata_version in bounded transactions while keeping the
     * file mutation, root head and durable journal atomic.
     *
     * This command is deliberately keyset/ID based.  It never materialises
     * the whole project and it does not use a direct table update that would
     * leave mounted lazy caches unaware of the changed metadata version.
     */
    public function backfillMagicFSMetadataVersions(int $batchSize = 1000): int
    {
        $batchSize = max(1, min($batchSize, 10000));
        $processedTotal = 0;

        while (true) {
            $processed = Db::transaction(function () use ($batchSize): int {
                $beforeModels = $this->model::query()
                    ->where('metadata_version', 1)
                    ->where('latest_version', '>', 1)
                    ->whereNull('deleted_at')
                    ->orderBy('file_id', 'ASC')
                    ->limit($batchSize)
                    ->lockForUpdate()
                    ->get();
                if ($beforeModels->isEmpty()) {
                    return 0;
                }

                $ids = $beforeModels->pluck('file_id')
                    ->map(static fn ($id): int => (int) $id)
                    ->all();
                $now = date('Y-m-d H:i:s');
                $updatedRows = $this->model::query()
                    ->whereIn('file_id', $ids)
                    ->where('metadata_version', 1)
                    ->where('latest_version', '>', 1)
                    ->whereNull('deleted_at')
                    ->update([
                        'metadata_version' => Db::raw('latest_version'),
                        'updated_at' => $now,
                    ]);

                $afterModels = $this->model::query()
                    ->whereIn('file_id', $ids)
                    ->whereNull('deleted_at')
                    ->get()
                    ->keyBy('file_id');
                $pending = [];
                $parentRootIds = [];
                foreach ($beforeModels as $beforeModel) {
                    $afterModel = $afterModels->get($beforeModel->file_id);
                    $this->recordFileTreeMutation(
                        new TaskFileEntity($beforeModel->toArray()),
                        $afterModel ? new TaskFileEntity($afterModel->toArray()) : null,
                        'update',
                        null,
                        null,
                        $pending,
                        parentRootIds: $parentRootIds
                    );
                }
                $this->appendFileTreeChanges($pending);

                // Some historical rows are outside a mounted MagicFS file tree and
                // therefore intentionally produce no journal event.  The
                // outer loop must nevertheless advance past those rows: its
                // progress unit is the number of file rows actually updated,
                // not the number of emitted feed records.
                return (int) $updatedRows;
            });

            if ($processed === 0) {
                break;
            }
            $processedTotal += $processed;
        }

        return $processedTotal;
    }

    /**
     * Apply heterogeneous maintenance updates without bypassing the
     * mutation journal.  Only the fields needed by the parent-id/file-key
     * migration are accepted; arbitrary command input must not become a
     * second write API with different file-tree semantics.
     *
     * @param array<int, array{file_id:int,file_key?:string,parent_id?:null|int,updated_at?:string}> $updates
     */
    public function applyMagicFSBackfillUpdates(array $updates): int
    {
        $normalised = [];
        foreach ($updates as $update) {
            $fileId = (int) ($update['file_id'] ?? 0);
            if ($fileId <= 0) {
                continue;
            }
            $item = ['file_id' => $fileId];
            if (array_key_exists('file_key', $update)) {
                $item['file_key'] = (string) $update['file_key'];
            }
            if (array_key_exists('parent_id', $update)) {
                $item['parent_id'] = $update['parent_id'] === null
                    ? null
                    : (int) $update['parent_id'];
            }
            if (array_key_exists('updated_at', $update) && $update['updated_at'] !== null) {
                $item['updated_at'] = (string) $update['updated_at'];
            }
            if (count($item) > 1) {
                // Keep the last calculated value when a caller accidentally
                // supplies the same file twice in one chunk.
                $normalised[$fileId] = $item;
            }
        }
        if ($normalised === []) {
            return 0;
        }

        return Db::transaction(function () use ($normalised): int {
            $ids = array_keys($normalised);
            $beforeModels = $this->model::query()
                ->whereIn('file_id', $ids)
                ->whereNull('deleted_at')
                // Keep row-lock acquisition deterministic when concurrent
                // moves share ancestors; the file-tree head lock already
                // serialises feed allocation, and this ordering avoids an
                // avoidable deadlock between overlapping chains.
                ->orderBy('file_id', 'ASC')
                ->lockForUpdate()
                ->get()
                ->keyBy('file_id');
            if ($beforeModels->isEmpty()) {
                return 0;
            }

            $changedIds = [];
            foreach ($normalised as $fileId => $update) {
                $beforeModel = $beforeModels->get($fileId);
                if ($beforeModel === null) {
                    continue;
                }
                $data = [];
                if (array_key_exists('file_key', $update)
                    && (string) $beforeModel->getAttribute('file_key') !== $update['file_key']) {
                    $data['file_key'] = $update['file_key'];
                }
                if (array_key_exists('parent_id', $update)
                    && ($beforeModel->getAttribute('parent_id') === null
                        ? $update['parent_id'] !== null
                        : (int) $beforeModel->getAttribute('parent_id') !== (int) $update['parent_id'])) {
                    $data['parent_id'] = $update['parent_id'];
                }
                if ($data === []) {
                    continue;
                }
                if (array_key_exists('parent_id', $data)) {
                    $before = new TaskFileEntity($beforeModel->toArray());
                    $candidate = new TaskFileEntity($before->toArray());
                    $candidate->setParentId(
                        $data['parent_id'] === null || (int) $data['parent_id'] <= 0
                            ? null
                            : (int) $data['parent_id']
                    );
                    $data['parent_id'] = $candidate->getParentId();
                }
                $data['updated_at'] = $update['updated_at'] ?? date('Y-m-d H:i:s');
                $this->model::query()
                    ->where('file_id', $fileId)
                    ->whereNull('deleted_at')
                    ->update($data);
                $changedIds[] = (int) $fileId;
            }
            if ($changedIds === []) {
                return 0;
            }

            $afterModels = $this->model::query()
                ->whereIn('file_id', $changedIds)
                ->whereNull('deleted_at')
                ->get()
                ->keyBy('file_id');
            $pending = [];
            $parentRootIds = [];
            foreach ($changedIds as $fileId) {
                $beforeModel = $beforeModels->get($fileId);
                $afterModel = $afterModels->get($fileId);
                if ($beforeModel === null || $afterModel === null) {
                    continue;
                }
                $this->recordFileTreeMutation(
                    new TaskFileEntity($beforeModel->toArray()),
                    new TaskFileEntity($afterModel->toArray()),
                    null,
                    null,
                    null,
                    $pending,
                    parentRootIds: $parentRootIds
                );
            }
            $this->appendFileTreeChanges($pending);

            return count($changedIds);
        });
    }

    public function updateFileByCondition(array $condition, array $data): bool
    {
        return Db::transaction(function () use ($condition, $data): bool {
            $beforeModels = $this->model::query()->where($condition)->get();
            unset($data['root_file_id']);
            $affected = 0;
            if (! array_key_exists('parent_id', $data)) {
                $affected = $this->model::query()->where($condition)->update($data);
            } else {
                foreach ($beforeModels as $beforeModel) {
                    $before = new TaskFileEntity($beforeModel->toArray());
                    $candidate = new TaskFileEntity($before->toArray());
                    $parentId = $data['parent_id'];
                    $candidate->setParentId(
                        $parentId === null || $parentId === '' || (int) $parentId <= 0
                            ? null
                            : (int) $parentId
                    );
                    $rowData = $data;
                    $rowData['parent_id'] = $candidate->getParentId();
                    $updated = $this->model::query()
                        ->where('file_id', $before->getFileId())
                        ->update($rowData);
                    $affected += (int) $updated;
                }
            }
            if ($affected <= 0) {
                return false;
            }
            $ids = $beforeModels->pluck('file_id')->map(static fn ($id): int => (int) $id)->all();
            if ($ids === []) {
                return true;
            }
            $afterModels = $this->model::query()->whereIn('file_id', $ids)->get()->keyBy('file_id');
            $pending = [];
            $parentRootIds = [];
            foreach ($beforeModels as $beforeModel) {
                $afterModel = $afterModels->get($beforeModel->file_id);
                $this->recordFileTreeMutation(
                    new TaskFileEntity($beforeModel->toArray()),
                    $afterModel ? new TaskFileEntity($afterModel->toArray()) : null,
                    null,
                    null,
                    null,
                    $pending,
                    parentRootIds: $parentRootIds
                );
            }
            $this->appendFileTreeChanges($pending);
            return true;
        });
    }

    public function deleteById(int $id, bool $forceDelete = true): void
    {
        Db::transaction(function () use ($id, $forceDelete): void {
            $before = $this->getByIdWithTrash($id);
            $beforeRootFileId = $before !== null && $this->shouldJournalFileTree($before)
                ? $this->resolveFileTreeRootId($before)
                : null;
            $query = $this->model::query()->where('file_id', $id);
            if ($forceDelete) {
                $query->forceDelete();
            } else {
                $query->delete();
            }
            $pending = null;
            $this->recordFileTreeMutation($before, null, 'delete', null, null, $pending, $beforeRootFileId);
        });
    }

    /**
     * 根据 file_key 和 project_id 删除文件（物理删除）.
     */
    public function deleteByFileKeyAndProjectId(string $fileKey, int $projectId): int
    {
        return Db::transaction(function () use ($fileKey, $projectId): int {
            $beforeModels = $this->model::withTrashed()
                ->where('file_key', $fileKey)
                ->where('project_id', $projectId)
                ->get();
            $beforeRoots = [];
            $beforeParentRootIds = [];
            foreach ($beforeModels as $beforeModel) {
                $before = new TaskFileEntity($beforeModel->toArray());
                if ($this->shouldJournalFileTree($before) && $before->getDeletedAt() === null) {
                    $beforeRoots[(int) $beforeModel->file_id] = $this->resolveFileTreeRootId($before, $beforeParentRootIds);
                }
            }
            $result = $this->model::query()
                ->where('file_key', $fileKey)
                ->where('project_id', $projectId)
                ->forceDelete();
            $pending = [];
            foreach ($beforeModels as $beforeModel) {
                $this->recordFileTreeMutation(
                    new TaskFileEntity($beforeModel->toArray()),
                    null,
                    'delete',
                    null,
                    null,
                    $pending,
                    $beforeRoots[(int) $beforeModel->file_id] ?? null
                );
            }
            $this->appendFileTreeChanges($pending);
            return (int) ($result ?? 0);
        });
    }

    public function getByFileKeyAndSandboxId(string $fileKey, int $sandboxId): ?TaskFileEntity
    {
        $model = $this->model::query()
            ->where('file_key', $fileKey)
            ->where('sandbox_id', $sandboxId)
            ->first();
        if (! $model) {
            return null;
        }
        return new TaskFileEntity($model->toArray());
    }

    /**
     * 根据文件ID数组和用户ID批量获取用户文件.
     *
     * @param array $fileIds 文件ID数组
     * @param string $userId 用户ID
     * @return TaskFileEntity[] 用户文件列表
     */
    public function findUserFilesByIds(array $fileIds, string $userId): array
    {
        if (empty($fileIds)) {
            return [];
        }

        // 查询属于指定用户的文件
        $models = $this->model::query()
            ->whereIn('file_id', $fileIds)
            ->where('user_id', $userId)
            ->whereNull('deleted_at') // 过滤已删除的文件
            ->orderBy('file_id', 'desc')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = new TaskFileEntity($model->toArray());
        }

        return $entities;
    }

    public function findUserFilesByTopicId(string $topicId): array
    {
        $models = $this->model::query()
            ->where('topic_id', $topicId)
            ->where('is_hidden', 0)
            ->whereNull('deleted_at') // 过滤已删除的文件
            ->orderBy('file_id', 'desc')
            ->limit(1000)
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = new TaskFileEntity($model->toArray());
        }

        return $entities;
    }

    public function findUserFilesByProjectId(string $projectId): array
    {
        $models = $this->model::query()
            ->where('project_id', $projectId)
            ->where('is_hidden', 0)
            ->whereNull('deleted_at') // 过滤已删除的文件
            ->orderBy('file_id', 'desc')
            ->limit(1000)
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = new TaskFileEntity($model->toArray());
        }

        return $entities;
    }

    /**
     * @return array|TaskFileEntity[]
     */
    public function findFilesByProjectIdAndIds(int $projectId, array $fileIds): array
    {
        $models = $this->model::query()
            ->where('project_id', $projectId)
            ->whereIn('file_id', $fileIds)
            ->whereNull('deleted_at') // 过滤已删除的文件
            ->orderBy('file_id', 'desc')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = new TaskFileEntity($model->toArray());
        }

        return $entities;
    }

    /**
     * 根据项目ID获取所有文件的file_key列表（高性能查询）.
     */
    public function getFileKeysByProjectId(int $projectId, int $limit = 1000): array
    {
        $query = $this->model::query()
            ->select(['file_key'])
            ->where('project_id', $projectId)
            ->whereNull('deleted_at')
            ->limit($limit);

        return $query->pluck('file_key')->toArray();
    }

    /**
     * 批量插入新文件记录.
     */
    public function batchInsertFiles(DataIsolation $dataIsolation, int $projectId, array $newFileKeys, array $objectStorageFiles = []): void
    {
        if (empty($newFileKeys)) {
            return;
        }

        $rootFileId = $this->findProjectFileTreeRootId($projectId);
        if ($rootFileId <= 0) {
            throw new RuntimeException(sprintf(
                'Cannot batch insert project files: file-tree root is unavailable for project_id=%d',
                $projectId
            ));
        }

        $insertData = [];
        $now = date('Y-m-d H:i:s');

        foreach ($newFileKeys as $fileKey) {
            // 从对象存储文件信息中获取详细信息
            $fileInfo = $objectStorageFiles[$fileKey] ?? [];

            $insertData[] = [
                'file_id' => IdGenerator::getSnowId(),
                'parent_id' => $rootFileId,
                'user_id' => $dataIsolation->getCurrentUserId(),
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                'project_id' => $projectId,
                'source_file_id' => null,
                'topic_id' => 0,
                'task_id' => 0,
                'file_key' => $fileKey,
                'file_name' => $fileInfo['file_name'] ?? basename($fileKey),
                'file_extension' => $fileInfo['file_extension'] ?? pathinfo($fileKey, PATHINFO_EXTENSION),
                'file_type' => 'auto_sync',
                'file_size' => $fileInfo['file_size'] ?? 0,
                'storage_type' => 'workspace',
                'is_hidden' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        Db::transaction(function () use ($insertData): void {
            $this->model::query()->insert($insertData);
            // Hydrate only the inserted rows after the batch write. This keeps
            // the file-table operation batched while still giving each
            // root cursor one precise create event.
            $ids = array_column($insertData, 'file_id');
            $models = $this->model::query()->whereIn('file_id', $ids)->get();
            $pending = [];
            $parentRootIds = [];
            foreach ($models as $model) {
                $this->recordFileTreeMutation(null, new TaskFileEntity($model->toArray()), 'create', null, null, $pending, parentRootIds: $parentRootIds);
            }
            $this->appendFileTreeChanges($pending);
        });
    }

    /**
     * 批量标记文件为已删除.
     */
    public function batchMarkAsDeleted(array $deletedFileKeys): void
    {
        if (empty($deletedFileKeys)) {
            return;
        }

        Db::transaction(function () use ($deletedFileKeys): void {
            $beforeModels = $this->model::query()
                ->whereIn('file_key', $deletedFileKeys)
                ->whereNull('deleted_at')
                ->get();
            $this->model::query()
                ->whereIn('file_key', $deletedFileKeys)
                ->whereNull('deleted_at')
                ->update([
                    'deleted_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s'),
                ]);
            $pending = [];
            $parentRootIds = [];
            foreach ($beforeModels as $model) {
                $this->recordFileTreeMutation(new TaskFileEntity($model->toArray()), null, 'delete', null, null, $pending, parentRootIds: $parentRootIds);
            }
            $this->appendFileTreeChanges($pending);
        });
    }

    /**
     * 批量更新文件信息.
     */
    public function batchUpdateFiles(array $updatedFileKeys): void
    {
        if (empty($updatedFileKeys)) {
            return;
        }

        Db::transaction(function () use ($updatedFileKeys): void {
            $beforeModels = $this->model::query()
                ->whereIn('file_key', $updatedFileKeys)
                ->whereNull('deleted_at')
                ->get();
            // 简化实现：只更新修改时间
            $this->model::query()
                ->whereIn('file_key', $updatedFileKeys)
                ->whereNull('deleted_at')
                ->update(['updated_at' => date('Y-m-d H:i:s')]);
            $afterModels = $this->model::query()
                ->whereIn('file_key', $updatedFileKeys)
                ->whereNull('deleted_at')
                ->get()
                ->keyBy('file_id');
            $pending = [];
            $parentRootIds = [];
            foreach ($beforeModels as $beforeModel) {
                $afterModel = $afterModels->get($beforeModel->file_id);
                $this->recordFileTreeMutation(
                    new TaskFileEntity($beforeModel->toArray()),
                    $afterModel ? new TaskFileEntity($afterModel->toArray()) : null,
                    null,
                    null,
                    null,
                    $pending,
                    parentRootIds: $parentRootIds
                );
            }
            $this->appendFileTreeChanges($pending);
        });
    }

    /**
     * 根据目录路径查找文件列表.
     */
    public function findFilesByDirectoryPath(int $projectId, string $directoryPath, int $limit = 1000): array
    {
        $models = $this->model::query()
            ->where('project_id', $projectId)
            ->where('file_key', 'like', $directoryPath . '%')
            ->whereNull('deleted_at')
            ->limit($limit)
            ->get();

        $list = [];
        foreach ($models as $model) {
            $list[] = new TaskFileEntity($model->toArray());
        }

        return $list;
    }

    /**
     * 根据 parent_id 和 project_id 查找子文件列表.
     * 此查询会使用索引: idx_project_parent_sort (project_id, parent_id, sort, file_id).
     */
    public function getChildrenByParentAndProject(int $projectId, int $parentId, int $limit = 500, ?string $spaceType = null): array
    {
        $query = $this->model::query()
            ->where('project_id', $projectId)
            ->where('parent_id', $parentId)
            ->whereNull('deleted_at');

        if ($spaceType !== null) {
            $query->where('space_type', $spaceType);
        }

        $models = $query->limit($limit)->get();

        $list = [];
        foreach ($models as $model) {
            $list[] = new TaskFileEntity($model->toArray());
        }

        return $list;
    }

    /**
     * 批量查询多个父目录的子文件（使用 IN 查询，避免 N+1 问题）.
     * 使用 idx_project_parent_sort 索引.
     *
     * @param int $projectId 项目ID
     * @param array $parentIds 父目录ID数组
     * @param int $limit 限制数量
     * @return TaskFileEntity[] 文件实体列表
     */
    public function getChildrenByParentIdsAndProject(int $projectId, array $parentIds, int $limit = 1000, int $offset = 0): array
    {
        if (empty($parentIds)) {
            return [];
        }

        $models = $this->model::query()
            ->where('project_id', $projectId)
            ->whereIn('parent_id', $parentIds)
            ->whereNull('deleted_at')
            ->offset($offset)
            ->limit($limit)
            ->get();

        $list = [];
        foreach ($models as $model) {
            $list[] = new TaskFileEntity($model->toArray());
        }

        return $list;
    }

    public function getChildrenByParentIdsAndProjectWithTrash(int $projectId, array $parentIds, int $limit = 1000, int $offset = 0): array
    {
        if (empty($parentIds)) {
            return [];
        }

        /* @phpstan-ignore-next-line - TaskFileModel uses SoftDeletes trait which provides withTrashed() */
        $models = $this->model::withTrashed()
            ->where('project_id', $projectId)
            ->whereIn('parent_id', $parentIds)
            ->offset($offset)
            ->limit($limit)
            ->get();

        $list = [];
        foreach ($models as $model) {
            $list[] = new TaskFileEntity($model->toArray());
        }

        return $list;
    }

    public function getAllDescendantEntitiesWithTrash(int $parentId, int $projectId = 0, int $maxDepth = 100): array
    {
        $result = [];
        $parentIds = [$parentId];

        for ($depth = 0; $depth < $maxDepth && $parentIds !== []; ++$depth) {
            $nextParentIds = [];
            $offset = 0;
            do {
                $children = $this->getChildrenByParentIdsAndProjectWithTrash(
                    $projectId,
                    $parentIds,
                    1000,
                    $offset
                );
                foreach ($children as $child) {
                    if (isset($result[$child->getFileId()])) {
                        continue;
                    }
                    $result[$child->getFileId()] = $child;
                    if ($child->getIsDirectory()) {
                        $nextParentIds[] = $child->getFileId();
                    }
                }
                $offset += count($children);
            } while (count($children) === 1000);

            $parentIds = array_values(array_unique($nextParentIds));
        }

        return array_values($result);
    }

    /**
     * 批量更新文件的 file_key.
     * 使用 CASE WHEN 语句实现一次性批量更新.
     *
     * @param array $updateBatch [['file_id' => 1, 'file_key' => 'new/path', 'updated_at' => '...'], ...]
     * @return int 更新的文件数量
     */
    public function batchUpdateFileKeys(array $updateBatch): int
    {
        if (empty($updateBatch)) {
            return 0;
        }

        $fileIds = array_column($updateBatch, 'file_id');

        // 构建 CASE WHEN 语句和绑定参数（正确的顺序）
        $fileKeyCases = [];
        $updatedAtCases = [];
        $fileKeyBindings = [];
        $updatedAtBindings = [];

        foreach ($updateBatch as $item) {
            $fileKeyCases[] = 'WHEN ? THEN ?';
            $updatedAtCases[] = 'WHEN ? THEN ?';

            // file_key 的参数
            $fileKeyBindings[] = $item['file_id'];
            $fileKeyBindings[] = $item['file_key'];

            // updated_at 的参数
            $updatedAtBindings[] = $item['file_id'];
            $updatedAtBindings[] = $item['updated_at'];
        }

        $fileKeyCasesSql = implode(' ', $fileKeyCases);
        $updatedAtCasesSql = implode(' ', $updatedAtCases);

        // 构建 SQL（按照正确的顺序合并参数）
        $sql = sprintf(
            'UPDATE %s SET 
                file_key = CASE file_id %s END,
                updated_at = CASE file_id %s END
                WHERE file_id IN (%s)',
            $this->model->getTable(),
            $fileKeyCasesSql,
            $updatedAtCasesSql,
            implode(',', array_fill(0, count($fileIds), '?'))
        );

        // 正确的参数顺序：先 file_key 的 CASE，再 updated_at 的 CASE，最后是 WHERE IN
        $bindings = array_merge($fileKeyBindings, $updatedAtBindings, $fileIds);

        return Db::transaction(function () use ($sql, $bindings, $fileIds): int {
            $beforeModels = $this->model::query()->whereIn('file_id', $fileIds)->get();
            $affected = Db::update($sql, $bindings);
            $afterModels = $this->model::query()->whereIn('file_id', $fileIds)->get()->keyBy('file_id');
            $pending = [];
            $parentRootIds = [];
            foreach ($beforeModels as $beforeModel) {
                $afterModel = $afterModels->get($beforeModel->file_id);
                $this->recordFileTreeMutation(
                    new TaskFileEntity($beforeModel->toArray()),
                    $afterModel ? new TaskFileEntity($afterModel->toArray()) : null,
                    null,
                    null,
                    null,
                    $pending,
                    parentRootIds: $parentRootIds
                );
            }
            $this->appendFileTreeChanges($pending);
            return $affected;
        });
    }

    /**
     * 批量删除文件.
     *
     * @param array $fileIds 文件ID数组
     * @param bool $forceDelete 是否强制删除（物理删除），默认为true，false为软删除
     * @param null|int $projectId 可选项目作用域
     */
    public function deleteByIds(array $fileIds, bool $forceDelete = true, ?int $projectId = null): void
    {
        if (empty($fileIds)) {
            return;
        }

        Db::transaction(function () use ($fileIds, $forceDelete, $projectId): void {
            $ids = array_values(array_unique(array_map('intval', $fileIds)));
            $beforeQuery = $this->model::withTrashed()->whereIn('file_id', $ids);
            if ($projectId !== null && $projectId > 0) {
                $beforeQuery->where('project_id', $projectId);
            }
            $beforeModels = $beforeQuery->get();
            $beforeRoots = [];
            $beforeParentRootIds = [];
            foreach ($beforeModels as $beforeModel) {
                $before = new TaskFileEntity($beforeModel->toArray());
                if ($this->shouldJournalFileTree($before) && $before->getDeletedAt() === null) {
                    $beforeRoots[(int) $beforeModel->file_id] = $this->resolveFileTreeRootId($before, $beforeParentRootIds);
                }
            }

            $query = $this->model::query()->whereIn('file_id', $ids);
            if ($projectId !== null && $projectId > 0) {
                $query->where('project_id', $projectId);
            }
            if ($forceDelete) {
                $query->forceDelete();
            } else {
                $query->delete();
            }

            $pending = [];
            foreach ($beforeModels as $beforeModel) {
                $this->recordFileTreeMutation(
                    new TaskFileEntity($beforeModel->toArray()),
                    null,
                    'delete',
                    null,
                    null,
                    $pending,
                    $beforeRoots[(int) $beforeModel->file_id] ?? null
                );
            }
            $this->appendFileTreeChanges($pending);
        });
    }

    /**
     * 根据文件Keys批量删除文件（物理删除）.
     */
    public function deleteByFileKeys(array $fileKeys): void
    {
        if (empty($fileKeys)) {
            return;
        }

        Db::transaction(function () use ($fileKeys): void {
            $beforeModels = $this->model::withTrashed()->whereIn('file_key', $fileKeys)->get();
            $beforeRoots = [];
            $beforeParentRootIds = [];
            foreach ($beforeModels as $beforeModel) {
                $before = new TaskFileEntity($beforeModel->toArray());
                if ($this->shouldJournalFileTree($before) && $before->getDeletedAt() === null) {
                    $beforeRoots[(int) $beforeModel->file_id] = $this->resolveFileTreeRootId($before, $beforeParentRootIds);
                }
            }
            $this->model::query()->whereIn('file_key', $fileKeys)->forceDelete();
            $pending = [];
            foreach ($beforeModels as $beforeModel) {
                $this->recordFileTreeMutation(
                    new TaskFileEntity($beforeModel->toArray()),
                    null,
                    'delete',
                    null,
                    null,
                    $pending,
                    $beforeRoots[(int) $beforeModel->file_id] ?? null
                );
            }
            $this->appendFileTreeChanges($pending);
        });
    }

    /**
     * 获取指定父目录下的最小排序值.
     *
     * @param null|int $parentId 父目录ID，null 表示根层级
     * @param int $projectId 项目ID
     * @param null|string $spaceType 空间类型过滤，null 不过滤（保持原行为）
     */
    public function getMinSortByParentId(?int $parentId, int $projectId, ?string $spaceType = null): ?int
    {
        $query = $this->model::query()
            ->where('project_id', $projectId)
            ->whereNull('deleted_at');

        if ($parentId === null) {
            $query->whereNull('parent_id');
        } else {
            $query->where('parent_id', $parentId);
        }

        if ($spaceType !== null) {
            $query->where('space_type', $spaceType);
        }

        return $query->min('sort');
    }

    /**
     * 获取指定父目录下的最大排序值.
     *
     * @param null|int $parentId 父目录ID，null 表示根层级
     * @param int $projectId 项目ID
     * @param null|string $spaceType 空间类型过滤，null 不过滤（保持原行为）
     */
    public function getMaxSortByParentId(?int $parentId, int $projectId, ?string $spaceType = null): ?int
    {
        $query = $this->model::query()
            ->where('project_id', $projectId)
            ->whereNull('deleted_at');

        if ($parentId === null) {
            $query->whereNull('parent_id');
        } else {
            $query->where('parent_id', $parentId);
        }

        if ($spaceType !== null) {
            $query->where('space_type', $spaceType);
        }

        return $query->max('sort');
    }

    /**
     * 获取指定文件的排序值.
     */
    public function getSortByFileId(int $fileId): ?int
    {
        return $this->model::query()
            ->where('file_id', $fileId)
            ->whereNull('deleted_at')
            ->value('sort');
    }

    /**
     * 获取指定排序值之后的下一个排序值.
     *
     * @param null|int $parentId 父目录ID，null 表示根层级
     * @param int $currentSort 当前排序值
     * @param int $projectId 项目ID
     * @param null|string $spaceType 空间类型过滤，null 不过滤（保持原行为）
     */
    public function getNextSortAfter(?int $parentId, int $currentSort, int $projectId, ?string $spaceType = null): ?int
    {
        $query = $this->model::query()
            ->where('project_id', $projectId)
            ->where('sort', '>', $currentSort)
            ->whereNull('deleted_at');

        if ($parentId === null) {
            $query->whereNull('parent_id');
        } else {
            $query->where('parent_id', $parentId);
        }

        if ($spaceType !== null) {
            $query->where('space_type', $spaceType);
        }

        return $query->min('sort');
    }

    /**
     * 获取同一父目录下的所有兄弟节点.
     *
     * @param null|int $parentId 父目录ID，null 表示根层级
     * @param int $projectId 项目ID
     * @param string $orderBy 排序字段
     * @param string $direction 排序方向
     * @param null|string $spaceType 空间类型过滤，null 不过滤（保持原行为）
     */
    public function getSiblingsByParentId(?int $parentId, int $projectId, string $orderBy = 'sort', string $direction = 'ASC', ?string $spaceType = null): array
    {
        $query = $this->model::query()
            ->where('project_id', $projectId)
            ->whereNull('deleted_at');

        if ($parentId === null) {
            $query->whereNull('parent_id');
        } else {
            $query->where('parent_id', $parentId);
        }

        if ($spaceType !== null) {
            $query->where('space_type', $spaceType);
        }

        return $query->orderBy($orderBy, $direction)->get()->toArray();
    }

    public function getSiblingCountByParentId(int $parentId, int $projectId): int
    {
        return $this->model::query()
            ->where('project_id', $projectId)
            ->where('parent_id', $parentId)
            ->whereNull('deleted_at')
            ->count();
    }

    /**
     * 批量更新排序值.
     */
    public function batchUpdateSort(array $updates): void
    {
        if (empty($updates)) {
            return;
        }

        Db::transaction(function () use ($updates): void {
            $fileIds = array_values(array_unique(array_map(static fn (array $item): int => (int) $item['file_id'], $updates)));
            $beforeModels = $this->model::query()->whereIn('file_id', $fileIds)->get();
            foreach ($updates as $update) {
                $this->model::query()
                    ->where('file_id', $update['file_id'])
                    ->update(['sort' => $update['sort'], 'updated_at' => date('Y-m-d H:i:s')]);
            }
            $afterModels = $this->model::query()->whereIn('file_id', $fileIds)->get()->keyBy('file_id');
            $pending = [];
            $parentRootIds = [];
            foreach ($beforeModels as $beforeModel) {
                $afterModel = $afterModels->get($beforeModel->file_id);
                $this->recordFileTreeMutation(
                    new TaskFileEntity($beforeModel->toArray()),
                    $afterModel ? new TaskFileEntity($afterModel->toArray()) : null,
                    null,
                    null,
                    null,
                    $pending,
                    parentRootIds: $parentRootIds
                );
            }
            $this->appendFileTreeChanges($pending);
        });
    }

    /**
     * Batch bind files to project with parent directory.
     * Updates both project_id and parent_id atomically.
     */
    public function batchBindToProject(array $fileIds, int $projectId, int $parentId): int
    {
        if (empty($fileIds)) {
            return 0;
        }

        return Db::transaction(function () use ($fileIds, $projectId, $parentId): int {
            $base = $this->model::query()
                ->whereIn('file_id', $fileIds)
                ->where(function ($query) {
                    $query->whereNull('project_id')->orWhere('project_id', 0);
                });
            $beforeModels = $base->lockForUpdate()->orderBy('file_id', 'ASC')->get();
            if ($beforeModels->isEmpty()) {
                return 0;
            }

            $this->resolveParentChainRootId($parentId);
            $updatedAt = date('Y-m-d H:i:s');
            $affected = 0;
            foreach ($beforeModels as $beforeModel) {
                $affected += (int) $this->model::query()
                    ->where('file_id', $beforeModel->file_id)
                    ->update([
                        'project_id' => $projectId,
                        'parent_id' => $parentId,
                        'updated_at' => $updatedAt,
                    ]);
            }
            $afterModels = $this->model::query()->whereIn('file_id', $fileIds)->get()->keyBy('file_id');
            $pending = [];
            $parentRootIds = [];
            foreach ($beforeModels as $beforeModel) {
                $afterModel = $afterModels->get($beforeModel->file_id);
                $this->recordFileTreeMutation(
                    new TaskFileEntity($beforeModel->toArray()),
                    $afterModel ? new TaskFileEntity($afterModel->toArray()) : null,
                    null,
                    null,
                    null,
                    $pending,
                    parentRootIds: $parentRootIds
                );
            }
            $this->appendFileTreeChanges($pending);
            return $affected;
        });
    }

    public function findLatestUpdatedByProjectId(int $projectId): ?TaskFileEntity
    {
        /** @phpstan-ignore-next-line - TaskFileModel uses SoftDeletes trait which provides withTrashed() */
        $model = $this->model::query()
            ->withTrashed()
            ->where('project_id', $projectId)
            ->orderBy('updated_at', 'desc')
            ->first();

        if (! $model) {
            return null;
        }

        return new TaskFileEntity($model->toArray());
    }

    /**
     * Get the latest updated time by project ID.
     * This is an optimized method that only returns the time string,
     * avoiding Model instantiation and Enum reflection overhead.
     */
    public function getLatestUpdatedTimeByProjectId(int $projectId): ?string
    {
        /* @phpstan-ignore-next-line - TaskFileModel uses SoftDeletes trait which provides withTrashed() */
        return $this->model::query()
            ->withTrashed()
            ->where('project_id', $projectId)
            ->max('updated_at');
    }

    /**
     * Count files by project ID.
     */
    public function countFilesByProjectId(int $projectId): int
    {
        return $this->model::query()
            ->where('project_id', $projectId)
            ->where('storage_type', StorageType::WORKSPACE->value)
            ->where('is_hidden', false)
            ->whereNull('deleted_at')
            ->count();
    }

    /**
     * Parent map of the project-space files the fork enumeration can see
     * (space_type=project, visible, not deleted). Used to compute which files
     * still have a valid ancestor chain up to the project root.
     *
     * @return array<int, null|int> [file_id => parent_id]
     */
    public function getVisibleProjectFileParentMap(int $projectId): array
    {
        $rows = $this->model::query()
            ->where('project_id', $projectId)
            ->where('space_type', FileSpaceType::PROJECT->value)
            ->where('is_hidden', false)
            ->whereNull('deleted_at')
            ->get(['file_id', 'parent_id']);

        $map = [];
        foreach ($rows as $row) {
            $map[(int) $row->file_id] = $row->parent_id === null ? null : (int) $row->parent_id;
        }

        return $map;
    }

    /**
     * Count attachments by project ID using the V2 list endpoint semantics:
     * workspace storage + not deleted. No is_hidden filter and no root-row
     * trimming. Used by the V2 count endpoint so the returned total matches
     * what the V2 list endpoint would emit when called without file_type.
     */
    public function countAttachmentsByProjectIdV2(int $projectId): int
    {
        return $this->model::query()
            ->where('project_id', $projectId)
            ->where('storage_type', StorageType::WORKSPACE->value)
            ->whereNull('deleted_at')
            ->count();
    }

    /**
     * Append the smallest event for a completed before/after mutation.
     *
     * This public seam is intentionally tiny: callers that perform related
     * metadata-version updates in one transaction can suppress the automatic
     * repository event, re-read the final row, and publish one snapshot that
     * is guaranteed to carry the final metadata_version.
     */
    public function appendFileTreeMutation(
        ?TaskFileEntity $before,
        ?TaskFileEntity $after,
        ?string $operation = null
    ): void {
        $this->recordFileTreeMutation($before, $after, $operation);
    }

    public function appendFileTreeChange(
        TaskFileEntity $file,
        string $operation,
        ?int $oldParentId = null,
        ?string $oldName = null,
        ?int $rootFileId = null
    ): int {
        $revisions = $this->appendFileTreeChanges([[
            'root_file_id' => $rootFileId ?? $this->resolveFileTreeRootId($file),
            'file' => $file,
            'operation' => $operation,
            'old_parent_id' => $oldParentId,
            'old_name' => $oldName,
        ]]);

        return (int) ($revisions[0] ?? 0);
    }

    public function getFileTreeChanges(TaskFileEntity $rootFile, int $sinceRevision, int $limit): array
    {
        return $this->getFileTreeChangeFeed($rootFile, $sinceRevision, $limit)['rows'];
    }

    public function getFileTreeRevision(TaskFileEntity $rootFile): int
    {
        // Directory-page revisions are rooted at the mounted tree, even when
        // the page itself belongs to a descendant directory. The change-feed
        // entry point still requires the supplied entity to resolve to the
        // physical root row.
        $row = $this->getFileTreeHeadRow($this->requireFileTreeRootId($rootFile));
        return (int) $row['revision'];
    }

    /**
     * @return array{
     *     rows: array<int, array<string, mixed>>,
     *     head: int,
     *     oldest: int,
     *     cursor_expired: bool
     * }
     */
    public function getFileTreeChangeFeed(TaskFileEntity $rootFile, int $sinceRevision, int $limit): array
    {
        $sinceRevision = max(0, $sinceRevision);
        $rootFileId = $this->requireFileTreeRootId($rootFile, true);
        $headRow = $this->getFileTreeHeadRow($rootFileId);
        $head = (int) $headRow['revision'];
        $oldest = (int) $headRow['oldest_revision'];

        $cursorExpired = $oldest > 1 && $sinceRevision < $oldest - 1;
        if ($limit <= 0 || $cursorExpired) {
            return [
                'rows' => [],
                'head' => $head,
                'oldest' => $oldest,
                'cursor_expired' => $cursorExpired,
            ];
        }

        $query = $this->buildFileTreeChangeQuery($rootFileId)
            ->where('revision', '>', $sinceRevision)
            ->orderBy('revision', 'ASC')
            // Callers ask for one look-ahead row to expose has_more.  The
            // public API caps a page at 1000, so the repository must allow
            // 1001 here; capping at 1000 would make a full 1000-row page
            // incorrectly report has_more=false.
            ->limit(min($limit, 1001));

        return [
            'rows' => Db::select($query->toSql(), $query->getBindings()),
            'head' => $head,
            'oldest' => $oldest,
            'cursor_expired' => false,
        ];
    }

    /**
     * Compact the durable MagicFS journal without taking a global table lock.
     * Each root head is processed independently and locked in its own
     * short transaction, so writers for unrelated projects continue while a
     * large file tree is being compacted. Revisions are never renumbered:
     * deleting the prefix and advancing oldest_revision is what makes stale
     * cursors fail closed.
     *
     * @return array{file_trees:int, deleted_rows:int, expired_file_trees:int}
     */
    public function compactFileTreeChangeJournal(
        int $keepRevisions = 100000,
        int $batchSize = 1000,
        bool $dryRun = false
    ): array {
        $keepRevisions = max(1, $keepRevisions);
        $batchSize = max(1, min($batchSize, 10000));
        $fileTrees = 0;
        $deletedRows = 0;
        $expiredFileTrees = 0;
        $lastRootFileId = 0;

        while (true) {
            $heads = Db::table(self::FILE_TREE_HEADS_TABLE)
                ->where('root_file_id', '>', $lastRootFileId)
                ->orderBy('root_file_id', 'ASC')
                ->limit(200)
                ->get();
            if ($heads->isEmpty()) {
                break;
            }

            foreach ($heads as $headRow) {
                // Raw rows are assoc arrays here, never objects.
                $headRow = (array) $headRow;
                $rootFileId = (int) ($headRow['root_file_id'] ?? 0);
                $lastRootFileId = $rootFileId;
                ++$fileTrees;

                $result = $this->compactFileTree(
                    $rootFileId,
                    $keepRevisions,
                    $batchSize,
                    $dryRun
                );
                $deletedRows += $result['deleted_rows'];
                if ($result['cursor_expired']) {
                    ++$expiredFileTrees;
                }
            }
        }

        return [
            'file_trees' => $fileTrees,
            'deleted_rows' => $deletedRows,
            'expired_file_trees' => $expiredFileTrees,
        ];
    }

    /**
     * Batch count files by project IDs.
     *
     * @param array $projectIds Project ID array
     * @return array<int, int> [project_id => file_count] mapping array
     */
    public function countFilesByProjectIds(array $projectIds): array
    {
        if (empty($projectIds)) {
            return [];
        }

        // 转换为整数数组并去重
        $projectIds = array_unique(array_map('intval', $projectIds));
        $projectIds = array_filter($projectIds, fn ($id) => $id > 0);

        if (empty($projectIds)) {
            return [];
        }

        // 使用 GROUP BY 和 COUNT 一次性查询所有项目的文件数量
        // 修复：只统计文件，不统计文件夹（is_directory=false）
        $results = $this->model::query()
            ->selectRaw('project_id, COUNT(*) as file_count')
            ->whereIn('project_id', $projectIds)
            ->where('storage_type', StorageType::WORKSPACE->value)
            ->where('is_hidden', false)
            ->where('is_directory', false)  // 只统计文件，不统计文件夹
            ->whereNull('deleted_at')
            ->groupBy('project_id')
            ->get();

        // 转换为数组格式 [project_id => count]
        $countMap = [];
        foreach ($results as $result) {
            $countMap[(int) $result->project_id] = (int) $result->file_count;
        }

        // 补齐没有文件的项目（返回0）
        foreach ($projectIds as $projectId) {
            if (! isset($countMap[$projectId])) {
                $countMap[$projectId] = 0;
            }
        }

        return $countMap;
    }

    /**
     * 统计项目空间文件数量，最多统计到 $limit 即提前返回（大表场景避免全量 COUNT）.
     * 只取 file_id 单列并跳过实体水合；按 space_type='project' + storage_type='workspace'
     * 双重口径统计（防历史数据两字段不一致），包含隐藏文件与目录行。
     */
    public function countProjectFilesWithLimit(int $projectId, int $limit): int
    {
        $query = $this->model::query()
            ->select(['file_id'])
            ->where('project_id', $projectId)
            ->projectSpace()
            ->whereNull('deleted_at')
            ->limit($limit);

        return count(Db::select($query->toSql(), $query->getBindings()));
    }

    public function countProjectFiles(int $projectId): int
    {
        return $this->model::query()
            ->where('project_id', $projectId)
            ->projectSpace()
            ->whereNull('deleted_at')
            ->count('file_id');
    }

    /**
     * 统计用户空间文件数量，最多统计到 $limit 即提前返回（大表场景避免全量 COUNT）.
     * 只取 file_id 单列并跳过实体水合；按 space_type='user' + storage_type='user'
     * 双重口径统计（防历史数据两字段不一致），依赖 idx_user_id 索引命中即停。
     */
    public function countUserSpaceFilesWithLimit(string $userId, string $organizationCode, int $limit): int
    {
        $query = $this->model::query()
            ->select(['file_id'])
            ->where('user_id', $userId)
            ->where('organization_code', $organizationCode)
            ->where('space_type', FileSpaceType::USER->value)
            ->where('storage_type', StorageType::USER->value)
            ->whereNull('deleted_at')
            ->limit($limit);

        return count(Db::select($query->toSql(), $query->getBindings()));
    }

    public function countUserSpaceFiles(string $userId, string $organizationCode): int
    {
        return $this->model::query()
            ->where('user_id', $userId)
            ->where('organization_code', $organizationCode)
            ->where('space_type', FileSpaceType::USER->value)
            ->where('storage_type', StorageType::USER->value)
            ->whereNull('deleted_at')
            ->count('file_id');
    }

    /**
     * Get files by project ID with resume support.
     * Used for fork migration with pagination and resume capability.
     */
    public function getFilesByProjectIdWithResume(int $projectId, ?int $lastFileId, int $limit): array
    {
        $query = $this->model::query()
            ->where('project_id', $projectId)
            ->where('storage_type', StorageType::WORKSPACE->value)
            ->where('is_hidden', false)
            ->whereNull('deleted_at')
            ->orderBy('file_id', 'asc')
            ->limit($limit);

        // Support resume from last file ID
        if ($lastFileId !== null) {
            $query->where('file_id', '>', $lastFileId);
        }

        $models = $query->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = new TaskFileEntity($model->toArray());
        }

        return $entities;
    }

    /**
     * Batch update parent_id for multiple files.
     * Used for fixing parent relationships during fork operations.
     */
    public function batchUpdateParentId(array $fileIds, int $parentId, string $userId): int
    {
        if (empty($fileIds)) {
            return 0;
        }

        return Db::transaction(function () use ($fileIds, $parentId): int {
            $beforeModels = $this->model::query()
                ->whereIn('file_id', $fileIds)
                ->whereNull('deleted_at')
                ->lockForUpdate()
                ->orderBy('file_id', 'ASC')
                ->get();
            if ($beforeModels->isEmpty()) {
                return 0;
            }

            if ($parentId > 0) {
                $this->resolveParentChainRootId($parentId);
            }

            $updatedAt = date('Y-m-d H:i:s');
            $affected = 0;
            foreach ($beforeModels as $beforeModel) {
                $affected += (int) $this->model::query()
                    ->where('file_id', $beforeModel->file_id)
                    ->update([
                        'parent_id' => $parentId,
                        'updated_at' => $updatedAt,
                    ]);
            }
            $afterModels = $this->model::query()->whereIn('file_id', $fileIds)->get()->keyBy('file_id');
            $pending = [];
            $parentRootIds = [];
            foreach ($beforeModels as $beforeModel) {
                $afterModel = $afterModels->get($beforeModel->file_id);
                $this->recordFileTreeMutation(
                    new TaskFileEntity($beforeModel->toArray()),
                    $afterModel ? new TaskFileEntity($afterModel->toArray()) : null,
                    'move',
                    null,
                    null,
                    $pending,
                    parentRootIds: $parentRootIds
                );
            }
            $this->appendFileTreeChanges($pending);
            return $affected;
        });
    }

    public function lockDirectChildrenForUpdate(int $parentId): array
    {
        return $this->model::query()
            ->where('parent_id', $parentId)
            ->orderBy('sort', 'ASC')
            ->orderBy('file_id', 'ASC')
            ->lockForUpdate()
            ->get()
            ->toArray();
    }

    public function getAllChildrenByParentId(int $parentId): array
    {
        return $this->model::query()
            ->where('parent_id', $parentId)
            ->orderBy('sort', 'ASC')
            ->orderBy('file_id', 'ASC')
            ->get()
            ->toArray();
    }

    /**
     * 恢复被删除的文件.
     */
    public function restoreFile(int $fileId, bool $emitJournal = true): void
    {
        Db::transaction(function () use ($fileId, $emitJournal): void {
            $before = $this->getByIdWithTrash($fileId);
            /* @phpstan-ignore-next-line - TaskFileModel uses SoftDeletes trait which provides withTrashed() and restore() */
            $this->model::withTrashed()
                ->where('file_id', $fileId)
                ->restore();
            $after = $this->getById($fileId);
            if ($emitJournal && $before?->getDeletedAt() !== null && $after !== null) {
                $this->recordFileTreeMutation($before, $after, 'restore');
            }
        });
    }

    /**
     * 递增指定文件的版本号（原子操作）.
     */
    public function incrementVersionById(int $fileId): int
    {
        return Db::transaction(function () use ($fileId): int {
            $before = $this->getById($fileId);
            $now = date('Y-m-d H:i:s');

            // 使用原子操作递增版本号
            $this->model::query()
                ->where('file_id', $fileId)
                ->whereNull('deleted_at')
                ->update([
                    'latest_version' => Db::raw('latest_version + 1'),
                    'updated_at' => $now,
                ]);

            $after = $this->getById($fileId);
            $this->recordFileTreeMutation($before, $after, 'update');

            return (int) ($after?->getLatestVersion() ?? 1);
        });
    }

    /**
     * 更新指定文件的最新内容版本号.
     */
    public function updateLatestVersionById(int $fileId, int $latestVersion): void
    {
        Db::transaction(function () use ($fileId, $latestVersion): void {
            $before = $this->getById($fileId);
            $this->model::query()
                ->where('file_id', $fileId)
                ->whereNull('deleted_at')
                ->update([
                    'latest_version' => $latestVersion,
                    'updated_at' => date('Y-m-d H:i:s'),
                ]);
            $after = $this->getById($fileId);
            $this->recordFileTreeMutation($before, $after, 'update');
        });
    }

    /**
     * 批量获取文件版本号.
     */
    public function getVersionsByIds(array $fileIds): array
    {
        if (empty($fileIds)) {
            return [];
        }

        $results = $this->model::query()
            ->select(['file_id', 'latest_version'])
            ->whereIn('file_id', $fileIds)
            ->whereNull('deleted_at')
            ->get();

        $versions = [];
        foreach ($results as $result) {
            $versions[(string) $result->file_id] = (int) ($result->latest_version ?? 1);
        }

        return $versions;
    }

    /**
     * Advance the metadata version of the given nodes.
     *
     * # This is cache invalidation, not a change event
     *
     * A metadata version is a node's cache key: a reader that cached the node
     * compares versions to decide whether its copy is stale, so the server must
     * move the version whenever a node's representation changes. Telling
     * subscribers *what* changed is the journal's job, and the two acts are not
     * the same one.
     *
     * Deriving a journal row from a version bump is what made the feed's size a
     * function of tree depth: every create/delete/move bumped its whole ancestor
     * chain and announced each level, so one file written at depth ten produced
     * eleven rows, roughly two thirds of a busy tree's journal was directory
     * bookkeeping, and a reader that could not name a single one of those rows
     * had to discard the whole delta — while the information they carried ("this
     * directory's listing changed") is derivable from the child row's
     * `parent_id`, which every mutation already publishes.
     *
     * Rows therefore come from the mutation itself: insert / update / delete /
     * move / restore each append exactly one self-describing row for the node
     * they changed (see appendFileTreeChange). Nothing here writes a row.
     *
     * @param array<null|int|string> $fileIds
     * @return int rows whose version actually advanced
     */
    public function bumpMetadataVersions(array $fileIds): int
    {
        $ids = array_values(array_unique(array_filter(
            array_map('intval', $fileIds),
            static fn (int $id): bool => $id > 0
        )));
        if ($ids === []) {
            return 0;
        }

        // One statement, no lock: the increment is atomic, and there is no
        // longer a before/after image to read for a journal row. Removing the
        // SELECT ... FOR UPDATE also removes the contention it created on hot
        // directories, where every sibling write queued behind the same rows.
        return $this->model::query()
            ->whereIn('file_id', $ids)
            ->whereNull('deleted_at')
            ->update([
                'metadata_version' => Db::raw('metadata_version + 1'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
    }

    /**
     * 批量获取文件元数据版本号.
     * 用于 MagicFS 客户端检查缓存是否失效.
     */
    public function getMetadataVersionsByIds(array $fileIds): array
    {
        if (empty($fileIds)) {
            return [];
        }

        $results = $this->model::query()
            ->select(['file_id', 'metadata_version'])
            ->whereIn('file_id', $fileIds)
            ->whereNull('deleted_at')
            ->get();

        $versions = [];
        foreach ($results as $result) {
            $versions[(string) $result->file_id] = (int) ($result->metadata_version ?? 1);
        }

        return $versions;
    }

    /**
     * 递归获取文件及其所有父级文件.
     * 用于确保构建文件树时包含完整的父子关系链.
     */
    public function getFilesWithParentsByIds(array $fileIds, int $projectId = 0): array
    {
        if (empty($fileIds)) {
            return [];
        }

        // 获取初始文件列表
        $entities = $this->getFilesByIds($fileIds, $projectId);
        if (empty($entities)) {
            return [];
        }

        // 使用 file_id 作为键，避免重复
        $entityMap = [];
        foreach ($entities as $entity) {
            $entityMap[$entity->getFileId()] = $entity;
        }

        // 收集所有需要查找的父级ID
        $parentIdsToFind = [];
        foreach ($entities as $entity) {
            $parentId = $entity->getParentId();
            if ($parentId > 0 && ! isset($entityMap[$parentId])) {
                $parentIdsToFind[$parentId] = $parentId;
            }
        }

        // 递归查找所有父级文件
        while (! empty($parentIdsToFind)) {
            $foundParents = $this->getFilesByIds(array_values($parentIdsToFind), $projectId);
            $newParentIds = [];

            foreach ($foundParents as $parentEntity) {
                $parentId = $parentEntity->getFileId();
                if (! isset($entityMap[$parentId])) {
                    $entityMap[$parentId] = $parentEntity;
                    // 继续查找父级的父级
                    $grandParentId = $parentEntity->getParentId();
                    if ($grandParentId > 0 && ! isset($entityMap[$grandParentId])) {
                        $newParentIds[$grandParentId] = $grandParentId;
                    }
                }
            }

            $parentIdsToFind = $newParentIds;
        }

        return array_values($entityMap);
    }

    /**
     * 递归获取目录的所有子文件ID.
     * 使用广度优先遍历，逐层查询，避免深度递归.
     *
     * @param array $directoryIds 目录ID数组
     * @param int $projectId 项目ID
     * @param int $maxDepth 最大递归深度，防止无限递归
     * @param bool $includeDirectories 是否在结果中包含子目录ID（默认不包含，仅返回文件ID）
     * @return array 所有子文件的ID数组
     */
    public function getAllChildrenFileIdsByDirectoryIds(array $directoryIds, int $projectId, int $maxDepth = 10, bool $includeDirectories = false): array
    {
        if (empty($directoryIds)) {
            return [];
        }

        $allChildFileIds = [];
        $processedDirectoryIds = [];

        // 使用队列方式递归查询，避免深度递归
        $currentLevelParentIds = $directoryIds;

        // 广度优先遍历，逐层查询
        for ($depth = 0; $depth < $maxDepth && ! empty($currentLevelParentIds); ++$depth) {
            // 批量查询当前层所有父目录的子项（一次 SQL 查询，避免 N+1 问题）
            $children = $this->getChildrenByParentIdsAndProject(
                $projectId,
                $currentLevelParentIds,
                10000 // 设置较大的限制，确保获取所有子文件
            );

            if (empty($children)) {
                break;
            }

            $nextLevelParentIds = [];
            foreach ($children as $child) {
                $childId = $child->getFileId();

                // 修复：只统计文件，不统计文件夹
                if ($child->getIsDirectory()) {
                    // 如果是目录，加入下一层的查询队列继续遍历
                    if (! in_array($childId, $processedDirectoryIds)) {
                        $nextLevelParentIds[] = $childId;
                        $processedDirectoryIds[] = $childId;
                        // 拷贝等场景需要保留目录结构时，把目录ID也计入结果
                        if ($includeDirectories) {
                            $allChildFileIds[] = $childId;
                        }
                    }
                } else {
                    // 只有文件才计入结果
                    $allChildFileIds[] = $childId;
                }
            }

            $currentLevelParentIds = $nextLevelParentIds;
        }

        return array_unique($allChildFileIds);
    }

    public function getAllDescendantIds(int $parentId, int $projectId = 0, int $maxDepth = 100): array
    {
        $allIds = [];
        $currentLevelParentIds = [$parentId];

        for ($depth = 0; $depth < $maxDepth && ! empty($currentLevelParentIds); ++$depth) {
            $query = $this->model::query()
                ->whereIn('parent_id', $currentLevelParentIds)
                ->whereNull('deleted_at');

            if ($projectId > 0) {
                $query->where('project_id', $projectId);
            }

            // 只取两列，没必要为每行建一个 Eloquent 模型：5000 行的 BFS 实测模型水合要 143ms CPU，
            // 直接读原始行只要个位数毫秒。行形状用 (array) 归一（框架默认 FETCH_OBJ，
            // App\Listener\FetchModeListener 会改成 FETCH_ASSOC），列名由下面的 select 确定。
            $scoped = $query->select(['file_id', 'is_directory'])->toBase();
            $children = $this->model->getConnection()->select($scoped->toSql(), $scoped->getBindings());

            if ($children === []) {
                break;
            }

            $nextLevelParentIds = [];
            foreach ($children as $child) {
                $child = (array) $child;
                $fileId = (int) ($child['file_id'] ?? 0);
                $allIds[] = $fileId;
                if ((bool) ($child['is_directory'] ?? false)) {
                    $nextLevelParentIds[] = $fileId;
                }
            }

            $currentLevelParentIds = $nextLevelParentIds;
        }

        return $allIds;
    }

    /**
     * Transfer ownership of all files in a project.
     */
    public function transferOwnership(int $projectId, string $fromUserId, string $toUserId): int
    {
        return Db::transaction(function () use ($projectId, $fromUserId, $toUserId): int {
            $beforeModels = $this->model::query()
                ->where('project_id', $projectId)
                ->where('user_id', $fromUserId)
                ->get();
            $affected = $this->model::query()
                ->where('project_id', $projectId)
                ->where('user_id', $fromUserId)
                ->update([
                    'user_id' => $toUserId,
                    'updated_at' => date('Y-m-d H:i:s'),
                ]);
            $ids = $beforeModels->pluck('file_id')->all();
            $afterModels = $this->model::query()->whereIn('file_id', $ids)->get()->keyBy('file_id');
            $pending = [];
            $parentRootIds = [];
            foreach ($beforeModels as $beforeModel) {
                $afterModel = $afterModels->get($beforeModel->file_id);
                $this->recordFileTreeMutation(
                    new TaskFileEntity($beforeModel->toArray()),
                    $afterModel ? new TaskFileEntity($afterModel->toArray()) : null,
                    null,
                    null,
                    null,
                    $pending,
                    parentRootIds: $parentRootIds
                );
            }
            $this->appendFileTreeChanges($pending);
            return $affected;
        });
    }

    /**
     * 根据项目ID和空间类型获取根节点文件.
     *
     * @param int $projectId 项目ID
     * @param string $spaceType 空间类型，默认 project 空间
     * @return null|TaskFileEntity 根节点文件实体
     */
    public function getRootFileByProjectId(int $projectId, string $spaceType = FileSpaceType::PROJECT->value): ?TaskFileEntity
    {
        $model = $this->model::query()
            ->where('project_id', $projectId)
            ->whereNull('parent_id')
            ->where('is_directory', true)
            ->where('space_type', $spaceType)
            ->first();

        if (! $model) {
            return null;
        }

        return new TaskFileEntity($model->toArray());
    }

    public function existsByProjectIdAndFileName(int $projectId, string $fileName): bool
    {
        return $this->model::query()
            ->where('project_id', $projectId)
            ->where('file_name', $fileName)
            ->whereNull('deleted_at')
            ->exists();
    }

    /**
     * Find workspace root directory by project ID.
     * The root directory is identified by parent_id, file_name, is_directory
     * and storage_type; its file_id is the durable file-tree identity.
     */
    public function findRootDirectoryByProjectId(int $projectId): ?TaskFileEntity
    {
        $model = $this->model::query()
            ->where('project_id', $projectId)
            ->whereNull('parent_id')
            ->where('file_name', '/')
            ->where('is_directory', true)
            ->where('storage_type', StorageType::WORKSPACE->value)
            ->orderBy('file_id', 'asc')
            ->first();

        if (! $model) {
            return null;
        }

        return new TaskFileEntity($model->toArray());
    }

    /**
     * 查找用户空间的根目录.
     * 通过 user_id + organization_code + space_type='user' + parent_id IS NULL 定位.
     */
    public function findUserSpaceRootDirectory(string $userId, string $organizationCode): ?TaskFileEntity
    {
        $model = $this->model::query()
            ->where('user_id', $userId)
            ->where('organization_code', $organizationCode)
            ->where('space_type', FileSpaceType::USER->value)
            ->whereNull('parent_id')
            ->where('file_name', '/')
            ->where('is_directory', true)
            ->orderBy('file_id', 'asc')
            ->first();

        if (! $model) {
            return null;
        }

        return new TaskFileEntity($model->toArray());
    }

    public function findTopicSpaceRootDirectory(int $projectId, int $topicId, string $organizationCode): ?TaskFileEntity
    {
        $model = $this->model::query()
            ->where('organization_code', $organizationCode)
            ->where('project_id', $projectId)
            ->where('topic_id', $topicId)
            ->where('space_type', FileSpaceType::TOPIC->value)
            ->where('storage_type', StorageType::TOPIC->value)
            // 不过滤 file_name：根目录名已从固定 `.topic` 改为 `topic_{topic_id}`，
            // 去掉该条件可同时兼容存量 `.topic` 行，避免重复创建根目录。
            ->whereNull('parent_id')
            ->where('is_directory', true)
            ->whereNull('deleted_at')
            ->orderBy('file_id', 'asc')
            ->first();

        return $model ? new TaskFileEntity($model->toArray()) : null;
    }

    public function getTopicFilesByCursor(int $topicId, int $rootFileId, ?int $afterFileId, int $limit): array
    {
        $query = $this->model::query()
            ->where('topic_id', $topicId)
            ->where('space_type', FileSpaceType::TOPIC->value)
            ->where('storage_type', StorageType::TOPIC->value)
            ->where('file_id', '!=', $rootFileId)
            ->whereNull('deleted_at')
            ->orderBy('file_id', 'asc')
            ->limit($limit);

        if ($afterFileId !== null && $afterFileId > 0) {
            $query->where('file_id', '>', $afterFileId);
        }

        return $query->get()->map(fn ($model) => new TaskFileEntity($model->toArray()))->all();
    }

    public function countTopicFilesForCopy(int $topicId, int $rootFileId): int
    {
        return $this->model::query()
            ->where('topic_id', $topicId)
            ->where('space_type', FileSpaceType::TOPIC->value)
            ->where('storage_type', StorageType::TOPIC->value)
            ->where('file_id', '!=', $rootFileId)
            ->whereNull('deleted_at')
            ->count();
    }

    /**
     * Batch update is_hidden field for given file IDs.
     */
    public function batchUpdateIsHidden(array $fileIds, bool $isHidden, ?string $updatedAt = null): int
    {
        if (empty($fileIds)) {
            return 0;
        }

        return Db::transaction(function () use ($fileIds, $isHidden, $updatedAt): int {
            $beforeModels = $this->model::query()
                ->whereIn('file_id', $fileIds)
                ->where('is_hidden', '!=', $isHidden)
                ->whereNull('deleted_at')
                ->get();
            if ($beforeModels->isEmpty()) {
                return 0;
            }
            $ids = $beforeModels->pluck('file_id')->all();
            $affected = $this->model::query()
                ->whereIn('file_id', $ids)
                ->where('is_hidden', '!=', $isHidden)
                ->whereNull('deleted_at')
                ->update([
                    'is_hidden' => $isHidden,
                    'updated_at' => $updatedAt ?? date('Y-m-d H:i:s'),
                ]);
            $afterModels = $this->model::query()->whereIn('file_id', $ids)->get()->keyBy('file_id');
            $pending = [];
            $parentRootIds = [];
            foreach ($beforeModels as $beforeModel) {
                $afterModel = $afterModels->get($beforeModel->file_id);
                $this->recordFileTreeMutation(
                    new TaskFileEntity($beforeModel->toArray()),
                    $afterModel ? new TaskFileEntity($afterModel->toArray()) : null,
                    null,
                    null,
                    null,
                    $pending,
                    parentRootIds: $parentRootIds
                );
            }
            $this->appendFileTreeChanges($pending);
            return $affected;
        });
    }

    /**
     * Get existing file names under a parent directory, filtered by provided names.
     */
    public function getExistingFileNamesByParentId(int $parentId, array $fileNames): array
    {
        if (empty($fileNames)) {
            return [];
        }

        return $this->model::query()
            ->select(['file_name'])
            ->where('parent_id', $parentId)
            ->whereIn('file_name', $fileNames)
            ->whereNull('deleted_at')
            ->pluck('file_name')
            ->toArray();
    }

    /**
     * Batch insert WAV file records under a specific parent directory.
     */
    public function batchInsertWavFiles(DataIsolation $dataIsolation, int $projectId, int $parentId, array $wavFiles): void
    {
        if (empty($wavFiles)) {
            return;
        }

        $insertData = [];
        $now = date('Y-m-d H:i:s');

        foreach ($wavFiles as $fileInfo) {
            $insertData[] = [
                'file_id' => IdGenerator::getSnowId(),
                'user_id' => $dataIsolation->getCurrentUserId(),
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                'project_id' => $projectId,
                'source_file_id' => null,
                'topic_id' => 0,
                'task_id' => 0,
                'parent_id' => $parentId,
                'file_key' => $fileInfo['file_key'],
                'file_name' => $fileInfo['file_name'],
                'file_extension' => pathinfo($fileInfo['file_name'], PATHINFO_EXTENSION),
                'file_type' => 'auto_sync',
                'file_size' => $fileInfo['file_size'] ?? 0,
                'storage_type' => 'workspace',
                'is_hidden' => false,
                'is_directory' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        Db::transaction(function () use ($insertData): void {
            $this->model::query()->insert($insertData);
            $ids = array_column($insertData, 'file_id');
            $models = $this->model::query()->whereIn('file_id', $ids)->get();
            $pending = [];
            $parentRootIds = [];
            foreach ($models as $model) {
                $this->recordFileTreeMutation(null, new TaskFileEntity($model->toArray()), 'create', null, null, $pending, parentRootIds: $parentRootIds);
            }
            $this->appendFileTreeChanges($pending);
        });
    }

    /**
     * Resolve a file's current file-tree root by following parent_id links.
     * This is intentionally an ancestor-only query: moving a directory never
     * requires touching or scanning its descendants.
     *
     * @param null|array<int, int> $parentRootIds roots resolved within one unchanged parent-chain phase
     */
    private function resolveFileTreeRootId(TaskFileEntity $file, ?array &$parentRootIds = null): int
    {
        if (! $this->shouldJournalFileTree($file)) {
            throw new RuntimeException(sprintf(
                'File %d does not belong to a journaled file tree',
                $file->getFileId()
            ));
        }

        $parentId = $file->getParentId();
        if ($parentRootIds !== null && $parentId !== null && $parentId > 0) {
            return $parentRootIds[$parentId] ??= $this->resolveRootIdFromParentChain($file);
        }

        return $this->resolveRootIdFromParentChain($file);
    }

    /**
     * Resolve the physical root using parent_id only.
     *
     * This helper deliberately does not inspect the row's denormalized space
     * columns.  They are useful for legacy queries, but are not a stable tree
     * identity after a directory is moved between projects or spaces.
     */
    private function resolveRootIdFromParentChain(TaskFileEntity $file): int
    {
        $parentId = $file->getParentId();
        if ($parentId === null || $parentId <= 0) {
            if (! $file->getIsDirectory()) {
                throw new RuntimeException(sprintf(
                    'File-tree entry %d has no parent and is not a directory root',
                    $file->getFileId()
                ));
            }
            return $file->getFileId();
        }

        return $this->resolveParentChainRootId($parentId);
    }

    /**
     * Resolve a root without recursive CTE materialization. Multi-row walks
     * are verified in one read view before accepting either a root or an error.
     * Deleted ancestors are included because delete/restore mutations must
     * retain the root that was valid at the time of the mutation.
     */
    private function resolveParentChainRootId(int $parentId): int
    {
        $currentId = $parentId;
        $observedRows = [];
        $root = null;

        // Depth zero is the supplied parent. The observed map detects cycles.
        for ($depth = 0; $depth <= self::MAX_FILE_TREE_DEPTH; ++$depth) {
            if (array_key_exists($currentId, $observedRows)) {
                break;
            }

            $rows = Db::select(
                'SELECT file_id, parent_id, is_directory FROM magic_super_agent_task_files WHERE file_id = ?',
                [$currentId]
            );
            if ($rows === []) {
                if ($depth === 0) {
                    throw new RuntimeException(sprintf(
                        'Parent file %d does not exist while resolving its file-tree root',
                        $parentId
                    ));
                }
                // Missing intermediate nodes must also be verified.
                $observedRows[$currentId] = null;
                break;
            }

            $row = $this->normalizeFileTreeParentRow((array) $rows[0]);
            $observedRows[$currentId] = $row;
            if ($row['parent_id'] === null || $row['parent_id'] === 0) {
                $root = $row;
                break;
            }
            $currentId = $row['parent_id'];
        }

        // A single point read is coherent; longer paths need one read view.
        if (count($observedRows) > 1 && ! $this->fileTreeParentRowsMatch($observedRows)) {
            throw new RuntimeException(sprintf('File-tree parent chain for %d changed while resolving its root', $parentId));
        }
        if ($root === null) {
            throw new RuntimeException(sprintf(
                'File-tree parent chain for %d is cyclic or exceeds depth %d',
                $parentId,
                self::MAX_FILE_TREE_DEPTH
            ));
        }
        if (! $root['is_directory']) {
            throw new RuntimeException(sprintf('File-tree root %d is not a directory', $root['file_id']));
        }
        return $root['file_id'];
    }

    /**
     * @param array<int, null|array{file_id:int,parent_id:?int,is_directory:bool}> $observedRows
     */
    private function fileTreeParentRowsMatch(array $observedRows): bool
    {
        $fileIds = array_keys($observedRows);
        $rows = Db::select(
            'SELECT file_id, parent_id, is_directory FROM magic_super_agent_task_files WHERE file_id IN ('
            . implode(', ', array_fill(0, count($fileIds), '?')) . ')',
            $fileIds
        );
        $currentRows = [];
        foreach ($rows as $row) {
            $row = $this->normalizeFileTreeParentRow((array) $row);
            $currentRows[$row['file_id']] = $row;
        }
        foreach ($observedRows as $fileId => $observedRow) {
            if (($currentRows[$fileId] ?? null) !== $observedRow) {
                return false;
            }
        }
        return true;
    }

    /**
     * @param array<string, mixed> $row
     * @return array{file_id:int,parent_id:?int,is_directory:bool}
     */
    private function normalizeFileTreeParentRow(array $row): array
    {
        $parentId = $row['parent_id'] ?? null;
        return [
            'file_id' => (int) $row['file_id'],
            'parent_id' => $parentId === null ? null : (int) $parentId,
            'is_directory' => (bool) ($row['is_directory'] ?? false),
        ];
    }

    private function isFileTreeRoot(TaskFileEntity $file): bool
    {
        return $this->shouldJournalFileTree($file)
            && $file->getIsDirectory()
            && ($file->getParentId() === null || $file->getParentId() <= 0);
    }

    private function findProjectFileTreeRootId(int $projectId): int
    {
        return (int) ($this->model::query()
            ->where('project_id', $projectId)
            ->where('topic_id', 0)
            ->where('space_type', FileSpaceType::PROJECT->value)
            ->whereNull('parent_id')
            ->whereNull('deleted_at')
            ->where('is_directory', true)
            ->orderBy('file_id', 'asc')
            ->value('file_id') ?? 0);
    }

    /**
     * file_id 由调用方显式赋雪花 ID，不依赖数据库自增（见 TaskFileModel::$incrementing）。
     *
     * 导入、历史调用方可能不带 ID，这里在 PHP 侧补齐：交给数据库自增拿不到生成值，
     * 实体仍带着 0，响应、change journal 和后续按 file_id 的查询都会指向不存在的 ID。
     */
    private function ensureFileId(TaskFileEntity $entity): void
    {
        if ($entity->getFileId() <= 0) {
            $entity->setFileId(IdGenerator::getSnowId());
        }
    }

    /**
     * Read the durable root head, failing closed when the final MagicFS
     * schema/backfill has not been installed.  Returning an all-zero head is
     * unsafe: a mount would look like an empty project and its change cursor
     * could permanently miss mutations.  There is intentionally no fallback
     * to an aggregate scan or the legacy tree endpoint.
     *
     * The head is returned as an assoc array, never as an object: raw rows are
     * arrays in this project (App\Listener\FetchModeListener forces
     * PDO::FETCH_ASSOC), and reading a property off a row silently yields the
     * default instead of the persisted value.
     *
     * @param int $rootFileId the immutable file-tree root ID
     * @return array{root_file_id:mixed,revision:mixed,oldest_revision:mixed,updated_at:mixed}
     */
    private function getFileTreeHeadRow(int $rootFileId): array
    {
        $row = Db::table(self::FILE_TREE_HEADS_TABLE)
            ->where('root_file_id', $rootFileId)
            ->first();
        if ($row === null) {
            throw new RuntimeException(
                sprintf('MagicFS root head is not initialized for root_file_id=%d', $rootFileId)
            );
        }

        return (array) $row;
    }

    private function requireFileTreeRootId(TaskFileEntity $file, bool $requireRootRow = false): int
    {
        $rootFileId = $this->resolveFileTreeRootId($file);
        if ($requireRootRow && $rootFileId !== $file->getFileId()) {
            throw new RuntimeException(sprintf(
                'File %d is not a file-tree root (root_file_id=%d)',
                $file->getFileId(),
                $rootFileId
            ));
        }
        return $rootFileId;
    }

    /**
     * Only rows that can belong to a mounted MagicFS file tree are journaled.
     * Task-file storage also contains transient task attachments; recording
     * those under a synthetic project=0 file tree would grow the feed without
     * helping any mount and could make unrelated cursors appear active.
     *
     * # Which column identifies the tree (and which one must not)
     *
     * `space_type` + `project_id` / `topic_id` are the tree identity: a project
     * tree is (project_id, topic_id = 0), a topic tree is (project_id, topic_id
     * > 0), a user tree is (project_id = 0, user_id). `topic_id` on a project
     * row is therefore *identity*, not "the conversation that wrote it", and a
     * project row carrying a conversation topic belongs to no tree at all.
     *
     * That state used to be produced by the write path itself: sandbox clients
     * (AGFS) attach the pod's `/app/.credentials/metadata.json` to every create
     * request, so `MagicFSFileDomainService::createFile` stamped the *session*
     * topic onto new project rows. This gate then dropped those rows — no
     * error, no row — so a directory created inside a sandbox was never
     * announced to any other mount. Files created under it stayed unlocatable
     * forever, because the only row naming their parent was the one that had
     * been dropped. The write path no longer stamps that column (see
     * createFile), but rows written before that fix still exist, so the gate
     * must not treat the annotation as identity either: a project row with a
     * non-zero topic_id still resolves to a real project tree through its
     * parent chain, and that is what a mount needs.
     *
     * The columns that carry provenance are `task_id`,
     * `latest_modified_topic_id` and `latest_modified_task_id`; nothing here
     * reads them.
     */
    private function shouldJournalFileTree(TaskFileEntity $entity): bool
    {
        return match ($entity->getSpaceType()) {
            // A project tree is identified by its project; topic_id is an
            // annotation on these rows and must not exclude them from the feed.
            FileSpaceType::PROJECT->value => $entity->getProjectId() > 0,
            // A topic tree does need its topic: without one the row has no tree
            // identity to journal under.
            FileSpaceType::TOPIC->value => $entity->getProjectId() > 0 && $entity->getTopicId() > 0,
            // A user tree is identified by its owner; topic_id (if any) is the
            // same kind of annotation as above.
            FileSpaceType::USER->value => $entity->getProjectId() === 0
                && $entity->getUserId() !== ''
                && $entity->getOrganizationCode() !== '',
            default => false,
        };
    }

    /**
     * Compare a row before/after a repository mutation and emit the smallest
     * precise event. Moving across logical roots is represented as
     * delete+create because a root-local cursor cannot cross that boundary
     * safely.
     *
     * @param null|array<int, int> $parentRootIds operation-local roots; discard after changing parent links
     */
    private function recordFileTreeMutation(
        ?TaskFileEntity $before,
        ?TaskFileEntity $after,
        ?string $operation = null,
        ?int $oldParentId = null,
        ?string $oldName = null,
        ?array &$pending = null,
        ?int $beforeRootFileId = null,
        ?int $afterRootFileId = null,
        ?array &$parentRootIds = null
    ): void {
        if ($before !== null && ! $this->shouldJournalFileTree($before)) {
            $before = null;
        }
        if ($after !== null && ! $this->shouldJournalFileTree($after)) {
            $after = null;
        }
        if ($before === null && $after === null) {
            return;
        }

        $beforeActive = $before !== null && $before->getDeletedAt() === null;
        $afterActive = $after !== null && $after->getDeletedAt() === null;

        // A physical purge of an already soft-deleted row, or an update that
        // leaves a row deleted, does not change any mounted file tree. Do not
        // advance the cursor for either case.
        if (! $beforeActive && ! $afterActive) {
            return;
        }

        // Reuse queries within this stable read phase, including before/after
        // images with the same parent. Never seed this map from a before-root
        // override: it may have been captured before an ancestor was moved.
        $parentRootIds ??= [];
        $beforeRootFileId ??= $before === null ? null : $this->resolveFileTreeRootId($before, $parentRootIds);
        $afterRootFileId ??= $after === null ? null : $this->resolveFileTreeRootId($after, $parentRootIds);

        if ($beforeActive && $afterActive && $before !== null && $after !== null
            && $this->isFileTreeRoot($before)
            && $before->getParentId() !== $after->getParentId()) {
            throw new RuntimeException(sprintf(
                'MagicFS file-tree root %d cannot be moved',
                $before->getFileId()
            ));
        }

        // A file-tree crossing is represented as delete+create. This branch
        // is reached only for active images; deleted rows were handled above.
        if ($beforeActive && $afterActive
            && $before !== null && $after !== null
            && $beforeRootFileId !== $afterRootFileId) {
            $this->queueFileTreeMutationEvent(
                $pending,
                $before,
                (int) $beforeRootFileId,
                'delete',
                $before->getParentId(),
                $before->getFileName()
            );
            $this->queueFileTreeMutationEvent($pending, $after, (int) $afterRootFileId, 'create');
            return;
        }

        // For a soft-delete update, publish the last active image rather than
        // the deleted row.  For a restore, publish the newly active image.
        $file = $afterActive ? $after : $before;
        if ($file === null) {
            return;
        }

        $rootFileId = $afterActive ? $afterRootFileId : $beforeRootFileId;
        if ($rootFileId === null || $rootFileId <= 0) {
            throw new RuntimeException(sprintf(
                'Cannot journal file %d without a file-tree root',
                $file->getFileId()
            ));
        }

        if (! $beforeActive && $afterActive) {
            // A null before-image is a newly-created row, not a restore.  The
            // distinction is observable by the durable feed consumers (and
            // affects their counter/reconciliation semantics), so only an
            // existing soft-deleted row may produce a restore event.
            $operation = $before === null ? 'create' : 'restore';
        } elseif (! $afterActive) {
            $operation = 'delete';
        } elseif ($operation === null) {
            if ($before->getParentId() !== $after->getParentId()
                || $before->getFileName() !== $after->getFileName()) {
                $operation = 'move';
            } else {
                $operation = 'update';
            }
        }

        $this->queueFileTreeMutationEvent(
            $pending,
            $file,
            $rootFileId,
            $operation,
            $oldParentId ?? ($beforeActive ? $before?->getParentId() : null),
            $oldName ?? ($beforeActive ? $before?->getFileName() : null)
        );
    }

    /**
     * Queue an event for a surrounding bulk mutation, or persist it
     * immediately for the ordinary single-row path.
     *
     * @param null|array<int, array{root_file_id:int,file:TaskFileEntity,operation:string,old_parent_id:?int,old_name:?string}> $pending
     */
    private function queueFileTreeMutationEvent(
        ?array &$pending,
        TaskFileEntity $file,
        int $rootFileId,
        string $operation,
        ?int $oldParentId = null,
        ?string $oldName = null
    ): void {
        if ($pending !== null) {
            $pending[] = [
                'root_file_id' => $rootFileId,
                'file' => $file,
                'operation' => $operation,
                'old_parent_id' => $oldParentId,
                'old_name' => $oldName,
            ];
            return;
        }

        $this->appendFileTreeChange($file, $operation, $oldParentId, $oldName, $rootFileId);
    }

    /**
     * Allocate and insert several root-local events in one transaction.
     *
     * Batch file imports/deletes can contain tens of thousands of rows. The
     * old per-row path locked and updated the file-tree head for every event,
     * turning journal bookkeeping into the dominant cost. Events are grouped
     * by logical root here, each head is locked once, and journal rows are
     * bulk inserted in bounded chunks. Revisions remain strictly ordered
     * within a root_file_id and the returned list preserves event order.
     *
     * @param array<int, array{root_file_id?:int,file:TaskFileEntity,operation:string,old_parent_id:?int,old_name:?string}> $events
     * @return array<int, int> revisions keyed by input event index
     */
    private function appendFileTreeChanges(array $events): array
    {
        if ($events === []) {
            return [];
        }

        /*
         * Allocate and persist the event in the caller's transaction when one
         * is already active.  Starting a savepoint for every row in a batch
         * mutation is needlessly expensive and, more importantly, makes a
         * large import spend most of its time in transaction bookkeeping.
         * Direct callers still get a transaction around the head bump and
         * journal insert.
         */
        $write = function () use ($events): array {
            /** @var array<int, array{events:array<int,array{index:int,file:TaskFileEntity,operation:string,old_parent_id:?int,old_name:?string}>}> $groups */
            $groups = [];
            foreach ($events as $index => $event) {
                $file = $event['file'];
                $rootFileId = (int) ($event['root_file_id'] ?? $this->resolveFileTreeRootId($file));
                if ($rootFileId <= 0) {
                    throw new RuntimeException(sprintf(
                        'Cannot append file-tree change for file %d without a root_file_id',
                        $file->getFileId()
                    ));
                }
                if (! isset($groups[$rootFileId])) {
                    $groups[$rootFileId] = ['events' => []];
                }
                $groups[$rootFileId]['events'][] = [
                    'index' => $index,
                    'root_file_id' => $rootFileId,
                    'file' => $file,
                    'operation' => $event['operation'],
                    'old_parent_id' => $event['old_parent_id'],
                    'old_name' => $event['old_name'],
                ];
            }

            // Deterministic lock order prevents two cross-root bulk mutations
            // from deadlocking while they allocate their heads.
            ksort($groups, SORT_NUMERIC);
            $revisions = [];
            foreach ($groups as $rootFileId => $group) {
                $rootFileId = (int) $rootFileId;
                $now = date('Y-m-d H:i:s');

                foreach ($group['events'] as $event) {
                    if ($this->isFileTreeRoot($event['file'])
                        && $event['file']->getFileId() !== $rootFileId) {
                        throw new RuntimeException(sprintf(
                            'MagicFS logical root is immutable: expected root_file_id=%d, got root_file_id=%d',
                            $rootFileId,
                            $event['file']->getFileId()
                        ));
                    }
                }

                // root_file_id is the sole durable file-tree identity.  Heads
                // are never discovered through a project/user/topic tuple.
                $head = Db::table(self::FILE_TREE_HEADS_TABLE)
                    ->where('root_file_id', $rootFileId)
                    ->lockForUpdate()
                    ->first();
                if ($head === null) {
                    $rootFile = null;
                    foreach ($group['events'] as $event) {
                        if (in_array($event['operation'], ['create', 'restore'], true)
                            && $this->isFileTreeRoot($event['file'])) {
                            $rootFile = $event['file'];
                            break;
                        }
                    }
                    if ($rootFile === null) {
                        throw new RuntimeException(sprintf(
                            'MagicFS file-tree head is not initialized for root_file_id=%d',
                            $rootFileId
                        ));
                    }

                    // insertOrIgnore closes the first-writer race. The root
                    // primary key is the only uniqueness constraint needed.
                    Db::table(self::FILE_TREE_HEADS_TABLE)->insertOrIgnore([
                        'root_file_id' => $rootFileId,
                        'revision' => 0,
                        'oldest_revision' => 1,
                        'updated_at' => $now,
                    ]);
                    $head = Db::table(self::FILE_TREE_HEADS_TABLE)
                        ->where('root_file_id', $rootFileId)
                        ->lockForUpdate()
                        ->first();
                }
                if ($head === null) {
                    throw new RuntimeException(sprintf(
                        'MagicFS root head could not be locked for root_file_id=%d',
                        $rootFileId
                    ));
                }

                // Normalize the locked head to an array before reading it: raw
                // rows are assoc arrays here, and a property read would raise
                // "Attempt to read property on array".
                $head = (array) $head;
                $persistedRootFileId = (int) ($head['root_file_id'] ?? 0);
                if ($persistedRootFileId !== $rootFileId) {
                    throw new RuntimeException(sprintf(
                        'MagicFS file-tree head mismatch: expected root_file_id=%d, found root_file_id=%d',
                        $rootFileId,
                        $persistedRootFileId
                    ));
                }

                $rootRevision = (int) ($head['revision'] ?? 0);
                // 本次追加的排他下界 = 追加前的 head，也就是客户端此刻应当持有的游标。
                // 推送协议里 from_revision 就是这个值，不是第一行的 revision。
                $startRevision = $rootRevision;
                $rows = [];
                foreach ($group['events'] as $event) {
                    ++$rootRevision;
                    $revisions[$event['index']] = $rootRevision;
                    $file = $event['file'];
                    $rows[] = [
                        'root_file_id' => $rootFileId,
                        'revision' => $rootRevision,
                        'file_id' => $file->getFileId(),
                        'parent_id' => $file->getParentId(),
                        'old_parent_id' => $event['old_parent_id'],
                        'name' => $file->getFileName(),
                        'old_name' => $event['old_name'],
                        'operation' => $event['operation'],
                        'file_version' => $file->getMetadataVersion(),
                        'file_snapshot' => json_encode($this->fileTreeChangeSnapshot($file), JSON_THROW_ON_ERROR),
                        'created_at' => $now,
                    ];
                }

                Db::table(self::FILE_TREE_HEADS_TABLE)
                    ->where('root_file_id', $rootFileId)
                    ->update([
                        'revision' => $rootRevision,
                        'updated_at' => $now,
                    ]);

                // Keep INSERT packet size bounded for large imports.
                foreach (array_chunk($rows, 500) as $chunk) {
                    Db::table(self::FILE_TREE_CHANGES_TABLE)->insert($chunk);
                }

                // journal 落库之后再通知推送。仓库层只认识 domain 端口，
                // 不认识 Socket.IO / room / payload：实现由容器提供，
                // 这样持久化层不必为了推送反向依赖接口层。
                // 这里仍在调用方的事务里，发送时机由 publisher 自己按事务层级决定。
                $this->resolveChangePublisher()?->queue($rootFileId, $startRevision, $rootRevision, $rows);
            }

            ksort($revisions);
            return $revisions;
        };

        return Db::transactionLevel() > 0 ? $write() : Db::transaction($write);
    }

    /**
     * 第一次 journal 追加时才解析推送端口，之后复用。
     *
     * 解析失败只意味着"不推送"：journal 才是唯一真相，客户端会退回轮询。
     */
    private function resolveChangePublisher(): ?FileTreeChangePublisherInterface
    {
        if ($this->changePublisherResolved) {
            return $this->changePublisher;
        }
        $this->changePublisherResolved = true;

        try {
            if (! ApplicationContext::hasContainer()) {
                return null;
            }
            $container = ApplicationContext::getContainer();
            if ($container->has(FileTreeChangePublisherInterface::class)) {
                $this->changePublisher = $container->get(FileTreeChangePublisherInterface::class);
            }
        } catch (Throwable) {
            // 端口解析异常绝不能冒泡到写入路径。
            $this->changePublisher = null;
        }

        return $this->changePublisher;
    }

    /** @return array<string, mixed> */
    private function fileTreeChangeSnapshot(TaskFileEntity $file): array
    {
        $metadata = [];
        if ($file->getMetadata() !== null && $file->getMetadata() !== '') {
            $decoded = json_decode($file->getMetadata(), true);
            if (is_array($decoded)) {
                $metadata = $decoded;
            }
        }
        $mode = isset($metadata['mode'])
            ? (int) $metadata['mode']
            : ($file->getIsDirectory() ? 0755 : 0644);
        unset($metadata['mode']);

        // FileMetadata is a string-to-string extension bag in the MagicFS
        // wire contract.  Task-file metadata may be written by other flows,
        // so discard nested/non-scalar values instead of emitting a snapshot
        // that cannot be decoded by the Go client.
        $fileMetadata = [];
        foreach ($metadata as $key => $value) {
            if (! is_string($key) || $key === '' || (! is_scalar($value) && $value !== null)) {
                continue;
            }
            $fileMetadata[$key] = $value === null ? '' : (string) $value;
        }

        return [
            'id' => (string) $file->getFileId(),
            'name' => $file->getFileName(),
            'parent_id' => (string) ($file->getParentId() ?? ''),
            'is_directory' => $file->getIsDirectory(),
            'size' => $file->getFileSize(),
            'mode' => $mode,
            // 空 map 必须序列化成 {}：json_encode 会把空 PHP 数组写成 []，
            // Go 侧 json.Unmarshal 到 map[string]string 会整页解码失败
            // （"cannot unmarshal array into ... file_metadata"），change feed
            // 会一直停在原地、挂载端再也同步不到任何变更。
            // 与 MagicFSFileDTO::toArray() 对同一字段的处理保持一致。
            'file_metadata' => $fileMetadata === [] ? (object) [] : $fileMetadata,
            's3_info' => ['object_key' => $file->getFileKey()],
            'created_at' => $file->getCreatedAt(),
            'updated_at' => $file->getUpdatedAt(),
            'version' => $file->getMetadataVersion(),
            'latest_version' => $file->getLatestVersion(),
        ];
    }

    /**
     * @return array{deleted_rows:int,cursor_expired:bool}
     */
    private function compactFileTree(
        int $rootFileId,
        int $keepRevisions,
        int $batchSize,
        bool $dryRun
    ): array {
        $headRevision = (int) (Db::table(self::FILE_TREE_HEADS_TABLE)
            ->where('root_file_id', $rootFileId)
            ->value('revision') ?? 0);
        $cutoff = $headRevision - $keepRevisions;
        if ($cutoff <= 0) {
            return ['deleted_rows' => 0, 'cursor_expired' => false];
        }

        if ($dryRun) {
            $eligible = (int) Db::table(self::FILE_TREE_CHANGES_TABLE)
                ->where('root_file_id', $rootFileId)
                ->where('revision', '<=', $cutoff)
                ->count();
            return [
                'deleted_rows' => $eligible,
                'cursor_expired' => $eligible > 0,
            ];
        }

        $deleted = 0;
        while (true) {
            // Commit every bounded batch separately. Writers in the same
            // file tree are serialized only while one small prefix is removed;
            // they can proceed between batches, and unrelated file trees never
            // contend on this head row.
            $deleteBatch = function () use ($rootFileId, $cutoff, $batchSize): int {
                $head = Db::table(self::FILE_TREE_HEADS_TABLE)
                    ->where('root_file_id', $rootFileId)
                    ->lockForUpdate()
                    ->first();
                if ($head === null) {
                    return 0;
                }
                $head = (array) $head;

                $ids = Db::table(self::FILE_TREE_CHANGES_TABLE)
                    ->where('root_file_id', $rootFileId)
                    ->where('revision', '<=', $cutoff)
                    ->orderBy('revision', 'ASC')
                    ->limit($batchSize)
                    ->pluck('change_id')
                    ->all();
                if ($ids === []) {
                    return 0;
                }

                $batchDeleted = Db::table(self::FILE_TREE_CHANGES_TABLE)
                    ->whereIn('change_id', $ids)
                    ->delete();
                $firstRevision = Db::table(self::FILE_TREE_CHANGES_TABLE)
                    ->where('root_file_id', $rootFileId)
                    ->min('revision');
                $currentHead = (int) ($head['revision'] ?? 0);
                $oldest = $firstRevision === null ? $currentHead + 1 : (int) $firstRevision;
                Db::table(self::FILE_TREE_HEADS_TABLE)
                    ->where('root_file_id', $rootFileId)
                    ->update([
                        'oldest_revision' => $oldest,
                        'updated_at' => date('Y-m-d H:i:s'),
                    ]);

                return $batchDeleted;
            };

            $batchDeleted = Db::transactionLevel() > 0
                ? $deleteBatch()
                : Db::transaction($deleteBatch);
            if ($batchDeleted === 0) {
                break;
            }
            $deleted += $batchDeleted;
        }

        return [
            'deleted_rows' => $deleted,
            'cursor_expired' => $deleted > 0,
        ];
    }

    /**
     * Build the root predicate shared by the change-feed queries. The explicit
     * root_file_id predicate is indexed and makes a cursor's directory tree
     * immediately visible in SQL logs.
     */
    private function buildFileTreeChangeQuery(int $rootFileId)
    {
        return Db::table(self::FILE_TREE_CHANGES_TABLE)
            ->where('root_file_id', $rootFileId);
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\TaskFileModel;

class TaskFileRepository implements TaskFileRepositoryInterface
{
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

    public function getFilesByIds(array $fileIds, int $projectId = 0): array
    {
        $query = $this->model::query()->whereIn('file_id', $fileIds);

        if ($projectId > 0) {
            $query->where('project_id', $projectId);
        }

        $models = $query->get();

        $list = [];
        foreach ($models as $model) {
            $list[] = new TaskFileEntity($model->toArray());
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

        $query = $this->model::query()->whereIn('file_id', $ids);
        if ($projectId > 0) {
            $query = $query->where('project_id', $projectId);
        }
        $models = $query->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = new TaskFileEntity($model->toArray());
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
    public function getByProjectIdAndFileKey(int $projectId, string $fileKey): ?TaskFileEntity
    {
        $model = $this->model::query()
            ->where('project_id', $projectId)
            ->where('file_key', $fileKey)
            ->first();

        if (! $model) {
            return null;
        }
        return new TaskFileEntity($model->toArray());
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
     * @return array{list: TaskFileEntity[], total: int} 文件列表和总数
     */
    public function getByProjectId(int $projectId, int $page, int $pageSize = 200, array $fileType = [], string $storageType = ''): array
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
        $date = date('Y-m-d H:i:s');
        $entity->setCreatedAt($date);
        $entity->setUpdatedAt($date);

        $entityArray = $entity->toArray();
        $model = $this->model::query()->create($entityArray);

        // 设置数据库生成的ID
        if (! empty($model->file_id)) {
            $entity->setFileId($entity->getFileId());
        }

        return $entity;
    }

    /**
     * 插入文件，如果存在冲突则忽略.
     * 根据file_key和topic_id判断是否存在冲突
     */
    public function insertOrIgnore(TaskFileEntity $entity): ?TaskFileEntity
    {
        // 首先检查是否已经存在相同的file_key和topic_id的记录
        $existingEntity = $this->model::query()
            ->where('file_key', $entity->getFileKey())
            ->first();

        // 如果已存在记录，则返回已存在的实体
        if ($existingEntity) {
            return new TaskFileEntity($existingEntity->toArray());
        }

        // 不存在则创建新记录
        $date = date('Y-m-d H:i:s');
        if (empty($entity->getFileId())) {
            $entity->setFileId(IdGenerator::getSnowId());
        }
        $entity->setCreatedAt($date);
        $entity->setUpdatedAt($date);

        $entityArray = $entity->toArray();

        $this->model::query()->create($entityArray);
        return $entity;
    }

    public function updateById(TaskFileEntity $entity): TaskFileEntity
    {
        $entity->setUpdatedAt(date('Y-m-d H:i:s'));
        $entityArray = $entity->toArray();

        $this->model::query()
            ->where('file_id', $entity->getFileId())
            ->update($entityArray);

        return $entity;
    }

    public function updateFileByCondition(array $condition, array $data): bool
    {
        return $this->model::query()
            ->where($condition)
            ->update($data) > 0;
    }

    public function deleteById(int $id): void
    {
        $this->model::query()->where('file_id', $id)->delete();
    }

    public function deleteByFileKeyAndProjectId(string $fileKey, int $projectId): int
    {
        $result = $this->model::query()->where('file_key', $fileKey)->where('project_id', $projectId)->delete();
        return $result ?? 0;
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

        $insertData = [];
        $now = date('Y-m-d H:i:s');

        foreach ($newFileKeys as $fileKey) {
            // 从对象存储文件信息中获取详细信息
            $fileInfo = $objectStorageFiles[$fileKey] ?? [];

            $insertData[] = [
                'file_id' => IdGenerator::getSnowId(),
                'user_id' => $dataIsolation->getCurrentUserId(),
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                'project_id' => $projectId,
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

        // 使用批量插入提升性能
        $this->model::query()->insert($insertData);
    }

    /**
     * 批量标记文件为已删除.
     */
    public function batchMarkAsDeleted(array $deletedFileKeys): void
    {
        if (empty($deletedFileKeys)) {
            return;
        }

        $this->model::query()
            ->whereIn('file_key', $deletedFileKeys)
            ->whereNull('deleted_at')
            ->update([
                'deleted_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
    }

    /**
     * 批量更新文件信息.
     */
    public function batchUpdateFiles(array $updatedFileKeys): void
    {
        if (empty($updatedFileKeys)) {
            return;
        }

        // 简化实现：只更新修改时间
        $this->model::query()
            ->whereIn('file_key', $updatedFileKeys)
            ->whereNull('deleted_at')
            ->update([
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
    }

    /**
     * 根据目录路径查找文件列表.
     */
    public function findFilesByDirectoryPath(int $projectId, string $directoryPath, int $limit = 500): array
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
     * 批量删除文件.
     */
    public function deleteByIds(array $fileIds): void
    {
        if (empty($fileIds)) {
            return;
        }

        $this->model::query()
            ->whereIn('file_id', $fileIds)
            ->delete();
    }

    /**
     * 根据文件Keys批量删除文件.
     */
    public function deleteByFileKeys(array $fileKeys): void
    {
        if (empty($fileKeys)) {
            return;
        }

        $this->model::query()
            ->whereIn('file_key', $fileKeys)
            ->delete();
    }

    /**
     * 获取指定父目录下的最小排序值.
     */
    public function getMinSortByParentId(?int $parentId, int $projectId): ?int
    {
        $query = $this->model::query()
            ->where('project_id', $projectId)
            ->whereNull('deleted_at');

        if ($parentId === null) {
            $query->whereNull('parent_id');
        } else {
            $query->where('parent_id', $parentId);
        }

        return $query->min('sort');
    }

    /**
     * 获取指定父目录下的最大排序值.
     */
    public function getMaxSortByParentId(?int $parentId, int $projectId): ?int
    {
        $query = $this->model::query()
            ->where('project_id', $projectId)
            ->whereNull('deleted_at');

        if ($parentId === null) {
            $query->whereNull('parent_id');
        } else {
            $query->where('parent_id', $parentId);
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
     */
    public function getNextSortAfter(?int $parentId, int $currentSort, int $projectId): ?int
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

        return $query->min('sort');
    }

    /**
     * 获取同一父目录下的所有兄弟节点.
     */
    public function getSiblingsByParentId(?int $parentId, int $projectId, string $orderBy = 'sort', string $direction = 'ASC'): array
    {
        $query = $this->model::query()
            ->where('project_id', $projectId)
            ->whereNull('deleted_at');

        if ($parentId === null) {
            $query->whereNull('parent_id');
        } else {
            $query->where('parent_id', $parentId);
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

        foreach ($updates as $update) {
            $this->model::query()
                ->where('file_id', $update['file_id'])
                ->update(['sort' => $update['sort'], 'updated_at' => date('Y-m-d H:i:s')]);
        }
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

        return $this->model::query()
            ->whereIn('file_id', $fileIds)
            ->where(function ($query) {
                $query->whereNull('project_id')
                    ->orWhere('project_id', 0);
            })
            ->update([
                'project_id' => $projectId,
                'parent_id' => $parentId,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
    }

    public function findLatestUpdatedByProjectId(int $projectId): ?TaskFileEntity
    {
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

        return $this->model::query()
            ->whereIn('file_id', $fileIds)
            ->whereNull('deleted_at')
            ->update([
                'parent_id' => $parentId,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
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
    public function restoreFile(int $fileId): void
    {
        $this->model::withTrashed()
            ->where('file_id', $fileId)
            ->restore();
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;

interface TaskFileRepositoryInterface
{
    /**
     * 根据ID获取文件.
     */
    public function getById(int $id): ?TaskFileEntity;

    /**
     * 根据ID批量获取文件.
     * @return TaskFileEntity[]
     */
    public function getFilesByIds(array $fileIds, int $projectId = 0): array;

    /**
     * 根据ID批量获取文件.
     * @return TaskFileEntity[]
     */
    public function getTaskFilesByIds(array $ids, int $projectId = 0): array;

    /**
     * 根据fileKey获取文件.
     *
     * @param string $fileKey 文件键
     * @param null|int $topicId 话题ID，默认为0
     * @param bool $withTrash 是否包含已删除的文件，默认为false
     */
    public function getByFileKey(string $fileKey, ?int $topicId = 0, bool $withTrash = false): ?TaskFileEntity;

    /**
     * 根据fileKey数组批量获取文件.
     *
     * @param array $fileKeys 文件Key数组
     * @return TaskFileEntity[] 文件实体数组，以file_key为键
     */
    public function getByFileKeys(array $fileKeys): array;

    /**
     * 根据项目ID和fileKey获取文件.
     */
    public function getByProjectIdAndFileKey(int $projectId, string $fileKey): ?TaskFileEntity;

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
    public function getByTopicId(int $topicId, int $page, int $pageSize, array $fileType = [], string $storageType = 'workspace'): array;

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
    public function getByProjectId(int $projectId, int $page, int $pageSize = 200, array $fileType = [], string $storageType = ''): array;

    /**
     * 根据任务ID获取文件列表.
     *
     * @param int $taskId 任务ID
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @return array{list: TaskFileEntity[], total: int} 文件列表和总数
     */
    public function getByTaskId(int $taskId, int $page, int $pageSize): array;

    /**
     * 根据话题任务ID获取文件列表.
     *
     * @param int $topicTaskId 话题任务ID
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @return array{list: TaskFileEntity[], total: int} 文件列表和总数
     * @deprecated 使用 getByTopicId 和 getByTaskId 方法替代
     */
    public function getByTopicTaskId(int $topicTaskId, int $page, int $pageSize): array;

    /**
     * 插入文件.
     */
    public function insert(TaskFileEntity $entity): TaskFileEntity;

    /**
     * 插入文件，如果存在冲突则忽略.
     * 根据file_key和topic_id判断是否存在冲突
     */
    public function insertOrIgnore(TaskFileEntity $entity): ?TaskFileEntity;

    /**
     * 更新文件.
     */
    public function updateById(TaskFileEntity $entity): TaskFileEntity;

    /**
     * 删除文件.
     */
    public function deleteById(int $id): void;

    public function deleteByFileKeyAndProjectId(string $fileKey, int $projectId): int;

    /**
     * 根据文件ID数组和用户ID批量获取用户文件.
     *
     * @param array $fileIds 文件ID数组
     * @param string $userId 用户ID
     * @return TaskFileEntity[] 用户文件列表
     */
    public function findUserFilesByIds(array $fileIds, string $userId): array;

    public function findUserFilesByTopicId(string $topicId): array;

    public function findUserFilesByProjectId(string $projectId): array;

    /**
     * @return TaskFileEntity[] 用户文件列表
     */
    public function findFilesByProjectIdAndIds(int $projectId, array $fileIds): array;

    /**
     * 根据项目ID获取所有文件的file_key列表（高性能查询）.
     */
    public function getFileKeysByProjectId(int $projectId, int $limit = 1000): array;

    /**
     * 批量插入新文件记录.
     */
    public function batchInsertFiles(DataIsolation $dataIsolation, int $projectId, array $newFileKeys, array $objectStorageFiles = []): void;

    /**
     * 批量标记文件为已删除.
     */
    public function batchMarkAsDeleted(array $deletedFileKeys): void;

    /**
     * 获取指定父目录下的最小排序值.
     */
    public function getMinSortByParentId(?int $parentId, int $projectId): ?int;

    /**
     * 获取指定父目录下的最大排序值.
     */
    public function getMaxSortByParentId(?int $parentId, int $projectId): ?int;

    /**
     * 获取指定文件的排序值.
     */
    public function getSortByFileId(int $fileId): ?int;

    /**
     * 获取指定排序值之后的下一个排序值.
     */
    public function getNextSortAfter(?int $parentId, int $currentSort, int $projectId): ?int;

    /**
     * 获取同一父目录下的所有兄弟节点.
     */
    public function getSiblingsByParentId(?int $parentId, int $projectId, string $orderBy = 'sort', string $direction = 'ASC'): array;

    public function getSiblingCountByParentId(int $parentId, int $projectId): int;

    /**
     * 批量更新排序值.
     */
    public function batchUpdateSort(array $updates): void;

    /**
     * 批量更新文件信息.
     */
    public function batchUpdateFiles(array $updatedFileKeys): void;

    /**
     * 根据目录路径查找文件列表.
     *
     * @param int $projectId 项目ID
     * @param string $directoryPath 目录路径
     * @param int $limit 查询限制
     * @return TaskFileEntity[] 文件列表
     */
    public function findFilesByDirectoryPath(int $projectId, string $directoryPath, int $limit = 1000): array;

    /**
     * 批量删除文件.
     *
     * @param array $fileIds 文件ID数组
     */
    public function deleteByIds(array $fileIds): void;

    /**
     * 根据文件Keys批量删除文件.
     *
     * @param array $fileKeys 文件Key数组
     */
    public function deleteByFileKeys(array $fileKeys): void;

    /**
     * Batch bind files to project with parent directory.
     * Updates both project_id and parent_id atomically.
     *
     * @param array $fileIds Array of file IDs to bind
     * @param int $projectId Project ID to bind to
     * @param int $parentId Parent directory ID
     * @return int Number of affected rows
     */
    public function batchBindToProject(array $fileIds, int $projectId, int $parentId): int;

    public function findLatestUpdatedByProjectId(int $projectId): ?TaskFileEntity;

    /**
     * Count files by project ID.
     *
     * @param int $projectId Project ID
     * @return int Total count of files in the project
     */
    public function countFilesByProjectId(int $projectId): int;

    /**
     * Get files by project ID with resume support.
     * Used for fork migration with pagination and resume capability.
     *
     * @param int $projectId Project ID
     * @param null|int $lastFileId Last processed file ID for resume
     * @param int $limit Number of files to fetch
     * @return TaskFileEntity[] Array of file entities
     */
    public function getFilesByProjectIdWithResume(int $projectId, ?int $lastFileId, int $limit): array;

    /**
     * Batch update parent_id for multiple files.
     * Used for fixing parent relationships during fork operations.
     *
     * @param array $fileIds Array of file IDs to update
     * @param int $parentId New parent ID to set
     * @param string $userId User performing the update
     * @return int Number of affected rows
     */
    public function batchUpdateParentId(array $fileIds, int $parentId, string $userId): int;

    public function updateFileByCondition(array $condition, array $data): bool;

    public function lockDirectChildrenForUpdate(int $parentId): array;

    public function getAllChildrenByParentId(int $parentId): array;

    /**
     * 恢复被删除的文件.
     *
     * @param int $fileId 文件ID
     */
    public function restoreFile(int $fileId): void;
}

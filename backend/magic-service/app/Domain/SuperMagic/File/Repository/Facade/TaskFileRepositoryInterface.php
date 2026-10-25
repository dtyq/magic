<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Repository\Facade;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;

interface TaskFileRepositoryInterface
{
    /**
     * 根据ID获取文件.
     */
    public function getById(int $id): ?TaskFileEntity;

    /**
     * Load a MagicFS node with its effective file-tree context.
     *
     * Descendant rows may retain historical project/user fields after their
     * directory is moved to another root.  The parent chain, not those
     * denormalized fields, is the authoritative tree boundary.
     */
    public function getFileTreeFileById(int $id): ?TaskFileEntity;

    /**
     * 根据项目ID获取项目目录。
     */
    public function getDirectoryByIdAndProject(int $parentId, int $projectId): ?TaskFileEntity;

    /**
     * 根据ID获取文件，包含已软删除记录.
     */
    public function getByIdWithTrash(int $id): ?TaskFileEntity;

    /**
     * 根据ID批量获取文件，包含已软删除记录.
     * @param int[] $ids
     * @return array<int, TaskFileEntity> keyed by file_id
     */
    public function getByIdsWithTrash(array $ids): array;

    /**
     * 根据ID批量获取文件.
     * @return TaskFileEntity[]
     */
    public function getFilesByIds(array $fileIds, int $projectId = 0, ?string $spaceType = null): array;

    /**
     * 根据文件ID批量获取文件，包含已软删除记录，并支持项目/空间过滤.
     *
     * @param array<int|string> $fileIds
     * @return TaskFileEntity[]
     */
    public function getFilesByIdsWithTrash(array $fileIds, int $projectId = 0, ?string $spaceType = null): array;

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
     * 获取由指定文件直接复制产生的目标文件。
     *
     * @return TaskFileEntity[]
     */
    public function getCopiesBySourceFileId(int $sourceFileId): array;

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
    public function getByProjectIdAndFileKey(int $projectId, string $fileKey, bool $withTrash = false): ?TaskFileEntity;

    /**
     * Get file by project ID and file name (searches across all directories).
     */
    public function getByProjectIdAndFileName(int $projectId, string $fileName): ?TaskFileEntity;

    /**
     * 根据项目ID、父目录ID和文件名获取文件（用于同目录重名冲突判断）.
     */
    public function getByProjectParentAndName(int $projectId, ?int $parentId, string $fileName, bool $withTrash = false): ?TaskFileEntity;

    public function getBySpaceParentAndName(
        string $spaceType,
        int $projectId,
        ?int $parentId,
        string $fileName,
        string $userId,
        string $organizationCode,
        bool $withTrash = false,
        ?int $topicId = null
    ): ?TaskFileEntity;

    /**
     * Find a direct child by parent/name for MagicFS.
     *
     * Parent identity is authoritative; descendants may retain historical
     * project fields after a cross-root move.  The optional trash flag is used
     * by checkpoint restore/reuse semantics.
     */
    public function getFileTreeChildByParentAndName(
        int $parentId,
        string $fileName,
        bool $withTrash = false,
        ?TaskFileEntity $parentContext = null
    ): ?TaskFileEntity;

    /**
     * Find a direct child in a user-owned file tree.
     *
     * User-space identity is scoped by user, organization and space type;
     * project_id=0 is only a storage value and must not be used as a lookup
     * boundary on the large task-files table.
     */
    public function getUserFileTreeChildByParentAndName(
        int $parentId,
        string $fileName,
        string $userId,
        string $organizationCode,
        bool $withTrash = false
    ): ?TaskFileEntity;

    /**
     * 根据项目、父目录和文件名批量查询直接子节点。
     *
     * @param string[] $fileNames
     * @return array<string, TaskFileEntity> 以文件名为键的文件实体
     */
    public function getByProjectParentAndNames(int $projectId, int $parentId, array $fileNames): array;

    /**
     * Get files by project ID and file keys.
     *
     * @param int $projectId Project ID
     * @param array $fileKeys File keys
     * @return TaskFileEntity[] File entities indexed by file_key
     */
    public function getByProjectIdAndFileKeys(int $projectId, array $fileKeys): array;

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
     * @param null|string $updatedAfter 更新时间过滤（查询此时间之后更新的文件）
     * @return array{list: TaskFileEntity[], total: int} 文件列表和总数
     */
    public function getByProjectId(int $projectId, int $page, int $pageSize = 200, array $fileType = [], string $storageType = '', ?string $updatedAfter = null): array;

    /**
     * Keyset cursor pagination over project files. Returns raw associative rows
     * (no Eloquent hydration, no entity construction) for hot read paths.
     *
     * @param int $projectId project id
     * @param string $storageType storage type, e.g. workspace
     * @param null|int $afterFileId previous page's last file_id (exclusive); null/0 for first page
     * @param int $limit page size
     * @param string[] $fileTypes optional file_type filter
     * @param null|string $updatedAfter optional updated_at filter
     * @return array<int, array<string, mixed>> raw rows from PDO
     */
    public function getProjectFilesByCursor(
        int $projectId,
        string $storageType,
        ?int $afterFileId,
        int $limit,
        array $fileTypes = [],
        ?string $updatedAfter = null
    ): array;

    /**
     * Cursor pagination for one parent's direct children using tree order.
     * Directories are always included so the client can continue traversal even
     * when file type filters are applied to files.
     *
     * @param string[] $fileTypes optional file_type filter for non-directory files
     * @return array<int, array<string, mixed>> raw rows from PDO
     */
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
    ): array;

    /**
     * Cursor pagination for a MagicFS directory.
     *
     * The authenticated parent is the tree boundary, so this query must use
     * parent_id as its ownership predicate and must not filter descendants by
     * their historical project_id after a cross-root move.
     *
     * @param string[] $fileTypes optional file_type filter for non-directory files
     * @return array<int, array<string, mixed>> raw rows from PDO
     */
    public function getFileTreeChildrenByParentCursor(
        int $parentId,
        string $storageType,
        ?int $afterSort,
        ?int $afterFileId,
        int $limit,
        array $fileTypes = [],
        string $fileName = ''
    ): array;

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
     * 插入或更新文件.
     * 使用 INSERT ... ON DUPLICATE KEY UPDATE 语法
     * 当 file_key 冲突时更新现有记录，否则插入新记录.
     *
     * @param TaskFileEntity $entity 文件实体
     * @return TaskFileEntity 插入或更新后的文件实体
     */
    public function insertOrUpdate(TaskFileEntity $entity): TaskFileEntity;

    /**
     * 更新文件.
     */
    public function updateById(
        TaskFileEntity $entity,
        ?string $journalOperation = null,
        bool $emitJournal = true
    ): TaskFileEntity;

    /**
     * Initialize one durable change-feed head for every active file-tree root.
     * The operation is bounded and idempotent so it can be safely resumed.
     *
     * @return array{discovered_file_trees:int, initialized_file_trees:int}
     */
    public function initializeFileTreeHeads(int $batchSize = 1000): array;

    /**
     * Backfill metadata_version in bounded transactions while publishing the
     * same precise file-tree update events as an online mutation.
     *
     * This is intentionally a repository operation rather than a command
     * writing the task-file table directly: the file row, root head and
     * journal snapshot must commit together.
     */
    public function backfillMagicFSMetadataVersions(int $batchSize = 1000): int;

    /**
     * Apply heterogeneous maintenance updates to active task-file rows in one
     * bounded transaction and append one precise event per changed row.
     *
     * @param array<int, array{file_id:int,file_key?:string,parent_id?:null|int,updated_at?:string}> $updates
     */
    public function applyMagicFSBackfillUpdates(array $updates): int;

    /**
     * Delete file by ID.
     *
     * @param int $id File ID
     * @param bool $forceDelete Whether to force delete (hard delete), default true
     */
    public function deleteById(int $id, bool $forceDelete = true): void;

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
     *
     * @param null|int $parentId 父目录ID，null 表示根层级
     * @param int $projectId 项目ID
     * @param null|string $spaceType 空间类型过滤，null 不过滤（保持原行为）
     */
    public function getMinSortByParentId(?int $parentId, int $projectId, ?string $spaceType = null): ?int;

    /**
     * 获取指定父目录下的最大排序值.
     *
     * @param null|int $parentId 父目录ID，null 表示根层级
     * @param int $projectId 项目ID
     * @param null|string $spaceType 空间类型过滤，null 不过滤（保持原行为）
     */
    public function getMaxSortByParentId(?int $parentId, int $projectId, ?string $spaceType = null): ?int;

    /**
     * 获取指定文件的排序值.
     */
    public function getSortByFileId(int $fileId): ?int;

    /**
     * 获取指定排序值之后的下一个排序值.
     *
     * @param null|int $parentId 父目录ID，null 表示根层级
     * @param int $currentSort 当前排序值
     * @param int $projectId 项目ID
     * @param null|string $spaceType 空间类型过滤，null 不过滤（保持原行为）
     */
    public function getNextSortAfter(?int $parentId, int $currentSort, int $projectId, ?string $spaceType = null): ?int;

    /**
     * 获取同一父目录下的所有兄弟节点.
     *
     * @param null|int $parentId 父目录ID，null 表示根层级
     * @param int $projectId 项目ID
     * @param string $orderBy 排序字段
     * @param string $direction 排序方向
     * @param null|string $spaceType 空间类型过滤，null 不过滤（保持原行为）
     */
    public function getSiblingsByParentId(?int $parentId, int $projectId, string $orderBy = 'sort', string $direction = 'ASC', ?string $spaceType = null): array;

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
     * Get children files by parent_id and project_id.
     *
     * @param int $projectId Project ID
     * @param int $parentId Parent directory ID
     * @param int $limit Maximum number of files to return
     * @param null|string $spaceType Optional space type filter
     * @return TaskFileEntity[] File entity list
     */
    public function getChildrenByParentAndProject(int $projectId, int $parentId, int $limit = 500, ?string $spaceType = null): array;

    /**
     * Get children files by multiple parent_ids and project_id (batch query).
     * Uses idx_project_parent_sort index to avoid N+1 problem.
     *
     * @param int $projectId Project ID
     * @param array $parentIds Parent directory IDs
     * @param int $limit Maximum number of files to return
     * @return TaskFileEntity[] File entity list
     */
    public function getChildrenByParentIdsAndProject(int $projectId, array $parentIds, int $limit = 1000, int $offset = 0): array;

    /**
     * 获取指定父目录的子节点，包含已软删除记录。
     *
     * @param int[] $parentIds
     * @return TaskFileEntity[]
     */
    public function getChildrenByParentIdsAndProjectWithTrash(int $projectId, array $parentIds, int $limit = 1000, int $offset = 0): array;

    /**
     * 获取目录的全部后代节点，包含已软删除记录。
     * 目录关系只依据 parent_id，不使用 file_key。
     *
     * @return TaskFileEntity[]
     */
    public function getAllDescendantEntitiesWithTrash(int $parentId, int $projectId = 0, int $maxDepth = 100): array;

    /**
     * Batch update file_key for multiple files.
     *
     * @param array $updateBatch Array of [['file_id' => 1, 'file_key' => 'new/path', 'updated_at' => '...'], ...]
     * @return int Number of updated files
     */
    public function batchUpdateFileKeys(array $updateBatch): int;

    /**
     * 批量删除文件.
     *
     * @param array $fileIds 文件ID数组
     * @param bool $forceDelete 是否强制删除（物理删除），默认为true，false为软删除
     * @param null|int $projectId 可选项目作用域
     */
    public function deleteByIds(array $fileIds, bool $forceDelete = true, ?int $projectId = null): void;

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
     * Get the latest updated time by project ID.
     * This is an optimized method that only returns the time string,
     * avoiding Model instantiation and Enum reflection overhead.
     *
     * @param int $projectId Project ID
     * @return null|string The latest updated time or null if no files exist
     */
    public function getLatestUpdatedTimeByProjectId(int $projectId): ?string;

    /**
     * Count files by project ID.
     *
     * @param int $projectId Project ID
     * @return int Total count of files in the project
     */
    public function countFilesByProjectId(int $projectId): int;

    /**
     * Count attachments aligned with the V2 list endpoint semantics
     * (workspace + not deleted; no is_hidden filter, no root-row trim).
     */
    public function countAttachmentsByProjectIdV2(int $projectId): int;

    /**
     * Append one durable root-local change and return its monotonic cursor.
     * The caller should invoke this in the same database transaction as the
     * file mutation.
     */
    public function appendFileTreeChange(
        TaskFileEntity $file,
        string $operation,
        ?int $oldParentId = null,
        ?string $oldName = null,
        ?int $rootFileId = null
    ): int;

    /**
     * Publish a precise before/after mutation after any related version-chain
     * updates have completed. This is used by atomic MagicFS operations that
     * need their journal snapshot to contain the final metadata revision.
     */
    public function appendFileTreeMutation(
        ?TaskFileEntity $before,
        ?TaskFileEntity $after,
        ?string $operation = null
    ): void;

    /**
     * Read changes after a root_file_id-local cursor. A limit of zero is a cheap head
     * query and returns no rows.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getFileTreeChanges(TaskFileEntity $rootFile, int $sinceRevision, int $limit): array;

    /** Return the current durable revision for a file tree. */
    public function getFileTreeRevision(TaskFileEntity $rootFile): int;

    /**
     * Read a bounded root feed together with cursor state. Revisions are
     * allocated independently for each root_file_id; callers must never
     * compare cursors from different roots.
     *
     * @return array{
     *     rows: array<int, array<string, mixed>>,
     *     head: int,
     *     oldest: int,
     *     cursor_expired: bool
     * }
     */
    public function getFileTreeChangeFeed(TaskFileEntity $rootFile, int $sinceRevision, int $limit): array;

    /**
     * Retain only the newest N revisions per root_file_id and advance
     * oldest_revision atomically. Clients whose cursor falls before that
     * boundary receive cursor_expired and re-list visited directories on
     * demand; no complete-tree rebuild is allowed as a recovery path.
     *
     * @return array{file_trees:int, deleted_rows:int, expired_file_trees:int}
     */
    public function compactFileTreeChangeJournal(
        int $keepRevisions = 100000,
        int $batchSize = 1000,
        bool $dryRun = false
    ): array;

    /**
     * Batch count files by project IDs.
     *
     * @param array $projectIds Project ID array
     * @return array<int, int> [project_id => file_count] mapping array
     */
    public function countFilesByProjectIds(array $projectIds): array;

    /**
     * 统计项目空间文件数量，最多统计到 $limit 即提前返回（大表场景避免全量 COUNT）.
     * 返回值为 min(实际数量, $limit)，用于「是否达到阈值」判断。
     * 口径：project_id + space_type='project' + storage_type='workspace' + 未删除（含隐藏文件与目录行）。
     *
     * @param int $projectId 项目ID
     * @param int $limit 统计上限
     * @return int 文件数量（上限封顶）
     */
    public function countProjectFilesWithLimit(int $projectId, int $limit): int;

    /**
     * 统计项目空间的完整文件数量；只在达到临时保护阈值后用于生成用户提示。
     */
    public function countProjectFiles(int $projectId): int;

    /**
     * 统计用户空间文件数量，最多统计到 $limit 即提前返回（大表场景避免全量 COUNT）.
     * 返回值为 min(实际数量, $limit)，用于「是否达到阈值」判断。
     * 口径：user_id + organization_code + space_type='user' + storage_type='user' + 未删除。
     *
     * @param string $userId 用户ID
     * @param string $organizationCode 组织编码
     * @param int $limit 统计上限
     * @return int 文件数量（上限封顶）
     */
    public function countUserSpaceFilesWithLimit(string $userId, string $organizationCode, int $limit): int;

    /**
     * 统计用户空间的完整文件数量；只在达到临时保护阈值后用于生成用户提示。
     */
    public function countUserSpaceFiles(string $userId, string $organizationCode): int;

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
     * Parent map of the project-space files the fork enumeration can see
     * (space_type=project, visible, not deleted). Used to compute which files
     * still have a valid ancestor chain up to the project root.
     *
     * @return array<int, null|int> [file_id => parent_id]
     */
    public function getVisibleProjectFileParentMap(int $projectId): array;

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
    public function restoreFile(int $fileId, bool $emitJournal = true): void;

    /**
     * 递归获取文件及其所有父级文件.
     * 用于确保构建文件树时包含完整的父子关系链.
     *
     * @param array $fileIds 文件ID数组
     * @param int $projectId 项目ID（可选，用于过滤）
     * @return TaskFileEntity[] 包含所有父级文件的完整文件列表
     */
    public function getFilesWithParentsByIds(array $fileIds, int $projectId = 0): array;

    /**
     * 递增指定文件的版本号（原子操作）.
     *
     * @param int $fileId 文件ID
     * @return int 更新后的版本号
     */
    public function incrementVersionById(int $fileId): int;

    /**
     * 更新指定文件的最新内容版本号.
     *
     * @param int $fileId 文件ID
     * @param int $latestVersion 最新版本号
     */
    public function updateLatestVersionById(int $fileId, int $latestVersion): void;

    /**
     * 批量获取文件版本号.
     *
     * @param array $fileIds 文件ID数组
     * @return array<string, int> file_id => version 的映射
     */
    public function getVersionsByIds(array $fileIds): array;

    /**
     * Advance the metadata version of the given nodes.
     *
     * Cache invalidation only: a version is a cache key, and moving it is not a
     * change event. Journal rows are appended by the mutation that changed the
     * node (insert / update / delete / move / restore), never by a bump, so a
     * reader's window stays one row per changed node instead of one row per
     * ancestor per change. See the implementation for the full rationale.
     *
     * @param array<null|int|string> $fileIds
     * @return int rows whose version actually advanced
     */
    public function bumpMetadataVersions(array $fileIds): int;

    /**
     * 批量获取文件元数据版本号.
     * 用于 MagicFS 客户端检查缓存是否失效.
     *
     * @param array $fileIds 文件ID数组
     * @return array<string, int> file_id => metadata_version 的映射
     */
    public function getMetadataVersionsByIds(array $fileIds): array;

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
    public function getAllChildrenFileIdsByDirectoryIds(array $directoryIds, int $projectId, int $maxDepth = 10, bool $includeDirectories = false): array;

    /**
     * 获取目录下所有后代节点的ID（包含文件和目录）.
     * 使用广度优先遍历 parent_id 链，逐层查询。
     *
     * @param int $parentId 父目录ID
     * @param int $projectId 项目ID（0 表示不限制项目）
     * @param int $maxDepth 最大递归深度
     * @return array<int> 所有后代节点的 file_id 数组
     */
    public function getAllDescendantIds(int $parentId, int $projectId = 0, int $maxDepth = 100): array;

    /**
     * Transfer ownership of all files in a project.
     *
     * Updates the user_id field for all files belonging to a project.
     *
     * @param int $projectId Project ID
     * @param string $fromUserId Original owner user ID
     * @param string $toUserId New owner user ID
     * @return int Number of files updated
     */
    public function transferOwnership(int $projectId, string $fromUserId, string $toUserId): int;

    /**
     * 根据项目ID和空间类型获取根节点文件.
     *
     * @param int $projectId 项目ID
     * @param string $spaceType 空间类型，默认 project 空间
     * @return null|TaskFileEntity 根节点文件实体
     */
    public function getRootFileByProjectId(int $projectId, string $spaceType = FileSpaceType::PROJECT->value): ?TaskFileEntity;

    /**
     * Check if a file with the given name exists in a project.
     *
     * @param int $projectId Project ID
     * @param string $fileName File name to check
     * @return bool Whether the file exists
     */
    public function existsByProjectIdAndFileName(int $projectId, string $fileName): bool;

    /**
     * Find root directory by project ID.
     * Root directory is identified by: parent_id IS NULL AND file_name = '/' AND is_directory = true.
     *
     * @param int $projectId Project ID
     * @return null|TaskFileEntity Root directory entity or null if not found
     */
    public function findRootDirectoryByProjectId(int $projectId): ?TaskFileEntity;

    /**
     * Find user-space root directory by user_id, organization_code and space_type.
     * Root directory is identified by: parent_id IS NULL AND file_name = '/' AND is_directory = true
     * AND space_type = 'user' AND user_id = ? AND organization_code = ?.
     */
    public function findUserSpaceRootDirectory(string $userId, string $organizationCode): ?TaskFileEntity;

    public function findTopicSpaceRootDirectory(int $projectId, int $topicId, string $organizationCode): ?TaskFileEntity;

    /**
     * Get topic files using a file_id cursor, excluding the topic root itself.
     *
     * @return TaskFileEntity[]
     */
    public function getTopicFilesByCursor(int $topicId, int $rootFileId, ?int $afterFileId, int $limit): array;

    public function countTopicFilesForCopy(int $topicId, int $rootFileId): int;

    /**
     * Batch update is_hidden field for given file IDs.
     *
     * @param int[] $fileIds File IDs to update
     * @param bool $isHidden New hidden status
     * @return int Number of affected rows
     */
    public function batchUpdateIsHidden(array $fileIds, bool $isHidden, ?string $updatedAt = null): int;

    /**
     * Get existing file names under a parent directory, filtered by provided names.
     * Used to avoid duplicate insertions.
     *
     * @param int $parentId Parent directory file ID
     * @param array $fileNames File names to check
     * @return string[] Existing file names in the database
     */
    public function getExistingFileNamesByParentId(int $parentId, array $fileNames): array;

    /**
     * Batch insert WAV file records under a specific parent directory.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param int $projectId Project ID
     * @param int $parentId Parent directory file ID
     * @param array $wavFiles Array of file info: [['file_name' => ..., 'file_key' => ..., 'file_size' => ...], ...]
     */
    public function batchInsertWavFiles(DataIsolation $dataIsolation, int $projectId, int $parentId, array $wavFiles): void;
}

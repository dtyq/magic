<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\SuperMagic\Common\Entity\ValueObject\StorageType;
use App\Domain\SuperMagic\Common\Event\DeleteEventSource;
use App\Domain\SuperMagic\File\Constant\TopicFileConstant;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileType;
use App\Domain\SuperMagic\File\Entity\ValueObject\SandboxFileNotificationDataValueObject;
use App\Domain\SuperMagic\File\Entity\ValueObject\TaskFileSource;
use App\Domain\SuperMagic\File\Event\AttachmentsProcessedEvent;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileVersionRepositoryInterface;
use App\Domain\SuperMagic\Message\Entity\ValueObject\MessageMetadata;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ProjectForkEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ForkStatus;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectForkRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Task\Entity\TaskEntity;
use App\Domain\SuperMagic\Task\Repository\Facade\TaskRepositoryInterface;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Topic\Repository\Facade\TopicRepositoryInterface;
use App\Domain\SuperMagic\Workspace\Repository\Facade\WorkspaceVersionRepositoryInterface;
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\CloudFile\ImageProcessFactory;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use App\Infrastructure\SuperMagic\Utils\FileDownloadUrlHelper;
use App\Infrastructure\SuperMagic\Utils\FileSortUtil;
use App\Infrastructure\SuperMagic\Utils\WorkDirectoryUtil;
use App\Infrastructure\SuperMagic\Utils\WorkFileUtil;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Psr\SimpleCache\CacheInterface;
use RuntimeException;
use Throwable;

use function Hyperf\Translation\trans;

class TaskFileDomainService
{
    public const URL_EXPIRES = 3600;

    // File move operation constants
    private const FILE_MOVE_LOCK_PREFIX = 'file_move_operation';

    private const LOCK_TIMEOUT = 30;

    private const DEFAULT_SORT_STEP = 1024;

    private const MIN_GAP = 10;

    // File URL cache constants
    private const FILE_URL_CACHE_PREFIX = 'super_agent:file_url:';

    private const CACHE_TTL = 3540;

    private const FILE_COPY_BATCH_SIZE = 100;

    private const FILE_COPY_MAX_ATTEMPTS = 3;

    private const URL_EXPIRY_BUFFER = 60;

    private readonly LoggerInterface $logger;

    public function __construct(
        protected TaskRepositoryInterface $taskRepository,
        protected TaskFileRepositoryInterface $taskFileRepository,
        protected WorkspaceVersionRepositoryInterface $workspaceVersionRepository,
        protected TopicRepositoryInterface $topicRepository,
        protected CloudFileRepositoryInterface $cloudFileRepository,
        protected ProjectRepositoryInterface $projectRepository,
        protected ProjectForkRepositoryInterface $projectForkRepository,
        protected SandboxGatewayInterface $sandboxGateway,
        protected LockerInterface $locker,
        protected TaskFileVersionRepositoryInterface $taskFileVersionRepository,
        protected CacheInterface $cache,
        protected AgentDomainService $agentDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    public function getProjectFilesFromCloudStorage(string $organizationCode, string $workDir): array
    {
        return $this->cloudFileRepository->listObjectsByCredential(
            $organizationCode,
            $workDir,
            StorageBucketType::SandBox,
        );
    }

    /**
     * Get file by ID.
     */
    public function getById(int $id): ?TaskFileEntity
    {
        return $this->taskFileRepository->getById($id);
    }

    /**
     * @return TaskFileEntity[]
     */
    public function getCopiesBySourceFileId(int $sourceFileId): array
    {
        return $this->taskFileRepository->getCopiesBySourceFileId($sourceFileId);
    }

    public function isProjectSpaceFile(TaskFileEntity $fileEntity): bool
    {
        return $fileEntity->getSpaceType() === FileSpaceType::PROJECT->value;
    }

    /**
     * Filter a batch of file entities to project-space files without issuing
     * one database query per entity.
     *
     * @param TaskFileEntity[] $fileEntities
     * @return TaskFileEntity[]
     */
    public function filterProjectSpaceFiles(array $fileEntities): array
    {
        return array_values(array_filter(
            $fileEntities,
            fn (TaskFileEntity $fileEntity): bool => $this->isProjectSpaceFile($fileEntity)
        ));
    }

    /**
     * Batch-load project-space files by IDs.
     *
     * @param int[] $fileIds
     * @return TaskFileEntity[]
     */
    public function getProjectSpaceFilesByIds(array $fileIds, int $projectId = 0): array
    {
        return $this->getFilesByIds($fileIds, $projectId, FileSpaceType::PROJECT->value);
    }

    public function shouldEnterRecycleBin(TaskFileEntity $fileEntity, DeleteEventSource $source): bool
    {
        return $fileEntity->getFileId() > 0
            && $this->isProjectSpaceFile($fileEntity)
            && in_array($source, [DeleteEventSource::User, DeleteEventSource::Agent], true);
    }

    /**
     * 根据项目ID获取项目目录，避免跨项目使用 parent_id。
     */
    public function getDirectoryByIdAndProject(int $parentId, int $projectId): ?TaskFileEntity
    {
        return $this->taskFileRepository->getDirectoryByIdAndProject($parentId, $projectId);
    }

    /**
     * 根据文件编号获取文件实体，不限制文件所属空间。
     */
    public function getFileEntityById(int $fileId): TaskFileEntity
    {
        $fileEntity = $this->taskFileRepository->getById($fileId);
        if ($fileEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
        }

        return $fileEntity;
    }

    /**
     * Get file by ID, including soft-deleted records.
     */
    public function getByIdWithTrash(int $id): ?TaskFileEntity
    {
        return $this->taskFileRepository->getByIdWithTrash($id);
    }

    /**
     * Get project root directory file ID for sandbox initialization.
     *
     * @throws BusinessException
     */
    public function getProjectRootFileId(int $projectId): int
    {
        $rootDir = $this->taskFileRepository->findRootDirectoryByProjectId($projectId);
        if ($rootDir === null) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::FILE_NOT_FOUND,
                trans('file.root_directory_not_found')
            );
        }

        return $rootDir->getFileId();
    }

    /**
     * Get file by file key.
     */
    public function getByFileKey(string $fileKey): ?TaskFileEntity
    {
        return $this->taskFileRepository->getByFileKey($fileKey);
    }

    /**
     * Get file by project ID and file key.
     */
    public function getByProjectIdAndFileKey(int $projectId, string $fileKey, bool $withTrash = false): ?TaskFileEntity
    {
        return $this->taskFileRepository->getByProjectIdAndFileKey($projectId, $fileKey, $withTrash);
    }

    public function getByProjectParentAndName(int $projectId, ?int $parentId, string $fileName, bool $withTrash = false): ?TaskFileEntity
    {
        return $this->taskFileRepository->getByProjectParentAndName($projectId, $parentId, $fileName, $withTrash);
    }

    /**
     * 根据父目录批量获取指定名称的直接子节点，避免逐个文件查询。
     *
     * @param string[] $fileNames
     * @return array<string, TaskFileEntity> 以文件名为键的文件实体
     */
    public function getByProjectParentAndNames(int $projectId, int $parentId, array $fileNames): array
    {
        return $this->taskFileRepository->getByProjectParentAndNames($projectId, $parentId, $fileNames);
    }

    /**
     * Find user files by file IDs and user ID.
     *
     * @param array $fileIds File ID array
     * @param string $userId User ID
     * @return TaskFileEntity[] User file list
     */
    public function findUserFilesByIds(array $fileIds, string $userId): array
    {
        return $this->taskFileRepository->findUserFilesByIds($fileIds, $userId);
    }

    /**
     * @return TaskFileEntity[] User file list
     */
    public function findFilesByProjectIdAndIds(int $projectId, array $fileIds): array
    {
        return $this->taskFileRepository->findFilesByProjectIdAndIds($projectId, $fileIds);
    }

    /**
     * @return TaskFileEntity[] User file list
     */
    public function findUserFilesByTopicId(string $topicId): array
    {
        return $this->taskFileRepository->findUserFilesByTopicId($topicId);
    }

    public function findUserFilesByProjectId(string $projectId): array
    {
        return $this->taskFileRepository->findUserFilesByProjectId($projectId);
    }

    /**
     * Get children files by parent_id and project_id.
     * Uses existing index: idx_project_parent_sort.
     *
     * @param int $projectId Project ID
     * @param int $parentId Parent directory ID
     * @param int $limit Maximum number of files to return
     * @return TaskFileEntity[] File entity list
     */
    public function getChildrenByParentAndProject(int $projectId, int $parentId, int $limit = 500): array
    {
        return $this->taskFileRepository->getChildrenByParentAndProject($projectId, $parentId, $limit);
    }

    /**
     * 根据项目ID获取根节点文件.
     *
     * @param int $projectId 项目ID
     * @return null|TaskFileEntity 根节点文件实体
     */
    public function getRootFile(int $projectId): ?TaskFileEntity
    {
        return $this->taskFileRepository->getRootFileByProjectId($projectId);
    }

    public function getTopicRootDirectory(int $projectId, int $topicId, string $organizationCode): ?TaskFileEntity
    {
        return $this->taskFileRepository->findTopicSpaceRootDirectory($projectId, $topicId, $organizationCode);
    }

    /**
     * Get topic files using a stable file id cursor.
     */
    public function getTopicFilesByCursor(int $topicId, int $rootFileId, ?int $afterFileId, int $limit): array
    {
        return $this->taskFileRepository->getTopicFilesByCursor($topicId, $rootFileId, $afterFileId, $limit);
    }

    /**
     * Get a topic file tree page without creating directories.
     *
     * @return array{list: TaskFileEntity[], total: int, next_cursor: ?int}
     */
    public function getFilesForCopy(TaskFileEntity $sourceRootFile, ?int $afterFileId = null, int $limit = 200): array
    {
        if ($sourceRootFile->getSpaceType() === FileSpaceType::PROJECT->value) {
            $rawFiles = $this->taskFileRepository->getFilesByProjectIdWithResume(
                $sourceRootFile->getProjectId(),
                $afterFileId,
                $limit + 1
            );
            $files = array_slice(array_values(array_filter(
                $rawFiles,
                fn (TaskFileEntity $file) => $file->getFileId() !== $sourceRootFile->getFileId()
            )), 0, $limit);
            return [
                'list' => $files,
                'total' => count($files),
                'next_cursor' => count($rawFiles) > $limit && $files !== [] ? end($files)->getFileId() : null,
            ];
        }

        $files = $this->taskFileRepository->getTopicFilesByCursor(
            $sourceRootFile->getTopicId(),
            $sourceRootFile->getFileId(),
            $afterFileId,
            $limit
        );

        $nextCursor = count($files) === $limit ? end($files)->getFileId() : null;
        return [
            'list' => $files,
            'total' => $this->taskFileRepository->countTopicFilesForCopy(
                $sourceRootFile->getTopicId(),
                $sourceRootFile->getFileId()
            ),
            'next_cursor' => $nextCursor,
        ];
    }

    /**
     * Copy one page of a Task File tree under a new root.
     *
     * @return array{total: int, directories: int, files: int, copied: int, skipped: int, failed: int, failed_file_keys: string[], source_to_target: array<int, int>, source_to_target_file_keys: array<string, string>}
     */
    public function copyFileList(
        DataIsolation $dataIsolation,
        TaskFileEntity $sourceRootFile,
        TaskFileEntity $targetRootFile,
        array $sourceFiles,
        array &$sourceToTarget = [],
        array &$pendingParentIds = [],
        ?callable $progressCallback = null,
        ?int $targetTopicId = null
    ): array {
        $result = [
            'total' => count($sourceFiles), 'directories' => 0, 'files' => 0,
            'copied' => 0, 'skipped' => 0, 'failed' => 0, 'failed_file_keys' => [],
            'source_to_target' => [], 'source_to_target_file_keys' => [],
        ];
        $targetRootKey = rtrim($targetRootFile->getFileKey(), '/');
        $copyBatch = [];
        $copyEntities = [];

        foreach ($sourceFiles as $sourceFile) {
            $newFileId = IdGenerator::getSnowId();
            // MagicFS uses the generated file ID as the final object-key segment
            // for ordinary files and directories. Only the already-created space
            // root keeps its special deterministic key with a trailing slash.
            $targetKey = $this->buildCopiedFileKey($targetRootKey, $newFileId);
            $existingFile = $this->taskFileRepository->getByFileKey($targetKey);
            if ($existingFile !== null) {
                $sourceToTarget[$sourceFile->getFileId()] = $existingFile->getFileId();
                $result['source_to_target_file_keys'][$sourceFile->getFileKey()] = $existingFile->getFileKey();
                ++$result['skipped'];
                continue;
            }
            $sourceParentId = $sourceFile->getParentId();
            $parentId = $sourceToTarget[$sourceParentId] ?? $targetRootFile->getFileId();
            if ($sourceParentId !== null && ! isset($sourceToTarget[$sourceParentId])) {
                $pendingParentIds[] = [
                    'source_file_id' => $sourceFile->getFileId(),
                    'new_id' => null,
                    'old_parent_id' => $sourceParentId,
                ];
            }

            if ($sourceFile->getIsDirectory()) {
                ++$result['directories'];
                try {
                    $this->cloudFileRepository->createFolderByCredential(
                        WorkDirectoryUtil::getPrefix($targetKey),
                        $dataIsolation->getCurrentOrganizationCode(),
                        $targetKey,
                        StorageBucketType::SandBox,
                        ['metadata' => WorkDirectoryUtil::generateDefaultWorkDirMetadata()]
                    );
                    $newFile = $this->copyTaskFileEntity(
                        $sourceFile,
                        $dataIsolation->getCurrentUserId(),
                        $dataIsolation->getCurrentOrganizationCode(),
                        $targetRootFile->getProjectId(),
                        $targetTopicId ?? $targetRootFile->getTopicId(),
                        $targetKey,
                        $parentId,
                        $newFileId
                    );
                    $newFile->setSource(TaskFileSource::COPY);
                    $created = $this->taskFileRepository->insert($newFile);
                    $sourceToTarget[$sourceFile->getFileId()] = $created->getFileId();
                    $result['source_to_target_file_keys'][$sourceFile->getFileKey()] = $created->getFileKey();
                    $this->setPendingNewFileId($pendingParentIds, $sourceFile->getFileId(), $created->getFileId());
                    ++$result['copied'];
                } catch (Throwable $e) {
                    ++$result['failed'];
                    $result['failed_file_keys'][] = $sourceFile->getFileKey();
                    $this->logger->error('TaskFile tree directory copy failed', ['source_file_key' => $sourceFile->getFileKey(), 'target_file_key' => $targetKey, 'error' => $e->getMessage()]);
                }
                continue;
            }

            ++$result['files'];
            $copyBatch[] = ['source_oss_path' => $sourceFile->getFileKey(), 'target_oss_path' => $targetKey];
            $copyEntities[] = [$sourceFile, $targetKey, $parentId, $newFileId];
            if (count($copyBatch) >= self::FILE_COPY_BATCH_SIZE) {
                $this->copyFileBatch($dataIsolation, $copyBatch, $copyEntities, $targetRootFile, $sourceToTarget, $pendingParentIds, $result, $targetTopicId);
                $copyBatch = [];
                $copyEntities = [];
                $progressCallback && $progressCallback($result);
            }
        }

        if ($copyBatch !== []) {
            $this->copyFileBatch($dataIsolation, $copyBatch, $copyEntities, $targetRootFile, $sourceToTarget, $pendingParentIds, $result, $targetTopicId);
        }

        $result['source_to_target'] = $sourceToTarget;
        return $result;
    }

    public function fixCopiedParentIds(array $pendingParentIds, array $sourceToTarget, string $userId): void
    {
        $groups = [];
        foreach ($pendingParentIds as $pending) {
            $newParentId = $sourceToTarget[$pending['old_parent_id']] ?? null;
            if ($newParentId !== null && $pending['new_id'] !== null) {
                $groups[$newParentId][] = $pending['new_id'];
            }
        }
        foreach ($groups as $newParentId => $fileIds) {
            $this->taskFileRepository->batchUpdateParentId($fileIds, $newParentId, $userId);
        }
    }

    /**
     * Check whether the agent identity file exists strictly at ".magic/IDENTITY.md".
     * The file location is validated purely from the directory tree:
     * root -> .magic -> IDENTITY.md.
     */
    public function existsStrictAgentIdentityFile(int $projectId): bool
    {
        $rootDir = $this->getRootFile($projectId);
        if ($rootDir === null) {
            return false;
        }

        $magicDir = $this->findDirectChildByName(
            $projectId,
            $rootDir->getFileId(),
            '.magic',
            true
        );
        if ($magicDir === null) {
            return false;
        }

        return $this->findDirectChildByName(
            $projectId,
            $magicDir->getFileId(),
            'IDENTITY.md',
            false
        ) !== null;
    }

    /**
     * 递归查询目录下所有文件（使用 parent_id 索引，高性能）.
     * 利用 idx_project_parent_sort 索引进行广度优先遍历.
     * 使用批量查询避免 N+1 问题.
     * 每一层通过分页循环确保不遗漏超过单次 limit 的子项.
     *
     * @param int $projectId 项目ID
     * @param int $parentId 父目录ID
     * @param int $maxDepth 最大递归深度（防止无限递归）
     * @return TaskFileEntity[] 文件实体列表
     */
    public function findFilesRecursivelyByParentId(int $projectId, int $parentId, int $maxDepth = 10): array
    {
        $allFiles = [];
        $currentLevelParentIds = [$parentId];
        $batchLimit = 1000;

        // 广度优先遍历，逐层查询
        for ($depth = 0; $depth < $maxDepth && ! empty($currentLevelParentIds); ++$depth) {
            $nextLevelParentIds = [];
            $offset = 0;

            // 分页循环，确保获取当前层所有子项
            do {
                $children = $this->taskFileRepository->getChildrenByParentIdsAndProject(
                    $projectId,
                    $currentLevelParentIds,
                    $batchLimit,
                    $offset
                );

                foreach ($children as $child) {
                    $allFiles[] = $child;

                    // 如果是目录，加入下一层的查询队列
                    if ($child->getIsDirectory()) {
                        $nextLevelParentIds[] = $child->getFileId();
                    }
                }

                $offset += $batchLimit;
            } while (count($children) >= $batchLimit);

            $currentLevelParentIds = $nextLevelParentIds;
        }

        return $allFiles;
    }

    /**
     * Batch update file_key for multiple files.
     *
     * @param array $updateBatch Array of [['file_id' => 1, 'file_key' => 'new/path', 'updated_at' => '2025-10-27 18:00:00'], ...]
     * @return int Number of updated files
     */
    public function batchUpdateFileKeys(array $updateBatch): int
    {
        return $this->taskFileRepository->batchUpdateFileKeys($updateBatch);
    }

    /**
     * 递归获取文件及其所有父级文件.
     * 用于确保构建文件树时包含完整的父子关系链.
     *
     * @param array $fileIds 文件ID数组
     * @param int $projectId 项目ID（可选，用于过滤）
     * @return TaskFileEntity[] 包含所有父级文件的完整文件列表
     */
    public function getFilesWithParentsByIds(array $fileIds, int $projectId = 0): array
    {
        return $this->taskFileRepository->getFilesWithParentsByIds($fileIds, $projectId);
    }

    /**
     * Keyset cursor pagination over a project's files. Returns raw rows for the
     * V2 attachment list hot path (no entity hydration).
     *
     * @param string[] $fileTypes
     * @return array<int, array<string, mixed>>
     */
    public function getProjectFilesByCursor(
        int $projectId,
        string $storageType,
        ?int $afterFileId,
        int $limit,
        array $fileTypes = [],
        ?string $updatedAfter = null
    ): array {
        return $this->taskFileRepository->getProjectFilesByCursor(
            $projectId,
            $storageType,
            $afterFileId,
            $limit,
            $fileTypes,
            $updatedAfter
        );
    }

    /**
     * Cursor pagination for one parent's direct children using tree order.
     *
     * @param string[] $fileTypes
     * @return array<int, array<string, mixed>>
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
    ): array {
        return $this->taskFileRepository->getProjectFileChildrenByParentCursor(
            $projectId,
            $parentId,
            $storageType,
            $afterSort,
            $afterFileId,
            $limit,
            $fileTypes,
            $fileName,
            $spaceType,
            $topicId,
            $userId,
            $organizationCode,
            $excludeHidden
        );
    }

    /**
     * Cursor pagination for a MagicFS directory whose parent chain is the
     * authoritative file-tree boundary.
     *
     * @param string[] $fileTypes
     * @return array<int, array<string, mixed>>
     */
    public function getFileTreeChildrenByParentCursor(
        int $parentId,
        string $storageType,
        ?int $afterSort,
        ?int $afterFileId,
        int $limit,
        array $fileTypes = [],
        string $fileName = ''
    ): array {
        return $this->taskFileRepository->getFileTreeChildrenByParentCursor(
            $parentId,
            $storageType,
            $afterSort,
            $afterFileId,
            $limit,
            $fileTypes,
            $fileName
        );
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
        return $this->taskFileRepository->getAllChildrenFileIdsByDirectoryIds($directoryIds, $projectId, $maxDepth, $includeDirectories);
    }

    /**
     * 根据文件ID批量获取文件实体.
     *
     * @param array $fileIds 文件ID数组
     * @param int $projectId 项目ID（可选，用于过滤）
     * @param null|string $spaceType 文件空间类型（可选，用于过滤）
     * @return TaskFileEntity[] 文件实体列表
     */
    public function getFilesByIds(array $fileIds, int $projectId = 0, ?string $spaceType = null): array
    {
        return $this->taskFileRepository->getFilesByIds($fileIds, $projectId, $spaceType);
    }

    /**
     * 根据文件ID批量获取文件实体，包含已软删除记录.
     *
     * @param array<int|string> $fileIds
     * @return TaskFileEntity[]
     */
    public function getFilesByIdsWithTrash(array $fileIds, int $projectId = 0, ?string $spaceType = null): array
    {
        return $this->taskFileRepository->getFilesByIdsWithTrash($fileIds, $projectId, $spaceType);
    }

    /**
     * Get the latest updated file by project ID.
     */
    public function getLatestUpdatedByProjectId(int $projectId): string
    {
        // Use optimized method to get only the time string, avoiding Model instantiation and Enum reflection
        $lastUpdatedTime = $this->taskFileRepository->getLatestUpdatedTimeByProjectId($projectId);

        // 获取版本更新时间
        $lastVersionEntity = $this->workspaceVersionRepository->getLatestUpdateVersionProjectId($projectId);
        if ($lastVersionEntity) {
            $versionUpdatedTime = $lastVersionEntity->getUpdatedAt();

            // 使用 strtotime 进行更安全的时间比较
            if ($lastUpdatedTime === null || strtotime($versionUpdatedTime) > strtotime($lastUpdatedTime)) {
                $lastUpdatedTime = $versionUpdatedTime;
            }
        }

        // 如果两个时间都为空，返回空字符串；否则返回最新时间
        return $lastUpdatedTime ?? '';
    }

    /**
     * Get file list by topic ID.
     *
     * @param int $topicId Topic ID
     * @param int $page Page number
     * @param int $pageSize Page size
     * @param array $fileType File type filter
     * @param string $storageType Storage type
     * @return array{list: TaskFileEntity[], total: int} File list and total count
     */
    public function getByTopicId(int $topicId, int $page, int $pageSize, array $fileType = [], string $storageType = 'workspace'): array
    {
        return $this->taskFileRepository->getByTopicId($topicId, $page, $pageSize, $fileType, $storageType);
    }

    /**
     * Get file list by task ID.
     *
     * @param int $taskId Task ID
     * @param int $page Page number
     * @param int $pageSize Page size
     * @return array{list: TaskFileEntity[], total: int} File list and total count
     */
    public function getByTaskId(int $taskId, int $page, int $pageSize): array
    {
        return $this->taskFileRepository->getByTaskId($taskId, $page, $pageSize);
    }

    /**
     * Insert file.
     */
    public function insert(TaskFileEntity $entity): TaskFileEntity
    {
        return $this->taskFileRepository->insert($entity);
    }

    /**
     * Insert file or ignore if conflict.
     */
    public function insertOrIgnore(TaskFileEntity $entity): ?TaskFileEntity
    {
        return $this->taskFileRepository->insertOrIgnore($entity);
    }

    /**
     * Determine if a file should be hidden based on its relative path from project root.
     * Builds relative path by querying parent chain in one query, then checks each segment
     * against known hidden directory names.
     */
    public function determineIsHidden(string $fileName, ?int $parentId, int $projectId = 0): bool
    {
        // Quick check: if file name itself is a hidden directory
        if (WorkFileUtil::isHiddenFileName($fileName)) {
            return true;
        }

        if ($parentId === null || $parentId <= 0) {
            return false;
        }

        // Get all ancestor entities in one query
        $ancestorEntities = $this->taskFileRepository->getFilesWithParentsByIds([$parentId], $projectId);

        // Check if any ancestor's name matches hidden directory
        foreach ($ancestorEntities as $ancestor) {
            if (WorkFileUtil::isHiddenFileName($ancestor->getFileName())) {
                return true;
            }
        }

        return false;
    }

    /**
     * Filter out entities whose fileName matches given directory names and all their descendants.
     *
     * @param TaskFileEntity[] $entities
     * @param string[] $directoryNames directory names to match (e.g. ['.magic'])
     * @return TaskFileEntity[]
     */
    public function filterOutDescendantsByDirectoryNames(array $entities, array $directoryNames): array
    {
        if (empty($entities) || empty($directoryNames)) {
            return $entities;
        }

        // Find target directory IDs
        $targetDirIds = [];
        foreach ($entities as $entity) {
            if ($entity->getIsDirectory() && in_array($entity->getFileName(), $directoryNames, true)) {
                $targetDirIds[] = $entity->getFileId();
            }
        }

        if (empty($targetDirIds)) {
            return $entities;
        }

        // Build parent_id -> child_ids map
        $parentToChildren = [];
        foreach ($entities as $entity) {
            $parentId = $entity->getParentId() ?? 0;
            $parentToChildren[$parentId][] = $entity->getFileId();
        }

        // BFS to collect all descendant IDs
        $excludeIds = [];
        $queue = $targetDirIds;
        while (! empty($queue)) {
            $currentId = array_shift($queue);
            $excludeIds[$currentId] = true;
            if (isset($parentToChildren[$currentId])) {
                foreach ($parentToChildren[$currentId] as $childId) {
                    if (! isset($excludeIds[$childId])) {
                        $queue[] = $childId;
                    }
                }
            }
        }

        // Filter out
        return array_values(array_filter($entities, fn (TaskFileEntity $e) => ! isset($excludeIds[$e->getFileId()])));
    }

    public function insertOrUpdate(TaskFileEntity $entity): TaskFileEntity
    {
        return $this->taskFileRepository->insertOrUpdate($entity);
    }

    /**
     * Update file by ID.
     */
    public function updateById(TaskFileEntity $entity): TaskFileEntity
    {
        return $this->taskFileRepository->updateById($entity);
    }

    /**
     * Update only the source field of a task file.
     * Only `source` and `updated_at` are written; all other fields are left untouched.
     *
     * @param int $fileId File ID
     * @param TaskFileSource $source New source value
     * @return TaskFileEntity Updated file entity
     * @throws BusinessException When the file is not found
     */
    public function updateFileSource(int $fileId, TaskFileSource $source): TaskFileEntity
    {
        $fileEntity = $this->getById($fileId);
        if ($fileEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND);
        }

        $this->taskFileRepository->updateFileByCondition(
            ['file_id' => $fileId],
            ['source' => $source->value, 'updated_at' => date('Y-m-d H:i:s')]
        );

        $fileEntity->setSource($source);

        return $fileEntity;
    }

    /**
     * Refresh file metadata from cloud storage after content change.
     * Update file_size and updated_at fields.
     *
     * @param TaskFileEntity $fileEntity File entity to refresh
     * @param string $organizationCode Organization code for cloud storage access
     * @return TaskFileEntity Updated file entity
     */
    public function refreshFileMetadataFromCloudStorage(
        TaskFileEntity $fileEntity,
        string $organizationCode
    ): TaskFileEntity {
        // Get file info from cloud storage
        $fileInfo = $this->getFileInfoFromCloudStorage(
            $fileEntity->getFileName(),
            $fileEntity->getFileKey(),
            $organizationCode
        );

        // Update entity fields
        $fileEntity->setFileSize($fileInfo['size']);
        $fileEntity->setUpdatedAt(date('Y-m-d H:i:s'));

        $this->logger->info('Refreshing file metadata from cloud storage', [
            'file_id' => $fileEntity->getFileId(),
            'file_key' => $fileEntity->getFileKey(),
            'new_file_size' => $fileInfo['size'],
        ]);

        // Content may have changed without changing its size (for example, a rollback).
        // MagicFS advances the cache version and journals the final snapshot together.
        return $this->getMagicFSFileDomainService()->updateFile(
            (string) $fileEntity->getFileId(),
            ['size' => $fileInfo['size']]
        );
    }

    /**
     * Delete file by ID.
     */
    public function deleteById(int $id): void
    {
        $this->taskFileRepository->deleteById($id);
    }

    /**
     * Bind files to project with proper parent directory setup.
     *
     * Note: This method assumes all files are in the same directory level.
     * It uses the first file's path to determine the parent directory for all files.
     * If files are from different directories, they will all be placed in the same parent directory.
     *
     * @param DataIsolation $dataIsolation Data isolation context for permission check
     * @param array $fileIds Array of file IDs to bind
     * @param string $workDir Project work directory
     * @return bool Whether binding was successful
     */
    public function bindProjectFiles(
        DataIsolation $dataIsolation,
        ProjectEntity $projectEntity,
        array $fileIds,
        string $workDir
    ): bool {
        if (empty($fileIds)) {
            return true;
        }

        // 1. Permission check: only query files belonging to current user
        $fileEntities = $this->taskFileRepository->findUserFilesByIds(
            $fileIds,
            $dataIsolation->getCurrentUserId()
        );

        if (empty($fileEntities)) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::FILE_NOT_FOUND,
                trans('file.files_not_found_or_no_permission')
            );
        }

        // 2. Find or create project root directory as parent directory
        $parentId = $this->findOrCreateDirectoryAndGetParentId(
            projectId: $projectEntity->getId(),
            userId: $dataIsolation->getCurrentUserId(),
            organizationCode: $dataIsolation->getCurrentOrganizationCode(),
            projectOrganizationCode: $projectEntity->getUserOrganizationCode(),
            fullFileKey: $fileEntities[0]->getFileKey(),
            workDir: $workDir,
        );

        // 3. Filter unbound files and prepare for batch update
        $unboundFileIds = [];
        foreach ($fileEntities as $fileEntity) {
            if ($fileEntity->getProjectId() <= 0) {
                $unboundFileIds[] = $fileEntity->getFileId();
            }
        }

        if (empty($unboundFileIds)) {
            return true; // All files already bound, no operation needed
        }

        // 4. Batch update: set both project_id and parent_id atomically
        $this->taskFileRepository->batchBindToProject(
            $unboundFileIds,
            $projectEntity->getId(),
            $parentId
        );

        return true;
    }

    /**
     * Save project file.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param ProjectEntity $projectEntity Project entity
     * @param TaskFileEntity $taskFileEntity Task file entity with data to save
     * @param string $storageType Storage type
     * @param bool $isUpdated Whether the file is updated
     * @return null|TaskFileEntity Saved file entity
     * @throws Throwable
     */
    public function saveProjectFile(
        DataIsolation $dataIsolation,
        ProjectEntity $projectEntity,
        TaskFileEntity $taskFileEntity,
        string $storageType = '',
        bool $isUpdated = true,
        bool $withTrash = true,
    ): ?TaskFileEntity {
        return $this->upsertProjectFileNode(
            new UpsertProjectFileNodeDTO(
                projectId: $projectEntity->getId(),
                projectWorkDir: $projectEntity->getWorkDir(),
                projectOrganizationCode: $projectEntity->getUserOrganizationCode(),
                operatorUserId: $dataIsolation->getCurrentUserId(),
                operatorOrganizationCode: $dataIsolation->getCurrentOrganizationCode(),
                taskFileEntity: $taskFileEntity,
                storageTypeOverride: $storageType,
                isUpdated: $isUpdated,
                withTrash: $withTrash,
            )
        );
    }

    /**
     * Create project file or folder.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param ProjectEntity $projectEntity Project entity
     * @param int $parentId Parent file ID (0 for root)
     * @param string $fileName File name
     * @param bool $isDirectory Whether it's a directory
     * @return TaskFileEntity Created file entity
     */
    public function createProjectFile(
        DataIsolation $dataIsolation,
        ProjectEntity $projectEntity,
        int $parentId,
        string $fileName,
        bool $isDirectory,
        int $sortValue = 0
    ): TaskFileEntity {
        $projectOrganizationCode = $projectEntity->getUserOrganizationCode();
        $workDir = $projectEntity->getWorkDir();

        if (empty($workDir)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORK_DIR_NOT_FOUND, trans('project.work_dir.not_found'));
        }

        $fullPrefix = $this->getFullPrefix($projectOrganizationCode);
        if (! empty($parentId)) {
            $parentFIleEntity = $this->taskFileRepository->getById($parentId);
            if ($parentFIleEntity === null || $parentFIleEntity->getProjectId() != $projectEntity->getId()) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
            }
            $fileKey = rtrim($parentFIleEntity->getFileKey(), '/') . '/' . $fileName;
        } else {
            $fileKey = WorkDirectoryUtil::getFullFileKey($fullPrefix, $workDir, $fileName);
        }

        if ($isDirectory) {
            $fileKey = rtrim($fileKey, '/') . '/';
        }

        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $workDir);
        if (! WorkDirectoryUtil::checkEffectiveFileKey($fullWorkdir, $fileKey)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_ILLEGAL_KEY, trans('file.illegal_file_key'));
        }

        // Check if file already exists
        $existingFile = $this->taskFileRepository->getByFileKey($fileKey);
        if ($existingFile !== null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_EXIST, trans('file.file_exist'));
        }

        Db::beginTransaction();
        try {
            // Create object in cloud storage
            if ($isDirectory) {
                $this->cloudFileRepository->createFolderByCredential(WorkDirectoryUtil::getPrefix($workDir), $projectOrganizationCode, $fileKey, StorageBucketType::SandBox);
            } else {
                $this->cloudFileRepository->createFileByCredential(WorkDirectoryUtil::getPrefix($workDir), $projectOrganizationCode, $fileKey, '', StorageBucketType::SandBox);
            }

            // Create file entity
            $taskFileEntity = new TaskFileEntity();
            $taskFileEntity->setFileId(IdGenerator::getSnowId());
            $taskFileEntity->setProjectId($projectEntity->getId());
            $taskFileEntity->setFileKey($fileKey);
            $taskFileEntity->setFileName($fileName);
            $taskFileEntity->setFileSize(0); // Empty file/folder initially
            $taskFileEntity->setFileType(FileType::USER_UPLOAD->value);
            $taskFileEntity->setIsDirectory($isDirectory);
            $taskFileEntity->setParentId($parentId === 0 ? null : $parentId);
            $taskFileEntity->setSource(TaskFileSource::PROJECT_DIRECTORY);
            $taskFileEntity->setStorageType(StorageType::WORKSPACE);
            $taskFileEntity->setUserId($dataIsolation->getCurrentUserId());
            $taskFileEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
            $taskFileEntity->setIsHidden($this->determineIsHidden($fileName, $parentId === 0 ? null : $parentId, $projectEntity->getId()));
            $taskFileEntity->setSort($sortValue);

            // Extract file extension for files
            if (! $isDirectory && ! empty($fileName)) {
                $fileExtension = pathinfo($fileName, PATHINFO_EXTENSION);
                $taskFileEntity->setFileExtension($fileExtension);
            }

            // Set timestamps
            $now = date('Y-m-d H:i:s');
            $taskFileEntity->setCreatedAt($now);
            $taskFileEntity->setUpdatedAt($now);

            // Save to database
            $taskFileEntity = $this->insertOrUpdate($taskFileEntity);

            // A new child changes its containing directory's listing; the
            // child's own row was appended by insertOrUpdate above.
            if ($parentId > 0) {
                $this->bumpFileTreeVersions([$parentId]);
            }

            Db::commit();
            return $taskFileEntity;
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
    }

    /**
     * Create a project file with content and upload it to cloud storage.
     *
     * Unlike createProjectFile (which creates empty files), this method uploads actual
     * file content to the cloud storage backend. Suitable for initializing template files
     * at project creation time. If a file with the same key already exists, it is returned
     * as-is for idempotency (no exception is thrown). This method does not open its own
     * database transaction and must be called within an existing transaction.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param ProjectEntity $projectEntity Project entity
     * @param int $parentId Parent file ID (0 for project root)
     * @param string $fileName File name
     * @param string $content Raw file content to upload
     * @param TaskFileSource $source File source tag
     * @return TaskFileEntity Created (or pre-existing) file entity
     */
    public function createProjectFileWithContent(
        DataIsolation $dataIsolation,
        ProjectEntity $projectEntity,
        int $parentId,
        string $fileName,
        string $content,
        TaskFileSource $source = TaskFileSource::PROJECT_DIRECTORY
    ): TaskFileEntity {
        $projectOrganizationCode = $projectEntity->getUserOrganizationCode();
        $workDir = $projectEntity->getWorkDir();

        if (empty($workDir)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORK_DIR_NOT_FOUND, trans('project.work_dir.not_found'));
        }

        $fullPrefix = $this->getFullPrefix($projectOrganizationCode);
        if (! empty($parentId)) {
            $parentFileEntity = $this->taskFileRepository->getById($parentId);
            if ($parentFileEntity === null || $parentFileEntity->getProjectId() != $projectEntity->getId()) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
            }
            $fileKey = rtrim($parentFileEntity->getFileKey(), '/') . '/' . $fileName;
        } else {
            $fileKey = WorkDirectoryUtil::getFullFileKey($fullPrefix, $workDir, $fileName);
        }

        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $workDir);
        if (! WorkDirectoryUtil::checkEffectiveFileKey($fullWorkdir, $fileKey)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_ILLEGAL_KEY, trans('file.illegal_file_key'));
        }

        // Return existing file for idempotency instead of throwing
        $existingFile = $this->taskFileRepository->getByFileKey($fileKey);
        if ($existingFile !== null) {
            return $existingFile;
        }

        // Upload content to cloud storage
        $this->cloudFileRepository->createFileByCredential(
            WorkDirectoryUtil::getPrefix($workDir),
            $projectOrganizationCode,
            $fileKey,
            $content,
            StorageBucketType::SandBox
        );

        $taskFileEntity = new TaskFileEntity();
        $taskFileEntity->setFileId(IdGenerator::getSnowId());
        $taskFileEntity->setProjectId($projectEntity->getId());
        $taskFileEntity->setFileKey($fileKey);
        $taskFileEntity->setFileName($fileName);
        $taskFileEntity->setFileSize(strlen($content));
        $taskFileEntity->setFileType(FileType::USER_UPLOAD->value);
        $taskFileEntity->setIsDirectory(false);
        $taskFileEntity->setParentId($parentId === 0 ? null : $parentId);
        $taskFileEntity->setSource($source);
        $taskFileEntity->setStorageType(StorageType::WORKSPACE);
        $taskFileEntity->setUserId($dataIsolation->getCurrentUserId());
        $taskFileEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $taskFileEntity->setIsHidden($this->determineIsHidden($fileName, $parentId === 0 ? null : $parentId, $projectEntity->getId()));
        $taskFileEntity->setSort(0);

        if (! empty($fileName)) {
            $taskFileEntity->setFileExtension(pathinfo($fileName, PATHINFO_EXTENSION));
        }

        $now = date('Y-m-d H:i:s');
        $taskFileEntity->setCreatedAt($now);
        $taskFileEntity->setUpdatedAt($now);

        $taskFileEntity = $this->insertOrUpdate($taskFileEntity);

        // Keep project-file creation consistent with createFile(): a new child
        // changes the containing directory's listing. The child's own row is
        // appended by insertOrUpdate above; idempotent existing files return
        // before this, so it runs only for new rows.
        if ($parentId > 0) {
            $this->bumpFileTreeVersions([$parentId]);
        }

        return $taskFileEntity;
    }

    public function deleteProjectFiles(string $projectOrganizationCode, TaskFileEntity $fileEntity, string $workDir): bool
    {
        $fullPrefix = $this->getFullPrefix($projectOrganizationCode);
        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $workDir);
        if (! WorkDirectoryUtil::checkEffectiveFileKey($fullWorkdir, $fileEntity->getFileKey())) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_ILLEGAL_KEY, trans('file.illegal_file_key'));
        }

        // Delete cloud file
        try {
            $prefix = WorkDirectoryUtil::getPrefix($workDir);
            $this->cloudFileRepository->deleteObjectByCredential($prefix, $projectOrganizationCode, $fileEntity->getFileKey(), StorageBucketType::SandBox);
        } catch (Throwable $e) {
            $this->logger->warning('Failed to delete cloud file', ['file_key' => $fileEntity->getFileKey(), 'error' => $e->getMessage()]);
        }

        // Delete file record
        $this->taskFileRepository->deleteById($fileEntity->getFileId());

        return true;
    }

    public function deleteDirectoryFiles(DataIsolation $dataIsolation, string $workDir, int $projectId, string $targetPath, string $projectOrganizationCode): int
    {
        Db::beginTransaction();
        try {
            // 1. 查找目录下所有文件（限制500条）
            $fileEntities = $this->taskFileRepository->findFilesByDirectoryPath($projectId, $targetPath);

            if (empty($fileEntities)) {
                Db::commit();
                return 0;
            }
            $deletedCount = 0;
            $fullPrefix = $this->getFullPrefix($projectOrganizationCode);
            $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $workDir);
            $prefix = WorkDirectoryUtil::getPrefix($workDir);

            // 3. 批量删除云存储文件
            $fileKeys = [];
            foreach ($fileEntities as $fileEntity) {
                if (WorkDirectoryUtil::checkEffectiveFileKey($fullWorkdir, $fileEntity->getFileKey())) {
                    $fileKeys[] = $fileEntity->getFileKey();
                }
            }

            // 删除云存储文件（批量操作）
            if (! empty($fileKeys)) {
                try {
                    $deleteResult = $this->cloudFileRepository->deleteObjectsByCredential(
                        $prefix,
                        $projectOrganizationCode,
                        $fileKeys,
                        StorageBucketType::SandBox
                    );

                    // 统计成功删除的文件数量
                    $deletedCount = count($deleteResult['deleted']);

                    // 记录删除失败的文件
                    if (! empty($deleteResult['errors'])) {
                        foreach ($deleteResult['errors'] as $error) {
                            $this->logger->error('Failed to delete cloud file in batch', [
                                'file_key' => $error['key'],
                                'error_code' => $error['code'] ?? 'unknown',
                                'error_message' => $error['message'] ?? 'unknown error',
                            ]);
                        }
                    }

                    $this->logger->info('Batch delete cloud files completed', [
                        'total_files' => count($fileKeys),
                        'deleted_count' => $deletedCount,
                        'failed_count' => count($deleteResult['errors']),
                    ]);
                } catch (Throwable $e) {
                    $this->logger->error('Failed to batch delete cloud files', [
                        'file_count' => count($fileKeys),
                        'error' => $e->getMessage(),
                    ]);

                    // 批量删除失败时，记录为0个成功删除
                    $deletedCount = 0;
                }
            }

            // 4. 批量删除数据库记录
            $fileIds = array_map(fn ($entity) => $entity->getFileId(), $fileEntities);
            // 根据文件ID批量删除数据库记录
            $this->taskFileRepository->deleteByIds($fileIds);

            Db::commit();
            return $deletedCount;
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
    }

    /**
     * Batch delete project files by file IDs.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param string $workDir Project work directory
     * @param int $projectId Project ID
     * @param array $fileIds Array of file IDs to delete
     * @param bool $forceDelete Whether to force delete (optional)
     * @return array Result with counts of deleted files
     */
    public function batchDeleteProjectFiles(DataIsolation $dataIsolation, string $workDir, int $projectId, array $fileIds, bool $forceDelete = false, ?string $projectOrganizationCode = null): array
    {
        $projectOrganizationCode = $projectOrganizationCode ?? $dataIsolation->getCurrentOrganizationCode();
        $userId = $dataIsolation->getCurrentUserId();

        try {
            // 1. Batch get file entities by IDs (performance optimized)
            $fileEntities = $this->taskFileRepository->getFilesByIds($fileIds);

            if (empty($fileEntities)) {
                return [
                    'project_id' => $projectId,
                    'total_files' => count($fileIds),
                ];
            }

            $fullPrefix = $this->getFullPrefix($projectOrganizationCode);
            $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $workDir);
            $prefix = WorkDirectoryUtil::getPrefix($workDir);
            // 2. Validate permissions and project ownership
            $fileKeys = [];
            foreach ($fileEntities as $fileEntity) {
                // Validate file ownership
                if ($fileEntity->getUserId() !== $userId) {
                    $this->logger->error('File ownership validation failed', [
                        'file_id' => $fileEntity->getFileId(),
                        'user_id' => $userId,
                        'file_user_id' => $fileEntity->getUserId(),
                    ]);
                    continue; // Skip if force delete
                }

                // Validate file belongs to the project
                if ($fileEntity->getProjectId() !== $projectId) {
                    $this->logger->error('File project ownership validation failed', [
                        'file_id' => $fileEntity->getFileId(),
                        'project_id' => $projectId,
                        'file_project_id' => $fileEntity->getProjectId(),
                    ]);
                    continue; // Skip if force delete
                }

                $fileKeys[] = $fileEntity->getFileKey();
            }

            // 3. Delete cloud files
            if (! empty($fileKeys)) {
                try {
                    $deleteResult = $this->cloudFileRepository->deleteObjectsByCredential(
                        $prefix,
                        $projectOrganizationCode,
                        $fileKeys,
                        StorageBucketType::SandBox
                    );

                    // 统计成功删除的文件数量
                    $deletedCount = count($deleteResult['deleted']);

                    // 记录删除失败的文件
                    if (! empty($deleteResult['errors'])) {
                        foreach ($deleteResult['errors'] as $error) {
                            $this->logger->error('Failed to delete cloud file in batch', [
                                'file_key' => $error['key'],
                                'error_code' => $error['code'] ?? 'unknown',
                                'error_message' => $error['message'] ?? 'unknown error',
                            ]);
                        }
                    }

                    $this->logger->info('Batch delete cloud files completed', [
                        'total_files' => count($fileKeys),
                        'deleted_count' => $deletedCount,
                        'failed_count' => count($deleteResult['errors']),
                    ]);
                } catch (Throwable $e) {
                    $this->logger->error('Failed to batch delete cloud files', [
                        'file_count' => count($fileKeys),
                        'error' => $e->getMessage(),
                    ]);

                    // 批量删除失败时，记录为0个成功删除
                    $deletedCount = 0;
                }
            }

            // 4. 批量删除数据库记录
            $fileIds = array_map(fn ($entity) => $entity->getFileId(), $fileEntities);
            // 根据文件ID批量删除数据库记录
            $this->taskFileRepository->deleteByIds($fileIds);

            return [
                'project_id' => $projectId,
                'total_files' => count($fileIds),
            ];
        } catch (Throwable $e) {
            throw $e;
        }
    }

    public function renameProjectFile(DataIsolation $dataIsolation, TaskFileEntity $fileEntity, ProjectEntity $projectEntity, string $targetName): TaskFileEntity
    {
        $projectOrganizationCode = $projectEntity->getUserOrganizationCode();
        $workDir = $projectEntity->getWorkDir();

        $dir = dirname($fileEntity->getFileKey());
        $fullTargetFileKey = $dir . DIRECTORY_SEPARATOR . $targetName;
        $targetFileEntity = $this->taskFileRepository->getByFileKey($fullTargetFileKey);
        if ($targetFileEntity !== null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_EXIST, trans('file.file_exist'));
        }

        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir(
            $this->getFullPrefix($projectOrganizationCode),
            $workDir
        );
        if (! WorkDirectoryUtil::checkEffectiveFileKey($fullWorkdir, $fullTargetFileKey)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_ILLEGAL_KEY, trans('file.illegal_file_key'));
        }

        Db::beginTransaction();
        try {
            $prefix = WorkDirectoryUtil::getPrefix($workDir);
            // call cloud file service
            $this->cloudFileRepository->renameObjectByCredential($prefix, $projectOrganizationCode, $fileEntity->getFileKey(), $fullTargetFileKey, StorageBucketType::SandBox);

            // rename file record
            $fileEntity->setFileKey($fullTargetFileKey);
            $fileEntity->setFileName(basename($fullTargetFileKey));
            $fileExtension = pathinfo(basename($fullTargetFileKey), PATHINFO_EXTENSION);
            $fileEntity->setFileExtension($fileExtension);
            $fileEntity->setUpdatedAt(date('Y-m-d H:i:s'));
            $this->taskFileRepository->updateById($fileEntity);

            Db::commit();
            return $fileEntity;
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
    }

    public function renameDirectoryFiles(DataIsolation $dataIsolation, TaskFileEntity $dirEntity, ProjectEntity $projectEntity, string $newDirName): int
    {
        $projectOrganizationCode = $projectEntity->getUserOrganizationCode();
        $workDir = $projectEntity->getWorkDir();

        $oldDirKey = $dirEntity->getFileKey();
        $parentDir = dirname($oldDirKey);
        $newDirKey = rtrim($parentDir, '/') . '/' . ltrim($newDirName, '/') . '/';

        // Check if target directory name already exists
        $targetFileEntity = $this->taskFileRepository->getByFileKey($newDirKey);
        if ($targetFileEntity !== null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_EXIST, trans('file.file_exist'));
        }

        // Validate new directory key is within work directory
        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir(
            $this->getFullPrefix($projectOrganizationCode),
            $workDir
        );
        if (! WorkDirectoryUtil::checkEffectiveFileKey($fullWorkdir, $newDirKey)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_ILLEGAL_KEY, trans('file.illegal_file_key'));
        }

        Db::beginTransaction();
        try {
            // 1. Find all files in the directory (flat query)
            $fileEntities = $this->taskFileRepository->findFilesByDirectoryPath($dirEntity->getProjectId(), $oldDirKey);

            if (empty($fileEntities)) {
                Db::commit();
                return 0;
            }

            $renamedCount = 0;
            $fullPrefix = $this->getFullPrefix($projectOrganizationCode);
            $prefix = WorkDirectoryUtil::getPrefix($workDir);

            // 2. Batch update file keys in database
            foreach ($fileEntities as $fileEntity) {
                if (! WorkDirectoryUtil::checkEffectiveFileKey($fullWorkdir, $fileEntity->getFileKey())) {
                    continue;
                }

                // Calculate new file key by replacing old directory path with new directory path
                $newFileKey = str_replace($oldDirKey, $newDirKey, $fileEntity->getFileKey());
                $oldFileKey = $fileEntity->getFileKey();

                // Update entity
                $fileEntity->setFileKey($newFileKey);
                if ($fileEntity->getFileId() === $dirEntity->getFileId()) {
                    // Update directory name for the main directory entity
                    $fileEntity->setFileName($newDirName);
                }
                $fileEntity->setUpdatedAt(date('Y-m-d H:i:s'));

                // Update in database
                $this->taskFileRepository->updateById($fileEntity);

                // 3. Rename in cloud storage
                try {
                    $this->cloudFileRepository->renameObjectByCredential($prefix, $projectOrganizationCode, $oldFileKey, $newFileKey, StorageBucketType::SandBox);
                    ++$renamedCount;
                } catch (Throwable $e) {
                    $this->logger->error('Failed to rename file in cloud storage', [
                        'old_file_key' => $oldFileKey,
                        'new_file_key' => $newFileKey,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            Db::commit();
            return $renamedCount;
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
    }

    /**
     * Move project file (supports both same-project and cross-project move).
     *
     * @param DataIsolation $dataIsolation Data isolation
     * @param TaskFileEntity $fileEntity Source file entity
     * @param ProjectEntity $sourceProject Source project entity
     * @param ProjectEntity $targetProject Target project entity
     * @param int $targetParentId Target parent directory ID
     */
    public function moveProjectFile(
        DataIsolation $dataIsolation,
        TaskFileEntity $fileEntity,
        ProjectEntity $sourceProject,
        ProjectEntity $targetProject,
        int $targetParentId,
        DataIsolation $sourceDataIsolation,
        array $keepBothFileIds = []
    ): void {
        if ($targetParentId <= 0) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
        }

        // 1. Get and validate target parent directory
        $targetParentEntity = $this->taskFileRepository->getById($targetParentId);
        if ($targetParentEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.target_parent_not_found'));
        }

        // 2. Validate target parent is a directory
        if (! $targetParentEntity->getIsDirectory()) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterValidationFailed,
                trans('file.target_parent_not_directory')
            );
        }

        // 3. Validate target parent belongs to target project
        if ($targetParentEntity->getProjectId() !== $targetProject->getId()) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::FILE_PERMISSION_DENIED,
                trans('file.target_parent_not_in_target_project')
            );
        }

        $sameProject = $sourceProject->getId() === $targetProject->getId();
        $sameOrganization = $sourceProject->getUserOrganizationCode() === $targetProject->getUserOrganizationCode();

        // 4. Resolve target name and conflict strategy with parent_id + file_name semantics
        $targetFileName = $fileEntity->getFileName();
        $existingTargetFile = $this->taskFileRepository->getByProjectParentAndName(
            $targetProject->getId(),
            $targetParentId,
            $targetFileName
        );

        $sourceFileIdStr = (string) $fileEntity->getFileId();
        $shouldKeepBoth = in_array($sourceFileIdStr, $keepBothFileIds, true);

        if ($existingTargetFile !== null && $existingTargetFile->getFileId() === $fileEntity->getFileId()) {
            // Existing target is source file itself: no conflict.
            $existingTargetFile = null;
            $shouldKeepBoth = false;
        }

        if ($existingTargetFile !== null && $shouldKeepBoth) {
            $targetFileName = $this->generateUniqueFileNameInParent(
                $targetProject->getId(),
                $targetParentId,
                $targetFileName
            );
            $existingTargetFile = null;
        }

        // 5. Resolve target file_key by move domain rule
        $targetFileKey = $fileEntity->getFileKey();
        if (! $sameProject || ! $sameOrganization) {
            $targetFileKey = WorkDirectoryUtil::getFullFileKey(
                $this->getFullPrefix($targetProject->getUserOrganizationCode()),
                $targetProject->getWorkDir(),
                (string) $fileEntity->getFileId()
            );
        }

        // 6. Check if operation actually changes state
        if ($sameProject
            && $fileEntity->getParentId() === $targetParentId
            && $fileEntity->getFileName() === $targetFileName
            && $fileEntity->getFileKey() === $targetFileKey) {
            return; // No change needed
        }

        // 7. Deterministic key collision protection
        if ($targetFileKey !== $fileEntity->getFileKey()) {
            $occupiedFile = $this->taskFileRepository->getByFileKey($targetFileKey);
            if ($occupiedFile !== null && $occupiedFile->getFileId() !== $fileEntity->getFileId()) {
                $this->logger->error('Deterministic target file_key occupied during move', [
                    'source_file_id' => $fileEntity->getFileId(),
                    'occupied_file_id' => $occupiedFile->getFileId(),
                    'target_file_key' => $targetFileKey,
                    'source_project_id' => $sourceProject->getId(),
                    'target_project_id' => $targetProject->getId(),
                ]);
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_MOVE_FAILED, trans('file.file_move_failed'));
            }
        }

        // 8. Execute move operation
        Db::beginTransaction();
        try {
            // Overwrite mode: delete existing target file before move.
            if ($existingTargetFile !== null && ! $shouldKeepBoth) {
                if ($existingTargetFile->getIsDirectory()) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::FILE_EXIST, trans('file.file_exist'));
                }

                $this->taskFileRepository->deleteById($existingTargetFile->getFileId());

                $this->logger->info('Deleted existing target file before move', [
                    'deleted_file_id' => $existingTargetFile->getFileId(),
                    'deleted_file_key' => $existingTargetFile->getFileKey(),
                    'source_file_id' => $fileEntity->getFileId(),
                ]);
            }

            // Now safe to update source file path
            $this->moveFile(
                $fileEntity,
                $sourceProject,
                $targetProject,
                $targetFileKey,
                $targetFileName,
                $targetParentId,
                $sourceDataIsolation
            );

            Db::commit();
        } catch (Throwable $e) {
            Db::rollBack();
            $this->logger->error('moveProjectFile error', [
                'file_id' => $fileEntity->getFileId(),
                'file_key' => $fileEntity->getFileKey(),
                'source_project_id' => $sourceProject->getId(),
                'target_project_id' => $targetProject->getId(),
                'target_parent_id' => $targetParentId,
                'should_keep_both' => $shouldKeepBoth,
                'target_file_key' => $targetFileKey,
                'target_file_name' => $targetFileName,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Copy file to target directory (supports both same-project and cross-project copy).
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param TaskFileEntity $fileEntity Source file entity to copy
     * @param ProjectEntity $sourceProject Source project entity
     * @param ProjectEntity $targetProject Target project entity
     * @param int $targetParentId Target parent directory ID
     * @param array $keepBothFileIds Array of source file IDs that should not overwrite when conflict occurs
     * @return TaskFileEntity Newly created file entity
     */
    public function copyProjectFile(
        DataIsolation $dataIsolation,
        TaskFileEntity $fileEntity,
        ProjectEntity $sourceProject,
        ProjectEntity $targetProject,
        int $targetParentId,
        DataIsolation $sourceDataIsolation,
        array $keepBothFileIds = []
    ): TaskFileEntity {
        if ($targetParentId <= 0) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
        }

        // 1. Get and validate target parent directory
        $targetParentEntity = $this->taskFileRepository->getById($targetParentId);
        if ($targetParentEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.target_parent_not_found'));
        }

        // 2. Validate target parent is a directory
        if (! $targetParentEntity->getIsDirectory()) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterValidationFailed,
                trans('file.target_parent_not_directory')
            );
        }

        // 3. Validate target parent belongs to target project
        if ($targetParentEntity->getProjectId() !== $targetProject->getId()) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::FILE_PERMISSION_DENIED,
                trans('file.target_parent_not_in_target_project')
            );
        }

        // 4. Resolve target file name by parent_id + file_name semantics.
        $targetFileName = $fileEntity->getFileName();
        $existingTargetFile = $this->taskFileRepository->getByProjectParentAndName(
            $targetProject->getId(),
            $targetParentId,
            $targetFileName
        );

        $sourceFileIdStr = (string) $fileEntity->getFileId();
        $shouldKeepBoth = in_array($sourceFileIdStr, $keepBothFileIds, true);

        if ($existingTargetFile !== null && $existingTargetFile->getFileId() === $fileEntity->getFileId()) {
            if (! $shouldKeepBoth) {
                $this->logger->info('Skipped copy because target file is source file itself', [
                    'source_file_id' => $fileEntity->getFileId(),
                    'target_parent_id' => $targetParentId,
                    'target_file_name' => $targetFileName,
                ]);

                return $fileEntity;
            }
        }

        if ($existingTargetFile !== null && $shouldKeepBoth) {
            $targetFileName = $this->generateUniqueFileNameInParent(
                $targetProject->getId(),
                $targetParentId,
                $targetFileName
            );
            $existingTargetFile = null;
        }

        $newFileId = IdGenerator::getSnowId();
        $targetFileKey = $this->buildCopiedFileKey(
            WorkDirectoryUtil::getFullWorkdir(
                $this->getFullPrefix($targetProject->getUserOrganizationCode()),
                $targetProject->getWorkDir()
            ),
            $newFileId
        );

        // 5. Validate target key is within target project's work directory.
        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir(
            $this->getFullPrefix($targetProject->getUserOrganizationCode()),
            $targetProject->getWorkDir()
        );
        if (! WorkDirectoryUtil::checkEffectiveFileKey($fullWorkdir, $targetFileKey)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_ILLEGAL_KEY, trans('file.illegal_file_key'));
        }

        // 6. Execute copy operation
        Db::beginTransaction();
        try {
            // Overwrite mode: delete existing file. Directory conflict is not allowed.
            if ($existingTargetFile !== null && ! $shouldKeepBoth) {
                if ($existingTargetFile->getIsDirectory()) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::FILE_EXIST, trans('file.file_exist'));
                }

                $this->taskFileRepository->deleteById($existingTargetFile->getFileId());

                $this->logger->info('Deleted existing target file before copy', [
                    'deleted_file_id' => $existingTargetFile->getFileId(),
                    'deleted_file_key' => $existingTargetFile->getFileKey(),
                    'source_file_id' => $fileEntity->getFileId(),
                ]);
            }

            // Copy file in cloud storage
            $this->copyFileInCloudStorage(
                $fileEntity,
                $sourceProject,
                $targetProject,
                $targetFileKey,
                $sourceDataIsolation
            );

            // Create new file record
            $newFileEntity = new TaskFileEntity();
            $newFileEntity->setFileId($newFileId);
            $newFileEntity->setProjectId($targetProject->getId());
            $newFileEntity->setUserId($dataIsolation->getCurrentUserId());
            $newFileEntity->setOrganizationCode($targetProject->getUserOrganizationCode());
            $newFileEntity->setFileType($fileEntity->getFileType());
            $newFileEntity->setFileName($targetFileName);
            $fileInfo = pathinfo($targetFileName);
            $extension = isset($fileInfo['extension']) ? $fileInfo['extension'] : '';
            $newFileEntity->setFileExtension($extension);
            $newFileEntity->setFileSize($fileEntity->getFileSize());
            $newFileEntity->setFileKey($targetFileKey);
            $newFileEntity->setCreatedAt(date('Y-m-d H:i:s'));
            $newFileEntity->setUpdatedAt(date('Y-m-d H:i:s'));
            $newFileEntity->setStorageType($fileEntity->getStorageType());
            $newFileEntity->setSourceFileId($fileEntity->getFileId());
            $newFileEntity->setIsHidden($this->determineIsHidden($targetFileName, $targetParentId, $targetProject->getId()));
            $newFileEntity->setIsDirectory($fileEntity->getIsDirectory());
            $newFileEntity->setParentId($targetParentId);
            $newFileEntity->setMetadata($fileEntity->getMetadata());
            $newFileEntity->setDisplayConfig($fileEntity->getDisplayConfig());
            $newFileEntity->setSource(TaskFileSource::COPY->value);
            $newFileEntity->setLatestVersion(1);
            $newFileEntity->setMetadataVersion(1);

            $createdFileEntity = $this->taskFileRepository->insert($newFileEntity);

            // Display config processing is handled by AttachmentsProcessedEventSubscriber
            // reacting to the FileUploadedEvent dispatched by the caller after this method returns.

            Db::commit();

            $this->logger->info('File copied successfully', [
                'source_file_id' => $fileEntity->getFileId(),
                'new_file_id' => $createdFileEntity->getFileId(),
                'source_project_id' => $sourceProject->getId(),
                'target_project_id' => $targetProject->getId(),
                'target_file_name' => $targetFileName,
                'target_file_key' => $targetFileKey,
                'should_keep_both' => $shouldKeepBoth,
            ]);

            return $createdFileEntity;
        } catch (Throwable $e) {
            Db::rollBack();
            $this->logger->error('copyProjectFile error', [
                'file_id' => $fileEntity->getFileId(),
                'file_key' => $fileEntity->getFileKey(),
                'source_project_id' => $sourceProject->getId(),
                'target_project_id' => $targetProject->getId(),
                'target_parent_id' => $targetParentId,
                'should_keep_both' => $shouldKeepBoth,
                'target_file_name' => $targetFileName,
                'target_file_key' => $targetFileKey,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Move file in cloud storage and update database record.
     *
     * @param TaskFileEntity $fileEntity File entity to move
     * @param ProjectEntity $sourceProject Source project entity
     * @param ProjectEntity $targetProject Target project entity
     * @param int $targetParentId Target parent directory ID
     */
    public function moveFile(
        TaskFileEntity $fileEntity,
        ProjectEntity $sourceProject,
        ProjectEntity $targetProject,
        string $targetFileKey,
        string $targetFileName,
        int $targetParentId,
        DataIsolation $sourceDataIsolation
    ): void {
        try {
            $sameProject = $sourceProject->getId() === $targetProject->getId();
            $sameOrganization = $sourceProject->getUserOrganizationCode() === $targetProject->getUserOrganizationCode();
            $keyChanged = $fileEntity->getFileKey() !== $targetFileKey;
            $nameChanged = $fileEntity->getFileName() !== $targetFileName;
            $parentChanged = $fileEntity->getParentId() !== $targetParentId;

            if (! $keyChanged && ! $nameChanged && ! $parentChanged && $sameProject) {
                return;
            }

            // 1. Handle cloud storage operation only when key/org changes.
            // Directories have no physical objects in object storage, so skip cloud operations for them.
            if (! $fileEntity->getIsDirectory() && ($keyChanged || ! $sameOrganization)) {
                $this->moveFileInCloudStorage(
                    $fileEntity,
                    $sourceProject,
                    $targetProject,
                    $targetFileKey,
                    $sourceDataIsolation
                );
            }

            // 2. Update database record
            $this->updateFileRecord(
                $fileEntity,
                $sourceProject,
                $targetProject,
                $targetFileKey,
                $targetFileName,
                $targetParentId
            );

            // AttachmentsProcessedEvent dispatching is handled by the application-layer caller
            // (FileBatchMoveSubscriber::moveFile()) after this method returns.
        } catch (Throwable $e) {
            $this->logger->error('moveFile error', [
                'file_id' => $fileEntity->getFileId(),
                'file_key' => $fileEntity->getFileKey(),
                'target_file_key' => $targetFileKey,
                'target_file_name' => $targetFileName,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    public function copyFile(DataIsolation $dataIsolation, TaskFileEntity $fileEntity, string $workDir, string $targetPath, int $targetParentId): ?TaskFileEntity
    {
        try {
            if ($fileEntity->getFileKey() === $targetPath) {
                return null;
            }

            // Call cloud file service to move the file
            $prefix = WorkDirectoryUtil::getPrefix($workDir);
            $this->cloudFileRepository->copyObjectByCredential($prefix, $dataIsolation->getCurrentOrganizationCode(), $fileEntity->getFileKey(), $targetPath, StorageBucketType::SandBox);

            // Update file record (parentId and sort have already been set by handleFileSortOnMove)
            $targetFileEntity = new TaskFileEntity();
            $targetFileEntity->setFileId(IdGenerator::getSnowId());
            $targetFileEntity->setProjectId($fileEntity->getProjectId());
            $targetFileEntity->setUserId($dataIsolation->getCurrentUserId());
            $targetFileEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
            $targetFileEntity->setFileType($fileEntity->getFileType());
            $targetFileEntity->setFileName(basename($targetPath));
            $fileInfo = pathinfo($targetPath);
            $extension = $fileInfo['extension'];
            $targetFileEntity->setFileExtension($extension);
            $targetFileEntity->setFileSize($fileEntity->getFileSize());
            $targetFileEntity->setFileKey($targetPath);
            $targetFileEntity->setCreatedAt(date('Y-m-d H:i:s'));
            $targetFileEntity->setStorageType($fileEntity->getStorageType());
            $targetFileEntity->setSourceFileId($fileEntity->getFileId());
            $targetFileEntity->setIsHidden($this->determineIsHidden(basename($targetPath), $targetParentId, $fileEntity->getProjectId()));
            $targetFileEntity->setIsDirectory($fileEntity->getIsDirectory());
            $targetFileEntity->setParentId($targetParentId);
            $targetFileEntity->setSort($fileEntity->getSort() + 1);
            $targetFileEntity->setMetadata($fileEntity->getMetadata());
            $targetFileEntity->setDisplayConfig($fileEntity->getDisplayConfig());
            $targetFileEntity->setSource(TaskFileSource::COPY->value);

            return $this->taskFileRepository->insert($targetFileEntity);
        } catch (Throwable $e) {
            throw $e;
        }
    }

    public function getDirectoryFileIds(DataIsolation $dataIsolation, TaskFileEntity $dirEntity): array
    {
        $fileIds = [$dirEntity->getFileId()];
        $descendantIds = $this->taskFileRepository->getAllDescendantIds(
            (int) $dirEntity->getFileId(),
            $dirEntity->getProjectId()
        );
        if (! empty($descendantIds)) {
            $fileIds = array_values(array_unique(array_merge($fileIds, $descendantIds)));
        }
        return $fileIds;
    }

    /**
     * 为新文件计算排序值（领域逻辑）.
     *
     * @param null|int $parentId 父目录ID，null 表示根层级
     * @param int $preFileId 前置文件ID，0表示插入第一位，-1表示插入末尾
     * @param int $projectId 项目ID
     * @param null|string $spaceType 空间类型过滤，null 不过滤（保持原行为）
     */
    public function calculateSortForNewFile(?int $parentId, int $preFileId, int $projectId, ?string $spaceType = null): int
    {
        // Use FileSortUtil for consistent sorting logic
        return FileSortUtil::calculateSortValue($this->taskFileRepository, $parentId, $preFileId, $projectId, $spaceType);
    }

    /**
     * Handle file sorting on move with project-level locking and rebalancing.
     */
    /**
     * Handle file sort on copy operation.
     * Reuses handleFileSortOnMove logic since sorting logic is identical.
     *
     * @param TaskFileEntity $fileEntity File entity being copied
     * @param ProjectEntity $targetProject Target project entity
     * @param int $targetParentId Target parent directory ID
     * @param null|int $preFileId Previous file ID for positioning
     */
    public function handleFileSortOnCopy(
        TaskFileEntity $fileEntity,
        ProjectEntity $targetProject,
        int $targetParentId,
        ?int $preFileId = null
    ): void {
        // Reuse move logic since sorting is identical
        $this->handleFileSortOnMove($fileEntity, $targetProject, $targetParentId, $preFileId);
    }

    /**
     * Handle file sort on move operation.
     *
     * @param TaskFileEntity $fileEntity File entity being moved
     * @param ProjectEntity $targetProject Target project entity
     * @param int $targetParentId Target parent directory ID
     * @param null|int $preFileId Previous file ID for positioning
     */
    public function handleFileSortOnMove(
        TaskFileEntity $fileEntity,
        ProjectEntity $targetProject,
        int $targetParentId,
        ?int $preFileId = null
    ): void {
        $targetProjectId = $targetProject->getId();

        // Acquire project-level move lock for target project
        [$lockAcquired, $lockKey, $lockOwner] = $this->acquireProjectMoveLock($targetProjectId);

        if (! $lockAcquired) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::FILE_OPERATION_BUSY,
                trans('file.move_operation_busy')
            );
        }

        Db::beginTransaction();
        try {
            // Lock target directory's direct children for update
            $targetChildren = $this->taskFileRepository->lockDirectChildrenForUpdate($targetParentId);

            // Calculate new sort value
            $newSort = $this->calculateSortAfterFile($targetChildren, $preFileId);

            if ($newSort === null) {
                // Gap insufficient, trigger rebalancing
                $newSort = $this->rebalanceAndCalculateSort($targetParentId, $preFileId);
            }

            // Update sort value
            $this->taskFileRepository->updateFileByCondition(
                ['file_id' => $fileEntity->getFileId()],
                ['sort' => $newSort, 'updated_at' => date('Y-m-d H:i:s')]
            );

            Db::commit();

            $this->logger->info('File move sort operation completed', [
                'file_id' => $fileEntity->getFileId(),
                'target_project_id' => $targetProjectId,
                'target_parent_id' => $targetParentId,
                'pre_file_id' => $preFileId,
                'new_sort' => $newSort,
            ]);
        } catch (Throwable $e) {
            Db::rollBack();
            $this->logger->error('File move sort operation failed', [
                'file_id' => $fileEntity->getFileId(),
                'target_project_id' => $targetProjectId,
                'target_parent_id' => $targetParentId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        } finally {
            $this->releaseProjectMoveLock($lockKey, $lockOwner);
        }
    }

    /**
     * Find or create directory structure and return parent ID for a file.
     * This method ensures all necessary directories exist for the given file path.
     *
     * @param int $projectId Project ID
     * @param string $fullFileKey Complete file key from storage
     * @param string $workDir Project work directory
     * @param string $userId User ID
     * @param string $organizationCode Organization code
     * @param string $projectOrganizationCode Project organization code
     * @param TaskFileSource $source File source
     * @return int The file_id of the direct parent directory
     */
    public function findOrCreateDirectoryAndGetParentId(int $projectId, string $userId, string $organizationCode, string $projectOrganizationCode, string $fullFileKey, string $workDir, TaskFileSource $source = TaskFileSource::PROJECT_DIRECTORY): int
    {
        // 1. Get relative path of the file
        $relativePath = WorkDirectoryUtil::getRelativeFilePath($fullFileKey, $workDir);

        // 2. Get parent directory path
        $parentDirPath = dirname($relativePath);

        // 3. If file is in root directory, return project root directory ID
        if ($parentDirPath === '.' || $parentDirPath === '/' || empty($parentDirPath)) {
            return $this->findOrCreateProjectRootDirectory($projectId, $workDir, $userId, $organizationCode, $projectOrganizationCode, $source);
        }

        // 4. Ensure all directory levels exist and return the final parent ID
        return $this->ensureDirectoryPathExists($projectId, $parentDirPath, $workDir, $userId, $organizationCode, $projectOrganizationCode, $source);
    }

    /**
     * Handle sandbox file notification (CREATE/UPDATE operations).
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param ProjectEntity $projectEntity Project entity
     * @param string $fileKey Complete file key
     * @param SandboxFileNotificationDataValueObject $data File data
     * @return TaskFileEntity Created or updated file entity
     */
    public function handleSandboxFileNotification(
        DataIsolation $dataIsolation,
        ProjectEntity $projectEntity,
        string $fileKey,
        SandboxFileNotificationDataValueObject $data,
        MessageMetadata $metadata,
        bool $isUpdate = false
    ): TaskFileEntity {
        $projectOrganizationCode = $projectEntity->getUserOrganizationCode();
        Db::beginTransaction();
        try {
            $taskEntity = $this->taskRepository->getTaskById((int) $metadata->getSuperMagicTaskId());
            $taskFileEntity = new TaskFileEntity();
            $taskFileEntity->setFileKey($fileKey);
            $taskFileEntity->setTaskId($taskEntity->getId());
            $taskFileEntity->setTopicId($taskEntity->getTopicId());
            $taskFileEntity->setSource($data->getSource() ?? TaskFileSource::AGENT->value);
            $taskFileEntity->setStorageType(StorageType::WORKSPACE);
            $taskFileEntity->setFileType(FileType::SYSTEM_AUTO_UPLOAD->value);
            if ($isUpdate) {
                $taskFileEntity->setSource($data->getSource() ?? TaskFileSource::AGENT->value);
            }
            if ($data->getIsDirectory()) {
                $taskFileEntity->setIsDirectory(true);
                $taskFileEntity->setFileType(FileType::DIRECTORY->value);
            } else {
                $taskFileEntity->setIsDirectory(false);
            }

            // Get file information from cloud storage
            $fileName = basename(rtrim($data->getFilePath(), '/'));
            $fileInfo = $this->getFileInfoFromCloudStorage(
                $fileName,
                $fileKey,
                $projectOrganizationCode
            );
            $taskFileEntity->setFileSize($fileInfo['size']);
            $fileEntity = $this->upsertProjectFileNode(
                new UpsertProjectFileNodeDTO(
                    projectId: $projectEntity->getId(),
                    projectWorkDir: $projectEntity->getWorkDir(),
                    projectOrganizationCode: $projectEntity->getUserOrganizationCode(),
                    operatorUserId: $dataIsolation->getCurrentUserId(),
                    operatorOrganizationCode: $dataIsolation->getCurrentOrganizationCode(),
                    taskFileEntity: $taskFileEntity,
                    isUpdated: $isUpdate,
                    withTrash: true,
                )
            );

            Db::commit();
            return $fileEntity;
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
    }

    /**
     * Handle sandbox file delete operation.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param string $fileKey Complete file key
     * @return bool Whether file was deleted
     */
    public function handleSandboxFileDelete(DataIsolation $dataIsolation, string $fileKey): bool
    {
        $existingFile = $this->taskFileRepository->getByFileKey($fileKey);

        if ($existingFile === null) {
            // File doesn't exist, consider it as successfully deleted
            return true;
        }

        // todo 等所有文件迁移完成后，再删除备份文件
        if ($existingFile->getIsDirectory()) {
            // 去除文件key的末尾的/
            $fileKey = rtrim($fileKey, '/');
            $backupFile = $this->taskFileRepository->getByFileKey($fileKey);
            // 如果备份文件存在，则删除备份文件
            if ($backupFile !== null) {
                try {
                    $this->taskFileRepository->deleteById($backupFile->getFileId());
                } catch (Throwable $e) {
                    $this->logger->error('Delete backup file failed', [
                        'file_key' => $fileKey,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        try {
            $this->taskFileRepository->deleteById($existingFile->getFileId());
            return true;
        } catch (Throwable $e) {
            $this->logger->error('Delete file failed', [
                'file_key' => $fileKey,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Find or create project root directory.
     *
     * @param int $projectId Project ID
     * @param string $workDir Project work directory
     * @param string $userId User ID
     * @param string $organizationCode Organization code
     * @param string $projectOrganizationCode Project organization code
     * @param TaskFileSource $source File source
     * @return int Root directory file_id
     */
    public function findOrCreateProjectRootDirectory(int $projectId, string $workDir, string $userId, string $organizationCode, string $projectOrganizationCode, TaskFileSource $source = TaskFileSource::PROJECT_DIRECTORY): int
    {
        // 按完整根目录条件精确查询，不能扫描 parent_id=NULL 的全部同级记录。
        $rootDir = $this->taskFileRepository->findRootDirectoryByProjectId($projectId);

        if ($rootDir !== null) {
            return $rootDir->getFileId();
        }
        $fullPrefix = $this->getFullPrefix($projectOrganizationCode);
        $fullWorkDir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $workDir);
        $fileKey = rtrim($fullWorkDir, '/') . '/';

        // Call remote file system
        $metadata = WorkDirectoryUtil::generateDefaultWorkDirMetadata();
        $this->cloudFileRepository->createFolderByCredential(WorkDirectoryUtil::getPrefix($workDir), $projectOrganizationCode, $fileKey, StorageBucketType::SandBox, ['metadata' => $metadata]);

        // Create root directory if not exists
        $rootDirEntity = new TaskFileEntity();
        $rootDirEntity->setFileId(IdGenerator::getSnowId());
        $rootDirEntity->setUserId($userId);
        $rootDirEntity->setOrganizationCode($organizationCode);
        $rootDirEntity->setProjectId($projectId);
        $rootDirEntity->setFileName('/');
        $rootDirEntity->setFileKey($fileKey);
        $rootDirEntity->setFileSize(0);
        $rootDirEntity->setFileType(FileType::DIRECTORY->value);
        $rootDirEntity->setIsDirectory(true);
        $rootDirEntity->setParentId(null);
        $rootDirEntity->setSource($source);
        $rootDirEntity->setStorageType(StorageType::WORKSPACE);
        $rootDirEntity->setIsHidden(true);
        $rootDirEntity->setSort(0);

        $now = date('Y-m-d H:i:s');
        $rootDirEntity->setCreatedAt($now);
        $rootDirEntity->setUpdatedAt($now);
        $rootDirEntity->setDeletedAt(null);

        $rootDirEntity = $this->insertOrUpdate($rootDirEntity);

        return $rootDirEntity->getFileId();
    }

    /**
     * 查找或创建用户空间的根目录.
     *
     * 用户空间根目录不属于任何项目（project_id=0），通过 user_id + organization_code +
     * space_type='user' 唯一定位。在沙箱初始化时调用，确保用户空间的挂载点存在。
     *
     * @param string $userId 用户ID
     * @param string $organizationCode 组织代码
     * @return int 用户空间根目录的 file_id
     */
    public function findOrCreateUserRootDirectory(string $userId, string $organizationCode): int
    {
        // 查找已有的用户空间根目录（无锁快速路径）
        $rootDir = $this->taskFileRepository->findUserSpaceRootDirectory($userId, $organizationCode);

        if ($rootDir !== null) {
            return $rootDir->getFileId();
        }

        // 加分布式锁，防止并发创建多条根目录记录
        $lockKey = sprintf('magicfs:user_root_dir:%s:%s', $organizationCode, $userId);
        $lockOwner = IdGenerator::getUniqueId32();

        if (! $this->locker->spinLock($lockKey, $lockOwner, 30)) {
            // 获取锁超时，再查一次——大概率是另一个协程已经创建完成
            $rootDir = $this->taskFileRepository->findUserSpaceRootDirectory($userId, $organizationCode);
            if ($rootDir !== null) {
                return $rootDir->getFileId();
            }
            throw new RuntimeException('Failed to acquire lock for creating user space root directory');
        }

        try {
            // Double-check：拿到锁后再查一次，避免重复创建
            $rootDir = $this->taskFileRepository->findUserSpaceRootDirectory($userId, $organizationCode);
            if ($rootDir !== null) {
                return $rootDir->getFileId();
            }

            // 生成 S3 key：用户空间使用 user_{userId}/workspace 作为工作目录，
            // 与 project 空间的 project_{id}/workspace 布局保持一致
            $fullPrefix = $this->getFullPrefix($organizationCode);
            $userWorkDir = WorkDirectoryUtil::getUserWorkDir($userId);
            $fullWorkDir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $userWorkDir);
            $fileKey = rtrim($fullWorkDir, '/') . '/';

            // 在对象存储上创建文件夹
            $metadata = WorkDirectoryUtil::generateDefaultWorkDirMetadata();
            $this->cloudFileRepository->createFolderByCredential(
                WorkDirectoryUtil::getPrefix($userWorkDir),
                $organizationCode,
                $fileKey,
                StorageBucketType::SandBox,
                ['metadata' => $metadata]
            );

            // 创建用户空间根目录记录
            $rootDirEntity = new TaskFileEntity();
            $rootDirEntity->setFileId(IdGenerator::getSnowId());
            $rootDirEntity->setUserId($userId);
            $rootDirEntity->setOrganizationCode($organizationCode);
            $rootDirEntity->setProjectId(0); // 不属于任何项目
            $rootDirEntity->setFileName('/');
            $rootDirEntity->setFileKey($fileKey);
            $rootDirEntity->setFileSize(0);
            $rootDirEntity->setFileType(FileType::DIRECTORY->value);
            $rootDirEntity->setIsDirectory(true);
            $rootDirEntity->setParentId(null);
            $rootDirEntity->setSource(TaskFileSource::AGENT);
            $rootDirEntity->setStorageType(FileSpaceType::USER->toStorageType());
            $rootDirEntity->setIsHidden(true);
            $rootDirEntity->setSort(0);
            $rootDirEntity->setSpaceType(FileSpaceType::USER->value);

            $now = date('Y-m-d H:i:s');
            $rootDirEntity->setCreatedAt($now);
            $rootDirEntity->setUpdatedAt($now);
            $rootDirEntity->setDeletedAt(null);

            $rootDirEntity = $this->insertOrUpdate($rootDirEntity);

            $this->logger->info('User space root directory created', [
                'user_id' => $userId,
                'organization_code' => $organizationCode,
                'file_id' => $rootDirEntity->getFileId(),
                'file_key' => $fileKey,
            ]);

            return $rootDirEntity->getFileId();
        } finally {
            if (! $this->locker->release($lockKey, $lockOwner)) {
                $this->logger->warning('Failed to release user space root directory lock', [
                    'lock_key' => $lockKey,
                    'lock_owner' => $lockOwner,
                ]);
            }
        }
    }

    public function findOrCreateTopicRootDirectory(
        int $projectId,
        int $topicId,
        string $userId,
        string $organizationCode,
        string $projectOrganizationCode
    ): int {
        $root = $this->taskFileRepository->findTopicSpaceRootDirectory($projectId, $topicId, $organizationCode);
        if ($root !== null) {
            return $root->getFileId();
        }

        $lockKey = sprintf('magicfs:topic_root_dir:%s:%d:%d', $organizationCode, $projectId, $topicId);
        $lockOwner = IdGenerator::getUniqueId32();
        if (! $this->locker->spinLock($lockKey, $lockOwner, self::LOCK_TIMEOUT)) {
            $root = $this->taskFileRepository->findTopicSpaceRootDirectory($projectId, $topicId, $organizationCode);
            if ($root !== null) {
                return $root->getFileId();
            }
            throw new RuntimeException('Failed to acquire lock for creating topic root directory');
        }

        try {
            $root = $this->taskFileRepository->findTopicSpaceRootDirectory($projectId, $topicId, $organizationCode);
            if ($root !== null) {
                return $root->getFileId();
            }

            // Topic root 使用既有固定物理目录，以便沙箱按该前缀申请最小范围权限。
            // `topic_{topic_id}` 仅是 TaskFile 元数据名称，不拼入对象存储 file_key；
            // 不能命名为 `.topic`，否则沙箱 mount 时与容器内挂载点冲突。
            $relativeDir = WorkDirectoryUtil::getTopicRootDir($userId, $projectId, $topicId);
            $fullPrefix = $this->getFullPrefix($projectOrganizationCode);
            $fileKey = rtrim($fullPrefix . ltrim($relativeDir, '/'), '/') . '/';
            $this->cloudFileRepository->createFolderByCredential(
                WorkDirectoryUtil::getPrefix($relativeDir),
                $projectOrganizationCode,
                $fileKey,
                StorageBucketType::SandBox,
                ['metadata' => WorkDirectoryUtil::generateDefaultWorkDirMetadata()]
            );

            $entity = new TaskFileEntity();
            $entity->setFileId(IdGenerator::getSnowId());
            $entity->setUserId($userId);
            $entity->setOrganizationCode($organizationCode);
            $entity->setProjectId($projectId);
            $entity->setTopicId($topicId);
            $entity->setFileName(TopicFileConstant::rootFileName($topicId));
            $entity->setFileKey($fileKey);
            $entity->setFileSize(0);
            $entity->setFileType(FileType::DIRECTORY->value);
            $entity->setIsDirectory(true);
            $entity->setIsHidden(false);
            $entity->setParentId(null);
            $entity->setSource(TaskFileSource::AGENT);
            $entity->setSpaceType(FileSpaceType::TOPIC->value);
            $entity->setStorageType(FileSpaceType::TOPIC->toStorageType());
            $entity->setSort(0);
            $now = date('Y-m-d H:i:s');
            $entity->setCreatedAt($now);
            $entity->setUpdatedAt($now);
            $entity->setDeletedAt(null);

            return $this->insertOrUpdate($entity)->getFileId();
        } finally {
            $this->locker->release($lockKey, $lockOwner);
        }
    }

    /**
     * 外部移动操作后同步父目录链的元数据版本号.
     *
     * @param ?int $oldParentId 原父目录ID
     * @param int $newParentId 新父目录ID
     */
    public function syncVersionAfterExternalMove(?int $oldParentId, int $newParentId): void
    {
        if ($oldParentId === $newParentId) {
            return;
        }

        // Both directories' listings changed; the moved node's own row is
        // appended by whoever performed the move.
        $this->bumpFileTreeVersions(
            $oldParentId === null ? [$newParentId] : [$oldParentId, $newParentId]
        );
    }

    /**
     * 外部复制操作后同步目标父目录的元数据版本号.
     *
     * 复制进来的节点由调用方各自落 journal 行；这里只让目标目录的列表版本
     * 前移，使目录版本做缓存键的读者看到它已过期。
     *
     * @param int $targetParentId 目标父目录ID
     */
    public function syncVersionAfterExternalCopy(int $targetParentId): void
    {
        $this->bumpFileTreeVersions([$targetParentId]);
    }

    /**
     * Get file URLs for multiple files.
     *
     * @param string $projectOrganizationCode Project organization code
     * @param array $fileIds Array of file IDs
     * @param string $downloadMode Download mode (download, preview, etc.)
     * @param array $options Additional options
     * @param array $fileVersions File version mapping [file_id => version]
     * @return array Array of file URLs
     */
    public function getFileUrls(string $projectOrganizationCode, int $projectId, array $fileIds, string $downloadMode, array $options = [], array $fileVersions = [], bool $addWatermark = true): array
    {
        $useCache = $options['cache'] ?? true;

        $fileEntities = $this->taskFileRepository->getTaskFilesByIds($fileIds, $projectId);
        if (empty($fileEntities)) {
            return [];
        }

        // Collect non-directory file IDs for batch latest-version query (1 SQL for all files)
        $nonDirectoryFileIds = [];
        foreach ($fileEntities as $fileEntity) {
            if (! $fileEntity->getIsDirectory()) {
                $nonDirectoryFileIds[] = $fileEntity->getFileId();
            }
        }
        $latestVersionMap = $this->taskFileVersionRepository->batchGetLatestVersionNumbers($nonDirectoryFileIds);

        $preparedFiles = [];
        $resultByFileId = [];
        foreach ($fileEntities as $fileEntity) {
            // 跳过目录
            if ($fileEntity->getIsDirectory()) {
                continue;
            }

            try {
                // 检查是否指定了版本号
                $specifiedVersion = $fileVersions[$fileEntity->getFileId()] ?? null;

                if ($specifiedVersion !== null) {
                    // 查询指定版本的文件信息
                    $versionEntity = $this->taskFileVersionRepository->getByFileIdAndVersion(
                        $fileEntity->getFileId(),
                        $specifiedVersion
                    );

                    if (empty($versionEntity)) {
                        $this->logger->warning(sprintf('版本%d不存在, file_id:%d', $specifiedVersion, $fileEntity->getFileId()));
                        continue;
                    }

                    $fileEntity->setFileKey($versionEntity->getFileKey());
                }

                if ($useCache) {
                    $cachedData = $this->getCachedFileUrl(
                        $projectOrganizationCode,
                        $fileEntity,
                        $specifiedVersion,
                        $downloadMode,
                        $addWatermark
                    );
                    if ($cachedData !== null) {
                        $cachedData['version'] = $latestVersionMap[$fileEntity->getFileId()] ?? null;
                        $cachedData['updated_at'] = $fileEntity->getUpdatedAt();
                        $resultByFileId[(string) $fileEntity->getFileId()] = $cachedData;
                        continue;
                    }
                }

                $urlOptions = $this->prepareFileUrlOptions(
                    $fileEntity->getFileName(),
                    $downloadMode,
                    $addWatermark,
                    $fileEntity
                );
                $urlOptions['method'] = 'GET';
                $urlOptions['expires'] = self::URL_EXPIRES;
                $preparedFiles[] = [
                    'file_id' => (string) $fileEntity->getFileId(),
                    'object_key' => $fileEntity->getFileKey(),
                    'version' => $latestVersionMap[$fileEntity->getFileId()] ?? null,
                    'updated_at' => $fileEntity->getUpdatedAt(),
                    'specified_version' => $specifiedVersion,
                    'options' => $urlOptions,
                ];
            } catch (Throwable $e) {
                // 获取URL失败，记录日志并跳过
                $this->logger->error(sprintf('获取文件URL失败, file_id:%d, err：%s', $fileEntity->getFileId(), $e->getMessage()));
            }
        }

        if ($preparedFiles !== []) {
            try {
                $urls = $this->cloudFileRepository->getPreSignedUrlsByCredential(
                    $projectOrganizationCode,
                    array_map(static fn (array $file): array => [
                        'object_key' => $file['object_key'],
                        'options' => $file['options'],
                    ], $preparedFiles),
                    StorageBucketType::SandBox,
                    7200,
                    ['cache' => false]
                );

                foreach ($preparedFiles as $preparedFile) {
                    $url = $urls[$preparedFile['object_key']] ?? null;
                    if (! is_string($url) || $url === '') {
                        continue;
                    }

                    $urlData = [
                        'file_id' => $preparedFile['file_id'],
                        'url' => $url,
                        'expires_at' => date('Y-m-d H:i:s', time() + self::URL_EXPIRES),
                        'version' => $preparedFile['version'],
                        'updated_at' => $preparedFile['updated_at'],
                    ];
                    $resultByFileId[$preparedFile['file_id']] = $urlData;

                    $cacheKey = $this->buildFileUrlCacheKey(
                        $projectOrganizationCode,
                        (int) $preparedFile['file_id'],
                        $preparedFile['specified_version'],
                        $downloadMode,
                        $addWatermark
                    );
                    $this->writeFileUrlCache($cacheKey, $url);
                }
            } catch (Throwable $e) {
                $this->logger->error(sprintf('批量获取文件URL失败, project_id:%d, err：%s', $projectId, $e->getMessage()));
            }
        }

        $result = [];
        foreach ($fileEntities as $fileEntity) {
            $fileId = (string) $fileEntity->getFileId();
            if (isset($resultByFileId[$fileId])) {
                $result[] = $resultByFileId[$fileId];
            }
        }

        return $result;
    }

    /**
     * getFileUrls for project id.
     *
     * @param array $fileIds Array of file IDs
     * @param int $projectId Project ID
     * @param string $downloadMode Download mode
     * @param array $fileVersions File version mapping [file_id => version]
     * @return array Array of file URLs
     */
    public function getFileUrlsByProjectId(array $fileIds, int $projectId, string $downloadMode, array $fileVersions = [], bool $addWatermark = true): array
    {
        $projectEntity = $this->projectRepository->findById($projectId);
        if (empty($projectEntity)) {
            $this->logger->warning(sprintf('分享获取项目不存在, project_id:%d', $projectId));
            return [];
        }
        // 从token获取内容
        $fileEntities = $this->taskFileRepository->getTaskFilesByIds($fileIds, $projectId);
        if (empty($fileEntities)) {
            return [];
        }

        $preparedFiles = [];
        foreach ($fileEntities as $fileEntity) {
            // 跳过目录
            if ($fileEntity->getIsDirectory()) {
                continue;
            }

            try {
                // 检查是否指定了版本号
                $specifiedVersion = $fileVersions[$fileEntity->getFileId()] ?? null;

                if ($specifiedVersion !== null) {
                    // 查询指定版本的文件信息
                    $versionEntity = $this->taskFileVersionRepository->getByFileIdAndVersion(
                        $fileEntity->getFileId(),
                        $specifiedVersion
                    );

                    if (empty($versionEntity)) {
                        $this->logger->warning(sprintf('版本%d不存在, file_id:%d', $specifiedVersion, $fileEntity->getFileId()));
                        continue;
                    }

                    $fileEntity->setFileKey($versionEntity->getFileKey());
                }

                $urlOptions = $this->prepareFileUrlOptions(
                    $fileEntity->getFileName(),
                    $downloadMode,
                    $addWatermark,
                    $fileEntity
                );
                $urlOptions['method'] = 'GET';
                $urlOptions['expires'] = self::URL_EXPIRES;

                $preparedFiles[] = [
                    'file_id' => (string) $fileEntity->getFileId(),
                    'object_key' => $fileEntity->getFileKey(),
                    'options' => $urlOptions,
                ];
            } catch (Throwable $e) {
                // 获取URL失败，记录日志并跳过
                $this->logger->error(sprintf('获取文件URL失败, file_id:%d, err：%s', $fileEntity->getFileId(), $e->getMessage()));
            }
        }

        if ($preparedFiles === []) {
            return [];
        }

        try {
            $urls = $this->cloudFileRepository->getPreSignedUrlsByCredential(
                $projectEntity->getUserOrganizationCode(),
                array_map(static fn (array $file): array => [
                    'object_key' => $file['object_key'],
                    'options' => $file['options'],
                ], $preparedFiles),
                StorageBucketType::SandBox,
                7200,
                ['cache' => false]
            );
        } catch (Throwable $e) {
            $this->logger->error(sprintf('批量获取文件URL失败, project_id:%d, err：%s', $projectId, $e->getMessage()));
            return [];
        }

        $result = [];
        foreach ($preparedFiles as $preparedFile) {
            $url = $urls[$preparedFile['object_key']] ?? null;
            if (! is_string($url) || $url === '') {
                continue;
            }

            $result[] = [
                'file_id' => $preparedFile['file_id'],
                'url' => $url,
                'expires_at' => date('Y-m-d H:i:s', time() + self::URL_EXPIRES),
            ];
        }

        return $result;
    }

    /**
     * Get file URLs by relative paths.
     *
     * @param string $projectOrganizationCode Project organization code
     * @param int $projectId Project ID
     * @param TaskFileEntity $parentFileEntity Parent file entity
     * @param array $relativeFilePaths Relative file paths
     * @param string $downloadMode Download mode
     * @return array File URLs with relative_file_path and url
     */
    public function getFileUrlsByRelativePaths(
        string $projectOrganizationCode,
        int $projectId,
        TaskFileEntity $parentFileEntity,
        array $relativeFilePaths,
        string $downloadMode
    ): array {
        $result = [];

        // 1. Get parent file_key as base path
        $parentFileKey = rtrim($parentFileEntity->getFileKey(), '/');

        // 2. Build full file_key list
        $fileKeyToRelativePath = [];
        foreach ($relativeFilePaths as $relativePath) {
            // Normalize relative path: remove leading './' and '/'
            $normalizedPath = $this->normalizeRelativePath($relativePath);
            if (empty($normalizedPath)) {
                continue;
            }

            // Build full file_key
            $fullFileKey = $parentFileKey . '/' . $normalizedPath;
            // Normalize: remove consecutive '/'
            $fullFileKey = preg_replace('#/+#', '/', $fullFileKey);

            $fileKeyToRelativePath[$fullFileKey] = $relativePath;
        }

        if (empty($fileKeyToRelativePath)) {
            return $result;
        }

        // 3. Batch query database to validate file_key
        $fileKeys = array_keys($fileKeyToRelativePath);
        $fileEntities = $this->taskFileRepository->getByProjectIdAndFileKeys($projectId, $fileKeys);

        // 4. Generate URLs
        foreach ($fileEntities as $fileEntity) {
            // Skip directories
            if ($fileEntity->getIsDirectory()) {
                continue;
            }

            $fileKey = $fileEntity->getFileKey();
            $relativePath = $fileKeyToRelativePath[$fileKey] ?? null;
            if ($relativePath === null) {
                continue;
            }

            try {
                $urlResult = $this->generateFileUrlForEntity(
                    $projectOrganizationCode,
                    $fileEntity,
                    $downloadMode,
                    (string) $fileEntity->getFileId()
                );

                $result[] = [
                    'relative_file_path' => $relativePath,
                    'url' => $urlResult['url'],
                    'expires_at' => $urlResult['expires_at'] ?? null,
                ];
            } catch (Throwable $e) {
                $this->logger->error(sprintf(
                    'Failed to generate URL for file: %s, error: %s',
                    $fileKey,
                    $e->getMessage()
                ));
                continue;
            }
        }

        return $result;
    }

    public function getFullPrefix(string $organizationCode): string
    {
        return $this->cloudFileRepository->getFullPrefix($organizationCode);
    }

    /**
     * Get pre-signed URL for file download or upload.
     *
     * @param string $projectOrganizationCode Project organization code
     * @param TaskFileEntity $fileEntity File entity to generate URL for
     * @param array $options Additional options (method, expires, filename, etc.)
     * @return string Pre-signed URL
     * @throws Throwable
     */
    public function getFilePreSignedUrl(
        string $projectOrganizationCode,
        TaskFileEntity $fileEntity,
        array $options = []
    ): string {
        // Cannot generate URL for directories
        if ($fileEntity->getIsDirectory()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_ILLEGAL_KEY, trans('file.cannot_generate_url_for_directory'));
        }

        // Set default filename if not provided
        if (! isset($options['filename'])) {
            $options['filename'] = $fileEntity->getFileName();
        }

        // Set default HTTP method for downloads
        if (! isset($options['method'])) {
            $options['method'] = 'GET';
        }

        // Determine storage bucket type based on file storage type
        $bucketType = StorageBucketType::SandBox;

        try {
            return $this->cloudFileRepository->getPreSignedUrlByCredential(
                $projectOrganizationCode,
                $fileEntity->getFileKey(),
                $bucketType,
                $options
            );
        } catch (Throwable $e) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::FILE_NOT_FOUND,
                trans('file.file_not_found')
            );
        }
    }

    /**
     * Migrate project files for fork operation.
     *
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param ProjectEntity $sourceProjectEntity 源项目实体
     * @param ProjectEntity $forkProjectEntity 目标项目实体
     * @param ProjectForkEntity $projectForkRecordEntity Fork记录实体
     * @param null|array $fileIds 要复制的文件ID列表（null表示复制所有文件）
     * @return array<int, int> source file ID => fork file ID
     * @throws Throwable
     */
    public function migrateProjectFile(DataIsolation $dataIsolation, ProjectEntity $sourceProjectEntity, ProjectEntity $forkProjectEntity, ProjectForkEntity $projectForkRecordEntity, DataIsolation $targetDataIsolation, ?array $fileIds = null): array
    {
        // 初始化基本参数
        $pageSize = 200; // Process 200 files at a time
        $lastFileId = $projectForkRecordEntity->getCurrentFileId() ?? 0;
        $forkRecordId = $projectForkRecordEntity->getId();
        $processedCount = $projectForkRecordEntity->getProcessedFiles();
        $totalCount = $projectForkRecordEntity->getTotalFiles();
        $userId = $dataIsolation->getCurrentUserId();
        $sourceToNewIdMap = [];
        $pendingParentIds = [];
        $failedFileKeys = [];

        $this->logger->info(sprintf(
            'Starting file migration for fork event, source_project_id: %d, fork_project_id: %d, total_files: %d, processed_files: %d',
            $sourceProjectEntity->getId(),
            $forkProjectEntity->getId(),
            $totalCount,
            $processedCount
        ));

        // Ensure the fork process is still running
        if (! $projectForkRecordEntity->getStatus()->isRunning()) {
            $this->logger->warning(sprintf('Fork process %d is not in running status, current status: %s. Skipping file migration.', $projectForkRecordEntity->getId(), $projectForkRecordEntity->getStatus()->value));
            return [];
        }

        // fork 网关操作使用目标项目身份，由应用层预先准备授权。
        if ($targetDataIsolation->getCurrentOrganizationCode() !== $forkProjectEntity->getUserOrganizationCode()
            || $targetDataIsolation->getCurrentUserId() !== $forkProjectEntity->getUserId()) {
            throw new InvalidArgumentException('文件迁移必须传入目标项目用户的数据隔离对象');
        }
        $userCtx = $targetDataIsolation;

        // 根节点单独处理
        $sourceRootFileId = $this->findOrCreateProjectRootDirectory($sourceProjectEntity->getId(), $sourceProjectEntity->getWorkDir(), $sourceProjectEntity->getUserId(), $sourceProjectEntity->getUserOrganizationCode(), $sourceProjectEntity->getUserOrganizationCode());
        $forkRootFileId = $this->findOrCreateProjectRootDirectory($forkProjectEntity->getId(), $forkProjectEntity->getWorkDir(), $forkProjectEntity->getUserId(), $forkProjectEntity->getUserOrganizationCode(), $forkProjectEntity->getUserOrganizationCode(), TaskFileSource::COPY);
        $sourceToNewIdMap[$sourceRootFileId] = $forkRootFileId;
        $sourceRootFile = $this->taskFileRepository->getById($sourceRootFileId);
        $forkRootFile = $this->taskFileRepository->getById($forkRootFileId);
        if ($sourceRootFile === null || $forkRootFile === null) {
            throw new RuntimeException('Project root TaskFile not found during fork migration');
        }

        // 如果指定了文件ID列表,转换为整数并构建集合（用于快速查找）
        $fileIdSet = null;
        if ($fileIds !== null) {
            // 确保所有文件ID都是整数
            $fileIds = array_map(fn ($id) => (int) $id, $fileIds);
            // 按文件ID升序排序，确保分页逻辑正确
            sort($fileIds);
            // 构建文件ID集合（用于 O(1) 查找）
            $fileIdSet = array_flip($fileIds);

            $this->logger->info(sprintf(
                'Migrating specific files, file count: %d, fork record ID: %d',
                count($fileIds),
                $forkRecordId
            ));
        }

        // 目录删除是单节点语义（不级联子项），已删除目录下的存活文件会变成
        // 无法回溯到项目根的孤儿数据。分享列表侧用 filterByValidParentChain
        // 丢弃这类文件，Fork 必须保持同一口径，否则会把它们复制过去并挂到
        // 目标根目录，等于"复活"已删除的内容。
        $reachableFileIds = null;
        if ($sourceRootFile->getSpaceType() === FileSpaceType::PROJECT->value) {
            $parentMap = $this->taskFileRepository->getVisibleProjectFileParentMap($sourceProjectEntity->getId());
            // 项目根是父链的固定终点：即使它因过滤条件不在映射里，也必须作为锚点，
            // 否则整棵树的父链都无法终止，会被整体误判为不可达。
            $parentMap[(int) $sourceRootFileId] = null;
            $reachableFileIds = $this->resolveReachableFileIds($parentMap);
            // 项目根目录不参与复制（copyFileList 会跳过），从可达集合与分母中剔除
            unset($reachableFileIds[$sourceRootFileId]);
        }
        $skippedUnreachableCount = 0;

        // 创建 fork 记录时用的是整项目计数（含孤儿与隐藏节点），与实际可复制
        // 集合不一致。这里把分母对齐到"枚举真正会取到的集合"，避免进度到不了 100%。
        if ($reachableFileIds !== null) {
            $expectedTotalCount = count($fileIdSet === null
                ? $reachableFileIds
                : array_intersect_key($fileIdSet, $reachableFileIds));
            if ($expectedTotalCount !== $totalCount) {
                $this->logger->info(sprintf(
                    'Fork record %d: total_files corrected from %d to %d (excluding unreachable/hidden files)',
                    $forkRecordId,
                    $totalCount,
                    $expectedTotalCount
                ));
                $this->projectForkRepository->updateTotalFiles($forkRecordId, $expectedTotalCount);
                $totalCount = $expectedTotalCount;
            }
        }

        try {
            // 检查是否已经处理完所有文件
            if ($totalCount > 0 && $processedCount >= $totalCount) {
                $this->logger->info(sprintf('Fork record %d: All %d files already processed, skipping migration', $forkRecordId, $totalCount));
                $this->projectForkRepository->updateStatus($forkRecordId, ForkStatus::FINISHED->value, 100, '');
                return [];
            }

            // 分批获取和处理文件
            while (true) {
                // 始终通过通用游标能力读取源文件；指定 fileIds 时只在
                // 当前页做集合过滤，避免项目 Fork 保留另一套全量读取逻辑。
                $sourcePage = $this->getFilesForCopy($sourceRootFile, $lastFileId, $pageSize);
                $pageFiles = $sourcePage['list'];
                if ($pageFiles === []) {
                    break;
                }
                $lastFileId = end($pageFiles)->getFileId();
                // 过滤不可达（孤儿）文件；部分分享场景再叠加 fileIds 过滤。
                // 游标 $lastFileId 始终取自原始页，避免被过滤页卡住而重复读取。
                $sourceFiles = [];
                $unreachableInPage = 0;
                foreach ($pageFiles as $pageFile) {
                    if ($reachableFileIds !== null && ! isset($reachableFileIds[$pageFile->getFileId()])) {
                        ++$unreachableInPage;
                        continue;
                    }
                    if ($fileIdSet === null || isset($fileIdSet[$pageFile->getFileId()])) {
                        $sourceFiles[] = $pageFile;
                    }
                }
                $skippedUnreachableCount += $unreachableInPage;

                if (empty($sourceFiles)) {
                    if ($sourcePage['next_cursor'] === null) {
                        break;
                    }
                    continue;
                }
                $copyResult = $this->copyFileList(
                    $userCtx,
                    $sourceRootFile,
                    $forkRootFile,
                    $sourceFiles,
                    $sourceToNewIdMap,
                    $pendingParentIds,
                    null,
                    $forkProjectEntity->getCurrentTopicId()
                );
                $processedCount += $copyResult['copied'] + $copyResult['skipped'];
                $failedFileKeys = array_merge($failedFileKeys, $copyResult['failed_file_keys']);

                // 批次级别更新进度 (基于总文件数的准确进度计算)
                if ($totalCount > 0) {
                    // 使用准确的总文件数计算进度，文件迁移阶段占总进度的90%
                    $progress = min(90, max(1, intval(($processedCount / $totalCount) * 90)));
                } else {
                    // 如果总文件数为0，设置默认进度
                    $progress = 50;
                }

                $this->projectForkRepository->updateProgress($forkRecordId, $processedCount, $progress);

                $this->logger->info(sprintf(
                    'Completed batch: processed %d/%d files (fork record %d, progress: %d%%)',
                    $processedCount,
                    $totalCount,
                    $forkRecordId,
                    $progress
                ));

                // 检查是否为最后一批
                if ($sourcePage['next_cursor'] === null) {
                    break; // Less than page size, means it's the last batch
                }
            }

            // 最终更新进度到90%
            $this->projectForkRepository->updateProgress($forkRecordId, $processedCount, 90);
            $this->logger->info(sprintf('Fork record %d: Successfully processed %d/%d files', $forkRecordId, $processedCount, $totalCount));

            if ($skippedUnreachableCount > 0) {
                $this->logger->warning(sprintf(
                    'Fork record %d: skipped %d unreachable files (ancestor directory deleted or missing)',
                    $forkRecordId,
                    $skippedUnreachableCount
                ));
            }

            // 兜底逻辑：修复那些parent_id为null的文件
            if ($pendingParentIds !== []) {
                $this->fixCopiedParentIds($pendingParentIds, $sourceToNewIdMap, $userId);
                $this->logger->info(sprintf('Fixed parent_id for %d files in fork record %d', count($pendingParentIds), $forkRecordId));
            }

            if ($failedFileKeys !== []) {
                $failedCount = count($failedFileKeys);
                $errorMessage = sprintf('Failed to migrate %d of %d files', $failedCount, $totalCount);
                $finalProgress = $totalCount > 0 ? intval(($processedCount / $totalCount) * 100) : 0;
                $this->projectForkRepository->updateStatus(
                    $forkRecordId,
                    ForkStatus::FAILED->value,
                    $finalProgress,
                    $errorMessage,
                );
                $this->logger->error(sprintf(
                    'File migration failed for fork record %d: %s',
                    $forkRecordId,
                    $errorMessage,
                ));
                return $sourceToNewIdMap;
            }

            // Mark as finished
            $this->projectForkRepository->updateStatus($forkRecordId, ForkStatus::FINISHED->value, 100, '');
            $this->logger->info(sprintf('File migration finished for fork record %d.', $forkRecordId));
            return $sourceToNewIdMap;
        } catch (Throwable $e) {
            $this->logger->error(sprintf('File migration failed for fork record %d: %s', $forkRecordId, $e->getMessage()));
            $this->projectForkRepository->updateStatus($forkRecordId, ForkStatus::FAILED->value, 0, 'File migration failed');
            throw $e;
        } finally {
            // 确保用户上下文总是被清理
            // Per-call DataIsolation above is no longer needed after
            // copyFiles loop; no explicit clear required (the per-call
            // value object was scoped to this method).
            unset($userCtx);
        }
    }

    /**
     * @return TaskFileEntity[]
     */
    public function getProjectFilesByIds(int $projectId, array $fileIds): array
    {
        return $this->taskFileRepository->getFilesByIds($fileIds, $projectId);
    }

    public function getSiblingCountByParentId(int $parentId, int $projectId): int
    {
        return $this->taskFileRepository->getSiblingCountByParentId($parentId, $projectId);
    }

    public function createFolderFromFileEntity(
        TaskFileEntity $oldFileEntity,
        int $parentId,
        string $newFileKey,
        string $workDir,
        ?int $targetProjectId = null,
        ?string $targetOrganizationCode = null
    ): TaskFileEntity {
        $dirEntity = new TaskFileEntity();

        // Copy all properties from old entity
        $dirEntity->setProjectId($targetProjectId ?? $oldFileEntity->getProjectId());
        $dirEntity->setUserId($oldFileEntity->getUserId());
        $dirEntity->setOrganizationCode($targetOrganizationCode ?? $oldFileEntity->getOrganizationCode());
        $dirEntity->setFileSize($oldFileEntity->getFileSize());
        $dirEntity->setFileType($oldFileEntity->getFileType());
        $dirEntity->setIsDirectory($oldFileEntity->getIsDirectory());
        $dirEntity->setParentId($parentId);
        $dirEntity->setSource(TaskFileSource::COPY);
        $dirEntity->setStorageType($oldFileEntity->getStorageType());
        $dirEntity->setIsHidden($this->determineIsHidden($oldFileEntity->getFileName(), $parentId, $targetProjectId ?? $oldFileEntity->getProjectId()));
        $dirEntity->setSort($oldFileEntity->getSort());
        $dirEntity->setMetadata($oldFileEntity->getMetadata());  // Preserve metadata when creating folder
        $dirEntity->setDisplayConfig($oldFileEntity->getDisplayConfig());  // Preserve display config when creating folder
        $dirEntity->setFileId(IdGenerator::getSnowId());
        $dirEntity->setFileName($oldFileEntity->getFileName());
        $dirEntity->setFileKey($newFileKey);
        $dirEntity->setSourceFileId($oldFileEntity->getFileId());

        // Set current timestamp for created_at and updated_at
        $now = date('Y-m-d H:i:s');
        $dirEntity->setCreatedAt($now);
        $dirEntity->setUpdatedAt($now);

        $orgCodeForStorage = $targetOrganizationCode ?? $oldFileEntity->getOrganizationCode();
        try {
            $this->cloudFileRepository->createFolderByCredential(WorkDirectoryUtil::getPrefix($workDir), $orgCodeForStorage, $newFileKey, StorageBucketType::SandBox);
        } catch (Throwable $e) {
            $this->logger->error(sprintf('createFolderFromFileEntity err, new_file_key:%s', $newFileKey), ['err' => $e->getMessage()]);
        }

        $this->insertOrUpdate($dirEntity);

        return $dirEntity;
    }

    public function renameFolderFromFileEntity(
        TaskFileEntity $oldFileEntity,
        int $parentId,
        string $newFileKey,
        string $workDir,
        ?int $targetProjectId = null,
        ?string $targetOrganizationCode = null
    ): TaskFileEntity {
        $oldFileKey = $oldFileEntity->getFileKey();
        $oldFileEntity->setParentId($parentId);
        $oldFileEntity->setFileKey($newFileKey);
        $now = date('Y-m-d H:i:s');
        $oldFileEntity->setUpdatedAt($now);

        // Update project_id and organization_code if provided (for cross-project move)
        if ($targetProjectId !== null) {
            $oldFileEntity->setProjectId($targetProjectId);
        }
        if ($targetOrganizationCode !== null) {
            $oldFileEntity->setOrganizationCode($targetOrganizationCode);
        }

        if ($oldFileKey === $newFileKey) {
            return $oldFileEntity;
        }

        // 重命名文件夹
        $orgCodeForStorage = $targetOrganizationCode ?? $oldFileEntity->getOrganizationCode();
        try {
            $this->cloudFileRepository->renameObjectByCredential(WorkDirectoryUtil::getPrefix($workDir), $orgCodeForStorage, $oldFileKey, $newFileKey, StorageBucketType::SandBox);
        } catch (Throwable $e) {
            $this->logger->error(sprintf('renameFolderFromFileEntity, old_file_key: %s, new_file_key:%s', $oldFileKey, $newFileKey), ['err' => $e->getMessage()]);
        }

        // Build update fields
        $updateFields = [
            'parent_id' => $parentId,
            'file_key' => $newFileKey,
            'updated_at' => $now,
        ];
        if ($targetProjectId !== null) {
            $updateFields['project_id'] = $targetProjectId;
        }
        if ($targetOrganizationCode !== null) {
            $updateFields['organization_code'] = $targetOrganizationCode;
        }

        $this->taskFileRepository->updateFileByCondition(['file_id' => $oldFileEntity->getFileId()], $updateFields);

        return $oldFileEntity;
    }

    /**
     * ReBalance directory and calculate sort value.
     */
    public function rebalanceAndCalculateSort(int $targetParentId, ?int $preFileId): int
    {
        // Get all children
        $allChildren = $this->taskFileRepository->getAllChildrenByParentId($targetParentId);

        // Sort by business rules
        $sortedChildren = $this->sortChildrenByBusinessRules($allChildren);

        // Reallocate sort values
        $updates = [];
        $sortValue = self::DEFAULT_SORT_STEP;

        foreach ($sortedChildren as $child) {
            $updates[] = [
                'file_id' => $child['file_id'],
                'sort' => $sortValue,
            ];
            $sortValue += self::DEFAULT_SORT_STEP;
        }

        // Batch update
        $this->taskFileRepository->batchUpdateSort($updates);

        // Log rebalancing operation
        $this->logger->info('File sort rebalance triggered', [
            'parent_id' => $targetParentId,
            'affected_files' => count($updates),
            'gap_threshold' => self::MIN_GAP,
            'timestamp' => date('Y-m-d H:i:s'),
        ]);

        // Calculate target position sort value
        if ($this->isToBeginning($preFileId)) {
            return intval(self::DEFAULT_SORT_STEP / 2);
        }

        // Find preFileId's new sort value
        foreach ($updates as $update) {
            if ($update['file_id'] === $preFileId) {
                return $update['sort'] + intval(self::DEFAULT_SORT_STEP / 2);
            }
        }

        return $sortValue; // Default to end
    }

    public function getUserFileEntityNoUser(int $fileId): TaskFileEntity
    {
        $fileEntity = $this->taskFileRepository->getById($fileId);
        if ($fileEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
        }

        if ($fileEntity->getProjectId() <= 0) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, trans('project.project_not_found'));
        }

        return $fileEntity;
    }

    /**
     * Get sibling file entities by parent id.`.
     * @return TaskFileEntity[]
     */
    public function getSiblingFileEntitiesByParentId(int $parentId, int $projectId): array
    {
        $models = $this->taskFileRepository->getSiblingsByParentId($parentId, $projectId);

        $list = [];
        foreach ($models as $model) {
            $list[] = new TaskFileEntity($model);
        }

        return $list;
    }

    /**
     * Convert attachment array to TaskFileEntity based on type.
     * @param array $attachment Attachment data
     * @param TaskEntity $task Task entity
     */
    public function convertMessageAttachmentToTaskFileEntity(array $attachment, TaskEntity $task): TaskFileEntity
    {
        $taskFileEntity = new TaskFileEntity();
        $taskFileEntity->setProjectId($task->getProjectId());
        $taskFileEntity->setTopicId($task->getTopicId());
        $taskFileEntity->setTaskId($task->getId());

        // Set basic file information
        $taskFileEntity->setFileKey($attachment['file_key']);
        $taskFileEntity->setFileName(! empty($attachment['filename']) ? $attachment['filename'] : (! empty($attachment['display_filename']) ? $attachment['display_filename'] : basename($attachment['file_key'])));
        $taskFileEntity->setFileExtension($attachment['file_extension']);
        $taskFileEntity->setFileSize(! empty($attachment['file_size']) ? $attachment['file_size'] : 0);

        // message type
        $taskFileEntity->setFileType(FileType::fromValue($attachment['file_tag'] ?? null, FileType::PROCESS)->value);
        $taskFileEntity->setSource(TaskFileSource::AGENT);

        // Set storage type (will be overridden by saveProjectFile parameter)
        $taskFileEntity->setStorageType(! empty($attachment['storage_type']) ? $attachment['storage_type'] : StorageType::WORKSPACE->value);

        if (WorkDirectoryUtil::isValidDirectoryName($attachment['file_key'])) {
            $taskFileEntity->setIsDirectory(true);
        } else {
            $taskFileEntity->setIsDirectory(false);
        }
        return $taskFileEntity;
    }

    /**
     * 根据fileKey数组批量获取文件.
     *
     * @param array $fileKeys 文件Key数组
     * @return TaskFileEntity[] 文件实体数组，以file_key为键
     */
    public function getByFileKeys(array $fileKeys): array
    {
        return $this->taskFileRepository->getByFileKeys($fileKeys);
    }

    /**
     * Get file information from cloud storage.
     *
     * @param string $fileName File name
     * @param string $fileKey File key
     * @param string $organizationCode Organization code
     * @return array File information
     */
    public function getFileInfoFromCloudStorage(
        string $fileName,
        string $fileKey,
        string $organizationCode
    ): array {
        if (WorkDirectoryUtil::isValidDirectoryName($fileName)) {
            return [
                'size' => 0,
                'last_modified' => date('Y-m-d H:i:s'),
            ];
        }

        try {
            $headObjectResult = $this->cloudFileRepository->getHeadObjectByCredential($organizationCode, $fileKey, StorageBucketType::SandBox);
            return [
                'size' => $headObjectResult['content_length'] ?? 0,
                'last_modified' => date('Y-m-d H:i:s'),
            ];
        } catch (Throwable $e) {
            // File not found or other cloud storage error
            $this->logger->warning(
                'Failed to get file info from cloud storage',
                [
                    'file_key' => $fileKey,
                    'organization_code' => $organizationCode,
                    'error' => $e->getMessage(),
                ]
            );
            return [
                'size' => 0,
                'last_modified' => date('Y-m-d H:i:s'),
            ];
        }
    }

    /**
     * 获取单个项目的文件数量（workspace + 非隐藏 + 未删除）.
     */
    public function countFilesByProjectId(int $projectId): int
    {
        if ($projectId <= 0) {
            return 0;
        }
        return $this->taskFileRepository->countFilesByProjectId($projectId);
    }

    /**
     * V2 列表口径的附件计数（workspace + 未删除，不过滤 is_hidden、不剔除根目录）.
     * 与 V2 列表接口在不传 file_type 时返回的总行数保持一致，供前端做灰度阈值判断。
     */
    public function countAttachmentsByProjectIdV2(int $projectId): int
    {
        if ($projectId <= 0) {
            return 0;
        }
        return $this->taskFileRepository->countAttachmentsByProjectIdV2($projectId);
    }

    /**
     * 批量获取项目的文件数量.
     *
     * @param array<int> $projectIds 项目ID数组
     * @return array<int, int> [project_id => file_count] 映射数组
     */
    public function countFilesByProjectIds(array $projectIds): array
    {
        if (empty($projectIds)) {
            return [];
        }

        // 调用 Repository 层统计文件数量
        return $this->taskFileRepository->countFilesByProjectIds($projectIds);
    }

    /**
     * 统计项目空间文件数量，最多统计到 $limit 即提前返回.
     * 返回值为 min(实际数量, $limit)，用于发起沙箱前的「是否达到阈值」判断。
     */
    public function countProjectFilesWithLimit(int $projectId, int $limit): int
    {
        if ($projectId <= 0 || $limit <= 0) {
            return 0;
        }
        return $this->taskFileRepository->countProjectFilesWithLimit($projectId, $limit);
    }

    public function countProjectFiles(int $projectId): int
    {
        if ($projectId <= 0) {
            return 0;
        }
        return $this->taskFileRepository->countProjectFiles($projectId);
    }

    /**
     * 统计用户空间文件数量，最多统计到 $limit 即提前返回.
     * 返回值为 min(实际数量, $limit)，用于发起沙箱前的「是否达到阈值」判断。
     */
    public function countUserSpaceFilesWithLimit(string $userId, string $organizationCode, int $limit): int
    {
        if ($userId === '' || $organizationCode === '' || $limit <= 0) {
            return 0;
        }
        return $this->taskFileRepository->countUserSpaceFilesWithLimit($userId, $organizationCode, $limit);
    }

    public function countUserSpaceFiles(string $userId, string $organizationCode): int
    {
        if ($userId === '' || $organizationCode === '') {
            return 0;
        }
        return $this->taskFileRepository->countUserSpaceFiles($userId, $organizationCode);
    }

    /**
     * Create a new directory entity.
     * Returns existing directory id when the same parent/name already exists.
     * The file_key is derived from the parent entity's stored file_key to avoid path-string dependency.
     *
     * @param int $projectId Project ID
     * @param int $parentId Parent directory ID
     * @param string $dirName Directory name
     * @return int Created directory file_id
     */
    public function createDirectory(int $projectId, int $parentId, string $dirName, string $userId, string $organizationCode, string $projectOrganizationCode, TaskFileSource $source = TaskFileSource::PROJECT_DIRECTORY): int
    {
        $existingDir = $this->findDirectoryByParentIdAndName($parentId, $dirName, $projectId);
        if ($existingDir !== null) {
            return $existingDir->getFileId();
        }

        // Derive file_key from parent entity's stored file_key to avoid path-string dependency.
        $parentEntity = $this->taskFileRepository->getById($parentId);
        if ($parentEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
        }
        $fileKey = rtrim($parentEntity->getFileKey(), '/') . '/' . $dirName . '/';

        $dirEntity = new TaskFileEntity();
        $dirEntity->setFileId(IdGenerator::getSnowId());
        $dirEntity->setProjectId($projectId);
        $dirEntity->setUserId($userId);
        $dirEntity->setOrganizationCode($organizationCode);
        $dirEntity->setFileName($dirName);
        $dirEntity->setFileKey($fileKey);
        $dirEntity->setFileSize(0);
        $dirEntity->setFileType(FileType::DIRECTORY->value);
        $dirEntity->setIsDirectory(true);
        $dirEntity->setParentId($parentId);
        $dirEntity->setSource($source);
        $dirEntity->setStorageType(StorageType::WORKSPACE);
        $dirEntity->setIsHidden($this->determineIsHidden($dirName, $parentId, $projectId));
        $dirEntity->setSort(0);

        $now = date('Y-m-d H:i:s');
        $dirEntity->setCreatedAt($now);
        $dirEntity->setUpdatedAt($now);

        $this->insertOrUpdate($dirEntity);

        return $dirEntity->getFileId();
    }

    /**
     * Find a direct child directory by parent ID and directory name.
     * Uses parent_id + file_name tree navigation without any path string dependency.
     *
     * @param int $projectId Project ID
     * @param int $parentId Parent directory file_id
     * @param string $dirName Directory name to look for
     * @return null|TaskFileEntity Found directory entity or null
     */
    public function findChildDirectoryByName(int $projectId, int $parentId, string $dirName): ?TaskFileEntity
    {
        return $this->findDirectChildByName($projectId, $parentId, $dirName, true);
    }

    /**
     * Navigate the file tree by relative path segments, returning any entity (file or directory).
     * Intermediate segments must be directories; the last segment can be either.
     * e.g. "测试/images/photo.png" → root → 测试(dir) → images(dir) → photo.png(file).
     *
     * @param int $projectId Project ID
     * @param string $relativePath Relative path from project root (e.g. "测试/images/photo.png" or "/测试/images/")
     * @return null|TaskFileEntity Target entity or null if any segment not found
     */
    public function findEntityByRelativePath(int $projectId, string $relativePath): ?TaskFileEntity
    {
        $segments = array_values(array_filter(explode('/', trim($relativePath, '/')), static fn (string $s) => $s !== ''));
        if (empty($segments)) {
            return $this->getRootFile($projectId);
        }

        $rootDir = $this->getRootFile($projectId);
        if ($rootDir === null) {
            return null;
        }

        $lastIndex = count($segments) - 1;
        $currentParentId = $rootDir->getFileId();

        foreach ($segments as $index => $segment) {
            if ($index === $lastIndex) {
                // Last segment: match file or directory by name under current parent
                return $this->getByProjectParentAndName($projectId, $currentParentId, $segment);
            }
            // Intermediate segments: must be directories
            $found = $this->findDirectoryByParentIdAndName($currentParentId, $segment, $projectId);
            if ($found === null) {
                return null;
            }
            $currentParentId = $found->getFileId();
        }

        return null;
    }

    /**
     * Navigate directory tree by path segments starting from project root.
     * e.g. ".magic/skills/my-skill" will traverse root -> .magic -> skills -> my-skill.
     *
     * @param int $projectId Project ID
     * @param string $path Relative path from project root (e.g. ".magic/skills/my-skill")
     * @return null|TaskFileEntity Target directory entity or null if any segment not found
     */
    public function findDirectoryByPath(int $projectId, string $path): ?TaskFileEntity
    {
        $segments = array_filter(explode('/', trim($path, '/')), static fn (string $s) => $s !== '');
        if (empty($segments)) {
            return null;
        }

        $rootDir = $this->getRootFile($projectId);
        if ($rootDir === null) {
            return null;
        }

        $currentParentId = $rootDir->getFileId();
        $currentEntity = $rootDir;

        foreach ($segments as $segment) {
            $found = $this->findDirectoryByParentIdAndName($currentParentId, $segment, $projectId);
            if ($found === null) {
                return null;
            }
            $currentParentId = $found->getFileId();
            $currentEntity = $found;
        }

        return $currentEntity;
    }

    /**
     * Get file by project ID and file name (searches across all directories).
     */
    public function getByProjectIdAndFileName(int $projectId, string $fileName): ?TaskFileEntity
    {
        return $this->taskFileRepository->getByProjectIdAndFileName($projectId, $fileName);
    }

    /**
     * Check whether a file with the given name exists anywhere in the project (case-insensitive).
     */
    public function existsFileByName(int $projectId, string $fileName): bool
    {
        $entity = $this->taskFileRepository->getByProjectIdAndFileName($projectId, $fileName);
        if ($entity !== null) {
            return true;
        }

        // Case-insensitive fallback
        $lower = strtolower($fileName);
        if ($lower !== $fileName) {
            return $this->taskFileRepository->getByProjectIdAndFileName($projectId, $lower) !== null;
        }

        return false;
    }

    /**
     * Overwrite an existing project file's content in cloud storage and update its size in the DB.
     * Returns null if the file does not exist in the task file index or does not belong to the given project.
     */
    public function overwriteProjectFileContent(
        ProjectEntity $projectEntity,
        string $fileKey,
        string $content
    ): ?TaskFileEntity {
        $entity = $this->taskFileRepository->getByProjectIdAndFileKey($projectEntity->getId(), $fileKey);
        if ($entity === null) {
            return null;
        }

        // Use the key from the verified entity to prevent caller-supplied key substitution.
        $verifiedFileKey = $entity->getFileKey();

        $this->cloudFileRepository->createFileByCredential(
            WorkDirectoryUtil::getPrefix($projectEntity->getWorkDir()),
            $projectEntity->getUserOrganizationCode(),
            $verifiedFileKey,
            $content,
            StorageBucketType::SandBox
        );

        // A successful object overwrite must invalidate sandbox caches, even for equal sizes.
        return $this->getMagicFSFileDomainService()->updateFile(
            (string) $entity->getFileId(),
            ['size' => strlen($content)]
        );
    }

    /**
     * Clear all descendants under the given directory while keeping the parent node itself.
     *
     * @return array{
     *     project_id:int,
     *     parent_id:int,
     *     deleted_total:int,
     *     deleted_files:int,
     *     deleted_directories:int,
     *     deleted_objects:int
     * }
     */
    public function clearProjectFile(int $projectId, string $organizationCode, int $parentId): array
    {
        $projectEntity = $this->projectRepository->findById($projectId);
        if ($projectEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, trans('project.project_not_found'));
        }

        $workDir = $projectEntity->getWorkDir();
        if ($workDir === '') {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORK_DIR_NOT_FOUND, trans('project.work_dir.not_found'));
        }

        if ($projectEntity->getUserOrganizationCode() !== $organizationCode) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, trans('file.permission_denied'));
        }

        $parentEntity = $this->taskFileRepository->getById($parentId);
        if ($parentEntity === null || $parentEntity->getProjectId() !== $projectId) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
        }
        if (! $parentEntity->getIsDirectory()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_OPERATION_NOT_ALLOWED, trans('file.cannot_replace_directory'));
        }

        $descendants = $this->findFilesRecursivelyByParentId($projectId, $parentId, 100);
        if ($descendants === []) {
            return [
                'project_id' => $projectId,
                'parent_id' => $parentId,
                'deleted_total' => 0,
                'deleted_files' => 0,
                'deleted_directories' => 0,
                'deleted_objects' => 0,
            ];
        }

        $fullPrefix = $this->getFullPrefix($organizationCode);
        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $workDir);
        $parentPrefix = rtrim($parentEntity->getFileKey(), '/') . '/';
        $fileIds = [];
        $fileKeys = [];
        $deletedFiles = 0;
        $deletedDirectories = 0;

        foreach ($descendants as $entity) {
            $fileKey = $entity->getFileKey();

            if (
                $entity->getProjectId() !== $projectId
                || ! WorkDirectoryUtil::checkEffectiveFileKey($fullWorkdir, $fileKey)
                || ! str_starts_with($fileKey, $parentPrefix)
            ) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_ILLEGAL_KEY, trans('file.illegal_file_key'));
            }

            $fileIds[] = $entity->getFileId();
            $fileKeys[] = $fileKey;

            if ($entity->getIsDirectory()) {
                ++$deletedDirectories;
            } else {
                ++$deletedFiles;
            }
        }

        $deleteResult = $this->cloudFileRepository->deleteObjectsByCredential(
            WorkDirectoryUtil::getPrefix($workDir),
            $organizationCode,
            $fileKeys,
            StorageBucketType::SandBox
        );

        if (! empty($deleteResult['errors'])) {
            $this->logger->error('Failed to clear project files from storage', [
                'project_id' => $projectId,
                'parent_id' => $parentId,
                'errors' => $deleteResult['errors'],
            ]);
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_DELETE_FAILED, trans('file.batch_delete_failed'));
        }

        Db::beginTransaction();
        try {
            $this->taskFileRepository->deleteByIds($fileIds);
            Db::commit();
        } catch (Throwable $e) {
            Db::rollBack();
            $this->logger->error('Failed to clear project files from database', [
                'project_id' => $projectId,
                'parent_id' => $parentId,
                'error' => $e->getMessage(),
            ]);
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_DELETE_FAILED, trans('file.batch_delete_failed'));
        }

        return [
            'project_id' => $projectId,
            'parent_id' => $parentId,
            'deleted_total' => count($descendants),
            'deleted_files' => $deletedFiles,
            'deleted_directories' => $deletedDirectories,
            'deleted_objects' => count($deleteResult['deleted'] ?? []),
        ];
    }

    /**
     * Upsert project file node for attachment/client-upload fallback scenarios.
     * Centralizes conflict resolution and tree consistency maintenance.
     */
    public function upsertProjectFileNode(UpsertProjectFileNodeDTO $dto): TaskFileEntity
    {
        $taskFileEntity = $dto->getTaskFileEntity();
        $fileKey = trim($taskFileEntity->getFileKey());

        if ($fileKey === '') {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::FILE_NOT_FOUND,
                'file.file_not_found'
            );
        }

        $fileName = trim($taskFileEntity->getFileName());
        if ($fileName === '') {
            $fileName = basename(rtrim($fileKey, '/'));
            if ($fileName === '') {
                $fileName = '/';
            }
        }

        $parentId = $this->resolveUpsertParentId($dto);
        $lockKey = $this->getProjectNodeUpsertLockKey($dto->getProjectId(), $parentId, $fileName);
        $lockOwner = IdGenerator::getUniqueId32();

        if (! $this->locker->spinLock($lockKey, $lockOwner, 30)) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::FILE_UPLOAD_FAILED,
                'file.operation_failed'
            );
        }

        try {
            $existingByName = $this->taskFileRepository->getByProjectParentAndName(
                $dto->getProjectId(),
                $parentId,
                $fileName,
                $dto->isWithTrash()
            );
            $existingByFileKey = $this->taskFileRepository->getByProjectIdAndFileKey(
                $dto->getProjectId(),
                $fileKey,
                $dto->isWithTrash()
            );

            if ($existingByName !== null
                && $existingByFileKey !== null
                && $existingByName->getFileId() !== $existingByFileKey->getFileId()) {
                $this->logger->error('Conflicting records found while upserting project file node', [
                    'project_id' => $dto->getProjectId(),
                    'parent_id' => $parentId,
                    'file_name' => $fileName,
                    'file_key' => $fileKey,
                    'name_file_id' => $existingByName->getFileId(),
                    'key_file_id' => $existingByFileKey->getFileId(),
                ]);
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::FILE_EXIST,
                    'file.file_exist'
                );
            }

            $fileEntity = $existingByName ?? $existingByFileKey;
            // Keep an immutable before-image for the single final journal
            // event. The existing entity is mutated below before the version
            // chain is bumped, so using it as the before-image would erase
            // the old parent/name in move events.
            $beforeEntity = $fileEntity === null
                ? null
                : new TaskFileEntity($fileEntity->toArray());

            if ($dto->isWithTrash() && $fileEntity?->getDeletedAt() !== null) {
                $wasRestored = true;
            } else {
                $wasRestored = false;
            }

            if ($fileEntity !== null && ! $dto->isUpdated()) {
                if ($wasRestored) {
                    // Restore the row and publish its event in the same
                    // repository transaction.  There is no follow-up update
                    // in this branch that could carry the journal entry.
                    $this->taskFileRepository->restoreFile($fileEntity->getFileId());
                    $fileEntity->setDeletedAt(null);
                }
                return $fileEntity;
            }

            $currentTime = date('Y-m-d H:i:s');
            $isNewFile = $fileEntity === null;
            $oldParentId = $fileEntity?->getParentId();
            $source = $this->resolveTaskFileSource($taskFileEntity);

            if ($isNewFile) {
                $fileEntity = new TaskFileEntity();
                $fileEntity->setFileId(IdGenerator::getSnowId());
                $fileEntity->setCreatedAt($currentTime);
                $fileEntity->setTopicId($taskFileEntity->getTopicId());
                $fileEntity->setTaskId($taskFileEntity->getTaskId());
                $fileEntity->setSpaceType($taskFileEntity->getSpaceType());
                $fileEntity->setSource($source);
                $fileEntity->setLatestVersion(1);
                $fileEntity->setMetadataVersion(1);
                // file_type 只在新建时写入；已存在的节点保留原类型，
                // 避免同名覆盖把「用户创建（user_create）」改写为「用户上传（user_upload）」等。
                $fileEntity->setFileType(! empty($taskFileEntity->getFileType()) ? $taskFileEntity->getFileType() : FileType::PROCESS->value);
            } else {
                if ($source === TaskFileSource::AI_IMAGE_GENERATION) {
                    $fileEntity->setSource($source);
                } elseif ($fileEntity->getSource() === TaskFileSource::AI_IMAGE_GENERATION) {
                    $fileEntity->setSource($fileEntity->getSource());
                }
            }

            $fileEntity->setProjectId($dto->getProjectId());
            $fileEntity->setUserId($dto->getOperatorUserId());
            $fileEntity->setOrganizationCode($dto->getOperatorOrganizationCode());
            $fileEntity->setFileKey($fileKey);
            $fileEntity->setFileName($fileName);

            if ($taskFileEntity->getTopicId() > 0 && $taskFileEntity->getTopicId() !== $fileEntity->getLatestModifiedTopicId()) {
                $fileEntity->setLatestModifiedTopicId($taskFileEntity->getTopicId());
            }
            if ($taskFileEntity->getTaskId() > 0 && $taskFileEntity->getTaskId() !== $fileEntity->getLatestModifiedTaskId()) {
                $fileEntity->setLatestModifiedTaskId($taskFileEntity->getTaskId());
            }

            $fileEntity->setFileExtension(
                ! empty($taskFileEntity->getFileExtension())
                    ? $taskFileEntity->getFileExtension()
                    : pathinfo($fileName, PATHINFO_EXTENSION)
            );
            $fileEntity->setFileSize(! empty($taskFileEntity->getFileSize()) ? $taskFileEntity->getFileSize() : 0);

            if ($dto->getStorageTypeOverride() === '') {
                $fileEntity->setStorageType($taskFileEntity->getStorageType());
            } else {
                $fileEntity->setStorageType($dto->getStorageTypeOverride());
            }

            $fileEntity->setIsHidden($dto->getIsHidden() ?? $this->determineIsHidden($fileName, $parentId, $dto->getProjectId()));
            $fileEntity->setIsDirectory($taskFileEntity->getIsDirectory());
            $fileEntity->setSort(! empty($taskFileEntity->getSort()) ? $taskFileEntity->getSort() : 0);
            $fileEntity->setParentId($parentId);
            $fileEntity->setMetadata(! empty($taskFileEntity->getMetadata()) ? $taskFileEntity->getMetadata() : '');
            $fileEntity->setDisplayConfig(! empty($taskFileEntity->getDisplayConfig()) ? $taskFileEntity->getDisplayConfig() : '');
            $fileEntity->setUpdatedAt($currentTime);

            return Db::transaction(function () use (
                $fileEntity,
                $beforeEntity,
                $isNewFile,
                $wasRestored,
                $oldParentId,
                $parentId
            ): TaskFileEntity {
                if ($wasRestored) {
                    // The final update below emits the single restore event.
                    // Keeping both writes under this outer transaction avoids
                    // an observable active row without its durable journal.
                    $this->taskFileRepository->restoreFile($fileEntity->getFileId(), false);
                    $fileEntity->setDeletedAt(null);
                }

                $saved = $isNewFile
                    ? $this->taskFileRepository->insertOrUpdate($fileEntity)
                    : $this->taskFileRepository->updateById($fileEntity, $wasRestored ? 'restore' : null, false);

                if ($isNewFile) {
                    // The child's own row was appended by insertOrUpdate.
                    $this->bumpFileTreeVersions([$parentId]);
                } else {
                    $parentChanged = $oldParentId !== $parentId;
                    // A move mutates the node and both directory listings; a
                    // plain update mutates only the node. All of them get a
                    // fresh version before the single final snapshot below so
                    // the row a reader sees matches the version it carries.
                    $this->bumpFileTreeVersions(
                        $parentChanged
                            ? [$saved->getFileId(), $oldParentId, $parentId]
                            : [$saved->getFileId()]
                    );
                }

                if (! $isNewFile) {
                    // Re-read after all metadata-version bumps and publish
                    // one coherent update/restore snapshot.
                    $saved = $this->taskFileRepository->getById($saved->getFileId());
                    if ($saved === null) {
                        throw new RuntimeException(sprintf(
                            'File disappeared while upserting project node: %d',
                            $fileEntity->getFileId()
                        ));
                    }
                    $this->taskFileRepository->appendFileTreeMutation(
                        $beforeEntity,
                        $saved,
                        $wasRestored ? 'restore' : null
                    );
                }

                return $saved;
            });
        } finally {
            if (! $this->locker->release($lockKey, $lockOwner)) {
                $this->logger->warning('Failed to release project file node upsert lock', [
                    'lock_key' => $lockKey,
                    'lock_owner' => $lockOwner,
                ]);
            }
        }
    }

    /**
     * Advance the metadata versions of the nodes a mutation just touched.
     *
     * Delegates to the MagicFS domain service because MagicFS owns what a
     * metadata version means for a mounted tree; see
     * MagicFSFileDomainService::bumpFileTreeVersions() for the contract.
     *
     * @param array<null|int|string> $fileIds
     */
    public function bumpFileTreeVersions(array $fileIds): void
    {
        $this->getMagicFSFileDomainService()->bumpFileTreeVersions($fileIds);
    }

    /**
     * Replace file with new file content.
     *
     * @param string $fileId Target file ID to replace
     * @param string $sourceFileKey New file key in cloud storage
     * @param null|string $newFileName New file name (optional)
     * @return TaskFileEntity Updated file entity
     * @throws RuntimeException When cloud storage operation fails
     */
    public function replaceFile(
        string $fileId,
        string $sourceFileKey,
        ?string $newFileName = null
    ): TaskFileEntity {
        $originalFile = $this->taskFileRepository->getById((int) $fileId);
        if ($originalFile === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
        }

        if ($originalFile->getIsDirectory()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_UPLOAD_FAILED, 'Cannot replace directory');
        }

        // 用户空间文件没有项目（project_id=0），存储目录由文件所属用户确定。
        if ($originalFile->isProjectFile()) {
            $project = $this->projectRepository->findById($originalFile->getProjectId());
            if ($project === null) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, trans('project.project_not_found'));
            }
            $workDir = $project->getWorkDir();
        } else {
            $workDir = WorkDirectoryUtil::getUserWorkDir($originalFile->getUserId());
        }
        $organizationCode = $originalFile->getOrganizationCode();
        $fullPrefix = $this->cloudFileRepository->getFullPrefix($organizationCode);

        if (! $this->checkFileExistsInStorage($sourceFileKey, $organizationCode)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, 'Source file not found in storage');
        }

        $finalFileName = $newFileName ?? $originalFile->getFileName();

        $originalFileKey = $originalFile->getFileKey();
        if ($finalFileName === $originalFile->getFileName()) {
            $targetFileKey = $originalFileKey;
        } else {
            $targetFileKey = dirname($originalFileKey) . '/' . $finalFileName;
            $existingFile = $this->taskFileRepository->getByFileKey($targetFileKey);
            if ($existingFile !== null && $existingFile->getFileId() !== $originalFile->getFileId()) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_EXIST, 'Target file already exists');
            }
        }

        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $workDir);
        if (! WorkDirectoryUtil::checkEffectiveFileKey($fullWorkdir, $targetFileKey)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_UPLOAD_FAILED, 'Illegal target file key');
        }

        if (! WorkDirectoryUtil::checkEffectiveFileKey($fullWorkdir, $sourceFileKey)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_UPLOAD_FAILED, 'Illegal source file key');
        }

        try {
            $prefix = WorkDirectoryUtil::getPrefix($workDir);

            if ($sourceFileKey !== $targetFileKey) {
                if ($originalFileKey === $targetFileKey) {
                    $this->cloudFileRepository->deleteObjectByCredential(
                        $prefix,
                        $organizationCode,
                        $originalFileKey,
                        StorageBucketType::SandBox
                    );
                }

                $this->cloudFileRepository->renameObjectByCredential(
                    $prefix,
                    $organizationCode,
                    $sourceFileKey,
                    $targetFileKey,
                    StorageBucketType::SandBox
                );
            }

            if ($originalFileKey !== $targetFileKey
                && $originalFileKey !== $sourceFileKey
                && $this->checkFileExistsInStorage($originalFileKey, $organizationCode)) {
                $this->cloudFileRepository->deleteObjectByCredential(
                    $prefix,
                    $organizationCode,
                    $originalFileKey,
                    StorageBucketType::SandBox
                );
            }
        } catch (Throwable $e) {
            throw new RuntimeException(
                sprintf('Failed to replace file in object storage: %s', $e->getMessage()),
                $e->getCode(),
                $e
            );
        }

        $newFileInfo = $this->getFileInfoFromCloudStorage(
            $finalFileName,
            $targetFileKey,
            $organizationCode
        );

        $originalFile->setFileName($finalFileName);
        $originalFile->setFileKey($targetFileKey);
        $originalFile->setFileExtension(pathinfo($finalFileName, PATHINFO_EXTENSION));
        $originalFile->setFileSize($newFileInfo['size'] ?? 0);
        $originalFile->setUpdatedAt(date('Y-m-d H:i:s'));

        return Db::transaction(function () use ($originalFile, $fileId): TaskFileEntity {
            // Suppress the repository's automatic event until the metadata
            // version chain has been bumped.  The journal must contain the
            // final snapshot, otherwise a mounted client can observe the
            // content replacement and then miss the corresponding revision.
            $before = $this->taskFileRepository->getById($originalFile->getFileId());

            $this->taskFileRepository->updateById($originalFile, null, false);
            // The replacement's own row is appended below; only the version
            // has to move first so that row carries the post-bump value.
            $this->bumpFileTreeVersions([$fileId]);

            $final = $this->taskFileRepository->getById($originalFile->getFileId());
            if ($final === null) {
                throw new RuntimeException(sprintf(
                    'File disappeared while replacing content: %d',
                    $originalFile->getFileId()
                ));
            }

            $this->taskFileRepository->appendFileTreeMutation($before, $final);

            return $final;
        });
    }

    /**
     * 重命名文件（浏览器用户操作语义）.
     *
     * 与文件系统 rename 不同，此方法在目标名称已存在时拒绝操作。
     * 适用于浏览器端的重命名操作，让用户自行决定如何处理冲突。
     *
     * @param string $fileId 文件ID
     * @param string $newName 新文件名
     * @return TaskFileEntity 更新后的文件实体
     * @throws BusinessException 如果同目录下已存在同名文件
     */
    public function renameFileWithCheck(string $fileId, string $newName): TaskFileEntity
    {
        $newName = trim($newName);
        if (empty($newName)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::VALIDATE_FAILED, 'File name is required');
        }

        $file = $this->taskFileRepository->getById((int) $fileId);
        if ($file === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
        }

        if ($newName === $file->getFileName()) {
            return $file;
        }

        // 浏览器语义：同名冲突时拒绝，让用户决定
        $existingFile = $this->taskFileRepository->getByProjectParentAndName(
            $file->getProjectId(),
            $file->getParentId(),
            $newName
        );
        if ($existingFile !== null && $existingFile->getFileId() !== $file->getFileId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_EXIST, trans('file.file_exist'));
        }

        // 冲突检查通过后，委托给 MagicFS 执行实际 rename（is_hidden、版本链等由 MagicFS 处理）
        return $this->getMagicFSFileDomainService()->renameFile($fileId, $newName);
    }

    /**
     * 移动文件到新目录（浏览器用户操作语义）.
     *
     * 与文件系统 rename 不同，此方法在目标目录已存在同名文件时拒绝操作。
     * 适用于浏览器端的移动操作，让用户自行决定如何处理冲突（覆盖/保留两者/取消）。
     *
     * @param string $fileId 文件ID
     * @param string $targetParentId 目标父目录ID
     * @param bool $overwrite 用户明确选择覆盖时传 true
     * @return TaskFileEntity 更新后的文件实体
     * @throws BusinessException 如果目标目录不存在、不是目录、或存在同名冲突且 overwrite=false
     */
    public function moveFileWithCheck(string $fileId, string $targetParentId, bool $overwrite = false): TaskFileEntity
    {
        $file = $this->taskFileRepository->getById((int) $fileId);
        if ($file === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
        }

        $targetParentIdInt = $targetParentId === '' || $targetParentId === '0' ? null : (int) $targetParentId;

        if ($targetParentIdInt === $file->getParentId()) {
            return $file;
        }

        // 浏览器语义：检查目标目录同名冲突
        $existingTarget = $this->taskFileRepository->getByProjectParentAndName(
            $file->getProjectId(),
            $targetParentIdInt,
            $file->getFileName()
        );

        if ($existingTarget !== null && $existingTarget->getFileId() !== $file->getFileId()) {
            if (! $overwrite) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_EXIST, trans('file.file_exist'));
            }
            if ($existingTarget->getIsDirectory()) {
                if (! $file->getIsDirectory()) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::FILE_EXIST, trans('file.file_exist'));
                }

                $this->getMagicFSFileDomainService()->deleteFile((string) $existingTarget->getFileId(), true);
            }
        }

        // 冲突检查通过后，委托给 MagicFS 执行实际操作（覆盖、is_hidden、版本链等由 MagicFS 处理）
        return $this->getMagicFSFileDomainService()->updateFile($fileId, ['parent_id' => $targetParentId]);
    }

    /**
     * 复制文件到目标父目录（浏览器用户操作）.
     *
     * copy 不是文件系统原子操作（POSIX 没有 copy() syscall），属于用户空间行为。
     * 支持同项目与跨项目复制，冲突时根据 $overwrite 决定覆盖或自动改名。
     *
     * @param string $fileId 源文件ID
     * @param string $targetParentId 目标父目录ID
     * @param null|string $newFileName 新文件名（可选）
     * @param bool $overwrite 是否覆盖同名文件
     * @return TaskFileEntity 新创建的文件实体
     */
    public function copyFileToParent(
        string $fileId,
        string $targetParentId,
        ?string $newFileName = null,
        bool $overwrite = false
    ): TaskFileEntity {
        $sourceFile = $this->taskFileRepository->getById((int) $fileId);
        if ($sourceFile === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
        }

        if ($sourceFile->getIsDirectory()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::VALIDATE_FAILED, 'Cannot copy directory');
        }

        $targetFileName = $newFileName ?? $sourceFile->getFileName();
        $targetParentIdInt = $targetParentId === '' || $targetParentId === '0' ? null : (int) $targetParentId;

        $targetParentFile = null;
        if ($targetParentIdInt !== null) {
            $targetParentFile = $this->taskFileRepository->getById($targetParentIdInt);
            if ($targetParentFile === null) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, 'Target parent directory not found');
            }
            if (! $targetParentFile->getIsDirectory()) {
                ExceptionBuilder::throw(SuperAgentErrorCode::VALIDATE_FAILED, 'Target is not a directory');
            }
        }

        $targetProjectId = $targetParentFile?->getProjectId() ?? $sourceFile->getProjectId();
        $targetOrganizationCode = $targetParentFile?->getOrganizationCode() ?? $sourceFile->getOrganizationCode();
        $targetUserId = $targetParentFile?->getUserId() ?? $sourceFile->getUserId();

        // 冲突处理
        $existingTarget = $this->taskFileRepository->getByProjectParentAndName(
            $targetProjectId,
            $targetParentIdInt,
            $targetFileName
        );

        if ($overwrite) {
            if ($existingTarget !== null && $existingTarget->getFileId() === $sourceFile->getFileId()) {
                return $sourceFile;
            }

            if ($existingTarget !== null) {
                if (! $existingTarget->getIsDirectory()) {
                    $this->taskFileRepository->deleteById($existingTarget->getFileId(), false);
                } else {
                    ExceptionBuilder::throw(SuperAgentErrorCode::FILE_EXIST, trans('file.file_exist'));
                }
            }
        } else {
            $targetFileName = $this->generateUniqueFileNameInParent(
                $targetProjectId,
                $targetParentIdInt ?? 0,
                $targetFileName
            );
        }

        $project = $this->projectRepository->findById($targetProjectId);
        if ($project === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, trans('project.project_not_found'));
        }
        $workDir = $project->getWorkDir();

        $newFileId = IdGenerator::getSnowId();
        $fullPrefix = $this->cloudFileRepository->getFullPrefix($targetOrganizationCode);
        $newFileKey = WorkDirectoryUtil::getFullFileKey($fullPrefix, $workDir, (string) $newFileId);

        try {
            $prefix = WorkDirectoryUtil::getPrefix($workDir);
            $this->cloudFileRepository->copyObjectByCredential(
                $prefix,
                $targetOrganizationCode,
                $sourceFile->getFileKey(),
                $newFileKey,
                StorageBucketType::SandBox
            );
        } catch (Throwable $e) {
            throw new RuntimeException(
                sprintf('Failed to copy file in object storage: %s', $e->getMessage()),
                $e->getCode(),
                $e
            );
        }

        $newFileEntity = new TaskFileEntity();
        $newFileEntity->setFileId($newFileId);
        $newFileEntity->setUserId($targetUserId);
        $newFileEntity->setOrganizationCode($targetOrganizationCode);
        $newFileEntity->setProjectId($targetProjectId);
        $newFileEntity->setFileName($targetFileName);
        $newFileEntity->setFileKey($newFileKey);
        $newFileEntity->setFileExtension(pathinfo($targetFileName, PATHINFO_EXTENSION));
        $newFileEntity->setFileSize($sourceFile->getFileSize());
        $newFileEntity->setIsDirectory(false);
        $newFileEntity->setParentId($targetParentIdInt);
        $newFileEntity->setIsHidden($this->determineIsHidden($targetFileName, $targetParentIdInt, $targetProjectId));
        $newFileEntity->setStorageType($sourceFile->getStorageType());
        $newFileEntity->setSourceFileId($sourceFile->getFileId());
        $newFileEntity->setSource(TaskFileSource::COPY);
        $newFileEntity->setLatestVersion(1);
        $newFileEntity->setMetadataVersion(1);
        $newFileEntity->setFileType($sourceFile->getFileType());
        $newFileEntity->setMetadata($sourceFile->getMetadata());
        $newFileEntity->setDisplayConfig($sourceFile->getDisplayConfig());

        $now = date('Y-m-d H:i:s');
        $newFileEntity->setCreatedAt($now);
        $newFileEntity->setUpdatedAt($now);

        $newFileEntity = $this->taskFileRepository->insert($newFileEntity);

        if ($targetParentIdInt !== null) {
            $this->bumpFileTreeVersions([$targetParentIdInt]);
        }

        return $newFileEntity;
    }

    /**
     * Get existing WAV file names under a parent directory.
     *
     * @param int $parentId Parent directory file ID
     * @param array $fileNames File names to check
     * @return string[] Existing file names
     */
    public function getExistingWavFileNamesByParentId(int $parentId, array $fileNames): array
    {
        return $this->taskFileRepository->getExistingFileNamesByParentId($parentId, $fileNames);
    }

    /**
     * Batch insert WAV file records under a specific parent directory.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param int $projectId Project ID
     * @param int $parentId Parent directory file ID
     * @param array $wavFiles Array of [['file_name' => ..., 'file_key' => ..., 'file_size' => ...], ...]
     */
    public function batchInsertWavFiles(DataIsolation $dataIsolation, int $projectId, int $parentId, array $wavFiles): void
    {
        $this->taskFileRepository->batchInsertWavFiles($dataIsolation, $projectId, $parentId, $wavFiles);
    }

    /**
     * 计算仍能回溯到项目根的文件（可达集合）。
     *
     * 口径与分享列表的 RelativeFilePathUtil::filterByValidParentChain 一致：
     * 只有父链一路向上能在同一集合内找到、并终止于顶层（parent 为空或 <=0）
     * 的文件才可达。父目录已被删除的文件属于孤儿数据，不可达，复制时应丢弃。
     *
     * @param array<int, null|int> $parentMap [file_id => parent_id]
     * @return array<int, int> [file_id => file_id] 可达文件ID集合
     */
    private function resolveReachableFileIds(array $parentMap): array
    {
        $resolved = [];   // file_id => 是否可达（含中间节点缓存）
        $reachable = [];
        foreach (array_keys($parentMap) as $fileId) {
            if (isset($resolved[$fileId])) {
                if ($resolved[$fileId]) {
                    $reachable[$fileId] = $fileId;
                }
                continue;
            }

            $chain = [];
            $seen = [];
            $cursor = $fileId;
            $result = false;
            while (true) {
                if (isset($resolved[$cursor])) {
                    $result = $resolved[$cursor];
                    break;
                }
                if (isset($seen[$cursor])) {
                    // 环，视为不可达
                    break;
                }
                $seen[$cursor] = true;
                $chain[] = $cursor;

                $parentId = $parentMap[$cursor] ?? null;
                if ($parentId === null || $parentId <= 0) {
                    $result = true;
                    break;
                }
                if (! array_key_exists($parentId, $parentMap)) {
                    // 父节点缺失（例如父目录已删除），不可达
                    break;
                }
                $cursor = $parentId;
            }

            foreach ($chain as $id) {
                $resolved[$id] = $result;
                if ($result) {
                    $reachable[$id] = $id;
                }
            }
        }

        return $reachable;
    }

    private function setPendingNewFileId(array &$pendingParentIds, int $sourceFileId, int $newFileId): void
    {
        foreach ($pendingParentIds as &$pending) {
            if (($pending['source_file_id'] ?? null) === $sourceFileId) {
                $pending['new_id'] = $newFileId;
                return;
            }
        }
    }

    private function copyFileBatch(DataIsolation $dataIsolation, array $copyBatch, array $copyEntities, TaskFileEntity $targetRootFile, array &$sourceToTarget, array &$pendingParentIds, array &$result, ?int $targetTopicId = null): void
    {
        try {
            $lastError = null;
            for ($attempt = 1; $attempt <= self::FILE_COPY_MAX_ATTEMPTS; ++$attempt) {
                try {
                    $copyResult = $this->sandboxGateway->copyFiles($dataIsolation, $copyBatch);
                    if ($copyResult->isSuccess()) {
                        $lastError = null;
                        break;
                    }
                    $lastError = new RuntimeException($copyResult->getMessage() ?: 'Sandbox file copy failed');
                } catch (Throwable $e) {
                    $lastError = $e;
                }

                $this->logger->warning('TaskFile tree batch copy attempt failed', [
                    'attempt' => $attempt,
                    'max_attempts' => self::FILE_COPY_MAX_ATTEMPTS,
                    'batch_size' => count($copyBatch),
                    'source_file_keys' => array_map(
                        static fn (array $copyItem): string => (string) ($copyItem['source_oss_path'] ?? ''),
                        $copyBatch
                    ),
                    'error' => $lastError->getMessage(),
                ]);
            }
            if ($lastError !== null) {
                throw $lastError;
            }
            foreach ($copyEntities as [$sourceFile, $targetKey, $parentId, $newFileId]) {
                $newFile = $this->copyTaskFileEntity(
                    $sourceFile,
                    $dataIsolation->getCurrentUserId(),
                    $dataIsolation->getCurrentOrganizationCode(),
                    $targetRootFile->getProjectId(),
                    $targetTopicId ?? $targetRootFile->getTopicId(),
                    $targetKey,
                    $parentId,
                    $newFileId
                );
                $newFile->setSource(TaskFileSource::COPY);
                $created = $this->taskFileRepository->insert($newFile);
                $sourceToTarget[$sourceFile->getFileId()] = $created->getFileId();
                $result['source_to_target_file_keys'][$sourceFile->getFileKey()] = $created->getFileKey();
                $this->setPendingNewFileId($pendingParentIds, $sourceFile->getFileId(), $created->getFileId());
                ++$result['copied'];
            }
        } catch (Throwable $e) {
            $result['failed'] += count($copyEntities);
            foreach ($copyEntities as [$sourceFile]) {
                $result['failed_file_keys'][] = $sourceFile->getFileKey();
            }
            $this->logger->error('TaskFile tree batch copy failed', ['batch_size' => count($copyBatch), 'error' => $e->getMessage()]);
        }
    }

    private function getMagicFSFileDomainService(): MagicFSFileDomainService
    {
        return di(MagicFSFileDomainService::class);
    }

    private function resolveUpsertParentId(UpsertProjectFileNodeDTO $dto): int
    {
        $taskFileEntity = $dto->getTaskFileEntity();
        $parentId = $taskFileEntity->getParentId();

        if ($parentId !== null && $parentId > 0) {
            $parentFile = $this->taskFileRepository->getById($parentId);
            if ($parentFile === null) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::FILE_NOT_FOUND,
                    'Parent directory not found'
                );
            }

            if (! $parentFile->getIsDirectory()) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::FILE_UPLOAD_FAILED,
                    'Parent is not a directory'
                );
            }

            if ($parentFile->getProjectId() !== $dto->getProjectId()) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::FILE_NOT_FOUND,
                    'File not found'
                );
            }

            return $parentId;
        }

        return $this->findOrCreateProjectRootDirectory(
            $dto->getProjectId(),
            $dto->getProjectWorkDir(),
            $dto->getOperatorUserId(),
            $dto->getOperatorOrganizationCode(),
            $dto->getProjectOrganizationCode()
        );
    }

    private function resolveTaskFileSource(TaskFileEntity $taskFileEntity): TaskFileSource
    {
        try {
            return $taskFileEntity->getSource();
        } catch (Throwable) {
            return TaskFileSource::DEFAULT;
        }
    }

    private function getProjectNodeUpsertLockKey(int $projectId, ?int $parentId, string $fileName): string
    {
        return sprintf(
            'magicfs:file_node_upsert:%d:%d:%s',
            $projectId,
            (int) ($parentId ?? 0),
            md5($fileName)
        );
    }

    private function checkFileExistsInStorage(string $fileKey, string $organizationCode): bool
    {
        try {
            $this->cloudFileRepository->getHeadObjectByCredential(
                $organizationCode,
                $fileKey,
                StorageBucketType::SandBox
            );
            return true;
        } catch (Throwable) {
            return false;
        }
    }

    private function findDirectChildByName(
        int $projectId,
        int $parentId,
        string $fileName,
        bool $isDirectory
    ): ?TaskFileEntity {
        $limit = 200;
        $offset = 0;

        do {
            $children = $this->taskFileRepository->getChildrenByParentIdsAndProject(
                $projectId,
                [$parentId],
                $limit,
                $offset
            );

            foreach ($children as $child) {
                if ($child->getFileName() === $fileName && $child->getIsDirectory() === $isDirectory) {
                    return $child;
                }
            }

            $offset += count($children);
        } while (count($children) === $limit);

        return null;
    }

    /**
     * Normalize relative path.
     * Removes leading './', '/', and handles edge cases.
     *
     * @param string $path Relative path
     * @return string Normalized path
     */
    private function normalizeRelativePath(string $path): string
    {
        // Remove leading './'
        $path = preg_replace('#^\./#', '', $path);
        // Remove leading '/'
        $path = ltrim($path, '/');
        // Remove consecutive '/'
        $path = preg_replace('#/+#', '/', $path);
        // Remove trailing '/'
        return rtrim($path, '/');
    }

    /**
     * Copy file in cloud storage (without deleting source file).
     *
     * @param TaskFileEntity $fileEntity File entity
     * @param ProjectEntity $sourceProject Source project
     * @param ProjectEntity $targetProject Target project
     * @param string $targetPath Target path
     */
    private function copyFileInCloudStorage(
        TaskFileEntity $fileEntity,
        ProjectEntity $sourceProject,
        ProjectEntity $targetProject,
        string $targetPath,
        DataIsolation $sourceDataIsolation
    ): void {
        if ($sourceProject->getUserOrganizationCode() === $targetProject->getUserOrganizationCode()) {
            // Same organization: use copy operation
            $this->cloudFileRepository->copyObjectByCredential(
                '',
                $targetProject->getUserOrganizationCode(),
                $fileEntity->getFileKey(),
                $targetPath,
                StorageBucketType::SandBox
            );
        } else {
            // Different organization: use sandbox gateway for cross-organization copy
            if ($sourceDataIsolation->getCurrentOrganizationCode() !== $sourceProject->getUserOrganizationCode()
                || $sourceDataIsolation->getCurrentUserId() !== $sourceProject->getUserId()) {
                throw new InvalidArgumentException('跨组织文件操作必须传入源项目用户的数据隔离对象');
            }
            $copyUserCtx = $sourceDataIsolation;
            $copyResult = $this->sandboxGateway->copyFiles(
                $copyUserCtx,
                [
                    [
                        'source_oss_path' => $fileEntity->getFileKey(),
                        'target_oss_path' => $targetPath,
                    ],
                ],
            );

            if (! $copyResult->isSuccess()) {
                $this->logger->error('Failed to copy file across organizations', [
                    'source_file_key' => $fileEntity->getFileKey(),
                    'target_path' => $targetPath,
                    'source_org' => $sourceProject->getUserOrganizationCode(),
                    'target_org' => $targetProject->getUserOrganizationCode(),
                ]);
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::FILE_COPY_FAILED,
                    trans('file.cross_organization_copy_failed')
                );
            }

            // Note: Do NOT delete source file (this is copy, not move)
        }
    }

    /**
     * Generate the object key for an ordinary copied MagicFS node.
     * Space roots keep their existing deterministic key rules; every child
     * file or directory uses its newly generated file_id without a trailing slash.
     */
    private function buildCopiedFileKey(string $targetRootKey, int $newFileId): string
    {
        return rtrim($targetRootKey, '/') . '/' . $newFileId;
    }

    /**
     * Move file in cloud storage.
     *
     * @param TaskFileEntity $fileEntity File entity
     * @param ProjectEntity $sourceProject Source project
     * @param ProjectEntity $targetProject Target project
     * @param string $targetPath Target path
     */
    private function moveFileInCloudStorage(
        TaskFileEntity $fileEntity,
        ProjectEntity $sourceProject,
        ProjectEntity $targetProject,
        string $targetPath,
        DataIsolation $sourceDataIsolation
    ): void {
        if ($sourceProject->getUserOrganizationCode() === $targetProject->getUserOrganizationCode()) {
            // Same organization: use efficient rename operation
            $this->cloudFileRepository->renameObjectByCredential(
                '',
                $targetProject->getUserOrganizationCode(),
                $fileEntity->getFileKey(),
                $targetPath,
                StorageBucketType::SandBox
            );
        } else {
            // Different organization: use sandbox gateway for cross-organization copy
            if ($sourceDataIsolation->getCurrentOrganizationCode() !== $sourceProject->getUserOrganizationCode()
                || $sourceDataIsolation->getCurrentUserId() !== $sourceProject->getUserId()) {
                throw new InvalidArgumentException('跨组织文件操作必须传入源项目用户的数据隔离对象');
            }
            $copyUserCtx = $sourceDataIsolation;
            $copyResult = $this->sandboxGateway->copyFiles(
                $copyUserCtx,
                [
                    [
                        'source_oss_path' => $fileEntity->getFileKey(),
                        'target_oss_path' => $targetPath,
                    ],
                ],
            );

            if (! $copyResult->isSuccess()) {
                $this->logger->error('Failed to copy file across organizations', [
                    'source_file_key' => $fileEntity->getFileKey(),
                    'target_path' => $targetPath,
                    'source_org' => $sourceProject->getUserOrganizationCode(),
                    'target_org' => $targetProject->getUserOrganizationCode(),
                ]);
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::FILE_MOVE_FAILED,
                    trans('file.cross_organization_copy_failed')
                );
            }

            // Delete original file after successful copy
            $sourcePrefix = WorkDirectoryUtil::getPrefix($sourceProject->getWorkDir());
            $this->cloudFileRepository->deleteObjectByCredential(
                $sourcePrefix,
                $sourceProject->getUserOrganizationCode(),
                $fileEntity->getFileKey(),
                StorageBucketType::SandBox,
                ['cache' => false]
            );
        }
    }

    /**
     * Update file record in database.
     *
     * @param TaskFileEntity $fileEntity File entity
     * @param ProjectEntity $sourceProject Source project
     * @param ProjectEntity $targetProject Target project
     * @param int $targetParentId Target parent ID
     */
    private function updateFileRecord(
        TaskFileEntity $fileEntity,
        ProjectEntity $sourceProject,
        ProjectEntity $targetProject,
        string $targetFileKey,
        string $targetFileName,
        int $targetParentId
    ): void {
        $sameProject = $sourceProject->getId() === $targetProject->getId();
        $sameOrganization = $sourceProject->getUserOrganizationCode() === $targetProject->getUserOrganizationCode();

        // Build update fields
        $updateFields = [
            'file_name' => $targetFileName,
            'parent_id' => $targetParentId,
            'metadata' => $fileEntity->getMetadata(),  // Preserve metadata when moving
            'display_config' => $fileEntity->getDisplayConfig(),  // Preserve display config when moving
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        if ($fileEntity->getFileKey() !== $targetFileKey || ! $sameProject || ! $sameOrganization) {
            $updateFields['file_key'] = $targetFileKey;
        }

        // Update project_id if cross-project
        if (! $sameProject) {
            $updateFields['project_id'] = $targetProject->getId();
        }

        // Update organization_code if cross-organization
        if (! $sameOrganization) {
            $updateFields['organization_code'] = $targetProject->getUserOrganizationCode();
        }

        $this->taskFileRepository->updateFileByCondition(
            ['file_id' => $fileEntity->getFileId()],
            $updateFields
        );
    }

    /**
     * Generate unique file name in target parent using parent_id + file_name semantics.
     */
    private function generateUniqueFileNameInParent(
        int $projectId,
        int $parentId,
        string $originalFileName
    ): string {
        $siblings = $this->taskFileRepository->getChildrenByParentAndProject($projectId, $parentId, 10000);

        $existingNames = [];
        foreach ($siblings as $sibling) {
            $existingNames[$sibling->getFileName()] = true;
        }

        if (! isset($existingNames[$originalFileName])) {
            return $originalFileName;
        }

        $pathInfo = pathinfo($originalFileName);
        $baseName = $pathInfo['filename'] ?? $originalFileName;
        $extension = isset($pathInfo['extension']) ? '.' . $pathInfo['extension'] : '';

        for ($i = 1; $i <= 20; ++$i) {
            $candidate = $baseName . '(' . $i . ')' . $extension;
            if (! isset($existingNames[$candidate])) {
                return $candidate;
            }
        }

        return $baseName . '_' . time() . substr((string) microtime(true), -6) . $extension;
    }

    /**
     * Ensure the complete directory path exists, creating missing directories.
     *
     * @param int $projectId Project ID
     * @param string $dirPath Directory path (e.g., "a/b/c")
     * @param string $workDir Project work directory
     * @param string $userId User ID
     * @param string $organizationCode Organization code
     * @param TaskFileSource $source File source
     * @return int The file_id of the final directory in the path
     */
    private function ensureDirectoryPathExists(int $projectId, string $dirPath, string $workDir, string $userId, string $organizationCode, string $projectOrganizationCode, TaskFileSource $source = TaskFileSource::PROJECT_DIRECTORY): int
    {
        $pathParts = array_filter(explode('/', trim($dirPath, '/')));
        $currentParentId = $this->findOrCreateProjectRootDirectory($projectId, $workDir, $userId, $organizationCode, $projectOrganizationCode, $source);

        foreach ($pathParts as $dirName) {
            // createDirectory is idempotent: returns existing dir ID if already present
            $currentParentId = $this->createDirectory($projectId, $currentParentId, $dirName, $userId, $organizationCode, $projectOrganizationCode, $source);
        }

        return $currentParentId;
    }

    /**
     * Find directory by parent ID and name.
     *
     * @param null|int $parentId Parent directory ID (null for root level)
     * @param string $dirName Directory name
     * @param int $projectId Project ID
     * @return null|TaskFileEntity Found directory entity or null
     */
    private function findDirectoryByParentIdAndName(?int $parentId, string $dirName, int $projectId): ?TaskFileEntity
    {
        // Get all siblings under the parent directory
        $siblings = $this->taskFileRepository->getSiblingsByParentId($parentId, $projectId);

        foreach ($siblings as $sibling) {
            // Convert array to entity for consistency (if needed)
            if (is_array($sibling)) {
                if ($sibling['is_directory'] && $sibling['file_name'] === $dirName) {
                    return $this->taskFileRepository->getById($sibling['file_id']);
                }
            } elseif ($sibling instanceof TaskFileEntity) {
                if ($sibling->getIsDirectory() && $sibling->getFileName() === $dirName) {
                    return $sibling;
                }
            }
        }

        return null;
    }

    /**
     * Prepare URL options for file download/preview.
     *
     * @param string $filename File name
     * @param string $downloadMode Download mode (download, preview, inline)
     * @param bool $addWatermark Whether to add watermark parameters
     * @param TaskFileEntity $fileEntity File entity
     * @return array URL options array
     */
    private function prepareFileUrlOptions(string $filename, string $downloadMode, bool $addWatermark, TaskFileEntity $fileEntity): array
    {
        return FileDownloadUrlHelper::prepareFileUrlOptions(
            $filename,
            $downloadMode,
            $addWatermark,
            $fileEntity->getSource()
        );
    }

    /**
     * Generate file URL for a single file entity.
     *
     * @param string $projectOrganizationCode Project organization code
     * @param TaskFileEntity $fileEntity File entity
     * @param string $downloadMode Download mode
     * @param string $fileId File ID for result array
     * @return array URL result array or null if failed
     */
    private function generateFileUrlForEntity(
        string $projectOrganizationCode,
        TaskFileEntity $fileEntity,
        string $downloadMode,
        string $fileId,
        bool $addWatermark = true,
        bool $useCache = true,
        ?int $expires = null
    ): array {
        // 准备下载选项，包含水印参数
        $filename = $fileEntity->getFileName();
        $urlOptions = $this->prepareFileUrlOptions($filename, $downloadMode, $addWatermark, $fileEntity);

        $effectiveExpires = $expires ?? self::URL_EXPIRES;
        $urlOptions['expires'] = $effectiveExpires;
        $urlOptions['cache'] = $useCache;

        // 生成预签名URL（水印参数已包含在签名中）
        $preSignedUrl = $this->getFilePreSignedUrl($projectOrganizationCode, $fileEntity, $urlOptions);

        // 返回结果数组
        return [
            'file_id' => $fileId,
            'url' => $preSignedUrl,
            'expires_at' => date('Y-m-d H:i:s', time() + $effectiveExpires),
        ];
    }

    /**
     * Read a valid cached URL without generating a new URL on cache miss.
     */
    private function getCachedFileUrl(
        string $projectOrganizationCode,
        TaskFileEntity $fileEntity,
        ?int $version,
        string $downloadMode,
        bool $addWatermark
    ): ?array {
        $fileId = $fileEntity->getFileId();
        $cacheKey = $this->buildFileUrlCacheKey(
            $projectOrganizationCode,
            $fileId,
            $version,
            $downloadMode,
            $addWatermark
        );
        $cachedData = $this->cache->get($cacheKey);
        if (! is_array($cachedData)) {
            return null;
        }

        $cachedAt = $cachedData['cached_at'] ?? 0;
        $expiresAt = $cachedData['expires_at'] ?? 0;
        $updatedAtStr = $fileEntity->getUpdatedAt();
        $fileUpdatedAt = ! empty($updatedAtStr) ? strtotime($updatedAtStr) : 0;
        $currentTime = time();

        // Hit when file not updated and url won't expire immediately.
        if ($fileUpdatedAt > $cachedAt || ($currentTime + self::URL_EXPIRY_BUFFER) >= $expiresAt) {
            return null;
        }

        $url = $cachedData['url'] ?? null;
        if (! is_string($url) || $url === '') {
            return null;
        }

        return [
            'file_id' => (string) $fileId,
            'url' => $url,
            'expires_at' => date('Y-m-d H:i:s', $expiresAt),
        ];
    }

    /**
     * Write file URL cache with standard ttl/expiry payload.
     */
    private function writeFileUrlCache(string $cacheKey, string $url): void
    {
        $currentTime = time();
        $cacheData = [
            'url' => $url,
            'cached_at' => $currentTime,
            'expires_at' => $currentTime + self::URL_EXPIRES,
        ];
        $this->cache->set($cacheKey, $cacheData, self::CACHE_TTL);
    }

    /**
     * Build cache key for file URL.
     */
    private function buildFileUrlCacheKey(
        string $organizationCode,
        int $fileId,
        ?int $version,
        string $downloadMode,
        bool $addWatermark
    ): string {
        $versionPart = $version ?? 'current';
        $watermarkPart = $addWatermark ? 'wm' : 'no_wm';
        $imageProcess = ImageProcessFactory::getByHeader()?->toString();
        return sprintf(
            '%s%s:%d:%s:%s:%s:%s',
            self::FILE_URL_CACHE_PREFIX,
            $organizationCode,
            $fileId,
            $versionPart,
            $downloadMode,
            $watermarkPart,
            $imageProcess,
        );
    }

    /**
     * Helper to copy TaskFileEntity properties for forking.
     *
     * @param TaskFileEntity $sourceFile Source file entity
     * @param string $userId User ID creating the file
     * @param string $organizationCode Organization code
     * @param int $projectId New project ID for the fork
     * @param int $topicId New topic ID for the fork
     * @param string $newFileKey New file key for the fork
     * @param null|int $parentId Parent ID for the new file (null to keep original mapping logic)
     * @return TaskFileEntity New task file entity
     */
    private function copyTaskFileEntity(
        TaskFileEntity $sourceFile,
        string $userId,
        string $organizationCode,
        int $projectId,
        int $topicId,
        string $newFileKey,
        ?int $parentId = null,
        ?int $newFileId = null
    ): TaskFileEntity {
        $newTaskFile = new TaskFileEntity();
        $newTaskFile->setFileId($newFileId ?? IdGenerator::getSnowId());
        $newTaskFile->setProjectId($projectId);
        $newTaskFile->setTopicId($topicId);
        $newTaskFile->setFileType($sourceFile->getFileType());
        $newTaskFile->setFileName($sourceFile->getFileName());
        $newTaskFile->setFileExtension($sourceFile->getFileExtension());
        $newTaskFile->setFileKey($newFileKey);
        $newTaskFile->setFileSize($sourceFile->getFileSize());
        $newTaskFile->setIsHidden($this->determineIsHidden($sourceFile->getFileName(), $parentId, $projectId));
        $newTaskFile->setIsDirectory($sourceFile->getIsDirectory());

        // Use provided parentId or fall back to source file's parentId
        $newTaskFile->setParentId($parentId);

        $newTaskFile->setSort($sourceFile->getSort());
        $newTaskFile->setSourceFileId($sourceFile->getFileId());
        // Keep the logical MagicFS space aligned with the source tree. The
        // entity default is `project`, which would make copied Topic files
        // invisible to queries constrained by space_type = topic.
        $newTaskFile->setSpaceType($sourceFile->getSpaceType());
        $newTaskFile->setStorageType($sourceFile->getStorageType());
        $newTaskFile->setMetadata($sourceFile->getMetadata());
        $newTaskFile->setDisplayConfig($sourceFile->getDisplayConfig());
        $newTaskFile->setUserId($userId);
        $newTaskFile->setOrganizationCode($organizationCode);
        $newTaskFile->setSource(TaskFileSource::DEFAULT->value);
        $newTaskFile->setCreatedAt(date('Y-m-d H:i:s'));
        $newTaskFile->setUpdatedAt(date('Y-m-d H:i:s'));

        return $newTaskFile;
    }

    /**
     * Acquire project-level move lock.
     */
    private function acquireProjectMoveLock(int $projectId): array
    {
        $lockKey = self::FILE_MOVE_LOCK_PREFIX . ':project:' . $projectId;
        $lockOwner = IdGenerator::getUniqueId32();
        $lockAcquired = $this->locker->spinLock($lockKey, $lockOwner, self::LOCK_TIMEOUT);

        return [$lockAcquired, $lockKey, $lockOwner];
    }

    /**
     * Release project-level move lock.
     */
    private function releaseProjectMoveLock(string $lockKey, string $lockOwner): void
    {
        if (! $this->locker->release($lockKey, $lockOwner)) {
            $this->logger->error('Failed to release file move lock', [
                'lock_key' => $lockKey,
                'lock_owner' => $lockOwner,
            ]);
        }
    }

    /**
     * Check if file should be moved to beginning.
     */
    private function isToBeginning(?int $preFileId): bool
    {
        return $preFileId === null || $preFileId === 0 || $preFileId === -1;
    }

    /**
     * Calculate sort value after a specific file.
     */
    private function calculateSortAfterFile(array $children, ?int $preFileId): ?int
    {
        if (empty($children)) {
            return self::DEFAULT_SORT_STEP;
        }

        // Sort by sort value
        usort($children, fn ($a, $b) => $a['sort'] <=> $b['sort']);

        // Move to beginning
        if ($this->isToBeginning($preFileId)) {
            $firstSort = $children[0]['sort'] ?? self::DEFAULT_SORT_STEP;
            return $firstSort > self::MIN_GAP ? intval($firstSort / 2) : null;
        }

        // Move after specific file
        $preFileIndex = array_search($preFileId, array_column($children, 'file_id'));

        if ($preFileIndex === false) {
            // Move to end
            $lastSort = end($children)['sort'] ?? 0;
            return $lastSort + self::DEFAULT_SORT_STEP;
        }

        // Calculate insertion position
        $prevSort = $children[$preFileIndex]['sort'];
        $nextSort = isset($children[$preFileIndex + 1])
            ? $children[$preFileIndex + 1]['sort']
            : $prevSort + self::DEFAULT_SORT_STEP * 2;

        $gap = $nextSort - $prevSort;
        return $gap > self::MIN_GAP ? $prevSort + intval($gap / 2) : null;
    }

    /**
     * Sort children by business rules.
     */
    private function sortChildrenByBusinessRules(array $children): array
    {
        usort($children, function ($a, $b) {
            // Files with sort value have priority
            if (($a['sort'] > 0) !== ($b['sort'] > 0)) {
                return ($b['sort'] > 0) <=> ($a['sort'] > 0);
            }

            // If both have sort values, sort by sort value
            if ($a['sort'] > 0 && $b['sort'] > 0) {
                return $a['sort'] <=> $b['sort'];
            }

            // Directories have priority
            if ($a['is_directory'] !== $b['is_directory']) {
                return $b['is_directory'] <=> $a['is_directory'];
            }

            // Sort by creation time
            return $b['created_at'] <=> $a['created_at'];
        });

        return $children;
    }
}

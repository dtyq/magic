<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\ProjectFileConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectForkEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\FileType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ForkStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageMetadata;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\SandboxFileNotificationDataValueObject;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\AttachmentsProcessedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectForkRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileVersionRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TopicRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\WorkspaceVersionRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Dtyq\SuperMagic\Infrastructure\Utils\ContentTypeUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\FileSortUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkFileUtil;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

class TaskFileDomainService
{
    // File move operation constants
    private const FILE_MOVE_LOCK_PREFIX = 'file_move_operation';

    private const LOCK_TIMEOUT = 30;

    private const DEFAULT_SORT_STEP = 1024;

    private const MIN_GAP = 10;

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
        protected TaskFileVersionRepositoryInterface $taskFileVersionRepository,  // 新增依赖
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
     * Get file by file key.
     */
    public function getByFileKey(string $fileKey): ?TaskFileEntity
    {
        return $this->taskFileRepository->getByFileKey($fileKey);
    }

    /**
     * Get file by project ID and file key.
     */
    public function getByProjectIdAndFileKey(int $projectId, string $fileKey): ?TaskFileEntity
    {
        return $this->taskFileRepository->getByProjectIdAndFileKey($projectId, $fileKey);
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
     * 递归查询目录下所有文件（使用 parent_id 索引，高性能）.
     * 利用 idx_project_parent_sort 索引进行广度优先遍历.
     * 使用批量查询避免 N+1 问题.
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

        // 广度优先遍历，逐层查询
        for ($depth = 0; $depth < $maxDepth && ! empty($currentLevelParentIds); ++$depth) {
            // 批量查询当前层所有父目录的子项（一次 SQL 查询，避免 N+1 问题）
            $children = $this->taskFileRepository->getChildrenByParentIdsAndProject(
                $projectId,
                $currentLevelParentIds,
                1000
            );

            if (empty($children)) {
                break;
            }

            $nextLevelParentIds = [];
            foreach ($children as $child) {
                $allFiles[] = $child;

                // 如果是目录，加入下一层的查询队列
                if ($child->getIsDirectory()) {
                    $nextLevelParentIds[] = $child->getFileId();
                }
            }

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
     * Get the latest updated file by project ID.
     */
    public function getLatestUpdatedByProjectId(int $projectId): string
    {
        $lastUpdatedTime = null;

        // 获取文件最新更新的时间
        $lastFileEntity = $this->taskFileRepository->findLatestUpdatedByProjectId($projectId);
        if ($lastFileEntity) {
            $lastUpdatedTime = $lastFileEntity->getUpdatedAt();
        }

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
     * Update file by ID.
     */
    public function updateById(TaskFileEntity $entity): TaskFileEntity
    {
        return $this->taskFileRepository->updateById($entity);
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
        // 检查输入参数
        if (empty($taskFileEntity->getFileKey())) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::FILE_NOT_FOUND,
                trans('file.file_not_found')
            );
        }
        try {
            // 查找文件是否存在
            $fileEntity = $this->taskFileRepository->getByFileKey($taskFileEntity->getFileKey(), withTrash: $withTrash);
            if ($withTrash && $fileEntity?->getDeletedAt() !== null) {
                $this->taskFileRepository->restoreFile($fileEntity->getFileId());
                $fileEntity->setDeletedAt(null);
            }

            if (! empty($fileEntity) && $isUpdated === false) {
                return $fileEntity;
            }

            $isCreated = false;
            $currentTime = date('Y-m-d H:i:s');
            if (empty($fileEntity)) {
                $isCreated = true;
                $fileEntity = new TaskFileEntity();
                $fileEntity->setFileId(IdGenerator::getSnowId());
                $fileEntity->setFileKey($taskFileEntity->getFileKey());
                $fileEntity->setTopicId($taskFileEntity->getTopicId());
                $fileEntity->setTaskId($taskFileEntity->getTaskId());
                $fileEntity->setSource($taskFileEntity->getSource() ?? TaskFileSource::DEFAULT);
                $fileEntity->setCreatedAt($currentTime);
            }

            // id 相关设置
            $fileEntity->setProjectId($projectEntity->getId());
            $fileEntity->setUserId($dataIsolation->getCurrentUserId());
            $fileEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
            if (! empty($taskFileEntity->getTopicId()) && ($taskFileEntity->getTopicId() !== $fileEntity->getLatestModifiedTopicId())) {
                $fileEntity->setLatestModifiedTopicId($taskFileEntity->getTopicId());
            }
            if (! empty($taskFileEntity->getTaskId()) && ($taskFileEntity->getTaskId() !== $taskFileEntity->getLatestModifiedTaskId())) {
                $fileEntity->setLatestModifiedTaskId($taskFileEntity->getTaskId());
            }
            // 文件信息相关设置
            $fileEntity->setFileType(! empty($taskFileEntity->getFileType()) ? $taskFileEntity->getFileType() : FileType::PROCESS->value);
            $fileEntity->setFileName(! empty($taskFileEntity->getFileName()) ? $taskFileEntity->getFileName() : basename($taskFileEntity->getFileKey()));
            $fileEntity->setFileExtension(! empty($taskFileEntity->getFileExtension()) ? $taskFileEntity->getFileExtension() : pathinfo($fileEntity->getFileName(), PATHINFO_EXTENSION));
            $fileEntity->setFileSize(! empty($taskFileEntity->getFileSize()) ? $taskFileEntity->getFileSize() : 0);

            // 设置存储类型，由于其他快照文件也存储到工作区，这里需要做下处理
            if (empty($storageType)) {
                if ($taskFileEntity->getStorageType() == StorageType::WORKSPACE->value && WorkFileUtil::isSnapshotFile($fileEntity->getFileKey())) {
                    $fileEntity->setStorageType(StorageType::SNAPSHOT);
                } else {
                    $fileEntity->setStorageType($taskFileEntity->getStorageType());
                }
            } else {
                $fileEntity->setStorageType($storageType);
            }
            $fileEntity->setIsHidden(WorkFileUtil::isHiddenFile($fileEntity->getFileKey()));
            $fileEntity->setIsDirectory($taskFileEntity->getIsDirectory());
            $fileEntity->setSort(! empty($taskFileEntity->getSort()) ? $taskFileEntity->getSort() : 0);

            if (empty($taskFileEntity->getParentId())) {
                $parentId = $this->findOrCreateDirectoryAndGetParentId(
                    projectId: $projectEntity->getId(),
                    userId: $dataIsolation->getCurrentUserId(),
                    organizationCode: $dataIsolation->getCurrentOrganizationCode(),
                    projectOrganizationCode: $projectEntity->getUserOrganizationCode(),
                    fullFileKey: $fileEntity->getFileKey(),
                    workDir: $projectEntity->getWorkDir(),
                    source: $fileEntity->getSource()
                );
                $fileEntity->setParentId($parentId);
            } else {
                $fileEntity->setParentId($taskFileEntity->getParentId());
            }

            $fileEntity->setMetadata(! empty($taskFileEntity->getMetadata()) ? $taskFileEntity->getMetadata() : '');
            $fileEntity->setUpdatedAt($currentTime);

            if ($isCreated) {
                $newFileEntity = $this->taskFileRepository->insert($fileEntity);
            }
            $newFileEntity = $this->taskFileRepository->updateById($fileEntity);

            // set meta data file
            // Dispatch AttachmentsProcessedEvent for special file processing (like project.js)
            if (ProjectFileConstant::isSetMetadataFile($newFileEntity->getFileName())) {
                AsyncEventUtil::dispatch(new AttachmentsProcessedEvent($newFileEntity->getParentId(), $newFileEntity->getProjectId(), $newFileEntity->getTaskId()));
                $this->logger->info(sprintf(
                    'Dispatched AttachmentsProcessedEvent for saveProjectFile processed attachments, parentId: %d, projectId: %d, taskId: %d',
                    $newFileEntity->getParentId(),
                    $newFileEntity->getProjectId(),
                    $newFileEntity->getTaskId()
                ));
            }
            return $newFileEntity;
        } catch (Throwable $e) {
            $this->logger->error('Error saving project file', ['file_key' => $taskFileEntity->getFileKey(), 'error' => $e->getMessage()]);
            throw $e;
        }
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
            $taskFileEntity->setIsHidden(false);
            $taskFileEntity->setSort(0);

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
            $this->insert($taskFileEntity);

            Db::commit();
            return $taskFileEntity;
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
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

        // 4. Build initial target file path
        $baseFileName = basename($fileEntity->getFileKey());
        $targetPath = rtrim($targetParentEntity->getFileKey(), '/') . '/' . $baseFileName;

        // 5. Validate target path is within target project's work directory
        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir(
            $this->getFullPrefix($targetProject->getUserOrganizationCode()),
            $targetProject->getWorkDir()
        );
        if (! WorkDirectoryUtil::checkEffectiveFileKey($fullWorkdir, $targetPath)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_ILLEGAL_KEY, trans('file.illegal_file_key'));
        }

        // 6. Check if file path actually needs to change
        $sameProject = $sourceProject->getId() === $targetProject->getId();
        if ($fileEntity->getFileKey() === $targetPath && $sameProject) {
            return; // No change needed
        }

        // 7. Check if target file already exists
        $existingTargetFile = $this->taskFileRepository->getByFileKey($targetPath);

        // 8. Determine conflict resolution strategy
        $shouldKeepBoth = false;
        if (! empty($existingTargetFile)) {
            // Check if current SOURCE file ID is in keep_both_file_ids
            $sourceFileIdStr = (string) $fileEntity->getFileId();
            if (in_array($sourceFileIdStr, $keepBothFileIds, true)) {
                $shouldKeepBoth = true;

                // Generate new TARGET filename to avoid conflict
                $targetPath = $this->generateUniqueFileName(
                    $targetParentEntity->getFileKey(),
                    $baseFileName,
                    $targetProject->getId()
                );

                $this->logger->info('Conflict resolved by renaming target path', [
                    'source_file_id' => $fileEntity->getFileId(),
                    'original_target' => $baseFileName,
                    'new_target_path' => $targetPath,
                    'existing_file_id' => $existingTargetFile->getFileId(),
                ]);
            }
        }

        // 9. Execute move operation
        Db::beginTransaction();
        try {
            // Delete existing target file BEFORE updating source file to avoid unique key conflict
            if (! empty($existingTargetFile) && ! $shouldKeepBoth) {
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
                $targetPath,
                $targetParentId
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
                'target_path' => $targetPath,
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

        // 4. Build initial target file path
        $baseFileName = basename($fileEntity->getFileKey());
        $targetPath = rtrim($targetParentEntity->getFileKey(), '/') . '/' . $baseFileName;

        // 5. Validate target path is within target project's work directory
        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir(
            $this->getFullPrefix($targetProject->getUserOrganizationCode()),
            $targetProject->getWorkDir()
        );
        if (! WorkDirectoryUtil::checkEffectiveFileKey($fullWorkdir, $targetPath)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_ILLEGAL_KEY, trans('file.illegal_file_key'));
        }

        // 6. Check if target file already exists
        $existingTargetFile = $this->taskFileRepository->getByFileKey($targetPath);

        // 7. Determine conflict resolution strategy
        $shouldKeepBoth = false;
        if (! empty($existingTargetFile)) {
            // Check if current SOURCE file ID is in keep_both_file_ids
            $sourceFileIdStr = (string) $fileEntity->getFileId();
            if (in_array($sourceFileIdStr, $keepBothFileIds, true)) {
                $shouldKeepBoth = true;

                // Generate new TARGET filename to avoid conflict
                $targetPath = $this->generateUniqueFileName(
                    $targetParentEntity->getFileKey(),
                    $baseFileName,
                    $targetProject->getId()
                );

                $this->logger->info('Conflict resolved by renaming target path', [
                    'source_file_id' => $fileEntity->getFileId(),
                    'original_target' => $baseFileName,
                    'new_target_path' => $targetPath,
                    'existing_file_id' => $existingTargetFile->getFileId(),
                ]);
            }
        }

        // 8. Execute copy operation
        Db::beginTransaction();
        try {
            // Delete existing target file BEFORE copying to avoid unique key conflict (overwrite mode)
            if (! empty($existingTargetFile) && ! $shouldKeepBoth) {
                $this->taskFileRepository->deleteById($existingTargetFile->getFileId(), true);

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
                $targetPath
            );

            // Create new file record
            $newFileEntity = new TaskFileEntity();
            $newFileEntity->setFileId(IdGenerator::getSnowId());
            $newFileEntity->setProjectId($targetProject->getId());
            $newFileEntity->setUserId($dataIsolation->getCurrentUserId());
            $newFileEntity->setOrganizationCode($targetProject->getUserOrganizationCode());
            $newFileEntity->setFileType($fileEntity->getFileType());
            $newFileEntity->setFileName(basename($targetPath));
            $fileInfo = pathinfo($targetPath);
            $extension = isset($fileInfo['extension']) ? $fileInfo['extension'] : '';
            $newFileEntity->setFileExtension($extension);
            $newFileEntity->setFileSize($fileEntity->getFileSize());
            $newFileEntity->setFileKey($targetPath);
            $newFileEntity->setCreatedAt(date('Y-m-d H:i:s'));
            $newFileEntity->setUpdatedAt(date('Y-m-d H:i:s'));
            $newFileEntity->setStorageType($fileEntity->getStorageType());
            $newFileEntity->setIsHidden($fileEntity->getIsHidden());
            $newFileEntity->setIsDirectory($fileEntity->getIsDirectory());
            $newFileEntity->setParentId($targetParentId);
            $newFileEntity->setMetadata($fileEntity->getMetadata());
            $newFileEntity->setSource(TaskFileSource::COPY->value);

            $createdFileEntity = $this->taskFileRepository->insert($newFileEntity);

            Db::commit();

            $this->logger->info('File copied successfully', [
                'source_file_id' => $fileEntity->getFileId(),
                'new_file_id' => $createdFileEntity->getFileId(),
                'source_project_id' => $sourceProject->getId(),
                'target_project_id' => $targetProject->getId(),
                'target_path' => $targetPath,
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
                'target_path' => $targetPath,
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
     * @param string $targetPath Target file path
     * @param int $targetParentId Target parent directory ID
     */
    public function moveFile(
        TaskFileEntity $fileEntity,
        ProjectEntity $sourceProject,
        ProjectEntity $targetProject,
        string $targetPath,
        int $targetParentId
    ): void {
        try {
            $sameProject = $sourceProject->getId() === $targetProject->getId();

            if ($fileEntity->getFileKey() === $targetPath && $sameProject) {
                return;
            }

            // 1. Handle cloud storage operation
            $this->moveFileInCloudStorage(
                $fileEntity,
                $sourceProject,
                $targetProject,
                $targetPath
            );

            // 2. Update database record
            $this->updateFileRecord(
                $fileEntity,
                $sourceProject,
                $targetProject,
                $targetPath,
                $targetParentId
            );
        } catch (Throwable $e) {
            $this->logger->error('moveFile error', [
                'file_id' => $fileEntity->getFileId(),
                'file_key' => $fileEntity->getFileKey(),
                'target_path' => $targetPath,
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
            $targetFileEntity->setIsHidden($fileEntity->getIsHidden());
            $targetFileEntity->setIsDirectory($fileEntity->getIsDirectory());
            $targetFileEntity->setParentId($targetParentId);
            $targetFileEntity->setSort($fileEntity->getSort() + 1);
            $targetFileEntity->setMetadata($fileEntity->getMetadata());
            $targetFileEntity->setSource(TaskFileSource::COPY->value);

            return $this->taskFileRepository->insert($targetFileEntity);
        } catch (Throwable $e) {
            throw $e;
        }
    }

    public function getDirectoryFileIds(DataIsolation $dataIsolation, TaskFileEntity $dirEntity): array
    {
        $fileEntities = $this->taskFileRepository->findFilesByDirectoryPath($dirEntity->getProjectId(), $dirEntity->getFileKey());
        if (empty($fileEntities)) {
            return [];
        }

        $fileIds = [];
        foreach ($fileEntities as $fileEntity) {
            $fileIds[] = $fileEntity->getFileId();
        }
        return $fileIds;
    }

    /**
     * 为新文件计算排序值（领域逻辑）.
     */
    public function calculateSortForNewFile(?int $parentId, int $preFileId, int $projectId): int
    {
        // Use FileSortUtil for consistent sorting logic
        return FileSortUtil::calculateSortValue($this->taskFileRepository, $parentId, $preFileId, $projectId);
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
        MessageMetadata $metadata
    ): TaskFileEntity {
        $projectOrganizationCode = $projectEntity->getUserOrganizationCode();
        Db::beginTransaction();
        try {
            $taskEntity = $this->taskRepository->getTaskById((int) $metadata->getSuperMagicTaskId());

            $taskFileEntity = new TaskFileEntity();
            $taskFileEntity->setFileKey($fileKey);
            $taskFileEntity->setTaskId($taskEntity->getId());
            $taskFileEntity->setTopicId($taskEntity->getTopicId());
            $taskFileEntity->setSource(TaskFileSource::AGENT);
            $taskFileEntity->setStorageType(StorageType::WORKSPACE);
            $taskFileEntity->setFileType(FileType::SYSTEM_AUTO_UPLOAD->value);
            if ($data->getIsDirectory()) {
                $taskFileEntity->setIsDirectory(true);
                $taskFileEntity->setFileType(FileType::DIRECTORY->value);
            } else {
                $taskFileEntity->setIsDirectory(false);
            }

            // Get file information from cloud storage
            $fileInfo = $this->getFileInfoFromCloudStorage($fileKey, $projectOrganizationCode);
            $taskFileEntity->setFileSize($fileInfo['size']);

            $fileEntity = $this->saveProjectFile($dataIsolation, $projectEntity, $taskFileEntity, withTrash: true);

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

        try {
            $this->taskFileRepository->deleteById($existingFile->getFileId());

            // Delete the same file in projects
            $this->taskFileRepository->deleteByFileKeyAndProjectId($existingFile->getFileKey(), $existingFile->getProjectId());

            return true;
        } catch (Throwable $e) {
            // Log error if needed
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
        // Look for existing root directory (parent_id IS NULL and is_directory = true)
        $rootDir = $this->findDirectoryByParentIdAndName(null, '/', $projectId);

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

        $this->insert($rootDirEntity);

        return $rootDirEntity->getFileId();
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
        $result = [];

        $fileEntities = $this->taskFileRepository->getTaskFilesByIds($fileIds, $projectId);
        if (empty($fileEntities)) {
            return $result;
        }

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

                $result[] = $this->generateFileUrlForEntity($projectOrganizationCode, $fileEntity, $downloadMode, (string) $fileEntity->getFileId(), $addWatermark);
            } catch (Throwable $e) {
                // 获取URL失败，记录日志并跳过
                $this->logger->error(sprintf('获取文件URL失败, file_id:%d, err：%s', $fileEntity->getFileId(), $e->getMessage()));
                continue;
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

        $result = [];
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

                $result[] = $this->generateFileUrlForEntity($projectEntity->getUserOrganizationCode(), $fileEntity, $downloadMode, (string) $fileEntity->getFileId(), $addWatermark);
            } catch (Throwable $e) {
                // 获取URL失败，记录日志并跳过
                $this->logger->error(sprintf('获取文件URL失败, file_id:%d, err：%s', $fileEntity->getFileId(), $e->getMessage()));
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
     * @throws Throwable
     */
    public function migrateProjectFile(DataIsolation $dataIsolation, ProjectEntity $sourceProjectEntity, ProjectEntity $forkProjectEntity, ProjectForkEntity $projectForkRecordEntity): void
    {
        // 初始化基本参数
        $pageSize = 200; // Process 200 files at a time
        $lastFileId = $projectForkRecordEntity->getCurrentFileId();
        $forkRecordId = $projectForkRecordEntity->getId();
        $processedCount = $projectForkRecordEntity->getProcessedFiles();
        $totalCount = $projectForkRecordEntity->getTotalFiles();
        $userId = $dataIsolation->getCurrentUserId();
        $sourceToNewIdMap = [];
        $needFixFileIds = [];

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
            return;
        }

        // 预计算工作目录路径（避免重复计算）
        $sourceFullWorkDir = WorkDirectoryUtil::getFullWorkdir($this->getFullPrefix($sourceProjectEntity->getUserOrganizationCode()), $sourceProjectEntity->getWorkDir());
        $targetFullWorkDir = WorkDirectoryUtil::getFullWorkdir($this->getFullPrefix($forkProjectEntity->getUserOrganizationCode()), $forkProjectEntity->getWorkDir());
        $targetWorkDirPrefix = WorkDirectoryUtil::getPrefix($forkProjectEntity->getWorkDir());

        // 设置用户上下文
        $this->sandboxGateway->setUserContext(
            $forkProjectEntity->getUserId(),
            $forkProjectEntity->getUserOrganizationCode()
        );

        // 根节点单独处理
        $sourceRootFileId = $this->findOrCreateProjectRootDirectory($sourceProjectEntity->getId(), $sourceProjectEntity->getWorkDir(), $sourceProjectEntity->getUserId(), $sourceProjectEntity->getUserOrganizationCode(), $sourceProjectEntity->getUserOrganizationCode());
        $forkRootFileId = $this->findOrCreateProjectRootDirectory($forkProjectEntity->getId(), $forkProjectEntity->getWorkDir(), $forkProjectEntity->getUserId(), $forkProjectEntity->getUserOrganizationCode(), $forkProjectEntity->getUserOrganizationCode(), TaskFileSource::COPY);
        $sourceToNewIdMap[$sourceRootFileId] = $forkRootFileId;

        try {
            // 检查是否已经处理完所有文件
            if ($totalCount > 0 && $processedCount >= $totalCount) {
                $this->logger->info(sprintf('Fork record %d: All %d files already processed, skipping migration', $forkRecordId, $totalCount));
                $this->projectForkRepository->updateStatus($forkRecordId, ForkStatus::FINISHED->value, 100, '');
                return;
            }

            // 分批获取和处理文件
            while (true) {
                $sourceFiles = $this->taskFileRepository->getFilesByProjectIdWithResume($sourceProjectEntity->getId(), $lastFileId, $pageSize);
                if (empty($sourceFiles)) {
                    break; // No more files to process
                }
                foreach ($sourceFiles as $sourceFile) {
                    $newFileKey = str_replace($sourceFullWorkDir, $targetFullWorkDir, $sourceFile->getFileKey());
                    $lastFileId = $sourceFile->getFileId(); // 更新分页游标

                    // 1. 检查文件是否存在，如果存在则跳过
                    $existingFileEntity = $this->taskFileRepository->getByFileKey($newFileKey);
                    if (! empty($existingFileEntity)) {
                        continue;
                    }

                    try {
                        // 2. 处理远端附件
                        if ($sourceFile->getIsDirectory()) {
                            // 目录可以直接使用 cloud file 处理
                            $metadata = WorkDirectoryUtil::generateDefaultWorkDirMetadata();
                            $this->cloudFileRepository->createFolderByCredential(
                                $targetWorkDirPrefix,
                                $forkProjectEntity->getUserOrganizationCode(),
                                $newFileKey,
                                StorageBucketType::SandBox,
                                ['metadata' => $metadata]
                            );
                        } else {
                            // 文件拷贝需要通过远程沙箱处理
                            // 处理文件：调用新的沙箱 copy 接口
                            $copyResult = $this->sandboxGateway->copyFiles([
                                [
                                    'source_oss_path' => $sourceFile->getFileKey(),
                                    'target_oss_path' => $newFileKey,
                                ],
                            ]);

                            if (! $copyResult->isSuccess()) {
                                $this->logger->error(sprintf(
                                    'Sandbox Copy File Failed to copy file %s to %s',
                                    $sourceFile->getFileKey(),
                                    $newFileKey
                                ));
                                continue;
                            }
                        }

                        // 3. 保存数据库记录
                        $parentId = $sourceToNewIdMap[$sourceFile->getParentId()] ?? null;
                        // Create new TaskFileEntity for the forked project
                        $newTaskFile = $this->copyTaskFileEntity(
                            $sourceFile,
                            $userId,
                            $dataIsolation->getCurrentOrganizationCode(),
                            $forkProjectEntity->getId(),
                            $forkProjectEntity->getCurrentTopicId(),
                            $newFileKey,
                            $parentId,
                        );
                        $this->taskFileRepository->insert($newTaskFile);
                        // 由于新的目标文件没有 parent_id，所以需要处理，为了提高处理效率，存储一下关系
                        $sourceToNewIdMap[$sourceFile->getFileId()] = $newTaskFile->getFileId();
                        if (is_null($newTaskFile->getParentId())) {
                            $needFixFileIds[] = [
                                'new_id' => $newTaskFile->getFileId(),
                                'old_parent_id' => $sourceFile->getParentId(),
                            ];
                        }

                        ++$processedCount; // 成功处理一个文件，计数器递增
                    } catch (Throwable $e) {
                        $this->logger->error(
                            'Failed to process file during fork migration',
                            [
                                'exception' => $e->getMessage(),
                                'file_name' => $sourceFile->getFileName(),
                                'file_key' => $sourceFile->getFileKey(),
                                'new_file_key' => $newFileKey,
                                'is_directory' => $sourceFile->getIsDirectory(),
                                'processed_count' => $processedCount,
                            ]
                        );
                        // 继续处理下一个文件，不中断整个流程
                    }
                }

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
                if (count($sourceFiles) < $pageSize) {
                    break; // Less than page size, means it's the last batch
                }
            }

            // 最终更新进度到90%
            $this->projectForkRepository->updateProgress($forkRecordId, $processedCount, 90);
            $this->logger->info(sprintf('Fork record %d: Successfully processed %d/%d files', $forkRecordId, $processedCount, $totalCount));

            // 兜底逻辑：修复那些parent_id为null的文件
            if (count($needFixFileIds) > 0) {
                $this->batchFixParentIds($needFixFileIds, $sourceToNewIdMap, $userId);
                $this->logger->info(sprintf('Fixed parent_id for %d files in fork record %d', count($needFixFileIds), $forkRecordId));
            }

            // Mark as finished
            $this->projectForkRepository->updateStatus($forkRecordId, ForkStatus::FINISHED->value, 100, '');
            $this->logger->info(sprintf('File migration finished for fork record %d.', $forkRecordId));
        } catch (Throwable $e) {
            $this->logger->error(sprintf('File migration failed for fork record %d: %s', $forkRecordId, $e->getMessage()));
            $this->projectForkRepository->updateStatus($forkRecordId, ForkStatus::FAILED->value, 0, 'File migration failed');
            throw $e;
        } finally {
            // 确保用户上下文总是被清理
            $this->sandboxGateway->clearUserContext();
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
        $dirEntity->setIsHidden($oldFileEntity->getIsHidden());
        $dirEntity->setSort($oldFileEntity->getSort());
        $dirEntity->setFileId(IdGenerator::getSnowId());
        $dirEntity->setFileName($oldFileEntity->getFileName());
        $dirEntity->setFileKey($newFileKey);

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

        $this->insert($dirEntity);

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
        $taskFileEntity->setFileType(! empty($attachment['file_tag']) ? $attachment['file_tag'] : FileType::PROCESS->value);
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
     * @param string $fileKey File key
     * @param string $organizationCode Organization code
     * @return array File information
     */
    public function getFileInfoFromCloudStorage(string $fileKey, string $organizationCode): array
    {
        if (WorkDirectoryUtil::isValidDirectoryName($fileKey)) {
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
     * Generate unique filename by appending (1), (2), etc. when file exists.
     * Optimized: batch generate candidates and query once.
     *
     * @param string $parentPath Parent directory path
     * @param string $originalFileName Original file name
     * @param int $projectId Project ID for checking existence
     * @return string Unique file path
     */
    private function generateUniqueFileName(
        string $parentPath,
        string $originalFileName,
        int $projectId
    ): string {
        $parentPath = rtrim($parentPath, '/');

        // Parse file name and extension
        $pathInfo = pathinfo($originalFileName);
        $baseName = $pathInfo['filename'];
        $extension = isset($pathInfo['extension']) ? '.' . $pathInfo['extension'] : '';

        // Handle double extensions like .tar.gz
        if (preg_match('/^(.+?)(\.[a-z0-9]+\.[a-z0-9]+)$/i', $originalFileName, $matches)) {
            $baseName = $matches[1];
            $extension = $matches[2];
        }

        // Generate 10 candidate filenames at once
        $candidatePaths = [];
        for ($i = 1; $i <= 10; ++$i) {
            $newFileName = $baseName . '(' . $i . ')' . $extension;
            $newPath = $parentPath . '/' . $newFileName;
            $candidatePaths[] = $newPath;
        }

        // Batch query: use existing getByFileKeys method
        $existingFiles = $this->taskFileRepository->getByFileKeys($candidatePaths);
        $existingPaths = array_keys($existingFiles);

        // Find first available candidate
        foreach ($candidatePaths as $candidatePath) {
            if (! in_array($candidatePath, $existingPaths, true)) {
                $this->logger->info('Generated unique filename', [
                    'original' => $originalFileName,
                    'result' => basename($candidatePath),
                    'project_id' => $projectId,
                ]);
                return $candidatePath;
            }
        }

        // Fallback: all 10 candidates exist, use timestamp
        $timestamp = time();
        $microtime = substr((string) microtime(true), -6);  // Last 6 digits for uniqueness
        $fallbackName = $baseName . '_' . $timestamp . $microtime . $extension;
        $fallbackPath = $parentPath . '/' . $fallbackName;

        $this->logger->warning('All 10 candidates existed, using timestamp fallback', [
            'original' => $originalFileName,
            'fallback' => $fallbackName,
            'project_id' => $projectId,
        ]);

        return $fallbackPath;
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
        string $targetPath
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
            $copyResult = $this->sandboxGateway->copyFiles([
                [
                    'source_oss_path' => $fileEntity->getFileKey(),
                    'target_oss_path' => $targetPath,
                ],
            ]);

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
        string $targetPath
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
            $copyResult = $this->sandboxGateway->copyFiles([
                [
                    'source_oss_path' => $fileEntity->getFileKey(),
                    'target_oss_path' => $targetPath,
                ],
            ]);

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
     * @param string $targetPath Target path
     * @param int $targetParentId Target parent ID
     */
    private function updateFileRecord(
        TaskFileEntity $fileEntity,
        ProjectEntity $sourceProject,
        ProjectEntity $targetProject,
        string $targetPath,
        int $targetParentId
    ): void {
        $sameProject = $sourceProject->getId() === $targetProject->getId();
        $sameOrganization = $sourceProject->getUserOrganizationCode() === $targetProject->getUserOrganizationCode();

        // Build update fields
        $updateFields = [
            'file_key' => $targetPath,
            'file_name' => basename($targetPath),  // Extract filename from path
            'parent_id' => $targetParentId,
            'updated_at' => date('Y-m-d H:i:s'),
        ];

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
        // Split path into parts and process each level
        $pathParts = array_filter(explode('/', trim($dirPath, '/')));
        $currentParentId = $this->findOrCreateProjectRootDirectory($projectId, $workDir, $userId, $organizationCode, $projectOrganizationCode, $source);
        $currentPath = '';

        foreach ($pathParts as $dirName) {
            $currentPath = empty($currentPath) ? $dirName : "{$currentPath}/{$dirName}";

            // Look for existing directory
            $existingDir = $this->findDirectoryByParentIdAndName($currentParentId, $dirName, $projectId);

            if ($existingDir !== null) {
                $currentParentId = $existingDir->getFileId();
            } else {
                // Create new directory
                $newDirId = $this->createDirectory($projectId, $currentParentId, $dirName, $currentPath, $workDir, $userId, $organizationCode, $projectOrganizationCode, $source);
                $currentParentId = $newDirId;
            }
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
     * Create a new directory entity.
     *
     * @param int $projectId Project ID
     * @param int $parentId Parent directory ID
     * @param string $dirName Directory name
     * @param string $relativePath Relative path from project root
     * @param string $workDir Project work directory
     * @return int Created directory file_id
     */
    private function createDirectory(int $projectId, int $parentId, string $dirName, string $relativePath, string $workDir, string $userId, string $organizationCode, string $projectOrganizationCode, TaskFileSource $source = TaskFileSource::PROJECT_DIRECTORY): int
    {
        $dirEntity = new TaskFileEntity();
        $dirEntity->setFileId(IdGenerator::getSnowId());
        $dirEntity->setProjectId($projectId);
        $dirEntity->setUserId($userId);
        $dirEntity->setOrganizationCode($organizationCode);
        $dirEntity->setFileName($dirName);

        // Build complete file_key: workDir + relativePath + trailing slash
        $fullPrefix = $this->getFullPrefix($projectOrganizationCode);
        $fileKey = WorkDirectoryUtil::getFullFileKey($fullPrefix, $workDir, $relativePath);
        $fileKey = ltrim($fileKey, '/') . '/';
        $dirEntity->setFileKey($fileKey);
        $dirEntity->setFileSize(0);
        $dirEntity->setFileType(FileType::DIRECTORY->value);
        $dirEntity->setIsDirectory(true);
        $dirEntity->setParentId($parentId);
        $dirEntity->setSource($source);
        if (WorkFileUtil::isSnapshotFile($fileKey)) {
            $dirEntity->setStorageType(StorageType::SNAPSHOT);
        } else {
            $dirEntity->setStorageType(StorageType::WORKSPACE);
        }
        $dirEntity->setIsHidden(false);
        $dirEntity->setSort(0);

        $now = date('Y-m-d H:i:s');
        $dirEntity->setCreatedAt($now);
        $dirEntity->setUpdatedAt($now);

        $this->insert($dirEntity);

        return $dirEntity->getFileId();
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
        $urlOptions = [];

        // 设置Content-Type based on file extension
        $urlOptions['content_type'] = ContentTypeUtil::getContentType($filename);

        // 设置Content-Disposition based on download mode and HTTP standards
        switch (strtolower($downloadMode)) {
            case 'preview':
            case 'inline':
                // 预览模式：如果文件可预览则inline，否则强制下载
                if (ContentTypeUtil::isPreviewable($filename)) {
                    $urlOptions['custom_query']['response-content-disposition']
                        = ContentTypeUtil::buildContentDispositionHeader($filename, 'inline');
                } else {
                    $urlOptions['custom_query']['response-content-disposition']
                        = ContentTypeUtil::buildContentDispositionHeader($filename, 'attachment');
                }

                // Add watermark parameters if enabled and file is an image
                if ($addWatermark && $this->isImageFile($filename)) {
                    $watermarkParams = $this->getWatermarkParameters($fileEntity->getSource());
                    if (! empty($watermarkParams)) {
                        $urlOptions['custom_query'] = array_merge($urlOptions['custom_query'] ?? [], $watermarkParams);
                    }
                }

                break;
            case 'high_quality':
            case 'download':
            default:
                // 下载模式：强制下载，使用标准的 attachment 格式
                $urlOptions['custom_query']['response-content-disposition']
                    = ContentTypeUtil::buildContentDispositionHeader($filename, 'attachment');
                break;
        }

        // 设置Content-Type响应头
        $urlOptions['custom_query']['response-content-type'] = $urlOptions['content_type'];

        // 设置filename用于预签名URL生成
        $urlOptions['filename'] = $filename;

        return $urlOptions;
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
        bool $addWatermark = true
    ): array {
        // 准备下载选项，包含水印参数
        $filename = $fileEntity->getFileName();
        $urlOptions = $this->prepareFileUrlOptions($filename, $downloadMode, $addWatermark, $fileEntity);

        // 生成预签名URL（水印参数已包含在签名中）
        $preSignedUrl = $this->getFilePreSignedUrl($projectOrganizationCode, $fileEntity, $urlOptions);

        // 返回结果数组
        return [
            'file_id' => $fileId,
            'url' => $preSignedUrl,
        ];
    }

    /**
     * Get watermark text from translation.
     */
    private function getWatermarkText(): string
    {
        return trans('image_generate.image_watermark');
    }

    /**
     * Check if file is an image based on file extension.
     */
    private function isImageFile(string $filename): bool
    {
        $imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        return in_array($extension, $imageExtensions);
    }

    private function getWatermarkParameters(TaskFileSource $source): array
    {
        $driver = env('FILE_SERVICE_PUBLIC_PLATFORM') ?? env('FILE_SERVICE_PRIVATE_PLATFORM');

        if (empty($driver)) {
            $driver = env('FILE_DRIVER');
        }

        if (empty($driver)) {
            return [];
        }

        $watermarkText = $this->getWatermarkText();
        // Use base64url encoding for cloud storage compatibility
        $encodedText = $this->base64UrlEncode($watermarkText);

        if ($source->value === TaskFileSource::AGENT->value) {
            // $watermark = 'image/resize,p_50/watermark,text_' . $encodedText . ',t_50,size_30,color_FFFFFF,g_se,x_10,y_10,type_d3F5LW1pY3JvaGVp';
            $watermark = 'image/watermark,text_' . $encodedText . ',t_50,size_50,color_FFFFFF,g_se,x_50,y_50,type_d3F5LW1pY3JvaGVp';
        } else {
            // $watermark = 'image/resize,p_50';
            $watermark = '';
        }

        switch ($driver) {
            case 'oss':
                return [
                    'x-oss-process' => $watermark,
                ];
            case 'tos':
                return [
                    'x-tos-process' => $watermark,
                ];
            default:
                return [];
        }
    }

    /**
     * Encode string to base64url format (RFC 4648).
     */
    private function base64UrlEncode(string $data): string
    {
        // First encode to standard base64
        $base64 = base64_encode($data);

        // Convert to base64url by replacing characters and removing padding
        return rtrim(strtr($base64, '+/', '-_'), '=');
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
        ?int $parentId = null
    ): TaskFileEntity {
        $newTaskFile = new TaskFileEntity();
        $newTaskFile->setFileId(IdGenerator::getSnowId());
        $newTaskFile->setProjectId($projectId);
        $newTaskFile->setTopicId($topicId);
        $newTaskFile->setFileType($sourceFile->getFileType());
        $newTaskFile->setFileName($sourceFile->getFileName());
        $newTaskFile->setFileExtension($sourceFile->getFileExtension());
        $newTaskFile->setFileKey($newFileKey);
        $newTaskFile->setFileSize($sourceFile->getFileSize());
        $newTaskFile->setIsHidden($sourceFile->getIsHidden());
        $newTaskFile->setIsDirectory($sourceFile->getIsDirectory());

        // Use provided parentId or fall back to source file's parentId
        $newTaskFile->setParentId($parentId);

        $newTaskFile->setSort($sourceFile->getSort());
        $newTaskFile->setStorageType($sourceFile->getStorageType());
        $newTaskFile->setMetadata($sourceFile->getMetadata());
        $newTaskFile->setUserId($userId);
        $newTaskFile->setOrganizationCode($organizationCode);
        $newTaskFile->setSource(TaskFileSource::DEFAULT->value);
        $newTaskFile->setCreatedAt(date('Y-m-d H:i:s'));
        $newTaskFile->setUpdatedAt(date('Y-m-d H:i:s'));

        return $newTaskFile;
    }

    /**
     * Batch fix parent_id for files that couldn't be resolved during initial processing.
     *
     * @param array $needFixFileIds Array of files needing parent_id fixes
     * @param array $sourceToNewIdMap Mapping from source file ID to new file ID
     * @param string $userId User performing the update
     */
    private function batchFixParentIds(array $needFixFileIds, array $sourceToNewIdMap, string $userId): void
    {
        // Group files by their old parent_id for batch processing
        $parentGroups = [];
        foreach ($needFixFileIds as $fixInfo) {
            $oldParentId = $fixInfo['old_parent_id'];
            $newFileId = $fixInfo['new_id'];

            if (isset($sourceToNewIdMap[$oldParentId])) {
                $newParentId = $sourceToNewIdMap[$oldParentId];
                $parentGroups[$newParentId][] = $newFileId;
            }
        }

        // Batch update files by parent_id groups using repository
        foreach ($parentGroups as $newParentId => $fileIds) {
            $updatedCount = $this->taskFileRepository->batchUpdateParentId($fileIds, $newParentId, $userId);
            $this->logger->debug(sprintf(
                'Updated parent_id to %d for %d files (affected: %d)',
                $newParentId,
                count($fileIds),
                $updatedCount
            ));
        }
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

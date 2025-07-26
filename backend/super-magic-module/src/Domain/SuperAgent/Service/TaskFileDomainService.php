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
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\FileType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageMetadata;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\SandboxFileNotificationDataValueObject;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TopicRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\WorkspaceVersionRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\FileSortUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Hyperf\DbConnection\Db;
use Throwable;

use function Hyperf\Translation\trans;

class TaskFileDomainService
{
    public function __construct(
        protected TaskRepositoryInterface $taskRepository,
        protected TaskFileRepositoryInterface $taskFileRepository,
        protected WorkspaceVersionRepositoryInterface $workspaceVersionRepository,
        protected TopicRepositoryInterface $topicRepository,
        protected CloudFileRepositoryInterface $cloudFileRepository
    ) {
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
    public function findUserFilesByTopicId(string $topicId): array
    {
        return $this->taskFileRepository->findUserFilesByTopicId($topicId);
    }

    public function findUserFilesByProjectId(string $projectId): array
    {
        return $this->taskFileRepository->findUserFilesByProjectId($projectId);
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
     * 根据文件key和topicId获取相对于工作目录的文件路径。
     * 逻辑参考 AgentFileAppService::getFileVersions 方法。
     *
     * @param string $fileKey 完整的文件key（包含 workDir 前缀）
     * @param int $topicId 话题 ID
     *
     * @return string 相对于 workDir 的文件路径（当未匹配到 workDir 时返回原始 $fileKey）
     */
    public function getFileWorkspacePath(string $fileKey, int $topicId): string
    {
        // 通过仓储直接获取话题，避免领域服务之间的依赖
        $topicEntity = $this->topicRepository->getTopicById($topicId);

        // 若话题不存在或 workDir 为空，直接返回原始 fileKey
        if (empty($topicEntity) || empty($topicEntity->getWorkDir())) {
            return $fileKey;
        }

        $workDir = rtrim($topicEntity->getWorkDir(), '/') . '/';

        // 使用 workDir 在 fileKey 中找到最后一次出现的位置，截取其后内容
        $pos = strrpos($fileKey, $workDir);
        if ($pos === false) {
            // 未找到 workDir，返回原始 fileKey
            return $fileKey;
        }

        return substr($fileKey, $pos + strlen($workDir));
    }

    /**
     * Bind files to project with proper parent directory setup.
     *
     * Note: This method assumes all files are in the same directory level.
     * It uses the first file's path to determine the parent directory for all files.
     * If files are from different directories, they will all be placed in the same parent directory.
     *
     * @param DataIsolation $dataIsolation Data isolation context for permission check
     * @param int $projectId Project ID to bind files to
     * @param array $fileIds Array of file IDs to bind
     * @param string $workDir Project work directory
     * @return bool Whether binding was successful
     */
    public function bindProjectFiles(
        DataIsolation $dataIsolation,
        int $projectId,
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
            projectId: $projectId,
            userId: $dataIsolation->getCurrentUserId(),
            organizationCode: $dataIsolation->getCurrentOrganizationCode(),
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
            $projectId,
            $parentId
        );

        return true;
    }

    /**
     * @deprecated Use bindProjectFiles instead
     */
    public function bindProject(int $projectId, array $fileIds): bool
    {
        $fileEntities = $this->taskFileRepository->getFilesByIds($fileIds);
        if (empty($fileEntities)) {
            return false;
        }
        foreach ($fileEntities as $fileEntity) {
            if ($fileEntity->getProjectId() > 0) {
                continue;
            }
            $fileEntity->setProjectId($projectId);
            $this->taskFileRepository->updateById($fileEntity);
        }
        return true;
    }

    /**
     * Save project file.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param TaskFileEntity $taskFileEntity Task file entity with data to save
     * @return TaskFileEntity Saved file entity
     */
    public function saveProjectFile(
        DataIsolation $dataIsolation,
        TaskFileEntity $taskFileEntity
    ): TaskFileEntity {
        // Check if file already exists by project_id and file_key
        if ($taskFileEntity->getProjectId() > 0 && ! empty($taskFileEntity->getFileKey())) {
            $existingFile = $this->taskFileRepository->getByFileKey($taskFileEntity->getFileKey());
            if ($existingFile !== null) {
                return $existingFile;
            }
        }

        // Set data isolation context
        $taskFileEntity->setUserId($dataIsolation->getCurrentUserId());
        $taskFileEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());

        // Generate file ID if not set
        if ($taskFileEntity->getFileId() === 0) {
            $taskFileEntity->setFileId(IdGenerator::getSnowId());
        }

        // Extract file extension from file name if not set
        if (empty($taskFileEntity->getFileExtension()) && ! empty($taskFileEntity->getFileName())) {
            $fileExtension = pathinfo($taskFileEntity->getFileName(), PATHINFO_EXTENSION);
            $taskFileEntity->setFileExtension($fileExtension);
        }

        // Set timestamps
        $now = date('Y-m-d H:i:s');
        $taskFileEntity->setCreatedAt($now);
        $taskFileEntity->setUpdatedAt($now);

        // Save to repository
        $this->insert($taskFileEntity);

        return $taskFileEntity;
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
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $workDir = $projectEntity->getWorkDir();

        if (empty($workDir)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORK_DIR_NOT_FOUND, trans('project.work_dir.not_found'));
        }

        if (! empty($parentId)) {
            $parentFIleEntity = $this->taskFileRepository->getById($parentId);
            if ($parentFIleEntity === null || $parentFIleEntity->getProjectId() != $projectEntity->getId()) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
            }
            $fileKey = rtrim($parentFIleEntity->getFileKey(), '/') . '/' . $fileName;
        } else {
            $fileKey = WorkDirectoryUtil::getFullPrefix($organizationCode) . trim($workDir, '/') . '/' . $fileName;
        }

        if ($isDirectory) {
            $fileKey = rtrim($fileKey, '/') . '/';
        }

        if (! WorkDirectoryUtil::checkEffectiveFileKey($organizationCode, $dataIsolation->getCurrentUserId(), $projectEntity->getId(), $fileKey)) {
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
                $this->cloudFileRepository->createFolderByCredential(WorkDirectoryUtil::getPrefix($workDir), $organizationCode, $fileKey);
            } else {
                $this->cloudFileRepository->createFileByCredential(WorkDirectoryUtil::getPrefix($workDir), $organizationCode, $fileKey);
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
            $taskFileEntity->setOrganizationCode($organizationCode);
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

    public function deleteProjectFiles(DataIsolation $dataIsolation, TaskFileEntity $fileEntity, string $workDir): bool
    {
        if (! WorkDirectoryUtil::checkEffectiveFileKey($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId(), $fileEntity->getProjectId(), $fileEntity->getFileKey())) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_ILLEGAL_KEY, trans('file.illegal_file_key'));
        }

        Db::beginTransaction();
        try {
            // Delete cloud file
            $prefix = WorkDirectoryUtil::getPrefix($workDir);
            $this->cloudFileRepository->deleteObjectByCredential($prefix, $dataIsolation->getCurrentOrganizationCode(), $fileEntity->getFileKey());

            // Delete file record
            $this->taskFileRepository->deleteById($fileEntity->getFileId());

            Db::commit();
            return true;
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
    }

    public function deleteDirectoryFiles(DataIsolation $dataIsolation, string $workDir, int $projectId, string $targetPath): int
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        Db::beginTransaction();
        try {
            // 1. 查找目录下所有文件（限制500条）
            $fileEntities = $this->taskFileRepository->findFilesByDirectoryPath($projectId, $targetPath);

            if (empty($fileEntities)) {
                Db::commit();
                return 0;
            }
            $deletedCount = 0;
            $prefix = WorkDirectoryUtil::getPrefix($workDir);

            // 3. 批量删除云存储文件
            $fileKeys = [];
            foreach ($fileEntities as $fileEntity) {
                if (WorkDirectoryUtil::checkEffectiveFileKey($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId(), $fileEntity->getProjectId(), $fileEntity->getFileKey())) {
                    $fileKeys[] = $fileEntity->getFileKey();
                }
            }

            // 删除云存储文件（批量操作）
            foreach ($fileKeys as $fileKey) {
                try {
                    $this->cloudFileRepository->deleteObjectByCredential($prefix, $organizationCode, $fileKey);
                    ++$deletedCount;
                } catch (Throwable $e) {
                    // 记录单个文件删除失败，但继续处理其他文件
                    // 这里可以添加日志记录
                }
            }

            // 4. 批量删除数据库记录
            $fileIds = array_map(fn ($entity) => $entity->getFileId(), $fileEntities);
            $this->taskFileRepository->deleteByIds($fileIds);

            Db::commit();
            return $deletedCount;
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
    }

    public function copyProjectFile(DataIsolation $dataIsolation, TaskFileEntity $fileEntity, string $workDir, string $targetObject)
    {
        try {
            // target file exist
            $organizationCode = $dataIsolation->getCurrentOrganizationCode();
            $prefix = WorkDirectoryUtil::getPrefix($workDir);
            $fullTargetFileKey = WorkDirectoryUtil::getFullPrefix($organizationCode) . trim($workDir, '/') . '/' . trim($targetObject, '/');

            $targetFileEntity = $this->taskFileRepository->getByFileKey($fullTargetFileKey);
            if ($targetFileEntity !== null) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_EXIST, trans('file.file_exist'));
            }

            // call cloud file service
            $this->cloudFileRepository->copyObjectByCredential($prefix, $organizationCode, $fileEntity->getFileKey(), $fullTargetFileKey);
        } catch (Throwable $e) {
            throw $e;
        }
    }

    public function renameProjectFile(DataIsolation $dataIsolation, TaskFileEntity $fileEntity, string $workDir, string $targetName): void
    {
        $dir = dirname($fileEntity->getFileKey());
        $fullTargetFileKey = $dir . DIRECTORY_SEPARATOR . $targetName;
        $targetFileEntity = $this->taskFileRepository->getByFileKey($fullTargetFileKey);
        if ($targetFileEntity !== null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_EXIST, trans('file.file_exist'));
        }

        if (! WorkDirectoryUtil::checkEffectiveFileKey($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId(), $fileEntity->getProjectId(), $fullTargetFileKey)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_ILLEGAL_KEY, trans('file.illegal_file_key'));
        }

        Db::beginTransaction();
        try {
            $organizationCode = $dataIsolation->getCurrentOrganizationCode();
            $prefix = WorkDirectoryUtil::getPrefix($workDir);
            // call cloud file service
            $this->cloudFileRepository->renameObjectByCredential($prefix, $organizationCode, $fileEntity->getFileKey(), $fullTargetFileKey);

            // rename file record
            $fileEntity->setFileKey($fullTargetFileKey);
            $fileEntity->setFileName(basename($fullTargetFileKey));
            $fileExtension = pathinfo(basename($fullTargetFileKey), PATHINFO_EXTENSION);
            $fileEntity->setFileExtension($fileExtension);
            $fileEntity->setUpdatedAt(date('Y-m-d H:i:s'));
            $this->taskFileRepository->updateById($fileEntity);

            Db::commit();
            return;
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
    }

    public function moveProjectFile(DataIsolation $dataIsolation, TaskFileEntity $fileEntity, string $workDir, int $targetParentId): void
    {
        if ($targetParentId <= 0) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
        }

        $targetParentEntity = $this->taskFileRepository->getById($targetParentId);
        if ($targetParentEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
        }

        // Validate target parent is a directory
        if (! $targetParentEntity->getIsDirectory()) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, trans('file.target_parent_not_directory'));
        }

        // Validate target parent belongs to same project
        if ($targetParentEntity->getProjectId() !== $fileEntity->getProjectId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, trans('file.permission_denied'));
        }

        // Validate target parent belongs to same user
        if ($targetParentEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, trans('file.permission_denied'));
        }

        // Build full target file key
        $targetParentPath = rtrim($targetParentEntity->getFileKey(), '/') . '/' . basename($fileEntity->getFileKey());

        if (! WorkDirectoryUtil::checkEffectiveFileKey($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId(), $fileEntity->getProjectId(), $targetParentPath)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_ILLEGAL_KEY, trans('file.illegal_file_key'));
        }

        // Check if target file already exists
        $targetParentEntity = $this->taskFileRepository->getByFileKey($targetParentPath);
        if (! empty($targetParentEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_EXIST, trans('file.file_exist'));
        }

        // Prevent moving file to itself or its subdirectory (for directories)
        if ($fileEntity->getIsDirectory()) {
            // todo need to update this
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, trans('file.cannot_move_to_subdirectory'));
        }

        Db::beginTransaction();
        try {
            // Call cloud file service to move the file
            $prefix = WorkDirectoryUtil::getPrefix($workDir);
            $this->cloudFileRepository->renameObjectByCredential($prefix, $dataIsolation->getCurrentOrganizationCode(), $fileEntity->getFileKey(), $targetParentPath);

            // Update file record
            $fileEntity->setFileKey($targetParentPath);
            $fileEntity->setParentId($targetParentId);
            $fileEntity->setUpdatedAt(date('Y-m-d H:i:s'));
            $this->taskFileRepository->updateById($fileEntity);

            Db::commit();
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
    }

    public function getUserFileEntity(DataIsolation $dataIsolation, int $fileId): TaskFileEntity
    {
        $fileEntity = $this->taskFileRepository->getById($fileId);
        if ($fileEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
        }

        if ($fileEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, trans('file.permission_denied'));
        }

        if ($fileEntity->getProjectId() <= 0) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, trans('project.project_not_found'));
        }

        return $fileEntity;
    }

    /**
     * 为新文件计算排序值（领域逻辑）.
     */
    public function calculateSortForNewFile(?int $parentId, int $preFileId, int $projectId): int
    {
        if ($preFileId === 0) {
            return $this->calculateFirstPositionSort($parentId, $projectId);
        }

        if ($preFileId === -1) {
            return $this->calculateLastPositionSort($parentId, $projectId);
        }

        return $this->calculateAfterPositionSort($parentId, $preFileId, $projectId);
    }

    /**
     * 处理移动文件时的排序（领域协调）.
     */
    public function handleFileSortOnMove(
        TaskFileEntity $fileEntity,
        int $targetParentId,
        int $preFileId
    ): void {
        $newParentId = $targetParentId === 0 ? null : $targetParentId;

        // 计算新的排序值
        $newSort = $this->calculateSortForNewFile(
            $newParentId,
            $preFileId,
            $fileEntity->getProjectId()
        );

        // 更新实体
        $fileEntity->setSort($newSort);
        $fileEntity->setParentId($newParentId);

        // 如果需要重排，委托给基础设施层
        if ($this->needsReorder($newParentId, $fileEntity->getProjectId())) {
            $updates = FileSortUtil::reorderSiblings(
                $this->taskFileRepository,
                $newParentId,
                $fileEntity->getProjectId()
            );

            if (! empty($updates)) {
                $this->taskFileRepository->batchUpdateSort($updates);
            }
        }
    }

    /**
     * Find or create directory structure and return parent ID for a file.
     * This method ensures all necessary directories exist for the given file path.
     *
     * @param int $projectId Project ID
     * @param string $fullFileKey Complete file key from storage
     * @param string $workDir Project work directory
     * @return int The file_id of the direct parent directory
     */
    public function findOrCreateDirectoryAndGetParentId(int $projectId, string $userId, string $organizationCode, string $fullFileKey, string $workDir): int
    {
        // 1. Get relative path of the file
        $relativePath = WorkDirectoryUtil::getRelativeFilePath($fullFileKey, $workDir);

        // 2. Get parent directory path
        $parentDirPath = dirname($relativePath);

        // 3. If file is in root directory, return project root directory ID
        if ($parentDirPath === '.' || $parentDirPath === '/' || empty($parentDirPath)) {
            return $this->findOrCreateProjectRootDirectory($projectId, $workDir, $userId, $organizationCode);
        }

        // 4. Ensure all directory levels exist and return the final parent ID
        return $this->ensureDirectoryPathExists($projectId, $parentDirPath, $workDir, $userId, $organizationCode);
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
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $userId = $dataIsolation->getCurrentUserId();
        $projectId = $projectEntity->getId();
        $workDir = $projectEntity->getWorkDir();

        // 1. Get parent directory ID (create directories if needed)
        $parentId = $this->findOrCreateDirectoryAndGetParentId(
            $projectId,
            $userId,
            $organizationCode,
            $fileKey,
            $workDir
        );

        // 2. Check if file already exists
        $existingFile = $this->taskFileRepository->getByFileKey($fileKey);

        Db::beginTransaction();
        try {
            if ($existingFile !== null) {
                // Update existing file
                $taskFileEntity = $this->updateSandboxFile($existingFile, $data, $organizationCode);
            } else {
                // Create new file
                $taskFileEntity = $this->createSandboxFile(
                    $dataIsolation,
                    $projectEntity,
                    $fileKey,
                    $parentId,
                    (int) $metadata->getSuperMagicTaskId(),
                    $data
                );
            }

            Db::commit();
            return $taskFileEntity;
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

        // Check permission
        if ($existingFile->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, trans('file.permission_denied'));
        }

        try {
            $this->taskFileRepository->deleteById($existingFile->getFileId());
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
     * @return int Root directory file_id
     */
    public function findOrCreateProjectRootDirectory(int $projectId, string $workDir, string $userId, string $organizationCode): int
    {
        // Look for existing root directory (parent_id IS NULL and is_directory = true)
        $rootDir = $this->findDirectoryByParentIdAndName(null, '/', $projectId);

        if ($rootDir !== null) {
            return $rootDir->getFileId();
        }

        $fullWorkDir = WorkDirectoryUtil::getFullPrefix($organizationCode) . ltrim($workDir, '/');

        // Create root directory if not exists
        $rootDirEntity = new TaskFileEntity();
        $rootDirEntity->setFileId(IdGenerator::getSnowId());
        $rootDirEntity->setUserId($userId);
        $rootDirEntity->setOrganizationCode($organizationCode);
        $rootDirEntity->setProjectId($projectId);
        $rootDirEntity->setFileName('/');
        $rootDirEntity->setFileKey(rtrim($fullWorkDir, '/') . '/');
        $rootDirEntity->setFileSize(0);
        $rootDirEntity->setFileType(FileType::DIRECTORY->value);
        $rootDirEntity->setIsDirectory(true);
        $rootDirEntity->setParentId(null);
        $rootDirEntity->setSource(TaskFileSource::PROJECT_DIRECTORY);
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
     * 计算插入第一位的排序值
     */
    private function calculateFirstPositionSort(?int $parentId, int $projectId): int
    {
        $minSort = $this->taskFileRepository->getMinSortByParentId($parentId, $projectId);

        if ($minSort === null) {
            // 没有文件，使用默认值
            return FileSortUtil::DEFAULT_SORT_STEP;
        }

        if ($minSort > FileSortUtil::DEFAULT_SORT_STEP) {
            // 最小值很大，可以使用默认值插入到前面
            return FileSortUtil::DEFAULT_SORT_STEP;
        }

        // 尝试计算一个更小的值，使用一半的步长
        $halfStep = intval(FileSortUtil::DEFAULT_SORT_STEP / 2);
        if ($minSort > $halfStep) {
            return $minSort - $halfStep;
        }

        // 如果最小值太小，无法插入合理的值，需要重排
        // 这里应该触发重排逻辑，暂时返回默认值
        return FileSortUtil::DEFAULT_SORT_STEP;
    }

    /**
     * 计算插入末尾的排序值
     */
    private function calculateLastPositionSort(?int $parentId, int $projectId): int
    {
        $maxSort = $this->taskFileRepository->getMaxSortByParentId($parentId, $projectId);

        if ($maxSort === null) {
            return FileSortUtil::DEFAULT_SORT_STEP;
        }

        return $maxSort + FileSortUtil::DEFAULT_SORT_STEP;
    }

    /**
     * 计算插入到指定文件后的排序值
     */
    private function calculateAfterPositionSort(?int $parentId, int $preFileId, int $projectId): int
    {
        $preSort = $this->taskFileRepository->getSortByFileId($preFileId);
        if ($preSort === null) {
            // 前置文件不存在，插入到末尾
            return $this->calculateLastPositionSort($parentId, $projectId);
        }

        $nextSort = $this->taskFileRepository->getNextSortAfter($parentId, $preSort, $projectId);

        if ($nextSort === null) {
            // 插入到末尾
            return $preSort + FileSortUtil::DEFAULT_SORT_STEP;
        }

        $gap = $nextSort - $preSort;
        if ($gap >= FileSortUtil::MIN_SORT_GAP) {
            return $preSort + intval($gap / 2);
        }

        // 空隙不够，需要重排，先触发重排再计算
        return $this->calculateAfterReorder($parentId, $preFileId, $projectId);
    }

    /**
     * 检查是否需要重排.
     */
    private function needsReorder(?int $parentId, int $projectId): bool
    {
        // 检查是否有连续的排序值过于密集
        $siblings = $this->taskFileRepository->getSiblingsByParentId($parentId, $projectId, 'sort', 'ASC');

        for ($i = 0; $i < count($siblings) - 1; ++$i) {
            $gap = $siblings[$i + 1]['sort'] - $siblings[$i]['sort'];
            if ($gap < FileSortUtil::MIN_SORT_GAP) {
                return true;
            }
        }

        return false;
    }

    /**
     * 重排后计算排序值
     */
    private function calculateAfterReorder(?int $parentId, int $preFileId, int $projectId): int
    {
        // 触发重排
        $updates = FileSortUtil::reorderSiblings($this->taskFileRepository, $parentId, $projectId);
        if (! empty($updates)) {
            $this->taskFileRepository->batchUpdateSort($updates);
        }

        // 重新计算
        return $this->calculateAfterPositionSort($parentId, $preFileId, $projectId);
    }

    /**
     * Ensure the complete directory path exists, creating missing directories.
     *
     * @param int $projectId Project ID
     * @param string $dirPath Directory path (e.g., "a/b/c")
     * @param string $workDir Project work directory
     * @return int The file_id of the final directory in the path
     */
    private function ensureDirectoryPathExists(int $projectId, string $dirPath, string $workDir, string $userId, string $organizationCode): int
    {
        // Cache to avoid duplicate database queries in single request
        static $pathCache = [];
        $cacheKey = "{$projectId}:{$dirPath}";

        if (isset($pathCache[$cacheKey])) {
            return $pathCache[$cacheKey];
        }

        // Split path into parts and process each level
        $pathParts = array_filter(explode('/', trim($dirPath, '/')));
        $currentParentId = $this->findOrCreateProjectRootDirectory($projectId, $workDir, $userId, $organizationCode);
        $currentPath = '';

        foreach ($pathParts as $dirName) {
            $currentPath = empty($currentPath) ? $dirName : "{$currentPath}/{$dirName}";
            $currentCacheKey = "{$projectId}:{$currentPath}";

            // Check cache first
            if (isset($pathCache[$currentCacheKey])) {
                $currentParentId = $pathCache[$currentCacheKey];
                continue;
            }

            // Look for existing directory
            $existingDir = $this->findDirectoryByParentIdAndName($currentParentId, $dirName, $projectId);

            if ($existingDir !== null) {
                $currentParentId = $existingDir->getFileId();
            } else {
                // Create new directory
                $newDirId = $this->createDirectory($projectId, $currentParentId, $dirName, $currentPath, $workDir, $userId, $organizationCode);
                $currentParentId = $newDirId;
            }

            // Cache the result
            $pathCache[$currentCacheKey] = $currentParentId;
        }

        $pathCache[$cacheKey] = $currentParentId;
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
    private function createDirectory(int $projectId, int $parentId, string $dirName, string $relativePath, string $workDir, string $userId, string $organizationCode): int
    {
        $dirEntity = new TaskFileEntity();
        $dirEntity->setFileId(IdGenerator::getSnowId());
        $dirEntity->setProjectId($projectId);
        $dirEntity->setUserId($userId);
        $dirEntity->setOrganizationCode($organizationCode);
        $dirEntity->setFileName($dirName);

        // Build complete file_key: workDir + relativePath + trailing slash
        $fileKey = WorkDirectoryUtil::getFullPrefix($organizationCode) . trim($workDir, '/') . '/' . trim($relativePath, '/') . '/';
        $dirEntity->setFileKey($fileKey);
        $dirEntity->setFileSize(0);
        $dirEntity->setFileType(FileType::DIRECTORY->value);
        $dirEntity->setIsDirectory(true);
        $dirEntity->setParentId($parentId);
        $dirEntity->setSource(TaskFileSource::PROJECT_DIRECTORY);
        $dirEntity->setStorageType(StorageType::WORKSPACE);
        $dirEntity->setIsHidden(false);
        $dirEntity->setSort(0);

        $now = date('Y-m-d H:i:s');
        $dirEntity->setCreatedAt($now);
        $dirEntity->setUpdatedAt($now);

        $this->insert($dirEntity);

        return $dirEntity->getFileId();
    }

    /**
     * Update existing sandbox file.
     *
     * @param TaskFileEntity $existingFile Existing file entity
     * @param SandboxFileNotificationDataValueObject $data File data
     * @param string $organizationCode Organization code
     * @return TaskFileEntity Updated file entity
     */
    private function updateSandboxFile(
        TaskFileEntity $existingFile,
        SandboxFileNotificationDataValueObject $data,
        string $organizationCode
    ): TaskFileEntity {
        // Get file information from cloud storage
        $fileInfo = $this->getFileInfoFromCloudStorage($existingFile->getFileKey(), $organizationCode);

        // Update file entity
        $existingFile->setFileSize($fileInfo['size'] ?? $data->getFileSize());
        $existingFile->setUpdatedAt(date('Y-m-d H:i:s'));

        // Update file extension if changed
        $fileName = basename($existingFile->getFileKey());
        $fileExtension = pathinfo($fileName, PATHINFO_EXTENSION);
        $existingFile->setFileExtension($fileExtension);

        $this->taskFileRepository->updateById($existingFile);

        return $existingFile;
    }

    /**
     * Create new sandbox file.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param ProjectEntity $projectEntity Project entity
     * @param string $fileKey Complete file key
     * @param int $parentId Parent directory ID
     * @param SandboxFileNotificationDataValueObject $data File data
     * @return TaskFileEntity Created file entity
     */
    private function createSandboxFile(
        DataIsolation $dataIsolation,
        ProjectEntity $projectEntity,
        string $fileKey,
        int $parentId,
        int $taskId,
        SandboxFileNotificationDataValueObject $data,
    ): TaskFileEntity {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        // Get file information from cloud storage
        $fileInfo = $this->getFileInfoFromCloudStorage($fileKey, $organizationCode);

        // Create file entity
        $taskFileEntity = new TaskFileEntity();
        $taskFileEntity->setFileId(IdGenerator::getSnowId());
        $taskFileEntity->setProjectId($projectEntity->getId());
        $taskFileEntity->setUserId($dataIsolation->getCurrentUserId());
        $taskFileEntity->setOrganizationCode($organizationCode);
        $taskFileEntity->setFileKey($fileKey);

        $taskEntity = $this->taskRepository->getTaskById($taskId);
        if (! empty($taskEntity)) {
            $taskFileEntity->setTaskId($taskId);
            $taskFileEntity->setTopicId($taskEntity->getTopicId());
        }

        $fileName = basename($fileKey);
        $taskFileEntity->setFileName($fileName);
        $taskFileEntity->setFileSize($fileInfo['size'] ?? $data->getFileSize());
        $taskFileEntity->setFileType(FileType::AUTO_SYNC->value);
        $taskFileEntity->setIsDirectory(false);
        $taskFileEntity->setParentId($parentId === 0 ? null : $parentId);
        $taskFileEntity->setSource(TaskFileSource::AGENT);
        $taskFileEntity->setStorageType(StorageType::WORKSPACE);
        $taskFileEntity->setIsHidden(false);
        $taskFileEntity->setSort(0);

        // Extract file extension
        $fileExtension = pathinfo($fileName, PATHINFO_EXTENSION);
        $taskFileEntity->setFileExtension($fileExtension);

        // Set timestamps
        $now = date('Y-m-d H:i:s');
        $taskFileEntity->setCreatedAt($now);
        $taskFileEntity->setUpdatedAt($now);

        $this->insert($taskFileEntity);

        return $taskFileEntity;
    }

    /**
     * Get file information from cloud storage.
     *
     * @param string $fileKey File key
     * @param string $organizationCode Organization code
     * @return array File information
     */
    private function getFileInfoFromCloudStorage(string $fileKey, string $organizationCode): array
    {
        $headObjectResult = $this->cloudFileRepository->getMetas([$fileKey], $organizationCode);
        $meta = $headObjectResult[$fileKey] ?? null;
        if ($meta === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
        }
        $info = $meta->getFileAttributes();
        return [
            'size' => $info['fileSize'],
            'last_modified' => $info['lastModified'],
        ];
    }
}

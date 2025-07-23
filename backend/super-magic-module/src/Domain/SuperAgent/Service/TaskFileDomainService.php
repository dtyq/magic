<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TopicRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Hyperf\DbConnection\Db;
use Throwable;

class TaskFileDomainService
{
    public function __construct(
        protected TaskFileRepositoryInterface $taskFileRepository,
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
        bool $isDirectory
    ): TaskFileEntity {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $workDir = $projectEntity->getWorkDir();

        if (empty($workDir)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORK_DIR_NOT_FOUND, 'project.work_dir.not_found');
        }

        if (! empty($parentId)) {
            $parentFIleEntity = $this->taskFileRepository->getById($parentId);
            if ($parentFIleEntity === null || $parentFIleEntity->getProjectId() != $projectEntity->getId()) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, 'file.file_not_found');
            }
            $fileKey = rtrim($parentFIleEntity->getFileKey(), '/') . '/' . $fileName;
        } else {
            $fileKey = WorkDirectoryUtil::getFullPrefix($organizationCode) . trim($workDir, '/') . '/' . $fileName;
        }

        if ($isDirectory) {
            $fileKey = rtrim($fileKey, '/') . '/';
        }

        // Check if file already exists
        $existingFile = $this->taskFileRepository->getByFileKey($fileKey);
        if ($existingFile !== null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_EXIST, 'file.file_exist');
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
            $taskFileEntity->setFileType('user_upload');
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

    public function deleteProjectFiles(DataIsolation $dataIsolation, TaskFileEntity $fileEntity): bool
    {
        Db::beginTransaction();
        try {
            // Delete cloud file
            $workDir = WorkDirectoryUtil::getRootDir($dataIsolation->getCurrentUserId(), $fileEntity->getProjectId());
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
                $fileKeys[] = $fileEntity->getFileKey();
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
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_EXIST, 'file.file_exist');
            }

            // call cloud file service
            $this->cloudFileRepository->copyObjectByCredential($prefix, $organizationCode, $fileEntity->getFileKey(), $fullTargetFileKey);
        } catch (Throwable $e) {
            throw $e;
        }
    }

    public function renameProjectFile(DataIsolation $dataIsolation, TaskFileEntity $fileEntity, string $workDir, string $targetObject): void
    {
        // target file exist
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $prefix = WorkDirectoryUtil::getPrefix($workDir);
        $fullTargetFileKey = WorkDirectoryUtil::getFullPrefix($organizationCode) . trim($workDir, '/') . '/' . trim($targetObject, '/');

        $targetFileEntity = $this->taskFileRepository->getByFileKey($fullTargetFileKey);
        if ($targetFileEntity !== null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_EXIST, 'file.file_exist');
        }

        Db::beginTransaction();
        try {
            // call cloud file service
            $this->cloudFileRepository->renameObjectByCredential($prefix, $organizationCode, $fileEntity->getFileKey(), $fullTargetFileKey);

            // rename file record
            $fileEntity->setFileKey($fullTargetFileKey);
            $fileEntity->setFileName(basename($fullTargetFileKey));
            $fileEntity->setUpdatedAt(date('Y-m-d H:i:s'));
            $this->taskFileRepository->updateById($fileEntity);

            Db::commit();
            return;
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
    }

    public function getUserFileEntity(DataIsolation $dataIsolation, int $fileId): TaskFileEntity
    {
        $fileEntity = $this->taskFileRepository->getById($fileId);
        if ($fileEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, 'file.file_not_found');
        }

        if ($fileEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.permission_denied');
        }

        if ($fileEntity->getProjectId() <= 0) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }

        return $fileEntity;
    }
}

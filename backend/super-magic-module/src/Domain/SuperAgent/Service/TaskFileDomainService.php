<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TopicRepositoryInterface;

class TaskFileDomainService
{
    public function __construct(
        protected TaskFileRepositoryInterface $taskFileRepository,
        protected TopicRepositoryInterface $topicRepository,
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
     * Save project file.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param string $projectId Project ID
     * @param string $topicId Topic ID (optional)
     * @param string $taskId Task ID (optional)
     * @param string $fileKey File key in OSS
     * @param string $fileName File name
     * @param int $fileSize File size in bytes
     * @param string $fileType File type
     * @return TaskFileEntity Saved file entity
     */
    public function saveProjectFile(
        DataIsolation $dataIsolation,
        string $projectId,
        string $topicId,
        string $taskId,
        string $fileKey,
        string $fileName,
        int $fileSize,
        string $fileType
    ): TaskFileEntity {
        // Check if file already exists by project_id and file_key
        $existingFile = $this->getByProjectIdAndFileKey((int) $projectId, $fileKey);
        if ($existingFile !== null) {
            return $existingFile;
        }

        // Create new file entity
        $entity = new TaskFileEntity();
        $entity->setUserId($dataIsolation->getCurrentUserId());
        $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $entity->setProjectId((int) $projectId);
        $entity->setTopicId(! empty($topicId) ? (int) $topicId : 0);
        $entity->setTaskId(! empty($taskId) ? (int) $taskId : 0);
        $entity->setFileId(IdGenerator::getSnowId());
        $entity->setFileKey($fileKey);
        $entity->setFileName($fileName);
        $entity->setFileSize($fileSize);
        $entity->setFileType($fileType);

        // Set default values as per requirements
        $entity->setStorageType(''); // Default empty string
        $entity->setIsHidden(false); // Default 0 (false)

        // Extract file extension from file name
        $fileExtension = pathinfo($fileName, PATHINFO_EXTENSION);
        $entity->setFileExtension($fileExtension);

        // Set timestamps
        $now = date('Y-m-d H:i:s');
        $entity->setCreatedAt($now);
        $entity->setUpdatedAt($now);

        // Save to repository
        $this->insert($entity);

        return $entity;
    }
}

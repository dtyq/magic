<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\File\Event\Publish\FileBatchCompressPublisher;
use App\Application\File\Service\FileAppService;
use App\Application\File\Service\FileBatchStatusManager;
use App\Domain\File\Event\FileBatchCompressEvent;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\SuperMagic\Domain\FileCollection\Service\FileCollectionDomainService;
use Dtyq\SuperMagic\Domain\Share\Constant\ResourceType;
use Dtyq\SuperMagic\Domain\Share\Service\ResourceShareDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\ErrorCode\ShareErrorCode;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\AccessTokenUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateBatchDownloadRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\CheckBatchDownloadResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\CreateBatchDownloadResponseDTO;
use Hyperf\Amqp\Producer;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

class FileBatchAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected FileAppService $fileAppService,
        protected TopicDomainService $topicDomainService,
        protected ProjectDomainService $projectDomainService,
        protected TaskFileDomainService $taskFileDomainService,
        protected Producer $producer,
        protected FileBatchStatusManager $statusManager,
        protected ResourceShareDomainService $resourceShareDomainService,
        protected FileCollectionDomainService $fileCollectionDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * Create batch download task.
     *
     * @param RequestContext $requestContext Request context
     * @param CreateBatchDownloadRequestDTO $requestDTO Request DTO
     * @return CreateBatchDownloadResponseDTO Create result
     * @throws BusinessException If files not found or access denied
     */
    public function createBatchDownload(
        RequestContext $requestContext,
        CreateBatchDownloadRequestDTO $requestDTO
    ): CreateBatchDownloadResponseDTO {
        // Get user authorization info
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();
        $fileIds = $requestDTO->getFileIds();

        // Basic validation
        if (count($fileIds) > 1000) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_TOO_MANY_FILES);
        }

        // Check topic access
        $projectEntity = $this->getAccessibleProject((int) $requestDTO->getProjectId(), $userId, $userAuthorization->getOrganizationCode());

        // Get selected entities (may include directories)
        $selectedEntities = [];
        if (! empty($fileIds)) {
            $selectedEntities = $this->taskFileDomainService->findFilesByProjectIdAndIds($projectEntity->getId(), $fileIds);
        } else {
            $selectedEntities = $this->taskFileDomainService->findUserFilesByProjectId($requestDTO->getProjectId());
        }

        // Check if there are valid entities
        if (empty($selectedEntities)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_NO_VALID_FILES);
        }

        // Expand directories to get all files
        $userFiles = $this->expandDirectoriesToFiles($selectedEntities, $projectEntity->getId());

        // Check if there are valid files after expansion
        if (empty($userFiles)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_NO_VALID_FILES);
        }

        // Check if expanded file count exceeds limit
        if (count($userFiles) > 10000) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_TOO_MANY_FILES);
        }

        // Use relative path mode (hardcoded for now, can be exposed to frontend later)
        $pathMode = 'relative';

        // Use actual file IDs (after expansion) to generate batch key
        // This ensures cache key reflects the actual content to be downloaded
        $actualFileIds = array_map(fn ($file) => $file->getFileId(), $userFiles);

        // Generate batch key (include pathMode for cache isolation)
        $batchKey = $this->generateBatchKey($actualFileIds, $userId, $requestDTO->getProjectId(), $pathMode);

        // Check if task already exists and completed
        $taskStatus = $this->statusManager->getTaskStatus($batchKey);
        if ($taskStatus && $taskStatus['status'] === 'ready') {
            // Check if files have been updated since cache creation
            $latestFileUpdateTime = $this->getLatestFileUpdateTime($userFiles);
            $cacheUpdatedAt = $taskStatus['updated_at'] ?? 0;

            if ($latestFileUpdateTime > $cacheUpdatedAt) {
                // Files have been updated, need to regenerate cache
                $this->logger->info('Files updated since cache creation, invalidating cache', [
                    'batch_key' => $batchKey,
                    'latest_file_time' => date('Y-m-d H:i:s', $latestFileUpdateTime),
                    'cache_updated_at' => date('Y-m-d H:i:s', $cacheUpdatedAt),
                ]);

                // Clear existing cache and proceed to regenerate
                $this->statusManager->cleanupTask($batchKey);
            } else {
                // Cache is still valid, return existing download link
                $downloadUrl = $taskStatus['result']['download_url'] ?? '';

                return new CreateBatchDownloadResponseDTO(
                    'ready',
                    $batchKey,
                    $downloadUrl,
                    $taskStatus['result']['file_count'] ?? count($userFiles),
                    'Files are ready'
                );
            }
        }

        // Get workdir path
        $workdir = $projectEntity->getWorkdir();
        $targetName = sprintf('%s_%s.zip', $projectEntity->getProjectName(), date('YmdHi'));
        $organizationCode = $projectEntity->getUserOrganizationCode();

        // Calculate basePath (LCA) for relative path mode
        $basePath = $this->calculateBasePath($selectedEntities, $workdir);

        // Initialize task status with organization code
        $this->statusManager->initializeTask($batchKey, $userId, count($userFiles), $organizationCode);

        // Publish message queue task
        $this->publishBatchJob($batchKey, $userFiles, $projectEntity->getId(), $userId, $organizationCode, $targetName, $workdir, $pathMode, $basePath);

        return new CreateBatchDownloadResponseDTO(
            'processing',
            $batchKey,
            null,
            count($userFiles),
            'Processing, please check status later'
        );
    }

    /**
     * Create batch download task by access token.
     *
     * @param RequestContext $requestContext Request context
     * @param CreateBatchDownloadRequestDTO $requestDTO Request DTO
     * @return CreateBatchDownloadResponseDTO Create result
     * @throws BusinessException If validation failed
     */
    public function createBatchDownloadByToken(
        RequestContext $requestContext,
        CreateBatchDownloadRequestDTO $requestDTO
    ): CreateBatchDownloadResponseDTO {
        $token = $requestDTO->getToken();
        $fileIds = $requestDTO->getFileIds();

        // Basic validation
        if (empty($token)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'token_required');
        }

        if (count($fileIds) > 1000) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_TOO_MANY_FILES);
        }

        // Validate token
        if (! AccessTokenUtil::validate($token)) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'task_file.access_denied');
        }

        // Get share entity from token
        $shareId = AccessTokenUtil::getShareId($token);
        $shareEntity = $this->resourceShareDomainService->getValidShareById($shareId);
        if (! $shareEntity) {
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, 'share.resource_not_found');
        }

        // Determine project ID and organization code
        // For FileCollection type, also get allowed file IDs for filtering
        $projectId = 0;
        $allowedFileIds = null; // Only set for FileCollection type
        switch ($shareEntity->getResourceType()) {
            case ResourceType::Topic->value:
                $topicEntity = $this->topicDomainService->getTopicWithDeleted((int) $shareEntity->getResourceId());
                if (empty($topicEntity)) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
                }
                $projectId = $topicEntity->getProjectId();
                break;
            case ResourceType::Project->value:
                $projectId = (int) $shareEntity->getProjectId();
                break;
            case ResourceType::FileCollection->value:
                $collectionId = (int) $shareEntity->getResourceId();
                $projectId = $this->fileCollectionDomainService->getProjectIdByCollectionId($collectionId);
                if (empty($projectId)) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, 'file.file_collection_empty_or_not_found');
                }
                // Get allowed file IDs from collection (includes files inside shared directories)
                $allowedFileIds = $this->getAllowedFileIdsFromCollection($collectionId, $projectId);
                break;
            case ResourceType::File->value:
                // 单文件类型：resource_id 是文件集ID（单文件也使用文件集存储）
                $collectionId = (int) $shareEntity->getResourceId();
                $projectId = $this->fileCollectionDomainService->getProjectIdByCollectionId($collectionId);
                if (empty($projectId)) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, 'file.file_collection_empty_or_not_found');
                }
                // Get allowed file IDs from collection (includes files inside shared directories)
                $allowedFileIds = $this->getAllowedFileIdsFromCollection($collectionId, $projectId);
                break;
            default:
                ExceptionBuilder::throw(ShareErrorCode::RESOURCE_TYPE_NOT_SUPPORTED, 'share.resource_type_not_supported');
        }

        // Get project entity to get workdir and organization code
        // Note: In token mode, we don't check user permission on project,
        // we trust the token validation and resource scope.
        // However, we still need the project entity for configuration.
        $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);
        if (empty($projectEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND);
        }

        // Get selected entities - may include directories
        $selectedEntities = $this->taskFileDomainService->findFilesByProjectIdAndIds($projectId, $fileIds);

        // Check if there are valid entities
        if (empty($selectedEntities)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_NO_VALID_FILES);
        }

        // Expand directories to get all files
        $userFiles = $this->expandDirectoriesToFiles($selectedEntities, $projectId);

        // For FileCollection type, filter to only include files within the shared scope
        // This must be done AFTER expandDirectoriesToFiles to filter expanded child files
        if ($allowedFileIds !== null) {
            $userFiles = array_filter($userFiles, function ($file) use ($allowedFileIds) {
                return in_array($file->getFileId(), $allowedFileIds, true);
            });
            $userFiles = array_values($userFiles); // Re-index array
        }

        // Check if there are valid files after expansion and filtering
        if (empty($userFiles)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_NO_VALID_FILES);
        }

        // Check if expanded file count exceeds limit
        if (count($userFiles) > 10000) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_TOO_MANY_FILES);
        }

        // Use relative path mode (hardcoded for now, can be exposed to frontend later)
        $pathMode = 'relative';

        // Use current logged-in user ID for operation tracking and batch key generation
        // This ensures that even with token access, the operation is linked to the actual user
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();

        // Use actual file IDs (after expansion and filtering) to generate batch key
        // This ensures cache key reflects the actual content to be downloaded
        // For FileCollection/File types, this prevents cache collision between different shares
        $actualFileIds = array_map(fn ($file) => $file->getFileId(), $userFiles);

        // Generate batch key (include pathMode for cache isolation)
        // We use project ID from the share resource
        $batchKey = $this->generateBatchKey($actualFileIds, $userId, (string) $projectId, $pathMode);

        // Check task status (reuse logic)
        $taskStatus = $this->statusManager->getTaskStatus($batchKey);
        if ($taskStatus && $taskStatus['status'] === 'ready') {
            $latestFileUpdateTime = $this->getLatestFileUpdateTime($userFiles);
            $cacheUpdatedAt = $taskStatus['updated_at'] ?? 0;

            if ($latestFileUpdateTime > $cacheUpdatedAt) {
                $this->statusManager->cleanupTask($batchKey);
            } else {
                $downloadUrl = $taskStatus['result']['download_url'] ?? '';
                return new CreateBatchDownloadResponseDTO(
                    'ready',
                    $batchKey,
                    $downloadUrl,
                    $taskStatus['result']['file_count'] ?? count($userFiles),
                    'Files are ready'
                );
            }
        }

        // Prepare for publishing task
        $workdir = $projectEntity->getWorkdir();
        $targetName = sprintf('%s_%s.zip', $projectEntity->getProjectName(), date('YmdHi'));
        $organizationCode = $projectEntity->getUserOrganizationCode();

        // Calculate basePath (LCA) for relative path mode
        $basePath = $this->calculateBasePath($selectedEntities, $workdir);

        // Initialize task status
        $this->statusManager->initializeTask($batchKey, $userId, count($userFiles), $organizationCode);

        // Publish message queue task
        $this->publishBatchJob($batchKey, $userFiles, $projectId, $userId, $organizationCode, $targetName, $workdir, $pathMode, $basePath);

        return new CreateBatchDownloadResponseDTO(
            'processing',
            $batchKey,
            null,
            count($userFiles),
            'Processing, please check status later'
        );
    }

    /**
     * Check batch download status.
     *
     * @param RequestContext $requestContext Request context
     * @param string $batchKey Batch key
     * @return CheckBatchDownloadResponseDTO Query result
     * @throws BusinessException If access denied
     */
    public function checkBatchDownload(
        RequestContext $requestContext,
        string $batchKey
    ): CheckBatchDownloadResponseDTO {
        // Get user authorization info
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();

        // Permission check
        if (! $this->statusManager->verifyUserPermission($batchKey, $userId)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_ACCESS_DENIED);
        }

        // Get task status
        $taskStatus = $this->statusManager->getTaskStatus($batchKey);

        if (! $taskStatus) {
            return new CheckBatchDownloadResponseDTO(
                'processing',
                null,
                0,
                'Task not found or expired'
            );
        }

        $status = $taskStatus['status'];
        $progress = $taskStatus['progress'] ?? [];
        $result = $taskStatus['result'] ?? [];
        $error = $taskStatus['error'] ?? '';
        // Use organization code from Redis instead of current user authorization
        $organizationCode = $taskStatus['organization_code'] ?? $userAuthorization->getOrganizationCode();

        $this->logger->info('Check batch download status', [
            'batch_key' => $batchKey,
            'status' => $status,
            'organization_code' => $organizationCode,
            'user_id' => $userId,
        ]);

        switch ($status) {
            case 'ready':
                $fileKey = $result['zip_file_key'] ?? '';
                if (! empty($fileKey)) {
                    $downloadUrl = $this->generateDownloadUrl($fileKey, $organizationCode);
                } else {
                    $downloadUrl = $result['download_url'] ?? '';
                }
                return new CheckBatchDownloadResponseDTO(
                    'ready',
                    $downloadUrl,
                    100,
                    'Files are ready'
                );

            case 'failed':
                return new CheckBatchDownloadResponseDTO(
                    'failed',
                    null,
                    null,
                    $error ?: 'Task failed'
                );

            case 'processing':
            default:
                $progressValue = $progress['percentage'] ?? 0;
                $progressMessage = $progress['message'] ?? 'Processing...';

                return new CheckBatchDownloadResponseDTO(
                    'processing',
                    null,
                    (int) $progressValue,
                    $progressMessage
                );
        }
    }

    /**
     * Generate batch key.
     *
     * @param array $fileIds File ID array
     * @param string $userId User ID
     * @param string $projectId Project ID
     * @param string $pathMode Path mode (absolute or relative)
     * @return string Batch key
     */
    private function generateBatchKey(array $fileIds, string $userId, string $projectId, string $pathMode = 'absolute'): string
    {
        sort($fileIds);
        $data = implode(',', $fileIds) . '|' . $userId . '|' . $projectId . '|' . $pathMode;
        return 'batch_' . md5($data);
    }

    /**
     * Publish batch processing task.
     *
     * @param string $batchKey Batch key
     * @param array $files File array
     * @param int $projectId Project ID
     * @param string $userId User ID
     * @param string $organizationCode Organization code
     * @param string $targetName Target name
     * @param string $workDir Work directory
     * @param string $pathMode Path mode: 'absolute' or 'relative'
     * @param string $basePath Base path for calculating relative paths in ZIP
     */
    private function publishBatchJob(string $batchKey, array $files, int $projectId, string $userId, string $organizationCode, string $targetName = '', string $workDir = '', string $pathMode = 'absolute', string $basePath = ''): void
    {
        // Prevent duplicate processing
        if (! $this->statusManager->acquireLock($batchKey)) {
            return;
        }

        // Prepare file data to pass to magic-service (format: ['file_id' => 'file_key'])
        $fileData = [];
        /** @var TaskFileEntity $file */
        foreach ($files as $file) {
            $fileData[$file->getFileId()] = [
                'file_key' => $file->getFileKey(),
                'file_name' => $file->getFileName(),
            ];
        }

        // Create and publish FileBatchCompressEvent
        $event = new FileBatchCompressEvent(
            'super_magic',
            $organizationCode,
            $userId,
            $batchKey,
            $fileData,
            $workDir,
            $targetName,
            WorkDirectoryUtil::getProjectFilePackDir($userId, $projectId),
            StorageBucketType::SandBox,
            $pathMode,
            $basePath
        );

        $publisher = new FileBatchCompressPublisher($event);
        if (! $this->producer->produce($publisher)) {
            $this->logger->error('Failed to publish file batch compress message', [
                'batch_key' => $batchKey,
                'user_id' => $userId,
                'file_count' => count($files),
            ]);

            // Remove lock when publish fails
            $this->statusManager->releaseLock($batchKey);
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_PUBLISH_FAILED);
        }

        $this->logger->info('File batch compress message published successfully', [
            'batch_key' => $batchKey,
            'user_id' => $userId,
            'file_count' => count($files),
            'path_mode' => $pathMode,
            'base_path' => $basePath,
        ]);

        $this->logger->info('Batch job published', [
            'batch_key' => $batchKey,
            'user_id' => $userId,
            'file_count' => count($files),
            'organization_code' => $organizationCode,
        ]);
    }

    /**
     * Generate download URL.
     *
     * @param string $filePath File path
     * @param string $organizationCode Organization code
     * @return string Download URL
     */
    private function generateDownloadUrl(string $filePath, string $organizationCode): string
    {
        $fileLink = $this->fileAppService->getLink($organizationCode, $filePath, StorageBucketType::SandBox, []);
        if (empty($fileLink)) {
            return '';
        }
        return $fileLink->getUrl();
    }

    /**
     * Get the latest file update time from user files.
     *
     * @param array $userFiles Array of TaskFileEntity objects
     * @return int Latest update timestamp (0 if no files or no update time)
     */
    private function getLatestFileUpdateTime(array $userFiles): int
    {
        $latestTimestamp = 0;

        /** @var TaskFileEntity $file */
        foreach ($userFiles as $file) {
            $updateTime = $file->getUpdatedAt();

            if (! empty($updateTime)) {
                // Convert Y-m-d H:i:s format to timestamp
                $timestamp = strtotime($updateTime);
                if ($timestamp > $latestTimestamp) {
                    $latestTimestamp = $timestamp;
                }
            }
        }

        return $latestTimestamp;
    }

    /**
     * Expand directories to get all files (excluding directories).
     *
     * @param TaskFileEntity[] $entities Selected entities (may include directories)
     * @param int $projectId Project ID
     * @return TaskFileEntity[] All file entities (excluding directories)
     */
    private function expandDirectoriesToFiles(array $entities, int $projectId): array
    {
        $allFiles = [];

        /** @var TaskFileEntity $entity */
        foreach ($entities as $entity) {
            if ($entity->getIsDirectory()) {
                // Recursively get all files under this directory
                $childFiles = $this->taskFileDomainService->findFilesRecursivelyByParentId(
                    $projectId,
                    $entity->getFileId()
                );
                // Filter out directories, only keep files
                foreach ($childFiles as $child) {
                    if (! $child->getIsDirectory()) {
                        $allFiles[] = $child;
                    }
                }
            } else {
                $allFiles[] = $entity;
            }
        }

        return $allFiles;
    }

    /**
     * Calculate base path (LCA - Lowest Common Ancestor) for selected entities.
     *
     * @param TaskFileEntity[] $selectedEntities User selected entities (files or directories)
     * @param string $workdir Project workdir
     * @return string Base path for ZIP relative paths
     */
    private function calculateBasePath(array $selectedEntities, string $workdir): string
    {
        if (empty($selectedEntities)) {
            return $workdir;
        }

        // Collect all relative paths (relative to workdir)
        $paths = [];
        $workdirNormalized = str_replace(['\\', '//', '///'], '/', trim($workdir, '/'));

        /** @var TaskFileEntity $entity */
        foreach ($selectedEntities as $entity) {
            $fileKey = $entity->getFileKey();
            // Normalize path separators
            $fileKey = str_replace(['\\', '//', '///'], '/', trim($fileKey));

            // Find position after workdir
            $pos = strpos($fileKey, $workdirNormalized);
            if ($pos !== false) {
                $relativePath = ltrim(substr($fileKey, $pos + strlen($workdirNormalized)), '/');
                if (! empty($relativePath)) {
                    // For both files and directories, use parent directory
                    // This ensures directory names are preserved in the ZIP
                    $parentDir = dirname($relativePath);
                    $paths[] = $parentDir === '.' ? '' : $parentDir;
                }
            }
        }

        if (empty($paths)) {
            return $workdir;
        }

        // Calculate LCA
        $lcaPath = $this->findLCA($paths);

        // Combine workdir with LCA
        if (empty($lcaPath)) {
            return $workdir;
        }

        return rtrim($workdir, '/') . '/' . $lcaPath;
    }

    /**
     * Find Lowest Common Ancestor path from multiple paths.
     *
     * @param string[] $paths Array of relative paths
     * @return string LCA path
     */
    private function findLCA(array $paths): string
    {
        // Filter out empty paths
        $paths = array_filter($paths, fn ($path) => $path !== '');

        if (empty($paths)) {
            return '';
        }

        if (count($paths) === 1) {
            return $paths[array_key_first($paths)];
        }

        // Split all paths into segments
        $segmentArrays = array_map(
            fn ($path) => array_values(array_filter(explode('/', $path))),
            $paths
        );

        // Find common prefix
        $commonSegments = [];
        $firstPath = $segmentArrays[array_key_first($segmentArrays)];

        for ($i = 0; $i < count($firstPath); ++$i) {
            $segment = $firstPath[$i];
            $isCommon = true;

            foreach ($segmentArrays as $segments) {
                if (! isset($segments[$i]) || $segments[$i] !== $segment) {
                    $isCommon = false;
                    break;
                }
            }

            if ($isCommon) {
                $commonSegments[] = $segment;
            } else {
                break;
            }
        }

        return implode('/', $commonSegments);
    }

    /**
     * Get all allowed file IDs from a file collection.
     * This includes files directly in the collection AND all child files of directories in the collection.
     *
     * @param int $collectionId File collection ID
     * @param int $projectId Project ID
     * @return array Array of allowed file IDs
     */
    private function getAllowedFileIdsFromCollection(int $collectionId, int $projectId): array
    {
        // Get files directly shared in the collection
        $collectionItems = $this->fileCollectionDomainService->getFilesByCollectionId($collectionId);
        if (empty($collectionItems)) {
            return [];
        }

        // Extract file IDs from collection items
        $sharedFileIds = array_map(fn ($item) => (int) $item->getFileId(), $collectionItems);

        // Get file entities to check which ones are directories
        $sharedEntities = $this->taskFileDomainService->findFilesByProjectIdAndIds($projectId, $sharedFileIds);

        $allowedFileIds = [];
        foreach ($sharedEntities as $entity) {
            $fileId = $entity->getFileId();
            $allowedFileIds[] = $fileId;

            // If it's a directory, recursively get all child file IDs
            if ($entity->getIsDirectory()) {
                $childFiles = $this->taskFileDomainService->findFilesRecursivelyByParentId($projectId, $fileId);
                foreach ($childFiles as $childFile) {
                    $allowedFileIds[] = $childFile->getFileId();
                }
            }
        }

        return array_unique($allowedFileIds);
    }
}

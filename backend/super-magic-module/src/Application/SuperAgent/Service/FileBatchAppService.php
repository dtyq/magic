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
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
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

        // Permission validation: get user accessible files
        if (empty($requestDTO->getFileIds())) {
            $userFiles = $this->taskFileDomainService->findUserFilesByProjectId($requestDTO->getProjectId());
        } else {
            $userFiles = $this->taskFileDomainService->findFilesByProjectIdAndIds($projectEntity->getId(), $fileIds);
        }

        // Check if there are valid files
        if (empty($userFiles)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_NO_VALID_FILES);
        }

        // Generate batch key
        $batchKey = $this->generateBatchKey($fileIds, $userId, $requestDTO->getProjectId());

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

        // Initialize task status with organization code
        $this->statusManager->initializeTask($batchKey, $userId, count($userFiles), $organizationCode);

        // Publish message queue task
        $this->publishBatchJob($batchKey, $userFiles, $projectEntity->getId(), $userId, $organizationCode, $targetName, $workdir);

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
     * @param string $topicId Topic ID
     * @return string Batch key
     */
    private function generateBatchKey(array $fileIds, string $userId, string $topicId): string
    {
        sort($fileIds);
        $data = implode(',', $fileIds) . '|' . $userId . '|' . $topicId;
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
     */
    private function publishBatchJob(string $batchKey, array $files, int $projectId, string $userId, string $organizationCode, string $targetName = '', string $workDir = ''): void
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
            StorageBucketType::SandBox
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
        ]);
        // This part will be implemented in the next step

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
}

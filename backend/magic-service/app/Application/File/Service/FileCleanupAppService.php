<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\File\Service;

use App\Domain\File\Service\FileCleanupDomainService;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * File cleanup application service.
 */
class FileCleanupAppService extends AbstractAppService
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly FileCleanupDomainService $domainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('FileCleanupApp');
    }

    /**
     * Register file for cleanup.
     *
     * @param string $organizationCode organization code
     * @param string $fileKey file storage key
     * @param string $fileName file name
     * @param int $fileSize file size
     * @param string $sourceType source type
     * @param null|string $sourceId source ID
     * @param int $expireAfterSeconds expire time in seconds
     * @param string $bucketType bucket type
     * @return bool registration success
     */
    public function registerFileForCleanup(
        string $organizationCode,
        string $fileKey,
        string $fileName,
        int $fileSize,
        string $sourceType,
        ?string $sourceId = null,
        int $expireAfterSeconds = 7200,
        string $bucketType = 'private'
    ): bool {
        try {
            return $this->domainService->registerFileForCleanup(
                $organizationCode,
                $fileKey,
                $fileName,
                $fileSize,
                $sourceType,
                $sourceId,
                $expireAfterSeconds,
                $bucketType
            );
        } catch (Throwable $e) {
            $this->logger->error('Register file for cleanup failed', [
                'organization_code' => $organizationCode,
                'file_key' => $fileKey,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return false;
        }
    }

    /**
     * Batch register files for cleanup.
     *
     * @param array $files file information array
     * @return array registration result
     */
    public function registerFilesForCleanup(array $files): array
    {
        $results = [
            'total' => count($files),
            'success' => 0,
            'failed' => 0,
            'failed_files' => [],
        ];

        foreach ($files as $file) {
            $success = $this->registerFileForCleanup(
                $file['organization_code'],
                $file['file_key'],
                $file['file_name'],
                $file['file_size'],
                $file['source_type'],
                $file['source_id'] ?? null,
                $file['expire_after_seconds'] ?? 7200,
                $file['bucket_type'] ?? 'private'
            );

            if ($success) {
                ++$results['success'];
            } else {
                ++$results['failed'];
                $results['failed_files'][] = $file['file_key'];
            }
        }

        $this->logger->info('Batch file cleanup registration completed', $results);
        return $results;
    }

    /**
     * Cancel file cleanup.
     *
     * @param string $fileKey file key
     * @param string $organizationCode organization code
     * @return bool cancellation success
     */
    public function cancelCleanup(string $fileKey, string $organizationCode): bool
    {
        try {
            if (empty($fileKey) || empty($organizationCode)) {
                $this->logger->error('Cancel cleanup parameters incomplete', [
                    'file_key' => $fileKey,
                    'organization_code' => $organizationCode,
                ]);
                return false;
            }

            return $this->domainService->cancelCleanup($fileKey, $organizationCode);
        } catch (Throwable $e) {
            $this->logger->error('Cancel file cleanup failed', [
                'file_key' => $fileKey,
                'organization_code' => $organizationCode,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Force cleanup file.
     *
     * @param int $recordId record ID
     * @return bool cleanup success
     */
    public function forceCleanup(int $recordId): bool
    {
        try {
            if ($recordId <= 0) {
                $this->logger->error('Invalid record ID', ['record_id' => $recordId]);
                return false;
            }

            return $this->domainService->forceCleanupFile($recordId);
        } catch (Throwable $e) {
            $this->logger->error('Force cleanup file failed', [
                'record_id' => $recordId,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Get cleanup statistics.
     *
     * @param null|string $sourceType source type filter
     * @return array statistics information
     */
    public function getCleanupStats(?string $sourceType = null): array
    {
        try {
            return $this->domainService->getCleanupStats($sourceType);
        } catch (Throwable $e) {
            $this->logger->error('Get cleanup statistics failed', [
                'source_type' => $sourceType,
                'error' => $e->getMessage(),
            ]);
            return [
                'pending' => 0,
                'cleaned' => 0,
                'failed' => 0,
                'expired' => 0,
                'total' => 0,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get file cleanup record details.
     *
     * @param int $recordId record ID
     * @return null|array record details
     */
    public function getCleanupRecord(int $recordId): ?array
    {
        try {
            $record = $this->domainService->getCleanupRecord($recordId);
            if (! $record) {
                return null;
            }

            return [
                'id' => $record->getId(),
                'organization_code' => $record->getOrganizationCode(),
                'file_key' => $record->getFileKey(),
                'file_name' => $record->getFileName(),
                'file_size' => $record->getFileSize(),
                'bucket_type' => $record->getBucketType(),
                'source_type' => $record->getSourceType(),
                'source_id' => $record->getSourceId(),
                'expire_at' => $record->getExpireAt(),
                'status' => $record->getStatus(),
                'status_text' => $this->getStatusText($record->getStatus()),
                'retry_count' => $record->getRetryCount(),
                'error_message' => $record->getErrorMessage(),
                'created_at' => $record->getCreatedAt(),
                'updated_at' => $record->getUpdatedAt(),
                'is_expired' => $record->isExpired(),
            ];
        } catch (Throwable $e) {
            $this->logger->error('Get cleanup record failed', [
                'record_id' => $recordId,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Execute system maintenance cleanup.
     *
     * @param int $successDaysToKeep success record retention days
     * @param int $failedDaysToKeep failed record retention days
     * @param int $maxRetries maximum retry count
     * @return array maintenance result
     */
    public function maintenance(int $successDaysToKeep = 7, int $failedDaysToKeep = 7, int $maxRetries = 3): array
    {
        try {
            return $this->domainService->maintenance($successDaysToKeep, $failedDaysToKeep, $maxRetries);
        } catch (Throwable $e) {
            $this->logger->error('System maintenance failed', [
                'error' => $e->getMessage(),
            ]);
            return [
                'success_records_cleaned' => 0,
                'failed_records_cleaned' => 0,
                'total_cleaned' => 0,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get status text description.
     */
    private function getStatusText(int $status): string
    {
        return match ($status) {
            0 => 'Pending cleanup',
            1 => 'Cleaned',
            2 => 'Cleanup failed',
            default => 'Unknown status',
        };
    }
}

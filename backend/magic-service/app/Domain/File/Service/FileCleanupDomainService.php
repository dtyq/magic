<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\Service;

use App\Domain\File\Entity\FileCleanupRecordEntity;
use App\Domain\File\Repository\FileCleanupRecordRepository;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

readonly class FileCleanupDomainService
{
    private LoggerInterface $logger;

    public function __construct(
        private FileCleanupRecordRepository $repository,
        private FileDomainService $fileDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('FileCleanup');
    }

    /**
     * Execute expired file cleanup.
     */
    public function cleanupExpiredFiles(int $batchSize = 50): array
    {
        $this->logger->info('Starting cleanup of expired files', ['batch_size' => $batchSize]);

        $stats = [
            'total_processed' => 0,
            'success_count' => 0,
            'failed_count' => 0,
            'skipped_count' => 0,
        ];

        try {
            // Get expired pending cleanup records
            $expiredRecords = $this->repository->getExpiredRecords($batchSize);

            if (empty($expiredRecords)) {
                $this->logger->info('No expired file records found');
                return $stats;
            }

            $stats['total_processed'] = count($expiredRecords);

            $this->logger->info('Found expired file records', [
                'count' => count($expiredRecords),
            ]);

            // Process expired files one by one
            foreach ($expiredRecords as $record) {
                $result = $this->cleanupSingleFile($record);

                switch ($result) {
                    case 'success':
                        $stats['success_count']++;
                        break;
                    case 'failed':
                        $stats['failed_count']++;
                        break;
                    case 'skipped':
                        $stats['skipped_count']++;
                        break;
                }
            }

            $this->logger->info('Expired file cleanup completed', $stats);
        } catch (Throwable $e) {
            $this->logger->error('Failed to cleanup expired files', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }

        return $stats;
    }

    /**
     * Process retry records.
     */
    public function processRetryRecords(int $maxRetries = 3, int $batchSize = 50): array
    {
        $this->logger->info('Starting processing of retry records', [
            'max_retries' => $maxRetries,
            'batch_size' => $batchSize,
        ]);

        $stats = [
            'total_processed' => 0,
            'success_count' => 0,
            'failed_count' => 0,
            'abandoned_count' => 0,
        ];

        try {
            $retryRecords = $this->repository->getRetryRecords($maxRetries, $batchSize);

            if (empty($retryRecords)) {
                $this->logger->info('No retry records found');
                return $stats;
            }

            $stats['total_processed'] = count($retryRecords);

            foreach ($retryRecords as $record) {
                if (! $record->canRetry($maxRetries)) {
                    $this->logger->warning('Record exceeded maximum retry count, abandoning processing', [
                        'record_id' => $record->getId(),
                        'retry_count' => $record->getRetryCount(),
                        'max_retries' => $maxRetries,
                    ]);
                    ++$stats['abandoned_count'];
                    continue;
                }

                $result = $this->cleanupSingleFile($record);

                switch ($result) {
                    case 'success':
                        $stats['success_count']++;
                        break;
                    case 'failed':
                        $stats['failed_count']++;
                        break;
                }
            }

            $this->logger->info('Retry record processing completed', $stats);
        } catch (Throwable $e) {
            $this->logger->error('Failed to process retry records', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }

        return $stats;
    }

    /**
     * Clean up single file - core business logic.
     *
     * Data consistency strategy:
     * 1. Delete object storage file first
     * 2. Delete database record if successful
     * 3. Update retry status if failed
     */
    public function cleanupSingleFile(FileCleanupRecordEntity $record): string
    {
        $this->logger->debug('Starting cleanup of single file', [
            'record_id' => $record->getId(),
            'file_key' => $record->getFileKey(),
            'organization_code' => $record->getOrganizationCode(),
            'source_type' => $record->getSourceType(),
        ]);

        try {
            // Step 1: Delete object storage file
            $bucketType = StorageBucketType::tryFrom($record->getBucketType()) ?? StorageBucketType::Private;
            $deleteSuccess = $this->fileDomainService->deleteFile(
                $record->getOrganizationCode(),
                $record->getFileKey(),
                $bucketType
            );

            if ($deleteSuccess) {
                // Step 2: Delete successful, immediately delete database record
                $this->repository->delete($record->getId());

                $this->logger->info('File cleanup successful', [
                    'record_id' => $record->getId(),
                    'file_key' => $record->getFileKey(),
                    'source_type' => $record->getSourceType(),
                    'file_size' => $record->getFileSize(),
                ]);

                return 'success';
            }
            // Step 3: Delete failed, increment retry count
            $this->repository->incrementRetry($record->getId(), 'Object storage file deletion failed');

            $this->logger->warning('File deletion failed, marked for retry', [
                'record_id' => $record->getId(),
                'file_key' => $record->getFileKey(),
                'retry_count' => $record->getRetryCount() + 1,
            ]);

            return 'failed';
        } catch (Throwable $e) {
            // Exception case: record error information and mark for retry
            $errorMessage = sprintf('File cleanup exception: %s', $e->getMessage());
            $this->repository->incrementRetry($record->getId(), $errorMessage);

            $this->logger->error('File cleanup exception', [
                'record_id' => $record->getId(),
                'file_key' => $record->getFileKey(),
                'error' => $e->getMessage(),
                'retry_count' => $record->getRetryCount() + 1,
            ]);

            return 'failed';
        }
    }

    /**
     * Force cleanup specified file.
     */
    public function forceCleanupFile(int $recordId): bool
    {
        $record = $this->repository->findById($recordId);
        if (! $record) {
            $this->logger->warning('Force cleanup failed: record not found', ['record_id' => $recordId]);
            return false;
        }

        $result = $this->cleanupSingleFile($record);
        return $result === 'success';
    }

    /**
     * Cancel file cleanup.
     */
    public function cancelCleanup(string $fileKey, string $organizationCode): bool
    {
        $canceled = $this->repository->cancelCleanup($fileKey, $organizationCode);

        if ($canceled) {
            $this->logger->info('File cleanup cancellation successful', [
                'file_key' => $fileKey,
                'organization_code' => $organizationCode,
            ]);
        } else {
            $this->logger->warning('File cleanup cancellation failed: record not found or status not allowed', [
                'file_key' => $fileKey,
                'organization_code' => $organizationCode,
            ]);
        }

        return $canceled;
    }

    /**
     * Maintenance cleanup: delete old success records and long-term failed records.
     */
    public function maintenance(int $successDaysToKeep = 7, int $failedDaysToKeep = 7, int $maxRetries = 3): array
    {
        $this->logger->info('Starting maintenance cleanup', [
            'success_days_to_keep' => $successDaysToKeep,
            'failed_days_to_keep' => $failedDaysToKeep,
            'max_retries' => $maxRetries,
        ]);

        try {
            $successCleaned = $this->repository->cleanupOldRecords($successDaysToKeep);
            $failedCleaned = $this->repository->cleanupFailedRecords($maxRetries, $failedDaysToKeep);

            $result = [
                'success_records_cleaned' => $successCleaned,
                'failed_records_cleaned' => $failedCleaned,
                'total_cleaned' => $successCleaned + $failedCleaned,
            ];

            $this->logger->info('Maintenance cleanup completed', $result);
            return $result;
        } catch (Throwable $e) {
            $this->logger->error('Maintenance cleanup failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
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
            // Parameter validation
            if (empty($organizationCode) || empty($fileKey) || empty($fileName) || empty($sourceType)) {
                $this->logger->error('File cleanup registration parameters incomplete', [
                    'organization_code' => $organizationCode,
                    'file_key' => $fileKey,
                    'file_name' => $fileName,
                    'source_type' => $sourceType,
                ]);
                return false;
            }

            if ($expireAfterSeconds <= 0) {
                $this->logger->error('Expire time must be greater than 0', ['expire_after_seconds' => $expireAfterSeconds]);
                return false;
            }

            // Check if same record already exists
            $existingRecord = $this->repository->findByFileKey($fileKey, $organizationCode);
            if ($existingRecord && $existingRecord->isPending()) {
                $this->logger->warning('File cleanup record already exists', [
                    'file_key' => $fileKey,
                    'organization_code' => $organizationCode,
                    'existing_id' => $existingRecord->getId(),
                ]);
                return true; // Already exists pending cleanup record, return success directly
            }

            // Create entity
            $entity = new FileCleanupRecordEntity();
            $entity->setOrganizationCode($organizationCode);
            $entity->setFileKey($fileKey);
            $entity->setFileName($fileName);
            $entity->setFileSize($fileSize);
            $entity->setBucketType($bucketType);
            $entity->setSourceType($sourceType);
            $entity->setSourceId($sourceId);
            $entity->setExpireAt(date('Y-m-d H:i:s', time() + $expireAfterSeconds));
            $entity->setStatus(0); // pending cleanup
            $entity->setRetryCount(0);
            $entity->setErrorMessage(null);

            // Save to database
            $this->repository->create($entity);

            $this->logger->info('File cleanup registration successful', [
                'id' => $entity->getId(),
                'organization_code' => $organizationCode,
                'file_key' => $fileKey,
                'file_name' => $fileName,
                'source_type' => $sourceType,
                'expire_at' => $entity->getExpireAt(),
            ]);

            return true;
        } catch (Throwable $e) {
            $this->logger->error('File cleanup registration failed', [
                'organization_code' => $organizationCode,
                'file_key' => $fileKey,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return false;
        }
    }

    /**
     * Get file cleanup record details.
     *
     * @param int $recordId record ID
     * @return null|FileCleanupRecordEntity record details
     */
    public function getCleanupRecord(int $recordId): ?FileCleanupRecordEntity
    {
        try {
            return $this->repository->findById($recordId);
        } catch (Throwable $e) {
            $this->logger->error('Failed to get cleanup record', [
                'record_id' => $recordId,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Get cleanup statistics.
     */
    public function getCleanupStats(?string $sourceType = null): array
    {
        return $this->repository->getCleanupStats($sourceType);
    }
}

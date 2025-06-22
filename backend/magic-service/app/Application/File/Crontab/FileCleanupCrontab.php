<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\File\Crontab;

use App\Domain\File\Service\FileCleanupDomainService;
use App\Infrastructure\Util\Locker\LockerInterface;
use Hyperf\Crontab\Annotation\Crontab;
use Psr\Log\LoggerInterface;
use Throwable;

#[Crontab(
    rule: '0 * * * *',                    // Execute every hour
    name: 'FileCleanupCrontab',
    singleton: true,                      // Singleton mode to prevent duplicate execution
    mutexExpires: 3600,                   // Mutex lock expires in 1 hour
    onOneServer: true,                    // Execute on only one server
    callback: 'execute',
    memo: 'File cleanup scheduled task'
)]
readonly class FileCleanupCrontab
{
    public function __construct(
        private FileCleanupDomainService $fileCleanupDomainService,
        private LockerInterface $locker,
        private LoggerInterface $logger,
    ) {
    }

    public function execute(): void
    {
        $this->logger->info('FileCleanupCrontab started execution');
        $startTime = time();

        try {
            // Use distributed lock to ensure only one instance executes at the same time
            $lockKey = 'FileCleanupCrontab-global';
            $lockOwner = 'FileCleanupCrontab-' . gethostname() . '-' . getmypid();
            $lockTimeout = 3600; // 1 hour lock timeout

            if (! $this->locker->mutexLock($lockKey, $lockOwner, $lockTimeout)) {
                $this->logger->info('FileCleanupCrontab failed to acquire lock, another instance may be running');
                return;
            }

            try {
                // Execute cleanup tasks
                $this->performCleanup();
            } finally {
                // Ensure lock is released
                $this->locker->release($lockKey, $lockOwner);
            }

            $duration = time() - $startTime;
            $this->logger->info('FileCleanupCrontab execution completed', [
                'duration_seconds' => $duration,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('FileCleanupCrontab execution exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'duration_seconds' => time() - $startTime,
            ]);
        }
    }

    /**
     * Execute cleanup tasks.
     */
    private function performCleanup(): void
    {
        $totalStats = [
            'expired_files' => [
                'total_processed' => 0,
                'success_count' => 0,
                'failed_count' => 0,
                'skipped_count' => 0,
            ],
            'retry_files' => [
                'total_processed' => 0,
                'success_count' => 0,
                'failed_count' => 0,
                'abandoned_count' => 0,
            ],
            'maintenance' => [
                'success_records_cleaned' => 0,
                'failed_records_cleaned' => 0,
                'total_cleaned' => 0,
            ],
        ];

        // 1. Clean up expired files
        $this->logger->info('Starting cleanup of expired files');
        $expiredStats = $this->cleanupExpiredFiles();
        $totalStats['expired_files'] = $expiredStats;

        // 2. Process retry records
        $this->logger->info('Starting processing of retry records');
        $retryStats = $this->processRetryRecords();
        $totalStats['retry_files'] = $retryStats;

        // 3. System maintenance (execute once daily at 1 AM)
        if (date('H') === '01') {
            $this->logger->info('Starting system maintenance');
            $maintenanceStats = $this->performMaintenance();
            $totalStats['maintenance'] = $maintenanceStats;
        }

        $this->logger->info('File cleanup tasks completed', $totalStats);
    }

    /**
     * Clean up expired files.
     */
    private function cleanupExpiredFiles(): array
    {
        $batchSize = 50; // Process 50 files per batch
        $totalStats = [
            'total_processed' => 0,
            'success_count' => 0,
            'failed_count' => 0,
            'skipped_count' => 0,
        ];

        try {
            $maxBatches = 20; // Maximum 20 batches to prevent single task from running too long
            $currentBatch = 0;

            while ($currentBatch < $maxBatches) {
                $stats = $this->fileCleanupDomainService->cleanupExpiredFiles($batchSize);

                // Accumulate statistics
                $totalStats['total_processed'] += $stats['total_processed'];
                $totalStats['success_count'] += $stats['success_count'];
                $totalStats['failed_count'] += $stats['failed_count'];
                $totalStats['skipped_count'] += $stats['skipped_count'];

                ++$currentBatch;

                // If no files were processed, there are no more expired files
                if ($stats['total_processed'] === 0) {
                    break;
                }

                $this->logger->debug('Expired file cleanup batch completed', [
                    'batch' => $currentBatch,
                    'batch_stats' => $stats,
                ]);

                // If processed files are less than batch size, there are no more files
                if ($stats['total_processed'] < $batchSize) {
                    break;
                }
            }

            $this->logger->info('Expired file cleanup completed', [
                'total_batches' => $currentBatch,
                'total_stats' => $totalStats,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('Failed to clean up expired files', [
                'error' => $e->getMessage(),
                'current_stats' => $totalStats,
            ]);
        }

        return $totalStats;
    }

    /**
     * Process retry records.
     */
    private function processRetryRecords(): array
    {
        $batchSize = 30; // Process 30 retry records per batch
        $maxRetries = 3;
        $totalStats = [
            'total_processed' => 0,
            'success_count' => 0,
            'failed_count' => 0,
            'abandoned_count' => 0,
        ];

        try {
            $maxBatches = 10; // Maximum 10 batches of retry records
            $currentBatch = 0;

            while ($currentBatch < $maxBatches) {
                $stats = $this->fileCleanupDomainService->processRetryRecords($maxRetries, $batchSize);

                // Accumulate statistics
                $totalStats['total_processed'] += $stats['total_processed'];
                $totalStats['success_count'] += $stats['success_count'];
                $totalStats['failed_count'] += $stats['failed_count'];
                $totalStats['abandoned_count'] += $stats['abandoned_count'];

                ++$currentBatch;

                // If no records were processed, there are no more retry records
                if ($stats['total_processed'] === 0) {
                    break;
                }

                $this->logger->debug('Retry record processing batch completed', [
                    'batch' => $currentBatch,
                    'batch_stats' => $stats,
                ]);

                // If processed records are less than batch size, there are no more records
                if ($stats['total_processed'] < $batchSize) {
                    break;
                }
            }

            $this->logger->info('Retry record processing completed', [
                'total_batches' => $currentBatch,
                'total_stats' => $totalStats,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('Failed to process retry records', [
                'error' => $e->getMessage(),
                'current_stats' => $totalStats,
            ]);
        }

        return $totalStats;
    }

    /**
     * Execute system maintenance.
     */
    private function performMaintenance(): array
    {
        $defaultStats = [
            'success_records_cleaned' => 0,
            'failed_records_cleaned' => 0,
            'total_cleaned' => 0,
        ];

        try {
            // Clean up success and failed records from 7 days ago
            $successDaysToKeep = 7;
            $failedDaysToKeep = 7;
            $maxRetries = 3;

            $stats = $this->fileCleanupDomainService->maintenance(
                $successDaysToKeep,
                $failedDaysToKeep,
                $maxRetries
            );

            $this->logger->info('System maintenance completed', $stats);
            return $stats;
        } catch (Throwable $e) {
            $this->logger->error('System maintenance failed', [
                'error' => $e->getMessage(),
            ]);
            return array_merge($defaultStats, ['error' => $e->getMessage()]);
        }
    }
}

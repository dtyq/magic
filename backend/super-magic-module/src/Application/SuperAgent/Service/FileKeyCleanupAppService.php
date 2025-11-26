<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use Dtyq\SuperMagic\Application\SuperAgent\DTO\CleanupFileKeysRequestDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\FileKeyCleanupDomainService;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * File Key Cleanup Application Service.
 */
class FileKeyCleanupAppService
{
    private const BATCH_SIZE = 50;

    private LoggerInterface $logger;

    public function __construct(
        protected FileKeyCleanupDomainService $cleanupService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('file-key-cleanup-api');
    }

    /**
     * Get cleanup statistics by project_id or file_key.
     */
    public function getStatistics(?int $projectId = null, ?string $fileKey = null): array
    {
        try {
            $stats = $this->cleanupService->getStatistics($projectId, $fileKey);

            return [
                'success' => true,
                'data' => [
                    'fully_deleted_count' => $stats['deleted'] ?? 0,
                    'directory_duplicates_count' => $stats['directory'] ?? 0,
                    'file_duplicates_count' => $stats['file'] ?? 0,
                    'total_count' => ($stats['deleted'] ?? 0) + ($stats['directory'] ?? 0) + ($stats['file'] ?? 0),
                ],
                'filter' => [
                    'project_id' => $projectId,
                    'file_key' => $fileKey,
                ],
            ];
        } catch (Throwable $e) {
            $this->logger->error('Failed to get cleanup statistics', [
                'project_id' => $projectId,
                'file_key' => $fileKey,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'Failed to get statistics: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Execute cleanup process.
     */
    public function executeCleanup(CleanupFileKeysRequestDTO $requestDTO): array
    {
        $projectId = $requestDTO->getProjectId();
        $fileKey = $requestDTO->getFileKey();
        $dryRun = $requestDTO->getDryRun();

        $this->logger->info('Cleanup process initiated via API', [
            'project_id' => $projectId,
            'file_key' => $fileKey,
            'dry_run' => $dryRun,
        ]);

        $startTime = microtime(true);

        try {
            // Initialize log files
            $this->cleanupService->initializeLogFiles();

            // Get statistics
            $stats = $this->cleanupService->getStatistics($projectId, $fileKey);

            $totalFileKeys = $stats['deleted'] + $stats['directory'] + $stats['file'];

            if ($totalFileKeys === 0) {
                $this->cleanupService->closeLogFiles();
                return [
                    'success' => true,
                    'message' => 'No duplicate file_keys found',
                    'statistics' => [
                        'fully_deleted_count' => 0,
                        'directory_duplicates_count' => 0,
                        'file_duplicates_count' => 0,
                        'total_count' => 0,
                    ],
                    'results' => [
                        'total_processed' => 0,
                        'total_deleted' => 0,
                        'total_errors' => 0,
                    ],
                    'dry_run' => $dryRun,
                ];
            }

            // Process all stages
            $results = $this->processAllStages($stats, $projectId, $fileKey, $dryRun);

            // Verification
            $remainingDuplicates = $this->cleanupService->verifyRemainingDuplicates();
            $fixResults = $this->cleanupService->fixInconsistentDirectoryFlags($dryRun);

            $executionTime = microtime(true) - $startTime;

            // Close log files
            $this->cleanupService->closeLogFiles();

            return [
                'success' => true,
                'message' => $dryRun ? 'Preview completed (no data modified)' : 'Cleanup process completed',
                'statistics' => [
                    'fully_deleted_count' => $stats['deleted'] ?? 0,
                    'directory_duplicates_count' => $stats['directory'] ?? 0,
                    'file_duplicates_count' => $stats['file'] ?? 0,
                    'total_count' => $totalFileKeys,
                ],
                'results' => [
                    'total_processed' => $results['total_processed'],
                    'total_deleted' => $results['total_deleted'],
                    'total_errors' => $results['total_errors'],
                    'stages' => $results['stages'],
                ],
                'verification' => [
                    'remaining_duplicates' => $remainingDuplicates,
                    'fixed_inconsistencies' => $fixResults['total'] ?? 0,
                ],
                'execution_time_seconds' => round($executionTime, 2),
                'logs' => [
                    'csv_log' => $this->cleanupService->getCsvFilePath(),
                    'execution_log' => $this->cleanupService->getLogFilePath(),
                ],
                'filter' => [
                    'project_id' => $projectId,
                    'file_key' => $fileKey,
                ],
                'dry_run' => $dryRun,
            ];
        } catch (Throwable $e) {
            $this->logger->error('Cleanup process failed', [
                'project_id' => $projectId,
                'file_key' => $fileKey,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $this->cleanupService->closeLogFiles();

            return [
                'success' => false,
                'message' => 'Cleanup process failed: ' . $e->getMessage(),
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Process all cleanup stages.
     */
    private function processAllStages(array $stats, ?int $projectId, ?string $fileKey, bool $dryRun): array
    {
        $totalProcessed = 0;
        $totalDeleted = 0;
        $totalErrors = 0;
        $stages = [];

        // Stage 1: Process fully deleted
        if ($stats['deleted'] > 0) {
            $result = $this->cleanupService->processFullyDeleted(
                self::BATCH_SIZE,
                $dryRun,
                $projectId,
                $fileKey
            );
            $stages['fully_deleted'] = $result;
            $totalProcessed += $result['processed'] ?? 0;
            $totalDeleted += $result['deleted'] ?? 0;
            $totalErrors += $result['errors'] ?? 0;
        }

        // Stage 2: Process directory duplicates
        if ($stats['directory'] > 0) {
            $result = $this->cleanupService->processDirectoryDuplicates(
                self::BATCH_SIZE,
                $dryRun,
                $projectId,
                $fileKey
            );
            $stages['directory_duplicates'] = $result;
            $totalProcessed += $result['processed'] ?? 0;
            $totalDeleted += $result['deleted'] ?? 0;
            $totalErrors += $result['errors'] ?? 0;
        }

        // Stage 3: Process file duplicates
        if ($stats['file'] > 0) {
            $result = $this->cleanupService->processFileDuplicates(
                self::BATCH_SIZE,
                $dryRun,
                $projectId,
                $fileKey
            );
            $stages['file_duplicates'] = $result;
            $totalProcessed += $result['processed'] ?? 0;
            $totalDeleted += $result['deleted'] ?? 0;
            $totalErrors += $result['errors'] ?? 0;
        }

        return [
            'total_processed' => $totalProcessed,
            'total_deleted' => $totalDeleted,
            'total_errors' => $totalErrors,
            'stages' => $stages,
        ];
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileCleanupRepositoryInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class FileKeyCleanupDomainService
{
    private LoggerInterface $logger;

    private mixed $csvFileHandle = null;

    private string $csvFilePath = '';

    private string $logFilePath = '';

    public function __construct(
        protected TaskFileCleanupRepositoryInterface $repository,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('file-key-cleanup');
    }

    /**
     * Get statistics for duplicate file_keys (optimized - single query).
     */
    public function getStatistics(?int $projectId = null, ?string $fileKey = null): array
    {
        return $this->repository->getAllStatistics($projectId, $fileKey);
    }

    /**
     * Initialize log files.
     */
    public function initializeLogFiles(): void
    {
        $timestamp = date('Ymd_His');
        $logDir = BASE_PATH . '/storage/logs';

        if (! is_dir($logDir)) {
            mkdir($logDir, 0755, true);
        }

        $this->csvFilePath = $logDir . "/file_key_cleanup_{$timestamp}.csv";
        $this->logFilePath = $logDir . "/file_key_cleanup_{$timestamp}.log";

        // Initialize CSV file with headers
        $this->csvFileHandle = fopen($this->csvFilePath, 'w');
        if ($this->csvFileHandle) {
            fputcsv($this->csvFileHandle, [
                'timestamp',
                'stage',
                'action',
                'file_key',
                'file_id',
                'kept_file_id',
                'file_name',
                'is_directory',
                'project_id',
                'topic_id',
                'parent_id',
                'deleted_at',
                'error_message',
            ]);
        }

        $this->writeLog('INFO', 'Log files initialized');
        $this->writeLog('INFO', "CSV log: {$this->csvFilePath}");
        $this->writeLog('INFO', "Execution log: {$this->logFilePath}");
    }

    /**
     * Close log files.
     */
    public function closeLogFiles(): void
    {
        if ($this->csvFileHandle) {
            fclose($this->csvFileHandle);
        }
    }

    /**
     * Get CSV log file path.
     */
    public function getCsvFilePath(): string
    {
        return $this->csvFilePath;
    }

    /**
     * Get execution log file path.
     */
    public function getLogFilePath(): string
    {
        return $this->logFilePath;
    }

    /**
     * Process fully deleted file_keys (PERFORMANCE OPTIMIZED).
     *
     * OPTIMIZATIONS:
     * 1. Removed slow COUNT query at start (saves ~30 seconds)
     * 2. Fixed OFFSET=0 pagination strategy
     * 3. Added infinite loop protection
     * 4. Added dry-run mode protection
     *
     * PAGINATION STRATEGY: Uses fixed OFFSET=0 approach.
     * - Each query always fetches from OFFSET 0
     * - Processed records are deleted immediately
     * - Next query automatically gets new first batch
     * - No offset drift issue
     */
    public function processFullyDeleted(int $batchSize, bool $dryRun = false, ?int $projectId = null, ?string $fileKey = null): array
    {
        $totalProcessed = 0;
        $totalDeleted = 0;
        $totalErrors = 0;

        // Infinite loop protection
        $maxIterations = 1000;
        $iteration = 0;

        // OPTIMIZATION: Removed slow COUNT query, process directly
        $this->writeLog('INFO', "Stage 1: Processing fully deleted file_keys (batch size: {$batchSize})");

        while (true) {
            // Always query from OFFSET 0, as processed records are deleted
            $fileKeys = $this->repository->getFullyDeletedDuplicateKeys($batchSize, $projectId, $fileKey);

            if (empty($fileKeys)) {
                $this->writeLog('INFO', 'No more fully deleted file_keys to process');
                break;
            }

            // Prevent infinite loop in case of persistent errors
            ++$iteration;
            if ($iteration > $maxIterations) {
                $this->writeLog('WARNING', "Reached maximum iterations ({$maxIterations}), stopping to prevent infinite loop");
                break;
            }

            $this->writeLog('INFO', "Processing batch {$iteration}: {$totalProcessed} file_keys processed so far, " . count($fileKeys) . ' in current batch');

            // Optimized: Batch query all records for these file_keys at once
            $recordsGrouped = $this->repository->getRecordsByFileKeys($fileKeys);

            $batchProcessed = 0;
            foreach ($fileKeys as $currentFileKey) {
                try {
                    $records = $recordsGrouped[$currentFileKey] ?? [];
                    if (empty($records)) {
                        continue;
                    }

                    $result = $this->processFullyDeletedFileKeyWithRecords($currentFileKey, $records, $dryRun);
                    $totalDeleted += $result['deleted'];
                    ++$totalProcessed;
                    ++$batchProcessed;
                } catch (Throwable $e) {
                    ++$totalErrors;
                    $this->logError('deleted', $currentFileKey, $e->getMessage());
                    $this->writeLog('ERROR', "Failed to process file_key '{$currentFileKey}': {$e->getMessage()}");
                }
            }

            // In dry-run mode, if no records were actually processed, break to avoid infinite loop
            if ($dryRun && $batchProcessed === 0) {
                $this->writeLog('WARNING', 'Dry-run mode: No records processed in this batch, stopping to prevent infinite loop');
                break;
            }
        }

        $this->writeLog('INFO', "Stage 1 completed: {$totalProcessed} file_keys processed, {$totalDeleted} records deleted, {$totalErrors} errors");

        return [
            'processed' => $totalProcessed,
            'deleted' => $totalDeleted,
            'errors' => $totalErrors,
        ];
    }

    /**
     * Process directory duplicates (PERFORMANCE OPTIMIZED).
     *
     * OPTIMIZATIONS:
     * 1. Removed slow COUNT query at start (saves ~30 seconds)
     * 2. Fixed OFFSET=0 pagination strategy
     * 3. Added infinite loop protection
     * 4. Added dry-run mode protection
     *
     * PAGINATION STRATEGY: Uses fixed OFFSET=0 approach.
     * - Each query always fetches from OFFSET 0
     * - Processed records are deleted immediately
     * - Next query automatically gets new first batch
     * - No offset drift issue
     */
    public function processDirectoryDuplicates(int $batchSize, bool $dryRun = false, ?int $projectId = null, ?string $fileKey = null): array
    {
        $totalProcessed = 0;
        $totalKept = 0;
        $totalDeleted = 0;
        $totalParentIdUpdated = 0;
        $totalErrors = 0;

        // Infinite loop protection
        $maxIterations = 1000;
        $iteration = 0;

        // OPTIMIZATION: Removed slow COUNT query, process directly
        $this->writeLog('INFO', "Stage 2: Processing duplicate directory file_keys (batch size: {$batchSize})");

        while (true) {
            // Always query from OFFSET 0, as processed records are deleted
            $fileKeys = $this->repository->getDirectoryDuplicateKeys($batchSize, $projectId, $fileKey);

            if (empty($fileKeys)) {
                $this->writeLog('INFO', 'No more duplicate directory file_keys to process');
                break;
            }

            // Prevent infinite loop in case of persistent errors
            ++$iteration;
            if ($iteration > $maxIterations) {
                $this->writeLog('WARNING', "Reached maximum iterations ({$maxIterations}), stopping to prevent infinite loop");
                break;
            }

            $this->writeLog('INFO', "Processing batch {$iteration}: {$totalProcessed} file_keys processed so far, " . count($fileKeys) . ' in current batch');

            // Optimized: Batch query all records for these file_keys at once
            $recordsGrouped = $this->repository->getRecordsByFileKeys($fileKeys);

            $batchProcessed = 0;
            foreach ($fileKeys as $currentFileKey) {
                try {
                    $records = $recordsGrouped[$currentFileKey] ?? [];
                    if (empty($records)) {
                        continue;
                    }

                    $result = $this->processDirectoryFileKeyWithRecords($currentFileKey, $records, $dryRun);
                    if ($result['kept'] > 0) {
                        ++$totalKept;
                    }
                    $totalDeleted += $result['deleted'];
                    $totalParentIdUpdated += $result['parent_id_updated'];
                    ++$totalProcessed;
                    ++$batchProcessed;
                } catch (Throwable $e) {
                    ++$totalErrors;
                    $this->logError('directory', $currentFileKey, $e->getMessage());
                    $this->writeLog('ERROR', "Failed to process file_key '{$currentFileKey}': {$e->getMessage()}");
                }
            }

            // In dry-run mode, if no records were actually processed, break to avoid infinite loop
            if ($dryRun && $batchProcessed === 0) {
                $this->writeLog('WARNING', 'Dry-run mode: No records processed in this batch, stopping to prevent infinite loop');
                break;
            }
        }

        $this->writeLog(
            'INFO',
            "Stage 2 completed: {$totalProcessed} file_keys processed, {$totalKept} kept, {$totalDeleted} deleted, {$totalParentIdUpdated} parent_id updated, {$totalErrors} errors"
        );

        return [
            'processed' => $totalProcessed,
            'kept' => $totalKept,
            'deleted' => $totalDeleted,
            'parent_id_updated' => $totalParentIdUpdated,
            'errors' => $totalErrors,
        ];
    }

    /**
     * Process file duplicates (PERFORMANCE OPTIMIZED).
     *
     * OPTIMIZATIONS:
     * 1. Removed slow COUNT queries (saves ~60+ seconds)
     * 2. Fixed OFFSET=0 pagination strategy
     * 3. FIXED BUG: Removed break that caused only first batch to be processed
     * 4. Added infinite loop protection
     * 5. Added dry-run mode protection
     *
     * PAGINATION STRATEGY: Uses fixed OFFSET=0 approach.
     * - Each query always fetches from OFFSET 0
     * - Processed records are deleted immediately
     * - Next query automatically gets new first batch
     * - No offset drift issue
     */
    public function processFileDuplicates(int $batchSize, bool $dryRun = false, ?int $projectId = null, ?string $fileKey = null): array
    {
        $totalProcessed = 0;
        $totalKept = 0;
        $totalDeleted = 0;
        $totalErrors = 0;

        // Infinite loop protection
        $maxIterations = 1000;
        $iteration = 0;

        // OPTIMIZATION: Removed slow COUNT query, process directly
        $this->writeLog('INFO', "Stage 3: Processing duplicate file file_keys (batch size: {$batchSize})");

        while (true) {
            // Always query from OFFSET 0, as processed records are deleted
            $fileKeys = $this->repository->getFileDuplicateKeys($batchSize, $projectId, $fileKey);

            if (empty($fileKeys)) {
                $this->writeLog('INFO', 'No more duplicate file file_keys to process');
                break;
            }

            // Prevent infinite loop in case of persistent errors
            ++$iteration;
            if ($iteration > $maxIterations) {
                $this->writeLog('WARNING', "Reached maximum iterations ({$maxIterations}), stopping to prevent infinite loop");
                break;
            }

            $this->writeLog('INFO', "Processing batch {$iteration}: {$totalProcessed} file_keys processed so far, " . count($fileKeys) . ' in current batch');

            // Optimized: Batch query all records for these file_keys at once
            $recordsGrouped = $this->repository->getRecordsByFileKeys($fileKeys);

            $batchProcessed = 0;
            foreach ($fileKeys as $currentFileKey) {
                try {
                    $records = $recordsGrouped[$currentFileKey] ?? [];
                    if (empty($records)) {
                        continue;
                    }
                    $result = $this->processFileFileKeyWithRecords($currentFileKey, $records, $dryRun);
                    if ($result['kept'] > 0) {
                        ++$totalKept;
                    }
                    $totalDeleted += $result['deleted'];
                    ++$totalProcessed;
                    ++$batchProcessed;
                } catch (Throwable $e) {
                    ++$totalErrors;
                    $this->logError('file', $currentFileKey, $e->getMessage());
                    $this->writeLog('ERROR', "Failed to process file_key '{$currentFileKey}': {$e->getMessage()}");
                }
            }

            // In dry-run mode, if no records were actually processed, break to avoid infinite loop
            if ($dryRun && $batchProcessed === 0) {
                $this->writeLog('WARNING', 'Dry-run mode: No records processed in this batch, stopping to prevent infinite loop');
                break;
            }

            // FIXED: Removed break that was here - now processes all batches
        }

        $this->writeLog(
            'INFO',
            "Stage 3 completed: {$totalProcessed} file_keys processed, {$totalKept} kept, {$totalDeleted} deleted, {$totalErrors} errors"
        );

        return [
            'processed' => $totalProcessed,
            'kept' => $totalKept,
            'deleted' => $totalDeleted,
            'errors' => $totalErrors,
        ];
    }

    /**
     * Estimate remaining duplicates based on processed counts (FAST).
     *
     * PERFORMANCE NOTE: Uses estimation instead of slow COUNT query.
     * Formula: remaining = initial total - processed counts
     * This is much faster (instant) than counting remaining records on large tables.
     *
     * @param array $stats Initial statistics from getStatistics()
     * @param array $results Processing results from all stages
     * @return int Estimated remaining duplicates
     */
    public function estimateRemainingDuplicates(array $stats, array $results): int
    {
        $initialTotal = ($stats['deleted'] ?? 0) + ($stats['directory'] ?? 0) + ($stats['file'] ?? 0);

        $totalProcessed = 0;
        if (isset($results['deleted']['processed'])) {
            $totalProcessed += $results['deleted']['processed'];
        }
        if (isset($results['directory']['processed'])) {
            $totalProcessed += $results['directory']['processed'];
        }
        if (isset($results['file']['processed'])) {
            $totalProcessed += $results['file']['processed'];
        }

        $estimated = max(0, $initialTotal - $totalProcessed);

        $this->writeLog('INFO', "Estimation: ~{$estimated} duplicate file_keys remaining (based on initial: {$initialTotal}, processed: {$totalProcessed})");

        return $estimated;
    }

    /**
     * Verify remaining duplicates with actual COUNT (SLOW on large tables).
     *
     * @deprecated Use estimateRemainingDuplicates() for better performance
     */
    public function verifyRemainingDuplicates(): int
    {
        $count = $this->repository->countRemainingDuplicates();
        $this->writeLog('INFO', "Verification: {$count} duplicate file_keys remaining");
        return $count;
    }

    /**
     * Detect and fix is_directory inconsistencies.
     */
    public function fixInconsistentDirectoryFlags(bool $dryRun = false): array
    {
        $inconsistentKeys = $this->repository->getInconsistentDirectoryFlags();

        if (empty($inconsistentKeys)) {
            $this->writeLog('INFO', 'No is_directory inconsistencies found');
            return [
                'total' => 0,
                'fixed' => 0,
            ];
        }

        $this->writeLog('WARNING', 'Found ' . count($inconsistentKeys) . ' file_keys with inconsistent is_directory values');

        $fixed = 0;
        foreach ($inconsistentKeys as $item) {
            $fileKey = $item['file_key'];
            $correctIsDirectory = $this->determineCorrectIsDirectory($fileKey);

            $this->writeLog(
                'INFO',
                "File key '{$fileKey}' has inconsistent is_directory values ({$item['is_directory_values']}), "
                . "correcting to {$correctIsDirectory} (records: {$item['record_count']})"
            );

            if (! $dryRun) {
                $updatedCount = $this->repository->fixDirectoryFlag($fileKey, $correctIsDirectory);
                $this->writeLog('INFO', "Updated {$updatedCount} records for '{$fileKey}'");
                ++$fixed;
            } else {
                $this->writeLog('INFO', "[DRY RUN] Would update records for '{$fileKey}' to is_directory={$correctIsDirectory}");
                ++$fixed;
            }
        }

        return [
            'total' => count($inconsistentKeys),
            'fixed' => $fixed,
        ];
    }

    /**
     * Process a single fully deleted file_key with pre-fetched records (optimized).
     */
    private function processFullyDeletedFileKeyWithRecords(string $fileKey, array $records, bool $dryRun): array
    {
        Db::beginTransaction();
        try {
            $fileIds = array_column($records, 'file_id');

            if (! $dryRun) {
                $this->repository->deleteRecords($fileIds);
            }

            // Log all deleted records
            foreach ($records as $record) {
                $this->logDeletion('deleted', 'delete_all', $record, null, $dryRun);
            }

            Db::commit();

            return ['deleted' => count($fileIds)];
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
    }

    /**
     * Process a single directory file_key with pre-fetched records (optimized).
     */
    private function processDirectoryFileKeyWithRecords(string $fileKey, array $records, bool $dryRun): array
    {
        Db::beginTransaction();
        try {
            $deletedCount = 0;
            $parentIdUpdatedCount = 0;
            $keptCount = 0;

            // Step 1: Delete soft deleted records first
            $softDeleted = array_filter($records, fn ($r) => $r['deleted_at'] !== null);
            if (! empty($softDeleted)) {
                $softDeletedIds = array_column($softDeleted, 'file_id');
                if (! $dryRun) {
                    $this->repository->deleteRecords($softDeletedIds);
                }
                foreach ($softDeleted as $record) {
                    $this->logDeletion('directory', 'delete_soft_deleted', $record, null, $dryRun);
                }
                $deletedCount += count($softDeletedIds);
                // Remove soft deleted from records
                $records = array_filter($records, fn ($r) => $r['deleted_at'] === null);
            }

            // Step 2: Handle remaining duplicates
            if (count($records) > 1) {
                $keptRecord = $records[0]; // First record is the one to keep (highest priority)
                $duplicates = array_slice($records, 1);

                $keptFileId = (int) $keptRecord['file_id'];
                $projectId = (int) $keptRecord['project_id'];
                $deletedFileIds = array_values(array_map(fn ($r) => (int) $r['file_id'], $duplicates));

                // Update parent_id references
                if (! $dryRun) {
                    $parentIdUpdatedCount = $this->repository->updateParentIdReferences(
                        $keptFileId,
                        $deletedFileIds,
                        $projectId
                    );
                }

                // Delete duplicate records
                if (! $dryRun && ! empty($deletedFileIds)) {
                    $this->repository->deleteRecords($deletedFileIds);
                }

                // Log kept record
                $this->logDeletion('directory', 'keep', $keptRecord, $keptFileId, $dryRun);
                $keptCount = 1;

                // Log deleted duplicates
                foreach ($duplicates as $record) {
                    $this->logDeletion('directory', 'delete_duplicate', $record, $keptFileId, $dryRun);
                }

                $deletedCount += count($deletedFileIds);

                // Log parent_id update
                if ($parentIdUpdatedCount > 0 || $dryRun) {
                    $this->logParentIdUpdate($fileKey, $keptFileId, $parentIdUpdatedCount, $projectId, $dryRun);
                }
            }

            Db::commit();

            return [
                'kept' => $keptCount,
                'deleted' => $deletedCount,
                'parent_id_updated' => $parentIdUpdatedCount,
            ];
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
    }

    /**
     * Process a single file file_key with pre-fetched records (optimized).
     * Enhanced with parent_id validation logic.
     */
    private function processFileFileKeyWithRecords(string $fileKey, array $records, bool $dryRun): array
    {
        Db::beginTransaction();
        try {
            $deletedCount = 0;
            $keptCount = 0;

            // Step 1: Delete soft deleted records first
            $softDeleted = array_filter($records, fn ($r) => $r['deleted_at'] !== null);
            if (! empty($softDeleted)) {
                $softDeletedIds = array_column($softDeleted, 'file_id');
                if (! $dryRun) {
                    $this->repository->deleteRecords($softDeletedIds);
                }
                foreach ($softDeleted as $record) {
                    $this->logDeletion('file', 'delete_soft_deleted', $record, null, $dryRun);
                }
                $deletedCount += count($softDeletedIds);
                // Remove soft deleted from records
                $records = array_filter($records, fn ($r) => $r['deleted_at'] === null);
            }

            // Step 2: Handle remaining duplicates
            if (count($records) > 1) {
                // Enhanced logic: Check parent_id consistency and validity
                $keptRecord = $this->selectRecordToKeepForFile($records, $fileKey);

                // Build list of records to delete (all except kept one)
                $duplicates = array_filter($records, fn ($r) => $r['file_id'] !== $keptRecord['file_id']);

                $keptFileId = (int) $keptRecord['file_id'];
                $deletedFileIds = array_values(array_map(fn ($r) => (int) $r['file_id'], $duplicates));

                // Delete duplicate records
                if (! $dryRun && ! empty($deletedFileIds)) {
                    $this->repository->deleteRecords($deletedFileIds);
                }

                // Log kept record
                $this->logDeletion('file', 'keep', $keptRecord, $keptFileId, $dryRun);
                $keptCount = 1;

                // Log deleted duplicates
                foreach ($duplicates as $record) {
                    $this->logDeletion('file', 'delete_duplicate', $record, $keptFileId, $dryRun);
                }

                $deletedCount += count($deletedFileIds);
            }

            Db::commit();

            return [
                'kept' => $keptCount,
                'deleted' => $deletedCount,
            ];
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
    }

    /**
     * Select the record to keep for file duplicates with parent_id validation.
     *
     * Rules:
     * 1. If all parent_ids are the same, keep the latest updated_at
     * 2. If parent_ids differ:
     *    2.1 Query which parent_ids exist in database
     *    2.2 If multiple parent_ids exist, keep the latest updated_at
     *    2.3 If only one parent_id exists, keep the latest updated_at
     *    2.4 If no parent_ids exist, keep the latest updated_at
     *
     * Summary: Always keep the latest updated_at, but log parent_id situation
     */
    private function selectRecordToKeepForFile(array $records, string $fileKey): array
    {
        // Collect all unique parent_ids
        $parentIds = array_unique(array_filter(array_column($records, 'parent_id'), fn ($id) => $id !== null));

        // Case 1: All parent_ids are the same (or all null)
        if (count($parentIds) <= 1) {
            // Sort by updated_at DESC to get the latest one
            usort($records, fn ($a, $b) => strcmp($b['updated_at'] ?? '', $a['updated_at'] ?? ''));

            $this->writeLog(
                'INFO',
                "File '{$fileKey}': All parent_ids are consistent (" . (empty($parentIds) ? 'NULL' : reset($parentIds)) . "), keeping latest updated record (file_id: {$records[0]['file_id']})"
            );

            return $records[0];
        }

        // Case 2: parent_ids are different, check which ones exist
        $existingParentIds = $this->checkParentIdsExist(array_values($parentIds));
        $existingCount = count($existingParentIds);

        // Filter records based on parent_id existence
        if ($existingCount > 0) {
            // Case 2.1 & 2.2: If any parent_ids exist, filter records to only keep those with existing parent_ids
            $recordsWithExistingParent = array_filter(
                $records,
                fn ($r) => in_array($r['parent_id'], $existingParentIds)
            );

            if (! empty($recordsWithExistingParent)) {
                // Sort filtered records by updated_at DESC
                usort($recordsWithExistingParent, fn ($a, $b) => strcmp($b['updated_at'] ?? '', $a['updated_at'] ?? ''));
                $selectedRecord = $recordsWithExistingParent[0];

                if ($existingCount > 1) {
                    $this->writeLog(
                        'INFO',
                        "File '{$fileKey}': Multiple parent_ids exist (" . implode(', ', $existingParentIds) . "), filtered to records with existing parent_id, keeping latest updated record (file_id: {$selectedRecord['file_id']}, parent_id: {$selectedRecord['parent_id']})"
                    );
                } else {
                    $this->writeLog(
                        'INFO',
                        "File '{$fileKey}': Only one parent_id exists (" . $existingParentIds[0] . "), filtered to records with existing parent_id, keeping latest updated record (file_id: {$selectedRecord['file_id']}, parent_id: {$selectedRecord['parent_id']})"
                    );
                }

                return $selectedRecord;
            }
        }

        // Case 2.3: No parent_ids exist, or filtered result is empty
        // Fall back to selecting from all records
        usort($records, fn ($a, $b) => strcmp($b['updated_at'] ?? '', $a['updated_at'] ?? ''));
        $selectedRecord = $records[0];

        $this->writeLog(
            'WARNING',
            "File '{$fileKey}': No parent_ids exist in database, keeping latest updated record from all records (file_id: {$selectedRecord['file_id']}, parent_id: {$selectedRecord['parent_id']})"
        );

        return $selectedRecord;
    }

    /**
     * Check which parent_ids exist in the database.
     *
     * @param array $parentIds Array of parent_id values to check
     * @return array Array of parent_ids that exist
     */
    private function checkParentIdsExist(array $parentIds): array
    {
        if (empty($parentIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($parentIds), '?'));

        $results = Db::select(
            "SELECT DISTINCT file_id 
            FROM magic_super_agent_task_files 
            WHERE file_id IN ({$placeholders})
              AND deleted_at IS NULL",
            $parentIds
        );

        return array_column($results, 'file_id');
    }

    /**
     * Determine correct is_directory value based on file_key pattern.
     *
     * Rules:
     * - No extension (e.g., "xx/a" or "xx/a/") → Directory (1)
     * - Has extension (e.g., "xx/a.txt") → File (0)
     */
    private function determineCorrectIsDirectory(string $fileKey): int
    {
        // Remove trailing slash if exists
        $fileKey = rtrim($fileKey, '/');

        // Get the last part after the last slash
        $lastPart = basename($fileKey);

        // Check if it has a file extension
        // A file extension is a dot followed by 1-10 alphanumeric characters
        if (preg_match('/\.[a-zA-Z0-9]{1,10}$/', $lastPart)) {
            return 0; // File
        }

        return 1; // Directory
    }

    /**
     * Log a deletion action to CSV.
     */
    private function logDeletion(string $stage, string $action, array $record, ?int $keptFileId, bool $dryRun): void
    {
        if (! $this->csvFileHandle) {
            return;
        }

        $row = [
            date('Y-m-d H:i:s'),
            $stage,
            $dryRun ? "[DRY-RUN] {$action}" : $action,
            $record['file_key'] ?? '',
            $record['file_id'] ?? '',
            $keptFileId ?? '',
            $record['file_name'] ?? '',
            $record['is_directory'] ?? '',
            $record['project_id'] ?? '',
            $record['topic_id'] ?? '',
            $record['parent_id'] ?? '',
            $record['deleted_at'] ?? '',
            '',
        ];

        fputcsv($this->csvFileHandle, $row);
    }

    /**
     * Log a parent_id update action to CSV.
     */
    private function logParentIdUpdate(string $fileKey, int $keptFileId, int $updatedCount, int $projectId, bool $dryRun): void
    {
        if (! $this->csvFileHandle) {
            return;
        }

        $message = $dryRun
            ? "[DRY-RUN] Would update {$updatedCount} children"
            : "Updated {$updatedCount} children";

        $row = [
            date('Y-m-d H:i:s'),
            'directory',
            $dryRun ? '[DRY-RUN] update_parent_id' : 'update_parent_id',
            $fileKey,
            '',
            $keptFileId,
            '',
            '',
            $projectId,
            '',
            '',
            '',
            $message,
        ];

        fputcsv($this->csvFileHandle, $row);
    }

    /**
     * Log an error to CSV.
     */
    private function logError(string $stage, string $fileKey, string $errorMessage): void
    {
        if (! $this->csvFileHandle) {
            return;
        }

        $row = [
            date('Y-m-d H:i:s'),
            $stage,
            'error',
            $fileKey,
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            $errorMessage,
        ];

        fputcsv($this->csvFileHandle, $row);

        $this->logger->error("Error processing file_key '{$fileKey}': {$errorMessage}");
    }

    /**
     * Write a log message to the execution log file.
     */
    private function writeLog(string $level, string $message): void
    {
        if (! empty($this->logFilePath)) {
            $timestamp = date('Y-m-d H:i:s');
            $logLine = "[{$timestamp}] {$level}: {$message}\n";
            file_put_contents($this->logFilePath, $logLine, FILE_APPEND);
        }

        // Also log to Hyperf logger
        $logMethod = strtolower($level);
        if (method_exists($this->logger, $logMethod)) {
            $this->logger->{$logMethod}($message);
        }
    }
}

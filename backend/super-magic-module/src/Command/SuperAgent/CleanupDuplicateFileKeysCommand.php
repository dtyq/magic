<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Command\SuperAgent;

use Dtyq\SuperMagic\Domain\SuperAgent\Service\FileKeyCleanupDomainService;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class CleanupDuplicateFileKeysCommand extends HyperfCommand
{
    protected ?string $name = 'super-agent:cleanup-duplicate-file-keys';

    protected LoggerInterface $logger;

    public function __construct(
        protected FileKeyCleanupDomainService $cleanupService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('cleanup-duplicate-file-keys');
        parent::__construct();
    }

    public function configure()
    {
        parent::configure();
        $this->setDescription('Cleanup duplicate file_keys in magic_super_agent_task_files table');

        $this->addOption(
            'stage',
            null,
            InputOption::VALUE_OPTIONAL,
            'Processing stage: all, deleted, directory, file',
            'all'
        );

        $this->addOption(
            'batch-size',
            null,
            InputOption::VALUE_OPTIONAL,
            'Batch size for processing file_keys',
            50
        );

        $this->addOption(
            'dry-run',
            null,
            InputOption::VALUE_NONE,
            'Dry run mode - show what would be deleted without actually deleting'
        );

        $this->addOption(
            'continue-from',
            null,
            InputOption::VALUE_OPTIONAL,
            'Continue from offset (for resume)',
            0
        );

        $this->addOption(
            'force',
            null,
            InputOption::VALUE_NONE,
            'Skip confirmation prompt'
        );

        $this->addOption(
            'project-id',
            null,
            InputOption::VALUE_OPTIONAL,
            'Filter by specific project ID',
            null
        );

        $this->addOption(
            'file-key',
            null,
            InputOption::VALUE_OPTIONAL,
            'Process only a specific file_key',
            null
        );
    }

    public function handle()
    {
        $stage = $this->input->getOption('stage');
        $batchSize = (int) $this->input->getOption('batch-size');
        $dryRun = (bool) $this->input->getOption('dry-run');
        $force = (bool) $this->input->getOption('force');
        $projectId = $this->input->getOption('project-id') ? (int) $this->input->getOption('project-id') : null;
        $fileKey = $this->input->getOption('file-key');

        $this->line('');
        $this->line('🚀 <fg=cyan>Starting file_key cleanup process...</>');
        $this->line('');

        if ($dryRun) {
            $this->warn('⚠️  DRY-RUN MODE: No data will be actually deleted');
            $this->line('');
        }

        // Display filter information
        if ($projectId !== null) {
            $this->info("🔍 Filter: Project ID = {$projectId}");
            $this->line('');
        }

        if ($fileKey !== null) {
            $this->info("🔍 Filter: File Key = {$fileKey}");
            $this->line('');
        }

        try {
            // Initialize log files
            $this->cleanupService->initializeLogFiles();

            $startTime = microtime(true);

            // Stage 0: Data analysis
            $this->displayStageHeader('Stage 0: Data Analysis');
            $stats = $this->cleanupService->getStatistics($projectId, $fileKey);

            $this->info("  Fully deleted file_keys: {$stats['deleted']}");
            $this->info("  Duplicate directory file_keys: {$stats['directory']}");
            $this->info("  Duplicate file file_keys: {$stats['file']}");

            $totalFileKeys = $stats['deleted'] + $stats['directory'] + $stats['file'];
            $this->info("  Total file_keys to process: {$totalFileKeys}");

            $estimatedMinutes = (int) ceil($totalFileKeys / ($batchSize * 10)); // Rough estimate
            $this->info("  Estimated time: ~{$estimatedMinutes} minute(s)");
            $this->line('');

            if ($totalFileKeys === 0) {
                $this->info('✅ No duplicate file_keys found. Nothing to process.');
                $this->cleanupService->closeLogFiles();
                return 0;
            }

            // Confirmation prompt
            if (! $dryRun && ! $force) {
                if (! $this->confirm('Do you want to continue?', true)) {
                    $this->warn('❌ Operation cancelled by user.');
                    $this->cleanupService->closeLogFiles();
                    return 0;
                }
                $this->line('');
            }

            $results = [];

            // Stage 1: Process fully deleted
            if (in_array($stage, ['all', 'deleted'])) {
                if ($stats['deleted'] > 0) {
                    $this->displayStageHeader('Stage 1: Cleaning up fully deleted file_keys');
                    $results['deleted'] = $this->cleanupService->processFullyDeleted($batchSize, $dryRun, $projectId, $fileKey);
                    $this->displayStageResults($results['deleted']);
                } else {
                    $this->info('Stage 1: No fully deleted file_keys to process. Skipping.');
                    $this->line('');
                }
            }

            // Stage 2: Process directory duplicates
            if (in_array($stage, ['all', 'directory'])) {
                if ($stats['directory'] > 0) {
                    $this->displayStageHeader('Stage 2: Cleaning up directory duplicates');
                    $results['directory'] = $this->cleanupService->processDirectoryDuplicates($batchSize, $dryRun, $projectId, $fileKey);
                    $this->displayStageResults($results['directory']);
                } else {
                    $this->info('Stage 2: No duplicate directory file_keys to process. Skipping.');
                    $this->line('');
                }
            }

            // Stage 3: Process file duplicates
            if (in_array($stage, ['all', 'file'])) {
                if ($stats['file'] > 0) {
                    $this->displayStageHeader('Stage 3: Cleaning up file duplicates');
                    $results['file'] = $this->cleanupService->processFileDuplicates($batchSize, $dryRun, $projectId, $fileKey);
                    $this->displayStageResults($results['file']);
                } else {
                    $this->info('Stage 3: No duplicate file file_keys to process. Skipping.');
                    $this->line('');
                }
            }

            // Stage 4: Verification and Fixes
            $this->displayStageHeader('Stage 4: Verification and Fixes');
            
            // Step 4.1: Check and fix is_directory inconsistencies
            $this->info('  🔍 Checking for is_directory inconsistencies...');
            $fixResults = $this->cleanupService->fixInconsistentDirectoryFlags($dryRun);
            
            if ($fixResults['total'] > 0) {
                if ($dryRun) {
                    $this->warn("  ⚠️  Found {$fixResults['total']} file_keys with inconsistent is_directory values");
                    $this->info("  💡 Run without --dry-run to fix these automatically");
                } else {
                    $this->info("  ✅ Fixed {$fixResults['fixed']} file_keys with inconsistent is_directory values");
                }
            } else {
                $this->info('  ✅ No is_directory inconsistencies found');
            }
            $this->line('');
            
            // Step 4.2: Check remaining duplicates
            $this->info('  🔍 Checking for remaining duplicates...');
            $remainingDuplicates = $this->cleanupService->verifyRemainingDuplicates();

            if ($remainingDuplicates === 0) {
                $this->info('  ✅ All duplicates have been cleaned up successfully!');
            } else {
                $this->warn("  ⚠️  {$remainingDuplicates} duplicate file_keys still remaining");
                if ($fixResults['total'] > 0 && !$dryRun) {
                    $this->info("  💡 is_directory values were corrected. Re-run cleanup to process the corrected records.");
                }
            }
            $this->line('');

            // Summary
            $endTime = microtime(true);
            $executionTime = $endTime - $startTime;
            $this->displaySummary($results, $executionTime, $dryRun);

            // Display log file paths
            $this->line('');
            $this->info('📝 Log files:');
            $this->info("  CSV log: {$this->cleanupService->getCsvFilePath()}");
            $this->info("  Execution log: {$this->cleanupService->getLogFilePath()}");
            $this->line('');

            if ($dryRun) {
                $this->warn('⚠️  This was a DRY-RUN. No data was actually deleted.');
                $this->info('💡 Run without --dry-run to perform actual cleanup.');
            } else {
                $this->info('✅ Cleanup process completed successfully!');
            }

            $this->cleanupService->closeLogFiles();

            return 0;
        } catch (Throwable $e) {
            $this->error('');
            $this->error('❌ Cleanup process failed with error:');
            $this->error("   {$e->getMessage()}");
            $this->error('');
            $this->error('Stack trace:');
            $this->error($e->getTraceAsString());
            $this->error('');

            $this->logger->error('Cleanup process failed', [
                'exception' => $e,
                'stage' => $stage,
                'batch_size' => $batchSize,
                'dry_run' => $dryRun,
            ]);

            $this->cleanupService->closeLogFiles();

            return 1;
        }
    }

    /**
     * Display stage header.
     */
    private function displayStageHeader(string $title): void
    {
        $this->line('');
        $this->line("<fg=yellow>=== {$title} ===</>");
        $this->line('');
    }

    /**
     * Display stage results.
     */
    private function displayStageResults(array $results): void
    {
        $this->info('  Results:');
        $this->info("    Processed: {$results['processed']} file_keys");

        if (isset($results['kept'])) {
            $this->info("    Kept: {$results['kept']} records");
        }

        if (isset($results['deleted'])) {
            $this->info("    Deleted: {$results['deleted']} records");
        }

        if (isset($results['parent_id_updated'])) {
            $this->info("    Updated parent_id: {$results['parent_id_updated']} records");
        }

        if (isset($results['errors']) && $results['errors'] > 0) {
            $this->warn("    Errors: {$results['errors']}");
        } else {
            $this->info('    Errors: 0');
        }

        $this->line('');
    }

    /**
     * Display summary.
     */
    private function displaySummary(array $results, float $executionTime, bool $dryRun): void
    {
        $this->line('');
        $this->line('<fg=cyan>=== Summary ===>');
        $this->line('');

        $minutes = (int) floor($executionTime / 60);
        $seconds = (int) ($executionTime % 60);
        $timeStr = $minutes > 0 ? "{$minutes}m {$seconds}s" : "{$seconds}s";

        $this->info("  Execution time: {$timeStr}");

        $totalProcessed = 0;
        $totalDeleted = 0;
        $totalParentIdUpdated = 0;
        $totalErrors = 0;

        foreach ($results as $stage => $result) {
            $totalProcessed += $result['processed'] ?? 0;
            $totalDeleted += $result['deleted'] ?? 0;
            $totalParentIdUpdated += $result['parent_id_updated'] ?? 0;
            $totalErrors += $result['errors'] ?? 0;
        }

        $this->info("  Total file_keys processed: {$totalProcessed}");
        $this->info("  Total records deleted: {$totalDeleted}");

        if ($totalParentIdUpdated > 0) {
            $this->info("  Total parent_id updated: {$totalParentIdUpdated}");
        }

        if ($totalErrors > 0) {
            $this->warn("  Total errors: {$totalErrors}");
        } else {
            $this->info('  Total errors: 0');
        }

        if ($dryRun) {
            $this->line('');
            $this->warn('  ⚠️  DRY-RUN MODE - No data was actually modified');
        }
    }
}


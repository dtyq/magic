<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileBatchCopyEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Infrastructure\Utils\FileBatchOperationStatusManager;
use Dtyq\SuperMagic\Infrastructure\Utils\FileTreeUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TaskFileItemDTO;
use Hyperf\Amqp\Annotation\Consumer;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Amqp\Result;
use Hyperf\Logger\LoggerFactory;
use PhpAmqpLib\Message\AMQPMessage;
use PhpAmqpLib\Wire\AMQPTable;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * File batch copy operation subscriber.
 *
 * Handles asynchronous batch file copy operations when dealing with multiple files.
 */
#[Consumer(
    exchange: 'super_magic_file_batch_copy',
    routingKey: 'super_magic_file_batch_copy',
    queue: 'super_magic_file_batch_copy',
    nums: 1
)]
class FileBatchCopySubscriber extends ConsumerMessage
{
    /**
     * @var AMQPTable|array queue arguments for setting priority etc
     */
    protected AMQPTable|array $queueArguments = [];

    /**
     * @var null|array qoS configuration for controlling prefetch count etc
     */
    protected ?array $qos = [
        'prefetch_count' => 1, // Prefetch only 1 message at a time
        'prefetch_size' => 0,
        'global' => false,
    ];

    private LoggerInterface $logger;

    /**
     * @var TaskFileEntity[]
     */
    private array $fileEntitiesCache = [];

    /**
     * Progress tracking properties.
     */
    private string $currentBatchKey = '';

    private int $totalTopLevelFiles = 0;

    private int $processedTopLevelFiles = 0;

    /**
     * Constructor.
     */
    public function __construct(
        private readonly ProjectDomainService $projectDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly FileBatchOperationStatusManager $statusManager,
        private readonly LockerInterface $locker,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('FileBatchCopy');
    }

    /**
     * Consume batch copy event message.
     *
     * Entry point that handles parameter parsing, duplicate processing check,
     * mutex lock acquisition, and delegates to business logic.
     *
     * @param array $data Event data containing batch copy parameters
     * @param AMQPMessage $message AMQP message
     * @return Result Processing result
     */
    public function consumeMessage($data, AMQPMessage $message): Result
    {
        $batchKey = '';
        $lockKey = '';
        $lockOwner = '';
        $lockAcquired = false;

        try {
            // Step 1: Parse and validate event data
            $event = FileBatchCopyEvent::fromArray($data);
            $batchKey = $event->getBatchKey();

            $this->logger->info('Received file batch copy event', [
                'batch_key' => $batchKey,
                'file_ids' => $event->getFileIds(),
                'target_parent_id' => $event->getTargetParentId(),
                'file_count' => count($event->getFileIds()),
            ]);

            // Step 2: Validate required parameters
            if (empty($batchKey) || empty($event->getUserId()) || empty($event->getFileIds()) || ! $event->getProjectId()) {
                $this->logger->error('Invalid batch copy event data: missing required parameters', [
                    'batch_key' => $batchKey,
                    'user_id' => $event->getUserId(),
                    'file_ids' => $event->getFileIds(),
                    'project_id' => $event->getProjectId(),
                ]);

                if (! empty($batchKey)) {
                    $this->statusManager->setTaskFailed($batchKey, 'Invalid batch copy event data: missing required parameters');
                }
                return Result::ACK;
            }

            // Step 3: Check if task is already completed or in progress
            if ($this->isTaskAlreadyProcessed($batchKey)) {
                $this->logger->info('Batch copy task already processed, skipping', [
                    'batch_key' => $batchKey,
                ]);
                return Result::ACK;
            }

            // Step 4: Acquire mutex lock to prevent concurrent processing
            [$lockAcquired, $lockKey, $lockOwner] = $this->acquireBatchCopyLock($batchKey);
            if (! $lockAcquired) {
                $this->logger->warning('Failed to acquire lock for batch copy, another process may be handling it', [
                    'batch_key' => $batchKey,
                ]);
                return Result::ACK;
            }

            $this->logger->info('Acquired lock for batch copy processing', [
                'batch_key' => $batchKey,
                'lock_key' => $lockKey,
            ]);

            // Step 5: Double-check task status after acquiring lock
            // This is intentional double-checked locking pattern: another process
            // could have completed the task while we were waiting for the lock
            /* @phpstan-ignore-next-line if.alwaysFalse */
            if ($this->isTaskAlreadyProcessed($batchKey)) {
                $this->logger->info('Batch copy task already processed after lock acquisition, skipping', [
                    'batch_key' => $batchKey,
                ]);
                return Result::ACK;
            }

            // Step 6: Delegate to business logic
            $this->processBatchCopyBusinessLogic($event);

            return Result::ACK;
        } catch (Throwable $e) {
            $this->logger->error('Failed to process file batch copy event', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'data' => $data,
                'batch_key' => $batchKey,
            ]);

            // Mark task as failed if we have batch key
            if (! empty($batchKey)) {
                $this->statusManager->setTaskFailed($batchKey, $e->getMessage());
            }

            // Return ACK to avoid retrying failed message
            return Result::ACK;
        } finally {
            // Always release lock
            if ($lockAcquired && ! empty($lockKey)) {
                $this->releaseBatchCopyLock($lockKey, $lockOwner);
                $this->logger->info('Released lock for batch copy processing', [
                    'batch_key' => $batchKey,
                    'lock_key' => $lockKey,
                ]);
            }
        }
    }

    /**
     * Copy file (recursive for directories).
     */
    public function copyFile(
        DataIsolation $dataIsolation,
        array $node,
        ProjectEntity $sourceProject,
        ProjectEntity $targetProject,
        string $parentDir,
        TaskFileEntity $targetParentEntity,
        array $keepBothFileIds = []
    ) {
        try {
            // Extract file information from node
            $fileId = (int) ($node['file_id'] ?? 0);
            $oldFileKey = $node['file_key'] ?? '';
            $fileName = $node['file_name'] ?? '';
            $isDirectory = $node['is_directory'] ?? false;
            $children = $node['children'] ?? [];

            if ($fileId <= 0 || empty($oldFileKey) || empty($fileName)) {
                $this->logger->warning('Invalid file node data', ['node' => $node]);
                return;
            }

            // Calculate target file key
            $newFileKey = $this->calculateNewFileKey($oldFileKey, $fileName, $parentDir, $isDirectory);
            $targetEntity = $this->taskFileDomainService->getByFileKey($newFileKey);

            if ($isDirectory) {
                $newTargetEntity = $this->handleDirectory(
                    $node,
                    $sourceProject,
                    $targetProject,
                    $targetParentEntity->getFileId(),
                    $newFileKey,
                    $targetEntity
                );
                if (! empty($children)) {
                    // For children, the parent directory should be the new location of this file/directory
                    $newParentDir = $newFileKey;
                    foreach ($children as $child) {
                        $this->copyFile($dataIsolation, $child, $sourceProject, $targetProject, $newParentDir, $newTargetEntity, $keepBothFileIds);
                    }
                }
            } else {
                // Get file entity
                $fileEntity = $this->getFileEntityForCache($fileId);
                $sourceFileIdStr = (string) $fileId;

                // Always use copyProjectFile which handles conflict resolution
                $this->taskFileDomainService->copyProjectFile(
                    $dataIsolation,
                    $fileEntity,
                    $sourceProject,
                    $targetProject,
                    $targetParentEntity->getFileId(),
                    $keepBothFileIds
                );
            }

            $this->logger->info('Copying file in batch operation', [
                'file_id' => $fileId,
                'old_file_key' => $oldFileKey,
                'new_file_key' => $newFileKey,
                'parent_dir' => $parentDir,
                'source_project' => $sourceProject->getId(),
                'target_project' => $targetProject->getId(),
            ]);
        } catch (Throwable $e) {
            $this->logger->error('Failed to copy file in batch operation', [
                'node' => $node,
                'source_project' => $sourceProject->getId(),
                'target_project' => $targetProject->getId(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    /**
     * Handle directory copy - always create new directory (never delete source).
     */
    private function handleDirectory(
        array $file,
        ProjectEntity $sourceProject,
        ProjectEntity $targetProject,
        int $parentId,
        string $newFileKey,
        ?TaskFileEntity $targetFileEntity
    ): TaskFileEntity {
        $oldFileEntity = $this->getFileEntityForCache((int) $file['file_id']);

        // If target directory exists, reuse it (for copy operation, we don't delete source)
        if (! empty($targetFileEntity) && ($file['file_key'] !== $newFileKey)) {
            return $targetFileEntity;
        }

        // Always create new directory for copy operation
        return $this->taskFileDomainService->createFolderFromFileEntity(
            $oldFileEntity,
            $parentId,
            $newFileKey,
            $targetProject->getWorkDir(),
            $targetProject->getId(),
            $targetProject->getUserOrganizationCode()
        );
    }

    private function getFileEntityForCache(int $fileId): ?TaskFileEntity
    {
        if (isset($this->fileEntitiesCache[$fileId])) {
            return $this->fileEntitiesCache[$fileId];
        }
        return $this->taskFileDomainService->getById($fileId);
    }

    /**
     * Calculate new file key based on target parent path.
     */
    private function calculateNewFileKey(string $oldFileKey, string $fileName, string $targetParentKey, bool $isDirectory): string
    {
        // Ensure target parent key ends with /
        $targetParentKey = rtrim($targetParentKey, '/') . '/';

        // Generate new file key
        $newFileKey = $targetParentKey . $fileName;

        // For directories, ensure it ends with /
        if ($isDirectory) {
            $newFileKey = rtrim($newFileKey, '/') . '/';
        }

        return $newFileKey;
    }

    /**
     * Process the main business logic for batch file copy.
     *
     * @param FileBatchCopyEvent $event Batch copy event
     * @throws Throwable
     */
    private function processBatchCopyBusinessLogic(FileBatchCopyEvent $event): void
    {
        // Extract parameters from event
        $batchKey = $event->getBatchKey();
        $userId = $event->getUserId();
        $organizationCode = $event->getOrganizationCode();
        $fileIds = $event->getFileIds();
        $sourceProjectId = $event->getSourceProjectId();
        $targetProjectId = $event->getTargetProjectId();
        $preFileId = $event->getPreFileId();
        $targetParentId = $event->getTargetParentId();
        $keepBothFileIds = $event->getKeepBothFileIds();

        // Initialize progress tracking
        $this->currentBatchKey = $batchKey;

        $this->logger->info('Processing batch copy business logic', [
            'batch_key' => $batchKey,
            'user_id' => $userId,
            'organization_code' => $organizationCode,
            'file_ids' => $fileIds,
            'source_project_id' => $sourceProjectId,
            'target_project_id' => $targetProjectId,
            'pre_file_id' => $preFileId,
            'target_parent_id' => $targetParentId,
            'keep_both_file_ids' => $keepBothFileIds,
            'file_count' => count($fileIds),
        ]);

        // Set task progress to started (0%)
        $this->statusManager->setTaskProgress($batchKey, 0, count($fileIds), 'Starting batch file copy process');

        // Create data isolation
        $dataIsolation = DataIsolation::simpleMake($organizationCode, $userId);

        // Preparation phase (5%)
        $this->updateProgress(5, 'Loading and preparing file entities');

        // Get source and target projects
        $sourceProject = $this->projectDomainService->getProjectNotUserId($sourceProjectId);
        $targetProject = $this->projectDomainService->getProjectNotUserId($targetProjectId);

        $this->logger->info('Batch copy project context', [
            'source_project_id' => $sourceProjectId,
            'target_project_id' => $targetProjectId,
            'source_org' => $sourceProject->getUserOrganizationCode(),
            'target_org' => $targetProject->getUserOrganizationCode(),
            'is_cross_project' => $sourceProjectId !== $targetProjectId,
            'is_cross_organization' => $sourceProject->getUserOrganizationCode() !== $targetProject->getUserOrganizationCode(),
        ]);

        // Get file entities by IDs
        $fileEntities = $this->taskFileDomainService->getProjectFilesByIds($sourceProjectId, $fileIds);

        // Build hierarchical structure
        $projectEntity = $sourceProject;
        $files = [];
        $fileDebugArr = [];
        foreach ($fileEntities as $fileEntity) {
            // set cache
            $this->fileEntitiesCache[$fileEntity->getFileId()] = $fileEntity;
            $files[] = TaskFileItemDTO::fromEntity($fileEntity, $projectEntity->getWorkDir())->toArray();
            $fileDebugArr[] = [
                'id' => $fileEntity->getFileId(),
                'key' => $fileEntity->getFileKey(),
                'p_id' => $fileEntity->getParentId(),
            ];
        }
        $fileTree = FileTreeUtil::assembleFilesTreeByParentId($files);
        $this->logger->info(sprintf('recordOldFile, %s', $batchKey), ['data' => $fileDebugArr]);

        // File copying phase (10% - 90%)
        $this->updateProgress(10, 'Starting file copy operations');
        $this->copyFileByTree($dataIsolation, $fileTree, $sourceProject, $targetProject, $targetParentId, $keepBothFileIds);

        // Rebalancing phase (90% - 95%)
        $this->updateProgress(90, 'Rebalancing directory sort order');
        $this->taskFileDomainService->rebalanceAndCalculateSort($targetParentId, $preFileId);

        // Finalizing (95% - 100%)
        $this->updateProgress(95, 'Finalizing batch file copy operation');

        // Mark as completed
        $this->statusManager->setTaskCompleted($batchKey, [
            'file_ids' => $fileIds,
            'target_parent_id' => $targetParentId,
            'operation' => 'batch_copy',
            'message' => 'Batch file copy completed successfully',
            'file_count' => count($fileIds),
        ]);

        $this->logger->info('File batch copy business logic completed successfully', [
            'batch_key' => $batchKey,
            'file_count' => count($fileIds),
        ]);
    }

    private function copyFileByTree(
        DataIsolation $dataIsolation,
        array $fileTree,
        ProjectEntity $sourceProject,
        ProjectEntity $targetProject,
        int $targetParentId,
        array $keepBothFileIds = []
    ) {
        $targetParentEntity = $this->taskFileDomainService->getById($targetParentId);

        // For top-level files in the tree, the parent directory should be the target location
        $targetParentDir = $targetParentEntity->getFileKey();

        // Initialize progress tracking - simple count of file tree
        $this->totalTopLevelFiles = count($fileTree);
        $this->processedTopLevelFiles = 0;

        foreach ($fileTree as $node) {
            if (empty($node['file_id']) || $node['parent_id'] === $targetParentId) {
                continue;
            }

            // For top-level nodes, use target parent directory
            $this->copyFile($dataIsolation, $node, $sourceProject, $targetProject, $targetParentDir, $targetParentEntity, $keepBothFileIds);

            // Update progress after each file copy
            ++$this->processedTopLevelFiles;
            $this->updateFileCopyingProgress();
        }
    }

    /**
     * Check if the batch copy task is already processed or in progress.
     *
     * @param string $batchKey Batch key to check
     * @return bool True if already processed, false otherwise
     */
    private function isTaskAlreadyProcessed(string $batchKey): bool
    {
        try {
            $status = $this->statusManager->getTaskStatus($batchKey);

            // Check if task is completed or failed
            if (! empty($status) && in_array($status['status'] ?? '', ['completed', 'failed'])) {
                return true;
            }

            return false;
        } catch (Throwable $e) {
            $this->logger->warning('Failed to check task status, assuming not processed', [
                'batch_key' => $batchKey,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Acquire mutex lock for batch copy operation.
     *
     * @param string $batchKey Batch key for locking
     * @return array [bool $acquired, string $lockKey, string $lockOwner]
     */
    private function acquireBatchCopyLock(string $batchKey): array
    {
        $lockKey = "batch_copy_lock:{$batchKey}";
        $lockOwner = uniqid('batch_copy_', true);
        $lockTtl = 300; // 5 minutes

        try {
            $acquired = $this->locker->mutexLock($lockKey, $lockOwner, $lockTtl);
            return [$acquired, $lockKey, $lockOwner];
        } catch (Throwable $e) {
            $this->logger->error('Failed to acquire batch copy lock', [
                'batch_key' => $batchKey,
                'lock_key' => $lockKey,
                'error' => $e->getMessage(),
            ]);
            return [false, '', ''];
        }
    }

    /**
     * Release mutex lock for batch copy operation.
     *
     * @param string $lockKey Lock key to release
     * @param string $lockOwner Lock owner for verification
     */
    private function releaseBatchCopyLock(string $lockKey, string $lockOwner): void
    {
        try {
            $this->locker->release($lockKey, $lockOwner);
        } catch (Throwable $e) {
            $this->logger->warning('Failed to release batch copy lock', [
                'lock_key' => $lockKey,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Update progress with specific percentage and message.
     */
    private function updateProgress(int $percentage, string $message): void
    {
        if (empty($this->currentBatchKey)) {
            return;
        }

        try {
            // Use a reasonable count based on total files for consistent progress display
            $totalCount = $this->totalTopLevelFiles > 0 ? $this->totalTopLevelFiles : 1;
            $completedCount = (int) (($percentage / 100) * $totalCount);

            $this->statusManager->setTaskProgress(
                $this->currentBatchKey,
                $completedCount,
                $totalCount,
                $message
            );

            $this->logger->info('Progress updated', [
                'batch_key' => $this->currentBatchKey,
                'percentage' => $percentage,
                'message' => $message,
            ]);
        } catch (Throwable $e) {
            $this->logger->warning('Failed to update progress', [
                'batch_key' => $this->currentBatchKey,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Update progress during file copying phase (10%-90%).
     */
    private function updateFileCopyingProgress(): void
    {
        if ($this->totalTopLevelFiles <= 0 || empty($this->currentBatchKey)) {
            return;
        }

        try {
            // File copying phase occupies 10%-90%, total 80% progress
            $copyProgress = 10 + (80 * ($this->processedTopLevelFiles / $this->totalTopLevelFiles));
            $percentage = (int) $copyProgress;

            $message = "Copying files ({$this->processedTopLevelFiles}/{$this->totalTopLevelFiles})";

            $this->statusManager->setTaskProgress(
                $this->currentBatchKey,
                $this->processedTopLevelFiles,
                $this->totalTopLevelFiles,
                $message
            );

            $this->logger->info('File copying progress updated', [
                'batch_key' => $this->currentBatchKey,
                'processed' => $this->processedTopLevelFiles,
                'total' => $this->totalTopLevelFiles,
                'percentage' => $percentage,
                'message' => $message,
            ]);
        } catch (Throwable $e) {
            $this->logger->warning('Failed to update file copying progress', [
                'batch_key' => $this->currentBatchKey,
                'error' => $e->getMessage(),
            ]);
        }
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\MagicFS\Service\MagicFSFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\ProjectFileConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\AttachmentsProcessedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\DirectoryDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileBatchMoveEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDisplayConfigDomainService;
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
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

/**
 * File batch move operation subscriber.
 *
 * Handles asynchronous batch file move operations when dealing with multiple files.
 */
#[Consumer(
    exchange: 'super_magic_file_batch_move',
    routingKey: 'super_magic_file_batch_move',
    queue: 'super_magic_file_batch_move',
    nums: 1
)]
class FileBatchMoveSubscriber extends ConsumerMessage
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

    /** Total number of all files (including nested) to be moved in the current batch. */
    private int $totalFiles = 0;

    /** Number of individual files (non-directories) successfully moved so far. */
    private int $processedFiles = 0;

    /**
     * Constructor.
     */
    public function __construct(
        private readonly ProjectDomainService $projectDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly MagicFSFileDomainService $magicFSFileDomainService,
        private readonly FileBatchOperationStatusManager $statusManager,
        private readonly EventDispatcherInterface $eventDispatcher,
        private readonly LockerInterface $locker,
        private readonly ProjectDisplayConfigDomainService $projectDisplayConfigDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('FileBatchMove');
    }

    /**
     * Consume batch move event message.
     *
     * Entry point that handles parameter parsing, duplicate processing check,
     * mutex lock acquisition, and delegates to business logic.
     *
     * @param array $data Event data containing batch move parameters
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
            $event = FileBatchMoveEvent::fromArray($data);
            $batchKey = $event->getBatchKey();

            $this->logger->info('Received file batch move event', [
                'batch_key' => $batchKey,
                'file_ids' => $event->getFileIds(),
                'target_parent_id' => $event->getTargetParentId(),
                'file_count' => count($event->getFileIds()),
            ]);

            // Step 2: Validate required parameters
            if (empty($batchKey) || empty($event->getUserId()) || empty($event->getFileIds()) || ! $event->getProjectId()) {
                $this->logger->error('Invalid batch move event data: missing required parameters', [
                    'batch_key' => $batchKey,
                    'user_id' => $event->getUserId(),
                    'file_ids' => $event->getFileIds(),
                    'project_id' => $event->getProjectId(),
                ]);

                if (! empty($batchKey)) {
                    $this->statusManager->setTaskFailed($batchKey, 'Invalid batch move event data: missing required parameters');
                }
                return Result::ACK;
            }

            // Step 3: Check if task is already completed or in progress
            if ($this->isTaskAlreadyProcessed($batchKey)) {
                $this->logger->info('Batch move task already processed, skipping', [
                    'batch_key' => $batchKey,
                ]);
                return Result::ACK;
            }

            // Step 4: Acquire mutex lock to prevent concurrent processing
            [$lockAcquired, $lockKey, $lockOwner] = $this->acquireBatchMoveLock($batchKey);
            if (! $lockAcquired) {
                $this->logger->warning('Failed to acquire lock for batch move, another process may be handling it', [
                    'batch_key' => $batchKey,
                ]);
                return Result::ACK;
            }

            $this->logger->info('Acquired lock for batch move processing', [
                'batch_key' => $batchKey,
                'lock_key' => $lockKey,
            ]);

            // Step 5: Double-check task status after acquiring lock
            // This is necessary to handle race conditions where another process
            // might have completed the task between the first check and lock acquisition
            /* @phpstan-ignore-next-line */
            if ($this->isTaskAlreadyProcessed($batchKey)) {
                $this->logger->info('Batch move task already processed after lock acquisition, skipping', [
                    'batch_key' => $batchKey,
                ]);
                return Result::ACK;
            }

            // Step 6: Delegate to business logic
            $this->processBatchMoveBusinessLogic($event);

            return Result::ACK;
        } catch (Throwable $e) {
            $this->logger->error('Failed to process file batch move event', [
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
                $this->releaseBatchMoveLock($lockKey, $lockOwner);
                $this->logger->info('Released lock for batch move processing', [
                    'batch_key' => $batchKey,
                    'lock_key' => $lockKey,
                ]);
            }
        }
    }

    public function moveFile(
        DataIsolation $dataIsolation,
        array $node,
        ProjectEntity $sourceProject,
        ProjectEntity $targetProject,
        TaskFileEntity $targetParentEntity,
        array $keepBothFileIds = []
    ): void {
        try {
            // Extract file information from node
            $fileId = (int) ($node['file_id'] ?? 0);
            $oldFileKey = $node['file_key'] ?? '';
            $fileName = $node['file_name'] ?? '';
            $isDirectory = $node['is_directory'] ?? false;
            $children = $node['children'] ?? [];

            if ($fileId <= 0 || empty($fileName)) {
                $this->logger->warning('Invalid file node data', ['node' => $node]);
                return;
            }

            if ($isDirectory) {
                $directoryResult = $this->handleDirectory(
                    $node,
                    $dataIsolation,
                    $sourceProject,
                    $targetProject,
                    $targetParentEntity,
                    $keepBothFileIds
                );

                /** @var TaskFileEntity $newTargetEntity */
                $newTargetEntity = $directoryResult['target_dir'];
                $deleteSourceDirAfterChildren = (bool) ($directoryResult['delete_source_dir_after_children'] ?? false);

                if (! empty($children)) {
                    foreach ($children as $child) {
                        $this->moveFile($dataIsolation, $child, $sourceProject, $targetProject, $newTargetEntity, $keepBothFileIds);
                    }
                }

                if ($deleteSourceDirAfterChildren) {
                    // Fetch entity before deletion so we can build the DirectoryDeletedEvent
                    $sourceDirEntity = $this->getFileEntityForCache($fileId);
                    $this->magicFSFileDomainService->deleteFile((string) $fileId);
                    if ($sourceDirEntity !== null) {
                        $dirUserAuth = new MagicUserAuthorization();
                        $dirUserAuth->setId($sourceDirEntity->getUserId());
                        $dirUserAuth->setOrganizationCode($sourceDirEntity->getOrganizationCode());
                        $this->eventDispatcher->dispatch(new DirectoryDeletedEvent($sourceDirEntity, $dirUserAuth));
                    }
                }
            } else {
                $fileEntity = $this->getFileEntityForCache($fileId);
                if ($fileEntity === null) {
                    $this->logger->warning('Source file entity not found while moving node', ['node' => $node]);
                    return;
                }

                $oldParentId = $fileEntity->getParentId();
                $newParentId = $targetParentEntity->getFileId();

                $this->taskFileDomainService->moveProjectFile(
                    $dataIsolation,
                    $fileEntity,
                    $sourceProject,
                    $targetProject,
                    $newParentId,
                    $keepBothFileIds
                );

                $this->syncTreeAfterProjectMove(
                    $fileEntity,
                    $newParentId,
                    $sourceProject,
                    $targetProject
                );

                // When a metadata file (magic.project.js / index.html) is moved to a different
                // directory, clear the stale display_config from the old location
                if (ProjectFileConstant::isSetMetadataFile($fileEntity->getFileName())
                    && $oldParentId !== null
                    && $oldParentId !== $newParentId
                ) {
                    $this->projectDisplayConfigDomainService->clearDisplayConfigForOldDirectory(
                        $oldParentId,
                        $fileEntity->getProjectId()
                    );
                }

                // Dispatch AttachmentsProcessedEvent for the new location if it's a metadata file
                if (ProjectFileConstant::isSetMetadataFile($fileEntity->getFileName())) {
                    $this->eventDispatcher->dispatch(new AttachmentsProcessedEvent(
                        $newParentId,
                        $fileEntity->getProjectId(),
                        $fileEntity->getTaskId()
                    ));
                }

                // Update fine-grained progress after each individual file is moved
                ++$this->processedFiles;
                $this->updateFileMovingProgress();
            }

            $this->logger->info('Moving file in batch operation', [
                'file_id' => $fileId,
                'old_file_key' => $oldFileKey,
                'target_parent_id' => $targetParentEntity->getFileId(),
                'source_project' => $sourceProject->getId(),
                'target_project' => $targetProject->getId(),
            ]);
        } catch (Throwable $e) {
            $this->logger->error('Failed to move file in batch operation', [
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
     * Check if the batch move task is already processed or in progress.
     *
     * @param string $batchKey Batch key to check
     * @return bool True if already processed, false otherwise
     */
    private function isTaskAlreadyProcessed(string $batchKey): bool
    {
        try {
            $status = $this->statusManager->getTaskStatus($batchKey);

            // Check if task is completed or failed
            if (! empty($status) && in_array(
                $status['status'] ?? '',
                [FileBatchOperationStatusManager::STATUS_SUCCESS, FileBatchOperationStatusManager::STATUS_FAILED],
                true
            )) {
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
     * Acquire mutex lock for batch move operation.
     *
     * @param string $batchKey Batch key for locking
     * @return array [bool $acquired, string $lockKey, string $lockOwner]
     */
    private function acquireBatchMoveLock(string $batchKey): array
    {
        $lockKey = "batch_move_lock:{$batchKey}";
        $lockOwner = uniqid('batch_move_', true);
        $lockTtl = 300; // 5 minutes

        try {
            $acquired = $this->locker->mutexLock($lockKey, $lockOwner, $lockTtl);
            return [$acquired, $lockKey, $lockOwner];
        } catch (Throwable $e) {
            $this->logger->error('Failed to acquire batch move lock', [
                'batch_key' => $batchKey,
                'lock_key' => $lockKey,
                'error' => $e->getMessage(),
            ]);
            return [false, '', ''];
        }
    }

    /**
     * Release mutex lock for batch move operation.
     *
     * @param string $lockKey Lock key to release
     * @param string $lockOwner Lock owner for verification
     */
    private function releaseBatchMoveLock(string $lockKey, string $lockOwner): void
    {
        try {
            $this->locker->release($lockKey, $lockOwner);
        } catch (Throwable $e) {
            $this->logger->warning('Failed to release batch move lock', [
                'lock_key' => $lockKey,
                'lock_owner' => $lockOwner,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Process the main business logic for batch file move.
     *
     * @param FileBatchMoveEvent $event Batch move event
     * @throws Throwable
     */
    private function processBatchMoveBusinessLogic(FileBatchMoveEvent $event): void
    {
        // Extract parameters from event
        $batchKey = $event->getBatchKey();
        $userId = $event->getUserId();
        $organizationCode = $event->getOrganizationCode();
        $fileIds = $event->getFileIds();
        $sourceProjectId = $event->getSourceProjectId();
        $targetProjectId = $event->getTargetProjectId();
        $targetParentId = $event->getTargetParentId();
        $keepBothFileIds = $event->getKeepBothFileIds();

        // Initialize progress tracking
        $this->currentBatchKey = $batchKey;
        $this->totalFiles = count($fileIds);
        $this->processedFiles = 0;

        $this->logger->info('Processing batch move business logic', [
            'batch_key' => $batchKey,
            'user_id' => $userId,
            'organization_code' => $organizationCode,
            'file_ids' => $fileIds,
            'source_project_id' => $sourceProjectId,
            'target_project_id' => $targetProjectId,
            'target_parent_id' => $targetParentId,
            'keep_both_file_ids' => $keepBothFileIds,
            'file_count' => count($fileIds),
        ]);

        // Set task progress to started (0%)
        $this->statusManager->setTaskProgress($batchKey, 0, count($fileIds), 'Starting batch file move process');

        // Create data isolation
        $dataIsolation = DataIsolation::simpleMake($organizationCode, $userId);

        // Preparation phase (5%)
        $this->updateProgress(5, 'Loading and preparing file entities');

        // Get source and target projects
        $sourceProject = $this->projectDomainService->getProjectNotUserId($sourceProjectId);
        $targetProject = $this->projectDomainService->getProjectNotUserId($targetProjectId);

        $this->logger->info('Batch move project context', [
            'source_project_id' => $sourceProjectId,
            'target_project_id' => $targetProjectId,
            'source_org' => $sourceProject->getUserOrganizationCode(),
            'target_org' => $targetProject->getUserOrganizationCode(),
            'is_cross_project' => $sourceProjectId !== $targetProjectId,
            'is_cross_organization' => $sourceProject->getUserOrganizationCode() !== $targetProject->getUserOrganizationCode(),
        ]);

        // 通过 file_id 的数组，查出所有 file_entity 实体
        $fileEntities = $this->taskFileDomainService->getProjectFilesByIds($sourceProjectId, $fileIds);

        // 通过 file_entity 的 parent_id 构建层级的结构
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

        // File moving phase (10% - 90%)
        $this->updateProgress(10, 'Starting file move operations');
        $this->moveFileByTree($dataIsolation, $fileTree, $sourceProject, $targetProject, $targetParentId, $keepBothFileIds);

        // Finalizing (95% - 100%)
        $this->updateProgress(95, 'Finalizing batch file move operation');

        // Mark as completed
        $this->statusManager->setTaskCompleted($batchKey, [
            'file_ids' => $fileIds,
            'target_parent_id' => $targetParentId,
            'operation' => 'batch_move',
            'message' => 'Batch file move completed successfully',
            'file_count' => count($fileIds),
        ]);

        try {
            // Dispatch only after actual batch move success.
            $this->eventDispatcher->dispatch($event);
        } catch (Throwable $e) {
            // Keep move task success state even if downstream notification/logging fails.
            $this->logger->warning('Batch move succeeded but event dispatch failed', [
                'batch_key' => $batchKey,
                'error' => $e->getMessage(),
            ]);
        }

        $this->logger->info('File batch move business logic completed successfully', [
            'batch_key' => $batchKey,
            'file_count' => count($fileIds),
        ]);
    }

    private function moveFileByTree(
        DataIsolation $dataIsolation,
        array $fileTree,
        ProjectEntity $sourceProject,
        ProjectEntity $targetProject,
        int $targetParentId,
        array $keepBothFileIds = []
    ) {
        $targetParentEntity = $this->taskFileDomainService->getById($targetParentId);
        if ($targetParentEntity === null) {
            $this->logger->warning('Target parent entity not found during batch move', [
                'target_parent_id' => $targetParentId,
            ]);
            return;
        }

        foreach ($fileTree as $node) {
            if (empty($node['file_id']) || $node['parent_id'] === $targetParentId) {
                continue;
            }

            $this->moveFile($dataIsolation, $node, $sourceProject, $targetProject, $targetParentEntity, $keepBothFileIds);
        }
    }

    private function handleDirectory(
        array $file,
        DataIsolation $dataIsolation,
        ProjectEntity $sourceProject,
        ProjectEntity $targetProject,
        TaskFileEntity $targetParentEntity,
        array $keepBothFileIds = []
    ): array {
        $oldFileEntity = $this->getFileEntityForCache((int) $file['file_id']);
        if ($oldFileEntity === null) {
            throw new RuntimeException('Source directory entity not found');
        }

        $sourceFileId = $oldFileEntity->getFileId();
        $sourceFileIdStr = (string) $sourceFileId;
        $sourceFileName = $oldFileEntity->getFileName();
        $targetParentId = $targetParentEntity->getFileId();
        $shouldKeepBoth = in_array($sourceFileIdStr, $keepBothFileIds, true);

        $targetFileEntity = $this->taskFileDomainService->getByProjectParentAndName(
            $targetProject->getId(),
            $targetParentId,
            $sourceFileName
        );

        if ($targetFileEntity !== null && $targetFileEntity->getFileId() === $sourceFileId) {
            $targetFileEntity = null;
        }

        $actualChildrenCount = $this->taskFileDomainService->getSiblingCountByParentId((int) $file['file_id'], $sourceProject->getId());
        $selectedChildrenCount = is_array($file['children'] ?? null) ? count($file['children']) : 0;
        $fullMove = $actualChildrenCount === 0 || $selectedChildrenCount === $actualChildrenCount;

        if (! $shouldKeepBoth && $targetFileEntity !== null && ! $targetFileEntity->getIsDirectory()) {
            $conflictEntity = $targetFileEntity;
            $this->magicFSFileDomainService->deleteFile((string) $conflictEntity->getFileId());
            $this->eventDispatcher->dispatch(new FileDeletedEvent(
                $conflictEntity,
                $conflictEntity->getUserId(),
                $conflictEntity->getOrganizationCode()
            ));
            $targetFileEntity = null;
        }

        if (! $shouldKeepBoth && $targetFileEntity !== null && $targetFileEntity->getIsDirectory()) {
            // Batch move keeps directory-merge behavior for compatibility: reuse target directory.
            return [
                'target_dir' => $targetFileEntity,
                'delete_source_dir_after_children' => $fullMove,
            ];
        }

        if ($fullMove) {
            $this->taskFileDomainService->moveProjectFile(
                $dataIsolation,
                $oldFileEntity,
                $sourceProject,
                $targetProject,
                $targetParentId,
                $keepBothFileIds
            );

            $this->syncTreeAfterProjectMove(
                $oldFileEntity,
                $targetParentId,
                $sourceProject,
                $targetProject
            );

            $movedDirectory = $this->taskFileDomainService->getById($sourceFileId) ?? $oldFileEntity;

            return [
                'target_dir' => $movedDirectory,
                'delete_source_dir_after_children' => false,
            ];
        }

        $newDirName = $sourceFileName;
        if ($shouldKeepBoth && $targetFileEntity !== null) {
            $newDirName = $this->generateUniqueDirectoryName(
                $sourceFileName,
                $targetProject->getId(),
                $targetParentId
            );
        }

        $createdDirectory = $this->magicFSFileDomainService->createFile(
            $newDirName,
            (string) $targetParentId,
            true,
            null,
            $oldFileEntity->getSort(),
            null,
            TaskFileSource::MOVE
        );

        $createdDirectory->setMetadata($oldFileEntity->getMetadata());
        $createdDirectory->setDisplayConfig($oldFileEntity->getDisplayConfig());
        $createdDirectory = $this->taskFileDomainService->updateById($createdDirectory);

        return [
            'target_dir' => $createdDirectory,
            'delete_source_dir_after_children' => false,
        ];
    }

    private function syncTreeAfterProjectMove(
        TaskFileEntity $sourceFileEntity,
        int $targetParentId,
        ProjectEntity $sourceProject,
        ProjectEntity $targetProject
    ): void {
        $oldParentId = $sourceFileEntity->getParentId();
        $sourceOrganizationCode = $sourceProject->getUserOrganizationCode();
        $targetOrganizationCode = $targetProject->getUserOrganizationCode();
        $crossOrganization = $sourceOrganizationCode !== $targetOrganizationCode;
        $parentChanged = $oldParentId !== $targetParentId;

        if (! $crossOrganization && ! $parentChanged) {
            return;
        }

        $this->taskFileDomainService->syncVersionAfterExternalMove($oldParentId, $targetParentId);
    }

    private function getFileEntityForCache(int $fileId): ?TaskFileEntity
    {
        if (isset($this->fileEntitiesCache[$fileId])) {
            return $this->fileEntitiesCache[$fileId];
        }
        return $this->taskFileDomainService->getById($fileId);
    }

    private function generateUniqueDirectoryName(
        string $originalDirName,
        int $projectId,
        int $parentId
    ): string {
        $baseDirName = rtrim($originalDirName, '/');

        $siblings = $this->taskFileDomainService->getChildrenByParentAndProject(
            $projectId,
            $parentId,
            10000
        );

        $existingNames = [];
        foreach ($siblings as $sibling) {
            $existingNames[$sibling->getFileName()] = true;
        }

        if (! isset($existingNames[$baseDirName])) {
            return $baseDirName;
        }

        for ($i = 1; $i <= 20; ++$i) {
            $candidate = $baseDirName . '(' . $i . ')';
            if (! isset($existingNames[$candidate])) {
                return $candidate;
            }
        }

        return $baseDirName . '_' . time() . substr((string) microtime(true), -6);
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
            // Use the real total file count so progress percentages reflect actual work
            $totalCount = $this->totalFiles > 0 ? $this->totalFiles : 1;
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
     * Update progress during file moving phase (10%-90%).
     */
    private function updateFileMovingProgress(): void
    {
        if ($this->totalFiles <= 0 || empty($this->currentBatchKey)) {
            return;
        }

        try {
            // File moving phase occupies 10%-90%, total 80% progress
            $moveProgress = 10 + (80 * ($this->processedFiles / $this->totalFiles));
            $percentage = (int) $moveProgress;

            $message = "Moving files ({$this->processedFiles}/{$this->totalFiles})";

            $this->statusManager->setTaskProgress(
                $this->currentBatchKey,
                $this->processedFiles,
                $this->totalFiles,
                $message
            );

            $this->logger->info('File moving progress updated', [
                'batch_key' => $this->currentBatchKey,
                'processed' => $this->processedFiles,
                'total' => $this->totalFiles,
                'percentage' => $percentage,
                'message' => $message,
            ]);
        } catch (Throwable $e) {
            $this->logger->warning('Failed to update file moving progress', [
                'batch_key' => $this->currentBatchKey,
                'error' => $e->getMessage(),
            ]);
        }
    }
}

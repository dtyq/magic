<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\Event\Subscribe;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Common\Event\DeleteEventSource;
use App\Domain\SuperMagic\File\Constant\ProjectFileConstant;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileMoveChangeSet;
use App\Domain\SuperMagic\File\Entity\ValueObject\TaskFileSource;
use App\Domain\SuperMagic\File\Event\AttachmentsProcessedEvent;
use App\Domain\SuperMagic\File\Event\DirectoryDeletedEvent;
use App\Domain\SuperMagic\File\Event\FileBatchMoveCompletedEvent;
use App\Domain\SuperMagic\File\Event\FileBatchMoveEvent;
use App\Domain\SuperMagic\File\Event\FileDeletedEvent;
use App\Domain\SuperMagic\File\Service\MagicFSFileDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Service\ProjectDisplayConfigDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\SuperMagic\Utils\FileBatchOperationStatusManager;
use App\Infrastructure\SuperMagic\Utils\FileOperationTreeUtil;
use App\Infrastructure\SuperMagic\Utils\FileTreeUtil;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\File\DTO\Response\TaskFileItemDTO;
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

use function Hyperf\Translation\trans;

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

    /** @var array<string, DataIsolation> 当前消息内按组织和用户缓存的来源上下文。 */
    private array $sourceDataIsolations = [];

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

    /** Collected file changes for the current batch operation. */
    private ?FileMoveChangeSet $currentChangeSet = null;

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
        $this->sourceDataIsolations = [];
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
            $this->sourceDataIsolations = [];
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
            $isSyntheticParent = (bool) ($node['is_synthetic_parent'] ?? false);

            if ($fileId <= 0 || empty($fileName)) {
                $this->logger->warning('Invalid file node data', ['node' => $node]);
                return;
            }

            if ($isDirectory) {
                if ($isSyntheticParent) {
                    $newTargetEntity = $this->resolveSyntheticParentDirectory(
                        $node,
                        $targetProject,
                        $targetParentEntity->getFileId()
                    );
                    foreach ($children as $child) {
                        $this->moveFile($dataIsolation, $child, $sourceProject, $targetProject, $newTargetEntity, $keepBothFileIds);
                    }
                    return;
                }

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
                        $this->eventDispatcher->dispatch(new DirectoryDeletedEvent(
                            $sourceDirEntity,
                            $dirUserAuth,
                            DeleteEventSource::InternalOverwrite
                        ));
                        if ($this->currentChangeSet !== null) {
                            $this->currentChangeSet->recordDeletedFile($sourceDirEntity);
                        }
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

                // Pre-detect overwritten file before moveProjectFile silently deletes it
                $batchOverwrittenFile = null;
                if ($this->currentChangeSet !== null && ! in_array((string) $fileId, $keepBothFileIds, true)) {
                    $batchCandidate = $this->taskFileDomainService->getByProjectParentAndName(
                        $targetProject->getId(),
                        $newParentId,
                        $fileEntity->getFileName()
                    );
                    if ($batchCandidate !== null && $batchCandidate->getFileId() !== $fileId && ! $batchCandidate->getIsDirectory()) {
                        $batchOverwrittenFile = $batchCandidate;
                    }
                }

                $this->taskFileDomainService->moveProjectFile(
                    $dataIsolation,
                    $fileEntity,
                    $sourceProject,
                    $targetProject,
                    $newParentId,
                    $this->prepareSourceDataIsolation($sourceProject),
                    $keepBothFileIds
                );

                if ($this->currentChangeSet !== null) {
                    if ($batchOverwrittenFile !== null) {
                        $this->currentChangeSet->recordDeletedFile($batchOverwrittenFile);
                    }
                    $this->currentChangeSet->recordUpdatedFileId($fileId);
                    $this->currentChangeSet->recordAffectedParentId($newParentId, $targetProject->getId());
                    if ($oldParentId !== null && $oldParentId > 0 && $oldParentId !== $newParentId) {
                        $this->currentChangeSet->recordAffectedParentId($oldParentId, $sourceProject->getId());
                    }
                }

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

    /** 按源项目身份创建上下文，避免用操作人替代资源所有者。 */
    private function prepareSourceDataIsolation(ProjectEntity $project): DataIsolation
    {
        $key = json_encode([$project->getUserOrganizationCode(), $project->getUserId()], JSON_THROW_ON_ERROR);
        if (! isset($this->sourceDataIsolations[$key])) {
            $context = DataIsolation::create($project->getUserOrganizationCode(), $project->getUserId());
            $context->initDataIsolationEnv();
            $this->sourceDataIsolations[$key] = $context;
        }
        return $this->sourceDataIsolations[$key];
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
        $preserveParentPath = $event->shouldPreserveParentPath() && $sourceProjectId !== $targetProjectId;

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
            'preserve_parent_path' => $preserveParentPath,
            'file_count' => count($fileIds),
        ]);

        // Set task progress to started (0%)
        $this->statusManager->setTaskProgress($batchKey, 0, count($fileIds), 'Starting batch file move process');

        // Create data isolation
        $dataIsolation = DataIsolation::simpleMake($organizationCode, $userId);
        $dataIsolation->initDataIsolationEnv();

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

        $this->fileEntitiesCache = [];
        $fileTree = $this->prepareMoveTree($fileIds, $sourceProject, $preserveParentPath);

        if ($preserveParentPath) {
            $this->preflightSyntheticParentPaths($fileTree, $targetProjectId, $targetParentId);
        }

        // Initialize change collector for this batch
        $this->currentChangeSet = new FileMoveChangeSet();

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
            'preserve_parent_path' => $preserveParentPath,
        ]);

        $changeSet = $this->currentChangeSet;
        $this->currentChangeSet = null;
        try {
            // Dispatch aggregated completion event (carries FileMoveChangeSet for rich notifications).
            if ($changeSet !== null && ! $changeSet->isEmpty()) {
                $this->eventDispatcher->dispatch(new FileBatchMoveCompletedEvent(
                    $batchKey,
                    $userId,
                    $organizationCode,
                    $targetProjectId,
                    $sourceProjectId,
                    $targetParentId,
                    $changeSet
                ));
            }
        } catch (Throwable $e) {
            // Keep move task success state even if downstream notification/logging fails.
            $this->logger->warning('Batch move succeeded but completed event dispatch failed', [
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
            if (empty($node['file_id'])
                || (! (bool) ($node['is_synthetic_parent'] ?? false) && $node['parent_id'] === $targetParentId)
            ) {
                continue;
            }

            $this->moveFile($dataIsolation, $node, $sourceProject, $targetProject, $targetParentEntity, $keepBothFileIds);
        }
    }

    /**
     * @param array<int> $fileIds
     * @return array<int, array<string, mixed>>
     */
    private function prepareMoveTree(
        array $fileIds,
        ProjectEntity $sourceProject,
        bool $preserveParentPath
    ): array {
        $sourceProjectId = $sourceProject->getId();
        $fileEntities = $preserveParentPath
            ? $this->taskFileDomainService->getFilesWithParentsByIds($fileIds, $sourceProjectId)
            : $this->taskFileDomainService->getProjectFilesByIds($sourceProjectId, $fileIds);

        $files = [];
        $fileDebugArr = [];
        foreach ($fileEntities as $fileEntity) {
            $this->fileEntitiesCache[$fileEntity->getFileId()] = $fileEntity;
            $files[] = TaskFileItemDTO::fromEntity($fileEntity, $sourceProject->getWorkDir())->toArray();
            $fileDebugArr[] = [
                'id' => $fileEntity->getFileId(),
                'key' => $fileEntity->getFileKey(),
                'p_id' => $fileEntity->getParentId(),
            ];
        }

        $this->logger->info('Prepared batch move file tree entities', [
            'source_project_id' => $sourceProjectId,
            'preserve_parent_path' => $preserveParentPath,
            'data' => $fileDebugArr,
        ]);

        if (! $preserveParentPath) {
            return FileTreeUtil::assembleFilesTreeByParentId($files);
        }

        $sourceRootFileId = $this->taskFileDomainService->getProjectRootFileId($sourceProjectId);
        return FileOperationTreeUtil::assemblePreservingParentPath($files, $fileIds, $sourceRootFileId);
    }

    /** @param array<int, array<string, mixed>> $fileTree */
    private function preflightSyntheticParentPaths(array $fileTree, int $targetProjectId, int $targetParentId): void
    {
        foreach ($fileTree as $node) {
            $this->preflightSyntheticParentNode($node, $targetProjectId, $targetParentId, '');
        }
    }

    /** @param array<string, mixed> $node */
    private function preflightSyntheticParentNode(
        array $node,
        int $targetProjectId,
        int $targetParentId,
        string $relativePath
    ): void {
        if (! (bool) ($node['is_synthetic_parent'] ?? false)) {
            return;
        }

        $fileName = (string) ($node['file_name'] ?? '');
        if ($fileName === '' || ! (bool) ($node['is_directory'] ?? false)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'Invalid synthetic parent directory');
        }

        $currentPath = $relativePath === '' ? $fileName : $relativePath . '/' . $fileName;
        $targetEntity = $this->taskFileDomainService->getByProjectParentAndName(
            $targetProjectId,
            $targetParentId,
            $fileName
        );
        if ($targetEntity === null) {
            return;
        }
        if (! $targetEntity->getIsDirectory()) {
            $this->throwSyntheticParentConflict($currentPath);
        }

        foreach (($node['children'] ?? []) as $child) {
            if (is_array($child)) {
                $this->preflightSyntheticParentNode($child, $targetProjectId, $targetEntity->getFileId(), $currentPath);
            }
        }
    }

    /** @param array<string, mixed> $node */
    private function resolveSyntheticParentDirectory(
        array $node,
        ProjectEntity $targetProject,
        int $targetParentId
    ): TaskFileEntity {
        $fileName = (string) ($node['file_name'] ?? '');
        if ($fileName === '' || ! (bool) ($node['is_directory'] ?? false)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'Invalid synthetic parent directory');
        }

        $targetEntity = $this->taskFileDomainService->getByProjectParentAndName(
            $targetProject->getId(),
            $targetParentId,
            $fileName
        );
        if ($targetEntity !== null) {
            if ($targetEntity->getIsDirectory()) {
                return $targetEntity;
            }
            $this->throwSyntheticParentConflict($fileName);
        }

        try {
            return $this->magicFSFileDomainService->createFile(
                $fileName,
                (string) $targetParentId,
                true,
                null,
                null,
                null,
                TaskFileSource::MOVE
            );
        } catch (Throwable $e) {
            $concurrentEntity = $this->taskFileDomainService->getByProjectParentAndName(
                $targetProject->getId(),
                $targetParentId,
                $fileName
            );
            if ($concurrentEntity !== null && $concurrentEntity->getIsDirectory()) {
                return $concurrentEntity;
            }
            if ($concurrentEntity !== null) {
                $this->throwSyntheticParentConflict($fileName);
            }
            throw $e;
        }
    }

    private function throwSyntheticParentConflict(string $relativePath): never
    {
        ExceptionBuilder::throw(
            GenericErrorCode::ParameterValidationFailed,
            trans('file.preserve_parent_path_conflict', ['path' => $relativePath])
        );
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
                $conflictEntity->getOrganizationCode(),
                DeleteEventSource::InternalOverwrite
            ));
            if ($this->currentChangeSet !== null) {
                $this->currentChangeSet->recordDeletedFile($conflictEntity);
            }
            $targetFileEntity = null;
        }

        if (! $shouldKeepBoth && $targetFileEntity !== null && $targetFileEntity->getIsDirectory()) {
            // When the existing target with the same name is also a directory, reuse it
            // (merge into it) instead of deleting and recreating. This preserves the
            // target directory's existing children and lets inner file conflicts be
            // resolved per-file (e.g. keep-both renames source copies to "name(1).ext").
            // After all children have been moved out, delete the now-empty source directory.
            // Only delete when all children are being moved (fullMove); for partial moves the
            // source directory still holds unselected children, so leave it intact.
            $this->logger->info('Reusing existing target directory for merge move', [
                'source_id' => $sourceFileId,
                'existing_id' => $targetFileEntity->getFileId(),
                'target_parent_id' => $targetParentId,
            ]);

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
                $this->prepareSourceDataIsolation($sourceProject),
                $keepBothFileIds
            );

            $this->syncTreeAfterProjectMove(
                $oldFileEntity,
                $targetParentId,
                $sourceProject,
                $targetProject
            );

            $movedDirectory = $this->taskFileDomainService->getById($sourceFileId) ?? $oldFileEntity;

            if ($this->currentChangeSet !== null) {
                $this->currentChangeSet->recordUpdatedFileId($sourceFileId);
                $this->currentChangeSet->recordAffectedParentId($targetParentId, $targetProject->getId());
                $oldDirParentId = $oldFileEntity->getParentId();
                if ($oldDirParentId !== null && $oldDirParentId > 0 && $oldDirParentId !== $targetParentId) {
                    $this->currentChangeSet->recordAffectedParentId($oldDirParentId, $sourceProject->getId());
                }
            }

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

        if ($this->currentChangeSet !== null) {
            $this->currentChangeSet->recordAddedFileId($createdDirectory->getFileId());
            $this->currentChangeSet->recordAffectedParentId($targetParentId, $targetProject->getId());
        }

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

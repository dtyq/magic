<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\Event\Subscribe;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\TaskFileSource;
use App\Domain\SuperMagic\File\Event\FileBatchCopyEvent;
use App\Domain\SuperMagic\File\Event\FileUploadedEvent;
use App\Domain\SuperMagic\File\Service\MagicFSFileDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\SuperMagic\Utils\FileBatchOperationStatusManager;
use App\Infrastructure\SuperMagic\Utils\FileOperationTreeUtil;
use App\Infrastructure\SuperMagic\Utils\FileTreeUtil;
use App\Infrastructure\Util\Locker\LockerInterface;
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

    /** Total number of all files (including nested) to be copied in the current batch. */
    private int $totalFiles = 0;

    /** Number of individual files (non-directories) successfully copied so far. */
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
        $this->sourceDataIsolations = [];
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
            $this->sourceDataIsolations = [];
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
        TaskFileEntity $targetParentEntity,
        array $keepBothFileIds = []
    ): void {
        try {
            // Extract file information from node
            $fileId = (int) ($node['file_id'] ?? 0);
            $fileName = $node['file_name'] ?? '';
            $isDirectory = $node['is_directory'] ?? false;
            $children = $node['children'] ?? [];

            if ($fileId <= 0 || empty($fileName)) {
                $this->logger->warning('Invalid file node data', ['node' => $node]);
                return;
            }

            if ($isDirectory) {
                $isSyntheticParent = (bool) ($node['is_synthetic_parent'] ?? false);
                $newTargetEntity = $isSyntheticParent
                    ? $this->resolveSyntheticParentDirectory(
                        $node,
                        $targetProject,
                        $targetParentEntity->getFileId()
                    )
                    : $this->handleDirectory(
                        $node,
                        $sourceProject,
                        $targetProject,
                        $targetParentEntity->getFileId(),
                        $keepBothFileIds
                    );
                if (! $isSyntheticParent && $newTargetEntity->getFileId() === $fileId && ! in_array((string) $fileId, $keepBothFileIds, true)) {
                    $this->logger->info('Skipped directory copy because target directory is source directory itself', [
                        'source_id' => $fileId,
                        'target_parent_id' => $targetParentEntity->getFileId(),
                    ]);
                } elseif (! empty($children)) {
                    foreach ($children as $child) {
                        $this->copyFile($dataIsolation, $child, $sourceProject, $targetProject, $newTargetEntity, $keepBothFileIds);
                    }
                }
            } else {
                // Get file entity
                $fileEntity = $this->getFileEntityForCache($fileId);
                if ($fileEntity === null) {
                    $this->logger->warning('Source file entity not found while copying node', ['node' => $node]);
                    return;
                }

                // Always use copyProjectFile which handles conflict resolution
                $copiedFileEntity = $this->taskFileDomainService->copyProjectFile(
                    $dataIsolation,
                    $fileEntity,
                    $sourceProject,
                    $targetProject,
                    $targetParentEntity->getFileId(),
                    $this->prepareSourceDataIsolation($sourceProject),
                    $keepBothFileIds
                );

                if ($copiedFileEntity->getFileId() === $fileEntity->getFileId()) {
                    $this->logger->info('Skipped file copy because target file is source file itself', [
                        'source_id' => $fileId,
                        'target_parent_id' => $targetParentEntity->getFileId(),
                    ]);
                    ++$this->processedFiles;
                    $this->updateFileCopyingProgress();
                    return;
                }

                $this->syncTreeAfterProjectCopy(
                    $copiedFileEntity,
                    $targetParentEntity->getFileId(),
                    $targetProject->getUserOrganizationCode()
                );

                // Dispatch file uploaded event for the new copy so clients get notified
                $this->eventDispatcher->dispatch(new FileUploadedEvent(
                    $copiedFileEntity,
                    $dataIsolation->getCurrentUserId(),
                    $dataIsolation->getCurrentOrganizationCode()
                ));

                // Update fine-grained progress after each individual file is copied
                ++$this->processedFiles;
                $this->updateFileCopyingProgress();
            }

            $this->logger->info('Copying file/directory in batch operation', [
                'file_id' => $fileId,
                'target_parent_id' => $targetParentEntity->getFileId(),
                'source_project' => $sourceProject->getId(),
                'target_project' => $targetProject->getId(),
                'is_directory' => $isDirectory,
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
     * Handle directory copy - create new directory or reuse existing.
     *
     * @param array $file File node data
     * @param ProjectEntity $sourceProject Source project
     * @param ProjectEntity $targetProject Target project
     * @param int $parentId Target parent ID
     * @param array $keepBothFileIds Array of source file IDs that should not overwrite when conflict occurs
     * @return TaskFileEntity Created or existing directory entity
     */
    private function handleDirectory(
        array $file,
        ProjectEntity $sourceProject,
        ProjectEntity $targetProject,
        int $parentId,
        array $keepBothFileIds = []
    ): TaskFileEntity {
        $oldFileEntity = $this->getFileEntityForCache((int) $file['file_id']);
        if ($oldFileEntity === null) {
            throw new RuntimeException('Source directory entity not found');
        }

        $sourceFileId = $oldFileEntity->getFileId();
        $sourceFileIdStr = (string) $sourceFileId;
        $sourceFileName = $oldFileEntity->getFileName();
        $shouldKeepBoth = in_array($sourceFileIdStr, $keepBothFileIds, true);

        $targetFileEntity = $this->taskFileDomainService->getByProjectParentAndName(
            $targetProject->getId(),
            $parentId,
            $sourceFileName
        );

        if ($targetFileEntity !== null && $targetFileEntity->getFileId() === $sourceFileId) {
            if (! $shouldKeepBoth) {
                return $oldFileEntity;
            }
        }

        $newDirName = $sourceFileName;
        if ($targetFileEntity !== null && $shouldKeepBoth) {
            $newDirName = $this->generateUniqueDirectoryName(
                $sourceFileName,
                $targetProject->getId(),
                $parentId
            );
            $targetFileEntity = null;
        }

        if (! $shouldKeepBoth && $targetFileEntity !== null) {
            // When the existing target with the same name is also a directory, reuse it
            // (merge into it) instead of deleting and recreating. This preserves the
            // target directory's existing children and lets inner file conflicts be
            // resolved per-file (e.g. keep-both renames source copies to "name(1).ext").
            if ($targetFileEntity->getIsDirectory()) {
                $this->logger->info('Reusing existing target directory for merge copy', [
                    'source_id' => $sourceFileId,
                    'existing_id' => $targetFileEntity->getFileId(),
                    'target_parent_id' => $parentId,
                ]);

                return $targetFileEntity;
            }

            // Type mismatch: existing target is a file while source is a directory.
            // Keep the original overwrite behavior by deleting the conflicting file first.
            $this->logger->info('Deleting existing target before directory copy overwrite', [
                'source_id' => $sourceFileId,
                'existing_id' => $targetFileEntity->getFileId(),
                'target_parent_id' => $parentId,
                'existing_is_directory' => $targetFileEntity->getIsDirectory(),
            ]);

            $this->magicFSFileDomainService->deleteFile(
                (string) $targetFileEntity->getFileId(),
                $targetFileEntity->getIsDirectory()
            );
            $targetFileEntity = null;
        }

        $createdDirectory = $this->magicFSFileDomainService->createFile(
            $newDirName,
            (string) $parentId,
            true,
            null,
            $oldFileEntity->getSort(),
            null,
            TaskFileSource::COPY
        );
        $createdDirectory->setMetadata($oldFileEntity->getMetadata());
        $createdDirectory->setDisplayConfig($oldFileEntity->getDisplayConfig());
        $createdDirectory->setSourceFileId($oldFileEntity->getFileId());
        return $this->taskFileDomainService->updateById($createdDirectory);
    }

    /**
     * Create or reuse a structural directory used only to preserve the source parent path.
     * Synthetic parents never overwrite or rename an existing target file.
     *
     * @param array<string, mixed> $node
     */
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
                TaskFileSource::COPY
            );
        } catch (Throwable $e) {
            // A concurrent operation may have created the same path after preflight.
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

    private function getFileEntityForCache(int $fileId): ?TaskFileEntity
    {
        if (isset($this->fileEntitiesCache[$fileId])) {
            return $this->fileEntitiesCache[$fileId];
        }
        return $this->taskFileDomainService->getById($fileId);
    }

    /**
     * Generate unique directory name when conflict occurs.
     */
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

    private function syncTreeAfterProjectCopy(
        TaskFileEntity $copiedFileEntity,
        int $targetParentId,
        string $targetOrganizationCode
    ): void {
        $this->taskFileDomainService->syncVersionAfterExternalCopy($targetParentId);
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
        $preserveParentPath = $event->shouldPreserveParentPath() && $sourceProjectId !== $targetProjectId;

        // Initialize progress tracking
        $this->currentBatchKey = $batchKey;
        $this->totalFiles = count($fileIds);
        $this->processedFiles = 0;

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
            'preserve_parent_path' => $preserveParentPath,
            'file_count' => count($fileIds),
        ]);

        // Set task progress to started (0%)
        $this->statusManager->setTaskProgress($batchKey, 0, count($fileIds), 'Starting batch file copy process');

        // Create data isolation
        $dataIsolation = DataIsolation::simpleMake($organizationCode, $userId);
        $dataIsolation->initDataIsolationEnv();

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

        $this->fileEntitiesCache = [];
        $fileTree = $this->prepareCopyTree($fileIds, $sourceProject, $preserveParentPath);
        $syntheticParentIds = $this->collectSyntheticParentIds($fileTree);

        $this->logger->info('Prepared batch copy operation tree', [
            'batch_key' => $batchKey,
            'preserve_parent_path' => $preserveParentPath,
            'synthetic_parent_ids' => $syntheticParentIds,
            'synthetic_parent_count' => count($syntheticParentIds),
        ]);

        if ($preserveParentPath) {
            $this->preflightSyntheticParentPaths($fileTree, $targetProjectId, $targetParentId);
        }

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
            'preserve_parent_path' => $preserveParentPath,
        ]);

        try {
            // Dispatch only after actual batch copy success.
            $this->eventDispatcher->dispatch($event);
        } catch (Throwable $e) {
            // Keep copy task success state even if downstream notification/logging fails.
            $this->logger->warning('Batch copy succeeded but event dispatch failed', [
                'batch_key' => $batchKey,
                'error' => $e->getMessage(),
            ]);
        }

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
        if ($targetParentEntity === null) {
            $this->logger->warning('Target parent entity not found during batch copy', [
                'target_parent_id' => $targetParentId,
            ]);
            return;
        }

        foreach ($fileTree as $node) {
            if (empty($node['file_id'])) {
                continue;
            }

            $this->copyFile($dataIsolation, $node, $sourceProject, $targetProject, $targetParentEntity, $keepBothFileIds);
        }
    }

    /**
     * @param array<int, array<string, mixed>> $fileTree
     * @return array<int>
     */
    private function collectSyntheticParentIds(array $fileTree): array
    {
        $ids = [];
        foreach ($fileTree as $node) {
            if ((bool) ($node['is_synthetic_parent'] ?? false)) {
                $ids[] = (int) ($node['file_id'] ?? 0);
            }
            $children = $node['children'] ?? [];
            if (is_array($children) && $children !== []) {
                $ids = array_merge($ids, $this->collectSyntheticParentIds($children));
            }
        }

        return array_values(array_filter(array_unique($ids), static fn (int $id): bool => $id > 0));
    }

    /**
     * @param array<int> $fileIds
     * @return array<int, array<string, mixed>>
     */
    private function prepareCopyTree(
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

        $this->logger->info('Prepared batch copy file tree entities', [
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

    /**
     * Validate all synthetic parent paths before the first write operation.
     *
     * @param array<int, array<string, mixed>> $fileTree
     */
    private function preflightSyntheticParentPaths(
        array $fileTree,
        int $targetProjectId,
        int $targetParentId
    ): void {
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
            // Descendants cannot already exist when their parent directory does not exist.
            return;
        }

        if (! $targetEntity->getIsDirectory()) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterValidationFailed,
                trans('file.preserve_parent_path_conflict', ['path' => $currentPath])
            );
        }

        foreach (($node['children'] ?? []) as $child) {
            if (is_array($child)) {
                $this->preflightSyntheticParentNode(
                    $child,
                    $targetProjectId,
                    $targetEntity->getFileId(),
                    $currentPath
                );
            }
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
     * Update progress during file copying phase (10%-90%).
     */
    private function updateFileCopyingProgress(): void
    {
        if ($this->totalFiles <= 0 || empty($this->currentBatchKey)) {
            return;
        }

        try {
            // File copying phase occupies 10%-90%, total 80% progress
            $copyProgress = 10 + (80 * ($this->processedFiles / $this->totalFiles));
            $percentage = (int) $copyProgress;

            $message = "Copying files ({$this->processedFiles}/{$this->totalFiles})";

            $this->statusManager->setTaskProgress(
                $this->currentBatchKey,
                $this->processedFiles,
                $this->totalFiles,
                $message
            );

            $this->logger->info('File copying progress updated', [
                'batch_key' => $this->currentBatchKey,
                'processed' => $this->processedFiles,
                'total' => $this->totalFiles,
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

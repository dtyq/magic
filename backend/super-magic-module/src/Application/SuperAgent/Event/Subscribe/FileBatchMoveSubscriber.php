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
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileBatchMoveEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Infrastructure\Utils\FileBatchOperationStatusManager;
use Dtyq\SuperMagic\Infrastructure\Utils\FileTreeUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
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

    public function moveFile(DataIsolation $dataIsolation, array $node, string $prefix, string $parentDir, ProjectEntity $projectEntity, TaskFileEntity $targetParentEntity)
    {
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

            // 判断目标位置是否存在
            $newFileKey = $this->calculateNewFileKey($oldFileKey, $fileName, $parentDir, $isDirectory);
            $targetEntity = $this->taskFileDomainService->getByFileKey($newFileKey);

            if ($isDirectory) {
                $newTargetEntity = $this->handlerDirectory($dataIsolation, $node, $targetParentEntity->getFileId(), $newFileKey, $projectEntity->getWorkDir(), $targetEntity);
                if (! empty($children)) {
                    // For children, the parent directory should be the new location of this file/directory
                    $newParentDir = $newFileKey;
                    foreach ($children as $child) {
                        $this->moveFile($dataIsolation, $child, $prefix, $newParentDir, $projectEntity, $newTargetEntity);
                    }
                }
            } else {
                // 先执行复制操作
                // 如果目标文件已经存在，则把以前的文件进行删除，保留目标的文件id
                $fileEntity = $this->getFileEntityForCache($fileId);
                $this->taskFileDomainService->moveFile($dataIsolation, $fileEntity, $projectEntity->getWorkDir(), $newFileKey, $targetParentEntity->getFileId());
                if (! empty($targetEntity) && $fileEntity->getFileKey() !== $newFileKey) {
                    // 覆盖的逻辑
                    $this->taskFileDomainService->deleteById($targetEntity->getFileId());
                }
            }

            $this->logger->info('Moving file', [
                'file_id' => $fileId,
                'old_file_key' => $oldFileKey,
                'new_file_key' => $newFileKey,
                'parent_dir' => $parentDir,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('Failed to move file', [
                'node' => $node,
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
        $projectId = $event->getProjectId();
        $preFileId = $event->getPreFileId();
        $targetParentId = $event->getTargetParentId();

        // Initialize progress tracking
        $this->currentBatchKey = $batchKey;

        $this->logger->info('Processing batch move business logic', [
            'batch_key' => $batchKey,
            'user_id' => $userId,
            'organization_code' => $organizationCode,
            'file_ids' => $fileIds,
            'project_id' => $projectId,
            'pre_file_id' => $preFileId,
            'target_parent_id' => $targetParentId,
            'file_count' => count($fileIds),
        ]);

        // Set task progress to started (0%)
        $this->statusManager->setTaskProgress($batchKey, 0, count($fileIds), 'Starting batch file move process');

        // Create data isolation
        $dataIsolation = DataIsolation::simpleMake($organizationCode, $userId);

        // Preparation phase (5%)
        $this->updateProgress(5, 'Loading and preparing file entities');

        // 通过 file_id 的数组，查出所有 file_entity 实体
        $fileEntities = $this->taskFileDomainService->getProjectFilesByIds($projectId, $fileIds);

        // 通过 file_entity 的 parent_id 构建层级的结构
        $projectEntity = $this->projectDomainService->getProject($projectId, $userId);
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
        $this->moveFileByTree($dataIsolation, $fileTree, $projectEntity, $targetParentId);

        // Rebalancing phase (90% - 95%)
        $this->updateProgress(90, 'Rebalancing directory sort order');
        $this->taskFileDomainService->rebalanceAndCalculateSort($targetParentId, $preFileId);

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

        $this->logger->info('File batch move business logic completed successfully', [
            'batch_key' => $batchKey,
            'file_count' => count($fileIds),
        ]);
    }

    private function moveFileByTree(DataIsolation $dataIsolation, array $fileTree, ProjectEntity $projectEntity, int $targetParentId)
    {
        $prefix = WorkDirectoryUtil::getPrefix($projectEntity->getWorkDir());
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
            $this->moveFile($dataIsolation, $node, $prefix, $targetParentDir, $projectEntity, $targetParentEntity);

            // Update progress after each file move
            ++$this->processedTopLevelFiles;
            $this->updateFileMovingProgress();
        }
    }

    private function handlerDirectory(DataIsolation $dataIsolation, array $file, int $parentId, string $newFileKey, string $workDir, ?TaskFileEntity $targetFileEntity): TaskFileEntity
    {
        $oldFileEntity = $this->getFileEntityForCache((int) $file['file_id']);
        $actualChildrenCount = $this->taskFileDomainService->getSiblingCountByParentId((int) $file['file_id'], $oldFileEntity->getProjectId());

        // 如果目标文件夹存在，并且源文件夹的子文件已经没有文件了，那么就删除源文件夹, 且不能等于相同的文件
        if (! empty($targetFileEntity) && ($file['file_key'] !== $newFileKey) && ($actualChildrenCount === 0 || count($file['children']) === $actualChildrenCount)) {
            $this->taskFileDomainService->deleteProjectFiles($dataIsolation, $oldFileEntity, $workDir);
            return $targetFileEntity;
        }
        // 如果不存在，分为两种情况
        // 第一种是历史文件夹 存在文件的时候，这种需要创建新的文件夹
        if ($actualChildrenCount > $file['children']) {
            return $this->taskFileDomainService->createFolderFromFileEntity($oldFileEntity, $parentId, $newFileKey, $workDir);
        }
        // 否则使用原先的记录，更换路径
        return $this->taskFileDomainService->renameFolderFromFileEntity($oldFileEntity, $parentId, $newFileKey, $workDir);
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
     * Update progress during file moving phase (10%-90%).
     */
    private function updateFileMovingProgress(): void
    {
        if ($this->totalTopLevelFiles <= 0 || empty($this->currentBatchKey)) {
            return;
        }

        try {
            // File moving phase occupies 10%-90%, total 80% progress
            $moveProgress = 10 + (80 * ($this->processedTopLevelFiles / $this->totalTopLevelFiles));
            $percentage = (int) $moveProgress;

            $message = "Moving files ({$this->processedTopLevelFiles}/{$this->totalTopLevelFiles})";

            $this->statusManager->setTaskProgress(
                $this->currentBatchKey,
                $this->processedTopLevelFiles,
                $this->totalTopLevelFiles,
                $message
            );

            $this->logger->info('File moving progress updated', [
                'batch_key' => $this->currentBatchKey,
                'processed' => $this->processedTopLevelFiles,
                'total' => $this->totalTopLevelFiles,
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

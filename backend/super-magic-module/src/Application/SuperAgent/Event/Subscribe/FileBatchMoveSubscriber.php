<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
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
    exchange: 'file.batch.move',
    routingKey: 'file.batch.move',
    queue: 'file.batch.move',
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
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('FileBatchMove');
    }

    /**
     * Consume batch move event message.
     *
     * @param array $data Event data containing batch move parameters
     * @param AMQPMessage $message AMQP message
     * @return Result Processing result
     */
    public function consumeMessage($data, AMQPMessage $message): Result
    {
        try {
            // Create event from array data
            $event = FileBatchMoveEvent::fromArray($data);

            $this->logger->info('Received file batch move event', [
                'batch_key' => $event->getBatchKey(),
                'file_ids' => $event->getFileIds(),
                'target_parent_id' => $event->getTargetParentId(),
                'file_count' => count($event->getFileIds()),
            ]);

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

            // Validate required parameters
            if (empty($batchKey) || empty($userId) || empty($fileIds) || ! $projectId) {
                $this->logger->error('Invalid batch move event data: missing required parameters', [
                    'batch_key' => $batchKey,
                    'user_id' => $userId,
                    'file_ids' => $fileIds,
                    'project_id' => $projectId,
                ]);

                // Mark task as failed if we have batch key
                if (! empty($batchKey)) {
                    $this->statusManager->setTaskFailed($batchKey, 'Invalid batch move event data: missing required parameters');
                }

                return Result::ACK;
            }

            // Log the received parameters for debugging
            $this->logger->debug('File batch move event parameters extracted', [
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
            foreach ($fileEntities as $fileEntity) {
                // set cache
                $this->fileEntitiesCache[$fileEntity->getFileId()] = $fileEntity;
                $files[] = TaskFileItemDTO::fromEntity($fileEntity, $projectEntity->getWorkDir())->toArray();
            }
            $fileTree = FileTreeUtil::assembleFilesTree($files);

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

            $this->logger->info('File batch move event processed successfully', [
                'batch_key' => $batchKey,
                'file_count' => count($fileIds),
            ]);

            return Result::ACK;
        } catch (Throwable $e) {
            $this->logger->error('Failed to process file batch move event', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'data' => $data,
            ]);

            // Mark task as failed if we have batch key
            $batchKey = $data['batch_key'] ?? '';
            if (! empty($batchKey)) {
                $this->statusManager->setTaskFailed($batchKey, $e->getMessage());
            }

            // Return ACK to avoid retrying failed message
            return Result::ACK;
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
                if (! empty($targetEntity)) {
                    $this->taskFileDomainService->deleteById($fileEntity->getFileId());
                }
            }

            $this->logger->debug('Moving file', [
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
        if (is_null($targetFileEntity)) {
            // 目录不存在，创建一个新的目录
            $targetFileEntity = $this->taskFileDomainService->copyEntity($oldFileEntity, $parentId, $newFileKey, $workDir);
        }

        // 如文件夹下已经没有文件了，或者本次移动的数量刚好整个文件夹一起移动
        // 代表原先的文件夹已经没有，则删除该文件夹
        $actualChildrenCount = $this->taskFileDomainService->getSiblingCountByParentId((int) $file['file_id'], $targetFileEntity->getProjectId());
        if ($actualChildrenCount === 0 || count($file['children']) === $actualChildrenCount) {
            $this->taskFileDomainService->deleteProjectFiles($dataIsolation, $oldFileEntity, $workDir);
        }

        return $targetFileEntity;
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

            $this->logger->debug('Progress updated', [
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

            $this->logger->debug('File moving progress updated', [
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

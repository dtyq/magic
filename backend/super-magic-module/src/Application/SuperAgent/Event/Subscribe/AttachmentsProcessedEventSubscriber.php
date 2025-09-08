<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\ProjectFileConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\AttachmentsProcessedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMetadataDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * AttachmentsProcessedEvent事件监听器 - 处理project.js元数据.
 */
#[AsyncListener]
#[Listener]
class AttachmentsProcessedEventSubscriber implements ListenerInterface
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly ProjectMetadataDomainService $projectMetadataDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly LockerInterface $locker,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    /**
     * Listen to events.
     *
     * @return array Array of event classes to listen to
     */
    public function listen(): array
    {
        return [
            AttachmentsProcessedEvent::class,
        ];
    }

    /**
     * Process the event.
     *
     * @param object $event Event object
     */
    public function process(object $event): void
    {
        // Type check
        if (! $event instanceof AttachmentsProcessedEvent) {
            return;
        }

        $this->logger->info('AttachmentsProcessedEventSubscriber triggered', [
            'event_class' => get_class($event),
            'parent_file_id' => $event->parentFileId,
            'project_id' => $event->projectId,
            'task_id' => $event->taskId,
        ]);

        // Process project.js metadata for each attachment
        $this->processProjectMetadata($event);
    }

    /**
     * Process project.js metadata from sibling files under parent directory.
     *
     * @param AttachmentsProcessedEvent $event Event object
     */
    private function processProjectMetadata(AttachmentsProcessedEvent $event): void
    {
        // Try to acquire parent directory level lock
        $lockKey = 'project_metadata_process_lock:' . $event->parentFileId;
        $lockOwner = IdGenerator::getUniqueId32();
        $lockExpireSeconds = 30; // Metadata processing timeout

        $lockAcquired = $this->acquireLock($lockKey, $lockOwner, $lockExpireSeconds);

        if (! $lockAcquired) {
            $this->logger->info('Cannot acquire lock for parent directory metadata processing, skipping', [
                'parent_file_id' => $event->parentFileId,
                'project_id' => $event->projectId,
                'task_id' => $event->taskId,
                'lock_key' => $lockKey,
            ]);
            return; // Skip processing if cannot acquire lock
        }

        $this->logger->info('Acquired lock for parent directory metadata processing', [
            'parent_file_id' => $event->parentFileId,
            'project_id' => $event->projectId,
            'task_id' => $event->taskId,
            'lock_owner' => $lockOwner,
        ]);

        try {
            $projectJsProcessed = 0;
            $projectJsSkipped = 0;

            try {
                // Get sibling files under the parent directory
                $siblingFiles = $this->taskFileDomainService->getSiblingFileEntitiesByParentId(
                    $event->parentFileId,
                    $event->projectId
                );

                $this->logger->info('Retrieved sibling files for metadata processing', [
                    'parent_file_id' => $event->parentFileId,
                    'project_id' => $event->projectId,
                    'task_id' => $event->taskId,
                    'sibling_files_count' => count($siblingFiles),
                ]);

                foreach ($siblingFiles as $fileEntity) {
                    // Check if this is a project.js file
                    if ($fileEntity->getFileName() === ProjectFileConstant::PROJECT_CONFIG_FILENAME) {
                        try {
                            $this->logger->info('Found project.js file, starting metadata processing', [
                                'file_id' => $fileEntity->getFileId(),
                                'file_key' => $fileEntity->getFileKey(),
                                'task_id' => $event->taskId,
                            ]);

                            $this->projectMetadataDomainService->processProjectConfigFile($fileEntity);

                            $this->logger->info('Successfully processed project.js metadata', [
                                'file_id' => $fileEntity->getFileId(),
                                'task_id' => $event->taskId,
                            ]);

                            ++$projectJsProcessed;
                        } catch (Throwable $e) {
                            $this->logger->error('Failed to process project.js metadata', [
                                'file_id' => $fileEntity->getFileId(),
                                'file_key' => $fileEntity->getFileKey(),
                                'task_id' => $event->taskId,
                                'error' => $e->getMessage(),
                                'trace' => $e->getTraceAsString(),
                            ]);

                            ++$projectJsSkipped;
                        }
                    }
                }

                if ($projectJsProcessed > 0 || $projectJsSkipped > 0) {
                    $this->logger->info('Project.js metadata processing completed', [
                        'task_id' => $event->taskId,
                        'files_processed' => $projectJsProcessed,
                        'files_skipped' => $projectJsSkipped,
                        'total_sibling_files' => count($siblingFiles),
                    ]);
                }
            } catch (Throwable $e) {
                $this->logger->error('Failed to retrieve sibling files for metadata processing', [
                    'parent_file_id' => $event->parentFileId,
                    'project_id' => $event->projectId,
                    'task_id' => $event->taskId,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        } finally {
            // Always release the lock
            if ($this->releaseLock($lockKey, $lockOwner)) {
                $this->logger->info('Released lock for parent directory metadata processing', [
                    'parent_file_id' => $event->parentFileId,
                    'lock_owner' => $lockOwner,
                ]);
            } else {
                $this->logger->error('Failed to release lock for parent directory metadata processing', [
                    'parent_file_id' => $event->parentFileId,
                    'lock_key' => $lockKey,
                    'lock_owner' => $lockOwner,
                ]);
            }
        }
    }

    /**
     * Acquire distributed lock.
     */
    private function acquireLock(string $lockKey, string $lockOwner, int $lockExpireSeconds): bool
    {
        return $this->locker->spinLock($lockKey, $lockOwner, $lockExpireSeconds);
    }

    /**
     * Release distributed lock.
     */
    private function releaseLock(string $lockKey, string $lockOwner): bool
    {
        return $this->locker->release($lockKey, $lockOwner);
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\ProjectFileConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\AttachmentsProcessedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileContentSavedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileMovedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileReplacedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileUploadedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AudioProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDisplayConfigDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Hyperf\Coroutine\Coroutine;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Subscriber that processes display_config updates for metadata files
 * (magic.project.js / index.html) across multiple file lifecycle events.
 *
 * Design principle: services dispatch their natural domain events; this
 * subscriber reacts to those events and handles all display_config logic
 * in one cohesive place rather than scattering AttachmentsProcessedEvent
 * dispatches across every service method.
 *
 * Uses a coroutine + distributed lock to process asynchronously without
 * blocking the main request.
 */
#[Listener]
class AttachmentsProcessedEventSubscriber implements ListenerInterface
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly ProjectDisplayConfigDomainService $projectDisplayConfigDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly AudioProjectDomainService $audioProjectDomainService,
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
            // Direct dispatch path: batch-save, upsert-project-file-node, async move new location
            AttachmentsProcessedEvent::class,
            // File created or copied (sync/async) → check if metadata file
            FileUploadedEvent::class,
            // File content saved (save / rollback) → check if metadata file
            FileContentSavedEvent::class,
            // File replaced → check if metadata file
            FileReplacedEvent::class,
            // File moved (sync same-project path) → clear old + process new
            FileMovedEvent::class,
        ];
    }

    /**
     * Process the event.
     *
     * @param object $event Event object
     */
    public function process(object $event): void
    {
        $this->logger->info('AttachmentsProcessedEventSubscriber triggered', [
            'event_class' => get_class($event),
        ]);

        match (true) {
            $event instanceof AttachmentsProcessedEvent => $this->handleAttachmentsProcessed($event),
            $event instanceof FileUploadedEvent => $this->handleFileEvent(
                $event->getFileEntity()
            ),
            $event instanceof FileContentSavedEvent => $this->handleFileEvent(
                $event->getFileEntity()
            ),
            $event instanceof FileReplacedEvent => $this->handleFileEvent(
                $event->getFileEntity()
            ),
            $event instanceof FileMovedEvent => $this->handleFileMovedEvent($event),
            default => null,
        };
    }

    /**
     * Handle the original AttachmentsProcessedEvent (direct dispatch path).
     */
    private function handleAttachmentsProcessed(AttachmentsProcessedEvent $event): void
    {
        $this->logger->info('Handling AttachmentsProcessedEvent', [
            'parent_file_id' => $event->parentFileId,
            'project_id' => $event->projectId,
            'task_id' => $event->taskId,
        ]);

        Coroutine::create(function () use ($event) {
            try {
                $this->processDisplayConfigByParentId(
                    $event->parentFileId,
                    $event->projectId,
                    $event->taskId
                );
            } catch (Throwable $e) {
                $this->logger->error('Failed to process display config (AttachmentsProcessedEvent)', [
                    'parent_file_id' => $event->parentFileId,
                    'project_id' => $event->projectId,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        });
    }

    /**
     * Handle file events that may involve a metadata file at a fixed location
     * (FileUploadedEvent, FileContentSavedEvent, FileReplacedEvent).
     */
    private function handleFileEvent(TaskFileEntity $fileEntity): void
    {
        if (! ProjectFileConstant::isSetMetadataFile($fileEntity->getFileName())) {
            return;
        }

        $parentId = $fileEntity->getParentId();
        if ($parentId === null) {
            return;
        }

        $projectId = $fileEntity->getProjectId();
        $taskId = $fileEntity->getTaskId();

        $this->logger->info('Metadata file event detected, scheduling display_config processing', [
            'file_name' => $fileEntity->getFileName(),
            'file_id' => $fileEntity->getFileId(),
            'parent_id' => $parentId,
            'project_id' => $projectId,
        ]);

        Coroutine::create(function () use ($parentId, $projectId, $taskId) {
            try {
                $this->processDisplayConfigByParentId($parentId, $projectId, $taskId);
            } catch (Throwable $e) {
                $this->logger->error('Failed to process display config (file event)', [
                    'parent_id' => $parentId,
                    'project_id' => $projectId,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        });
    }

    /**
     * Handle FileMovedEvent: when a metadata file is moved, clear the stale
     * display_config from the old directory, then process the new directory.
     */
    private function handleFileMovedEvent(FileMovedEvent $event): void
    {
        $fileEntity = $event->getFileEntity();

        if (! ProjectFileConstant::isSetMetadataFile($fileEntity->getFileName())) {
            return;
        }

        $oldParentId = $event->getOldParentId();
        $newParentId = $fileEntity->getParentId();
        $projectId = $fileEntity->getProjectId();
        $taskId = $fileEntity->getTaskId();

        $this->logger->info('Metadata file moved, scheduling display_config update', [
            'file_name' => $fileEntity->getFileName(),
            'file_id' => $fileEntity->getFileId(),
            'old_parent_id' => $oldParentId,
            'new_parent_id' => $newParentId,
            'project_id' => $projectId,
        ]);

        Coroutine::create(function () use ($oldParentId, $newParentId, $projectId, $taskId) {
            try {
                // Clear stale display_config from the old directory when the parent changed
                if ($oldParentId !== null && $oldParentId !== $newParentId) {
                    $this->projectDisplayConfigDomainService->clearDisplayConfigForOldDirectory(
                        $oldParentId,
                        $projectId
                    );
                }

                // Process new location
                if ($newParentId !== null) {
                    $this->processDisplayConfigByParentId($newParentId, $projectId, $taskId);
                }
            } catch (Throwable $e) {
                $this->logger->error('Failed to process display config (FileMovedEvent)', [
                    'old_parent_id' => $oldParentId,
                    'new_parent_id' => $newParentId,
                    'project_id' => $projectId,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        });
    }

    /**
     * Core logic: find magic.project.js under a given parent directory and
     * run the display_config processing pipeline.
     */
    private function processDisplayConfigByParentId(int $parentFileId, int $projectId, int $taskId): void
    {
        // Try to acquire parent-directory-level lock to prevent concurrent processing
        $lockKey = 'project_display_config_process_lock:' . $parentFileId;
        $lockOwner = IdGenerator::getUniqueId32();
        $lockExpireSeconds = 30;

        $lockAcquired = $this->locker->spinLock($lockKey, $lockOwner, $lockExpireSeconds);

        if (! $lockAcquired) {
            $this->logger->info('Cannot acquire lock for display config processing, skipping', [
                'parent_file_id' => $parentFileId,
                'project_id' => $projectId,
                'lock_key' => $lockKey,
            ]);
            return;
        }

        $this->logger->info('Acquired lock for display config processing', [
            'parent_file_id' => $parentFileId,
            'project_id' => $projectId,
            'lock_owner' => $lockOwner,
        ]);

        try {
            $projectJsProcessed = 0;
            $projectJsSkipped = 0;

            try {
                $siblingFiles = $this->taskFileDomainService->getSiblingFileEntitiesByParentId(
                    $parentFileId,
                    $projectId
                );

                $this->logger->info('Retrieved sibling files for display config processing', [
                    'parent_file_id' => $parentFileId,
                    'project_id' => $projectId,
                    'task_id' => $taskId,
                    'sibling_files_count' => count($siblingFiles),
                ]);

                foreach ($siblingFiles as $fileEntity) {
                    if ($fileEntity->getFileName() === ProjectFileConstant::PROJECT_CONFIG_FILENAME) {
                        try {
                            $this->logger->info('Found project.js file, starting display config processing', [
                                'file_id' => $fileEntity->getFileId(),
                                'file_key' => $fileEntity->getFileKey(),
                                'task_id' => $taskId,
                            ]);

                            $displayConfig = $this->projectDisplayConfigDomainService
                                ->processProjectConfigFile($fileEntity);

                            $this->logger->info('Successfully processed project.js display config', [
                                'file_id' => $fileEntity->getFileId(),
                                'task_id' => $taskId,
                            ]);

                            $this->processProjectMetadataByType($fileEntity, $displayConfig);

                            ++$projectJsProcessed;
                        } catch (Throwable $e) {
                            $this->logger->error('Failed to process project.js display config', [
                                'file_id' => $fileEntity->getFileId(),
                                'file_key' => $fileEntity->getFileKey(),
                                'task_id' => $taskId,
                                'error' => $e->getMessage(),
                                'trace' => $e->getTraceAsString(),
                            ]);
                            ++$projectJsSkipped;
                        }
                    }
                }

                if ($projectJsProcessed > 0 || $projectJsSkipped > 0) {
                    $this->logger->info('Project.js display config processing completed', [
                        'task_id' => $taskId,
                        'files_processed' => $projectJsProcessed,
                        'files_skipped' => $projectJsSkipped,
                        'total_sibling_files' => count($siblingFiles),
                    ]);
                }
            } catch (Throwable $e) {
                $this->logger->error('Failed to retrieve sibling files for display config processing', [
                    'parent_file_id' => $parentFileId,
                    'project_id' => $projectId,
                    'task_id' => $taskId,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        } finally {
            if ($this->locker->release($lockKey, $lockOwner)) {
                $this->logger->info('Released lock for display config processing', [
                    'parent_file_id' => $parentFileId,
                    'lock_owner' => $lockOwner,
                ]);
            } else {
                $this->logger->error('Failed to release lock for display config processing', [
                    'parent_file_id' => $parentFileId,
                    'lock_key' => $lockKey,
                    'lock_owner' => $lockOwner,
                ]);
            }
        }
    }

    /**
     * Process project metadata by type (switch dispatcher).
     *
     * @param TaskFileEntity $fileEntity Project.js file entity
     * @param null|array $metadata Extracted metadata array
     */
    private function processProjectMetadataByType(TaskFileEntity $fileEntity, ?array $metadata): void
    {
        if ($metadata === null) {
            $this->logger->info('No metadata to process by type', [
                'file_id' => $fileEntity->getFileId(),
            ]);
            return;
        }

        $projectType = $metadata['type'] ?? null;

        switch ($projectType) {
            case 'audio':
                $this->processAudioProjectMetadata($fileEntity, $metadata);
                break;
            default:
                $this->logger->info('Project type not processed or unsupported', [
                    'file_id' => $fileEntity->getFileId(),
                    'project_type' => $projectType,
                ]);
                break;
        }
    }

    /**
     * Process audio project metadata (extract and update tags).
     *
     * @param TaskFileEntity $fileEntity Project.js file entity
     * @param array $metadata Extracted metadata array
     */
    private function processAudioProjectMetadata(TaskFileEntity $fileEntity, array $metadata): void
    {
        $tags = $metadata['metadata']['tags'] ?? [];
        if (empty($tags)) {
            $this->logger->info('No tags found in audio project metadata', [
                'file_id' => $fileEntity->getFileId(),
            ]);
            return;
        }

        $this->audioProjectDomainService->updateTags($fileEntity->getProjectId(), $tags);
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\ProjectFileConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\AttachmentsProcessedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMetadataDomainService;
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
            'processed_attachments_count' => count($event->processedAttachments),
            'task_id' => $event->taskContext->getTask()->getTaskId(),
        ]);

        // Process project.js metadata for each attachment
        $this->processProjectMetadata($event);
    }

    /**
     * Process project.js metadata from processed attachments.
     *
     * @param AttachmentsProcessedEvent $event Event object
     */
    private function processProjectMetadata(AttachmentsProcessedEvent $event): void
    {
        $projectJsProcessed = 0;
        $projectJsSkipped = 0;

        foreach ($event->processedAttachments as $fileEntity) {
            // Check if this is a project.js file
            if ($fileEntity->getFileName() === ProjectFileConstant::PROJECT_CONFIG_FILENAME) {
                try {
                    $this->logger->info('Found project.js file, starting metadata processing', [
                        'file_id' => $fileEntity->getFileId(),
                        'file_key' => $fileEntity->getFileKey(),
                        'task_id' => $event->taskContext->getTask()->getTaskId(),
                    ]);

                    $this->projectMetadataDomainService->processProjectConfigFile($fileEntity);

                    $this->logger->info('Successfully processed project.js metadata', [
                        'file_id' => $fileEntity->getFileId(),
                        'task_id' => $event->taskContext->getTask()->getTaskId(),
                    ]);

                    ++$projectJsProcessed;
                } catch (Throwable $e) {
                    $this->logger->error('Failed to process project.js metadata', [
                        'file_id' => $fileEntity->getFileId(),
                        'file_key' => $fileEntity->getFileKey(),
                        'task_id' => $event->taskContext->getTask()->getTaskId(),
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString(),
                    ]);

                    ++$projectJsSkipped;
                }
            }
        }

        if ($projectJsProcessed > 0 || $projectJsSkipped > 0) {
            $this->logger->info('Project.js metadata processing completed', [
                'task_id' => $event->taskContext->getTask()->getTaskId(),
                'files_processed' => $projectJsProcessed,
                'files_skipped' => $projectJsSkipped,
                'total_attachments' => count($event->processedAttachments),
            ]);
        }
    }
}

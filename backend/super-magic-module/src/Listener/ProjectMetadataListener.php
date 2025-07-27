<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Listener;

use Dtyq\SuperMagic\Domain\SuperAgent\Constant\ProjectFileConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\AttachmentsProcessedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMetadataDomainService;
use Hyperf\Contract\StdoutLoggerInterface;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Throwable;

#[Listener]
class ProjectMetadataListener implements ListenerInterface
{
    public function __construct(
        private ProjectMetadataDomainService $projectMetadataDomainService,
        private StdoutLoggerInterface $logger
    ) {
    }

    public function listen(): array
    {
        return [
            AttachmentsProcessedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof AttachmentsProcessedEvent) {
            return;
        }

        $this->logger->info('ProjectMetadataListener triggered', [
            'event_class' => get_class($event),
            'processed_attachments_count' => count($event->processedAttachments),
            'task_id' => $event->taskContext->getTask()->getTaskId(),
        ]);

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
                } catch (Throwable $e) {
                    $this->logger->error('Failed to process project.js metadata', [
                        'file_id' => $fileEntity->getFileId(),
                        'file_key' => $fileEntity->getFileKey(),
                        'task_id' => $event->taskContext->getTask()->getTaskId(),
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString(),
                    ]);
                }
            }
        }
    }
}

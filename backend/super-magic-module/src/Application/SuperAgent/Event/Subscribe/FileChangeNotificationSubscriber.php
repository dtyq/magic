<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Domain\Chat\Entity\ValueObject\SocketEventType;
use App\Domain\Contact\Repository\Persistence\MagicUserRepository;
use App\Infrastructure\Util\SocketIO\SocketIOUtil;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\DirectoryDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileBatchMoveEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileMovedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileRenamedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FilesBatchDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileUploadedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TaskFileItemDTO;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * File change notification subscriber.
 * Listen to all file change events and push WebSocket notifications to clients.
 * Using async listener to avoid blocking the main business process.
 */
#[AsyncListener]
#[Listener]
class FileChangeNotificationSubscriber implements ListenerInterface
{
    private readonly LoggerInterface $logger;

    public function __construct(
        private readonly ProjectDomainService $projectDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly MagicUserRepository $magicUserRepository,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * Listen to all file change events.
     */
    public function listen(): array
    {
        return [
            FileUploadedEvent::class,
            FileDeletedEvent::class,
            DirectoryDeletedEvent::class,
            FilesBatchDeletedEvent::class,
            FileRenamedEvent::class,
            FileMovedEvent::class,
            FileBatchMoveEvent::class,
        ];
    }

    /**
     * Process file change events and push notifications.
     */
    public function process(object $event): void
    {
        try {
            match (true) {
                $event instanceof FileUploadedEvent => $this->handleFileUploaded($event),
                $event instanceof FileDeletedEvent => $this->handleFileDeleted($event),
                $event instanceof DirectoryDeletedEvent => $this->handleDirectoryDeleted($event),
                $event instanceof FilesBatchDeletedEvent => $this->handleBatchDeleted($event),
                $event instanceof FileRenamedEvent => $this->handleFileRenamed($event),
                $event instanceof FileMovedEvent => $this->handleFileMoved($event),
                $event instanceof FileBatchMoveEvent => $this->handleBatchMoved($event),
                default => null,
            };
        } catch (Throwable $e) {
            // Log error but don't throw to avoid affecting main business logic
            $this->logger->error('File change notification failed', [
                'event' => get_class($event),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Handle file uploaded event.
     */
    private function handleFileUploaded(FileUploadedEvent $event): void
    {
        $fileEntity = $event->getFileEntity();
        $projectEntity = $this->projectDomainService->getProjectNotUserId($fileEntity->getProjectId());

        if (! $projectEntity) {
            $this->logger->warning('Project not found for file upload notification', [
                'project_id' => $fileEntity->getProjectId(),
            ]);
            return;
        }

        $pushData = $this->buildPushData(
            operation: 'add',
            projectId: (string) $fileEntity->getProjectId(),
            workspaceId: $projectEntity->getWorkDir(),
            fileEntity: $fileEntity,
            workDir: $projectEntity->getWorkDir()
        );

        $this->pushNotification($event->getUserId(), $pushData);
    }

    /**
     * Handle file deleted event.
     */
    private function handleFileDeleted(FileDeletedEvent $event): void
    {
        $fileEntity = $event->getFileEntity();
        $projectEntity = $this->projectDomainService->getProjectNotUserId($fileEntity->getProjectId());

        if (! $projectEntity) {
            return;
        }

        $pushData = $this->buildPushData(
            operation: 'delete',
            projectId: (string) $fileEntity->getProjectId(),
            workspaceId: $projectEntity->getWorkDir(),
            fileEntity: $fileEntity,
            workDir: $projectEntity->getWorkDir()
        );

        $this->pushNotification($event->getUserId(), $pushData);
    }

    /**
     * Handle directory deleted event.
     */
    private function handleDirectoryDeleted(DirectoryDeletedEvent $event): void
    {
        $fileEntity = $event->getDirectoryEntity();
        $projectEntity = $this->projectDomainService->getProjectNotUserId($fileEntity->getProjectId());

        if (! $projectEntity) {
            return;
        }

        $pushData = $this->buildPushData(
            operation: 'delete',
            projectId: (string) $fileEntity->getProjectId(),
            workspaceId: $projectEntity->getWorkDir(),
            fileEntity: $fileEntity,
            workDir: $projectEntity->getWorkDir()
        );

        $this->pushNotification($event->getUserAuthorization()->getId(), $pushData);
    }

    /**
     * Handle batch deleted event.
     */
    private function handleBatchDeleted(FilesBatchDeletedEvent $event): void
    {
        $projectId = $event->getProjectId();
        $fileIds = $event->getFileIds();
        $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);

        if (! $projectEntity) {
            return;
        }

        // Build batch changes
        $changes = [];
        foreach ($fileIds as $fileId) {
            $changes[] = [
                'operation' => 'delete',
                'file_id' => (string) $fileId,
            ];
        }

        $pushData = [
            'type' => 'super_magic_file_change',
            'project_id' => (string) $projectId,
            'workspace_id' => $projectEntity->getWorkDir(),
            'changes' => $changes,
            'timestamp' => date('c'),
        ];

        $this->pushNotification($event->getUserAuthorization()->getId(), $pushData);
    }

    /**
     * Handle file renamed event.
     */
    private function handleFileRenamed(FileRenamedEvent $event): void
    {
        $fileEntity = $event->getFileEntity();
        $projectEntity = $this->projectDomainService->getProjectNotUserId($fileEntity->getProjectId());

        if (! $projectEntity) {
            return;
        }

        $pushData = $this->buildPushData(
            operation: 'update',
            projectId: (string) $fileEntity->getProjectId(),
            workspaceId: $projectEntity->getWorkDir(),
            fileEntity: $fileEntity,
            workDir: $projectEntity->getWorkDir()
        );

        $this->pushNotification($event->getUserAuthorization()->getId(), $pushData);
    }

    /**
     * Handle file moved event.
     */
    private function handleFileMoved(FileMovedEvent $event): void
    {
        $fileEntity = $event->getFileEntity();
        $projectEntity = $this->projectDomainService->getProjectNotUserId($fileEntity->getProjectId());

        if (! $projectEntity) {
            return;
        }

        $pushData = $this->buildPushData(
            operation: 'update',
            projectId: (string) $fileEntity->getProjectId(),
            workspaceId: $projectEntity->getWorkDir(),
            fileEntity: $fileEntity,
            workDir: $projectEntity->getWorkDir()
        );

        $this->pushNotification($event->getUserAuthorization()->getId(), $pushData);
    }

    /**
     * Handle batch moved event.
     */
    private function handleBatchMoved(FileBatchMoveEvent $event): void
    {
        $projectId = $event->getProjectId();
        $fileIds = $event->getFileIds();
        $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);

        if (! $projectEntity) {
            return;
        }

        // Build batch changes
        $changes = [];
        foreach ($fileIds as $fileId) {
            try {
                $fileEntity = $this->taskFileDomainService->getById($fileId);
                if ($fileEntity) {
                    $fileDto = TaskFileItemDTO::fromEntity($fileEntity, $projectEntity->getWorkDir());
                    $changes[] = [
                        'operation' => 'update',
                        'file_id' => (string) $fileId,
                        'file' => $fileDto->toArray(),
                    ];
                }
            } catch (Throwable $e) {
                $this->logger->warning('Failed to get file info for batch move notification', [
                    'file_id' => $fileId,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if (empty($changes)) {
            return;
        }

        $pushData = [
            'type' => 'super_magic_file_change',
            'project_id' => (string) $projectId,
            'workspace_id' => $projectEntity->getWorkDir(),
            'changes' => $changes,
            'timestamp' => date('c'),
        ];

        $this->pushNotification($event->getUserId(), $pushData);
    }

    /**
     * Build push data structure.
     * @param mixed $fileEntity
     */
    private function buildPushData(
        string $operation,
        string $projectId,
        string $workspaceId,
        $fileEntity,
        string $workDir
    ): array {
        $fileDto = TaskFileItemDTO::fromEntity($fileEntity, $workDir);

        return [
            'type' => 'super_magic_file_change',
            'project_id' => $projectId,
            'workspace_id' => $workspaceId,
            'changes' => [
                [
                    'operation' => $operation,
                    'file_id' => (string) $fileEntity->getFileId(),
                    'file' => $fileDto->toArray(),
                ],
            ],
            'timestamp' => date('c'),
        ];
    }

    /**
     * Push notification via WebSocket.
     */
    private function pushNotification(string $userId, array $pushData): void
    {
        // Get user's magicId from userId
        $magicId = $this->getMagicIdByUserId($userId);

        if (empty($magicId)) {
            $this->logger->warning('Cannot get magicId for user', ['user_id' => $userId]);
            return;
        }

        $this->logger->info('Pushing file change notification', [
            'magic_id' => $magicId,
            'project_id' => $pushData['project_id'],
            'changes_count' => count($pushData['changes']),
        ]);

        // Push via WebSocket
        SocketIOUtil::sendIntermediate(
            SocketEventType::Intermediate,
            $magicId,
            $pushData
        );
    }

    /**
     * Get magicId by userId.
     */
    private function getMagicIdByUserId(string $userId): string
    {
        try {
            $userEntity = $this->magicUserRepository->getUserById($userId);
            if ($userEntity) {
                return (string) $userEntity->getMagicId();
            }
        } catch (Throwable $e) {
            $this->logger->error('Failed to get magicId', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);
        }
        return '';
    }
}

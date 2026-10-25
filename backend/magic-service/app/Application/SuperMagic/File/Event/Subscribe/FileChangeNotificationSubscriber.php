<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\Event\Subscribe;

use App\Domain\Chat\Entity\ValueObject\SocketEventType;
use App\Domain\Contact\Repository\Persistence\MagicUserRepository;
use App\Domain\SuperMagic\Common\Event\DeleteEventSource;
use App\Domain\SuperMagic\File\Constant\ProjectFileConstant;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileChangeOrigin;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileMoveChangeSet;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;
use App\Domain\SuperMagic\File\Event\CheckpointRollbackFilesChangedEvent;
use App\Domain\SuperMagic\File\Event\DirectoryDeletedEvent;
use App\Domain\SuperMagic\File\Event\FileBatchMoveCompletedEvent;
use App\Domain\SuperMagic\File\Event\FileContentSavedEvent;
use App\Domain\SuperMagic\File\Event\FileDeletedEvent;
use App\Domain\SuperMagic\File\Event\FileMovedEvent;
use App\Domain\SuperMagic\File\Event\FileRenamedEvent;
use App\Domain\SuperMagic\File\Event\FileReplacedEvent;
use App\Domain\SuperMagic\File\Event\FilesBatchDeletedEvent;
use App\Domain\SuperMagic\File\Event\FileUploadedEvent;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Infrastructure\SuperMagic\Utils\RelativeFilePathUtil;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\SocketIO\SocketIOUtil;
use App\Interfaces\SuperMagic\File\DTO\Response\TaskFileItemDTO;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * File change notification subscriber.
 * Listen to all file change events and push WebSocket notifications to clients.
 * Using async listener to avoid blocking the main business process.
 *
 * Notification scope:
 * - Only TaskFileEntity with space_type = FileSpaceType::PROJECT->value can
 *   produce project file change notifications.
 * - User-space and topic-space files never produce project file notifications,
 *   even when their project_id is greater than zero.
 * - Deletes that qualify for the file recycle bin are not pushed as project
 *   file changes; the recycle-bin subscriber owns that lifecycle.
 * - File version creation does not publish a file change notification.
 *   Version rollback may publish FileContentSavedEvent for other subscribers,
 *   but VERSION_ROLLBACK is intentionally ignored by this subscriber.
 * - For batch events, the same project-space rule is applied per entity before
 *   changes, parent refresh IDs, and WebSocket messages are built.
 */
#[AsyncListener(driver: 'coroutine')]
#[Listener(priority: -100)]
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
            FileBatchMoveCompletedEvent::class,
            FileContentSavedEvent::class,
            FileReplacedEvent::class,
            CheckpointRollbackFilesChangedEvent::class,
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
                $event instanceof FileBatchMoveCompletedEvent => $this->handleBatchMoveCompleted($event),
                $event instanceof FileContentSavedEvent => $this->handleFileContentSaved($event),
                $event instanceof FileReplacedEvent => $this->handleFileReplaced($event),
                $event instanceof CheckpointRollbackFilesChangedEvent => $this->handleCheckpointRollbackFilesChanged($event),
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
        if ($this->isUserSpaceFile($fileEntity)) {
            $this->pushNotification(
                $event->getUserId(),
                $this->buildUserPushData('add', $fileEntity, $event->getOrganizationCode())
            );
            return;
        }
        if (! $this->isProjectSpaceFile($fileEntity)) {
            return;
        }
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
            workspaceId: $this->getProjectWorkspaceId($projectEntity),
            fileEntity: $fileEntity,
            workDir: $projectEntity->getWorkDir(),
            organizationCode: $event->getOrganizationCode(),
            conversationId: '',
            topicId: (string) $fileEntity->getTopicId()
        );

        $this->pushNotification($event->getUserId(), $pushData);
    }

    /**
     * Handle file deleted event.
     */
    private function handleFileDeleted(FileDeletedEvent $event): void
    {
        // Internal overwrites during batch moves are covered by FileBatchMoveCompletedEvent.
        if ($event->getSource() === DeleteEventSource::InternalOverwrite
            || $this->shouldSkipRecycleBinDelete($event->getFileEntity(), $event->getSource())
            || ! $this->isProjectSpaceFile($event->getFileEntity())) {
            return;
        }

        $fileEntity = $event->getFileEntity();
        if ($this->isUserSpaceFile($fileEntity)) {
            $this->pushNotification(
                $event->getUserId(),
                $this->buildUserPushData('delete', $fileEntity, $event->getOrganizationCode())
            );
            return;
        }
        $projectEntity = $this->projectDomainService->getProjectNotUserId($fileEntity->getProjectId());

        if (! $projectEntity) {
            return;
        }

        $pushData = $this->buildPushData(
            operation: 'delete',
            projectId: (string) $fileEntity->getProjectId(),
            workspaceId: $this->getProjectWorkspaceId($projectEntity),
            fileEntity: $fileEntity,
            workDir: $projectEntity->getWorkDir(),
            organizationCode: $event->getOrganizationCode(),
            conversationId: '',
            topicId: (string) $fileEntity->getTopicId()
        );

        $this->pushNotification($event->getUserId(), $pushData);
    }

    /**
     * Handle file content saved event.
     */
    private function handleFileContentSaved(FileContentSavedEvent $event): void
    {
        $fileEntity = $event->getFileEntity();
        if ($event->getOrigin() === FileChangeOrigin::VERSION_ROLLBACK) {
            return;
        }
        if ($this->isUserSpaceFile($fileEntity)) {
            $this->pushNotification(
                $event->getUserId(),
                $this->buildUserPushData('update', $fileEntity, $event->getOrganizationCode())
            );
            return;
        }
        if (! $this->isProjectSpaceFile($fileEntity)) {
            return;
        }
        $projectEntity = $this->projectDomainService->getProjectNotUserId($fileEntity->getProjectId());

        if (! $projectEntity) {
            $this->logger->warning('Project not found for file content saved notification', [
                'project_id' => $fileEntity->getProjectId(),
            ]);
            return;
        }

        $pushData = $this->buildPushData(
            operation: 'update',
            projectId: (string) $fileEntity->getProjectId(),
            workspaceId: $this->getProjectWorkspaceId($projectEntity),
            fileEntity: $fileEntity,
            workDir: $projectEntity->getWorkDir(),
            organizationCode: $event->getOrganizationCode(),
            conversationId: '',
            topicId: (string) $fileEntity->getTopicId()
        );

        $this->pushNotification($event->getUserId(), $pushData);
    }

    /**
     * Handle directory deleted event.
     */
    private function handleDirectoryDeleted(DirectoryDeletedEvent $event): void
    {
        // Internal overwrites during batch moves are covered by FileBatchMoveCompletedEvent.
        if ($event->getSource() === DeleteEventSource::InternalOverwrite
            || $this->shouldSkipRecycleBinDelete($event->getDirectoryEntity(), $event->getSource())
            || ! $this->isProjectSpaceFile($event->getDirectoryEntity())) {
            return;
        }

        $fileEntity = $event->getDirectoryEntity();
        if ($this->isUserSpaceFile($fileEntity)) {
            $authorization = $event->getUserAuthorization();
            $this->pushNotification(
                $authorization->getId(),
                $this->buildUserPushData('delete', $fileEntity, $authorization->getOrganizationCode())
            );
            return;
        }
        $projectEntity = $this->projectDomainService->getProjectNotUserId($fileEntity->getProjectId());

        if (! $projectEntity) {
            return;
        }

        $userAuthorization = $event->getUserAuthorization();
        $pushData = $this->buildPushData(
            operation: 'delete',
            projectId: (string) $fileEntity->getProjectId(),
            workspaceId: $this->getProjectWorkspaceId($projectEntity),
            fileEntity: $fileEntity,
            workDir: $projectEntity->getWorkDir(),
            organizationCode: $userAuthorization->getOrganizationCode(),
            conversationId: '',
            topicId: (string) $fileEntity->getTopicId()
        );

        $this->pushNotification($userAuthorization->getId(), $pushData);
    }

    /**
     * Handle batch deleted event.
     */
    private function handleBatchDeleted(FilesBatchDeletedEvent $event): void
    {
        $userFileEntities = array_values(array_filter(
            $event->getAllEntities(),
            fn (TaskFileEntity $fileEntity): bool => $this->isUserSpaceFile($fileEntity)
        ));
        if ($userFileEntities !== []) {
            if ($this->shouldSkipRecycleBinDeleteForBatch($userFileEntities, $event->getSource())) {
                return;
            }
            $authorization = $event->getUserAuthorization();
            $changes = array_map(
                static fn (TaskFileEntity $fileEntity): array => [
                    'operation' => 'delete',
                    'file_id' => (string) $fileEntity->getFileId(),
                ],
                $userFileEntities,
            );
            $this->pushNotification(
                $authorization->getId(),
                $this->buildUserBatchPushData(
                    $changes,
                    $authorization->getOrganizationCode(),
                    array_map(static fn (TaskFileEntity $file): ?int => $file->getParentId(), $userFileEntities),
                )
            );
            return;
        }
        $projectId = $event->getProjectId();
        $fileEntities = $this->taskFileDomainService->filterProjectSpaceFiles($event->getAllEntities());
        if (empty($fileEntities) || $this->shouldSkipRecycleBinDeleteForBatch($fileEntities, $event->getSource())) {
            return;
        }
        $fileIds = array_map(
            static fn (TaskFileEntity $fileEntity): int => $fileEntity->getFileId(),
            $fileEntities
        );
        $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);

        if (! $projectEntity) {
            return;
        }

        $userAuthorization = $event->getUserAuthorization();

        // Build batch changes
        $changes = [];
        foreach ($fileIds as $fileId) {
            $changes[] = [
                'operation' => 'delete',
                'file_id' => (string) $fileId,
            ];
        }

        $pushData = $this->buildBatchPushData(
            projectId: (string) $projectId,
            workspaceId: $this->getProjectWorkspaceId($projectEntity),
            changes: $changes,
            organizationCode: $userAuthorization->getOrganizationCode(),
            topicId: '',
            refreshParentIds: $this->collectMetadataRefreshParentIds($fileEntities)
        );

        $this->pushNotification($userAuthorization->getId(), $pushData);
    }

    /**
     * Handle file renamed event.
     */
    private function handleFileRenamed(FileRenamedEvent $event): void
    {
        $fileEntity = $event->getFileEntity();
        if ($this->isUserSpaceFile($fileEntity)) {
            $authorization = $event->getUserAuthorization();
            $this->pushNotification(
                $authorization->getId(),
                $this->buildUserPushData('update', $fileEntity, $authorization->getOrganizationCode())
            );
            return;
        }
        if (! $this->isProjectSpaceFile($fileEntity)) {
            return;
        }
        $projectEntity = $this->projectDomainService->getProjectNotUserId($fileEntity->getProjectId());

        if (! $projectEntity) {
            return;
        }

        $userAuthorization = $event->getUserAuthorization();
        $pushData = $this->buildPushData(
            operation: 'update',
            projectId: (string) $fileEntity->getProjectId(),
            workspaceId: $this->getProjectWorkspaceId($projectEntity),
            fileEntity: $fileEntity,
            workDir: $projectEntity->getWorkDir(),
            organizationCode: $userAuthorization->getOrganizationCode(),
            conversationId: '',
            topicId: (string) $fileEntity->getTopicId()
        );

        $this->pushNotification($userAuthorization->getId(), $pushData);
    }

    /**
     * Handle file moved event.
     */
    private function handleFileMoved(FileMovedEvent $event): void
    {
        $fileEntity = $event->getFileEntity();
        if ($this->isUserSpaceFile($fileEntity)) {
            $authorization = $event->getUserAuthorization();
            $changes = [];
            $overwrittenFile = $event->getOverwrittenFile();
            if ($overwrittenFile !== null && $this->isUserSpaceFile($overwrittenFile)) {
                $changes[] = ['operation' => 'delete', 'file_id' => (string) $overwrittenFile->getFileId()];
            }
            $changes[] = [
                'operation' => 'update',
                'file_id' => (string) $fileEntity->getFileId(),
                'file' => TaskFileItemDTO::fromEntity($fileEntity)->toArray(),
            ];
            $parentIds = [$fileEntity->getParentId(), $event->getOldParentId(), $overwrittenFile?->getParentId()];
            $this->pushNotification(
                $authorization->getId(),
                $this->buildUserBatchPushData($changes, $authorization->getOrganizationCode(), $parentIds)
            );
            return;
        }
        if (! $this->isProjectSpaceFile($fileEntity)) {
            return;
        }
        $projectEntity = $this->projectDomainService->getProjectNotUserId($fileEntity->getProjectId());

        if (! $projectEntity) {
            return;
        }

        $userAuthorization = $event->getUserAuthorization();
        $changes = [];

        // 1. Record delete for the overwritten file (if any)
        $overwrittenFile = $event->getOverwrittenFile();
        if ($overwrittenFile !== null && $this->isProjectSpaceFile($overwrittenFile)) {
            $changes[] = [
                'operation' => 'delete',
                'file_id' => (string) $overwrittenFile->getFileId(),
            ];
        }

        // 2. Record update for the moved file
        $relativeFilePath = $this->buildRelativeFilePathForEntity($fileEntity, $fileEntity->getProjectId());
        $fileDto = TaskFileItemDTO::fromEntity($fileEntity, $projectEntity->getWorkDir(), $relativeFilePath);
        $changes[] = [
            'operation' => 'update',
            'file_id' => (string) $fileEntity->getFileId(),
            'file' => $fileDto->toArray(),
        ];

        // 3. Collect refresh_parent_ids: new parent + overwritten file parent + old parent
        $parentIdSet = [];
        $newParentId = $fileEntity->getParentId();
        if ($newParentId !== null && $newParentId > 0) {
            $parentIdSet[$newParentId] = true;
        }
        if ($overwrittenFile !== null) {
            $owParentId = $overwrittenFile->getParentId();
            if ($owParentId !== null && $owParentId > 0) {
                $parentIdSet[$owParentId] = true;
            }
        }
        $oldParentId = $event->getOldParentId();
        if ($oldParentId !== null && $oldParentId > 0) {
            $parentIdSet[$oldParentId] = true;
        }
        $refreshParentIds = array_map('strval', array_keys($parentIdSet));

        $pushData = $this->buildBatchPushData(
            projectId: (string) $fileEntity->getProjectId(),
            workspaceId: $this->getProjectWorkspaceId($projectEntity),
            changes: $changes,
            organizationCode: $userAuthorization->getOrganizationCode(),
            conversationId: '',
            topicId: (string) $fileEntity->getTopicId(),
            refreshParentIds: $refreshParentIds
        );

        $this->pushNotification($userAuthorization->getId(), $pushData);
    }

    /**
     * Handle batch move completed event.
     * Builds a single aggregated notification from the FileMoveChangeSet.
     * Query count is O(1): one getFilesByIds + one getFilesWithParentsByIds regardless of batch size.
     */
    private function handleBatchMoveCompleted(FileBatchMoveCompletedEvent $event): void
    {
        $changeSet = $event->getChangeSet();
        $targetProjectId = $event->getTargetProjectId();

        $userDeleted = array_values(array_filter(
            $changeSet->getDeletedFileEntities(),
            fn (TaskFileEntity $fileEntity): bool => $this->isUserSpaceFile($fileEntity)
        ));
        $userIds = array_merge($changeSet->getAddedFileIds(), $changeSet->getUpdatedFileIds());
        $userLive = $userIds === []
            ? []
            : $this->taskFileDomainService->getFilesByIds($userIds, $targetProjectId, FileSpaceType::USER->value);
        if ($userDeleted !== [] || $userLive !== []) {
            $changes = array_map(
                static fn (TaskFileEntity $fileEntity): array => [
                    'operation' => 'delete',
                    'file_id' => (string) $fileEntity->getFileId(),
                ],
                $userDeleted,
            );
            $addedIds = array_flip($changeSet->getAddedFileIds());
            foreach ($userLive as $fileEntity) {
                $changes[] = [
                    'operation' => isset($addedIds[$fileEntity->getFileId()]) ? 'add' : 'update',
                    'file_id' => (string) $fileEntity->getFileId(),
                    'file' => TaskFileItemDTO::fromEntity($fileEntity)->toArray(),
                ];
            }
            if ($changes !== []) {
                $this->pushNotification(
                    $event->getUserId(),
                    $this->buildUserBatchPushData(
                        $changes,
                        $event->getOrganizationCode(),
                        array_merge(
                            array_map(static fn (TaskFileEntity $file): ?int => $file->getParentId(), $userDeleted),
                            array_map(static fn (TaskFileEntity $file): ?int => $file->getParentId(), $userLive),
                        ),
                    )
                );
            }
            return;
        }

        $projectEntity = $this->projectDomainService->getProjectNotUserId($targetProjectId);
        if (! $projectEntity) {
            return;
        }

        $changes = [];

        // 1. Deletes — entities were captured before soft-delete, no re-query needed
        foreach ($changeSet->getDeletedFileEntities() as $fileEntity) {
            if (! $this->isProjectSpaceFile($fileEntity)) {
                continue;
            }
            $changes[] = [
                'operation' => 'delete',
                'file_id' => (string) $fileEntity->getFileId(),
            ];
        }

        // 2. Added + Updated — one batch load
        $addedFileIds = $changeSet->getAddedFileIds();
        $updatedFileIds = $changeSet->getUpdatedFileIds();
        $allLiveIds = array_merge($addedFileIds, $updatedFileIds);

        $liveEntities = empty($allLiveIds)
            ? []
            : $this->taskFileDomainService->getFilesByIds($allLiveIds, $targetProjectId, FileSpaceType::PROJECT->value);

        // Build relative paths in one shot (internally uses one getFilesWithParentsByIds call)
        $relPathMap = $this->buildRelativeFilePathsForEntities($liveEntities, $targetProjectId);

        $liveById = [];
        foreach ($liveEntities as $liveEntity) {
            $liveById[$liveEntity->getFileId()] = $liveEntity;
        }

        foreach ($addedFileIds as $fileId) {
            $liveEntity = $liveById[$fileId] ?? null;
            if ($liveEntity === null) {
                continue;
            }
            $fileDto = TaskFileItemDTO::fromEntity($liveEntity, $projectEntity->getWorkDir(), $relPathMap[$liveEntity->getFileId()] ?? null);
            $changes[] = ['operation' => 'add', 'file_id' => (string) $fileId, 'file' => $fileDto->toArray()];
        }

        foreach ($updatedFileIds as $fileId) {
            $liveEntity = $liveById[$fileId] ?? null;
            if ($liveEntity === null) {
                continue;
            }
            $fileDto = TaskFileItemDTO::fromEntity($liveEntity, $projectEntity->getWorkDir(), $relPathMap[$liveEntity->getFileId()] ?? null);
            $changes[] = ['operation' => 'update', 'file_id' => (string) $fileId, 'file' => $fileDto->toArray()];
        }

        if (empty($changes)) {
            return;
        }

        // Derive topic_id from first live entity that has one
        $topicId = '';
        foreach ($liveEntities as $liveEntity) {
            if ($liveEntity->getTopicId() > 0) {
                $topicId = (string) $liveEntity->getTopicId();
                break;
            }
        }

        // Refresh parent IDs scoped to the target project
        $refreshParentIds = array_map('strval', $changeSet->getAffectedParentIdsForProject($targetProjectId));

        $pushData = $this->buildBatchPushData(
            projectId: (string) $targetProjectId,
            workspaceId: $this->getProjectWorkspaceId($projectEntity),
            changes: $changes,
            organizationCode: $event->getOrganizationCode(),
            topicId: $topicId,
            refreshParentIds: $refreshParentIds
        );

        $this->pushNotification($event->getUserId(), $pushData);
    }

    /**
     * Handle file replaced event.
     */
    private function handleFileReplaced(FileReplacedEvent $event): void
    {
        $fileEntity = $event->getFileEntity();
        if ($this->isUserSpaceFile($fileEntity)) {
            $authorization = $event->getUserAuthorization();
            $this->pushNotification(
                $authorization->getId(),
                $this->buildUserPushData('update', $fileEntity, $authorization->getOrganizationCode())
            );
            return;
        }
        if (! $this->isProjectSpaceFile($fileEntity)) {
            return;
        }
        $projectEntity = $this->projectDomainService->getProjectNotUserId($fileEntity->getProjectId());

        if (! $projectEntity) {
            $this->logger->warning('Project not found for file replace notification', [
                'project_id' => $fileEntity->getProjectId(),
            ]);
            return;
        }

        $userAuthorization = $event->getUserAuthorization();
        $pushData = $this->buildPushData(
            operation: 'update',
            projectId: (string) $fileEntity->getProjectId(),
            workspaceId: $this->getProjectWorkspaceId($projectEntity),
            fileEntity: $fileEntity,
            workDir: $projectEntity->getWorkDir(),
            organizationCode: $userAuthorization->getOrganizationCode(),
            conversationId: '',
            topicId: (string) $fileEntity->getTopicId()
        );

        $this->pushNotification($userAuthorization->getId(), $pushData);
    }

    /**
     * Handle checkpoint rollback files changed event.
     */
    private function handleCheckpointRollbackFilesChanged(CheckpointRollbackFilesChangedEvent $event): void
    {
        $projectId = $event->getProjectId();
        $fileChanges = $event->getFileChanges();
        if (empty($fileChanges)) {
            return;
        }
        $fileChanges = array_slice($fileChanges, 0, 500);

        $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);
        if (! $projectEntity) {
            return;
        }

        $fileIds = [];
        foreach ($fileChanges as $fileChange) {
            $fileId = (int) ($fileChange['file_id'] ?? 0);
            if ($fileId > 0) {
                $fileIds[$fileId] = $fileId;
            }
        }
        if (empty($fileIds)) {
            return;
        }

        // Rollback delete may target a file that has already been soft-deleted
        // in task_file metadata. Keep the entity available for parent/project
        // context, while still emitting a delete payload without a file DTO.
        $fileEntities = $this->taskFileDomainService->getFilesByIdsWithTrash(
            array_values($fileIds),
            $projectId,
            FileSpaceType::PROJECT->value
        );
        $fileEntitiesById = [];
        foreach ($fileEntities as $fileEntity) {
            $fileEntitiesById[$fileEntity->getFileId()] = $fileEntity;
        }

        $relativeFilePathMap = $this->buildRelativeFilePathsForEntities($fileEntities, $projectId);
        $changes = [];
        foreach ($fileChanges as $fileChange) {
            $fileId = (int) ($fileChange['file_id'] ?? 0);
            $fileEntity = $fileEntitiesById[$fileId] ?? null;
            if (! $fileEntity) {
                continue;
            }

            $operation = $this->normalizeFileChangeOperation($fileChange['operation'] ?? '');
            $change = [
                'operation' => $operation,
                'file_id' => (string) $fileEntity->getFileId(),
            ];
            if ($operation !== 'delete') {
                $fileDto = TaskFileItemDTO::fromEntity(
                    $fileEntity,
                    $projectEntity->getWorkDir(),
                    $relativeFilePathMap[$fileEntity->getFileId()] ?? null
                );
                $change['file'] = $fileDto->toArray();
            }
            $changes[] = $change;
        }
        if (empty($changes)) {
            return;
        }

        $pushData = $this->buildBatchPushData(
            projectId: (string) $projectId,
            workspaceId: $this->getProjectWorkspaceId($projectEntity),
            changes: $changes,
            organizationCode: $event->getOrganizationCode(),
            topicId: $event->getTopicId() > 0 ? (string) $event->getTopicId() : '',
            refreshParentIds: $this->collectMetadataRefreshParentIds($fileEntities)
        );

        $this->pushNotification($event->getUserId(), $pushData);
    }

    private function normalizeFileChangeOperation(mixed $operation): string
    {
        return in_array($operation, ['add', 'update', 'delete'], true) ? $operation : 'update';
    }

    private function isProjectSpaceFile(TaskFileEntity $fileEntity): bool
    {
        return $this->taskFileDomainService->isProjectSpaceFile($fileEntity);
    }

    private function isUserSpaceFile(TaskFileEntity $fileEntity): bool
    {
        return $fileEntity->getSpaceType() === FileSpaceType::USER->value;
    }

    /** Build the compact user-space event consumed by the MagicFS directory cache. */
    private function buildUserPushData(
        string $operation,
        TaskFileEntity $fileEntity,
        string $organizationCode,
    ): array {
        $change = [
            'operation' => $operation,
            'file_id' => (string) $fileEntity->getFileId(),
        ];
        if ($operation !== 'delete') {
            $change['file'] = TaskFileItemDTO::fromEntity($fileEntity)->toArray();
        }

        return $this->buildUserBatchPushData(
            [$change],
            $organizationCode,
            [$fileEntity->getParentId()]
        );
    }

    /** @param array<int, array<string, mixed>> $changes */
    private function buildUserBatchPushData(
        array $changes,
        string $organizationCode,
        array $refreshParentIds = [],
    ): array {
        return $this->buildBatchPushData(
            projectId: '',
            workspaceId: '',
            changes: $changes,
            organizationCode: $organizationCode,
            topicId: '',
            refreshParentIds: array_values(array_unique(array_filter(
                array_map(static fn ($id): string => (string) ($id ?? ''), $refreshParentIds),
                static fn (string $id): bool => $id !== '' && $id !== '0'
            ))),
            spaceType: FileSpaceType::USER->value,
        );
    }

    private function shouldSkipRecycleBinDelete(TaskFileEntity $fileEntity, DeleteEventSource $source): bool
    {
        return $this->taskFileDomainService->shouldEnterRecycleBin($fileEntity, $source);
    }

    /**
     * @param TaskFileEntity[] $fileEntities
     */
    private function shouldSkipRecycleBinDeleteForBatch(array $fileEntities, DeleteEventSource $source): bool
    {
        foreach ($fileEntities as $fileEntity) {
            if ($this->shouldSkipRecycleBinDelete($fileEntity, $source)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Build push data structure for single file operation.
     * @param mixed $fileEntity
     */
    private function buildPushData(
        string $operation,
        string $projectId,
        string $workspaceId,
        $fileEntity,
        string $workDir,
        string $organizationCode = '',
        string $conversationId = '',
        string $topicId = ''
    ): array {
        $relativeFilePath = $this->buildRelativeFilePathForEntity($fileEntity, (int) $projectId);
        $fileDto = TaskFileItemDTO::fromEntity($fileEntity, $workDir, $relativeFilePath);

        $changes = [
            [
                'operation' => $operation,
                'file_id' => (string) $fileEntity->getFileId(),
                'file' => $fileDto->toArray(),
            ],
        ];

        return $this->buildBatchPushData(
            projectId: $projectId,
            workspaceId: $workspaceId,
            changes: $changes,
            organizationCode: $organizationCode,
            conversationId: $conversationId,
            topicId: $topicId,
            refreshParentIds: $this->collectMetadataRefreshParentIds([$fileEntity])
        );
    }

    /**
     * @param TaskFileEntity[] $fileEntities
     * @return string[]
     */
    private function collectMetadataRefreshParentIds(array $fileEntities): array
    {
        $parentIdSet = [];
        foreach ($fileEntities as $fileEntity) {
            if (! $fileEntity instanceof TaskFileEntity) {
                continue;
            }
            if (! ProjectFileConstant::isSetMetadataFile($fileEntity->getFileName())) {
                continue;
            }

            $parentId = $fileEntity->getParentId();
            if ($parentId !== null && $parentId > 0) {
                $parentIdSet[$parentId] = true;
            }
        }

        return array_map('strval', array_keys($parentIdSet));
    }

    /**
     * Build batch push data structure.
     */
    private function buildBatchPushData(
        string $projectId,
        string $workspaceId,
        array $changes,
        string $organizationCode = '',
        string $conversationId = '',
        string $topicId = '',
        array $refreshParentIds = [],
        string $spaceType = 'project',
    ): array {
        $message = [
            'type' => 'super_magic_file_change',
            'space_type' => $spaceType,
            'project_id' => $projectId,
            'workspace_id' => $workspaceId,
            'topic_id' => $topicId,
            'changes' => $changes,
            'timestamp' => date('c'),
        ];

        if (! empty($refreshParentIds)) {
            $message['refresh_parent_ids'] = $refreshParentIds;
        }

        return [
            'type' => 'seq',
            'seq' => [
                'magic_id' => '',
                'seq_id' => (string) IdGenerator::getSnowId(),
                'message_id' => '',
                'refer_message_id' => '',
                'sender_message_id' => '',
                'conversation_id' => $conversationId,
                'organization_code' => $organizationCode,
                'message' => $message,
            ],
        ];
    }

    /**
     * Build relative file path based on parent_id chain, consistent with createFile response.
     */
    private function buildRelativeFilePathForEntity(TaskFileEntity $fileEntity, int $projectId): ?string
    {
        try {
            $parentId = $fileEntity->getParentId();
            $filesWithParents = [];
            if ($parentId > 0) {
                // Query from parent to avoid losing path when the changed file has been soft-deleted.
                $filesWithParents = $this->taskFileDomainService->getFilesWithParentsByIds([$parentId], $projectId);
            }

            $fileMap = RelativeFilePathUtil::indexByFileId($filesWithParents);
            $fileMap[$fileEntity->getFileId()] = $fileEntity;

            return RelativeFilePathUtil::buildPathByParentChain($fileEntity, $fileMap);
        } catch (Throwable $throwable) {
            $this->logger->warning('Failed to build relative file path for notification', [
                'file_id' => $fileEntity->getFileId(),
                'project_id' => $projectId,
                'error' => $throwable->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * @param TaskFileEntity[] $fileEntities
     * @return array<int, string>
     */
    private function buildRelativeFilePathsForEntities(array $fileEntities, int $projectId): array
    {
        if (empty($fileEntities)) {
            return [];
        }

        try {
            $parentIds = [];
            foreach ($fileEntities as $fileEntity) {
                $parentId = $fileEntity->getParentId();
                if ($parentId > 0) {
                    $parentIds[$parentId] = $parentId;
                }
            }

            $filesWithParents = empty($parentIds)
                ? []
                : $this->taskFileDomainService->getFilesWithParentsByIds(array_values($parentIds), $projectId);

            $fileMap = RelativeFilePathUtil::indexByFileId($filesWithParents);
            foreach ($fileEntities as $fileEntity) {
                $fileMap[$fileEntity->getFileId()] = $fileEntity;
            }

            return RelativeFilePathUtil::buildPathMapByParentChain($fileEntities, $fileMap);
        } catch (Throwable $throwable) {
            $this->logger->warning('Failed to build relative file paths for batch notification', [
                'project_id' => $projectId,
                'file_count' => count($fileEntities),
                'error' => $throwable->getMessage(),
            ]);

            return [];
        }
    }

    private function getProjectWorkspaceId(ProjectEntity $projectEntity): string
    {
        $workspaceId = $projectEntity->getWorkspaceId();
        return $workspaceId === null ? '' : (string) $workspaceId;
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

        $message = $pushData['seq']['message'] ?? [];
        $this->logger->info('Pushing file change notification', [
            'magic_id' => $magicId,
            'project_id' => $message['project_id'] ?? '',
            'changes_count' => count($message['changes'] ?? []),
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

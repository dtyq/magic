<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Common\RecycleBin\Service;

use App\Domain\SuperMagic\Common\Event\DeleteEventSource;
use App\Domain\SuperMagic\Common\RecycleBin\Enum\RecycleBinResourceType;
use App\Domain\SuperMagic\Common\RecycleBin\Service\RecycleBinDomainService;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Enum\FileDeletionPolicy;
use App\Domain\SuperMagic\File\Event\DirectoryDeletedEvent;
use App\Domain\SuperMagic\File\Event\FileDeletedEvent;
use App\Domain\SuperMagic\File\Event\FilesBatchDeletedEvent;
use App\Domain\SuperMagic\File\Service\FileDeletionPolicyContext;
use App\Domain\SuperMagic\File\Service\FileDeletionPolicyResolver;
use App\Domain\SuperMagic\File\Service\TaskFileCleanupRecordService;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Task\Repository\Facade\TaskRepositoryInterface;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Domain\SuperMagic\Workspace\Service\WorkspaceDomainService;
use App\Infrastructure\SuperMagic\Utils\RelativeFilePathUtil;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 文件/目录删除后写入统一回收站.
 */
#[Listener]
class FileRecycleBinSubscriber implements ListenerInterface
{
    private readonly LoggerInterface $logger;

    public function __construct(
        private readonly RecycleBinDomainService $recycleBinDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly WorkspaceDomainService $workspaceDomainService,
        private readonly FileDeletionPolicyResolver $deletionPolicyResolver,
        private readonly TaskFileCleanupRecordService $cleanupRecordService,
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskRepositoryInterface $taskRepository,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    public function listen(): array
    {
        return [
            FileDeletedEvent::class,
            DirectoryDeletedEvent::class,
            FilesBatchDeletedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        try {
            $source = match (true) {
                $event instanceof FileDeletedEvent => $event->getSource(),
                $event instanceof DirectoryDeletedEvent => $event->getSource(),
                $event instanceof FilesBatchDeletedEvent => $event->getSource(),
                default => null,
            };

            if ($source === null || ! $this->shouldRecordSource($source)) {
                return;
            }

            if ($event instanceof FileDeletedEvent && ! $event->getFileEntity()->isProjectFile()) {
                return;
            }
            if ($event instanceof DirectoryDeletedEvent && ! $event->getDirectoryEntity()->isProjectFile()) {
                return;
            }

            match (true) {
                $event instanceof FileDeletedEvent => $this->handleFileDeleted($event),
                $event instanceof DirectoryDeletedEvent => $this->handleDirectoryDeleted($event),
                $event instanceof FilesBatchDeletedEvent => $this->handleFilesBatchDeleted($event),
                default => null,
            };
        } catch (Throwable $e) {
            $this->logger->error('文件删除策略处理失败', [
                'event' => $event::class,
                'event_id' => (string) $event->getEventId(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    private function handleFileDeleted(FileDeletedEvent $event): void
    {
        $entity = $event->getFileEntity();
        $context = $this->buildPolicyContext([$entity], $event->getSource());
        if ($this->deletionPolicyResolver->resolve($entity, $event->getSource(), $context) === FileDeletionPolicy::PhysicalDelete) {
            $this->cleanupRecordService->enqueue(
                $entity,
                (string) $event->getEventId(),
                $event->getSource(),
                'deletion_policy',
                $event->getUserId()
            );
            return;
        }

        $this->recordFileDeletion(
            $entity,
            $event->getUserId(),
            $event->getSource(),
            $context
        );
    }

    private function handleDirectoryDeleted(DirectoryDeletedEvent $event): void
    {
        $entity = $event->getDirectoryEntity();
        $context = $this->buildPolicyContext([$entity], $event->getSource());
        if ($this->deletionPolicyResolver->resolve($entity, $event->getSource(), $context) === FileDeletionPolicy::PhysicalDelete) {
            $this->cleanupRecordService->enqueue(
                $entity,
                (string) $event->getEventId(),
                $event->getSource(),
                'deletion_policy',
                $event->getUserAuthorization()->getId()
            );
            return;
        }

        $this->recordFileDeletion(
            $entity,
            $event->getUserAuthorization()->getId(),
            $event->getSource(),
            $context
        );
    }

    private function handleFilesBatchDeleted(FilesBatchDeletedEvent $event): void
    {
        $fileEntities = array_values(array_filter(
            $event->getAllEntities(),
            static fn (TaskFileEntity $entity): bool => $entity->isProjectFile()
        ));
        if ($fileEntities === []) {
            return;
        }

        $context = $this->buildPolicyContext($fileEntities, $event->getSource());

        foreach ($fileEntities as $fileEntity) {
            try {
                if ($this->deletionPolicyResolver->resolve($fileEntity, $event->getSource(), $context) === FileDeletionPolicy::PhysicalDelete) {
                    $this->cleanupRecordService->enqueue(
                        $fileEntity,
                        (string) $event->getEventId(),
                        $event->getSource(),
                        'deletion_policy',
                        $event->getUserId()
                    );
                    continue;
                }
                $this->recordFileDeletion(
                    $fileEntity,
                    $event->getUserId(),
                    $event->getSource(),
                    $context
                );
            } catch (Throwable $e) {
                $this->logger->error('单个文件删除策略处理失败，继续处理批次', [
                    'event_id' => (string) $event->getEventId(),
                    'file_id' => $fileEntity->getFileId(),
                    'project_id' => $fileEntity->getProjectId(),
                    'topic_id' => $fileEntity->getTopicId(),
                    'task_id' => $fileEntity->getTaskId(),
                    'source' => $event->getSource()->value,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    private function shouldRecordSource(DeleteEventSource $source): bool
    {
        return in_array($source, [DeleteEventSource::User, DeleteEventSource::Agent], true);
    }

    /** @param TaskFileEntity[] $entities */
    private function buildPolicyContext(array $entities, DeleteEventSource $source): FileDeletionPolicyContext
    {
        if (in_array($source, [DeleteEventSource::InternalOverwrite, DeleteEventSource::SystemSync], true)) {
            return new FileDeletionPolicyContext();
        }

        $files = $this->loadFileMap($entities);
        $treeContext = new FileDeletionPolicyContext(files: $files);
        $taskIds = [];
        $topicIds = [];
        foreach ($entities as $entity) {
            if ($treeContext->isUnderRootHiddenDirectory((int) $entity->getFileId())) {
                continue;
            }
            if ($entity->getTaskId() > 0) {
                $taskIds[$entity->getTaskId()] = $entity->getTaskId();
            }
            if ($entity->getTopicId() > 0) {
                $topicIds[$entity->getTopicId()] = $entity->getTopicId();
            }
        }

        return new FileDeletionPolicyContext(
            $taskIds === [] ? [] : $this->taskRepository->getTasksByIds(array_values($taskIds)),
            $topicIds === [] ? [] : $this->indexTopics($this->topicDomainService->getTopicsByIds(array_values($topicIds))),
            $files
        );
    }

    /** @param array<int, TopicEntity> $topics */
    private function indexTopics(array $topics): array
    {
        $indexed = [];
        foreach ($topics as $topic) {
            $indexed[$topic->getId()] = $topic;
        }
        return $indexed;
    }

    private function recordFileDeletion(
        TaskFileEntity $fileEntity,
        string $deletedBy,
        DeleteEventSource $source,
        FileDeletionPolicyContext $context
    ): void {
        $fileId = (int) $fileEntity->getFileId();
        if ($fileId <= 0) {
            return;
        }

        $existing = $this->recycleBinDomainService->findByResource(RecycleBinResourceType::File, $fileId);
        if ($existing !== null) {
            return;
        }

        $project = $this->projectDomainService->getProjectNotUserId($fileEntity->getProjectId());
        $workspace = null;
        if ($project !== null && $project->getWorkspaceId() !== null) {
            $workspace = $this->workspaceDomainService->getWorkspaceDetail($project->getWorkspaceId());
        }

        $originalParentId = $fileEntity->getParentId();
        $originalParentName = '';
        if ($originalParentId !== null && $originalParentId > 0) {
            $parent = $context->files[$originalParentId] ?? null;
            $originalParentName = $parent?->getFileName() ?? '';
        }

        $relativeFilePath = RelativeFilePathUtil::buildPathByParentChain($fileEntity, $context->files);

        $this->recycleBinDomainService->recordDeletion(
            resourceType: RecycleBinResourceType::File,
            resourceId: $fileId,
            resourceName: $fileEntity->getFileName(),
            ownerId: $fileEntity->getUserId(),
            deletedBy: $deletedBy,
            parentId: $fileEntity->getProjectId(),
            extraData: [
                'delete_source' => $source->value,
                'is_directory' => $fileEntity->getIsDirectory(),
                'file_key' => $fileEntity->getFileKey(),
                'storage_type' => $fileEntity->getStorageType()->value,
                'source' => $fileEntity->getSource()->value,
                'original_parent_id' => $originalParentId,
                'original_parent_name' => $originalParentName,
                'relative_file_path' => $relativeFilePath,
                'project_id' => $fileEntity->getProjectId(),
                'project_name' => $project?->getProjectName() ?? '',
                'workspace_id' => $project?->getWorkspaceId(),
                'workspace_name' => $workspace?->getName() ?? '',
            ]
        );
    }

    /**
     * @param TaskFileEntity[] $entities
     * @return array<int, TaskFileEntity>
     */
    private function loadFileMap(array $entities): array
    {
        $fileMap = RelativeFilePathUtil::indexByFileId($entities);
        $frontier = $entities;
        $requested = [];
        while ($frontier !== []) {
            $missing = [];
            foreach ($frontier as $file) {
                $parentId = $file->getParentId();
                if ($parentId !== null && $parentId > 0
                    && ! isset($fileMap[$parentId]) && ! isset($requested[$parentId])) {
                    $missing[$parentId] = $parentId;
                    $requested[$parentId] = true;
                }
            }
            if ($missing === []) {
                break;
            }
            // Deletion events arrive after soft deletion; reuse event entities first.
            $frontier = $this->taskFileDomainService->getFilesByIdsWithTrash(array_values($missing));
            foreach ($frontier as $file) {
                $fileMap[$file->getFileId()] = $file;
            }
        }

        return $fileMap;
    }
}

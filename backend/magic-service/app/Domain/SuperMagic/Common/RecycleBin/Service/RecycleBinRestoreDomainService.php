<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Common\RecycleBin\Service;

use App\Application\SuperMagic\Common\RecycleBin\DTO\RestoreConflictDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\RestorePreviewItemDTO;
use App\Domain\SuperMagic\Common\RecycleBin\Entity\RecycleBinEntity;
use App\Domain\SuperMagic\Common\RecycleBin\Enum\RecycleBinResourceType;
use App\Domain\SuperMagic\Common\RecycleBin\Enum\RestoreConflictResolution;
use App\Domain\SuperMagic\Common\RecycleBin\Enum\RestoreConflictType;
use App\Domain\SuperMagic\Common\RecycleBin\Repository\Facade\RecycleBinRepositoryInterface;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectMemberRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Repository\Facade\TopicRepositoryInterface;
use App\Domain\SuperMagic\Workspace\Repository\Facade\WorkspaceRepositoryInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * Recycle bin restore domain service.
 *
 * Handles workspace, project, topic, and file restore (with cascade).
 * File restore supports explicit conflict resolution via conflict_resolutions map.
 */
class RecycleBinRestoreDomainService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected RecycleBinRepositoryInterface $recycleBinRepository,
        protected WorkspaceRepositoryInterface $workspaceRepository,
        protected ProjectRepositoryInterface $projectRepository,
        protected TopicRepositoryInterface $topicRepository,
        protected TaskFileRepositoryInterface $taskFileRepository,
        protected ProjectMemberRepositoryInterface $projectMemberRepository,
        protected MicroAppRepositoryInterface $microAppRepository,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * Batch restore resources (partial success allowed).
     *
     * @param array<int|string, array<string, string>> $conflictResolutions resource_id → [conflict_type → resolution]
     * @return array{succeeded: RecycleBinEntity[], failed: array{entity: RecycleBinEntity, error: string}[]}
     */
    public function restoreBatch(
        array $resourceIds,
        RecycleBinResourceType $resourceType,
        string $userId,
        array $conflictResolutions = []
    ): array {
        $entities = $this->recycleBinRepository->findLatestByResourceIds($resourceIds, $resourceType, $userId);
        $entities = $this->sortRecycleBinEntitiesByDeletedAtDesc($entities);

        if (empty($entities)) {
            return ['succeeded' => [], 'failed' => []];
        }

        $succeeded = [];
        $failed = [];

        if ($resourceType === RecycleBinResourceType::File) {
            $batchContext = $this->buildFileBatchContext($entities);
            // Restore parents before children so that a child's parent is already live
            // when restoreFile() resolves its target parent (no batch-awareness needed there).
            $entities = $this->sortFileEntitiesParentFirst($entities, $batchContext['filesById']);
            $fileRestorePlan = $this->filterDuplicateFileRestoreTargets($entities, $conflictResolutions, $batchContext);
            $entities = $fileRestorePlan['entities'];
            $failed = $fileRestorePlan['failed'];
        }

        foreach ($entities as $entity) {
            try {
                $this->restoreSingle($entity, $userId, $conflictResolutions);
                $succeeded[] = $entity;
            } catch (Throwable $e) {
                $this->logger->error('Failed to restore resource', [
                    'recycle_bin_id' => $entity->getId(),
                    'resource_type' => $entity->getResourceType()->value,
                    'resource_id' => $entity->getResourceId(),
                    'error' => $e->getMessage(),
                ]);

                $failed[] = [
                    'entity' => $entity,
                    'error' => $e->getMessage(),
                ];
            }
        }

        return ['succeeded' => $succeeded, 'failed' => $failed];
    }

    /**
     * Preview file conflicts for a list of resource IDs.
     * Read-only; no side effects.
     *
     * @return array{items_with_conflict: RestorePreviewItemDTO[], items_no_conflict: RestorePreviewItemDTO[]}
     */
    public function previewFileConflicts(array $resourceIds, string $userId): array
    {
        $itemsWithConflict = [];
        $itemsNoConflict = [];

        if (empty($resourceIds)) {
            return ['items_with_conflict' => [], 'items_no_conflict' => []];
        }

        $entities = $this->recycleBinRepository->findLatestByResourceIds(
            $resourceIds,
            RecycleBinResourceType::File,
            $userId
        );
        $entities = $this->sortRecycleBinEntitiesByDeletedAtDesc($entities);
        $batchContext = $this->buildFileBatchContext($entities);
        $filesById = $batchContext['filesById'];
        $selectedDirIds = $batchContext['selectedDirIds'];
        $seenTargetKeys = [];
        $projectExistsCache = [];

        foreach ($entities as $entity) {
            $fileId = (int) $entity->getResourceId();
            $file = $filesById[$fileId] ?? null;

            // File permanently deleted or purged from recycle bin — no actionable conflict
            if ($file === null || $entity->getRemovedAt() !== null || $entity->getPurgedAt() !== null) {
                $itemsNoConflict[] = new RestorePreviewItemDTO(
                    resourceId: (string) $fileId,
                    resourceName: $entity->getResourceName(),
                    isDirectory: false,
                );
                continue;
            }

            if (! $this->projectExistsAndNotDeleted($file->getProjectId(), $projectExistsCache)) {
                $itemsWithConflict[] = new RestorePreviewItemDTO(
                    resourceId: (string) $fileId,
                    resourceName: $file->getFileName(),
                    isDirectory: $file->getIsDirectory(),
                    conflict: new RestoreConflictDTO(
                        type: RestoreConflictType::ProjectMissing,
                    ),
                );
                continue;
            }

            $parentId = $file->getParentId();

            // Step 1: detect parent_missing. A parent that is still soft-deleted but is a
            // directory selected in this same batch counts as available, since it will be
            // restored first (parent-first ordering).
            if ($parentId !== null && $parentId > 0) {
                $parent = $filesById[$parentId] ?? null;
                if (! $this->isParentAvailableInBatch($parentId, $parent, $selectedDirIds)) {
                    $itemsWithConflict[] = new RestorePreviewItemDTO(
                        resourceId: (string) $fileId,
                        resourceName: $file->getFileName(),
                        isDirectory: $file->getIsDirectory(),
                        conflict: new RestoreConflictDTO(
                            type: RestoreConflictType::ParentMissing,
                            originalParentId: $parentId,
                        ),
                    );
                    continue;
                }
            }

            // Step 2: detect duplicate target within the current restore batch.
            $targetKey = $this->buildFileRestoreTargetKey($file, $parentId);
            if (isset($seenTargetKeys[$targetKey])) {
                $itemsWithConflict[] = new RestorePreviewItemDTO(
                    resourceId: (string) $fileId,
                    resourceName: $file->getFileName(),
                    isDirectory: $file->getIsDirectory(),
                    conflict: new RestoreConflictDTO(
                        type: RestoreConflictType::DuplicateRestoreTarget,
                    ),
                );
                continue;
            }
            $seenTargetKeys[$targetKey] = true;

            // Step 3: detect name_conflict (only when parent is healthy)
            $existing = $this->taskFileRepository->getByProjectParentAndName(
                $file->getProjectId(),
                $parentId,
                $file->getFileName()
            );

            if ($existing !== null && $existing->getFileId() !== $file->getFileId()) {
                $itemsWithConflict[] = new RestorePreviewItemDTO(
                    resourceId: (string) $fileId,
                    resourceName: $file->getFileName(),
                    isDirectory: $file->getIsDirectory(),
                    conflict: new RestoreConflictDTO(
                        type: RestoreConflictType::NameConflict,
                        existingFileId: $existing->getFileId(),
                        existingIsDirectory: $existing->getIsDirectory(),
                    ),
                );
                continue;
            }

            $itemsNoConflict[] = new RestorePreviewItemDTO(
                resourceId: (string) $fileId,
                resourceName: $file->getFileName(),
                isDirectory: $file->getIsDirectory(),
            );
        }

        return [
            'items_with_conflict' => $itemsWithConflict,
            'items_no_conflict' => $itemsNoConflict,
        ];
    }

    /**
     * Restore project and its sub-resources without parent check (no recycle bin record deletion).
     */
    public function restoreProjectWithoutParentCheck(int $projectId, string $userId): void
    {
        $restored = $this->projectRepository->restore($projectId, $userId);
        if (! $restored) {
            throw new RuntimeException(trans('recycle_bin.restore.project_failed'));
        }

        $restoredMembers = $this->projectMemberRepository->restoreByProjectIds([$projectId], $userId);
        $this->logger->info('Restored project members', [
            'project_id' => $projectId,
            'member_count' => $restoredMembers,
        ]);

        $excludeTopicIds = $this->recycleBinRepository->findResourceIdsByParent(
            $projectId,
            RecycleBinResourceType::Topic
        );

        $restoredTopics = $this->topicRepository->restoreByProjectId($projectId, $excludeTopicIds, $userId);
        $this->logger->info('Restored topics under project', [
            'project_id' => $projectId,
            'restored_count' => $restoredTopics,
            'excluded_count' => count($excludeTopicIds),
        ]);
    }

    /**
     * Restore topic without parent check (no recycle bin record deletion).
     */
    public function restoreTopicWithoutParentCheck(int $topicId, string $userId): void
    {
        $restored = $this->topicRepository->restore($topicId, $userId);
        if (! $restored) {
            throw new RuntimeException(trans('recycle_bin.restore.topic_failed'));
        }

        $this->logger->info('Topic restored', ['topic_id' => $topicId, 'user_id' => $userId]);
    }

    /**
     * Find project by ID including soft-deleted records.
     */
    public function findProjectByIdWithTrashed(int $projectId): ?ProjectEntity
    {
        return $this->projectRepository->findByIdWithTrashed($projectId);
    }

    /**
     * Find topic by ID including soft-deleted records.
     */
    public function findTopicByIdWithTrashed(int $topicId): ?TopicEntity
    {
        return $this->topicRepository->findByIdWithTrashed($topicId);
    }

    /**
     * @param RecycleBinEntity[] $entities
     * @return RecycleBinEntity[]
     */
    private function sortRecycleBinEntitiesByDeletedAtDesc(array $entities): array
    {
        usort(
            $entities,
            static function (RecycleBinEntity $left, RecycleBinEntity $right): int {
                $deletedAtCompare = strcmp($right->getDeletedAt(), $left->getDeletedAt());
                if ($deletedAtCompare !== 0) {
                    return $deletedAtCompare;
                }

                return ((int) $right->getId()) <=> ((int) $left->getId());
            }
        );

        return $entities;
    }

    /**
     * @param RecycleBinEntity[] $entities
     * @param array<int|string, array<string, string>> $conflictResolutions
     * @param array{filesById: array<int, TaskFileEntity>, selectedDirIds: array<int, bool>} $batchContext
     * @return array{entities: RecycleBinEntity[], failed: array{entity: RecycleBinEntity, error: string}[]}
     */
    private function filterDuplicateFileRestoreTargets(array $entities, array $conflictResolutions, array $batchContext): array
    {
        $selectedEntities = [];
        $failed = [];
        $seenTargetKeys = [];
        $projectExistsCache = [];
        $filesById = $batchContext['filesById'];

        foreach ($entities as $entity) {
            if ($entity->getRemovedAt() !== null || $entity->getPurgedAt() !== null) {
                $selectedEntities[] = $entity;
                continue;
            }

            $fileId = (int) $entity->getResourceId();
            $file = $filesById[$fileId] ?? null;
            if ($file === null) {
                $selectedEntities[] = $entity;
                continue;
            }

            if (! $this->projectExistsAndNotDeleted($file->getProjectId(), $projectExistsCache)) {
                $failed[] = [
                    'entity' => $entity,
                    'error' => trans('recycle_bin.restore.file_project_missing'),
                ];
                continue;
            }

            if ($file->getDeletedAt() === null) {
                $selectedEntities[] = $entity;
                continue;
            }

            $resolution = $conflictResolutions[(string) $fileId] ?? [];

            try {
                $targetParentId = $this->resolveBatchTargetParentId($file, $resolution, $batchContext);
            } catch (RuntimeException) {
                $selectedEntities[] = $entity;
                continue;
            }

            $targetKey = $this->buildFileRestoreTargetKey($file, $targetParentId);
            if (isset($seenTargetKeys[$targetKey])) {
                $failed[] = [
                    'entity' => $entity,
                    'error' => trans('recycle_bin.restore.file_duplicate_restore_target'),
                ];
                continue;
            }

            $seenTargetKeys[$targetKey] = true;
            $selectedEntities[] = $entity;
        }

        return [
            'entities' => $selectedEntities,
            'failed' => $failed,
        ];
    }

    /**
     * Build a one-shot batch context for file restore/preview.
     *
     * Loads all selected files (including soft-deleted) and their parents in batch
     * to avoid N+1 queries, and records which selected items are directories.
     *
     * @param RecycleBinEntity[] $entities
     * @return array{filesById: array<int, TaskFileEntity>, selectedDirIds: array<int, bool>}
     */
    private function buildFileBatchContext(array $entities): array
    {
        $fileIds = [];
        foreach ($entities as $entity) {
            $fileIds[] = (int) $entity->getResourceId();
        }

        $filesById = $this->taskFileRepository->getByIdsWithTrash($fileIds);

        // Directories explicitly selected in this batch (used to treat a still-deleted
        // parent as "available" because it will be restored first).
        $selectedDirIds = [];
        foreach ($filesById as $fileId => $file) {
            if ($file->getIsDirectory()) {
                $selectedDirIds[$fileId] = true;
            }
        }

        // Preload parents that are not part of the selected set so parent availability
        // checks stay query-free.
        $missingParentIds = [];
        foreach ($filesById as $file) {
            $parentId = $file->getParentId();
            if ($parentId !== null && $parentId > 0 && ! isset($filesById[$parentId])) {
                $missingParentIds[$parentId] = $parentId;
            }
        }
        if (! empty($missingParentIds)) {
            foreach ($this->taskFileRepository->getByIdsWithTrash(array_values($missingParentIds)) as $parentId => $parent) {
                $filesById[$parentId] = $parent;
            }
        }

        return [
            'filesById' => $filesById,
            'selectedDirIds' => $selectedDirIds,
        ];
    }

    /**
     * Decide whether a parent directory is usable as a restore target within the batch.
     *
     * @param array<int, bool> $selectedDirIds
     */
    private function isParentAvailableInBatch(?int $parentId, ?TaskFileEntity $parent, array $selectedDirIds): bool
    {
        // Root-level node — no parent required.
        if ($parentId === null || $parentId <= 0) {
            return true;
        }
        if ($parent === null || ! $parent->getIsDirectory()) {
            return false;
        }
        // Live directory.
        if ($parent->getDeletedAt() === null) {
            return true;
        }
        // Still soft-deleted, but selected in this batch and will be restored first.
        return isset($selectedDirIds[$parentId]);
    }

    /**
     * Resolve the effective target parent ID during batch dedup, treating in-batch
     * parents as available. Falls back to the parent_missing resolution strategy.
     *
     * @param array{filesById: array<int, TaskFileEntity>, selectedDirIds: array<int, bool>} $batchContext
     * @param array<string, string> $resolution
     * @throws RuntimeException when parent is missing and no valid resolution is given
     */
    private function resolveBatchTargetParentId(TaskFileEntity $file, array $resolution, array $batchContext): ?int
    {
        $parentId = $file->getParentId();
        if ($parentId === null || $parentId <= 0) {
            return null;
        }

        $parent = $batchContext['filesById'][$parentId] ?? null;
        if ($this->isParentAvailableInBatch($parentId, $parent, $batchContext['selectedDirIds'])) {
            return $parentId;
        }

        $parentResolution = RestoreConflictResolution::tryFrom($resolution['parent_missing'] ?? '');
        if ($parentResolution === RestoreConflictResolution::RestoreToRoot) {
            $root = $this->taskFileRepository->findRootDirectoryByProjectId($file->getProjectId());
            if ($root === null) {
                throw new RuntimeException(trans('recycle_bin.restore.file_restore_to_root_failed'));
            }
            return $root->getFileId();
        }

        throw new RuntimeException(trans('recycle_bin.restore.file_parent_missing'));
    }

    /**
     * Sort entities so that any parent directory is restored before its descendants.
     * Ordering is by in-batch depth ascending; ties keep the original deleted_at desc order.
     *
     * @param RecycleBinEntity[] $entities
     * @param array<int, TaskFileEntity> $filesById
     * @return RecycleBinEntity[]
     */
    private function sortFileEntitiesParentFirst(array $entities, array $filesById): array
    {
        $batchIds = [];
        foreach ($entities as $entity) {
            $batchIds[(int) $entity->getResourceId()] = true;
        }

        $depthCache = [];
        $indexed = [];
        foreach ($entities as $entity) {
            $indexed[] = [
                'entity' => $entity,
                'depth' => $this->computeBatchDepth((int) $entity->getResourceId(), $filesById, $batchIds, $depthCache),
            ];
        }

        usort(
            $indexed,
            static function (array $left, array $right): int {
                if ($left['depth'] !== $right['depth']) {
                    return $left['depth'] <=> $right['depth'];
                }

                $deletedAtCompare = strcmp($right['entity']->getDeletedAt(), $left['entity']->getDeletedAt());
                if ($deletedAtCompare !== 0) {
                    return $deletedAtCompare;
                }

                return ((int) $right['entity']->getId()) <=> ((int) $left['entity']->getId());
            }
        );

        return array_map(static fn (array $item): RecycleBinEntity => $item['entity'], $indexed);
    }

    /**
     * Compute a node's depth relative to ancestors that are also in the batch.
     * The tentative cache write doubles as a cycle guard for malformed parent chains.
     *
     * @param array<int, TaskFileEntity> $filesById
     * @param array<int, bool> $batchIds
     * @param array<int, int> $depthCache
     */
    private function computeBatchDepth(int $fileId, array $filesById, array $batchIds, array &$depthCache): int
    {
        if (isset($depthCache[$fileId])) {
            return $depthCache[$fileId];
        }

        // Tentatively treat as root to break any accidental cycle.
        $depthCache[$fileId] = 0;

        $file = $filesById[$fileId] ?? null;
        if ($file === null) {
            return 0;
        }

        $parentId = $file->getParentId();
        if ($parentId === null || $parentId <= 0 || ! isset($batchIds[$parentId])) {
            return 0;
        }

        return $depthCache[$fileId] = $this->computeBatchDepth($parentId, $filesById, $batchIds, $depthCache) + 1;
    }

    /**
     * @param array<int, bool> $projectExistsCache
     */
    private function projectExistsAndNotDeleted(int $projectId, array &$projectExistsCache): bool
    {
        if (! array_key_exists($projectId, $projectExistsCache)) {
            $projectExistsCache[$projectId] = $this->projectRepository->existsAndNotDeleted($projectId);
        }

        return $projectExistsCache[$projectId];
    }

    private function buildFileRestoreTargetKey(TaskFileEntity $file, ?int $targetParentId): string
    {
        return sprintf('%d:%d:%s', $file->getProjectId(), $targetParentId ?? 0, $file->getFileName());
    }

    /**
     * @param array<int|string, array<string, string>> $conflictResolutions
     */
    private function restoreSingle(
        RecycleBinEntity $entity,
        string $userId,
        array $conflictResolutions = []
    ): void {
        $resourceType = $entity->getResourceType();

        match ($resourceType) {
            RecycleBinResourceType::Workspace => $this->restoreWorkspace($entity, $userId),
            RecycleBinResourceType::Project => $this->restoreProject($entity, $userId),
            RecycleBinResourceType::Topic => $this->restoreTopic($entity, $userId),
            RecycleBinResourceType::File => $this->restoreFile($entity, $userId, $conflictResolutions),
            RecycleBinResourceType::MicroApp => $this->restoreMicroApp($entity, $userId),
            default => throw new RuntimeException(
                trans('recycle_bin.restore.unsupported_resource_type', ['type' => $resourceType->value])
            ),
        };
    }

    private function restoreWorkspace(RecycleBinEntity $entity, string $userId): void
    {
        $workspaceId = (int) $entity->getResourceId();

        Db::beginTransaction();
        try {
            $restored = $this->workspaceRepository->restore($workspaceId, $userId);
            if (! $restored) {
                throw new RuntimeException(trans('recycle_bin.restore.workspace_not_found_or_permanently_deleted'));
            }

            $excludeProjectIds = $this->recycleBinRepository->findResourceIdsByParent(
                $workspaceId,
                RecycleBinResourceType::Project
            );

            $restoredProjects = $this->projectRepository->restoreByWorkspaceId(
                $workspaceId,
                $excludeProjectIds,
                $userId
            );

            $this->logger->info('Restored projects under workspace', [
                'workspace_id' => $workspaceId,
                'restored_count' => $restoredProjects,
                'excluded_count' => count($excludeProjectIds),
            ]);

            $restoredProjectIds = $this->projectRepository->findProjectIdsByWorkspaceId(
                $workspaceId,
                $excludeProjectIds
            );

            $excludeTopicIds = $this->recycleBinRepository->findResourceIdsByParents(
                $restoredProjectIds,
                RecycleBinResourceType::Topic
            );

            $restoredTopics = $this->topicRepository->restoreByWorkspaceId(
                $workspaceId,
                $restoredProjectIds,
                $excludeTopicIds,
                $userId
            );

            $this->logger->info('Restored topics under workspace', [
                'workspace_id' => $workspaceId,
                'restored_count' => $restoredTopics,
                'excluded_count' => count($excludeTopicIds),
            ]);

            $this->recycleBinRepository->deleteById($entity->getId());

            Db::commit();
        } catch (Throwable $e) {
            Db::rollBack();
            $this->logger->error('Failed to restore workspace', [
                'workspace_id' => $workspaceId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    private function restoreProject(RecycleBinEntity $entity, string $userId): void
    {
        $projectId = (int) $entity->getResourceId();

        Db::transaction(function () use ($projectId, $entity, $userId) {
            $project = $this->projectRepository->findByIdWithTrashed($projectId);
            if (! $project) {
                throw new RuntimeException(trans('recycle_bin.restore.project_not_found_or_permanently_deleted'));
            }

            $workspaceId = $project->getWorkspaceId();
            if ($workspaceId !== null) {
                $workspaceExists = $this->workspaceRepository->existsAndNotDeleted($workspaceId);
                if (! $workspaceExists) {
                    throw new RuntimeException(trans('recycle_bin.restore.parent_workspace_missing'));
                }
            } else {
                $this->logger->warning('workspace_id is null when restoring project', [
                    'project_id' => $projectId,
                    'recycle_bin_id' => $entity->getId(),
                ]);
            }

            $this->restoreProjectWithoutParentCheck($projectId, $userId);
            $this->recycleBinRepository->deleteById($entity->getId());
        });
    }

    private function restoreMicroApp(RecycleBinEntity $entity, string $userId): void
    {
        $appId = (int) $entity->getResourceId();

        Db::transaction(function () use ($appId, $entity, $userId): void {
            $microApp = $this->microAppRepository->findByIdWithTrashed($appId);
            if ($microApp === null) {
                throw new RuntimeException(trans('recycle_bin.restore.micro_app_not_found_or_permanently_deleted'));
            }

            $projectId = $microApp->getProjectId();
            $project = $this->projectRepository->findByIdWithTrashed($projectId);
            if ($project === null) {
                throw new RuntimeException(trans('recycle_bin.restore.project_not_found_or_permanently_deleted'));
            }

            $workspaceId = $project->getWorkspaceId();
            if ($workspaceId !== null && ! $this->workspaceRepository->existsAndNotDeleted($workspaceId)) {
                throw new RuntimeException(trans('recycle_bin.restore.parent_workspace_missing'));
            }

            $this->restoreProjectWithoutParentCheck($projectId, $userId);
            if (! $this->microAppRepository->restoreById($appId)) {
                throw new RuntimeException(trans('recycle_bin.restore.micro_app_failed'));
            }

            $this->recycleBinRepository->deleteById($entity->getId());
        });
    }

    private function restoreTopic(RecycleBinEntity $entity, string $userId): void
    {
        $topicId = (int) $entity->getResourceId();

        Db::transaction(function () use ($topicId, $entity, $userId) {
            $topic = $this->topicRepository->findByIdWithTrashed($topicId);
            if (! $topic) {
                throw new RuntimeException(trans('recycle_bin.restore.topic_not_found_or_permanently_deleted'));
            }

            $parentId = $entity->getParentId();
            if ($parentId !== null) {
                $parentExists = $this->projectRepository->existsAndNotDeleted($parentId);
                if (! $parentExists) {
                    throw new RuntimeException(trans('recycle_bin.restore.parent_project_missing'));
                }
            } else {
                $this->logger->warning('parent_id is null when restoring topic', [
                    'topic_id' => $topicId,
                    'recycle_bin_id' => $entity->getId(),
                ]);
            }

            $this->restoreTopicWithoutParentCheck($topicId, $userId);
            $this->recycleBinRepository->deleteById($entity->getId());
        });
    }

    /**
     * Restore a file or directory.
     *
     * Checks parent_missing then name_conflict in order.
     * Any unresolved conflict (missing or 'skip' strategy) throws, causing the item to be failed.
     *
     * @param array<int|string, array<string, string>> $conflictResolutions
     */
    private function restoreFile(
        RecycleBinEntity $entity,
        string $userId,
        array $conflictResolutions = []
    ): void {
        $fileId = (int) $entity->getResourceId();
        $resolution = $conflictResolutions[(string) $fileId] ?? [];

        Db::transaction(function () use ($fileId, $entity, $userId, $resolution) {
            // 1. Validate recycle bin record state
            if ($entity->getRemovedAt() !== null || $entity->getPurgedAt() !== null) {
                throw new RuntimeException(trans('recycle_bin.restore.file_removed_cannot_restore'));
            }

            // 2. Load file (including soft-deleted)
            $file = $this->taskFileRepository->getByIdWithTrash($fileId);
            if ($file === null) {
                throw new RuntimeException(trans('recycle_bin.restore.file_not_found_or_permanently_deleted'));
            }

            if (! $this->projectRepository->existsAndNotDeleted($file->getProjectId())) {
                throw new RuntimeException(trans('recycle_bin.restore.file_project_missing'));
            }

            // 3. Already restored — just clean up recycle bin record
            if ($file->getDeletedAt() === null) {
                $this->recycleBinRepository->deleteById($entity->getId());
                return;
            }

            // 4. Resolve target parent (use file.parent_id directly, no extra_data)
            $oldParentId = $file->getParentId();
            $targetParentId = $this->resolveTargetParentId($file->getParentId(), $file->getProjectId(), $resolution);

            // 5. Check name conflict at resolved target location
            $existing = $this->taskFileRepository->getByProjectParentAndName(
                $file->getProjectId(),
                $targetParentId,
                $file->getFileName()
            );

            if ($existing !== null && $existing->getFileId() !== $file->getFileId()) {
                $nameResolution = RestoreConflictResolution::tryFrom($resolution['name_conflict'] ?? '');

                if ($nameResolution === RestoreConflictResolution::Overwrite) {
                    // Soft-delete the conflicting entry (self only, no recursive)
                    $this->taskFileRepository->deleteById($existing->getFileId(), false);
                    $this->logger->info('Overwrote conflicting file during restore', [
                        'existing_file_id' => $existing->getFileId(),
                        'restore_file_id' => $fileId,
                    ]);
                } else {
                    throw new RuntimeException(trans('recycle_bin.restore.file_name_conflict'));
                }
            }

            // 6. Restore the file record
            // The following update carries one precise restore event; avoid
            // publishing an intermediate event with the old parent/name.
            $this->taskFileRepository->restoreFile($fileId, false);
            $restored = $this->taskFileRepository->getById($fileId);
            if ($restored === null) {
                throw new RuntimeException(trans('recycle_bin.restore.file_failed'));
            }

            // 7. Update parent and timestamp
            $restored->setParentId($targetParentId);
            $restored->setFileName($file->getFileName());
            $restored->setFileExtension(
                $restored->getIsDirectory() ? '' : (pathinfo($file->getFileName(), PATHINFO_EXTENSION) ?: '')
            );
            $restored->setDeletedAt(null);
            $restored->setUpdatedAt(date('Y-m-d H:i:s'));
            $this->taskFileRepository->updateById($restored, 'restore', false);

            // 8. Move the restored row's version (the final restore snapshot
            // is appended below and must carry the post-bump value) plus both
            // directory listings that the restore changed.
            $this->taskFileRepository->bumpMetadataVersions(array_values(array_filter([
                $fileId,
                $oldParentId,
                $targetParentId,
            ], static fn (?int $id): bool => $id !== null && $id > 0)));

            // Publish exactly one restore event after the parent revision bump
            // so the snapshot is the final committed representation.
            $final = $this->taskFileRepository->getById($fileId);
            $this->taskFileRepository->appendFileTreeMutation($file, $final, 'restore');

            $this->logger->info('File restored successfully', [
                'file_id' => $fileId,
                'target_parent_id' => $targetParentId,
                'user_id' => $userId,
            ]);

            // 9. Remove recycle bin record
            $this->recycleBinRepository->deleteById($entity->getId());
        });
    }

    /**
     * Resolve the effective target parent ID.
     * Uses file.parent_id directly. On parent_missing, applies resolution strategy.
     *
     * @param array<string, string> $resolution
     * @throws RuntimeException when parent is missing and no valid resolution is given
     */
    private function resolveTargetParentId(?int $parentId, int $projectId, array $resolution): ?int
    {
        // Root-level file — no parent check needed
        if ($parentId === null || $parentId <= 0) {
            return null;
        }

        $parent = $this->taskFileRepository->getByIdWithTrash($parentId);
        $parentMissing = $parent === null || $parent->getDeletedAt() !== null || ! $parent->getIsDirectory();

        if (! $parentMissing) {
            return $parentId;
        }

        // Parent is missing — apply resolution
        $parentResolution = RestoreConflictResolution::tryFrom($resolution['parent_missing'] ?? '');

        if ($parentResolution === RestoreConflictResolution::RestoreToRoot) {
            $root = $this->taskFileRepository->findRootDirectoryByProjectId($projectId);
            if ($root === null) {
                throw new RuntimeException(trans('recycle_bin.restore.file_restore_to_root_failed'));
            }
            return $root->getFileId();
        }

        throw new RuntimeException(trans('recycle_bin.restore.file_parent_missing'));
    }
}

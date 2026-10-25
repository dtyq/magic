<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Common\RecycleBin\Service;

use App\Application\SuperMagic\Common\RecycleBin\DTO\BatchMoveProjectInRecycleBinRequestDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\BatchMoveTopicsInRecycleBinRequestDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\CheckParentRequestDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\MoveProjectInRecycleBinRequestDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\MoveTopicInRecycleBinRequestDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\PermanentDeleteRequestDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\RecycleBinCountsRequestDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\RecycleBinCountsResponseDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\RecycleBinFilePreviewResponseDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\RecycleBinListRequestDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\RecycleBinListResponseDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\RestoreConflictDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\RestorePreviewItemDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\RestorePreviewResponseDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\RestoreRequestDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\RestoreResponseDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\RestoreResultItemDTO;
use App\Application\SuperMagic\Common\Service\AbstractAppService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\SuperMagic\Common\Entity\ValueObject\StorageType;
use App\Domain\SuperMagic\Common\RecycleBin\Entity\RecycleBinEntity;
use App\Domain\SuperMagic\Common\RecycleBin\Enum\RecycleBinResourceType;
use App\Domain\SuperMagic\Common\RecycleBin\Enum\RestoreConflictType;
use App\Domain\SuperMagic\Common\RecycleBin\Service\RecycleBinDomainService;
use App\Domain\SuperMagic\Common\RecycleBin\Service\RecycleBinRestoreDomainService;
use App\Domain\SuperMagic\Common\RecycleBin\Service\TopicRecycleDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Event\ProjectUpdatedEvent;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Workspace\Service\WorkspaceDomainService;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

use function Hyperf\Translation\trans;

class RecycleBinAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly RecycleBinDomainService $recycleBinDomainService,
        private readonly RecycleBinRestoreDomainService $recycleBinRestoreDomainService,
        private readonly TopicRecycleDomainService $topicRecycleDomainService,
        private readonly MagicUserDomainService $magicUserDomainService,
        private readonly WorkspaceDomainService $workspaceDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly EventDispatcherInterface $eventDispatcher,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly ProjectRepositoryInterface $projectRepository,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    public function previewFile(RequestContext $requestContext, int $id, ?int $projectId): RecycleBinFilePreviewResponseDTO
    {
        $authorization = $requestContext->getUserAuthorization();
        $records = $this->recycleBinDomainService->findByIdsAndTypeVisibleToUser(
            [$id],
            RecycleBinResourceType::File->value,
            $authorization->getId()
        );
        $record = $records[0] ?? null;
        if ($record === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, trans('recycle_bin.preview.unavailable'));
        }
        $deletedAt = strtotime($record->getDeletedAt());
        if ($deletedAt === false || $deletedAt + $record->getRetainDays() * 86400 <= time()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('recycle_bin.preview.expired'));
        }
        $file = $this->taskFileDomainService->getByIdWithTrash($record->getResourceId());
        if ($file === null || $file->getDeletedAt() === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('recycle_bin.preview.unavailable'));
        }
        // 回收站授权允许查看保留内容；父项目已删除不要求先恢复，也不放宽普通文件接口。
        if ($file->getSpaceType() === 'project') {
            $project = $this->projectRepository->findByIdWithTrashed($file->getProjectId());
            $organizationCode = $project?->getUserOrganizationCode() ?? '';
            $allowed = $project !== null
                && $record->getParentId() === $file->getProjectId()
                && ! $file->getIsHidden()
                && $file->getStorageType() === StorageType::WORKSPACE;
        } else {
            $organizationCode = $file->getOrganizationCode();
            $allowed = $file->getSpaceType() === 'user' && $this->hasTaskFileOwnerPermission($file, $authorization);
        }
        if (! $allowed || $organizationCode !== $authorization->getOrganizationCode()
            || ($projectId !== null && ($file->getSpaceType() !== 'project' || $file->getProjectId() !== $projectId))) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, trans('recycle_bin.preview.unavailable'));
        }
        if ($file->getIsDirectory()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('recycle_bin.preview.directory'));
        }
        $url = $this->taskFileDomainService->getFilePreSignedUrl($organizationCode, $file, ['expires' => TaskFileDomainService::URL_EXPIRES]);
        return new RecycleBinFilePreviewResponseDTO($record, $file, $url);
    }

    /**
     * 获取回收站列表.
     */
    public function getRecycleBinList(
        RequestContext $requestContext,
        RecycleBinListRequestDTO $requestDTO
    ): RecycleBinListResponseDTO {
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();

        $result = $this->recycleBinDomainService->getRecycleBinList(
            userId: $userId,
            resourceType: $requestDTO->getResourceType(),
            keyword: $requestDTO->getKeyword(),
            order: $requestDTO->getOrder(),
            page: $requestDTO->getPage(),
            pageSize: $requestDTO->getPageSize(),
            fileQuery: $requestDTO->getFileQuery()
        );

        $deletedByIds = array_unique(array_map(
            fn (RecycleBinEntity $entity) => $entity->getDeletedBy(),
            $result['list']
        ));
        $deletedByUsers = [];
        if (! empty($deletedByIds)) {
            $deletedByUsers = $this->magicUserDomainService->getUserByIdsWithoutOrganization($deletedByIds);
        }
        $userMap = [];
        foreach ($deletedByUsers as $user) {
            $userMap[$user->getUserId()] = $user;
        }
        $result['user_map'] = $userMap;

        $this->logger->info('查询回收站列表', [
            'user_id' => $userId,
            'resource_type' => $requestDTO->getResourceType(),
            'keyword' => $requestDTO->getKeyword(),
            'total' => $result['total'] ?? null,
        ]);

        return RecycleBinListResponseDTO::fromResult($result);
    }

    /**
     * 获取各资源类型的回收站数量.
     */
    public function getRecycleBinCounts(
        RequestContext $requestContext,
        RecycleBinCountsRequestDTO $requestDTO
    ): RecycleBinCountsResponseDTO {
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();

        $countsByType = $this->recycleBinDomainService->getCountsByType(
            $userId,
            $requestDTO->getKeyword(),
            $requestDTO->getProjectId()
        );

        $this->logger->info('查询回收站类型数量', [
            'user_id' => $userId,
            'keyword' => $requestDTO->getKeyword(),
            'counts' => $countsByType,
        ]);

        return new RecycleBinCountsResponseDTO($countsByType);
    }

    /**
     * Check restore conflicts for a batch of resources (all types).
     *
     * Unified endpoint for all resource types:
     * - File: detects parent_missing + name_conflict via domain service
     * - Project/Topic: detects parent_missing (parent workspace/project existence check)
     * - Workspace: always no-conflict
     *
     * Read-only; no side effects.
     */
    public function checkConflicts(
        RequestContext $requestContext,
        CheckParentRequestDTO $requestDTO
    ): RestorePreviewResponseDTO {
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();

        $resourceType = $requestDTO->getResourceType();
        $resourceIds = $requestDTO->getResourceIds();

        $itemsWithConflict = [];
        $itemsNoConflict = [];

        if ($resourceType === RecycleBinResourceType::File) {
            // File type: full conflict detection (parent_missing + name_conflict)
            $result = $this->recycleBinRestoreDomainService->previewFileConflicts($resourceIds, $userId);
            $itemsWithConflict = $result['items_with_conflict'];
            $itemsNoConflict = $result['items_no_conflict'];
        } else {
            // Project/Topic/Workspace: parent-existence check only
            $entities = $this->recycleBinDomainService->findLatestByResourceIds(
                $resourceIds,
                $resourceType,
                $userId
            );

            foreach ($entities as $entity) {
                $parentId = $entity->getParentId();
                $resourceId = (string) $entity->getResourceId();
                $resourceName = $entity->getResourceName();

                // Workspace or root-level resource — no parent check needed
                if ($resourceType === RecycleBinResourceType::Workspace || $parentId === null) {
                    $itemsNoConflict[] = new RestorePreviewItemDTO(
                        resourceId: $resourceId,
                        resourceName: $resourceName,
                        isDirectory: true,
                    );
                    continue;
                }

                $parentExists = false;

                if ($resourceType === RecycleBinResourceType::Project || $resourceType === RecycleBinResourceType::MicroApp) {
                    $workspace = $this->workspaceDomainService->getWorkspaceDetail($parentId);
                    $parentExists = $workspace !== null;
                } elseif ($resourceType === RecycleBinResourceType::Topic) {
                    try {
                        $project = $this->projectDomainService->getProjectNotUserId($parentId);
                        $parentExists = $project !== null;
                    } catch (Throwable) {
                        $parentExists = false;
                    }
                }

                if ($parentExists) {
                    $itemsNoConflict[] = new RestorePreviewItemDTO(
                        resourceId: $resourceId,
                        resourceName: $resourceName,
                        isDirectory: true,
                    );
                } else {
                    $itemsWithConflict[] = new RestorePreviewItemDTO(
                        resourceId: $resourceId,
                        resourceName: $resourceName,
                        isDirectory: true,
                        conflict: new RestoreConflictDTO(
                            type: RestoreConflictType::ParentMissing,
                        ),
                    );
                }
            }
        }

        $this->logger->info('Check restore conflicts', [
            'user_id' => $userId,
            'resource_type' => $resourceType->value,
            'with_conflict_count' => count($itemsWithConflict),
            'no_conflict_count' => count($itemsNoConflict),
        ]);

        return new RestorePreviewResponseDTO($itemsWithConflict, $itemsNoConflict);
    }

    /**
     * 恢复资源.
     */
    public function restore(
        RequestContext $requestContext,
        RestoreRequestDTO $requestDTO
    ): RestoreResponseDTO {
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();
        $resourceIds = $requestDTO->getResourceIds();
        $resourceType = $requestDTO->getResourceType();

        $result = $this->recycleBinRestoreDomainService->restoreBatch(
            $resourceIds,
            $resourceType,
            $userId,
            $requestDTO->getConflictResolutions()
        );

        if ($result['succeeded'] !== [] && $resourceType === RecycleBinResourceType::Project) {
            foreach ($result['succeeded'] as $entity) {
                $project = $this->projectDomainService->getProjectNotUserId((int) $entity->getResourceId());
                if ($project !== null) {
                    $this->eventDispatcher->dispatch(new ProjectUpdatedEvent($project, $userAuthorization));
                }
            }
        }

        $resultDTOs = [];

        foreach ($result['succeeded'] as $entity) {
            $dto = new RestoreResultItemDTO();
            $dto->id = (string) $entity->getId();
            $dto->resourceType = $entity->getResourceType()->value;
            $dto->resourceId = (string) $entity->getResourceId();
            $dto->resourceName = $entity->getResourceName();
            $dto->success = true;

            $resultDTOs[] = $dto;
        }

        foreach ($result['failed'] as $failedItem) {
            $entity = $failedItem['entity'];
            $dto = new RestoreResultItemDTO();
            $dto->id = (string) $entity->getId();
            $dto->resourceType = $entity->getResourceType()->value;
            $dto->resourceId = (string) $entity->getResourceId();
            $dto->resourceName = $entity->getResourceName();
            $dto->success = false;
            $dto->errorMessage = (string) ($failedItem['error'] ?? '');

            $resultDTOs[] = $dto;
        }

        $successCount = count($result['succeeded']);
        $failedCount = count($result['failed']);

        $this->logger->info('批量恢复资源', [
            'user_id' => $userId,
            'resource_ids' => $resourceIds,
            'success_count' => $successCount,
            'failed_count' => $failedCount,
        ]);

        return new RestoreResponseDTO(
            $successCount,
            $failedCount,
            $resultDTOs
        );
    }

    /**
     * 移动回收站内的项目到新工作区（移动并恢复）.
     */
    public function moveProject(
        RequestContext $requestContext,
        MoveProjectInRecycleBinRequestDTO $requestDTO
    ): array {
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();

        $sourceProjectId = $requestDTO->getSourceProjectId();
        $targetWorkspaceId = $requestDTO->getTargetWorkspaceId();

        Db::transaction(function () use ($sourceProjectId, $targetWorkspaceId, $userId) {
            $project = $this->recycleBinRestoreDomainService->findProjectByIdWithTrashed($sourceProjectId);
            if (! $project) {
                throw new RuntimeException(trans('recycle_bin.restore.project_not_found_or_permanently_deleted'));
            }

            if (! $project->isDeleted()) {
                throw new RuntimeException(trans('recycle_bin.move.project_not_in_recycle_bin_use_normal_move'));
            }

            // 恢复 → 移动 → 清理回收站记录
            $this->recycleBinRestoreDomainService->restoreProjectWithoutParentCheck($sourceProjectId, $userId);
            $this->projectDomainService->moveProject($sourceProjectId, $targetWorkspaceId, $userId);

            $entities = $this->recycleBinDomainService->findLatestByResourceIds(
                [$sourceProjectId],
                RecycleBinResourceType::Project,
                $userId
            );

            if (! empty($entities)) {
                $this->recycleBinDomainService->deleteById($entities[0]->getId());
            }
        });

        $this->logger->info('回收站项目移动并恢复成功', [
            'user_id' => $userId,
            'project_id' => $sourceProjectId,
            'target_workspace_id' => $targetWorkspaceId,
        ]);

        return ['success' => true];
    }

    /**
     * 批量移动回收站项目并恢复.
     *
     * 每个项目独立事务，一个失败不影响其他项目.
     *
     * @return array{total: int, success: int, failed: int, results: array<array{project_id: string, success: bool, message: string}>}
     */
    public function batchMoveProject(
        RequestContext $requestContext,
        BatchMoveProjectInRecycleBinRequestDTO $requestDTO
    ): array {
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();

        $projectIds = $requestDTO->getProjectIds();
        $targetWorkspaceId = $requestDTO->getTargetWorkspaceId();

        $this->logger->info('开始批量移动回收站项目', [
            'user_id' => $userId,
            'project_count' => count($projectIds),
            'target_workspace_id' => $targetWorkspaceId,
        ]);

        $results = [];

        foreach ($projectIds as $projectId) {
            try {
                Db::transaction(function () use ($projectId, $targetWorkspaceId, $userId) {
                    $projectIdInt = (int) $projectId;

                    $project = $this->recycleBinRestoreDomainService->findProjectByIdWithTrashed($projectIdInt);
                    if (! $project) {
                        throw new RuntimeException(trans('recycle_bin.restore.project_not_found_or_permanently_deleted'));
                    }

                    if (! $project->isDeleted()) {
                        throw new RuntimeException(trans('recycle_bin.move.project_not_in_recycle_bin'));
                    }

                    // 恢复 → 移动 → 清理回收站记录
                    $this->recycleBinRestoreDomainService->restoreProjectWithoutParentCheck($projectIdInt, $userId);
                    $this->projectDomainService->moveProject($projectIdInt, $targetWorkspaceId, $userId);

                    $entities = $this->recycleBinDomainService->findLatestByResourceIds(
                        [$projectIdInt],
                        RecycleBinResourceType::Project,
                        $userId
                    );

                    if (! empty($entities)) {
                        $this->recycleBinDomainService->deleteById($entities[0]->getId());
                    }
                });

                $results[] = [
                    'project_id' => $projectId,
                    'success' => true,
                    'message' => trans('recycle_bin.move.success'),
                ];
            } catch (Throwable $e) {
                $results[] = [
                    'project_id' => $projectId,
                    'success' => false,
                    'message' => $e->getMessage(),
                ];

                $this->logger->warning('单个项目移动失败', [
                    'project_id' => $projectId,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $successCount = count(array_filter($results, fn ($r) => $r['success']));
        $failedCount = count(array_filter($results, fn ($r) => ! $r['success']));

        $this->logger->info('批量移动回收站项目完成', [
            'total' => count($projectIds),
            'success' => $successCount,
            'failed' => $failedCount,
        ]);

        return [
            'total' => count($projectIds),
            'success' => $successCount,
            'failed' => $failedCount,
            'results' => $results,
        ];
    }

    /**
     * 移动回收站中的话题.
     *
     * @throws RuntimeException
     */
    public function moveTopic(
        RequestContext $requestContext,
        MoveTopicInRecycleBinRequestDTO $requestDTO
    ): array {
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();
        $sourceTopicId = $requestDTO->getSourceTopicId();
        $targetProjectId = $requestDTO->getTargetProjectId();

        Db::transaction(function () use ($sourceTopicId, $targetProjectId, $userId) {
            $topic = $this->recycleBinRestoreDomainService->findTopicByIdWithTrashed($sourceTopicId);
            if (! $topic) {
                throw new RuntimeException(trans('recycle_bin.restore.topic_not_found_or_permanently_deleted'));
            }

            if ($topic->getDeletedAt() === null) {
                throw new RuntimeException(trans('recycle_bin.move.topic_not_in_recycle_bin_use_normal_move'));
            }

            // 恢复 → 移动 → 清理回收站记录
            $this->recycleBinRestoreDomainService->restoreTopicWithoutParentCheck($sourceTopicId, $userId);
            $this->topicRecycleDomainService->moveTopicInRecycleBin($sourceTopicId, $targetProjectId, $userId);

            $entities = $this->recycleBinDomainService->findLatestByResourceIds(
                [$sourceTopicId],
                RecycleBinResourceType::Topic,
                $userId
            );

            if (! empty($entities)) {
                $this->recycleBinDomainService->deleteById($entities[0]->getId());
            }
        });

        $this->logger->info('回收站话题移动并恢复成功', [
            'user_id' => $userId,
            'topic_id' => $sourceTopicId,
            'target_project_id' => $targetProjectId,
        ]);

        return [
            'success' => true,
            'topic_id' => (string) $sourceTopicId,
            'message' => trans('recycle_bin.move.topic_success'),
        ];
    }

    /**
     * 批量移动回收站中的话题.
     */
    public function batchMoveTopic(
        RequestContext $requestContext,
        BatchMoveTopicsInRecycleBinRequestDTO $requestDTO
    ): array {
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();

        $topicIds = $requestDTO->getTopicIds();
        $targetProjectId = $requestDTO->getTargetProjectId();

        $this->logger->info('开始批量移动回收站话题', [
            'topic_count' => count($topicIds),
            'target_project_id' => $targetProjectId,
            'user_id' => $userId,
        ]);

        $succeeded = [];
        $failed = [];

        // 每个话题使用独立事务，允许部分成功
        foreach ($topicIds as $topicIdStr) {
            $topicId = (int) $topicIdStr;

            try {
                Db::transaction(function () use ($topicId, $targetProjectId, $userId) {
                    $topic = $this->recycleBinRestoreDomainService->findTopicByIdWithTrashed($topicId);
                    if (! $topic) {
                        throw new RuntimeException(trans('recycle_bin.restore.topic_not_found_or_permanently_deleted'));
                    }

                    if ($topic->getDeletedAt() === null) {
                        throw new RuntimeException(trans('recycle_bin.move.topic_not_in_recycle_bin'));
                    }

                    // 恢复 → 移动 → 清理回收站记录
                    $this->recycleBinRestoreDomainService->restoreTopicWithoutParentCheck($topicId, $userId);
                    $this->topicRecycleDomainService->moveTopicInRecycleBin($topicId, $targetProjectId, $userId);

                    $entities = $this->recycleBinDomainService->findLatestByResourceIds(
                        [$topicId],
                        RecycleBinResourceType::Topic,
                        $userId
                    );

                    if (! empty($entities)) {
                        $this->recycleBinDomainService->deleteById($entities[0]->getId());
                    }
                });

                $succeeded[] = [
                    'topic_id' => (string) $topicId,
                    'success' => true,
                    'message' => trans('recycle_bin.move.success'),
                ];

                $this->logger->info('话题移动成功', [
                    'topic_id' => $topicId,
                    'user_id' => $userId,
                ]);
            } catch (Throwable $e) {
                $failed[] = [
                    'topic_id' => (string) $topicId,
                    'success' => false,
                    'message' => $e->getMessage(),
                ];

                $this->logger->error('话题移动失败', [
                    'topic_id' => $topicId,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                    'user_id' => $userId,
                ]);
            }
        }

        $this->logger->info('批量移动回收站话题完成', [
            'total' => count($topicIds),
            'success_count' => count($succeeded),
            'failed_count' => count($failed),
            'user_id' => $userId,
        ]);

        return [
            'total' => count($topicIds),
            'success' => count($succeeded),
            'failed' => count($failed),
            'results' => array_merge($succeeded, $failed),
        ];
    }

    /**
     * 彻底删除回收站记录.
     *
     * @return array ['failed' => [...]] 只返回失败项
     */
    public function permanentDelete(
        RequestContext $requestContext,
        PermanentDeleteRequestDTO $requestDTO
    ): array {
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();

        $this->logger->info('开始彻底删除回收站记录', [
            'user_id' => $userId,
            'ids_count' => count($requestDTO->getIds()),
        ]);

        $result = $this->recycleBinDomainService->permanentDelete(
            $requestDTO->getIds(),
            $userId
        );

        $this->logger->info('彻底删除回收站记录完成', [
            'user_id' => $userId,
            'failed_count' => count($result['failed']),
        ]);

        return $result;
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\RecycleBin\Service;

use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\BatchMoveProjectInRecycleBinRequestDTO;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\BatchMoveTopicsInRecycleBinRequestDTO;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\CheckParentRequestDTO;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\CheckParentResponseDTO;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\MoveProjectInRecycleBinRequestDTO;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\MoveTopicInRecycleBinRequestDTO;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\ParentNotFoundItemDTO;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\PermanentDeleteRequestDTO;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\RecycleBinListRequestDTO;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\RecycleBinListResponseDTO;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\RestoreRequestDTO;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\RestoreResponseDTO;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\RestoreResultItemDTO;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AbstractAppService;
use Dtyq\SuperMagic\Domain\RecycleBin\Entity\RecycleBinEntity;
use Dtyq\SuperMagic\Domain\RecycleBin\Enum\RecycleBinResourceType;
use Dtyq\SuperMagic\Domain\RecycleBin\Service\RecycleBinDomainService;
use Dtyq\SuperMagic\Domain\RecycleBin\Service\RecycleBinRestoreDomainService;
use Dtyq\SuperMagic\Domain\RecycleBin\Service\TopicRecycleDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

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
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
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
            pageSize: $requestDTO->getPageSize()
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
            'total' => $result['total'],
        ]);

        return RecycleBinListResponseDTO::fromResult($result);
    }

    /**
     * 检查父级是否存在.
     * 先按「当前用户可访问」查出回收站记录，再检查父级，避免越权.
     */
    public function checkParent(
        RequestContext $requestContext,
        CheckParentRequestDTO $requestDTO
    ): CheckParentResponseDTO {
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();

        $entities = $this->recycleBinDomainService->findLatestByResourceIds(
            $requestDTO->getResourceIds(),
            $requestDTO->getResourceType(),
            $userId
        );

        $itemsNeedMove = [];
        $itemsNoNeedMove = [];
        foreach ($entities as $entity) {
            $parentId = $entity->getParentId();
            if ($parentId === null) {
                $itemsNoNeedMove[] = $entity;
                continue;
            }

            $resourceTypeValue = $entity->getResourceType()->value;

            if ($resourceTypeValue === RecycleBinResourceType::Workspace->value) {
                $itemsNoNeedMove[] = $entity;
                continue;
            }

            $parentExists = false;

            if ($resourceTypeValue === RecycleBinResourceType::Project->value) {
                $workspace = $this->workspaceDomainService->getWorkspaceDetail($parentId);
                if ($workspace !== null) {
                    $parentExists = true;
                }
            } elseif ($resourceTypeValue === RecycleBinResourceType::Topic->value) {
                try {
                    $project = $this->projectDomainService->getProjectNotUserId($parentId);
                    if ($project !== null) {
                        $parentExists = true;
                    }
                } catch (Throwable $e) {
                    $parentExists = false;
                }
            } else {
                $itemsNoNeedMove[] = $entity;
                continue;
            }

            if ($parentExists) {
                $itemsNoNeedMove[] = $entity;
            } else {
                $itemsNeedMove[] = $entity;
            }
        }

        $dtoListNeedMove = array_map(
            fn (RecycleBinEntity $e) => $this->entityToCheckItemDto($e),
            $itemsNeedMove
        );
        $dtoListNoNeedMove = array_map(
            fn (RecycleBinEntity $e) => $this->entityToCheckItemDto($e),
            $itemsNoNeedMove
        );

        $this->logger->info('检查父级是否存在', [
            'user_id' => $userId,
            'resource_ids' => $requestDTO->getResourceIds(),
            'resource_type' => $requestDTO->getResourceType()->value,
            'items_need_move_count' => count($dtoListNeedMove),
            'items_no_need_move_count' => count($dtoListNoNeedMove),
        ]);

        return new CheckParentResponseDTO($dtoListNeedMove, $dtoListNoNeedMove);
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
            $userId
        );

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
                throw new RuntimeException('项目不存在或已被永久删除');
            }

            if (! $project->isDeleted()) {
                throw new RuntimeException('该项目不在回收站中，请使用正常的移动接口');
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
                        throw new RuntimeException('项目不存在或已被永久删除');
                    }

                    if (! $project->isDeleted()) {
                        throw new RuntimeException('该项目不在回收站中');
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
                    'message' => '移动并恢复成功',
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
                throw new RuntimeException('话题不存在或已被永久删除');
            }

            if ($topic->getDeletedAt() === null) {
                throw new RuntimeException('该话题不在回收站中，请使用正常的移动接口');
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
            'message' => '话题移动并恢复成功',
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
                        throw new RuntimeException('话题不存在或已被永久删除');
                    }

                    if ($topic->getDeletedAt() === null) {
                        throw new RuntimeException('该话题不在回收站中');
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
                    'message' => '移动并恢复成功',
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

    private function entityToCheckItemDto(RecycleBinEntity $entity): ParentNotFoundItemDTO
    {
        $dto = new ParentNotFoundItemDTO();
        $dto->id = (string) $entity->getId();
        $dto->resourceType = $entity->getResourceType()->value;
        $dto->resourceId = (string) $entity->getResourceId();
        $dto->resourceName = $entity->getResourceName();
        $dto->parentId = $entity->getParentId() !== null ? (string) $entity->getParentId() : null;

        return $dto;
    }
}

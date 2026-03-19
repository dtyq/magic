<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\RecycleBin\Service;

use Dtyq\SuperMagic\Domain\RecycleBin\Entity\RecycleBinEntity;
use Dtyq\SuperMagic\Domain\RecycleBin\Enum\RecycleBinResourceType;
use Dtyq\SuperMagic\Domain\RecycleBin\Repository\Facade\RecycleBinRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectMemberRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TopicRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\WorkspaceRepositoryInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

/**
 * 回收站恢复领域服务.
 *
 * 负责工作区、项目、话题的恢复逻辑（含级联恢复）.
 */
class RecycleBinRestoreDomainService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected RecycleBinRepositoryInterface $recycleBinRepository,
        protected WorkspaceRepositoryInterface $workspaceRepository,
        protected ProjectRepositoryInterface $projectRepository,
        protected TopicRepositoryInterface $topicRepository,
        protected ProjectMemberRepositoryInterface $projectMemberRepository,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * 批量恢复资源（允许部分成功）.
     *
     * @param array $resourceIds 资源ID数组
     * @param RecycleBinResourceType $resourceType 资源类型枚举
     * @param string $userId 当前用户ID
     * @return array ['succeeded' => RecycleBinEntity[], 'failed' => ['entity' => RecycleBinEntity, 'error' => string][]]
     */
    public function restoreBatch(
        array $resourceIds,
        RecycleBinResourceType $resourceType,
        string $userId
    ): array {
        $entities = $this->recycleBinRepository->findLatestByResourceIds($resourceIds, $resourceType, $userId);

        if (empty($entities)) {
            return ['succeeded' => [], 'failed' => []];
        }

        $succeeded = [];
        $failed = [];

        foreach ($entities as $entity) {
            try {
                $this->restoreSingle($entity, $userId);
                $succeeded[] = $entity;
            } catch (Throwable $e) {
                $this->logger->error('恢复资源失败', [
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

        return [
            'succeeded' => $succeeded,
            'failed' => $failed,
        ];
    }

    /**
     * 恢复项目及其子资源（不验证父级，不删除回收站记录）.
     *
     * @param int $projectId 项目ID
     * @param string $userId 当前用户ID
     * @throws RuntimeException
     */
    public function restoreProjectWithoutParentCheck(int $projectId, string $userId): void
    {
        $restored = $this->projectRepository->restore($projectId, $userId);
        if (! $restored) {
            throw new RuntimeException('恢复项目失败');
        }

        $restoredMembers = $this->projectMemberRepository->restoreByProjectIds(
            [$projectId],
            $userId
        );

        $this->logger->info('恢复项目成员', [
            'project_id' => $projectId,
            'member_count' => $restoredMembers,
        ]);

        // 查询用户曾单独删除的话题，恢复时排除
        $excludeTopicIds = $this->recycleBinRepository->findResourceIdsByParent(
            $projectId,
            RecycleBinResourceType::Topic
        );

        $restoredTopics = $this->topicRepository->restoreByProjectId(
            $projectId,
            $excludeTopicIds,
            $userId
        );

        $this->logger->info('恢复项目下的话题', [
            'project_id' => $projectId,
            'restored_count' => $restoredTopics,
            'excluded_count' => count($excludeTopicIds),
        ]);
    }

    /**
     * 恢复话题（不验证父级，不删除回收站记录）.
     *
     * @param int $topicId 话题ID
     * @param string $userId 当前用户ID
     * @throws RuntimeException
     */
    public function restoreTopicWithoutParentCheck(int $topicId, string $userId): void
    {
        $restored = $this->topicRepository->restore($topicId, $userId);
        if (! $restored) {
            throw new RuntimeException('恢复话题失败');
        }

        $this->logger->info('恢复话题成功', [
            'topic_id' => $topicId,
            'user_id' => $userId,
        ]);
    }

    /**
     * 根据ID查询项目（包含软删除的项目）.
     *
     * @param int $projectId 项目ID
     * @return null|ProjectEntity 项目实体或null
     */
    public function findProjectByIdWithTrashed(int $projectId): ?ProjectEntity
    {
        return $this->projectRepository->findByIdWithTrashed($projectId);
    }

    /**
     * 根据ID查询话题（包含软删除的话题）.
     *
     * @param int $topicId 话题ID
     * @return null|TopicEntity 话题实体或null
     */
    public function findTopicByIdWithTrashed(int $topicId): ?TopicEntity
    {
        return $this->topicRepository->findByIdWithTrashed($topicId);
    }

    /**
     * 恢复单个资源.
     *
     * @param RecycleBinEntity $entity 回收站实体
     * @param string $userId 当前用户ID
     * @throws RuntimeException 当恢复失败时抛出
     */
    private function restoreSingle(RecycleBinEntity $entity, string $userId): void
    {
        $resourceType = $entity->getResourceType();

        match ($resourceType) {
            RecycleBinResourceType::Workspace => $this->restoreWorkspace($entity, $userId),
            RecycleBinResourceType::Project => $this->restoreProject($entity, $userId),
            RecycleBinResourceType::Topic => $this->restoreTopic($entity, $userId),
            default => throw new RuntimeException('不支持的资源类型: ' . $resourceType->value),
        };
    }

    /**
     * 恢复工作区（级联恢复项目、话题）.
     */
    private function restoreWorkspace(RecycleBinEntity $entity, string $userId): void
    {
        $workspaceId = (int) $entity->getResourceId();

        Db::beginTransaction();
        try {
            $restored = $this->workspaceRepository->restore($workspaceId, $userId);
            if (! $restored) {
                throw new RuntimeException('工作区不存在或已被永久删除');
            }

            // 查询用户曾单独删除的项目，恢复时排除
            $excludeProjectIds = $this->recycleBinRepository->findResourceIdsByParent(
                $workspaceId,
                RecycleBinResourceType::Project
            );

            $restoredProjects = $this->projectRepository->restoreByWorkspaceId(
                $workspaceId,
                $excludeProjectIds,
                $userId
            );

            $this->logger->info('恢复工作区下的项目', [
                'workspace_id' => $workspaceId,
                'restored_count' => $restoredProjects,
                'excluded_count' => count($excludeProjectIds),
            ]);

            // 查询用户曾单独删除的话题，恢复时排除
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

            $this->logger->info('恢复工作区下的话题', [
                'workspace_id' => $workspaceId,
                'restored_count' => $restoredTopics,
                'excluded_count' => count($excludeTopicIds),
            ]);

            $this->recycleBinRepository->deleteById($entity->getId());

            Db::commit();
        } catch (Throwable $e) {
            Db::rollBack();
            $this->logger->error('恢复工作区失败', [
                'workspace_id' => $workspaceId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * 恢复项目（级联恢复话题、成员，排除用户曾删的话题）.
     *
     * @param RecycleBinEntity $entity 回收站实体
     * @param string $userId 当前用户ID
     * @throws RuntimeException 恢复失败时抛出异常
     */
    private function restoreProject(RecycleBinEntity $entity, string $userId): void
    {
        $projectId = (int) $entity->getResourceId();

        Db::transaction(function () use ($projectId, $entity, $userId) {
            $project = $this->projectRepository->findByIdWithTrashed($projectId);
            if (! $project) {
                throw new RuntimeException('项目不存在或已被永久删除');
            }

            // 验证父级工作区是否存在
            $workspaceId = $project->getWorkspaceId();
            if ($workspaceId !== null) {
                $workspaceExists = $this->workspaceRepository->existsAndNotDeleted($workspaceId);
                if (! $workspaceExists) {
                    throw new RuntimeException('父级工作区不存在，请先移动项目到其他工作区');
                }
            } else {
                $this->logger->warning('恢复项目时 workspace_id 为空', [
                    'project_id' => $projectId,
                    'recycle_bin_id' => $entity->getId(),
                ]);
            }

            $this->restoreProjectWithoutParentCheck($projectId, $userId);
            $this->recycleBinRepository->deleteById($entity->getId());
        });
    }

    /**
     * 恢复话题（单独恢复）.
     *
     * @param RecycleBinEntity $entity 回收站实体
     * @param string $userId 当前用户ID
     * @throws RuntimeException 恢复失败时抛出异常
     */
    private function restoreTopic(RecycleBinEntity $entity, string $userId): void
    {
        $topicId = (int) $entity->getResourceId();

        Db::transaction(function () use ($topicId, $entity, $userId) {
            $topic = $this->topicRepository->findByIdWithTrashed($topicId);
            if (! $topic) {
                throw new RuntimeException('话题不存在或已被永久删除');
            }

            // 验证父级项目是否存在
            $parentId = $entity->getParentId();
            if ($parentId !== null) {
                $parentExists = $this->projectRepository->existsAndNotDeleted($parentId);
                if (! $parentExists) {
                    throw new RuntimeException('父级项目不存在，请先移动话题到其他项目');
                }
            } else {
                $this->logger->warning('恢复话题时 parent_id 为空', [
                    'topic_id' => $topicId,
                    'recycle_bin_id' => $entity->getId(),
                ]);
            }

            $this->restoreTopicWithoutParentCheck($topicId, $userId);
            $this->recycleBinRepository->deleteById($entity->getId());
        });
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectForkEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\CreationSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ForkStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectMode;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectForkRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TopicRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Psr\SimpleCache\CacheInterface;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * Project Domain Service.
 */
class ProjectDomainService
{
    private const CACHE_KEY_UNGROUPED_COUNT = 'project_ungrouped_count:%s:%s:%s';

    private const CACHE_TTL_UNGROUPED_COUNT = 60;

    private LoggerInterface $logger;

    public function __construct(
        private readonly ProjectRepositoryInterface $projectRepository,
        private readonly ProjectForkRepositoryInterface $projectForkRepository,
        private readonly TaskFileRepositoryInterface $taskFileRepository,
        private readonly TopicRepositoryInterface $topicRepository,
        private readonly TaskRepositoryInterface $taskRepository,
        private readonly CacheInterface $cache,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * Create project.
     */
    public function createProject(
        int $workspaceId,
        string $projectName,
        string $userId,
        string $userOrganizationCode,
        string $projectId = '',
        string $workDir = '',
        ?string $projectMode = null,
        int $source = CreationSource::USER_CREATED->value,
        bool $isHidden = false,
        ?int $hiddenType = null
    ): ProjectEntity {
        $currentTime = date('Y-m-d H:i:s');
        $project = new ProjectEntity();
        if (! empty($projectId)) {
            $project->setId((int) $projectId);
        }

        if ($projectMode !== null && str_starts_with($projectMode, 'SMA-')) {
            $projectMode = ProjectMode::CUSTOM_AGENT->value;
        }

        $project->setUserId($userId)
            ->setUserOrganizationCode($userOrganizationCode)
            ->setWorkspaceId($workspaceId)
            ->setProjectName($projectName)
            ->setWorkDir($workDir)
            ->setProjectMode($projectMode)
            ->setSource($source)
            ->setIsHidden($isHidden)
            ->setHiddenType($hiddenType)
            ->setProjectStatus(ProjectStatus::ACTIVE->value)
            ->setCurrentTopicId(null)
            ->setCurrentTopicStatus('')
            ->setIsCollaborationEnabled(true)
            ->setCreatedUid($userId)
            ->setUpdatedUid($userId)
            ->setCreatedAt($currentTime)
            ->setUpdatedAt($currentTime);

        return $this->projectRepository->create($project);
    }

    /**
     * Delete project.
     */
    public function deleteProject(int $projectId, string $userId): bool
    {
        $project = $this->projectRepository->findById($projectId);
        if (! $project) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }

        // Check permissions
        if ($project->getUserId() !== $userId) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
        }

        return $this->projectRepository->delete($project);
    }

    /**
     * Batch get projects by IDs with permission check.
     *
     * @return ProjectEntity[]
     */
    public function getProjectsByIds(array $projectIds): array
    {
        if (empty($projectIds)) {
            return [];
        }

        return $this->projectRepository->findByIds($projectIds);
    }

    public function getProjectsWithAuth(array $projectIds, string $userId, string $organizationCode): array
    {
        return $this->projectRepository->findByIdsWithAuth($projectIds, $userId, $organizationCode);
    }

    public function deleteProjectsByWorkspaceId(DataIsolation $dataIsolation, int $workspaceId): bool
    {
        $conditions = [
            'workspace_id' => $workspaceId,
        ];

        $data = [
            'deleted_at' => date('Y-m-d H:i:s'),
            'updated_uid' => $dataIsolation->getCurrentUserId(),
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        return $this->projectRepository->updateProjectByCondition($conditions, $data);
    }

    /**
     * 根据工作区ID获取项目ID列表.
     *
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param int $workspaceId 工作区ID
     * @return array 项目ID列表
     */
    public function getProjectIdsByWorkspaceId(DataIsolation $dataIsolation, int $workspaceId): array
    {
        return $this->projectRepository->getProjectIdsByWorkspaceId(
            $workspaceId,
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode()
        );
    }

    /**
     * Get project details.
     */
    public function getProject(int $projectId, string $userId): ProjectEntity
    {
        $project = $this->projectRepository->findById($projectId);
        if (! $project) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }

        // Check permissions
        if ($project->getUserId() !== $userId) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
        }

        return $project;
    }

    public function getProjectNotUserId(int $projectId): ?ProjectEntity
    {
        $project = $this->projectRepository->findById($projectId);
        if ($project === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND);
        }
        return $project;
    }

    /**
     * Get projects by conditions
     * 根据条件获取项目列表，支持分页和排序.
     */
    public function getProjectsByConditions(
        array $conditions = [],
        int $page = 1,
        int $pageSize = 10,
        string $orderBy = 'updated_at',
        string $orderDirection = 'desc'
    ): array {
        return $this->projectRepository->getProjectsByConditions($conditions, $page, $pageSize, $orderBy, $orderDirection);
    }

    /**
     * Save project entity
     * Directly save project entity without redundant queries.
     * @param ProjectEntity $projectEntity Project entity
     * @return ProjectEntity Saved project entity
     */
    public function saveProjectEntity(ProjectEntity $projectEntity): ProjectEntity
    {
        return $this->projectRepository->save($projectEntity);
    }

    public function updateProjectStatus(int $id, int $topicId, TaskStatus $taskStatus)
    {
        $conditions = [
            'id' => $id,
        ];
        $currentTime = date('Y-m-d H:i:s');
        $data = [
            'current_topic_id' => $topicId,
            'current_topic_status' => $taskStatus->value,
            'updated_at' => $currentTime,
        ];

        return $this->projectRepository->updateProjectByCondition($conditions, $data);
    }

    public function updateProjectMode(int $id, string $topicMode): bool
    {
        $projectEntity = $this->projectRepository->findById($id);
        if (! $projectEntity || ! empty($projectEntity->getProjectMode())) {
            return false;
        }
        $projectEntity->setProjectMode($topicMode);
        $projectEntity->setUpdatedAt(date('Y-m-d H:i:s'));
        $this->projectRepository->save($projectEntity);
        return true;
    }

    public function getProjectForkCount(int $projectId): int
    {
        return $this->projectForkRepository->getForkCountByProjectId($projectId);
    }

    public function findByForkProjectId(int $forkProjectId): ?ProjectForkEntity
    {
        return $this->projectForkRepository->findByForkProjectId($forkProjectId);
    }

    /**
     * Fork project.
     */
    public function forkProject(
        int $sourceProjectId,
        int $targetWorkspaceId,
        string $targetProjectName,
        string $userId,
        string $userOrganizationCode
    ): array {
        // Check if user already has a running fork for this project
        if ($this->projectForkRepository->hasRunningFork($userId, $sourceProjectId)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_FORK_ALREADY_RUNNING, trans('project.fork_already_running'));
        }

        // Get source project entity
        $sourceProject = $this->projectRepository->findById($sourceProjectId);
        if (! $sourceProject) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, trans('project.project_not_found'));
        }

        $currentTime = date('Y-m-d H:i:s');

        // Create forked project entity
        $forkedProject = $this->createForkedProjectFromSource(
            $sourceProject,
            $targetWorkspaceId,
            $targetProjectName,
            $userId,
            $userOrganizationCode,
            $currentTime
        );

        // Save forked project
        $forkedProject = $this->projectRepository->create($forkedProject);

        // Count total files in source project
        $totalFiles = $this->taskFileRepository->countFilesByProjectId($sourceProjectId);

        // Create fork record
        $projectFork = new ProjectForkEntity();
        $projectFork->setSourceProjectId($sourceProjectId)
            ->setForkProjectId($forkedProject->getId())
            ->setTargetWorkspaceId($targetWorkspaceId)
            ->setUserId($userId)
            ->setUserOrganizationCode($userOrganizationCode)
            ->setStatus(ForkStatus::RUNNING->value)
            ->setProgress(0)
            ->setTotalFiles($totalFiles)
            ->setProcessedFiles(0)
            ->setCreatedUid($userId)
            ->setUpdatedUid($userId)
            ->setCreatedAt($currentTime)
            ->setUpdatedAt($currentTime);

        $projectFork = $this->projectForkRepository->create($projectFork);

        return [$forkedProject, $projectFork];
    }

    public function getForkProjectRecordById(int $forkId): ?ProjectForkEntity
    {
        return $this->projectForkRepository->findById($forkId);
    }

    /**
     * Move project to another workspace.
     * @param int $sourceProjectId Source project ID
     * @param null|int $targetWorkspaceId Target workspace ID (null means move to no workspace)
     * @param string $userId User ID performing the move
     */
    public function moveProject(int $sourceProjectId, ?int $targetWorkspaceId, string $userId): ProjectEntity
    {
        return Db::transaction(function () use ($sourceProjectId, $targetWorkspaceId, $userId) {
            $currentTime = date('Y-m-d H:i:s');

            // Get the source project first to return updated entity
            $sourceProject = $this->projectRepository->findById($sourceProjectId);
            if (! $sourceProject) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, trans('project.project_not_found'));
            }

            // Get original workspace ID for topic and task updates
            $originalWorkspaceId = $sourceProject->getWorkspaceId();

            // Check if project is already in target workspace
            if ($originalWorkspaceId === $targetWorkspaceId) {
                // Project is already in the target workspace, no need to move
                return $sourceProject;
            }

            // Update project workspace_id
            $projectUpdateResult = $this->projectRepository->updateProjectByCondition(
                ['id' => $sourceProjectId],
                [
                    'workspace_id' => $targetWorkspaceId,
                    'updated_uid' => $userId,
                    'updated_at' => $currentTime,
                ]
            );

            if (! $projectUpdateResult) {
                ExceptionBuilder::throw(SuperAgentErrorCode::UPDATE_PROJECT_FAILED, trans('project.project_update_failed'));
            }

            // Update topics workspace_id
            $topicUpdateResult = $this->topicRepository->updateTopicByCondition(
                [
                    'project_id' => $sourceProjectId,
                    'workspace_id' => $originalWorkspaceId,
                ],
                [
                    'workspace_id' => $targetWorkspaceId,
                    'updated_at' => $currentTime,
                ]
            );

            // Update tasks workspace_id
            $taskUpdateResult = $this->taskRepository->updateTaskByCondition(
                [
                    'project_id' => $sourceProjectId,
                    'workspace_id' => $originalWorkspaceId,
                ],
                [
                    'workspace_id' => $targetWorkspaceId,
                    'updated_at' => $currentTime,
                ]
            );

            // Return updated project entity
            $updatedProject = $this->projectRepository->findById($sourceProjectId);
            if (! $updatedProject) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, trans('project.project_not_found'));
            }

            // todo 记录操作日志

            return $updatedProject;
        });
    }

    /**
     * 更新项目的updated_at时间.
     */
    public function updateUpdatedAtToNow(int $projectId): bool
    {
        return $this->projectRepository->updateUpdatedAtToNow($projectId);
    }

    public function getOrganizationCodesByProjectIds(array $projectIds): array
    {
        return $this->projectRepository->getOrganizationCodesByProjectIds($projectIds);
    }

    /**
     * Batch get project names by IDs.
     *
     * @param array $projectIds Project ID array
     * @return array ['project_id' => 'project_name'] key-value pairs
     */
    public function getProjectNamesBatch(array $projectIds): array
    {
        if (empty($projectIds)) {
            return [];
        }

        return $this->projectRepository->getProjectNamesBatch($projectIds);
    }

    /**
     * 批量获取项目的workspace_id.
     *
     * @param array $projectIds 项目ID列表
     * @return array 项目ID => workspace_id的映射 ['project_id' => workspace_id]
     */
    public function getWorkspaceIdsByProjectIds(array $projectIds): array
    {
        if (empty($projectIds)) {
            return [];
        }

        return $this->projectRepository->getWorkspaceIdsByProjectIds($projectIds);
    }

    /**
     * 查找用户在指定工作区下的隐藏项目（根据隐藏类型）.
     *
     * @param int $workspaceId 工作区ID
     * @param string $userId 用户ID
     * @param int $hiddenType 隐藏类型（HiddenType枚举的值）
     * @return null|ProjectEntity 返回隐藏项目实体，如果不存在则返回null
     */
    public function findHiddenProjectByWorkspaceAndUser(int $workspaceId, string $userId, int $hiddenType): ?ProjectEntity
    {
        return $this->projectRepository->findHiddenProjectByWorkspaceAndUser($workspaceId, $userId, $hiddenType);
    }

    public function findAllHiddenProjectsByWorkspaceAndUser(int $workspaceId, string $userId, int $hiddenType): array
    {
        return $this->projectRepository->findAllHiddenProjectsByWorkspaceAndUser($workspaceId, $userId, $hiddenType);
    }

    /**
     * Get project count for multiple workspaces.
     * Batch query optimized for performance.
     *
     * @param array $workspaceIds Workspace ID array
     * @param DataIsolation $dataIsolation Data isolation object
     * @return array ['workspace_id' => count, ...] Map of workspace ID to project count
     */
    public function getProjectCountByWorkspaceIds(
        array $workspaceIds,
        DataIsolation $dataIsolation
    ): array {
        if (empty($workspaceIds)) {
            return [];
        }

        return $this->projectRepository->countProjectsByWorkspaceIds(
            $workspaceIds,
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode()
        );
    }

    /**
     * Count ungrouped projects by mode with cache.
     *
     * @param string $userId User ID
     * @param string $userOrganizationCode User organization code
     * @param ProjectMode $projectMode Project mode
     * @return int Count of ungrouped projects
     */
    public function countUngroupedProjectsByMode(string $userId, string $userOrganizationCode, ProjectMode $projectMode): int
    {
        $cacheKey = sprintf(self::CACHE_KEY_UNGROUPED_COUNT, $userId, $userOrganizationCode, $projectMode->value);

        try {
            // Try to get from cache
            $cachedValue = $this->cache->get($cacheKey);
            if ($cachedValue !== null) {
                return (int) $cachedValue;
            }
        } catch (Throwable $e) {
            // Log cache error but continue
            $this->logger->warning('Failed to get cache for ungrouped projects count', [
                'user_id' => $userId,
                'user_organization_code' => $userOrganizationCode,
                'project_mode' => $projectMode->value,
                'error' => $e->getMessage(),
            ]);
        }

        // Query from repository
        $count = $this->projectRepository->countUngroupedProjectsByMode($userId, $userOrganizationCode, $projectMode->value);

        try {
            // Set cache with TTL
            $this->cache->set($cacheKey, (string) $count, self::CACHE_TTL_UNGROUPED_COUNT);
        } catch (Throwable $e) {
            // Log cache error but don't throw
            $this->logger->warning('Failed to set cache for ungrouped projects count', [
                'user_id' => $userId,
                'user_organization_code' => $userOrganizationCode,
                'project_mode' => $projectMode->value,
                'count' => $count,
                'error' => $e->getMessage(),
            ]);
        }

        return $count;
    }

    /**
     * Clear ungrouped projects count cache by mode.
     *
     * @param string $userId User ID
     * @param string $userOrganizationCode User organization code
     * @param ProjectMode $projectMode Project mode
     */
    public function clearUngroupedProjectCountCacheByMode(string $userId, string $userOrganizationCode, ProjectMode $projectMode): void
    {
        $cacheKey = sprintf(self::CACHE_KEY_UNGROUPED_COUNT, $userId, $userOrganizationCode, $projectMode->value);

        try {
            $this->cache->delete($cacheKey);
        } catch (Throwable $e) {
            // Log cache error but don't throw
            $this->logger->warning('Failed to delete cache for ungrouped projects count', [
                'user_id' => $userId,
                'user_organization_code' => $userOrganizationCode,
                'project_mode' => $projectMode->value,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Detach workspace from projects.
     * Set workspace_id to null for all projects under the workspace.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param int $workspaceId Workspace ID
     * @return bool Whether the operation succeeded
     */
    public function detachWorkspaceFromProjects(DataIsolation $dataIsolation, int $workspaceId): bool
    {
        return $this->projectRepository->detachWorkspace($workspaceId, $dataIsolation->getCurrentUserId());
    }

    /**
     * Update project hidden status.
     *
     * @param int $projectId Project ID
     * @param bool $isHidden Hidden status
     * @return bool Whether the update succeeded
     */
    public function updateHiddenStatus(int $projectId, bool $isHidden): bool
    {
        return $this->projectRepository->updateHiddenStatus($projectId, $isHidden);
    }

    /**
     * Batch enable collaboration for projects.
     */
    public function batchEnableCollaboration(array $projectIds): int
    {
        return $this->projectRepository->batchEnableCollaboration($projectIds);
    }

    public function getProjectByTopicId(int $topicId): ?ProjectEntity
    {
        return $this->projectRepository->getProjectByTopicId($topicId);
    }

    /**
     * Create forked project from source project.
     */
    private function createForkedProjectFromSource(
        ProjectEntity $sourceProject,
        int $targetWorkspaceId,
        string $targetProjectName,
        string $userId,
        string $userOrganizationCode,
        string $currentTime
    ): ProjectEntity {
        $forkedProject = new ProjectEntity();
        $forkedProject->setUserId($userId)
            ->setUserOrganizationCode($userOrganizationCode)
            ->setWorkspaceId($targetWorkspaceId)
            ->setProjectName($targetProjectName)
            ->setProjectDescription($sourceProject->getProjectDescription())
            ->setWorkDir('') // Will be set later during file migration
            ->setProjectMode($sourceProject->getProjectMode())
            ->setProjectStatus(ProjectStatus::ACTIVE->value)
            ->setCurrentTopicId(null)
            ->setCurrentTopicStatus('')
            ->setIsCollaborationEnabled(true)
            ->setCreatedUid($userId)
            ->setUpdatedUid($userId)
            ->setCreatedAt($currentTime)
            ->setUpdatedAt($currentTime);

        return $forkedProject;
    }
}

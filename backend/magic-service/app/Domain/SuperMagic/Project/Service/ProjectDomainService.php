<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Project\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Common\Entity\ValueObject\CreationSource;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\Message\Service\MessageScheduleDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ProjectForkEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ForkStatus;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectStatus;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectForkRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectMemberSettingRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskStatus;
use App\Domain\SuperMagic\Task\Repository\Facade\TaskRepositoryInterface;
use App\Domain\SuperMagic\Topic\Repository\Facade\TopicRepositoryInterface;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Psr\SimpleCache\CacheInterface;
use RuntimeException;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * Project Domain Service.
 */
class ProjectDomainService
{
    private const CACHE_KEY_UNGROUPED_COUNT = 'project_ungrouped_count:%s:%s:%s';

    private const CACHE_TTL_UNGROUPED_COUNT = 60;

    /**
     * A fork record whose progress has not advanced for this long is treated as abandoned.
     * Must stay well above the consumer's lock TTL so a slow but live migration is never reclaimed.
     */
    private const FORK_STALE_TIMEOUT_SECONDS = 900;

    private LoggerInterface $logger;

    public function __construct(
        private readonly ProjectRepositoryInterface $projectRepository,
        private readonly ProjectForkRepositoryInterface $projectForkRepository,
        private readonly ProjectMemberSettingRepositoryInterface $projectMemberSettingRepository,
        private readonly TaskFileRepositoryInterface $taskFileRepository,
        private readonly TopicRepositoryInterface $topicRepository,
        private readonly TaskRepositoryInterface $taskRepository,
        private readonly MessageScheduleDomainService $messageScheduleDomainService,
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

    /** @return ProjectEntity[] */
    public function getProjectsForWorkspaceDeletion(int $workspaceId): array
    {
        return $this->projectRepository->findByWorkspaceIdForDeletion($workspaceId);
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
        string $orderDirection = 'desc',
        bool $pinPriority = false
    ): array {
        return $this->projectRepository->getProjectsByConditions(
            $conditions,
            $page,
            $pageSize,
            $orderBy,
            $orderDirection,
            $pinPriority
        );
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
        string $userOrganizationCode,
        ?string $projectMode = null
    ): array {
        // A live migration refreshes updated_at on every processed batch, so a running record left
        // untouched past the timeout has lost its consumer and will never finish. Reclaim it here,
        // otherwise a single lost migration blocks every later copy of the same project forever.
        $staleBefore = date('Y-m-d H:i:s', time() - self::FORK_STALE_TIMEOUT_SECONDS);
        if ($this->projectForkRepository->failStaleRunningForks($userId, $sourceProjectId, $staleBefore, 'File migration failed')) {
            $this->logger->warning(sprintf(
                'Reclaimed abandoned fork of project %d for user %s, no progress since %s',
                $sourceProjectId,
                $userId,
                $staleBefore
            ));
        }

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
            $currentTime,
            $projectMode
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
     * Mark a running fork record as failed.
     *
     * Returns false when the record is missing or already in a terminal state, so callers may
     * invoke it defensively without overwriting a more accurate failure recorded earlier.
     */
    public function markForkRecordFailed(int $forkId, string $errMsg): bool
    {
        $forkRecord = $this->projectForkRepository->findById($forkId);
        if ($forkRecord === null || $forkRecord->getStatus() !== ForkStatus::RUNNING) {
            return false;
        }

        return $this->projectForkRepository->updateStatus(
            $forkId,
            ForkStatus::FAILED->value,
            $forkRecord->getProgress(),
            $errMsg
        );
    }

    /**
     * Move project to another workspace.
     * @param int $sourceProjectId Source project ID
     * @param null|int $targetWorkspaceId Target workspace ID (null means move to no workspace)
     * @param string $userId User ID performing the move
     * @param null|string $targetProjectName Target project name, null means keep the current name
     */
    public function moveProject(
        int $sourceProjectId,
        ?int $targetWorkspaceId,
        string $userId,
        ?string $targetProjectName = null,
        ?string $projectMode = null,
        ?int $preProjectId = null,
        ?int $nextProjectId = null,
        bool $sortProvided = false
    ): ProjectEntity {
        return Db::transaction(function () use ($sourceProjectId, $targetWorkspaceId, $userId, $targetProjectName, $projectMode, $preProjectId, $nextProjectId, $sortProvided) {
            $currentTime = date('Y-m-d H:i:s');

            // Get the source project first to return updated entity
            $sourceProject = $this->projectRepository->findById($sourceProjectId);
            if (! $sourceProject) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, trans('project.project_not_found'));
            }

            // Get original workspace ID for topic and task updates
            $originalWorkspaceId = $sourceProject->getWorkspaceId();
            $workspaceChanged = $originalWorkspaceId !== $targetWorkspaceId;
            $projectNameChanged = $targetProjectName !== null
                && $targetProjectName !== $sourceProject->getProjectName();
            $projectModeChanged = $projectMode !== null
                && $projectMode !== $sourceProject->getProjectMode();

            // Check if project is already in target workspace with the target name
            if (! $workspaceChanged && ! $projectNameChanged && ! $projectModeChanged && ! $sortProvided) {
                return $sourceProject;
            }

            // A sort-only request must not mutate the project's business timestamp.
            $projectUpdateData = [];
            if ($workspaceChanged || $projectNameChanged || $projectModeChanged) {
                $projectUpdateData = [
                    'workspace_id' => $targetWorkspaceId,
                    'updated_uid' => $userId,
                    'updated_at' => $currentTime,
                ];
            }
            if ($projectNameChanged) {
                $projectUpdateData['project_name'] = $targetProjectName;
            }
            if ($projectModeChanged) {
                $projectUpdateData['project_mode'] = $projectMode;
            }

            if ($projectUpdateData !== []) {
                $projectUpdateResult = $this->projectRepository->updateProjectByCondition(
                    ['id' => $sourceProjectId],
                    $projectUpdateData
                );

                if (! $projectUpdateResult) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::UPDATE_PROJECT_FAILED, trans('project.project_update_failed'));
                }
            }

            if ($workspaceChanged) {
                // Manual positions are scoped to the source workspace. Clear
                // them without changing the project's pin state; the pin API
                // can assign a precise position in the destination workspace.
                $this->projectMemberSettingRepository->clearManualSortOrders($userId, $sourceProjectId);
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
                // 路线 C：task 表无 project_id 索引，先经 topics 表（含已软删话题）取 topic_id，再按 topic_id 一次性更新
                $topicIds = $this->topicRepository->getTopicIdsByCondition(
                    [
                        'project_id' => $sourceProjectId,
                        'workspace_id' => $originalWorkspaceId,
                    ],
                    true
                );
                if ($topicIds !== []) {
                    $this->taskRepository->updateTaskByCondition(
                        [
                            'topic_id' => $topicIds,
                        ],
                        [
                            'workspace_id' => $targetWorkspaceId,
                            'updated_at' => $currentTime,
                        ]
                    );
                }

                $this->messageScheduleDomainService->syncMovedProjectSchedules(
                    [$sourceProjectId],
                    $userId,
                    $sourceProject->getUserOrganizationCode(),
                    (int) ($targetWorkspaceId ?? 0),
                    $userId
                );

                $this->syncOwnerWorkspaceBinding($sourceProject, $targetWorkspaceId);
            }

            if ($sortProvided) {
                $this->applyProjectSortOrderForBatch(
                    $userId,
                    $sourceProject->getUserOrganizationCode(),
                    $sourceProjectId,
                    $targetWorkspaceId,
                    $preProjectId,
                    $nextProjectId
                );
            }

            // Return updated project entity
            $updatedProject = $this->projectRepository->findById($sourceProjectId);
            if (! $updatedProject) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, trans('project.project_not_found'));
            }

            // todo 记录操作日志

            return $updatedProject;
        });
    }

    public function applyProjectSortOrderForBatch(
        string $userId,
        string $organizationCode,
        int $projectId,
        ?int $workspaceId,
        ?int $preProjectId,
        ?int $nextProjectId = null
    ): void {
        $this->applyProjectSortOrderForGroup($userId, $organizationCode, $projectId, $workspaceId, $preProjectId, $nextProjectId, false);
    }

    public function applyProjectSortOrderForGroup(
        string $userId,
        string $organizationCode,
        int $projectId,
        ?int $workspaceId,
        ?int $preProjectId,
        ?int $nextProjectId = null,
        bool $targetPinned = false
    ): void {
        if ($workspaceId === null) {
            if ($preProjectId !== null || $nextProjectId !== null) {
                throw new RuntimeException('Cannot set relative project order without a target workspace');
            }
            return;
        }

        // `pre_project_id` wins when both relative-position parameters are supplied.
        $targetProjectId = $preProjectId ?? $nextProjectId;
        $insertAfter = $preProjectId !== null;
        if ($targetProjectId === null) {
            // An explicit null relative-position value is a no-op. Omitting
            // both fields is handled by the application service and never
            // enters this method.
            return;
        }

        if ($targetProjectId === $projectId) {
            throw new RuntimeException('Relative project cannot be the current project');
        }

        $targetProject = $this->projectRepository->findById($targetProjectId);
        if ($targetProject === null || $targetProject->getWorkspaceId() !== $workspaceId) {
            throw new RuntimeException('Relative project is not in the target workspace');
        }

        $workspaceProjectIds = $this->projectRepository->getProjectIdsByWorkspaceId(
            $workspaceId,
            $userId,
            $organizationCode
        );
        // The target may be a collaboration project that is visible to the
        // current user but is not owned by them, so include it explicitly
        // when lazily creating the user's settings row.
        $workspaceProjectIds[] = (string) $targetProjectId;
        $this->projectMemberSettingRepository->ensureSettingsForSorting(
            $userId,
            array_map('intval', $workspaceProjectIds),
            $organizationCode
        );

        $targetSetting = $this->projectMemberSettingRepository->findByUserAndProject($userId, $targetProjectId);
        if ($targetSetting === null) {
            throw new RuntimeException('Relative project setting is invalid');
        }
        if ($targetSetting->isPinned() !== $targetPinned) {
            throw new RuntimeException('Relative project is not in the target ordering group');
        }

        $rows = $this->projectMemberSettingRepository->getSortOrderRows(
            $userId,
            $workspaceId,
            $projectId,
            $targetPinned
        );
        $orderedIds = array_map(static fn (array $row): int => $row['id'], $rows);
        $sortOrderMap = [];
        foreach ($rows as $row) {
            $value = $targetPinned ? $row['pinned_sort_order'] : $row['sort_order'];
            if ($value !== null) {
                $sortOrderMap[$row['id']] = $value;
            }
        }
        if (! in_array($targetProjectId, $orderedIds, true)) {
            throw new RuntimeException('Relative project is not in the target ordering group');
        }

        $allHaveSortOrder = $rows !== [] && array_reduce(
            $rows,
            static function (bool $carry, array $row) use ($targetPinned): bool {
                $value = $targetPinned ? $row['pinned_sort_order'] : $row['sort_order'];
                return $carry && $value !== null;
            },
            true
        );
        if (! $allHaveSortOrder) {
            $initial = [];
            $rank = 1_000_000;
            foreach ($orderedIds as $id) {
                $initial[$id] = $rank;
                $rank += 1_000_000;
            }
            if ($targetPinned) {
                $this->projectMemberSettingRepository->batchUpdatePinnedSortOrders($userId, $initial);
            } else {
                $this->projectMemberSettingRepository->batchUpdateSortOrdersForMove($userId, $initial);
            }
            $sortOrderMap = $initial;
        }

        $index = array_search($targetProjectId, $orderedIds, true);
        $insertPosition = $insertAfter ? $index + 1 : $index;
        array_splice($orderedIds, $insertPosition, 0, [$projectId]);

        $position = $insertPosition;
        $previousSortOrder = $position > 0 ? $sortOrderMap[$orderedIds[$position - 1]] : null;
        $nextSortOrder = $position + 1 < count($orderedIds) ? $sortOrderMap[$orderedIds[$position + 1]] : null;

        if ($previousSortOrder === null && $nextSortOrder !== null) {
            $newSortOrder = $nextSortOrder - 1_000_000;
        } elseif ($previousSortOrder !== null && $nextSortOrder === null) {
            $newSortOrder = $previousSortOrder + 1_000_000;
        } elseif ($previousSortOrder !== null && $nextSortOrder !== null
            && $nextSortOrder - $previousSortOrder > 1
        ) {
            $newSortOrder = intdiv($previousSortOrder + $nextSortOrder, 2);
        } else {
            $sortOrders = [];
            $rank = 1_000_000;
            foreach ($orderedIds as $id) {
                $sortOrders[$id] = $rank;
                $rank += 1_000_000;
            }
            if ($targetPinned) {
                $this->projectMemberSettingRepository->batchUpdatePinnedSortOrders($userId, $sortOrders);
            } else {
                $this->projectMemberSettingRepository->batchUpdateSortOrdersForMove($userId, $sortOrders);
            }
            $newSortOrder = $sortOrders[$projectId];
        }

        if ($targetPinned) {
            $this->projectMemberSettingRepository->updatePinnedSortOrder($userId, $projectId, $organizationCode, $newSortOrder);
        } else {
            $this->projectMemberSettingRepository->updateSortOrderForMove($userId, $projectId, $organizationCode, $newSortOrder);
        }
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
     * Batch get current topic IDs indexed by project ID.
     * Used to resolve sandbox IDs for batch sandbox status queries.
     * Returns null for projects that have no current topic assigned.
     *
     * @param int[] $projectIds Project ID array
     * @return array<int, null|int> Map of projectId => currentTopicId (null if none)
     */
    public function getTopicIdMapByProjectIds(array $projectIds): array
    {
        if (empty($projectIds)) {
            return [];
        }

        $projects = $this->projectRepository->findByIds($projectIds);
        $result = [];
        foreach ($projects as $project) {
            $result[$project->getId()] = $project->getCurrentTopicId();
        }

        return $result;
    }

    public function getCurrentTopicSandboxId(int $projectId): ?string
    {
        $project = $this->getProjectNotUserId($projectId);
        $topicId = $project->getCurrentTopicId();
        if (empty($topicId)) {
            return null;
        }

        $topic = $this->topicRepository->getTopicById((int) $topicId);
        if ($topic === null) {
            return null;
        }

        $sandboxId = $topic->getSandboxId();
        return $sandboxId === '' ? null : $sandboxId;
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
     * 按 ID 查询项目，不存在时返回 null（不抛错）.
     */
    public function findProjectByIdOrNull(int $projectId): ?ProjectEntity
    {
        return $this->projectRepository->findById($projectId);
    }

    /**
     * Keep the project owner's personal workspace binding aligned with project moves.
     */
    private function syncOwnerWorkspaceBinding(ProjectEntity $project, ?int $targetWorkspaceId): void
    {
        if ($targetWorkspaceId === null) {
            $this->projectMemberSettingRepository->cancelProjectShortcut(
                $project->getUserId(),
                $project->getId()
            );
            return;
        }

        $this->projectMemberSettingRepository->setProjectShortcut(
            $project->getUserId(),
            $project->getId(),
            $targetWorkspaceId,
            $project->getUserOrganizationCode()
        );
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
        string $currentTime,
        ?string $projectMode = null
    ): ProjectEntity {
        $forkedProject = new ProjectEntity();
        $forkedProject->setUserId($userId)
            ->setUserOrganizationCode($userOrganizationCode)
            ->setWorkspaceId($targetWorkspaceId)
            ->setProjectName($targetProjectName)
            ->setProjectDescription($sourceProject->getProjectDescription())
            ->setWorkDir('') // Will be set later during file migration
            ->setProjectMode($projectMode ?? $sourceProject->getProjectMode())
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

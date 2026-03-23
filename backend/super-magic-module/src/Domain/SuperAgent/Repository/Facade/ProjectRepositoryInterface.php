<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;

/**
 * 项目仓储接口.
 */
interface ProjectRepositoryInterface
{
    /**
     * 根据ID查找项目.
     */
    public function findById(int $id): ?ProjectEntity;

    /**
     * 保存项目.
     */
    public function save(ProjectEntity $project): ProjectEntity;

    public function create(ProjectEntity $project): ProjectEntity;

    /**
     * 删除项目（软删除）.
     */
    public function delete(ProjectEntity $project): bool;

    /**
     * 批量获取项目信息.
     */
    public function findByIds(array $ids): array;

    /**
     * 根据条件获取项目列表
     * 支持分页和排序.
     */
    public function getProjectsByConditions(
        array $conditions = [],
        int $page = 1,
        int $pageSize = 10,
        string $orderBy = 'updated_at',
        string $orderDirection = 'desc'
    ): array;

    public function updateProjectByCondition(array $condition, array $data): bool;

    /**
     * 更新项目的updated_at为当前时间.
     */
    public function updateUpdatedAtToNow(int $projectId): bool;

    /**
     * 根据工作区ID获取项目ID列表.
     *
     * @param int $workspaceId 工作区ID
     * @param string $userId 用户ID
     * @param string $organizationCode 组织代码
     * @return array 项目ID列表
     */
    public function getProjectIdsByWorkspaceId(int $workspaceId, string $userId, string $organizationCode): array;

    /**
     * Batch get project names by IDs.
     *
     * @param array $projectIds Project ID array
     * @return array ['project_id' => 'project_name'] key-value pairs
     */
    public function getProjectNamesBatch(array $projectIds): array;

    /**
     * 批量获取项目的workspace_id.
     *
     * @param array $projectIds 项目ID列表
     * @return array 项目ID => workspace_id的映射 ['project_id' => workspace_id]
     */
    public function getWorkspaceIdsByProjectIds(array $projectIds): array;

    public function getOrganizationCodesByProjectIds(array $projectIds): array;

    /**
     * Batch update projects owner.
     *
     * @param array $projectIds Project IDs to update
     * @param string $newUserId New owner user ID
     * @return int Number of updated projects
     */
    public function batchUpdateOwner(array $projectIds, string $newUserId): int;

    /**
     * Batch update projects workspace and owner.
     *
     * @param array $projectIds Project IDs to update
     * @param int $newWorkspaceId New workspace ID
     * @param string $newUserId New owner user ID
     * @return int Number of updated projects
     */
    public function batchUpdateWorkspaceAndOwner(
        array $projectIds,
        int $newWorkspaceId,
        string $newUserId
    ): int;

    /**
     * Batch update projects workspace.
     *
     * @param array $projectIds Project IDs to update
     * @param null|int $workspaceId New workspace ID (null means move to no workspace)
     * @param string $updatedAt Updated timestamp
     * @return int Number of updated projects
     */
    public function batchUpdateWorkspace(array $projectIds, ?int $workspaceId, string $updatedAt): int;

    /**
     * Find projects by IDs and user ID.
     *
     * @param array $projectIds Project IDs
     * @param string $userId User ID
     * @return array Array of ProjectEntity
     */
    public function findByUserIdAndIds(array $projectIds, string $userId): array;

    /**
     * Find projects by IDs with user and organization filter.
     *
     * @param array $projectIds Project IDs
     * @param string $userId User ID
     * @param string $organizationCode Organization code
     * @return array Array of ProjectEntity
     */
    public function findByIdsWithAuth(array $projectIds, string $userId, string $organizationCode): array;

    /**
     * 查找用户在指定工作区下的隐藏项目（根据隐藏类型）.
     *
     * @param int $workspaceId 工作区ID
     * @param string $userId 用户ID
     * @param int $hiddenType 隐藏类型（HiddenType枚举的值）
     * @return null|ProjectEntity 返回隐藏项目实体，如果不存在则返回null
     */
    public function findHiddenProjectByWorkspaceAndUser(int $workspaceId, string $userId, int $hiddenType): ?ProjectEntity;

    /**
     * 查找用户在指定工作区下的所有隐藏项目（根据隐藏类型）.
     *
     * @param int $workspaceId 工作区ID
     * @param string $userId 用户ID
     * @param int $hiddenType 隐藏类型（HiddenType枚举的值）
     * @return array<ProjectEntity> 返回隐藏项目实体数组
     */
    public function findAllHiddenProjectsByWorkspaceAndUser(int $workspaceId, string $userId, int $hiddenType): array;

    /**
     * Batch count projects by workspace IDs.
     * Performance optimized with single GROUP BY query.
     *
     * @param array $workspaceIds Workspace ID array
     * @param string $userId User ID for data isolation
     * @param string $orgCode Organization code for data isolation
     * @return array ['workspace_id' => count, ...] Map of workspace ID to project count
     */
    public function countProjectsByWorkspaceIds(
        array $workspaceIds,
        string $userId,
        string $orgCode
    ): array;

    /**
     * Count ungrouped projects by mode for a user.
     *
     * @param string $userId User ID
     * @param string $userOrganizationCode User organization code
     * @param string $projectMode Project mode (from ProjectMode enum)
     * @return int Count of ungrouped projects
     */
    public function countUngroupedProjectsByMode(string $userId, string $userOrganizationCode, string $projectMode): int;

    /**
     * Update workspace_id to null for projects under specified workspace.
     *
     * @param int $workspaceId Workspace ID
     * @param string $userId User ID who performs the operation
     * @return bool Whether the operation succeeded
     */
    public function detachWorkspace(int $workspaceId, string $userId): bool;

    /**
     * Update project hidden status.
     *
     * @param int $projectId Project ID
     * @param bool $isHidden Hidden status (true or false)
     * @return bool Whether the operation succeeded
     */
    public function updateHiddenStatus(int $projectId, bool $isHidden): bool;

    /**
     * Batch enable collaboration for projects.
     *
     * @param array $projectIds Project ID array
     * @return int Number of updated projects
     */
    public function batchEnableCollaboration(array $projectIds): int;

    public function getProjectByTopicId(int $topicId): ?ProjectEntity;
}

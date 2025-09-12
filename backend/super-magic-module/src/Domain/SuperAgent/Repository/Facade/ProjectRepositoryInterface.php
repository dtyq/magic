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
}

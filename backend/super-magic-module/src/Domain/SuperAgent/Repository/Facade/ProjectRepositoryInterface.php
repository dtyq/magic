<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;

/**
 * 项目仓储接口
 */
interface ProjectRepositoryInterface
{
    /**
     * 根据ID查找项目
     */
    public function findById(int $id): ?ProjectEntity;

    /**
     * 根据工作区ID和用户ID查找项目列表
     */
    public function findByWorkspaceIdAndUserId(int $workspaceId, string $userId): array;

    /**
     * 根据用户ID获取项目列表（支持分页）
     */
    public function findByUserId(string $userId, ?Page $page = null): array;

    /**
     * 根据用户ID获取最近使用的项目列表
     */
    public function findRecentProjectsByUserId(string $userId, int $limit = 10): array;

    /**
     * 根据用户ID和组织编码获取项目列表
     */
    public function findByUserIdAndOrganizationCode(string $userId, string $organizationCode, ?Page $page = null): array;

    /**
     * 保存项目
     */
    public function save(ProjectEntity $project): ProjectEntity;

    /**
     * 删除项目（软删除）
     */
    public function delete(ProjectEntity $project): bool;

    /**
     * 根据项目名称和工作区ID查找项目
     */
    public function findByProjectNameAndWorkspaceId(string $projectName, int $workspaceId): ?ProjectEntity;

    /**
     * 检查项目是否存在
     */
    public function exists(int $id): bool;

    /**
     * 统计用户的项目数量
     */
    public function countByUserId(string $userId): int;

    /**
     * 统计工作区下的项目数量
     */
    public function countByWorkspaceId(int $workspaceId): int;

    /**
     * 批量获取项目信息
     */
    public function findByIds(array $ids): array;

    public function updateProjectByCondition(array $condition, array $data): bool;
}
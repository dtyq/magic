<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectMemberEntity;

/**
 * 项目成员仓储接口.
 *
 * 提供项目成员数据的持久化操作
 */
interface ProjectMemberRepositoryInterface
{
    /**
     * 批量插入项目成员.
     *
     * @param ProjectMemberEntity[] $projectMemberEntities 项目成员实体数组
     */
    public function insert(array $projectMemberEntities): void;

    /**
     * 根据项目ID删除所有成员.
     *
     * @param int $projectId 项目ID
     * @return int 删除的记录数
     */
    public function deleteByProjectId(int $projectId): int;

    /**
     * 根据ID数组批量删除成员.
     *
     * @param array $ids 成员ID数组
     * @return int 删除的记录数
     */
    public function deleteByIds(array $ids): int;

    /**
     * 检查项目和用户的成员关系是否存在.
     *
     * @param int $projectId 项目ID
     * @param string $userId 用户ID
     * @return bool 存在返回true，否则返回false
     */
    public function existsByProjectAndUser(int $projectId, string $userId): bool;

    /**
     * 检查项目和部门列表的成员关系是否存在.
     *
     * @param int $projectId 项目ID
     * @param array $departmentIds 部门ID数组
     * @return bool 存在返回true，否则返回false
     */
    public function existsByProjectAndDepartments(int $projectId, array $departmentIds): bool;

    /**
     * 根据项目ID获取所有项目成员.
     *
     * @param int $projectId 项目ID
     * @return ProjectMemberEntity[] 项目成员实体数组
     */
    public function findByProjectId(int $projectId): array;

    /**
     * 根据用户和部门获取项目ID列表及总数.
     *
     * @param string $userId 用户ID
     * @param array $departmentIds 部门ID数组
     * @param null|string $name 项目名称模糊搜索关键词
     * @return array ['total' => int, 'list' => array]
     */
    public function getProjectIdsByUserAndDepartments(
        string $userId,
        array $departmentIds = [],
        ?string $name = null,
        ?string $sortField = null,
        string $sortDirection = 'desc',
        array $creatorUserIds = []
    ): array;

    /**
     * 批量获取项目成员总数.
     *
     * @param array $projectIds 项目ID数组
     * @return array [project_id => total_count]
     */
    public function getProjectMembersCounts(array $projectIds): array;

    /**
     * 批量获取项目前N个成员预览.
     *
     * @param array $projectIds 项目ID数组
     * @param int $limit 限制数量，默认4个
     * @return array [project_id => [['target_type' => '', 'target_id' => ''], ...]]
     */
    public function getProjectMembersPreview(array $projectIds, int $limit = 4): array;

    /**
     * 获取用户创建的且有成员的项目ID列表及总数.
     *
     * @return array ['total' => int, 'list' => array]
     */
    public function getSharedProjectIdsByUser(
        string $userId,
        string $organizationCode,
        ?string $name = null,
        int $page = 1,
        int $pageSize = 10,
        ?string $sortField = null,
        string $sortDirection = 'desc',
        array $creatorUserIds = []
    ): array;

    /**
     * 获取协作项目的创建者用户ID列表.
     *
     * @param string $userId 当前用户ID
     * @param array $departmentIds 用户所在部门ID数组
     * @param string $organizationCode 组织代码
     * @return array 创建者用户ID数组
     */
    public function getCollaborationProjectCreatorIds(
        string $userId,
        array $departmentIds,
        string $organizationCode
    ): array;

    /**
     * 获取用户参与的项目列表（支持协作项目筛选和工作区绑定筛选）.
     *
     * @param string $userId 用户ID
     * @param int $workspaceId 工作区ID
     * @param bool $showCollaboration 是否显示协作项目
     * @param null|string $projectName 项目名称模糊搜索
     * @param int $page 页码
     * @param int $pageSize 每页大小
     * @param string $sortField 排序字段
     * @param string $sortDirection 排序方向
     * @return array ['total' => int, 'list' => array]
     */
    public function getParticipatedProjects(
        string $userId,
        ?int $workspaceId,
        bool $showCollaboration = true,
        ?string $projectName = null,
        int $page = 1,
        int $pageSize = 10,
        string $sortField = 'last_active_at',
        string $sortDirection = 'desc'
    ): array;
}
